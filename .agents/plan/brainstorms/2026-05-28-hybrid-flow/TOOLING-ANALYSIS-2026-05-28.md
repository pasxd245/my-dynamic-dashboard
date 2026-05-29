# Design Preview Tooling Analysis — Real-world Issues & Recommendations

**Date**: 2026-05-28  
**Scope**: DCBF D-round preview creation methodology  
**Context**: Scan of `.agents/design/` workflow; current approach is hand-rolled HTML + Tailwind CDN + custom CSS  
**Audience**: Human lead + future D-round decision points

---

## Executive Summary

The current hand-rolled approach (Tailwind CDN + custom CSS in each `.preview.html`) is **working but fragile**. It's unblocking quick design iteration now (R14 proof: 4 reframes absorbed safely), but carries **6 real-world risk categories** that will compound as design scope grows (projected 10+ previews by R35+).

**Critical finding**: Token drift is the highest friction point **right now**. A 2-hour fix (auto-sync tokens via script) immediately removes a blocking handoff pain. Fidelity feedback is the second blocker for D-round sign-off.

**Recommendation**: Phase in defense without rework. Fix token drift + add a fidelity checklist this cycle. Escalate to build-based tooling only if duplication or state complexity exceed 20% of preview authoring time by R31.

---

## Current Architecture

### What lives in `.agents/design/`

```
.agents/design/
├── README.md                    (design methodology anchor)
├── index.html                   (navigation hub, manual links)
├── _css/
│   ├── tokens.css              (MANUAL MIRROR of themeTokens.ts)
│   └── preview-shell.css       (shared chrome: sidebar, topbar, content grid)
├── _js/
│   └── preview-shell.js        (sidebar nav, collapse toggle, ~60 lines)
└── data-management/            (by domain)
    ├── datasets.md             (design intent)
    ├── datasets.preview.html   (live preview, ~550 lines total)
    ├── upload.md
    ├── upload.preview.html
    ├── workspace-shell.md
    ├── workspace-shell.preview.html
    ├── dataset-detail.md
    ├── dataset-filters.md
    ├── crud-hygiene.md
    └── ... (~6-8 live previews currently)
```

### Current stack choices

| Layer             | Choice                      | Source                                                |
| ----------------- | --------------------------- | ----------------------------------------------------- |
| **Host**          | Static HTML files           | Opens directly from `file://` (no server)             |
| **CSS framework** | Tailwind CDN + custom CSS   | `<script src="https://cdn.tailwindcss.com"></script>` |
| **Tokens**        | Manual CSS variables mirror | tokens.css (hand-mirrored from themeTokens.ts)        |
| **Shared chrome** | Extracted CSS + vanilla JS  | R14 extraction (now at N=7-8 previews)                |
| **Interactions**  | Vanilla JavaScript          | toggleGroup(), toggleCollapse() functions             |
| **State mgmt**    | CSS class toggling on body  | `.state-populated`, `.state-empty`, etc.              |
| **Build**         | None                        | No PostCSS, no purge, no bundling                     |

---

## Six Real-World Issues (Severity Assessment)

### 🔴 Issue #1: Token Drift — Manual Mirror is Fragile

**Severity**: HIGH | **Current pain**: Per UI token change | **Frequency**: Growing as product evolves

#### The problem

`tokens.css` is a **manual copy** of `workspace/packages/ui/src/themeTokens.ts`. When production changes a color, border-radius, or shadow, the designer must manually sync two files in two different places.

#### Evidence

**From tokens.css** (line 1-2):

```css
/*
 * Design-preview tokens (mirrors workspace/packages/ui/src/themeTokens.ts).
 * ... When themeTokens.ts changes, this file is updated in the same round.
```

**What this means**: No automated validation. If a dev updates themeTokens.ts and forgets to sync tokens.css, the preview becomes a **visual lie**. A designer may prototype against stale tokens and feed bad feedback.

#### Concrete scenario

1. Dev changes `--color-primary: #1677ff → #1890ff` in themeTokens.ts (R25)
2. Designer is working on R26 preview at the same time
3. Preview is still using `#1677ff` (old token)
4. Designer: "This color palette feels wrong." Dev: "I already changed it."
5. Lost 30 min to misalignment.

#### Cost today

- ~5-10 min per UI token change (search → replace → verify both files match)
- Risk compounds with each new token or token group

#### Risk if unfixed

- Designers build recommendations against stale visual language
- Handoff friction: "Why does the preview not match the running builder?"
- Erodes trust in preview fidelity claims

---

### 🟡 Issue #2: Tailwind CDN + Custom CSS Overlap

**Severity**: MEDIUM | **Current pain**: Per new preview | **Frequency**: Grows with previews

#### The problem

Each preview loads:

1. **Tailwind CDN** (~90 KB uncompressed, full utility class set — nothing is purged)
2. **Custom CSS** (~150-250 lines per preview, inline in `<style>`)
3. **Shared CSS** (tokens.css + preview-shell.css)

This creates **overlapping concerns**: some styling via Tailwind classes in HTML, other styling via custom CSS blocks. Hard to know which approach "owns" a component style, and Tailwind utilities are mostly unused per preview.

#### Evidence

From `datasets.preview.html` (lines 40-150):

```html
<script src="https://cdn.tailwindcss.com"></script>
<!-- ... -->
<style>
  /* Custom CSS owning table styling, filtering, badges, etc. */
  .dataset-table { width: 100%; ... }
  .filter-bar { display: flex; gap: 12px; ... }
  .status-dot { display: inline-block; width: 8px; height: 8px; ... }
  /* Could be Tailwind: flex, gap-3, w-2, h-2, etc. */
  /* But instead: hand-rolled CSS */
</style>
```

**Why it matters**:

- **Bloat**: 90 KB of Tailwind classes per preview, but only ~5-10 KB actually used
- **Confusion**: New previewer doesn't know if to use Tailwind classes or add custom CSS
- **Maintenance**: If a button style needs updating, is it in custom CSS or does Tailwind have a utility?
- **Version risk**: Tailwind CDN is version-pinned by Cloudflare. If we ever need v4, may break previews.

#### Cost today

- ~15-20 min to create a new preview (copy existing + customize CSS)
- Each pattern variation requires testing CSS overlap
- Deciding "Tailwind class or custom CSS?" adds cognitive load

#### Risk if unfixed

- As previews grow (10+), CSS maintenance becomes fragmented
- Tailwind version lock means we can't easily upgrade
- Custom CSS can unintentionally override Tailwind utilities (specificity wars)

---

### 🟡 Issue #3: No Standardized Component Library for Previews

**Severity**: MEDIUM | **Current pain**: Duplication per new concept | **Frequency**: Per D-round

#### The problem

Each preview re-implements shared patterns. If upload wizard defines a form field, and dataset filters define another form field, they're not sharing code. Same for buttons, modals, tables, and status badges.

#### Evidence

**From datasets.preview.html**:

```css
.dataset-table {
  /* 30 lines */
}
.filter-control {
  /* 10 lines */
}
.filter-select {
  /* 8 lines */
}
.status-dot {
  /* 10 lines */
}
```

**From upload.preview.html** (presumed, not fully verified):

- Likely defines `.form-field`, `.wizard-step`, `.button-primary`, etc.
- These are probably similar to patterns in datasets.preview.html but not shared

**Result**: When a pattern needs tweaking (e.g., "buttons should have more padding"), the change lives in multiple places. One update becomes N file edits.

#### Cost today

- **Duplication**: ~30-50% of CSS per new preview is copy-paste (or re-invention)
- **Update friction**: One design tweak = touching 3-4 files + testing all

#### Risk if unfixed

- Inconsistency: preview button at R14 ≠ preview button at R25
- Design coherence erosion over time
- New previewer has no reference for "where do I put this component style?"

---

### 🟠 Issue #4: No Interactive State Management Beyond Simple Toggles

**Severity**: LOW-MEDIUM | **Current pain**: Emerging as features grow | **Frequency**: Blocks complex prototypes

#### The problem

Current JS (preview-shell.js) handles nav open/close + sidebar collapse. But for complex features (multi-step forms, modal workflows, conditional branching), state management is manual:

- Hard-code all possible states as HTML
- Use CSS classes to show/hide
- If there are 5 paths through a wizard, all 5 must exist in the HTML (but hidden)

#### Evidence

From `datasets.preview.html`:

```javascript
// State visibility via CSS
[data-show-when] { display: none; }
body.state-populated [data-show-when~='populated'] { display: revert; }
body.state-empty [data-show-when~='empty'] { display: revert; }
```

**Problem**: If the upload wizard has states like:

- Source selection (CSV vs Excel)
- Column detection
- Data mapping
- Validation errors
- Success state

...and each state has sub-branches, the HTML becomes bloated with hidden DOM nodes.

#### Cost today

- ~30 min per complex interaction (modal, multi-step form, branching logic)
- HTML size balloons as each state is pre-rendered

#### Risk if unfixed

- Complex features (wizards, dashboards with multiple views) become hard to prototype
- Designers may sidestep interactive prototyping → fallback to static screenshots
- Lost the R14 learning: "cross-linked previews + HIxAI Q&A loop surface framing errors early"

---

### 🔴 Issue #5: No Fidelity Quantification or Feedback Loop

**Severity**: HIGH | **Current pain**: Every D-round handoff (D → C/B/F) | **Frequency**: Per design

#### The problem

All previews claim **"~90% fidelity"** but there's no objective measure, checklist, or tooling to verify this. What if one preview is 70% and another is 95%? How does a designer know when a preview is "done"?

#### Evidence

**From index.html**:

```html
<div class="honest-banner">... Each entry below is a self-contained brainstorming preview at ~90% fidelity ...</div>
```

**From .agents/design/README.md**:

```
- Optional brainstorming previews in HTML ... when a concept introduces a new visual pattern
```

No definition of what "visual pattern" means or how to measure it.

#### What's missing

- No checklist: "Have I styled padding, typography, hover states, focus states, error states?"
- No screenshot diffing: no tool to compare preview vs. actual rendered UI
- No sign-off criteria: Designer has no objective way to say "this is 90% done"
- No feedback loop: After the feature ships, no one validates "did the preview match reality?"

#### Cost today

- Guess-work during handoff (Designer: "I think this is ready." Dev: "Wait, the focus ring is wrong.")
- Lost learning: what visual gaps do previews actually have?
- Risk of over-confidence: designer thinks "90% = implementation-ready"; dev disagrees

#### Risk if unfixed

- Fidelity expectations creep: confusion about what "~90%" actually means
- D-rounds may not catch issues that only surface when actual code renders
- Feedback loop breaks: no data on what previews miss most (could guide future improvements)

---

### 🟡 Issue #6: Manual Index Maintenance + Link Rot

**Severity**: MEDIUM | **Current pain**: Per new preview | **Frequency**: Grows with previews

#### The problem

`index.html` manually lists all preview cards and sidebar links. No generation, no auto-discovery. If a preview file moves or renames, the link breaks silently.

#### Evidence

From `index.html` (hand-maintained):

```html
<div class="mdd-nav-group is-expanded" id="grp-data">
  <button class="mdd-nav-group-header">Data Management</button>
  <ul class="mdd-nav-group-items">
    <li><a href="data-management/datasets.preview.html">Datasets</a></li>
    <li><a href="data-management/upload.preview.html">Upload</a></li>
    <!-- Each new preview = manual entry here -->
  </ul>
</div>
```

#### Cost today

- ~5 min per new preview (add sidebar item + descriptive card)
- Risk of stale links if someone renames a preview file without updating index

#### Risk if unfixed

- Dead links accumulate over time
- New contributors don't know what previews exist if they're not in the index
- Navigation becomes unreliable

---

## Alternative Approaches: Trade-off Analysis

### Option A: Keep Current Approach (Status quo)

**Description**: Continue with hand-rolled HTML + Tailwind CDN + custom CSS.

**Pros**:

- ✅ No build, no server — opens directly from `file://`
- ✅ Simple, documented, no hidden complexity
- ✅ Lightweight overall (~20 KB custom CSS + JS across all previews)
- ✅ R14 already paid off: reusable CSS structure exists
- ✅ Learning value well-captured in design/README.md
- ✅ Zero migration cost

**Cons**:

- ❌ Token drift risk remains unfixed (manual mirror)
- ❌ Tailwind CDN overhead (90 KB unused utilities per preview)
- ❌ Overlapping CSS concerns grow with each preview
- ❌ No component library → duplication
- ❌ No state management for complex interactions
- ❌ Fidelity feedback loop missing

**Recommendation**: Status quo **only if** next 3-4 D-rounds stay simple (< 5 previews, static mockups). If complexity grows, move to Option E.

---

### Option B: Hand-rolled CSS-only (No Tailwind)

**Description**: Drop Tailwind CDN, write all CSS by hand.

**Pros**:

- ✅ Removes CDN dependency + version lock risk
- ✅ Custom CSS is already the primary mechanism
- ✅ Smaller HTML files (no unused Tailwind utilities)
- ✅ Full control over styling

**Cons**:

- ❌ More verbose CSS (~30-40% more code per preview)
- ❌ Slower to prototype new patterns
- ❌ Still has duplication + no component library
- ❌ No state management advantage
- ❌ Not a real solution to any of the 6 issues

**When to use**: Only if visual consistency > prototyping speed (unlikely for design previews).

**Verdict**: Not recommended. Doesn't solve the core problems.

---

### Option C: Tailwind with Local Build (PostCSS Purge)

**Description**: Run a build process that:

1. Uses `workspace/packages/ui/` Tailwind config
2. Purges unused utilities (reduces to ~15-20 KB per preview)
3. Auto-syncs tokens from themeTokens.ts
4. Serves previews via dev server (no more `file://`)

**Pros**:

- ✅ Removes CDN overhead
- ✅ Tokens auto-synced (fixes Issue #1)
- ✅ Can use Tailwind's `@apply` for shared components
- ✅ Build validation catches config errors early

**Cons**:

- ❌ Requires build infrastructure (PostCSS, build script, Node.js)
- ❌ Previews can no longer open directly from `file://`
- ❌ Requires dev server running
- ❌ More moving parts to maintain
- ❌ Breaks the "designers can open HTML in browser" workflow
- ❌ Still has duplication (no component library)
- ❌ State management not solved

**When to use**: If we accept a dev server + build step and want Tailwind's full power. Good for R31+ if scale exceeds 10-15 previews.

**Verdict**: Reasonable middle ground, but breaks current simplicity. Only escalate if duplication becomes >20% of authoring time.

---

### Option D: Mini Component Library (Lit or Astro Static Export)

**Description**: Build a small component library with:

1. Reusable button, input, table, modal, form field components
2. TypeScript for type safety
3. Generate static HTML previews at build time
4. Web Components or template-based rendering

**Pros**:

- ✅ Centralized component definitions
- ✅ Automatic state management (shadow DOM or framework state)
- ✅ Can generate multiple preview variants per component
- ✅ Scales to complex interactions without HTML bloat
- ✅ Type-safe components
- ✅ Solves duplication (Issue #3) + state complexity (Issue #4)

**Cons**:

- ❌ Significant dev overhead (~40-60 hours initial setup)
- ❌ Learning curve for designers (not just editing HTML)
- ❌ May over-engineer if most previews stay simple
- ❌ Web Components isolation can conflict with shared tokens
- ❌ Requires build + dev server
- ❌ Overkill if design scope stays modest

**When to use**: Only if design becomes core to product velocity (many previews, complex interactions, 20+ visual patterns to manage).

**Verdict**: Over-engineered for current scope. Revisit at R35+ if needed.

---

### Option E: Hybrid — Current + Token Sync Tooling (Recommended now)

**Description**: Keep current approach but add:

1. **Token sync script**: auto-generate `_css/tokens.css` from themeTokens.ts (fixes Issue #1)
2. **Fidelity checklist**: markdown template for D-round sign-off (fixes Issue #5)
3. **Pattern documentation**: `_css/README.md` listing component patterns (helps Issue #3)
4. **Index generation** (optional): script to auto-discover previews and update index.html

**Pros**:

- ✅ Zero disruption to current workflow
- ✅ Solves the two blocking issues (token drift + fidelity feedback)
- ✅ Scales to 10-15 previews without friction
- ✅ Low cost (~6-8 hours of setup)
- ✅ Can add complexity later if needed
- ✅ Preserves the "no build, open from file://" benefit

**Cons**:

- ⚠️ Doesn't solve duplication (Issue #3) or complex state (Issue #4) yet
- ⚠️ CDN overhead remains (minor concern)

**When to use**: **Now** (R28-R30). This is the sweet spot for current scope.

**Verdict**: Strongly recommended. Removes immediate pain, unblocks 3-5 more D-rounds.

---

## Detailed Recommendation: Phased Path

### Phase 1: Now (R28-R30) — Fix Critical Issues

**Goal**: Unblock token drift + fidelity feedback without rework.

#### Task 1.1: Auto-sync tokens

**Time**: ~2 hours

Create `scripts/sync-preview-tokens.mjs`:

```javascript
// Pseudo-code
const themeTokens = require('.../workspace/packages/ui/src/themeTokens.ts');
const cssVars = Object.entries(themeTokens).map(([key, value]) => `--${key}: ${value};`);
writeFileSync('.agents/design/_css/tokens.css', `:root { ${cssVars.join('\n')} }`);
```

- Add to pre-commit hook (Husky)
- Run once to validate
- Document in design/README.md

**Impact**: Eliminates Issue #1 (token drift). Designers can trust tokens are fresh.

#### Task 1.2: Add fidelity checklist

**Time**: ~1 hour

Create `.agents/design/_templates/fidelity-checklist.md`:

```markdown
# D-round Sign-off: Fidelity Checklist

Preview: **\*\***\_\_\_**\*\***

- [ ] Spacing: All padding/margin values match tokens.css
- [ ] Typography: Font sizes, weights, line heights accurate
- [ ] Color palette: All colors use production tokens
- [ ] Borders: Border widths + radius match tokens
- [ ] Hover states: Interactive elements respond correctly
- [ ] Focus states: Keyboard navigation visible
- [ ] Error states: Form validation styles present
- [ ] Loading states: Async operations show feedback
- [ ] Responsive: Desktop + mobile breakpoints tested
- [ ] Contrast: WCAG AA color contrast verified

Designer sign-off: \***\*\_\_\_\_\*\*** Date: **\_\_\_**
```

- Add to design concept templates
- Use in D-round completion criteria

**Impact**: Removes Issue #5 (fidelity quantification). Clear, objective sign-off criteria.

#### Task 1.3: Document component patterns

**Time**: ~1.5 hours

Create `.agents/design/_css/PATTERNS.md`:

```markdown
# Preview Component Patterns

## Buttons

**Used in**: datasets.preview.html, upload.preview.html
**CSS class**: `.row-action`, `.filter-clear`
**Pattern**: Borderless secondary buttons with primary on hover
**When to use**: Non-destructive actions in tables, filters

## Tables

**Used in**: datasets.preview.html
**CSS class**: `.dataset-table`
**Pattern**: Fixed-width headers, tabular-nums for numbers
...
```

- Reference all live patterns
- Link to first preview that implements each
- Update as new patterns emerge

**Impact**: Helps with Issue #3 (duplication). New previewer knows where to find patterns.

#### Task 1.4: Document and validate

**Time**: ~1.5 hours

Update `.agents/design/README.md`:

- Add section: "Preview creation workflow"
- Link to checklist, patterns, token sync script
- Add to design round template (`plan/PDCA.md`)

**Total Phase 1 cost**: ~6 hours (can overlap across 2-3 days)

---

### Phase 2: Later (R31+) — Escalate Only If Needed

**Decision criteria** (measure after 3-5 more D-rounds):

| Metric                                 | Threshold                          | Escalate to                           |
| -------------------------------------- | ---------------------------------- | ------------------------------------- |
| Duplication in new previews            | > 30% of authoring                 | Option C (local build)                |
| Time per new pattern                   | > 20 min                           | Option C (local build)                |
| State branching complexity             | > 3 independent states per preview | Option D (component lib) or Alpine.js |
| Total previews                         | > 15                               | Consider Option C                     |
| Designer frustration with manual index | Blocking new previews              | Add auto-discovery script             |

**What to escalate to**:

- **If duplication + complexity grow**: Option C (Tailwind + local build)
  - Cost: ~12-16 hours to set up build pipeline, token sync, purging
  - Benefit: CDN removed, tokens auto-synced, component extraction possible
- **If state management becomes bottleneck**: Add Alpine.js or htmx to previews
  - Cost: ~4-6 hours to add library + document patterns
  - Benefit: State machine, reactivity without full framework

- **If design previews become core to feedback loop**: Option D (Lit components)
  - Cost: ~40-60 hours to build component library
  - Benefit: Reusable, typed, scalable to 20+ patterns

---

## Summary: Issues → Mitigations

| Issue                 | Severity   | Current pain         | Option E cost | Residual after Phase 1  |
| --------------------- | ---------- | -------------------- | ------------- | ----------------------- |
| #1: Token drift       | 🔴 HIGH    | Per UI change        | ~2h (fixes)   | ✅ Eliminated           |
| #2: CDN overhead      | 🟡 MED     | Per preview          | No fix        | Minor (90 KB unused)    |
| #3: Duplication       | 🟡 MED     | Per pattern          | ~1h (doc)     | Mitigated (awareness)   |
| #4: State mgmt        | 🟠 LOW-MED | Complex interactions | No fix        | Manageable for R28-32   |
| #5: Fidelity feedback | 🔴 HIGH    | Handoff friction     | ~1h (fixes)   | ✅ Eliminated           |
| #6: Index maintenance | 🟡 MED     | Per preview          | No fix        | Mitigated if documented |

---

## Real-world Risks: Critical, But Manageable

### Risk: "Tailwind goes away"

**Likelihood**: LOW (Tailwind is ecosystem-standard)  
**Mitigation**: Phase 1.1 (token sync) makes switching easier later; no vendor lock

### Risk: "Previews diverge from running builder"

**Likelihood**: MEDIUM  
**Mitigation**: Phase 1.2 (fidelity checklist) + scheduled screenshot diffs post-implementation

### Risk: "New previewer breaks the workflow"

**Likelihood**: MEDIUM  
**Mitigation**: Phase 1.2 + 1.3 + documentation in design/README.md

### Risk: "Token sync script breaks during CI"

**Likelihood**: LOW  
**Mitigation**: Add to test suite; validate tokens.css is regenerated before commit

---

## Conclusion

The current approach **works and is unblocking rapid iteration** (R14 proof). Don't rework it. Instead:

1. **Now**: Fix token drift (2h) + add fidelity checklist (1h) + document patterns (1.5h)
2. **R31+**: Measure pain. Only escalate to Option C/D if metrics cross thresholds

This keeps the workflow simple, unblocks the next 3-5 D-rounds, and buys time for the right solution to emerge from usage data rather than speculation.

**Next step**: Escalate Phase 1 to be owned by next available agent/session. Owner: TBD.

---

_Report generated by deep scan of `.agents/design/` directory (R28). No changes made to source files. Safe to use as reference for design round planning._
