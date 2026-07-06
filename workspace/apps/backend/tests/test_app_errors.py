"""R151/F3 — an unhandled server error must return a typed JSON 500 that still
carries the CORS header (so the browser reads a real 500 instead of mislabeling
a header-less response "CORS blocked") and must log a traceback (the durable
trace in backend.log). Exercises the REAL app's middleware stack."""

import logging

import pytest
from fastapi.testclient import TestClient

from app._config import CONFIG
from app.main import app


@pytest.mark.unit
def test_unhandled_exception_returns_cors_safe_typed_500(
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def _boom() -> None:
        raise RuntimeError("kaboom")

    app.add_api_route("/_test/boom", _boom, methods=["GET"])
    origin = CONFIG.settings.backend.cors_allow_origins[0]
    # caplog's handler must be attached to the app logger explicitly (propagation
    # + level nuances; same pattern as test_datasets_batch's coercion-log check).
    main_logger = logging.getLogger("app.main")
    main_logger.addHandler(caplog.handler)
    try:
        # raise_server_exceptions=False → observe the 500 response the browser
        # would receive rather than re-raising the error into the test.
        with (
            TestClient(app, raise_server_exceptions=False) as client,
            caplog.at_level(logging.ERROR, logger="app.main"),
        ):
            resp = client.get("/_test/boom", headers={"Origin": origin})
    finally:
        main_logger.removeHandler(caplog.handler)
        app.router.routes = [
            r for r in app.router.routes if getattr(r, "path", None) != "/_test/boom"
        ]

    assert resp.status_code == 500
    assert resp.json() == {"detail": "internal_error"}
    # The F3 fix: the CORS layer (OUTER to the error middleware) decorated the
    # 500 — without it the browser would see no Allow-Origin and cry "CORS".
    assert resp.headers.get("access-control-allow-origin") == origin
    # Supportability: the traceback is logged (backend.log), body stays generic.
    assert "unhandled_error" in caplog.text
    assert "kaboom" in caplog.text
