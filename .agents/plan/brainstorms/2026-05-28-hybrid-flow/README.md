# Brainstorm: Hybrid design-and-delivery flow (2026-05-28)

Pre-decision brainstorm chain that produced the hybrid DCFBI/DFCFBI
operating-model recommendation R47 codifies.

## Chain order

1. **[MEMO-FINDINGS-2026-05-28.md](MEMO-FINDINGS-2026-05-28.md)** —
   deep scan of the current `.agents/design/` D-round workflow.
   Surfaces 6 real-world issues; flags 2 as critical-now (token
   drift, fidelity feedback).
2. **[TOOLING-ANALYSIS-2026-05-28.md](TOOLING-ANALYSIS-2026-05-28.md)** —
   full per-issue analysis: what each risk costs, what fixes exist,
   what's deferable. Source of the operating-model trade-offs.
3. **[TOOLING-QUICK-START.md](TOOLING-QUICK-START.md)** — executive
   summary companion to the analysis; the same content compressed
   for skim-reading.
4. **[FINAL-RECOMMENDATION-2026-05-28.md](FINAL-RECOMMENDATION-2026-05-28.md)** —
   synthesis: DCFBI default path, DFCFBI conditional (2-of-5 flow
   selector), O-rule as cross-cutting invariant, adoption plan
   across the next two rounds. This is the doc R47's decision file
   paraphrases and tightens.

## Lifecycle

```text
brainstorm chain (this directory)
    ↓
decision artifact   → .agents/decisions/2026-05-28-hybrid-flow-governance.md  (R47 output)
    ↓
applying round      → .agents/plan/cycles/Round_47.md
    ↓
corpus reconciliation → Round_48 (precondition for first DCFBI trial)
```

## Convention

This is the **first instance** of the brainstorm-housing convention
R46 established. See [PDCA.md § Brainstorm lifecycle (optional)](../../PDCA.md)
for the general shape. Brainstorm docs in this directory are
historical record — not edited after the decision lands.
