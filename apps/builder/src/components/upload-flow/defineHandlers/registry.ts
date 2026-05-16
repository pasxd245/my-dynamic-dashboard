import csvHandler from "./csvHandler";
import excelHandler from "./excelHandler";
import type { SourceTypeDefineHandler, SourceTypeKey } from "./types";

/**
 * Handler registry — maps SourceTypeKey to SourceTypeDefineHandler.
 *
 * Provides lookup by source type. Handlers for URL, API, and text
 * are stubbed here for future rounds (R45+).
 */
export const defineHandlerRegistry: Record<SourceTypeKey, SourceTypeDefineHandler> = {
  csv: csvHandler,
  excel: excelHandler,
  // Queued for future rounds (R45+)
  url: {
    layoutCard: undefined,
    beforeSchemaPreview: undefined,
    validate: () => ({ ok: true, reasons: [] }),
  },
  api: {
    layoutCard: undefined,
    beforeSchemaPreview: undefined,
    validate: () => ({ ok: true, reasons: [] }),
  },
  text: {
    layoutCard: undefined,
    beforeSchemaPreview: undefined,
    validate: () => ({ ok: true, reasons: [] }),
  },
};

/**
 * getDefineHandler — lookup a handler by source type key.
 * Falls back to a no-op handler if the key is not registered.
 */
export function getDefineHandler(sourceType: SourceTypeKey): SourceTypeDefineHandler {
  return defineHandlerRegistry[sourceType] ?? {
    layoutCard: undefined,
    beforeSchemaPreview: undefined,
    validate: () => ({ ok: true, reasons: [] }),
  };
}
