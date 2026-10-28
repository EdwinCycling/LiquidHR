# INS-01 — Headcount & FTE acceptance

**Result: PARTIAL — local implementation and synthetic layout pass; authenticated Core TEST acceptance remains open.**

## Baseline and source validation

- Implemented from GitHub `main` `32bb21b00d1d0ebff60726e4d536dd8b74967654` on isolated branch `work/ins01-headcount-fte-20261028`.
- Read-only Core TEST schema/aggregate validation used project `wnpfloqpjvaacobppbpk`. Confirmed employment, effective schedule, and historical organization-placement sources and date semantics. Confirmed employment history begins January 2021; latest completed snapshot was 2026-09-30.
- At 2026-09-30, the project-wide aggregate contained 79 confirmed active employments across 79 unique employees. 76 employments had exactly one valid effective schedule; 3 did not. 63 had exactly one employment-linked organization placement; 16 did not. Schedule coverage was complete before September 2026; placement gaps were present from August 2025.
- These are project-wide aggregates, not report results or identified-person data. Report results are calculated inside the authenticated tenant, HR-group, administration, and Manager employee scope.
- No salary or medical source was read. No schema, migration, business data, or fixture was changed.

## Delivered behavior

- Existing `/insights?report=headcount-fte` catalog, permission and Query/Navigation Seam; API at `/api/insights/headcount-fte` with same-query CSV export.
- Month-end snapshots, completed-month defaults, validated URL-backed period/administration/department/team filters, sorting and 25-row pagination; Apply/Reset/clear and browser history preserve canonical URL state. CSV exports the complete filtered result; employee drilldown uses the authorized existing route.
- One server-side report result supplies KPI, monthly trends, ending-snapshot rows and CSV. Headcount deduplicates employees across selected administrations; FTE sums active employments independently. Unknown factors make total FTE incomplete and remain visible as an unknown rather than zero. Unknown employment-linked placements remain explicit and are never guessed from another job or a current record.
- The service requires existing `report-employee-department:read` and `employee:read` permissions plus HR Admin/Tenant Admin or Direct Manager role. HR Admin administration choices are taken from the active HR-group context. Manager reads are limited to the existing direct-team employee allowlist in the active administration; a truncated team source or out-of-scope filter fails closed. Employee roles are denied before report-source reads. The existing employee-detail route authorizes each drilldown independently.
- NL/EN translations and responsive employee-card/table layouts use existing Insights controls and components.

## Verification

- 38 focused tests passed across 7 files: API response contracts, calculation/date and multi-employment rules, schedule and placement gaps, query/filter/pagination serialization, catalog/URL seam, manager/admin/employee authorization contracts, and CSV safety.
- TypeScript `tsc --noEmit`: PASS.
- Targeted ESLint on changed app and test files: PASS.
- NL/EN i18n key parity: PASS (43 namespaces).
- `git diff --check`: PASS.
- Isolated synthetic presentation preview: 390 px (mobile cards visible, table hidden), 768 px (mobile cards visible, table hidden), and 1440 px (table visible, cards hidden); all three had no horizontal page overflow. The preview used synthetic display-only data and made no API or database calls.

## Remaining acceptance

- Authenticated Core TEST HR Admin/Manager browser and RLS acceptance is **OPEN**. The canonical local TEST runtime configuration/persona file was absent and port 3010 was not running. No alternate credentials, accounts, local secrets, or bypass were created. The focused service tests use mocked authenticated contexts and do not establish live Supabase RLS or persona-session behavior.
- No database migration or write is required or authorized for INS-01.
- **Integration advice: HOLD** until the existing authenticated TEST runtime can exercise the report as HR Admin and Manager, including negative cross-administration and cross-team checks. Local implementation gates are green; no merge, push, or deployment was performed.
