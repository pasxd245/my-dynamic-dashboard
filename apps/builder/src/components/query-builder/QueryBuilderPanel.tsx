import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { validateQuery } from "../../api/queryBuilderApi";
import type { ActionableError } from "../../api/types";
import { getActionableError } from "../../api/httpErrors";
import type { QueryConfig, SelectedColumn, FilterSpec, AggregationSpec, ValidationIssue } from "../../api/queryBuilderTypes";
import ActionableErrorPanel from "../errors/ActionableErrorPanel";

const SAMPLE_TABLES = [
  { id: "users", name: "Users", columns: [
    { name: "user_id", type: "int" },
    { name: "name", type: "string" },
    { name: "email", type: "string" },
  ]},
  { id: "orders", name: "Orders", columns: [
    { name: "order_id", type: "int" },
    { name: "user_id", type: "int" },
    { name: "amount", type: "float" },
    { name: "status", type: "string" },
  ]},
];

interface QueryBuilderState {
  baseTableId: string;
  selectedColumns: SelectedColumn[];
  filters: FilterSpec[];
  aggregations: AggregationSpec[];
  groupByColumns: string[];
  joins: any[];
  validationIssues: ValidationIssue[];
  sqlPreview: string;
  isValidating: boolean;
}

export interface QueryBuilderPanelProps {
  workspaceId?: string;
  initialSnapshot?: Record<string, unknown> | null;
  onSaveRequest?: (snapshot: Record<string, unknown>) => void;
}

export default function QueryBuilderPanel({
  workspaceId,
  initialSnapshot,
  onSaveRequest,
}: QueryBuilderPanelProps = {}): ReactElement {
  const hasWorkspace = Boolean(workspaceId);

  const [state, setState] = useState<QueryBuilderState>({
    baseTableId: "users",
    selectedColumns: [],
    filters: [],
    aggregations: [],
    groupByColumns: [],
    joins: [],
    validationIssues: [],
    sqlPreview: "",
    isValidating: false,
  });
  const [actionableError, setActionableError] = useState<ActionableError | null>(null);

  // Hydrate builder state from a loaded snapshot
  useEffect(() => {
    if (!initialSnapshot) return;

    setState((prev) => ({
      ...prev,
      baseTableId: (initialSnapshot.base_table_id as string | undefined) ?? prev.baseTableId,
      selectedColumns: (initialSnapshot.selected_columns as SelectedColumn[] | undefined) ?? prev.selectedColumns,
      filters: (initialSnapshot.filters as FilterSpec[] | undefined) ?? prev.filters,
      aggregations: (initialSnapshot.aggregations as AggregationSpec[] | undefined) ?? prev.aggregations,
      groupByColumns: (initialSnapshot.group_by_columns as string[] | undefined) ?? prev.groupByColumns,
      joins: (initialSnapshot.joins as any[] | undefined) ?? prev.joins,
    }));
  }, [initialSnapshot]);

  const baseTable = SAMPLE_TABLES.find(t => t.id === state.baseTableId);

  const handleAddColumn = (columnName: string) => {
    if (!state.selectedColumns.find(c => c.column_name === columnName)) {
      setState(prev => ({
        ...prev,
        selectedColumns: [...prev.selectedColumns, {
          table_id: prev.baseTableId,
          column_name: columnName,
          alias: columnName,
        }],
      }));
    }
  };

  const handleRemoveColumn = (columnName: string) => {
    setState(prev => ({
      ...prev,
      selectedColumns: prev.selectedColumns.filter(c => c.column_name !== columnName),
    }));
  };

  const handleAddFilter = () => {
    setState(prev => ({
      ...prev,
      filters: [...prev.filters, {
        column_id: "name",
        operator: "=" as const,
        value: "",
      }],
    }));
  };

  const handleUpdateFilter = (index: number, field: keyof FilterSpec, value: any) => {
    setState(prev => {
      const newFilters = [...prev.filters];
      newFilters[index] = { ...newFilters[index], [field]: value };
      return { ...prev, filters: newFilters };
    });
  };

  const handleRemoveFilter = (index: number) => {
    setState(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  };

  const handleValidate = async () => {
    if (!hasWorkspace) {
      setActionableError(null);
      setState((prev) => ({
        ...prev,
        validationIssues: [
          {
            code: "WORKSPACE_REQUIRED",
            message: "Create a workspace first before validating queries.",
            severity: "error" as const,
          },
        ],
      }));
      return;
    }

    const resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
      return;
    }
    setState(prev => ({ ...prev, isValidating: true }));
    try {
      const config: QueryConfig = {
        base_table_id: state.baseTableId,
        selected_columns: state.selectedColumns,
        filters: state.filters,
        aggregations: state.aggregations,
        group_by_columns: state.groupByColumns,
        joins: state.joins,
      };
      const result = await validateQuery(resolvedWorkspaceId, config);
      setActionableError(null);
      setState(prev => ({
        ...prev,
        validationIssues: result.issues || [],
        sqlPreview: result.sql_preview || "",
      }));
    } catch (error) {
      setActionableError(getActionableError(error));
      setState(prev => ({
        ...prev,
        validationIssues: [{
          code: "REQUEST_ERROR",
          message: error instanceof Error ? error.message : "Validation failed",
          severity: "error" as const,
        }],
      }));
    } finally {
      setState(prev => ({ ...prev, isValidating: false }));
    }
  };

  const errors = state.validationIssues.filter(i => i.severity === "error");
  const warnings = state.validationIssues.filter(i => i.severity === "warning");
  let validateButtonLabel = "Create Workspace First";
  if (hasWorkspace) {
    validateButtonLabel = "Validate Query";
  }
  if (state.isValidating) {
    validateButtonLabel = "Validating...";
  }

  return (
    <section className="space-y-6 p-4 bg-white rounded-lg border border-gray-200">
      <div>
        <h2 className="text-2xl font-bold mb-4">Query Builder</h2>

        {/* Base Table Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Base Table
          </label>
          <select
            value={state.baseTableId}
            onChange={(e) => setState(prev => ({ ...prev, baseTableId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {SAMPLE_TABLES.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Column Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Columns
          </label>
          <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
            {baseTable?.columns.map(col => (
              <div key={col.name} className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id={col.name}
                  checked={state.selectedColumns.some(c => c.column_name === col.name)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleAddColumn(col.name);
                    } else {
                      handleRemoveColumn(col.name);
                    }
                  }}
                  className="mr-2"
                />
                <label htmlFor={col.name} className="text-sm">
                  {col.name} ({col.type})
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">Filters</label>
            <button
              onClick={handleAddFilter}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Filter
            </button>
          </div>
          <div className="space-y-2">
            {state.filters.map((filter, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={filter.column_id}
                  onChange={(e) => handleUpdateFilter(idx, "column_id", e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                >
                  {baseTable?.columns.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={filter.operator}
                  onChange={(e) => handleUpdateFilter(idx, "operator", e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value="<">&lt;</option>
                  <option value=">">&gt;</option>
                  <option value="<=">&lt;=</option>
                  <option value=">=">&gt;=</option>
                  <option value="IN">IN</option>
                  <option value="LIKE">LIKE</option>
                  <option value="IS NULL">IS NULL</option>
                  <option value="IS NOT NULL">IS NOT NULL</option>
                </select>
                <input
                  type="text"
                  value={typeof filter.value === "string" || typeof filter.value === "number" ? String(filter.value) : ""}
                  onChange={(e) => handleUpdateFilter(idx, "value", e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <button
                  onClick={() => handleRemoveFilter(idx)}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SQL Preview */}
        {state.sqlPreview && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SQL Preview
            </label>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto border border-gray-300">
              {state.sqlPreview}
            </pre>
          </div>
        )}

        {/* Validation Issues */}
        {actionableError && (
          <div className="mb-4">
            <ActionableErrorPanel error={actionableError} />
          </div>
        )}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="mb-4 space-y-2">
            {errors.map((issue, idx) => (
              <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                {issue.code}: {issue.message}
              </div>
            ))}
            {warnings.map((issue, idx) => (
              <div key={idx} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                {issue.code}: {issue.message}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleValidate}
            disabled={state.isValidating || !hasWorkspace}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {validateButtonLabel}
          </button>
          {onSaveRequest && (
            <button
              onClick={() => {
                const snapshot: Record<string, unknown> = {
                  base_table_id: state.baseTableId,
                  selected_columns: state.selectedColumns,
                  filters: state.filters,
                  aggregations: state.aggregations,
                  group_by_columns: state.groupByColumns,
                  joins: state.joins,
                };
                onSaveRequest(snapshot);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save Query
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
