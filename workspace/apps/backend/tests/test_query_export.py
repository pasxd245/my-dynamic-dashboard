"""R182: POST /queries/{id}/export — every row of the final (post-step,
filtered) result as CSV / XLSX with typed cells, the totals row and a Filters
sheet; a row cap that refuses instead of writing."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.main import app

_CSV = (
    b"region,calls,quotes,rate,day\n"
    b"EMEA,100,10,0.1,2026-01-05\n"
    b"EMEA,300,60,0.2,2026-01-06\n"
    b"APAC,200,100,0.5,2026-02-01\n"
    b"APAC,,5,,2026-02-02\n"
)
_EMPTY_DEF = {"q": None, "filters": [], "advanced": []}
_TOTALS = {"calls": {"agg": "sum"}, "rate": {"agg": "ratio", "num": "quotes", "den": "calls"}}


def _seed(client: TestClient, definition: dict | None = None) -> str:
    ws = client.post("/workspaces", json={"name": "X"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("d.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "rows"}]}
    ).json()[0]
    q = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": "Calls", "sourceId": ds["id"], "definition": definition or _EMPTY_DEF},
    )
    assert q.status_code == 201, q.text
    return q.json()["id"]


@pytest.mark.unit
def test_csv_has_every_row_typed_text_and_the_totals_row() -> None:
    with TestClient(app) as client:
        qid = _seed(client)
        resp = client.post(f"/queries/{qid}/export", json={"format": "csv", "totals": _TOTALS, "title": "Calls table"})

    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/csv")
    assert resp.headers["content-disposition"] == 'attachment; filename="Calls_table.csv"'
    text = resp.content.decode("utf-8-sig")
    lines = text.strip().split("\r\n")
    assert lines[0] == "region,calls,quotes,rate,day,Source.Name"
    assert lines[1].startswith("EMEA,100,10,0.1,2026-01-05,")
    assert len(lines) == 1 + 4 + 1  # header + 4 rows + totals
    total = lines[-1].split(",")
    assert total[0] == "Total" and total[1] == "600"
    assert abs(float(total[3]) - 175 / 600) < 1e-9  # ratio = Σquotes / Σcalls


@pytest.mark.unit
def test_xlsx_cells_keep_their_types_and_the_filters_sheet_names_the_filter() -> None:
    with TestClient(app) as client:
        qid = _seed(client)
        resp = client.post(
            f"/queries/{qid}/export",
            json={
                "format": "xlsx",
                "totals": _TOTALS,
                "percent": True,
                "title": "Calls table",
                "filters": [{"column": "region", "values": ["EMEA"]}],
            },
        )

    assert resp.status_code == 200, resp.text
    assert resp.headers["content-disposition"] == 'attachment; filename="Calls_table.xlsx"'
    wb = load_workbook(io.BytesIO(resp.content))
    assert wb.sheetnames == ["Calls table", "Filters"]
    ws = wb["Calls table"]
    header = [c.value for c in ws[1]]
    assert header[:5] == ["region", "calls", "quotes", "rate", "day"]
    rows = [[c.value for c in r] for r in ws.iter_rows(min_row=2)]
    assert len(rows) == 2 + 1  # the EMEA rows + totals
    assert rows[0][1] == 100 and isinstance(rows[0][1], int)  # a number, not "100"
    assert rows[0][3] == pytest.approx(0.1)
    assert str(rows[0][4]).startswith("2026-01-05")  # a real date cell
    assert ws.cell(row=2, column=4).number_format == "0.0%"  # the ratio column reads as a percent
    assert ws.cell(row=2, column=5).number_format == "yyyy-mm-dd"
    total = rows[-1]
    assert total[0] == "Total" and total[1] == 400 and total[3] == pytest.approx(70 / 400)
    assert ws.cell(row=ws.max_row, column=2).font.bold
    fs = wb["Filters"]
    cells = [[c.value for c in r] for r in fs.iter_rows()]
    assert ["query", "Calls"] in cells and ["widget", "Calls table"] in cells and ["rows", "2"] in cells
    assert ["region", "EMEA"] in cells


@pytest.mark.unit
def test_stepped_query_exports_the_shaped_rows_and_404_409_follow_the_run_path() -> None:
    definition = {
        **_EMPTY_DEF,
        "steps": [{"kind": "aggregate", "dimensions": ["region"], "measures": [{"col": "quotes", "agg": "sum"}]}],
    }
    with TestClient(app) as client:
        qid = _seed(client, definition)
        resp = client.post(f"/queries/{qid}/export", json={"format": "csv", "totals": {"quotes": {"agg": "sum"}}})
        missing = client.post("/queries/qr_ffffffff/export", json={"format": "csv"})

    assert resp.status_code == 200, resp.text
    lines = resp.content.decode("utf-8-sig").strip().split("\r\n")
    assert lines[0] == "region,quotes"
    assert sorted(lines[1:3]) == ["APAC,105", "EMEA,70"]
    assert lines[3] == "Total,175"
    assert missing.status_code == 404


@pytest.mark.unit
def test_row_cap_refuses_with_the_count(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routers.queries.EXPORT_MAX_ROWS", 3)
    with TestClient(app) as client:
        qid = _seed(client)
        resp = client.post(f"/queries/{qid}/export", json={"format": "xlsx"})
        filtered = client.post(
            f"/queries/{qid}/export", json={"format": "xlsx", "filters": [{"column": "region", "values": ["EMEA"]}]}
        )

    assert resp.status_code == 422
    assert resp.json() == {"code": "export_too_large", "rows": 4, "max": 3}
    assert filtered.status_code == 200  # under the cap once filtered
