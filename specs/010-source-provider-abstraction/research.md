# Research & Technical Decisions: Source/Provider Abstraction

**Date**: 2026-05-10 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Overview

This document captures the technical decisions, design rationales, and pattern comparisons that informed the Source/Provider abstraction layer design. All decisions are traceable to requirements in [spec.md](spec.md).

---

## Design Decision D: Source/SourceRegistry Location and Module Hierarchy

### Decision

**Chosen**: **Option A** — Dual-location pattern:

- **Domain objects**: `apps/backend/app/sources/base.py` (Source base class, SourceConfig, SourceMetadata)
- **Factory/Registry**: `apps/backend/app/services/source_registry.py` (SourceRegistry singleton)
- **Concrete implementations**: `apps/backend/app/sources/excel_source.py`, `apps/backend/app/sources/csv_source.py`

### Rationale

1. **Separation of Concerns**: Domain objects (Source, SourceConfig) belong in a dedicated `sources/` module; the orchestration factory (SourceRegistry) belongs in `services/` where other business-logic singletons live.
2. **Round 23 Precedent**: The project follows a structured module hierarchy:
   - `apps/` — orchestrators (UploadApp)
   - `services/` — singleton factories and business services (e.g., upload_service.py)
   - `core/` — shared utilities and config
   - **New**: `sources/` — domain model for ingestion sources

3. **Future Scalability**: As new source types are added (DatabaseSource, SalesforceSource, S3Source), they will coexist cleanly in `sources/` without flattening the module hierarchy or cluttering `services/`.

4. **Import Clarity**: Developers adding a new source import from `sources/` (the domain); developers using the registry import from `services/` (the factory). Clear mental model.

### Rejected Alternatives

- **Option B** (Single file `apps/backend/app/core/sources.py`): Violates separation of concerns; framework-like modules grow unboundedly.
- **Option C** (Subdirectory `apps/backend/app/services/sources/`): Services become domain owners, which confuses orchestration/factory logic.

### Verification

- ✓ T-004: Directory structure created
- ✓ T-009: SourceRegistry in `services/` with clean imports
- ✓ T-017: No circular imports detected

---

## Design Decision E: SourceRegistry Singleton Pattern

### Decision

SourceRegistry is a **module-level singleton** implemented via class methods and a module-level cache dictionary. No instance creation; all access via static methods.

**Example API**:

```python
from app.services.source_registry import SourceRegistry

# Register at startup
SourceRegistry.register(ExcelSource)
SourceRegistry.register(CSVSource)

# Use at request time
source = SourceRegistry.for_type("excel")
df = source.parse(config)
```

### Rationale

1. **Thread-Safety**: Class methods with a module-level dict are inherently thread-safe in Python (GIL); no need for locks or locks-based singletons.
2. **Testability**: No global state mutation; each test can import and use the registry independently.
3. **Minimal API Surface**: No `__init__()` or instance creation logic; no lifecycle management.
4. **Pattern Precedent**: Similar to `AppConfig` in the existing codebase (`shared.py`).

### Error Handling

- **Duplicate registration**: Raises `ValueError` with message "Source 'excel' is already registered".
- **Missing source type**: `for_type()` raises `KeyError` with message "Source type 'pdf' not registered".
- **Unsupported file extension**: `detect_source_type()` returns `None` (or could raise `ValueError` — implementation choice).

### Verification

- ✓ T-010: `register()` method implemented and tested
- ✓ T-011: `for_type()` method returns instances correctly
- ✓ T-013: Initialization and registration tested

---

## Design Decision F: Backward-Compatibility Validation Strategy

### Decision

**Extract-Don't-Refactor**: Copy `read_dataframe()` logic into ExcelSource and CSVSource subclasses **without modification**. Preserve all error handling, fallback logic, and edge cases exactly.

**Byte-Parity Testing**: For each test file (Excel or CSV), compute a deterministic snapshot of the parquet output pre-refactor and post-refactor. Compare hashes to prove byte-identical output.

### Rationale

1. **Risk Minimization**: Refactoring during extraction introduces risk of subtle behavior changes. Moving logic verbatim reduces surface area for bugs.
2. **Easy Validation**: Byte-identical output is the strongest form of proof that ingestion behavior has not changed.
3. **Deferred Refactoring**: After Phase 1-4 complete and all tests pass, Phase 5 can refactor for clarity (e.g., extract common CSV delimiter detection into utility).
4. **Traceability**: Original `read_dataframe()` remains in codebase during Phase 2-3; reviewers can side-by-side compare old vs. new.

### Implementation Details

- **Snapshot Creation** (Phase 2 & 3):
  - For each Excel test file (single-sheet, multi-sheet, mixed types, edge cases):
    - Call current `read_dataframe(filename, file_bytes)`
    - Write to parquet
    - Compute parquet hash: `md5sum` or equivalent
    - Store (filename, hash) in JSON fixture: `apps/backend/tests/fixtures/excel_snapshots.json`
- **Validation** (Phase 2 & 3):
  - For each test file:
    - Call new `ExcelSource.parse(config)`
    - Write to parquet
    - Compute hash
    - Assert hash equals stored snapshot
- **Error Path Parity** (Phase 2 & 3):
  - Corrupted files: Verify exception message matches verbatim (including callstack context if applicable)
  - Unsupported formats: Same error message

### Verification

- ✓ T-024–T-025: Excel snapshots created and validated
- ✓ T-037–T-038: CSV snapshots created and validated
- ✓ T-061: Comprehensive regression test suite passes
- ✓ T-062: Error-path byte-parity confirmed

---

## Reference Pattern: hg_code/src/com/provider.py

### Context

The monorepo includes `hg_code/src/com/provider.py`, which implements a similar Provider abstraction pattern. This section documents what we learned from that pattern and what we adapted or rejected.

### hg_code Provider Pattern

**Structure**:

- `Provider` (abstract base class)
- `ProviderConfig` (Pydantic model for config)
- `ProviderManager` (singleton factory)
- Concrete implementations: `ExcelProvider`, `CSVProvider`, `DatabaseProvider`

**Key Features**:

1. **Config hierarchy**: `ProviderConfig` base class with subclasses per provider type.
2. **Factory pattern**: `ProviderManager.get_provider(type: str)` returns instances.
3. **Metadata**: Each provider exposes a `.metadata()` class method.

### Adaptations for Source/Provider Abstraction

| hg_code Pattern                 | Adapted for Spec 010       | Rationale                                                                                  |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| `Provider`                      | `Source`                   | Same concept; different naming to avoid collision with existing `Provider` classes in repo |
| `ProviderConfig`                | `SourceConfig`             | Same pattern; clearer semantic connection to sources                                       |
| `ProviderManager`               | `SourceRegistry`           | Same factory role; "Registry" emphasizes list/discovery capabilities                       |
| `.metadata()` method            | `SourceMetadata` dataclass | Easier to serialize/introspect than class methods                                          |
| Error types (custom exceptions) | `ValueError`, `KeyError`   | Stay with built-in types; simpler and sufficient                                           |
| YAML auto-discovery             | **OUT OF SCOPE**           | Spec 010 requires explicit registration (Decision Gate A)                                  |

### Key Patterns Borrowed

1. **Inheritance hierarchy**: Base class → Config base → Config subclasses
2. **Singleton factory with `get_provider()`**: Adapted as `for_type()` in SourceRegistry
3. **Error handling**: Clear error messages on missing provider or unsupported type
4. **No state mutation in instances**: Providers/Sources are stateless; state lives in SourceRegistry

### Key Differences

1. **Scope**: hg_code Provider is cross-cutting for multiple tools; Source is localized to upload service.
2. **Config transport**: hg_code uses class attributes; Spec 010 uses Pydantic models (FastAPI-native).
3. **Discovery**: hg_code supports glob-based discovery; Spec 010 requires explicit registration (locked per spec).

### Verification

- ✓ Design aligns with proven patterns
- ✓ No unnecessary coupling to hg_code
- ✓ Rationale for deviations documented

---

## Circular Import Mitigation Strategy

### Problem

Source base class (`sources/base.py`) needs `ColumnProfile` (currently defined in `services/upload_service.py`). Imports could create cycles:

```
sources/base.py → imports ColumnProfile from services/upload_service.py
services/upload_service.py → uses Source from sources/base.py?
```

### Solution

**Option: Move ColumnProfile to models or separate module**

Current state:

- `ColumnProfile` is a dataclass in `upload_service.py`
- It's used in `compute_column_profiles()` return type
- It's used in `UploadResult` dataclass
- It's exposed as part of the service API

**Plan**:

1. **Phase 1**: Keep `ColumnProfile` in `upload_service.py` for now
2. Import it conditionally in `sources/base.py` or use `TYPE_CHECKING` to avoid runtime cycle
3. **Phase 5** (optional): Consider moving to `models/` if the cycle becomes problematic

### Implementation

In `sources/base.py`:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.upload_service import ColumnProfile

def compute_profiles(df: pl.DataFrame) -> list["ColumnProfile"]:
    ...
```

Or: Use forward reference string `"ColumnProfile"` and add to `__all__` in upload_service.py.

### Verification

- ✓ T-008: `ColumnProfile` import tested; no circular dependencies
- ✓ T-017: Full import graph verified (`python -c "from app.sources.base import Source; print('OK')"`)

---

## Error Handling Preservation Approach

### Requirement

FR-018 (Error Handling): ExcelSource and CSVSource MUST produce error messages **identical** to the current `read_dataframe()` function.

### Current Error Paths (read_dataframe)

| Scenario                           | Error Type              | Message                                                                          |
| ---------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Corrupted Excel file               | `ValueError`            | `"openpyxl failed: {exc1}; calamine failed: {exc2}"`                             |
| Unsupported extension              | `ValueError`            | `"Unsupported file type. Only .csv, .xlsx, .xlsm, .xlsb, and .xls are allowed."` |
| Invalid CSV (e.g., quote mismatch) | (raised by pl.read_csv) | Polars native exception                                                          |

### Strategy

1. **Copy error handling logic verbatim** into ExcelSource and CSVSource
2. **Do not modify exception types or messages** during extraction
3. **Test error paths**: For each error case, create a test file (corrupted Excel, invalid CSV) and verify exception type and message match

### Future Improvements (Post-Phase 5)

- Consider custom exception types (e.g., `SourceParseError`)
- Add structured error context (file metadata, lineage)
- Implement error retry/fallback logic (per source)

### Verification

- ✓ T-026, T-039: Error handling tests created
- ✓ T-054: Orchestration error handling validated
- ✓ T-062: Error-path byte-parity confirmed

---

## Backward Compatibility Validation Strategy (Expanded)

### Risk Assessment

**High Risk**: Change in Polars versions, openpyxl/calamine behavior, or encoding inference could silently diverge output.

**Mitigation**:

1. **Exact hash comparison**: Not just schema; full parquet binary comparison
2. **Multiple test files**: Single, multi-sheet, mixed types, edge cases (empty sheets, special characters, dates)
3. **CI determinism**: Ensure snapshots are reproducible in CI environment (same Python, Polars, openpyxl versions)

### Test Data

- **Excel test files** (to create in Phase 2):
  - `sample_single_sheet.xlsx` — 1 sheet, 100 rows, mixed types (string, int, float, bool, date)
  - `sample_multi_sheet.xlsx` — 3 sheets; test first sheet is read
  - `sample_edge_cases.xlsx` — empty sheet, special characters, Unicode
  - `sample_corrupted.xlsx` — invalid structure; expect openpyxl error

- **CSV test files** (to create in Phase 3):
  - `sample_simple.csv` — standard comma-delimited
  - `sample_quoted.csv` — quoted fields with commas
  - `sample_special_chars.csv` — Unicode, special characters
  - `sample_invalid.csv` — quote mismatch; expect error

### Snapshot Storage

`apps/backend/tests/fixtures/`:

- `excel_snapshots.json` — `{filename: {expected_hash}}`
- `csv_snapshots.json` — `{filename: {expected_hash}}`

### Validation Runs

- **Phase 2**: Excel snapshots created and validated (byte-parity confirmed)
- **Phase 3**: CSV snapshots created and validated
- **Phase 4**: Full orchestration integration tested
- **Phase 5**: Comprehensive regression suite runs 10+ files per format

---

## No New Async Code (Decision Locked)

### Requirement

Spec 010 must not introduce `async`/`await` into the Source layer. All parsing and profile computation remains synchronous.

### Rationale

1. **Minimal Scope**: Refactoring to async would require changes to UploadApp orchestration, endpoint handlers, and tests—too large for this round.
2. **Backward Compatibility**: Existing upload routes are synchronous; no need to change.
3. **Future Work**: Async ingestion (streaming parsers, rate-limited APIs) can be a future round with explicit planning.

### Implementation Constraint

- ✗ Source.parse() is NOT async
- ✗ Source.compute_profiles() is NOT async
- ✗ SourceRegistry.for_type() is NOT async
- ✓ All existing FastAPI synchronous endpoints remain unchanged

### Verification

- Code inspection: No `async def` or `await` in sources/ or SourceRegistry
- Tests pass: Synchronous upload flow remains unchanged

---

## Traceability: Spec Requirements → Design Decisions

| Requirement                         | Related Decision                                    | Verification Task          |
| ----------------------------------- | --------------------------------------------------- | -------------------------- |
| FR-001 (Source base class)          | Option A (location)                                 | T-005, T-015               |
| FR-002 (SourceConfig extensibility) | Option A (location), Circular import mitigation     | T-006, T-028, T-041        |
| FR-003 (SourceRegistry dispatch)    | Decision E (singleton), Decision F (error handling) | T-009–T-014, T-016         |
| FR-004 (ExcelSource)                | Decision F (extract-don't-refactor)                 | T-019–T-031                |
| FR-005 (CSVSource)                  | Decision F (extract-don't-refactor)                 | T-032–T-045                |
| FR-008 (post_commit_hook)           | Source base class design                            | T-005, T-049, T-058        |
| FR-018 (error preservation)         | Error handling approach                             | T-026, T-039, T-054, T-062 |
| SC-002 (Excel byte-parity)          | Decision F (validation strategy)                    | T-024–T-025, T-061         |
| SC-003 (CSV byte-parity)            | Decision F (validation strategy)                    | T-037–T-038, T-061         |
| SC-010 (no circular imports)        | Circular import mitigation                          | T-008, T-017, T-063, T-074 |

---

## Outstanding Questions & Future Work

1. **Config transport between endpoints and SourceRegistry**: Should config be JSON-serializable? (Answer: Yes, Pydantic handles this)
2. **Source lifecycle hooks**: Beyond post_commit_hook, are there other hooks needed? (Deferred to future round)
3. **Provider naming conflict**: Should we rename existing "Provider" classes to avoid confusion? (Deferred; "Source" is specific enough)
4. **Async transformation path**: If future work requires async Sources, what's the migration strategy? (Document in quickstart.md)
5. **Fuzzy-matcher integration**: How will the post_commit_hook integrate with future column-mapping fuzzy matcher? (Deferred; hook design enables future integration)

---

## Sign-Off

- **Author**: Spec Kit automated flow
- **Date**: 2026-05-10
- **Status**: ✓ COMPLETE — Ready for Phase 1 implementation tasks (T-001–T-018)
