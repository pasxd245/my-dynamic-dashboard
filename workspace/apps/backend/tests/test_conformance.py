"""Cross-cutting conformance test.

One canonical happy-path response per contract, validated against
the locked OpenAPI 3.1 schema. The per-endpoint test files also
include their own `validate_response(...)` assertions; this file is
the belt-and-braces sweep that catches "did we forget the
conformance check on one endpoint" regressions.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response
from tests._excel import two_sheet_workbook


_FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.contract
def test_all_six_endpoints_conform_to_locked_contracts() -> None:
    with TestClient(app) as client:
        # 1. GET /workspaces — empty.
        resp = client.get("/workspaces")
        validate_response("workspaces/get.contract.yaml", 200, resp.json())

        # 2. POST /workspaces.
        ws = client.post("/workspaces", json={"name": "Conformance"}).json()
        validate_response("workspaces/post.contract.yaml", 201, ws)

        # 3. POST /uploads — Excel multi-sheet.
        upload = client.post(
            "/uploads",
            data={"sourceFormat": "excel"},
            files={
                "file": (
                    "book.xlsx",
                    two_sheet_workbook(),
                    "application/octet-stream",
                )
            },
        ).json()
        validate_response("uploads/post.contract.yaml", 200, upload)

        # 4. POST /uploads/{temp_id}/parse.
        parsed = client.post(
            f"/uploads/{upload['temp_id']}/parse",
            json={"items": [{"sheet": "Deals"}]},
        ).json()
        validate_response("uploads/parse.contract.yaml", 200, parsed)

        # 5. POST /workspaces/{id}/datasets/batch.
        committed = client.post(
            f"/workspaces/{ws['id']}/datasets/batch",
            json={
                "temp_id": upload["temp_id"],
                "items": [{"sheet": "Deals", "name": "q1_deals"}],
            },
        ).json()
        validate_response("datasets/batch-post.contract.yaml", 201, committed)

        # 6. GET /datasets.
        listed = client.get("/datasets").json()
        validate_response("datasets/get.contract.yaml", 200, listed)
