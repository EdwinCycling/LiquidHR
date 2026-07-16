# Punten 1 t/m 6 — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Punten 1 t/m 6 uit de actuele backlog omzetten naar aantoonbaar werkende, geteste verticale slices, met klok/reminders als eerste volledig afgeronde slice.

**Architecture:** Iedere slice volgt `schema → API/service → UI`. Database-autorisatie en server-side permissionchecks zijn dubbel verplicht. De bestaande Supabase SSR-client, effectieve-datering, i18n en dashboardpatronen worden hergebruikt; testdata mag via gecontroleerde migraties/fixtures worden aangepast.

**Tech Stack:** Next.js App Router, Server Components, Server Actions, strict TypeScript, Supabase/Postgres/RLS, Zod, Vitest, Tailwind v4 en bestaande NL/EN-namespace-i18n.

## Global Constraints

- Geen `any`, geen React Query/SWR en geen client-side autorisatie.
- Alle blootgestelde tabellen krijgen RLS en policies in dezelfde migratie.
- Alle zichtbare tekst en foutmeldingen komen uit gelijke NL/EN-taalbestanden.
- Lokale validatie gebruikt poort 3000; iedere mijlpaal wordt ook in een echte browser op desktop en 390px gecontroleerd.
- Na schemawijzigingen: Supabase tests/advisors en `packages/db/types.ts` opnieuw genereren.
- Externe configuratie (SMTP, OAuth, permanente deployment en productie-secrets) wordt voorbereid en alleen geactiveerd met beschikbare credentials.

## Definition of Done per punt

1. Klok/reminders: schema/RLS, API, persoonlijke en HR-flow, Tijdhub, instellingen, tests en browser-preview zijn aantoonbaar groen.
2. Dienstverband: multi-domeinmutatie, basis/IKV- en organisatieformulieren, nieuwe persoonskaart na geen match en ketenhistorie zijn werkend en getest.
3. Auth/deployment: uitnodiging/SMTP/OAuth/deployment zijn lokaal volledig voorbereid; ontbrekende externe credentials staan expliciet als handmatige actie.
4. Afwezigheid: leidend model, tijdzone/gedeeltelijke afwezigheid, resolver en tests bestaan; deputyregels blijven veilig uitgeschakeld tot het model werkt.
5. Multitenancy: iedere relevante stam-/transactietabel heeft tenant- en administratiescope, RLS en negatieve isolatietests.
6. Documenten/compliance: categorieën, opslag, toegangsbeleid, audit en compliance-auditflow zijn werkend in de medewerkercontext.

## Uitvoeringsvolgorde

### Task 1: Tijdhub-domein en test-first basis

**Files:** bestaande `apps/hr-suite/lib/reminders/*`; nieuwe reminder requirement en i18n namespaces.

- [ ] Breid tests uit voor countdowns, tijdzones, klokmodi, doelgroepsamenvatting en alle reminderstatusacties.
- [ ] Voer de tests rood uit en noteer dat de ontbrekende persistence-/servicecontracten falen.
- [ ] Houd pure helpers strikt zonder database/browserafhankelijkheid en maak de tests groen.

### Task 2: Tijdhub-schema, RLS en databaseproef

**Files:** nieuwe Supabase-migratie en `apps/hr-suite/supabase/tests/reminders.sql`.

- [ ] Voeg klokvelden toe aan `user_preferences`.
- [ ] Maak `reminders`, `reminder_targets` en `reminder_recipients`, inclusief tenant-/administratie-FK's, checks en indexes.
- [ ] Voeg `reminder:read` en `reminder:write` toe, policies en audit vastlegging.
- [ ] Bouw de transactionele `publish_reminder`-RPC met self-only recipientacties, doelgroepmaterialisatie en deduplicatie.
- [ ] Draai live databaseproef, advisors en typegeneratie.

### Task 3: Reminder-services en routes

**Files:** nieuwe `apps/hr-suite/lib/reminders/reminder-service.ts`, tests en routes onder `app/api/reminders`.

- [ ] Implementeer server-side reads/writes met de ingelogde RLS-client.
- [ ] Implementeer persoonlijke create/update/delete en HR create/publish/cancel.
- [ ] Implementeer recipient-acties `COMPLETE`, `SNOOZE` en `DISMISS`.
- [ ] Test 401/403/404/409, cross-tenantweigering en HR-only beheer.

### Task 4: Klokinstellingen, Tijdhub en reminderpagina

**Files:** dashboard layout/sidebar/settings, nieuwe remindercomponenten, `/reminders`, NL/EN namespaces.

- [ ] Voeg klokvoorkeuren toe aan bestaande Server Action en instellingenmodal.
- [ ] Render analoge/digitale/hidden klok met tekstalternatief en drie analoge stijlen.
- [ ] Voeg maximaal drie reminders, live countdown, badge, detaildialog en sessiepopup toe.
- [ ] Bouw persoonlijke en HR-composer met server-side berekend bereik.
- [ ] Controleer desktop, collapsed sidebar, 390px mobiel, reduced motion en RBAC.

### Task 5: Dienstverband afronden

- [ ] Voeg atomic multi-domain apply/rollback toe voor `direct meenemen`.
- [ ] Voeg mutatieformulieren voor basis/IKV en organisatieplaatsing toe.
- [ ] Voeg nieuwe persoonskaartflow toe na mislukte identity match.
- [ ] Voeg externe ketenhistorie en cao-uitzonderingen toe met audit en gemotiveerde override.

### Task 6: Auth, uitnodiging en deployment

- [ ] Verifieer en documenteer server-only secrets, SMTP, Google callback/redirects en leaked-password protection.
- [ ] Test uitnodigingsflow met echte geconfigureerde provider waar beschikbaar.
- [ ] Maak permanente deployment-configuratie en voer publieke end-to-end controle uit zodra deploymentcredentials beschikbaar zijn.

### Task 7: Afwezigheid en workflowresolver

- [ ] Ontwerp en implementeer absence schema/service/API/UI met timezone en partial-day semantics.
- [ ] Voeg resolver voor meerdere rolhouders en negatieve autorisatietests toe.
- [ ] Activeer deputyselectie pas na geslaagde absence-tests.

### Task 8: Multitenancy-afwerking

- [ ] Inventariseer resterende stamtabellen en voeg expliciete scopes, samengestelde FKs, RLS en policies toe.
- [ ] Voeg kopieeractie/versioned template alleen toe waar requirements dit noodzakelijk maken.
- [ ] Herhaal isolatietests voor tenant, administratie, doelgroep en audit.

### Task 9: Documenten en compliance

- [ ] Voeg categorieën, documenten, opslagmetadata, gekoppelde entiteiten en categorie-/RBAC-policies toe.
- [ ] Voeg upload/download/delete API en medewerker-/dienstverband UI toe.
- [ ] Voeg compliance-auditrecords, auditstatussen, rapportage en testdata toe.
- [ ] Houd AI-auditresultaat als gecontroleerde, auditbare servicegrens; geen vrije modeltoegang vanuit de browser.

### Task 10: Integrale verificatie en overdracht

- [ ] Draai Vitest, database-isolatie, advisors, lint, strict TypeScript, i18n-check en productiebuild.
- [ ] Start geforceerd op poort 3000 en controleer alle zes slices in een echte browser.
- [ ] Controleer een actuele publieke preview wanneer deployment/tunnel beschikbaar is.
- [ ] Werk `docs/README.md`, `IMPLEMENTATION_STATUS.md` en `CURRENT_CONTEXT.md` alleen bij met werkelijk bewijs.

