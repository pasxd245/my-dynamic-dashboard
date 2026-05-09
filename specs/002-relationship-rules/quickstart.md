# Quickstart: Relationship Rules (Spec 002)

## Goal

Run an end-to-end relationship governance flow: create a workspace, upload two CSV files, create a relationship rule, review and approve it, verify audit history, and run backend tests.

## 1. Start backend

```bash
cd apps/backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Optional health check:

```bash
curl -s http://localhost:8000/api/health
```

## 2. Start builder

```bash
cd apps/builder
pnpm install
pnpm dev
```

Open the builder at `http://localhost:3000`.

## 3. Create workspace + upload 2 CSV files

In the builder UI:

- Create a new workspace.
- Upload two CSV files that share a potential join key (for example `customer_id`).
- Wait until parsing and profiling complete for both sheets.

## 4. Create a relationship between two columns

In the Relationship panel:

- Select source column and target column.
- Select `join_type` (`inner|left|right|full`).
- Select `rel_type` (`exact_key|normalized_key|date_window`).
- Create the rule and confirm it appears with:
  - `status = suggested`
  - computed `overlap_pct`
  - computed `cardinality`

## 5. Review and approve relationship

- Trigger review action to move rule to `reviewed`.
- Approve the rule.
- If overlap is below 80%, acknowledge warning.
- If overlap is below 5%, provide `override_reason` before approval.

## 6. Verify audit trail

- Open relationship details.
- Confirm audit timeline contains at least:
  - `created`
  - `reviewed`
  - `approved` (or `rejected`)
- Verify each event has actor, reason (when required), and timestamp.

## 7. Run backend tests

```bash
cd apps/backend
pytest
```

Expected result:

- Existing tests remain green.
- New contract/integration tests for relationship lifecycle pass.
