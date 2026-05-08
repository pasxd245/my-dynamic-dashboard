from __future__ import annotations

import json
import uuid
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

from app.core.config import metadata_db_path, parquet_root_dir
from app.core.metadata_db import (
    get_connection,
    init_metadata_db,
    persist_manifest_snapshot,
    persist_role_assignment,
)
from app.schemas import (
    ApiErrorModel,
    ColumnSchema,
    ColumnProfileResponse,
    CreateRelationshipRuleRequest,
    ErrorResponse,
    ManifestImportRequest,
    ManifestResponse,
    ReadinessStatusResponse,
    RelationshipRuleDetailResponse,
    RelationshipRuleListResponse,
    RelationshipRuleResponse,
    ReviewRelationshipRuleRequest,
    RoleAssignmentRequest,
    RoleAssignmentResponse,
    RoleAssignmentResult,
    SheetOverrideRequest,
    SheetResponse,
    SourceUploadResponse,
    TableSummary,
    QueryConfig,
    UpdateRelationshipRuleRequest,
    UploadTableResponse,
    ValidateQueryResponse,
    WorkspaceCreateRequest,
    WorkspaceProfileResponse,
    WorkspaceResponse,
)
from app.services.profile_service import compute_column_profile, compute_profiles
from app.services.profile_service import validate_role_compatibility
from app.services.manifest_service import (
    collect_source_hash_mismatches,
    compute_source_hash,
    export_workspace_manifest,
    import_workspace_manifest,
    split_manifest_hash,
    validate_manifest_hash,
)
from app.services.relationship_service import (
    compute_overlap_pct,
    create_relationship_rule,
    delete_rule,
    get_rule_detail,
    list_rules,
    review_rule,
    update_rule,
)
from app.services.query_builder_service import JoinGraphValidator, QueryConfigValidator, SqlTranslator
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

app = FastAPI(title="My Dynamic Dashboard Backend")

DB_PATH = metadata_db_path()
PARQUET_ROOT = parquet_root_dir()


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, object] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


QUERY_ERROR_STATUS_BY_CODE = {
    "VALIDATION_ERROR": 400,
    "TIMEOUT": 408,
    "UNAPPROVED_RELATIONSHIP": 409,
    "MEMORY_ERROR": 413,
}


def raise_query_error(
    code: str,
    message: str,
    details: dict[str, object] | None = None,
) -> None:
    status_code = QUERY_ERROR_STATUS_BY_CODE.get(code, 400)
    raise ApiError(status_code=status_code, code=code, message=message, details=details)


@app.on_event("startup")
def startup_event() -> None:
    init_metadata_db(DB_PATH)


@app.exception_handler(ApiError)
def handle_api_error(_: object, exc: ApiError) -> JSONResponse:
    payload = ErrorResponse(
        error=ApiErrorModel(code=exc.code, message=exc.message, details=exc.details)
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


@app.exception_handler(HTTPException)
def handle_http_error(_: object, exc: HTTPException) -> JSONResponse:
    message = str(exc.detail)
    payload = ErrorResponse(error=ApiErrorModel(code="http_error", message=message))
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/workspaces")
def create_workspace(request: WorkspaceCreateRequest) -> WorkspaceResponse:
    workspace_id = str(uuid.uuid4())
    now = utc_now_iso()

    with get_connection(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO workspaces (id, name, status, manifest_version, content_hash, created_at, updated_at)
            VALUES (?, ?, 'draft', 1, NULL, ?, ?)
            """,
            (workspace_id, request.name, now, now),
        )

    return WorkspaceResponse(
        id=workspace_id,
        name=request.name,
        status="draft",
        manifest_version=1,
    )


def _get_workspace(workspace_id: str) -> dict:
    with get_connection(DB_PATH) as conn:
        row = conn.execute(
            "SELECT id, name, status, manifest_version FROM workspaces WHERE id = ?",
            (workspace_id,),
        ).fetchone()

    if row is None:
        raise ApiError(status_code=404, code="workspace_not_found", message="Workspace not found")

    return {
        "id": str(row["id"]),
        "name": str(row["name"]),
        "status": str(row["status"]),
        "manifest_version": int(row["manifest_version"]),
    }


@app.post("/api/v1/workspaces/{workspace_id}/queries/validate")
def validate_query(workspace_id: str, request: QueryConfig) -> ValidateQueryResponse:
    _get_workspace(workspace_id)

    validator = QueryConfigValidator()
    join_validator = JoinGraphValidator()
    translator = SqlTranslator()

    issues = validator.validate(request)
    issues.extend(join_validator.validate_joins(request.base_table_id, request.joins))

    has_errors = any(issue.severity == "error" for issue in issues)
    if has_errors:
        return ValidateQueryResponse(valid=False, issues=issues)

    sql, _ = translator.translate(request)
    return ValidateQueryResponse(valid=True, issues=issues, sql_preview=sql)


@app.post(
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

    now = utc_now_iso()
    source_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())
    data_range = detect_data_range(df)
    profiles = compute_column_profiles(df)
    profile_df, sampled, sample_size, sample_seed = compute_profiles(df)
    warnings: list[str] = []

    with get_connection(DB_PATH) as conn:
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


@app.patch("/api/v1/workspaces/{workspace_id}/sheets/{sheet_id}/override")
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

    with get_connection(DB_PATH) as conn:
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

@app.get("/api/v1/workspaces/{workspace_id}/profile")
def get_workspace_profile(workspace_id: str) -> WorkspaceProfileResponse:
    _get_workspace(workspace_id)

    with get_connection(DB_PATH) as conn:
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


@app.put("/api/v1/workspaces/{workspace_id}/columns/{column_id}/roles")
def assign_column_roles(
    workspace_id: str,
    column_id: str,
    request: RoleAssignmentRequest,
) -> RoleAssignmentResponse:
    _get_workspace(workspace_id)

    with get_connection(DB_PATH) as conn:
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


@app.get("/api/v1/workspaces/{workspace_id}/readiness")
def get_workspace_readiness(workspace_id: str) -> ReadinessStatusResponse:
    _get_workspace(workspace_id)

    required_roles = ["identity_key", "time_anchor", "measure", "source_of_truth_outcome"]
    critical_warning_codes = {"mixed_type_values", "date_out_of_range", "sentinel_values_detected"}

    with get_connection(DB_PATH) as conn:
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


@app.post("/api/v1/workspaces/{workspace_id}/manifest/export")
def export_manifest(workspace_id: str) -> ManifestResponse:
    workspace = _get_workspace(workspace_id)

    with get_connection(DB_PATH) as conn:
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


@app.post("/api/v1/workspaces/manifest/import")
def import_manifest(request: ManifestImportRequest) -> WorkspaceResponse:
    try:
        validate_manifest_hash(request.manifest)
    except ValueError as exc:
        raise ApiError(
            status_code=400,
            code="invalid_manifest_hash",
            message=str(exc),
        ) from exc

    with get_connection(DB_PATH) as conn:
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


@app.post("/api/v1/workspaces/{workspace_id}/relationships", status_code=201)
def create_relationship(
    workspace_id: str,
    request: CreateRelationshipRuleRequest,
) -> RelationshipRuleResponse:
    _get_workspace(workspace_id)

    if request.join_type not in {"inner", "left", "right", "full"}:
        raise ApiError(
            400,
            "invalid_join_type",
            "join_type must be one of: inner, left, right, full",
        )
    if request.rel_type not in {"exact_key", "normalized_key", "date_window"}:
        raise ApiError(
            400,
            "invalid_rel_type",
            "rel_type must be one of: exact_key, normalized_key, date_window",
        )

    with get_connection(DB_PATH) as conn:
        for col_id in [request.from_column_id, request.to_column_id]:
            col = conn.execute(
                """SELECT c.id FROM columns c
                   JOIN sheets s ON s.id = c.sheet_id
                   JOIN source_files sf ON sf.id = s.source_file_id
                   WHERE c.id = ? AND sf.workspace_id = ?""",
                (col_id, workspace_id),
            ).fetchone()
            if col is None:
                raise ApiError(
                    404,
                    "column_not_found",
                    f"Column {col_id} not found in workspace",
                )

        overlap = compute_overlap_pct(conn, request.from_column_id, request.to_column_id)
        if overlap < 0.80 and not request.low_overlap_acknowledged:
            raise ApiError(
                409,
                "low_overlap_unacknowledged",
                f"Overlap is {overlap:.1%}. Set low_overlap_acknowledged=true to proceed.",
            )

        now = utc_now_iso()
        rule = create_relationship_rule(
            conn,
            workspace_id=workspace_id,
            from_column_id=request.from_column_id,
            to_column_id=request.to_column_id,
            join_type=request.join_type,
            rel_type=request.rel_type,
            low_overlap_acknowledged=request.low_overlap_acknowledged,
            actor="user",
            now=now,
        )
    return RelationshipRuleResponse(**rule)


@app.get("/api/v1/workspaces/{workspace_id}/relationships")
def list_relationships(workspace_id: str) -> RelationshipRuleListResponse:
    _get_workspace(workspace_id)
    with get_connection(DB_PATH) as conn:
        rules = list_rules(conn, workspace_id)
    return RelationshipRuleListResponse(
        items=[RelationshipRuleResponse(**item) for item in rules]
    )


@app.get("/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}")
def get_relationship(
    workspace_id: str,
    relationship_id: str,
) -> RelationshipRuleDetailResponse:
    _get_workspace(workspace_id)
    with get_connection(DB_PATH) as conn:
        rule = get_rule_detail(conn, relationship_id)
    if rule is None:
        raise ApiError(404, "relationship_not_found", "Relationship not found")
    return RelationshipRuleDetailResponse(**rule)


@app.patch("/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review")
def review_relationship(
    workspace_id: str,
    relationship_id: str,
    request: ReviewRelationshipRuleRequest,
) -> RelationshipRuleResponse:
    _get_workspace(workspace_id)
    if request.action not in {"reviewed", "approved", "rejected"}:
        raise ApiError(400, "invalid_action", "action must be: reviewed, approved, or rejected")

    with get_connection(DB_PATH) as conn:
        try:
            rule = review_rule(
                conn,
                rule_id=relationship_id,
                workspace_id=workspace_id,
                action=request.action,
                reason=request.reason,
                override_reason=request.override_reason,
                actor="user",
                now=utc_now_iso(),
            )
        except ValueError as exc:
            message = str(exc)
            if message == "not_found":
                raise ApiError(404, "relationship_not_found", "Relationship not found") from exc
            if message == "overlap_too_low":
                raise ApiError(
                    409,
                    "overlap_too_low",
                    "Overlap < 5%. Provide override_reason to approve.",
                ) from exc
            raise ApiError(
                400,
                "invalid_transition",
                f"Cannot perform '{request.action}' from current status.",
            ) from exc
    return RelationshipRuleResponse(**rule)


@app.put("/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}")
def update_relationship(
    workspace_id: str,
    relationship_id: str,
    request: UpdateRelationshipRuleRequest,
) -> RelationshipRuleResponse:
    _get_workspace(workspace_id)
    if request.join_type not in {"inner", "left", "right", "full"}:
        raise ApiError(
            400,
            "invalid_join_type",
            "join_type must be one of: inner, left, right, full",
        )
    if request.rel_type not in {"exact_key", "normalized_key", "date_window"}:
        raise ApiError(
            400,
            "invalid_rel_type",
            "rel_type must be one of: exact_key, normalized_key, date_window",
        )

    with get_connection(DB_PATH) as conn:
        for col_id in [request.from_column_id, request.to_column_id]:
            col = conn.execute(
                """SELECT c.id FROM columns c
                   JOIN sheets s ON s.id = c.sheet_id
                   JOIN source_files sf ON sf.id = s.source_file_id
                   WHERE c.id = ? AND sf.workspace_id = ?""",
                (col_id, workspace_id),
            ).fetchone()
            if col is None:
                raise ApiError(
                    404,
                    "column_not_found",
                    f"Column {col_id} not found in workspace",
                )

        try:
            rule = update_rule(
                conn,
                rule_id=relationship_id,
                workspace_id=workspace_id,
                from_column_id=request.from_column_id,
                to_column_id=request.to_column_id,
                join_type=request.join_type,
                rel_type=request.rel_type,
                actor="user",
                now=utc_now_iso(),
            )
        except ValueError as exc:
            raise ApiError(404, "relationship_not_found", "Relationship not found") from exc
    return RelationshipRuleResponse(**rule)


@app.delete("/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}", status_code=204, response_class=Response, response_model=None)
def delete_relationship(workspace_id: str, relationship_id: str) -> Response:
    _get_workspace(workspace_id)
    with get_connection(DB_PATH) as conn:
        try:
            delete_rule(
                conn,
                rule_id=relationship_id,
                workspace_id=workspace_id,
                actor="user",
                now=utc_now_iso(),
            )
        except ValueError as exc:
            raise ApiError(404, "relationship_not_found", "Relationship not found") from exc
    return Response(status_code=204)


@app.post(
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

    with get_connection(DB_PATH) as conn:
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

    parquet_path = save_parquet(df=df, parquet_root=PARQUET_ROOT, table_id=table_id, version=version)
    result = build_upload_result(
        filename=filename,
        df=df,
        parquet_path=parquet_path,
        version=version,
        previous_schema_hash=previous_schema_hash,
    )

    with get_connection(DB_PATH) as conn:
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


@app.get("/api/v1/tables")
def list_tables() -> list[TableSummary]:
    with get_connection(DB_PATH) as conn:
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
