from __future__ import annotations

from app.services.chart_suggestion_service import ChartSuggestionService
from app.services.dashboard_service import DashboardService
from app.services.panel_executor_service import PanelExecutorService
from app.shared import current_db_path


class DashboardApp:
    def dashboard_service(self) -> DashboardService:
        chart_service = ChartSuggestionService()
        panel_executor = PanelExecutorService(chart_service=chart_service)
        return DashboardService(
            db_path=current_db_path(),
            panel_executor=panel_executor,
        )


DASHBOARD_APP = DashboardApp()
