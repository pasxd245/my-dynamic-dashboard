"""
Unit tests for SourceRegistry singleton factory.

Tests verify:
- register() method stores and validates sources
- for_type() retrieves sources correctly
- detect_source_type() identifies files correctly
- list_sources() returns correct metadata
- Error handling (duplicate registration, missing type, unsupported extension)
"""

from __future__ import annotations

import polars as pl
import pytest

from app.services.source_registry import SourceRegistry
from app.services.upload_service import ColumnProfile
from app.sources.base import Source, SourceConfig, SourceMetadata


# Test fixtures: Concrete Source implementations for testing

class TestExcelSource(Source):
    """Test fixture: Mock Excel source."""
    
    def parse(self, config: SourceConfig) -> pl.DataFrame:
        return pl.DataFrame({"col": [1, 2, 3]})
    
    def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
        return [ColumnProfile(name="col", data_type="Int64", is_nullable=False)]
    
    @classmethod
    def get_metadata(cls) -> SourceMetadata:
        return SourceMetadata(
            source_type="test_excel",
            display_name="Test Excel",
            description="Test Excel source",
            supported_extensions=[".xlsx"],
            requires_config=None
        )


class TestCSVSource(Source):
    """Test fixture: Mock CSV source."""
    
    def parse(self, config: SourceConfig) -> pl.DataFrame:
        return pl.DataFrame({"col": ["a", "b", "c"]})
    
    def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
        return [ColumnProfile(name="col", data_type="String", is_nullable=False)]
    
    @classmethod
    def get_metadata(cls) -> SourceMetadata:
        return SourceMetadata(
            source_type="test_csv",
            display_name="Test CSV",
            description="Test CSV source",
            supported_extensions=[".csv"],
            requires_config=None
        )


class TestSourceRegistryRegister:
    """Tests for SourceRegistry.register()."""
    
    def setup_method(self):
        """Clear registry before each test."""
        SourceRegistry._registry.clear()
        SourceRegistry._metadata_cache.clear()
    
    def test_register_first_source(self):
        """Register a source successfully."""
        SourceRegistry.register(TestExcelSource)
        
        assert "test_excel" in SourceRegistry._registry
        assert SourceRegistry._registry["test_excel"] == TestExcelSource
    
    def test_register_multiple_sources(self):
        """Register multiple sources."""
        SourceRegistry.register(TestExcelSource)
        SourceRegistry.register(TestCSVSource)
        
        assert len(SourceRegistry._registry) == 2
        assert "test_excel" in SourceRegistry._registry
        assert "test_csv" in SourceRegistry._registry
    
    def test_register_duplicate_raises_error(self):
        """Attempting to register duplicate source_type raises ValueError."""
        SourceRegistry.register(TestExcelSource)
        
        with pytest.raises(ValueError, match="already registered"):
            SourceRegistry.register(TestExcelSource)
    
    def test_register_different_source_same_type_raises_error(self):
        """Registering a different source class with same source_type raises error."""
        SourceRegistry.register(TestExcelSource)
        
        class AnotherExcelSource(Source):
            def parse(self, config: SourceConfig) -> pl.DataFrame:
                return pl.DataFrame()
            
            def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
                return []
            
            @classmethod
            def get_metadata(cls) -> SourceMetadata:
                return SourceMetadata(
                    source_type="test_excel",  # Same type
                    display_name="Another Excel",
                    description="Another source",
                    supported_extensions=[".xlsx"],
                    requires_config=None
                )
        
        with pytest.raises(ValueError, match="already registered"):
            SourceRegistry.register(AnotherExcelSource)
    
    def test_register_metadata_cached(self):
        """Metadata is cached when source is registered."""
        SourceRegistry.register(TestExcelSource)
        
        assert "test_excel" in SourceRegistry._metadata_cache
        metadata = SourceRegistry._metadata_cache["test_excel"]
        assert metadata.source_type == "test_excel"
        assert metadata.display_name == "Test Excel"


class TestSourceRegistryForType:
    """Tests for SourceRegistry.for_type()."""
    
    def setup_method(self):
        """Setup registry with test sources."""
        SourceRegistry._registry.clear()
        SourceRegistry._metadata_cache.clear()
        SourceRegistry.register(TestExcelSource)
        SourceRegistry.register(TestCSVSource)
    
    def test_for_type_returns_instance(self):
        """for_type returns a Source instance."""
        source = SourceRegistry.for_type("test_excel")
        assert source is not None
        assert isinstance(source, Source)
        assert isinstance(source, TestExcelSource)
    
    def test_for_type_different_types(self):
        """for_type returns different instances for different types."""
        excel_source = SourceRegistry.for_type("test_excel")
        csv_source = SourceRegistry.for_type("test_csv")
        
        assert isinstance(excel_source, TestExcelSource)
        assert isinstance(csv_source, TestCSVSource)
    
    def test_for_type_missing_raises_keyerror(self):
        """Requesting unregistered source_type raises KeyError."""
        with pytest.raises(KeyError, match="not registered"):
            SourceRegistry.for_type("nonexistent")
    
    def test_for_type_empty_registry_raises_keyerror(self):
        """Accessing any type from empty registry raises KeyError."""
        SourceRegistry._registry.clear()
        
        with pytest.raises(KeyError, match="not registered"):
            SourceRegistry.for_type("test_excel")
    
    def test_for_type_instance_can_parse(self):
        """Source instance returned by for_type can parse."""
        source = SourceRegistry.for_type("test_excel")
        df = source.parse(SourceConfig(source_type="test_excel"))
        
        assert df.height == 3
        assert "col" in df.columns


class TestSourceRegistryDetectSourceType:
    """Tests for SourceRegistry.detect_source_type()."""
    
    def test_detect_excel_xlsx(self):
        """Detect .xlsx as excel."""
        assert SourceRegistry.detect_source_type("data.xlsx") == "excel"
    
    def test_detect_excel_xlsm(self):
        """Detect .xlsm as excel."""
        assert SourceRegistry.detect_source_type("data.xlsm") == "excel"
    
    def test_detect_excel_xlsb(self):
        """Detect .xlsb as excel."""
        assert SourceRegistry.detect_source_type("data.xlsb") == "excel"
    
    def test_detect_excel_xls(self):
        """Detect .xls as excel."""
        assert SourceRegistry.detect_source_type("data.xls") == "excel"
    
    def test_detect_csv(self):
        """Detect .csv as csv."""
        assert SourceRegistry.detect_source_type("data.csv") == "csv"
    
    def test_detect_case_insensitive(self):
        """Detection is case-insensitive."""
        assert SourceRegistry.detect_source_type("DATA.XLSX") == "excel"
        assert SourceRegistry.detect_source_type("Data.Csv") == "csv"
        assert SourceRegistry.detect_source_type("DATA.XLS") == "excel"
    
    def test_detect_unsupported_returns_none(self):
        """Unsupported extensions return None."""
        assert SourceRegistry.detect_source_type("data.json") is None
        assert SourceRegistry.detect_source_type("data.txt") is None
        assert SourceRegistry.detect_source_type("data.pdf") is None
        assert SourceRegistry.detect_source_type("data.parquet") is None
    
    def test_detect_no_extension_returns_none(self):
        """File without extension returns None."""
        assert SourceRegistry.detect_source_type("data") is None
    
    def test_detect_with_path(self):
        """Detection works with full paths."""
        assert SourceRegistry.detect_source_type("/path/to/data.xlsx") == "excel"
        assert SourceRegistry.detect_source_type("C:\\data\\file.csv") == "csv"


class TestSourceRegistryListSources:
    """Tests for SourceRegistry.list_sources()."""
    
    def setup_method(self):
        """Setup registry with test sources."""
        SourceRegistry._registry.clear()
        SourceRegistry._metadata_cache.clear()
    
    def test_list_sources_empty(self):
        """Empty registry returns empty list."""
        sources = SourceRegistry.list_sources()
        assert sources == []
    
    def test_list_sources_after_registration(self):
        """list_sources returns all registered sources."""
        SourceRegistry.register(TestExcelSource)
        SourceRegistry.register(TestCSVSource)
        
        sources = SourceRegistry.list_sources()
        assert len(sources) == 2
    
    def test_list_sources_contains_metadata(self):
        """Returned items are SourceMetadata objects."""
        SourceRegistry.register(TestExcelSource)
        
        sources = SourceRegistry.list_sources()
        assert len(sources) == 1
        
        metadata = sources[0]
        assert isinstance(metadata, SourceMetadata)
        assert metadata.source_type == "test_excel"
        assert metadata.display_name == "Test Excel"
    
    def test_list_sources_all_sources_included(self):
        """All registered sources are included in list."""
        SourceRegistry.register(TestExcelSource)
        SourceRegistry.register(TestCSVSource)
        
        sources = SourceRegistry.list_sources()
        types = {s.source_type for s in sources}
        
        assert "test_excel" in types
        assert "test_csv" in types


class TestSourceRegistrySingleton:
    """Tests for singleton behavior."""
    
    def setup_method(self):
        """Clear registry."""
        SourceRegistry._registry.clear()
        SourceRegistry._metadata_cache.clear()
    
    def test_registry_state_persists(self):
        """Registry state persists across multiple calls."""
        SourceRegistry.register(TestExcelSource)
        
        # First call
        source1 = SourceRegistry.for_type("test_excel")
        
        # Second call
        source2 = SourceRegistry.for_type("test_excel")
        
        # Both should be TestExcelSource instances
        assert isinstance(source1, TestExcelSource)
        assert isinstance(source2, TestExcelSource)
    
    def test_multiple_registrations_cumulative(self):
        """Multiple registrations are cumulative."""
        SourceRegistry.register(TestExcelSource)
        assert len(SourceRegistry.list_sources()) == 1
        
        SourceRegistry.register(TestCSVSource)
        assert len(SourceRegistry.list_sources()) == 2
