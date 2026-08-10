# Grain alignment — a virtual experiment (dataset + relationship only)

**Date**: 2026-08-07
**Status**: experiment run, **no verdict taken** — deliberately
**Feeds**: the [Round_162](../cycles/Round_162.md) query-identity fork; the
[`_noun-model.md`](../../design/data-management/_noun-model.md) OPEN boundary.

## Why this exists

The human's 2026-08-07 full-loop dogfood dead-ended: two shaped results from one uploaded
dataset could not be combined, blocking an ordinary dashboard. Rather than argue the existing
nouns, this runs a **clean-slate thought experiment** on imaginary data.

**Rules of the experiment** (set by the human):

1. **Forget query and workflow entirely.** Neither noun appears below. No design is mapped back
   to them; that mapping is a separate step, taken later, on purpose.
2. **What we have in hand: `dataset` (a table) + `relationship` (a governed edge).**
3. **No code is written.** Paper only, on sample data small enough to verify by hand.
4. **No winner is declared.** The output is evidence and a comparison, not a recommendation.

---

## Sample data

Small enough that every number below can be checked by hand.

**`Agents`**

| agent | name | team |
| --- | --- | --- |
| A1 | Lan | North |
| A2 | Minh | North |
| A3 | Hoa | South |

**`Customers`**

| customer | name | segment |
| --- | --- | --- |
| C1 | Acme | Enterprise |
| C2 | Beta | SMB |
| C3 | Gamma | SMB |
| C4 | Delta | Enterprise |
| C5 | Epsilon | SMB |

**`Calls_Jan`** and **`Calls_Feb`** — two disjoint monthly exports (the real-world shape:
one file per month, same columns, no overlap).

| id | agent | customer | outcome | sec |
| --- | --- | --- | --- | --- |
| 1 | A1 | C1 | connected | 300 |
| 2 | A1 | C2 | no_answer | 0 |
| 3 | A2 | C3 | connected | 120 |
| 4 | A3 | C1 | connected | 600 |
| 5 | A3 | C4 | no_answer | 0 |

| id | agent | customer | outcome | sec |
| --- | --- | --- | --- | --- |
| 6 | A1 | C3 | connected | 200 |
| 7 | A2 | C2 | connected | 90 |
| 8 | A2 | C3 | no_answer | 0 |
| 9 | A3 | C1 | connected | 450 |
| 10 | A1 | C1 | connected | 150 |

**Relationships in hand**: `Calls.agent → Agents.agent` (M:1) · `Calls.customer → Customers.customer` (M:1).

> **Changed from the first pass** (2 edits, both to make a tile non-trivial): added customer
> **C5 Epsilon** (never called), and moved call **8** from C4 to C3 so **C4 has January
> activity but none in February**. Without these, T5 returned an empty set and tested nothing.

---

## The target: one dashboard a sales leader wants

| # | Tile |
| --- | --- |
| T1 | Connected calls, Feb vs Jan, with the change |
| T2 | Connect rate by agent |
| T3 | Each agent's connect rate **vs their team's** |
| T4 | Top 3 customers by talk-minutes, showing segment |
| T5 | Customers with **zero** calls in February |

## Ground truth (hand-computed)

Any design that produces different numbers is wrong; any design that *cannot* produce these is
incomplete.

- **Stacked** Jan+Feb = 10 calls.
- **Agent rates** — A1 = 3/4 = **75.0%** · A2 = 2/3 = **66.7%** · A3 = 2/3 = **66.7%**
- **T1** — Jan connected = 3, Feb connected = 4 → **+1 (+33.3%)**
- **T4** — C1 1500s = **25.0 min** (Enterprise) · C3 320s = **5.3 min** (SMB) · C2 90s = **1.5 min** (SMB)
- **T5** — **C4 Delta** (active in Jan, silent in Feb) and **C5 Epsilon** (never called).
  Two rows that mean very different things to a leader.

### The T3 trap

"The team's rate" has two legitimate readings, and they disagree:

| Reading | North | A1 delta | A2 delta |
| --- | --- | --- | --- |
| **Pooled** — all North rows together: 5/7 | **71.4%** | +3.6pt | −4.8pt |
| **Average of agent rates** — (75.0 + 66.7)/2 | **70.8%** | +4.2pt | −4.1pt |

Both defensible. A design that silently picks one produces a confident wrong answer on a
dashboard someone will act on. **This is the sharpest discriminator in the experiment** —
sharper than expressiveness, because every design below *can* eventually produce a number.

---

## What the tiles actually require

| Tile | Operations |
| --- | --- |
| T1 | stack · filter · group by month · count · **compare two results** |
| T2 | stack · group by agent · **two aggregates over the same rows** (connected ÷ all) |
| T3 | agent-grain result · team-grain result · **align by team** |
| T4 | stack · follow · group · sum · rank · limit |
| T5 | Customers · **absence of** a match |

The primitive set falls out as: **stack · follow · filter · group · derive · rank · exclude** —
plus one operation that behaves unlike the rest:

> **Align two different grains** — where the output of one shaping becomes the input to another.

**T1, T2 and T3 all need it. Three of five tiles.** This is the experiment's first finding:
grain alignment is not an advanced case at the edge of the product. It is load-bearing for an
ordinary leader's first dashboard, which is consistent with the dogfood hitting the wall almost
immediately.

---

## Four candidate designs

Described neutrally. Each is a different answer to *"what is the intermediate result, and what
may you do with it?"*

| | Design | The core idea |
| --- | --- | --- |
| **D-A** | **Group-aggregate as a column** | No intermediate exists. The tool offers a primitive: "add a column = aggregate of X within group Y." |
| **D-B** | **Named result, live** | An intermediate is a named thing, referenceable as an input, recomputed on read. |
| **D-C** | **Named result, frozen** | Same, but an intermediate must be snapshotted before it can be referenced. |
| **D-D** | **Inline nesting, unnamed** | The comparison is expressed in one place; the tool builds the sub-computation invisibly. No artifact. |

---

## Walkthrough: T3 (agent vs team)

### D-A — group-aggregate as a column

1. Stack Jan + Feb
2. Follow `Calls.agent → Agents` (brings `team`)
3. Group by agent, carrying team → connect rate per agent
4. **Add column**: average of `connect_rate` within `team`
5. Derive: `delta = connect_rate − team_avg`

**Artifacts**: 1. **New concepts**: 1 ("a column that aggregates within a group").

**Trap behaviour**: step 4 operates on the *already-aggregated* rate column, so it yields
**70.8%** — the average-of-agents reading. The **pooled 71.4% is not expressible** unless the
primitive can also aggregate over the *underlying rows* rather than the visible column. The user
is not asked which they meant; they receive one reading and no signal that another exists.

### D-B — named result, live

1. Stack + follow + group by agent → save as **"Agent rates"**
2. Stack + follow + group by team → save as **"Team rates"** (pooled = 71.4%, from raw rows)
3. New shaping: reference both, align on `team`, derive `delta`

**Artifacts**: 3. **New concepts**: 1 ("a saved result can be an input").

**Trap behaviour**: **both readings expressible, and the choice is visible.** Group the raw rows
by team → pooled 71.4. Group "Agent rates" by team → 70.8. The user picks by choosing which
thing to group, and the choice is legible afterwards in what they built.

### D-C — named result, frozen

Identical to D-B, plus a snapshot step for each intermediate before step 3 can reference it.

**Artifacts**: 3 named + 2 snapshots = 5. **New concepts**: 2 ("saved result", "snapshot").

**Trap behaviour**: same as D-B — expressible and visible.

### D-D — inline nesting, unnamed

1. Stack + follow + group by agent
2. In one place, express "compare to team"

**Artifacts**: 1. **New concepts**: 0–1.

**Trap behaviour**: the tool must either ask which reading, or pick silently. Because no
intermediate is named or inspectable, the user has **no way to check which they got**. The trap
lands hardest here.

## Walkthrough: T5 (absence)

| Design | Expressible? | How |
| --- | --- | --- |
| **D-A** | Only with a *second* special-case primitive | "Group-aggregate as a column" says nothing about absence; needs an "exclude"/"has no match" primitive added alongside |
| **D-B** | Yes | Reference `Customers` + a "Feb calls" result, align keeping unmatched |
| **D-C** | Yes | Same, after freezing "Feb calls" |
| **D-D** | Yes, if "exclude" is an inline option | Same shape as D-B, un-named |

**Second finding**: absence discriminates **less** than predicted. It turns on whether the align
operation supports *keep-unmatched* — largely orthogonal to the intermediate question. Its real
signal is against **D-A**: covering T3 and T5 needs two unrelated primitives, hinting that D-A is
a family of gadgets (one per pattern) rather than a model. The open question is how long that
family gets as tiles accumulate.

---

## Comparison matrix

| Probe | D-A | D-B | D-C | D-D |
| --- | --- | --- | --- | --- |
| Artifacts after T3 | 1 | 3 | 5 | 1 |
| New concepts to learn | 1 | 1 | 2 | 0–1 |
| Steps to first number (T3) | 5 | 3 shapings | 3 shapings + 2 freezes | 2 |
| Both T3 readings expressible | **No** (70.8 only) | Yes | Yes | Depends on the prompt |
| User can see which reading they got | No | **Yes** | **Yes** | **No** |
| T5 absence | Needs a 2nd primitive | Yes | Yes | Yes |
| March data arrives | re-run; 1 place | recompute; 1 place | **re-freeze 2 things, in order** | re-run; 1 place |
| "Company-wide, not team" | 1 edit | 1–2 edits | 1–2 edits + re-freeze | 1 edit |
| Where a wrong number can hide | silent reading choice | two intermediates drifting apart in filters | **mismatched freeze times** | invisible sub-computation |

### Third finding: the real axis is not power vs simplicity

D-A and D-D are the fewest steps *and* the least inspectable. D-B and D-C cost more steps *and*
make the ambiguity visible. Across all four, the trade is:

> **steps ⇄ inspectability** — not power ⇄ simplicity.

The intermediate that costs the user an extra step is the same object that lets them see which
question they asked. This reframes the choice: it is about whether a leader must be able to
*audit* a number they act on, not about how capable the engine is.

### Fourth finding: D-C carries a failure mode the others do not

If "Agent rates" is re-frozen and "Team rates" is not, the delta is computed across two
different points in time. Every number renders, none error, and the result is wrong with no
visible cause. D-B cannot produce this (both recompute together); D-A and D-D have no
intermediates to desynchronize. This is a **new** silent-wrong-number risk, not a variant of an
existing one — and it grows with the number of intermediates.

---

## What this experiment did NOT test

Named honestly, so the evidence is not over-read:

- **Real data volume.** All four look fine on 10 rows. Live recomputation (D-B) and freeze cost
  (D-C) only diverge at real scale. Nothing here measures that.
- **T1 and T2 walkthroughs.** Only T3 and T5 were walked. T1 (period-over-period) stresses grain
  alignment along *time* rather than *hierarchy* and may separate the designs differently.
- **Drift.** A CRM export changing its columns mid-quarter is the product's founding pain, and
  no design above was tested against it.
- **The messy-key case.** Real call logs have no clean single-column key; every join here used a
  tidy one.
- **Whether "explore" means a handful of deliberate joins or fast iteration.** D-C's ceremony is
  either acceptable or fatal depending purely on this, and it is a human answer, not a code one.

## Open questions for the human

1. **Auditability**: when a number on your dashboard looks wrong, do you need to open the
   intermediate and check it — or is "rebuild it and see" acceptable?
2. **Rhythm**: is exploring a handful of deliberate comparisons, or rapid iteration where a
   freeze-per-step would break the flow?
3. **The T3 reading**: for your real reporting, is "team rate" pooled or average-of-agents — and
   does the answer vary by report?
4. **Artifact tolerance**: is a workspace holding 5 named things per dashboard tile a reasonable
   cost, or clutter?

---

## Status

**No design is preferred as of this document.** Four findings are recorded (grain alignment is
load-bearing at 3/5 tiles · absence discriminates weakly · the axis is steps ⇄ inspectability ·
frozen intermediates carry a unique desync risk). The mapping back to the product's existing
nouns is deliberately **not** performed here, per rule 1.
