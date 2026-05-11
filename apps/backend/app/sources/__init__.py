"""
Sources module: Pluggable data ingestion abstraction layer.

Exports:
- Source (abstract base class)
- SourceConfig (base configuration model)
- SourceMetadata (introspectable metadata)
 - ExcelSource / ExcelSourceConfig (Excel ingestion)
 - CSVSource / CSVSourceConfig (CSV ingestion)
"""

from app.sources.csv_source import CSVSource, CSVSourceConfig
from app.sources.excel_source import ExcelSource, ExcelSourceConfig
from app.sources.base import Source, SourceConfig, SourceMetadata

__all__ = [
	"Source",
	"SourceConfig",
	"SourceMetadata",
	"ExcelSource",
	"ExcelSourceConfig",
	"CSVSource",
	"CSVSourceConfig",
]
