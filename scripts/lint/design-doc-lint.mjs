#!/usr/bin/env node
/**
 * Design-doc conformance lint (R64).
 *
 * Enforces the five format conventions the design-corpus audit (R56–R63,
 * program now closed) proved are SYSTEMATIC — hand-maintenance demonstrably
 * does not fix them, only a template + lint will:
 *
 *   L1 (A6) status header   — `**Status**: <draft|accepted|superseded> (...)`
 *   L2 (A1) surface vocab   — Surface-table Reusability/Purity base token ∈ canonical set
 *   L3 (A3) token map       — present + cites themeTokens.ts / an AntD seed token
 *   L4 (A5) scope boundary  — an explicit out-of-scope / "does NOT cover" section
 *   L5 (A2) acceptance      — a user-journeys / testable-acceptance-criteria section
 *
 * Canonical vocab (D-1, ratified 2026-06-08 — docs canonical, README reconciled):
 * a cell is "base token + optional (qualifier)"; the base token (before any
 * `(…)`) must be in the canonical set. See .agents/design/README.md.
 *
 * Artifact-type-aware (D-2, R60 variants):
 *   canonical  <concept>.md         → all five rules.
 *   target     <concept>.target.md  → L1 (status="Target horizon"), L2, L4
 *                                      + target-specifics (TARGET-NOT-CURRENT
 *                                      banner, named-pulls, retire/lifecycle
 *                                      clause). L3 + L5 are n-a (B6⇄A3 fold:
 *                                      token concern, presence included, is A3's).
 *   preview    <concept>.preview.html → out of scope (not markdown).
 *
 * Grandfather baseline: scripts/lint/design-doc-lint.baseline.json maps each
 * known-non-conforming doc to the rule ids it currently fails (as of R64).
 * Baselined failures WARN (do not block); any violation NOT in the baseline
 * ERRORS (exit 1). New docs carry no baseline entry, so they must conform.
 * R65 backfills the docs and deletes their baseline entries.
 *
 * Usage:
 *   node scripts/lint/design-doc-lint.mjs              # scan the design corpus
 *   node scripts/lint/design-doc-lint.mjs <path...>    # lint specific file(s)
 *   node scripts/lint/design-doc-lint.mjs --json       # machine-readable report
 *   node scripts/lint/design-doc-lint.mjs --update-baseline  # rewrite baseline from current state
 *
 * Wired into the post-round audit — see .agents/plan/PDCA.md.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DESIGN_ROOT = path.join(REPO_ROOT, '.agents', 'design');
const BASELINE_PATH = path.join(REPO_ROOT, 'scripts', 'lint', 'design-doc-lint.baseline.json');

// ── Canonical Surface-table vocab (D-1) — base tokens, lowercased for compare ──
const REUSABILITY = new Set(['shared cross-domain', 'feature', 'builder-only', 'backend', 'data type']);
const PURITY = new Set(['plain-ui', 'glue', 'data constant', 'feature', 'data type', 'pure']);

const RULES = {
  L1: 'L1-status-header',
  L2: 'L2-surface-vocab',
  L3: 'L3-token-map',
  L4: 'L4-scope-boundary',
  L5: 'L5-acceptance-criteria',
};

// ── File discovery ────────────────────────────────────────────────────────
function isLintable(relFromDesign) {
  // Skip the format README, _archive, and any `_`-prefixed meta/template file.
  const parts = relFromDesign.split(path.sep);
  if (parts.some((p) => p === '_archive' || p.startsWith('_'))) return false;
  if (relFromDesign === 'README.md') return false;
  return relFromDesign.endsWith('.md');
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function corpusFiles() {
  return walk(DESIGN_ROOT)
    .filter((f) => isLintable(path.relative(DESIGN_ROOT, f)))
    .sort();
}

function artifactType(file) {
  if (file.endsWith('.target.md')) return 'target';
  if (file.endsWith('.preview.html')) return 'preview';
  return 'canonical';
}

// ── Lightweight markdown helpers ────────────────────────────────────────────
function headings(text) {
  // Returns [{ level, title }] for ATX headings.
  return [...text.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((m) => ({
    level: m[1].length,
    title: m[2],
  }));
}

function hasHeading(text, re) {
  return headings(text).some((h) => re.test(h.title));
}

function sectionBody(text, titleRe) {
  // Body of the first heading whose title matches titleRe, up to the next
  // heading of the same-or-shallower level.
  const lines = text.split('\n');
  const hd = /^(#{1,6})\s+(.+?)\s*$/;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(hd);
    if (m && titleRe.test(m[2])) {
      start = i + 1;
      level = m[1].length;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(hd);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function baseToken(cell) {
  // "glue (server-data)" → "glue"; "`feature`" → "feature"; lowercased.
  return cell
    .replace(/`/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase();
}

function findSurfaceTable(text) {
  // Locate the header row carrying Surface · Layer · Reusability · Purity,
  // then return its data rows' Reusability + Purity base tokens.
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('|')) continue;
    const headerCells = lines[i].split('|').map((c) => c.trim().toLowerCase());
    const iReuse = headerCells.findIndex((c) => c === 'reusability');
    const iPurity = headerCells.findIndex((c) => c === 'purity');
    const hasSurface = headerCells.some((c) => c === 'surface');
    if (iReuse === -1 || iPurity === -1 || !hasSurface) continue;
    // Found it. Data rows follow the `---` separator, until a non-table line.
    const rows = [];
    for (let j = i + 2; j < lines.length; j++) {
      if (!lines[j].includes('|') || lines[j].trim() === '') break;
      const cells = lines[j].split('|').map((c) => c.trim());
      if (/^[-:\s|]+$/.test(lines[j])) continue; // stray separator
      rows.push({ reuse: cells[iReuse] ?? '', purity: cells[iPurity] ?? '' });
    }
    return { found: true, rows };
  }
  return { found: false, rows: [] };
}

// ── The five rules ──────────────────────────────────────────────────────────
function checkDoc(file) {
  const text = readFileSync(file, 'utf8');
  const type = artifactType(file);
  const fails = []; // { rule, detail }

  // L1 — status header with lifecycle vocab.
  const statusLine = text.match(/^\s*\*{0,2}status\*{0,2}\s*:\s*(.+)$/im);
  const lifecycle = type === 'target' ? /(target horizon|draft|accepted|superseded)/i : /(draft|accepted|superseded)/i;
  if (!statusLine || !lifecycle.test(statusLine[1])) {
    fails.push({ rule: RULES.L1, detail: statusLine ? `status "${statusLine[1].trim()}" lacks lifecycle vocab` : 'no Status header found' });
  }

  // L2 — surface-table Reusability/Purity vocab (canonical base tokens).
  const table = findSurfaceTable(text);
  if (!table.found) {
    fails.push({ rule: RULES.L2, detail: 'no Surface-declaration table (Surface · Layer · Reusability · Purity)' });
  } else {
    const bad = [];
    for (const row of table.rows) {
      const r = baseToken(row.reuse);
      const p = baseToken(row.purity);
      if (r && !REUSABILITY.has(r)) bad.push(`Reusability "${row.reuse.trim()}"`);
      if (p && !PURITY.has(p)) bad.push(`Purity "${row.purity.trim()}"`);
    }
    if (bad.length) fails.push({ rule: RULES.L2, detail: `off-canonical vocab: ${[...new Set(bad)].join(', ')}` });
  }

  // L3 — token map present + cites the source of truth. (n-a for target docs.)
  if (type !== 'target') {
    const body = sectionBody(text, /token map/i);
    if (body === null) {
      fails.push({ rule: RULES.L3, detail: 'no Token map section' });
    } else if (!/themeTokens\.ts/.test(body) && !/antd\s+seed/i.test(body)) {
      fails.push({ rule: RULES.L3, detail: 'Token map cites neither themeTokens.ts nor an AntD seed token' });
    }
  }

  // L4 — explicit scope boundary / out-of-scope section.
  if (!hasHeading(text, /scope boundary|out of scope|does not cover/i)) {
    fails.push({ rule: RULES.L4, detail: 'no Scope boundary / out-of-scope section' });
  }

  // L5 — acceptance-criteria / user-journeys section. (n-a for target docs.)
  if (type !== 'target') {
    if (!hasHeading(text, /acceptance crit|user journey/i)) {
      fails.push({ rule: RULES.L5, detail: 'no Acceptance-criteria / user-journeys section' });
    }
  }

  // Target-specifics.
  if (type === 'target') {
    if (!/target[\s-]not[\s-]current/i.test(text)) fails.push({ rule: 'T1-banner', detail: 'no TARGET-NOT-CURRENT banner' });
    if (!hasHeading(text, /named pull/i)) fails.push({ rule: 'T2-named-pulls', detail: 'no Named-pulls section' });
    if (!/(retire|lifecycle|fold .*canonical|delete the target)/i.test(text)) fails.push({ rule: 'T3-retire', detail: 'no retire/lifecycle clause' });
  }

  return { rule_ids: fails.map((f) => f.rule), fails, type };
}

// ── Baseline ─────────────────────────────────────────────────────────────────
function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return {};
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  delete raw._comment;
  delete raw._generated;
  return raw;
}

function relKey(file) {
  return path.relative(DESIGN_ROOT, file).split(path.sep).join('/');
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const updateBaseline = args.includes('--update-baseline');
const explicit = args.filter((a) => !a.startsWith('--'));

const files = explicit.length
  ? explicit.map((a) => path.resolve(process.cwd(), a))
  : corpusFiles();

const baseline = loadBaseline();
const report = [];
let errorCount = 0;
let warnCount = 0;

for (const file of files) {
  const key = relKey(file);
  const { rule_ids, fails } = checkDoc(file);
  const grandfathered = baseline[key] ?? [];
  const errors = fails.filter((f) => !grandfathered.includes(f.rule));
  const warns = fails.filter((f) => grandfathered.includes(f.rule));
  const staleBaseline = grandfathered.filter((r) => !rule_ids.includes(r)); // fixed since baselined
  errorCount += errors.length;
  warnCount += warns.length;
  report.push({ file: key, errors, warns, staleBaseline });
}

if (updateBaseline) {
  const next = {
    _comment:
      'Grandfathered design-doc conformance failures as of R64. Baselined failures WARN; non-baselined violations ERROR. R65 backfills docs and removes entries. Regenerate: node scripts/lint/design-doc-lint.mjs --update-baseline',
    _generated: 'R64 (data-management doc-template + lint)',
  };
  for (const file of corpusFiles()) {
    const { rule_ids } = checkDoc(file);
    if (rule_ids.length) next[relKey(file)] = rule_ids.sort();
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`✔ Baseline written: ${path.relative(REPO_ROOT, BASELINE_PATH)} (${Object.keys(next).length - 2} docs).`);
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify({ errorCount, warnCount, report }, null, 2));
  process.exit(errorCount ? 1 : 0);
}

// Human-readable.
for (const r of report) {
  if (!r.errors.length && !r.warns.length && !r.staleBaseline.length) {
    console.log(`✔ ${r.file}`);
    continue;
  }
  console.log(`\n${r.file}`);
  for (const f of r.errors) console.log(`  ✖ ERROR  ${f.rule} — ${f.detail}`);
  for (const f of r.warns) console.log(`  ⚠ warn   ${f.rule} — ${f.detail} (grandfathered → R65)`);
  for (const rule of r.staleBaseline) console.log(`  ℹ note   ${rule} now passes — remove from baseline`);
}

console.log(`\n${errorCount} error(s), ${warnCount} grandfathered warning(s) across ${report.length} doc(s).`);
if (errorCount) {
  console.log('Non-grandfathered violations block the audit. Fix the doc, or (if intentional) update the baseline.');
}
process.exit(errorCount ? 1 : 0);
