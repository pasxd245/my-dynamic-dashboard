"""
SourceRegistry: Centralized singleton factory for pluggable data sources.

This module provides the SourceRegistry, which manages the registration and dispatch
of all available source types. It enables upload orchestration to be source-agnostic,
routing to the appropriate Source implementation based on file type.

Requirements (FR-003, FR-006, FR-009, FR-012, FR-014, FR-016):
- Singleton pattern (module-level class methods)
- Thread-safe (module-level dict with Python GIL)
- Enables detection of source type from filename
- Provides introspection via list_sources()
- Supports explicit registration only (no YAML auto-discovery; Gate A)
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.sources.base import Source, SourceMetadata


class SourceRegistry:
    """
    Singleton registry for all source implementations.

    All methods are static/class methods; no instance creation.
    State is maintained in module-level cache dictionaries.

    Pattern (FR-006):
    - Usage: SourceRegistry.register(ExcelSource) at app startup
    - Usage: SourceRegistry.for_type("excel") at request time
    - Thread-safe: Module-level dict operations under Python GIL
    """

    # Module-level cache: source_type (str) -> Source class
    _registry: dict[str, type[Source]] = {}

    # Module-level cache: source_type (str) -> SourceMetadata
    _metadata_cache: dict[str, SourceMetadata] = {}

    @staticmethod
    def register_builtin_sources() -> None:
        """Ensure first-party file sources are available for upload dispatch."""
        from app.sources import CSVSource, ExcelSource

        for source_class in (ExcelSource, CSVSource):
            source_type = source_class.get_metadata().source_type
            if not SourceRegistry.is_registered(source_type):
                SourceRegistry.register(source_class)

    @staticmethod
    def register(source_class: type[Source]) -> None:
        """
        Register a new Source subclass at app startup.

        Requirements (FR-003, FR-006, FR-016):
        - Called once per source type at FastAPI startup
        - Raises ValueError if source_type is already registered
        - No YAML auto-discovery (explicit registration only)

        Args:
            source_class: A concrete Source subclass (must have _get_source_type() method)

        Raises:
            ValueError: If source_type is already registered
            AttributeError: If source_class doesn't have required attributes

        Example:
            SourceRegistry.register(ExcelSource)
            SourceRegistry.register(CSVSource)
        """
        # Try to get metadata (if available as class method)
        if hasattr(source_class, "get_metadata"):
            metadata = source_class.get_metadata()
            source_type = metadata.source_type
        else:
            # Fallback: Try to instantiate and check for source_type attribute
            # This is a bit awkward; we'll refine in Phase 2
            raise AttributeError(
                f"Source class {source_class.__name__} must have a get_metadata() class method "
                "that returns SourceMetadata"
            )

        if source_type in SourceRegistry._registry:
            raise ValueError(
                f"Source type '{source_type}' is already registered. Cannot register {source_class.__name__}."
            )

        SourceRegistry._registry[source_type] = source_class
        SourceRegistry._metadata_cache[source_type] = metadata

    @staticmethod
    def is_registered(source_type: str) -> bool:
        return source_type in SourceRegistry._registry

    @staticmethod
    def for_type(source_type: str) -> Source:
        """
        Retrieve a Source instance for the given type.

        Requirements (FR-003, FR-006, FR-011):
        - Returns a Source instance that can parse files of this type
        - Raises KeyError if source_type not registered
        - Called by orchestration to dispatch parsing

        Args:
            source_type: Type identifier (e.g., "excel", "csv", "database")

        Returns:
            Instance of the registered Source subclass

        Raises:
            KeyError: If source_type is not registered

        Example:
            source = SourceRegistry.for_type("excel")
            df = source.parse(config)
        """
        if source_type not in SourceRegistry._registry:
            available = ", ".join(SourceRegistry._registry.keys()) or "(none)"
            raise KeyError(f"Source type '{source_type}' is not registered. Available sources: {available}")

        source_class = SourceRegistry._registry[source_type]
        return source_class()

    @staticmethod
    def detect_source_type(filename: str) -> str | None:
        """
        Detect source type based on file extension.

        Requirements (FR-012, FR-018):
        - Maps file extensions to source_type identifiers
        - Case-insensitive (handles .XLSX, .xlsx, etc.)
        - Returns None if extension is unsupported
        - Currently built-in for Excel (.xlsx, .xlsm, .xlsb, .xls) and CSV (.csv)

        Future: Could be extensible (sources register their extensions)

        Args:
            filename: Original filename (e.g., "data.xlsx", "data.csv")

        Returns:
            Source type identifier (e.g., "excel", "csv") or None if unsupported

        Example:
            source_type = SourceRegistry.detect_source_type("data.xlsx")  # "excel"
            source_type = SourceRegistry.detect_source_type("data.csv")   # "csv"
            source_type = SourceRegistry.detect_source_type("data.json")  # None
        """
        lower_name = filename.lower()

        # Excel formats
        if lower_name.endswith((".xlsx", ".xlsm", ".xlsb", ".xls")):
            return "excel"

        # CSV format
        if lower_name.endswith(".csv"):
            return "csv"

        # Unknown
        return None

    @staticmethod
    def list_sources() -> list[SourceMetadata]:
        """
        Return list of all registered sources.

        Requirements (FR-003, FR-014):
        - Used for UI discovery, documentation, introspection
        - Returns empty list if no sources registered
        - Returns SourceMetadata for each registered source
        - Result is JSON-serializable

        Returns:
            List of SourceMetadata objects, one per registered source

        Example:
            sources = SourceRegistry.list_sources()
            for meta in sources:
                print(f"{meta.source_type}: {meta.display_name}")
        """
        return list(SourceRegistry._metadata_cache.values())
