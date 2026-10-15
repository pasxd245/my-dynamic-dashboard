"""R183: GET /relationships/{id}/check — the relationship measured against the
data: coverage both ways, unmatched rows, observed vs declared cardinality,
join multiplication. A flag, never a block: the joined query still runs."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response

# left: key 3 repeats (and has no partner), key 9 has no partner, one blank key.
_LEFT = b"key,amount\n1,10\n2,20\n3,30\n3,31\n9,90\n,5\n"
# right: 1, 2, 4 — 4 has no partner on the left; keys unique.
_RIGHT = b"key,owner\n1,Ann\n2,Bo\n4,Cy\n"


def _commit(client: TestClient, ws: str, name: str, csv: bytes) -> str:
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": (f"{name}.csv", csv, "text/csv")}).json()
    return client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": name}]}
    ).json()[0]["id"]


def _seed(client: TestClient, cardinality: str = "one_to_one") -> tuple[str, str, str, dict]:
    ws = client.post("/workspaces", json={"name": "R"}).json()["id"]
    left = _commit(client, ws, "facts", _LEFT)
    right = _commit(client, ws, "dims", _RIGHT)
    rel = client.post(
        f"/workspaces/{ws}/relationships",
        json={
            "leftDatasetId": left,
            "leftColumn": "key",
            "rightDatasetId": right,
            "rightColumn": "key",
            "cardinality": cardinality,
        },
    )
    assert rel.status_code == 201, rel.text
    return ws, left, right, rel.json()


@pytest.mark.unit
def test_check_measures_coverage_keys_and_cardinality() -> None:
    with TestClient(app) as client:
        _, _, _, rel = _seed(client, "one_to_one")
        resp = client.get(f"/relationships/{rel['id']}/check")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    validate_response("relationships/check-get.contract.yaml", 200, body)
    # left: 6 rows; 1 and 2 match → 2; 3, 3, 9 and the blank do not.
    assert body["leftRows"] == 6 and body["leftMatchedRows"] == 2 and body["leftUnmatchedRows"] == 4
    assert body["leftCoverage"] == pytest.approx(2 / 6, abs=1e-6)
    # right: 3 rows; 1, 2 match → 2; 4 does not.
    assert body["rightRows"] == 3 and body["rightMatchedRows"] == 2 and body["rightUnmatchedRows"] == 1
    assert body["rightCoverage"] == pytest.approx(2 / 3, abs=1e-6)
    assert body["leftDistinctKeys"] == 4 and body["rightDistinctKeys"] == 3  # blanks are not keys
    assert body["leftMaxPerKey"] == 2 and body["rightMaxPerKey"] == 1
    # the left repeats keys → many_to_one observed; declared one_to_one → flagged, not blocked.
    assert body["observedCardinality"] == "many_to_one"
    assert body["declaredCardinality"] == "one_to_one" and body["cardinalityMatches"] is False
    # a hop left → right never multiplies (right keys unique); the reverse would.
    assert body["multipliesLeft"] is False and body["multipliesRight"] is True


@pytest.mark.unit
def test_matching_declaration_is_not_flagged_and_the_join_still_runs() -> None:
    with TestClient(app) as client:
        ws, left, _right, rel = _seed(client, "many_to_one")
        check = client.get(f"/relationships/{rel['id']}/check").json()
        qrel = {
            "id": "qrel_" + rel["id"].split("_", 1)[1],
            "leftSourceId": rel["leftDatasetId"],
            "leftColumn": "key",
            "rightSourceId": rel["rightDatasetId"],
            "rightColumn": "key",
            "cardinality": rel["cardinality"],
            "originRelationshipId": rel["id"],
        }
        created = client.post(
            f"/workspaces/{ws}/queries",
            json={
                "name": "facts × dims",
                "sourceId": left,
                "definition": {
                    "q": None,
                    "filters": [],
                    "advanced": [],
                    "relationships": [qrel],
                    "joins": [{"queryRelId": qrel["id"], "type": "inner"}],
                },
            },
        )
        assert created.status_code == 201, created.text
        rows = client.get(f"/queries/{created.json()['id']}/rows")

    assert check["cardinalityMatches"] is True
    assert rows.status_code == 200 and rows.json()["total"] == 2  # keys 1 and 2 — the flag changed nothing


@pytest.mark.unit
def test_missing_is_404_and_a_stale_edge_is_409() -> None:
    with TestClient(app) as client:
        ws, left, _right, rel = _seed(client)
        missing = client.get("/relationships/rel_ffffffff/check")
        # Drift the left key column away (a refresh that renames it) → stale.
        up = client.post(
            "/uploads", data={"sourceFormat": "csv"}, files={"file": ("f.csv", b"id,amount\n1,1\n", "text/csv")}
        ).json()
        refreshed = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": up["temp_id"], "items": [{"name": "IGNORED", "target_dataset_id": left}]},
        )
        assert refreshed.status_code == 201, refreshed.text
        stale = client.get(f"/relationships/{rel['id']}/check")

    assert missing.status_code == 404
    assert stale.status_code == 409 and stale.json() == {"code": "relationship_stale"}
