// R202 (item 5.2) — how a severity looks: a coloured tag (cards, badges, At a
// glance) and a dot (dataset column headers). Labels come from i18n.

import { Tag, theme } from 'antd';
import { useTranslation } from 'react-i18next';

import type { Severity } from './reserved';

export const SEVERITY_TAG_COLOR: Record<Severity, string> = {
  error: 'red',
  decide: 'orange',
  warn: 'gold',
  info: 'blue',
};

export function SeverityTag({ severity, count }: Readonly<{ severity: Severity; count?: number }>) {
  const { t } = useTranslation();
  return (
    <Tag
      color={SEVERITY_TAG_COLOR[severity]}
      style={{ marginInlineEnd: 0 }}
      data-component="MetadataSeverity"
      data-severity={severity}
    >
      {count !== undefined && count > 1
        ? `${t(`metadata.severity.${severity}`)} ×${count}`
        : t(`metadata.severity.${severity}`)}
    </Tag>
  );
}

/** The dot's colour: the severity's, grey when the noun has notes but none carries one. */
export function useSeverityDotColor(severity: Severity | undefined): string {
  const { token } = theme.useToken();
  switch (severity) {
    case 'error':
      return token.colorError;
    case 'decide':
      return token.orange;
    case 'warn':
      return token.colorWarning;
    case 'info':
      return token.colorInfo;
    default:
      return token.colorTextQuaternary;
  }
}
