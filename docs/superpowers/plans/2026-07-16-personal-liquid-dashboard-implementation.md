# Personal Liquid Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een veilige, persoonlijke Liquid Dashboard-startpagina met meerdere opgeslagen dashboards en een beperkte widgetcatalogus.

**Architecture:** Twee RLS-beveiligde tabellen bewaren uitsluitend persoonlijke dashboardmetadata en een typed widgetconfiguratie. Een server-side service leidt de sessiecontext af en levert een readmodel met bestaande, geautoriseerde bronnen. De client bewerkt een lokale conceptindeling en bewaart die alleen via de expliciete save-route.

**Tech Stack:** Next.js App Router, React, strict TypeScript, Supabase SSR/RLS/Postgres, Zod, Tailwind v4, Vitest.

## Global Constraints

- Bouw `schema -> API route/service -> UI`; geen browser-secrets, `any`, React Query of SWR.
- Tabellen hebben owner/tenant-RLS, indexes, grants en samengestelde tenant-FK's in één migratie.
- Alle zichtbare tekst komt uit gelijke NL/EN-namespaces.
- Widgetcodes zijn gesloten typed waarden; opgeslagen instellingen bevatten geen uitvoerbare code.
- Bewerkmodus gebruikt toegankelijke volgorde-knoppen, geen drag-and-drop.

---

### Task 1: Personal dashboard schema, types en RLS

**Files:**
- Create: `apps/hr-suite/supabase/migrations/<timestamp>_add_personal_dashboards.sql`
- Create: `apps/hr-suite/supabase/tests/personal_dashboards.sql`
- Create: `apps/hr-suite/lib/dashboard/schemas.ts`
- Create: `apps/hr-suite/lib/dashboard/schemas.test.ts`
- Modify: `packages/db/types.ts`

**Interfaces:** produces `personal_dashboards`, `personal_dashboard_widgets`, `dashboardCreateSchema`, `dashboardLayoutSchema` and widget type union `WELCOME | MY_REMINDERS | ORGANIZATION_OVERVIEW | EMPLOYEE_OVERVIEW`.

- [ ] Write failing schema test: an empty dashboard name and an unknown widget type are rejected.
- [ ] Run `npm.cmd test -w @liquid-hr/hr-suite -- lib/dashboard/schemas.test.ts`; confirm RED.
- [ ] Add owner/tenant schema, partial unique default index, cascade widgets, typed position/settings checks, RLS/policies/grants/indexes and SQL structural test.
- [ ] Add strict Zod schemas and local generated-type equivalent.
- [ ] Re-run focused test and type check; expect green.
- [ ] Commit: `feat: add personal dashboard schema`.

### Task 2: Dashboard service and authorized widget readmodel

**Files:**
- Create: `apps/hr-suite/lib/dashboard/service.ts`
- Create: `apps/hr-suite/lib/dashboard/service.test.ts`
- Create: `apps/hr-suite/lib/dashboard/types.ts`

**Interfaces:** produces `listPersonalDashboards`, `createDashboard`, `renameDashboard`, `duplicateDashboard`, `deleteDashboard`, `saveDashboardLayout`, `getDashboardView` and auto-provisioned default dashboard.

- [ ] Write failing service test: first visit creates exactly one default dashboard with the four approved widgets.
- [ ] Write failing service test: layout save rejects duplicate positions and unknown widgets.
- [ ] Run focused tests; confirm RED.
- [ ] Implement server-derived context, owner/tenant scoped persistence and widget readmodel using existing reminder, employee and organization sources only.
- [ ] Ensure unavailable widget sources produce a neutral state rather than leaking data.
- [ ] Re-run focused tests; expect green.
- [ ] Commit: `feat: add personal dashboard service`.

### Task 3: Dashboard API and i18n

**Files:**
- Create: `apps/hr-suite/app/api/dashboards/route.ts`
- Create: `apps/hr-suite/app/api/dashboards/[dashboardId]/route.ts`
- Create: `apps/hr-suite/app/api/dashboards/[dashboardId]/layout/route.ts`
- Create: co-located route tests
- Create: `apps/hr-suite/messages/nl/dashboard.json`
- Create: `apps/hr-suite/messages/en/dashboard.json`
- Modify: `apps/hr-suite/lib/i18n/config.ts`
- Modify: `apps/hr-suite/lib/i18n/server.ts`

- [ ] Write failing route tests for unauthenticated access, invalid widget payload and owner-only delete.
- [ ] Run focused route tests; confirm RED.
- [ ] Add Zod-validated CRUD/layout endpoints with `{ data }`/`{ error }` responses.
- [ ] Add matching dashboard translations and verify parity.
- [ ] Re-run route tests and `check:i18n`; expect green.
- [ ] Commit: `feat: expose personal dashboard API`.

### Task 4: Dashboard workspace and widgets

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/dashboard/page.tsx`
- Create: `apps/hr-suite/components/dashboard/dashboard-workspace.tsx`
- Create: `apps/hr-suite/components/dashboard/dashboard-switcher.tsx`
- Create: `apps/hr-suite/components/dashboard/dashboard-editor.tsx`
- Create: `apps/hr-suite/components/dashboard/widget-renderer.tsx`
- Create: focused helper/component tests

- [ ] Write failing pure UI test: unsaved widget reordering does not change the persisted layout model.
- [ ] Run focused test; confirm RED.
- [ ] Build the personal workspace, widget renderer, normal/edit modes, add/remove/reorder controls and explicit save/cancel.
- [ ] Make widgets responsive and link only to existing, authorized modules.
- [ ] Re-run UI tests, lint and type check; expect green.
- [ ] Commit: `feat: add personal dashboard workspace`.

### Task 5: Navigation, start route and delivery verification

**Files:**
- Modify: `apps/hr-suite/app/page.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/layout.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`
- Modify: `apps/hr-suite/messages/nl/navigation.json`
- Modify: `apps/hr-suite/messages/en/navigation.json`
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `docs/delivery/HANDMATIGE_ACTIES.md`

- [ ] Write failing navigation helper/component test: Dashboard is the first authenticated navigation item.
- [ ] Run the test; confirm RED.
- [ ] Add Dashboard as first flat sidebar link and redirect `/` to `/dashboard`.
- [ ] Document actual scope, Supabase migration block and detailed acceptance test steps.
- [ ] Run full test suite, lint, type check, i18n and production build.
- [ ] Restart port-3000 server and smoke test `/login` and `/dashboard` redirect behavior.
- [ ] Commit: `chore: prepare personal dashboard test release`.

## Self-review

- Schema, API, UI, persistence, security, widgets, navigation, documentation and verification are each covered by a task.
- The plan deliberately excludes free-form Liquid Display queries, charts, sharing and drag-and-drop.
- All later interfaces use the widget union and service methods introduced in Tasks 1–2.
