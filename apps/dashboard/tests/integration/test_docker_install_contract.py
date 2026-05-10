from __future__ import annotations

from pathlib import Path


def test_dockerfile_uses_pyproject_install_flow() -> None:
    dockerfile = Path(__file__).resolve().parents[2] / "Dockerfile"
    content = dockerfile.read_text(encoding="utf-8")

    assert "pip install --no-cache-dir -e /app" in content
    assert "requirements.txt" not in content
