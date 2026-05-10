from __future__ import annotations

from tests.factories import make_preview_workflow_payload, make_upload_workflow_context


def test_integration_layer_consumes_upload_workflow_factory() -> None:
    context = make_upload_workflow_context()
    assert context["workspace"]["id"] == "ws-001"
    assert context["source"]["workspace_id"] == context["workspace"]["id"]


def test_integration_layer_consumes_preview_payload_factory() -> None:
    payload = make_preview_workflow_payload()
    assert payload["result_limit"] == 100
    assert payload["base_table_id"] == "sales"
