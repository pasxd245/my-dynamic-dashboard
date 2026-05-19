import type { FC } from 'react';

export type IconProps = {
  className?: string;
  color?: string;
  height?: number | string;
  variant?: string;
  viewBox?: string;
  width?: number | string;
};

export type NavigationItem = {
  id: string;
  path: string;
  title: string;
  children?: NavigationItem[];
  condition?: boolean;
  disabled?: boolean;
  icon?: FC<IconProps>;
  parentId?: string;
  permission?: string;
  sidebar?: boolean;
};

export type Tab = { id: string; path: string; title: string };

export type AppError = {
  code: string;
  details: { field: string; message: string }[];
  error: string;
  message: string;
  status?: number;
  traceId?: string;
};

export type StatusColors = Record<string, string>;

export type ColumnVisibility = {
  key: string;
  label: string;
  value: boolean;
  disabled?: boolean;
};
