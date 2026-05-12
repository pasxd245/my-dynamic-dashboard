import { describe, expect, it } from "vitest";

import {
  classifyErrorCode,
  getErrorKindMeta,
  getErrorMetaForCode,
} from "../errorKinds";

describe("classifyErrorCode", () => {
  it("classifies encrypted_file backend code", () => {
    expect(classifyErrorCode("encrypted_file")).toBe("encrypted_file");
  });

  it("classifies malformed-file kinds (parse_failed + sheet_discovery_failed)", () => {
    expect(classifyErrorCode("parse_failed")).toBe("malformed_file");
    expect(classifyErrorCode("sheet_discovery_failed")).toBe("malformed_file");
  });

  it("classifies unsupported_file as unsupported_extension", () => {
    expect(classifyErrorCode("unsupported_file")).toBe("unsupported_extension");
  });

  it("classifies source_type_mismatch", () => {
    expect(classifyErrorCode("source_type_mismatch")).toBe("source_type_mismatch");
  });

  it("classifies invalid_source_type as missing_source_type", () => {
    expect(classifyErrorCode("invalid_source_type")).toBe("missing_source_type");
  });

  it("classifies empty_sheet", () => {
    expect(classifyErrorCode("empty_sheet")).toBe("empty_sheet");
  });

  it("classifies sheet_*_not_supported as sheet_not_supported", () => {
    expect(classifyErrorCode("sheet_discovery_not_supported")).toBe("sheet_not_supported");
    expect(classifyErrorCode("sheet_selection_not_supported")).toBe("sheet_not_supported");
  });

  it("classifies smoke_run_not_found as not_found", () => {
    expect(classifyErrorCode("smoke_run_not_found")).toBe("not_found");
  });

  it("falls back to unknown for unrecognized codes", () => {
    expect(classifyErrorCode("brand_new_code_we_dont_know")).toBe("unknown");
    expect(classifyErrorCode("")).toBe("unknown");
  });
});

describe("getErrorKindMeta", () => {
  it("returns severity 'error' for encrypted_file and malformed_file", () => {
    expect(getErrorKindMeta("encrypted_file").severity).toBe("error");
    expect(getErrorKindMeta("malformed_file").severity).toBe("error");
    expect(getErrorKindMeta("unknown").severity).toBe("error");
  });

  it("returns severity 'warning' for source/file mismatch kinds", () => {
    expect(getErrorKindMeta("unsupported_extension").severity).toBe("warning");
    expect(getErrorKindMeta("source_type_mismatch").severity).toBe("warning");
    expect(getErrorKindMeta("empty_sheet").severity).toBe("warning");
    expect(getErrorKindMeta("not_found").severity).toBe("warning");
  });

  it("returns severity 'info' for advisory kinds", () => {
    expect(getErrorKindMeta("missing_source_type").severity).toBe("info");
    expect(getErrorKindMeta("sheet_not_supported").severity).toBe("info");
  });

  it("every kind exposes a non-empty title and guidance", () => {
    const kinds = [
      "encrypted_file",
      "malformed_file",
      "unsupported_extension",
      "source_type_mismatch",
      "missing_source_type",
      "empty_sheet",
      "sheet_not_supported",
      "not_found",
      "unknown",
    ] as const;
    for (const kind of kinds) {
      const meta = getErrorKindMeta(kind);
      expect(meta.title.length).toBeGreaterThan(0);
      expect(meta.guidance.length).toBeGreaterThan(0);
    }
  });
});

describe("getErrorMetaForCode", () => {
  it("composes classifyErrorCode + getErrorKindMeta", () => {
    const meta = getErrorMetaForCode("encrypted_file");
    expect(meta.kind).toBe("encrypted_file");
    expect(meta.title).toContain("password-protected");
  });

  it("returns unknown meta for unrecognized codes", () => {
    const meta = getErrorMetaForCode("brand_new");
    expect(meta.kind).toBe("unknown");
    expect(meta.severity).toBe("error");
  });
});
