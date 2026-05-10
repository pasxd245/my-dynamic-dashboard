"""
Sources module: Pluggable data ingestion abstraction layer.

Exports:
- Source (abstract base class)
- SourceConfig (base configuration model)
- SourceMetadata (introspectable metadata)
"""

from app.sources.base import Source, SourceConfig, SourceMetadata

__all__ = ["Source", "SourceConfig", "SourceMetadata"]
