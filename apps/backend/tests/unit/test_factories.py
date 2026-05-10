from __future__ import annotations

from tests.factories import make_query_payload, make_source_file, make_workspace


def test_domain_factories_provide_deterministic_defaults() -> None:
    workspace = make_workspace()
    source = make_source_file()
    payload = make_query_payload()

    assert workspace["id"] == "ws-001"
    assert source["id"] == "src-001"
    assert source["uploaded_at"] == "2026-01-01T00:00:00Z"
    assert payload["execution_timeout_seconds"] == 5


def test_domain_factories_apply_overrides_explicitly() -> None:
    workspace = make_workspace(name="custom-name")
    source = make_source_file(index=9, filename_original="override.csv")
    payload = make_query_payload(result_limit=25)

    assert workspace["name"] == "custom-name"
    assert source["id"] == "src-009"
    assert source["filename_original"] == "override.csv"
    assert payload["result_limit"] == 25
