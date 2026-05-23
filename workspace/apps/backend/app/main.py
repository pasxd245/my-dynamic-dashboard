import duckdb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import workspaces

app = FastAPI(title="my-dynamic-dashboard backend")

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


@app.get("/health")
def health() -> dict[str, str]:
    with duckdb.connect(":memory:") as con:
        version = con.execute("SELECT version()").fetchone()[0]
    return {"status": "ok", "duckdb": version}
