import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import yaml from "js-yaml";

export interface LoadedSkill {
  name: string;
  description: string;
  body: string;
  fingerprint: string;
  dir: string;
}

export class SkillNotFoundError extends Error {
  constructor(public readonly name: string, public readonly path: string) {
    super(`Skill "${name}" not found at ${path}`);
    this.name = "SkillNotFoundError";
  }
}

export class SkillManifestError extends Error {
  constructor(public readonly path: string, msg: string) {
    super(`Skill manifest invalid at ${path}: ${msg}`);
    this.name = "SkillManifestError";
  }
}

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// Splits a SKILL.md into (frontmatter object, body). Throws if the
// frontmatter block is missing — every SKILL.md in this repo declares
// at least `name` and `description`, and we want a fast failure if a
// caller points at the wrong file.
function parseSkillMd(raw: string, path: string): { fm: Record<string, unknown>; body: string } {
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) {
    throw new SkillManifestError(path, "missing YAML frontmatter block");
  }
  const fm = (yaml.load(m[1]!) ?? {}) as Record<string, unknown>;
  const body = raw.slice(m[0]!.length).trimStart();
  return { fm, body };
}

function fingerprintOf(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export interface LoadSkillsOptions {
  /** Skill root. Default `.agents/skills`. */
  dir?: string;
  /** When true, missing skills are silently dropped instead of throwing. */
  ignoreMissing?: boolean;
}

export async function loadSkills(
  names: readonly string[],
  opts: LoadSkillsOptions = {},
): Promise<LoadedSkill[]> {
  const root = resolve(
    process.cwd(),
    opts.dir ?? process.env.SELFEVO_SKILLS_DIR ?? ".agents/skills",
  );
  const out: LoadedSkill[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (!NAME_RE.test(name)) {
      throw new SkillManifestError(name, `invalid skill name (must match ${NAME_RE})`);
    }
    const path = join(root, name, "SKILL.md");
    if (!existsSync(path)) {
      if (opts.ignoreMissing) continue;
      throw new SkillNotFoundError(name, path);
    }
    const raw = await readFile(path, "utf8");
    const { fm, body } = parseSkillMd(raw, path);
    const description = typeof fm.description === "string"
      ? fm.description.trim()
      : "";
    out.push({
      name,
      description,
      body: body.trim(),
      fingerprint: fingerprintOf(body),
      dir: join(root, name),
    });
  }
  return out;
}

export function bundleFingerprint(skills: readonly LoadedSkill[]): string {
  if (!skills.length) return "";
  const h = createHash("sha256");
  for (const s of skills) {
    h.update(s.name);
    h.update("\0");
    h.update(s.fingerprint);
    h.update("\0");
  }
  return h.digest("hex");
}
