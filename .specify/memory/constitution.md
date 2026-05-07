# my-dynamic-dashboard Constitution

This constitution captures the non-negotiable principles for building
`my-dynamic-dashboard` — a governed business-analysis workspace that turns
messy Excel-based business processes into decision-grade analytical systems.

The dashboard is the visible surface. The product is the machinery that
makes numbers explainable, repeatable, and safe to use in business decisions.

## Core Principles

### I. Business-Question-First (NON-NEGOTIABLE)

Every feature must connect to a concrete business decision. No work begins
from "what chart can we draw?" — it begins from "what business question are
we trying to answer, and what evidence makes that answer credible?".
Specs MUST state the business question, the decision it informs, and the
role that consumes it before any data model or UI is designed.

### II. Metric Contract Before Visualization

No chart, KPI, or report displays a metric that does not have a stored
metric contract. A metric contract MUST define: name, business meaning,
numerator, denominator, source tables, filters, time anchor, relationship
dependencies, exclusion rules, trust type, and owner / confirmation status.
Visualization layers consume contracts; they do not invent metrics.

### III. Relationship Rule Before Cross-Table Query

Joins across uploaded datasets are expressed as named, versioned
relationship rules — not ad-hoc SQL. Rules carry a type (exact key,
normalized key, fuzzy/fallback, date-window, one-to-many business
mapping, evidence-only, challenge-only) and a lifecycle
(suggested → reviewed → approved). Approved rules are the only ones
consumed by metrics; suggested or evidence-only rules are surfaced for
review, never silently used in decision outputs.

### IV. Reconciliation Before Recommendation

Recommendation-style outputs (staffing, ROI, "you should do X") are
gated behind reconciliation. Where two numbers should relate, the system
MUST decompose the gap (explained drivers + residual) before any
recommendation language is permitted. Residuals are surfaced, not hidden.

### V. Challenge & Sensitivity Before Decision-Ready

Findings carry a stability label derived from challenge runs over the
relevant assumption space (match windows, qualified-lead rules,
segmentation, time windows). Findings labeled "sensitive" MAY be shown
in exploration surfaces but MUST NOT be promoted to decision-ready
surfaces or recommendation language until stabilized.

### VI. Traceability For Every Claim

Every visible claim — a number on a card, a sentence in a narrative,
a row in an export — is traceable back to source files, columns,
relationship rules, metric contracts, filters, and challenge results.
Lineage is inspectable from the UI, not buried in code. "Interactive
does not mean decision-ready"; lineage is what earns the
"decision-ready" label.

### VII. Reproducibility From Raw Inputs

Every analysis workspace MUST be reproducible from raw files plus
versioned rules and contracts. Each run records: dataset manifest,
file hashes, schema versions, rule versions, metric versions, and
output versions. A single command MUST regenerate the analysis from
inputs. If reproduction breaks, that is a release-blocking defect.

## Quality Gates

Decision-readiness depends on these gates passing in order. A gate
failure downgrades the surface (e.g. "exploration only") and blocks
recommendation language.

1. Data quality gate — schema, nulls, ranges, duplicates within tolerance.
2. Relationship confidence gate — required relationships are approved,
   not merely suggested.
3. Metric contract gate — every displayed metric resolves to a saved,
   confirmed contract.
4. Reconciliation residual gate — residual is within tolerance, or
   explicitly labeled and surfaced.
5. Challenge stability gate — finding is labeled stable across
   declared challenge variants.
6. Output readiness gate — UI surface role (exploration, analysis
   workbench, executive report, decision-ready, simulator, audit/export)
   matches the gate state.

Recommendation-style output (action verbs aimed at staffing, budget,
or operational change) is permitted only when gates 1–5 pass and the
surface role is decision-ready or executive report.

## UI Surface Roles

Every surface declares its role explicitly and renders that role to the
user. The system MUST prevent users from mistaking an exploratory chart
for a validated recommendation.

- exploration — raw view of data, no recommendation language.
- analysis workbench — challenge / sensitivity runs, comparison views.
- executive report — narrative + trust boundary, gated.
- decision-ready dashboard — gated KPIs and reconciled metrics only.
- simulator — scenario calculator with explicit assumption labels.
- audit / export — Excel/CSV with full lineage.

## Development Workflow

- All non-trivial features go through Spec Kit: constitution → specify →
  (clarify) → plan → tasks → (analyze / checklist) → implement.
- Specs MUST include: business question, decision consumed, role,
  required metric contracts, required relationship rules, required
  reconciliation, challenge variants, decision-readiness gates,
  traceability surfaces.
- Plans MUST map each requirement to: data layer, metric contract,
  relationship rule, surface role, gate, and test.
- Tasks generated from plans MUST preserve traceability — each task
  references the requirement it satisfies.
- Implementation MUST NOT bypass gates; if a gate cannot be met, the
  surface role is downgraded in the same change.

## Governance

This constitution supersedes ad-hoc preferences. Amendments require an
explicit PR that updates this file, bumps the version, and migrates any
affected templates and in-flight specs. Reviewers MUST verify that PRs:

- name the business question they serve,
- declare metric contracts and relationship rules they touch,
- show reconciliation and challenge posture where applicable,
- declare the surface role and the gate state required to display it,
- preserve traceability and reproducibility.

Complexity is justified only when it serves a principle above; YAGNI
applies elsewhere. For runtime collaboration guidance, see
`.agents/AGENTS.md` and `.claude/CLAUDE.md`.

**Version**: 0.1.0 | **Ratified**: 2026-05-08 | **Last Amended**: 2026-05-08
