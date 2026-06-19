#!/usr/bin/env python3
"""Seed realistic, NON-MOCK testing data into the local backend, built against
the current contract (workspaces / uploads / datasets / relationships / queries).

Loads a small sales star:

    regions (1:N) → customers (1:N) → orders
    products (1:N) → orders

plus governed relationships and two base Queries on ``customers`` to exercise
R77's "Build on this query" from (each can add the customers ⋈ orders join → a
composed Query).

UPSERT by default — re-running CONVERGES instead of duplicating:
  • workspace  : reused if one with WS_NAME exists, else created
  • dataset    : reused if (workspace, name) exists (content is immutable per the
                 contract — PATCH is metadata-only); else uploaded + committed
  • relationship: reused if the same column-pair exists (unique per workspace);
                 else declared
  • query      : found by name → PUT its definition (UPDATE); else POST (create)

  --reset : delete the whole workspace first, then a clean fresh seed (mirrors
            scripts/dev/seed.sh). Use when a CSV's CONTENT changed — a reused
            dataset keeps its original rows.

Pure stdlib (urllib) — no extra deps. Prereq: dev backend up (pnpm dev:local:up).

Usage:
    python3 scripts/dev/seed.py
    python3 scripts/dev/seed.py --reset
    BACKEND_URL=http://127.0.0.1:8000 python3 scripts/dev/seed.py
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
WS_NAME = os.environ.get("WS_NAME", "Sales demo (seed)")
DATA_DIR = Path(__file__).resolve().parent / "seed-data"
WORKSPACES = "/workspaces"

C_CYAN, C_GREEN, C_DIM, C_RED, C_RESET = "\033[36m", "\033[32m", "\033[2m", "\033[31m", "\033[0m"


def say(msg: str) -> None:
    print(f"{C_CYAN}•{C_RESET} {msg}")


def ok(action: str, msg: str) -> None:
    tag = {"create": f"{C_GREEN}+{C_RESET}", "reuse": f"{C_DIM}={C_RESET}", "update": f"{C_GREEN}~{C_RESET}"}[action]
    print(f"  {tag} {msg}")


def die(msg: str) -> "None":
    print(f"{C_RED}error:{C_RESET} {msg}", file=sys.stderr)
    raise SystemExit(1)


# --- HTTP (stdlib) -----------------------------------------------------------
def _request(method: str, path: str, *, body: bytes | None = None, headers: dict | None = None):
    url = path if path.startswith("http") else f"{BACKEND_URL}{path}"
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, {"_raw": raw.decode("utf-8", "replace")}
    except urllib.error.URLError as exc:
        die(f"cannot reach {url}: {exc.reason} — is the backend up? (pnpm dev:local:up)")


def get(path: str):
    return _request("GET", path)


def post(path: str, payload: dict):
    return _request("POST", path, body=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})


def put(path: str, payload: dict):
    return _request("PUT", path, body=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})


def delete(path: str):
    return _request("DELETE", path)


def upload_csv(csv_path: Path) -> str:
    """multipart/form-data POST /uploads — returns temp_id."""
    boundary = f"----seed{uuid.uuid4().hex}"
    ctype = mimetypes.guess_type(csv_path.name)[0] or "text/csv"
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="sourceFormat"\r\n\r\ncsv\r\n'.encode(),
        (
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
            f'filename="{csv_path.name}"\r\nContent-Type: {ctype}\r\n\r\n'
        ).encode(),
        csv_path.read_bytes(),
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    status, data = _request(
        "POST", "/uploads", body=b"".join(parts),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    if status != 200 or not data or "temp_id" not in data:
        die(f"upload({csv_path.name}) failed [{status}]: {data}")
    return data["temp_id"]


# --- upserts -----------------------------------------------------------------
def upsert_workspace(name: str) -> str:
    status, rows = get(WORKSPACES)
    if status != 200:
        die(f"list workspaces [{status}]: {rows}")
    existing = next((w["id"] for w in rows if w["name"] == name), None)
    if existing:
        ok("reuse", f"workspace {existing} ({name})")
        return existing
    status, data = post(WORKSPACES, {"name": name})
    if status not in (200, 201):
        die(f"create workspace [{status}]: {data}")
    ok("create", f"workspace {data['id']} ({name})")
    return data["id"]


def upsert_dataset(ws: str, name: str) -> str:
    csv_path = DATA_DIR / f"{name}.csv"
    if not csv_path.is_file():
        die(f"missing fixture: {csv_path}")
    _, all_ds = get("/datasets")
    existing = next((d["id"] for d in (all_ds or []) if d["workspaceId"] == ws and d["name"] == name), None)
    if existing:
        ok("reuse", f"dataset {existing} ({name})")
        return existing
    temp_id = upload_csv(csv_path)
    status, data = post(f"/workspaces/{ws}/datasets/batch", {"temp_id": temp_id, "items": [{"name": name}]})
    if status not in (200, 201) or not isinstance(data, list):
        die(f"commit dataset({name}) [{status}]: {data}")
    ok("create", f"dataset {data[0]['id']} ({name})")
    return data[0]["id"]


def upsert_relationship(ws: str, left: str, lcol: str, right: str, rcol: str, card: str) -> str:
    _, rels = get(f"/workspaces/{ws}/relationships")
    for r in rels or []:
        if (r["leftDatasetId"], r["leftColumn"], r["rightDatasetId"], r["rightColumn"]) == (left, lcol, right, rcol):
            ok("reuse", f"relationship {r['id']} ({lcol} → {rcol})")
            return r["id"]
    status, data = post(
        f"/workspaces/{ws}/relationships",
        {"leftDatasetId": left, "leftColumn": lcol, "rightDatasetId": right, "rightColumn": rcol, "cardinality": card},
    )
    if status not in (200, 201):
        die(f"declare relationship({lcol}→{rcol}) [{status}]: {data}")
    ok("create", f"relationship {data['id']} ({lcol} → {rcol})")
    return data["id"]


def upsert_query(ws: str, name: str, dataset_id: str, definition: dict) -> str:
    _, queries = get(f"/workspaces/{ws}/queries")
    existing = next((q["id"] for q in (queries or []) if q["name"] == name), None)
    if existing:
        status, data = put(f"/queries/{existing}", {"definition": definition})
        if status != 200:
            die(f"update query({name}) [{status}]: {data}")
        ok("update", f'query {existing} ("{name}")')
        return existing
    status, data = post(f"/workspaces/{ws}/queries", {"name": name, "sourceId": dataset_id, "definition": definition})
    if status not in (200, 201):
        die(f"create query({name}) [{status}]: {data}")
    ok("create", f'query {data["id"]} ("{name}")')
    return data["id"]


# --- seed --------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="Seed/upsert non-mock testing data into the local backend.")
    ap.add_argument("--reset", action="store_true", help="delete the workspace first, then seed fresh")
    # Tolerate pnpm's argument separator: `pnpm dev:seed --reset` forwards a bare `--`.
    args = ap.parse_args([a for a in sys.argv[1:] if a != "--"])

    status, _ = get("/health")
    if status != 200:
        die(f"backend unhealthy at {BACKEND_URL} [{status}] — run: pnpm dev:local:up")
    say(f"backend: {BACKEND_URL}")

    if args.reset:
        _, rows = get(WORKSPACES)
        prior = next((w["id"] for w in (rows or []) if w["name"] == WS_NAME), None)
        if prior:
            # A workspace delete 409s while it still holds datasets (no cascade from the
            # workspace). Delete each dataset first — that DOES cascade its queries +
            # relationships — then the now-empty workspace.
            _, all_ds = get("/datasets")
            for d in (all_ds or []):
                if d["workspaceId"] == prior:
                    delete(f"/datasets/{d['id']}")
            status, _ = delete(f"/workspaces/{prior}")
            if status not in (200, 204):
                die(f"--reset: could not drop workspace {prior} [{status}]")
            say(f"--reset: dropped workspace {prior} ({WS_NAME})")

    ws = upsert_workspace(WS_NAME)

    ds = {name: upsert_dataset(ws, name) for name in ("regions", "products", "customers", "orders")}

    rel_cust_ord = upsert_relationship(ws, ds["customers"], "customer_id", ds["orders"], "customer_id", "one_to_many")
    upsert_relationship(ws, ds["products"], "product_id", ds["orders"], "product_id", "one_to_many")
    upsert_relationship(ws, ds["regions"], "region_id", ds["customers"], "region_id", "one_to_many")

    # Column indexes (0-based) for the filter atoms below:
    #   customers: 0 customer_id · 1 customer_name · 2 region_id · 3 tier · 4 is_active · 5 signed_up
    #   orders:    0 order_id · 1 customer_id · 2 product_id · 3 amount · 4 quantity · 5 status · 6 is_priority · 7 ordered_at
    def defn(filters=None, advanced=None, joins=None, relationships=None):
        return {
            "q": None,
            "filters": filters or [],
            "advanced": advanced or [],
            # R88 — a query OWNS its join relationships (copy-on-pick); hops reference
            # them by `queryRelId`. Empty for single-source queries.
            "relationships": relationships or [],
            "joins": joins or [],
        }

    def qrel(rel_id, left, lcol, right, rcol, card="one_to_many"):
        """COPY-ON-PICK: a query-owned relationship copied from a governed `rel_`
        (provenance kept in `originRelationshipId`)."""
        return {
            "id": "qrel_" + rel_id.split("_", 1)[1],
            "leftSourceId": left,
            "leftColumn": lcol,
            "rightSourceId": right,
            "rightColumn": rcol,
            "cardinality": card,
            "originRelationshipId": rel_id,
        }

    # The seeded saved join: customers ⋈ orders, copy-on-picked from the governed rel.
    cust_ord_qrel = qrel(rel_cust_ord, ds["customers"], "customer_id", ds["orders"], "customer_id")

    # Each base query exercises a distinct query-builder flow. (name, source, definition, blurb)
    base_queries = [
        ("Gold-tier customers", "customers",
         defn(filters=[{"col": 3, "dtype": "string", "op": "equals", "val": "gold"}]),
         "string filter + Build-on → join orders"),
        ("Active customers", "customers",
         defn(filters=[{"col": 4, "dtype": "boolean", "op": "is_true"}]),
         "boolean (is_true) filter"),
        ("Big or pending orders", "orders",
         defn(advanced=[  # advanced DNF (OR of AND-groups)
             [{"col": 3, "dtype": "float", "op": "gt", "val": 500}],
             [{"col": 5, "dtype": "string", "op": "equals", "val": "pending"}],
         ]),
         "advanced query (DNF: amount>500 OR status=pending)"),
        ("All regions", "regions", defn(),
         "Build-on → 2-hop tree regions ⋈ customers ⋈ orders"),
        ("Customers with orders", "customers",
         defn(relationships=[cust_ord_qrel],
              joins=[{"queryRelId": cust_ord_qrel["id"], "type": "inner"}]),
         "a saved inner join (renders an existing hop)"),
        ("All customers", "customers", defn(),
         "plain base — try left/full joins to see unmatched rows"),
    ]
    seeded = [(name, upsert_query(ws, name, ds[source], definition), blurb)
              for name, source, definition, blurb in base_queries]

    print()
    say(f"seed complete — workspace \"{WS_NAME}\" ({ws})")
    print("\n  Datasets:      regions(5) · products(7) · customers(11) · orders(32)")
    print("  Relationships: customers→orders · products→orders · regions→customers (one_to_many)")
    print("  Unmatched rows (for left/right/full joins): region 'Africa' (no customers),")
    print("    customer 'Lonely Co' (no orders), product 'Legacy Tool' (never ordered).")
    print("\n  Base queries — each exercises a different query-builder flow:")
    for name, qid, blurb in seeded:
        print(f"    • {name:<22} {FRONTEND_URL}/data-management/queries/{qid}")
        print(f"      {C_DIM}{blurb}{C_RESET}")
    print()


if __name__ == "__main__":
    main()
