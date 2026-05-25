"""AppConfig — stable drifted-style facade over Pydantic Settings.

All call sites read config via this facade (`CONFIG.get_str(Fields.X)`,
`CONFIG.get_int(...)`, etc.) so the underlying Pydantic implementation
can change later without touching consumers.

Bonus: callers that prefer typed-attribute access can use
`CONFIG.settings.backend.port` directly.

Drifted-pattern reference: `apps/backend/app/shared.py` lines 51-95
(AppConfig class).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .settings import Settings, build_settings


class AppConfig:
    """Facade over a Pydantic Settings instance.

    Exposes drifted-style typed accessors (`get_str`, `get_int`,
    `get_path`) plus a generic `.get("dotted.key", default)` plus
    `.settings` for direct typed access.
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        # `model_dump()` produces a nested-dict snapshot suitable for
        # dotted-key walks.
        self._dict: dict[str, Any] = settings.model_dump()

    # ── Generic dotted-key access ──────────────────────────────────

    def get(self, dotted_key: str, default: Any = None) -> Any:
        current: Any = self._dict
        for part in dotted_key.split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return default
        return current

    # ── Typed accessors (drifted shape) ────────────────────────────

    def get_str(self, key: str, default: str = "") -> str:
        val = self.get(key, default)
        return str(val) if val is not None else default

    def get_int(self, key: str, default: int = 0) -> int:
        val = self.get(key, default)
        if val is None:
            return default
        try:
            return int(val)
        except (TypeError, ValueError):
            return default

    def get_path(self, key: str, default: Path | None = None) -> Path | None:
        val = self.get(key, default)
        if val is None:
            return default
        return Path(str(val))

    # ── Typed direct access ────────────────────────────────────────

    @property
    def settings(self) -> Settings:
        """Typed Pydantic instance — IDE autocomplete on every field."""
        return self._settings


# Module-level singleton resolved at import time (drifted pattern).
CONFIG: AppConfig = AppConfig(build_settings())
