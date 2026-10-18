// R195 (item 3.7b) — the query page's Parameters panel (dashboard-filters.md D1)
// and the value inputs a read asks for when a used parameter has no value.
//
// `QueryParamsPanel` declares parameters on the working copy: name, type, label,
// default (a literal, or for dates "today ± n days"). The filter popover and the
// steps editor then offer "Use parameter" on value fields of a fitting type.
// `ParamValueInputs` renders one input per parameter needing a value (the
// preview's own values, or the query view's URL values) — never saved.

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Input, InputNumber, Select, Space, Tooltip, Typography } from 'antd';
import { createContext } from 'react';
import { useTranslation } from 'react-i18next';

import { MAX_PARAMS, PARAM_NAME_RE, isRelative, nextParamName, valueFits } from './params';
import type { QueryParam } from './types';

/** R195 — the working copy's declared parameters, for the value editors deep in
 *  the steps editor (a context, not a prop through every card). */
export const QueryParamsContext = createContext<readonly QueryParam[]>([]);

type DefaultMode = 'none' | 'value' | 'today';

function modeOf(p: QueryParam): DefaultMode {
  if (p.default === undefined) return 'none';
  return isRelative(p.default) ? 'today' : 'value';
}

/** Why the declarations cannot be saved yet (a bad or duplicate name, a default
 *  that does not fit its type), or `undefined` when they can. */
export function invalidParams(params: readonly QueryParam[]): string | undefined {
  const seen = new Set<string>();
  for (const p of params) {
    if (!PARAM_NAME_RE.test(p.name)) return p.name;
    if (seen.has(p.name)) return p.name;
    seen.add(p.name);
    if (p.default !== undefined && !isRelative(p.default) && !valueFits(p.type, String(p.default))) return p.name;
  }
  return undefined;
}

export function QueryParamsPanel({
  params,
  onChange,
}: Readonly<{ params: readonly QueryParam[]; onChange: (next: QueryParam[]) => void }>) {
  const { t } = useTranslation();
  const names = params.map((p) => p.name);
  const set = (i: number, patch: Partial<QueryParam>) =>
    onChange(
      params.map((p, k) => {
        if (k !== i) return p;
        const next: QueryParam = { ...p, ...patch };
        // Changing the type drops a default that no longer fits it.
        if (patch.type && patch.type !== p.type) delete next.default;
        if (next.label === '') delete next.label;
        return next;
      }),
    );
  const setDefault = (i: number, mode: DefaultMode) => {
    const p = params[i];
    const next: QueryParam = { ...p };
    if (mode === 'none') delete next.default;
    else if (mode === 'today') next.default = { kind: 'today', offsetDays: 0 };
    else next.default = p.type === 'number' ? 0 : '';
    onChange(params.map((q, k) => (k === i ? next : q)));
  };

  return (
    <div data-component="QueryParamsPanel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('queries.params.hint')}
      </Typography.Text>
      {params.map((p, i) => {
        const nameBad = !PARAM_NAME_RE.test(p.name) || names.indexOf(p.name) !== i;
        const mode = modeOf(p);
        const literal = mode === 'value' ? String(p.default ?? '') : '';
        const defaultBad = mode === 'value' && !valueFits(p.type, literal);
        return (
          <Space key={i} wrap size={6} align="start" data-component="QueryParamRow" data-name={p.name}>
            <Tooltip title={nameBad ? t('queries.params.nameRule') : undefined}>
              <Input
                value={p.name}
                status={nameBad ? 'error' : undefined}
                onChange={(e) => set(i, { name: e.target.value.trim() })}
                style={{ width: 130 }}
                aria-label={t('queries.params.name')}
                data-component="QueryParamName"
              />
            </Tooltip>
            <Select
              value={p.type}
              onChange={(type: QueryParam['type']) => set(i, { type })}
              style={{ width: 100 }}
              aria-label={t('queries.params.type')}
              options={(['date', 'number', 'string'] as const).map((v) => ({
                value: v,
                label: t(`queries.params.types.${v}`),
              }))}
              data-component="QueryParamType"
            />
            <Input
              value={p.label ?? ''}
              placeholder={t('queries.params.label')}
              maxLength={60}
              onChange={(e) => set(i, { label: e.target.value })}
              style={{ width: 140 }}
              aria-label={t('queries.params.label')}
              data-component="QueryParamLabel"
            />
            <Select
              value={mode}
              onChange={(m: DefaultMode) => setDefault(i, m)}
              style={{ width: 150 }}
              aria-label={t('queries.params.default')}
              options={[
                { value: 'none', label: t('queries.params.noDefault') },
                { value: 'value', label: t('queries.params.fixedDefault') },
                ...(p.type === 'date' ? [{ value: 'today', label: t('queries.params.todayDefault') }] : []),
              ]}
              data-component="QueryParamDefaultMode"
            />
            {mode === 'value' &&
              (p.type === 'number' ? (
                <InputNumber
                  value={typeof p.default === 'number' ? p.default : null}
                  onChange={(n) => set(i, { default: n ?? 0 })}
                  controls={false}
                  style={{ width: 120 }}
                  aria-label={t('queries.params.default')}
                  data-component="QueryParamDefault"
                />
              ) : (
                <Input
                  type={p.type === 'date' ? 'date' : 'text'}
                  value={literal}
                  status={defaultBad ? 'error' : undefined}
                  onChange={(e) => set(i, { default: e.target.value })}
                  style={{ width: 150 }}
                  aria-label={t('queries.params.default')}
                  data-component="QueryParamDefault"
                />
              ))}
            {mode === 'today' && isRelative(p.default) && (
              <Space size={4}>
                <Typography.Text>{t('queries.params.today')}</Typography.Text>
                <InputNumber
                  value={p.default.offsetDays}
                  min={-366}
                  max={366}
                  onChange={(n) => set(i, { default: { kind: 'today', offsetDays: n ?? 0 } })}
                  style={{ width: 80 }}
                  aria-label={t('queries.params.offset')}
                  data-component="QueryParamOffset"
                />
                <Typography.Text type="secondary">{t('queries.params.days')}</Typography.Text>
              </Space>
            )}
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('queries.params.remove', { name: p.name })}
              onClick={() => onChange(params.filter((_, k) => k !== i))}
              data-component="QueryParamRemove"
            />
          </Space>
        );
      })}
      <div>
        <Button
          icon={<PlusOutlined />}
          size="small"
          disabled={params.length >= MAX_PARAMS}
          onClick={() => onChange([...params, { name: nextParamName(params), type: 'date' }])}
          data-component="QueryParamAdd"
        >
          {t('queries.params.add')}
        </Button>
      </div>
    </div>
  );
}

/** One input per parameter needing a value; `error` names the one the server
 *  refused (`param_unbound` / `param_invalid`). Values are strings, as in a URL. */
export function ParamValueInputs({
  params,
  values,
  onChange,
  error,
}: Readonly<{
  params: readonly QueryParam[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  error?: { code: string; param: string; label?: string; expected?: string; reason?: string };
}>) {
  const { t } = useTranslation();
  if (params.length === 0) return null;
  const title = error ? (error.label ?? error.param) : '';
  return (
    <div data-component="ParamValueInputs" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && (
        <Alert
          type={error.code === 'param_unbound' ? 'info' : 'warning'}
          showIcon
          title={
            error.code === 'param_unbound'
              ? t('queries.params.pick', { label: title })
              : error.reason === 'range_reversed'
                ? t('queries.params.reversed', { label: title })
                : t('queries.params.invalid', {
                    label: title,
                    type: t(`queries.params.types.${error.expected ?? 'string'}`),
                  })
          }
          data-component="ParamValueError"
        />
      )}
      <Space wrap size={12}>
        {params.map((p) => (
          <label key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Typography.Text strong>{p.label ?? p.name}</Typography.Text>
            <Input
              type={p.type === 'date' ? 'date' : 'text'}
              value={values[p.name] ?? ''}
              status={error?.param === p.name ? 'warning' : undefined}
              onChange={(e) => onChange(p.name, e.target.value)}
              style={{ width: 160 }}
              aria-label={p.label ?? p.name}
              data-component="ParamValueInput"
              data-name={p.name}
            />
          </label>
        ))}
      </Space>
    </div>
  );
}
