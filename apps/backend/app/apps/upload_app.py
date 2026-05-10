from __future__ import annotations

import sys
from pathlib import Path

from app.services.builder_smoke_service import BuilderSmokeService
from app.services.preflight_service import PreflightService
from app.shared import current_db_path, current_parquet_root


class UploadApp:
    def __init__(
        self,
        *,
        builder_smoke_service: BuilderSmokeService | None = None,
    ) -> None:
        self._preflight_service: PreflightService | None = None
        self._builder_smoke_service = builder_smoke_service or BuilderSmokeService()

    def metadata_db_path(self) -> Path:
        return current_db_path()

    def parquet_root(self) -> Path:
        return current_parquet_root()

    def preflight_service(self) -> PreflightService:
        main_module = sys.modules.get("app.main")
        if main_module is not None:
            main_value = getattr(main_module, "PREFLIGHT_SERVICE", self._preflight_service)
            if main_value is not self._preflight_service:
                self._preflight_service = main_value

        metadata_db_path = self.metadata_db_path()
        if self._preflight_service is None or self._preflight_service.metadata_db_path != metadata_db_path:
            self._preflight_service = PreflightService(metadata_db_path=metadata_db_path)

        if main_module is not None:
            main_module.PREFLIGHT_SERVICE = self._preflight_service
        return self._preflight_service

    def builder_smoke_service(self) -> BuilderSmokeService:
        main_module = sys.modules.get("app.main")
        if main_module is not None:
            main_value = getattr(main_module, "BUILDER_SMOKE_SERVICE", self._builder_smoke_service)
            if main_value is not self._builder_smoke_service:
                return main_value
        return self._builder_smoke_service


UPLOAD_APP = UploadApp()
