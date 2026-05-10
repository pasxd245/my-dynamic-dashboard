from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_env_access_is_centralized_to_env_helper() -> None:
    getenv_token = "os." + "getenv"
    environ_token = "os." + "environ"
    violations: list[Path] = []
    scan_roots = [
        ROOT / "streamlit_app.py",
        ROOT / "app_logging.py",
        ROOT / "src/dashboard",
    ]

    for root in scan_roots:
        if root.is_file():
            candidates = [root]
        else:
            candidates = list(root.rglob("*.py"))

        for path in candidates:
            rel = path.relative_to(ROOT)
            if "__pycache__" in rel.parts:
                continue
            if rel == Path("src/dashboard/utils/env_helper.py"):
                continue
            text = path.read_text(encoding="utf-8")
            if getenv_token in text or environ_token in text:
                violations.append(rel)

    assert not violations, f"found forbidden env access in: {violations}"
