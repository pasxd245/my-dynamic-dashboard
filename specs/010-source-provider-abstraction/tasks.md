# Tasks: Source/Provider Abstraction Layer

**Specification**: [spec.md](spec.md) | **Implementation Plan**: [plan.md](plan.md)  
**Feature**: Spec 010 — Source/Provider Abstraction  
**Scope**: Extract ingestion source handling into a pluggable abstraction layer to enable extensible data source integration without scattering edits across multiple files.  
**Status**: Ready for `/speckit.implement`

---

## Overview

This document decomposes Spec 010's implementation plan into **60+ sequentially-ordered, independently-verifiable tasks** organized by phase. Each task includes:
This document decomposes Spec 010's implementation plan into **74 sequentially-ordered, independently-verifiable tasks** organized by phase. Each task includes:

- **Task ID** (T-001, T-002, ...) for progress tracking
- **Phase label** (Phase 1-5) for readability
- **Requirement linkage** (e.g., FR-001, SC-001) to spec
- **Acceptance criteria** (verifiable evidence: file created, test passes, import succeeds, etc.)
- **Dependencies** (implicit ordering within phase; explicit cross-phase dependencies noted)

**Total Task Count**: 62 tasks across 5 phases  
**Estimated Duration**: 10-16 days with concurrent work streams  
**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 (mostly sequential; within-phase tasks can parallelize)

---

## Phase 1: Foundation (Source Base Class, SourceConfig, SourceRegistry)

**Duration**: 1-2 days | **Goal**: Define the Source/SourceConfig/SourceRegistry contracts and prove compilation

### Research & Documentation Tasks

- [x] T-001: Phase 1 — Document decision justifications in `research.md`
  - **Requirement**: FR-002, FR-003, FR-009
  - **Acceptance**: (a) `specs/010-source-provider-abstraction/research.md` exists, (b) sections: "Design Decision D (Location)", "Design Decision E (Singleton Pattern)", "Design Decision F (Backward Compatibility)", (c) hg_code/src/com/provider.py pattern comparison included

- [x] T-002: Phase 1 — Create entity relationship diagram in `data-model.md`
  - **Requirement**: FR-001, FR-002, FR-003, SC-008
  - **Acceptance**: (a) `specs/010-source-provider-abstraction/data-model.md` exists, (b) includes entity diagrams for Source (abstract), SourceConfig, ExcelSourceConfig, CSVSourceConfig, SourceRegistry, SourceMetadata, (c) relationships clearly labeled (inheritance, composition, dependency)

- [x] T-003: Phase 1 — Document SourceRegistry initialization in `quickstart.md` (outline only)
  - **Requirement**: SC-008
  - **Acceptance**: (a) `specs/010-source-provider-abstraction/quickstart.md` exists, (b) sections: "Overview", "Adding a New Source Type (Stub)", "Registration Pattern" (outline, not detailed yet—Phase 5 fills in details)

### Foundation Implementation Tasks

- [x] T-004: Phase 1 — Create `apps/backend/app/sources/` directory and `__init__.py`
  - **Requirement**: FR-009
  - **Acceptance**: (a) Directory exists at `apps/backend/app/sources/`, (b) `__init__.py` is present and empty or imports Source base class

- [x] T-005: Phase 1 — Define Source abstract base class in `apps/backend/app/sources/base.py`
  - **Requirement**: FR-001, FR-008
  - **Acceptance**: (a) File exists, (b) Source class has abstract methods: `parse(config: SourceConfig) -> pl.DataFrame`, `compute_profiles(df: pl.DataFrame) -> list[ColumnProfile]`, (c) `post_commit_hook(workspace_id: str, source_file_id: str, columns: list[ColumnProfile]) -> None` is defined as no-op, (d) docstrings included, (e) file imports successfully: `from app.sources.base import Source`

- [x] T-006: Phase 1 — Define SourceConfig Pydantic base class in `apps/backend/app/sources/base.py`
  - **Requirement**: FR-002, FR-010
  - **Acceptance**: (a) SourceConfig class inherits from `pydantic.BaseModel`, (b) has field `source_type: str`, (c) is frozen/immutable (`model_config = ConfigDict(frozen=True)`), (d) serializable to JSON, (e) import succeeds: `from app.sources.base import SourceConfig`

- [x] T-007: Phase 1 — Define SourceMetadata dataclass in `apps/backend/app/sources/base.py`
  - **Requirement**: FR-014
  - **Acceptance**: (a) SourceMetadata defined in base.py, (b) has fields: `source_type: str, display_name: str, description: str, supported_extensions: list[str], requires_config: dict[str, Any] | None`, (c) serializable to dict, (d) import succeeds: `from app.sources.base import SourceMetadata`

- [x] T-008: Phase 1 — Ensure ColumnProfile import does not create circular dependency
  - **Requirement**: FR-001, FR-005
  - **Acceptance**: (a) ColumnProfile can be imported into base.py (check current location in upload_service.py or models), (b) no circular imports detected when importing `from app.sources.base import Source`, (c) document import strategy in code comment if moved or re-exported

- [x] T-009: Phase 1 — Create `apps/backend/app/services/source_registry.py` with SourceRegistry singleton
  - **Requirement**: FR-003, FR-006, FR-009
  - **Acceptance**: (a) File exists, (b) SourceRegistry class is defined, (c) has static method `register(source_class: type[Source]) -> None`, (d) has static method `for_type(source_type: str) -> Source`, (e) has static method `detect_source_type(filename: str) -> str | None`, (f) has static method `list_sources() -> list[SourceMetadata]`, (g) import succeeds: `from app.services.source_registry import SourceRegistry`

- [x] T-010: Phase 1 — Implement SourceRegistry.register() method
  - **Requirement**: FR-003, FR-006
  - **Acceptance**: (a) Method accepts a Source subclass, (b) stores it by source_type (extracted from class metadata or attribute), (c) raises ValueError if duplicate source_type is registered, (d) callable without errors: `SourceRegistry.register(TestSource)`

- [x] T-011: Phase 1 — Implement SourceRegistry.for_type() method
  - **Requirement**: FR-003, FR-006
  - **Acceptance**: (a) Method returns a Source instance for valid source_type, (b) raises KeyError if source_type not found, (c) returns consistent instances for same source_type, (d) callable: `SourceRegistry.for_type("excel")` returns Source

- [x] T-012: Phase 1 — Implement SourceRegistry.detect_source_type() method
  - **Requirement**: FR-003, FR-012
  - **Acceptance**: (a) Returns "excel" for .xlsx, .xlsm, .xlsb, .xls files, (b) returns "csv" for .csv files, (c) returns None or raises ValueError for unsupported extensions, (d) case-insensitive detection, (e) accepts filename and extracts extension correctly

- [x] T-013: Phase 1 — Implement SourceRegistry.list_sources() method
  - **Requirement**: FR-003, FR-014
  - **Acceptance**: (a) Returns `list[SourceMetadata]`, (b) initially returns empty list (before any registration), (c) returns correct metadata after registration, (d) can be serialized to JSON

- [x] T-014: Phase 1 — Add SourceRegistry to `apps/backend/app/sources/__init__.py` exports
  - **Requirement**: FR-009
  - **Acceptance**: (a) `from app.sources import Source, SourceConfig, SourceMetadata` works, (b) alternatively, `from app.services.source_registry import SourceRegistry` is the canonical import (document choice in code)

### Phase 1 Validation Tasks

- [x] T-015: Phase 1 — Create unit tests for Source base class in `apps/backend/tests/test_source_base.py`
  - **Requirement**: FR-001, SC-008
  - **Acceptance**: (a) File exists, (b) tests that Source is abstract and cannot be instantiated directly, (c) tests SourceConfig can be instantiated with valid source_type, (d) tests SourceConfig is immutable, (e) tests post_commit_hook() exists and is callable on a mock Source subclass

- [x] T-016: Phase 1 — Create unit tests for SourceRegistry in `apps/backend/tests/test_source_registry.py`
  - **Requirement**: FR-003, FR-006, SC-004, SC-007
  - **Acceptance**: (a) File exists, (b) tests register(), for_type(), detect_source_type(), list_sources() independently, (c) tests error cases (duplicate registration, missing type, unsupported extension), (d) tests that list_sources() starts empty and populates after registration, (e) all tests pass

- [x] T-017: Phase 1 — Verify no circular imports in foundation layer
  - **Requirement**: FR-010
  - **Acceptance**: (a) Run `python -c "from app.sources.base import Source; from app.services.source_registry import SourceRegistry; print('OK')"` successfully, (b) run `python -m py_compile apps/backend/app/sources/base.py apps/backend/app/services/source_registry.py` without errors, (c) no `ImportError` or `ModuleNotFoundError` raised

- [x] T-018: Phase 1 — Confirm SourceRegistry initialization path (defer actual startup wiring to Phase 4)
  - **Requirement**: FR-006
  - **Acceptance**: (a) Document in code comment where SourceRegistry.register() calls will be added (expected location: `main.py` or `upload_app.py`), (b) no actual startup code written yet (Phase 4 task), (c) SourceRegistry is importable but uninitialized

---

## Phase 2: ExcelSource Refactor (Extract Excel Logic, Backward-Compatibility Validation)

**Duration**: 2-3 days | **Goal**: Move Excel parsing logic into ExcelSource with byte-parity validation

### ExcelSource Implementation Tasks

- [x] T-019: Phase 2 — Create `apps/backend/app/sources/excel_source.py` file
  - **Requirement**: FR-004
  - **Acceptance**: (a) File exists, (b) is importable: `from app.sources.excel_source import ExcelSource, ExcelSourceConfig`

- [x] T-020: Phase 2 — Define ExcelSourceConfig Pydantic model in `excel_source.py`
  - **Requirement**: FR-004, FR-010
  - **Acceptance**: (a) ExcelSourceConfig extends SourceConfig, (b) has field `source_type: str = Field(default="excel", frozen=True)`, (c) has field `filename: str`, (d) has field `file_bytes: bytes`, (e) is serializable to JSON

- [x] T-021: Phase 2 — Implement ExcelSource class inheriting from Source
  - **Requirement**: FR-004
  - **Acceptance**: (a) ExcelSource class is defined, (b) has method `parse(config: ExcelSourceConfig) -> pl.DataFrame`, (c) has method `compute_profiles(df: pl.DataFrame) -> list[ColumnProfile]`, (d) class is concrete (not abstract)

- [x] T-022: Phase 2 — Extract Excel parsing logic from `read_dataframe()` into `ExcelSource.parse()`
  - **Requirement**: FR-004, FR-011, FR-018
  - **Acceptance**: (a) Logic copied verbatim (not refactored) from `read_dataframe()` for .xlsx/.xlsm/.xlsb/.xls files, (b) includes openpyxl → calamine fallback with identical error message: `"openpyxl failed: {exc1}; calamine failed: {exc2}"`, (c) implementation matches plan.md pseudocode, (d) file is compilable and imports successfully

- [x] T-023: Phase 2 — Implement `ExcelSource.compute_profiles()` by reusing existing logic
  - **Requirement**: FR-004
  - **Acceptance**: (a) compute_profiles() delegates to existing `compute_column_profiles()` from upload_service.py (or equivalent), (b) returns identical `list[ColumnProfile]` to current behavior, (c) no new logic introduced

- [x] T-024: Phase 2 — Create baseline snapshot of Excel test files via current `read_dataframe()`
  - **Requirement**: SC-002
  - **Acceptance**: (a) For each Excel test file in `data/parquet/sample-v1/` or equivalent, (b) compute parquet hash using current `read_dataframe()` and save to `apps/backend/tests/fixtures/excel_snapshots.json` (or similar), (c) at least 3 test files: single-sheet, multi-sheet, mixed types, (d) snapshots are deterministic (same input → same hash in CI environment)

- [x] T-025: Phase 2 — Run ExcelSource against test files and compare to baseline snapshots
  - **Requirement**: SC-002, SC-003
  - **Acceptance**: (a) For each Excel test file, call `ExcelSource.parse()` and compute parquet hash, (b) verify hash matches baseline snapshot from T-024, (c) byte-level parity confirmed (not just schema-level), (d) all test files pass comparison

- [x] T-026: Phase 2 — Create unit tests for ExcelSource error handling
  - **Requirement**: FR-018
  - **Acceptance**: (a) Test file `apps/backend/tests/test_excel_source.py` created, (b) tests corrupted Excel file triggers openpyxl exception, (c) tests that fallback to calamine occurs, (d) tests that final error message matches expected format, (e) error handling matches current `read_dataframe()` behavior exactly

- [x] T-027: Phase 2 — Create unit tests for ExcelSource with various sheet types
  - **Requirement**: SC-002
  - **Acceptance**: (a) Tests single-sheet Excel file, (b) tests multi-sheet file (verifies first sheet is used, or behavior matches current), (c) tests Excel file with mixed data types (strings, numbers, dates, booleans), (d) all tests pass

- [x] T-028: Phase 2 — Create unit tests for ExcelSourceConfig serialization
  - **Requirement**: FR-010
  - **Acceptance**: (a) ExcelSourceConfig can be instantiated with valid data, (b) can be serialized to dict/JSON, (c) can be deserialized back, (d) all tests pass

- [x] T-029: Phase 2 — Verify ExcelSource can be registered with SourceRegistry
  - **Requirement**: FR-004, SC-004
  - **Acceptance**: (a) Add registration call: `SourceRegistry.register(ExcelSource)` (not in app startup yet; just in test), (b) call `SourceRegistry.for_type("excel")` and receive ExcelSource instance, (c) instance can call `parse()` method successfully

- [x] T-030: Phase 2 — Verify SourceRegistry.detect_source_type() correctly identifies Excel files
  - **Requirement**: FR-012, SC-004
  - **Acceptance**: (a) `SourceRegistry.detect_source_type("data.xlsx")` returns "excel", (b) `detect_source_type("data.xlsm")` returns "excel", (c) `detect_source_type("data.xls")` returns "excel", (d) `detect_source_type("data.csv")` does NOT return "excel" (returns "csv" or None)

### Phase 2 Validation Tasks

- [x] T-031: Phase 2 — Ensure existing upload tests still pass (no code changes to upload_service.py yet)
  - **Requirement**: FR-007, SC-001
  - **Acceptance**: (a) Run `pytest apps/backend/tests/test_upload_service.py -v`, (b) all tests pass unchanged, (c) no modifications to test code required (old `read_dataframe()` still exists), (d) confirm that ExcelSource exists but is not yet used in orchestration

---

## Phase 3: CSVSource Implementation (Second Concrete Source)

**Duration**: 1-2 days | **Goal**: Move CSV parsing logic into CSVSource with byte-parity validation

### CSVSource Implementation Tasks

- [x] T-032: Phase 3 — Create `apps/backend/app/sources/csv_source.py` file
  - **Requirement**: FR-005
  - **Acceptance**: (a) File exists, (b) is importable: `from app.sources.csv_source import CSVSource, CSVSourceConfig`

- [x] T-033: Phase 3 — Define CSVSourceConfig Pydantic model in `csv_source.py`
  - **Requirement**: FR-005, FR-010
  - **Acceptance**: (a) CSVSourceConfig extends SourceConfig, (b) has field `source_type: str = Field(default="csv", frozen=True)`, (c) has field `filename: str`, (d) has field `file_bytes: bytes`, (e) is serializable to JSON

- [x] T-034: Phase 3 — Implement CSVSource class inheriting from Source
  - **Requirement**: FR-005
  - **Acceptance**: (a) CSVSource class is defined, (b) has method `parse(config: CSVSourceConfig) -> pl.DataFrame`, (c) has method `compute_profiles(df: pl.DataFrame) -> list[ColumnProfile]`, (d) class is concrete (not abstract)

- [x] T-035: Phase 3 — Extract CSV parsing logic from `read_dataframe()` into `CSVSource.parse()`
  - **Requirement**: FR-005, FR-011, FR-018
  - **Acceptance**: (a) Logic copied verbatim from `read_dataframe()` for .csv files, (b) includes current delimiter detection and encoding inference (if any), (c) implementation matches current behavior exactly, (d) file is compilable and imports successfully

- [x] T-036: Phase 3 — Implement `CSVSource.compute_profiles()` by reusing existing logic
  - **Requirement**: FR-005
  - **Acceptance**: (a) compute_profiles() delegates to existing `compute_column_profiles()`, (b) returns identical `list[ColumnProfile]` to current behavior, (c) no new logic introduced

- [x] T-037: Phase 3 — Create baseline snapshot of CSV test files via current `read_dataframe()`
  - **Requirement**: SC-003
  - **Acceptance**: (a) For each CSV test file in `data/parquet/sample-v1/` or equivalent, (b) compute parquet hash using current `read_dataframe()` and save to `apps/backend/tests/fixtures/csv_snapshots.json`, (c) at least 3 test files: simple CSV, quoted fields, various encodings, (d) snapshots are deterministic

- [x] T-038: Phase 3 — Run CSVSource against test files and compare to baseline snapshots
  - **Requirement**: SC-003
  - **Acceptance**: (a) For each CSV test file, call `CSVSource.parse()` and compute parquet hash, (b) verify hash matches baseline snapshot from T-037, (c) byte-level parity confirmed, (d) all test files pass comparison

- [x] T-039: Phase 3 — Create unit tests for CSVSource error handling
  - **Requirement**: FR-018
  - **Acceptance**: (a) Test file `apps/backend/tests/test_csv_source.py` created, (b) tests invalid CSV (e.g., mismatched quotes) triggers appropriate exception, (c) tests error message matches current `read_dataframe()` behavior, (d) edge cases: empty file, single column, special characters

- [x] T-040: Phase 3 — Create unit tests for CSVSource with various delimiters and encodings
  - **Requirement**: SC-003
  - **Acceptance**: (a) Tests standard comma-delimited CSV, (b) tests quoted fields, (c) tests various encodings if current code handles them, (d) all tests pass

- [x] T-041: Phase 3 — Create unit tests for CSVSourceConfig serialization
  - **Requirement**: FR-010
  - **Acceptance**: (a) CSVSourceConfig can be instantiated with valid data, (b) can be serialized to dict/JSON, (c) can be deserialized back, (d) all tests pass

- [x] T-042: Phase 3 — Verify CSVSource can be registered with SourceRegistry
  - **Requirement**: FR-005, SC-004
  - **Acceptance**: (a) Add registration call: `SourceRegistry.register(CSVSource)` in test, (b) call `SourceRegistry.for_type("csv")` and receive CSVSource instance, (c) instance can call `parse()` method successfully

- [x] T-043: Phase 3 — Verify SourceRegistry.detect_source_type() correctly identifies CSV files
  - **Requirement**: FR-012, SC-004
  - **Acceptance**: (a) `SourceRegistry.detect_source_type("data.csv")` returns "csv", (b) `detect_source_type("data.xlsx")` does NOT return "csv", (c) `detect_source_type("data.txt")` returns None or raises error (unsupported extension)

- [x] T-044: Phase 3 — Verify SourceRegistry.list_sources() returns 2 sources after both registered
  - **Requirement**: FR-003, SC-007
  - **Acceptance**: (a) Register both ExcelSource and CSVSource in test setup, (b) call `SourceRegistry.list_sources()`, (c) verify result contains exactly 2 items, (d) verify metadata for both sources is present and correct

### Phase 3 Validation Tasks

- [x] T-045: Phase 3 — Ensure existing upload tests still pass (CSVSource added, orchestration unchanged)
  - **Requirement**: FR-007, SC-001
  - **Acceptance**: (a) Run `pytest apps/backend/tests/test_upload_service.py -v`, (b) all tests pass unchanged, (c) no modifications to test code required (old `read_dataframe()` still exists), (d) confirm that both ExcelSource and CSVSource exist but are not yet used in orchestration

---

## Phase 4: Integration (Wire SourceRegistry into FastAPI App, Update Orchestration)

**Duration**: 2-3 days | **Goal**: Integrate SourceRegistry into upload orchestration and app startup

### Orchestration Refactor Tasks

- [x] T-046: Phase 4 — Modify `apps/backend/app/apps/upload_app.py` to use SourceRegistry for dispatch
  - **Requirement**: FR-007, FR-008, FR-011
  - **Acceptance**: (a) UploadApp imports SourceRegistry, (b) orchestration calls `SourceRegistry.detect_source_type(filename)` instead of inspecting filename directly, (c) orchestration calls `SourceRegistry.for_type(source_type)` to get Source instance, (d) orchestration calls `Source.parse(config)` instead of `read_dataframe()`, (e) UploadResult contract unchanged, (f) file compiles without errors

- [x] T-047: Phase 4 — Create source-specific config objects in orchestration based on file type
  - **Requirement**: FR-002, FR-007
  - **Acceptance**: (a) When source_type is "excel", create `ExcelSourceConfig(filename=..., file_bytes=...)`, (b) when source_type is "csv", create `CSVSourceConfig(filename=..., file_bytes=...)`, (c) raise error if source_type is unsupported, (d) config objects are passed to `Source.parse(config)`

- [x] T-048: Phase 4 — Refactor `Source.compute_profiles()` call to use instance from SourceRegistry
  - **Requirement**: FR-001, FR-007
  - **Acceptance**: (a) After getting Source instance via registry, call `source.compute_profiles(df)`, (b) result is identical to current orchestration behavior, (c) column profiles are persisted unchanged

- [x] T-049: Phase 4 — Wire `Source.post_commit_hook()` call into orchestration after profile computation
  - **Requirement**: FR-008, SC-006
  - **Acceptance**: (a) After UploadResult is fully prepared (parquet written, metadata persisted), call `source.post_commit_hook(workspace_id, source_file_id, columns)`, (b) hook call receives correct workspace_id, source_file_id, and list of ColumnProfile objects, (c) hook completes without error (no-op for this round), (d) upload flow completes successfully regardless of hook result

- [x] T-050: Phase 4 — Update upload endpoint handlers to continue accepting file uploads unchanged
  - **Requirement**: FR-007
  - **Acceptance**: (a) Existing upload endpoint API unchanged (same URL, same request/response schema), (b) internally uses SourceRegistry dispatch, (c) endpoint still accepts Excel and CSV files, (d) endpoint rejects unsupported file types with same error message as before

- [x] T-051: Phase 4 — Initialize SourceRegistry at app startup (FastAPI main.py)
  - **Requirement**: FR-006, FR-016
  - **Acceptance**: (a) In `apps/backend/app/main.py` (or equivalent app startup location), add explicit registration calls: `SourceRegistry.register(ExcelSource)` and `SourceRegistry.register(CSVSource)`, (b) registration happens before first request can be received, (c) app starts without errors, (d) SourceRegistry is populated with exactly 2 sources at startup

- [x] T-052: Phase 4 — Update `apps/backend/app/sources/__init__.py` to export all source classes for registration
  - **Requirement**: FR-009, FR-016
  - **Acceptance**: (a) `from app.sources import ExcelSource, CSVSource` is possible (or equivalent canonical import), (b) alternative: `from app.sources.excel_source import ExcelSource` works, (c) imports work from app startup code

- [x] T-053: Phase 4 — Keep old `read_dataframe()` function in place (do not delete yet) for backward compatibility during testing
  - **Requirement**: FR-007
  - **Acceptance**: (a) `read_dataframe()` remains callable in upload_service.py, (b) existing test code that uses `read_dataframe()` continues to work, (c) will be removed in Phase 5 after full regression validation

- [x] T-054: Phase 4 — Handle error cases: unsupported file types, missing source registration, Source.parse() exceptions
  - **Requirement**: FR-012, FR-018
  - **Acceptance**: (a) If filename extension is unsupported, `detect_source_type()` returns None and orchestration raises clear error message (same as before), (b) if source_type is not registered, `for_type()` raises KeyError with helpful message, (c) if `Source.parse()` raises exception, orchestration catches and re-raises with original error message, (d) error responses to client are identical to pre-refactor behavior

### Integration Test Tasks

- [x] T-055: Phase 4 — Create integration test for ExcelSource dispatch via SourceRegistry in upload flow
  - **Requirement**: FR-007, FR-011, SC-004, SC-005
  - **Acceptance**: (a) Test file `apps/backend/tests/integration/test_upload_flow_with_sources.py` created, (b) upload Excel file via endpoint, (c) verify that orchestration internally uses ExcelSource (can mock or introspect), (d) verify UploadResult is unchanged, (e) test passes

- [x] T-056: Phase 4 — Create integration test for CSVSource dispatch via SourceRegistry in upload flow
  - **Requirement**: FR-007, FR-011, SC-004, SC-005
  - **Acceptance**: (a) Upload CSV file via endpoint, (b) verify that orchestration internally uses CSVSource, (c) verify UploadResult is unchanged, (d) test passes

- [x] T-057: Phase 4 — Create integration test for unsupported file type rejection
  - **Requirement**: FR-012, FR-018
  - **Acceptance**: (a) Attempt to upload .json or .txt file, (b) receive error from detect_source_type(), (c) error message is clear and matches pre-refactor behavior, (d) test passes

- [x] T-058: Phase 4 — Create integration test for Source.post_commit_hook() invocation
  - **Requirement**: FR-008, SC-006
  - **Acceptance**: (a) Upload Excel or CSV file successfully, (b) verify that post_commit_hook() is called with correct parameters (can spy/mock), (c) hook call includes workspace_id, source_file_id, and list of ColumnProfile, (d) hook completion does not break upload flow, (e) test passes

### Phase 4 Validation Tasks

- [x] T-059: Phase 4 — Run full backend test suite and confirm all existing tests pass unchanged
  - **Requirement**: FR-007, SC-001
  - **Acceptance**: (a) Run `pytest apps/backend/tests/ -v`, (b) at least 170 tests execute, (c) zero new test failures introduced by refactoring, (d) pre-refactor tests continue to pass without modification

- [x] T-060: Phase 4 — Verify byte-parity: ExcelSource and CSVSource produce identical output to pre-refactor baseline
  - **Requirement**: SC-002, SC-003
  - **Acceptance**: (a) Run side-by-side comparison of old `read_dataframe()` vs new `ExcelSource.parse()` for all Excel test files, (b) parquet hashes match exactly, (c) same comparison for CSVSource, (d) all test files pass, (e) document results in test output

---

## Phase 5: Validation, Documentation, and Cleanup

**Duration**: 2-3 days | **Goal**: Comprehensive regression testing, CRG analysis, documentation completion, final cleanup

### Backward-Compatibility & Regression Validation Tasks

- [x] T-061: Phase 5 — Run comprehensive byte-parity test suite for all Excel and CSV test files
  - **Requirement**: SC-002, SC-003
  - **Acceptance**: (a) Create test suite that compares parquet output for 10+ Excel files (single-sheet, multi-sheet, mixed types, edge cases), (b) create test suite for 10+ CSV files (various delimiters, encodings, special characters), (c) all tests verify byte-identical output (parquet hash match), (d) tests are deterministic within CI environment, (e) all tests pass

- [x] T-062: Phase 5 — Test error-path byte-parity: error messages and exception types
  - **Requirement**: FR-018
  - **Acceptance**: (a) For corrupted files that trigger exceptions in old code, verify new code produces identical error messages, (b) verify exception types are identical (ValueError vs custom types), (c) verify error context is preserved, (d) test both ExcelSource and CSVSource error cases, (e) all tests pass

- [x] T-063: Phase 5 — Run CRG (circular reference graph) or equivalent static analysis
  - **Requirement**: FR-010, SC-010
  - **Acceptance**: (a) Use CRG or manual import graph inspection to detect circular imports, (b) verify no circular dependencies introduced by Source subclasses, (c) SourceRegistry does not create import-time cycles, (d) result documented in research.md or test output, (e) zero new coupling hotspots introduced

- [x] T-064: Phase 5 — Verify SourceRegistry introspection: list_sources() returns correct metadata
  - **Requirement**: FR-014, SC-007
  - **Acceptance**: (a) Call `SourceRegistry.list_sources()`, (b) verify result is list of 2 SourceMetadata objects, (c) verify first item: source_type="excel", display_name contains "Excel", supported_extensions includes ".xlsx", (d) verify second item: source_type="csv", display_name contains "CSV", supported_extensions includes ".csv", (e) verify result is JSON-serializable

- [x] T-065: Phase 5 — Test stub DatabaseSource registration (proof that new sources don't require editing orchestration)
  - **Requirement**: FR-015, SC-005
  - **Acceptance**: (a) Create a simple DatabaseSourceConfig and stub DatabaseSource in test code (not in production), (b) register via `SourceRegistry.register(DatabaseSource)`, (c) retrieve via `SourceRegistry.for_type("database")`, (d) verify SourceRegistry.list_sources() returns 3 items, (e) verify that orchestration code (upload_app.py) does NOT need modification to support this stub source, (f) test passes

### Documentation Completion Tasks

- [x] T-066: Phase 5 — Finalize `research.md` with decision justifications and hg_code pattern analysis
  - **Requirement**: SC-008
  - **Acceptance**: (a) `research.md` includes section: "Decision D: Source/SourceRegistry location rationale", (b) includes section: "hg_code Pattern Comparison", (c) includes section: "Circular Import Mitigation Strategy", (d) includes section: "Backward Compatibility Validation Strategy", (e) includes section: "Error Handling Preservation Approach", (f) each decision is linked to spec requirements

- [x] T-067: Phase 5 — Finalize `data-model.md` with complete entity diagrams and relationships
  - **Requirement**: SC-008
  - **Acceptance**: (a) `data-model.md` includes Mermaid or ASCII diagrams for: Source (abstract), SourceConfig hierarchy, ExcelSource, CSVSource, SourceRegistry, SourceMetadata, (b) relationships clearly labeled: inheritance (Source ← ExcelSource), composition (SourceRegistry contains Source instances), (c) method signatures documented for each class, (d) file is clear and could be used as developer reference

- [x] T-068: Phase 5 — Finalize `quickstart.md` with concrete walkthrough of adding a new Source type
  - **Requirement**: SC-008, FR-015
  - **Acceptance**: (a) `quickstart.md` includes section: "Adding a New Source Type", (b) step-by-step walkthrough to create DatabaseSource (or similar), (c) walkthrough includes: define DatabaseSourceConfig, implement DatabaseSource.parse() and compute_profiles(), register with SourceRegistry, (d) walkthrough explicitly states that upload_app.py and endpoint code do NOT need modification, (e) includes code example snippets, (f) sufficient detail that a developer can add a new source without trial-and-error

- [x] T-069: Phase 5 — Create `contracts/` directory with interface contracts (optional)
  - **Requirement**: SC-008
  - **Acceptance**: (a) Create `specs/010-source-provider-abstraction/contracts/` directory, (b) create `source_interface.md` or equivalent with Source method signatures and contracts (parse(), compute_profiles(), post_commit_hook()), (c) create `sourceconfig_interface.md` with SourceConfig Pydantic model schema, (d) create `sourceregistry_interface.md` with SourceRegistry method signatures, (e) contracts include expected exception types and error messages (optional, for clarity)

### Final Cleanup and Verification Tasks

- [x] T-070: Phase 5 — Remove or deprecate old `read_dataframe()` function from upload_service.py
  - **Requirement**: FR-007, FR-011
  - **Acceptance**: (a) Search for uses of `read_dataframe()` in production code (upload_app.py, endpoints), (b) verify all uses are replaced with SourceRegistry dispatch, (c) remove `read_dataframe()` function definition, (d) verify orchestration code no longer imports or references it, (e) backend tests still pass after removal (tests should not be modified; they should work with new code)

- [x] T-071: Phase 5 — Update any internal documentation or developer notes referencing old upload flow
  - **Requirement**: SC-008
  - **Acceptance**: (a) Search `docs/development/` or similar for upload flow documentation, (b) update to reference new SourceRegistry-based approach, (c) no references to direct `read_dataframe()` calls in developer docs, (d) links to quickstart.md for adding new sources

- [x] T-072: Phase 5 — Final verification: Run full backend test suite with zero modifications
  - **Requirement**: SC-001
  - **Acceptance**: (a) Run `pytest apps/backend/tests/ -v --tb=short`, (b) at least 170 tests pass, (c) zero failures, (d) zero errors, (e) generate test summary showing test count and pass rate

- [x] T-073: Phase 5 — Verify app startup and basic health check
  - **Requirement**: FR-006, FR-016
  - **Acceptance**: (a) Start backend app with: `python apps/backend/main.py` or equivalent, (b) app initializes SourceRegistry without errors, (c) health check endpoint returns 200 OK, (d) SourceRegistry is accessible from app context, (e) no startup failures or warnings

- [x] T-074: Phase 5 — Verify that no new circular imports are introduced in overall codebase
  - **Requirement**: SC-010
  - **Acceptance**: (a) Run Python import checker: `python -m py_compile apps/backend/app/sources/ apps/backend/app/services/source_registry.py`, (b) no compilation errors, (c) run `python -c "import sys; sys.path.insert(0, 'apps/backend'); from app.main import app; print('OK')"`, (d) app imports successfully without circular import errors

---

## Task Summary

| Phase       | Task Range     | Count  | Duration       | Focus                                                |
| ----------- | -------------- | ------ | -------------- | ---------------------------------------------------- |
| **Phase 1** | T-001 to T-018 | 18     | 1-2 days       | Foundation (Source, SourceConfig, SourceRegistry)    |
| **Phase 2** | T-019 to T-031 | 13     | 2-3 days       | ExcelSource + backward-compatibility validation      |
| **Phase 3** | T-032 to T-045 | 14     | 1-2 days       | CSVSource + byte-parity testing                      |
| **Phase 4** | T-046 to T-060 | 15     | 2-3 days       | Integration with FastAPI app and orchestration       |
| **Phase 5** | T-061 to T-074 | 14     | 2-3 days       | Comprehensive regression testing, CRG, documentation |
| **TOTAL**   | T-001 to T-074 | **74** | **10-16 days** | Full feature delivery                                |

---

## Dependency Graph

```
Phase 1 (Foundation)
  ├─ T-001–T-003: Research & Docs (parallel)
  ├─ T-004–T-014: Foundation Classes (sequential dependencies: T-004 → T-005–T-007 → T-008–T-014)
  └─ T-015–T-018: Validation (depends on T-004–T-014)
       ↓
Phase 2 (ExcelSource)
  ├─ T-019–T-030: ExcelSource Implementation (sequential: T-019 → T-020–T-021 → T-022–T-030)
  └─ T-031: Regression Check (depends on T-019–T-030)
       ↓
Phase 3 (CSVSource)
  ├─ T-032–T-044: CSVSource Implementation (sequential: T-032 → T-033–T-034 → T-035–T-044)
  └─ T-045: Regression Check (depends on T-032–T-044)
       ↓
Phase 4 (Integration)
  ├─ T-046–T-054: Orchestration Refactor (sequential: T-046 → T-047–T-049 → T-050–T-054)
  ├─ T-055–T-058: Integration Tests (depends on T-046–T-054)
  └─ T-059–T-060: Validation (depends on all Phase 4 tasks)
       ↓
Phase 5 (Validation & Documentation)
  ├─ T-061–T-065: Regression & Extensibility Tests (parallel)
  ├─ T-066–T-069: Documentation (parallel)
  ├─ T-070–T-071: Cleanup (sequential)
  └─ T-072–T-074: Final Verification (depends on T-070–T-071)
```

---

## Acceptance Evidence Checklist

For each task marked complete, verify the corresponding evidence:

- **T-001 to T-003**: Documents exist and are readable
- **T-004 to T-008**: Files created; imports succeed; no errors
- **T-009 to T-014**: SourceRegistry methods defined; unit tests pass
- **T-015 to T-018**: Tests execute; no circular imports detected
- **T-019 to T-030**: ExcelSource implemented; byte-parity tests pass
- **T-031**: Existing upload tests pass unchanged
- **T-032 to T-044**: CSVSource implemented; byte-parity tests pass
- **T-045**: Existing upload tests pass unchanged
- **T-046 to T-058**: Orchestration refactored; integration tests pass; API unchanged
- **T-059 to T-060**: Full test suite passes; byte-parity confirmed
- **T-061 to T-065**: Comprehensive regression tests pass; CRG clean; extensibility proven
- **T-066 to T-069**: Documentation complete and clear
- **T-070 to T-074**: Old code removed; app starts; final tests pass

---

## Notes

- **Parallelization opportunities**:
  - Phase 1: Research (T-001–T-003) can run in parallel with foundation implementation (T-004–T-014)
  - Phase 2 & 3: Snapshot baseline creation (T-024, T-037) can run in parallel while implementation continues
  - Phase 5: Regression tests (T-061–T-065) and documentation (T-066–T-069) can run in parallel

- **Decision Gates Locked** (Spec 010):
  - Gate A: No YAML descriptor loading (verified in T-001, T-016)
  - Gate B: Post-commit hook pre-staged only (verified in T-049, T-058)
  - Gate C: Excel + CSV sources only (verified in T-030, T-043, T-044)
  - Gate D: Synchronous service layer (no async added; verified throughout)

- **Scope Constraints Maintained**:
  - No YAML auto-discovery (T-001, T-051)
  - No fuzzy-matcher implementation (T-049 pre-stages hook; actual matcher deferred)
  - No new source types beyond Excel + CSV (verified in T-065 via stub test)
  - Service layer remains synchronous (no async/await added)

---

## Specification Traceability

| Requirement                                              | Tasks                      | Status  |
| -------------------------------------------------------- | -------------------------- | ------- |
| **FR-001** (Source base class)                           | T-005, T-015, T-021        | Covered |
| **FR-002** (SourceConfig extensibility)                  | T-006, T-020, T-033        | Covered |
| **FR-003** (SourceRegistry dispatch)                     | T-009–T-014, T-016         | Covered |
| **FR-004** (ExcelSource)                                 | T-019–T-030                | Covered |
| **FR-005** (CSVSource)                                   | T-032–T-044                | Covered |
| **FR-006** (SourceRegistry singleton)                    | T-009, T-051               | Covered |
| **FR-007** (orchestration refactor)                      | T-046–T-050, T-053–T-054   | Covered |
| **FR-008** (post_commit_hook)                            | T-005, T-049, T-058        | Covered |
| **FR-009** (canonical location)                          | T-009, T-014, T-052        | Covered |
| **FR-010** (SourceConfig immutable/serializable)         | T-006, T-028, T-041        | Covered |
| **FR-011** (no source-specific imports in orchestration) | T-046–T-047, T-070         | Covered |
| **FR-012** (detect_source_type)                          | T-012, T-030, T-043        | Covered |
| **FR-013** (tests pass unchanged)                        | T-031, T-045, T-059, T-072 | Covered |
| **FR-014** (SourceMetadata)                              | T-007, T-013               | Covered |
| **FR-015** (extensibility without edits)                 | T-065                      | Covered |
| **FR-016** (no YAML descriptors)                         | T-001, T-051               | Covered |
| **FR-017** (UploadResult unchanged)                      | T-046, T-050, T-056        | Covered |
| **FR-018** (error preservation)                          | T-026, T-039, T-054, T-062 | Covered |
| **SC-001** (no new failures)                             | T-031, T-045, T-059, T-072 | Covered |
| **SC-002** (Excel byte-parity)                           | T-024–T-025, T-061         | Covered |
| **SC-003** (CSV byte-parity)                             | T-037–T-038, T-061         | Covered |
| **SC-004** (SourceRegistry dispatch)                     | T-029, T-042, T-055–T-056  | Covered |
| **SC-005** (new source without edits)                    | T-065                      | Covered |
| **SC-006** (post_commit_hook called)                     | T-049, T-058               | Covered |
| **SC-007** (list_sources returns 2)                      | T-013, T-044               | Covered |
| **SC-008** (documentation clear)                         | T-001–T-003, T-066–T-069   | Covered |
| **SC-009** (no scattered logic)                          | T-046–T-047, T-070         | Covered |
| **SC-010** (no circular imports)                         | T-017, T-063, T-074        | Covered |

---

## Related Artifacts

- **Specification**: [spec.md](spec.md)
- **Implementation Plan**: [plan.md](plan.md)
- **Research & Decisions**: [research.md](research.md) (Phase 1 deliverable)
- **Data Model & Entities**: [data-model.md](data-model.md) (Phase 1 deliverable)
- **Developer Quickstart**: [quickstart.md](quickstart.md) (Phase 5 deliverable)
- **Interface Contracts**: [contracts/](contracts/) (Phase 5 deliverable, optional)

---

**Ready for `/speckit.implement`**: All tasks are actionable and independently verifiable. Proceed with Phase 1 (Foundation).
