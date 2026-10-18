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
def test_a_lone_totalled_column_keeps_its_total_and_the_row_has_no_label() -> None:
    """R191 — the label never overwrites a total: with every column totalled the
    row carries the totals only. Before, the label replaced the first total."""
    definition = {
        **_EMPTY_DEF,
        "steps": [{"kind": "aggregate", "dimensions": [], "measures": [{"col": "quotes", "agg": "sum"}]}],
    }
    with TestClient(app) as client:
        qid = _seed(client, definition)
        csv_resp = client.post(f"/queries/{qid}/export", json={"format": "csv", "totals": {"quotes": {"agg": "sum"}}})
        xlsx_resp = client.post(f"/queries/{qid}/export", json={"format": "xlsx", "totals": {"quotes": {"agg": "sum"}}})

    assert csv_resp.status_code == 200, csv_resp.text
    lines = csv_resp.content.decode("utf-8-sig").strip().split("\r\n")
    assert lines == ["quotes", "175", "175"]
    ws = load_workbook(io.BytesIO(xlsx_resp.content)).worksheets[0]
    assert [c.value for c in ws[ws.max_row]] == [175]


@pytest.mark.unit
def test_the_label_goes_to_the_first_untotalled_column_not_into_an_empty_total() -> None:
    """R191 — column 0 carries a ratio that is empty (no rows → Σden is 0);
    column 1 has no totals spec. The label goes to column 1; column 0 stays
    empty. Before, the label went into the first EMPTY cell — the ratio's."""
    definition = {
        **_EMPTY_DEF,
        "filters": [{"col": 0, "dtype": "string", "op": "equals", "val": "nowhere"}],
        "steps": [
            {
                "kind": "aggregate",
                "dimensions": [],
                "measures": [{"col": "quotes", "agg": "sum"}, {"col": "calls", "agg": "sum"}],
            }
        ],
    }
    totals = {"quotes": {"agg": "ratio", "num": "quotes", "den": "calls"}}
    with TestClient(app) as client:
        qid = _seed(client, definition)
        resp = client.post(f"/queries/{qid}/export", json={"format": "csv", "totals": totals})

    assert resp.status_code == 200, resp.text
    assert resp.content.decode("utf-8-sig").strip().split("\r\n")[-1].split(",") == ["", "Total"]


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


@pytest.mark.unit
def test_r191_qa_every_column_totalled_xlsx_and_csv_carry_no_label() -> None:
    """R191 QA — two measures, both totalled: no cell is free, so no label; the
    totals are the column sums, untouched (CSV and XLSX agree)."""
    definition = {
        **_EMPTY_DEF,
        "steps": [
            {
                "kind": "aggregate",
                "dimensions": [],
                "measures": [{"col": "quotes", "agg": "sum"}, {"col": "calls", "agg": "sum"}],
            }
        ],
    }
    totals = {"quotes": {"agg": "sum"}, "calls": {"agg": "sum"}}
    with TestClient(app) as client:
        qid = _seed(client, definition)
        csv_resp = client.post(f"/queries/{qid}/export", json={"format": "csv", "totals": totals})
        xlsx_resp = client.post(f"/queries/{qid}/export", json={"format": "xlsx", "totals": totals})

    assert csv_resp.status_code == 200, csv_resp.text
    lines = csv_resp.content.decode("utf-8-sig").strip().split("\r\n")
    assert lines[-1] == "175,600"
    ws = load_workbook(io.BytesIO(xlsx_resp.content)).worksheets[0]
    assert [c.value for c in ws[ws.max_row]] == [175, 600]


@pytest.mark.unit
def test_r191_qa_totalled_first_column_with_an_empty_ratio_leaves_both_blank() -> None:
    """R191 QA — the old bug's exact shape: column 0 totalled, a later ratio
    total empty (Σden = 0). The old code dropped the label into the first empty
    total; now neither cell carries the label."""
    definition = {
        **_EMPTY_DEF,
        "filters": [{"col": 0, "dtype": "string", "op": "equals", "val": "nowhere"}],
        "steps": [
            {
                "kind": "aggregate",
                "dimensions": [],
                "measures": [{"col": "quotes", "agg": "sum"}, {"col": "calls", "agg": "sum"}],
            }
        ],
    }
    totals = {"quotes": {"agg": "sum"}, "calls": {"agg": "ratio", "num": "quotes", "den": "calls"}}
    with TestClient(app) as client:
        qid = _seed(client, definition)
        resp = client.post(f"/queries/{qid}/export", json={"format": "csv", "totals": totals})

    assert resp.status_code == 200, resp.text
    last = resp.content.decode("utf-8-sig").strip().split("\r\n")[-1]
    assert "Total" not in last
