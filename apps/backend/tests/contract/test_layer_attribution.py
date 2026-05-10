from __future__ import annotations

from pathlib import Path


def test_contract_tests_live_under_contract_directory() -> None:
    contract_dir = Path(__file__).resolve().parent
    files = [p.name for p in contract_dir.glob("test_*.py")]
    assert files, "Expected at least one contract test file"


def test_contract_tests_do_not_use_perf_marker() -> None:
    contract_dir = Path(__file__).resolve().parent
    offenders: list[str] = []
    marker_token = "@pytest.mark." + "perf"
    for path in contract_dir.glob("test_*.py"):
        if marker_token in path.read_text(encoding="utf-8"):
            offenders.append(path.name)

    assert offenders == [], f"Contract tests must not carry perf markers: {offenders}"
