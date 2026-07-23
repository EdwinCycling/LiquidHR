# BLUEPRINT.md — Architectuur-blauwdruk (How-to-Replicate)

> Doel: dit document geeft je genoeg om in een leeg project exact dezelfde technische fundering neer te zetten als de AI-Superworker-codebase — folderstructuur, stack, Supabase-patronen, data-architectuur, auth, forms, API-design en codeerstijl. Business-logica (boekhouding, CRM, etc.) is bewust weggelaten; dit is de "DNA"-laag.

---

## 1. Projectstructuur

Monorepo met npm workspaces. Root:

```
repo-root/
├── apps/
│   ├── <app-a>/            ← Next.js app, eigen package.json, eigen poort
│   └── <app-b>/            ← tweede Next.js app, deelt dezelfde Supabase-backend
├── packages/
│   └── db/                 ← gedeelde Supabase TypeScript types (@scope/db)
├── docs/                   ← scope, architectuur, ADR's, FDR's, journal
└── apps/<app-a>/supabase/migrations/   ← gedeelde DB-migraties (één bron van waarheid)
```

Root `package.json` heeft geen eigen dependencies buiten `husky`; het is puur een workspace-orchestrator:

```json
{
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w <app-a>",
    "build": "npm run build --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "type-check": "npm run type-check --workspaces --if-present",
    "migrate": "npm run migrate -w <app-a>"
  }
}
```

Binnen een app (`apps/<app-a>/`):

```
app/
  (dashboard)/          ← route group: alles achter auth, per module een submap
  api/                  ← REST endpoints, één route.ts per resource
  api/cron/             ← cron-handlers (aangestuurd door externe scheduler, zie §Async)
  auth/                 ← login/callback routes
  login/                ← publieke login-pagina
  layout.tsx, page.tsx, globals.css, error.tsx, global-error.tsx
components/
  ui/                   ← shadcn/ui primitives + eigen atomen (button, card, stat-card, page-state, segmented-filter)
  layout/                ← sidebar, topbar, switchers (tenant/context)
  <module>/              ← per functioneel domein een submap (bv. crm/, support/, sales/)
lib/
  supabase/              ← client.ts (browser), server.ts (server components/actions), admin.ts (service-role)
  auth/                  ← permissions, roles, scope-resolvers, audit
  <module>/              ← business logic per domein, puur TypeScript, geen JSX
  i18n/                  ← locale-helpers
  hooks/                 ← gedeelde custom hooks
  utils.ts, labels.ts, logger.ts   ← generieke helpers
messages/
  nl/<namespace>.json    ← vertalingen per namespace
  en/<namespace>.json
scripts/                 ← migratie-runner, build-check, deploy-check, CI-achtige guard-scripts
supabase/migrations/     ← SQL-migraties, timestamp-prefixed
tests/                   ← integratietests (naast co-located *.test.ts bij de code zelf)
```

**Regel:** types staan niet in een aparte `types/`-map maar co-located: gegenereerde Supabase-types in `packages/db/types.ts` (gedeeld tussen apps via `@scope/db`), verder module-specifieke types gewoon bovenin het bestand dat ze gebruikt of in een `types.ts` naast de module in `lib/<module>/`.

**Regel:** hooks staan in `lib/hooks/` (gedeeld) of lokaal naast de component die ze nodig heeft — geen aparte `hooks/`-root buiten `lib/`.

**Regel:** volgorde bij elke feature is altijd **schema → API route → UI**. Nooit andersom — een tabel zonder RLS-policy of een route zonder validatie wordt niet gebouwd "voor nu even snel".

---

## 2. Tech Stack & Configuratie

| Laag | Keuze |
|---|---|
| Framework | Next.js (App Router), meest recente major — **let op**: elke nieuwe major versie kan breaking changes t.o.v. trainingsdata hebben; altijd de lokale `node_modules/next/dist/docs` checken voordat je op geheugen codeert |
| Taal | TypeScript, strict, **geen `any`** |
| Styling | Tailwind (laatste major) + shadcn/ui componenten-generator |
| DB + Auth | Eén gedeeld Supabase-project (Postgres + Auth + Storage + RLS) |
| AI | Eén provider-agnostische AI-SDK-laag (bv. Vercel AI SDK) + één model-provider; modellen centraal gedefinieerd in een `MODELS`-object, nooit hardcoded string-literals door de codebase heen |
| E-mail | Eén transactionele e-mail-provider (in-app afzenderdomein met SPF/DKIM) |
| Deployment | Eén hostingplatform per app (Vercel-stijl), root-directory per app, push-naar-main = auto-deploy |
| i18n | Cookie-based locale-library (geen URL-prefix in de suite-apps), NL default + EN |

### Styling-opzet voor consistente UI

`globals.css` is de **enige plek** waar hexwaarden/kleuren staan. Patroon:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@theme inline {
  /* koppel elke Tailwind-kleurtoken aan een CSS-var */
  --color-background: var(--background);
  --color-primary: var(--primary);
  --radius-lg: var(--radius);
  /* etc. */
}

:root {
  --background: #f3f4f8;
  --foreground: #0f172a;
  --primary: #14264a;      /* merkkleur, actieknoppen */
  --accent: #f2f5fc;
  --accent-foreground: #2757d6;
  --border: #e8edf2;
  --radius: 0.625rem;
  --sidebar: #0a1b3d;       /* aparte kleurset voor de sidebar, donker */
  /* chart-1..5, custom domein-tokens (bv. status-kleuren) hier ook */
}

.dark {
  /* zelfde tokens, dark-variant */
}
```

Merk-remap-truc: als je een consistente merkkleur wil die overal via bestaande Tailwind-klassen (`indigo-500` etc.) werkt zonder duizend classNamen te hoeven vervangen, remap je in `@theme inline` de hele `indigo-*`-schaal naar je eigen CSS-vars. Zo blijft `bg-indigo-600` overal werken maar toont het je merkblauw.

**Regel:** nooit een hex-waarde in een component. Altijd een Tailwind-token of CSS-var uit `globals.css`.

---

## 3. Supabase Integratie

Drie client-varianten, elk met een duidelijk gebruiksdoel:

```ts
// lib/supabase/server.ts — server components / server actions, respecteert RLS via de ingelogde user
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* server component: cookies worden via middleware gezet */ }
        },
      },
    }
  )
}
```

```ts
// lib/supabase/client.ts — browser client (client components), ook RLS-scoped
// lib/supabase/admin.ts — service-role client, ALLEEN in API routes na expliciete autorisatie-check,
//                          NOOIT client-side geïmporteerd
```

**Types genereren:** via Supabase MCP/CLI (`generate_typescript_types`) naar `packages/db/types.ts`, geïmporteerd als `@scope/db` door beide apps. Na elke schema-wijziging opnieuw genereren — types zijn altijd de afgeleide, nooit de bron van waarheid.

**RLS-patronen:**
1. Elke nieuwe tabel: `ENABLE ROW LEVEL SECURITY` + minstens één `CREATE POLICY` **in dezelfde migratie**.
2. Tabel zonder eigen `tenant_id`-kolom → policy via een `JOIN`/`EXISTS` op de parent-tabel die wél `tenant_id` heeft.
3. Autorisatie-functies leven in een **apart schema** (bv. `internal_security`), nooit in `public` (voorkomt RPC-enumeratie door anon-rol). Altijd `SECURITY DEFINER` + `SET search_path = public, pg_temp`.
4. Geen `EXECUTE`-grant aan `PUBLIC`/`anon` op interne functies.
5. Na elke migratie: security-advisor van de Supabase-tooling draaien en alles oplossen vóór commit.
6. Voorbeeld helper-patroon: `user_has_<resource>_access(resource_id, min_role)` als herbruikbare RLS-functie in plaats van dezelfde JOIN-logica in elke policy te herhalen.

**Auth:** magic link (Supabase Auth), geen wachtwoorden. Eén gebruiker kan lidmaatschap hebben in meerdere tenants; een membership-resolver bepaalt na login wat zichtbaar is.

---

## 4. Data-architectuur Patronen

**Geen React Query/SWR** — het patroon is server-gedreven fetching + gerichte client-fetches, geen globale client-cache-laag. Lijstpagina's zijn server-rendered met query-params voor filter/sort/paginatie; de client rendert precies één pagina resultaten.

**Standaard CRUD-route (GET-voorbeeld):**

```ts
// app/api/<resource>/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, permissionErrorResponse, type AuthContext } from '@/lib/auth/permissions'

export async function GET() {
  let ctx: AuthContext
  try { ctx = await requirePermission('admin.users') }
  catch (err) { const r = permissionErrorResponse(err); if (r) return r; throw err }

  const { data, error } = await createAdminClient()
    .from('resource_table')
    .select('id, name, is_active')
    .eq('tenant_id', ctx.tenantId)
    .order('name', { ascending: true })
    .limit(200) // NOOIT .select() zonder limit/range op groeiende tabellen

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data ?? [] })
}
```

Kernregels:
- **Nooit** `.select()` zonder `.limit()`/`.range()` op tabellen die kunnen groeien — de DB-laag kapt anders stil af, wat als correcte (maar foute) data oogt.
- **Aggregatie (som/telling/groepering) in Postgres**, niet client-side over opgehaalde rijen — via een `rpt_*`-achtige RPC (`STABLE`, alleen `service_role`-execute, autorisatie route-side).
- Niet-lineaire berekeningen (afronding per regel, etc.) blijven in een geteste TypeScript-calc-laag; de RPC mag alleen platslaan/filteren.
- Per-regel loops met awaited queries altijd batchen (`.in()` + `Promise.all` of chunks) — nooit een query per item in een for-loop.
- Elke nieuwe query-vorm krijgt een passende index in dezelfde migratie.

**Async werk (mail, imports, etc.):** één generieke job-queue-tabel (bv. `workflow_jobs`), gedraind door een externe scheduler (bv. Postgres-cron die een cron-endpoint met een secret aanroept) — géén platform-cron met beperkte frequentie voor queue-werk. Snelle paden draaien de queue direct in-process leeg na de trigger (`after(() => drainQueue())`), de externe scheduler is het vangnet voor retries. Eén queue voor alle kanalen; een nieuw kanaal = nieuwe adapter + job-type, geen nieuwe infra.

---

## 5. Performance-architectuur voor navigatie en tabs

Medewerkerslijst, medewerkerdetail en dienstverbanddetail zijn navigatie-intensieve schermen. Nieuwe schermen en tabs volgen daarom deze vaste regels:

- **Meetbare budgetten:** voeg voor iedere nieuwe route of tab een gerichte navigatiemeting toe. Als startbudget geldt p75 maximaal 1.500 ms voor een eerste detailroute en maximaal 1.000 ms voor een warme tabwissel. Een afwijking is alleen acceptabel wanneer de dataset of beveiligingscontrole aantoonbaar zwaarder is en de afwijking in `CURRENT_CONTEXT.md` wordt vastgelegd.
- **Tabgericht laden:** laad alleen de projectie voor de actieve tab. Gedeelde shellgegevens (naam, identificatie, toegestane navigatie en context) blijven klein; persoonlijke, salaris-, historie- en dossiergegevens worden niet op inactieve tabs opgehaald.
- **Eén leesgrens per projectie:** maak per scherm een getypeerde serverservice die de benodigde projectie leest. Herhaal geen permission-, context- of databaselezing vanuit losse UI-componenten wanneer de pagina die context al heeft.
- **Parallel waar onafhankelijk:** start onafhankelijke autorisatie- en datalezingen samen met `Promise.all`. Gebruik geen seriële `await`-keten voor queries die elkaar niet nodig hebben. Batch kinddata en begrens iedere groeiende query met `limit`/`range`.
- **Geen globale clientcache:** gebruik Server Components, URL-state en route-segment loading states. Prefetch alleen gericht en na meting; zet geen hoog-cardinaliteit medewerkerlinks collectief aan.
- **Perceptie hoort bij het contract:** iedere detailroute heeft een compacte skeleton/loading state die de uiteindelijke layout benadert. Dit vervangt geen backendmeting, maar voorkomt dat een serverrender als een stilstaand scherm wordt ervaren.
- **Regressiebewijs:** een wijziging aan een bestaande projectie bevat minimaal een gerichte type-/lintcontrole en een route- of browsermeting van de gewijzigde keten. Herhaal de volledige releasegate bij releasevoorbereiding of wijzigingen aan gedeelde infrastructuur, auth, routing, schema/RLS of kritieke businesslogica.

Deze regels behouden de vaste bouwvolgorde **schema → API/service → UI**. Een snellere route mag nooit autorisatie of RLS overslaan; een RPC of samengestelde query is alleen toegestaan wanneer de projectie en scope server-side en database-side controleerbaar blijven. Zie ADR-0004 voor de concrete navigatiebesluiten en het meetprotocol.

## 6. Autorisatie & Authenticatie

- **Auth-methode:** magic link via Supabase Auth (geen wachtwoorden).
- **Sessie:** cookie-based via `@supabase/ssr`, domain-aware (custom cookie-domain-helper voor subdomein-scenario's zoals een whitelabel-portaal).
- **Multi-tenant model:** gebruiker ↔ tenant ↔ resource via een access-tabel met een rol-enum (bv. `owner`/`editor`/`reviewer`/`contributor`/`viewer`). Geen aparte "modi" in de UI — zichtbare menu's/acties zijn puur een functie van de rechten van de ingelogde gebruiker in de **huidige** tenant.
- **Route-bescherming:** een centrale `proxy.ts` (of middleware) resolvet per request welke tenant/context van toepassing is (inclusief subdomein-rewrite voor whitelabel), zonder netwerk-round-trips per request — auth-claims worden lokaal gelezen (`getClaims()`-achtig patroon), niet bij elke request opnieuw tegen de DB gevalideerd.
- **API-autorisatie:** een centrale `requirePermission(permissionKey)`-helper in `lib/auth/permissions.ts` die een `AuthContext` teruggeeft (tenantId, userId, rol) of een typed error gooit; elke route begint hiermee. Een bijbehorende `permissionErrorResponse(err)` zet de error om naar een consistente HTTP-response.
- **Audit:** elke mutatie (door mens of AI) loopt door één centrale `writeAudit()`-functie.

---

## 7. UI/UX Componenten & Formulieren

- **Component-tiers:** `components/ui/` voor generieke atomen (button, input, card, stat-card, page-state, segmented-filter — shadcn-gegenereerd + eigen toevoegingen), `components/<module>/` voor samengestelde, domein-specifieke componenten.
- **Canonieke componenten herhalen, niet forken.** Zodra een patroon bestaat (bv. een stat-kaart, een leeg-staat-component, een filter-balk), wordt die hergebruikt — nooit een bijna-identieke variant ernaast bouwen.
- **Formulier-validatie:** Zod-schema's, hergebruikt tussen client (form-validatie) en server (API-route-validatie) — één schema, twee toepassingen. `zod-to-json-schema` wordt gebruikt waar een JSON-schema nodig is (bv. voor AI tool-definities).
- **Laadpatroon:** een klein aantal herbruikbare state-componenten (`PageState`/`LoadingState`/`EmptyState`) in plaats van dat elke pagina zijn eigen skeleton/spinner-logica uitvindt. Nooit een pagina "in fasen" opbouwen (eerst layout, dan data later erin schuiven) — het canonieke laadpatroon regelt de volgorde.

---

## 8. API Design

- Eén `route.ts` per resource/actie, HTTP-methode-functies (`GET`/`POST`/`PATCH`/`DELETE`) als named exports.
- Elke route: (1) `requirePermission()` eerst, (2) input-validatie met Zod, (3) data-laag call, (4) consistente JSON-response `{ data }` of `{ error: message }` met correcte status code.
- Error-responses altijd JSON met een `error`-veld, nooit een kale 500 zonder body.
- Zware/greedy berekeningen horen niet in de route zelf maar in een pure-TS module in `lib/<module>/`, zodat die apart unit-test-baar is.
- Bestandsgrootte-richtlijn: API-routes streven naar ~150 regels, max ~300. Groter → splits-voorstel doen, niet zomaar laten groeien.

---

## 9. Best Practices / Codeerstijl van deze auteur

- **Geen `any`**, TypeScript strict overal.
- **Geen premature abstractie** — een paar gelijkende regels code is prima; pas een helper/hook extraheren als het patroon zich écht herhaalt.
- **Eén-schrijfweg-principe** voor kritieke domeinlogica: als er een "engine"-achtige functie is voor een gevoelige operatie (bv. financieel boeken), is dát de **enige** plek die naar de betreffende tabellen schrijft — nooit directe inserts vanuit andere modules.
- **Secrets altijd via env-vars**, nooit in code, nooit gelogd.
- **Unit-testing verplicht voor kritieke logica** (financiële berekeningen, autorisatie-flows) — 100% dekking daar, niet overal.
- **Comments minimaal en alleen bij niet-voor-de-hand-liggende WHY** (workaround, verrassende constraint) — nooit een comment die herhaalt wat de code al zegt.
- **Bestandsgrootte als signaal, geen harde regel** — richtlijnen per laag (API-routes ~150/300, components ~200/400, lib ~250/500), overschrijding = bespreken en evt. splitsen, niet blind doorbouwen.
- **Nederlandse code-commentaar/PM-communicatie, Engelse identifiers** — variabelen/functies in het Engels, comments en gebruikersgerichte teksten in het Nederlands (met i18n-laag voor de UI-teksten zelf).
- **Altijd `schema → API route → UI`** als bouwvolgorde; nooit UI eerst met gemockte data.

---

## 10. How to Replicate — stappenplan voor een leeg project

1. **Monorepo opzetten**: root `package.json` met `workspaces: ["apps/*", "packages/*"]`, geen dependencies op root-niveau behalve `husky`.
2. **Eén Next.js app scaffolden** in `apps/<naam>/` (App Router, TypeScript strict, ESLint).
3. **Tailwind + shadcn/ui installeren**, `globals.css` opzetten met het `@theme inline` + `:root` CSS-var-patroon uit §2. Kies 1 primary/accent-kleur en leg die vast als bron van waarheid.
4. **Supabase-project aanmaken**, drie clients opzetten (`lib/supabase/{client,server,admin}.ts`) volgens §3.
5. **Kernschema migreren**: `tenants`, een centrale access/rol-tabel, en de domein-tabellen van de nieuwe app. RLS + policy in dezelfde migratie, geen uitzonderingen.
6. **`packages/db/` opzetten** voor gegenereerde Supabase-types, geïmporteerd als `@scope/db`.
7. **Auth-flow bouwen**: magic-link login-pagina, `auth/callback`-route, membership-resolver, `requirePermission()`-helper in `lib/auth/permissions.ts`.
8. **Eerste CRUD-verticale slice bouwen** volgens het patroon in §4 (schema → route → UI) om het hele pad te valideren voordat je verder uitbreidt.
9. **i18n opzetten**: cookie-based locale-library, `messages/{nl,en}/<namespace>.json`, nooit hardcoded UI-tekst.
10. **Deploy-pipeline**: push naar main → automatische deploy, env-vars in het hosting-dashboard, migratie-script (`npm run migrate`) los van de app-deploy.
11. **Guard-scripts toevoegen** naarmate de app groeit: i18n-pariteitscheck, ongeboundeerde-query-check, build-check — vóór elke push draaien.
