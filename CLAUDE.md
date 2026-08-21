# CLAUDE.md — Project Instructions

## General instructions

> **Shared knowledge base**: [AGENTS.md](.agents/AGENTS.md)
> It defines pair programming workflows, decision frameworks, and the `.agents/` directory structure.
> Load it first for full context before starting any task.

<!--

## Your instructions here

-->

<!-- import file -->
@.agents/AGENTS.md

## Claude Code Instructions

Claude Code loads this file at cold start. Treat the imported agent constitution as project instructions.

If the import fails or `.agents/AGENTS.md` is unavailable, stop before making changes, state that you could not load it, and ask the user how to proceed.

On a resumed session, follow AGENTS.md's **Load Order**, then — in one message — summarize the current round state from code-sourced truth and name the next gate **before** any long work. Don't spend the first turn on broad exploration.

<!-- OPENWIKI:START -->

## OpenWiki

This repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading.

- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements.
- Prefer the narrowest quiet validation that proves the changed behavior. Preserve complete failure output.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
