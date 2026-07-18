# Autorisatieoverzicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak autorisatiebeheer snel scanbaar met een gegroepeerde rechteneditor, grafische dekkingsmatrix en gescheiden organisatietoewijzingen, en publiceer versie `1.20260718.2`.

**Architecture:** De bestaande Supabase-tabellen en API blijven de enige autorisatiebron. Een pure TypeScript-presentatielaag berekent tellingen en heatmapwaarden; de Server Component levert beveiligde data en de Client Component beheert alleen URL-/conceptstate en mutatieaanroepen.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Tailwind v4, Supabase SSR/RLS, Vitest, NL/EN-i18n, Vercel.

## Global Constraints

- Geen nieuw databaseschema of nieuwe autorisatiebeslissing in de client.
- `authorization:read`, `authorization:write`, API-validatie en RLS blijven leidend.
- Systeemrollen zijn zichtbaar maar niet wijzigbaar.
- Geen hardcoded kleuren of zichtbare componenttekst; gebruik CSS-tokens en paritaire taalbestanden.
- URL-state bepaalt het actieve tabblad; mobiel mag geen horizontale pagina-overflow hebben.
- Gebruikerswijzigingen in `docs/delivery/HANDMATIGE_ACTIES.md` en `package-lock.json` niet meenemen of overschrijven.

---

### Task 1: Geteste presentatielaag voor rechtenoverzicht

**Files:**
- Create: `apps/hr-suite/lib/organization/authorization-view.ts`
- Create: `apps/hr-suite/lib/organization/authorization-view.test.ts`

**Interfaces:**
- Consumes: `management_roles`, `permissions` en `role_permissions` rows uit `@scope/db`.
- Produces: `buildAuthorizationOverview(...)`, `permissionCoverage(...)` en `togglePermissionGroup(...)` met strict getypeerde resultaten voor UI en heatmap.

- [ ] **Step 1: Write failing tests for role counts, category coverage and group toggling**

```ts
expect(buildAuthorizationOverview(fixture).assignedPermissionCount).toBe(3)
expect(permissionCoverage(['p1'], ['p1', 'p2'])).toEqual({ assigned: 1, total: 2, percentage: 50 })
expect(togglePermissionGroup(new Set(['p1']), ['p1', 'p2'])).toEqual(new Set(['p1', 'p2']))
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -w @liquid-hr/hr-suite -- lib/organization/authorization-view.test.ts`
Expected: FAIL because `authorization-view.ts` does not exist.

- [ ] **Step 3: Implement pure deterministic helpers**

Implement category grouping with stable labels, unique assignment counting, integer percentages, all-on/all-off group toggling and no mutation of input sets.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -w @liquid-hr/hr-suite -- lib/organization/authorization-view.test.ts`
Expected: all focused tests pass.

- [ ] **Step 5: Commit the presentatielaag**

Commit: `feat: add authorization overview model`

### Task 2: Bouw de overzichtelijke rechtenwerkruimte

**Files:**
- Modify: `apps/hr-suite/app/(dashboard)/authorization/page.tsx`
- Modify: `apps/hr-suite/components/organization/authorization-manager.tsx`
- Modify: `apps/hr-suite/messages/nl/organization.json`
- Modify: `apps/hr-suite/messages/en/organization.json`

**Interfaces:**
- Consumes: helpers uit Task 1 en bestaande `/api/roles`, `/api/roles/[roleId]/permissions`, `/api/organization/placements` en `/api/organization/management-assignments`.
- Produces: tabbladen `permissions`, `overview`, `assignments`; zoekbare rollenlijst; grouped editor; toegankelijke heatmap; gescheiden toewijzingsformulieren.

- [ ] **Step 1: Add failing component/source assertions**

Breid `authorization-view.test.ts` uit met tabnormalisatie en dirty-statevergelijking:

```ts
expect(normalizeAuthorizationTab('overview')).toBe('overview')
expect(normalizeAuthorizationTab('unknown')).toBe('permissions')
expect(permissionSelectionChanged(new Set(['a']), new Set(['a', 'b']))).toBe(true)
```

- [ ] **Step 2: Verify RED for the new view-state API**

Run: `npm test -w @liquid-hr/hr-suite -- lib/organization/authorization-view.test.ts`
Expected: FAIL because the new exports are absent.

- [ ] **Step 3: Implement view-state helpers and responsive UI**

Gebruik `useSearchParams`/`router.replace` voor tabstate, een sticky savebar met herstellen, `aria-pressed` voor tabs/groepen en tekstwaarden naast iedere heatmapkleur. Behoud bestaande API-payloads exact.

- [ ] **Step 4: Add all NL and EN keys with equal structure**

Voeg sleutels toe voor kengetallen, tabs, zoeken, dekking, select-all/clear, dirty-state, scope-uitleg en heatmapbediening. Componenten bevatten geen fallbackvertalingen.

- [ ] **Step 5: Run focused tests, i18n and type-check**

Run:
- `npm test -w @liquid-hr/hr-suite -- lib/organization/authorization-view.test.ts`
- `npm run check:i18n -w @liquid-hr/hr-suite`
- `npm run type-check -w @liquid-hr/hr-suite`

Expected: alle commando's exit 0.

- [ ] **Step 6: Commit the UI slice**

Commit: `feat: redesign authorization workspace`

### Task 3: Versie, abonnementsbeperking en overdracht

**Files:**
- Modify: `apps/hr-suite/lib/app-version.ts`
- Modify: `apps/hr-suite/lib/app-version.test.ts`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/requirements/authorization/AUTORISATIE_EN_RECHTEN.md`
- Modify: `docs/README.md`

**Interfaces:**
- Produces: applicatieversie `1.20260718.2` en actuele blijvende documentatie.

- [ ] **Step 1: Change the version test first and verify RED**

Wijzig de verwachting naar `1.20260718.2`; run `npm test -w @liquid-hr/hr-suite -- lib/app-version.test.ts`.
Expected: FAIL met ontvangen versie `1.20260718.1`.

- [ ] **Step 2: Bump the application version and verify GREEN**

Wijzig `APP_VERSION` naar `1.20260718.2` en herhaal de test.
Expected: 2 tests pass.

- [ ] **Step 3: Update durable documentation**

Documenteer het grafische overzicht en leg vast dat leaked-password protection in het huidige abonnement niet beschikbaar is en daarom geen uitvoerbare open actie is. Verwijder of overschrijf het gebruikerbestand `HANDMATIGE_ACTIES.md` niet.

- [ ] **Step 4: Commit documentation and version**

Commit: `docs: release authorization overview 1.20260718.2`

### Task 4: Volledige verificatie en deployment

**Files:**
- Verify only; generated `apps/hr-suite/next-env.d.ts` must not remain changed.

**Interfaces:**
- Produces: geverifieerde lokale build, publieke preview en productie-uitrol.

- [ ] **Step 1: Run the complete automated gate**

Run:
- `npm test -w @liquid-hr/hr-suite`
- `npm run check:i18n -w @liquid-hr/hr-suite`
- `npm run type-check -w @liquid-hr/hr-suite`
- `npm run lint -w @liquid-hr/hr-suite`
- `npm run build -w @liquid-hr/hr-suite`

Expected: alle suites slagen zonder fouten.

- [ ] **Step 2: Validate localhost:3000**

Controleer desktop en 390px: tabnavigatie, rollen zoeken, groepselectie, dirty/herstel, heatmap-drilldown en geen horizontale overflow. Zonder geldige sessie moeten `/authorization` en de API veilig naar login/401-403 leiden.

- [ ] **Step 3: Push and validate branch preview**

Push de featurebranch, wacht tot Vercel `READY` meldt en controleer login plus beschermde redirect. Gebruik een bestaande geldige sessie alleen wanneer die voor dezelfde host beschikbaar is.

- [ ] **Step 4: Integrate and deploy production**

Integreer de geverifieerde commits in `main` zonder de twee gebruikerswijzigingen mee te nemen, push `main`, wacht op Vercel `READY` en controleer de productie-URL.

- [ ] **Step 5: Record final evidence**

Werk `CURRENT_CONTEXT.md` alleen bij wanneer deploymentgegevens afwijken van Task 3, commit/push die correctie en bevestig dat de oorspronkelijke werkboom uitsluitend de twee bewaarde gebruikerswijzigingen toont.
