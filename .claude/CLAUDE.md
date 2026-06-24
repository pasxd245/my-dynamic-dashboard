# CLAUDE.md — Project Instructions

<!-- import file -->
@../.agents/AGENTS.md

## General instructions

> **Shared knowledge base**: [AGENTS.md](../.agents/AGENTS.md)
> It defines pair programming workflows, decision frameworks, and the `.agents/` directory structure.
> Load it first for full context before starting any task.

## Claude Code Instructions

Claude Code loads this file at cold start. Treat the imported agent constitution as project instructions.

If the import fails or `.agents/AGENTS.md` is unavailable, stop before making changes, state that you could not load it, and ask the user how to proceed.

On a resumed session, follow AGENTS.md's **Load Order**, then — in one message — summarize the current round state from code-sourced truth and name the next gate **before** any long work. Don't spend the first turn on broad exploration.
