# Round 10: Dashboard Visualisations

**Status**: Deferred
**Date started**:
**Date completed**:
**MVP**: 2
**DoD tasks**: 10.1–10.6
**Canonical state**: Branch `001-upload-profile-field-roles` (US1-US3 complete, MVP1 gates pending)

## Goal

The Streamlit dashboard auto-generates charts from query results and
presents them alongside KPIs and the data table.

## Plan

- [ ] Detect column types in result DataFrame (numeric, categorical, date)
- [ ] Generate bar chart for categorical × numeric combinations
- [ ] Generate line chart for date × numeric combinations
- [ ] Add metrics row at top: row count, totals, averages (from numeric columns)
- [ ] Layout: metrics → chart(s) → data table → export buttons
- [ ] Use Plotly with `use_container_width=True`

## Do

**Context**: MVP2 visualization layer. Follows Round 09 saved queries implementation. Auto-detects query result shape and generates appropriate Plotly visualizations.

## Check

- [ ] Charts auto-generate without hardcoded column names
- [ ] Charts are interactive (hover, zoom)
- [ ] KPI metrics display correct calculations
- [ ] Page layout is clear and not cluttered
- [ ] User finds the dashboard useful for their weekly meeting

## Act

## **Learnings**

**Analytics Layer**: Auto-visualization transforms raw query results into consumable dashboards. Plotly enables interactivity; column type detection ensures relevance.

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
