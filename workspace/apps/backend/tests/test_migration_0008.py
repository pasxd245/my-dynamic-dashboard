"""R192 — migration `0008_dataset_lineage` rebuilds `datasets` (a PARENT table).

The risk it guards: dropping or renaming `datasets` with foreign keys on would
cascade-delete relationships, or re-point their REFERENCES at a temporary name.
Both directions must keep every child row, leave `PRAGMA foreign_key_check`
clean, and keep the children referencing `datasets`.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from alembic import command

from app import db

_COLS_JSON = '[{"name":"team","dtype":"string"}]'


@pytest.fixture
def _restore_db_path():
    original = db.get_db_path()
    yield
    db.set_db_path(original)


def _seed_at_0007(path: Path) -> None:
    con = sqlite3.connect(path)
    con.execute("INSERT INTO workspaces (id, name, created_at) VALUES ('ws_00000001', 'W', '2026-01-01T00:00:00Z')")
    for ds in ("ds_0000000a", "ds_0000000b"):
        con.execute(
            "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
            "source_format, sheet_name, created_at, refreshed_at, data_version) "
            f"VALUES ('{ds}', 'ws_00000001', '{ds}', 1, 1, 1, '{_COLS_JSON}', 'csv', NULL, "
            "'2026-02-03T04:05:06Z', '2026-02-04T00:00:00Z', 3)"
        )
    con.execute(
        "INSERT INTO relationships (id, workspace_id, left_dataset_id, left_column, right_dataset_id, right_column, "
        "cardinality, created_at) VALUES ('rel_0000000a', 'ws_00000001', 'ds_0000000a', 'team', 'ds_0000000b', "
        "'team', 'many_to_one', '2026-02-05T00:00:00Z')"
    )
    con.execute(
        "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
        "VALUES ('qr_0000000a', 'ws_00000001', 'ds_0000000a', 'q', '{}', '2026-02-05T00:00:00Z')"
    )
    con.execute(
        "INSERT INTO metadata_entries (kind, noun_id, namespace, md, source, author, written_at, "
        "definition_version) VALUES ('dataset', 'ds_0000000a', 'notes', 'x', 'human', 'a', "
        "'2026-02-05T00:00:00Z', 'v')"
    )
    con.commit()
    con.close()


def _state(path: Path) -> dict:
    con = sqlite3.connect(path)
    try:
        return {
            "datasets": con.execute(
                "SELECT id, source_format, refreshed_at, data_version FROM datasets ORDER BY id"
            ).fetchall(),
            "relationships": con.execute("SELECT id FROM relationships").fetchall(),
            "queries": con.execute("SELECT id FROM queries").fetchall(),
            "metadata": con.execute("SELECT noun_id FROM metadata_entries").fetchall(),
            "fk_check": con.execute("PRAGMA foreign_key_check").fetchall(),
            "rel_refs": sorted({r[2] for r in con.execute("PRAGMA foreign_key_list(relationships)").fetchall()}),
            "tables": sorted(r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()),
            "cols": [r[1] for r in con.execute("PRAGMA table_info(datasets)").fetchall()],
        }
    finally:
        con.close()


def test_0008_keeps_every_child_row_both_ways(tmp_path: Path, _restore_db_path) -> None:
    path = tmp_path / "m.sqlite"
    db.set_db_path(path)
    cfg = db._alembic_config()
    command.upgrade(cfg, "0007_workflow_runs")
    _seed_at_0007(path)

    command.upgrade(cfg, "0008_dataset_lineage")
    up = _state(path)
    assert up["datasets"] == [
        ("ds_0000000a", "csv", "2026-02-04T00:00:00Z", 3),
        ("ds_0000000b", "csv", "2026-02-04T00:00:00Z", 3),
    ]
    assert up["relationships"] == [("rel_0000000a",)]
    assert up["queries"] == [("qr_0000000a",)]
    assert up["metadata"] == [("ds_0000000a",)]
    assert up["fk_check"] == []
    assert up["rel_refs"] == ["datasets", "workspaces"]
    assert "_datasets_new" not in up["tables"]
    assert up["cols"][-2:] == ["lineage_json", "published_workflow_id"]

    # The new CHECK accepts a published dataset; the publisher is unique per workspace.
    con = sqlite3.connect(path)
    con.execute(
        "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
        "source_format, created_at, refreshed_at, data_version, lineage_json, published_workflow_id) "
        f"VALUES ('ds_0000000c', 'ws_00000001', 'pub', 1, 1, 1, '{_COLS_JSON}', 'workflow', "
        "'2026-02-06T00:00:00Z', '2026-02-06T00:00:00Z', 1, '{}', 'wf_0000000a')"
    )
    con.commit()
    with pytest.raises(sqlite3.IntegrityError):
        con.execute(
            "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
            "source_format, created_at, data_version, published_workflow_id) "
            f"VALUES ('ds_0000000d', 'ws_00000001', 'pub2', 1, 1, 1, '{_COLS_JSON}', 'workflow', "
            "'2026-02-06T00:00:00Z', 1, 'wf_0000000a')"
        )
    con.close()

    command.downgrade(cfg, "0007_workflow_runs")
    down = _state(path)
    assert ("ds_0000000c", "csv", "2026-02-06T00:00:00Z", 1) in down["datasets"]  # kept, as csv
    assert down["relationships"] == [("rel_0000000a",)]
    assert down["queries"] == [("qr_0000000a",)]
    assert down["metadata"] == [("ds_0000000a",)]
    assert down["fk_check"] == []
    assert down["rel_refs"] == ["datasets", "workspaces"]
    assert "lineage_json" not in down["cols"]

    command.upgrade(cfg, "head")
    again = _state(path)
    assert again["relationships"] == [("rel_0000000a",)]
    assert again["fk_check"] == []


def test_relationships_still_cascade_after_the_rebuild(tmp_path: Path, _restore_db_path) -> None:
    """The children's REFERENCES point at the rebuilt `datasets`: deleting a
    dataset through the app connection (foreign keys ON) still cascades."""
    path = tmp_path / "c.sqlite"
    db.set_db_path(path)
    cfg = db._alembic_config()
    command.upgrade(cfg, "0007_workflow_runs")
    _seed_at_0007(path)
    command.upgrade(cfg, "head")

    with db.get_conn() as con:
        con.execute("DELETE FROM datasets WHERE id = 'ds_0000000b'")
        con.commit()
        assert con.execute("SELECT count(*) FROM relationships").fetchone()[0] == 0
