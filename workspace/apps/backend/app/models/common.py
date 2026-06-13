"""Pydantic models matching `@mdd/contracts` OpenAPI 3.1 YAML.

Hand-aligned per R16; codegen is deferred (see Round_16.md). Each
model that the YAML marks `additionalProperties: false` uses
`extra='forbid'` to enforce the same on the Python side.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app._generated.constants import ERROR_CODES, ID_PATTERNS, NAME_LENGTHS


Dtype = Literal["string", "integer", "float", "boolean", "date", "datetime"]
SourceFormat = Literal["excel", "csv"]


# R29: pattern strings sourced from app/_generated/constants.py (rendered from
# workspace/config/values.yaml). Pydantic Field(pattern=...) accepts strings;
# the compiled regex is created at field-creation time. Same behavior, one
# source of truth.
WsId = Annotated[str, Field(pattern=ID_PATTERNS["workspace"])]
DsId = Annotated[str, Field(pattern=ID_PATTERNS["dataset"])]
TempId = Annotated[str, Field(pattern=ID_PATTERNS["temp"])]
IsoUtc = Annotated[
    str,
    Field(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$"),
]


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1)]
    dtype: Dtype


class Workspace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: WsId
    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["workspace_max"])]
    createdAt: IsoUtc  # noqa: N815 — wire shape


class Dataset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: DsId
    workspaceId: WsId  # noqa: N815
    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["dataset_max"])]
    sizeBytes: Annotated[int, Field(ge=0)]  # noqa: N815
    rowCount: Annotated[int, Field(ge=0)]  # noqa: N815
    columnCount: Annotated[int, Field(ge=1)]  # noqa: N815
    columns: Annotated[list[Column], Field(min_length=1)]
    sourceFormat: SourceFormat  # noqa: N815
    sheetName: str | None = None  # noqa: N815
    createdAt: IsoUtc  # noqa: N815


class ParseOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    range: Annotated[str | None, Field(pattern=r"^[A-Z]+[0-9]+:[A-Z]+[0-9]+$")] = None
    skip_rows: Annotated[int | None, Field(ge=0)] = None
    has_header: bool | None = None


class ColumnOverride(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dtype: Dtype
    format: str | None = None


class SheetSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sheet: Annotated[str, Field(min_length=1)]
    rowCount: Annotated[int, Field(ge=0)]  # noqa: N815
    columnCount: Annotated[int, Field(ge=0)]  # noqa: N815
    usedRange: Annotated[  # noqa: N815
        str | None, Field(pattern=r"^[A-Z]+[0-9]+:[A-Z]+[0-9]+$")
    ] = None


class CsvParsePreview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    columns: Annotated[list[Column], Field(min_length=1)]
    rowCount: Annotated[int, Field(ge=0)]  # noqa: N815
    sampleRows: list[list[str | None]]  # noqa: N815


class TempUploadCsv(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temp_id: TempId
    sourceFormat: Literal["csv"]  # noqa: N815
    sizeBytes: Annotated[int, Field(ge=0)]  # noqa: N815
    csvPreview: CsvParsePreview  # noqa: N815


class TempUploadExcel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temp_id: TempId
    sourceFormat: Literal["excel"]  # noqa: N815
    sizeBytes: Annotated[int, Field(ge=0)]  # noqa: N815
    sheets: Annotated[list[SheetSummary], Field(min_length=1)]


# R23 CRUD hygiene chain — added in R25. Matches the YAMLs at
# packages/contracts/_shared/api-error.yaml and the per-endpoint
# patch.contract.yaml request bodies.


class RenameBody(BaseModel):
    """Shared request body for PATCH /workspaces/{id} and
    PATCH /datasets/{id}. The route-level handler enforces the
    per-resource max-length (80 vs 120) via its own Annotated
    wrapper; this base model only enforces the lower bound."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1)]


# R29: Literal[...] type annotations stay hand-authored — Pydantic needs
# the literal-string at parse time for discriminated-union narrowing.
# The default values reference ERROR_CODES so the runtime string has one
# source of truth (any future rename in values.yaml propagates to the
# defaults; the Literal annotations would need a paired update).


class ApiErrorNotFound(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["not_found"] = ERROR_CODES["not_found"]  # type: ignore[assignment]


class ApiErrorNameTaken(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["name_taken"] = ERROR_CODES["name_taken"]  # type: ignore[assignment]


class ApiErrorNonEmpty(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["non_empty"] = ERROR_CODES["non_empty"]  # type: ignore[assignment]
    datasetCount: Annotated[int, Field(ge=1)]  # noqa: N815


# ─── R69: Saved Query ────────────────────────────────────────────────
# Mirrors packages/contracts/_shared/query.yaml + queries/*. The
# `definition` reuses the EXACT predicate-atom shape the rows-GET `aq`
# param already carries (no new vocabulary). Persistence is raw-SQLite
# (the established backend standard) — see Round_69 Do (J-3 deviation).

QueryId = Annotated[str, Field(pattern=ID_PATTERNS["query"])]


class FilterAtom(BaseModel):
    """One predicate atom — the same shape the rows-GET `aq` param carries.
    `col` is the 0-based index into the source Dataset.columns[]."""

    model_config = ConfigDict(extra="forbid")

    col: Annotated[int, Field(ge=0)]
    dtype: Dtype
    op: Annotated[str, Field(min_length=1)]
    val: int | float | str | None = None
    min: int | float | str | None = None
    max: int | float | str | None = None


class JoinStep(BaseModel):
    """R71 — an optional join step on a QueryDefinition. The Query consumes a
    governed Relationship (`rel_`) to read two related datasets as one."""

    model_config = ConfigDict(extra="forbid")

    relationshipId: Annotated[str, Field(pattern=ID_PATTERNS["relationship"])]  # noqa: N815
    type: Literal["inner"]  # MVP — inner join only


class QueryDefinition(BaseModel):
    """The saved predicate state: chip filters + advanced DNF + `?q=`. R71 adds
    an optional `join`: when present the Query is multi-source and a FilterAtom's
    `col` indexes the EFFECTIVE (left ++ right) column space."""

    model_config = ConfigDict(extra="forbid")

    q: Annotated[str | None, Field(max_length=200)] = None
    filters: list[FilterAtom]
    advanced: list[list[FilterAtom]]
    join: JoinStep | None = None


class Query(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: QueryId
    workspaceId: WsId  # noqa: N815
    datasetId: DsId  # noqa: N815
    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["query_max"])]
    definition: QueryDefinition
    # R71 — the effective (combined, collision-qualified) columns; present only
    # when `definition.join` is set. The FE renders joined headers from it.
    resolvedColumns: list[Column] | None = None  # noqa: N815
    createdAt: IsoUtc  # noqa: N815


class CreateQueryBody(BaseModel):
    """POST /workspaces/{id}/queries request body."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["query_max"])]
    datasetId: DsId  # noqa: N815
    definition: QueryDefinition


class ApiErrorQueryStale(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["query_stale"] = ERROR_CODES["query_stale"]  # type: ignore[assignment]


# ─── R70: relationship governance ────────────────────────────────────
# Mirrors packages/contracts/_shared/relationship.yaml + relationships/*.
# A Relationship is a governed EDGE between two datasets in one workspace.
# `status` is computed on read (never stored). Persistence is raw-SQLite.

RelationshipId = Annotated[str, Field(pattern=ID_PATTERNS["relationship"])]
Cardinality = Literal["one_to_one", "one_to_many", "many_to_many"]
RelationshipStatus = Literal["valid", "stale"]


class Relationship(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: RelationshipId
    workspaceId: WsId  # noqa: N815
    leftDatasetId: DsId  # noqa: N815
    leftColumn: Annotated[str, Field(min_length=1)]  # noqa: N815
    rightDatasetId: DsId  # noqa: N815
    rightColumn: Annotated[str, Field(min_length=1)]  # noqa: N815
    cardinality: Cardinality
    status: RelationshipStatus
    createdAt: IsoUtc  # noqa: N815


class CreateRelationshipBody(BaseModel):
    """POST /workspaces/{id}/relationships request body."""

    model_config = ConfigDict(extra="forbid")

    leftDatasetId: DsId  # noqa: N815
    leftColumn: Annotated[str, Field(min_length=1)]  # noqa: N815
    rightDatasetId: DsId  # noqa: N815
    rightColumn: Annotated[str, Field(min_length=1)]  # noqa: N815
    cardinality: Cardinality


class ApiErrorRelationshipExists(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["relationship_exists"] = ERROR_CODES["relationship_exists"]  # type: ignore[assignment]


class ApiErrorRelationshipStale(BaseModel):
    """R71 — a join was requested over an edge whose key column drifted (or whose
    edge/dataset is gone), so the join can't run. Blocks the join (vs query_stale,
    which is a predicate-atom drift)."""

    model_config = ConfigDict(extra="forbid")

    code: Literal["relationship_stale"] = ERROR_CODES["relationship_stale"]  # type: ignore[assignment]
