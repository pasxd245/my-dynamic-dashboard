#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_SCRIPT="$ROOT_DIR/scripts/ops/backup.sh"
RESTORE_SCRIPT="$ROOT_DIR/scripts/ops/restore.sh"
ROLLBACK_SCRIPT="$ROOT_DIR/scripts/ops/rollback-release.sh"
EVIDENCE_DIR="${DR_EVIDENCE_DIR:-$ROOT_DIR/tmp/dr-evidence-$(date -u +%Y%m%dT%H%M%SZ)}"

mkdir -p "$EVIDENCE_DIR"
start_epoch="$(date +%s)"

bash "$BACKUP_SCRIPT" | tee "$EVIDENCE_DIR/backup.log"
bash "$RESTORE_SCRIPT" | tee "$EVIDENCE_DIR/restore.log"
ROLLBACK_TARGET_BUNDLE="dr-known-good" bash "$ROLLBACK_SCRIPT" | tee "$EVIDENCE_DIR/rollback.log"

end_epoch="$(date +%s)"
duration="$((end_epoch - start_epoch))"

{
	echo "dr_drill_completed=true"
	echo "duration_seconds=$duration"
	echo "evidence_dir=$EVIDENCE_DIR"
} > "$EVIDENCE_DIR/summary.txt"

echo "dr drill completed in ${duration}s; evidence: $EVIDENCE_DIR"
