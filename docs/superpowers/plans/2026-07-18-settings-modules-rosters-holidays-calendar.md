# Settings, Modules, Rosters, Holidays and Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build separate personal and HR-admin settings pages, tenant-wide optional modules, effective-dated 1–4-week work patterns, administration holidays and a unified employee month calendar.

**Architecture:** Keep `employment_schedules` as the effective-dated hours agreement and add normalized work-pattern tables as a separate timeline. Store tenant module flags and imported/manual holidays as authoritative configuration, while the calendar remains a bounded projection over source modules. Enforce every boundary with permissions, server services and RLS.

**Tech Stack:** Next.js App Router, React Server Components, strict TypeScript, Zod, Supabase PostgreSQL/RLS/RPC, Tailwind v4, Vitest, next-intl-style repository translators.

## Global Constraints

- Build in `schema → service/API → UI` order.
- Use no `any`, React Query or SWR.
- All visible copy lives in equal NL/EN message namespaces.
- All public tables receive RLS and policies in the creating migration.
- Module activation supplements permissions and never grants a permission.
- Existing optional modules remain enabled for existing tenants after migration.
- Work patterns use whole minutes and cycles of exactly 1, 2, 3 or 4 weeks.
- `all` calendar page size is capped at 100 employees.
- Validate locally on port 3000 and through a public preview before production deployment.
- Preserve user-owned changes outside the isolated worktree.

---

### Task 1: Database foundation for settings, modules, work patterns and holidays

**Files:**
- Create via CLI: `apps/hr-suite/supabase/migrations/*_add_settings_modules_work_patterns_holidays.sql`
- Modify after generation: `packages/db/types.ts`
- Create: `apps/hr-suite/supabase/tests/settings_rosters_holidays.sql`

**Interfaces:**
- Produces tables `tenant_modules`, `employment_work_patterns`, `employment_work_pattern_days`, `holiday_calendars`, `holidays`.
- Produces permissions `settings:read`, `modules:read`, `modules:write`, `work-schedule:read`, `work-schedule:write`, `holidays:read`, `holidays:write`.
- Produces RPCs `publish_employment_work_pattern(...)`, `preview_or_import_holidays(...)` only where transactionality requires database ownership.

- [ ] **Step 1: Generate the migration with the installed CLI**

Run:

```powershell
npx supabase --help
npx supabase migration new add_settings_modules_work_patterns_holidays
```

Expected: the CLI prints one new migration path ending in `_add_settings_modules_work_patterns_holidays.sql`.

- [ ] **Step 2: Write the failing database regression test**

Create a transaction-wrapped SQL test that proves:

```sql
do $$
begin
  if to_regclass('public.tenant_modules') is null then raise exception 'tenant_modules ontbreekt'; end if;
  if to_regclass('public.employment_work_patterns') is null then raise exception 'employment_work_patterns ontbreekt'; end if;
  if to_regclass('public.employment_work_pattern_days') is null then raise exception 'employment_work_pattern_days ontbreekt'; end if;
  if to_regclass('public.holiday_calendars') is null then raise exception 'holiday_calendars ontbreekt'; end if;
  if to_regclass('public.holidays') is null then raise exception 'holidays ontbreekt'; end if;
end $$;
```

Add assertions for cycle range, seven unique days per cycle week, non-overlapping work-pattern periods, tenant/administration foreign keys, existing-tenant module defaults and permission seeds.

- [ ] **Step 3: Run the SQL test and confirm RED**

Run the repository's documented Supabase SQL-test command or `psql` command used by adjacent files.

Expected: FAIL because the new relations do not exist.

- [ ] **Step 4: Implement the migration**

The migration must define strict enums/checks, compound tenant/administration foreign keys, GiST exclusion for work-pattern periods, RLS, separate SELECT/INSERT/UPDATE/DELETE policies, audit triggers, indexes and grants. Seed existing tenants with:

```sql
insert into public.tenant_modules (tenant_id, module_code, is_enabled)
select tenant.id, module.code, true
from public.tenants tenant
cross join (values ('HERA'), ('DOCUMENTS'), ('REMINDERS')) module(code)
on conflict (tenant_id, module_code) do nothing;
```

`publish_employment_work_pattern` must recalculate `scheduled_minutes`, compute average minutes as `sum(minutes) / cycle_weeks`, lock the employment, reject overlaps and raise `WORK_PATTERN_HOURS_MISMATCH` unless it equals the hours agreement in minutes.

- [ ] **Step 5: Apply locally, generate types and run advisors**

Run commands discovered via `npx supabase --help`, then regenerate `packages/db/types.ts` with the repository's established generation command.

Expected: SQL test PASS; security and performance advisors contain no new actionable findings.

- [ ] **Step 6: Commit the schema slice**

```powershell
git add apps/hr-suite/supabase/migrations apps/hr-suite/supabase/tests/settings_rosters_holidays.sql packages/db/types.ts
git commit -m "feat: add module roster and holiday schema"
```

### Task 2: Pure module and work-pattern domain models

**Files:**
- Create: `apps/hr-suite/lib/modules/module-registry.ts`
- Create: `apps/hr-suite/lib/modules/module-registry.test.ts`
- Create: `apps/hr-suite/lib/work-patterns/work-pattern-model.ts`
- Create: `apps/hr-suite/lib/work-patterns/work-pattern-model.test.ts`
- Create: `apps/hr-suite/lib/work-patterns/schemas.ts`

**Interfaces:**
- Produces `OPTIONAL_MODULES`, `resolveModuleAvailability(code, row)` and `isModuleCode(value)`.
- Produces `cycleWeekForDate(anchorDate, date, cycleWeeks)`, `calculateScheduledMinutes(day)`, `calculateAverageMinutes(days, cycleWeeks)` and `projectWorkPatternDay(pattern, date)`.

- [ ] **Step 1: Write failing module registry tests**

Test exact outcomes:

```ts
expect(resolveModuleAvailability('HERA', { isEnabled: false })).toBe('DISABLED')
expect(resolveModuleAvailability('LEAVE', null)).toBe('COMING_SOON')
expect(isModuleCode('CORE_HR')).toBe(false)
```

- [ ] **Step 2: Write failing cycle and minutes tests**

Cover cycles 1–4 across year boundaries, breaks and averages:

```ts
expect(cycleWeekForDate('2026-12-28', '2027-01-11', 4)).toBe(3)
expect(calculateScheduledMinutes({ startsAt: '09:00', endsAt: '17:30', breakMinutes: 30 })).toBe(480)
expect(calculateAverageMinutes([{ weekIndex: 1, scheduledMinutes: 480 }, { weekIndex: 2, scheduledMinutes: 0 }], 2)).toBe(240)
```

- [ ] **Step 3: Run focused tests and confirm RED**

```powershell
npm test -w @liquid-hr/hr-suite -- module-registry.test.ts work-pattern-model.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement minimal strict TypeScript models and Zod schemas**

Use Euclidean modulo for dates before the anchor and UTC date arithmetic. Return typed values rather than formatted UI strings.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Expected: both files PASS, including all 1–4-week boundary cases.

- [ ] **Step 6: Commit**

```powershell
git add apps/hr-suite/lib/modules apps/hr-suite/lib/work-patterns
git commit -m "feat: add module and work pattern models"
```

### Task 3: Module services, guards and APIs

**Files:**
- Create: `apps/hr-suite/lib/modules/module-service.ts`
- Create: `apps/hr-suite/lib/modules/module-guard.ts`
- Create: `apps/hr-suite/app/api/settings/modules/route.ts`
- Create: `apps/hr-suite/lib/modules/module-service.test.ts`
- Modify: existing HeRa, document and reminder route/service entry points selected by repository search.

**Interfaces:**
- Produces `listTenantModules()`, `setTenantModules(input)`, `requireModule(code)` and `ModuleDisabledError`.
- API `GET /api/settings/modules` returns `{ data: ModuleAvailability[] }`.
- API `PUT /api/settings/modules` accepts `{ modules: [{ code, enabled }] }`.

- [ ] **Step 1: Write failing permission and guard tests**

Assert `settings:read`/`modules:read`, `modules:write`, disabled module errors and that `COMING_SOON` cannot be enabled.

- [ ] **Step 2: Run focused tests and confirm RED**

- [ ] **Step 3: Implement services and route with Zod input**

Every call derives tenant and actor from `requirePermission`; no request field may contain trusted tenant or actor IDs.

- [ ] **Step 4: Add module guards to optional module entry points**

Guard the server page and API/service roots for HeRa, documents and reminders. Do not scatter UI-only checks.

- [ ] **Step 5: Run focused and auth route tests**

Expected: disabled modules return typed 403 responses; enabled modules retain current behavior.

- [ ] **Step 6: Commit**

```powershell
git add apps/hr-suite/lib/modules apps/hr-suite/app/api/settings apps/hr-suite/app apps/hr-suite/lib
git commit -m "feat: enforce tenant module availability"
```

### Task 4: Separate personal settings and HR-admin settings UI

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/personal-settings/page.tsx`
- Create: `apps/hr-suite/app/(dashboard)/settings/page.tsx`
- Create: `apps/hr-suite/app/(dashboard)/settings/modules/page.tsx`
- Create: `apps/hr-suite/components/settings/settings-hub.tsx`
- Create: `apps/hr-suite/components/settings/module-manager.tsx`
- Refactor: `apps/hr-suite/components/layout/settings-modal.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/layout.tsx`
- Create/modify: `apps/hr-suite/messages/{nl,en}/settings.json`, `navigation.json`

**Interfaces:**
- Personal profile link opens `/personal-settings` for every authenticated user.
- HR menu item opens `/settings` only when `settings:read` is present.
- Existing preference save endpoint and payload remain unchanged.

- [ ] **Step 1: Write failing navigation/model tests**

Test that admin links collapse into one settings item, personal settings remains visible to all users and module cards show active/disabled/coming-soon states.

- [ ] **Step 2: Run tests and confirm RED**

- [ ] **Step 3: Build the personal settings page**

Move the existing language, theme and clock form into a reusable form component used by `/personal-settings`; remove modal-specific dialog behavior without changing storage semantics.

- [ ] **Step 4: Build the permission-filtered settings hub and module page**

Use server-loaded capabilities and full-page cards. Do not put HR-admin forms in the sidebar or personal page.

- [ ] **Step 5: Update sidebar and translations**

Remove direct Authorization, Custom Fields and Master Data links from the main list. Add the HR settings item and personal profile link.

- [ ] **Step 6: Run focused tests and i18n check**

```powershell
npm run check:i18n -w @liquid-hr/hr-suite
npm test -w @liquid-hr/hr-suite -- settings
```

- [ ] **Step 7: Commit**

```powershell
git add apps/hr-suite/app apps/hr-suite/components apps/hr-suite/messages
git commit -m "feat: add personal and admin settings pages"
```

### Task 5: Work-pattern services, API and employment page

**Files:**
- Create: `apps/hr-suite/lib/work-patterns/work-pattern-service.ts`
- Create: `apps/hr-suite/app/api/employments/[employmentId]/work-patterns/route.ts`
- Create: `apps/hr-suite/components/employment/work-pattern-editor.tsx`
- Create: `apps/hr-suite/components/employment/work-pattern-timeline.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx`
- Modify: `apps/hr-suite/messages/{nl,en}/employment.json`

**Interfaces:**
- `listEmploymentWorkPatterns(employmentId)` returns patterns with exactly `cycleWeeks * 7` day slots.
- `POST` validates and publishes one pattern through the database RPC.
- Employment tab becomes `Uren & rooster` and shows both independent timelines.

- [ ] **Step 1: Write failing service/schema tests**

Cover 1–4 weeks, invalid times, missing days, mismatched totals, overlap errors and administration scope.

- [ ] **Step 2: Run tests and confirm RED**

- [ ] **Step 3: Implement service and route**

Map database errors to the typed codes in the design; never calculate authoritative totals only in the client.

- [ ] **Step 4: Build editor and dual timeline**

Provide cycle length, dates, day/time/pause inputs, copy-day, copy-week and calculated comparison. Keep unsaved changes client-local and publish through one action.

- [ ] **Step 5: Run focused tests, i18n and typecheck**

- [ ] **Step 6: Commit**

```powershell
git add apps/hr-suite/lib/work-patterns apps/hr-suite/app/api/employments apps/hr-suite/components/employment 'apps/hr-suite/app/(dashboard)/employees' apps/hr-suite/messages
git commit -m "feat: add repeating employment rosters"
```

### Task 6: Holiday provider, import API and settings page

**Files:**
- Create: `apps/hr-suite/lib/holidays/nager-provider.ts`
- Create: `apps/hr-suite/lib/holidays/holiday-service.ts`
- Create: `apps/hr-suite/lib/holidays/schemas.ts`
- Create: `apps/hr-suite/lib/holidays/nager-provider.test.ts`
- Create: `apps/hr-suite/app/api/settings/holidays/preview/route.ts`
- Create: `apps/hr-suite/app/api/settings/holidays/route.ts`
- Create: `apps/hr-suite/app/(dashboard)/settings/holidays/page.tsx`
- Create: `apps/hr-suite/components/settings/holiday-manager.tsx`
- Create: `apps/hr-suite/messages/{nl,en}/holidays.json`

**Interfaces:**
- `previewHolidays({ year, countryCode })` returns validated additions, changes and existing matches.
- `importHolidays(input)` transactionally upserts API rows and preserves manual/excluded rows.
- Manual CRUD uses the same service with `source: 'MANUAL'`.

- [ ] **Step 1: Write failing provider and merge tests**

Mock successful, timeout, oversized and malformed responses. Prove reimport preserves manual rows and excluded API rows.

- [ ] **Step 2: Run tests and confirm RED**

- [ ] **Step 3: Implement the bounded Nager.Date adapter**

Use a server-only fetch with `AbortSignal.timeout`, ISO country/year validation, `cache: 'no-store'`, response size protection and strict Zod parsing.

- [ ] **Step 4: Implement preview/import/manual routes**

All writes require `holidays:write`; reads require `holidays:read`; administration comes from active server context.

- [ ] **Step 5: Build the full-page holiday manager**

Show country/year selection, preview diff, confirm import, source badges, active toggle and manual add/edit/delete.

- [ ] **Step 6: Run focused tests and i18n**

- [ ] **Step 7: Commit**

```powershell
git add apps/hr-suite/lib/holidays apps/hr-suite/app/api/settings/holidays 'apps/hr-suite/app/(dashboard)/settings/holidays' apps/hr-suite/components/settings apps/hr-suite/messages
git commit -m "feat: add administration holiday calendars"
```

### Task 7: Unified bounded calendar projection

**Files:**
- Create: `apps/hr-suite/lib/hr-calendar/calendar-projection.ts`
- Create: `apps/hr-suite/lib/hr-calendar/calendar-projection.test.ts`
- Modify: `apps/hr-suite/lib/hr-calendar/schemas.ts`
- Modify: `apps/hr-suite/lib/hr-events/service.ts`
- Modify: `apps/hr-suite/app/api/hr-events/route.ts`

**Interfaces:**
- `listEmployeeCalendar(input)` returns `{ employees, days, holidays, generalReminders, entries, pagination, sourceStatus }`.
- Selection input includes month, filters, page and pageSize `10 | 25 | 'all'`.
- Employee rows include `averageMinutesPerWeek` and projected work-pattern days.

- [ ] **Step 1: Write failing projection tests**

Prove cycle selection, no duplicate reminders, holiday/work coexistence, source filtering and selection cap:

```ts
expect(() => validateCalendarSelection({ pageSize: 'all', total: 101 })).toThrow('CALENDAR_SELECTION_TOO_LARGE')
```

- [ ] **Step 2: Run tests and confirm RED**

- [ ] **Step 3: Implement server-side employee pagination first**

Load no more than 100 employee IDs before retrieving work-pattern and event details. Apply permission and administration scope at each source.

- [ ] **Step 4: Combine typed source projections**

Do not convert a source error into an empty array; return a source status that the UI can display.

- [ ] **Step 5: Update API and run focused tests**

- [ ] **Step 6: Commit**

```powershell
git add apps/hr-suite/lib/hr-calendar apps/hr-suite/lib/hr-events apps/hr-suite/app/api/hr-events
git commit -m "feat: project unified employee calendar"
```

### Task 8: Adaptive desktop calendar UI

**Files:**
- Refactor: `apps/hr-suite/components/hr-calendar/hr-month-calendar.tsx`
- Create: `apps/hr-suite/components/hr-calendar/calendar-day-cell.tsx`
- Create: `apps/hr-suite/components/hr-calendar/calendar-day-panel.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/hr-calendar/page.tsx`
- Modify: `apps/hr-suite/messages/{nl,en}/hrCalendar.json`

**Interfaces:**
- Day-header selection exposes `{ date }`.
- Employee-day selection exposes `{ employeeId, date, scheduledMinutes }`.
- Employee names link to `/employees/{employeeId}`.

- [ ] **Step 1: Write failing calendar UI-model tests**

Test URL-state normalization, 10/25/all choices, day-cell visual state priority and popover labels.

- [ ] **Step 2: Run tests and confirm RED**

- [ ] **Step 3: Build sticky desktop grid**

Use a sticky employee column and day header, horizontal scrolling, today/weekend/holiday states, clickable names and average-hours badges.

- [ ] **Step 4: Build accessible day interactions**

Non-working days show a grey bar. Working days remain visually open. Hover, focus and click expose times, pause, net hours and cycle week. Day header and employee cell open read-only future-action panels.

- [ ] **Step 5: Add filters, pagination and partial-source errors**

Keep all state in the URL and show the 100-employee refinement message.

- [ ] **Step 6: Run focused tests, i18n, typecheck and lint**

- [ ] **Step 7: Commit**

```powershell
git add apps/hr-suite/components/hr-calendar 'apps/hr-suite/app/(dashboard)/hr-calendar' apps/hr-suite/messages
git commit -m "feat: redesign employee month calendar"
```

### Task 9: Documentation, version, full verification and deployment

**Files:**
- Modify: `apps/hr-suite/lib/app-version.ts`
- Modify: `apps/hr-suite/lib/app-version.test.ts`
- Modify: `docs/README.md`
- Modify: `docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`
- Modify: `docs/requirements/authorization/AUTORISATIE_EN_RECHTEN.md`
- Create: `docs/requirements/settings/INSTELLINGEN_MODULES_FEESTDAGEN.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`

**Interfaces:**
- Version becomes the next date-based release number after `1.20260718.2`.
- Documentation records actual migration, test, preview and production evidence only.

- [ ] **Step 1: Update version test first and confirm RED**

Set the expected release to `1.20260718.3`, run the focused test and confirm it fails against `.2`.

- [ ] **Step 2: Update version and documentation**

Document the final schema, permissions, routes, known limits and the separation between personal and HR-admin settings.

- [ ] **Step 3: Run the complete release gate**

```powershell
npm test
npm run check:i18n -w @liquid-hr/hr-suite
npm run typecheck -w @liquid-hr/hr-suite
npm run lint -w @liquid-hr/hr-suite
npm run build -w @liquid-hr/hr-suite
```

Expected: all commands exit 0.

- [ ] **Step 4: Validate locally on port 3000**

Run the production app on port 3000 and use Playwright to verify personal settings, HR-admin settings, module management, roster editor, holiday import with a controlled provider response and calendar interactions at laptop and desktop widths.

- [ ] **Step 5: Publish and validate a public preview**

Push the feature branch, wait for Vercel READY and repeat safe read-only browser checks. Inspect runtime logs for errors.

- [ ] **Step 6: Merge to main and deploy production**

After every release gate is green, merge without discarding unrelated work, push `main`, wait for production READY and validate version `1.20260718.3` plus protected routes.

- [ ] **Step 7: Commit final evidence**

```powershell
git add apps/hr-suite/lib/app-version.ts apps/hr-suite/lib/app-version.test.ts docs
git commit -m "docs: release settings rosters and calendar 1.20260718.3"
```
