from __future__ import annotations

from tests.layer_policy import CANONICAL_LAYER_POLICIES


def test_contract_layer_restrictions_are_explicit() -> None:
    contract_policy = CANONICAL_LAYER_POLICIES["contract"]
    assert contract_policy.allows_network_io is False
    assert contract_policy.allows_api_contract_validation is True
    assert contract_policy.allows_perf_measurement is False
    assert contract_policy.failure_interpretation == "interface-drift"
