from __future__ import annotations

from fastapi.testclient import TestClient
import polars as pl

from app.main import app
from app.services.upload_service import ColumnProfile
from app.sources.base import Source, SourceConfig


class _SpySource(Source):
    def __init__(self) -> None:
        self.parse_called_with: SourceConfig | None = None
        self.hook_called_with: tuple[str, str, list[ColumnProfile]] | None = None

    def parse(self, config: SourceConfig) -> pl.DataFrame:
        self.parse_called_with = config
        return pl.DataFrame({"id": [1], "value": ["x"]})

    def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
        return [
            ColumnProfile(name="id", data_type="Int64", is_nullable=False),
            ColumnProfile(name="value", data_type="String", is_nullable=False),
        ]

    def post_commit_hook(self, workspace_id: str, source_file_id: str, columns: list[ColumnProfile]) -> None:
        self.hook_called_with = (workspace_id, source_file_id, columns)


def test_excel_upload_dispatches_via_registry(monkeypatch) -> None:
    client = TestClient(app)
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-source-dispatch-xlsx"}).json()["id"]

    spy = _SpySource()
    requested_types: list[str] = []

    from app.services.source_registry import SourceRegistry

    def _for_type(source_type: str):
        requested_types.append(source_type)
        return spy

    monkeypatch.setattr(SourceRegistry, "for_type", staticmethod(_for_type))

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("sample.xlsx", b"any-bytes", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )

    assert response.status_code == 200, response.json()
    assert requested_types == ["excel"]
    assert spy.parse_called_with is not None
    assert spy.parse_called_with.source_type == "excel"


def test_csv_upload_dispatch_and_post_commit_hook(monkeypatch) -> None:
    client = TestClient(app)
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-source-dispatch-csv"}).json()["id"]

    spy = _SpySource()

    from app.services.source_registry import SourceRegistry

    monkeypatch.setattr(SourceRegistry, "for_type", staticmethod(lambda source_type: spy))

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("sample.csv", b"a,b\n1,2\n", "text/csv")},
    )

    assert response.status_code == 200, response.json()
    payload = response.json()

    assert spy.parse_called_with is not None
    assert spy.parse_called_with.source_type == "csv"
    assert spy.hook_called_with is not None

    hook_workspace_id, hook_source_file_id, hook_columns = spy.hook_called_with
    assert hook_workspace_id == workspace_id
    assert hook_source_file_id == payload["source_id"]
    assert len(hook_columns) == 2


def test_unsupported_file_type_is_rejected() -> None:
    client = TestClient(app)
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-source-unsupported"}).json()["id"]

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/sources/upload",
        files={"file": ("sample.json", b"{}", "application/json")},
    )

    assert response.status_code == 400
    body = response.json()
    error_code = body.get("error_code", body.get("error", {}).get("code", "")).lower()
    assert "unsupported" in error_code