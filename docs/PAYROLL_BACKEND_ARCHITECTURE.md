# Payroll Backend Architecture

## Boundaries

Payroll is an organization-owned module. Every configuration, compensation, bank account, run, employee snapshot, and line item carries `organization_id`; APIs always scope records to the authenticated organization. Platform administrators do not receive implicit access to tenant payroll data through these APIs.

## Core records

- `payroll_settings`: organization currency, pay cycle, proration behavior, and versionable statutory configuration.
- `pay_groups`: employee processing groups such as monthly, weekly, or biweekly payroll.
- `payroll_components`: reusable earnings, deductions, and employer contributions.
- `employee_compensations`: effective-dated salary records. A salary change creates a new record and closes the previous period.
- `employee_bank_accounts`: encrypted account numbers with masked API output.
- `payroll_runs`: one processing period and its lifecycle totals.
- `payroll_run_items`: immutable employee/employment/bank snapshots for a run.
- `payroll_run_item_lines`: the frozen calculation breakdown used by payslips and reports.

## Run lifecycle

`draft -> calculated -> pending_approval -> approved -> finalized -> published`

Rejected runs become `rejected`. Requests for changes or cancelled approval requests return the run to `calculated`. A calculated run may be recalculated; approval and finalized runs cannot be recalculated. Publication is a separate timestamp rather than a mutable calculation status: employees only see finalized runs after payroll explicitly publishes them.

Calculation exceptions, including missing effective compensation or a missing primary bank account, block approval submission. Finalization requires an approved run and records the responsible user and timestamp.

## Calculation contract

The first engine version calculates basic pay with calendar-day proration and applies configured fixed or percentage recurring components. Every line stores its calculation inputs. Statutory rules are configuration data and are deliberately not hardcoded: the Nigeria PAYE, pension, NHF, NSITF, ITF, relief, and employer-contribution engines should be delivered as separately versioned rule calculators before production payroll is enabled.

The operational layer derives unpaid leave from approved unpaid leave requests and overtime from attendance against assigned shifts. Approved one-off inputs cover bonuses, allowances, deductions, reimbursements, and adjustments. Active loans project installments during calculation and only post repayments on finalization; voiding a finalized run reverses those postings.

Configured employee statutory profiles drive pension, PAYE, and NHF lines. Pension defaults to the PenCom minimum rates of 8% employee and 10% employer when enabled. PAYE brackets remain effective-versioned organization configuration so legislation can change without rewriting historical results. Payment CSV files contain encrypted-at-rest destination account numbers and require finalization authority. Balanced accounting journals, payroll register exports, statutory summaries, and immutable printable payslip documents are generated from frozen run items.

## Security

Payroll uses granular permissions for settings, compensation, bank accounts, processing, submission, approval, finalization, own payslips, and reporting. Salary and bank changes are audited. Bank account numbers are encrypted at rest and only their final four digits appear in ordinary API responses.
