#!/usr/bin/env node
/**
 * js-tmpl render harness (R27).
 *
 * Wraps `@nci-gis/js-tmpl`'s programmatic API to render
 * `workspace/values.yaml` + `workspace/config/<app>/...` templates into
 * `workspace/apps/<app>/...` outputs.
 *
 * Why this exists instead of `pnpm exec js-tmpl render`:
 *   The js-tmpl CLI (v0.1.0) has an `isDirectRun` check in
 *   `src/cli/main.js` that compares `import.meta.url` to
 *   `process.argv[1]`. Under pnpm, the symlink path used by
 *   `process.argv[1]` differs from the real `.pnpm/...` path
 *   resolved by `import.meta.url`, so the check fails and `main()`
 *   never runs — the CLI silently exits 0. The programmatic API
 *   (`renderDirectory`, `resolveConfig`) doesn't have this issue
 *   because it's invoked directly.
 *
 *   File reference for the lib bug: dogfooding signal back to
 *   `@nci-gis/js-tmpl` — capture as an upstream issue when the
 *   readiness chain is stable.
 *
 * Usage:
 *   node scripts/config-render.mjs
 *
 * Invoked via `pnpm config:render` (root package.json script).
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

import { renderDirectory, resolveConfig } from '@nci-gis/js-tmpl';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const CONFIG_DIR = path.join(REPO_ROOT, 'workspace', 'config');

// Move into workspace/config/ so js-tmpl auto-discovers
// js-tmpl.config.yaml there (priority-1 lookup) and resolves
// valuesFile/templateDir against the same CWD.
process.chdir(CONFIG_DIR);

const cfg = resolveConfig({ command: 'render' }, CONFIG_DIR);

await renderDirectory(cfg);

console.log('✔ js-tmpl render complete.');
