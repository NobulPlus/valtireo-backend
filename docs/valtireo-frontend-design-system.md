# Valtireo Frontend Design System

Last updated: 2026-08-11

This is the living frontend design-system reference for the Valtireo web app. It should evolve as the product grows, but new screens should reuse these foundations before introducing new UI patterns.

## Core Principles

- Build dense, calm operational screens. Valtireo is an organizational command layer, not a marketing site.
- Use reusable UI components from `client/src/components/ui`.
- Keep dashboards scannable: metrics first, visual summaries second, tables/action lists third.
- Avoid nested cards. Cards frame repeated items, modals, dashboard panels, and tool surfaces.
- Use role/module visibility rules from the shell rather than hiding controls ad hoc inside pages.

## Current Shared Components

- `Alert`
- `AsyncSelect`
- `BreakdownList`
- `Button`
- `Card`, `CardHeader`, `CardTitle`, `CardBody`
- `Charts`
- `DataTable`
- `DateRangePicker`
- `Field`
- `Input`, `Textarea`, `Select`
- `Logomark`
- `Modal`
- `PageHeader`
- `Pagination`
- `States`
- `StatTile`
- `StatusBadge`

## Charts

Shared chart components live in:

```text
client/src/components/ui/Charts.tsx
```

Use:

- Valtireo currently supports only two chart forms in the product UI: doughnut charts and column charts.
- `DonutChart` for composition breakdowns, such as employees by department or organizations by status.
- `ColumnChart` for location, period, or category comparison where users need to compare bar heights.
- `ChartLegend` beside doughnut charts when labels/counts matter.
- Do not add line, area, stacked, radar, gauge, or pie variants until the design system intentionally expands.

Current chart palette:

```text
#0F766E
#2563EB
#D97706
#7C3AED
#DC2626
#0891B2
#64748B
```

## Dashboard Patterns

Organization dashboard:

- Top row: `StatTile`
- Employees by department: `DonutChart` plus `ChartLegend`
- By employment type: `ColumnChart`
- By location: `ColumnChart`
- Employee table: `DataTable`
- Dashboard filters should stay basic: search, primary status/category filter, department or scope filter, date range, reset, and report action.
- Quick export: dashboard-level CSV report action belongs in the organization filter surface and must honor the active employee filters/date range.

Platform console:

- Product-wide metrics use `StatTile`
- Organization status uses `DonutChart`
- Module adoption uses `ColumnChart`
- Console-level filtering should use a single `DateRangePicker` reporting window.
- Organization table search/status filters belong inside the table toolbar.
- Organization table sorting belongs on sortable `DataTable` headers, not separate sort dropdowns.
- Organization table CSV export belongs in the table header and must honor the reporting window, search, status, and sort controls.
- Needs-attention metrics are clickable rows that open a `Modal`
- Drill-down actions belong on organization detail pages

## Table Sorting

Use sortable table headers for obvious table fields. For example, organization tables sort through the `Organization`, `Status`, and `Country` headers.

Avoid separate sort dropdowns when the sortable field is already visible as a table heading.

## Export Pattern

Use quick export buttons where the export is obvious from context, such as employees on the employee list or organization dashboard.

Use the Reports module for heavier reporting workflows: multiple report types, advanced filters, formal exports, and future scheduling.

## Next Improvements

- Add reusable filter bar primitives.
- Add reusable dashboard section layouts.
- Add a formal chart tooltip/legend pattern.
- Add visual QA screenshots for major dashboards once the frontend test stack is settled.
