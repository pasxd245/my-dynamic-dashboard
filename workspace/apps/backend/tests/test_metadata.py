"""R180: read-only metadata on seven noun kinds — written by token, stamped by
the server, read by everyone, flagged stale when the noun's definition moves."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app._config import CONFIG
from app._config.settings import MetadataToken
from app.main import app
from tests._conformance import validate_response

_FIXTURES = Path(__file__).parent / "fixtures"
_AI = "ai-token-0123456789abcdef"
_HUMAN = "human-token-0123456789abcdef"


@pytest.fixture
def tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        CONFIG.settings.backend,
        "metadata_tokens",
        [
            MetadataToken(token=_AI, author="agent", source="ai", namespaces=["aicowork", "ai_insights"]),
            MetadataToken(token=_HUMAN, author="analyst", source="human", namespaces=["notes"]),
        ],
    )


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed(client: TestClient) -> dict[str, str]:
    """A workspace with a dataset, a query, a dashboard (one widget) and a
    second dataset + relationship; returns the ids."""
    ws = client.post("/workspaces", json={"name": "W"}).json()["id"]

    def dataset(name: str, csv: bytes) -> str:
        up = client.post(
            "/uploads", data={"sourceFormat": "csv"}, files={"file": (f"{name}.csv", csv, "text/csv")}
        ).json()
        return client.post(
            f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": name}]}
        ).json()[0]["id"]

    ds = dataset("leads", (_FIXTURES / "sample.csv").read_bytes())
    ds2 = dataset("owners", b"id,owner\n1,Ann\n2,Bo\n")
    q = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": "All", "sourceId": ds, "definition": {"q": None, "filters": [], "advanced": []}},
    ).json()["id"]
    dsh = client.post(
        f"/workspaces/{ws}/dashboards",
        json={
            "name": "D",
            "slug": "d",
            "definition": {
                "widgets": [
                    {"id": "wdg_00000180", "queryId": q, "title": "T", "chartType": "table", "agg": "count", "span": 3}
                ]
            },
        },
    ).json()["id"]
    rel = client.post(
        f"/workspaces/{ws}/relationships",
        json={
            "leftDatasetId": ds,
            "leftColumn": "id",
            "rightDatasetId": ds2,
            "rightColumn": "id",
            "cardinality": "one_to_one",
        },
    )
    assert rel.status_code == 201, rel.text
    return {"ws": ws, "ds": ds, "ds2": ds2, "q": q, "dsh": dsh, "rel": rel.json()["id"]}


@pytest.mark.unit
def test_writes_are_off_without_a_configured_token() -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        no_header = client.put(f"/metadata/dataset/{ids['ds']}/aicowork", json={"md": "x"})
        bad = client.put(f"/metadata/dataset/{ids['ds']}/aicowork", json={"md": "x"}, headers=_auth("nope"))
        read = client.get(f"/metadata/dataset/{ids['ds']}")

    assert no_header.status_code == 401 and no_header.json() == {"code": "unauthorized"}
    assert bad.status_code == 401
    assert read.status_code == 200 and read.json()["entries"] == {} and read.json()["children"] == {}
    validate_response("metadata/get.contract.yaml", 200, read.json())


@pytest.mark.unit
def test_write_is_stamped_by_the_server_and_read_back(tokens: None) -> None:
    md = "---\nsource: export 2026-10-12\n---\n\n## Leads\n\nOne row per **lead**."
    with TestClient(app) as client:
        ids = _seed(client)
        put = client.put(f"/metadata/dataset/{ids['ds']}/aicowork", json={"md": md}, headers=_auth(_AI))
        read = client.get(f"/metadata/dataset/{ids['ds']}")

    assert put.status_code == 201, put.text
    body = put.json()
    assert body["md"] == md and body["source"] == "ai" and body["author"] == "agent" and body["stale"] is False
    assert body["writtenAt"].endswith("Z") and len(body["definitionVersion"]) == 12
    validate_response("metadata/put.contract.yaml", 201, body)
    assert read.json()["entries"] == {"aicowork": body}
    validate_response("metadata/get.contract.yaml", 200, read.json())


@pytest.mark.unit
def test_client_cannot_claim_an_author(tokens: None) -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        resp = client.put(
            f"/metadata/dataset/{ids['ds']}/aicowork",
            json={"md": "x", "author": "the boss", "source": "human"},
            headers=_auth(_AI),
        )

    assert resp.status_code == 422  # extra=forbid on the body: the field does not exist


@pytest.mark.unit
def test_namespace_rules(tokens: None) -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        other = client.put(f"/metadata/dataset/{ids['ds']}/notes", json={"md": "x"}, headers=_auth(_AI))
        system = client.put(f"/metadata/dataset/{ids['ds']}/system", json={"md": "x"}, headers=_auth(_AI))
        bad_name = client.put(f"/metadata/dataset/{ids['ds']}/Bad-Name", json={"md": "x"}, headers=_auth(_AI))
        ok_human = client.put(f"/metadata/dataset/{ids['ds']}/notes", json={"md": "y"}, headers=_auth(_HUMAN))
        ok_ai = client.put(f"/metadata/dataset/{ids['ds']}/ai_insights", json={"md": "z"}, headers=_auth(_AI))
        read = client.get(f"/metadata/dataset/{ids['ds']}")

    assert other.status_code == 403 and other.json() == {"code": "forbidden"}
    assert system.status_code == 403
    assert bad_name.status_code == 403  # not in the token's list — the list check comes first
    assert ok_human.status_code == 201 and ok_ai.status_code == 201
    entries = read.json()["entries"]
    assert set(entries) == {"notes", "ai_insights"}
    assert entries["notes"]["source"] == "human" and entries["ai_insights"]["source"] == "ai"


@pytest.mark.unit
@pytest.mark.parametrize(
    ("md", "reason"),
    [
        ("", "empty"),
        ("   \n", "empty"),
        ("<b>hi</b>", "markdown_unsafe"),
        ("![x](https://e.com/p.png)", "markdown_unsafe"),
        ("[x](javascript:alert(1))", "markdown_unsafe"),
        ("x" * (64 * 1024 + 1), "too_large"),
    ],
)
def test_entry_validation_is_422_with_a_reason(tokens: None, md: str, reason: str) -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        resp = client.put(f"/metadata/dataset/{ids['ds']}/aicowork", json={"md": md}, headers=_auth(_AI))

    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "metadata_invalid" and resp.json()["reason"] == reason
    validate_response("metadata/put.contract.yaml", 422, resp.json())


@pytest.mark.unit
def test_writing_one_namespace_leaves_the_others_alone(tokens: None) -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        client.put(f"/metadata/query/{ids['q']}/notes", json={"md": "human says"}, headers=_auth(_HUMAN))
        client.put(f"/metadata/query/{ids['q']}/aicowork", json={"md": "v1"}, headers=_auth(_AI))
        client.put(f"/metadata/query/{ids['q']}/aicowork", json={"md": "v2"}, headers=_auth(_AI))
        read = client.get(f"/metadata/query/{ids['q']}").json()["entries"]

    assert read["notes"]["md"] == "human says"
    assert read["aicowork"]["md"] == "v2"


@pytest.mark.unit
def test_every_kind_resolves_and_children_ride_with_the_parent(tokens: None) -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        targets = {
            "dataset": ids["ds"],
            "column": f"{ids['ds']}:amount",
            "relationship": ids["rel"],
            "query": ids["q"],
            "dashboard": ids["dsh"],
            "widget": f"{ids['dsh']}:wdg_00000180",
        }
        for kind, noun_id in targets.items():
            r = client.put(f"/metadata/{kind}/{noun_id}/aicowork", json={"md": f"about {kind}"}, headers=_auth(_AI))
            assert r.status_code == 201, (kind, r.text)
        ds_read = client.get(f"/metadata/dataset/{ids['ds']}").json()
        dsh_read = client.get(f"/metadata/dashboard/{ids['dsh']}").json()
        rel_read = client.get(f"/metadata/relationship/{ids['rel']}").json()
        missing_col = client.put(f"/metadata/column/{ids['ds']}:nope/aicowork", json={"md": "x"}, headers=_auth(_AI))
        missing_wdg = client.get(f"/metadata/widget/{ids['dsh']}:wdg_ffffffff")

    assert ds_read["entries"]["aicowork"]["md"] == "about dataset"
    assert ds_read["children"] == {"amount": {"aicowork": {**ds_read["children"]["amount"]["aicowork"]}}}
    assert ds_read["children"]["amount"]["aicowork"]["md"] == "about column"
    assert dsh_read["children"]["wdg_00000180"]["aicowork"]["md"] == "about widget"
    assert rel_read["entries"]["aicowork"]["md"] == "about relationship" and "children" not in rel_read
    assert missing_col.status_code == 404 and missing_wdg.status_code == 404
    validate_response("metadata/get.contract.yaml", 200, ds_read)
    validate_response("metadata/get.contract.yaml", 200, dsh_read)


@pytest.mark.unit
def test_definition_change_flags_the_entry_stale(tokens: None) -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        client.put(f"/metadata/query/{ids['q']}/aicowork", json={"md": "about the query"}, headers=_auth(_AI))
        before = client.get(f"/metadata/query/{ids['q']}").json()["entries"]["aicowork"]["stale"]
        upd = client.put(
            f"/queries/{ids['q']}",
            json={
                "definition": {
                    "q": None,
                    "filters": [{"col": 2, "dtype": "float", "op": "gt", "val": 1}],
                    "advanced": [],
                }
            },
        )
        assert upd.status_code == 200, upd.text
        after = client.get(f"/metadata/query/{ids['q']}").json()["entries"]["aicowork"]
        rewritten = client.put(
            f"/metadata/query/{ids['q']}/aicowork", json={"md": "about the new query"}, headers=_auth(_AI)
        ).json()

    assert before is False
    assert after["stale"] is True
    assert rewritten["stale"] is False


@pytest.mark.unit
def test_delete_needs_the_token_and_removes_only_that_namespace(tokens: None) -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        client.put(f"/metadata/dataset/{ids['ds']}/aicowork", json={"md": "a"}, headers=_auth(_AI))
        client.put(f"/metadata/dataset/{ids['ds']}/notes", json={"md": "n"}, headers=_auth(_HUMAN))
        anon = client.delete(f"/metadata/dataset/{ids['ds']}/aicowork")
        wrong = client.delete(f"/metadata/dataset/{ids['ds']}/aicowork", headers=_auth(_HUMAN))
        ok = client.delete(f"/metadata/dataset/{ids['ds']}/aicowork", headers=_auth(_AI))
        again = client.delete(f"/metadata/dataset/{ids['ds']}/aicowork", headers=_auth(_AI))
        read = client.get(f"/metadata/dataset/{ids['ds']}").json()["entries"]

    assert anon.status_code == 401 and wrong.status_code == 403
    assert ok.status_code == 204 and again.status_code == 404
    assert set(read) == {"notes"}


@pytest.mark.unit
def test_namespace_cap_per_noun(tokens: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        CONFIG.settings.backend,
        "metadata_tokens",
        [MetadataToken(token=_AI, author="agent", source="ai", namespaces=[f"ns{i}" for i in range(40)])],
    )
    monkeypatch.setattr("app.routers.metadata.MAX_NAMESPACES_PER_NOUN", 3)
    with TestClient(app) as client:
        ids = _seed(client)
        codes = [
            client.put(f"/metadata/dataset/{ids['ds']}/ns{i}", json={"md": "x"}, headers=_auth(_AI)).status_code
            for i in range(4)
        ]
        rewrite = client.put(f"/metadata/dataset/{ids['ds']}/ns0", json={"md": "y"}, headers=_auth(_AI))

    assert codes == [201, 201, 201, 422]
    assert rewrite.status_code == 201  # replacing an existing namespace never hits the cap


@pytest.mark.unit
def test_resaving_an_unchanged_noun_does_not_flag_stale(tokens: None) -> None:
    """A dashboard PUT stores a plain model_dump (optional fields as null); the
    version hash ignores nulls, so re-saving the same widgets — or adding a
    sibling widget — leaves a widget's entry fresh; changing the widget's own
    config flags it."""
    with TestClient(app) as client:
        ids = _seed(client)
        dsh = client.get(f"/dashboards/{ids['dsh']}").json()
        wid = f"{ids['dsh']}:wdg_00000180"
        client.put(f"/metadata/widget/{wid}/aicowork", json={"md": "about the table"}, headers=_auth(_AI))
        same = client.put(
            f"/dashboards/{ids['dsh']}",
            json={"name": dsh["name"], "slug": dsh["slug"], "definition": dsh["definition"]},
        )
        assert same.status_code == 200, same.text
        after_same = client.get(f"/metadata/widget/{wid}").json()["entries"]["aicowork"]["stale"]
        widgets = dsh["definition"]["widgets"] + [
            {
                "id": "wdg_00000181",
                "queryId": ids["q"],
                "title": "Sibling",
                "chartType": "stat",
                "agg": "count",
                "span": 1,
            }
        ]
        client.put(
            f"/dashboards/{ids['dsh']}",
            json={"name": dsh["name"], "slug": dsh["slug"], "definition": {"widgets": widgets}},
        )
        after_sibling = client.get(f"/metadata/widget/{wid}").json()["entries"]["aicowork"]["stale"]
        dash_level = client.get(f"/metadata/dashboard/{ids['dsh']}").json()
        widgets[0] = {**widgets[0], "span": 2}
        client.put(
            f"/dashboards/{ids['dsh']}",
            json={"name": dsh["name"], "slug": dsh["slug"], "definition": {"widgets": widgets}},
        )
        after_change = client.get(f"/metadata/widget/{wid}").json()["entries"]["aicowork"]["stale"]

    assert after_same is False
    assert after_sibling is False
    assert "wdg_00000180" in dash_level["children"]
    assert after_change is True
