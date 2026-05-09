from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.logging import correlation_id_ctx
from app.schemas import ActionableError


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def with_correlation_details(details: dict[str, object] | None = None) -> dict[str, object]:
    enriched = dict(details or {})
    correlation_id = correlation_id_ctx.get()
    if correlation_id and "correlation_id" not in enriched:
        enriched["correlation_id"] = correlation_id
    return enriched


def build_actionable_error(
    *,
    error_code: str,
    stage: str,
    user_message: str,
    next_steps: list[str],
    technical_details: dict[str, Any] | None = None,
) -> ActionableError:
    return ActionableError(
        error_code=error_code,
        stage=stage,
        user_message=user_message,
        next_steps=next_steps,
        technical_details=technical_details,
        correlation_id=correlation_id_ctx.get() or "unknown",
        occurred_at_utc=_utc_now_iso(),
    )


def actionable_stage_for_path(path: str) -> str | None:
    if path.endswith("/sources/upload"):
        return "upload_source"
    if path.endswith("/profile") or "/columns/" in path and path.endswith("/roles"):
        return "schema_sheet"
    if "/query/" in path or "/queries/" in path:
        return "query"
    if "/saved-queries" in path:
        return "results_saved"
    return None


def default_next_steps_for_stage(stage: str) -> list[str]:
    if stage == "upload_source":
        return [
            "Confirm workspace selection",
            "Check file format and content",
            "Retry the upload action",
        ]
    if stage == "schema_sheet":
        return [
            "Confirm workspace and source are available",
            "Resolve profile or role issues",
            "Retry this action",
        ]
    if stage == "query":
        return [
            "Confirm active workspace and source context",
            "Fix query or validation inputs",
            "Retry query action",
        ]
    if stage == "results_saved":
        return [
            "Confirm active workspace and source context",
            "Verify saved-query filters or query state",
            "Retry saved-query action",
        ]
    return ["Retry this action"]


def build_actionable_error_from_api_error(
    *,
    path: str,
    error_code: str,
    user_message: str,
    technical_details: dict[str, Any] | None,
) -> ActionableError | None:
    stage = actionable_stage_for_path(path)
    if stage is None:
        return None

    normalized_code = error_code.upper()
    return build_actionable_error(
        error_code=normalized_code,
        stage=stage,
        user_message=user_message,
        next_steps=default_next_steps_for_stage(stage),
        technical_details=technical_details,
    )
