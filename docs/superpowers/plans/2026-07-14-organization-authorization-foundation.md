# Organisatie- en autorisatiefundering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De repositorydocumentatie canoniek maken en de organisatie- en autorisatielaag veilig laten aansluiten op de goedgekeurde requirements.

**Architecture:** De rootdocumentatie wordt de vaste bron van waarheid via `AGENTS.md` en `docs/README.md`. Autorisatie blijft dubbel afgedwongen: de Next.js-helper controleert exacte rechten en Supabase RLS bepaalt de toegestane rijen, inclusief afdelingsscope en directe leidinggevenden. Plaatsvervanging wordt gemodelleerd, maar alleen actief gebruikt wanneer een latere afwezigheidsbron dit expliciet toestaat.

**Tech Stack:** Next.js App Router, strict TypeScript, Vitest, Supabase Postgres/RLS, npm workspaces.

## Global Constraints

- Gebruik nooit TypeScript `any`.
- Bouwvolgorde voor functionele wijzigingen is `schema → API route → UI`.
- Iedere publieke tabel heeft RLS en policies in dezelfde migratie.
- Database-identifiers zijn Engels; documentatie, UI en comments zijn Nederlands.
- Canonieke permissionnotatie is `resource:action` of `self:resource:action`.
- De applicatie draait en wordt getest op poort 3000.

---

### Task 1: Canonieke documentstructuur

**Files:**
- Create: `AGENTS.md`
- Create: `docs/README.md`
- Move: `Docs/Architecure/*` naar `docs/architecture/*`
- Move: `Docs/Requirements/*.txt` naar domeingerichte `.md`-paden onder `docs/requirements/`

**Interfaces:**
- Consumes: de bestaande vijf architectuurdocumenten en alle requirements.
- Produces: één index met documentstatus, implementatiestatus en leesrouting voor volgende agents.

- [x] **Step 1:** Controleer dat alle bronbestanden bestaan en leg aantallen vast.
- [x] **Step 2:** Verplaats de bestanden mechanisch zonder inhoudsverlies.
- [x] **Step 3:** Voeg `AGENTS.md` en `docs/README.md` toe.
- [x] **Step 4:** Vergelijk bestandsgroottes en controleer dat geen `.txt`-requirements of map `Architecure` resteert.

### Task 2: Requirements normaliseren

**Files:**
- Modify: `docs/requirements/authorization/AUTORISATIE_EN_RECHTEN.md`
- Modify: `docs/requirements/organization/AFDELINGEN_EN_ROLLEN.md`
- Modify: `docs/architecture/BLUEPRINT.md`
- Create: `docs/delivery/IMPLEMENTATION_STATUS.md`

**Interfaces:**
- Produces: canonieke permissions (`employee:read`, `self:employee:read`, enzovoort), expliciete scope- en deputyregels en een driftmatrix.

- [x] **Step 1:** Verwijder dubbele/conversationele tekst uit de autorisatiespecificatie.
- [x] **Step 2:** Leg exacte permissioncodes en beslissingen over meerdere rolhouders vast.
- [x] **Step 3:** Leg vast dat deputies pas actief worden na een positieve afwezigheidsbeslissing.
- [x] **Step 4:** Zoek repositorybreed naar verouderde permissionnotaties en corrigeer de documentatie.

### Task 3: Autorisatielogica test-first

**Files:**
- Create: `apps/hr-suite/lib/auth/permissions.test.ts`
- Create: `apps/hr-suite/lib/auth/permission-rules.ts`
- Modify: `apps/hr-suite/lib/auth/permissions.ts`
- Modify: `apps/hr-suite/package.json`

**Interfaces:**
- Produces: `toSelfPermission(permissionCode: string): string`, exacte selfservicecontrole en `AuthContext.permissions` naast echte `activeRoles`.

- [x] **Step 1:** Installeer Vitest en voeg het `test`-script toe.
- [x] **Step 2:** Schrijf tests die bewijzen dat `employee:read` naar `self:employee:read` vertaalt en `self:read` geen wildcard is.
- [x] **Step 3:** Draai de tests en bevestig de verwachte RED-status.
- [x] **Step 4:** Implementeer de minimale pure regels en pas `requirePermission` aan.
- [x] **Step 5:** Draai de tests en bevestig GREEN.

### Task 4: Organisatieresolver test-first

**Files:**
- Create: `apps/hr-suite/lib/organization/manager-resolver.test.ts`
- Create: `apps/hr-suite/lib/organization/manager-resolver.ts`

**Interfaces:**
- Produces: pure resolver voor directe manager, expliciete deputyfallback en omhoog klimmen in de afdelingenboom.

- [x] **Step 1:** Schrijf tests voor directe override, parent-escalatie, deputyfallback en ambiguïteit bij meerdere actieve rolhouders.
- [x] **Step 2:** Draai de tests en bevestig RED.
- [x] **Step 3:** Implementeer de minimale resolver met expliciete typed errors.
- [x] **Step 4:** Draai de tests en bevestig GREEN.

### Task 5: Supabase-schema en RLS

**Files:**
- Create: `apps/hr-suite/supabase/migrations/<timestamp>_harden_organization_authorization.sql`
- Regenerate: `packages/db/types.ts`

**Interfaces:**
- Produces: permissioncategorieën, volledige seeds, canonical selfrechten, organisatievelden en RLS-scope voor directe managers.

- [x] **Step 1:** Voer schema-asserties uit die vóór de migratie falen voor de ontbrekende kolommen en permissioncodes.
- [x] **Step 2:** Maak de migratie met de Supabase CLI en schrijf DDL, seeds, functies en policies.
- [x] **Step 3:** Pas de migratie toe op project `wnpfloqpjvaacobppbpk`.
- [x] **Step 4:** Herhaal de schema- en autorisatieasserties tot GREEN.
- [x] **Step 5:** Draai Supabase security- en performance-advisors en los nieuwe waarschuwingen op.
- [x] **Step 6:** Genereer de TypeScript-databasetypes opnieuw.

### Task 6: Volledige verificatie en poort 3000

**Files:**
- Verify: volledige workspace en browserflow.

**Interfaces:**
- Consumes: alle eerdere taken.
- Produces: aantoonbaar werkende build, tests, database en lokale browserflow.

- [x] **Step 1:** Draai `npm run test`, `npm run lint`, `npm run type-check` en `npm run build`.
- [x] **Step 2:** Start of herstart de app expliciet op poort 3000.
- [x] **Step 3:** Laad de actuele agent-browser core-instructie en test login, beveiligde redirect en afdelingenpagina.
- [x] **Step 4:** Controleer serverlogs op runtimefouten en werk `docs/delivery/IMPLEMENTATION_STATUS.md` bij.
