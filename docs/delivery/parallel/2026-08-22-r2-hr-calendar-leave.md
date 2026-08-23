# R2 HR Calendar + Leave — parallel handoff

## Scope

- Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
- Branch: `work/r2-hr-calendar-leave`
- Worktree: `.codex-worktrees/r2-hr-calendar-leave`
- Runtime target: `http://localhost:3102`
- Remote writes, schema changes, migrations, production actions, push and merge: none.

## Implemented

- `/hr-calendar` now composes `PageShell`, `PageHeader`, `PageToolbar` and `FilterBar` while keeping the existing month, week, URL and pagination model.
- Active search, department, employee, job group, job, timeline-event and display filters are visible and remain URL-backed. Searchable `DropdownSelect` is used for closed single-value filters and week navigation.
- The calendar keeps scheduled hours, week numbers, occupancy, holidays, company activities, reminders, absence/leave visualization, employee links and day/week details. Day details now use the existing Foundation `Drawer`.
- Leave request create now uses the existing Foundation `FormDrawer`. Dirty-close confirmation, saving/double-submit protection, preview/API error state and retry-safe idempotency are retained in the domain component; the leave API payload and endpoint are unchanged.
- NL/EN `hrCalendar` keys were extended in parity.

## Contracts deliberately preserved

- Route `/hr-calendar`, URL query keys and month/week/page/page-size behavior.
- Department/employee/job/job-group and timeline-event type filtering.
- Reminders, scheduled hours, week numbers, occupancy, holidays, company activities, absence/leave markers and employee navigation.
- Leave preview `GET /api/leave/request/preview` and create `POST /api/leave/request`, including priority/direct modes, time modes and idempotency key semantics.
- No `components/ui/**`, generic `components/patterns/**` or `components/layout/**` source was changed.

## Verification

- `npm.cmd run type-check -w @liquid-hr/hr-suite`: GREEN.
- `npm.cmd run check:i18n -w @liquid-hr/hr-suite`: GREEN, 33 equal NL/EN namespaces.
- `npm.cmd run test -w @liquid-hr/hr-suite -- lib/hr-calendar lib/leave`: GREEN, 6 files / 43 tests.
- Targeted ESLint on the eight changed calendar/leave files: GREEN, 0 errors / 0 warnings.
- `git diff --check`: GREEN.
- Full suite/build: not run; not required for this domain-scoped presentation/interaction slice.

## Browser/API acceptance status — pre-retry record

`BLOCKED BY ENVIRONMENT` before authenticated acceptance, including the acceptance retry. Step 0 was attempted with `Copy-Item -Force` from the required canonical source path, but the source did not exist (`Test-Path=False`) and the exact-worktree target consequently did not exist either (`Test-Path=False`). No env values were printed, logged or committed. The canonical `fixtures:talent-auth` preflight was rerun and stops with `node: .env.local: not found`.

With the exact worktree dev server restarted on port 3102 for the retry, unauthenticated requests returned:

- `/dashboard/start`: HTTP 500
- `/hr-calendar`: HTTP 500
- `/login`: HTTP 500

The server and Playwright console identify the blocker as the missing Supabase URL/key in `proxy.ts`, not a calendar/leave assertion. Playwright opened the exact retry URL `/login` and recorded HTTP 500, the Next runtime error overlay and 3 console errors (including the expected 500/resource failure). Authenticated desktop, 390×844, Default, LinkedHR, filter persistence, day detail, employee link, real leave create/readback/cleanup and permission-negative evidence therefore remain unexecuted. The retry server and browser were stopped afterward.

No R2 test records were created, so no cleanup was required.

## FOUNDATION_GAP — LATER

The existing suite-wide searchable multiselect/chip pattern is still a Foundation gap for future reusable multi-value filters (including larger calendar type catalogs, custom fields and similar collections). Minimal future API: options, selected values, search, select/clear all, keyboard navigation, `onChange` and native form submission. This slice uses a domain-specific accessible checkbox group for the current small timeline-event set and does not add a generic component.

## Acceptance retry — canonical TEST environment (2026-08-22)

- Exact worktree and branch retained: `.codex-worktrees/r2-hr-calendar-leave`, `work/r2-hr-calendar-leave`; runtime `http://localhost:3102`.
- Canonical ignored TEST env was copied with `Copy-Item -Force` from the main workspace into `apps/hr-suite/.env.local`; destination `Test-Path=True`. No env values were printed, logged or committed. `npm.cmd run fixtures:talent-auth` completed successfully for the three canonical fixtures: HR Admin, Manager and Employee.
- Unauthenticated HTTP evidence: `/login` `200`; `/dashboard/start` `307`; `/hr-calendar` `307`. Authenticated TEST HR evidence: `POST /login` `200`, `/dashboard/start` `200`, `/hr-calendar` `200`.
- TEST HR Admin browser acceptance: month previous/next/today, URL-backed search, department, employee, job group, job and event-type filters, active-filter display and reset, display toggles for reminders/scheduled hours/occupancy, week-number toggle, week 35 drawer and URL state, page size 25 and page 2, day detail, employee navigation, holidays/company activities, absence/leave visualization and calendar markers all completed. Relevant navigation/RSC/page requests returned `200`.
- Day detail opened `2026-08-01`; employee links were visible and the Noah Hendriks link reached `/employees/c6b1c7a9-c250-3d19-b1a0-87e317e80b13` with HTTP `200`.
- Leave request interaction used the existing `FormDrawer`: direct preview returned `200`, priority preview returned `200`, dirty-close confirmation and discard worked, and double-submit protection remains in the existing drawer contract. For Lina Bakker, the API returned the real `409 LEAVE_EMPLOYMENT_SELECTION_REQUIRED`; the repaired dialog displayed the two returned employment options. Selecting `EMP-DEMO-046-A` caused a refreshed preview with `employmentId` and HTTP `200`. The preview then reported no active leave types, so the create button correctly remained disabled and no POST/create was attempted.
- Permission-negative evidence: test-role-switch API returned `403 TEST_ROLE_SWITCH_FORBIDDEN`; direct TEST Manager and TEST Employee calendar access reached `/geen-toegang` with HTTP `200` and no relevant console errors after the scoped page handling fix.
- Responsive/theme evidence: Default/Liquid Navy calendar was checked at `390x844` with `innerWidth=390`, `clientWidth=390`, `scrollWidth=390`, readable `HR-tijdlijn Kalender` and month navigation, and no page-level horizontal overflow. LinkedHR was selected and rendered on `/hr-calendar` at desktop; the same no-overflow calendar check passed. TEST HR was restored to Default/Liquid Navy before finishing.
- Fresh authenticated calendar browser evidence recorded zero relevant calendar console errors; only unrelated `storage://` avatar resource errors from the dashboard context and normal preload warnings were present. The handled employment-selection `409` is retained as API evidence, not a product failure.
- Real temporary R2-CALENDAR data was not created because canonical TEST data has no active leave type for the selected employment. There was therefore no created record requiring cleanup; no remote schema/database apply, production action, push, merge or deploy was performed.
- Acceptance classification: `BLOCKED` for the real leave CREATE/refresh/readback/cleanup portion because the canonical TEST fixture lacks an active leave type. The in-scope product bugs found during retry were fixed and retested: calendar UUID parsing now accepts database UUIDs, week options use stable string values, scoped calendar permission failures route to `/geen-toegang`, and employment-selection 409 details now render as a selectable leave-request field.
- Technical retry gates: targeted calendar/leave tests, strict TypeScript, i18n parity, targeted ESLint and `git diff --check` are rerun after this evidence update; full suite/build remains out of scope for this domain-scoped retry.

## Acceptance retry — temporary leave type contract (2026-08-23)

- Environment preflight completed in the exact worktree: the canonical ignored TEST `.env.local` was copied with `Copy-Item -Force`, destination `Test-Path=True`, fixture auth preflight succeeded for exactly TEST HR, TEST Manager and TEST Employee, and the worktree ran on port 3102. No env values were printed, logged or committed.
- The supported leave-type contract was used: TEST HR `POST /api/leave/catalog` with `action: LEAVE_TYPE` returned `201`, creating `R2-LEAVE-TYPE-20260823-092551` (`8cb0e8c2-ebb1-42f4-9c98-06a2c7cfbe39`) as an active `UNLIMITED` type. `GET /api/leave/catalog` returned `200` and read back the active type.
- Real leave CREATE used the existing calendar `FormDrawer` for Lina Bakker and employment `EMP-DEMO-046-A`; preview returned `200` after the existing employment-selection `409`, and `POST /api/leave/request` returned `201` with request id `563cee12-daee-43b3-9e00-531e7c28169e`. Replaying the same supported idempotency payload returned `201` with the same request id, proving persisted request readback. Reloading `/hr-calendar` returned `200`; `GET /api/leave/balance-report` returned `200`.
- The temporary type was `UNLIMITED`, so the existing ledger/read-model contract creates an allocation without a `TAKEN` transaction; absence of a calendar leave marker and an empty `taken` array in the balance report are therefore expected for this mutation. A supported ledger attempt to create a `TAKEN`-visible accrual path returned `409 LEAVE_ACCRUAL_TYPE_NOT_FOUND` for annual-cap mode and `409 LEAVE_LEDGER_OPERATION_FAILED` after switching the type to `ACCRUAL`; no opening-balance record was created. This was not changed with a direct database write or schema apply.
- Permission/scope evidence used real TEST personas: TEST Manager received `GET /api/leave/catalog` `200` and `GET /api/leave/ledger` `200`, but Lina's leave preview returned `403`; TEST Employee received `403` for catalog, ledger and the same leave preview. No other account was changed.
- Cleanup used the supported contract: `POST /api/leave/catalog` with `ARCHIVE_LEAVE_TYPE` returned `200`; subsequent `GET /api/leave/catalog` returned `200` and read back the temporary type with `is_active:false`. No supported leave-request edit, cancel or delete route exists in the inspected API surface, so request `563cee12-daee-43b3-9e00-531e7c28169e` was not directly deleted or mutated. No direct database cleanup was performed.
- The earlier desktop/390×844 and Default/LinkedHR acceptance remains valid; this retry only exercised the mutation flow and relevant permission/readback paths. No generic Foundation component, schema, production configuration, remote schema apply, push, merge or deploy was touched.
- Retry classification: `GREEN` for supported leave-type creation, real leave CREATE, idempotent readback, TEST Manager/Employee permission boundaries and supported type cleanup. The existing accrual-ledger `409` path and absence of request edit/cancel/delete endpoints remain documented contract limitations.

## Remaining manual gate

None for this acceptance retry. Keep the worktree/branch and remote-write boundaries unchanged.
