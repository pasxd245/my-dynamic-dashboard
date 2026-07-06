import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import duckdb
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app._config import CONFIG
from app.db import run_startup_migrations
from app.jobs.tmp_sweep import sweep_loop
from app.routers import dashboards, datasets, queries, relationships, uploads, workflows, workspaces
from app.storage import get_data_root


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # R78: adopt-or-upgrade via Alembic (replaces the hand-bootstrapped
    # schema). Fresh DB → upgrade head; existing dev DB → heal-then-stamp
    # then upgrade. See app/db.py and .agents/context/persistence.md.
    run_startup_migrations()

    # R30: spawn the tmp-upload sweep as a lifespan-managed asyncio task.
    # Disabled in tests via MDD_BACKEND__TMP_SWEEP__ENABLED=false.
    sweep_cfg = CONFIG.settings.backend.tmp_sweep
    sweep_task: asyncio.Task[None] | None = None
    if sweep_cfg.enabled:
        sweep_task = asyncio.create_task(
            sweep_loop(
                data_root=get_data_root(),
                interval_seconds=sweep_cfg.interval_seconds,
                ttl_seconds=sweep_cfg.ttl_seconds,
            ),
            name="tmp_sweep_loop",
        )
        app.state.tmp_sweep_task = sweep_task

    try:
        yield
    finally:
        if sweep_task is not None:
            sweep_task.cancel()
            try:
                await sweep_task
            except asyncio.CancelledError: # NOSONAR
                # We cancelled it ourselves at shutdown — swallowing is
                # intentional; don't re-raise into the lifespan.
                pass  # noqa: S7497
            except Exception:  # noqa: BLE001
                logger.exception("tmp_sweep_loop crashed during shutdown")


class UnhandledErrorMiddleware(BaseHTTPMiddleware):
    """R151/F3 — turn an unhandled exception into a typed JSON 500 that flows
    back OUT through CORSMiddleware. Without this, an unhandled 500 propagates to
    Starlette's outermost ServerErrorMiddleware (OUTSIDE the CORS layer), so the
    response carries no ``Access-Control-Allow-Origin`` header — the browser then
    mislabels it a *CORS* failure and the FE sees only a generic "Failed to
    fetch", hiding the real server error (R142-F3). Registered INNER to CORS
    (added BEFORE it, so CORS wraps it) so the CORS layer still decorates the
    error response. The traceback is logged — the durable trace in ``backend.log``
    — while the client body stays generic (no internals leaked)."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await call_next(request)
        except Exception:
            logger.exception("unhandled_error: %s %s", request.method, request.url.path)
            return JSONResponse(status_code=500, content={"detail": "internal_error"})


app = FastAPI(title="my-dynamic-dashboard backend", lifespan=lifespan)

# R151/F3 — added BEFORE CORSMiddleware so CORS is the OUTER layer and decorates
# the 500 this emits (a later add_middleware call is the outer wrapper). Order is
# load-bearing: flipped, the 500 would again lack CORS headers.
app.add_middleware(UnhandledErrorMiddleware)

# R13: first time the backend serves the browser. The builder dev
# server runs on :3000; restrict to that until a staging/prod origin
# enters the picture.
# R26 (post-merge fix): added PATCH + DELETE to allow_methods.
# R28: allow_origins now reads from CONFIG (values.yaml +
# MDD_CONFIG_FILE override + MDD_BACKEND__CORS_ALLOW_ORIGINS env var)
# instead of being hardcoded. allow_methods stays inline — it's
# protocol-level, not deployment-config.
# R72: added PUT — the query construction surface's Save is
# `PUT /queries/{id}`; without it the browser preflight is rejected
# (the MSW/pytest harness doesn't exercise CORS, so this only shows
# in the real app).
app.add_middleware(
    CORSMiddleware,
    allow_origins=CONFIG.settings.backend.cors_allow_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(workspaces.router)
app.include_router(uploads.router)
app.include_router(datasets.router)
app.include_router(queries.router)
app.include_router(relationships.router)
app.include_router(dashboards.router)
app.include_router(workflows.router)


@app.get("/health")
def health() -> dict[str, str]:
    with duckdb.connect(":memory:") as con:
        version = con.execute("SELECT version()").fetchone()[0]
    return {"status": "ok", "duckdb": version}
