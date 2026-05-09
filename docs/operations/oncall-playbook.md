# On-Call Playbook (Spec 006)

## Severity Levels

1. Sev-1: Full outage (API unavailable or restore impossible) — page immediately.
2. Sev-2: Partial outage (degraded health, dashboard failures) — respond within 15 min.
3. Sev-3: Non-blocking issues (single report failure, warning alerts) — next business window.

## Escalation Matrix

1. Primary on-call engineer triages and stabilizes.
2. Platform owner engaged for Sev-1/Sev-2 unresolved after 30 minutes.
3. Product stakeholder notified for customer-facing impact.

## First 15-Minute Checklist

1. Capture health snapshots and active alerts.
2. Validate deployment/rollback status.
3. Verify latest backup freshness and restore viability.
4. Start incident log with UTC timestamps.

## Required Evidence

1. Correlation IDs for failed requests.
2. Compose service states before and after remediation.
3. Backup ID and restore run ID (if recovery executed).
4. Summary of impact, root cause, and follow-up action.
