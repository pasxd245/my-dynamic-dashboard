#!/usr/bin/env node
/**
 * Design-doc token-map PARITY lint (R66).
 *
 * The companion to design-doc-lint.mjs's L3 rule. L3 (R64) checks a Token
 * map is PRESENT and cites the source of truth in FORM; this script checks
 * the cited token identifiers actually EXIST in the source of truth —
 * catching stale / wrong cites a presence+form check structurally cannot.
 *
 * Source of truth (R66 J-1 = A): the six seed tokens in
 * workspace/packages/ui/src/themeTokens.ts PLUS everything AntD derives from
 * them — i.e. the live `theme.getDesignToken()` registry of the installed
 * antd. This is the surface the app actually renders
 * (<ConfigProvider theme={themeTokens}>). The archived
 * .agents/design/_archive/_css/tokens.css `--color-*` mirror is NOT the
 * source of truth; citing it (or any `--css-var`) is a parity failure.
 *
 * Check (R66 J-2 = identifier-existence): each cited token NAME must resolve
 * in the registry. The informational `Value` column is not asserted against
 * the resolved value (robust across antd version bumps).
 *
 * Two failure shapes per Token-map section:
 *   P1-stale-cite   — the section mentions `tokens.css` or a `--css-var`
 *                     (the retired archived-mirror vocabulary).
 *   P2-unknown-token — a cited camelCase identifier (e.g. `colorBgLayout`)
 *                     is not in the AntD token registry.
 *
 * A camelCase backticked identifier (`^[a-z][a-zA-Z0-9]*$` with ≥1 uppercase)
 * inside the Token-map section is treated as a token claim. Prose words
 * ("derived", "system") have no uppercase and are ignored; component names
 * (`<Popover>`) carry angle brackets and are ignored.
 *
 * Usage:
 *   node scripts/design-token-parity.mjs            # scan the design corpus
 *   node scripts/design-token-parity.mjs <path...>  # specific file(s)
 *   node scripts/design-token-parity.mjs --json      # machine-readable
 *
 * Wired into the post-round audit — see .agents/plan/PDCA.md.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const DESIGN_ROOT = path.join(REPO_ROOT, '.agents', 'design');
const UI_PKG = path.join(REPO_ROOT, 'workspace', 'packages', 'ui', 'package.json');
const THEME_TOKENS = path.join(REPO_ROOT, 'workspace', 'packages', 'ui', 'src', 'themeTokens.ts');

// ── Source of truth: AntD derived registry + themeTokens.ts seeds ───────────
async function loadValidTokens() {
  // antd is a workspace/packages/ui dependency — resolve from there.
  const req = createRequire(UI_PKG);
  const antd = await import(pathToFileURL(req.resolve('antd')).href);
  const theme = antd.theme ?? antd.default?.theme;
  if (!theme?.getDesignToken) {
    throw new Error('Could not load antd `theme.getDesignToken` from the ui package.');
  }
  const registry = new Set(Object.keys(theme.getDesignToken()));
  // Seed keys declared in themeTokens.ts (belt-and-braces; all are in the
  // registry already, but we read them so a seed rename surfaces here too).
  for (const m of readFileSync(THEME_TOKENS, 'utf8').matchAll(/^\s*([a-z][a-zA-Z0-9]*)\s*:/gm)) {
    registry.add(m[1]);
  }
  return registry;
}

// ── File discovery (mirrors design-doc-lint.mjs) ────────────────────────────
function isLintable(rel) {
  const parts = rel.split(path.sep);
  if (parts.some((p) => p === '_archive' || p.startsWith('_'))) return false;
  if (rel === 'README.md') return false;
  return rel.endsWith('.md');
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
function relKey(file) {
  return path.relative(DESIGN_ROOT, file).split(path.sep).join('/');
}

// ── Token-map section extraction (same algorithm as design-doc-lint) ────────
function tokenMapSection(text) {
  const lines = text.split('\n');
  const hd = /^(#{1,6})\s+(.+?)\s*$/;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(hd);
    if (m && /token map/i.test(m[2])) {
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

// ── The parity checks ───────────────────────────────────────────────────────
const CAMEL = /^[a-z][a-zA-Z0-9]*$/;
function checkDoc(file, valid) {
  const body = tokenMapSection(readFileSync(file, 'utf8'));
  if (body === null) return { hasMap: false, fails: [] };
  const fails = [];

  // P1 — retired archived-mirror vocabulary.
  if (/tokens\.css/.test(body)) {
    fails.push({ rule: 'P1-stale-cite', detail: 'cites `tokens.css` (archived preview mirror — not the source of truth)' });
  }
  const cssVars = [...new Set([...body.matchAll(/--[a-z][a-z0-9-]*/g)].map((m) => m[0]))];
  if (cssVars.length) {
    fails.push({ rule: 'P1-stale-cite', detail: `cites archived CSS vars: ${cssVars.slice(0, 6).join(', ')}${cssVars.length > 6 ? ` (+${cssVars.length - 6} more)` : ''}` });
  }

  // P2 — cited camelCase identifiers must resolve in the AntD registry.
  const unknown = new Set();
  for (const m of body.matchAll(/`([^`]+)`/g)) {
    const id = m[1].trim();
    if (!CAMEL.test(id)) continue; // skip prose, `<Components>`, `borderRadius: 6`, hex, px
    if (!/[A-Z]/.test(id)) continue; // skip single lowercase words ("derived")
    if (!valid.has(id)) unknown.add(id);
  }
  for (const id of unknown) {
    fails.push({ rule: 'P2-unknown-token', detail: `\`${id}\` is not an AntD / themeTokens token` });
  }
  return { hasMap: true, fails };
}

// ── Main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const explicit = args.filter((a) => !a.startsWith('--'));
const files = explicit.length
  ? explicit.map((a) => path.resolve(process.cwd(), a))
  : corpusFiles();

const valid = await loadValidTokens();
const report = [];
let errorCount = 0;
let mapCount = 0;
for (const file of files) {
  const { hasMap, fails } = checkDoc(file, valid);
  if (hasMap) mapCount++;
  errorCount += fails.length;
  report.push({ file: relKey(file), hasMap, fails });
}

if (asJson) {
  console.log(JSON.stringify({ errorCount, mapCount, report }, null, 2));
  process.exit(errorCount ? 1 : 0);
}

for (const r of report) {
  if (!r.hasMap) continue;
  if (!r.fails.length) {
    console.log(`✔ ${r.file}`);
    continue;
  }
  console.log(`\n${r.file}`);
  for (const f of r.fails) console.log(`  ✖ ${f.rule} — ${f.detail}`);
}
console.log(`\n${errorCount} parity error(s) across ${mapCount} token map(s).`);
if (errorCount) {
  console.log('Cite live AntD / themeTokens token names (e.g. `colorBgLayout`); the `--color-*` / tokens.css mirror is archived (R66).');
}
process.exit(errorCount ? 1 : 0);
