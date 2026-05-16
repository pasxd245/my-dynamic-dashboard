import type { LoadedSkill } from "./loader.js";

// Composes a base system prompt with one or more loaded skill bodies.
// Each skill is wrapped in a versioned HTML-comment delimiter so a
// downstream reader (human or LLM) can see exactly which skill is
// active and at what content hash. Editing the SKILL.md changes the
// fingerprint suffix, which is the right cache-invalidation signal.
export function composeSystemPrompt(
  base: string,
  skills: readonly LoadedSkill[],
): string {
  if (!skills.length) return base;
  const blocks = skills
    .map((s) => {
      const tag = `skill:${s.name}@${s.fingerprint.slice(0, 8)}`;
      return `\n<!-- ${tag} BEGIN -->\n${s.body}\n<!-- ${tag} END -->`;
    })
    .join("\n");
  return `${base.trimEnd()}\n${blocks}\n`;
}
