from __future__ import annotations

from tests.layer_policy import CANONICAL_LAYER_POLICIES


def test_unit_layer_restrictions_are_explicit() -> None:
    unit_policy = CANONICAL_LAYER_POLICIES["unit"]
    assert unit_policy.allows_network_io is False
    assert unit_policy.allows_api_contract_validation is False
    assert unit_policy.allows_perf_measurement is False
    assert unit_policy.failure_interpretation == "logic-regression"
