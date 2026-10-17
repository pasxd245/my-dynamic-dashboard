"""R189 (rc.3 item 3.5): the `replace_period` refresh mode.

A weekly export re-covers the last N days: the rows of that window must be
replaced, older rows kept. The period is [min, max] of `period_column` over the
incoming rows (the whole stack when several files arrive), inclusive."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response

# Committed: 1–5 Sept. Incoming re-covers 3–6 Sept (5 Sept missing → removed).
_BASE = b"id,day,calls\n1,2026-09-01,1\n2,2026-09-02,2\n3,2026-09-03,3\n4,2026-09-04,4\n5,2026-09-05,5\n"
_WINDOW = b"id,day,calls\n30,2026-09-03,30\n40,2026-09-04,40\n60,2026-09-06,60\n"
_NEXT = b"id,day,calls\n70,2026-09-07,70\n"
_NULL_DAY = b"id,day,calls\n30,2026-09-03,30\n31,,31\n"
_NO_DATE = b"id,label,calls\n30,x,30\n"


def _upload(client: TestClient, content: bytes, name: str = "export.csv") -> str:
    return client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": (name, content, "text/csv")}).json()[
        "temp_id"
    ]


def _create(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "P"}).json()["id"]
    r = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": _upload(client, _BASE), "items": [{"name": "d"}]})
    assert r.status_code == 201, r.text
    return ws, r.json()[0]["id"]


def _refresh(client: TestClient, ws: str, ds: str, files: list[bytes], **item):
    ids = [_upload(client, c, f"f{i}.csv") for i, c in enumerate(files)]
    body: dict = {"temp_id": ids[0], "items": [{"name": "x", "target_dataset_id": ds, **item}]}
    if len(ids) > 1:
        body["extra_temp_ids"] = ids[1:]
    return client.post(f"/workspaces/{ws}/datasets/batch", json=body)


def _ids(client: TestClient, ds: str) -> list[str]:
    cols = [c["name"] for c in client.get(f"/datasets/{ds}").json()["columns"]]
    rows = client.get(f"/datasets/{ds}/rows", params={"page_size": 100}).json()["rows"]
    return [r[cols.index("id")] for r in rows]


_RP = {"refresh_mode": "replace_period", "period_column": "day"}


@pytest.mark.unit
def test_the_incoming_window_is_replaced_and_older_rows_kept() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds, [_WINDOW], **_RP)
        detail = client.get(f"/datasets/{ds}").json()
        ids = _ids(client, ds)
        settings = client.get(f"/datasets/{ds}/refresh-settings").json()

    assert resp.status_code == 201, resp.text
    body = resp.json()
    validate_response("datasets/batch-post.contract.yaml", 201, body)
    # Window = 3–6 Sept: committed 3, 4, 5 removed (5 is inside the window even
    # though the export no longer has it — that is what "replace the period" means).
    assert body["period"] == {
        "column": "day",
        "from": "2026-09-03",
        "to": "2026-09-06",
        "removed": 3,
        "inserted": 3,
        "kept": 2,
    }
    assert sorted(ids, key=int) == ["1", "2", "30", "40", "60"]
    assert detail["rowCount"] == 5 and detail["dataVersion"] == 2
    validate_response("datasets/refresh-settings-get.contract.yaml", 200, settings)
    assert settings["refresh_mode"] == "replace_period" and settings["period_column"] == "day"


@pytest.mark.unit
def test_the_period_spans_the_whole_stack_of_files() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds, [_WINDOW, _NEXT], **_RP)
        ids = _ids(client, ds)

    assert resp.status_code == 201, resp.text
    assert resp.json()["period"]["to"] == "2026-09-07"
    assert sorted(ids, key=int) == ["1", "2", "30", "40", "60", "70"]


@pytest.mark.unit
def test_a_row_without_a_period_value_refuses_the_refresh() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds, [_NULL_DAY], **_RP)
        after = client.get(f"/datasets/{ds}").json()

    assert resp.status_code == 422
    assert "1 incoming row(s) have no value in 'day'" in resp.json()["detail"]
    assert after["dataVersion"] == 1 and after["rowCount"] == 5


@pytest.mark.unit
def test_the_period_column_must_be_a_date_on_both_sides_and_the_mode_coherent() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        not_date = _refresh(client, ws, ds, [_WINDOW], refresh_mode="replace_period", period_column="calls")
        missing = _refresh(client, ws, ds, [_NO_DATE], **_RP)
        no_column = _refresh(client, ws, ds, [_WINDOW], refresh_mode="replace_period")
        wrong_mode = _refresh(client, ws, ds, [_WINDOW], period_column="day")
        with_key = _refresh(client, ws, ds, [_WINDOW], merge_key=["id"], **_RP)
        create = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": _upload(client, _WINDOW), "items": [{"name": "n", "period_column": "day"}]},
        )
        after = client.get(f"/datasets/{ds}").json()

    assert not_date.status_code == 422 and "date or datetime" in not_date.json()["detail"]
    assert missing.status_code == 422 and "not one of its columns" in missing.json()["detail"]
    assert no_column.status_code == 422 and "requires period_column" in no_column.json()["detail"]
    assert wrong_mode.status_code == 422 and "requires refresh_mode=replace_period" in wrong_mode.json()["detail"]
    assert with_key.status_code == 422
    assert create.status_code == 422
    assert after["dataVersion"] == 1


@pytest.mark.unit
def test_committed_rows_without_a_period_value_are_kept() -> None:
    base_with_blank = _BASE + b"6,,6\n"
    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "P"}).json()["id"]
        ds = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": _upload(client, base_with_blank), "items": [{"name": "d"}]},
        ).json()[0]["id"]
        resp = _refresh(client, ws, ds, [_WINDOW], **_RP)
        ids = _ids(client, ds)

    assert resp.status_code == 201, resp.text
    assert resp.json()["period"]["kept"] == 3
    assert "6" in ids
