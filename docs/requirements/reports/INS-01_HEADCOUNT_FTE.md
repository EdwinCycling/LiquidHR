# INS-01 — Headcount & FTE

Status: implementation contract for the first Workforce Insights report.
Baseline: GitHub `main` at `32bb21b00d1d0ebff60726e4d536dd8b74967654`.

## Metric contract

- A month is represented by its calendar month-end date. The default range is the latest twelve completed month-ends; an unfinished current month is excluded.
- An employment is active on date `d` when `record_status = CONFIRMED`, `deleted_at IS NULL`, `starts_on <= d`, and `ends_on IS NULL OR ends_on >= d`. Employment start and end dates are inclusive.
- Headcount is the number of distinct employee IDs with at least one active employment in the selected scope. Selecting multiple administrations deduplicates an employee across those administrations. Department/team group counts are distinct within each group and may not add to the overall headcount when an employee belongs to more than one group.
- FTE is the sum of the effective `part_time_factor` for every active employment. Concurrent employments contribute independently to FTE while their employee contributes once to headcount.
- A schedule is effective when `valid_from <= d` and `valid_until IS NULL OR valid_until > d`. The database models schedule validity as a half-open interval `[valid_from, valid_until)`; its constraint limits the factor to 0–1 and prevents overlapping schedules per employment.
- An employment with exactly one valid effective schedule contributes its factor, including a valid zero factor. With zero or multiple effective schedules, the employment's FTE is unknown. The report must never replace unknown with zero or a current schedule. When any in-scope active employment has unknown FTE, the total FTE KPI is incomplete; show the known subtotal and coverage count separately.
- Organization placement uses `employee_organizations` effective dates with inclusive `effective_from` and `effective_to`; the database excludes overlapping placements per employment. Use only the employment-linked placement for the as-of date. Employee-level rows without an employment link, absent rows, and ambiguous/contradictory rows are explicit unassigned data-quality states; do not guess which concurrent job they describe or substitute a latest/current placement for a historical one.
- Department filters use the as-of department placement. Team filters use the as-of direct-manager assignment for HR Admin; a Manager's population remains restricted by the existing authenticated direct-team resolver. Unknown placement is not assigned to a department/team.
- The KPI and detail table represent the last selected month-end; the trend contains every month-end in the selected interval. URL periods are limited to at most 120 consecutive completed month-ends, with January 2021 as the earliest selectable month because that is the verified start of the available confirmed employment history.

## Scope and privacy

- Reuse the existing `employee:read` permission and the active tenant/HR-group context. Do not add grants or a new permission.
- HR Admin administration options come only from the active context's accessible administration set. A Manager is limited to the active administration and employee IDs returned by the existing direct-team scope helper; supplied query IDs are checked against that allowlist server-side. Employees without `employee:read` cannot read this report.
- Catalog visibility reuses `report-employee-department:read`; the server also requires `employee:read` and an HR Admin or direct Manager role. It introduces no grant or permission. Each Manager source query is narrowed by the direct-team employee allowlist and fails closed if that source is truncated.
- Use the authenticated Supabase server client and existing RLS. The report reads only employment dates/status, schedule factors, organization placement, employee display identifiers and authorized organization labels. It does not read salary, medical, birth-date, contact, or payroll fields.
- Employee details link to the existing employee detail route with the canonical Insights return context. That route retains its own server-side authorization.

## Read-only source validation before implementation

Core TEST schema metadata and aggregate-only month-end coverage were checked read-only on 2026-10-28. The schema has all required effective-dated sources and constraints. The aggregate scan found active confirmed employment history from January 2021 through the latest completed month, 2026-09-30. That snapshot had 79 active employments across 79 distinct employees; 76 employments had exactly one effective schedule and 3 did not. Sixty-three had exactly one employment-linked organization placement and 16 did not. Schedule coverage was complete before September 2026; the organization-placement gaps start in August 2025. No employee-level records or identifying values were returned by the scan. Coverage is project-wide; actual report completeness is computed inside the authenticated tenant, HR-group, administration and Manager scope.

The observed source gaps are not grounds to discard the reliable headcount. The report must show headcount from confirmed active employments, mark FTE incomplete at affected snapshots, and expose unknown organization placement to authorized HR Admins. Manager queries must remain filtered to the existing direct-team scope and must not reveal out-of-scope gap counts or rows.

## Implementation decisions

- Only employment-linked organization placements are used for a snapshot. Employee-level placement rows with no employment link are not assigned to a job, even when only one job is selected, because that relation does not identify the employment's historical organization. Such rows remain unassigned until source history has an employment-linked placement.
- A valid factor of `0` contributes zero FTE. A missing schedule, multiple effective schedules, null/non-numeric factor, or factor outside the database's 0–1 constraint makes the FTE total incomplete. The valid-factor subtotal remains visible.
- One canonical service result supplies the KPI, trend, rows and CSV export. A filter is applied to employment rows before all projections, so metrics and details share scope. Headcount deduplicates employee IDs after filters; FTE sums every selected employment row.
- The detail view is at the ending snapshot, uses 25 rows per URL-backed page, and links to the existing employee route with the canonical Insights return state. CSV export contains the complete filtered result rather than only the visible page. The employee route retains its own authorization check.

## Implementation acceptance

- Use the existing Insights catalog, page, Query/Navigation Seam, shared controls, employee detail route and CSV-safe helper.
- One canonical scoped calculation supplies KPI, month-end trend, detail rows and CSV export.
- Period, administration, department, team, sort and page state are URL-backed; filters are validated against authenticated scope and support Apply, Reset, Back and Forward. Pagination follows the existing Insights page pattern, while export retains the entire filtered result.
- Tests cover date boundaries, draft/deleted exclusion, unique headcount across concurrent and cross-administration employments, FTE summation, missing/overlapping/zero factors, organization gaps, authorized filters, export parity and negative role/team/administration scope.
- NL/EN translations have matching keys. The report is responsive at 390, 768 and 1440 px without page-level horizontal overflow.
- No database change is required for this report. Any discovered need for schema or permission changes is outside this implementation and requires a separate decision.
