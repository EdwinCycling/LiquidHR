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

## Browser/API acceptance status

`BLOCKED BY ENVIRONMENT` before authenticated acceptance. The exact worktree has no `apps/hr-suite/.env.local`; the canonical `fixtures:talent-auth` preflight stops with `node: .env.local: not found`. No env values were printed or created.

With the exact worktree dev server on port 3102, unauthenticated requests returned:

- `/dashboard/start`: HTTP 500
- `/hr-calendar`: HTTP 500
- `/login`: HTTP 500

The server and Playwright console identify the blocker as the missing Supabase URL/key in `proxy.ts`, not a calendar/leave assertion. Playwright opened the exact `/hr-calendar` route and saw the Next runtime error overlay with 3 console errors (including the expected 500/resource failure); authenticated desktop, 390×844, Default, LinkedHR, filter persistence, day detail, employee link, real leave create/readback/cleanup and permission-negative evidence therefore remain unexecuted.

No R2 test records were created, so no cleanup was required.

## FOUNDATION_GAP — LATER

The existing suite-wide searchable multiselect/chip pattern is still a Foundation gap for future reusable multi-value filters (including larger calendar type catalogs, custom fields and similar collections). Minimal future API: options, selected values, search, select/clear all, keyboard navigation, `onChange` and native form submission. This slice uses a domain-specific accessible checkbox group for the current small timeline-event set and does not add a generic component.

## Remaining manual gate

Copy the canonical ignored `.env.local` into this exact worktree without exposing values, rerun fixture auth, start port 3102 from this worktree, then execute the TEST_ACCEPTANCE_MATRIX calendar/leave desktop + 390×844 + Default/LinkedHR and real API CRUD/permission matrix. Keep the worktree/branch and remote-write boundaries unchanged.
