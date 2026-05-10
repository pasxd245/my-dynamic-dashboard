"""Shared deterministic factory helpers."""

from __future__ import annotations

from typing import Any, TypeVar


TDict = TypeVar("TDict", bound=dict[str, Any])


def with_overrides(base: TDict, **overrides: Any) -> TDict:
    """Return a merged copy with explicit override semantics."""
    merged = dict(base)
    merged.update(overrides)
    return merged  # type: ignore[return-value]


def deterministic_iso_timestamp() -> str:
    """Stable timestamp default for predictable assertions."""
    return "2026-01-01T00:00:00Z"


def deterministic_workspace_id(index: int = 1) -> str:
    return f"ws-{index:03d}"


def deterministic_source_id(index: int = 1) -> str:
    return f"src-{index:03d}"
