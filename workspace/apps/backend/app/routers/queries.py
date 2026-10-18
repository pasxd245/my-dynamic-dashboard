"""Queries router — R69 Saved Query MVP.

Five endpoints (see workspace/packages/contracts/queries/*):

- ``POST   /workspaces/{id}/queries`` — save a query (validate-on-save).
- ``GET    /workspaces/{id}/queries`` — list, most-recent-first.
- ``GET    /queries/{id}``            — one saved query.
- ``GET    /queries/{id}/rows``       — RUN: live re-run, paged.
- ``DELETE /queries/{id}``            — delete (204).

Persistence is raw-SQLite + Pydantic (the established backend standard),
NOT SQLModel — see Round_69 Do (J-3 build-time deviation). The run path
re-validates the saved definition against the dataset's CURRENT columns
and delegates to the shipped ``query_dataset_rows`` engine; a definition
that no longer validates returns ``409 query_stale`` instead of executing.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import DASHBOARD_MAX_ROWS, ID_PATTERNS, PAGE_SIZES
from app import params as qparams
from app.db import get_conn
from app.ingest.filters import build_definition_predicates
from app import duck
from app.ingest.export import EXPORT_MAX_ROWS, attachment_disposition, build_csv, build_xlsx, file_stem
from app.ingest.rows_reader import _name_in_sql, build_steps_relation, query_aggregate_rows, query_dataset_rows
from app.models.common import (
    AggregateBody,
    ApiErrorExportTooLarge,
    ExportBody,
    TotalsBody,
    ApiErrorNameTaken,
    ApiErrorNotFound,
    ApiErrorQueryStale,
    ApiErrorStepInvalid,
    ApiErrorRelationshipStale,
    CreateQueryBody,
    PreviewQueryBody,
    Query as QueryModel,
    QueryDefinition,
    UpdateQueryBody,
)
from app.query_engine import (
    _SELECT_QUERY,
    _aggregate_output_columns,
    _build_inner_relation,
    _chain_of,
    _execute_chain,
    _rels_of,
    _resolve_plan,
    _resolved_columns,
    _run_steps,
    _step_plan,
    _to_resolved,
    _validate_aggregate,
)
from app.saved_copies import read_only_refusal
from app.metadata import sweep as metadata_sweep
from app.routers._shared import RowsPage, _is_unique_violation, _now_iso
from app.storage import dataset_dir


router = APIRouter(tags=["queries"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
QueryIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["query"])]

_PAGE_SIZE_ALLOWED = PAGE_SIZES  # R72 — centralized (values.yaml → constants)

# `_SELECT_QUERY` + the resolution/step engine now live in `app.query_engine`
# (R133 extraction — shared with the workflows router).


def _new_qr_id() -> str:
    return f"qr_{secrets.token_hex(4)}"


def _bound(definition: dict, viewer: dict | None, dashboard: dict | None, columns: list[dict]) -> tuple[dict, dict]:
    """R194 — resolve the used parameters (viewer → dashboard → default) and bind a
    copy of the definition; raises ``qparams.ParamError`` (→ 422)."""
    values, resolved = qparams.resolve(definition, viewer=viewer, dashboard=dashboard)
    return qparams.bind(definition, values, columns, resolved), resolved


def _data_versions(plan: dict | None) -> dict[str, int]:
    """R196 (3.2c) — the `dataVersion` of every dataset this plan reads (a join:
    every dataset of it), read now (R197: the shared `app.data_versions`)."""
    from app import data_versions

    with get_conn() as con:
        return data_versions.versions(con, data_versions.plan_dataset_ids(plan))


def _stamped(content: dict, resolved: dict, versions: dict[str, int]) -> dict:
    """R196 — which data (`dataVersions`) and, R194, under which values
    (`resolvedParams`) the read was made."""
    if versions:
        content["dataVersions"] = versions
    return _with_resolved(content, resolved)


def _with_resolved(content: dict, resolved: dict) -> dict:
    """R194 — `resolvedParams` only when something was resolved (a query without
    parameters answers exactly as before)."""
    if resolved:
        content["resolvedParams"] = resolved
    return content


def _check_definition(definition: dict, columns: list[dict]) -> None:
    """Save / preview checks: the parameter rules (D1), then every atom and step
    against the columns, with placeholders bound for the references (→ 422)."""
    qparams.check(definition, columns)
    bound = qparams.bind_placeholders(definition)
    build_definition_predicates(bound, columns)
    _step_plan(bound.get("steps") or [], columns)


def _query_from_row(con: sqlite3.Connection, row: sqlite3.Row) -> QueryModel:
    definition = json.loads(row["definition_json"])
    source_id = row["source_id"]
    return QueryModel(
        id=row["id"],
        workspaceId=row["workspace_id"],
        sourceId=source_id,
        name=row["name"],
        definition=QueryDefinition(**definition),
        # R194 — column shapes do not depend on parameter values: placeholders.
        resolvedColumns=_resolved_columns(con, qparams.bind_placeholders(definition), source_id, row["workspace_id"]),
        createdAt=row["created_at"],
    )


@router.post("/workspaces/{id}/queries", status_code=status.HTTP_201_CREATED)
def create_query(id: WsIdPath, body: CreateQueryBody) -> JSONResponse:  # noqa: A002
    """Save a query. The source dataset must exist AND belong to this
    workspace; the definition is validated against its current columns
    (a definition that can't run is rejected 422). Names are unique
    per workspace."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(workspaces=[id])) is not None:
        return ro
    definition_dict = body.definition.model_dump()
    chain = _chain_of(definition_dict)
    # R79 — the driving source is the single, canonical `sourceId`; R167 narrowed it
    # to a `ds_` dataset.
    source_id = body.sourceId
    # R71/R73 — a joined query's atoms index the EFFECTIVE space; the driving source
    # + every hop must resolve at save time (resolve_source checks the dataset exists
    # + is in-workspace). A bare single-dataset query validates against its one
    # dataset's columns.
    with get_conn() as con:
        plan, reason = _resolve_plan(con, source_id, chain, _rels_of(definition_dict), id)
    if reason == "source_missing":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "loc": ["body", "sourceId"],
                    "msg": f"unknown_source: {source_id} is not a dataset in workspace {id}",
                    "type": "value_error",
                }
            ],
        )
    if reason is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
        )

    # Validate every atom against the relevant column space → 422 on a bad atom
    # (you cannot persist a query that can't run). R120 — steps too; R194 — the
    # parameter rules first, then atoms/steps with placeholders bound.
    _check_definition(definition_dict, plan["columns"])

    qid = _new_qr_id()
    created_at = _now_iso()
    definition_json = json.dumps(body.definition.model_dump())
    try:
        with get_conn() as con:
            con.execute(
                "INSERT INTO queries "
                "(id, workspace_id, source_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (qid, id, source_id, body.name, definition_json, created_at),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        if "idx_queries_name_unique" in str(err) or _is_unique_violation(err, "queries.name"):
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
        raise

    created = QueryModel(
        id=qid,
        workspaceId=id,
        sourceId=source_id,
        name=body.name,
        definition=body.definition,
        createdAt=created_at,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=created.model_dump(exclude_none=True))


@router.get("/workspaces/{id}/queries")
def list_queries(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's saved queries, most-recent first."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM queries WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
        items = [_query_from_row(con, r).model_dump(exclude_none=True) for r in rows]
    return JSONResponse(status_code=status.HTTP_200_OK, content=items)


@router.get("/queries/{id}")
def get_query(id: QueryIdPath) -> JSONResponse:  # noqa: A002
    """Return one saved query (definition + metadata; resolvedColumns when joined)."""
    with get_conn() as con:
        row = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        content = _query_from_row(con, row).model_dump(exclude_none=True)
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.get("/queries/{id}/rows")
def run_query(  # noqa: A002
    id: QueryIdPath,
    request: Request,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 50,
    unpaged: Annotated[bool, Query()] = False,
    dashboard: Annotated[str | None, Query(pattern=ID_PATTERNS["dashboard"])] = None,
    widget: Annotated[str | None, Query(pattern=ID_PATTERNS["widget"])] = None,
) -> JSONResponse:
    """RUN the saved query: re-execute its definition against CURRENT data,
    paged. For a JOINED query (R71) the two related datasets are read as one;
    409 relationship_stale if the join key drifted (the join is blocked), 409
    query_stale if a predicate atom drifted.

    R107 — ``unpaged=true`` is the dashboard widget's single-request load path:
    paging is bypassed and rows are returned in ONE response, capped
    server-side at ``DASHBOARD_MAX_ROWS`` (the name is the mechanism, not a
    completeness promise — an oversized result is still capped). ``total`` still
    carries the full matched count, so a capped/partial result is detectable via
    ``total > len(rows)``.

    R194 — ``p.<name>=`` query parameters are the viewer's parameter values;
    ``dashboard`` + ``widget`` name the dashboard widget whose saved control values
    apply (D3)."""
    if (dashboard is None) != (widget is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["query", "dashboard"], "msg": "dashboard and widget go together", "type": "value_error"}],
        )
    viewer = {k[2:]: v for k, v in request.query_params.items() if k.startswith("p.") and len(k) > 2}
    dash_ref = {"id": dashboard, "widgetId": widget} if dashboard else None
    if unpaged:
        # Unpaged: read the first page sized to the cap. `total` (computed
        # separately) stays the full matched count, preserving the over-cap warning.
        eff_page, eff_page_size = 1, DASHBOARD_MAX_ROWS
    else:
        if page_size not in _PAGE_SIZE_ALLOWED:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"page_size must be one of {_PAGE_SIZE_ALLOWED}; got {page_size}",
            )
        eff_page, eff_page_size = page, page_size

    # Gather the run plan under the sqlite connection; execute the (duckdb) read
    # after it closes — the existing single-source discipline, extended for join.
    # R71/R73 — a joined run resolves the driving source + every hop with valid
    # keys; a drift BLOCKS the run (409 relationship_stale) — never silently wrong.
    with get_conn() as con:
        qrow = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        definition = json.loads(qrow["definition_json"])
        chain = _chain_of(definition)
        plan, reason = _resolve_plan(con, qrow["source_id"], chain, _rels_of(definition), qrow["workspace_id"])
        dash_values = qparams.dashboard_values(con, dash_ref, qrow, ["query", "dashboard"])

    if reason == "source_missing":
        # Defensive: the app-level cascade (R79) removes queries when their source
        # dataset is deleted, so this is a belt-and-braces 404.
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    if reason is not None:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorRelationshipStale().model_dump())
    try:
        definition, resolved_params = _bound(definition, viewer, dash_values, plan["columns"])
    except qparams.ParamError as err:
        return err.response()
    # R165 W-8 — a drifted PREDICATE and an unrunnable STEP are two different
    # failures and now carry two codes: merged, the surface named the wrong one.
    try:
        filters, advanced = build_definition_predicates(definition, plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorQueryStale().model_dump())
        raise
    try:
        step_plan = _step_plan(definition.get("steps") or [], plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorStepInvalid().model_dump())
        raise

    q = definition.get("q")
    # R120 — a query with a transform step returns its SHAPED rows: the steps run
    # over the resolved+filtered relation server-side. R144 (Review finding #2) —
    # the shaped relation pages like every other path: the R120 "small by
    # construction" assumption held only while `aggregate` was the sole step
    # kind; row-preserving steps (derive/filter/sort/date_bucket) keep the source
    # cardinality. `unpaged` (the widget path) stays one capped response.
    if step_plan is not None:
        rows, total = _run_steps(plan, q, filters, advanced, step_plan, page=eff_page, page_size=eff_page_size)
        echoed_page_size = len(rows) if unpaged else eff_page_size
        body = RowsPage(rows=rows, page=eff_page, pageSize=echoed_page_size, total=total)
        return JSONResponse(
            status_code=status.HTTP_200_OK, content=_stamped(body.model_dump(), resolved_params, _data_versions(plan))
        )

    if plan["kind"] == "join":
        rows, total = _execute_chain(
            plan["payload"], page=eff_page, page_size=eff_page_size, q=q, filters=filters, advanced=advanced
        )
    else:
        ds = plan["ds"]
        parquet_path = dataset_dir(ds["workspace_id"], ds["id"]) / "parsed.parquet"
        rows, total = query_dataset_rows(
            parquet_path,
            [c["name"] for c in plan["columns"]],
            page=eff_page,
            page_size=eff_page_size,
            q=q,
            filters=filters,
            advanced=advanced,
        )

    # Unpaged response echoes the returned row count as pageSize (it's not a
    # "page" in the pager sense); paged response echoes the requested size.
    echoed_page_size = len(rows) if unpaged else eff_page_size
    body = RowsPage(rows=rows, page=eff_page, pageSize=echoed_page_size, total=total)
    return JSONResponse(
        status_code=status.HTTP_200_OK, content=_stamped(body.model_dump(), resolved_params, _data_versions(plan))
    )


@router.post("/queries/{id}/aggregate")
def aggregate_query(id: QueryIdPath, body: AggregateBody) -> JSONResponse:  # noqa: A002
    """R119 — SERVER-SIDE AGGREGATE: a stateless ``GROUP BY (dimensions) →
    measures`` over the saved query's resolved rows, computed in DuckDB over the
    WHOLE result (no row cap — the result is one row per group). The dashboard
    consumer (bar/pie/line/scalar KPI) binds to this instead of rolling capped
    raw rows up client-side, so totals are correct regardless of the fetch cap.

    Resolves the saved query's plan with the SAME engine as the run path
    (driving source + joins + its OWN definition filters), so drift semantics
    are inherited verbatim: 404 absent · 409 relationship_stale / query_stale. The aggregate spec is re-validated against
    the EFFECTIVE columns (422). ``filters`` are the runtime dashboard filters
    (R103), pushed server-side as a name-based one-of so an aggregated widget
    honours an active filter; a filter on a column this query lacks is skipped
    (mirrors the client ``applyFilters``)."""
    with get_conn() as con:
        qrow = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        definition = json.loads(qrow["definition_json"])
        chain = _chain_of(definition)
        plan, reason = _resolve_plan(con, qrow["source_id"], chain, _rels_of(definition), qrow["workspace_id"])
        dash_values = qparams.dashboard_values(
            con, body.dashboard.model_dump() if body.dashboard else None, qrow, ["body", "dashboard"]
        )

    if reason == "source_missing":
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    if reason is not None:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorRelationshipStale().model_dump())
    try:
        definition, resolved_params = _bound(definition, body.params, dash_values, plan["columns"])
    except qparams.ParamError as err:
        return err.response()

    # Validate the aggregate spec against the effective columns (422) BEFORE the
    # predicate re-check, so a malformed request 422s regardless of query state.
    measures = _validate_aggregate(body.dimensions, [m.model_dump() for m in body.measures], plan["columns"], ["body"])

    try:
        filters, advanced = build_definition_predicates(definition, plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorQueryStale().model_dump())
        raise

    # A dashboard filter on a column this query lacks is skipped (R103 semantics).
    col_names = {c["name"] for c in plan["columns"]}
    dashboard_filters = [(f.column, f.values) for f in body.filters if f.column in col_names]

    inner_sql, inner_params = _build_inner_relation(plan, definition.get("q"), filters, advanced)
    rows = query_aggregate_rows(
        inner_sql,
        inner_params,
        dimensions=body.dimensions,
        measures=measures,
        dashboard_filters=dashboard_filters,
    )
    out_columns = _aggregate_output_columns(body.dimensions, measures, plan["columns"])
    content = {"columns": out_columns, "rows": rows, "total": len(rows)}
    return JSONResponse(
        status_code=status.HTTP_200_OK, content=_stamped(content, resolved_params, _data_versions(plan))
    )


def _final_relation(
    id: str,  # noqa: A002
    viewer: dict | None = None,
    dashboard: dict | None = None,
) -> tuple[dict | None, JSONResponse | None]:
    """R181/R182 — the saved query's FINAL relation: its resolved plan + own
    predicates, then its transform steps when it has any (the rows a table
    widget shows). Returns ``({sql, params, columns, name}, None)`` or
    ``(None, error)`` with the run path's drift semantics: 404 absent · 409
    `relationship_stale` / `query_stale`."""
    with get_conn() as con:
        qrow = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if qrow is None:
            return None, JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        definition = json.loads(qrow["definition_json"])
        chain = _chain_of(definition)
        plan, reason = _resolve_plan(con, qrow["source_id"], chain, _rels_of(definition), qrow["workspace_id"])
        name = qrow["name"]
        dash_values = qparams.dashboard_values(con, dashboard, qrow, ["body", "dashboard"])

    if reason == "source_missing":
        return None, JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    if reason is not None:
        return None, JSONResponse(
            status_code=status.HTTP_409_CONFLICT, content=ApiErrorRelationshipStale().model_dump()
        )
    try:
        definition, resolved_params = _bound(definition, viewer, dash_values, plan["columns"])
    except qparams.ParamError as err:
        return None, err.response()

    try:
        filters, advanced = build_definition_predicates(definition, plan["columns"])
        step_plan = _step_plan(definition.get("steps") or [], plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return None, JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorQueryStale().model_dump())
        raise

    inner_sql, inner_params = _build_inner_relation(plan, definition.get("q"), filters, advanced)
    if step_plan is not None:
        normalized, final_cols = step_plan
        relation_sql, relation_params, _names = build_steps_relation(
            inner_sql, inner_params, [c["name"] for c in plan["columns"]], normalized
        )
    else:
        final_cols = plan["columns"]
        relation_sql, relation_params = inner_sql, inner_params
    return {
        "sql": relation_sql,
        "params": relation_params,
        "columns": final_cols,
        "name": name,
        "resolvedParams": resolved_params,
        "dataVersions": _data_versions(plan),
    }, None


def _version_rows(versions: dict[str, int]) -> list[tuple[str, str, int]]:
    """`(dataset name, id, version)` rows for the export's Data versions block."""
    if not versions:
        return []
    marks = ",".join("?" * len(versions))
    with get_conn() as con:
        names = {
            r["id"]: r["name"]
            for r in con.execute(
                f"SELECT id, name FROM datasets WHERE id IN ({marks})",  # noqa: S608 — placeholders only
                list(versions),
            )
        }
    return [(names.get(i, i), i, v) for i, v in versions.items()]


def _totals_over(relation: dict, columns: list[str], filters: list) -> tuple[dict[str, str | None], int]:
    """Σ of `columns` + the row count over `relation` under the dashboard
    `filters` (a filter on a column the result lacks is skipped). 422 on an
    unknown / non-numeric column."""
    measures = _validate_aggregate([], [{"col": c, "agg": "sum"} for c in columns], relation["columns"], ["body"])
    col_names = {c["name"] for c in relation["columns"]}
    dashboard_filters = [(f.column, f.values) for f in filters if f.column in col_names]
    rows = query_aggregate_rows(
        relation["sql"],
        relation["params"],
        dimensions=[],
        measures=[*measures, (None, "count")],
        dashboard_filters=dashboard_filters,
    )
    cells = rows[0] if rows else [None] * (len(columns) + 1)
    sums = {c: cells[i] for i, c in enumerate(columns)}
    return sums, int(cells[len(columns)] or 0)


@router.post("/queries/{id}/totals")
def totals_query(id: QueryIdPath, body: TotalsBody) -> JSONResponse:  # noqa: A002
    """R181 — the SUM of each requested numeric column over the saved query's
    WHOLE result — the post-step relation when the query has transform steps,
    which the `/aggregate` route cannot see — under the runtime dashboard
    `filters` (name-based one-of, a filter on a column the result lacks is
    skipped). One DuckDB query; no row cap, so a table widget's footer is right
    even when its rows are capped. Non-numeric or unknown columns → 422.
    Drift semantics follow the run path: 404 absent · 409 stale."""
    relation, err = _final_relation(id, body.params, body.dashboard.model_dump() if body.dashboard else None)
    if err is not None:
        return err
    assert relation is not None  # noqa: S101 — the pair is exclusive
    sums, row_count = _totals_over(relation, body.columns, body.filters)
    content = _stamped({"sums": sums, "rowCount": row_count}, relation["resolvedParams"], relation["dataVersions"])
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.post("/queries/{id}/export")
def export_query(id: QueryIdPath, body: ExportBody) -> Response:  # noqa: A002
    """R182 — the table widget's numbers as a file: EVERY row of the final
    (post-step, dashboard-filtered) relation, typed cells, the R181 totals row
    when the widget has one, and (XLSX) a Filters sheet. Over
    `EXPORT_MAX_ROWS` → 422 `export_too_large`, nothing written. Drift
    semantics follow the run path: 404 absent · 409 stale.

    R194 (D7) — parameters resolved for the read go into the XLSX Filters sheet's
    `Parameters` block and, on both formats, the `X-MDD-Params` header (ASCII
    JSON)."""
    relation, err = _final_relation(id, body.params, body.dashboard.model_dump() if body.dashboard else None)
    if err is not None:
        return err
    assert relation is not None  # noqa: S101 — the pair is exclusive
    resolved_params: dict = relation["resolvedParams"]
    param_headers = (
        {"X-MDD-Params": json.dumps(resolved_params, ensure_ascii=True, separators=(",", ":"))}
        if resolved_params
        else {}
    )
    # R196 (3.2c) — which data the file holds.
    versions: dict[str, int] = relation["dataVersions"]
    if versions:
        param_headers["X-MDD-Data-Versions"] = json.dumps(versions, separators=(",", ":"))
    columns: list[dict] = relation["columns"]
    col_names = {c["name"] for c in columns}
    dashboard_filters = [(f.column, f.values) for f in body.filters if f.column in col_names]
    where_sql, where_params = _name_in_sql(dashboard_filters)
    sql = f"SELECT * FROM ({relation['sql']}) AS _final {where_sql}"  # noqa: S608 — composed from validated parts
    params = [*relation["params"], *where_params]
    with duck.connect() as con:
        total = int(con.execute(f"SELECT COUNT(*) FROM ({sql}) AS _c", params).fetchone()[0])  # noqa: S608
        if total > EXPORT_MAX_ROWS:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=ApiErrorExportTooLarge(rows=total, max=EXPORT_MAX_ROWS).model_dump(),
            )
        rows = [list(r) for r in con.execute(sql, params).fetchall()]

    totals_row: list[object] | None = None
    if body.totals:
        # The same sums the footer shows (R181), then the ratios derived from them.
        need = sorted(
            {c for spec in body.totals.values() for c in ([spec.num, spec.den] if spec.agg == "ratio" else [])}
            | {c for c, spec in body.totals.items() if spec.agg == "sum"}
        )
        sums, _count = _totals_over(relation, need, body.filters)

        def num(v: str | None) -> float | None:
            try:
                return None if v is None else float(v)
            except ValueError:
                return None

        totals_row = [None] * len(columns)
        for ci, c in enumerate(columns):
            spec = body.totals.get(c["name"])
            if spec is None:
                continue
            if spec.agg == "sum":
                v = num(sums.get(c["name"]))
                totals_row[ci] = int(v) if v is not None and c.get("dtype") == "integer" and v.is_integer() else v
            else:
                n, d = num(sums.get(spec.num or "")), num(sums.get(spec.den or ""))
                totals_row[ci] = None if n is None or d in (None, 0) else n / d  # type: ignore[operator]

    totalled = frozenset(body.totals or {})
    title = body.title or relation["name"]
    # R175's table rule, server-side: under `percent`, a float column whose
    # values all lie in [-1, 1] is a ratio, as is every `ratio` total's column.
    percent_columns: set[str] = set()
    if body.percent:
        for ci, c in enumerate(columns):
            if c.get("dtype") != "float":
                continue
            vals = [r[ci] for r in rows if r[ci] is not None]
            if vals and all(isinstance(v, (int, float)) and -1 <= v <= 1 for v in vals):
                percent_columns.add(c["name"])
        for name, spec in (body.totals or {}).items():
            if spec.agg == "ratio" and name in col_names:
                percent_columns.add(name)
    stem = file_stem(title)

    def disposition(ext: str) -> str:
        return attachment_disposition(stem, ext)

    if body.format == "csv":
        data = build_csv(columns, rows, totals_row, "Total", totalled=totalled)
        return Response(
            content=data,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": disposition("csv"), **param_headers},
        )
    data = build_xlsx(
        columns,
        rows,
        totals_row,
        "Total",
        percent_columns=percent_columns,
        sheet_title=title,
        filters=dashboard_filters,
        meta=[("query", relation["name"]), ("widget", title), ("exported_at", _now_iso()), ("rows", str(total))],
        filters_sheet_title="Filters",
        totalled=totalled,
        params=[(n, r["value"], r["source"]) for n, r in sorted(resolved_params.items())],
        data_versions=_version_rows(versions),
    )
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": disposition("xlsx"), **param_headers},
    )


@router.post("/workspaces/{id}/queries/preview")
def preview_query(  # noqa: A002
    id: WsIdPath,
    body: PreviewQueryBody,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 50,
) -> JSONResponse:
    """R72 — PREVIEW an UNSAVED working-copy definition (the construction
    surface's live preview), paged. Runs the SAME engines as the saved run
    against current data, but persists NOTHING. Mirrors the saved run's drift
    semantics: a drifted join key → 409 relationship_stale; a drifted predicate
    atom → 409 query_stale. A structurally-bad request (unknown / cross-workspace
    dataset or edge, bad page_size) → 422. Joined → the result carries the
    server-computed resolvedColumns (the builder's headers)."""
    if page_size not in _PAGE_SIZE_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"page_size must be one of {_PAGE_SIZE_ALLOWED}; got {page_size}",
        )

    definition = body.definition.model_dump()
    chain = _chain_of(definition)
    source_id = body.sourceId  # R79 — the canonical driving source (ds_ or qr_)
    with get_conn() as con:
        plan, reason = _resolve_plan(con, source_id, chain, _rels_of(definition), id)

    if reason == "relationship_stale":
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorRelationshipStale().model_dump())
    if reason == "source_missing":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "loc": ["body", "sourceId"],
                    "msg": f"unknown_source: {source_id} is not a dataset in workspace {id}",
                    "type": "value_error",
                }
            ],
        )
    if reason is not None:
        # unknown / cross-workspace / dataset-missing edge, or a disconnected /
        # cyclic join → structurally unpreviewable (it could never be saved either).
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
        )
    # R194 — the parameter rules a save would apply (422), then the preview's own
    # values (viewer only) resolved and bound.
    qparams.check(definition, plan["columns"])
    try:
        definition, resolved_params = _bound(definition, body.params, None, plan["columns"])
    except qparams.ParamError as err:
        return err.response()
    # R165 W-8 — a drifted PREDICATE and an unrunnable STEP are two different
    # failures and now carry two codes: merged, the surface named the wrong one.
    try:
        filters, advanced = build_definition_predicates(definition, plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorQueryStale().model_dump())
        raise
    try:
        step_plan = _step_plan(definition.get("steps") or [], plan["columns"])
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorStepInvalid().model_dump())
        raise

    q = definition.get("q")
    # R120 — a stepped preview returns the SHAPED rows + the post-step columns as
    # `resolvedColumns` (the builder's headers for the transformed result).
    # R144 (Review finding #2) — paged like the saved run: row-preserving steps
    # keep the source cardinality, so "return everything" no longer holds.
    if step_plan is not None:
        rows, total = _run_steps(plan, q, filters, advanced, step_plan, page=page, page_size=page_size)
        resolved = [{"name": c["name"], "dtype": c["dtype"]} for c in step_plan[1]]
        # R129 — the PRE-step effective columns, so the builder's join/filter editors
        # author against the base while the steps editor + table use the result.
        base = [{"name": c["name"], "dtype": c["dtype"]} for c in plan["columns"]]
        content = {
            "rows": rows,
            "page": page,
            "pageSize": page_size,
            "total": total,
            "resolvedColumns": resolved,
            "baseColumns": base,
        }
        return JSONResponse(
            status_code=status.HTTP_200_OK, content=_stamped(content, resolved_params, _data_versions(plan))
        )

    if plan["kind"] == "join":
        rows, total = _execute_chain(
            plan["payload"], page=page, page_size=page_size, q=q, filters=filters, advanced=advanced
        )
        resolved = [_to_resolved(c).model_dump(exclude_none=True) for c in plan["payload"]["effective"]]
        content = {"rows": rows, "page": page, "pageSize": page_size, "total": total, "resolvedColumns": resolved}
    else:
        ds = plan["ds"]
        parquet_path = dataset_dir(ds["workspace_id"], ds["id"]) / "parsed.parquet"
        rows, total = query_dataset_rows(
            parquet_path,
            [c["name"] for c in plan["columns"]],
            page=page,
            page_size=page_size,
            q=q,
            filters=filters,
            advanced=advanced,
        )
        content = {"rows": rows, "page": page, "pageSize": page_size, "total": total}

    return JSONResponse(
        status_code=status.HTTP_200_OK, content=_stamped(content, resolved_params, _data_versions(plan))
    )


@router.put("/queries/{id}")
def update_query(id: QueryIdPath, body: UpdateQueryBody) -> JSONResponse:  # noqa: A002
    """R72 — UPDATE a saved query's DEFINITION (the construction surface's Save).
    The first mutate-existing path. Validate-on-save mirrors create: the new
    definition is checked against current columns / the edge (a join edge must
    still exist, be in-workspace, and have valid keys), and a definition that
    can't run is rejected 422. The Query's name + source are unchanged this
    round. Returns the updated Query (resolvedColumns recomputed when joined)."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(queries=[id])) is not None:
        return ro
    definition = body.definition.model_dump()
    chain = _chain_of(definition)
    with get_conn() as con:
        qrow = con.execute(_SELECT_QUERY, (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        # The driving source is unchanged by a definition-only PUT (R72); R76/R79 — a
        # composed query keeps its `qr_` base, a dataset-rooted one its `ds_`.
        plan, reason = _resolve_plan(con, qrow["source_id"], chain, _rels_of(definition), qrow["workspace_id"])

    if reason == "source_missing":
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    if reason is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["body", "definition", "joins"], "msg": reason, "type": "value_error"}],
        )

    # Validate every atom against the relevant column space → 422 on a bad atom
    # (you cannot save a definition that can't run) — the create-time semantics.
    _check_definition(definition, plan["columns"])  # R120 steps + R194 params too

    definition_json = json.dumps(body.definition.model_dump())
    with get_conn() as con:
        con.execute("UPDATE queries SET definition_json = ? WHERE id = ?", (definition_json, id))
        con.commit()
        updated = _query_from_row(con, con.execute(_SELECT_QUERY, (id,)).fetchone())
    return JSONResponse(status_code=status.HTTP_200_OK, content=updated.model_dump(exclude_none=True))


@router.delete("/queries/{id}")
def delete_query(id: QueryIdPath) -> Response:  # noqa: A002
    """Delete a saved query. 404 if already absent."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(queries=[id])) is not None:
        return ro
    with get_conn() as con:
        row = con.execute("SELECT id FROM queries WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM queries WHERE id = ?", (id,))
        # R197 (3.8) — its metadata entries go with it (archived in metadata_entries_swept).
        metadata_sweep(con, _now_iso())
        con.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
