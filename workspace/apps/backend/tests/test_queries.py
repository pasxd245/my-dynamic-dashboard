"""R69: Saved Query — create / list / get / run / stale / delete / cascade.

Seeds a workspace + CSV dataset (sample.csv: id,name,amount,signed_up) via
the real upload→commit path, then exercises the five query routes against
the contracts. The stale path is driven by inserting a drifted definition
directly (a saved query cannot be created broken — that's the 422-on-save
guard — so we simulate post-save schema drift at the DB layer).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"

# amount (col 2, float) > 40 → Alice (42.5), Carol (99.9) = 2 of 3 rows.
_DEF = {"q": None, "filters": [{"col": 2, "dtype": "float", "op": "gt", "val": 40}], "advanced": []}


def _commit_csv(client: TestClient, ws_name: str = "Marketing") -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": ws_name}).json()["id"]
    upload = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", (_FIXTURES / "sample.csv").read_bytes(), "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": upload["temp_id"], "items": [{"name": "leads"}]},
    ).json()[0]
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, name: str = "Big deals", definition=None):
    return client.post(
        f"/workspaces/{ws}/queries",
        json={"name": name, "sourceId": ds_id, "definition": definition or _DEF},
    )


@pytest.mark.unit
def test_create_persists_and_returns_query() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = _create(client, ws, ds_id)

    assert resp.status_code == 201
    body = resp.json()
    assert body["id"].startswith("qr_")
    assert body["workspaceId"] == ws
    assert body["sourceId"] == ds_id
    assert body["name"] == "Big deals"
    assert body["definition"]["filters"][0]["op"] == "gt"
    validate_response("queries/post.contract.yaml", 201, body)


@pytest.mark.unit
def test_list_returns_workspace_queries_newest_first() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        _create(client, ws, ds_id, name="first")
        _create(client, ws, ds_id, name="second")
        resp = client.get(f"/workspaces/{ws}/queries")

    assert resp.status_code == 200
    body = resp.json()
    # Both queries are scoped to this workspace. (Strict newest-first order
    # isn't asserted here: both rows land in the same clock-second, so the
    # created_at-desc tiebreak is non-deterministic at this resolution.)
    assert {q["name"] for q in body} == {"first", "second"}
    assert all(q["workspaceId"] == ws for q in body)
    validate_response("queries/get.contract.yaml", 200, body)


@pytest.mark.unit
def test_get_returns_definition_and_metadata() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id).json()["id"]
        resp = client.get(f"/queries/{qid}")

    assert resp.status_code == 200
    validate_response("queries/detail-get.contract.yaml", 200, resp.json())


@pytest.mark.unit
def test_get_unknown_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.get("/queries/qr_00000000")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("queries/detail-get.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_run_is_live_rerun_against_current_data() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id).json()["id"]
        resp = client.get(f"/queries/{qid}/rows")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2  # Alice + Carol (amount > 40)
    names = {row[1] for row in body["rows"]}
    assert names == {"Alice", "Carol"}
    validate_response("queries/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_run_unpaged_returns_single_response() -> None:
    # R107 — ?unpaged=true returns the matched rows in ONE response (no paging).
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id).json()["id"]
        resp = client.get(f"/queries/{qid}/rows?unpaged=true")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2  # Alice + Carol (amount > 40)
    assert len(body["rows"]) == 2  # all of them, unpaged
    assert body["page"] == 1
    assert body["pageSize"] == 2  # echoes the returned row count, not the pager enum
    validate_response("queries/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_run_unpaged_returns_all_rows_beyond_one_page() -> None:
    # R107 — the decisive test: unpaged must return MORE than one default page
    # (50), proving it isn't silently falling back to paged. A 2-row fixture
    # can't distinguish the two; 120 rows (> default page, < cap) can.
    import csv
    import io

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "name", "amount", "signed_up"])
    for i in range(120):
        writer.writerow([f"D-{i:04d}", f"name{i}", "99.9", "true"])  # amount > 40 → all match _DEF
    big_csv = buf.getvalue().encode()

    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "Big"}).json()["id"]
        up = client.post(
            "/uploads",
            data={"sourceFormat": "csv"},
            files={"file": ("big.csv", big_csv, "text/csv")},
        ).json()
        ds_id = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": up["temp_id"], "items": [{"name": "big"}]},
        ).json()[0]["id"]
        qid = _create(client, ws, ds_id).json()["id"]

        paged = client.get(f"/queries/{qid}/rows").json()
        unpaged = client.get(f"/queries/{qid}/rows?unpaged=true").json()

    assert (len(paged["rows"]), paged["total"]) == (50, 120)  # default page is bounded
    assert (len(unpaged["rows"]), unpaged["total"]) == (120, 120)  # unpaged returns them all
    # The capped flag a widget computes (`total > len(rows)`) is False here — the
    # warning must NOT fire when the result fits under the cap.
    assert unpaged["total"] <= len(unpaged["rows"])


@pytest.mark.unit
def test_run_unpaged_ignores_page_size_validation() -> None:
    # R107 — with unpaged=true, page/page_size are ignored, so an off-enum
    # page_size does NOT 422 (the unpaged path skips that check).
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id).json()["id"]
        resp = client.get(f"/queries/{qid}/rows?unpaged=true&page_size=7")

    assert resp.status_code == 200
    assert resp.json()["total"] == 2


@pytest.mark.unit
def test_run_unpaged_caps_server_side(monkeypatch: pytest.MonkeyPatch) -> None:
    # R107 — the unpaged response is capped server-side at DASHBOARD_MAX_ROWS,
    # and `total` still carries the full count so a partial result is detectable.
    from app.routers import queries as queries_router

    monkeypatch.setattr(queries_router, "DASHBOARD_MAX_ROWS", 1)
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id).json()["id"]
        resp = client.get(f"/queries/{qid}/rows?unpaged=true")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["rows"]) == 1  # capped at DASHBOARD_MAX_ROWS=1
    assert body["total"] == 2  # full matched count → capped result detectable (total > len)
    validate_response("queries/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_create_duplicate_name_in_workspace_returns_409() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        _create(client, ws, ds_id, name="dupe")
        resp = _create(client, ws, ds_id, name="dupe")
    assert resp.status_code == 409
    assert resp.json() == {"code": "name_taken"}
    validate_response("queries/post.contract.yaml", 409, resp.json())


@pytest.mark.unit
def test_create_unknown_dataset_returns_422() -> None:
    with TestClient(app) as client:
        ws, _ds_id = _commit_csv(client)
        resp = _create(client, ws, "ds_00000000")
    assert resp.status_code == 422


@pytest.mark.unit
def test_create_invalid_definition_returns_422() -> None:
    # `gt` is not a valid operator for a string column (col 1 = name).
    bad = {"q": None, "filters": [{"col": 1, "dtype": "string", "op": "gt", "val": "x"}], "advanced": []}
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = _create(client, ws, ds_id, definition=bad)
    assert resp.status_code == 422


@pytest.mark.unit
def test_run_stale_definition_returns_409_query_stale() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        # Simulate post-save schema drift: a saved definition that references
        # a column index that no longer exists (inserted directly, bypassing
        # the create-time validation that would otherwise reject it 422).
        drifted = {"q": None, "filters": [{"col": 99, "dtype": "string", "op": "equals", "val": "x"}], "advanced": []}
        with db.get_conn() as con:
            con.execute(
                "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("qr_deadbeef", ws, ds_id, "Stale", json.dumps(drifted), "2026-06-13T00:00:00Z"),
            )
            con.commit()
        resp = client.get("/queries/qr_deadbeef/rows")

    assert resp.status_code == 409
    assert resp.json() == {"code": "query_stale"}
    validate_response("queries/rows-get.contract.yaml", 409, resp.json())


@pytest.mark.unit
def test_delete_removes_query_then_404() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id).json()["id"]
        assert client.delete(f"/queries/{qid}").status_code == 204
        assert client.get(f"/queries/{qid}").status_code == 404


@pytest.mark.unit
def test_deleting_source_dataset_cascades_queries_away() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id).json()["id"]
        assert client.delete(f"/datasets/{ds_id}").status_code == 204
        # The query's single source dataset is gone → the query cascaded away.
        assert client.get(f"/queries/{qid}").status_code == 404
