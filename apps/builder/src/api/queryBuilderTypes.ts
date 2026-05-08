export type FilterOperator =
  | "="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "IN"
  | "LIKE"
  | "IS NULL"
  | "IS NOT NULL";

export type AggregationFunction = "SUM" | "COUNT" | "AVG" | "MAX" | "MIN";
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";

export interface SelectedColumn {
  table_id: string;
  column_name: string;
  alias?: string | null;
}

export interface FilterSpec {
  column_id: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface AggregationSpec {
  column_id: string;
  function: AggregationFunction;
  alias: string;
}

export interface JoinSpec {
  relationship_rule_id: string;
  join_type: JoinType;
  joined_table_id: string;
}

export interface QueryConfig {
  base_table_id: string;
  selected_columns: SelectedColumn[];
  filters: FilterSpec[];
  aggregations: AggregationSpec[];
  group_by_columns: string[];
  joins: JoinSpec[];
  result_limit?: number;
  execution_timeout_seconds?: number;
}

export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
  severity: "error" | "warning";
}

export interface ValidateQueryResponse {
  valid: boolean;
  issues: ValidationIssue[];
  sql_preview?: string;
}

export interface QueryPreviewResponse {
  rows: Array<Record<string, unknown>>;
  estimated_total_rows?: number;
  execution_time_ms: number;
}

export interface QueryExecutionResponse {
  rows: Array<Record<string, unknown>>;
  total_rows: number;
  execution_time_ms: number;
  state: "QUEUED" | "RUNNING" | "COMPLETED" | "TIMEOUT" | "FAILED";
}
