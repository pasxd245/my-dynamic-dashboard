from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response
from tests._excel import two_sheet_workbook


_FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.unit
def test_post_uploads_csv_returns_temp_upload_with_preview() -> None:
    csv_path = _FIXTURES / "sample.csv"
    with TestClient(app) as client:
        resp = client.post(
            "/uploads",
            data={"sourceFormat": "csv"},
            files={"file": ("sample.csv", csv_path.read_bytes(), "text/csv")},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["sourceFormat"] == "csv"
    assert body["temp_id"].startswith("tmp_")
    assert len(body["temp_id"]) == 4 + 16
    assert body["sizeBytes"] == csv_path.stat().st_size
    preview = body["csvPreview"]
    assert preview["rowCount"] == 3
    col_names = [c["name"] for c in preview["columns"]]
    assert col_names == ["id", "name", "amount", "signed_up"]
    validate_response("uploads/post.contract.yaml", 200, body)


@pytest.mark.unit
def test_post_uploads_excel_returns_sheet_enumeration() -> None:
    xlsx_bytes = two_sheet_workbook()
    with TestClient(app) as client:
        resp = client.post(
            "/uploads",
            data={"sourceFormat": "excel"},
            files={"file": ("book.xlsx", xlsx_bytes, "application/octet-stream")},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["sourceFormat"] == "excel"
    sheet_names = [s["sheet"] for s in body["sheets"]]
    assert sheet_names == ["Deals", "Contacts"]
    validate_response("uploads/post.contract.yaml", 200, body)


@pytest.mark.unit
def test_post_uploads_format_mismatch_returns_415() -> None:
    csv_path = _FIXTURES / "sample.csv"
    with TestClient(app) as client:
        resp = client.post(
            "/uploads",
            data={"sourceFormat": "excel"},
            files={"file": ("sample.csv", csv_path.read_bytes(), "text/csv")},
        )
    assert resp.status_code == 415


@pytest.mark.unit
def test_post_uploads_oversize_returns_413(monkeypatch) -> None:
    from app.routers import uploads as uploads_module

    monkeypatch.setattr(uploads_module, "MAX_UPLOAD_BYTES", 10)
    csv_path = _FIXTURES / "sample.csv"
    with TestClient(app) as client:
        resp = client.post(
            "/uploads",
            data={"sourceFormat": "csv"},
            files={"file": ("sample.csv", csv_path.read_bytes(), "text/csv")},
        )
    assert resp.status_code == 413


@pytest.mark.unit
def test_post_uploads_unparseable_csv_returns_422() -> None:
    # An empty file has no columns → DuckDB read_csv_auto fails.
    with TestClient(app) as client:
        resp = client.post(
            "/uploads",
            data={"sourceFormat": "csv"},
            files={"file": ("empty.csv", b"", "text/csv")},
        )
    assert resp.status_code == 422
