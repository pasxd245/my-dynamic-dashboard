# AGENTS.md — Project Instructions

## General instructions

> **Shared knowledge base**: [AGENTS.md](.agents/AGENTS.md)
> It defines pair programming workflows, decision frameworks, and the `.agents/` directory structure.
> Load it first for full context before starting any task.

<!--

## Your instructions here

-->

## Spec-driven development (Spec Kit)

This repo uses [Spec Kit](https://github.com/github/spec-kit) for SDD.

- Constitution: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
- Specs: [`specs/`](specs/) — one directory per feature.
- Workflow: `/speckit.constitution` → `/speckit.specify` → `/speckit.clarify`
  *(optional)* → `/speckit.plan` → `/speckit.tasks` →
  `/speckit.analyze` / `/speckit.checklist` *(optional)* →
  `/speckit.implement`.
- Pilot in flight: [`specs/001-upload-profile-field-roles/spec.md`](specs/001-upload-profile-field-roles/spec.md).

Every non-trivial feature MUST go through this flow and respect the
constitution's principles (business-question-first, metric contracts,
relationship rules, reconciliation, challenge / sensitivity gates,
traceability, reproducibility).
