# Compaction Log

Tracks compaction history and the current compaction point for auto-trigger calculation.

| Compaction | Rounds      | Output File               | Date       | Last Compaction Point |
| ---------- | ----------- | ------------------------- | ---------- | --------------------- |
| (initial)  | —           | —                         | —          | 0                     |
| Manual     | Round_01-20 | Rounds_01_20.compacted.md | 2026-05-09 | 20                    |

**Current Last Compaction Point**: 20

**Next Auto-Compact Trigger**: When creating Round_41 (since `41 > (20 + 20)`)

---

## Manual Compactions

If you manually trigger `compact-docs` on a subset of rounds, update this log:

```markdown
| Manual | Round_XX-YY | Rounds_XX_YY.compacted.md | YYYY-MM-DD | YY |
```

Then agents will recalculate auto-compact trigger as: `21 > (YY + 20)?`
