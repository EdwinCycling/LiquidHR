# Organogram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een read-only, afdeling-gedreven organogram met geautoriseerde peildatumprojectie, aantrekkelijke filters, desktopcanvas en mobiele boom.

**Architecture:** Bestaande organisatie- en medewerkerstabellen blijven de enige bron van waarheid. Een pure TypeScript-projector zet geautoriseerde rijen om in een getypeerde graph; serverpage en GET-route gebruiken één service. Alleen pan, zoom en filterbediening zijn client-state.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Zod 4, Supabase/Postgres RLS, Tailwind v4, `@xyflow/react`, Vitest.

## Global Constraints

- Bouw in de volgorde `schema → API route → UI`.
- Geen `any`, hardcoded hexkleuren, React Query, SWR of client-side autorisatie.
- Alle zichtbare tekst staat in gelijkwaardige NL/EN-namespaces.
- Geen drag-and-drop of mutaties vanuit het organogram.
- Vrije velden zijn default niet beschikbaar als filter en vereisen expliciete opt-in.
- Lokale verificatie draait op poort `3000`; publieke preview blijft vereist voor definitieve afronding.

---

### Task 1: Schema, permission en database-isolatie

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260716110000_add_organization_chart_read_model.sql`
- Create: `apps/hr-suite/supabase/tests/organization_chart.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces: `custom_field_definitions.show_in_organization_chart_filter: boolean` en permission `organization-chart:read`.
- Consumes: bestaande `management_roles`, `permissions`, `role_permissions` en RLS.

- [ ] **Step 1: Schrijf de falende SQL-regressieproef**

```sql
begin;
do $$
begin
  if not exists (select 1 from public.permissions where code = 'organization-chart:read') then
    raise exception 'ORGANIZATION_CHART_PERMISSION_MISSING';
  end if;
  if exists (
    select 1 from public.custom_field_definitions
    where show_in_organization_chart_filter and is_active = false
  ) then raise exception 'INACTIVE_ORG_CHART_FILTER_EXPOSED'; end if;
end $$;
rollback;
```

- [ ] **Step 2: Draai de proef en bevestig RED**

Run: `npx supabase test db apps/hr-suite/supabase/tests/organization_chart.sql`
Expected: FAIL omdat kolom en permission nog ontbreken; indien CLI niet gekoppeld is, leg dit als externe blokkade vast en voer de migratie lokaal statisch verder uit.

- [ ] **Step 3: Maak de migratie met de Supabase CLI en implementeer schema/rechten**

Run eerst: `npx supabase migration new add_organization_chart_read_model`

```sql
alter table public.custom_field_definitions
  add column show_in_organization_chart_filter boolean not null default false;

insert into public.permissions (code, name, category, description)
values ('organization-chart:read', 'Organogram bekijken', 'Organisatie & inrichting',
        'Bekijkt het organogram binnen de geldige organisatie- en medewerkerscope.')
on conflict (code) do update set name = excluded.name, category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'organization-chart:read'
where role.code in ('TENANT_ADMIN', 'HR_ADVISOR', 'TEAM_LEAD')
on conflict do nothing;
```

- [ ] **Step 4: Genereer types en verifieer schema**

Run: `npx supabase db advisors`, `npx supabase gen types typescript --linked --schema public > packages/db/types.ts`, en de SQL-proef opnieuw.
Expected: geen nieuwe security/performance findings en databaseproef PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/supabase packages/db/types.ts
git commit -m "feat: add organization chart read model"
```

### Task 2: Getypeerde graph-projectie

**Files:**
- Create: `apps/hr-suite/lib/organization-chart/types.ts`
- Create: `apps/hr-suite/lib/organization-chart/projector.ts`
- Create: `apps/hr-suite/lib/organization-chart/projector.test.ts`
- Create: `apps/hr-suite/lib/organization-chart/schemas.ts`
- Create: `apps/hr-suite/lib/organization-chart/schemas.test.ts`

**Interfaces:**
- Produces: `projectOrganizationChart(input: OrganizationChartProjectionInput): OrganizationChartGraph`.
- Produces: `organizationChartQuerySchema` met `date`, `q`, `department`, `role`, `field`, `value`.

- [ ] **Step 1: Schrijf falende tests voor peildatum, hiërarchie, ambiguïteit en matchpaden**

```ts
it('behoudt ancestors van een gevonden medewerker als zichtbaar pad', () => {
  const graph = projectOrganizationChart(fixture({ query: 'Ada' }))
  expect(graph.nodes.find((node) => node.id === 'employee:ada')?.matchState).toBe('match')
  expect(graph.nodes.find((node) => node.id === 'department:engineering')?.matchState).toBe('context')
  expect(graph.nodes.find((node) => node.id === 'administration:main')?.matchState).toBe('context')
})

it('markeert meerdere actieve DIRECT_MANAGER-houders als ambigu', () => {
  const graph = projectOrganizationChart(fixture({ managerIds: ['one', 'two'] }))
  expect(graph.nodes.find((node) => node.id === 'department:engineering')).toMatchObject({
    type: 'department', manager: { status: 'ambiguous', count: 2 },
  })
})
```

- [ ] **Step 2: Draai tests en bevestig RED**

Run: `npm.cmd run test -w @liquid-hr/hr-suite -- lib/organization-chart/projector.test.ts lib/organization-chart/schemas.test.ts`
Expected: FAIL omdat modules ontbreken.

- [ ] **Step 3: Implementeer discriminated unions en projector**

```ts
export type OrganizationChartNode = AdministrationChartNode | DepartmentChartNode | EmployeeChartNode
export type MatchState = 'match' | 'context' | 'dimmed' | 'normal'

export function projectOrganizationChart(input: OrganizationChartProjectionInput): OrganizationChartGraph {
  const graph = buildUnfilteredGraph(input)
  return applyOrganizationChartFilters(graph, input.filters)
}
```

De implementatie sorteert op code/naam/id, maakt edges `administration-department`, `department-department` en `department-employee`, gebruikt alleen actieve inputrijen en kiest bij meerdere managers nooit de eerste.

- [ ] **Step 4: Draai gerichte tests en typecheck**

Run: `npm.cmd run test -w @liquid-hr/hr-suite -- lib/organization-chart` en `npm.cmd run type-check -w @liquid-hr/hr-suite`.
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/organization-chart
git commit -m "feat: project organization chart graph"
```

### Task 3: Geautoriseerde service en GET-route

**Files:**
- Create: `apps/hr-suite/lib/organization-chart/service.ts`
- Create: `apps/hr-suite/app/api/organization-chart/route.ts`
- Create: `apps/hr-suite/app/api/organization-chart/route.test.ts`

**Interfaces:**
- Consumes: `projectOrganizationChart`, `organizationChartQuerySchema`.
- Produces: `getOrganizationChart(query): Promise<OrganizationChartGraph>` en GET `{ data: graph }`.

- [ ] **Step 1: Schrijf falende routetests**

```ts
it('weigert een ongeldige peildatum', async () => {
  const response = await GET(new Request('http://localhost/api/organization-chart?date=16-07-2026'))
  expect(response.status).toBe(400)
  await expect(response.json()).resolves.toEqual({ code: 'ORGANIZATION_CHART_INPUT_INVALID' })
})
```

- [ ] **Step 2: Draai test en bevestig RED**

Run: `npm.cmd run test -w @liquid-hr/hr-suite -- app/api/organization-chart/route.test.ts`
Expected: FAIL omdat route ontbreekt.

- [ ] **Step 3: Implementeer service met expliciete bronrechten en begrensde parallelle queries**

```ts
const context = await requirePermission('organization-chart:read')
await Promise.all([
  requirePermission('department:read'),
  requirePermission('organization-placement:read'),
  requirePermission('management-assignment:read'),
])
if (!context.administrationId) throw new OrganizationChartError('ADMINISTRATION_REQUIRED', 400)
```

Selecteer uitsluitend graphvelden. Gebruik `.limit(500)` voor afdelingen/definities, `.limit(5000)` voor plaatsingen/medewerkers/waarden en pas tenant-, administratie- en peildatumfilters server-side toe. Employee-RLS bepaalt welke persoonskaarten zichtbaar zijn.

- [ ] **Step 4: Implementeer GET-route en consistente fouten**

```ts
export async function GET(request: Request): Promise<NextResponse> {
  const query = organizationChartQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!query.success) return NextResponse.json({ code: 'ORGANIZATION_CHART_INPUT_INVALID' }, { status: 400 })
  return NextResponse.json({ data: await getOrganizationChart(query.data) })
}
```

- [ ] **Step 5: Draai tests, lint en commit**

Run: gerichte tests, `npm.cmd run type-check -w @liquid-hr/hr-suite`, `npm.cmd run lint -w @liquid-hr/hr-suite`.

```powershell
git add apps/hr-suite/lib/organization-chart/service.ts apps/hr-suite/app/api/organization-chart
git commit -m "feat: expose authorized organization chart"
```

### Task 4: Verkenbalk, desktopcanvas en mobiele boom

**Files:**
- Modify: `apps/hr-suite/package.json`
- Modify: `package-lock.json`
- Create: `apps/hr-suite/app/(dashboard)/organization-chart/page.tsx`
- Create: `apps/hr-suite/components/organization-chart/organization-chart-explorer.tsx`
- Create: `apps/hr-suite/components/organization-chart/organization-chart-canvas.tsx`
- Create: `apps/hr-suite/components/organization-chart/organization-chart-mobile-tree.tsx`
- Create: `apps/hr-suite/components/organization-chart/organization-chart-nodes.tsx`
- Create: `apps/hr-suite/messages/nl/organization-chart.json`
- Create: `apps/hr-suite/messages/en/organization-chart.json`
- Modify: canonieke navigatiecomponent onder `apps/hr-suite/components/layout/`.

**Interfaces:**
- Consumes: `OrganizationChartGraph` en URL-query.
- Produces: route `/organization-chart` met deelbare filters.

- [ ] **Step 1: Installeer een gepinde React Flow-versie**

Run: `npm install @xyflow/react@12.11.2 -w @liquid-hr/hr-suite` en commit de lockfile mee.

- [ ] **Step 2: Bouw serverpage en aantrekkelijke verkenbalk**

De page parseert `searchParams`, laadt vertalingen en graph server-side. De explorer gebruikt een `<form method="get">`, een prominente zoekinput, snelle chips, een `<details>`-paneel voor peildatum/vrije velden, actieve filterchips en een contextuele resetlink.

```tsx
<form className="rounded-2xl border bg-surface/95 p-4 shadow-sm backdrop-blur" method="get">
  <label className="relative block">
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <input className="form-field h-11 w-full pl-10" name="q" defaultValue={query.q} />
  </label>
</form>
```

- [ ] **Step 3: Bouw desktopcanvas zonder drag-and-drop**

Gebruik getypeerde custom nodes, `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable`, `fitView`, Controls en MiniMap uit design tokens. Layoutposities worden vóór render deterministisch berekend en wijzigen niet door filters.

- [ ] **Step 4: Bouw mobiele verticale boom**

Onder `md` rendert een semantische `<ul>`/`<details>`-boom met minimaal 44px touch targets. De pagina zelf krijgt geen horizontale overflow. Medewerkerlinks blijven normale Next.js-links.

- [ ] **Step 5: Voeg NL/EN en navigatie toe**

Beide namespacebestanden hebben exact dezelfde sleutels voor titel, zoekplaceholder, filters, matchtelling, managerstatus, lege staat en reset. Navigatie verschijnt alleen wanneer `organization-chart:read` in de server-side capabilities zit.

- [ ] **Step 6: Verifieer UI-build en commit**

Run: `npm.cmd run check:i18n -w @liquid-hr/hr-suite`, gerichte tests, typecheck, lint en build.

```powershell
git add apps/hr-suite package-lock.json
git commit -m "feat: add organization chart explorer"
```

### Task 5: Integrale verificatie en blijvend geheugen

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `docs/delivery/HANDMATIGE_ACTIES.md` wanneer externe database/deployment nog blokkeert.

**Interfaces:**
- Consumes: volledig organogram.
- Produces: aantoonbare lokale en publieke status.

- [ ] **Step 1: Draai volledige controles**

Run: `npm.cmd test`, `npm.cmd run lint -w @liquid-hr/hr-suite`, `npm.cmd run type-check -w @liquid-hr/hr-suite`, `npm.cmd run check:i18n -w @liquid-hr/hr-suite`, `npm.cmd run build -w @liquid-hr/hr-suite`.
Expected: alles PASS.

- [ ] **Step 2: Draai productiebuild op poort 3000 en controleer echte flows**

Controleer desktop en 390px: initiële graph, zoeken, iedere filtersoort, losse chip verwijderen, wis alles, peildatum-deeplink, afdelingfocus, medewerkerdoorklik, zoom/fit en toetsenbordfocus. Controleer console en horizontale overflow.

- [ ] **Step 3: Controleer publieke preview**

Verifieer dezelfde kernflow op Vercel-preview. Wanneer Vercel- of Supabase-auth ontbreekt, markeer het onderdeel `GEDEELTELIJK` en schrijf de exacte handmatige actie in `HANDMATIGE_ACTIES.md`; claim geen volledige afronding.

- [ ] **Step 4: Werk documentatie bij en commit**

```powershell
git add docs
git commit -m "docs: record organization chart verification"
```
