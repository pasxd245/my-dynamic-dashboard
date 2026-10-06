"""R176: `in` / `not_in` list membership and column-vs-column predicates.

Pulled by the weekly-report dogfood (R175 Act): the lead-funnel pivot filter is a
checklist of call statuses — seven `case` branches with the same `then` — and
"valid from ≤ expiry" needed `date_part` + `derive`. Both are ATOM-ONLY: the
chip grammar (`f<N>_*`) and `OPS_BY_DTYPE` do not change."""

from __future__ import annotations

import json
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from app.ingest.filters import OPS_BY_DTYPE
from app.main import app

_CSV = (
    "id,status,amount,valid_from,expires,start_at\n"
    "1,Thành công,100,2026-01-01,2026-12-31,2026-01-01 08:00:00\n"
    "2,thất bại,250,2026-03-01,2026-02-01,2026-03-02 09:00:00\n"
    "3,Quan tâm,400,2026-05-01,2027-04-30,2026-04-30 10:00:00\n"
    "4,Hủy,250,2026-06-01,2026-06-01,2026-06-01 00:00:00\n"
    "5,,90,2026-07-01,2027-06-30,2026-07-01 12:00:00\n"
).encode()


def _commit(client: TestClient) -> tuple[str, str, list[dict]]:
    ws = client.post("/workspaces", json={"name": "R176"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("p.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={
            "temp_id": up["temp_id"],
            "items": [
                {
                    "name": "p",
                    "column_overrides": {
                        "valid_from": {"dtype": "date", "format": "yyyy-MM-dd"},
                        "expires": {"dtype": "date", "format": "yyyy-MM-dd"},
                        "start_at": {"dtype": "datetime", "format": "yyyy-MM-dd HH:mm:ss"},
                    },
                }
            ],
        },
    )
    assert ds.status_code == 201, ds.text
    body = ds.json()[0]
    return ws, body["id"], body["columns"]


def _idx(cols: list[dict], name: str) -> int:
    return [c["name"] for c in cols].index(name)


_SEQ = iter(range(1_000_000))


def _ids(client: TestClient, ws: str, ds: str, steps: list[dict]) -> list[int]:
    q = client.post(
        f"/workspaces/{ws}/queries",
        json={
            "name": f"q{next(_SEQ)}",
            "sourceId": ds,
            "definition": {"q": None, "filters": [], "advanced": [], "steps": steps},
        },
    )
    assert q.status_code == 201, q.text
    qid = q.json()["id"]
    cols = client.get(f"/queries/{qid}").json()["resolvedColumns"]
    rows = client.get(f"/queries/{qid}/rows?unpaged=true").json()["rows"]
    i = [c["name"] for c in cols].index("id")
    return sorted(int(r[i]) for r in rows)


def _filter(*preds: dict) -> list[dict]:
    return [{"kind": "filter", "predicates": list(preds)}]


# ── vocabulary stays the chip vocabulary ──────────────────────────────


@pytest.mark.unit
def test_chip_vocabulary_is_unchanged() -> None:
    for ops in OPS_BY_DTYPE.values():
        assert "in" not in ops and "not_in" not in ops


# ── in / not_in ───────────────────────────────────────────────────────


@pytest.mark.unit
def test_in_on_string_is_case_insensitive() -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        got = _ids(client, ws, ds, _filter({"col": "status", "op": "in", "vals": ["THÀNH CÔNG", "Thất bại"]}))
        assert got == [1, 2]


@pytest.mark.unit
def test_not_in_excludes_listed_values_and_nulls() -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        got = _ids(client, ws, ds, _filter({"col": "status", "op": "not_in", "vals": ["Hủy", "Thành công"]}))
        # row 5 has a blank status (NULL) — excluded, the same rule `ne` follows
        assert got == [2, 3]


@pytest.mark.unit
def test_in_on_numbers_and_dates() -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        assert _ids(client, ws, ds, _filter({"col": "amount", "op": "in", "vals": [250, "400"]})) == [2, 3, 4]
        assert _ids(client, ws, ds, _filter({"col": "valid_from", "op": "not_in", "vals": ["2026-01-01"]})) == [
            2,
            3,
            4,
            5,
        ]


@pytest.mark.unit
def test_in_inside_a_case_when_replaces_n_branches() -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        steps = [
            {
                "kind": "case",
                "name": "in_funnel",
                "branches": [
                    {
                        "when": [{"col": "status", "op": "in", "vals": ["Thành công", "Thất bại", "Quan tâm"]}],
                        "then": {"kind": "const", "value": 1},
                    }
                ],
                "otherwise": {"kind": "const", "value": 0},
            },
            {"kind": "filter", "predicates": [{"col": "in_funnel", "op": "equals", "val": 1}]},
        ]
        assert _ids(client, ws, ds, steps) == [1, 2, 3]


@pytest.mark.unit
@pytest.mark.parametrize(
    "pred, fragment",
    [
        ({"col": "status", "op": "in"}, "non-empty vals"),
        ({"col": "status", "op": "in", "vals": []}, None),  # pydantic min_length → 422
        ({"col": "status", "op": "in", "vals": ["a", None]}, None),
        ({"col": "amount", "op": "in", "vals": ["x"]}, "filter_value_unparseable"),
    ],
)
def test_in_operand_errors_are_422(pred: dict, fragment: str | None) -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        r = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "bad", "sourceId": ds, "definition": {"filters": [], "advanced": [], "steps": _filter(pred)}},
        )
        assert r.status_code == 422, r.text
        if fragment:
            assert fragment in r.text


@pytest.mark.unit
def test_in_is_not_a_chip() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _commit(client)
        n = _idx(cols, "status")
        r = client.get(f"/datasets/{ds}/rows?f{n}_op=in&f{n}_val=x")
        assert r.status_code == 422
        assert "advanced query" in r.text


@pytest.mark.unit
def test_in_travels_in_the_aq_param_and_in_saved_filters() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _commit(client)
        n = _idx(cols, "status")
        atom = {"col": n, "dtype": "string", "op": "in", "vals": ["Quan tâm", "Hủy"]}
        r = client.get(f"/datasets/{ds}/rows?aq={quote(json.dumps([[atom]]))}")
        assert r.status_code == 200, r.text
        assert r.json()["total"] == 2
        q = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "src", "sourceId": ds, "definition": {"filters": [atom], "advanced": [], "steps": []}},
        )
        assert q.status_code == 201, q.text
        rows = client.get(f"/queries/{q.json()['id']}/rows?unpaged=true").json()
        assert rows["total"] == 2


# ── column-vs-column ──────────────────────────────────────────────────


@pytest.mark.unit
def test_date_column_compared_with_date_column() -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        assert _ids(client, ws, ds, _filter({"col": "expires", "op": "gte", "refCol": "valid_from"})) == [1, 3, 4, 5]
        assert _ids(client, ws, ds, _filter({"col": "expires", "op": "before", "refCol": "valid_from"})) == [2]


@pytest.mark.unit
def test_date_compared_with_datetime_on_the_timestamp_axis() -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        # valid_from (date, midnight) vs start_at (datetime)
        assert _ids(client, ws, ds, _filter({"col": "valid_from", "op": "equals", "refCol": "start_at"})) == [4]
        assert _ids(client, ws, ds, _filter({"col": "start_at", "op": "before", "refCol": "valid_from"})) == [3]


@pytest.mark.unit
def test_number_column_compared_with_a_derived_number() -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        steps = [
            {"kind": "derive", "name": "double", "left": "amount", "op": "*", "right": {"kind": "const", "value": 2}},
            {"kind": "filter", "predicates": [{"col": "double", "op": "gt", "refCol": "amount"}]},
        ]
        assert _ids(client, ws, ds, steps) == [1, 2, 3, 4, 5]


@pytest.mark.unit
@pytest.mark.parametrize(
    "pred, fragment",
    [
        ({"col": "amount", "op": "gt", "refCol": "status"}, "cannot compare"),
        ({"col": "amount", "op": "gt", "refCol": "nope"}, "unknown_column"),
        ({"col": "amount", "op": "gt", "refCol": "id", "val": 3}, "both refCol and a value"),
        ({"col": "amount", "op": "between", "refCol": "id", "min": 1, "max": 2}, "cannot take refCol"),
    ],
)
def test_ref_col_errors_are_422(pred: dict, fragment: str) -> None:
    with TestClient(app) as client:
        ws, ds, _ = _commit(client)
        r = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "bad", "sourceId": ds, "definition": {"filters": [], "advanced": [], "steps": _filter(pred)}},
        )
        assert r.status_code == 422, r.text
        assert fragment in r.text
