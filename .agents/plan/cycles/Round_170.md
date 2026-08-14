# Round 170: the link gate tells the truth — fixing the checker, not the links

**Status**: Complete — 2026-08-14. `check:links` **24 → 8**, zero regressions; the 8 are genuine.
**Flow**: **N/A** — Track-2 tooling round. `flow-selector` explicitly skips process / docs /
tooling rounds; there is no product surface and no contract.
**Date started**: 2026-08-14
**Date completed**: 2026-08-14

## ⟢ At a glance

**Shipped** — **the link gate went from 24 reported breaks to 8, and all 8 are real.** Two small
edits: `slugify` stops collapsing consecutive and edge hyphens (GitHub collapses neither), and a
narrow `^L\d+(-L\d+)?$` recognises the line-reference form `CLAUDE.md` itself mandates. No new
mechanism, no new gate — an existing one made honest.

**Studied** — **the plan's `_Falsified if_` fired on the first run, and chasing it produced the
round's real finding.** Ten links that previously passed broke, which the plan had named as the
signal that the diagnosis was incomplete. It was: **the corpus held two slug conventions, and the
broken checker was masking ten genuine breaks** while reporting eleven correct links as broken. The
old `slugify` was wrong in **both directions at once** — the 24 was not an over-count, it was a
mix. All ten targets were verified to exist before repointing, which is what separates this from
the rot the round deliberately left alone.

**Watch**

- **A one-line diagnosis made on strong evidence was still incomplete.** MD051 disagreeing with
  `check_links` on the same line proved the false positives and said nothing about false
  **negatives** — and a validator wrong in one direction is usually wrong in the other. Diffing the
  before/after **sets** is what caught it; a count would have shown 24 → 8 and looked like success.
- **8 rotted links remain, deliberately visible.** Repairing them means editing eight Complete
  rounds (`unlink`, not repointing — the targets are gone). Human's call, and now unmissable.
- **No slug lint proposed.** One convention survives; a standing rule to enforce it is a new
  mechanism and the default is don't-add until a second instance appears.

## Goal

**Inherits from ← [Round_169](Round_169.md)** — which ran `markdown-check-link` on request and
found that **16 of the 24 reported breaks are not breaks**. The gate has reported 24 for many
rounds and nobody has acted on it, which is the symptom this round treats: a gate that is
two-thirds false trains its readers to ignore it, and a real break hides in the noise.

_Track: **2** (agent-method — a repo gate that reports false positives). Pulled by: R169's
`markdown-check-link` triage, which measured the false-positive rate and located the defect at one
line. Artifact + tooling only, inside the [R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md)._

**This is a correction, not a capability.** No new skill, no new gate, no new mechanism — the
Evolution Rule's default is don't-add, and this adds nothing. It makes an existing gate honest.

## Plan

**Expected outcome**: `check:links` reports **8** broken links, all of them real, and the 8 are
the genuine rot R169 triaged (targets deliberately deleted by R153 / R166 / R167).

**Falsified if**: the slug change breaks links that currently pass. The whole argument is that the
checker is stricter-and-wrong; if relaxing it turns previously-green links red, the diagnosis was
incomplete and the fix must be re-derived. **The before/after broken set is diffed, not counted** —
a count going 24 → 8 could hide a swap.

### The two defects, and why 24 → 8 needs both

R169's triage split the 24 into three groups. This round closes the two that are checker error:

| Group | Count | Defect |
| ----- | ----: | ------ |
| **1 — em-dash slugs** | **11** | `slugify` collapses `-+` → `-` and strips trailing `-`. GitHub does neither. |
| **2 — `#L<n>` line refs** | **5** | The checker resolves fragments only as headings; a line reference can never match one. |
| **3 — genuine rot** | **8** | Real. **Out of scope** — see below. |

#### Defect 1 — `slugify` is stricter than GitHub

[`parse.py:159`](../../skills/markdown-check-link/scripts/parse.py):

```python
s = re.sub(r"-+", "-", s).strip("-")   # GitHub does neither
```

A heading containing ` — ` (em-dash **with spaces**) strips to **two spaces** → **two hyphens**;
GitHub keeps them, and keeps a trailing hyphen left by a stripped trailing emoji.

| | |
| --- | --- |
| Heading | `### R109 — line / time-series ✅` |
| GitHub slug | `r109--line--time-series-` ← **what the links use** |
| `check_links` slug | `r109-line-time-series` |

**The decisive evidence is internal to this repo**: `MD051` (link-fragments-should-be-valid) is
**enabled** — `.markdownlint-cli2.jsonc` disables ten rules and not that one — and `pnpm md:lint`
reports **0 errors across 313 files**. So `Round_88.md:232`'s same-file fragment is **valid to
markdownlint and broken to `check_links`, on the same line**. Two linters, one repo, opposite
verdicts. One of them is wrong, and MD051 is the one that agrees with GitHub.

**This reverses the standing workaround.** [[markdown-anchor-slug-linter-conflict]] recorded the
advice "use `:` not ` — ` in same-file-linked headings" — distorting headings across the corpus to
satisfy the weaker tool. The evidence points the other way.

#### Defect 2 — `#L<n>` is a line reference, not a heading

`Round_92.md` uses `#L215`, `#L135`, `#L321`, `#L52` and `canvas.md#L115-L116`. That is the
convention **`CLAUDE.md` itself mandates** (_"For specific lines: `[filename.ts:42](src/filename.ts#L42)`"_),
and GitHub / the IDE resolve it. It is not a heading and never will be, so a heading-only fragment
check must recognise the form rather than report it.

The skill's own `as-is` resolution documents this exact case — but that lives in a **gitignored**
scratch file, so it fixes one person's run and not CI or a teammate's. The recognition belongs in
the checker.

### Explicitly NOT in this round

- **The 8 genuinely-rotted links** (Group 3). They sit in **Complete, append-only rounds** and were
  accurate when written. The honest repair is the skill's `unlink` (demote `[text](target)` →
  `` `target` ``), **not** repointing them at today's docs — that would make those rounds claim
  they cited something they did not. It is a separate editorial call for the human, and this round
  deliberately leaves the number at 8 so the remaining breaks are visible.
- **Auto-fix / `--fix` behaviour**, the suggestion scorer, and the `resolution` vocabulary — all
  untouched.
- **Any product code.**

## Risks / unknowns

| Risk | Why it matters | Handling |
| ---- | -------------- | -------- |
| **Relaxing the slug could turn a passing link red.** | The fix's whole premise is that the checker is wrong in one direction. A regression means the premise is wrong. | **Diff the before/after broken sets**, not the counts. The before set is captured to disk first. |
| **`.strip("-")` may be load-bearing for some heading shape** the corpus does not currently exercise. | Removing it to match GitHub is right in principle but only tested against this corpus. | Verified against all 313 files + 885 candidate targets; the diff is the evidence. |
| **A new false NEGATIVE** — a link that should break now passes. | A gate that under-reports is worse than one that over-reports. | The `#L<n>` recognition is narrowly anchored (`^L\d+(-L\d+)?$`), not a general "fragment I can't resolve is fine". |

## Do

### The fix — 2026-08-14

**Two edits, both small, both in the skill's scripts:**

1. **[`parse.py` `slugify`](../../skills/markdown-check-link/scripts/parse.py)** — dropped
   `re.sub(r"-+", "-", s).strip("-")`. GitHub collapses neither consecutive hyphens nor edge ones,
   and the docstring now carries the worked example so the next reader does not re-derive it.
2. **[`check_links.py`](../../skills/markdown-check-link/scripts/check_links.py)** — a narrow
   `LINE_REF_RE = ^L\d+(?:-L\d+)?$`, consulted in **both** fragment branches (same-file and
   cross-file). Deliberately narrow: not _"a fragment I cannot resolve is fine"_, which would turn
   the gate into a false negative.

### The `_Falsified if_` FIRED — and it found something better than it predicted

§ Plan said: _"Falsified if the slug change breaks links that currently pass… the diagnosis was
incomplete and the fix must be re-derived."_ **It did — 10 links that passed before now broke.**
This is exactly why the plan diffed the before/after **sets** rather than the counts: a 24 → 8 that
swapped members would have looked like success.

**The diagnosis was incomplete, and re-deriving it produced the round's real finding: the corpus
contains BOTH slug conventions, and the checker's bug was MASKING 10 genuine breaks.**

| Written as | Example | Old checker | GitHub |
| ---------- | ------- | ----------- | ------ |
| **GitHub form** (double hyphens) | `#r109--line--time-series-` | ✗ reported broken | ✓ resolves |
| **Collapsed form** (single hyphens) | `#surfaces-layer-reuse-purity-declaration` | ✓ reported fine | ✗ **does not resolve** |

The old `slugify` validated the collapsed form and rejected the correct one — so it was wrong in
**both directions at once**, and the 24 it reported was neither an over-count nor an under-count
but a **mix**.

**All ten targets were verified to EXIST** before touching anything — `## Surfaces — layer /
reuse / purity declaration`, `## Transform steps (workflows) — R120–R141`,
`### Refresh interaction — …`, `## Amendment — 2026-06-13 (R69 post-mortem)`,
`## Feeds into → Round_53 — …`, `### Close-triage agenda (drafted — …)`. Nothing was deleted or
renamed; the links were simply mis-slugged and nothing could tell anyone, because the one tool
that would have has been agreeing with the mistake.

**So the ten were repointed** to the slug their target actually generates, across ten files
including five Complete rounds and `gate-walker/SKILL.md`. That is **pointer maintenance, not
history rewriting** — the target exists, the link claims to reach it, and now it does. It is a
different act from Group 3, where the target is gone and repointing would make a round claim it
cited something it never did.

### Result — measured, and diffed rather than counted

```text
before = 24    after = 8    newly-broken = 0
```

The remaining **8** are precisely R169's Group 3, unchanged and still real: `ColumnsManager.tsx`
(deleted at R153) and seven anchors deleted when R166 withdrew create mode and R167 retired
composition. They are **left visible on purpose** — this round makes the gate honest, it does not
launder the last of the rot out of sight.

**Gates**: `md:lint` 0/314 · `plan:lint` 0/170 · `design:lint` 0/14 · `design:tokens` 0/11 ·
`check:links` **8, all genuine**. No product code touched.

## Check

| # | Criterion | Verdict |
| - | --------- | ------- |
| 1 | The 11 em-dash-slug links resolve | ✅ all pass |
| 2 | The 5 `#L<n>` line references resolve | ✅ all pass |
| 3 | **No link that passed before now fails** | ✅ **0 newly-broken** — after the 10 masked breaks were repaired |
| 4 | The remaining breaks are exactly R169's Group 3 | ✅ 8, member-for-member |
| 5 | `MD051` still agrees (no heading was changed) | ✅ `md:lint` 0/314 |
| 6 | No product code touched | ✅ two script files + link targets only |

**Criterion 3 is the one that mattered**, and it failed on the first run. The fix is only correct
because the failure was chased rather than the count accepted.

## Act

**The gate now means something**: 8 reported breaks, 8 real. Anyone who runs `check:links` from
here gets a signal instead of a number they have learned to skip.

**The lesson is the falsification, not the fix.** A one-line diagnosis was made on strong
evidence — MD051 vs `check_links` disagreeing on the same line — and it was still incomplete,
because it explained the false **positives** and never asked whether the same bug produced false
**negatives**. It did: ten of them. Recorded as
[[a-wrong-validator-hides-breaks-in-both-directions]].

**Carried, not absorbed:**

- **The 8 remaining rotted links** — the honest repair is the skill's `unlink` (demote
  `[text](target)` → `` `target` ``), which keeps the historical reference readable without
  asserting a link that cannot resolve. It edits eight Complete rounds, so it is the human's call,
  and the gate now shows exactly 8 rather than hiding them in 24.
- **A slug-form lint** is *not* proposed. Two conventions existed in the corpus and now one does;
  a rule to keep it that way is a new standing mechanism, and the Evolution Rule's default is
  don't-add until a second drift instance appears. The gate itself is the guard now that it is
  correct.

## Feeds into

A link gate that means something — so the next round that touches Markdown gets a signal instead
of a number it has learned to skip.
