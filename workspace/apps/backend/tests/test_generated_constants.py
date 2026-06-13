"""R29: smoke test for the js-tmpl-rendered BE constants module.

Verifies the rendered module imports cleanly and exposes the
expected keys + values. Catches drift if `values.yaml` is edited
without a re-render.
"""

from __future__ import annotations

import pytest

from app._generated.constants import ERROR_CODES, ID_PATTERNS, NAME_LENGTHS


@pytest.mark.unit
def test_id_patterns_keys_and_shapes() -> None:
    assert set(ID_PATTERNS.keys()) == {"workspace", "dataset", "temp", "query"}
    assert ID_PATTERNS["workspace"] == r"^ws_[0-9a-f]{8}$"
    assert ID_PATTERNS["dataset"] == r"^ds_[0-9a-f]{8}$"
    assert ID_PATTERNS["temp"] == r"^tmp_[0-9a-f]{16}$"
    assert ID_PATTERNS["query"] == r"^qr_[0-9a-f]{8}$"  # R69


@pytest.mark.unit
def test_error_codes_values_match_contract() -> None:
    """Values mirror packages/contracts/_shared/api-error.yaml enum."""
    assert ERROR_CODES["not_found"] == "not_found"
    assert ERROR_CODES["name_taken"] == "name_taken"
    assert ERROR_CODES["non_empty"] == "non_empty"
    assert ERROR_CODES["query_stale"] == "query_stale"  # R69


@pytest.mark.unit
def test_name_lengths_values_match_models() -> None:
    """Values mirror the Pydantic Field(max_length=...) bounds."""
    assert NAME_LENGTHS["workspace_max"] == 80
    assert NAME_LENGTHS["dataset_max"] == 120
    assert NAME_LENGTHS["query_max"] == 120  # R69


@pytest.mark.unit
def test_id_patterns_compile_as_regex() -> None:
    """Patterns must be valid Python regex strings (compile without raise)."""
    import re

    for key, pattern in ID_PATTERNS.items():
        re.compile(pattern), f"{key} pattern failed to compile"
