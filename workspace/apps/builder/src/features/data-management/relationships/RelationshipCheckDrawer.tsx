// R183 — the relationship self-check, read-only: what the keys actually do on
// both sides (coverage, unmatched rows, repeats), the OBSERVED cardinality
// next to the declared one, and whether a join in either direction multiplies
// rows. Flags, never blocks. The drawer also carries the relationship's
// metadata (R180), which had no surface until now.

import { WarningOutlined } from '@ant-design/icons';
import { Alert, Descriptions, Drawer, Progress, Skeleton, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { MetadataPanel } from '@/features/metadata/MetadataPanel';
import { ApiErrorThrown } from '../_shared/types';
import { useRelationshipCheckQuery } from './hooks';
import type { Relationship, RelationshipCheck } from './types';

function pct(v: number): number {
  return Math.round(v * 1000) / 10;
}

/** The findings as flags: an empty list means "as declared, nothing to watch". */
export function checkFlags(check: RelationshipCheck): ('cardinality' | 'multipliesLeft' | 'multipliesRight' | 'leftUnmatched' | 'rightUnmatched')[] {
  const out: ('cardinality' | 'multipliesLeft' | 'multipliesRight' | 'leftUnmatched' | 'rightUnmatched')[] = [];
  if (!check.cardinalityMatches) out.push('cardinality');
  if (check.multipliesLeft) out.push('multipliesLeft');
  if (check.multipliesRight) out.push('multipliesRight');
  if (check.leftUnmatchedRows > 0) out.push('leftUnmatched');
  if (check.rightUnmatchedRows > 0) out.push('rightUnmatched');
  return out;
}

export function RelationshipCheckView({
  check,
  leftName,
  rightName,
}: Readonly<{ check: RelationshipCheck; leftName: string; rightName: string }>) {
  const { t } = useTranslation();
  const flags = checkFlags(check);
  const side = (name: string, rows: number, matched: number, unmatched: number, coverage: number, keys: number, max: number) => (
    <div data-component="RelationshipCheckSide" style={{ marginBottom: 12 }}>
      <Typography.Text strong>{name}</Typography.Text>
      <Progress percent={pct(coverage)} size="small" status={unmatched > 0 ? 'exception' : 'success'} />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('relationships.check.side', { matched: matched.toLocaleString(), rows: rows.toLocaleString(), unmatched: unmatched.toLocaleString() })}
        {' · '}
        {t('relationships.check.keys', { keys: keys.toLocaleString(), max })}
      </Typography.Text>
    </div>
  );
  return (
    <div data-component="RelationshipCheck" data-flags={flags.join(' ')}>
      {side(leftName, check.leftRows, check.leftMatchedRows, check.leftUnmatchedRows, check.leftCoverage, check.leftDistinctKeys, check.leftMaxPerKey)}
      {side(rightName, check.rightRows, check.rightMatchedRows, check.rightUnmatchedRows, check.rightCoverage, check.rightDistinctKeys, check.rightMaxPerKey)}
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
        <Descriptions.Item label={t('relationships.check.declared')}>
          <Tag>{t(`relationships.cardinality.${check.declaredCardinality}`)}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('relationships.check.observed')}>
          <Tag color={check.cardinalityMatches ? 'success' : 'warning'} data-component="RelationshipCheckObserved">
            {t(`relationships.cardinality.${check.observedCardinality}`)}
          </Tag>
          {check.cardinalityMatches ? null : (
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              <WarningOutlined /> {t('relationships.check.mismatch')}
            </Typography.Text>
          )}
        </Descriptions.Item>
      </Descriptions>
      {check.multipliesLeft ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          data-component="RelationshipCheckMultiplies"
          title={t('relationships.check.multiplies', { from: leftName, to: rightName, max: check.rightMaxPerKey })}
        />
      ) : null}
      {check.multipliesRight ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          data-component="RelationshipCheckMultiplies"
          title={t('relationships.check.multiplies', { from: rightName, to: leftName, max: check.leftMaxPerKey })}
        />
      ) : null}
      {flags.length === 0 ? <Alert type="success" showIcon title={t('relationships.check.clean')} /> : null}
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        {t('relationships.check.checkedAt', { when: check.checkedAt })}
      </Typography.Text>
    </div>
  );
}

export function RelationshipCheckDrawer({
  rel,
  datasetName,
  onClose,
}: Readonly<{ rel: Relationship | null; datasetName: (id: string) => string; onClose: () => void }>) {
  const { t } = useTranslation();
  const q = useRelationshipCheckQuery(rel?.id, rel !== null);
  const stale = q.error instanceof ApiErrorThrown && q.error.body.code === 'relationship_stale';
  return (
    <Drawer
      open={rel !== null}
      onClose={onClose}
      width={460}
      title={rel ? `${datasetName(rel.leftDatasetId)}.${rel.leftColumn} ↔ ${datasetName(rel.rightDatasetId)}.${rel.rightColumn}` : ''}
      data-component="RelationshipCheckDrawer"
    >
      {rel === null ? null : q.isLoading ? (
        <Skeleton active />
      ) : q.data ? (
        <>
          <RelationshipCheckView check={q.data} leftName={datasetName(rel.leftDatasetId)} rightName={datasetName(rel.rightDatasetId)} />
          <div style={{ marginTop: 16 }}>
            <MetadataPanel kind="relationship" nounId={rel.id} alwaysShow />
          </div>
        </>
      ) : (
        <Alert type={stale ? 'warning' : 'error'} showIcon title={stale ? t('relationships.check.stale') : t('relationships.check.failed')} />
      )}
    </Drawer>
  );
}
