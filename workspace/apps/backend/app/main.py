import duckdb
from fastapi import FastAPI

app = FastAPI(title="my-dynamic-dashboard backend")


@app.get("/health")
def health() -> dict[str, str]:
    with duckdb.connect(":memory:") as con:
        version = con.execute("SELECT version()").fetchone()[0]
    return {"status": "ok", "duckdb": version}
