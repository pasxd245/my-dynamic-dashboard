"""
Source abstraction layer: Base classes for pluggable data source implementations.

This module defines the core contracts that all data source types must implement:
- Source (abstract base class for parser implementations)
- SourceConfig (Pydantic base model for source-specific configuration)
- SourceMetadata (introspectable metadata for registered sources)

All SourceConfig subclasses are immutable (frozen=True) for safety and predictability.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import polars as pl
from pydantic import BaseModel, ConfigDict

if TYPE_CHECKING:
    # Avoid circular import at runtime; TYPE_CHECKING block used only for type hints
    from app.services.upload_service import ColumnProfile


class SourceConfig(BaseModel):
    """
    Abstract base configuration model for all source types.
    
    All SourceConfig subclasses are immutable (frozen). Configuration is defined
    at instance creation time and cannot be modified.
    
    Requirements (FR-002, FR-010):
    - Extensible via inheritance (each source type defines its own subclass)
    - Immutable (frozen=True)
    - JSON-serializable (Pydantic v2 native)
    - source_type field uniquely identifies the configuration type
    """
    
    model_config = ConfigDict(frozen=True)
    
    source_type: str
    """
    String identifier for the source type (e.g., "excel", "csv", "database").
    Frozen to prevent modification after creation.
    Used by SourceRegistry to dispatch to the correct Source implementation.
    """


@dataclass
class SourceMetadata:
    """
    Introspectable metadata about a registered source type.
    
    Returned by SourceRegistry.list_sources() to enable:
    - UI discovery of available source types
    - Documentation generation
    - Configuration validation
    
    Requirements (FR-014):
    - Fully JSON-serializable (used in API responses)
    - Includes supported file extensions for UI filtering
    - Includes optional config schema for dynamic form generation
    """
    
    source_type: str
    """Unique identifier for this source type (e.g., "excel", "csv")."""
    
    display_name: str
    """Human-readable name suitable for UI display (e.g., "Excel Spreadsheet")."""
    
    description: str
    """Short description of what this source does and what formats it handles."""
    
    supported_extensions: list[str]
    """List of file extensions this source can handle (e.g., [".xlsx", ".xlsm"])."""
    
    requires_config: dict[str, Any] | None
    """
    Optional schema describing additional configuration fields needed.
    Example: {"connection_string": "str", "query": "str"}
    None for file-based sources that only need filename + file_bytes.
    """


class Source(ABC):
    """
    Abstract base class for data source implementations.
    
    All data ingestion sources (Excel, CSV, Database, API, S3, etc.) must
    inherit from Source and implement the required abstract methods.
    
    Design Principle (FR-001, FR-008):
    - Stateless (all state lives in SourceRegistry)
    - Thread-safe (no mutable class attributes)
    - Synchronous (no async/await; FR-11 constraint)
    - Error preservation (error messages must match existing behavior; FR-18)
    
    The post_commit_hook is pre-staged for future integration with column-mapping
    logic (Gate B in spec.md). Currently it's a no-op.
    """
    
    @abstractmethod
    def parse(self, config: SourceConfig) -> pl.DataFrame:
        """
        Parse file/stream into a Polars DataFrame.
        
        Requirements (FR-001, FR-004, FR-005, FR-011, FR-018):
        - ExcelSource: Reads .xlsx, .xlsm, .xlsb, .xls files
        - CSVSource: Reads .csv files
        - Error handling: Must preserve error messages exactly (FR-18)
        - Fallback logic: Excel should try openpyxl then calamine
        
        Args:
            config: Source-specific configuration (SourceConfig subclass)
                   e.g., ExcelSourceConfig(filename="data.xlsx", file_bytes=b"...")
        
        Returns:
            Polars DataFrame with parsed data
            
        Raises:
            ValueError: If parsing fails. Must preserve original error message
                       for backward compatibility.
        """
        ...
    
    @abstractmethod
    def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
        """
        Compute column profiles for the parsed DataFrame.
        
        Requirements (FR-001, SC-008):
        - ColumnProfile per column (name, data_type, is_nullable)
        - Must return same data as upload_service.compute_column_profiles()
        - Used for schema detection and change tracking
        
        Args:
            df: Polars DataFrame to profile
            
        Returns:
            List of ColumnProfile (one per column in DataFrame)
            
        Raises:
            ValueError: If profiling fails
        """
        ...
    
    def post_commit_hook(
        self,
        workspace_id: str,
        source_file_id: str,
        columns: list[ColumnProfile],
    ) -> None:
        """
        Optional hook called after successful upload orchestration.
        
        Requirements (FR-008, Gate B):
        - Pre-staged for future column-mapping integration
        - Currently a no-op (default implementation)
        - Subclasses may override for custom post-upload logic
        
        Used for future fuzzy-matcher registration (Phase X, not in Spec 010).
        
        Args:
            workspace_id: ID of workspace where file was uploaded
            source_file_id: ID of the uploaded SourceFile record
            columns: List of ColumnProfile for the uploaded data
            
        Raises:
            (None expected; exceptions are logged but do not fail upload)
        """
        # No-op default implementation. Subclasses override if needed.
        pass
