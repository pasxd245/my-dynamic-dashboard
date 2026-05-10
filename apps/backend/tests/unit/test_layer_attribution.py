from __future__ import annotations

from pathlib import Path


def _test_files() -> list[Path]:
    tests_root = Path(__file__).resolve().parents[1]
    return sorted(p for p in tests_root.rglob("test_*.py") if "__pycache__" not in p.parts)


def test_every_test_file_is_in_a_canonical_layer_directory() -> None:
    tests_root = Path(__file__).resolve().parents[1]
    canonical = {"unit", "integration", "contract", "perf"}
    invalid: list[str] = []

    for test_file in _test_files():
        relative = test_file.relative_to(tests_root)
        top = relative.parts[0]
        if top not in canonical:
            invalid.append(str(relative))

    assert invalid == [], f"Non-canonical test file locations: {invalid}"


def test_perf_marker_is_reserved_for_perf_directory() -> None:
    tests_root = Path(__file__).resolve().parents[1]
    misplaced: list[str] = []
    marker_token = "@pytest.mark." + "perf"

    for test_file in _test_files():
        content = test_file.read_text(encoding="utf-8")
        has_perf_marker = marker_token in content
        in_perf_dir = test_file.relative_to(tests_root).parts[0] == "perf"

        if has_perf_marker and not in_perf_dir:
            misplaced.append(str(test_file.relative_to(tests_root)))

    assert misplaced == [], f"Perf marker used outside tests/perf: {misplaced}"
