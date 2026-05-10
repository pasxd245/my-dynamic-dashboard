from __future__ import annotations

from app.services.audit_service import AuditService
from app.services.backup_service import BackupService
from app.services.deployment_service import DeploymentService
from app.shared import current_db_path


class DeploymentApp:
    def deployment_service(self) -> DeploymentService:
        return DeploymentService(db_path=current_db_path())

    def backup_service(self) -> BackupService:
        return BackupService(db_path=current_db_path())

    def audit_service(self) -> AuditService:
        return AuditService(db_path=current_db_path())


DEPLOYMENT_APP = DeploymentApp()
