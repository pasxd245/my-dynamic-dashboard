from __future__ import annotations

from pathlib import Path

from app.shared import current_db_path


class RelationshipApp:
    def metadata_db_path(self) -> Path:
        return current_db_path()


RELATIONSHIP_APP = RelationshipApp()
