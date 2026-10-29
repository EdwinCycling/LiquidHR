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

## Follow-up native acceptance — 2026-10-29

**Follow-up result: PARTIAL.** The Manager permission defect is corrected and authenticated role-scope checks pass against Core TEST. English UI rendering remains unverified because the active test identities have a persisted language preference that overrides a local browser cookie; changing it through Settings would write `user_preferences`, which was outside this run's authorization.

The code and acceptance update were committed locally on `work/ins01-headcount-fte-20261028`; code correction commit: `fb8ca69e224ae5594e98d581c92fd178c1d62fae`.

### Root cause and correction

- The `headcount-fte` catalog entry and service both required `report-employee-department:read`, which is granted to HR Admin/Tenant Admin but not Manager. This caused the actual Manager 403 before direct-team resolution ran.
- The report now uses its existing source permission `employee:read` for Direct Manager, and retains both `employee:read` and `report-employee-department:read` for HR Admin/Tenant Admin. Catalog visibility uses the same report-specific rule. No general Manager bypass, grant, RLS policy, or migration was added.
- The Manager service path is still bounded to the active administration and `listDirectTeamEmployeeScope`; out-of-scope administration, department, and team filters fail closed. Employee remains denied before report source reads.
- The Next runtime parse failure was caused by three workspace packages being consumed as raw TypeScript without Next transpilation. `transpilePackages` now explicitly includes `@liquid-hr/payroll-engine`, `@liquid-hr/payroll-rules-nl-2026`, and `@liquid-hr/payroll-rules-cao-bench02`; Payroll logic, package exports, and dependencies were not changed. The official Next.js `transpilePackages` behavior is documented at https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages.

### Authenticated Core TEST evidence

The official `scripts/start-test-worktree.ps1` runtime used the existing central TEST configuration on `http://127.0.0.1:3012`. The normal HR Admin fixture login and existing `/local/personas` handoffs were used; no accounts, credentials, roles, or grants were created or changed.

| Persona | Verified result |
| --- | --- |
| HR Admin Maya | With Jupiter BV selected: headcount 38, known FTE 31.9389, 3 missing schedule factors, 13 placements unassigned. CSV contained 38 employment rows; 35 known factors reconciled to 31.9389 and 3 remained unknown. None of the 13 unassigned rows had a department or team guessed. Reset returned to all accessible administrations: headcount 69, known FTE 61.2639, 4 missing factors, 14 unassigned placements. Existing employee drilldown opened successfully. |
| Manager Yara | The report page loaded for her direct team: headcount 6, FTE 5.95, 0 missing schedule factors, 2 unassigned placements. A direct authenticated API request filtered to Yara's team returned HTTP 200 and four matching rows; every row's team ID matched Yara. Injecting Manager Lisa's team ID returned HTTP 403. |
| Manager Lisa | The report page returned only her existing team: headcount 3, FTE 2.3, all three rows labeled with Lisa's team. Injecting Yara's team ID into the authenticated API request returned HTTP 403. |
| Employee Noah | The Insights catalog showed 0 reports; a direct authenticated Headcount & FTE API request returned HTTP 403. |

These checks used existing authenticated server/RLS paths. The Yara/Lisa team probes used real existing persona and employee identifiers; no response included employees outside the actor's authorized team. The 16 records with no unique historical organization placement in the full source remain unassigned rather than being attributed to an arbitrary team or department.

### Runtime, responsive and regression checks

- The corrected application loaded Headcount & FTE and the existing employee-detail route without the prior raw-TypeScript parse failure. The runtime's configured workspace packages are limited to the three failing payroll packages and `@scope/db`.
- An isolated Playwright browser used the normal local sign-in and Manager handoff. At 390×844, 768×1024, and 1440×1000, document and body widths equaled the viewport width and the CSV and Apply actions remained visible.
- NL rendered in the authenticated UI. `check:i18n` confirmed matching NL/EN keys across 43 namespaces, including the new `loading` key (`Laden` / `Loading`). English UI rendering was not tested: setting `liquid-locale=en` in the isolated browser did not override the persisted test-user preference. No preference or database value was changed.
- Targeted Vitest: **20/20 PASS** across the Headcount & FTE service, catalog, and API route tests. Earlier **38/38** feature tests were not repeated. TypeScript, targeted ESLint, `check:i18n`, and `git diff --check`: PASS.
- Protected `apps/hr-suite/next-env.d.ts` remained outside the change set; its SHA-256 remained `B8B3A344484B959AF5E4E3FC1A1609DAC3CB9ECE0CDEB6C145BE29BC4C491000`.

### Updated recommendation

- **Manager-access correction: PASS.** Yara reads her direct team, Lisa cannot read Yara's team, and Employee is denied at both catalog and API layers.
- **Integration: HOLD pending English runtime rendering** if the acceptance gate requires a live EN page. The smallest follow-up is to use an existing authorized persona whose saved locale is already English, or separately authorize a normal preference change and restore it afterward. No database change is otherwise needed.
- No push, Draft PR, merge, migration, or deployment was performed.
