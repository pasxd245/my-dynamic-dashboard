# Quick Start: Adding a New Source Type

**Date**: 2026-05-10 | **Spec**: [spec.md](spec.md) | **Data Model**: [data-model.md](data-model.md)

---

## Overview

This document provides a step-by-step walkthrough for adding a new data source type to the upload system without modifying orchestration code. It demonstrates the power of the Source/Provider abstraction.

**Key Principle**: Once SourceRegistry is wired into FastAPI startup and orchestration, adding a new source requires ONLY:

1. Define a new SourceConfig subclass
2. Implement a new Source subclass
3. Register it at startup

No changes to `app/api/upload.py` or endpoint code needed.

---

## Example: Adding a DatabaseSource (Stub Walkthrough)

### Step 1: Create the Config Model

**File**: `apps/backend/app/sources/database_source.py`

```python
from pydantic import BaseModel, ConfigDict, Field

from app.sources.base import SourceConfig

class DatabaseSourceConfig(SourceConfig):
    """Configuration for SQL database sources."""

    source_type: str = Field(default="database", frozen=True)
    connection_string: str  # e.g., "postgresql://user:pass@host/db"
    query: str              # e.g., "SELECT * FROM users"
    timeout_seconds: int = 30
```

### Step 2: Implement the Source Class

**File**: `apps/backend/app/sources/database_source.py` (append)

```python
import polars as pl
from sqlalchemy import create_engine, text

from app.services.upload_service import ColumnProfile
from app.sources.base import Source, SourceMetadata

class DatabaseSource(Source):
    """Source implementation for SQL databases via SQLAlchemy."""

    def parse(self, config: DatabaseSourceConfig) -> pl.DataFrame:
        """
        Execute query against database and return DataFrame.

        Args:
            config: DatabaseSourceConfig with connection_string and query

        Returns:
            Polars DataFrame containing query results

        Raises:
            ValueError: If connection fails or query is invalid
        """
        try:
            engine = create_engine(config.connection_string, connect_args={"timeout": config.timeout_seconds})
            with engine.connect() as conn:
                result = conn.execute(text(config.query))
                # Convert to pandas then polars (simplest path)
                df = pl.from_pandas(pd.DataFrame(result.fetchall(), columns=result.keys()))
            return df
        except Exception as e:
            raise ValueError(f"Database query failed: {e}") from e

    def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
        """
        Compute column profiles for database result.

        Args:
            df: Polars DataFrame

        Returns:
            List of ColumnProfile for each column
        """
        from app.services.upload_service import compute_column_profiles
        return compute_column_profiles(df)

    @classmethod
    def get_metadata(cls) -> SourceMetadata:
        """Return metadata for this source type."""
        return SourceMetadata(
            source_type="database",
            display_name="SQL Database",
            description="Query data from SQL databases (PostgreSQL, MySQL, SQLite, etc.)",
            supported_extensions=[],  # Not file-based
            requires_config={
                "connection_string": "str",
                "query": "str",
                "timeout_seconds": "int (optional)"
            }
        )
```

### Step 3: Register at Startup

**File**: `apps/backend/app/main.py` (modify existing startup)

```python
from app.sources import ExcelSource, CSVSource
from app.sources.database_source import DatabaseSource  # NEW
from app.services.source_registry import SourceRegistry

# In app startup (FastAPI lifespan or @app.on_event):
SourceRegistry.register_builtin_sources()
SourceRegistry.register(DatabaseSource)  # NEW
```

### Step 4: Verify

**In a test or REPL**:

```python
from app.services.source_registry import SourceRegistry

# Check that it's registered
assert len(SourceRegistry.list_sources()) == 3  # Excel, CSV, Database

# Retrieve it
db_source = SourceRegistry.for_type("database")
assert db_source is not None

# Use it
config = DatabaseSourceConfig(
    connection_string="postgresql://localhost/mydb",
    query="SELECT * FROM users"
)
df = db_source.parse(config)
```

**That's it!** No changes to orchestration code required.

---

## Key Points

1. **Config First**: Start with the Pydantic SourceConfig subclass. It defines what parameters your source needs.

2. **Implement Source Methods**: Implement `parse()` to read data and `compute_profiles()` to analyze columns.

3. **Error Handling**: Follow existing patterns (e.g., ExcelSource fallback logic). Preserve error messages for consistency.

4. **Registration**: Add a one-line `SourceRegistry.register(YourSource)` near startup/bootstrap, alongside `register_builtin_sources()`.

5. **No Orchestration Changes**: `app/api/upload.py`, endpoints, and upload flows continue unchanged. The registry handles dispatch.

---

## Registration Pattern (Phase 1 Draft)

The actual registration location will be finalized in Phase 4 (T-051). For now, here's the expected pattern:

**Option A** (Preferred): In `apps/backend/app/main.py` or app factory

```python
def create_app() -> FastAPI:
    app = FastAPI(...)

    # Register sources at startup
    from app.sources import ExcelSource, CSVSource
    from app.services.source_registry import SourceRegistry

    SourceRegistry.register_builtin_sources()

    return app
```

**Option B**: In a dispatch helper close to `app/services/upload_service.py`

```python
def parse_dataframe_via_source_registry(filename: str, file_bytes: bytes):
    SourceRegistry.register_builtin_sources()
    source_type = SourceRegistry.detect_source_type(filename)
    source = SourceRegistry.for_type(source_type)
    ...
```

---

## Architecture Diagram: Registration & Dispatch

```mermaid
sequenceDiagram
    participant FastAPI App Startup
    participant SourceRegistry
    participant Source Types
    participant Upload Endpoint

    FastAPI App Startup->>SourceRegistry: register_builtin_sources()
    FastAPI App Startup->>SourceRegistry: register(DatabaseSource)
    SourceRegistry-->>FastAPI App Startup: OK

    Note over SourceRegistry: Registry now has 3 sources

    Upload Endpoint->>SourceRegistry: detect_source_type("data.xlsx")
    SourceRegistry-->>Upload Endpoint: "excel"

    Upload Endpoint->>SourceRegistry: for_type("excel")
    SourceRegistry-->>Upload Endpoint: ExcelSource instance

    Upload Endpoint->>Source Types: parse(config)
    Source Types-->>Upload Endpoint: DataFrame
```

---

## Extensibility Without Scatter

### Before (Without Source Abstraction)

Adding a new source type required changes across multiple files:

```
1. Define parser function in upload_service.py
2. Update read_dataframe() to branch on file type
3. Update orchestration logic in app/api/upload.py to call new parser
4. Update endpoint request validation to accept new file type
5. Update tests to include new file type
```

**Result**: Edits scattered across 5+ files. High risk of missed cases.

### After (With Source Abstraction)

Adding a new source type requires changes in only ONE new file:

```
1. Create new file: sources/<new_type>_source.py
   - Define Config subclass
   - Implement Source subclass
   - Register in startup

2. No changes to app/api/upload.py ✓
3. No changes to endpoints ✓
4. No changes to existing tests ✓
```

**Result**: Edits localized to one file. Low risk of cascading failures.

---

## Testing a New Source (Phase 1 Outline Only)

Full testing walkthrough will be added in Phase 5 (T-068). For now, here's the skeleton:

```python
# tests/test_database_source.py

import pytest
from app.sources.database_source import DatabaseSource, DatabaseSourceConfig
from app.services.source_registry import SourceRegistry

def test_database_source_registration():
    """Verify DatabaseSource can be registered."""
    SourceRegistry.register(DatabaseSource)
    assert len(SourceRegistry.list_sources()) >= 3  # At least Excel, CSV, Database

def test_database_source_parse():
    """Verify DatabaseSource can parse a query result."""
    config = DatabaseSourceConfig(
        connection_string="sqlite:///:memory:",
        query="SELECT 1 as id, 'test' as name"
    )
    source = DatabaseSource()
    df = source.parse(config)
    assert df.height > 0
    assert "id" in df.columns

def test_database_source_profiles():
    """Verify column profiles are computed correctly."""
    config = DatabaseSourceConfig(...)
    source = DatabaseSource()
    df = source.parse(config)
    profiles = source.compute_profiles(df)
    assert len(profiles) == df.width
```

---

## Future Enhancements (Not in Scope)

1. **YAML-based Source Discovery**: Instead of explicit registration, discover sources from YAML config (Spec 010 Gate A keeps this OUT).
2. **Async Sources**: Support streaming/async parse operations (Decision F in research.md keeps this OUT).
3. **Source Plugins**: Load Sources from external packages (future round).
4. **Configuration UI**: Dashboard to register and configure new sources (future round).
5. **Fuzzy Matcher Integration**: Column mapping via post_commit_hook (Gate B: pre-staged only).

---

## Troubleshooting

### "Source type 'database' not registered"

**Cause**: You created and implemented DatabaseSource but forgot to call `SourceRegistry.register(DatabaseSource)` in your bootstrap path.

**Fix**: Add the registration call in your app startup code (Step 3 above).

### "SourceConfig has no attribute 'source_type'"

**Cause**: Your config class doesn't inherit from SourceConfig or doesn't define the field.

**Fix**:

```python
class YourSourceConfig(SourceConfig):
    source_type: str = Field(default="your_type", frozen=True)
```

### Circular import error

**Cause**: Your new source module imports from upload_service.py which might import from sources/.

**Fix**: Use `TYPE_CHECKING` guard:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.upload_service import ColumnProfile
```

---

## Summary

The Source/Provider abstraction enables a clean, pluggable architecture for ingestion:

✅ **Define**: Create a SourceConfig and Source subclass (one file)  
✅ **Register**: Add one line to app startup  
✅ **Use**: Orchestration routes through SourceRegistry; no edits needed

This is the power of abstraction: new features without scatter.

---

## Related Documents

- **Specification**: [spec.md](spec.md)
- **Data Model**: [data-model.md](data-model.md)
- **Research & Decisions**: [research.md](research.md)
- **Full Tasks**: [../tasks.md](../tasks.md) (implementation checklist)
