from __future__ import annotations

import re
from pathlib import Path

import yaml


# ---------------------------------------------------------------------------
# T019 – Configuration precedence tests
# ---------------------------------------------------------------------------

_APP_DIR = Path(__file__).resolve().parents[2] / "app"


def _load_config_fresh(monkeypatch, *, env: dict[str, str] | None = None, config_file: Path | None = None):
    """Return a fresh AppConfig with an isolated environment snapshot."""
    from app.shared import _ENV_OVERRIDES, _CONFIG_FILE_ENV  # type: ignore[attr-defined]

    for env_name in _ENV_OVERRIDES.values():
        monkeypatch.delenv(env_name, raising=False)
    monkeypatch.delenv(_CONFIG_FILE_ENV, raising=False)

    if env:
        for k, v in env.items():
            monkeypatch.setenv(k, v)
    if config_file is not None:
        monkeypatch.setenv(_CONFIG_FILE_ENV, str(config_file))

    from app.shared import load_config  # noqa: PLC0415

    return load_config()


def test_config_defaults_only(monkeypatch) -> None:
    """Layer 1: default.yaml values resolve when no env or CONFIG_FILE is set."""
    cfg = _load_config_fresh(monkeypatch)

    assert cfg.get_str("app_env") == "development"
    assert cfg.get_int("backend_port") == 8000
    assert cfg.get_int("backend_workers") == 1
    assert cfg.get_str("backend_log_level") == "INFO"
    assert cfg.get_int("backup_retention_days") == 30


def test_config_env_override_wins(monkeypatch) -> None:
    """Layer 3: env vars override default.yaml values."""
    cfg = _load_config_fresh(
        monkeypatch,
        env={
            "APP_ENV": "staging",
            "BACKEND_PORT": "9090",
            "BACKEND_WORKERS": "4",
        },
    )

    assert cfg.get_str("app_env") == "staging"
    assert cfg.get_int("backend_port") == 9090
    assert cfg.get_int("backend_workers") == 4
    # Un-overridden fields still come from defaults.
    assert cfg.get_str("backend_log_level") == "INFO"


def test_config_config_file_override(monkeypatch, tmp_path) -> None:
    """Layer 2: CONFIG_FILE values override default.yaml."""
    override_file = tmp_path / "override.yaml"
    override_file.write_text(yaml.dump({"backend_log_level": "DEBUG", "backup_retention_days": 7}))

    cfg = _load_config_fresh(monkeypatch, config_file=override_file)

    assert cfg.get_str("backend_log_level") == "DEBUG"
    assert cfg.get_int("backup_retention_days") == 7
    # Default not in override still comes from defaults.
    assert cfg.get_str("app_env") == "development"


def test_config_env_beats_config_file(monkeypatch, tmp_path) -> None:
    """Layer 3 wins over Layer 2: env var overrides CONFIG_FILE value."""
    override_file = tmp_path / "override.yaml"
    override_file.write_text(yaml.dump({"backend_log_level": "WARNING"}))

    cfg = _load_config_fresh(
        monkeypatch,
        env={"BACKEND_LOG_LEVEL": "ERROR"},
        config_file=override_file,
    )

    assert cfg.get_str("backend_log_level") == "ERROR"


def test_config_missing_config_file_is_ignored(monkeypatch, tmp_path) -> None:
    """A CONFIG_FILE path that does not exist is silently ignored (falls back to defaults)."""
    missing = tmp_path / "does_not_exist.yaml"
    cfg = _load_config_fresh(monkeypatch, config_file=missing)

    assert cfg.get_str("app_env") == "development"


# ---------------------------------------------------------------------------
# T020 – Bare env-read guard
# ---------------------------------------------------------------------------

# Files allowed to contain os.getenv / os.environ because they implement the
# config loading infrastructure or the REPO_ROOT bootstrap.
_ALLOWED_RELATIVE: frozenset[str] = frozenset(
    {
        "shared.py",             # implements the layered loader (os.getenv is the mechanism)
        "utils/env_helper.py",  # path-resolution helper called by the layered loader
        "core/config.py",       # REPO_ROOT bootstrap — circular if resolved via AppConfig
    }
)

_ENV_READ_PATTERN = re.compile(r"\bos\.getenv\b|\bos\.environ\b")


def test_no_bare_env_reads_outside_allowed_modules() -> None:
    """T020: no file under app/ (outside the allowed set) may call os.getenv or os.environ."""
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
        "Bare os.getenv / os.environ calls found outside the allowed modules.\n"
        "Route all config through AppConfig (app.shared.CONFIG).\n"
        "Violations:\n  " + "\n  ".join(violations)
    )
