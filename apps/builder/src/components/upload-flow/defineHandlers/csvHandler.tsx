import { Card, Typography } from "antd";
import type { SourceTypeDefineHandler } from "./types";

const csvHandler: SourceTypeDefineHandler = {
  /**
   * CSV does not require additional layout configuration in R41.
   * (Encoding / delimiter knobs queued for R44.)
   */
  layoutCard: () => (
    <Card size="small" title="CSV Configuration">
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        CSV is loaded with default encoding (UTF-8) and delimiter (comma).
        Advanced extraction parameters (encoding, delimiter, quote character)
        land in a later round.
      </Typography.Paragraph>
    </Card>
  ),

  /**
   * No pre-schema preview UI for CSV.
   */
  beforeSchemaPreview: undefined,

  /**
   * CSV readiness: no blocking conditions in R41.
   * (Type-correction and role-assignment gates land in R42+.)
   */
  validate: () => ({
    ok: true,
    reasons: [],
  }),
};

export default csvHandler;
