#!/usr/bin/env bash
set -euo pipefail

MODE="${BUILDER_SMOKE_MODE:-api}"
FAIL_STAGE="${BUILDER_SMOKE_FAIL_STAGE:-}"
API_BASE="${BUILDER_SMOKE_API_BASE:-http://localhost:8000}"

print_stage_summary() {
	local status="$1"
	local stage="$2"
	local message="$3"
	echo "[builder-workflow-smoke] stage=${stage} status=${status} message=${message}"
}

run_stub_mode() {
	local stages=("create_workspace" "upload_source" "validate_query" "list_saved_queries")
	local first_failed=""

	for stage in "${stages[@]}"; do
		if [[ -n "$first_failed" ]]; then
			print_stage_summary "skipped" "$stage" "Skipped because ${first_failed} failed"
			continue
		fi

		if [[ -n "$FAIL_STAGE" && "$FAIL_STAGE" == "$stage" ]]; then
			first_failed="$stage"
			print_stage_summary "failed" "$stage" "Simulated stage failure"
		else
			print_stage_summary "passed" "$stage" "Stage completed"
		fi
	done

	if [[ -n "$first_failed" ]]; then
		echo "[builder-workflow-smoke] status=failed first_failed_stage=${first_failed}"
		return 1
	fi

	echo "[builder-workflow-smoke] status=passed first_failed_stage=none"
	return 0
}

run_api_mode() {
	local payload='{}'
	if [[ -n "$FAIL_STAGE" ]]; then
		payload="{\"simulate_failure_stage\":\"${FAIL_STAGE}\"}"
	fi

	local run_response
	run_response=$(curl -fsS \
		-H "Content-Type: application/json" \
		-X POST \
		-d "$payload" \
		"${API_BASE}/api/v1/ops/smoke/builder-workflow")

	local run_id
	run_id=$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["run_id"])' <<<"$run_response")
	local result
	result=$(curl -fsS "${API_BASE}/api/v1/ops/smoke/builder-workflow/${run_id}")

	python3 - <<'PY' "$result"
import json
import sys

body = json.loads(sys.argv[1])
for stage in body.get("stages", []):
		print(
				f"[builder-workflow-smoke] stage={stage['stage']} "
				f"status={stage['status']} message={stage['message']}"
		)

first_failed = body.get("first_failed_stage") or "none"
print(f"[builder-workflow-smoke] status={body['status']} first_failed_stage={first_failed}")

if body["status"] != "passed":
		raise SystemExit(1)
PY
}

if [[ "$MODE" == "stub" ]]; then
	run_stub_mode
else
	run_api_mode
fi
