# Round 20 -> Round 22 Handoff

Date: 2026-05-09  
Source: .agents/plan/cycles/Round_20.md

## Purpose

Preserve next-round ideas and acceptance intent from Round 20 so compaction of rounds 01-20 does not lose execution context for Round 21 and Round 22.

## Locked Carry-Over (Must Survive Compaction)

1. Round 21 selected direction: Spec 007 - Builder Experience Hardening + Workflow Shell.
2. Round 22 proposed direction: Multi-source + Multi-sheet Orchestration.
3. Compaction is process-only; product backlog intent remains active unless explicitly superseded.

## Round 21 Scope Baseline (from Round 20)

1. Connectivity preflight with persistent connection status.
2. Actionable user-facing error system (guidance first, technical detail optional).
3. Workflow-oriented builder shell IA (upload/source, schema/sheet, query, results/saved views).
4. Lightweight docker E2E smoke for workspace create -> upload -> query validate -> saved list.
5. Remove hidden/default workspace fallbacks and surface active workspace/source state.

## Round 22 Candidate Scope (Seed)

1. Multi-sheet Excel picker with preview and include/skip controls.
2. Source registry per workspace with active source selection and processing history.
3. Per-sheet processing feedback with recoverable partial failures.

## Execution Rule

Before deleting compacted round files, verify this handoff note is linked from the active round file and referenced in the next relevant planning round.
