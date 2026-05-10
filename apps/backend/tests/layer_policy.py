"""Canonical test-layer policy for governance checks."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LayerPolicy:
    name: str
    allows_network_io: bool
    allows_api_contract_validation: bool
    allows_perf_measurement: bool
    failure_interpretation: str


CANONICAL_LAYER_POLICIES: dict[str, LayerPolicy] = {
    "unit": LayerPolicy(
        name="unit",
        allows_network_io=False,
        allows_api_contract_validation=False,
        allows_perf_measurement=False,
        failure_interpretation="logic-regression",
    ),
    "integration": LayerPolicy(
        name="integration",
        allows_network_io=False,
        allows_api_contract_validation=True,
        allows_perf_measurement=False,
        failure_interpretation="component-interaction-regression",
    ),
    "contract": LayerPolicy(
        name="contract",
        allows_network_io=False,
        allows_api_contract_validation=True,
        allows_perf_measurement=False,
        failure_interpretation="interface-drift",
    ),
    "perf": LayerPolicy(
        name="perf",
        allows_network_io=False,
        allows_api_contract_validation=True,
        allows_perf_measurement=True,
        failure_interpretation="slo-or-environment-regression",
    ),
}
