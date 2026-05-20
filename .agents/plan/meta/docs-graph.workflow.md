# Workflow — `docs-graph`

Operational quick-ref for the `docs-graph` tool added to self-evo. Master plan: [docs-graph.plan.md](docs-graph.plan.md).

## One-line summary

`docs-graph` walks every `*.md` in the repo, builds an Obsidian-style graph of links + code references, runs drift detectors, persists to SQLite, and serves a Cytoscape.js UI for humans and a read API for agents.

## Daily commands

```sh
# from repo root, after `pnpm install` + `pnpm --filter @self/orchestrator build`
.agents/orchestrators/self-evo/scripts/docs-graph.sh scan         # one shot
.agents/orchestrators/self-evo/scripts/docs-graph.sh scan --json  # for CI / agents
.agents/orchestrators/self-evo/scripts/docs-graph.sh serve        # http://127.0.0.1:7733
.agents/orchestrators/self-evo/scripts/docs-graph.sh latest       # print last scan id + summary
.agents/orchestrators/self-evo/scripts/docs-graph.sh diff <a> <b> # diff two scans
```

## Where things live

```
.agents/orchestrators/self-evo/
  src/docs-graph/        # parser, db, detectors, server
  src/tools/docs-graph.ts  # agent-callable read API (DG-3)
  scripts/docs-graph.sh    # entrypoint
  data/docs-graph.db       # SQLite (gitignored)
```

## Threading through self-evo (DG-3, planned)

- `repo-scanner` node calls `docsGraph.driftSummary()` and stores top findings in state.
- `judge` node refuses `approve` if `findings.error` count grew vs the previous scan.
- `round-writer` includes the drift delta in the round report.

## Threading through CI (later)

Not part of DG-1/DG-2/DG-3 chain. Idea: `pnpm --filter @self/orchestrator docs-graph scan --check` exits non-zero on new `error` findings.

## Reading the graph manually

```sh
sqlite3 .agents/orchestrators/self-evo/data/docs-graph.db \
  "select severity, detector, node_path, body
     from findings
    where scan_id = (select id from scans order by started_at desc limit 1)
    order by severity desc;"
```

## Common drift signals and what they mean

| Detector            | Severity | Read it as                                                                                       |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `broken-refs`       | error    | A doc links to a file that doesn't exist — fix the link or restore the file                      |
| `orphans`           | warn     | A doc has no inbound link from anywhere — either link it in, or it's dead and should be removed  |
| `round-report-pair` | warn     | A round file is missing its report (or vice versa) — finish the close-out or drop the round file |
| `cross-track`       | info     | A doc in one track references another track — usually fine, but watch the count over time        |
