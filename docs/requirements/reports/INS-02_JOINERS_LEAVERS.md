# INS-02 — Instroom & Uitstroom | implementation contract

> **29-10-2026, na INS-02 merge.** **Implementation integrated** via [PR #60](https://github.com/EdwinCycling/LiquidHR/pull/60) into GitHub `main` `cc6d4b56f3ed4705012aac88a57cbccccef0b608`. The latest tested feature HEAD was `5dff128b5939f885bbc67783aa66949b0d31fe71` (37/37 targeted tests PASS; targeted TypeScript, ESLint, 43-namespace i18n and diff-check PASS). Manager employment and termination source queries are prefiltered to the authorized direct-team employee allowlist; regression verifies out-of-team exclusion. The six termination events linked to soft-deleted employments remain all-history reconciliation only, and no unsupported turnover rate is displayed. The broad `npm run type-check` still fails on pre-existing generated `.next/dev/types` absence/WVP routes; live Core TEST role/RLS/browser and combined Vercel acceptance are deferred. This note supersedes the historical 'implementation NEXT' status below; no DB write, migration or deployment was performed.


> **29-10-2026 integration note.** INS-01 #57 and AA #59 are merged into GitHub Development `main`. The existing INS-02 branch was synchronized non-force, preserving its requirements commit and both main merges. Implementation may proceed with scoped local tests; hosted Vercel acceptance is deferred until the later combined TEST release by explicit user decision. The six confirmed termination events linked to soft-deleted employments remain a separate reconciliation measure; no unverified turnover rate or leaver claim. No DB write, migration or deployment is authorized.
Date: 2026-10-28
Issue: #58
Branch: `work/ins02-joiners-leavers-20261028`
Baseline: `main` `6ff3dfbcbb4064f59b8870a14176e746acd23ce3` (INS-01 PR #57 and AA docs PR #59 merged 2026-10-29).
Status: **source validation complete; design contract ready; implementation NEXT**. Existing feature branch non-force synchronized with integrated `main` on 2026-10-29.

## 1. Existing system — reuse, do not duplicate

The existing Insights catalog has `terminations` with `report-terminations:read`, implemented by `apps/hr-suite/lib/insights/employee-report-service.ts`, and `/insights?report=terminations`. It is an employee insight view, not a paired monthly inflow/outflow report. Preserve that existing route and its behavior. Add a separate report ID `joiners-leavers` (or similarly unambiguous ID) within the existing Insights catalog and Query/Navigation Seam. Do not replace the existing terminations report or silently alter its permissions.

The existing terminations implementation reads `employment_terminations` for workflow statuses `CONFIRMED`, `PAYROLL_READY`, `REPORTED` and uses `last_working_day`; its employment query currently excludes `deleted_at` rows. Do **not** copy its employee-primary selection, which is unsuitable for concurrent employments or accurate historical events. Reuse INS-01's authorized effective-dated employment/scope and reporting primitives **now merged on main**; do not fork its authorization or reporting framework.

## 2. Read-only Core TEST source evidence (aggregate only)

Read-only SQL on 2026-10-28 checked schema for `employments`, `employment_terminations`, `employee_organizations` and `employment_end_reasons`. The tables contain the expected tenant/HR-group/admin IDs, employee/employment links, effective dates, and statuses.

Project-wide, confirmed non-deleted employments: **85 records for 85 distinct employees**, 9 with a non-null `ends_on`, earliest `starts_on` 2016-01-04. The earlier INS-01 analysis verified reliable month-end snapshot coverage from January 2021; that **does not** establish complete pre-2021 hire history.

Confirmed termination workflow rows: **10**, spanning 2020-12-31 to 2026-06-30. All 10 link to confirmed employment records, but **6 linked employments have `deleted_at IS NOT NULL`**. Of the four linked non-deleted employments, all four have `ends_on = last_working_day`. The six deleted-linked rows were excluded by the non-deleted-only join; they are not broken foreign keys.

Aggregate starts from confirmed non-deleted employments (project-wide; not a tenant/persona-authorized report result):

| Month 2026 | Unique employees starting an employment | Started employments | Ended non-deleted employments |
| --- | ---: | ---: | ---: |
| Jan | 4 | 4 | 0 |
| Feb | 0 | 0 | 0 |
| Mar | 1 | 1 | 0 |
| Apr | 0 | 0 | 0 |
| May | 0 | 0 | 0 |
| Jun | 0 | 0 | 0 |
| Jul | 7 | 7 | 0 |
| Aug | 3 | 3 | 0 |
| Sep | 5 | 5 | 0 |
| Oct (unfinished) | 2 | 2 | 1 |

**Source hazard:** a naive `employments.deleted_at IS NULL` filter loses 6 of 10 historical termination records. Conversely, blindly including all soft-deleted employment rows as historical hires can inflate counts if soft deletion means a corrected or voided record. These two datasets need explicit, separate event-source policies. No production data; synthetic TEST only.

## 3. Proposed metrics and event policy

1. **Started employments**: confirmed non-deleted employments with `starts_on` in month, scoped by authorized administration and employee IDs. This is a factual employment-start count, not automatically a count of brand-new people.
2. **Employees with a start**: distinct employee IDs among those started employments; de-duplicate concurrent jobs and across selected administrations.
3. **First observed start in authorized scope**: only when the required prior employment history is available. **Never** label it a first-ever hire or new-to-organization hire unless authorized historical coverage can prove it. Earlier history may be incomplete; show a source-coverage note.
4. **Ended employments**: use `ends_on` on confirmed non-deleted employments for a baseline end-date series, and independently inspect confirmed `employment_terminations` events. If a confirmed termination links to a soft-deleted employment, do not silently discard or blindly count it: show a separate validated termination-events count or an explicit reconciliation gap until historical deletion semantics are verified.
5. **Employees leaving scope**: only classify a person as leaving the authorized organization/administration if *all relevant in-scope employments* have ended and no other in-scope active employment remains on that date. Do not equate one contract ending with the employee leaving. Do not inspect other tenants or unauthorized administrations to claim organization-wide departure.
6. **Rehires**: classify only when a prior confirmed employment end and a subsequent start can be verified within the authorized and complete history. If history insufficient, status `UNKNOWN`; do not infer from employee ID or seniority date.
7. **Net change**: display only when the underlying joiner/leaver measures have aligned population, time basis, and reconciliation; otherwise explicitly unavailable. **Turnover rate** out of scope pending denominator contract.
8. **Time semantics**: report monthly events using calendar dates; default latest 12 completed months, not unfinished October 2026. Month boundaries inclusive for events; all periods and date parsing UTC-safe. Avoid double-counting an event when the same employment has both `ends_on` and a termination workflow row.
9. **Organization attribution**: use the as-of event date and employment-linked `employee_organizations` record. Unknown/ambiguous placement stays unassigned; never use current department/manager to rewrite historical events. Manager's population remains constrained by the existing authenticated direct-team resolver; do not imply that it is historical team membership if it isn't.

## 4. Security and UI contract

- Use `getRequestAuthorizationContext`, `requirePermissionInContext`, tenant/HR-group, active administration allowlist, existing Manager direct-team employee allowlist, and authenticated Supabase client/RLS. Employee role denied. **Match INS-01's proven authorization policy:** Manager requires `employee:read` and strict current direct-team/active-administration scope; HR Admin/Tenant Admin requires `employee:read` plus `report-employee-department:read`. Do not require a Manager-only unavailable report permission, and do not create new grants. Keep existing `terminations` report permission unchanged.
- Prevent cross-scope filtering and leak of labels, counts, CSV or details. Manager fail-closed on truncated team scope; source limit fail-closed with explicit errors.
- Existing Insights Query/Navigation Seam: typed URL state; from/to month, administration, department, team, event type, sorting, 25-row page, Back/Forward, Apply/Reset. One canonical calculation for KPI, monthly trend, detail and full safe CSV.
- NL/EN labels and CSV headers; responsive 390/768/1440; drilldown uses existing employee route with return context. No salary, birth-date, medical or payroll data.
- Keep the existing `terminations` report accessible and unchanged. Explain distinctions between **employment start/end**, **confirmed termination workflow event**, and **employee join/leave** clearly in the UI.

## 5. Acceptance, delivery and explicit holds

Focused tests must cover: parallel jobs; same person in two selected administrations; first-in-scope vs first-ever; rehire with incomplete history; multiple contracts; start/end same month; deleted employment with confirmed termination; duplicate workflow/end-date event; disagreement in dates; event-date organization attribution; unknown placement; Manager/Employee/HR Admin cross-scope denial; incomplete team scope; URL Back/Forward; CSV formula injection and full-vs-page parity; NL/EN.

Implementation starts on this existing feature branch already synchronized with integrated `main`; do not recreate the branch, open a duplicate PR, or merge an unreviewed feature branch. No database writes, schema changes, test-user creation, deployment or merge as part of this work. Run focused tests, TypeScript, relevant ESLint and i18n parity locally. Capture exact commit and test results. Push branch and create Draft PR when complete.

**Open design decision / HOLD:** determine whether a soft-deleted confirmed employment with a confirmed termination workflow event is a legitimate historical leaver. Until established, present such events as a separate auditable reconciliation measure; do not claim fully reconciled leavers or turnover. Missing live HR Admin/Manager persona acceptance is a separate runtime gate and should not trigger repetitive broad Codex investigations.
