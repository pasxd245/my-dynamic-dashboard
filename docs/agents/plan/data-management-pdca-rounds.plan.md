# Data Management Implementation: PDCA Round Structure

**Purpose**: Implement Data Management features by user-facing function (e2e UI actions), using Spec Kit for each round with manual Check gates.

## Round Overview

| Round    | Function                        | Spec     | Goal                                                                       | Check Gate                                                                      |
| -------- | ------------------------------- | -------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Round 35 | Workspace Selection/Creation    | Spec 017 | Create or select workspace before upload                                   | Manual: UI renders workspace picker; create/select both work end-to-end         |
| Round 36 | File Upload & Sheet Discovery   | Spec 018 | Accept file, detect type, discover Excel sheets                            | Manual: Upload CSV + Excel; verify sheet list displays for multi-sheet files    |
| Round 37 | Metadata Extraction & Profiling | Spec 019 | Extract schema, compute data range, show columns                           | Manual: Post-upload profile shows columns with inferred types; can override     |
| Round 38 | Column Role Assignment          | Spec 020 | Assign semantic roles (identity_key, dimension, measure)                   | Manual: Assign roles; verify SQL readiness reflects changes                     |
| Round 39 | Readiness Validation            | Spec 021 | Gate query builder until workspace ready (sources + roles + relationships) | Manual: Readiness endpoint returns correct ready=true/false; gates query unlock |

## Check Phase Strategy

Each round's Check phase will:

1. **Run `/speckit.implement`** to execute all tasks in `specs/NNN-*/tasks.md`
2. **Manual verification checklist** specific to the round function:
   - UI interaction flows (user can click/type/submit)
   - Data persists correctly (check SQLite/state)
   - Error cases handled (show actionable messages)
   - Backend integration works (API calls succeed)
3. **If manual checks fail** → return to Do, fix the issue, re-run speckit.implement, re-check
4. **If all manual checks pass** → proceed to Act, capture learnings, plan Round N+1

## Execution Sequence

1. Create `specs/017-*` through `specs/021-*` directories with spec.md, plan.md, tasks.md
2. Start with Round 35 (Workspace Selection) as the first executable round
3. Each round follows Plan → Do (speckit.implement) → Check (manual) → Act
4. If Check fails, loop back to Do until all checks pass
5. Act captures learnings and proposes the next round

## Scope Boundaries

- **In scope**: Builder UI + Backend API for each function; SQLite persistence
- **Out of scope**: Dashboard features, saved queries beyond readiness check, AI workflow generation
- **No refactors**: Preserve existing upload/query endpoint behavior; only add UX/workflow features

---

## Example: Round 35 Manual Check Checklist

**Function**: Workspace Selection/Creation

- [ ] Workspace picker UI renders (list of existing workspaces)
- [ ] User can create new workspace (type name, submit)
- [ ] User can select existing workspace (click to choose)
- [ ] Active workspace_id is set in upload flow state
- [ ] Backend create_workspace API persists to SQLite
- [ ] Backend GET /workspaces returns list
- [ ] Error handling: invalid names, duplicate names show actionable error

When all ☑️, proceed to Act phase and plan Round 36.
