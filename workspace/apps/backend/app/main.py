import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import duckdb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app._config import CONFIG
from app.db import bootstrap_schema
from app.jobs.tmp_sweep import sweep_loop
from app.routers import datasets, uploads, workspaces
from app.storage import get_data_root


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    bootstrap_schema()

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
            except asyncio.CancelledError:
                # We cancelled it ourselves at shutdown — swallowing is
                # intentional; don't re-raise into the lifespan.
                pass  # noqa: S7497
            except Exception:  # noqa: BLE001
                logger.exception("tmp_sweep_loop crashed during shutdown")


app = FastAPI(title="my-dynamic-dashboard backend", lifespan=lifespan)

# R13: first time the backend serves the browser. The builder dev
# server runs on :3000; restrict to that until a staging/prod origin
# enters the picture.
# R26 (post-merge fix): added PATCH + DELETE to allow_methods.
# R28: allow_origins now reads from CONFIG (values.yaml +
# MDD_CONFIG_FILE override + MDD_BACKEND__CORS_ALLOW_ORIGINS env var)
# instead of being hardcoded. allow_methods stays inline — it's
# protocol-level, not deployment-config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CONFIG.settings.backend.cors_allow_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(workspaces.router)
app.include_router(uploads.router)
app.include_router(datasets.router)


@app.get("/health")
def health() -> dict[str, str]:
    with duckdb.connect(":memory:") as con:
        version = con.execute("SELECT version()").fetchone()[0]
    return {"status": "ok", "duckdb": version}
