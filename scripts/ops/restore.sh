#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
METADATA_DB_PATH="${METADATA_DB_PATH:-/app/data/metadata.db}"
TARGET_ARTIFACT="${TARGET_ARTIFACT:-}"

if [[ -z "$TARGET_ARTIFACT" ]]; then
	if [[ -f "$BACKUP_DIR/latest-valid.txt" ]]; then
		TARGET_ARTIFACT="$(cat "$BACKUP_DIR/latest-valid.txt")"
	else
		echo "TARGET_ARTIFACT is required when latest-valid.txt is missing" >&2
		exit 1
	fi
fi

artifact_path="$BACKUP_DIR/$TARGET_ARTIFACT"
checksum_path="$artifact_path.sha256"

if [[ ! -f "$artifact_path" ]]; then
	echo "backup artifact not found: $artifact_path" >&2
	exit 1
fi

if [[ ! -f "$checksum_path" ]] || ! sha256sum -c "$checksum_path" >/dev/null 2>&1; then
	quarantine_dir="$BACKUP_DIR/quarantine"
	mkdir -p "$quarantine_dir"
	mv "$artifact_path" "$quarantine_dir/" || true
	mv "$checksum_path" "$quarantine_dir/" || true
	echo "restore aborted: corrupt backup moved to quarantine" >&2
	exit 1
fi

mkdir -p "$(dirname "$METADATA_DB_PATH")"
if [[ -f "$METADATA_DB_PATH" ]]; then
	cp "$METADATA_DB_PATH" "$METADATA_DB_PATH.pre-restore.$(date -u +%Y%m%dT%H%M%SZ).bak"
fi

gunzip -c "$artifact_path" > "$METADATA_DB_PATH"
echo "restore_success artifact=$TARGET_ARTIFACT"
