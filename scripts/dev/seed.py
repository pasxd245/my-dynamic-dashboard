#!/usr/bin/env python3
"""Seed realistic, NON-MOCK testing data into the local backend, built against
the current contract (workspaces / uploads / datasets / relationships / queries).

Loads a small sales star:

    regions (1:N) → customers (1:N) → orders
    products (1:N) → orders

plus governed relationships, twelve base Queries (each exercising a different
query-builder flow, including the R163 within-group column and the R164/R165
ordered-window family), and — R167 — one materialized Workflow consolidating a
shaped query.

UPSERT by default — re-running CONVERGES instead of duplicating:
  • workspace  : reused if one with WS_NAME exists, else created
  • dataset    : reused if (workspace, name) exists (content is immutable per the
                 contract — PATCH is metadata-only); else uploaded + committed
  • relationship: reused if the same column-pair exists (unique per workspace);
                 else declared
  • query      : found by name → PUT its definition (UPDATE); else POST (create)
  • workflow   : found by name → PUT; else POST — then RUN, so it is materialized

  --reset : delete the whole workspace first, then a clean fresh seed (mirrors
            scripts/dev/seed.sh). Use when a CSV's CONTENT changed — a reused
            dataset keeps its original rows.

R99 — the FACT tables (orders, telesale) are GENERATED to a target volume
(deterministic) and uploaded in-memory; the bulk is never committed. Two modes:
  • ``pnpm dev:seed``       — LIGHT/fast (small counts, same structure: telesale +
                              all relationships + edge cases). For everyday dev.
  • ``pnpm dev:seed:full``  — the full Sales scenario (default 2000/2000/50), for
                              the dashboard / volume work. Tune: --orders/--telesale/--customers.

LIGHT IS NOT A SUBSET OF FULL — it trades in BOTH directions (R166, measured):
  • The two modes are STRUCTURALLY IDENTICAL — same 5 datasets, same 5 relationships,
    same 12 saved queries + 1 workflow, same inferred dtypes, and all four edge cases (which
    live in the committed base CSVs, not the generated volume, and are enforced for both
    by ``validate_data``). Nothing is *missing* from light.
  • Light detects LESS of anything volume-driven: paging depth, query cost, wide results.
  • Light detects MORE of anything sparsity-driven. Chiefly ``window_column``'s
    ``prior_period``, whose contract is that a MISSING period reads NULL rather than the
    wrong period's value — a dense table has no missing periods to prove it on. At the
    full volume ZERO order statuses have an interior month gap; at light, three of four
    do. See ``parse_args`` for the measured curve behind light's counts.
So: reach for full when the question is "does it hold at scale", light when the question
is "is the number right" — and do not read a green light run as covering the other.

Pure stdlib (urllib) — no extra deps. Prereq: dev backend up (pnpm dev:local:up).
(Dataset content is immutable once committed — re-seed at a new volume with --reset.)

Usage:
    pnpm dev:seed                 # light (≈ --light)
    pnpm dev:seed:full            # full volume (2000/2000/50)
    python3 scripts/dev/seed.py --reset                                  # full + fresh
    python3 scripts/dev/seed.py --orders 5000 --telesale 3000 --customers 80 --reset
    python3 scripts/dev/seed.py --light --dry-run    # generate + validate, no backend
    BACKEND_URL=http://127.0.0.1:8000 python3 scripts/dev/seed.py
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import mimetypes
import os
import random
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta
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


def upload_bytes(filename: str, content: bytes) -> str:
    """multipart/form-data POST /uploads of in-memory CSV bytes — returns temp_id."""
    boundary = f"----seed{uuid.uuid4().hex}"
    ctype = mimetypes.guess_type(filename)[0] or "text/csv"
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="sourceFormat"\r\n\r\ncsv\r\n'.encode(),
        (
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
            f'filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'
        ).encode(),
        content,
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    status, data = _request(
        "POST", "/uploads", body=b"".join(parts),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    if status != 200 or not data or "temp_id" not in data:
        die(f"upload({filename}) failed [{status}]: {data}")
    return data["temp_id"]


def upload_csv(csv_path: Path) -> str:
    """Upload a committed fixture CSV (small dimensions)."""
    return upload_bytes(csv_path.name, csv_path.read_bytes())


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


def _commit_dataset(ws: str, name: str, temp_id: str) -> str:
    status, data = post(f"/workspaces/{ws}/datasets/batch", {"temp_id": temp_id, "items": [{"name": name}]})
    if status not in (200, 201) or not isinstance(data, list):
        die(f"commit dataset({name}) [{status}]: {data}")
    ok("create", f"dataset {data[0]['id']} ({name})")
    return data[0]["id"]


def _existing_dataset(ws: str, name: str) -> str | None:
    _, all_ds = get("/datasets")
    return next((d["id"] for d in (all_ds or []) if d["workspaceId"] == ws and d["name"] == name), None)


def upsert_dataset(ws: str, name: str) -> str:
    """Upsert from a committed fixture CSV (the small, immutable dimensions)."""
    csv_path = DATA_DIR / f"{name}.csv"
    if not csv_path.is_file():
        die(f"missing fixture: {csv_path}")
    existing = _existing_dataset(ws, name)
    if existing:
        ok("reuse", f"dataset {existing} ({name})")
        return existing
    return _commit_dataset(ws, name, upload_csv(csv_path))


def upsert_dataset_bytes(ws: str, name: str, content: bytes) -> str:
    """Upsert from in-memory generated CSV bytes (the volume facts + scaled customers).
    Content is immutable once committed, so re-running reuses; use --reset to re-seed
    at a different volume."""
    existing = _existing_dataset(ws, name)
    if existing:
        ok("reuse", f"dataset {existing} ({name})")
        return existing
    return _commit_dataset(ws, name, upload_bytes(f"{name}.csv", content))


def upsert_relationship(ws: str, left: str, lcol: str, right: str, rcol: str, card: str, optional: bool = False):
    """`optional=True` — a nullable FK (e.g. telesale.order_id, blank on non-converted
    calls) may fail dtype-matching; warn + skip instead of aborting the whole seed."""
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
        if optional:
            print(f"  {C_DIM}~ skipped optional relationship ({lcol} → {rcol}) [{status}]: {data}{C_RESET}")
            return None
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


def upsert_workflow(ws: str, name: str, sources: list[str], steps: list | None = None) -> str:
    """R167 — seed ONE workflow, and RUN it so it is materialized.

    The acceptance walk needs a workflow to exist at all: narrowing the `qr_` resolver
    to Workflow's reader is R167's riskiest change, and with an empty `workflows` table
    it would be verified only by tests. This is also the artifact that makes the
    DEFERRED D1 trap visible by hand — see the note at the call site."""
    _, flows = get(f"/workspaces/{ws}/workflows")
    body = {"name": name, "definition": {"sources": sources, "steps": steps or []}}
    existing = next((w["id"] for w in (flows or []) if w["name"] == name), None)
    if existing:
        status, data = put(f"/workflows/{existing}", body)
        if status != 200:
            die(f"update workflow({name}) [{status}]: {data}")
        ok("update", f'workflow {existing} ("{name}")')
        wid = existing
    else:
        status, data = post(f"/workspaces/{ws}/workflows", body)
        if status not in (200, 201):
            die(f"create workflow({name}) [{status}]: {data}")
        ok("create", f'workflow {data["id"]} ("{name}")')
        wid = data["id"]
    # Materialize it — an un-run workflow has no output, which reads as
    # `composition_base_missing` to anything that consumes it.
    status, data = post(f"/workflows/{wid}/run", {})
    if status not in (200, 201):
        die(f"run workflow({name}) [{status}]: {data}")
    ok("update", f'workflow {wid} materialized')
    return wid


# --- data generator ----------------------------------------------------------
# Deterministic (fixed RNG seed) — re-runs + reviews are stable. Extends the
# committed "light" base CSVs (edge cases) up to a target volume in-memory; the
# bulk is never committed to git (R99 decision 1).
GEN_SEED = 1337
AGENTS = ["Alice Nguyen", "Bao Tran", "Carmen Diaz", "Dan O'Neil", "Elif Kaya",
          "Farouk Aziz", "Grace Park", "Hiro Tanaka"]
ORDER_STATUSES = ["completed", "completed", "completed", "pending", "cancelled", "refunded"]
TELESALE_OUTCOMES = ["connected", "no_answer", "callback", "converted", "declined"]
TELESALE_WEIGHTS = [30, 25, 15, 18, 12]
CUST_ADJ = ["Apex", "Vertex", "Quantum", "Summit", "Pioneer", "Atlas", "Nimbus",
            "Beacon", "Cobalt", "Zenith", "Orbit", "Delta", "Lumen", "Forge"]
CUST_NOUN = ["Systems", "Labs", "Holdings", "Partners", "Group", "Works", "Dynamics",
             "Logistics", "Ventures", "Industries", "Networks", "Solutions"]


def _read_base(name: str) -> tuple[list[str], list[list[str]]]:
    rows = list(csv.reader((DATA_DIR / f"{name}.csv").read_text().splitlines()))
    return rows[0], rows[1:]


def _to_csv_bytes(header: list[str], rows: list[list[str]]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(header)
    w.writerows(rows)
    return buf.getvalue().encode()


def _rand_date(rng: random.Random, start=date(2025, 1, 1), span_days=364) -> str:
    return (start + timedelta(days=rng.randint(0, span_days))).isoformat()


def generate_data(n_customers: int, n_orders: int, n_telesale: int) -> dict[str, bytes]:
    """Extend the committed base to the target volume. Returns {name: csv bytes}
    for the scaled/new datasets (customers, orders, telesale). Preserves the
    edge cases: Africa (region 5) gets no customers, Legacy Tool (product 7) is
    never ordered, Lonely Co (customer 11) has no orders."""
    rng = random.Random(GEN_SEED)
    cust_h, cust_rows = _read_base("customers")
    _, prod_rows = _read_base("products")
    _, region_rows = _read_base("regions")
    ord_h, ord_rows = _read_base("orders")

    # Region pool excludes Africa (5) so the "no customers" edge case holds.
    region_pool = [r[0] for r in region_rows if r[1] != "Africa"]
    # Product price lookup; orderable products exclude Legacy Tool (never ordered).
    price_of = {p[0]: p[3] for p in prod_rows}
    orderable_products = [p[0] for p in prod_rows if p[1] != "Legacy Tool"]

    # --- customers: base + generated up to n_customers ---
    next_cid = max(int(r[0]) for r in cust_rows) + 1
    for i in range(max(0, n_customers - len(cust_rows))):
        cid = next_cid + i
        cust_rows.append([
            str(cid),
            f"{rng.choice(CUST_ADJ)} {rng.choice(CUST_NOUN)}",
            rng.choice(region_pool),
            rng.choice(["gold", "silver", "bronze"]),
            "true" if rng.random() < 0.8 else "false",
            _rand_date(rng),
        ])
    # Orders may reference any customer EXCEPT Lonely Co (11) — keep it order-less.
    order_cust_ids = [r[0] for r in cust_rows if r[0] != "11"]

    # --- orders: base + generated up to n_orders ---
    next_oid = max(int(r[0]) for r in ord_rows) + 1
    for i in range(max(0, n_orders - len(ord_rows))):
        oid = next_oid + i
        pid = rng.choice(orderable_products)
        ord_rows.append([
            str(oid),
            rng.choice(order_cust_ids),
            pid,
            price_of[pid],  # amount = unit price (matches the base convention)
            str(rng.randint(1, 5)),
            rng.choice(ORDER_STATUSES),
            "true" if rng.random() < 0.25 else "false",
            _rand_date(rng),
        ])
    # Per-customer order ids — a converted telesale call links to a real order of that customer.
    cust_orders: dict[str, list[str]] = {}
    for r in ord_rows:
        cust_orders.setdefault(r[1], []).append(r[0])

    # --- telesale: generated (a call targets any customer; converted ⇒ links an order) ---
    all_cust_ids = [r[0] for r in cust_rows]
    tele_h = ["call_id", "customer_id", "agent", "called_at", "duration_sec", "outcome", "order_id"]
    tele_rows: list[list[str]] = []
    for i in range(n_telesale):
        cid = rng.choice(all_cust_ids)
        outcome = rng.choices(TELESALE_OUTCOMES, weights=TELESALE_WEIGHTS)[0]
        # "converted" requires a real order to link; a customer with none can't convert.
        if outcome == "converted" and not cust_orders.get(cid):
            outcome = "connected"
        order_id = rng.choice(cust_orders[cid]) if outcome == "converted" else ""
        tele_rows.append([
            str(i + 1), cid, rng.choice(AGENTS), _rand_date(rng),
            str(rng.randint(30, 1500)), outcome, order_id,
        ])

    return {
        "customers": _to_csv_bytes(cust_h, cust_rows),
        "orders": _to_csv_bytes(ord_h, ord_rows),
        "telesale": _to_csv_bytes(tele_h, tele_rows),
    }


def validate_data(gen: dict[str, bytes]) -> None:
    """Referential-integrity + edge-case check (used by --dry-run, and before upload)."""
    def parse(name):
        rows = list(csv.reader(gen[name].decode().splitlines()))
        return rows[0], rows[1:]

    _, cust = parse("customers")
    _, orders = parse("orders")
    _, tele = parse("telesale")
    cust_ids = {r[0] for r in cust}
    order_owner = {r[0]: r[1] for r in orders}  # order_id → customer_id
    _, prod_rows = _read_base("products")
    legacy_pid = next(p[0] for p in prod_rows if p[1] == "Legacy Tool")

    errs = []
    if any(r[1] not in cust_ids for r in orders):
        errs.append("orders.customer_id references a missing customer")
    if any(r[2] == legacy_pid for r in orders):
        errs.append("orders reference Legacy Tool (should never be ordered)")
    if "11" in {r[1] for r in orders}:
        errs.append("Lonely Co (11) has orders (should be order-less)")
    if any(r[1] not in cust_ids for r in tele):
        errs.append("telesale.customer_id references a missing customer")
    if any(r[6] and r[6] not in order_owner for r in tele):
        errs.append("telesale.order_id references a missing order")
    bad_conv = [r for r in tele if r[5] == "converted" and not r[6]]
    if bad_conv:
        errs.append(f"{len(bad_conv)} converted calls with no linked order")
    # A converted call must link an order belonging to THAT customer.
    if any(r[6] and order_owner.get(r[6]) != r[1] for r in tele):
        errs.append("a converted call links an order owned by a different customer")
    if errs:
        die("generated data failed validation:\n  - " + "\n  - ".join(errs))
    say(f"generated: customers({len(cust)}) · orders({len(orders)}) · telesale({len(tele)}) — integrity OK")


# --- seed --------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed/upsert non-mock testing data into the local backend.")
    ap.add_argument("--reset", action="store_true", help="delete the workspace first, then seed fresh")
    ap.add_argument("--orders", type=int, default=2000, help="total orders (default 2000; 1k–5k band)")
    ap.add_argument("--telesale", type=int, default=2000, help="total telesale calls (default 2000)")
    ap.add_argument("--customers", type=int, default=50, help="total customers (default 50)")
    ap.add_argument("--light", action="store_true",
                    help="fast, small seed (same structure: telesale + all rels + edge cases) — `pnpm dev:seed`")
    ap.add_argument("--dry-run", action="store_true", help="generate + validate the data, print counts, no backend")
    # Tolerate pnpm's argument separator: `pnpm dev:seed --reset` forwards a bare `--`.
    argv = [a for a in sys.argv[1:] if a != "--"]
    args = ap.parse_args(argv)
    # --light: a quick, structurally-complete seed — small counts, overridable by explicit flags.
    #
    # R166 — raised from 12/40/25 to 15/120/80 ("a bit bolder"), chosen at the knee of a
    # measured curve rather than by feel. The trade the human accepted is real but NOT
    # uniform: light detects LESS of anything volume-driven (paging depth, perf, wide
    # result sets) and MORE of anything sparsity-driven. Measured over `orders`:
    #
    #   cust/ord/tele | pages@25 | orders/customer | statuses with an interior MONTH gap
    #   12/  40/  25  |    2     |      1–7        | 4 of 4   ← today: paging too shallow
    #   15/ 120/  80  |    5     |      4–11       | 3 of 4   ← chosen
    #   20/ 200/ 120  |    8     |      4–16       | 2 of 4
    #   25/ 300/ 150  |   12     |      7–23       | 1 of 4
    #   50/2000/2000  |   80     |     25–55       | 0 of 4   ← full: gap case UNREACHABLE
    #
    # That last column is why "bolder" is not monotonically better. `window_column`'s
    # `prior_period` must return NULL for a MISSING period instead of the wrong period's
    # value (R164/R165 acceptance) — and a dense table has no missing periods to prove it
    # on. 15/120/80 buys real paging while KEEPING the gap observable; 20/200 starts
    # spending it. Group sizes stay countable by hand (4–11 orders per customer), which is
    # what makes a within-group column verifiable without a spreadsheet.
    if args.light:
        if "--orders" not in argv:
            args.orders = 120
        if "--telesale" not in argv:
            args.telesale = 80
        if "--customers" not in argv:
            args.customers = 15
    return args


def main() -> None:
    args = parse_args()

    # R99 — generate the volume (deterministic; extends the committed light base).
    gen = generate_data(args.customers, args.orders, args.telesale)
    validate_data(gen)
    if args.dry_run:
        say("--dry-run: generated + validated, no backend write.")
        return

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

    # Small dimensions from the committed CSVs; the scaled facts + telesale from the
    # generated bytes (R99 — content immutable once committed; --reset to re-seed at a new volume).
    ds = {name: upsert_dataset(ws, name) for name in ("regions", "products")}
    ds["customers"] = upsert_dataset_bytes(ws, "customers", gen["customers"])
    ds["orders"] = upsert_dataset_bytes(ws, "orders", gen["orders"])
    ds["telesale"] = upsert_dataset_bytes(ws, "telesale", gen["telesale"])

    rel_cust_ord = upsert_relationship(ws, ds["customers"], "customer_id", ds["orders"], "customer_id", "one_to_many")
    rel_prod_ord = upsert_relationship(ws, ds["products"], "product_id", ds["orders"], "product_id", "one_to_many")
    rel_reg_cust = upsert_relationship(ws, ds["regions"], "region_id", ds["customers"], "region_id", "one_to_many")
    # R99 — telesale: a customer receives many calls; a converted call links one order
    # (order_id is nullable on non-converted calls → the order link is optional).
    upsert_relationship(ws, ds["customers"], "customer_id", ds["telesale"], "customer_id", "one_to_many")
    upsert_relationship(ws, ds["orders"], "order_id", ds["telesale"], "order_id", "one_to_many", optional=True)

    # Column indexes (0-based) for the filter atoms below:
    #   customers: 0 customer_id · 1 customer_name · 2 region_id · 3 tier · 4 is_active · 5 signed_up
    #   orders:    0 order_id · 1 customer_id · 2 product_id · 3 amount · 4 quantity · 5 status · 6 is_priority · 7 ordered_at
    def defn(filters=None, advanced=None, joins=None, relationships=None, steps=None):
        return {
            "q": None,
            "filters": filters or [],
            "advanced": advanced or [],
            # R88 — a query OWNS its join relationships (copy-on-pick); hops reference
            # them by `queryRelId`. Empty for single-source queries.
            "relationships": relationships or [],
            "joins": joins or [],
            # R120+ — ordered transform steps (workflow shaping); empty = a plain
            # select query. By effective column NAME.
            "steps": steps or [],
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

    # R100 — copy-on-pick qrels backing the dashboard's saved queries (see below).
    prod_ord_qrel = qrel(rel_prod_ord, ds["products"], "product_id", ds["orders"], "product_id")
    reg_cust_qrel = qrel(rel_reg_cust, ds["regions"], "region_id", ds["customers"], "region_id")

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
        # R100 — three saved queries the static Sales dashboard binds to. LEFT joins so
        # the seed's edge cases surface as a zero bar/slice (not silently dropped):
        #   Africa (no customers) · Legacy Tool (never ordered).
        ("Revenue by region", "regions",
         defn(relationships=[reg_cust_qrel, cust_ord_qrel],
              joins=[{"queryRelId": reg_cust_qrel["id"], "type": "left"},
                     {"queryRelId": cust_ord_qrel["id"], "type": "left"}]),
         "R100 dashboard — regions ⋈ customers ⋈ orders (revenue-by-region widget)"),
        ("Orders by product", "products",
         defn(relationships=[prod_ord_qrel],
              joins=[{"queryRelId": prod_ord_qrel["id"], "type": "left"}]),
         "R100 dashboard — products ⋈ orders (revenue-by-product widget; Legacy Tool = 0)"),
        ("Telesale calls", "telesale", defn(),
         "R100 dashboard — plain telesale (outcomes-breakdown widget)"),
        # R128 — a WORKFLOW demo: a single-source query that SHAPES its result with
        # a transform step (GROUP BY status → SUM(amount)). Its detail shows the
        # grouped rows directly; a chart widget binds to it pre-shaped (R127).
        ("Revenue by order status", "orders",
         defn(steps=[{"kind": "aggregate", "dimensions": ["status"],
                      "measures": [{"col": "amount", "agg": "sum"}]}]),
         "R128 workflow — a saved aggregate STEP (pre-shaped: revenue by status)"),
        # R166 — the seed never caught up with R163/R165, so the two step families the
        # `query-shaping-surface` program exists to deliver had NO seeded example: every
        # shaped query here COLLAPSED rows (`aggregate`). Both families below keep the
        # row count, which is the whole point of them — and they are what makes a
        # "duplicate a SHAPED query" walk mean anything.
        #
        # The WITHIN-GROUP column (R163): every order row carries its own customer's
        # average, so a row can be read against its group without a second query — the
        # need that `query⋈query` was reached for before R166 withdrew it.
        ("Order vs customer average", "orders",
         defn(steps=[{"kind": "group_column", "name": "customer_avg_amount",
                      "agg": "avg", "col": "amount", "by": ["customer_id"]}]),
         "R163 within-group column — each order carries its customer's average; row count UNCHANGED"),
        # The ORDERED-WINDOW family (R164/R165). Partitioned BY STATUS deliberately: a
        # status's months are sparse at light volume, so `prior_period` has a real gap to
        # read BLANK on — the acceptance criterion that a dense table cannot demonstrate.
        ("Monthly revenue by status", "orders",
         defn(steps=[
             {"kind": "date_bucket", "col": "ordered_at", "granularity": "month", "name": "month"},
             {"kind": "aggregate", "dimensions": ["status", "month"],
              "measures": [{"col": "amount", "agg": "sum"}]},
             {"kind": "window_column", "op": "prior_period", "name": "prev_month",
              "col": "amount", "by": ["status"], "orderBy": [{"col": "month"}], "unit": "month"},
             {"kind": "window_column", "op": "running_total", "name": "cumulative",
              "col": "amount", "by": ["status"], "orderBy": [{"col": "month"}]},
         ]),
         "R164/R165 ordered window — prior_period reads BLANK on a skipped month (not the wrong one) + a running total"),
    ]
    seeded = [(name, upsert_query(ws, name, ds[source], definition), blurb)
              for name, source, definition, blurb in base_queries]
    by_name = {name: qid for name, qid, _ in seeded}

    # R167 — one workflow, consolidating a SHAPED query on purpose.
    #
    # It serves the acceptance walk twice. (1) It is the only way to hand-verify that
    # narrowing `resolve_source` to Workflow's reader left that reader intact — the
    # round's riskiest change, otherwise covered by tests alone. (2) It makes the
    # DEFERRED D1 bug VISIBLE: `build_consolidated_relation` never runs a source
    # query's `steps`, so this workflow materializes the ~120 UN-SHAPED order rows
    # instead of the 4 shaped rows "Revenue by order status" shows on its own detail
    # page. That mismatch is expected until item 4 repairs it (Round_167 § D-gate
    # calls); it is seeded rather than described so the next round argues from a
    # screen instead of from a paragraph.
    wf_id = upsert_workflow(ws, "Consolidated revenue by status", [by_name["Revenue by order status"]])

    print()
    say(f"seed complete — workspace \"{WS_NAME}\" ({ws})")
    print(f"\n  Datasets:      regions(5) · products(7) · customers({args.customers}) · "
          f"orders({args.orders}) · telesale({args.telesale})")
    print("  Relationships: customers→orders · products→orders · regions→customers ·")
    print("                 customers→telesale · orders→telesale (converted calls) (one_to_many)")
    print("  Unmatched rows (for left/right/full joins): region 'Africa' (no customers),")
    print("    customer 'Lonely Co' (no orders, but receives telesale calls), product")
    print("    'Legacy Tool' (never ordered); non-converted telesale calls (no order_id).")
    print(f"\n  Workflow:      Consolidated revenue by status   {FRONTEND_URL}/data-management/workflows/{wf_id}")
    print(f"    {C_DIM}R167 — consolidates a SHAPED query. Its output is the base's UN-SHAPED rows"
          f" (the deferred D1 bug, made visible on purpose).{C_RESET}")
    print("\n  Base queries — each exercises a different query-builder flow:")
    for name, qid, blurb in seeded:
        print(f"    • {name:<22} {FRONTEND_URL}/data-management/queries/{qid}")
        print(f"      {C_DIM}{blurb}{C_RESET}")
    print()


if __name__ == "__main__":
    main()
