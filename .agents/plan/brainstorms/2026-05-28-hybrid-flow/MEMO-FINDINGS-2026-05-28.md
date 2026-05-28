# Memo: Design Preview Tooling Analysis — Findings & Path Forward

**From**: Deep scan of `.agents/design/` DCBF D-round workflow  
**To**: Product lead + future design round decisions  
**Date**: 2026-05-28  
**Status**: Complete scan; no changes to source files

---

## TL;DR

Current approach (hand-rolled HTML + Tailwind CDN + custom CSS) is **working but has 6 real-world issues**. Two are **critical and fixable now** (6-8 hours total):

1. **Token drift** (HIGH) — tokens.css is manually mirrored; goes stale when production changes
2. **Fidelity feedback** (HIGH) — "~90% fidelity" undefined; no sign-off criteria

Other four (duplication, state complexity, CDN overhead, index maintenance) are manageable at current scale but will bite at 15+ previews. **Recommend: fix the two critical issues now. Escalate tooling upgrades only if metrics cross thresholds by R31.**

---

## What I Found

### Current Stack (Working)

- **Hosting**: Static HTML files (open directly from `file://`)
- **Framework**: Tailwind CDN (`https://cdn.tailwindcss.com`) + ~150-250 lines custom CSS per preview
- **Tokens**: Manual CSS mirror (`_css/tokens.css` copies `workspace/packages/ui/src/themeTokens.ts`)
- **Shared chrome**: Extracted CSS + vanilla JS (sidebar, topbar, nav toggle)
- **Build**: None (no PostCSS, no bundling)
- **Current scope**: 7-8 live previews; growing

### The 6 Issues (Ranked by Impact)

| # | Issue | Severity | When it hurts | Today's workaround |
|---|-------|----------|---------------|-------------------|
| 1 | **Token drift** | 🔴 HIGH | Per UI token change | Manual sync, hope you don't forget |
| 5 | **Fidelity feedback** | 🔴 HIGH | D-round sign-off | Guess "~90% ready" |
| 2 | **CDN + CSS overlap** | 🟡 MED | Per new preview | Decide Tailwind vs CSS case-by-case |
| 3 | **No component library** | 🟡 MED | Per new pattern | Copy-paste + hope it stays consistent |
| 6 | **Manual index** | 🟡 MED | Per new preview | Edit index.html, pray links don't rot |
| 4 | **State mgmt limited** | 🟠 LOW-MED | Complex features | Pre-render all states in hidden HTML |

---

## Real-world Risk Assessment (Be Critical)

### ✅ Things Working Well

- **No build step** — designers can open preview.html in browser directly
- **R14 validated it** — 4 reframes absorbed safely; cross-linked previews surface framing errors
- **Reusable chrome extracted** — tokens.css + preview-shell.css + preview-shell.js saved duplication
- **Lightweight overall** — ~20 KB custom code across all previews

### ⚠️ Pain Points Emerging

- **Token sync is tedious** — 5-10 min per change, error-prone, human-dependent
- **Fidelity is subjective** — "~90%" is aspirational, not measured; designer/dev mismatch at handoff
- **Duplication will compound** — at 15+ previews, 30-50% of new CSS will be copy-paste
- **State complexity grows unseen** — next complex feature (wizard with 5 paths) will expose limits

### 🔴 If We Do Nothing

- **R29-30**: Token drift bites; designer + dev misaligned on colors/spacing
- **R31-35**: Duplication becomes 20-30% of authoring time; no shared component library
- **R35+**: State complexity forces HTML bloat or re-architecting

---

## Options Evaluated

### Option A: Keep current (status quo)

**Cost**: 0 | **Risk**: All 6 issues accumulate | **When to use**: Only if next 3 D-rounds stay simple

### Option B: Hand-rolled CSS only (drop Tailwind)

**Cost**: 30-40% more CSS | **Benefit**: Removes CDN lock | **When**: Never (doesn't solve core issues)

### Option C: Tailwind + local build (PostCSS purge)

**Cost**: ~12-16h setup; breaks `file://` | **Benefit**: CDN removed, tokens auto-sync, component extraction possible | **When**: R31+ if scale exceeds 10-15 previews

### Option D: Component library (Lit/Astro)

**Cost**: ~40-60h setup | **Benefit**: Scalable, typed, solves duplication + state | **When**: Only if design becomes core to product velocity

### **Option E: Hybrid (current + token sync + docs)** ← **RECOMMENDED NOW**

**Cost**: ~6h setup | **Benefit**: Fixes the 2 critical issues; unblocks 5 more D-rounds | **When**: R28-R30 (now)

---

## Recommendation: Phased, Risk-Aware Path

### Phase 1: Now (R28-R30) — Fix Critical Issues

**Four independent tasks (~6-8h total, can run in parallel)**

1. **Auto-sync tokens** (2h)
   - Create `scripts/sync-preview-tokens.mjs`
   - Hook into pre-commit
   - Eliminates Issue #1 (token drift)

2. **Fidelity checklist** (1h)
   - Create `.agents/design/_templates/fidelity-checklist.md`
   - Eliminates Issue #5 (fidelity feedback)

3. **Document patterns** (1.5h)
   - Create `.agents/design/_css/PATTERNS.md`
   - Mitigates Issue #3 (duplication awareness)

4. **Update docs** (1.5h)
   - Add workflow to design/README.md
   - Add checklist to design round template

**Outcome**: Designers can trust tokens are fresh. D-round sign-off is objective. 3-5 more D-rounds unblocked.

### Phase 2: Escalate Only If Metrics Exceed Thresholds (R31+)

**Decision criteria** (measure after Phase 1 + 3-5 more D-rounds):

- **If duplication > 30% of authoring time** → Option C (local build)
- **If previews > 15** → Option C (local build)
- **If state branching > 3 independent states** → Add Alpine.js or escalate
- **If design becomes core to feedback** → Option D (component library)

---

## Why This Path?

- **Unblocks immediately** — token drift is a blocker now; fidelity checklist needed for sign-off
- **Low cost** — 6 hours, mostly documentation + one simple script
- **Zero rework** — existing previews keep working unchanged
- **Buys time** — Phase 2 decision driven by real usage data, not speculation
- **Preserves simplicity** — "no build, open from file://" benefit stays through R32

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Token sync script breaks | LOW | Add to test suite; validate before commit |
| Checklists unused | LOW | Add to design round template (PDCA.md); require sign-off |
| Designer still forgets tokens | LOW | Hook auto-sync into pre-commit; can't forget |
| Escalation needed sooner than R31 | MED | Measure duplication + state complexity after R29-30 |

---

## What I Didn't Change

✅ No files modified  
✅ No decisions made on your behalf  
✅ Two new reference documents created (in `.agents/design/`):

- `TOOLING-ANALYSIS-2026-05-28.md` (full deep-dive, trade-off tables)
- `TOOLING-QUICK-START.md` (executive summary, action items)

---

## Next Step

**Approve Phase 1** (or request clarification on any issue).  
**Assign owner** to Task 1.1-1.4 (can be single agent or split across sessions).  
**Timeline**: Fit into R28-R30 planning.

---

## Questions for Clarification?

1. **Should we add auto-discovery for index.html** (Phase 1.4+) or keep it manual?
2. **Fidelity checklist**: Do you want screenshot diffing post-implementation (optional, R31+)?
3. **Pattern documentation**: Should this live in design/README.md or separate file?
4. **Owner**: Who owns Phase 1 implementation?

---

**Reference**: Full trade-off analysis + detailed issue breakdown → [.agents/design/TOOLING-ANALYSIS-2026-05-28.md](TOOLING-ANALYSIS-2026-05-28.md)
