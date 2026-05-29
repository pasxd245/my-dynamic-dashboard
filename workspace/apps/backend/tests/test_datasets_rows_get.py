"""R35: GET /datasets/{id}/rows — paged + ?q= substring filter."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _commit_csv(client: TestClient, ws_name: str = "Marketing") -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": ws_name}).json()["id"]
    csv_path = _FIXTURES / "sample.csv"
    upload = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", csv_path.read_bytes(), "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": upload["temp_id"], "items": [{"name": "leads"}]},
    ).json()[0]
    return ws, ds["id"]


@pytest.mark.unit
def test_rows_default_page_returns_full_sample() -> None:
    """sample.csv has 3 rows. Default page=1, page_size=50 returns all."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows")

    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["pageSize"] == 50
    assert body["total"] == 3
    assert len(body["rows"]) == 3
    # Row 0: id=1, name=Alice, amount=42.5, signed_up=2024-01-15.
    assert body["rows"][0][0] == "1"  # int cast to VARCHAR
    assert body["rows"][0][1] == "Alice"
    assert body["rows"][0][2] == "42.5"
    assert body["rows"][0][3] == "2024-01-15"  # date cast
    validate_response("datasets/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_rows_explicit_page_size_25_returns_same_payload_shape() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?page_size=25")

    assert resp.status_code == 200
    body = resp.json()
    assert body["pageSize"] == 25
    assert len(body["rows"]) == 3  # only 3 rows total; all fit


@pytest.mark.unit
def test_rows_out_of_range_page_returns_200_with_empty_rows() -> None:
    """Per rows-get.contract.md: page > ceil(total/page_size) is 200-empty,
    not 422 — matches the list-GET "well-formed but matches nothing" rule."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?page=99")

    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["page"] == 99
    assert body["total"] == 3


@pytest.mark.unit
def test_rows_unknown_dataset_id_returns_404_not_found() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets/ds_00000000/rows")

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("datasets/rows-get.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_rows_invalid_page_size_returns_422() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?page_size=37")

    assert resp.status_code == 422


@pytest.mark.unit
def test_rows_malformed_id_returns_422() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets/garbage/rows")
    assert resp.status_code == 422


@pytest.mark.unit
def test_rows_q_too_long_returns_422() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        long_q = "x" * 201
        resp = client.get(f"/datasets/{ds_id}/rows?q={long_q}")

    assert resp.status_code == 422


@pytest.mark.unit
def test_rows_q_substring_matches_string_cell() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=Alice")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert len(body["rows"]) == 1
    assert body["rows"][0][1] == "Alice"


@pytest.mark.unit
def test_rows_q_is_case_insensitive() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=alice")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Alice"


@pytest.mark.unit
def test_rows_q_matches_numeric_cell() -> None:
    """?q=42.5 should match Alice's amount via CAST(amount AS VARCHAR)."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=42.5")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][2] == "42.5"


@pytest.mark.unit
def test_rows_q_matches_date_cell() -> None:
    """?q=2024-01-15 should match Alice's signed_up via CAST(date AS VARCHAR)."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=2024-01-15")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][3] == "2024-01-15"


@pytest.mark.unit
def test_rows_q_zero_match_returns_empty_with_total_0() -> None:
    """Zero-match returns 200 with rows=[] and total=0 — not 422."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=ZZZZZ")

    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["total"] == 0
    assert body["page"] == 1
    assert body["pageSize"] == 50
    validate_response("datasets/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_rows_q_empty_string_treated_as_absent() -> None:
    """An empty ?q= (FE would strip this) — FastAPI's min_length=1 makes
    it 422. The FE contract is: strip empty input before sending."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=")
    assert resp.status_code == 422


# ─── R39: per-column f<N>_* filters ─────────────────────────────────
#
# sample.csv schema (column index → name → dtype):
#   0 → id        → integer
#   1 → name      → string
#   2 → amount    → float
#   3 → signed_up → date
# Rows:
#   (1, Alice, 42.5, 2024-01-15)
#   (2, Bob,   17.0, 2024-02-03)
#   (3, Carol, 99.9, 2024-03-22)


@pytest.mark.unit
def test_rows_filter_int_equals() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f0_op=equals&f0_val=2")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Bob"


@pytest.mark.unit
def test_rows_filter_string_contains_case_insensitive() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f1_op=contains&f1_val=ali")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Alice"


@pytest.mark.unit
def test_rows_filter_string_equals_case_insensitive() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f1_op=equals&f1_val=alice")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Alice"


@pytest.mark.unit
def test_rows_filter_string_starts_with() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f1_op=starts_with&f1_val=B")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Bob"


@pytest.mark.unit
def test_rows_filter_string_ends_with() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f1_op=ends_with&f1_val=ol")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Carol"


@pytest.mark.unit
def test_rows_filter_float_between_inclusive() -> None:
    """Between is inclusive on both ends — Alice (42.5) matches [20, 60]."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f2_op=between&f2_min=20&f2_max=60")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Alice"


@pytest.mark.unit
def test_rows_filter_float_gt() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f2_op=gt&f2_val=50")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Carol"


@pytest.mark.unit
def test_rows_filter_date_after() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f3_op=after&f3_val=2024-02-01")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    names = [r[1] for r in body["rows"]]
    assert "Bob" in names and "Carol" in names


@pytest.mark.unit
def test_rows_filter_date_between() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f3_op=between&f3_min=2024-02-01&f3_max=2024-03-01")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Bob"


@pytest.mark.unit
def test_rows_filter_string_is_not_null() -> None:
    """All 3 sample rows have non-null name."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f1_op=is_not_null")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3


@pytest.mark.unit
def test_rows_filter_string_is_not_empty() -> None:
    """All 3 sample rows have non-empty name."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f1_op=is_not_empty")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3


@pytest.mark.unit
def test_rows_filter_compose_with_q() -> None:
    """`?q=ali` AND `?f0_op=gt&f0_val=0` → 1 row (Alice)."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=ali&f0_op=gt&f0_val=0")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Alice"


@pytest.mark.unit
def test_rows_filter_compose_with_q_zero_match() -> None:
    """Combined predicate that matches nothing → 200 empty, not 422."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=ZZZ&f0_op=gt&f0_val=0")

    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["total"] == 0


@pytest.mark.unit
def test_rows_filter_zero_match_returns_200_not_422() -> None:
    """A filter that matches no rows is 200, not 422."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f1_op=equals&f1_val=Dave")

    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["total"] == 0


# ─── 422 paths ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_rows_filter_op_dtype_mismatch_returns_422() -> None:
    """`gt` is not valid for a string column."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f1_op=gt&f1_val=5")

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert isinstance(detail, list)
    assert detail[0]["msg"].startswith("filter_op_dtype_mismatch")


@pytest.mark.unit
def test_rows_filter_value_unparseable_int_returns_422() -> None:
    """`f0_val=foo` on an integer column."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f0_op=equals&f0_val=foo")

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail[0]["msg"].startswith("filter_value_unparseable")


@pytest.mark.unit
def test_rows_filter_value_unparseable_date_returns_422() -> None:
    """`f3_val=not-a-date` on a date column."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f3_op=equals&f3_val=not-a-date")

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail[0]["msg"].startswith("filter_value_unparseable")


@pytest.mark.unit
def test_rows_filter_col_out_of_range_returns_422() -> None:
    """sample.csv has 4 columns; column 9 doesn't exist."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f9_op=equals&f9_val=anything")

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail[0]["msg"].startswith("filter_col_out_of_range")


@pytest.mark.unit
def test_rows_filter_operand_shape_between_with_val_returns_422() -> None:
    """`between` requires min/max, not val."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f0_op=between&f0_val=5")

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail[0]["msg"].startswith("filter_operand_shape")


@pytest.mark.unit
def test_rows_filter_operand_shape_between_min_greater_than_max_returns_422() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f0_op=between&f0_min=10&f0_max=5")

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail[0]["msg"].startswith("filter_operand_shape")


@pytest.mark.unit
def test_rows_filter_operand_shape_equals_without_val_returns_422() -> None:
    """Single-operand op without val."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f0_op=equals")

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail[0]["msg"].startswith("filter_operand_shape")


@pytest.mark.unit
def test_rows_filter_value_field_without_op_returns_422() -> None:
    """`f0_val` without `f0_op` is malformed."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?f0_val=5")

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail[0]["msg"].startswith("filter_operand_shape")


# ─── Vocabulary integrity (unit test against filters.OPS_BY_DTYPE) ──


@pytest.mark.unit
def test_filters_ops_by_dtype_matches_r37_vocabulary() -> None:
    """Defensive: every operator from the R37 predicate vocabulary
    table must appear in OPS_BY_DTYPE for the expected dtypes. If R37
    is amended, this test breaks loudly so the BE catches drift."""
    from app.ingest.filters import OPS_BY_DTYPE

    assert OPS_BY_DTYPE["string"] == frozenset(
        {
            "contains",
            "equals",
            "starts_with",
            "ends_with",
            "is_empty",
            "is_not_empty",
            "is_null",
            "is_not_null",
        }
    )
    assert OPS_BY_DTYPE["integer"] == frozenset(
        {
            "equals",
            "ne",
            "gt",
            "lt",
            "gte",
            "lte",
            "between",
            "is_null",
            "is_not_null",
        }
    )
    assert OPS_BY_DTYPE["float"] == OPS_BY_DTYPE["integer"]
    assert OPS_BY_DTYPE["date"] == frozenset(
        {
            "equals",
            "ne",
            "before",
            "after",
            "between",
            "is_null",
            "is_not_null",
        }
    )
    assert OPS_BY_DTYPE["datetime"] == OPS_BY_DTYPE["date"]
    assert OPS_BY_DTYPE["boolean"] == frozenset({"is_true", "is_false", "is_null", "is_not_null"})


@pytest.mark.unit
def test_filters_sql_builder_boolean_ops_unit() -> None:
    """sample.csv has no boolean column; this unit-tests the SQL
    builder against a synthetic predicate so the bool branch is
    exercised even without integration data."""
    from app.ingest.filters import FilterPredicate, build_filter_sql

    p = FilterPredicate(col_index=0, col_name="flag", dtype="boolean", op="is_true")
    sql, params = build_filter_sql([p])
    assert sql == '"flag" = TRUE'
    assert params == []

    p2 = FilterPredicate(col_index=0, col_name="flag", dtype="boolean", op="is_false")
    sql2, _ = build_filter_sql([p2])
    assert sql2 == '"flag" = FALSE'


@pytest.mark.unit
def test_filters_sql_builder_datetime_t_normalized() -> None:
    """`datetime` values with ISO 'T' separator should be normalized
    to space form before binding to DuckDB's CAST(? AS TIMESTAMP)."""
    from app.ingest.filters import FilterPredicate, build_filter_sql

    p = FilterPredicate(
        col_index=0,
        col_name="ts",
        dtype="datetime",
        op="equals",
        val="2024-01-15 14:02:00",  # already-normalized form
    )
    sql, params = build_filter_sql([p])
    assert sql == '"ts" = CAST(? AS TIMESTAMP)'
    assert params == ["2024-01-15 14:02:00"]


# ─── Advanced query (`aq` DNF param) — R51 ──────────────────────────
#
# sample.csv: 0→id(int), 1→name(str), 2→amount(float), 3→signed_up(date)
#   (1, Alice, 42.5, 2024-01-15), (2, Bob, 17.0, 2024-02-03),
#   (3, Carol, 99.9, 2024-03-22)


def _aq(client: TestClient, ds_id: str, groups: list, **extra: str):
    params = {"aq": json.dumps(groups), **extra}
    return client.get(f"/datasets/{ds_id}/rows", params=params)


@pytest.mark.unit
def test_aq_single_group_matches_equivalent_chip_filter() -> None:
    """C12: a single-group aq returns the same rows as the equivalent
    `f<N>_*` chip filter (AND-only parity)."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        chip = client.get(f"/datasets/{ds_id}/rows?f1_op=equals&f1_val=Alice").json()
        aq = _aq(client, ds_id, [[{"col": 1, "dtype": "string", "op": "equals", "val": "Alice"}]]).json()

    assert chip["total"] == 1
    assert aq["total"] == chip["total"]
    assert aq["rows"] == chip["rows"]


@pytest.mark.unit
def test_aq_and_within_group() -> None:
    """`id>0 AND name=Alice` → 1 row (Alice)."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = _aq(
            client,
            ds_id,
            [[
                {"col": 0, "dtype": "integer", "op": "gt", "val": 0},
                {"col": 1, "dtype": "string", "op": "equals", "val": "Alice"},
            ]],
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Alice"
    validate_response("datasets/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_aq_or_across_groups_returns_union() -> None:
    """C13: `name=Alice OR name=Carol` → union (2 rows); total reflects
    the OR-composed count. This is the capability `f<N>_*` cannot express."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = _aq(
            client,
            ds_id,
            [
                [{"col": 1, "dtype": "string", "op": "equals", "val": "Alice"}],
                [{"col": 1, "dtype": "string", "op": "equals", "val": "Carol"}],
            ],
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    names = sorted(r[1] for r in body["rows"])
    assert names == ["Alice", "Carol"]


@pytest.mark.unit
def test_aq_composes_with_chip_and_q_three_way() -> None:
    """C14: chip(amount>50) ∧ aq(Alice OR Carol) ∧ q(carol) → Carol only."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = _aq(
            client,
            ds_id,
            [
                [{"col": 1, "dtype": "string", "op": "equals", "val": "Alice"}],
                [{"col": 1, "dtype": "string", "op": "equals", "val": "Carol"}],
            ],
            f2_op="gt",
            f2_val="50",
            q="carol",
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Carol"


@pytest.mark.unit
def test_aq_empty_array_is_noop() -> None:
    """`aq=[]` matches everything (no advanced query active)."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = _aq(client, ds_id, [])

    assert resp.status_code == 200
    assert resp.json()["total"] == 3


@pytest.mark.unit
def test_aq_malformed_json_returns_422() -> None:
    """C15: non-JSON aq → 422 advanced_query_malformed, loc=['query','aq']."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows", params={"aq": "not-json"})

    assert resp.status_code == 422
    detail = resp.json()["detail"][0]
    assert detail["loc"] == ["query", "aq"]
    assert detail["msg"].startswith("advanced_query_malformed")


@pytest.mark.unit
def test_aq_not_array_returns_422() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows", params={"aq": json.dumps({"col": 1})})

    assert resp.status_code == 422
    assert resp.json()["detail"][0]["msg"].startswith("advanced_query_malformed")


@pytest.mark.unit
def test_aq_bad_atom_op_dtype_mismatch_reuses_filter_code() -> None:
    """C15: a structurally valid atom with an op invalid for the dtype →
    the existing filter_op_dtype_mismatch code, but loc=['query','aq']."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = _aq(client, ds_id, [[{"col": 0, "dtype": "integer", "op": "contains", "val": "x"}]])

    assert resp.status_code == 422
    detail = resp.json()["detail"][0]
    assert detail["loc"] == ["query", "aq"]
    assert detail["msg"].startswith("filter_op_dtype_mismatch")


@pytest.mark.unit
def test_aq_atom_col_out_of_range_returns_422() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = _aq(client, ds_id, [[{"col": 9, "dtype": "string", "op": "equals", "val": "x"}]])

    assert resp.status_code == 422
    detail = resp.json()["detail"][0]
    assert detail["loc"] == ["query", "aq"]
    assert detail["msg"].startswith("filter_col_out_of_range")


@pytest.mark.unit
def test_aq_atom_unparseable_value_returns_422() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = _aq(client, ds_id, [[{"col": 0, "dtype": "integer", "op": "equals", "val": "abc"}]])

    assert resp.status_code == 422
    detail = resp.json()["detail"][0]
    assert detail["loc"] == ["query", "aq"]
    assert detail["msg"].startswith("filter_value_unparseable")


@pytest.mark.unit
def test_build_advanced_sql_or_of_and() -> None:
    """Unit: OR-of-AND SQL composition shape."""
    from app.ingest.filters import FilterPredicate, build_advanced_sql

    g1 = [
        FilterPredicate(col_index=3, col_name="stage", dtype="string", op="equals", val="won"),
        FilterPredicate(col_index=1, col_name="amount", dtype="integer", op="gt", val=10000),
    ]
    g2 = [FilterPredicate(col_index=3, col_name="stage", dtype="string", op="equals", val="lost")]
    sql, params = build_advanced_sql([g1, g2])
    assert sql == '((lower("stage") = lower(?) AND "amount" > CAST(? AS BIGINT)) OR lower("stage") = lower(?))'
    assert params == ["won", 10000, "lost"]


@pytest.mark.unit
def test_build_advanced_sql_empty_is_noop() -> None:
    from app.ingest.filters import build_advanced_sql

    assert build_advanced_sql([]) == ("", [])
