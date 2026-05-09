# Documentation Hub

Quick reference for what doc to read for what. Specs are the source of truth;
everything else summarizes or links back.

## I want to

| Goal                                         | Read                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Get the project running locally              | [development/setup.md](development/setup.md)                                   |
| Understand a specific feature                | [features/](features/)                                                         |
| Write or extend a feature spec               | [development/sdd.md](development/sdd.md)                                       |
| Run local or production containers           | [../devops/README.md](../devops/README.md)                                     |
| Deploy to production                         | [operations/deployment-guide.md](operations/deployment-guide.md)               |
| Roll back a release                          | [operations/rollback-runbook.md](operations/rollback-runbook.md)               |
| Diagnose a production issue                  | [operations/troubleshooting-runbook.md](operations/troubleshooting-runbook.md) |
| Handle an on-call page                       | [operations/oncall-playbook.md](operations/oncall-playbook.md)                 |
| Review governance / constitution principles  | [governance.md](governance.md)                                                 |
| Read the original problem framing & analysis | [analysis/](analysis/)                                                         |

## Features

| Spec | Feature                    | Doc                                                                      |
| ---- | -------------------------- | ------------------------------------------------------------------------ |
| 001  | Data Upload & Profiling    | [features/spec-001-profiling.md](features/spec-001-profiling.md)         |
| 002  | Relationship Rules         | [features/spec-002-relationships.md](features/spec-002-relationships.md) |
| 003  | Query Builder & Execution  | [features/spec-003-query-builder.md](features/spec-003-query-builder.md) |
| 004  | Saved Queries              | [features/spec-004-saved-queries.md](features/spec-004-saved-queries.md) |
| 005  | Dashboard & Visualizations | [features/spec-005-dashboard.md](features/spec-005-dashboard.md)         |
| 006  | Production Deployment      | [features/spec-006-production.md](features/spec-006-production.md)       |

## Source of truth

Each feature's authoritative artifacts (spec, plan, tasks, data model,
contracts, quickstart) live under [`specs/{NUMBER}-{NAME}/`](../specs/).
The files in `docs/features/` are short summaries. When in doubt, read the
spec.

## Operations

| Doc                                                                            | Use when                         |
| ------------------------------------------------------------------------------ | -------------------------------- |
| [../devops/README.md](../devops/README.md)                                     | Finding compose files            |
| [operations/deployment-guide.md](operations/deployment-guide.md)               | Deploying or releasing           |
| [operations/rollback-runbook.md](operations/rollback-runbook.md)               | Rolling back a bad release       |
| [operations/troubleshooting-runbook.md](operations/troubleshooting-runbook.md) | Diagnosing production issues     |
| [operations/oncall-playbook.md](operations/oncall-playbook.md)                 | On-call shift, incident response |
