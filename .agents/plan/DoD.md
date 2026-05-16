# Definition of Done (DoD)

> Master checklist across all PDCA rounds. Each task maps to a round and
> requires explicit verification before it can be marked complete.

---

## Verification Levels

| Tag    | Meaning                                        | Who verifies       |
| ------ | ---------------------------------------------- | ------------------ |
| `auto` | Passes automated check (test, lint, build)     | CI / agent         |
| `demo` | Demonstrated working in dev environment        | Agent or developer |
| `user` | Confirmed acceptable by the user / stakeholder | User               |

A task is **done** only when its verification column shows a pass.
Agents may mark `auto` and `demo` items. Only the user may mark `user` items.

---

## Status Legend

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Done and verified
- `[!]` — Blocked or needs attention

---
