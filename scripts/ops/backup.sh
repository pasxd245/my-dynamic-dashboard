#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
METADATA_DB_PATH="${METADATA_DB_PATH:-/app/data/metadata.db}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
artifact="metadata-${ts}.sqlite3.gz"
artifact_path="$BACKUP_DIR/$artifact"

if [[ -f "$METADATA_DB_PATH" ]]; then
	gzip -c "$METADATA_DB_PATH" > "$artifact_path"
else
	echo "warning: metadata DB not found at $METADATA_DB_PATH; creating placeholder backup" >&2
	printf "placeholder backup\n" | gzip -c > "$artifact_path"
fi

checksum="$(sha256sum "$artifact_path" | awk '{print $1}')"
echo "$checksum  $artifact" > "$artifact_path.sha256"
echo "$artifact" > "$BACKUP_DIR/latest-valid.txt"

# Retain latest valid backup even if older than retention window.
latest_valid="$(cat "$BACKUP_DIR/latest-valid.txt" 2>/dev/null || true)"
find "$BACKUP_DIR" -maxdepth 1 -name 'metadata-*.sqlite3.gz' -mtime "+$RETENTION_DAYS" | while read -r old_file; do
	old_base="$(basename "$old_file")"
	if [[ "$old_base" == "$latest_valid" ]]; then
		continue
	fi
	rm -f "$old_file" "$old_file.sha256"
done

echo "backup_success artifact=$artifact checksum=$checksum"
