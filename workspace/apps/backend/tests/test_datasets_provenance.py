"""R156 § Provenance column — `Source.Name` (which source file each row came from).

The reserved provenance column is auto-injected into EVERY dataset (Power Query's
`Source.Name` convention): value = the source filename, appended last, hidden by
default (R152 view-hint), materialized into the single parquet write so it is a
real, groupable column. Covers the acceptance criteria: initial-upload tagging +
hidden default + string dtype (1), per-file append value (2), backfill of a
pre-R156 committed table (4, unit-level on append_parquets), collision =
user's column wins (6), and unhide-survives-refresh (5).
"""

from __future__ import annotations

import duckdb
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.ingest.merge import append_parquets
from app.ingest.parquet_writer import PROVENANCE_COLUMN
from app.main import app
from app.storage import dataset_dir

_JAN = b"region,calls\nNorth,5\nSouth,3\n"
_FEB = b"region,calls\nEast,4\nWest,9\n"


def _make_workspace(client: TestClient) -> str:
    return client.post("/workspaces", json={"name": "CRM"}).json()["id"]


def _upload(client: TestClient, content: bytes, name: str) -> str:
    return client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": (name, content, "text/csv")},
    ).json()["temp_id"]


def _create(client: TestClient, ws: str, content: bytes, name: str) -> dict:
    temp = _upload(client, content, name)
    resp = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": temp, "items": [{"name": "calls"}]})
    assert resp.status_code == 201, resp.text
    return resp.json()[0]


def _append(client: TestClient, ws: str, ds_id: str, content: bytes, name: str) -> dict:
    temp = _upload(client, content, name)
    resp = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ds_id, "refresh_mode": "append"}]},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _rows(client: TestClient, ds_id: str) -> list[list]:
    return client.get(f"/datasets/{ds_id}/rows", params={"page_size": 100}).json()["rows"]


def _detail_cols(client: TestClient, ds_id: str) -> list[dict]:
    return client.get(f"/datasets/{ds_id}").json()["columns"]


@pytest.mark.unit
def test_initial_upload_injects_hidden_provenance_of_the_filename() -> None:
    """Criterion 1 — every dataset gains `Source.Name` = the uploaded filename,
    appended last, hidden by default, and every row carries the filename."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create(client, ws, _JAN, "jan.csv")

        cols = _detail_cols(client, ds["id"])
        assert [c["name"] for c in cols] == ["region", "calls", PROVENANCE_COLUMN]
        prov = cols[-1]
        assert prov["dtype"] == "string"
        assert prov["hidden"] is True  # hidden-by-default (new column)

        rows = _rows(client, ds["id"])
        assert {r[-1] for r in rows} == {"jan.csv"}  # provenance = filename, all rows

        # Materialized as a real string column (no dtype disturbance — R142-F2).
        df = pd.read_parquet(dataset_dir(ds["workspaceId"], ds["id"]) / "parsed.parquet")
        assert str(df[PROVENANCE_COLUMN].dtype) in ("string", "object")


@pytest.mark.unit
def test_append_tags_each_row_with_its_own_source_file() -> None:
    """Criterion 2 — after appending feb onto jan, committed rows keep 'jan.csv'
    and appended rows carry 'feb.csv' (per-row origin)."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create(client, ws, _JAN, "jan.csv")
        _append(client, ws, ds["id"], _FEB, "feb.csv")

        rows = _rows(client, ds["id"])
        by_region = {r[0]: r[-1] for r in rows}
        assert by_region == {"North": "jan.csv", "South": "jan.csv", "East": "feb.csv", "West": "feb.csv"}


@pytest.mark.unit
def test_append_backfills_committed_rows_that_predate_provenance(tmp_path) -> None:
    """Criterion 4 (unit) — a pre-R156 committed table has no provenance column;
    on append the kept committed rows are backfilled with the dataset's OWN
    source filename (not NULL), while incoming rows get the incoming filename."""
    committed = tmp_path / "committed.parquet"
    incoming = tmp_path / "incoming.parquet"
    out = tmp_path / "out.parquet"
    prov_ident = '"' + PROVENANCE_COLUMN + '"'  # DuckDB identifier: "Source.Name"
    with duckdb.connect(":memory:") as con:
        # Legacy committed table: region only, NO Source.Name.
        con.execute(f"COPY (SELECT 'North' AS region) TO '{committed}' (FORMAT 'parquet')")
        # Incoming already carries the injected provenance column.
        con.execute(
            f"COPY (SELECT 'East' AS region, 'feb.csv' AS {prov_ident}) "  # noqa: S608 — literal test fixture
            f"TO '{incoming}' (FORMAT 'parquet')"
        )
    incoming_cols = [{"name": "region", "dtype": "string"}, {"name": PROVENANCE_COLUMN, "dtype": "string"}]
    stats = append_parquets(
        committed, incoming, out, incoming_cols=incoming_cols, provenance_backfill=(PROVENANCE_COLUMN, "jan.csv")
    )
    assert stats == {"appended": 1, "total": 2}
    df = pd.read_parquet(out).sort_values("region").reset_index(drop=True)
    assert df.loc[df.region == "North", PROVENANCE_COLUMN].item() == "jan.csv"  # backfilled, not NULL
    assert df.loc[df.region == "East", PROVENANCE_COLUMN].item() == "feb.csv"


@pytest.mark.unit
def test_source_column_named_source_name_wins_no_double_injection() -> None:
    """Criterion 6 — a source file already carrying a `Source.Name` column keeps
    its own values; we do not inject a second one or overwrite it."""
    content = b"Source.Name,calls\nalpha,5\nbeta,3\n"
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create(client, ws, content, "collide.csv")

        names = [c["name"] for c in _detail_cols(client, ds["id"])]
        assert names.count(PROVENANCE_COLUMN) == 1  # not doubled
        assert names == ["Source.Name", "calls"]  # the source's column, untouched

        rows = _rows(client, ds["id"])
        # Values are the source's ('alpha'/'beta'), NOT the filename.
        assert sorted(r[0] for r in rows) == ["alpha", "beta"]


@pytest.mark.unit
def test_unhide_survives_a_refresh() -> None:
    """Criterion 5 — unhiding `Source.Name`, then refreshing, leaves it visible
    (the new-column hidden default does not re-override the user's choice)."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create(client, ws, _JAN, "jan.csv")

        # Unhide: replace-set the hidden columns to none.
        resp = client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": []})
        assert resp.status_code == 200, resp.text
        prov = next(c for c in _detail_cols(client, ds["id"]) if c["name"] == PROVENANCE_COLUMN)
        assert "hidden" not in prov or prov["hidden"] is not True

        # Replace-refresh with a new file; provenance must STAY visible.
        temp = _upload(client, _FEB, "feb.csv")
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ds["id"], "refresh_mode": "replace"}]},
        )
        assert resp.status_code == 201, resp.text
        prov = next(c for c in _detail_cols(client, ds["id"]) if c["name"] == PROVENANCE_COLUMN)
        assert "hidden" not in prov or prov["hidden"] is not True  # user's unhide preserved
