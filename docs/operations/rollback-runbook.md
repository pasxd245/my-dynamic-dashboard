# Rollback Runbook (Spec 006)

## Triage Trigger

Start rollback when any of these persist for >10 minutes:

1. Backend `/health` degraded/not_ready.
2. Dashboard run failures spike after deployment.
3. Startup loop or repeated container restarts.

## Rollback Steps

1. Identify known-good bundle ID from deployment logs.
2. Export rollback target:
   - `export ROLLBACK_TARGET_BUNDLE=<known-good-bundle>`
3. Run rollback:
   - `scripts/ops/rollback-release.sh`
4. Keep data and backup volumes unchanged.

## Post-Rollback Verification

1. Verify API/UI health probes.
2. Run one saved-query execution and one dashboard refresh.
3. Confirm backup artifacts remain present and readable.
4. Record rollback evidence in incident notes.
