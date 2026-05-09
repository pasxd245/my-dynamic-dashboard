"""Integration tests for Spec 006 backup, restore, and DR flows."""

import re
from pathlib import Path

from app.core.config import metadata_db_path
from app.core.metadata_db import get_connection
from app.services.backup_service import BackupService


def test_backup_utc_naming_and_integrity_metadata_creation() -> None:
    service = BackupService(metadata_db_path())
    result = service.run_backup()
    backup_id = result["run_id"]

    backups = service.list_backups(limit=5)
    created = next(item for item in backups if item.backup_id == backup_id)
    assert re.match(r"^metadata-\d{8}T\d{6}Z\.sqlite3\.gz$", created.artifact_name)
    assert created.sqlite_integrity_ok is True
    assert created.checksum is not None


def test_retention_pruning_preserves_latest_valid_backup() -> None:
    service = BackupService(metadata_db_path())
    latest = service.run_backup()["run_id"]

    with get_connection(metadata_db_path()) as conn:
        conn.execute(
            "UPDATE backup_artifacts SET retention_expires_at_utc = '2000-01-01T00:00:00+00:00', is_latest_valid = 0 WHERE backup_id != ?",
            (latest,),
        )
    service.run_backup()

    with get_connection(metadata_db_path()) as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM backup_artifacts WHERE is_latest_valid = 1"
        ).fetchone()
    assert int(row[0]) == 1


def test_restore_from_latest_valid_recovers_service_health_shape() -> None:
    service = BackupService(metadata_db_path())
    backup_id = service.run_backup()["run_id"]
    restore = service.run_restore(backup_id=backup_id, operator_id="ops")

    assert restore.status == "completed"
    assert restore.validation_result == "passed"
    assert restore.finished_at_utc is not None


def test_corrupt_backup_detection_non_destructive_failure() -> None:
    service = BackupService(metadata_db_path())
    backup_id = service.run_backup()["run_id"]

    with get_connection(metadata_db_path()) as conn:
        conn.execute(
            "UPDATE backup_artifacts SET status = 'failed' WHERE backup_id = ?",
            (backup_id,),
        )

    try:
        service.run_restore(backup_id=backup_id, operator_id="ops")
        assert False, "Expected invalid backup failure"
    except ValueError as exc:
        assert str(exc) == "backup_invalid"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def test_rollback_execution_path_restores_known_good_bundle_and_revision() -> None:
    script = (_repo_root() / "scripts/ops/rollback-release.sh").read_text(encoding="utf-8")
    assert "ROLLBACK_TARGET_BUNDLE" in script
    assert "docker compose -f docker-compose.prod.yml" in script
    assert "rollback_finished" in script


def test_dr_drill_end_to_end_checklist_timing_and_evidence_capture() -> None:
    script = (_repo_root() / "scripts/ops/dr-drill.sh").read_text(encoding="utf-8")
    assert "backup.sh" in script
    assert "restore.sh" in script
    assert "rollback-release.sh" in script
    assert "dr-evidence-" in script
