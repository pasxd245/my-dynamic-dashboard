from __future__ import annotations

from dataclasses import dataclass
import json

import polars as pl


SAMPLING_THRESHOLD_ROWS = 10000
SAMPLING_SIZE = 5000
SAMPLING_SEED = 42


@dataclass
class ComputedProfile:
    null_ratio: float
    distinct_count: int
    uniqueness_ratio: float
    duplicate_signature: str
    top_k_values_json: str
    warnings_json: str
    sampled: bool
    sample_size: int | None
    sample_seed: int | None


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


def _warn_mixed_type_string(series: pl.Series) -> list[str]:
    if series.dtype != pl.String:
        return []

    non_null = series.drop_nulls().str.to_lowercase()
    if non_null.len() == 0:
        return []

    numeric_like = non_null.str.contains(r"^-?\d+(\.\d+)?$").sum()
    alpha_like = non_null.str.contains(r"[a-z]").sum()
    warnings: list[str] = []

    if numeric_like > 0 and alpha_like > 0:
        warnings.append("mixed_type_values")

    sentinel_like = non_null.str.contains(r"^(n/?a|null|none)$").sum()
    if sentinel_like > 0:
        warnings.append("sentinel_values_detected")

    whitespace_like = non_null.str.contains(r"^\s|\s$").sum()
    if whitespace_like > 0:
        warnings.append("leading_trailing_whitespace")

    return warnings


def _warn_out_of_range_dates(series: pl.Series) -> list[str]:
    if series.dtype not in {pl.Date, pl.Datetime}:
        return []

    non_null = series.drop_nulls()
    if non_null.len() == 0:
        return []

    min_value = non_null.min()
    max_value = non_null.max()
    min_year = getattr(min_value, "year", None)
    max_year = getattr(max_value, "year", None)

    if min_year is None or max_year is None:
        return []

    if min_year < 1990 or max_year > 2100:
        return ["date_out_of_range"]

    return []


def _to_top_k_json(series: pl.Series, limit: int = 5) -> str:
    top = series.drop_nulls().value_counts().sort("count", descending=True).head(limit)
    rows = top.to_dicts()
    normalized = [
        {"value": row.get(series.name), "count": int(row.get("count", 0))} for row in rows
    ]
    return json.dumps(normalized, separators=(",", ":"), sort_keys=True)


def compute_profiles(df: pl.DataFrame) -> tuple[pl.DataFrame, bool, int | None, int | None]:
    sampled = df.height > SAMPLING_THRESHOLD_ROWS
    sample_size: int | None = None
    sample_seed: int | None = None

    profile_df = df
    if sampled:
        sample_size = min(SAMPLING_SIZE, df.height)
        sample_seed = SAMPLING_SEED
        profile_df = df.sample(n=sample_size, seed=sample_seed)

    return profile_df, sampled, sample_size, sample_seed


def compute_column_profile(series: pl.Series, sampled: bool, sample_size: int | None, sample_seed: int | None) -> ComputedProfile:
    row_count = max(series.len(), 1)
    null_ratio = float(series.null_count() / row_count)
    distinct_count = int(series.n_unique())
    non_null = max(series.len() - series.null_count(), 1)
    uniqueness_ratio = float(distinct_count / non_null)

    warnings = _warn_mixed_type_string(series)
    warnings.extend(_warn_out_of_range_dates(series))

    duplicate_signature = "duplicates_present" if uniqueness_ratio < 1.0 else "all_unique"
    top_k_json = _to_top_k_json(series)
    warnings_json = json.dumps(warnings, separators=(",", ":"), sort_keys=True)

    return ComputedProfile(
        null_ratio=round(null_ratio, 6),
        distinct_count=distinct_count,
        uniqueness_ratio=round(uniqueness_ratio, 6),
        duplicate_signature=duplicate_signature,
        top_k_values_json=top_k_json,
        warnings_json=warnings_json,
        sampled=sampled,
        sample_size=sample_size,
        sample_seed=sample_seed,
    )
