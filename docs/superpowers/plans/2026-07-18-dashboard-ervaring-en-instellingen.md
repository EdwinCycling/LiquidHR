# Dashboardervaring en HR-instellingen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak het dashboard direct zichtbaar en progressief geladen, voeg voortgang en refresh toe, vervang technische widgetcodes door een gecategoriseerde widgetkiezer en herstel de twee HR-instellingenflows.

**Architecture:** Een server-side bootstrap leidt context, dashboardindeling en zichtbare catalogus één keer af. Afzonderlijke async Server Components laden widgetdata parallel binnen eigen Suspense-grenzen; kleine clientcomponenten beheren alleen voortgang, refresh en conceptstate. De bestaande RLS-tabellen en API voor widgetconfiguratie blijven de bron van waarheid.

**Tech Stack:** Next.js 16 App Router, React 19 Suspense/streaming, strict TypeScript, Supabase SSR/RLS, Zod, Tailwind v4, Vitest en paritaire NL/EN-i18n.

## Global Constraints

- Werk uitsluitend in `C:\Users\Edwin\Documents\Apps\HRMyDay\.worktrees\settings-rosters-calendar` op branch `codex/settings-rosters-calendar`.
- Gebruik geen subagents, `any`, React Query of SWR.
- Houd `schema → API/service → UI` aan; deze slice gebruikt de bestaande widgetconfiguratietabellen en voegt geen nieuw schema toe.
- Autorisatie wordt server-side én met RLS afgedwongen; UI-verberging is alleen UX.
- Alle zichtbare teksten komen uit gelijke `messages/nl`- en `messages/en`-namespaces.
- De knop Vernieuwen muteert nooit dashboardnaam, indeling, breedte, tenantconfiguratie of roltoegang.
- Niet-geïmplementeerde widgetloaders tonen een eerlijke vertaalde lege staat en nooit generieke of fictieve HR-cijfers.
- Controleer de lokale Next.js-documentatie voor App Router-streaming voordat de Server Component-grenzen worden gebouwd.
- Valideer lokaal op poort `3000`, op desktop en 390px, en via een publieke preview waar een geldige sessie beschikbaar is.

---

### Task 1: Getypte, vertaalde widgetpresentatie

**Files:**
- Create: `apps/hr-suite/lib/dashboard/widget-presentation.ts`
- Create: `apps/hr-suite/lib/dashboard/widget-presentation.test.ts`
- Modify: `apps/hr-suite/lib/dashboard/widget-catalog.ts`
- Modify: `apps/hr-suite/messages/nl/dashboard.json`
- Modify: `apps/hr-suite/messages/en/dashboard.json`
- Modify: `apps/hr-suite/messages/nl/settings.json`
- Modify: `apps/hr-suite/messages/en/settings.json`

**Interfaces:**
- Consumes: `DASHBOARD_WIDGET_CATALOG`, `DashboardWidgetCatalogEntry` en een translator `(key: string) => string`.
- Produces: `DashboardWidgetPresentation`, `buildWidgetPresentation(...)`, `buildWidgetPresentationMap(...)`, `dashboardCategoryOrder` en volledige vertaalde metadata voor alle catalogustypes.

- [ ] **Step 1: Schrijf de falende presentatietests**

```ts
import { describe, expect, it } from 'vitest'
import { DASHBOARD_WIDGET_CATALOG } from './widget-catalog'
import { buildWidgetPresentation, buildWidgetPresentationMap } from './widget-presentation'

describe('dashboard widget presentation', () => {
  it('maakt technische widgetcodes nooit zichtbaar', () => {
    const entry = DASHBOARD_WIDGET_CATALOG.find((item) => item.type === 'EXPIRING_CONTRACTS')!
    const view = buildWidgetPresentation(entry, (key) => ({
      'widgets.expiringContracts.title': 'Aflopende contracten',
      'widgets.expiringContracts.description': 'Contracten die binnenkort eindigen.',
      'categories.EMPLOYMENT': 'Dienstverband',
      'visualizations.TABLE': 'Tabel',
      'widths.TWO_THIRDS': 'Twee derde',
    })[key] ?? key)
    expect(view.title).toBe('Aflopende contracten')
    expect(view.description).toBe('Contracten die binnenkort eindigen.')
    expect(view.title).not.toContain('EXPIRING_CONTRACTS')
  })

  it('heeft voor ieder catalogustype volledige vertaalde metadata', () => {
    const map = buildWidgetPresentationMap(DASHBOARD_WIDGET_CATALOG, (key) => key.startsWith('missing.') ? key : `vertaald:${key}`)
    expect(map.size).toBe(DASHBOARD_WIDGET_CATALOG.length)
    for (const view of map.values()) {
      expect(view.title.startsWith('vertaald:')).toBe(true)
      expect(view.description.startsWith('vertaald:')).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd test -w @liquid-hr/hr-suite -- lib/dashboard/widget-presentation.test.ts`

Expected: FAIL omdat `widget-presentation.ts` nog niet bestaat.

- [ ] **Step 3: Implementeer de pure presentatielaag**

```ts
export interface DashboardWidgetPresentation {
  type: DashboardWidgetType
  category: DashboardWidgetCategory
  title: string
  description: string
  categoryLabel: string
  visualization: DashboardWidgetVisualization
  visualizationLabel: string
  defaultWidth: DashboardWidgetWidth
  widthLabel: string
}

export function buildWidgetPresentation(
  entry: DashboardWidgetCatalogEntry,
  translate: (key: string) => string,
): DashboardWidgetPresentation {
  return {
    type: entry.type,
    category: entry.category,
    title: translate(entry.titleKey),
    description: translate(entry.descriptionKey),
    categoryLabel: translate(`categories.${entry.category}`),
    visualization: entry.visualization,
    visualizationLabel: translate(`visualizations.${entry.visualization}`),
    defaultWidth: entry.defaultWidth,
    widthLabel: translate(`widths.${entry.defaultWidth}`),
  }
}
```

- [ ] **Step 4: Voeg volledige NL/EN-copy toe**

Gebruik onder `dashboard.widgets` de bestaande camelCase-sleutels uit `titleKey`/`descriptionKey`. Voeg daarnaast exact deze gedeelde groepen toe:

```json
{
  "categories": {
    "CORE_HR": "Kern HR",
    "EMPLOYMENT": "Dienstverband",
    "DOCUMENTS": "Documenten",
    "COMPENSATION": "Beloning",
    "ORGANIZATION_TIME": "Organisatie & tijd"
  },
  "visualizations": {
    "PROFILE": "Profiel", "KPI": "Kengetal", "TABLE": "Tabel", "PROGRESS": "Voortgang",
    "BAR": "Staafdiagram", "DONUT": "Verdeling", "LINE": "Lijngrafiek",
    "TIMELINE": "Tijdlijn", "CALENDAR": "Kalender"
  },
  "widths": { "HALF": "Half", "TWO_THIRDS": "Twee derde", "FULL": "Volledig" }
}
```

De Engelse structuur is exact gelijk met labels `Core HR`, `Employment`, `Documents`, `Compensation`, `Organization & time`, `Profile`, `Metric`, `Table`, `Progress`, `Bar chart`, `Distribution`, `Line chart`, `Timeline`, `Calendar`, `Half`, `Two thirds`, `Full`.

- [ ] **Step 5: Verifieer GREEN en i18n-pariteit**

Run:

- `npm.cmd test -w @liquid-hr/hr-suite -- lib/dashboard/widget-presentation.test.ts`
- `npm.cmd run check:i18n -w @liquid-hr/hr-suite`

Expected: beide commando's slagen.

- [ ] **Step 6: Commit**

```powershell
git add apps/hr-suite/lib/dashboard/widget-presentation.ts apps/hr-suite/lib/dashboard/widget-presentation.test.ts apps/hr-suite/lib/dashboard/widget-catalog.ts apps/hr-suite/messages/nl/dashboard.json apps/hr-suite/messages/en/dashboard.json apps/hr-suite/messages/nl/settings.json apps/hr-suite/messages/en/settings.json
git commit -m "feat: add translated dashboard widget metadata"
```

### Task 2: Eén geautoriseerde dashboard-readflow

**Files:**
- Create: `apps/hr-suite/lib/dashboard/widget-access.ts`
- Create: `apps/hr-suite/lib/dashboard/widget-access.test.ts`
- Create: `apps/hr-suite/lib/dashboard/widget-loaders.ts`
- Create: `apps/hr-suite/lib/dashboard/widget-loaders.test.ts`
- Modify: `apps/hr-suite/lib/dashboard/widget-settings-service.ts`
- Modify: `apps/hr-suite/lib/dashboard/service.ts`
- Modify: `apps/hr-suite/lib/auth/permissions.ts`

**Interfaces:**
- Consumes: één `AuthContext`, één Supabase SSR-client, widgetconfiguraties, roltoegang en catalogusmetadata.
- Produces: `DashboardRequestScope`, `DashboardBootstrap`, `DashboardWidgetData`, `createDashboardRequestScope()`, `getDashboardBootstrap(id?)`, `resolveVisibleWidgetTypes(...)` en `loadDashboardWidgetData(scope, widget)`.

- [ ] **Step 1: Schrijf falende access- en loadertests**

```ts
it('vereist enabled config, actieve rol en alle gewone permissions', () => {
  const visible = resolveVisibleWidgetTypes({
    configs: [{ widgetType: 'EXPIRING_CONTRACTS', isEnabled: true }],
    roleAccess: [{ widgetType: 'EXPIRING_CONTRACTS', roleId: 'hr' }],
    activeRoleIds: new Set(['hr']),
    permissions: new Set(['employee:read', 'contract:read']),
    entries: [getWidgetCatalogEntry('EXPIRING_CONTRACTS')!],
  })
  expect(visible).toEqual(new Set(['EXPIRING_CONTRACTS']))
})

it('vertaalt selfOnly permissions naar exacte selfrechten', () => {
  const visible = resolveVisibleWidgetTypes({
    configs: [{ widgetType: 'MY_SALARY_HISTORY', isEnabled: true }],
    roleAccess: [{ widgetType: 'MY_SALARY_HISTORY', roleId: 'employee' }],
    activeRoleIds: new Set(['employee']),
    permissions: new Set(['self:employee:read', 'self:salary:read']),
    entries: [getWidgetCatalogEntry('MY_SALARY_HISTORY')!],
  })
  expect(visible.has('MY_SALARY_HISTORY')).toBe(true)
})

it('retourneert een eerlijke lege staat voor een nog niet aangesloten loader', async () => {
  const result = await loadDashboardWidgetData(fixtureScope, fixtureWidget('MY_SALARY_HISTORY'))
  expect(result).toEqual({ status: 'empty', reason: 'DATA_SOURCE_PENDING' })
})
```

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd test -w @liquid-hr/hr-suite -- lib/dashboard/widget-access.test.ts lib/dashboard/widget-loaders.test.ts`

Expected: FAIL op de ontbrekende modules/exports.

- [ ] **Step 3: Maak de access-resolver puur en default-deny**

```ts
export interface WidgetAccessInput {
  configs: Array<{ widgetType: string; isEnabled: boolean }>
  roleAccess: Array<{ widgetType: string; roleId: string }>
  activeRoleIds: Set<string>
  permissions: Set<string>
  entries: readonly DashboardWidgetCatalogEntry[]
}

export function resolveVisibleWidgetTypes(input: WidgetAccessInput): Set<DashboardWidgetType> {
  // Alleen enabled + rolmatch + alle vereiste exacte permissions.
  // Bij selfOnly wordt iedere permission via toSelfPermission vertaald.
}
```

- [ ] **Step 4: Laat auth- en dashboardhelpers één client/context delen**

Breid `requireAuthContext` uit met een optionele bestaande client en laat `permissionCodesForRoleIds`/`roleCodesForRoleIds` diezelfde client gebruiken. Bouw daarna:

```ts
export interface DashboardRequestScope {
  context: AuthContext
  supabase: Awaited<ReturnType<typeof createClient>>
}

export async function createDashboardRequestScope(): Promise<DashboardRequestScope> {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  return { context, supabase }
}
```

`getDashboardBootstrap()` gebruikt deze scope voor dashboardlijst, geselecteerde layout, configs, role-access, actieve rollen en beschikbare catalogus. `listPersonalDashboards()` wordt niet nogmaals indirect aangeroepen.

- [ ] **Step 5: Implementeer typed loaderresultaten**

```ts
export type DashboardWidgetData =
  | { status: 'ready'; kind: 'welcome' }
  | { status: 'ready'; kind: 'metric'; value: number; href: string }
  | { status: 'empty'; reason: 'NO_DATA' | 'DATA_SOURCE_PENDING' }
  | { status: 'error'; code: 'WIDGET_LOAD_FAILED' }
```

Sluit `WELCOME`, `MY_REMINDERS`, `ORGANIZATION_OVERVIEW` en `EMPLOYEE_OVERVIEW` aan op hun bestaande betrouwbare bronnen. Andere catalogusentries krijgen `DATA_SOURCE_PENDING`; verwijder de huidige generieke employee-/department-/remindergrafiek omdat die inhoudelijk onjuist is.

- [ ] **Step 6: Verifieer GREEN en regressies**

Run:

- `npm.cmd test -w @liquid-hr/hr-suite -- lib/dashboard/widget-access.test.ts lib/dashboard/widget-loaders.test.ts lib/dashboard/service.test.ts`
- `npm.cmd run type-check -w @liquid-hr/hr-suite`

Expected: alle tests en type-check slagen.

- [ ] **Step 7: Commit**

```powershell
git add apps/hr-suite/lib/auth/permissions.ts apps/hr-suite/lib/dashboard/widget-access.ts apps/hr-suite/lib/dashboard/widget-access.test.ts apps/hr-suite/lib/dashboard/widget-loaders.ts apps/hr-suite/lib/dashboard/widget-loaders.test.ts apps/hr-suite/lib/dashboard/widget-settings-service.ts apps/hr-suite/lib/dashboard/service.ts apps/hr-suite/lib/dashboard/service.test.ts
git commit -m "perf: consolidate dashboard authorization and loading"
```

### Task 3: Gestreamde widgets, voortgang en refresh

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/dashboard/loading.tsx`
- Create: `apps/hr-suite/components/dashboard/dashboard-progress-model.ts`
- Create: `apps/hr-suite/components/dashboard/dashboard-progress-model.test.ts`
- Create: `apps/hr-suite/components/dashboard/dashboard-progress.tsx`
- Create: `apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx`
- Create: `apps/hr-suite/components/dashboard/widget-skeleton.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/hr-suite/components/dashboard/dashboard-workspace.tsx`
- Modify: `apps/hr-suite/components/dashboard/widget-renderer.tsx`

**Interfaces:**
- Consumes: `DashboardBootstrap`, parallel `Promise<DashboardWidgetData>[]` en vertaalde widgetpresentaties.
- Produces: stabiele servergestreamde widgetschillen, `DashboardProgressProvider`, `WidgetCompletionSignal`, `DashboardRefreshButton` en `DashboardWidgetStream`.

- [ ] **Step 1: Schrijf de falende voortgangstest**

```ts
it('telt ready, empty en error één keer en reset per generatie', () => {
  let state = createDashboardProgressState(3, 'initial')
  state = completeDashboardWidget(state, 'a', 'ready')
  state = completeDashboardWidget(state, 'b', 'empty')
  state = completeDashboardWidget(state, 'b', 'empty')
  state = completeDashboardWidget(state, 'c', 'error')
  expect(state.completed).toBe(3)
  expect(state.isComplete).toBe(true)
  expect(resetDashboardProgress(state, 'refresh-1').completed).toBe(0)
})
```

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd test -w @liquid-hr/hr-suite -- components/dashboard/dashboard-progress-model.test.ts`

Expected: FAIL omdat het model ontbreekt.

- [ ] **Step 3: Implementeer het pure progressmodel en de clientprovider**

De provider bewaart alleen `total`, unieke voltooide widget-ID's, foutaantal en `generation`. `WidgetCompletionSignal` meldt in `useEffect` exact één completion. De indicator gebruikt `role="status"` en toont `loadedProgress`, `updated` of `loadedWithErrors` uit `dashboard.json`.

- [ ] **Step 4: Bouw de serverstreaminggrenzen**

```tsx
const widgetPromises = bootstrap.view.widgets.map((widget) => ({
  widget,
  data: loadDashboardWidgetData(bootstrap.scope, widget),
}))

return (
  <DashboardProgressProvider generation={refreshKey} total={widgetPromises.length}>
    <DashboardWorkspace initialData={bootstrap.publicView}>
      {widgetPromises.map(({ widget, data }) => (
        <Suspense fallback={<WidgetSkeleton widget={widget} />} key={`${refreshKey}:${widget.id}`}>
          <DashboardWidgetStream data={data} widget={widget} />
        </Suspense>
      ))}
    </DashboardWorkspace>
  </DashboardProgressProvider>
)
```

`DashboardWidgetStream` vangt loadererrors lokaal af, rendert `DashboardWidgetRenderer` met typed data en plaatst daarna `WidgetCompletionSignal`.

- [ ] **Step 5: Verwijder de client-only eerste fetch**

`DashboardWorkspace` ontvangt `initialData` en rendert direct. Verwijder `useEffect`, `setTimeout`, `isLoading` en de initiële `fetch('/api/dashboards')`. Dashboardwisselen en mutaties gebruiken `router.push`/`router.refresh` zodat de server opnieuw de bron van waarheid rendert.

- [ ] **Step 6: Voeg refresh zonder layoutmutatie toe**

`DashboardRefreshButton` zet een nieuwe `refresh`-generatie in de URL met `router.replace`, behoudt `id`, en disablet zichzelf totdat de progressprovider compleet meldt. De serverloaders gebruiken `noStore()`/de lokale Next.js 16-equivalent. Er wordt geen PUT/PATCH/POST uitgevoerd.

- [ ] **Step 7: Verifieer GREEN en buildgedrag**

Run:

- `npm.cmd test -w @liquid-hr/hr-suite -- components/dashboard/dashboard-progress-model.test.ts`
- `npm.cmd run type-check -w @liquid-hr/hr-suite`
- `npm.cmd run build -w @liquid-hr/hr-suite`

Expected: test, type-check en build slagen; `/dashboard` heeft een route-level loading fallback.

- [ ] **Step 8: Commit**

```powershell
git add apps/hr-suite/app/'(dashboard)'/dashboard apps/hr-suite/components/dashboard/dashboard-progress-model.ts apps/hr-suite/components/dashboard/dashboard-progress-model.test.ts apps/hr-suite/components/dashboard/dashboard-progress.tsx apps/hr-suite/components/dashboard/dashboard-widget-stream.tsx apps/hr-suite/components/dashboard/widget-skeleton.tsx apps/hr-suite/components/dashboard/dashboard-workspace.tsx apps/hr-suite/components/dashboard/widget-renderer.tsx
git commit -m "feat: stream dashboard widgets with progress and refresh"
```

### Task 4: Gecategoriseerde widgetkiezer en begrijpelijke editor

**Files:**
- Create: `apps/hr-suite/components/dashboard/widget-picker-model.ts`
- Create: `apps/hr-suite/components/dashboard/widget-picker-model.test.ts`
- Create: `apps/hr-suite/components/dashboard/widget-picker-dialog.tsx`
- Modify: `apps/hr-suite/components/dashboard/dashboard-editor.tsx`
- Modify: `apps/hr-suite/components/dashboard/dashboard-workspace.tsx`
- Modify: `apps/hr-suite/components/dashboard/dashboard-workspace-model.ts`
- Modify: `apps/hr-suite/components/dashboard/dashboard-workspace-model.test.ts`

**Interfaces:**
- Consumes: `DashboardWidgetPresentation[]`, beschikbare types en lokale conceptwidgets.
- Produces: `filterWidgetPresentations(...)`, `groupWidgetPresentations(...)`, `WidgetPickerDialog` en een editor die uitsluitend vertaalde metadata toont.

- [ ] **Step 1: Schrijf falende picker- en conceptstatetests**

```ts
it('zoekt titel en omschrijving hoofdletterongevoelig en behoudt categorievolgorde', () => {
  const result = filterWidgetPresentations(fixtures, { query: 'contract', category: 'EMPLOYMENT' })
  expect(result.map((item) => item.type)).toEqual(['MY_CONTRACT_DETAILS', 'EXPIRING_CONTRACTS'])
})

it('voegt een widget met standaardbreedte alleen aan het concept toe', () => {
  const persisted = [fixtureWidget('WELCOME')]
  const next = addWidgetToDraft(persisted, fixturePresentation('MY_SALARY_HISTORY', 'TWO_THIRDS'))
  expect(next[1].settings.width).toBe('TWO_THIRDS')
  expect(persisted).toHaveLength(1)
})
```

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd test -w @liquid-hr/hr-suite -- components/dashboard/widget-picker-model.test.ts components/dashboard/dashboard-workspace-model.test.ts`

Expected: FAIL op ontbrekende exports.

- [ ] **Step 3: Implementeer pure filter-, groep- en addfuncties**

Normaliseer zoektekst met `toLocaleLowerCase(locale)`, filter op titel/omschrijving, sorteer eerst via `dashboardCategoryOrder` en daarna op titel. `addWidgetToDraft` gebruikt `presentation.defaultWidth` en muteert de invoer niet.

- [ ] **Step 4: Bouw de toegankelijke dialog**

De dialog bevat een gelabeld zoekveld, vijf categorietabs, kaarten met titel/omschrijving/visualisatie/standaardbreedte, status `alreadyAdded`, knop `add`, lege staat en `done`. Escape, backdrop en sluitknop sluiten de dialog; focus start in het zoekveld.

- [ ] **Step 5: Vervang technische codes in de editor**

`DashboardEditor` toont `presentation.title` voor bestaande conceptwidgets. De inline knoppenlijst verdwijnt volledig. Toevoegen blijft lokaal tot de bestaande expliciete Opslaan-knop wordt gebruikt.

- [ ] **Step 6: Verifieer GREEN, i18n en type-check**

Run:

- `npm.cmd test -w @liquid-hr/hr-suite -- components/dashboard/widget-picker-model.test.ts components/dashboard/dashboard-workspace-model.test.ts`
- `npm.cmd run check:i18n -w @liquid-hr/hr-suite`
- `npm.cmd run type-check -w @liquid-hr/hr-suite`

Expected: alle commando's slagen.

- [ ] **Step 7: Commit**

```powershell
git add apps/hr-suite/components/dashboard/widget-picker-model.ts apps/hr-suite/components/dashboard/widget-picker-model.test.ts apps/hr-suite/components/dashboard/widget-picker-dialog.tsx apps/hr-suite/components/dashboard/dashboard-editor.tsx apps/hr-suite/components/dashboard/dashboard-workspace.tsx apps/hr-suite/components/dashboard/dashboard-workspace-model.ts apps/hr-suite/components/dashboard/dashboard-workspace-model.test.ts
git commit -m "feat: add categorized dashboard widget picker"
```

### Task 5: HR-admin widgetbeheer en medewerker-pop-up

**Files:**
- Create: `apps/hr-suite/components/settings/employee-settings-placeholder-dialog.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/settings/page.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/settings/dashboard-widgets/page.tsx`
- Modify: `apps/hr-suite/components/settings/dashboard-widget-settings-form.tsx`
- Modify: `apps/hr-suite/lib/dashboard/widget-settings-service.ts`
- Modify: `apps/hr-suite/app/api/settings/dashboard-widgets/route.ts`
- Modify: `apps/hr-suite/messages/nl/settings.json`
- Modify: `apps/hr-suite/messages/en/settings.json`

**Interfaces:**
- Consumes: bestaande `dashboard_widget_configs`, `dashboard_widget_role_access`, `dashboard-widget:write` en `DashboardWidgetPresentation`.
- Produces: niet-navigerende medewerkerskaart, tijdelijke toegankelijke dialog en volledig vertaalde HR-adminwidgetkaarten met actief/inactief en roltoegang.

- [ ] **Step 1: Schrijf eerst falende service-/routevalidatietests**

Voeg `widget-settings-service.test.ts` en een pure inputhelper toe met deze verwachtingen:

```ts
expect(dashboardWidgetSettingUpdateSchema.safeParse({
  widgetType: 'EXPIRING_CONTRACTS', isEnabled: true, roleIds: ['geen-uuid'],
}).success).toBe(false)

expect(dashboardWidgetSettingUpdateSchema.safeParse({
  widgetType: 'EXPIRING_CONTRACTS', isEnabled: false, roleIds: [],
}).success).toBe(true)
```

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd test -w @liquid-hr/hr-suite -- lib/dashboard/widget-settings-service.test.ts`

Expected: FAIL omdat het updateschema ontbreekt.

- [ ] **Step 3: Valideer de API met Zod en behoud serverautoriteit**

Maak `dashboardWidgetSettingUpdateSchema` met een bekend catalogustype, boolean en unieke UUID-roleIds. De route gebruikt `safeParse`; de service controleert opnieuw dat alle rollen globaal of binnen dezelfde tenant bestaan. `requirePermission('dashboard-widget:write')` en RLS blijven verplicht.

- [ ] **Step 4: Lever vertaalde metadata aan de beheerpagina**

Vervang de lege `widgetNames` en `widgetDescriptions` door `DashboardWidgetPresentation`. Toon categorie, visualisatie, actieve status en rolchips zonder fallback naar `widget.type` of `descriptionKey`. Bij een mislukte optimistic update wordt de lokale vorige toestand hersteld.

- [ ] **Step 5: Bouw de medewerkerplaceholderdialog**

Vervang uitsluitend de `/settings`-tegel **Medewerkers** door een button die `EmployeeSettingsPlaceholderDialog` opent. De dialog toont `employeeSettings.title`, `employeeSettings.description`, `comingSoon` en `close`; de hoofdnavigatie naar `/employees` blijft ongewijzigd.

- [ ] **Step 6: Verifieer GREEN, i18n en type-check**

Run:

- `npm.cmd test -w @liquid-hr/hr-suite -- lib/dashboard/widget-settings-service.test.ts`
- `npm.cmd run check:i18n -w @liquid-hr/hr-suite`
- `npm.cmd run type-check -w @liquid-hr/hr-suite`

Expected: alle commando's slagen.

- [ ] **Step 7: Commit**

```powershell
git add apps/hr-suite/components/settings/employee-settings-placeholder-dialog.tsx apps/hr-suite/app/'(dashboard)'/settings/page.tsx apps/hr-suite/app/'(dashboard)'/settings/dashboard-widgets/page.tsx apps/hr-suite/components/settings/dashboard-widget-settings-form.tsx apps/hr-suite/lib/dashboard/widget-settings-service.ts apps/hr-suite/lib/dashboard/widget-settings-service.test.ts apps/hr-suite/app/api/settings/dashboard-widgets/route.ts apps/hr-suite/messages/nl/settings.json apps/hr-suite/messages/en/settings.json
git commit -m "feat: improve hr dashboard and employee settings"
```

### Task 6: Documentatie, versie en volledige verificatie

**Files:**
- Modify: `apps/hr-suite/lib/app-version.ts`
- Modify: `apps/hr-suite/lib/app-version.test.ts`
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `docs/requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`

**Interfaces:**
- Produces: actuele releaseversie, blijvende status en bewijs van lokale plus publieke verificatie.

- [ ] **Step 1: Bepaal de volgende versie en wijzig eerst de versietest**

Lees de huidige `APP_VERSION`, verhoog alleen het patchdeel met één en pas uitsluitend de testverwachting aan.

Run: `npm.cmd test -w @liquid-hr/hr-suite -- lib/app-version.test.ts`

Expected: FAIL met de oude versie als ontvangen waarde.

- [ ] **Step 2: Wijzig `APP_VERSION` en verifieer GREEN**

Run: `npm.cmd test -w @liquid-hr/hr-suite -- lib/app-version.test.ts`

Expected: PASS.

- [ ] **Step 3: Werk de blijvende documentatie bij**

Leg vast: medewerkertegel opent tijdelijke pop-up; widgetbeheer ondersteunt actief/inactief en rollen; widgetkiezer is vertaald/gecategoriseerd; dashboard gebruikt serverbootstrap, afzonderlijke streaminggrenzen, globale voortgang en handmatige refresh. Noteer expliciet dat echte loaders voor overige cataloguswidgets nog afzonderlijk werk zijn en dat zij nu geen fictieve cijfers tonen.

- [ ] **Step 4: Draai de volledige geautomatiseerde gate**

Run:

- `npm.cmd test -w @liquid-hr/hr-suite`
- `npm.cmd run check:i18n -w @liquid-hr/hr-suite`
- `npm.cmd run type-check -w @liquid-hr/hr-suite`
- `npm.cmd run lint -w @liquid-hr/hr-suite`
- `npm.cmd run build -w @liquid-hr/hr-suite`

Expected: alle commando's exitcode 0, zonder nieuwe warnings of errors.

- [ ] **Step 5: Valideer localhost:3000 in een echte browser**

Controleer ingelogd op desktop en 390px:

1. `/settings`: Medewerkers opent de pop-up en de linkernavigatie opent nog `/employees`.
2. `/settings/dashboard-widgets`: categorieën, vertaalde titels, actief/inactief en rolkeuzes werken.
3. `/dashboard`: contouren verschijnen direct; widgets voltooien afzonderlijk; algemene teller eindigt ook bij één geforceerde fout.
4. Vernieuwen herstart de teller en verandert de opgeslagen indeling niet.
5. Bewerken opent de zoekbare widgetdialog; nergens verschijnt `EXPIRING_CONTRACTS`, `MY_SALARY_HISTORY` of een andere technische code.
6. Geen horizontale overflow op 390px.

- [ ] **Step 6: Verifieer publieke preview**

Push de branch, wacht tot de preview `READY` is en controleer login/redirect plus alle beschermde flows met een geldige hostspecifieke sessie. Als zo'n sessie ontbreekt, rapporteer die beperking expliciet en claim geen beschermde end-to-endcontrole.

- [ ] **Step 7: Commit release en documentatie**

```powershell
git add apps/hr-suite/lib/app-version.ts apps/hr-suite/lib/app-version.test.ts docs/README.md docs/delivery/IMPLEMENTATION_STATUS.md docs/delivery/CURRENT_CONTEXT.md docs/requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md
git commit -m "release: dashboard experience improvements"
```

## Plan self-review

- Alle onderdelen uit het goedgekeurde ontwerp zijn toegewezen aan Tasks 1–6.
- De performanceoorzaak wordt bij de bron opgelost: geen client-only eerste fetch, geen herhaalde permissionloop per widget en geen dubbele dashboardlijst in dezelfde readflow.
- De UI gebruikt uitsluitend metadata uit taalbestanden; ruwe codes zijn alleen identifiers.
- Refresh is een readactie en kan geen opgeslagen configuratie wijzigen.
- Niet-aangesloten loaders tonen een expliciete lege staat; zij hergebruiken geen onjuiste generieke cijfers.
- Nieuwe functies en modellen hebben een vooraf falende test; browsergedrag wordt aanvullend end-to-end gecontroleerd.
