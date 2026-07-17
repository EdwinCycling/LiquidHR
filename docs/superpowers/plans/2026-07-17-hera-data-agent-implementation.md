# HeRa Data Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HeRa beantwoordt HR-vragen uitsluitend met data die de ingelogde gebruiker in de actieve tenant mag zien, beheert geheugen en stijlvoorkeuren met toestemming en voert mutaties alleen uit via voorstel, controlekaart en expliciete bevestiging.

**Architecture:** De implementatie volgt strikt schema → API/service → UI. Iedere datatool gebruikt de gewone Supabase-gebruikerssessie, vertrouwde servercontext, canonieke permissions en RLS; alleen het reeds gefilterde minimale resultaat bereikt Gemini. Geheugen, voorkeuren en actieconcepten zijn per `(tenant_id, owner_user_id)` geïsoleerd en worden met test-first negatieve autorisatiescenario's ontwikkeld.

**Tech Stack:** Next.js App Router, strict TypeScript, React Server Components en Server Actions/route handlers, Supabase Postgres en RLS, Zod, Vitest, Tailwind v4, Gemini REST API, Vercel.

## Global Constraints

- Absolute grens: nooit data uit een andere tenant of ongeautoriseerde rijen/velden uit de eigen tenant, ook niet via tellingen, fouten, logs of modelcontext.
- Nooit een service-roleclient voor gebruikersvragen; tenant en gebruiker komen uitsluitend uit de gevalideerde serversessie.
- Bouwvolgorde is `schema → API route → UI`.
- Kritieke autorisatie- en salarislogica wordt test-first ontwikkeld; iedere productiewijziging wordt voorafgegaan door een aantoonbaar falende test.
- Strict TypeScript, nooit `any`; geen React Query of SWR.
- Alle zichtbare tekst staat in gelijke NL/EN namespaces; Nederlands is standaard.
- Iedere schemawijziging bevat RLS/policies, Supabase-tests, advisors en regeneratie van `packages/db/types.ts`.
- Lokaal valideren op poort `3000`, daarna publieke Vercel-preview en productie-smoketest op desktop en 390 × 844.
- De bestaande gebruikerswijziging in `docs/delivery/HANDMATIGE_ACTIES.md` blijft buiten featurecommits.

---

## Bestandsstructuur

- `apps/hr-suite/supabase/migrations/20260717100000_harden_hera_memory_and_preferences.sql`: FK-herstel, voorkeurentabel, conceptstatus en RLS.
- `apps/hr-suite/supabase/tests/hera_data_agent.sql`: cross-user, cross-tenant, FK- en voorkeurisolatie.
- `apps/hr-suite/lib/hera/request-context.ts`: volledige vertrouwde HeRa-context.
- `apps/hr-suite/lib/hera/preferences.ts`: voorkeuren en geheugen laden zonder scopeverbreding.
- `apps/hr-suite/lib/hera/data-contract.ts`: data-first bron- en antwoordregels.
- `apps/hr-suite/lib/hera/read-tools.ts`: medewerker-, dienstverband-, salaris- en organisatiereads.
- `apps/hr-suite/lib/hera/tool-registry.ts`: allowlist, Zod-input en tooldispatch.
- `apps/hr-suite/lib/hera/date-time.ts`: relatieve tijd naar absolute tenanttijd.
- `apps/hr-suite/lib/hera/action-drafts.ts`: generieke concept- en bevestigingstoestandsmachine.
- `apps/hr-suite/lib/hera/gemini.ts`: providerprompt, tooldeclaraties en tool-result roundtrip.
- `apps/hr-suite/app/api/hera/preferences/route.ts`: GET/PATCH voor toon, detail en senioriteit.
- `apps/hr-suite/app/api/hera/memory/route.ts`: GET/POST/PATCH/DELETE met expliciete toestemming.
- `apps/hr-suite/app/api/hera/conversations/[conversationId]/messages/route.ts`: orchestratie en veilige modelcontext.
- `apps/hr-suite/components/hera/hera-settings.tsx`: zichtbaar voorkeur- en geheugenbeheer.
- `apps/hr-suite/components/hera/hera-scope-line.tsx`: scope/filters/peildatum bij data-antwoorden.
- `apps/hr-suite/components/hera/hera-control-card.tsx`: geheugen- en mutatiebevestiging.

### Task 1: Databasefundering, FK-herstel en RLS

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260717100000_harden_hera_memory_and_preferences.sql`
- Create: `apps/hr-suite/supabase/tests/hera_data_agent.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces: `public.ai_user_preferences`, veilige `ai_memory_items.source_conversation_id`, uitgebreide `ai_action_drafts`.

- [ ] **Step 1: Schrijf falende SQL-tests**

Voeg tests toe die bewijzen dat gesprekverwijdering `source_conversation_id` nullt zonder `tenant_id` te wijzigen, dat `(tenant_id, owner_user_id)` uniek is voor voorkeuren en dat vreemde gebruikers/tenants nul rijen lezen en wijzigen.

```sql
select lives_ok(
  $$ delete from public.ai_conversations where id = '00000000-0000-0000-0000-000000000101' $$,
  'conversation delete keeps linked memory valid'
);
select is(
  (select source_conversation_id from public.ai_memory_items where id = '00000000-0000-0000-0000-000000000201'),
  null,
  'memory source is detached'
);
select is((select count(*) from public.ai_user_preferences), 0::bigint, 'foreign user sees no preferences');
```

- [ ] **Step 2: Draai de test en verifieer RED**

Run: `supabase test db apps/hr-suite/supabase/tests/hera_data_agent.sql`  
Expected: FAIL omdat `ai_user_preferences` niet bestaat en de huidige composite FK gesprekverwijdering breekt.

- [ ] **Step 3: Implementeer de migratie**

Maak de FK enkelvoudig en tenantveilig via een trigger/check, voeg voorkeuren toe en breid conceptstatus uit.

```sql
alter table public.ai_memory_items
  drop constraint ai_memory_items_source_conversation_same_tenant_fkey,
  add constraint ai_memory_items_source_conversation_fkey
    foreign key (source_conversation_id) references public.ai_conversations(id) on delete set null;

create table public.ai_user_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  tone text not null default 'BUSINESS' check (tone in ('FRIENDLY','BUSINESS','DIRECT')),
  detail_level text not null default 'BALANCED' check (detail_level in ('COMPACT','BALANCED','EXTENDED')),
  seniority_level text not null default 'EXPERIENCED' check (seniority_level in ('BASIC','EXPERIENCED','EXPERT')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, owner_user_id)
);
alter table public.ai_user_preferences enable row level security;
create policy ai_user_preferences_owner_access on public.ai_user_preferences for all to authenticated
using (owner_user_id = (select auth.uid()) and (select internal_security.has_tenant_access(tenant_id)))
with check (owner_user_id = (select auth.uid()) and (select internal_security.has_tenant_access(tenant_id)));
grant select, insert, update, delete on public.ai_user_preferences to authenticated;
```

Voeg een constraint-trigger toe die bij een niet-null `source_conversation_id` dezelfde tenant en eigenaar eist. Voeg `action_type`, `version`, `control_payload` en de statussen `AWAITING_CONFIRMATION`, `EXECUTING`, `SUCCEEDED` toe zonder bestaande reminderconcepten ongeldig te maken.

- [ ] **Step 4: Verifieer GREEN, advisors en types**

Run: `supabase test db apps/hr-suite/supabase/tests/hera_data_agent.sql`  
Expected: PASS.  
Run de Supabase security- en performance-advisors; verwacht geen nieuwe ERROR/WARN door deze migratie. Genereer daarna `packages/db/types.ts` opnieuw met de gekoppelde projectworkflow.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/supabase/migrations/20260717100000_harden_hera_memory_and_preferences.sql apps/hr-suite/supabase/tests/hera_data_agent.sql packages/db/types.ts
git commit -m "feat: harden HeRa persistence and RLS"
```

### Task 2: Vertrouwde rollen-, permissions- en voorkeurcontext

**Files:**
- Modify: `apps/hr-suite/lib/hera/request-context.ts`
- Create: `apps/hr-suite/lib/hera/preferences.ts`
- Modify: `apps/hr-suite/lib/hera/types.ts`
- Test: `apps/hr-suite/lib/hera/request-context.test.ts`
- Create: `apps/hr-suite/lib/hera/preferences.test.ts`

**Interfaces:**
- Produces: `requireHeRaContext(): Promise<AuthContext>` met werkelijke rollen/permissions en `loadHeRaUserContext(context): Promise<HeRaUserContext>`.

- [ ] **Step 1: Schrijf falende contexttests**

```ts
it('returns actual role and permission codes for the active tenant', async () => {
  const context = await requireHeRaContextForTest(fixture)
  expect(context.activeRoles).toEqual(['HR_MANAGER'])
  expect(context.permissions).toContain('salary:read')
})

it('loads only memory and preferences for the current tenant and owner', async () => {
  const result = await loadHeRaUserContext(context, repository)
  expect(result.memory.map((item) => item.content)).toEqual(['Antwoord compact'])
})
```

- [ ] **Step 2: Verifieer RED**

Run: `npm test -w @liquid-hr/hr-suite -- lib/hera/request-context.test.ts lib/hera/preferences.test.ts`  
Expected: FAIL omdat rollen leeg zijn en `loadHeRaUserContext` ontbreekt.

- [ ] **Step 3: Implementeer minimale context**

Hergebruik de bestaande rol-/permissionresolutie uit `lib/auth/permissions.ts` via een geëxporteerde contextfunctie, zonder role-id of tenant-id uit chatinvoer te accepteren.

```ts
export interface HeRaUserContext {
  locale: 'nl' | 'en'
  timeZone: string
  tone: 'FRIENDLY' | 'BUSINESS' | 'DIRECT'
  detailLevel: 'COMPACT' | 'BALANCED' | 'EXTENDED'
  seniorityLevel: 'BASIC' | 'EXPERIENCED' | 'EXPERT'
  memory: ReadonlyArray<{ id: string; category: 'PREFERENCE' | 'WORKING_CONTEXT'; content: string }>
}
```

- [ ] **Step 4: Verifieer GREEN**

Run dezelfde Vitest-command; verwacht PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/auth/permissions.ts apps/hr-suite/lib/hera/request-context.ts apps/hr-suite/lib/hera/preferences.ts apps/hr-suite/lib/hera/types.ts apps/hr-suite/lib/hera/*.test.ts
git commit -m "feat: load trusted HeRa authorization context"
```

### Task 3: Geheugen- en stijl-API

**Files:**
- Modify: `apps/hr-suite/lib/hera/schemas.ts`
- Modify: `apps/hr-suite/lib/hera/service.ts`
- Modify: `apps/hr-suite/app/api/hera/memory/route.ts`
- Create: `apps/hr-suite/app/api/hera/preferences/route.ts`
- Test: `apps/hr-suite/lib/hera/service.test.ts`
- Create: `apps/hr-suite/app/api/hera/memory/route.test.ts`
- Create: `apps/hr-suite/app/api/hera/preferences/route.test.ts`

**Interfaces:**
- Produces: `PATCH /api/hera/memory`, `GET|PATCH /api/hera/preferences`; alle mutaties eisen `explicitConsent: true`.

- [ ] **Step 1: Schrijf falende route- en servicetests**

```ts
it('updates only an owned memory item after explicit consent', async () => {
  const response = await PATCH(request({ id, content: 'Antwoord direct', explicitConsent: true }))
  expect(response.status).toBe(200)
})

it('does not reveal whether a foreign memory item exists', async () => {
  const response = await PATCH(request({ id: foreignId, content: 'x', explicitConsent: true }))
  expect(response.status).toBe(404)
})
```

- [ ] **Step 2: Verifieer RED**

Run: `npm test -w @liquid-hr/hr-suite -- app/api/hera/memory/route.test.ts app/api/hera/preferences/route.test.ts lib/hera/service.test.ts`  
Expected: FAIL omdat PATCH en preferences-route ontbreken.

- [ ] **Step 3: Implementeer Zod-schema's en eigenaarbegrensde queries**

Gebruik altijd `.eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId)` en retourneer dezelfde 404 voor niet-bestaand en niet-toegankelijk.

```ts
const preferencePatchSchema = z.object({
  tone: z.enum(['FRIENDLY', 'BUSINESS', 'DIRECT']).optional(),
  detailLevel: z.enum(['COMPACT', 'BALANCED', 'EXTENDED']).optional(),
  seniorityLevel: z.enum(['BASIC', 'EXPERIENCED', 'EXPERT']).optional(),
}).refine((value) => Object.keys(value).length > 0)
```

- [ ] **Step 4: Verifieer GREEN en volledige HeRa-unitset**

Run de testcommand en daarna `npm test -w @liquid-hr/hr-suite -- lib/hera app/api/hera`; verwacht PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/hera apps/hr-suite/app/api/hera/memory apps/hr-suite/app/api/hera/preferences
git commit -m "feat: add consented HeRa memory management"
```

### Task 4: Data-first contract en providerorchestratie

**Files:**
- Create: `apps/hr-suite/lib/hera/data-contract.ts`
- Create: `apps/hr-suite/lib/hera/data-contract.test.ts`
- Modify: `apps/hr-suite/lib/hera/context.ts`
- Modify: `apps/hr-suite/lib/hera/gemini.ts`
- Modify: `apps/hr-suite/lib/hera/gemini.test.ts`

**Interfaces:**
- Produces: `buildHeRaSystemInstruction(input)` en `HeRaEvidenceEnvelope` met `source`, `scope`, `filters`, `asOfDate`, `uncertainties`.

- [ ] **Step 1: Schrijf falende promptcontracttests**

```ts
it('forbids answering an internal HR fact without tool evidence', () => {
  const instruction = buildHeRaSystemInstruction(input)
  expect(instruction).toContain('Beantwoord interne HR-feitvragen uitsluitend na een geslaagde toolcall')
  expect(instruction).toContain('Bevestig of ontken geen afgeschermde records')
})
```

- [ ] **Step 2: Verifieer RED**

Run: `npm test -w @liquid-hr/hr-suite -- lib/hera/data-contract.test.ts lib/hera/gemini.test.ts`  
Expected: FAIL omdat het contract en tool-resultvervolg ontbreken.

- [ ] **Step 3: Implementeer contract en meerstaps providerflow**

```ts
export interface HeRaEvidenceEnvelope<T> {
  source: 'LIQUID_HR'
  data: T
  scope: { tenantLabel: string; population: string; visibleCount: number }
  filters: ReadonlyArray<{ field: string; operator: string; value: string }>
  asOfDate: string
  uncertainties: string[]
}
```

Stuur alleen deze geautoriseerde envelope als toolresponse terug naar Gemini. Externe tools worden niet gedeclareerd totdat een aparte consentflow bestaat.

- [ ] **Step 4: Verifieer GREEN**

Run dezelfde tests; verwacht PASS en controleer dat toolarguments geen tenantId of userId bevatten.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/hera/data-contract* apps/hr-suite/lib/hera/context.ts apps/hr-suite/lib/hera/gemini*
git commit -m "feat: enforce HeRa data-first responses"
```

### Task 5: Salarisaggregatie met absolute autorisatiegrens

**Files:**
- Create: `apps/hr-suite/lib/hera/read-tools.ts`
- Create: `apps/hr-suite/lib/hera/read-tools.test.ts`
- Create: `apps/hr-suite/lib/hera/tool-registry.ts`
- Create: `apps/hr-suite/lib/hera/tool-registry.test.ts`
- Modify: `apps/hr-suite/lib/hera/gemini.ts`

**Interfaces:**
- Produces: `countVisibleSalariesAbove(context, input): Promise<HeRaEvidenceEnvelope<SalaryThresholdResult>>` en allowlisted `analyze_salary_threshold`.

- [ ] **Step 1: Schrijf falende salary- en hostile-argumenttests**

```ts
it('counts only salaries visible through the caller session', async () => {
  const result = await countVisibleSalariesAbove(managerContext, { amount: 6000, asOfDate: '2026-07-17' }, repository)
  expect(result.data).toEqual({ matchedCount: 2, populationCount: 8, currency: 'EUR', salaryBasis: 'MONTHLY_BASE' })
})

it('rejects tenant and user scope in model arguments', async () => {
  await expect(dispatchHeRaTool(context, { name: 'analyze_salary_threshold', args: { amount: 6000, tenantId: foreignTenant } }))
    .rejects.toMatchObject({ code: 'HERA_TOOL_INPUT_INVALID' })
})
```

- [ ] **Step 2: Verifieer RED**

Run: `npm test -w @liquid-hr/hr-suite -- lib/hera/read-tools.test.ts lib/hera/tool-registry.test.ts`  
Expected: FAIL omdat functies ontbreken.

- [ ] **Step 3: Implementeer minimale salarisquery**

Gebruik de gewone serverclient. Selecteer actuele `employment_salaries` binnen de peildatum; RLS begrenst werknemersscope en `salary:read`. Selecteer geen namen voor de telling. Zet `canRevealIndividuals` alleen waar een afzonderlijke permissioncheck en privacydrempel dit toestaan.

```ts
export interface SalaryThresholdResult {
  matchedCount: number
  populationCount: number
  currency: 'EUR'
  salaryBasis: 'MONTHLY_BASE'
  canRevealIndividuals: boolean
}
```

- [ ] **Step 4: Verifieer GREEN plus non-disclosure**

Run de tests; verwacht PASS. Voeg cases toe voor geen `salary:read`, alleen `self:salary:read`, vreemde employeeId en kleine groep; antwoorden mogen verborgen bestaan niet bevestigen.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/hera/read-tools* apps/hr-suite/lib/hera/tool-registry* apps/hr-suite/lib/hera/gemini.ts
git commit -m "feat: add authorized HeRa salary analysis"
```

### Task 6: Medewerker-, dienstverband- en organisatietools

**Files:**
- Modify: `apps/hr-suite/lib/hera/read-tools.ts`
- Modify: `apps/hr-suite/lib/hera/read-tools.test.ts`
- Modify: `apps/hr-suite/lib/hera/tool-registry.ts`
- Modify: `apps/hr-suite/lib/hera/tool-registry.test.ts`
- Modify: `apps/hr-suite/lib/hera/gemini.ts`

**Interfaces:**
- Produces: `search_visible_employees`, `get_visible_employment`, `get_visible_organization`, elk met `HeRaEvidenceEnvelope`.

- [ ] **Step 1: Schrijf falende begrenzingstests**

Test self-only, managerteamscope, HR-scope, vreemde tenant-id, verborgen medewerker-id, paginalimiet en niet-onderscheidende 404/403.

```ts
expect(await searchVisibleEmployees(managerContext, { query: 'Eva', limit: 20 }, repository))
  .toMatchObject({ data: { items: [{ employeeId: visibleEmployeeId }] } })
```

- [ ] **Step 2: Verifieer RED**

Run de twee tooltestbestanden; verwacht FAIL op ontbrekende toolnamen.

- [ ] **Step 3: Implementeer drie kleine tools**

Iedere input bevat alleen businessfilters, nooit tenant/user/permission. Selecteer per tool uitsluitend noodzakelijke velden; dienstverbandtool bevat salaris nooit impliciet.

- [ ] **Step 4: Verifieer GREEN**

Run de tooltests en `npm run type-check -w @liquid-hr/hr-suite`; verwacht PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/hera
git commit -m "feat: add authorized HeRa HR read tools"
```

### Task 7: Tijdzonecorrecte concepten en generieke bevestiging

**Files:**
- Create: `apps/hr-suite/lib/hera/date-time.ts`
- Create: `apps/hr-suite/lib/hera/date-time.test.ts`
- Create: `apps/hr-suite/lib/hera/action-drafts.ts`
- Create: `apps/hr-suite/lib/hera/action-drafts.test.ts`
- Modify: `apps/hr-suite/lib/hera/service.ts`
- Modify: `apps/hr-suite/app/api/hera/drafts/[draftId]/confirm/route.ts`

**Interfaces:**
- Produces: `resolveHeRaDateTime(text, now, timeZone, locale)`, `confirmActionDraft(context, draftId, expectedVersion)`.

- [ ] **Step 1: Schrijf falende regressietests**

```ts
it('resolves morgen from the current Amsterdam date', () => {
  expect(resolveHeRaDateTime('morgen om 09:00', new Date('2026-07-17T10:00:00Z'), 'Europe/Amsterdam', 'nl'))
    .toEqual({ iso: '2026-07-18T07:00:00.000Z', display: '18 juli 2026 om 09:00 (Europe/Amsterdam)' })
})
```

Test ook verleden blokkeren, DST, verlopen concept, gewijzigde versie en dubbele confirm.

- [ ] **Step 2: Verifieer RED**

Run: `npm test -w @liquid-hr/hr-suite -- lib/hera/date-time.test.ts lib/hera/action-drafts.test.ts`  
Expected: FAIL omdat de resolver en toestandmachine ontbreken.

- [ ] **Step 3: Implementeer minimale resolver en claimflow**

Claim atomair alleen `AWAITING_CONFIRMATION` met overeenkomstige eigenaar, tenant, versie en niet-verlopen timestamp; zet eerst `EXECUTING`, voer daarna bestaande domeinservice uit en eindig `SUCCEEDED` of `FAILED`.

- [ ] **Step 4: Verifieer GREEN**

Run tests; verwacht PASS en geen mutatie bij verlopen/dubbele bevestiging.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/hera apps/hr-suite/app/api/hera/drafts
git commit -m "feat: harden HeRa action confirmations"
```

### Task 8: Message-route met geheugen, tools en bewijsmetadata

**Files:**
- Modify: `apps/hr-suite/app/api/hera/conversations/[conversationId]/messages/route.ts`
- Create: `apps/hr-suite/app/api/hera/conversations/[conversationId]/messages/route.test.ts`
- Modify: `apps/hr-suite/lib/hera/context.ts`

**Interfaces:**
- Consumes: `loadHeRaUserContext`, `dispatchHeRaTool`, `HeRaEvidenceEnvelope`.
- Produces: responseparts voor tekst, `evidence` en `controlCard`.

- [ ] **Step 1: Schrijf falende routeflowtests**

Test de oorspronkelijke € 6.000-vraag, voorkeurhergebruik in nieuw gesprek, toolfout zonder verzonnen antwoord en vreemde conversationId als generieke 404.

- [ ] **Step 2: Verifieer RED**

Run de route-test; verwacht FAIL omdat huidige route slechts één toolcall afhandelt en geheugen niet injecteert.

- [ ] **Step 3: Implementeer begrensde orchestration loop**

Sta maximaal drie toolrondes toe, persisteer zichtbare toolnaam en minimale bewijsmetadata, en stuur nooit ruwe ongeautoriseerde data of servercontext terug naar de client.

- [ ] **Step 4: Verifieer GREEN**

Run route-, Gemini- en tooltests; verwacht PASS.

- [ ] **Step 5: Commit**

```powershell
git add 'apps/hr-suite/app/api/hera/conversations/[conversationId]/messages' apps/hr-suite/lib/hera/context.ts
git commit -m "feat: orchestrate grounded HeRa conversations"
```

### Task 9: Geheugenbeheer, stijlkeuze en datascoperegel in de UI

**Files:**
- Create: `apps/hr-suite/components/hera/hera-settings.tsx`
- Create: `apps/hr-suite/components/hera/hera-scope-line.tsx`
- Create: `apps/hr-suite/components/hera/hera-control-card.tsx`
- Create: `apps/hr-suite/components/hera/hera-settings.test.tsx`
- Modify: `apps/hr-suite/components/hera/hera-chat.tsx`
- Modify: `apps/hr-suite/components/hera/hera-chat-state.ts`
- Modify: `apps/hr-suite/messages/nl/hera.json`
- Modify: `apps/hr-suite/messages/en/hera.json`

**Interfaces:**
- Consumes: preferences/memory API en message `evidence`/`controlCard`.

- [ ] **Step 1: Schrijf falende component-/modeltests**

Test bekijken, wijzigen, verwijderen, voorstelkaart, toon/senioriteitselectie, absolute datumweergave, scope-uitklapper en 390px-layoutmodel.

- [ ] **Step 2: Verifieer RED**

Run: `npm test -w @liquid-hr/hr-suite -- components/hera`  
Expected: FAIL omdat settings/scope/control-card ontbreken.

- [ ] **Step 3: Implementeer toegankelijke componenten**

Gebruik bestaande design tokens, labels uit `hera.json`, knoppen voor bevestigen/annuleren en een `<details>` voor analysemetadata. Geen permissionlogica in de UI.

- [ ] **Step 4: Verifieer GREEN en i18n**

Run: `npm test -w @liquid-hr/hr-suite -- components/hera`  
Run: `npm run check:i18n -w @liquid-hr/hr-suite`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/components/hera apps/hr-suite/messages/nl/hera.json apps/hr-suite/messages/en/hera.json
git commit -m "feat: add HeRa memory and response controls"
```

### Task 10: Gefaseerde schrijftools via bestaande domeinservices

**Files:**
- Modify: `apps/hr-suite/lib/hera/action-drafts.ts`
- Modify: `apps/hr-suite/lib/hera/action-drafts.test.ts`
- Modify: `apps/hr-suite/lib/hera/tool-registry.ts`
- Modify: `apps/hr-suite/lib/hera/gemini.ts`
- Modify: `apps/hr-suite/components/hera/hera-control-card.tsx`

**Interfaces:**
- Produces: `draft_personal_reminder`, `draft_employee_address_change`, `draft_employment_salary_change`, `draft_employment_schedule_change` en `draft_organization_placement_change`.

- [ ] **Step 1: Schrijf voor iedere schrijftool een falende adaptertest**

Test deze vaste adapterkoppelingen:

```ts
const actionAdapters = {
  draft_personal_reminder: createPersonalReminder,
  draft_employee_address_change: updateEmployeeAddress,
  draft_employment_salary_change: applyTimelineMutation,
  draft_employment_schedule_change: applyTimelineMutation,
  draft_organization_placement_change: updatePlacement,
} as const
```

Iedere test eist: voorstel zonder domeinwrite, complete `controlPayload` met oude en nieuwe waarde, bevestiging onder dezelfde gebruiker/tenant, herautorisatie door de domeinservice en exact één uitvoering. Voor adres en plaatsing bevat het concept bestaande record-id en `updatedAt`/versie; voor salaris en rooster bevat het concept `employmentId`, `effectiveOn`, `reason`, waarschuwingen en acknowledgements.

- [ ] **Step 2: Verifieer RED voor alle vijf adapters**

Run: `npm test -w @liquid-hr/hr-suite -- lib/hera/action-drafts.test.ts lib/hera/tool-registry.test.ts`  
Expected: FAIL op de vier nieuwe toolregistraties; de remindercase faalt op de nieuwe generieke control payload.

- [ ] **Step 3: Implementeer de vijf adapters via bestaande domeinservices**

Importeer `createPersonalReminder` uit `lib/reminders/reminder-service.ts`, `updateEmployeeAddress` uit `lib/employees/employee-service.ts`, `applyTimelineMutation` uit `lib/employment/employment-detail-service.ts` en `updatePlacement` uit `lib/organization/management-service.ts`. Voer geen directe `.insert()`/`.update()` uit vanuit de agentlaag. Gebruik voor salaris respectievelijk rooster `timeline: 'SALARY'` en `timeline: 'SCHEDULE'`, zodat bestaande Zod-validatie, permissions en auditketen actief blijven.

- [ ] **Step 4: Verifieer GREEN en concurrencygedrag**

Run dezelfde twee testbestanden. Expected: PASS voor annuleren, verlopen, permissionverlies tussen voorstel en confirm, gewijzigde doeldata, dubbele confirm en idempotency. Als een bestaande service geen stale-writebescherming biedt, blijft de betreffende adapter niet geregistreerd en moet eerst in die domeinservice een afzonderlijke test-first concurrencyfix worden toegevoegd.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/hera apps/hr-suite/components/hera/hera-control-card.tsx
git commit -m "feat: add confirmed HeRa domain actions"
```

### Task 11: Productieconfiguratie, documentatie en versie

**Files:**
- Modify: `apps/hr-suite/lib/app-version.ts`
- Modify: `docs/requirements/chatbot/HERA_AI_AGENT.md`
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `apps/hr-suite/.env.example`

**Interfaces:**
- Produces: actuele leidende requirement/status en expliciete `NEXT_PUBLIC_APP_URL`-controle voor OAuth.

- [ ] **Step 1: Schrijf of actualiseer configuratieregressietest**

Laat de bestaande app-version/configtest falen op de nieuwe versie en documenteer dat productie geen localhost-origin mag gebruiken.

- [ ] **Step 2: Verifieer RED**

Run: `npm test -w @liquid-hr/hr-suite -- lib/app-version.test.ts`; verwacht FAIL op oude versie.

- [ ] **Step 3: Werk versie en documentatie bij**

Gebruik `1.20260717.1` als eerste releaseversie en vermeld afgeronde slices, open schrijftools en exacte verificatiestatus zonder secrets.

- [ ] **Step 4: Verifieer GREEN**

Run app-versiontest en `npm run check:i18n -w @liquid-hr/hr-suite`; verwacht PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/hr-suite/lib/app-version* apps/hr-suite/.env.example docs/README.md docs/requirements/chatbot/HERA_AI_AGENT.md docs/delivery/IMPLEMENTATION_STATUS.md docs/delivery/CURRENT_CONTEXT.md
git commit -m "docs: record HeRa data agent delivery"
```

### Task 12: Volledige verificatie, preview en productie-eindtest

**Files:**
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Create: `docs/delivery/HERA_PRODUCTION_ACCEPTANCE_2026-07-17.md`

**Interfaces:**
- Produces: herhaalbaar bewijs voor tests, RLS-isolatie en browserflows.

- [ ] **Step 1: Draai lokale kwaliteitscontroles**

```powershell
npm test -w @liquid-hr/hr-suite
npm run type-check -w @liquid-hr/hr-suite
npm run lint -w @liquid-hr/hr-suite
npm run check:i18n -w @liquid-hr/hr-suite
npm run build -w @liquid-hr/hr-suite
```

Expected: alle commando's exitcode 0 zonder nieuwe waarschuwingen.

- [ ] **Step 2: Draai database- en autorisatietests**

Run alle Supabase SQL-tests en advisors. Test gebruiker A/B in tenant 1, gebruiker A in tenant 2, medewerker-selfscope, managerteamscope en HR-scope. Expected: nul cross-user/cross-tenant reads/writes en geen bestaanlek via fout of telling.

- [ ] **Step 3: Start lokaal op poort 3000 en voer browsermatrix uit**

Test salaris > € 6.000, vervolgvragen, geheugen add/change/delete en nieuw gesprek, toon/senioriteit, alle readtools, control cards, dubbele confirm, relatieve datum, export en gesprekverwijdering op desktop en 390 × 844.

- [ ] **Step 4: Deploy publieke preview en herhaal kritieke matrix**

Controleer previewlogs op 4xx/5xx, runtimefouten en PII/salarispayloads. Corrigeer iedere fout met een nieuwe falende regressietest vóór codewijziging.

- [ ] **Step 5: Productie-smoketest**

Na expliciete promotie naar productie: controleer login/OAuth-origin, de oorspronkelijke salarisvraag, één beperkt account, geheugenisolatie en gesprekverwijdering. Ruim uitsluitend aangemaakte testdata op via normale domeinflows.

- [ ] **Step 6: Leg bewijs vast en commit**

```powershell
git add docs/delivery/HERA_PRODUCTION_ACCEPTANCE_2026-07-17.md docs/delivery/CURRENT_CONTEXT.md
git commit -m "test: document HeRa production acceptance"
```

## Definitie van gereed

- De vraag “Zijn er medewerkers die meer dan € 6.000 verdienen?” gebruikt aantoonbaar alleen geautoriseerde Liquid HR-data en noemt scope, peildatum en definitie.
- Dezelfde vraag levert per medewerker-, manager- en HR-context correct begrensde resultaten zonder verborgen bestaan te lekken.
- Geheugen werkt in een nieuw gesprek en is zichtbaar toe te voegen, wijzigen en verwijderen met expliciete bevestiging.
- Toon, detail en senioriteit zijn instelbaar en veranderen geen permissions.
- Iedere vrijgegeven write gebruikt proposal → controlekaart → confirm → herautorisatie → domeinservice → audit.
- Cross-user en cross-tenant tests slagen op database-, API- en browserniveau.
- Lokale build, publieke preview en productie-smoketest zijn vastgelegd zonder secrets.
