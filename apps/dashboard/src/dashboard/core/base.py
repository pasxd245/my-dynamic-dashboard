from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


@dataclass(frozen=True)
class ServiceResult:
    """Shared immutable result envelope for non-UI helpers."""

    ok: bool
    payload: Mapping[str, Any] | None = None
    message: str | None = None
