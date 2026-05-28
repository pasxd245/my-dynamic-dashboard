# Final Recommendation — Design and Delivery Flow

**Date**: 2026-05-28  
**Derived from**: MEMO-FINDINGS, TOOLING-ANALYSIS, TOOLING-QUICK-START  
**Status**: Recommended operating model for upcoming rounds

---

## Executive Decision

Adopt a **hybrid flow** with clear gates:

- **Default path**: DCFBI
- **Conditional path**: DFCFBI (enable F1 only when UX uncertainty is high)
- **Cross-cutting rule**: O (One Source of Truth interpretation) applies at every phase, not as a final step

This preserves speed on routine features while adding discovery safety where needed.

---

## Why This Decision

This recommendation integrates all prior findings:

1. The current process works but had two immediate blockers: token drift and undefined fidelity sign-off.
2. A pure one-size flow causes avoidable trade-offs:
   - Contract-first can lock poor UX assumptions too early.
   - Frontend-first can create late API churn if not timeboxed.
3. MSW maturity now supports a stronger two-stage frontend role:
   - Discovery before contract freeze (only when needed).
   - Confirmation after contract freeze (always scoped).

Result: hybrid flow gives the best cost-to-safety ratio for current scale.

---

## Operating Model

## 1) Default Path: DCFBI

Use for low-to-medium UX uncertainty features.

1. **D — Design**
   - Markdown only by default (Mermaid, ASCII, state notes, acceptance criteria).
2. **C — Contract**
   - Schema + examples + error model + pagination/filter semantics.
   - MSW handlers implemented from contract.
3. **F — Frontend**
   - UI implementation against MSW.
4. **B — Backend**
   - Implement against frozen contract.
5. **I — Integration**
   - FE + BE verification, contract conformance, regression pass.

## 2) Conditional Path: DFCFBI

Use when UX uncertainty is high.

1. **D — Design**
2. **F1 — Frontend discovery (timeboxed)**
   - Validate interaction model and state behavior.
   - Output: locked UX acceptance criteria.
3. **C — Contract freeze**
   - Define contract from locked UX.
   - Implement/update MSW from this contract.
4. **F2 — Frontend confirmation**
   - Integrate with finalized MSW and confirm behavior.
   - Scope is confirmation and alignment only (no open-ended discovery).
5. **B — Backend**
6. **I — Integration**

---

## Flow Selector (When to Enable F1)

Run this check right after Design. Enable F1 if **any 2 conditions** are true:

1. More than 3 independent interactive states or branches.
2. New interaction pattern not previously used in product.
3. High user-error risk if flow is unclear.
4. Contract shape depends on unresolved UI behavior decisions.
5. Team confidence in UX is below agreed threshold.

If fewer than 2 are true, use default DCFBI.

---

## O Rule: One Source of Truth Interpretation

O is a governance invariant, not a terminal phase.

- **UX truth**: Design artifact (flows, states, acceptance criteria).
- **Data behavior truth**: Contract artifact (request/response schema, examples, errors).
- **Execution truth**: Shared verification tests that run against both MSW and real backend.

This is one-source discipline by concern, with traceability across artifacts.

---

## Hard Gates (Non-negotiable)

## Design exit gate

- User journeys and state model documented.
- Acceptance criteria explicitly testable.

## F1 exit gate (only when enabled)

- Interaction decisions are frozen for this round.
- Open UX questions are resolved or deferred explicitly.

## Contract exit gate

- Request and response shapes frozen.
- Error semantics frozen.
- MSW handlers aligned with contract.

## F2 exit gate

- Confirmation pass complete against contract-derived MSW.
- Any contract-shape change request is logged as contract v2 and re-approved.

## Backend exit gate

- Contract conformance tests pass.

## Integration exit gate

- FE behavior verified against real BE.
- No unresolved FE-MSW vs BE mismatches.
- Shared contract conformance tests pass against both MSW and real backend.

---

## Risks and Mitigations

1. **Risk**: F1/F2 becomes open-ended frontend iteration.
   - **Mitigation**: strict F1 timebox and narrow F2 scope.
2. **Risk**: Late contract churn from F2.
   - **Mitigation**: explicit contract v2 process, no silent shape changes.
3. **Risk**: “One Source of Truth” becomes a slogan.
   - **Mitigation**: enforce three-truth model and shared conformance tests.
4. **Risk**: design markdown too abstract for complex flows.
   - **Mitigation**: allow focused interaction sketches only when selector triggers.

---

## Adoption Plan (Next 2 Rounds)

1. **Round N+1**
   - Adopt flow selector.
   - Run one feature in default DCFBI.
   - Enforce gates and record friction.
2. **Round N+2**
   - Run one high-uncertainty feature in DFCFBI.
   - Compare cycle time, change count, and mismatch rate.
3. Decide whether to keep thresholds or tune selector criteria.

---

## Final Position

Use **DCFBI as baseline**, activate **DFCFBI only by trigger**, and enforce **O as a cross-cutting invariant**.

This is the most balanced approach for current project maturity: fast enough for delivery, structured enough to prevent drift, and explicit enough to keep contract, MSW, FE, and BE aligned.
