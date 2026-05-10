from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response

from app.api import ApiError, _get_workspace
from app.apps.relationship_app import RELATIONSHIP_APP
from app.core.metadata_db import get_connection
from app.schemas import (
    CreateRelationshipRuleRequest,
    RelationshipRuleDetailResponse,
    RelationshipRuleListResponse,
    RelationshipRuleResponse,
    ReviewRelationshipRuleRequest,
    UpdateRelationshipRuleRequest,
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
from app.services.upload_service import utc_now_iso

router = APIRouter(tags=["relationships"])


@router.post("/api/v1/workspaces/{workspace_id}/relationships", status_code=201)
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

    with get_connection(RELATIONSHIP_APP.metadata_db_path()) as conn:
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


@router.get("/api/v1/workspaces/{workspace_id}/relationships")
def list_relationships(workspace_id: str) -> RelationshipRuleListResponse:
    _get_workspace(workspace_id)
    with get_connection(RELATIONSHIP_APP.metadata_db_path()) as conn:
        rules = list_rules(conn, workspace_id)
    return RelationshipRuleListResponse(items=[RelationshipRuleResponse(**item) for item in rules])


@router.get("/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}")
def get_relationship(
    workspace_id: str,
    relationship_id: str,
) -> RelationshipRuleDetailResponse:
    _get_workspace(workspace_id)
    with get_connection(RELATIONSHIP_APP.metadata_db_path()) as conn:
        rule = get_rule_detail(conn, relationship_id)
    if rule is None:
        raise ApiError(404, "relationship_not_found", "Relationship not found")
    return RelationshipRuleDetailResponse(**rule)


@router.patch("/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review")
def review_relationship(
    workspace_id: str,
    relationship_id: str,
    request: ReviewRelationshipRuleRequest,
) -> RelationshipRuleResponse:
    _get_workspace(workspace_id)
    if request.action not in {"reviewed", "approved", "rejected"}:
        raise ApiError(400, "invalid_action", "action must be: reviewed, approved, or rejected")

    with get_connection(RELATIONSHIP_APP.metadata_db_path()) as conn:
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


@router.put("/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}")
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

    with get_connection(RELATIONSHIP_APP.metadata_db_path()) as conn:
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


@router.delete(
    "/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}",
    status_code=204,
    response_class=Response,
    response_model=None,
)
def delete_relationship(workspace_id: str, relationship_id: str) -> Response:
    _get_workspace(workspace_id)
    with get_connection(RELATIONSHIP_APP.metadata_db_path()) as conn:
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
