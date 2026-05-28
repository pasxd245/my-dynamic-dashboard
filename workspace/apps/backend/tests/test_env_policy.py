"""R30: env-access policy scan.

Adopted from drifted's `test_no_bare_env_reads_outside_allowed_modules`
(see `.agents/memory/2026-05-25-drifted-config-pattern-research.md`).

Background: drifted ships an `env_helper.py` module with typed
env getters + a CI policy test that fails if any module outside
a tiny allowlist calls `os.getenv` / `os.environ` directly. The
typed-getters part is redundant for us (pydantic-settings provides
typed env reading via field annotations + `MDD_BACKEND__*` env
chain at R28). The policy-scan part is worth adopting: it
prevents future drift where a feature module reaches for
`os.environ` ad-hoc instead of going through `CONFIG`.

Our allowlist:

- `_config/settings.py` — Layer-2 bootstrap (`MDD_CONFIG_FILE`)
  has to read env before any config exists. Self-referential.

Anything else added to the allowlist must be justified — it
means a new bootstrap site.
"""

from __future__ import annotations

import re
from pathlib import Path


_APP_DIR = Path(__file__).resolve().parent.parent / "app"

# Files allowed bare env access. Each entry needs a one-line justification.
_ALLOWED_RELATIVE: frozenset[str] = frozenset(
    {
        # Layer-2 bootstrap path read; can't read its own location from config.
        "_config/settings.py",
    }
)

_ENV_READ_PATTERN = re.compile(r"\bos\.getenv\b|\bos\.environ\b")


def test_no_bare_env_reads_outside_allowed_modules() -> None:
    """No file under `app/` (outside the allowlist) may call `os.getenv`
    or `os.environ`. All env access goes through pydantic-settings'
    `MDD_BACKEND__*` env-var chain via `CONFIG.settings.*`.
    """
    violations: list[str] = []

    for py_file in sorted(_APP_DIR.rglob("*.py")):
        rel = py_file.relative_to(_APP_DIR).as_posix()
        if rel in _ALLOWED_RELATIVE:
            continue
        source = py_file.read_text(encoding="utf-8", errors="replace")
        if _ENV_READ_PATTERN.search(source):
            count = len(_ENV_READ_PATTERN.findall(source))
            violations.append(f"{rel}: {count} bare env read(s)")

    assert not violations, (
        "Bare env reads outside the allowlist — route through "
        "`CONFIG.settings.*` (pydantic-settings handles MDD_BACKEND__*) "
        "or justify a new allowlist entry in this test:\n  " + "\n  ".join(violations)
    )
