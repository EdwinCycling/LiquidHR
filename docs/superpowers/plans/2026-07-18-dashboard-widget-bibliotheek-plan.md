# Dashboard-widgetbibliotheek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een autorisatiebewuste, tenantgebonden widgetbibliotheek voor alle vijf HR-categorieën met bestaande datadekking, Recharts-visualisaties, drie breedtes en HR-adminbeheer.

**Architecture:** Een typed registry beschrijft catalogusmetadata en loadercontracten. Supabase bewaart tenantconfiguratie en roltoegang met RLS. Server-only dashboardservices filteren widgets op catalogus, tenantconfig, rol en permission voordat loaderdata naar de bestaande Dashboard Builder gaat.

**Tech Stack:** Next.js App Router, strict TypeScript, Supabase/Postgres/RLS, Zod, bestaande dashboardservices, Recharts, Tailwind v4 en NL/EN message namespaces.

## Global Constraints

- Bouw altijd `schema → API/service → UI`.
- Gebruik geen `any`, React Query of SWR.
- Autorisatie gebeurt server-side én met RLS; UI-verberging is alleen UX.
- Alle zichtbare teksten en foutmeldingen komen uit gelijke NL/EN-taalbestanden.
- Iedere nieuwe publieke tabel krijgt RLS, policies, grants en auditgedrag in dezelfde migratie.
- Geen BSN, documentbytes of ongeautoriseerde salarisdata in generieke widgetpayloads.
- Valideer lokaal op poort 3000 met type-check, tests, i18n, lint, build en browsercontrole.

---

### Task 1: Typed widgetcatalogus en datadekkingscontract

**Files:**
- Create: `apps/hr-suite/lib/dashboard/widget-catalog.ts`
- Create: `apps/hr-suite/lib/dashboard/widget-catalog.test.ts`
- Modify: `apps/hr-suite/lib/dashboard/schemas.ts`
- Modify: `apps/hr-suite/lib/dashboard/service.ts`

**Interfaces:**
- Produceer `DashboardWidgetCategory`, `DashboardWidgetWidth`, `DashboardWidgetVisualization`, `DashboardWidgetCatalogEntry` en `DASHBOARD_WIDGET_CATALOG`.
- Produceer `getWidgetCatalogEntry(type)` en `getAvailableWidgetCatalog()`.
- Behoud bestaande widgettypes als aliases of migratiecompatibele entries; ongeldige testtypes worden niet meer aangeboden.

- [ ] Schrijf tests voor vijf categorieën, unieke types, drie widths, beschikbare loaders en afwijzing van onbekende widgettypes.
- [ ] Run `npm test -w @liquid-hr/hr-suite -- lib/dashboard/widget-catalog.test.ts`; verwacht eerst FAIL op ontbrekende registry.
- [ ] Implementeer de registry met alleen widgets uit de goedgekeurde spec: Core HR, Employment, Documents, Compensation en Organization/Time.
- [ ] Breid `dashboardWidgetTypeSchema` uit met alle catalogustypes en voeg `width: z.enum(['HALF','TWO_THIRDS','FULL'])` toe aan widgetsettings/layoutvalidatie.
- [ ] Laat oude `WELCOME` en bestaande testwidgets veilig renderen via compat-entry of filter ze gecontroleerd uit; voeg geen fictieve datawidgets toe.
- [ ] Run dezelfde test opnieuw; verwacht PASS.
- [ ] Commit `feat: add typed dashboard widget catalog`.

### Task 2: Databaseconfiguratie, roltoegang en RLS

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260718170000_add_dashboard_widget_catalog.sql`
- Modify: `packages/db/types.ts`
- Create: `apps/hr-suite/supabase/tests/dashboard_widget_catalog.sql`

**Interfaces:**
- Tabellen: `dashboard_widget_configs(tenant_id, widget_type, is_enabled, updated_by, timestamps)` en `dashboard_widget_role_access(tenant_id, widget_type, management_role_id, timestamps)`.
- Unieke sleutels op tenant/widget en tenant/widget/role; samengestelde tenant foreign keys naar management roles.

- [ ] Schrijf SQL-tests voor tenantisolatie, HR-admin write, niet-HR-admin deny, roltoegang en disabled-config gedrag.
- [ ] Maak tabellen met RLS, policies, explicit grants en audittriggers. Gebruik `dashboard-widget:read` en `dashboard-widget:write` permissions.
- [ ] Seed permissions en default configs voor alle beschikbare catalogustypes; seed rolkoppelingen op bestaande management-role codes zonder hardcoded UUID's.
- [ ] Run Supabase migration/tests en genereer `packages/db/types.ts` opnieuw.
- [ ] Run Supabase security/performance advisors; los nieuwe grants/RLS-waarschuwingen op.
- [ ] Commit `feat: add dashboard widget tenant configuration`.

### Task 3: Server-side catalogusfiltering en widget-loadercontract

**Files:**
- Create: `apps/hr-suite/lib/dashboard/widget-access.ts`
- Create: `apps/hr-suite/lib/dashboard/widget-access.test.ts`
- Create: `apps/hr-suite/lib/dashboard/widget-loaders.ts`
- Create: `apps/hr-suite/lib/dashboard/widget-loaders.test.ts`
- Modify: `apps/hr-suite/lib/dashboard/service.ts`

**Interfaces:**
- `listVisibleWidgetCatalog(): Promise<DashboardWidgetCatalogEntry[]>`
- `filterDashboardWidgets(widgets: DashboardWidget[]): Promise<DashboardWidget[]>`
- `loadDashboardWidgetData(type, context): Promise<DashboardWidgetData>`
- `DashboardWidgetData` is a discriminated union per visualization; no `Record<string, unknown>` leaves the loader boundary.

- [ ] Schrijf tests voor enabled/disabled, role allowlist, missing permission, unknown type en stale existing dashboard widgets.
- [ ] Implementeer access resolver met tenantcontext, actieve management roles en `requirePermission`; default deny bij ontbrekende rolkoppeling.
- [ ] Implementeer loader-contracten voor employee core, employment, documents, compensation en organization/time met bestaande services/RLS.
- [ ] Maak loaderfouten widget-lokaal: return typed `empty`/`error` state en laat andere widgets laden.
- [ ] Pas `getDashboardView`, `getDashboardWidgets` en `saveDashboardLayout` aan zodat ongeldige widgets nooit terugkomen of opgeslagen worden.
- [ ] Run unit/service tests; verwacht PASS.
- [ ] Commit `feat: enforce dashboard widget access and loaders`.

### Task 4: Recharts en consistente widgetcomponenten

**Files:**
- Modify: `apps/hr-suite/package.json`
- Modify: `package-lock.json`
- Create: `apps/hr-suite/components/dashboard/widget-card.tsx`
- Create: `apps/hr-suite/components/dashboard/widget-chart.tsx`
- Create: `apps/hr-suite/components/dashboard/widget-table.tsx`
- Create: `apps/hr-suite/components/dashboard/widget-kpi.tsx`
- Create: `apps/hr-suite/components/dashboard/widget-empty-state.tsx`
- Modify: `apps/hr-suite/components/dashboard/widget-renderer.tsx`

**Interfaces:**
- `WidgetCard({ title, category, width, actions, children })`.
- `WidgetChart` wraps Recharts with CSS-variable colors, tooltip, legend and text summary.
- `WidgetWidth` maps `HALF → col-span-3`, `TWO_THIRDS → col-span-4`, `FULL → col-span-6` in a six-column grid.

- [ ] Add `recharts` dependency and lockfile update.
- [ ] Write component tests for width classes, empty/error state and accessible chart summary.
- [ ] Implement shared card primitives before widget-specific JSX; no hardcoded hex values.
- [ ] Implement renderer dispatch from catalog visualization/data discriminants.
- [ ] Run component tests and lint; expected PASS with no TypeScript errors.
- [ ] Commit `feat: add consistent dashboard widget primitives`.

### Task 5: Implement Core HR and Employment widgets

**Files:**
- Create: `apps/hr-suite/components/dashboard/widgets/core-hr-widgets.tsx`
- Create: `apps/hr-suite/components/dashboard/widgets/employment-widgets.tsx`
- Modify: `apps/hr-suite/components/dashboard/widget-renderer.tsx`
- Modify: `apps/hr-suite/lib/dashboard/widget-loaders.ts`

- [ ] Add typed loaders/renderers for profile, completeness, emergency contacts, directory, birthdays, department headcount, gender/education/nationality distributions.
- [ ] Add typed loaders/renderers for contract details/mix, expiring contracts, probation alerts, starts, ends, tenure, status mix and employment-change timeline.
- [ ] Apply archived exclusion and employee/admin scope in every collection query.
- [ ] Add i18n keys in `messages/nl/dashboard.json` and `messages/en/dashboard.json` for titles, descriptions, labels, units and empty/error states.
- [ ] Write tests for contract-date boundaries, tenure calculation, archived filtering and self versus HR scope.
- [ ] Commit `feat: add core hr and employment dashboard widgets`.

### Task 6: Implement Documents, Compensation and Organization/Time widgets

**Files:**
- Create: `apps/hr-suite/components/dashboard/widgets/document-widgets.tsx`
- Create: `apps/hr-suite/components/dashboard/widgets/compensation-widgets.tsx`
- Create: `apps/hr-suite/components/dashboard/widgets/organization-time-widgets.tsx`
- Modify: `apps/hr-suite/lib/dashboard/widget-loaders.ts`
- Modify: `apps/hr-suite/components/dashboard/widget-renderer.tsx`

- [ ] Implement recent/expiring/category/reminder document widgets without exposing private bytes or unauthorized document metadata.
- [ ] Implement salary history, averages, scale occupancy, payment-type mix, cost allocation and salary timeline behind `salary:read`.
- [ ] Implement weekly roster, weekday hours, FTE/headcount, roster coverage, upcoming holidays, reminders, organization summary and work-pattern widgets.
- [ ] Leave leave/absence/declaration/payroll-slip/AI-compliance catalog categories empty until real schemas exist.
- [ ] Write scope and permission tests for each loader family.
- [ ] Commit `feat: add document compensation and roster widgets`.

### Task 7: HR-admin widget library settings page and API

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/settings/dashboard-widgets/page.tsx`
- Create: `apps/hr-suite/app/api/settings/dashboard-widgets/route.ts`
- Create: `apps/hr-suite/app/api/settings/dashboard-widgets/[widgetType]/route.ts`
- Create: `apps/hr-suite/components/settings/dashboard-widget-library.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/settings/page.tsx`
- Modify: `apps/hr-suite/messages/nl/settings.json`
- Modify: `apps/hr-suite/messages/en/settings.json`

- [ ] Add settings tile visible only with `dashboard-widget:write`.
- [ ] Implement GET/PATCH APIs with Zod input, server permission checks and audit logging.
- [ ] Build category filters, search, active toggle, role checkboxes, visualization badges and impact count for existing dashboards.
- [ ] Show disabled/unavailable future categories as read-only explanatory sections, not selectable fake widgets.
- [ ] Add NL/EN translations and accessibility labels.
- [ ] Add API/service tests for authorization and role updates.
- [ ] Commit `feat: add hr dashboard widget library settings`.

### Task 8: Upgrade Dashboard Builder and default dashboards

**Files:**
- Modify: `apps/hr-suite/components/dashboard/dashboard-workspace.tsx`
- Modify: `apps/hr-suite/components/dashboard/dashboard-editor.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/hr-suite/lib/dashboard/service.ts`
- Modify: `apps/hr-suite/messages/nl/dashboard.json`
- Modify: `apps/hr-suite/messages/en/dashboard.json`

- [ ] Replace hardcoded widget buttons with server-provided visible catalog grouped by category.
- [ ] Add width selector and six-column responsive grid while preserving existing dashboard layouts.
- [ ] Add widget removal confirmation and a clear stale-widget message when HR disabled a widget.
- [ ] Remove obsolete test-only defaults and seed a small useful default dashboard from available catalog entries.
- [ ] Ensure new widgets can be added but unauthorized/disabled widgets cannot be re-saved.
- [ ] Add tests for layout width validation and stale widget cleanup.
- [ ] Commit `feat: expand dashboard builder with authorized widget library`.

### Task 9: Documentation, release version and end-to-end verification

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `apps/hr-suite/lib/app-version.ts`
- Modify: `apps/hr-suite/lib/app-version.test.ts`

- [ ] Document the widget library and admin route in the architecture index and status.
- [ ] Bump version from `1.20260718.4` to `1.20260718.5` and update the version test.
- [ ] Run `npm run type-check -w @liquid-hr/hr-suite`.
- [ ] Run `npm test -w @liquid-hr/hr-suite`.
- [ ] Run `npm run check:i18n -w @liquid-hr/hr-suite`.
- [ ] Run `npm run lint -w @liquid-hr/hr-suite`.
- [ ] Run `npm run build -w @liquid-hr/hr-suite`.
- [ ] Run local browser checks on port 3000 for widget library, role filtering, dashboard add/remove, all widths and disabled-widget removal.
- [ ] Re-run Supabase advisors and record remaining known warnings.
- [ ] Commit `release: dashboard widget library 1.20260718.5` and push the branch.
