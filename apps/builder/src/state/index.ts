/**
 * state/ — application state stores (Spec 013)
 *
 * Current stores:
 *   builderSessionStore  — workflow stage + session state (hand-rolled, no zustand)
 *
 * Planned (Phase 4 / T027-T028 — requires zustand installation):
 *   queryBuilderStore    — builder snapshot + column state
 *   savedQueryStore      — saved query list + pagination state
 */

export * from "./builderSessionStore";
