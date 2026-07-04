"""R145 § Refresh — whole-table replace, carry-forward, atomicity.

Covers the backend half of F9 (settings carry-forward via commitSettings +
`GET /datasets/{id}/refresh-settings`) and the refresh commit
(`target_dataset_id` → in-place replace), including the acceptance criteria:
identity kept, atomic replace, and existing-dataset-intact on coercion failure.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage import dataset_dir
from tests._conformance import validate_response


def _make_workspace(client: TestClient, name: str = "Marketing") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _csv_upload(client: TestClient, content: bytes, name: str = "export.csv") -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": (name, content, "text/csv")},
    )
    return resp.json()["temp_id"]


_V1 = b"id,name,amount,signed_up\n1,Alice,42.5,2024-01-15\n2,Bob,17.0,2024-02-03\n"
# Cumulative re-export: same schema, more rows (the FM cadence).
_V2 = (
    b"id,name,amount,signed_up\n"
    b"1,Alice,42.5,2024-01-15\n2,Bob,17.0,2024-02-03\n3,Cara,99.0,2024-03-01\n"
)


def _create_dataset(client: TestClient, ws: str, content: bytes = _V1, **item_extra) -> dict:
    temp = _csv_upload(client, content)
    item = {"name": "leads", **item_extra}
    resp = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": temp, "items": [item]})
    assert resp.status_code == 201, resp.text
    return resp.json()[0]


@pytest.mark.unit
def test_refresh_replaces_in_place_keeping_id_and_name() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _V1)
        assert ds["rowCount"] == 2

        # Refresh with a cumulative re-export (3 rows). `name` is sent but IGNORED.
        temp = _csv_upload(client, _V2)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "IGNORED", "target_dataset_id": ds["id"]}]},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        validate_response("datasets/batch-post.contract.yaml", 201, body)
        assert len(body) == 1
        updated = body[0]
        assert updated["id"] == ds["id"]  # identity kept — dependents survive
        assert updated["name"] == "leads"  # target name kept, item.name ignored
        assert updated["rowCount"] == 3  # whole-table replace

        # Rows endpoint serves the new data.
        rows = client.get(f"/datasets/{ds['id']}/rows").json()
        assert rows["total"] == 3


@pytest.mark.unit
def test_refresh_coercion_failure_leaves_existing_dataset_intact() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _V1)  # amount inferred float, 2 rows

        # Refresh, overriding amount → integer; "42.5" cannot cast → 422.
        temp = _csv_upload(client, _V2)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"target_dataset_id": ds["id"], "name": "x", "column_overrides": {"amount": {"dtype": "integer"}}}],
            },
        )
        assert resp.status_code == 422, resp.text
        body = resp.json()
        assert body["code"] == "coercion_failed"
        assert body["column"] == "amount"
        validate_response("datasets/batch-post.contract.yaml", 422, body)

        # Existing dataset fully intact: still 2 rows, amount still float.
        detail = client.get(f"/datasets/{ds['id']}").json()
        assert detail["rowCount"] == 2
        amount_dtype = next(c["dtype"] for c in detail["columns"] if c["name"] == "amount")
        assert amount_dtype == "float"
        assert client.get(f"/datasets/{ds['id']}/rows").json()["total"] == 2


@pytest.mark.unit
def test_refresh_rejects_multi_item_batch() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        temp = _csv_upload(client, _V2)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {"target_dataset_id": ds["id"], "name": "a"},
                    {"target_dataset_id": ds["id"], "name": "b"},
                ],
            },
        )
        assert resp.status_code == 422, resp.text


@pytest.mark.unit
def test_refresh_unknown_target_returns_404() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client, _V2)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"target_dataset_id": "ds_00000000", "name": "x"}]},
        )
        assert resp.status_code == 404


@pytest.mark.unit
def test_commit_settings_persisted_and_readable() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(
            client,
            ws,
            _V1,
            column_overrides={"id": {"dtype": "string"}},
            excluded_columns=["signed_up"],
        )
        resp = client.get(f"/datasets/{ds['id']}/refresh-settings")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        validate_response("datasets/refresh-settings-get.contract.yaml", 200, body)
        assert body["available"] is True
        assert body["column_overrides"]["id"] == {"dtype": "string"}
        assert body["excluded_columns"] == ["signed_up"]


@pytest.mark.unit
def test_refresh_settings_unknown_dataset_404() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets/ds_00000000/refresh-settings")
        assert resp.status_code == 404
        validate_response("datasets/refresh-settings-get.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_refresh_settings_available_false_for_legacy_dataset() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        # Simulate a pre-R145 dataset: strip commitSettings from source.json.
        src_path = dataset_dir(ws, ds["id"]) / "source.json"
        data = json.loads(src_path.read_text())
        data.pop("commitSettings", None)
        src_path.write_text(json.dumps(data))

        body = client.get(f"/datasets/{ds['id']}/refresh-settings").json()
        validate_response("datasets/refresh-settings-get.contract.yaml", 200, body)
        assert body == {"available": False}


def _excel_upload(client: TestClient, content: bytes) -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "excel"},
        files={"file": ("book.xlsx", content, "application/octet-stream")},
    )
    return resp.json()["temp_id"]


@pytest.mark.unit
def test_refresh_unknown_sheet_is_422_not_500_dataset_intact() -> None:
    """R147 — a commit naming a sheet the workbook doesn't have (the renamed-
    sheet cadence: monthly exports date-stamp sheet names) is a typed 422,
    not the R142-F1 opaque 500; the dataset is untouched."""
    from tests._excel import two_sheet_workbook

    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _excel_upload(client, two_sheet_workbook())
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "deals", "sheet": "Deals"}]},
        )
        assert resp.status_code == 201, resp.text
        ds = resp.json()[0]

        # Refresh with a workbook whose sheets are Deals/Contacts, but send
        # a stale sheet name (as a raw client could; the FE now prevents it).
        temp2 = _excel_upload(client, two_sheet_workbook())
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp2, "items": [{"name": "x", "sheet": "Data 12.4", "target_dataset_id": ds["id"]}]},
        )
        assert resp.status_code == 422, resp.text
        assert "parse_failed" in str(resp.json()["detail"])
        # Dataset fully intact.
        assert client.get(f"/datasets/{ds['id']}").json()["rowCount"] == 2


@pytest.mark.unit
def test_create_unknown_sheet_is_422_not_500() -> None:
    from tests._excel import two_sheet_workbook

    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _excel_upload(client, two_sheet_workbook())
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "sheet": "Nope"}]},
        )
        assert resp.status_code == 422, resp.text
        assert "parse_failed" in str(resp.json()["detail"])
