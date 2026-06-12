#!/usr/bin/env node
/**
 * Round-structure lint (R67).
 *
 * Mechanically enforces the round-file conventions defined in
 * .agents/plan/PDCA.md (Cycle Template + Round Template). Until R67 the
 * "Cross-links present" gate was the last MANUAL item in the post-round
 * audit — and the only one that wasn't a script. It slipped twice (R63, R66
 * shipped Complete with no outbound `Feeds into →`). Same lesson as the
 * R56–R64 design-corpus audit: defined + templated but unlinted ⇒ it recurs.
 * This script replaces the manual checkbox with a gate.
 *
 * Rules (every round under .agents/plan/cycles/Round_NN.md):
 *   R-status   — `**Status**:` carries lifecycle vocab
 *                (Planning | In Progress | Review | Complete).
 *   R-dates    — `**Date started**:` present; `**Date completed**:` is
 *                non-empty when Status is Complete.
 *   R-sections — the five PDCA phase headings exist: Goal, Plan, Do, Check,
 *                Act (`## ` level).
 *   R-feeds    — an OUTBOUND handoff: a `## Feeds into` heading or a
 *                `**Feeds into →` bold line (the template's closing section).
 *   R-inherits — an INBOUND cross-link `Inherits from ←` or `Pulled by ←`
 *                (exempt Round_01 — no predecessor).
 *
 * The corpus was clean at authoring (only R63's missing feeds + R64's
 * "Pulled by ←" variant, both handled), so there is NO grandfather baseline:
 * any violation errors. A round legitimately without a predecessor uses
 * `Pulled by ←` pointing at the memory / gap that pulled it.
 *
 * Usage:
 *   node scripts/lint/round-lint.mjs            # scan all rounds
 *   node scripts/lint/round-lint.mjs <path...>  # specific file(s)
 *   node scripts/lint/round-lint.mjs --json      # machine-readable
 *
 * Wired into the post-round audit — see .agents/plan/PDCA.md.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const CYCLES = path.join(REPO_ROOT, '.agents', 'plan', 'cycles');

function roundFiles() {
  return readdirSync(CYCLES)
    .filter((f) => /^Round_\d+\.md$/.test(f))
    .sort()
    .map((f) => path.join(CYCLES, f));
}

function roundNumber(file) {
  const m = path.basename(file).match(/^Round_(\d+)\.md$/);
  return m ? Number(m[1]) : Number.NaN;
}

function checkRound(file) {
  const text = readFileSync(file, 'utf8');
  const num = roundNumber(file);
  const fails = [];

  // R-status — lifecycle vocab.
  const status = text.match(/^\s*\*\*Status\*\*\s*:\s*(.+)$/im);
  if (!status) {
    fails.push({ rule: 'R-status', detail: 'no `**Status**:` line' });
  } else if (!/(planning|in progress|review|complete)/i.test(status[1])) {
    fails.push({ rule: 'R-status', detail: `Status "${status[1].trim()}" lacks lifecycle vocab` });
  }
  const isComplete = status && /complete/i.test(status[1]);

  // R-dates.
  if (!/^\s*\*\*Date started\*\*\s*:/im.test(text)) {
    fails.push({ rule: 'R-dates', detail: 'no `**Date started**:` line' });
  }
  const completed = text.match(/^\s*\*\*Date completed\*\*\s*:\s*(.*)$/im);
  if (isComplete && !completed?.[1]?.trim()) {
    fails.push({ rule: 'R-dates', detail: 'Status is Complete but `**Date completed**:` is empty' });
  }

  // R-sections — the five PDCA phase headings.
  const SECTIONS = [
    ['Goal', /^##\s+Goal\b/m],
    ['Plan', /^##\s+Plan\b/m],
    ['Do', /^##\s+Do\b/m],
    ['Check', /^##\s+Check\b/m],
    ['Act', /^##\s+Act\b/m],
  ];
  for (const [name, re] of SECTIONS) {
    if (!re.test(text)) fails.push({ rule: 'R-sections', detail: `no \`## ${name}\` section` });
  }

  // R-feeds — outbound handoff.
  const feedsOut = /^#{1,3}\s+Feeds into/m.test(text) || /^>?\s*\*\*Feeds into\s*→/m.test(text);
  if (!feedsOut) {
    fails.push({ rule: 'R-feeds', detail: 'no outbound `Feeds into →` section (heading or bold)' });
  }

  // R-inherits — inbound cross-link (Round_01 exempt).
  if (num !== 1) {
    const inbound = /Inherits from\s*←/.test(text) || /Pulled by\s*←/.test(text);
    if (!inbound) {
      fails.push({ rule: 'R-inherits', detail: 'no inbound `Inherits from ←` / `Pulled by ←` cross-link' });
    }
  }

  return fails;
}

// ── Main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const explicit = args.filter((a) => !a.startsWith('--'));
const files = explicit.length ? explicit.map((a) => path.resolve(process.cwd(), a)) : roundFiles();

const report = [];
let errorCount = 0;
for (const file of files) {
  const fails = checkRound(file);
  errorCount += fails.length;
  report.push({ file: path.relative(REPO_ROOT, file), fails });
}

if (asJson) {
  console.log(JSON.stringify({ errorCount, report }, null, 2));
  process.exit(errorCount ? 1 : 0);
}

for (const r of report) {
  if (!r.fails.length) continue;
  console.log(`\n${r.file}`);
  for (const f of r.fails) console.log(`  ✖ ${f.rule} — ${f.detail}`);
}
console.log(`\n${errorCount} error(s) across ${report.length} round(s).`);
if (errorCount) {
  console.log('Round files must follow the PDCA Round Template (.agents/plan/PDCA.md §"Round Template").');
}
process.exit(errorCount ? 1 : 0);
