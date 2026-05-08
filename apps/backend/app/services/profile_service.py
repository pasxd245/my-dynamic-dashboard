from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CompatibilityResult:
    accepted: bool
    override_required: bool
    reason: str | None = None


def validate_role_compatibility(
    role: str,
    effective_type: str,
    uniqueness_ratio: float,
    has_override_reason: bool,
) -> CompatibilityResult:
    if role == "time_anchor":
        if effective_type != "date":
            return CompatibilityResult(
                accepted=False,
                override_required=False,
                reason="time_anchor requires date type",
            )
        return CompatibilityResult(accepted=True, override_required=False)

    if role == "measure":
        if effective_type in {"numeric", "integer"}:
            return CompatibilityResult(accepted=True, override_required=False)
        if not has_override_reason:
            return CompatibilityResult(
                accepted=False,
                override_required=True,
                reason="measure override reason required for non-numeric column",
            )
        return CompatibilityResult(accepted=True, override_required=True)

    if role == "identity_key":
        if uniqueness_ratio >= 0.99:
            return CompatibilityResult(accepted=True, override_required=False)
        if not has_override_reason:
            return CompatibilityResult(
                accepted=False,
                override_required=True,
                reason="identity_key override reason required when uniqueness < 0.99",
            )
        return CompatibilityResult(accepted=True, override_required=True)

    return CompatibilityResult(accepted=True, override_required=False)
