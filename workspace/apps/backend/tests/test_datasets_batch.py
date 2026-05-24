from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response
from tests._excel import two_sheet_workbook


_FIXTURES = Path(__file__).parent / "fixtures"


def _make_workspace(client: TestClient, name: str = "Marketing") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _csv_upload(client: TestClient, fixture: str = "sample.csv") -> str:
    csv_path = _FIXTURES / fixture
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": (fixture, csv_path.read_bytes(), "text/csv")},
    )
    return resp.json()["temp_id"]


def _excel_upload(client: TestClient) -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "excel"},
        files={"file": ("book.xlsx", two_sheet_workbook(), "application/octet-stream")},
    )
    return resp.json()["temp_id"]


@pytest.mark.unit
def test_csv_single_item_commit_returns_201_and_dataset() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "leads"}]},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert len(body) == 1
    ds = body[0]
    assert ds["workspaceId"] == ws
    assert ds["name"] == "leads"
    assert ds["sourceFormat"] == "csv"
    assert "sheetName" not in ds  # contract: present iff sourceFormat === excel
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_excel_multi_item_commit_returns_ordered_datasets() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _excel_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {"sheet": "Deals", "name": "q1_deals"},
                    {"sheet": "Contacts", "name": "q1_contacts"},
                ],
            },
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert [d["name"] for d in body] == ["q1_deals", "q1_contacts"]
    assert [d["sheetName"] for d in body] == ["Deals", "Contacts"]
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_unknown_workspace_returns_404() -> None:
    with TestClient(app) as client:
        temp = _csv_upload(client)
        resp = client.post(
            "/workspaces/ws_00000000/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x"}]},
        )
    assert resp.status_code == 404


@pytest.mark.unit
def test_unknown_temp_id_returns_404() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": "tmp_0000000000000000", "items": [{"name": "x"}]},
        )
    assert resp.status_code == 404


@pytest.mark.unit
def test_target_dataset_id_returns_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"name": "x", "target_dataset_id": "ds_00000001"}],
            },
        )
    assert resp.status_code == 422


@pytest.mark.unit
def test_excluded_columns_empty_leaves_zero_columns_returns_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "name": "x",
                        "excluded_columns": ["id", "name", "amount", "signed_up"],
                    }
                ],
            },
        )
    assert resp.status_code == 422


@pytest.mark.unit
def test_csv_commit_with_skip_rows_drops_leading_lines() -> None:
    # Fixture has 2 noise lines, 1 header, 3 data rows. skip_rows=2 must
    # land the header on row 3 → real column names + 3 data rows. R20
    # behavior-conformance: R16 accepts the field, R20 makes it bite.
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client, "sample_with_noise.csv")
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"name": "leads", "parse_options": {"skip_rows": 2}}],
            },
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    ds = body[0]
    assert ds["rowCount"] == 3
    assert [c["name"] for c in ds["columns"]] == ["id", "name", "amount", "signed_up"]
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_csv_commit_with_has_header_false_auto_names_columns() -> None:
    # sample.csv has 1 header + 3 data rows. has_header=false reads all
    # 4 lines as data and auto-names columns `column1, column2, …`
    # (one-indexed, matching the Excel parser convention).
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [{"name": "raw", "parse_options": {"has_header": False}}],
            },
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    ds = body[0]
    assert ds["rowCount"] == 4
    assert [c["name"] for c in ds["columns"]] == [
        "column1",
        "column2",
        "column3",
        "column4",
    ]
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_csv_commit_with_skip_rows_and_has_header_false_combine() -> None:
    # skip first, then auto-name. Drop the 2 noise lines and treat the
    # remaining 4 lines (would-be-header + 3 data) as headerless data.
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client, "sample_with_noise.csv")
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "name": "raw_skip",
                        "parse_options": {"skip_rows": 2, "has_header": False},
                    }
                ],
            },
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    ds = body[0]
    assert ds["rowCount"] == 4
    assert [c["name"] for c in ds["columns"]] == [
        "column1",
        "column2",
        "column3",
        "column4",
    ]
    validate_response("datasets/batch-post.contract.yaml", 201, body)


@pytest.mark.unit
def test_column_overrides_missing_column_returns_409() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": temp,
                "items": [
                    {
                        "name": "x",
                        "column_overrides": {"not_a_column": {"dtype": "string"}},
                    }
                ],
            },
        )
    assert resp.status_code == 409
