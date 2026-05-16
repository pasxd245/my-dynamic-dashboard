import type { ReactNode } from "react";
import type { UploadFlowState } from "../../../state";

/**
 * SourceTypeDefineHandler — strategy interface for per-source-type Define section rendering.
 *
 * Each source type (CSV, Excel, URL, API, text) provides:
 * - layoutCard: optional UI before schema preview (e.g., Excel sheet picker)
 * - beforeSchemaPreview: optional UI before the schema preview card
 * - validate: readiness gate (returns ok + blocking reasons)
 *
 * Handlers are registered in registry.ts and looked up by SourceTypeKey.
 */

export interface SourceTypeDefineHandler {
  /**
   * layoutCard — optional UI for source-specific extraction configuration.
   * Examples: Excel sheet selector, CSV delimiter picker.
   * Positioned after entity identity, before schema preview.
   */
  layoutCard?: (state: UploadFlowState) => ReactNode;

  /**
   * beforeSchemaPreview — optional UI positioned before the schema preview card.
   * Use for multi-part validation workflows or pre-schema context.
   */
  beforeSchemaPreview?: (state: UploadFlowState) => ReactNode;

  /**
   * validate — readiness gate. Returns { ok: boolean; reasons: string[] }.
   * Blocks the "Continue to Publish" CTA if ok === false.
   * reasons lists blocking issues (one per string).
   */
  validate: (state: UploadFlowState) => { ok: boolean; reasons: string[] };
}

export type SourceTypeKey = "csv" | "excel" | "url" | "api" | "text";
