from __future__ import annotations

import json
import uuid
from typing import Annotated

from fastapi import APIRouter, File, UploadFile

from app.api import ApiError, _get_workspace
from app.apps.upload_app import UPLOAD_APP
from app.apps.workspace_app import WORKSPACE_APP
from app.core.metadata_db import (
	get_connection,
	persist_manifest_snapshot,
	persist_role_assignment,
)
from app.schemas import (
	BuilderSessionState,
	ColumnProfileResponse,
	ColumnSchema,
	ConnectionStatus,
	ManifestImportRequest,
	ManifestResponse,
	ReadinessStatusResponse,
	RoleAssignmentRequest,
	RoleAssignmentResponse,
	RoleAssignmentResult,
	SheetOverrideRequest,
	SheetResponse,
	SmokeFlowResult,
	SmokeRunRequest,
	SourceUploadResponse,
	TableSummary,
	UploadTableResponse,
	WorkspaceProfileResponse,
	WorkspaceResponse,
)
from app.services.builder_smoke_service import BuilderSmokeService
from app.services.manifest_service import (
	collect_source_hash_mismatches,
	compute_source_hash,
	export_workspace_manifest,
	import_workspace_manifest,
	split_manifest_hash,
	validate_manifest_hash,
)
from app.services.preflight_service import PreflightService
from app.services.profile_service import (
	compute_column_profile,
	compute_profiles,
	validate_role_compatibility,
)
from app.services.upload_service import (
	build_upload_result,
	compute_column_profiles,
	detect_data_range,
	normalize_effective_type,
	read_dataframe,
	save_parquet,
	slugify_filename,
	utc_now_iso,
)
router = APIRouter(tags=["upload"])


PREFLIGHT_SERVICE: PreflightService | None = None
BUILDER_SMOKE_SERVICE = BuilderSmokeService()


def _preflight_service() -> PreflightService:
	return UPLOAD_APP.preflight_service()


def _builder_smoke_service() -> BuilderSmokeService:
	return UPLOAD_APP.builder_smoke_service()


@router.get("/api/v1/builder/preflight")
def get_builder_preflight() -> ConnectionStatus:
	return _preflight_service().evaluate()


@router.get("/api/v1/builder/session-state")
def get_builder_session_state(current_stage: str | None = None) -> BuilderSessionState:
	requested_stage: str | None = None
	if current_stage:
		candidate = current_stage.strip()
		if candidate in {"upload_source", "schema_sheet", "query", "results_saved"}:
			requested_stage = candidate
	return WORKSPACE_APP.builder_session_service().build_default_state(
		connection_status=_preflight_service().evaluate(),
		current_stage=requested_stage,
	)


@router.post("/api/v1/ops/smoke/builder-workflow")
def run_builder_workflow_smoke(request: SmokeRunRequest | None = None) -> SmokeFlowResult:
	payload = request or SmokeRunRequest()
	return _builder_smoke_service().run_workflow_smoke(payload)


@router.get("/api/v1/ops/smoke/builder-workflow/{run_id}")
def get_builder_workflow_smoke(run_id: str) -> SmokeFlowResult:
	result = _builder_smoke_service().get_run(run_id)
	if result is None:
		raise ApiError(status_code=404, code="smoke_run_not_found", message="Smoke run not found")
	return result


@router.post(
	"/api/v1/workspaces/{workspace_id}/sources/upload",
	responses={400: {"description": "Unsupported, encrypted, or malformed file."}},
)
async def upload_source_for_workspace(
	workspace_id: str,
	file: Annotated[UploadFile, File(...)],
) -> SourceUploadResponse:
	_get_workspace(workspace_id)

	filename = file.filename or ""
	lower_name = filename.lower()
	if not lower_name.endswith((".csv", ".xlsx", ".xlsm", ".xlsb", ".xls")):
		raise ApiError(
			status_code=400,
			code="unsupported_file",
			message="Unsupported file type. Only .csv, .xlsx, .xlsm, .xlsb, and .xls are allowed.",
		)

	file_bytes = await file.read()

	try:
		df = read_dataframe(filename=filename, file_bytes=file_bytes)
	except Exception as exc:
		lowered = str(exc).lower()
		if "password" in lowered or "encrypted" in lowered:
			raise ApiError(
				status_code=400,
				code="encrypted_file",
				message="Encrypted Excel files are not supported.",
			) from exc
		raise ApiError(
			status_code=400,
			code="parse_failed",
			message=f"Unable to parse file: {exc}",
		) from exc

	if df.width == 0:
		raise ApiError(
			status_code=400,
			code="empty_sheet",
			message="Uploaded file has no columns or rows. Please provide a sheet with tabular data.",
		)

	now = utc_now_iso()
	source_id = str(uuid.uuid4())
	sheet_id = str(uuid.uuid4())
	data_range = detect_data_range(df)
	profiles = compute_column_profiles(df)
	profile_df, sampled, sample_size, sample_seed = compute_profiles(df)
	warnings: list[str] = []

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		conn.execute(
			"""
			INSERT INTO source_files (
				id, workspace_id, filename_original, extension, content_hash,
				encoding_detected, parse_status, reject_reason, uploaded_at
			) VALUES (?, ?, ?, ?, ?, ?, 'parsed', NULL, ?)
			""",
			(
				source_id,
				workspace_id,
				filename,
				filename.rsplit(".", 1)[-1].lower(),
				compute_source_hash(file_bytes),
				"utf-8" if lower_name.endswith(".csv") else None,
				now,
			),
		)
		conn.execute(
			"""
			INSERT INTO sheets (
				id, source_file_id, sheet_name,
				header_row_detected, header_row_effective,
				data_range_detected, data_range_effective,
				multi_range_warning, committed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
			""",
			(
				sheet_id,
				source_id,
				"Sheet1",
				1,
				1,
				data_range,
				data_range,
				now,
			),
		)

		for index, profile in enumerate(profiles):
			column_id = str(uuid.uuid4())
			conn.execute(
				"""
				INSERT INTO columns (
					id, sheet_id, name, ordinal,
					inferred_type, effective_type,
					type_override_reason, is_all_null
				) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
				""",
				(
					column_id,
					sheet_id,
					profile.name,
					index,
					normalize_effective_type(profile.data_type),
					normalize_effective_type(profile.data_type),
					int(df.get_column(profile.name).null_count() == df.height),
				),
			)

			computed = compute_column_profile(
				profile_df.get_column(profile.name),
				sampled=sampled,
				sample_size=sample_size,
				sample_seed=sample_seed,
			)
			conn.execute(
				"""
				INSERT INTO column_profiles (
					id, column_id, null_ratio, distinct_count, uniqueness_ratio,
					duplicate_signature, numeric_min, numeric_max, date_min, date_max,
					top_k_values_json, warnings_json, sampled, sample_size, sample_seed, computed_at
				) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)
				""",
				(
					str(uuid.uuid4()),
					column_id,
					computed.null_ratio,
					computed.distinct_count,
					computed.uniqueness_ratio,
					computed.duplicate_signature,
					computed.top_k_values_json,
					computed.warnings_json,
					int(computed.sampled),
					computed.sample_size,
					computed.sample_seed,
					now,
				),
			)

	return SourceUploadResponse(
		source_id=source_id,
		warnings=warnings,
		sheets=[
			SheetResponse(
				id=sheet_id,
				name="Sheet1",
				header_row_effective=1,
				data_range_effective=data_range,
			)
		],
	)


@router.patch("/api/v1/workspaces/{workspace_id}/sheets/{sheet_id}/override")
def override_sheet_range(
	workspace_id: str,
	sheet_id: str,
	request: SheetOverrideRequest,
) -> SheetResponse:
	if request.header_row is None and request.data_range is None:
		raise ApiError(
			status_code=400,
			code="invalid_override",
			message="At least one of header_row or data_range is required.",
		)

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		row = conn.execute(
			"""
			SELECT s.id, s.sheet_name, s.header_row_effective, s.data_range_effective
			FROM sheets s
			JOIN source_files sf ON sf.id = s.source_file_id
			WHERE s.id = ? AND sf.workspace_id = ?
			""",
			(sheet_id, workspace_id),
		).fetchone()

		if row is None:
			raise ApiError(status_code=404, code="sheet_not_found", message="Sheet not found")

		new_header = request.header_row or int(row["header_row_effective"])
		new_range = request.data_range or str(row["data_range_effective"])
		now = utc_now_iso()

		conn.execute(
			"""
			UPDATE sheets
			SET header_row_effective = ?, data_range_effective = ?, committed_at = ?
			WHERE id = ?
			""",
			(new_header, new_range, now, sheet_id),
		)

		if request.reason:
			old_value_json = json.dumps(
				{
					"header_row": int(row["header_row_effective"]),
					"data_range": str(row["data_range_effective"]),
				},
				separators=(",", ":"),
				sort_keys=True,
			)
			new_value_json = json.dumps(
				{"header_row": new_header, "data_range": new_range},
				separators=(",", ":"),
				sort_keys=True,
			)
			conn.execute(
				"""
				INSERT INTO override_logs (
					id, workspace_id, target_kind, target_id,
					old_value_json, new_value_json, reason, actor, created_at
				) VALUES (?, ?, 'sheet_range', ?, ?, ?, ?, 'user', ?)
				""",
				(
					str(uuid.uuid4()),
					workspace_id,
					sheet_id,
					old_value_json,
					new_value_json,
					request.reason,
					now,
				),
			)

		return SheetResponse(
			id=str(row["id"]),
			name=str(row["sheet_name"]),
			header_row_effective=new_header,
			data_range_effective=new_range,
		)


@router.get("/api/v1/workspaces/{workspace_id}/profile")
def get_workspace_profile(workspace_id: str) -> WorkspaceProfileResponse:
	_get_workspace(workspace_id)

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		rows = conn.execute(
			"""
			SELECT c.id AS column_id, c.name AS column_name, c.effective_type,
				   cp.null_ratio, cp.distinct_count, cp.uniqueness_ratio,
				   cp.warnings_json, cp.sampled, cp.sample_size, cp.sample_seed
			FROM columns c
			JOIN sheets s ON s.id = c.sheet_id
			JOIN source_files sf ON sf.id = s.source_file_id
			JOIN column_profiles cp ON cp.column_id = c.id
			WHERE sf.workspace_id = ?
			ORDER BY c.ordinal ASC
			""",
			(workspace_id,),
		).fetchall()

	profiles = [
		ColumnProfileResponse(
			column_id=str(row["column_id"]),
			column_name=str(row["column_name"]),
			effective_type=str(row["effective_type"]),
			null_ratio=float(row["null_ratio"]),
			distinct_count=int(row["distinct_count"]),
			uniqueness_ratio=float(row["uniqueness_ratio"]),
			warnings=json.loads(str(row["warnings_json"])),
			sampled=bool(row["sampled"]),
			sample_size=None if row["sample_size"] is None else int(row["sample_size"]),
			sample_seed=None if row["sample_seed"] is None else int(row["sample_seed"]),
		)
		for row in rows
	]

	return WorkspaceProfileResponse(columns=profiles)


@router.put("/api/v1/workspaces/{workspace_id}/columns/{column_id}/roles")
def assign_column_roles(
	workspace_id: str,
	column_id: str,
	request: RoleAssignmentRequest,
) -> RoleAssignmentResponse:
	_get_workspace(workspace_id)

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		context = conn.execute(
			"""
			SELECT c.id AS column_id, c.effective_type, cp.uniqueness_ratio
			FROM columns c
			JOIN sheets s ON s.id = c.sheet_id
			JOIN source_files sf ON sf.id = s.source_file_id
			JOIN column_profiles cp ON cp.column_id = c.id
			WHERE sf.workspace_id = ? AND c.id = ?
			""",
			(workspace_id, column_id),
		).fetchone()

		if context is None:
			raise ApiError(status_code=404, code="column_not_found", message="Column not found")

		assigned_at = utc_now_iso()
		results: list[RoleAssignmentResult] = []

		for role in request.roles:
			compatibility = validate_role_compatibility(
				role=role,
				effective_type=str(context["effective_type"]),
				uniqueness_ratio=float(context["uniqueness_ratio"]),
				has_override_reason=bool(request.override_reason),
			)

			if not compatibility.accepted:
				raise ApiError(
					status_code=422,
					code="compatibility_violation",
					message=compatibility.reason or "Role compatibility violation",
				)

			persist_role_assignment(
				conn,
				workspace_id=workspace_id,
				column_id=column_id,
				role=role,
				override_used=compatibility.override_required,
				override_reason=request.override_reason,
				assigned_by="user",
				assigned_at=assigned_at,
			)

			results.append(
				RoleAssignmentResult(
					column_id=column_id,
					role=role,
					accepted=True,
					override_used=compatibility.override_required,
					override_reason=request.override_reason,
					assigned_at=assigned_at,
				)
			)

	return RoleAssignmentResponse(assignments=results)


@router.get("/api/v1/workspaces/{workspace_id}/readiness")
def get_workspace_readiness(workspace_id: str) -> ReadinessStatusResponse:
	_get_workspace(workspace_id)

	required_roles = ["identity_key", "time_anchor", "measure", "source_of_truth_outcome"]
	critical_warning_codes = {"mixed_type_values", "date_out_of_range", "sentinel_values_detected"}

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		role_rows = conn.execute(
			"""
			SELECT DISTINCT ra.role
			FROM role_assignments ra
			JOIN columns c ON c.id = ra.column_id
			JOIN sheets s ON s.id = c.sheet_id
			JOIN source_files sf ON sf.id = s.source_file_id
			WHERE sf.workspace_id = ? AND ra.accepted = 1
			""",
			(workspace_id,),
		).fetchall()
		assigned_roles = {str(row["role"]) for row in role_rows}

		warning_rows = conn.execute(
			"""
			SELECT ra.role, cp.warnings_json
			FROM role_assignments ra
			JOIN columns c ON c.id = ra.column_id
			JOIN sheets s ON s.id = c.sheet_id
			JOIN source_files sf ON sf.id = s.source_file_id
			JOIN column_profiles cp ON cp.column_id = c.id
			WHERE sf.workspace_id = ? AND ra.accepted = 1
			""",
			(workspace_id,),
		).fetchall()

	missing_required = [role for role in required_roles if role not in assigned_roles]
	unresolved_critical: list[str] = []

	for row in warning_rows:
		role = str(row["role"])
		warnings = json.loads(str(row["warnings_json"]))
		for warning in warnings:
			if warning in critical_warning_codes:
				unresolved_critical.append(f"{role}:{warning}")

	complete = not missing_required and not unresolved_critical

	return ReadinessStatusResponse(
		complete=complete,
		missing_required_roles=missing_required,
		unresolved_critical_warnings=unresolved_critical,
		surface_role="analysis_workbench",
	)


@router.post("/api/v1/workspaces/{workspace_id}/manifest/export")
def export_manifest(workspace_id: str) -> ManifestResponse:
	workspace = _get_workspace(workspace_id)

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		manifest = export_workspace_manifest(conn, workspace_id)
		_, manifest_hash = split_manifest_hash(manifest)
		exported_at = utc_now_iso()
		persist_manifest_snapshot(
			conn,
			workspace_id=workspace_id,
			manifest_version=int(workspace["manifest_version"]),
			manifest_json=json.dumps(manifest, separators=(",", ":"), sort_keys=True),
			manifest_hash=manifest_hash or "",
			exported_at=exported_at,
		)
		conn.execute(
			"UPDATE workspaces SET content_hash = ?, updated_at = ? WHERE id = ?",
			(manifest_hash, exported_at, workspace_id),
		)

	return ManifestResponse(**manifest)


@router.post("/api/v1/workspaces/manifest/import")
def import_manifest(request: ManifestImportRequest) -> WorkspaceResponse:
	try:
		validate_manifest_hash(request.manifest)
	except ValueError as exc:
		raise ApiError(
			status_code=400,
			code="invalid_manifest_hash",
			message=str(exc),
		) from exc

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		mismatches = collect_source_hash_mismatches(conn, request.manifest)
		if mismatches:
			raise ApiError(
				status_code=409,
				code="manifest_hash_mismatch",
				message="Source hash mismatch blocked workspace reconstruction.",
				details={"mismatches": mismatches},
			)

		imported_at = utc_now_iso()
		workspace = import_workspace_manifest(conn, request.manifest, imported_at=imported_at)
		persist_manifest_snapshot(
			conn,
			workspace_id=workspace["id"],
			manifest_version=int(workspace["manifest_version"]),
			manifest_json=json.dumps(request.manifest, separators=(",", ":"), sort_keys=True),
			manifest_hash=str(workspace["manifest_hash"]),
			exported_at=imported_at,
		)

	return WorkspaceResponse(
		id=str(workspace["id"]),
		name=str(workspace["name"]),
		status=str(workspace["status"]),
		manifest_version=int(workspace["manifest_version"]),
	)


@router.post(
	"/api/v1/tables/upload",
	responses={400: {"description": "Unsupported or malformed upload file."}},
)
async def upload_table(file: Annotated[UploadFile, File(...)]) -> UploadTableResponse:
	filename = file.filename or ""
	lower_name = filename.lower()

	if not (lower_name.endswith(".csv") or lower_name.endswith(".xlsx")):
		raise ApiError(
			status_code=400,
			code="unsupported_file",
			message="Unsupported file type. Only .csv and .xlsx are allowed.",
		)

	file_bytes = await file.read()

	try:
		df = read_dataframe(filename=filename, file_bytes=file_bytes)
	except Exception as exc:
		raise ApiError(
			status_code=400,
			code="parse_failed",
			message=f"Unable to parse file: {exc}",
		) from exc

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		latest_row = conn.execute(
			"""
			SELECT version, schema_hash
			FROM files
			WHERE filename = ?
			ORDER BY version DESC
			LIMIT 1
			""",
			(filename,),
		).fetchone()

		version = 1 if latest_row is None else int(latest_row["version"]) + 1
		previous_schema_hash = None if latest_row is None else str(latest_row["schema_hash"])

	table_id = slugify_filename(filename)
	parquet_path = save_parquet(df=df, parquet_root=UPLOAD_APP.parquet_root(), table_id=table_id, version=version)
	result = build_upload_result(
		filename=filename,
		df=df,
		parquet_path=parquet_path,
		version=version,
		previous_schema_hash=previous_schema_hash,
	)

	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		conn.execute(
			"""
			INSERT INTO files (
				id, table_id, filename, extension, version, parquet_path,
				row_count, schema_hash, schema_changed, uploaded_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			""",
			(
				result.file_id,
				result.table_id,
				result.filename,
				result.filename.rsplit(".", 1)[-1].lower(),
				result.version,
				result.parquet_path,
				result.row_count,
				result.schema_hash,
				int(result.schema_changed),
				utc_now_iso(),
			),
		)

		for index, column in enumerate(result.columns):
			conn.execute(
				"""
				INSERT INTO file_schemas (
					id, file_id, column_name, data_type, is_nullable, ordinal
				) VALUES (?, ?, ?, ?, ?, ?)
				""",
				(
					str(uuid.uuid4()),
					result.file_id,
					column.name,
					column.data_type,
					int(column.is_nullable),
					index,
				),
			)

	return UploadTableResponse(
		file_id=result.file_id,
		table_id=result.table_id,
		filename=result.filename,
		version=result.version,
		row_count=result.row_count,
		parquet_path=result.parquet_path,
		schema_changed=result.schema_changed,
		schema=[
			ColumnSchema(
				name=column.name,
				data_type=column.data_type,
				is_nullable=column.is_nullable,
			)
			for column in result.columns
		],
	)


@router.get("/api/v1/tables")
def list_tables() -> list[TableSummary]:
	with get_connection(UPLOAD_APP.metadata_db_path()) as conn:
		latest_files = conn.execute(
			"""
			SELECT f.*
			FROM files f
			INNER JOIN (
				SELECT filename, MAX(version) AS max_version
				FROM files
				GROUP BY filename
			) latest
			ON f.filename = latest.filename
			AND f.version = latest.max_version
			ORDER BY f.filename ASC
			"""
		).fetchall()

		summaries: list[TableSummary] = []

		for file_row in latest_files:
			schema_rows = conn.execute(
				"""
				SELECT column_name, data_type, is_nullable
				FROM file_schemas
				WHERE file_id = ?
				ORDER BY ordinal ASC
				""",
				(file_row["id"],),
			).fetchall()

			summaries.append(
				TableSummary(
					file_id=str(file_row["id"]),
					table_id=str(file_row["table_id"]),
					filename=str(file_row["filename"]),
					version=int(file_row["version"]),
					row_count=int(file_row["row_count"]),
					schema_changed=bool(file_row["schema_changed"]),
					schema=[
						ColumnSchema(
							name=str(column_row["column_name"]),
							data_type=str(column_row["data_type"]),
							is_nullable=bool(column_row["is_nullable"]),
						)
						for column_row in schema_rows
					],
				)
			)

	return summaries
