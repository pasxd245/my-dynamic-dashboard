"""R195 (item 3.7b) — `DashboardDefinition.controls` (`kind: param`): saved with
the dashboard, checked at save, and read by the server as the dashboard level of
a widget's parameter value (dashboard-filters.md D3, D4)."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from tests._conformance import validate_response
from tests.test_params import _as_of_query, _dataset, _query

_W1, _W2 = "wdg_0000000a", "wdg_0000000b"


def _widget(wid: str, qid: str) -> dict:
    return {"id": wid, "queryId": qid, "title": wid, "chartType": "table", "agg": "count", "span": 1}


def _dashboard(client: TestClient, ws: str, widgets: list[dict], controls: list[dict] | None = None, name: str = "D"):
    definition: dict = {"widgets": widgets}
    if controls is not None:
        definition["controls"] = controls
    return client.post(
        f"/workspaces/{ws}/dashboards", json={"name": name, "slug": name.lower(), "definition": definition}
    )


def _control(**over) -> dict:
    return {"id": "ctl_0000000a", "kind": "param", "label": "As of", "param": "as_of", "targets": "all", **over}


@pytest.mark.unit
def test_controls_save_round_trip_and_apply_as_the_dashboard_level() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _as_of_query(cols, default="2026-10-10")).json()["id"]
        created = _dashboard(client, ws, [_widget(_W1, q)], [_control(saved="2026-10-11", targets=[_W1])])
        dsh = created.json()["id"]
        got = client.get(f"/dashboards/{dsh}").json()
        rows = client.get(f"/queries/{q}/rows?dashboard={dsh}&widget={_W1}").json()
        relative = client.put(
            f"/dashboards/{dsh}",
            json={
                "name": "D",
                "slug": "d",
                "definition": {
                    "widgets": [_widget(_W1, q)],
                    "controls": [_control(saved={"kind": "today", "offsetDays": -1})],
                },
            },
        )

    assert created.status_code == 201, created.text
    validate_response("dashboards/post.contract.yaml", 201, created.json())
    assert got["definition"]["controls"][0]["saved"] == "2026-10-11"
    assert rows["resolvedParams"]["as_of"] == {"value": "2026-10-11", "source": "dashboard"}
    assert relative.status_code == 200, relative.text


@pytest.mark.unit
def test_a_dashboard_without_controls_is_unchanged() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _as_of_query(cols, default="2026-10-10")).json()["id"]
        created = _dashboard(client, ws, [_widget(_W1, q)]).json()
        with db.get_conn() as con:
            stored = json.loads(
                con.execute("SELECT definition_json FROM dashboards WHERE id = ?", (created["id"],)).fetchone()[0]
            )

    assert "controls" not in created["definition"]
    assert stored.get("controls") is None


@pytest.mark.unit
def test_control_save_checks() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _as_of_query(cols, default="2026-10-10")).json()["id"]
        widgets = [_widget(_W1, q)]
        unknown_target = _dashboard(client, ws, widgets, [_control(targets=[_W2])])
        dup_param = _dashboard(client, ws, widgets, [_control(), _control(id="ctl_0000000b")])
        dup_id = _dashboard(client, ws, widgets, [_control(), _control(param="other")])
        wrong_type = _dashboard(client, ws, widgets, [_control(saved=5)])
        bad_date = _dashboard(client, ws, widgets, [_control(saved="last week")])
        bad_kind = _dashboard(client, ws, widgets, [_control(kind="values")])
        too_many = _dashboard(
            client, ws, widgets, [_control(id=f"ctl_000000{i:02x}", param=f"p{i}") for i in range(13)]
        )
        dup_target = _dashboard(client, ws, widgets, [_control(targets=[_W1, _W1])])
        n_query = _query(
            client,
            ws,
            ds,
            {
                "q": None,
                "advanced": [],
                "params": [{"name": "n", "type": "number"}],
                "filters": [{"col": 2, "dtype": "integer", "op": "gte", "val": {"param": "n"}}],
            },
            "n",
        ).json()["id"]
        half = _dashboard(client, ws, [_widget(_W2, n_query)], [_control(param="n", saved=2.5)])
        whole = _dashboard(client, ws, [_widget(_W2, n_query)], [_control(param="n", saved=2.0)], name="Whole")
        unused_ok = _dashboard(client, ws, widgets, [_control(param="nothing_uses_me", saved=5)])

    for r, needle in (
        (unknown_target, "unknown_widget"),
        (dup_param, "duplicate_param"),
        (dup_id, "duplicate_control"),
        (wrong_type, "param_type"),
        (bad_date, "param_type"),
        (bad_kind, ""),
        (too_many, ""),
        (dup_target, "duplicate_target"),
        (half, "whole number"),
    ):
        assert r.status_code == 422 and needle in r.text, r.text
    assert whole.status_code == 201, whole.text
    assert unused_ok.status_code == 201  # a control no query uses is skipped there, not refused (D5)
