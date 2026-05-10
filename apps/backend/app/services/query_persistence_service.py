from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from app.schemas import QueryConfig


@dataclass
class QueryPersistenceService:
    """Persists saved query configurations and lookup/history metadata."""

    def compute_config_hash(self, config: QueryConfig) -> str:
        serialized = json.dumps(config.model_dump(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def save_query(
        self, *, workspace_id: str, name: str, description: str | None, config: QueryConfig
    ) -> dict[str, Any]:
        _ = (workspace_id, name, description, config)
        return {}

    def list_queries(self, *, workspace_id: str) -> list[dict[str, Any]]:
        _ = workspace_id
        return []

    def get_query(self, *, workspace_id: str, query_id: str) -> dict[str, Any] | None:
        _ = (workspace_id, query_id)
        return None

    def update_query(
        self,
        *,
        workspace_id: str,
        query_id: str,
        name: str,
        description: str | None,
        config: QueryConfig,
    ) -> dict[str, Any] | None:
        _ = (workspace_id, query_id, name, description, config)
        return None

    def delete_query(self, *, workspace_id: str, query_id: str) -> bool:
        _ = (workspace_id, query_id)
        return False

    def list_execution_history(self, *, workspace_id: str, query_id: str) -> list[dict[str, Any]]:
        _ = (workspace_id, query_id)
        return []
