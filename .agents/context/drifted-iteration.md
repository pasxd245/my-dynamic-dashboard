# Drifted Iteration — Reference Hub

> The canonical "what is the drifted iteration, how do we cite it,
> when does it go away" hub. Memory and design docs that mine
> lessons from drifted route through this file instead of
> redocumenting the context.

_Track: agent-method. Pulled by: [Round 10](../plan/cycles/Round_10.md)
HIxAI review (citation-rot risk needed a structural answer).
Promoted in the same review pass that closed Round 10._

## What this is

The drifted iteration is the **prior attempt at this same product** —
a previous AI-built version of my-dynamic-dashboard that ran ~35
rounds before the team concluded it had drifted past recoverable
state (UI/BIZ entanglement, late `@mdd/ui` extraction, BIZ context in
look-and-feel-only code — see
[shell distillation](../memory/2026-05-23-drifted-shell-distillation.md)
REJECT entries for specifics). It lives at
`tmp/ref-apps/my-dynamic-dashboard-drifted/` as **read-only,
gitignored, local-only** reference material. Lifecycle: copied in
2026-05-22; actively mined round-by-round; removed when the last
ADOPT-VIA-ROUND pull from any active distillation memo lands
(R12–R15 window). Per [AGENTS.md](../AGENTS.md)'s "Preserve what
works" rule, no round may re-import capabilities from drifted
unless that round explicitly pulls them in.

After retirement this hub remains as the durable record; the
extracted-lesson memos stand alone (their principles don't depend
on the source being present).

## Extracted lessons — index

| Memory                                                                           | Subject                                     | Status                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| [build-first UI/BIZ boundary](../memory/2026-05-22-ui-boundary-build-first.md)   | Why `@mdd/ui` is scaffolded before BIZ      | High confidence; founding lesson                  |
| [python tooling (uv)](../memory/2026-05-22-python-tooling-uv.md)                 | Backend Python toolchain choice             | Adopted                                           |
| [round-roadmap deferrals](../memory/2026-05-22-round-roadmap-deferrals.md)       | What drifted built that we permanently skip | Permanent exclusions                              |
| [drifted shell distillation](../memory/2026-05-23-drifted-shell-distillation.md) | 20-bullet AppShell pull-list                | 3 ADOPT-NOW, 8 ADOPT-VIA-ROUND, 5 DEFER, 4 REJECT |

## Citation discipline

`tmp/ref-apps/` references use **inline code spans, never markdown
links** — links 404 when `tmp/` is removed; code spans rot
gracefully into stale path strings. Applies from R10 onward; R10
swept its own outputs.

- ❌ Bad: `[design-guidelines.md](../../tmp/ref-apps/my-dynamic-dashboard-drifted/docs/agents/design/design-guidelines.md)`
- ✅ Good: ``drifted `design-guidelines.md` § 3.1``
- ✅ Good: ``per `tmp/ref-apps/my-dynamic-dashboard-drifted/packages/ui/src/Components/MasterLayout/index.tsx:52` ``

Conformance check (should return zero matches, except the
intentional ❌ Bad teaching example above):

```bash
grep -rnE '\[[^]]+\]\([^)]*tmp/ref-apps[^)]*\)' .agents/
```

## Extracting a new lesson

Open `.agents/memory/YYYY-MM-DD-<topic>.md` from
[`_TEMPLATE.md`](../memory/_TEMPLATE.md). Cite drifted with inline
code spans only. Add a row to the index above. For curated
pull-lists (multiple entries), tag each with **ADOPT-NOW** /
**ADOPT-VIA-ROUND** / **DEFER** / **REJECT** — see the
[shell distillation](../memory/2026-05-23-drifted-shell-distillation.md)
as the worked example. The authoring round is the citation per the
[Evolution Rule](../AGENTS.md).

## Retiring drifted

When triggered (last ADOPT-VIA-ROUND lands, or stakeholder calls it
done), run this as its own dedicated round — never bundled with
feature work:

1. Confirm no in-flight round depends on it
   (`grep tmp/ref-apps .agents/plan/cycles/Round_*.md`).
2. `rm -rf tmp/ref-apps/my-dynamic-dashboard-drifted/`.
3. Run the conformance grep above; convert any surviving markdown
   links to inline code spans (should be zero if discipline held).
   Stale code spans stay — they're evidence, not navigation.
4. Update the Lifecycle line above to `Retired YYYY-MM-DD`.
