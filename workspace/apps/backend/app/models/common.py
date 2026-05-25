"""Pydantic models matching `@mdd/contracts` OpenAPI 3.1 YAML.

Hand-aligned per R16; codegen is deferred (see Round_16.md). Each
model that the YAML marks `additionalProperties: false` uses
`extra='forbid'` to enforce the same on the Python side.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


Dtype = Literal["string", "integer", "float", "boolean", "date", "datetime"]
SourceFormat = Literal["excel", "csv"]


WsId = Annotated[str, Field(pattern=r"^ws_[0-9a-f]{8}$")]
DsId = Annotated[str, Field(pattern=r"^ds_[0-9a-f]{8}$")]
TempId = Annotated[str, Field(pattern=r"^tmp_[0-9a-f]{16}$")]
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
    name: Annotated[str, Field(min_length=1, max_length=80)]
    createdAt: IsoUtc  # noqa: N815 — wire shape


class Dataset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: DsId
    workspaceId: WsId  # noqa: N815
    name: Annotated[str, Field(min_length=1, max_length=120)]
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


class ApiErrorNotFound(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["not_found"] = "not_found"


class ApiErrorNameTaken(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["name_taken"] = "name_taken"


class ApiErrorNonEmpty(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["non_empty"] = "non_empty"
    datasetCount: Annotated[int, Field(ge=1)]  # noqa: N815
