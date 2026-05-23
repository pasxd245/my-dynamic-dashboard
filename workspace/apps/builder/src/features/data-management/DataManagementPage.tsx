import { theme, Typography } from "antd";

export function DataManagementPage() {
  const { token } = theme.useToken();
  return (
    <section>
      <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
        Data Management
      </Typography.Title>
      <Typography.Paragraph
        style={{ color: token.colorTextSecondary, marginBottom: 24, maxWidth: "64ch" }}
      >
        Round 07 ships this page as a placeholder. Later rounds will land the
        real features here.
      </Typography.Paragraph>
      <div
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: 32,
          maxWidth: 960,
        }}
      >
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          What will live here
        </Typography.Title>
        <Typography.Paragraph>
          CSV upload for CRM exports, a dataset list pulled from DuckDB, and
          basic schema inspection. Each is its own future round with its own
          design document under <code>.agents/design/data-management/</code>.
        </Typography.Paragraph>
        <Typography.Paragraph
          style={{ color: token.colorTextTertiary, marginBottom: 0 }}
        >
          No backend wiring this round; the page is intentionally static.
        </Typography.Paragraph>
      </div>
    </section>
  );
}
