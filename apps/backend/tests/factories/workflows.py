"""Workflow composition factories for upload, preview, and export flows."""

from __future__ import annotations

from typing import Any

from .base import with_overrides
from .domain import make_query_payload, make_source_file, make_workspace


def make_upload_workflow_context(**overrides: Any) -> dict[str, Any]:
    workspace = make_workspace()
    source = make_source_file(workspace_id=workspace["id"])
    base = {
        "workspace": workspace,
        "source": source,
    }
    return with_overrides(base, **overrides)


def make_preview_workflow_payload(**overrides: Any) -> dict[str, Any]:
    payload = make_query_payload(result_limit=100)
    return with_overrides(payload, **overrides)


def make_export_workflow_payload(**overrides: Any) -> dict[str, Any]:
    payload = make_query_payload(result_limit=None)
    return with_overrides(payload, **overrides)
