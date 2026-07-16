# Dienstverbanddetail en slimme mutaties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een complete dienstverbanddetailpagina met veilige tijdlijnmutaties, ketenadvies, gecombineerde wijzigingspakketten, opvolging, profielkoppelingen en auditgeschiedenis.

**Architecture:** Het bestaande effective-dated schema wordt uitgebreid met atomaire PostgreSQL-RPC's en compacte metadata voor wijzigingspakketten. Next.js API-routes valideren Zod-input en permissions; Server Components lezen de detailprojectie en clientcomponenten beheren uitsluitend formulieren en bevestigingsmodals.

**Tech Stack:** Next.js App Router, strict TypeScript, Supabase/Postgres/RLS, Zod, Vitest, Tailwind v4, NL/EN-i18n.

## Global Constraints

- Bouw in de volgorde `schema → API route → UI`.
- Gebruik strict TypeScript en nooit `any`.
- Kritieke salaris-, keten- en autorisatielogica is test-first.
- Alle zichtbare tekst komt uit NL/EN-taalbestanden met sleutelpariteit.
- Iedere publieke tabel krijgt RLS en policies in dezelfde migratie.
- Mutaties zijn atomair, geaudit en tenant-/administratiescoped.
- Lokale en publieke browservalidatie gebruiken poort 3000 als bron.

---

### Task 1: Pure tijdlijn-, impact- en ketenregels

**Files:**
- Create: `apps/hr-suite/lib/employment/timeline-rules.test.ts`
- Create: `apps/hr-suite/lib/employment/timeline-rules.ts`
- Create: `apps/hr-suite/lib/employment/chain-assessment.test.ts`
- Create: `apps/hr-suite/lib/employment/chain-assessment.ts`
- Create: `apps/hr-suite/lib/employment/impact-rules.test.ts`
- Create: `apps/hr-suite/lib/employment/impact-rules.ts`

**Interfaces:**
- Produces `planTimelineInsertion`, `planLatestRollback`, `assessEmploymentChain` en `getEmploymentImpacts` als pure, strict getypeerde functies.

- [ ] Schrijf falende tests voor periode-splitsing, behoud van latere blokken, rollback en enig-blokbeveiliging.
- [ ] Draai de gerichte Vitest-bestanden en controleer de verwachte failures.
- [ ] Implementeer minimale tijdlijnregels en maak de tests groen.
- [ ] Schrijf falende ketentests voor huidig regime, toekomstig regime, duur, aantal, onderbreking, uitzondering en onbekende historie.
- [ ] Implementeer de versioned ketenengine en maak de tests groen.
- [ ] Schrijf falende impacttests voor rooster, salaris, organisatie, arbeidsvoorwaarden, contract en adres.
- [ ] Implementeer de deterministische impactregistry en maak de tests groen.

### Task 2: Schema, RLS, audit en atomaire RPC's

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715150000_add_employment_change_management.sql`
- Create: `apps/hr-suite/supabase/tests/employment_change_management.sql`
- Modify: `packages/db/types.ts` via typegeneratie

**Interfaces:**
- Produces tabellen voor profile links, change sets, follow-ups, chain history/assessments en RPC's voor apply/rollback van alle tijdlijndomeinen.

- [ ] Schrijf eerst falende database-integratietests voor RLS, 100%-kostenverdeling, atomair toepassen, rollback en auditkoppeling.
- [ ] Voeg tabellen, constraints, indexes, RLS en grants in één migratie toe.
- [ ] Voeg audituitbreiding en triggers toe met sanering van salaris- en PII-velden.
- [ ] Voeg transactionele apply/rollback-RPC's toe met dienstverbandvergrendeling.
- [ ] Draai migraties en database-integratietests; los iedere failure op.
- [ ] Draai Supabase security/performance advisors en genereer `packages/db/types.ts` opnieuw.

### Task 3: Schema-validatie en services

**Files:**
- Modify: `apps/hr-suite/lib/employment/schemas.ts`
- Modify: `apps/hr-suite/lib/employment/schemas.test.ts`
- Create: `apps/hr-suite/lib/employment/employment-detail-service.test.ts`
- Create: `apps/hr-suite/lib/employment/employment-detail-service.ts`
- Create: `apps/hr-suite/lib/employment/employment-mutation-service.test.ts`
- Create: `apps/hr-suite/lib/employment/employment-mutation-service.ts`

**Interfaces:**
- Produces `getEmploymentDetail`, `createEmploymentMutation`, `rollbackEmploymentTimeline`, profile-link-, chain- en follow-upservices.

- [ ] Schrijf falende Zod-tests voor ieder mutatietype, wijzigingspakket, ketenoverride, profielkoppeling en follow-up.
- [ ] Implementeer gedeelde schemas en maak validatietests groen.
- [ ] Schrijf falende servicetests voor permissionkeuze, scopecontrole, detailprojectie en RPC-foutmapping.
- [ ] Implementeer lees- en schrijfservices via de ingelogde RLS-client.
- [ ] Verifieer gerichte en bestaande employmenttests.

### Task 4: API-routes

**Files:**
- Create: `apps/hr-suite/app/api/employments/[employmentId]/route.ts`
- Create: `apps/hr-suite/app/api/employments/[employmentId]/mutations/route.ts`
- Create: `apps/hr-suite/app/api/employments/[employmentId]/timeline/[timeline]/route.ts`
- Create: `apps/hr-suite/app/api/employments/[employmentId]/profile-links/route.ts`
- Create: `apps/hr-suite/app/api/employments/[employmentId]/chain-assessment/route.ts`
- Create: `apps/hr-suite/app/api/employments/[employmentId]/follow-ups/route.ts`
- Create route tests beside the employment service HTTP error tests.

**Interfaces:**
- Consumes Task 3 schemas/services; produces consistente `{ data }`/`{ error }` contracten voor de UI.

- [ ] Schrijf falende routetests voor 400, 403, 404, 409 en succesresponses.
- [ ] Implementeer GET/PATCH voor basis & IKV en profielkoppelingen.
- [ ] Implementeer POST voor wijzigingspakketten en DELETE voor laatste tijdblokken.
- [ ] Implementeer ketenadvies- en follow-uproutes.
- [ ] Draai de volledige route- en servicetestset.

### Task 5: I18n en herbruikbare UI-bouwstenen

**Files:**
- Modify: `apps/hr-suite/messages/nl/employment.json`
- Modify: `apps/hr-suite/messages/en/employment.json`
- Create: `apps/hr-suite/components/employment/employment-detail-types.ts`
- Create: `apps/hr-suite/components/employment/confirmation-dialog.tsx`
- Create: `apps/hr-suite/components/employment/timeline-section.tsx`
- Create: `apps/hr-suite/components/employment/employment-profile-header.tsx`

**Interfaces:**
- Produces getypeerde labels, standaardpopup, tijdlijnweergave en uitgebreide/compacte header.

- [ ] Voeg eerst dezelfde NL/EN-sleutels toe voor tabs, waarschuwingen, impacts, ketenadvies, opvolging en errors.
- [ ] Bouw de toegankelijke standaard bevestigingsmodal met focus- en Escape-afhandeling.
- [ ] Bouw tijdlijnkaarten met huidig/toekomst/historie en toegestane rollbackactie.
- [ ] Bouw profielheader met foto, fallback, contactacties, links en view-toggle.
- [ ] Draai i18n-pariteitscheck, ESLint en typecheck voor deze mijlpaal.

### Task 6: Dienstverbanddetailpagina en domeinformulieren

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx`
- Create: `apps/hr-suite/components/employment/employment-detail-tabs.tsx`
- Create: `apps/hr-suite/components/employment/employment-overview.tsx`
- Create: `apps/hr-suite/components/employment/employment-mutation-panel.tsx`
- Create: `apps/hr-suite/components/employment/forms/employment-basics-form.tsx`
- Create: `apps/hr-suite/components/employment/forms/income-relationship-form.tsx`
- Create: `apps/hr-suite/components/employment/forms/labor-condition-form.tsx`
- Create: `apps/hr-suite/components/employment/forms/schedule-form.tsx`
- Create: `apps/hr-suite/components/employment/forms/salary-form.tsx`
- Create: `apps/hr-suite/components/employment/forms/organization-placement-form.tsx`
- Create: `apps/hr-suite/components/employment/forms/cost-allocation-form.tsx`
- Modify: `apps/hr-suite/components/employment/employment-timeline.tsx`

**Interfaces:**
- Consumes Task 3 detailprojectie en Task 4 routes; produces de volledige detailervaring.

- [ ] Link iedere dienstverbandkaart naar de nieuwe detailroute.
- [ ] Bouw URL-state tabs en expanded/compact zonder globale clientstore.
- [ ] Bouw overzicht met AI-placeholder, actuele kaarten, uitbreidingsslots en auditlog.
- [ ] Bouw ieder domeinformulier met inline Zod-feedback en impactvoorstellen.
- [ ] Bouw TWK-, normale bevestigings- en rollbackpopups.
- [ ] Bouw ketenadvies en gemotiveerde niet-blokkerende override in contractflows.
- [ ] Bouw gecombineerde wijzigingspakketten en follow-upacties.
- [ ] Controleer alle RBAC-zichtbaarheid en lege/foutstaten.

### Task 7: Volledige verificatie en documentatie

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `docs/requirements/employment/CONTRACT_EN_DIENSTVERBAND.md` met de goedgekeurde keten-, rollback- en wijzigingspakketbesluiten.

- [ ] Draai alle Vitest-tests en noteer aantallen.
- [ ] Draai alle Supabase database-/isolatietests en advisors.
- [ ] Draai ESLint, strict TypeScript, i18n-pariteit en productiebuild.
- [ ] Start/controleer de productieapp geforceerd op poort 3000.
- [ ] Controleer uitgebreid en compact op desktop en 390px mobiel in een echte browser.
- [ ] Controleer relevante flows via de actuele publieke preview.
- [ ] Werk README, implementatiestatus en CURRENT_CONTEXT bij met exact bewijs en open vervolgwerk.
