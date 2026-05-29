// AdvancedQueryHelp (R54) — the `?` reference popover that closes
// the learnability gap: a user can discover the operators + the
// dataset's columns without trial and error.
//
// Content is rendered from the LIVE vocabulary (SYNTAX_REFERENCE,
// derived from the parser's prefix maps) + `Dataset.columns`, so a
// later round that extends the operator set surfaces here for free.

import { QuestionIcon } from '@phosphor-icons/react';
import { Popover, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import type { Column } from '../types';
import { SYNTAX_REFERENCE, familiesForColumns } from './reference';

const LIST_STYLE: React.CSSProperties = { margin: '2px 0 6px', paddingInlineStart: 18 };

export function AdvancedQueryHelp({ columns }: Readonly<{ columns: readonly Column[] }>) {
  const { t } = useTranslation();
  const families = familiesForColumns(columns.map((c) => c.dtype));

  const content = (
    <div
      data-component="AdvancedQueryHelpContent"
      style={{ maxWidth: 320, maxHeight: 360, overflow: 'auto' }}
    >
      <Typography.Paragraph style={{ fontSize: 12, marginBottom: 8 }}>
        {t('datasets.advancedQuery.help.syntax')}
      </Typography.Paragraph>

      <Typography.Text strong style={{ fontSize: 12 }}>
        {t('datasets.advancedQuery.help.operators')}
      </Typography.Text>
      {families.map((fam) => (
        <div key={fam} style={{ marginTop: 4 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {t(`datasets.advancedQuery.help.family.${fam}`)}
          </Typography.Text>
          <ul style={LIST_STYLE}>
            {SYNTAX_REFERENCE[fam].map((e) => (
              <li key={`${e.token}:${e.op}`} style={{ fontSize: 12 }}>
                <code>:{e.token}</code> {t(`datasets.filters.op.${e.op}`)}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Typography.Text strong style={{ fontSize: 12 }}>
        {t('datasets.advancedQuery.help.columns')}
      </Typography.Text>
      <ul style={LIST_STYLE} data-component="AdvancedQueryHelpColumns">
        {columns.map((c) => (
          <li key={c.name} style={{ fontSize: 12 }}>
            {/* Quote names with whitespace so the shown key is the
                typeable form: `"customer number":value`. */}
            <code>{/\s/.test(c.name) ? `"${c.name}"` : c.name}</code>{' '}
            <Typography.Text type="secondary">[{t(`datasets.detail.dtype.${c.dtype}`)}]</Typography.Text>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Popover
      content={content}
      title={t('datasets.advancedQuery.help.title')}
      trigger="click"
      placement="bottomLeft"
    >
      {/* Tooltip (hover) names the icon before the click reveals the
          full syntax popover; reuses the accessible name so the
          visible hint and aria-label stay in sync. */}
      <Tooltip title={t('datasets.advancedQuery.help.ariaLabel')}>
        <button
          type="button"
          className="aq-icon-btn aq-help-btn"
          aria-label={t('datasets.advancedQuery.help.ariaLabel')}
          data-component="AdvancedQueryHelpTrigger"
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            marginInlineStart: 6,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <QuestionIcon size={16} />
        </button>
      </Tooltip>
    </Popover>
  );
}
