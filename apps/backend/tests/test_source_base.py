"""
Unit tests for Source base class and SourceConfig.

Tests verify:
- Source is abstract and cannot be instantiated directly
- SourceConfig is a Pydantic model and immutable (frozen)
- ColumnProfile creation works
- Error handling for unsupported functionality
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.services.upload_service import ColumnProfile
from app.sources.base import Source, SourceConfig, SourceMetadata


class TestSourceAbstractness:
    """Verify Source is abstract and cannot be instantiated."""
    
    def test_source_cannot_be_instantiated(self):
        """Source is abstract; direct instantiation should fail."""
        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            Source()
    
    def test_source_subclass_without_implementation_fails(self):
        """A Source subclass that doesn't implement abstract methods should fail."""
        class IncompleteSource(Source):
            pass
        
        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            IncompleteSource()
    
    def test_source_subclass_with_implementation_works(self):
        """A Source subclass that implements abstract methods can be instantiated."""
        import polars as pl
        
        class ConcreteSource(Source):
            def parse(self, config: SourceConfig) -> pl.DataFrame:
                return pl.DataFrame({"col": [1, 2, 3]})
            
            def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
                return [
                    ColumnProfile(name="col", data_type="Int64", is_nullable=False)
                ]
        
        source = ConcreteSource()
        assert source is not None
        assert isinstance(source, Source)


class TestSourceConfigImmutability:
    """Verify SourceConfig and subclasses are immutable (frozen)."""
    
    def test_source_config_is_frozen(self):
        """SourceConfig instances are immutable."""
        config = SourceConfig(source_type="test")
        
        with pytest.raises(Exception):  # Pydantic FrozenInstanceError
            config.source_type = "modified"
    
    def test_source_config_subclass_is_frozen(self):
        """Subclasses of SourceConfig are also frozen."""
        from pydantic import BaseModel, ConfigDict, Field
        
        class TestConfig(SourceConfig):
            source_type: str = Field(default="test", frozen=True)
            extra_field: str = "test"
        
        config = TestConfig(source_type="test", extra_field="value")
        
        with pytest.raises(Exception):  # Pydantic FrozenInstanceError
            config.extra_field = "modified"


class TestSourceConfigValidation:
    """Verify SourceConfig Pydantic validation works."""
    
    def test_source_config_requires_source_type(self):
        """source_type is required."""
        with pytest.raises(ValidationError):
            SourceConfig()
    
    def test_source_config_serialization(self):
        """SourceConfig can be serialized to dict/JSON."""
        config = SourceConfig(source_type="excel")
        
        # Pydantic v2 method
        data = config.model_dump()
        assert data == {"source_type": "excel"}
        
        # JSON serialization
        import json
        json_str = config.model_dump_json()
        assert json_str == '{"source_type":"excel"}'
    
    def test_source_config_deserialization(self):
        """SourceConfig can be deserialized from dict."""
        data = {"source_type": "csv"}
        config = SourceConfig(**data)
        assert config.source_type == "csv"


class TestColumnProfileCreation:
    """Verify ColumnProfile can be created and used."""
    
    def test_column_profile_creation(self):
        """Create a ColumnProfile successfully."""
        profile = ColumnProfile(name="age", data_type="Int64", is_nullable=True)
        assert profile.name == "age"
        assert profile.data_type == "Int64"
        assert profile.is_nullable is True
    
    def test_column_profile_list(self):
        """Create a list of ColumnProfiles."""
        profiles = [
            ColumnProfile(name="id", data_type="Int64", is_nullable=False),
            ColumnProfile(name="name", data_type="String", is_nullable=True),
            ColumnProfile(name="active", data_type="Boolean", is_nullable=False),
        ]
        assert len(profiles) == 3


class TestSourcePostCommitHook:
    """Verify post_commit_hook exists and is callable."""
    
    def test_post_commit_hook_no_op_by_default(self):
        """post_commit_hook is a no-op on the base Source class."""
        import polars as pl
        
        class TestSource(Source):
            def parse(self, config: SourceConfig) -> pl.DataFrame:
                return pl.DataFrame({"col": [1]})
            
            def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
                return [ColumnProfile(name="col", data_type="Int64", is_nullable=False)]
        
        source = TestSource()
        profiles = [ColumnProfile(name="col", data_type="Int64", is_nullable=False)]
        
        # Should not raise an exception
        result = source.post_commit_hook(
            workspace_id="ws-123",
            source_file_id="sf-456",
            columns=profiles
        )
        assert result is None
    
    def test_post_commit_hook_can_be_overridden(self):
        """Subclasses can override post_commit_hook for custom behavior."""
        import polars as pl
        
        class TestSourceWithHook(Source):
            hook_called = False
            
            def parse(self, config: SourceConfig) -> pl.DataFrame:
                return pl.DataFrame({"col": [1]})
            
            def compute_profiles(self, df: pl.DataFrame) -> list[ColumnProfile]:
                return [ColumnProfile(name="col", data_type="Int64", is_nullable=False)]
            
            def post_commit_hook(self, workspace_id: str, source_file_id: str, 
                                columns: list[ColumnProfile]) -> None:
                TestSourceWithHook.hook_called = True
        
        source = TestSourceWithHook()
        profiles = [ColumnProfile(name="col", data_type="Int64", is_nullable=False)]
        
        source.post_commit_hook("ws-123", "sf-456", profiles)
        assert TestSourceWithHook.hook_called is True


class TestSourceMetadata:
    """Verify SourceMetadata dataclass."""
    
    def test_source_metadata_creation(self):
        """Create SourceMetadata successfully."""
        metadata = SourceMetadata(
            source_type="excel",
            display_name="Excel Spreadsheet",
            description="Parse .xlsx files",
            supported_extensions=[".xlsx", ".xlsm", ".xls"],
            requires_config=None
        )
        assert metadata.source_type == "excel"
        assert len(metadata.supported_extensions) == 3
    
    def test_source_metadata_with_config_requirements(self):
        """SourceMetadata with requires_config field."""
        metadata = SourceMetadata(
            source_type="database",
            display_name="SQL Database",
            description="Query SQL databases",
            supported_extensions=[],
            requires_config={
                "connection_string": "str",
                "query": "str",
                "timeout": "int"
            }
        )
        assert metadata.requires_config is not None
        assert "connection_string" in metadata.requires_config
