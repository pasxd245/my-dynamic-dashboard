"""R194 (item 3.7a) — typed query parameters: the engine.

Design: `.agents/design/dashboards/dashboard-filters.md` D1–D3, D6, D7.

A query declares ``definition.params`` (``[{name, type, label?, default?}]``) and
writes ``{"param": "<name>"}`` where a literal operand would be — only in filter
atoms (``filters`` / ``advanced``), filter-step predicates and ``case`` WHEN
predicates (D2; the Pydantic model admits a reference nowhere else). Values are
never written into a definition: a read **resolves** a value per used parameter
(viewer → dashboard → default → ``param_unbound``) and **binds** a copy of the
definition, which then runs through the unchanged engine. So two reads with
different values share one ``definitionVersion`` (the hash is of the stored
definition), and a query without parameters runs exactly as before.

Only parameters the definition **uses** are resolved, required and echoed (BA
contract-exit F2). A ``date`` parameter on a ``datetime`` column compares by
calendar day: lower bounds start at 00:00, upper bounds end at 23:59:59.999999
(F3); ``equals`` / ``ne`` / ``in`` / ``not_in`` there are refused at save.
"""

from __future__ import annotations

import copy
import math
import re
import sqlite3
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

from app._config import CONFIG
from app._generated.constants import ERROR_CODES

REF_KEY = "param"
_OPERAND_KEYS = ("val", "min", "max")
# Ops whose operand field each key feeds (a reference elsewhere is refused at save).
_SINGLE = frozenset(
    {"contains", "equals", "ne", "gt", "lt", "gte", "lte", "starts_with", "ends_with", "before", "after"}
)
_RANGE = frozenset({"between"})
_LIST = frozenset({"in", "not_in"})
# Column dtype → the parameter type that fits it (D1).
_FIT = {"date": "date", "datetime": "date", "integer": "number", "float": "number", "string": "string"}
# On a datetime column a date parameter is a calendar day: these places take the
# day's END, every other bound its start (BA contract-exit F3).
_END_OF_DAY = {("lte", "val"), ("after", "val"), ("between", "max")}
_DAY_ONLY_REFUSED = frozenset({"equals", "ne", "in", "not_in"})
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_PLACEHOLDER = {"date": "2000-01-01", "number": 0, "string": "x"}

# The clock "today" is read from — replaced in tests.
_clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)  # noqa: E731


def is_ref(v: object) -> bool:
    return isinstance(v, dict) and set(v) == {REF_KEY} and isinstance(v[REF_KEY], str)


def declared(definition: dict) -> dict[str, dict]:
    return {p["name"]: p for p in (definition.get("params") or [])}


# --- walking the operand sites ----------------------------------------------


@dataclass
class Site:
    """One predicate holding operands: a source atom or a step predicate."""

    pred: dict
    loc: tuple  # the predicate's loc under `definition`
    step: int | None  # None for a source atom (filters / advanced)


def _sites(definition: dict) -> Iterator[Site]:
    for i, atom in enumerate(definition.get("filters") or []):
        yield Site(atom, ("filters", i), None)
    for g, group in enumerate(definition.get("advanced") or []):
        for i, atom in enumerate(group):
            yield Site(atom, ("advanced", g, i), None)
    for k, step in enumerate(definition.get("steps") or []):
        if step.get("kind") == "filter":
            for m, pred in enumerate(step.get("predicates") or []):
                yield Site(pred, ("steps", k, "predicates", m), k)
        elif step.get("kind") == "case":
            for b, br in enumerate(step.get("branches") or []):
                for m, pred in enumerate(br.get("when") or []):
                    yield Site(pred, ("steps", k, "branches", b, "when", m), k)


def _refs(site: Site) -> Iterator[tuple[tuple, str]]:
    """``(loc-suffix, name)`` for every reference in one predicate."""
    for key in _OPERAND_KEYS:
        if is_ref(site.pred.get(key)):
            yield (key,), site.pred[key][REF_KEY]
    for j, v in enumerate(site.pred.get("vals") or []):
        if is_ref(v):
            yield ("vals", j), v[REF_KEY]


def used(definition: dict) -> set[str]:
    return {name for s in _sites(definition) for _, name in _refs(s)}


def has_refs(steps: list[dict]) -> list[tuple]:
    """Locs (under `steps`) of every reference in a list of steps — a workflow's
    steps may hold none (D6)."""
    return [s.loc[1:] + suffix for s in _sites({"steps": steps}) for suffix, _ in _refs(s)]


# --- errors -----------------------------------------------------------------


class ParamError(Exception):
    """A read refused: ``param_unbound`` / ``param_invalid`` (422)."""

    def __init__(self, code: str, param: str, **extra: Any) -> None:
        super().__init__(f"{code}: {param}")
        self.body: dict[str, Any] = {"code": ERROR_CODES[code], "param": param}
        self.body.update({k: v for k, v in extra.items() if v is not None})

    def response(self) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=self.body)


def _save_422(loc: tuple, msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=[{"loc": ["body", "definition", *loc], "msg": msg, "type": "value_error"}],
    )


# --- values -----------------------------------------------------------------


def today() -> date:
    return _clock().astimezone(ZoneInfo(CONFIG.settings.backend.time_zone)).date()


def _is_relative(v: object) -> bool:
    return isinstance(v, dict) and v.get("kind") == "today"


def coerce(ptype: str, raw: object, *, allow_relative: bool) -> str | int | float:
    """A value of ``ptype`` from ``raw``, or ``ValueError``. A date is a plain
    ``YYYY-MM-DD``; a relative one ("today ± n days") is resolved now."""
    if ptype == "date":
        if allow_relative and _is_relative(raw):
            off = raw.get("offsetDays")  # type: ignore[union-attr]
            if not isinstance(off, int) or isinstance(off, bool) or not -366 <= off <= 366:
                raise ValueError("offsetDays")
            return (today() + timedelta(days=off)).isoformat()
        if not isinstance(raw, str) or not _ISO_DATE.match(raw):
            raise ValueError("date")
        return date.fromisoformat(raw).isoformat()
    if ptype == "number":
        if isinstance(raw, bool):
            raise ValueError("number")
        if isinstance(raw, int | float):
            n = raw
        elif isinstance(raw, str):
            n = int(raw) if raw.strip().lstrip("+-").isdigit() else float(raw)
        else:
            raise ValueError("number")
        if isinstance(n, float) and not math.isfinite(n):
            raise ValueError("number")
        return n
    if not isinstance(raw, str):
        raise ValueError("string")
    return raw


def resolve(
    definition: dict, *, viewer: dict | None = None, dashboard: dict | None = None
) -> tuple[dict[str, Any], dict[str, dict]]:
    """For each USED parameter: viewer value → dashboard saved value → default →
    ``param_unbound`` (D3). Returns ``(values, resolvedParams)``; raises
    ``ParamError``. Undeclared or unused names in ``viewer`` / ``dashboard`` are
    ignored."""
    decls = declared(definition)
    viewer = viewer or {}
    dashboard = dashboard or {}
    values: dict[str, Any] = {}
    resolved: dict[str, dict] = {}
    for name in sorted(used(definition)):
        decl = decls.get(name)
        if decl is None:  # an undeclared reference — refused at save; drift on read
            raise ParamError("param_unbound", name)
        ptype, label = decl["type"], decl.get("label")
        for source, raw, relative in (
            ("viewer", viewer.get(name), False),
            ("dashboard", dashboard.get(name), True),
        ):
            if raw is None:
                continue
            try:
                values[name] = coerce(ptype, raw, allow_relative=relative)
            except (ValueError, TypeError):
                raise ParamError("param_invalid", name, label=label, expected=ptype, source=source) from None
            resolved[name] = {"value": values[name], "source": source}
            break
        else:
            default = decl.get("default")
            if default is None:
                raise ParamError("param_unbound", name, label=label)
            values[name] = coerce(ptype, default, allow_relative=True)  # checked at save
            resolved[name] = {"value": values[name], "source": "default"}
    return values, resolved


def placeholders(definition: dict) -> dict[str, Any]:
    decls = declared(definition)
    return {n: _PLACEHOLDER[decls[n]["type"]] for n in used(definition) if n in decls}


# --- binding ------------------------------------------------------------------


def site_dtypes(definition: dict, base_columns: list[dict]) -> dict[tuple, str]:
    """The column dtype at every predicate site (by its loc). A step predicate's
    column is looked up in the column space at that step, folded with
    placeholder-bound steps; a site that does not resolve is left out (the
    engine's own validation reports it)."""
    from app.query_engine import _plan_one_step  # local: query_engine imports this module's callers

    out: dict[tuple, str] = {}
    by_step: dict[int, list[Site]] = {}
    for s in _sites(definition):
        if s.step is None:
            col = s.pred.get("col")
            if isinstance(col, int) and not isinstance(col, bool) and 0 <= col < len(base_columns):
                out[s.loc] = base_columns[col]["dtype"]
        else:
            by_step.setdefault(s.step, []).append(s)
    if by_step:
        steps = bind(definition, placeholders(definition)).get("steps") or []
        cur = base_columns
        for k, step in enumerate(steps):
            by_name = {c["name"]: c["dtype"] for c in cur}
            for s in by_step.get(k, []):
                if s.pred.get("col") in by_name:
                    out[s.loc] = by_name[s.pred["col"]]
            try:
                _norm, cur = _plan_one_step(step, cur, ["body", "definition", "steps", k])
            except HTTPException:
                break
    return out


def bind(definition: dict, values: dict[str, Any], base_columns: list[dict] | None = None) -> dict:
    """A copy of ``definition`` with every reference replaced by its value. With
    ``base_columns``, a date on a datetime column becomes its day's start or end
    (F3). Without them (column-shape-only paths) the plain value is used. A
    ``between`` whose other bound is a literal takes that literal for a missing
    value (save-time placeholders keep ``min <= max``)."""
    if not used(definition):
        return definition
    out = copy.deepcopy(definition)
    dtypes = site_dtypes(definition, base_columns) if base_columns is not None else {}
    decls = declared(definition)
    for s in _sites(out):
        op = s.pred.get("op")
        for suffix, name in list(_refs(s)):
            v = values.get(name)
            if v is None:
                continue
            if (
                dtypes.get(s.loc) == "datetime"
                and decls.get(name, {}).get("type") == "date"
                and (op, suffix[0]) in _END_OF_DAY
            ):
                v = f"{v} 23:59:59.999999"
            if suffix[0] == "vals":
                s.pred["vals"][suffix[1]] = v
            else:
                s.pred[suffix[0]] = v
    return out


def bind_placeholders(definition: dict) -> dict:
    """Bind type placeholders (save checks, column shapes). In a ``between`` with
    one literal bound the reference takes that literal, so ``min <= max`` holds."""
    out = bind(definition, placeholders(definition))
    if out is definition:
        return out
    originals = {s.loc: s.pred for s in _sites(definition)}
    for s in _sites(out):
        orig = originals[s.loc]
        if s.pred.get("op") == "between":
            if is_ref(orig.get("min")) and not is_ref(orig.get("max")) and orig.get("max") is not None:
                s.pred["min"] = orig["max"]
            if is_ref(orig.get("max")) and not is_ref(orig.get("min")) and orig.get("min") is not None:
                s.pred["max"] = orig["min"]
    return out


# --- save-time checks (D1) ------------------------------------------------------


def check(definition: dict, base_columns: list[dict]) -> None:
    """422 naming the field: a duplicate name, a default not of its type, a
    reference to an undeclared name, a reference beside ``refCol``, on an
    operator that takes no such operand, of a type that does not fit the column,
    or a date on a datetime column under an exact-match operator."""
    decls: dict[str, dict] = {}
    for i, p in enumerate(definition.get("params") or []):
        if p["name"] in decls:
            raise _save_422(("params", i, "name"), f"param_duplicate: {p['name']!r} is declared twice")
        decls[p["name"]] = p
        default = p.get("default")
        if default is not None:
            if _is_relative(default) and p["type"] != "date":
                raise _save_422(("params", i, "default"), "param_default: a relative default is for date parameters")
            try:
                coerce(p["type"], default, allow_relative=True)
            except (ValueError, TypeError):
                raise _save_422(("params", i, "default"), f"param_default: not a {p['type']} value") from None
    if not used(definition):
        return
    dtypes = site_dtypes(definition, base_columns)
    for s in _sites(definition):
        op = s.pred.get("op")
        for suffix, name in _refs(s):
            loc = (*s.loc, *suffix)
            decl = decls.get(name)
            if decl is None:
                raise _save_422(loc, f"param_undeclared: {name!r} is not a parameter of this query")
            if s.pred.get("refCol") is not None:
                raise _save_422(loc, "param_ref_col: a parameter and refCol cannot share one predicate")
            key = suffix[0]
            allowed = (
                (key == "val" and op in _SINGLE)
                or (key in ("min", "max") and op in _RANGE)
                or (key == "vals" and op in _LIST)
            )
            if not allowed:
                raise _save_422(loc, f"param_operand: operator {op!r} takes no {key!r} operand")
            dtype = dtypes.get(s.loc)
            if dtype is None:
                continue  # the column does not resolve — the engine's check names it
            if _FIT.get(dtype) != decl["type"]:
                raise _save_422(loc, f"param_type: {name!r} ({decl['type']}) does not fit a {dtype} column")
            if dtype == "datetime" and op in _DAY_ONLY_REFUSED:
                raise _save_422(
                    loc,
                    f"param_day_match: a date parameter on a datetime column cannot use {op!r} — use between",
                )


def check_workflow_steps(steps: list[dict]) -> None:
    """D6 — a workflow declares no parameters; its steps may not reference one."""
    locs = has_refs(steps)
    if locs:
        raise _save_422(("steps", *locs[0]), "param_in_workflow: a workflow step cannot reference a parameter")


# --- the dashboard level (D3 level 2) --------------------------------------------


def dashboard_values(con: sqlite3.Connection, ref: dict | None, workspace_id: str, loc: list) -> dict[str, Any]:
    """The values saved on ``ref``'s dashboard controls (kind ``param``) that reach
    its widget — read by the server, never asserted by a client (BA contract-exit
    F1). Empty until 3.7b adds ``controls``. An unknown dashboard or widget, or one
    in another workspace → 422."""
    if not ref:
        return {}
    import json

    row = con.execute("SELECT workspace_id, definition_json FROM dashboards WHERE id = ?", (ref["id"],)).fetchone()
    definition = json.loads(row["definition_json"]) if row is not None else None
    if row is None or row["workspace_id"] != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "loc": [*loc, "id"],
                    "msg": "unknown_dashboard: not a dashboard of this query's workspace",
                    "type": "value_error",
                }
            ],
        )
    if not any(w.get("id") == ref["widgetId"] for w in definition.get("widgets") or []):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "loc": [*loc, "widgetId"],
                    "msg": "unknown_widget: not a widget of this dashboard",
                    "type": "value_error",
                }
            ],
        )
    out: dict[str, Any] = {}
    for c in definition.get("controls") or []:
        if c.get("kind") != "param" or c.get("saved") is None:
            continue
        targets = c.get("targets")
        if targets == "all" or (isinstance(targets, list) and ref["widgetId"] in targets):
            out.setdefault(c.get("param"), c["saved"])
    return out
