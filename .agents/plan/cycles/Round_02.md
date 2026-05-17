# Round 02: Promote bug-fix SKILL.md frontmatter to current spec

**Status**: Review
**Date started**: 2026-05-17
**Date completed**: _(set on human approval)_

## Goal

Promote bug-fix SKILL.md frontmatter to current spec

### Requirements

- **R01** — Boundary: only .agents/skills/bug-fix/SKILL.md may be modified
- **R02** — Bring its frontmatter (name, description, metadata) in line with the shape used by newer skills like pdca-next and clean-code
- **R03** — Preserve all section body content below the frontmatter; only edit the YAML block
- **R04** — File must still pass markdownlint and the frontmatter must remain valid YAML

## Plan

- [ ] **P1** — Read `.agents/skills/bug-fix/SKILL.md` lines 1-12 and at least two reference skills (`pdca-next`, `skill-creator`) frontmatter to capture the exact current spec shape
- [ ] **P2** — Diff bug-fix frontmatter against the reference shape field-by-field (keys, nesting, value types) and list any deltas
- [ ] **P3** — If deltas exist, edit only the YAML frontmatter block (lines 1-12) of `.agents/skills/bug-fix/SKILL.md` to close them; if no deltas exist, record a no-op outcome
- [ ] **P4** — Validate the edited (or unchanged) frontmatter parses as valid YAML with the expected keys (`name`, `description`, `metadata.author`, `metadata.version`)
- [ ] **P5** — Verify lines 13+ of `.agents/skills/bug-fix/SKILL.md` are byte-identical to the original (body-frozen constraint)

## Do

### Findings (6)

- **tool:file-read** — The bug-fix SKILL.md frontmatter already has the same three top-level keys (name, description, metadata) as the newer skills pdca-next, skill-creator, and research. _(bug-fix/SKILL.md lines 1-12 show `name: bug-fix`, `description: >`, `metadata: { author: human, version: '1.0' }` — structurally identical to pdca-next/SKILL.md lines 1-7 and research/SKILL.md lines 1-7.)_
- **tool:file-read** — The bug-fix description uses a YAML folded block scalar (`>`) spanning six lines, while newer single-line skills like pdca-next and research use inline strings — but clean-code also uses `>`, so the block scalar form is accepted by the current spec. _(bug-fix/SKILL.md lines 3-8 use `description: >` with continuation lines; clean-code/SKILL.md lines 3-7 also use `description: >`; pdca-next/SKILL.md line 3 uses an inline string.)_
- **tool:file-read** — clean-code/SKILL.md is missing the `metadata` block entirely, which means it — not bug-fix — is the outlier; bug-fix already includes `metadata.author` and `metadata.version`. _(clean-code/SKILL.md lines 1-8 show only `name` and `description` with no `metadata:` key, while bug-fix/SKILL.md lines 9-11 include `metadata: { author: human, version: '1.0' }`.)_
- **inference** — The bug-fix SKILL.md frontmatter is already conformant with the current spec shape; no fields are missing or misnamed compared to the reference skills pdca-next, skill-creator, and research. _(Cross-comparing all five SKILL.md frontmatters read via tool:file-read, bug-fix has every key the newer skills have (name, description, metadata.author, metadata.version) and no extra or deprecated keys.)_
- **tool:file-read** — The ripgrep hits provided are entirely from vendored third-party packages (pyarrow, pygments) and unrelated project files; none reference `.agents/skills/bug-fix/SKILL.md` or any skill frontmatter. _(All 30+ ripgrep hits are in paths like `apps/backend/.venv-feature011-devtest/lib/python3.12/site-packages/` or `docs/analysis/`, `apps/backend/app/services/` — zero hits in `.agents/skills/`.)_
- **tool:file-read** — Section body content below the frontmatter (lines 13-184) is well-structured with seven procedure steps, anti-patterns, and PDCA pairing — R03 constraint is easily satisfiable since no body changes are needed. _(bug-fix/SKILL.md lines 14-184 contain ## Trigger, ## Operating Principle, ## Procedure (Steps 1-7), ## Anti-patterns, ## Pairing with PDCA — all cleanly separated from the frontmatter block ending at line 12.)_

### Boundary

- **In scope**: Promote bug-fix SKILL.md frontmatter to match the shape used by pdca-next, skill-creator, and research skills, Edit only the YAML frontmatter block (lines 1-12); body content (lines 13+) is frozen
- **Out of scope**: Any file other than .agents/skills/bug-fix/SKILL.md, Section body content below the frontmatter (lines 13-184), Adding new frontmatter keys not present in the reference skills, Changing the description wording or semantics (only structural/format changes allowed), Modifying clean-code or any other skill's SKILL.md to backfill missing metadata
- **Allowed file globs**: `.agents/skills/bug-fix/SKILL.md`
- **Assumptions**:
  - The bug-fix frontmatter is already structurally conformant (name, description, metadata.author, metadata.version) — the delta is expected to be minimal or zero
  - Block-scalar description (`>`) is accepted by the spec (clean-code uses it too), so no forced conversion to inline string is required
  - metadata flow-mapping style `{ author: human, version: '1.0' }` is equivalent to block-mapping style; either is acceptable
  - If the frontmatter is already fully conformant after inspection, an empty diff (no-op) is a valid outcome

### Change type: `doc`

### Patches (dry-run, 0)

(none)

## Check

### Pre-patch (current HEAD)

- [x] **lint** — pass _(899ms)_

## Act

_Judge verdict_: **approve** at score 1.00

**Learnings**:

- _(human to fill in during review)_

**Promotions**:

- [ ] → context/ : _topic_
- [ ] → skills/ : _topic_
