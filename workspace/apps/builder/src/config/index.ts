/**
 * Config module — R27 seeded the surface; R28 added the `appConfig`
 * facade.
 *
 * Call sites read config via `appConfig.apiBaseUrl()` etc. — no more
 * scattered `import.meta.env.VITE_*` reads at api-client sites.
 */
export { appConfig } from "./appConfig";
export { Const } from "./const";
export { Fields } from "./fields";
export type { FieldKey } from "./fields";
