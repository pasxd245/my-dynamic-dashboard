import type { StatusColors } from '../types/index.ts';

export const STATUS_COLORS: StatusColors = {
  PENDING: '#FACC15',
  SCHEDULED: '#60A5FA',
  SKIPPED: '#9CA3AF',
  IN_PROGRESS: '#FB923C',
  COMPLETED: '#34D399',
  FAILED: '#F87171',
  ACTIVE: '#34D399',
};

export const FORMAT_DATE_TYPE = {
  MONTH_DAY: 'MMM DD',
  MONTH_DAY_YEAR: 'MMM DD, YYYY',
} as const;
export type FormatDateType = (typeof FORMAT_DATE_TYPE)[keyof typeof FORMAT_DATE_TYPE];

export const QUICK_DAY_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const;
