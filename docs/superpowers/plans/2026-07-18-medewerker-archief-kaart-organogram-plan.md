# Medewerker archief, kaart en organogram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak archiveren, foto’s, medewerkerkaart-tabs, organogramfilters en dienstverbandtijdlijnen consistent en veilig beschikbaar in de hele HR-suite.

**Architecture:** Voeg een tenantgebonden `is_archived`-vlag toe aan `employees`, met RLS en audit via de bestaande server-side permissionlaag. Lijsten gebruiken URL-state; de laatste organogramfilter wordt in bestaande gebruikersvoorkeuren opgeslagen. Foto’s blijven in Supabase Storage met server-side mutatiecontrole. De medewerkerkaart wordt één tab-gebaseerde route; kalender en organogram sluiten gearchiveerden server-side uit.

**Tech Stack:** Next.js App Router, Server Components, route handlers, Supabase/Postgres/RLS, strict TypeScript, Tailwind tokens, Vitest, NL/EN message namespaces.

## Global Constraints

- Bouwvolgorde blijft `schema → API route → UI`.
- Geen `any`, geen React Query/SWR, alle zichtbare tekst uit NL/EN-taalbestanden.
- Tenant-, administratie-, medewerker- en permission-scope wordt server-side én via RLS afgedwongen.
- Nieuwe tabellen/kolommen krijgen policies/indexen in dezelfde migratie; advisors en `packages/db/types.ts` worden bijgewerkt.
- Gearchiveerd betekent uitsluitend een reversibele vlag; dienstverbanden en overige gegevens worden niet gewijzigd.

---

### Task 1: Archive flag and scoped employee queries

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260718150000_add_employee_archive_flag.sql`
- Modify: `apps/hr-suite/lib/employees/employee-service.ts`, `apps/hr-suite/lib/organization-chart/organization-chart-service.ts`, `apps/hr-suite/lib/hr-calendar/calendar-service.ts`
- Test: `apps/hr-suite/lib/employees/employee-service.test.ts`, `apps/hr-suite/lib/hr-calendar/calendar-model.test.ts`

- [ ] Add `employees.is_archived boolean not null default false`, a tenant/archive index, and an audit entry path using the existing audit helper.
- [ ] Extend employee listing/service signatures with `archiveFilter: 'active' | 'archived' | 'all'`, defaulting to `active`; keep employee-detail lookup able to open either state.
- [ ] Apply `is_archived = false` in organogram, calendar, reminder target options, authorization options, and other employee pickers unless an explicit HR-list filter asks otherwise.
- [ ] Add pure tests proving active/archived/all selection and the calendar/organogram default exclusion.
- [ ] Apply migration live, run Supabase advisors, and regenerate `packages/db/types.ts`.

### Task 2: Archive toggle API and employee list filter

**Files:**
- Create: `apps/hr-suite/app/api/employees/[employeeId]/archive/route.ts`
- Modify: `apps/hr-suite/app/(dashboard)/employees/page.tsx`, `apps/hr-suite/components/employees/employee-list.tsx`, `apps/hr-suite/messages/nl/employees.json`, `apps/hr-suite/messages/en/employees.json`
- Test: `apps/hr-suite/app/api/employees/[employeeId]/archive/route.test.ts`, `apps/hr-suite/lib/employees/employee-service.test.ts`

- [ ] Implement authenticated `PATCH` with Zod `{ archived: boolean }`, `employee:write`, tenant-safe update, and audit metadata.
- [ ] Add URL-state `archive=active|archived|all` to the employee page and a visible three-choice selector that composes with search/status/pagination.
- [ ] Render archive status on each row and pass the flag to the card action.
- [ ] Add NL/EN labels and route tests for authorization, invalid input, archive and restore.

### Task 3: Employee card photo and confirmation actions

**Files:**
- Create: `apps/hr-suite/app/api/employees/[employeeId]/avatar/route.ts`, `apps/hr-suite/components/employees/employee-archive-toggle.tsx`, `apps/hr-suite/components/employees/employee-avatar-manager.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`, `apps/hr-suite/components/employees/employee-person-card.tsx`, `apps/hr-suite/components/layout/sidebar.tsx`
- Test: `apps/hr-suite/app/api/employees/[employeeId]/avatar/route.test.ts`, `apps/hr-suite/components/employees/employee-archive-toggle.test.tsx`

- [ ] Add server-only avatar upload/replace/delete using the existing private storage conventions, MIME/size validation, signed/public-safe URL handling, and `employee:write` authorization.
- [ ] Add accessible confirmation dialogs for archive and restore; no mutation occurs until explicit confirmation.
- [ ] Show avatar or initials in the employee card and expose upload, replace and remove actions only to authorized users.
- [ ] Reuse the avatar projection in employee list and calendar data.

### Task 4: Tabbed employee card and employment timeline

**Files:**
- Modify: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`, `apps/hr-suite/components/employees/employee-person-card.tsx`, `apps/hr-suite/components/employment/employment-history-timeline.tsx`, `apps/hr-suite/messages/nl/employees.json`, `apps/hr-suite/messages/en/employees.json`, `apps/hr-suite/messages/nl/employment.json`, `apps/hr-suite/messages/en/employment.json`
- Test: `apps/hr-suite/components/employment/employment-history-timeline.test.ts`, `apps/hr-suite/lib/employment/employment-labels.test.ts`

- [ ] Make `tab=personal|employments|documents` URL state with clear active styling and keyboard focus.
- [ ] Render additional fields only in `personal`; move the entire dossier to `documents`; make employments a full tab.
- [ ] Add a horizontal/stacked effective-dated timeline showing each employment’s contract type, status, start and end dates, with Dutch/English labels (`Onbepaalde tijd`, `Bepaalde tijd`, `Extern`).
- [ ] Preserve deep links from existing employment detail routes and keep document/permission guards server-side.

### Task 5: Organogram filter panel and menu/stamgegevens routing

**Files:**
- Modify: `apps/hr-suite/app/(dashboard)/organization-chart/page.tsx`, `apps/hr-suite/components/organization/organization-chart-explorer.tsx`, `apps/hr-suite/lib/organization-chart/organization-chart-service.ts`, `apps/hr-suite/lib/preferences/server.ts`, `apps/hr-suite/app/(dashboard)/layout.tsx`, `apps/hr-suite/app/(dashboard)/settings/page.tsx`, message namespaces
- Test: `apps/hr-suite/lib/organization-chart/organization-chart-service.test.ts`, `apps/hr-suite/components/organization/organization-chart-explorer.test.tsx`

- [ ] Add a collapsed-by-default filter panel with search, department, role and date controls; keep active chips visible when collapsed.
- [ ] Persist the last filter in the existing user-preferences JSON and restore it only for that user/tenant context.
- [ ] Remove general sidebar `Afdelingen`; keep the route reachable from HR-admin settings/stamgegevens only.
- [ ] Ensure archived employees are excluded from graph data before rendering.

### Task 6: Calendar, labels, docs and release verification

**Files:**
- Modify: `apps/hr-suite/app/(dashboard)/hr-calendar/page.tsx`, `apps/hr-suite/components/hr-calendar/hr-month-calendar.tsx`, `docs/README.md`, `docs/delivery/IMPLEMENTATION_STATUS.md`, `docs/delivery/CURRENT_CONTEXT.md`

- [ ] Add avatar rendering and archive-safe employee projection to the calendar; keep day details and links intact.
- [ ] Replace raw contract enum output everywhere in employee/employment views with translated labels.
- [ ] Run `npm test -w @liquid-hr/hr-suite`, `npm run type-check -w @liquid-hr/hr-suite`, `npm run lint -w @liquid-hr/hr-suite`, `npm run check:i18n -w @liquid-hr/hr-suite`, `npm run build -w @liquid-hr/hr-suite`, and `git diff --check`.
- [ ] Verify local port 3000, preview login redirect, production HR-admin pages, archived filtering, photo actions, tabs, organogram filter persistence, and calendar exclusion.
- [ ] Update version, docs and release branch only after the complete verification gate is green.
