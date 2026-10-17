"""R188 (rc.3 item 3.4): a refresh may stack several uploads into ONE refresh.

Monthly exports arrive as several files that together form the new state of one
dataset. The files are stacked in request order (same columns, any order; the
first file's dtypes are the coercion targets), then the chosen refresh mode
(replace / merge / append) applies to the stack — one `dataVersion` bump, each
row's provenance naming its own file. Any bad file fails the whole refresh with
nothing committed."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.main import app
from tests._conformance import validate_response

_BASE = b"key,month,calls\n1,2026-07,5\n2,2026-07,3\n"
_AUG = b"key,month,calls\n3,2026-08,4\n4,2026-08,6\n"
_SEP = b"key,month,calls\n5,2026-09,1\n"
_SEP_REORDERED = b"calls,key,month\n1,5,2026-09\n"
_SEP_DUP_KEY = b"key,month,calls\n3,2026-09,9\n"
_SEP_WRONG_COLS = b"key,month,minutes\n5,2026-09,1\n"
_SEP_BAD_VALUE = b"key,month,calls\n5,2026-09,lots\n"


def _upload(client: TestClient, content: bytes, name: str) -> str:
    resp = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": (name, content, "text/csv")})
    assert resp.status_code == 200, resp.text
    return resp.json()["temp_id"]


def _create(client: TestClient) -> tuple[str, dict]:
    ws = client.post("/workspaces", json={"name": "M"}).json()["id"]
    resp = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": _upload(client, _BASE, "july.csv"), "items": [{"name": "calls"}]},
    )
    assert resp.status_code == 201, resp.text
    return ws, resp.json()[0]


def _refresh(client: TestClient, ws: str, ds: str, files: list[tuple[bytes, str]], **item_extra):
    ids = [_upload(client, c, n) for c, n in files]
    body: dict = {"temp_id": ids[0], "items": [{"name": "x", "target_dataset_id": ds, **item_extra}]}
    if len(ids) > 1:
        body["extra_temp_ids"] = ids[1:]
    return client.post(f"/workspaces/{ws}/datasets/batch", json=body)


def _rows(client: TestClient, ds_id: str) -> tuple[list[str], list[list[str | None]]]:
    cols = [c["name"] for c in client.get(f"/datasets/{ds_id}").json()["columns"]]
    rows = client.get(f"/datasets/{ds_id}/rows", params={"page_size": 100}).json()["rows"]
    return cols, rows


@pytest.mark.unit
def test_replace_with_two_files_stacks_them_in_order_with_one_version_bump() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds["id"], [(_AUG, "august.csv"), (_SEP, "september.csv")])
        detail = client.get(f"/datasets/{ds['id']}").json()
        cols, rows = _rows(client, ds["id"])

    assert resp.status_code == 201, resp.text
    validate_response("datasets/batch-post.contract.yaml", 201, resp.json())
    assert detail["rowCount"] == 3
    assert detail["dataVersion"] == 2  # one refresh, however many files
    k, prov = cols.index("key"), cols.index("Source.Name")
    assert [(r[k], r[prov]) for r in rows] == [("3", "august.csv"), ("4", "august.csv"), ("5", "september.csv")]


@pytest.mark.unit
def test_append_with_two_files_adds_both_to_the_committed_rows() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds["id"], [(_AUG, "august.csv"), (_SEP, "september.csv")], refresh_mode="append")
        _cols, rows = _rows(client, ds["id"])

    assert resp.status_code == 201, resp.text
    assert resp.json()["append"] == {"appended": 3, "total": 5}
    assert len(rows) == 5


@pytest.mark.unit
def test_merge_over_a_stack_and_a_key_repeated_across_files_is_refused() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        ok = _refresh(client, ws, ds["id"], [(_AUG, "august.csv"), (_SEP, "september.csv")], merge_key=["key"])
        dup = _refresh(client, ws, ds["id"], [(_AUG, "august.csv"), (_SEP_DUP_KEY, "september.csv")], merge_key=["key"])
        after = client.get(f"/datasets/{ds['id']}").json()

    assert ok.status_code == 201, ok.text
    assert ok.json()["merge"] == {"updated": 0, "inserted": 3, "kept": 2}
    # Key 3 appears in both files: which one wins is ambiguous → the merge's
    # duplicate-incoming-key stop, nothing committed.
    assert dup.status_code == 422
    assert dup.json()["code"] == "merge_duplicate_keys"
    assert after["dataVersion"] == 2 and after["rowCount"] == 5


@pytest.mark.unit
def test_a_file_with_its_columns_in_another_order_is_accepted() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds["id"], [(_AUG, "august.csv"), (_SEP_REORDERED, "september.csv")])
        cols, rows = _rows(client, ds["id"])

    assert resp.status_code == 201, resp.text
    c = cols.index("calls")
    assert [r[c] for r in rows] == ["4", "6", "1"]


@pytest.mark.unit
def test_a_file_with_other_columns_fails_the_whole_refresh_naming_it() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds["id"], [(_AUG, "august.csv"), (_SEP_WRONG_COLS, "september.csv")])
        after = client.get(f"/datasets/{ds['id']}").json()

    assert resp.status_code == 422
    msg = resp.json()["detail"]
    assert "'september.csv'" in msg and "missing ['calls']" in msg and "extra ['minutes']" in msg
    assert after["dataVersion"] == 1 and after["rowCount"] == 2  # untouched


@pytest.mark.unit
def test_a_value_that_does_not_fit_names_the_file_and_commits_nothing() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds["id"], [(_AUG, "august.csv"), (_SEP_BAD_VALUE, "september.csv")])
        after = client.get(f"/datasets/{ds['id']}").json()

    assert resp.status_code == 422
    body = resp.json()
    validate_response("datasets/batch-post.contract.yaml", 422, body)
    assert body["code"] == "coercion_failed"
    assert body["file"] == "september.csv" and body["column"] == "calls"
    assert after["dataVersion"] == 1 and after["rowCount"] == 2


@pytest.mark.unit
def test_extra_uploads_are_refused_outside_a_refresh_and_when_unusable() -> None:
    xlsx = io.BytesIO()
    wb = Workbook()
    wb.active.append(["key", "month", "calls"])
    wb.active.append([5, "2026-09", 1])
    wb.save(xlsx)
    with TestClient(app) as client:
        ws, ds = _create(client)
        a, b = _upload(client, _AUG, "august.csv"), _upload(client, _SEP, "september.csv")
        create = client.post(
            f"/workspaces/{ws}/datasets/batch", json={"temp_id": a, "extra_temp_ids": [b], "items": [{"name": "new"}]}
        )
        item = {"name": "x", "target_dataset_id": ds["id"]}
        same = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": a, "extra_temp_ids": [a], "items": [item]})
        twice = client.post(
            f"/workspaces/{ws}/datasets/batch", json={"temp_id": a, "extra_temp_ids": [b, b], "items": [item]}
        )
        unknown = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": a, "extra_temp_ids": ["tmp_0000000000000000"], "items": [item]},
        )
        x = client.post(
            "/uploads",
            data={"sourceFormat": "excel"},
            files={"file": ("sep.xlsx", xlsx.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        ).json()["temp_id"]
        other = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": a, "extra_temp_ids": [x], "items": [item]})
        after = client.get(f"/datasets/{ds['id']}").json()

    assert create.status_code == 422 and "target_dataset_id" in create.json()["detail"]
    assert same.status_code == 422
    assert twice.status_code == 422
    assert unknown.status_code == 404
    assert other.status_code == 422 and "'sep.xlsx'" in other.json()["detail"]
    assert after["dataVersion"] == 1


@pytest.mark.unit
def test_a_single_file_refresh_is_unchanged() -> None:
    """No `extra_temp_ids` → the pre-R188 path: rows, provenance, version."""
    with TestClient(app) as client:
        ws, ds = _create(client)
        resp = _refresh(client, ws, ds["id"], [(_AUG, "august.csv")])
        cols, rows = _rows(client, ds["id"])

    assert resp.status_code == 201, resp.text
    prov = cols.index("Source.Name")
    assert {r[prov] for r in rows} == {"august.csv"}
    assert resp.json()[0]["dataVersion"] == 2
