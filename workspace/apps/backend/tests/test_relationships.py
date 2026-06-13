"""R70: relationship governance — declare / list / get / validate / stale /
delete / cascade.

Seeds a workspace with TWO CSV datasets (both from sample.csv:
id,name,amount,signed_up) via the real upload→commit path, then exercises the
four relationship routes against the contracts. The stale path inserts a
drifted edge directly (a relationship cannot be declared broken — that's the
422-on-declare guard — so post-declare schema drift is simulated at the DB
layer, mirroring test_queries' stale case).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _commit_csv(client: TestClient, ws: str, name: str) -> str:
    upload = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", (_FIXTURES / "sample.csv").read_bytes(), "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": upload["temp_id"], "items": [{"name": name}]},
    ).json()[0]
    return ds["id"]


def _seed(client: TestClient) -> tuple[str, str, str]:
    """A workspace with two datasets (same schema: id,name,amount,signed_up)."""
    ws = client.post("/workspaces", json={"name": "Marketing"}).json()["id"]
    return ws, _commit_csv(client, ws, "deals"), _commit_csv(client, ws, "accounts")


def _declare(
    client: TestClient,
    ws: str,
    left: str,
    right: str,
    *,
    left_col: str = "name",
    right_col: str = "name",
    card: str = "one_to_many",
):
    return client.post(
        f"/workspaces/{ws}/relationships",
        json={
            "leftDatasetId": left,
            "leftColumn": left_col,
            "rightDatasetId": right,
            "rightColumn": right_col,
            "cardinality": card,
        },
    )


@pytest.mark.unit
def test_declare_persists_and_returns_relationship() -> None:
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        resp = _declare(client, ws, a, b)

    assert resp.status_code == 201
    body = resp.json()
    assert body["id"].startswith("rel_")
    assert body["workspaceId"] == ws
    assert body["leftDatasetId"] == a
    assert body["rightDatasetId"] == b
    assert body["cardinality"] == "one_to_many"
    assert body["status"] == "valid"
    validate_response("relationships/post.contract.yaml", 201, body)


@pytest.mark.unit
def test_list_returns_workspace_relationships_with_status() -> None:
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        _declare(client, ws, a, b, left_col="name", right_col="name")
        _declare(client, ws, a, b, left_col="id", right_col="id")
        resp = client.get(f"/workspaces/{ws}/relationships")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert all(r["workspaceId"] == ws for r in body)
    assert all(r["status"] == "valid" for r in body)
    validate_response("relationships/get.contract.yaml", 200, body)


@pytest.mark.unit
def test_get_returns_relationship() -> None:
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        rid = _declare(client, ws, a, b).json()["id"]
        resp = client.get(f"/relationships/{rid}")

    assert resp.status_code == 200
    validate_response("relationships/detail-get.contract.yaml", 200, resp.json())


@pytest.mark.unit
def test_get_unknown_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.get("/relationships/rel_00000000")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("relationships/detail-get.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_duplicate_pair_returns_409_relationship_exists() -> None:
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        _declare(client, ws, a, b, left_col="name", right_col="name")
        resp = _declare(client, ws, a, b, left_col="name", right_col="name")
    assert resp.status_code == 409
    assert resp.json() == {"code": "relationship_exists"}
    validate_response("relationships/post.contract.yaml", 409, resp.json())


@pytest.mark.unit
def test_incompatible_dtypes_returns_422() -> None:
    # name (string) ↔ amount (float) — not join-compatible.
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        resp = _declare(client, ws, a, b, left_col="name", right_col="amount")
    assert resp.status_code == 422


@pytest.mark.unit
def test_numeric_integer_float_pair_is_compatible() -> None:
    # id (integer) ↔ amount (float) — numeric cross-compatible (J-4).
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        resp = _declare(client, ws, a, b, left_col="id", right_col="amount")
    assert resp.status_code == 201


@pytest.mark.unit
def test_unknown_column_returns_422() -> None:
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        resp = _declare(client, ws, a, b, left_col="nope", right_col="name")
    assert resp.status_code == 422


@pytest.mark.unit
def test_cross_workspace_dataset_returns_422() -> None:
    with TestClient(app) as client:
        ws, a, _b = _seed(client)
        ws2 = client.post("/workspaces", json={"name": "Sales"}).json()["id"]
        other = _commit_csv(client, ws2, "other")
        resp = _declare(client, ws, a, other)
    assert resp.status_code == 422


@pytest.mark.unit
def test_self_join_same_dataset_returns_422() -> None:
    with TestClient(app) as client:
        ws, a, _b = _seed(client)
        resp = _declare(client, ws, a, a, left_col="name", right_col="id")
    assert resp.status_code == 422


@pytest.mark.unit
def test_stale_when_referenced_column_drifts() -> None:
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        # Simulate post-declare drift: an edge referencing a column that no
        # longer exists (inserted directly, bypassing the declare-time guard).
        with db.get_conn() as con:
            con.execute(
                "INSERT INTO relationships "
                "(id, workspace_id, left_dataset_id, left_column, "
                " right_dataset_id, right_column, cardinality, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ("rel_deadbeef", ws, a, "gone_column", b, "name", "one_to_one", "2026-06-13T00:00:00Z"),
            )
            con.commit()
        resp = client.get("/relationships/rel_deadbeef")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "stale"
    validate_response("relationships/detail-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_delete_removes_relationship_then_404() -> None:
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        rid = _declare(client, ws, a, b).json()["id"]
        assert client.delete(f"/relationships/{rid}").status_code == 204
        assert client.get(f"/relationships/{rid}").status_code == 404


@pytest.mark.unit
def test_deleting_source_dataset_cascades_relationships_away() -> None:
    with TestClient(app) as client:
        ws, a, b = _seed(client)
        rid = _declare(client, ws, a, b).json()["id"]
        assert client.delete(f"/datasets/{a}").status_code == 204
        # A source dataset is gone → the edge cascaded away.
        assert client.get(f"/relationships/{rid}").status_code == 404
