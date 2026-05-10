from __future__ import annotations

from tests.layer_policy import CANONICAL_LAYER_POLICIES


def test_integration_layer_restrictions_are_explicit() -> None:
    integration_policy = CANONICAL_LAYER_POLICIES["integration"]
    assert integration_policy.allows_network_io is False
    assert integration_policy.allows_api_contract_validation is True
    assert integration_policy.allows_perf_measurement is False
    assert integration_policy.failure_interpretation == "component-interaction-regression"
