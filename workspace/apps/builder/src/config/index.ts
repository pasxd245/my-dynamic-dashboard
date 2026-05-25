/**
 * Config module — R27 (readiness chain) seeds the surface.
 *
 * Full `AppConfig` facade (typed accessors over Pydantic-validated values)
 * lands in R28. Today: just `Fields` (dotted-key constants) and `Const`
 * (non-overridable defaults). Call sites that need env vars read
 * `import.meta.env.VITE_*` directly; R28's `AppConfig` will wrap that.
 */
export { Const } from "./const";
export { Fields } from "./fields";
export type { FieldKey } from "./fields";
