# Program plan: <Name>

**Status**: <Active | Paused | Closed> (current pilot/round — `cycles/Round_NN.md`)
**Opened**: <YYYY-MM-DD>
**Closed**: <YYYY-MM-DD — omit until close>

<One-paragraph charter: what this program sweeps/builds across many rounds,
the cadence (one X per round, pause at review), and the goal. A program is a
**multi-round** effort — bigger than a single `Round_NN.md`, smaller than the
standing methodology in [PDCA.md](../PDCA.md).>

_Track: <1 product | 2 agent-method | 3 system/evolution>. Pulled by: <trigger / decision /
round discussion that opened this>. Decisions settled in
`brainstorms/<dated-folder>/`._

## Settled decisions (<user, YYYY-MM-DD>)

1. **<decision>** — <one line>.
2. …

## The repeatable unit (what each round does)

<The single most important section: define the procedure a round applies,
identically, to its slice of the work. For an audit this is a rubric; for a
build it's a phase/gate list. If this control-flow can't be read off here in
prose — non-linear sequencing, branching, parallel rounds, or a chain that
diverges from the standard DCFBI gates — the program **graduates** to a
folder and gains a sibling `<name>.workflow.md` (see PDCA § Program plans).>

## Scope + firewall

- **In / deferred / out** — explicit.
- **Firewall (anti-creep)** — the discipline that keeps a round from
  expanding past its one slice (e.g. "log product gaps, never redesign
  in-round"). State what this program must *not* do.

## Work items + order (suggestive, not binding)

| # | Item | Status | Round |
| - | ---- | ------ | ----- |
| 1 | `<first>` | **pilot — in flight** | `Round_NN` |
| 2 | `<next>` | queued | — |

<If round 1 also calibrates the repeatable unit, say so — its review pass
hardens this doc before item 2 begins.>

## Rolling log

<Findings/gaps/decisions accumulated across rounds. **Frequency drives the
pull**: recurring → its own round; one-off → in-round fix. Append one row
per finding; bump "Seen in" when it recurs.>

| Entry | Axis/Kind | Seen in | Disposition |
| ----- | --------- | ------- | ----------- |
| <…> | <…> | <RNN> | open / pulled / fixed |

## Lifecycle

Active until <completion condition>. At close, the rolling log's recurring
entries are promoted to their own rounds / a decision artifact; this file
folds into a closing note. <When closed, set Status: Closed + Closed date.>
