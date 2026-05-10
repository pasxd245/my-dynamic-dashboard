from __future__ import annotations

from app.apps.workspace_app import WORKSPACE_APP, WorkspaceApp
from app.services.builder_session_service import BuilderSessionService
from app.services.query_service import SavedQueryService
from app.shared import current_db_path


class QueryApp:
    def __init__(self, *, workspace_app: WorkspaceApp) -> None:
        self._workspace_app = workspace_app

    def builder_session_service(self) -> BuilderSessionService:
        return self._workspace_app.builder_session_service()

    def saved_query_service(self) -> SavedQueryService:
        return SavedQueryService(db_path=current_db_path())


QUERY_APP = QueryApp(workspace_app=WORKSPACE_APP)
