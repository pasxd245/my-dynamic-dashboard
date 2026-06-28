"""Pydantic models matching `@mdd/contracts` OpenAPI 3.1 YAML.

Hand-aligned per R16; codegen is deferred (see Round_16.md). Each
model that the YAML marks `additionalProperties: false` uses
`extra='forbid'` to enforce the same on the Python side.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app._generated.constants import ERROR_CODES, ID_PATTERNS, NAME_LENGTHS


Dtype = Literal["string", "integer", "float", "boolean", "date", "datetime"]
SourceFormat = Literal["excel", "csv"]


# R29: pattern strings sourced from app/_generated/constants.py (rendered from
# workspace/config/values.yaml). Pydantic Field(pattern=...) accepts strings;
# the compiled regex is created at field-creation time. Same behavior, one
# source of truth.
WsId = Annotated[str, Field(pattern=ID_PATTERNS["workspace"])]
DsId = Annotated[str, Field(pattern=ID_PATTERNS["dataset"])]
# R76/R79/R91 — the polymorphic table-source id: a Dataset (`ds_…`) or a saved Query
# (`qr_…`). Used by the driving `sourceId` (R79) and, R91, by a join edge's
# `rightSourceId` (query×query). Hoisted here so the QueryRelationship model can use it.
# Mirrors the contract's `^(ds_|qr_)[0-9a-f]{8}$`; the unified resolver reads either.
SourceId = Annotated[str, Field(pattern=r"^(ds_|qr_)[0-9a-f]{8}$")]
# R93 — a LEAF dataset id (`ds_…` only); used by a ResolvedColumn's `ownerSourceId`,
# which is always a leaf (the join resolver matches a hop's left by leaf membership).
DatasetId = Annotated[str, Field(pattern=r"^ds_[0-9a-f]{8}$")]
TempId = Annotated[str, Field(pattern=ID_PATTERNS["temp"])]
IsoUtc = Annotated[
    str,
    Field(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$"),
]


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1)]
    dtype: Dtype


class ResolvedColumn(BaseModel):
    """R93 — an EFFECTIVE column of a (joined/composed) query, carrying its COLUMN
    PROVENANCE: the leaf dataset (`ownerSourceId`, always a `ds_`) + the
    pre-qualification name (`sourceColumn`) it traces to. A consumer joining OFF a
    query's effective column resolves the hop's left key to that leaf, which the
    join resolver matches by membership. A 1:1-owned column carries both; a
    derived/aggregate column (no single owner) omits them — none exist today."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1)]
    dtype: Dtype
    ownerSourceId: DatasetId | None = None  # noqa: N815 — wire shape; a leaf `ds_`
    sourceColumn: Annotated[str, Field(min_length=1)] | None = None  # noqa: N815


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


QueryRelationshipId = Annotated[str, Field(pattern=ID_PATTERNS["query_relationship"])]


class QueryRelationship(BaseModel):
    """R88 — a QUERY-OWNED join relationship: the governed Relationship's join
    fields, but stored INSIDE a QueryDefinition and scoped to that query. Seeded
    by COPY-ON-PICK (picking a governed `rel_` copies its current fields here,
    recording `originRelationshipId` as provenance) or — R89 — defined free-form
    (`originRelationshipId` null). Because the query carries its own copy, editing
    or deleting the governed rel never breaks the saved query (it runs on this
    snapshot). Mirrors `_shared/query.yaml#/QueryRelationship`."""

    model_config = ConfigDict(extra="forbid")

    id: QueryRelationshipId
    # R91 — right-side-first: a hop's left is always an in-graph dataset (`ds_`).
    leftSourceId: DsId  # noqa: N815
    leftColumn: Annotated[str, Field(min_length=1)]  # noqa: N815
    # R91 — the right source may be a dataset OR a saved Query (`qr_`, query×query),
    # resolved as a subquery exposing its effective columns. The governed ER stays
    # dataset-only, so a `qr_`-right edge is always free-form (no originRelationshipId).
    rightSourceId: SourceId  # noqa: N815
    rightColumn: Annotated[str, Field(min_length=1)]  # noqa: N815
    cardinality: Literal["one_to_one", "one_to_many", "many_to_many"]
    # Provenance back-ref to the governed rel copied from (copy-on-pick); null /
    # omitted when defined free-form (R89).
    originRelationshipId: (  # noqa: N815
        Annotated[str, Field(pattern=ID_PATTERNS["relationship"])] | None
    ) = None


class JoinStep(BaseModel):
    """One join hop. R71 introduced a single hop; R73 chains an ordered list of
    them (`QueryDefinition.joins`); R74 relaxes the topology to a connected acyclic
    tree (each hop's left = any in-graph source). R75: `type` widens beyond `inner`
    to the outer joins (left / right / full), which keep unmatched rows. R88 — a
    hop now consumes a QUERY-OWNED relationship (`queryRelId` → a `QueryRelationship`
    in this definition's `relationships`), not a governed `rel_` by id."""

    model_config = ConfigDict(extra="forbid")

    queryRelId: QueryRelationshipId  # noqa: N815
    type: Literal["inner", "left", "right", "full"] = "inner"  # R75 — inner default + outer joins


class QueryDefinition(BaseModel):
    """The saved predicate state: chip filters + advanced DNF + `?q=`. R71 added
    an optional join; R73 generalizes it to `joins`, an ordered LINEAR CHAIN of
    hops: when non-empty the Query is multi-source and a FilterAtom's `col`
    indexes the EFFECTIVE column space (the source dataset ++ every chained
    dataset). A single join is just a length-1 chain."""

    model_config = ConfigDict(extra="forbid")

    q: Annotated[str | None, Field(max_length=200)] = None
    filters: list[FilterAtom]
    advanced: list[list[FilterAtom]]
    # R88 — the query's OWN join relationships (query-owned rels). Each `JoinStep`
    # references one by `queryRelId`. Seeded by copy-on-pick or (R89) free-form.
    relationships: list[QueryRelationship] = []
    joins: list[JoinStep] = []

    @model_validator(mode="before")
    @classmethod
    def _fold_legacy_join(cls, data: object) -> object:
        """Back-compat read shim: a legacy single `join` (R71/R72 persisted
        definitions, or an older client) folds into a length-1 `joins`, so the
        model accepts it without violating `extra='forbid'`. New writes use
        `joins`; responses always carry `joins`."""
        if isinstance(data, dict) and "join" in data:
            data = dict(data)
            legacy = data.pop("join")
            if legacy is not None and not data.get("joins"):
                data["joins"] = [legacy]
        return data


# `SourceId` (the polymorphic `ds_|qr_` driving-source id) is defined near `DsId`
# above so the QueryRelationship model (R91 `rightSourceId`) can reference it too.


class Query(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: QueryId
    workspaceId: WsId  # noqa: N815
    # R79 — the single, canonical polymorphic driving source (required); a `ds_`
    # for a dataset-rooted query or a `qr_` for a composed one. The legacy
    # `datasetId` was retired here (backfilled into `sourceId`).
    sourceId: SourceId  # noqa: N815
    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["query_max"])]
    definition: QueryDefinition
    # R71/R73 — the effective (combined, collision-qualified) columns; present
    # whenever `definition.joins` is non-empty (a single join or a multi-hop
    # chain). The FE renders joined headers from it.
    resolvedColumns: list[ResolvedColumn] | None = None  # noqa: N815
    createdAt: IsoUtc  # noqa: N815


class CreateQueryBody(BaseModel):
    """POST /workspaces/{id}/queries request body."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["query_max"])]
    sourceId: SourceId  # noqa: N815 — R79: the required, canonical qr_/ds_ driving source
    definition: QueryDefinition


class UpdateQueryBody(BaseModel):
    """R72 — PUT /queries/{id} request body. Definition-only edit (the
    construction surface): the join + predicates change; the Query's name /
    source are unchanged this round (rename deferred)."""

    model_config = ConfigDict(extra="forbid")

    definition: QueryDefinition


class PreviewQueryBody(BaseModel):
    """R72 — POST /workspaces/{id}/queries/preview request body. Runs an
    UNSAVED working-copy definition (the live builder preview); never persisted.
    Same shapes as create, minus the name (no entity is created)."""

    model_config = ConfigDict(extra="forbid")

    sourceId: SourceId  # noqa: N815 — R79: the required, canonical qr_/ds_ driving source
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


class ApiErrorCompositionCycle(BaseModel):
    """R76 — a Query × Query composition would loop: the driving source (`sourceId`)
    is, directly or transitively, the query itself. Blocks the save (save-time guard)
    and the run (409) instead of recursing forever. The composition analogue of
    `cyclic_join` (which guards dataset re-entry within one join tree)."""

    model_config = ConfigDict(extra="forbid")

    code: Literal["composition_cycle"] = ERROR_CODES["composition_cycle"]  # type: ignore[assignment]


# ─── R101: Dashboard (persisted noun) ────────────────────────────────
# Mirrors packages/contracts/_shared/dashboard.yaml + dashboards/*. A Dashboard
# is workspace-scoped; its widgets live in an embedded-JSON `definition` (no
# separate widgets table). Both `name` and `slug` are unique per-workspace (the
# route nests the project — `/dashboards/<ws_id>/<slug>`). A widget is FORMULA-FREE:
# a saved Query (`queryId`) + dimension/measure/agg/chart, columns by NAME.
# Persistence is raw-SQLite (the established backend standard).

DashboardId = Annotated[str, Field(pattern=ID_PATTERNS["dashboard"])]
WidgetId = Annotated[str, Field(pattern=ID_PATTERNS["widget"])]
# Dash-case URL slug: lowercase alphanumerics + single internal hyphens.
SlugStr = Annotated[
    str,
    Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=NAME_LENGTHS["dashboard_max"]),
]
ChartType = Literal["bar", "pie"]
Agg = Literal["sum", "count"]


class Widget(BaseModel):
    """One formula-free chart on a dashboard: a saved Query (`queryId`) + which
    column is the dimension / measure, how to aggregate, how to chart it, and its
    grid width. Columns are stored by logical NAME (F1 resolved name-vs-index).
    `measureCol` is required for `sum` and omitted for `count`."""

    model_config = ConfigDict(extra="forbid")

    id: WidgetId
    queryId: QueryId  # noqa: N815 — FK → Query.id (must be a query in the dashboard's workspace)
    title: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["dashboard_max"])]
    chartType: ChartType  # noqa: N815
    dimensionCol: Annotated[str, Field(min_length=1)]  # noqa: N815
    measureCol: Annotated[str, Field(min_length=1)] | None = None  # noqa: N815
    agg: Agg
    span: Annotated[int, Field(ge=1, le=3)]

    @model_validator(mode="after")
    def _check_measure(self) -> Widget:
        """`sum` totals `measureCol` (required); `count` tallies rows (no
        measure). Mirrors the contract's per-field rule — a `sum` without a
        measure, or a `count` carrying one, is 422."""
        if self.agg == "sum" and self.measureCol is None:
            raise ValueError("measureCol is required when agg='sum'")
        if self.agg == "count" and self.measureCol is not None:
            raise ValueError("measureCol must be omitted when agg='count'")
        return self


class DashboardDefinition(BaseModel):
    """The embedded dashboard body — its ordered widget set. Empty `widgets` is
    valid (a freshly-created dashboard before its first widget)."""

    model_config = ConfigDict(extra="forbid")

    widgets: list[Widget]


class Dashboard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: DashboardId
    workspaceId: WsId  # noqa: N815
    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["dashboard_max"])]
    slug: SlugStr
    definition: DashboardDefinition
    createdAt: IsoUtc  # noqa: N815


class CreateDashboardBody(BaseModel):
    """POST /workspaces/{id}/dashboards request body."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["dashboard_max"])]
    slug: SlugStr
    definition: DashboardDefinition


class UpdateDashboardBody(CreateDashboardBody):
    """PUT /dashboards/{id} request body — a FULL-representation replace of
    `name` + `slug` + `definition` (every FE mutation resends the whole
    dashboard). Same shape as create."""


class ApiErrorSlugTaken(BaseModel):
    """R101 — a dashboard's `slug` collides with another dashboard's slug in the
    SAME workspace (per-workspace, like `name`). Distinct from `name_taken` so the
    FE points the inline error at the slug field."""

    model_config = ConfigDict(extra="forbid")

    code: Literal["slug_taken"] = ERROR_CODES["slug_taken"]  # type: ignore[assignment]
