# Specs

Spec-driven development artifacts for `my-dynamic-dashboard`, managed
via [Spec Kit](https://github.com/github/spec-kit).

## Layout

- One directory per feature, named `NNN-short-name/`.
- Each directory holds (as it progresses): `spec.md`, `plan.md`,
  `tasks.md`, plus any clarifications, checklists, and analysis
  artifacts.

## Authoring flow

Use the slash commands inside the configured AI agent (Copilot, Claude,
etc.):

1. `/speckit.constitution` — establish or amend `.specify/memory/constitution.md`.
2. `/speckit.specify` — create the feature spec (this directory).
3. `/speckit.clarify` *(optional)* — ask structured questions to de-risk ambiguity.
4. `/speckit.plan` — create the implementation plan.
5. `/speckit.tasks` — generate actionable tasks.
6. `/speckit.analyze` *(optional)* — cross-artifact consistency check.
7. `/speckit.checklist` *(optional)* — quality / readiness checklists.
8. `/speckit.implement` — execute the plan.

## Constitution

Project-wide non-negotiables live in
[`.specify/memory/constitution.md`](../.specify/memory/constitution.md).
Every spec MUST cite the principles it relies on (see
`001-upload-profile-field-roles/spec.md` for the pattern).

## Current pilot

- [`001-upload-profile-field-roles`](./001-upload-profile-field-roles/spec.md)
  — MVP 1: Upload + Profile + Field Roles. Status: Draft.
