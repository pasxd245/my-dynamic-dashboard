"""R199 (item 4.3, dashboard-filters.md D4, D5, D7) — shared filters.

A dashboard ``values`` control is the per-widget drawer's filter made
dashboard-wide: a name-based one-of on one result column. Its selection
travels in the EXISTING runtime ``filters`` list (no second engine —
``_name_in_sql`` applies every item the same way):

- an item with ``control`` is the viewer's selection for that control (from
  the dashboard URL's ``f.<controlId>``); it overrides the control's ``saved``;
- a targeted ``values`` control with no item reads its ``saved`` selection —
  the SERVER applies D3 level 2, as it does for parameters (R195: a client
  never asserts a "dashboard" value);
- an item without ``control`` is the widget's own drawer filter.

``GET /rows`` spells the viewer selection as the dashboard URL does
(``f.<controlId>=v1,v2``); ``parse_f_keys`` reads the RAW query string.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import unquote

from fastapi import HTTPException, status

from app.params import targets_widget

BLANK_TOKEN = "~blank"
Scope = Literal["widget", "dashboard"]
Source = Literal["viewer", "dashboard"]


@dataclass(frozen=True)
class SharedFilter:
    """One runtime filter of a read, with where it came from (the export's
    Filters sheet lists ``scope`` and ``source``, D7)."""

    column: str
    values: tuple[Any, ...]
    scope: Scope
    label: str | None = None
    source: Source | None = None

    @property
    def pair(self) -> tuple[str, list[Any]]:
        """The ``(column, values)`` shape ``_name_in_sql`` takes."""
        return self.column, list(self.values)


def _422(loc: list, msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=[{"loc": loc, "msg": msg, "type": "value_error"}],
    )


_BAD_ESCAPE = re.compile(r"%(?![0-9A-Fa-f]{2})")


def _decode(token: str) -> str:
    """Percent-decode one token, or keep it RAW when it is malformed — a ``%``
    not followed by two hex digits, or escapes that are not UTF-8. The builder's
    ``decodeURIComponent`` throws on exactly these and keeps the token as typed,
    so both sides read the same value (CR-2)."""
    if _BAD_ESCAPE.search(token):
        return token
    try:
        return unquote(token, errors="strict")
    except UnicodeDecodeError:
        return token


def parse_f_keys(raw_query: str) -> dict[str, list[str | None]]:
    """``f.<controlId>`` keys of a RAW query string → ``{control id: values}``.

    Split on ``,`` BEFORE percent-decoding (a ``,`` inside a value travels as
    ``%2C``); each token is percent-decoded only (``+`` is a literal plus); the
    raw token ``~blank`` is the ``(blank)`` option (``None``) while ``%7Eblank``
    decodes to the literal string ``"~blank"``; an empty token between commas is
    ignored; a repeated key → the last wins; an empty value (``f.<id>=``) is an
    empty list — the viewer cleared the control (BA-C1/C2/C5). A malformed token
    stays raw (CR-2, the builder's rule)."""
    out: dict[str, list[str | None]] = {}
    if not raw_query:
        return out
    for part in raw_query.split("&"):
        if not part:
            continue
        key, sep, value = part.partition("=")
        key = _decode(key)
        if not key.startswith("f.") or len(key) <= 2:
            continue
        values: list[str | None] = []
        if sep and value:
            for token in value.split(","):
                if token == "":
                    continue
                values.append(None if token == BLANK_TOKEN else _decode(token))
        out[key[2:]] = values
    return out


def _values_controls(definition: dict | None) -> dict[str, dict]:
    return {c["id"]: c for c in (definition or {}).get("controls") or [] if c.get("kind") == "values"}


def resolve(
    definition: dict | None,
    widget_id: str | None,
    items: list[tuple[str | None, list[Any], str | None]],
    loc: list,
) -> list[SharedFilter]:
    """The runtime filters of one read, in order: the request's items (widget
    filters as given; ``control`` items as the viewer's shared selections), then
    the ``saved`` selections of the targeted ``values`` controls the request did
    not override (D3 level 2).

    ``items`` are ``(column, values, control)``: ``column`` may be ``None`` for a
    ``GET /rows`` key (the control's column is used). Rules (BA-C1): a ``control``
    without a dashboard ref → 422 ``control_without_dashboard``; one naming no
    ``values`` control of the dashboard → IGNORED (a stale link keeps opening,
    exactly as an unused ``p.<name>``); one whose control does not target the
    widget → ignored (D5); a ``column`` that is not the control's → 422
    ``control_column``."""
    controls = _values_controls(definition)
    out: list[SharedFilter] = []
    overridden: set[str] = set()
    for i, (column, values, control) in enumerate(items):
        if control is None:
            if column is None:
                continue
            out.append(SharedFilter(column, tuple(values), "widget"))
            continue
        if definition is None:
            raise _422([*loc, i, "control"], "control_without_dashboard: a shared filter needs `dashboard`")
        c = controls.get(control)
        if c is None or widget_id is None or not targets_widget(c, widget_id):
            continue
        if column is not None and column != c["column"]:
            raise _422([*loc, i, "column"], f"control_column: {control} filters {c['column']!r}, not {column!r}")
        overridden.add(control)
        out.append(SharedFilter(c["column"], tuple(values), "dashboard", c["label"], "viewer"))
    if definition is not None and widget_id is not None:
        for cid, c in controls.items():
            if cid in overridden or c.get("saved") is None or not targets_widget(c, widget_id):
                continue
            out.append(SharedFilter(c["column"], tuple(c["saved"]), "dashboard", c["label"], "dashboard"))
    return out


def pairs(filters: list[SharedFilter], col_names: set[str]) -> list[tuple[str, list[Any]]]:
    """The ``(column, values)`` pairs ``_name_in_sql`` applies: a filter on a
    column the result lacks is skipped (R103 / D5)."""
    return [f.pair for f in filters if f.column in col_names]


def applied(filters: list[SharedFilter], col_names: set[str]) -> list[SharedFilter]:
    """The filters that restricted something — for the export's Filters sheet:
    neither a skipped one (no such column) nor a cleared one (an empty list) is
    listed (BA-C4)."""
    return [f for f in filters if f.column in col_names and len(f.values) > 0]
