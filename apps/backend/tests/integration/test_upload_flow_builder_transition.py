from fastapi.testclient import TestClient
from io import BytesIO
import pytest

from app.main import app


def _excel_workbook_bytes(sheet_names: list[str]) -> bytes:
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.Workbook()
    workbook.active.title = sheet_names[0]
    workbook.active.append(["id", "value"])
    workbook.active.append([1, "a"])
    for name in sheet_names[1:]:
        sheet = workbook.create_sheet(title=name)
        sheet.append(["id", "value"])
        sheet.append([2, name])
    sink = BytesIO()
    workbook.save(sink)
    return sink.getvalue()


def test_upload_flow_builder_transition_scaffold() -> None:
    """Scaffold integration: successful upload returns payload fields required for builder transition wiring."""

    client = TestClient(app)
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-upload-flow-transition"}).json()["id"]

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("sample.csv", b"id,value\n1,x\n", "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "source_id" in payload
    assert "sheets" in payload


def test_sheet_discovery_requires_selection_for_multi_sheet_excel() -> None:
    client = TestClient(app)
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-sheet-discovery-multi"}).json()["id"]

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/discover-sheets",
        files={"file": ("sample.xlsx", _excel_workbook_bytes(["Summary", "Revenue"]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"source_type": "excel"},
    )

    assert response.status_code == 200, response.json()
    body = response.json()
    assert body["requires_sheet_selection"] is True
    assert [item["name"] for item in body["options"]] == ["Summary", "Revenue"]


def test_sheet_discovery_bypasses_selection_for_single_sheet_excel() -> None:
    client = TestClient(app)
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-sheet-discovery-single"}).json()["id"]

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/discover-sheets",
        files={"file": ("sample.xlsx", _excel_workbook_bytes(["Sheet1"]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"source_type": "excel"},
    )

    assert response.status_code == 200, response.json()
    body = response.json()
    assert body["requires_sheet_selection"] is False
    assert [item["name"] for item in body["options"]] == ["Sheet1"]


def test_selected_sheet_is_forwarded_to_excel_source(monkeypatch) -> None:
    client = TestClient(app)
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-sheet-forward"}).json()["id"]

    from app.services.source_registry import SourceRegistry
    from app.sources.base import Source
    from app.services.upload_service import ColumnProfile
    import polars as pl

    class _SpyExcelSource(Source):
        def __init__(self) -> None:
            self.parse_called_with = None

        def parse(self, config):
            self.parse_called_with = config
            return pl.DataFrame({"id": [1], "value": ["x"]})

        def compute_profiles(self, df):
            return [
                ColumnProfile(name="id", data_type="Int64", is_nullable=False),
                ColumnProfile(name="value", data_type="String", is_nullable=False),
            ]

    spy = _SpyExcelSource()
    monkeypatch.setattr(SourceRegistry, "for_type", staticmethod(lambda source_type: spy))

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("sample.xlsx", _excel_workbook_bytes(["Summary", "Revenue"]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"source_type": "excel", "sheet_name": "Revenue"},
    )

    assert response.status_code == 200, response.json()
    assert spy.parse_called_with is not None
    assert spy.parse_called_with.sheet_name == "Revenue"


def test_successful_upload_response_can_drive_active_context_transition() -> None:
    client = TestClient(app)
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-transition-success"}).json()["id"]

    upload_response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("sample.csv", b"id,value\n1,x\n", "text/csv")},
        data={"source_type": "csv"},
    )

    assert upload_response.status_code == 200, upload_response.json()
    source_id = upload_response.json()["source_id"]

    context_response = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_id, "source_id": source_id},
    )
    assert context_response.status_code == 200, context_response.json()

    session_response = client.get("/api/v1/builder/session-state")
    assert session_response.status_code == 200, session_response.json()
    assert session_response.json()["current_stage"] == "schema_sheet"
