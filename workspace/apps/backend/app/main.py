from contextlib import asynccontextmanager
from typing import AsyncIterator

import duckdb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import bootstrap_schema
from app.routers import datasets, uploads, workspaces


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    bootstrap_schema()
    yield


app = FastAPI(title="my-dynamic-dashboard backend", lifespan=lifespan)

# R13: first time the backend serves the browser. The builder dev
# server runs on :3000; restrict to that until a staging/prod origin
# enters the picture.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
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
