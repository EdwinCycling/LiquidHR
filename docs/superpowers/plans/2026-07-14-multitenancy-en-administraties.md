# Multitenancy en multi-administratie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een aantoonbaar tenantveilig multi-administratiemodel met expliciete scope, administratiecontext, onomkeerbaar combineren en twee rijk gevulde demo-tenants.

**Architecture:** `tenants` zijn de absolute klantgrens; `administrations` zijn hiërarchische juridische entiteiten binnen één tenant. Applicatieroutes valideren de actieve cookiecontext en filteren expliciet, terwijl samengestelde databaseconstraints en RLS iedere tenant- en administratiesprong blokkeren. Medewerkers blijven tenantbreed; organisatie- en stamgegevens zijn administratiegebonden.

**Tech Stack:** Next.js 16 App Router, React Server Components, strict TypeScript, Vitest, Supabase Postgres/RLS, Tailwind v4, npm workspaces.

## Global Constraints

- Gebruik nooit TypeScript `any`.
- Bouw uitsluitend in de volgorde `schema → API route → UI`.
- Iedere publieke tabel krijgt RLS en policies in dezelfde migratie.
- Tenant- en administratie-ID's uit cookies, URL's en bodies zijn onbetrouwbare input.
- Database-identifiers zijn Engels; UI, comments en documentatie zijn Nederlands.
- Geen React Query, SWR of globale clientstore.
- Stamtabellen zijn administratiegebonden tenzij een requirement ze expliciet tenantbreed maakt.
- `SEPARATE → COMBINED` is eenmalig; `COMBINED → SEPARATE` wordt database-side geblokkeerd.
- De lokale app draait en wordt getest op poort 3000.

---

### Task 1: Requirement en besluiten canoniek maken

**Files:**
- Create: `docs/requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md`
- Create: `docs/decisions/ADR-0001-tenant-en-administratiegrenzen.md`
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-07-14-multitenancy-en-administraties-design.md` en `C:/Users/Edwin/Downloads/multi tenant.txt`.
- Produces: leidende requirement en architectuurbesluit voor alle volgende taken.

- [x] **Step 1:** Zet de brontekst om naar Markdown en corrigeer `UserAccess.administration_id = NULL` naar expliciete `scope_type`-semantiek.
- [x] **Step 2:** Leg het onomkeerbare combineerbesluit en de stamtabellenscope vast in ADR-0001.
- [x] **Step 3:** Registreer het nieuwe domein als LEIDEND/GEDEELTELIJK in `docs/README.md` en de delivery-status.
- [x] **Step 4:** Zoek naar tegenstrijdige termen met `rg -n "sharingMode|administrationId = NULL|multi tenant" docs` en corrigeer alleen leidende documentatie.

### Task 2: Schema- en isolatiemigratie test-first

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260714174305_add_multitenancy_administrations.sql`
- Regenerate: `packages/db/types.ts`

**Interfaces:**
- Produces: enums `administration_mode`, `sharing_mode`, `access_scope_type`; tabellen `administrations`, `user_access`, `employee_administration_assignments`; administration-FK's op organisatie-entiteiten; interne RLS-helpers.

- [x] **Step 1:** Draai een falende live schema-assertie voor ontbrekende `administrations`, `user_access`, `administration_id` en tenant/admin-constraints.
- [x] **Step 2:** Maak enums en tabellen met checks: `ADMINISTRATION` vereist een administration-ID, `TENANT` verbiedt die ID, effective dates zijn geldig.
- [x] **Step 3:** Voeg samengestelde uniques/FK's toe zodat administration, department, employee en tenant niet gekruist kunnen worden.
- [x] **Step 4:** Maak `validate_administration_parent`, breid `validate_department_parent` uit met administratiegelijkheid en blokkeer beide cyclustypen.
- [x] **Step 5:** Vervang de e-mail-bootstraptrigger door expliciete `user_access`; seed globale rol `TENANT_ADMIN` met niet-self permissions.
- [x] **Step 6:** Maak `has_tenant_access(uuid)`, `has_administration_access(uuid, uuid)` en pas employee/organization/department-policies aan zodat iedere policy eerst tenant- en waar relevant administratiescope controleert.
- [x] **Step 7:** Maak een interne combineerfunctie en onveranderlijkheidstrigger die `COMBINED → SEPARATE` weigert.
- [x] **Step 8:** Pas de migratie live toe, herhaal positieve én negatieve SQL-isolatietests en genereer types.

### Task 3: Contextresolver test-first

**Files:**
- Create: `apps/hr-suite/lib/context/administration-context.ts`
- Create: `apps/hr-suite/lib/context/administration-context.test.ts`
- Create: `apps/hr-suite/lib/context/server-context.ts`
- Modify: `apps/hr-suite/lib/auth/permissions.ts`
- Modify: `apps/hr-suite/lib/auth/permissions.test.ts`

**Interfaces:**
- Produces: `selectActiveContext(input): ActiveContext`, `loadActiveContext(): Promise<ActiveContext>` en `AuthContext.administrationId: string | null`.

- [x] **Step 1:** Schrijf falende tests voor tenantdefault, geldige administratie, gemanipuleerde cookie, siblingweigering en gecombineerde modus.
- [x] **Step 2:** Implementeer pure contextselectie met veilige default: nooit een niet-toegestane tenant of administratie retourneren.
- [x] **Step 3:** Implementeer server-loading via eigen `user_access`-regels, begrensde queries en HTTP-only cookienamen.
- [x] **Step 4:** Laat `requirePermission()` de actieve tenant en administratie gebruiken, combineer user-accessrollen met afdelingsrollen en ondersteun een hoofdgebruiker zonder verplichte employeekoppeling.
- [x] **Step 5:** Draai de gerichte tests tot GREEN.

### Task 4: Context-API en afdelingenroute

**Files:**
- Create: `apps/hr-suite/app/api/context/route.ts`
- Create: `apps/hr-suite/app/api/context/administration/route.ts`
- Create: `apps/hr-suite/lib/context/context-response.ts`
- Modify: `apps/hr-suite/app/api/departments/route.ts`

**Interfaces:**
- Produces: `GET /api/context`, `POST /api/context/administration` met body `{ administrationId: string }`, en administratiegefilterde department-JSON.

- [x] **Step 1:** Schrijf route/service-tests voor ongeldige UUID, niet-toegestane administratie en gecombineerde modus.
- [x] **Step 2:** Implementeer GET met alleen toegestane contextopties.
- [x] **Step 3:** Implementeer POST met server-side accessvalidatie en cookieopties `httpOnly`, `sameSite=lax`, `secure` in productie en rootpad.
- [x] **Step 4:** Voeg aan `/api/departments` naast `tenant_id` een verplichte `administration_id`-filter toe in gescheiden modus.
- [x] **Step 5:** Test 400/401/403 en controleer dat foutresponses uitsluitend `{ error: string }` bevatten.

### Task 5: Administratiekiezer en serverpagina

**Files:**
- Create: `apps/hr-suite/components/layout/administration-switcher.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/layout.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/departments/page.tsx`

**Interfaces:**
- Consumes: `ActiveContext` vanuit de server-layout.
- Produces: dropdown bij meerdere administraties in `SEPARATE`, label bij één, niets in `COMBINED`.

- [x] **Step 1:** Geef contextopties server-side als props aan de sidebar; de clientcomponent doet geen datafetch bij render.
- [x] **Step 2:** Bouw een toegankelijke `select` die uitsluitend toegestane UUID's post en na succes `router.refresh()` uitvoert.
- [x] **Step 3:** Filter de afdelingenpagina op tenant én actieve administratie en toon het administratielabel in de paginakop.
- [x] **Step 4:** Gebruik uitsluitend bestaande Tailwind/CSS-tokens en Nederlandse UI-tekst.
- [x] **Step 5:** Draai component-/contexttests, lint en type-check.

### Task 6: Deterministische demo-seed

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260714175659_seed_multitenancy_demo.sql`

**Interfaces:**
- Produces: twee vaste tenant-slugs, vier administraties, zestig medewerkers en complete bestaande organisatie-/roltabellen.

- [x] **Step 1:** Verwijder uitsluitend bestaande domeintestdata; behoud `auth.users`, globale rollen en permissions.
- [x] **Step 2:** Seed `liquid-hr-demo-holding` met holding + twee children, administratiegebonden afdelingen en vijftig realistische medewerkers.
- [x] **Step 3:** Seed `noorderlicht-zorggroep` met één administratie, afdelingen en tien eigen medewerkers.
- [x] **Step 4:** Vul voor alle zestig medewerkers adressen/contactdata, employee-administration-assignment en employee-organization; vul managementtoewijzingen per administratie.
- [x] **Step 5:** Koppel de bestaande authuser `edwin@editsolutions.nl` expliciet via tenantbrede `user_access` aan alleen tenant 1; tenant 2 krijgt geen login.
- [x] **Step 6:** Pas de seed live toe en assert exact 2 tenants, 4 administraties, 60 medewerkers, 60 assignments en 60 actieve organisatieplaatsingen.

### Task 7: Isolatie-, advisor- en browserverificatie

**Files:**
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/superpowers/plans/2026-07-14-multitenancy-en-administraties.md`

**Interfaces:**
- Produces: aantoonbaar groene kwaliteitsgate en actieve server op poort 3000.

- [x] **Step 1:** Simuleer authenticated JWT-contexten en bewijs met rollback-transacties dat tenant 1 nul rijen van tenant 2 en een administratiegebruiker nul siblingdata ziet.
- [x] **Step 2:** Bewijs dat cross-tenant en cross-administration-FK-inserts falen en dat combineren niet omkeerbaar is.
- [x] **Step 3:** Draai Supabase security- en performance-advisors en los nieuwe securitywaarschuwingen op.
- [x] **Step 4:** Draai `npm run test`, `npm run lint`, `npm run type-check` en `npm run build` vanaf de root.
- [ ] **Step 5:** Herstart `npm run dev` expliciet op poort 3000 en test loginredirect, 401-API, switcher en administratiefilter in de browser.
- [ ] **Step 6:** Controleer serverlogs, werk de statusdocumentatie bij en vink pas daarna dit plan volledig af.
