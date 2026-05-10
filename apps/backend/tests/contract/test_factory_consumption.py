from __future__ import annotations

from tests.factories import make_export_workflow_payload


def test_contract_layer_consumes_export_payload_factory() -> None:
    payload = make_export_workflow_payload(execution_timeout_seconds=7)

    assert payload["result_limit"] is None
    assert payload["execution_timeout_seconds"] == 7
    assert payload["selected_columns"][0]["column_name"] == "region"
