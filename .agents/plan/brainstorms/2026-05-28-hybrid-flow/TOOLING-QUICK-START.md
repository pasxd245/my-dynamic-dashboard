# Design Preview Tooling — Executive Summary & Quick Start

**Generated**: 2026-05-28 | **Full analysis**: [TOOLING-ANALYSIS-2026-05-28.md](TOOLING-ANALYSIS-2026-05-28.md)

---

## Current State

✅ **Working**: Hand-rolled HTML + Tailwind CDN + custom CSS  
✅ **Unblocking**: R14 absorbed 4 reframes; design-first thesis validated  
⚠️ **At risk**: Token drift, fidelity feedback loop, duplication accumulation

---

## The One Critical Issue (Fix Now)

### Token Drift is a Blocker

**Problem**: `_css/tokens.css` is hand-copied from `workspace/packages/ui/src/themeTokens.ts`. When production tokens change, the preview becomes a visual lie.

**Example**: Dev changes primary color in themeTokens.ts; designer prototypes against stale token; 30 min lost in misalignment.

**Solution**: Auto-sync tokens via script (2 hours, one-time).

---

## The Second Critical Issue (Quantify Now)

### Fidelity Sign-off is Undefined

**Problem**: All previews claim "~90% fidelity" but no checklist, no measure, no sign-off criteria. Designer has no objective way to know when a preview is "done."

**Solution**: Add fidelity checklist template (1 hour, one-time).

```markdown
# Fidelity Checklist
- [ ] Spacing: padding/margin from tokens.css
- [ ] Typography: font sizes accurate
- [ ] Colors: using production tokens
- [ ] Hover/focus/error states: present
- [ ] Responsive: desktop + mobile tested
- [ ] WCAG AA contrast verified

Designer sign-off: _______ Date: _______
```

---

## Other Issues (Monitor, Escalate Later)

| Issue | Risk | Next step |
|-------|------|-----------|
| CDN overhead (90 KB unused) | 🟡 MED | Escalate R31+ if 15+ previews |
| CSS duplication | 🟡 MED | Document patterns now, extract R31+ |
| State management (toggles only) | 🟠 LOW-MED | Add Alpine.js only if 3+ complex features |
| Manual index maintenance | 🟡 MED | Auto-discovery script if 20+ previews |

---

## Recommendation: Phase 1 (Now) + Phase 2 (Later)

### Phase 1: Unblock Immediate Pain (6-8 hours total)

**Task 1.1** — Auto-sync tokens (~2h)

- Create `scripts/sync-preview-tokens.mjs`
- Hook into pre-commit
- Update design/README.md

**Task 1.2** — Fidelity checklist (~1h)

- Create `.agents/design/_templates/fidelity-checklist.md`
- Add to design round templates

**Task 1.3** — Document patterns (~1.5h)

- Create `.agents/design/_css/PATTERNS.md`
- Reference all live patterns by preview

**Task 1.4** — Validate & update docs (~1.5h)

- Update design/README.md with workflow
- Add to `plan/PDCA.md` (design round template)

**Impact**: Fixes token drift + fidelity feedback. Unblocks 3-5 more D-rounds. Zero rework to existing previews.

### Phase 2: Escalate Only If Metrics Exceed Thresholds (R31+)

**Escalate to Option C (local build) if**:

- Duplication > 30% of new preview authoring time
- Total previews > 15
- New preview authoring > 20 min per pattern

**Escalate to Option D (component lib) if**:

- State branching complexity > 3 independent states per preview
- Design becomes core to feedback loop

---

## Why This Path?

| Approach | Cost | Time to value | Fits now? |
|----------|------|---|---|
| Status quo (do nothing) | 0 | Now | ❌ Token drift will bite |
| Phase 1 (fix + docs) | ~6h | Next session | ✅ **Unblocks 5 more rounds** |
| Option C (local build) | ~12h | 2 weeks | ❌ Premature at 7 previews |
| Option D (component lib) | ~50h | 4 weeks | ❌ Over-engineered |

---

## Next Step

**Owner**: [TBD]  
**Timeline**: R28-R30  
**Approval**: Human lead (this summary + full analysis)

Escalate Phase 1 tasks to next available agent or session. All 4 tasks are independent and can run in parallel or sequence.

---

## Reference Links

- Full analysis: [TOOLING-ANALYSIS-2026-05-28.md](TOOLING-ANALYSIS-2026-05-28.md)
- Design methodology: [README.md](README.md)
- DCBF context: [../../../context/contract-driven-feature.md](../../../context/_archive/contract-driven-feature.md)
- Design-first lesson: [../../../memory/2026-05-24-design-first-reframe-absorption.md](../../../memory/2026-05-24-design-first-reframe-absorption.md)
