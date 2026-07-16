# Tijdhub, klokken en reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een persoonlijke Tijdhub in de sidebar met instelbare klokken, self-reminders en veilig door HR gepubliceerde reminders voor iedereen, afdelingen of medewerkers.

**Architecture:** Reminders worden als tenantgebonden definities met gematerialiseerde ontvangers opgeslagen. Een transactionele PostgreSQL-RPC publiceert HR-reminders en materialiseert de doelgroep; RLS geeft gewone gebruikers uitsluitend toegang tot eigen persoonlijke reminders en eigen recipientstatus. De Next.js-layout voedt de sidebar server-side, terwijl kleine clientcomponenten alleen klokanimatie, aftelling en dialogs beheren.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Supabase/Postgres/RLS, Zod, Vitest, Tailwind v4, lucide-react, NL/EN-i18n.

## Global Constraints

- Bouw in de volgorde `schema → API route → UI`.
- Nieuwe publieke tabellen krijgen RLS, policies, expliciete grants en passende indexes in dezelfde migratie.
- Gebruik permissions `reminder:read` en `reminder:write`; persoonlijke toegang blijft self-only via RLS.
- Bewaar remindertijden als `timestamptz`; locale presentatie gebeurt pas in de UI.
- Alle zichtbare tekst komt uit gelijke `nl/reminders.json`- en `en/reminders.json`-namespaces.
- Gebruik CSS-variabelen en bestaande thematokens; geen hardcoded hexwaarden in componenten.
- Gebruik Server Components, Server Actions en URL-state; geen SWR, React Query of globale clientstore.
- Ontvangers worden bij HR-publicatie atomair en onveranderlijk gematerialiseerd.
- Kritieke autorisatie en doelgroepmaterialisatie worden test-first gebouwd.

---

### Task 1: Requirement, pure tijdlogica en validatieschema's

**Files:**
- Create: `docs/requirements/reminders/TIJDHUB_EN_REMINDERS.md`
- Create: `apps/hr-suite/lib/reminders/reminder-rules.test.ts`
- Create: `apps/hr-suite/lib/reminders/reminder-rules.ts`
- Create: `apps/hr-suite/lib/reminders/schemas.test.ts`
- Create: `apps/hr-suite/lib/reminders/schemas.ts`

**Interfaces:**
- Produces `formatReminderCountdown(now, remindAt, locale)`, `clockHandAngles(date)`, `summarizeTarget(input)` en gedeelde Zod-schema's voor create, publish en recipientacties.

- [ ] Schrijf falende tests voor `nu`, minuten, uren, morgen, te laat, klokhoeken op 00:00/06:30 en doelgroepdeduplicatie.
- [ ] Draai `npm.cmd run test -w @liquid-hr/hr-suite -- lib/reminders/reminder-rules.test.ts --run` en bevestig dat imports/gedrag ontbreken.
- [ ] Implementeer de pure helpers zonder browser- of databaseafhankelijkheden en maak de tests groen.
- [ ] Schrijf falende Zod-tests voor verleden tijd, lege titel, ongeldige HR-doelgroep, snooze in het verleden en verboden extra velden.
- [ ] Implementeer `personalReminderCreateSchema`, `hrReminderCreateSchema`, `reminderUpdateSchema`, `publishReminderSchema` en `recipientActionSchema`; draai beide testbestanden groen.

### Task 2: Supabase-schema, RLS en publicatie-RPC

**Files:**
- Create: `apps/hr-suite/supabase/migrations/<timestamp>_add_time_hub_reminders.sql`
- Create: `apps/hr-suite/supabase/tests/reminders.sql`
- Modify: `packages/db/types.ts` via Supabase-typegeneratie

**Interfaces:**
- Produces enums `clock_mode`, `analog_clock_style`, `reminder_type`, `reminder_target_type`, `reminder_status`, `reminder_recipient_status`; tabellen `reminders`, `reminder_targets`, `reminder_recipients`; RPC `publish_reminder(uuid)`.

- [ ] Schrijf eerst een transactionele databaseproef die self-only lezen/schrijven, cross-tenantweigering, HR-permission, afdelingmaterialisatie en deduplicatie verwacht en daardoor faalt.
- [ ] Breid `user_preferences` uit met `clock_mode default 'ANALOG'` en `analog_clock_style default 'LIQUID'`.
- [ ] Maak de drie remindertabellen met tenant-/administratie-FK's, unieke recipientconstraint, datum/statuschecks en indexes voor upcoming- en beheerquery's.
- [ ] Voeg `reminder:read` en `reminder:write` toe aan `permissions` en koppel beide idempotent aan `TENANT_ADMIN` en `HR_ADMIN`.
- [ ] Voeg self- en HR-policies toe. Een recipient mag alleen de eigen statusvelden muteren; een gewone gebruiker kan geen andere ontvangers of doelgroepregels lezen.
- [ ] Bouw `publish_reminder(requested_reminder_id uuid)` als `SECURITY INVOKER`: lock concept, valideer `reminder:write`, materialiseer actieve auth-gebruikers voor `EVERYONE`, actieve plaatsingen voor `DEPARTMENTS` of expliciete medewerkers voor `EMPLOYEES`, dedupliceer en publiceer alleen bij minimaal één ontvanger.
- [ ] Voeg audittriggers toe voor create, publish, cancel en recipientstatus zonder omschrijvingen onnodig in technische logs te kopiëren.
- [ ] Pas de migratie live toe, draai `reminders.sql`, beide Supabase advisors en genereer `packages/db/types.ts` opnieuw.

### Task 3: Reminder-services en autorisatietests

**Files:**
- Create: `apps/hr-suite/lib/reminders/reminder-service.test.ts`
- Create: `apps/hr-suite/lib/reminders/reminder-service.ts`

**Interfaces:**
- Produces `getSidebarTimeHub()`, `listMyReminders(filters)`, `listManagedReminders(filters)`, `createPersonalReminder(input)`, `createHrReminder(input)`, `publishReminder(id)`, `updateReminder(id, input)`, `deleteReminder(id)` en `updateRecipient(id, input)`.

- [ ] Schrijf falende tests voor permissionkeuze, tenant-/administratiefilters, limiet 3 in de sidebar, HR-only beheer en typed 404/409-mapping.
- [ ] Implementeer `ReminderServiceError` en de leesfuncties met RLS-client, expliciete `.limit()`/`.range()` en alleen noodzakelijke kolommen.
- [ ] Implementeer één schrijfweg per actie; persoonlijke create gebruikt claims-user, HR-create vereist `reminder:write`, publish gebruikt uitsluitend de RPC.
- [ ] Maak recipientacties self-only en sta `SNOOZE`, `COMPLETE` en `DISMISS` toe met servergevalideerde timestamps.
- [ ] Draai alle reminderunit- en servicetests groen.

### Task 4: API-routes

**Files:**
- Create: `apps/hr-suite/app/api/reminders/route.ts`
- Create: `apps/hr-suite/app/api/reminders/[reminderId]/route.ts`
- Create: `apps/hr-suite/app/api/reminders/[reminderId]/publish/route.ts`
- Create: `apps/hr-suite/app/api/reminder-recipients/[recipientId]/route.ts`

**Interfaces:**
- Consumes Task 1-schema's en Task 3-services; produces consistente `{ data }`/`{ error }` HTTP-contracten.

- [ ] Schrijf falende routetests voor ongeldige JSON, 401, 403, 404, 409, create, publish en recipientstatus.
- [ ] Bouw `GET/POST /api/reminders` met `scope=my|managed` en Zod-validatie vóór de servicecall.
- [ ] Bouw detail `GET/PATCH/DELETE`; map servicefouten naar consistente statuscodes.
- [ ] Bouw publish- en recipientroutes; laat geen tenant-, user- of statusvelden rechtstreeks door de client bepalen.
- [ ] Draai route-, service- en bestaande auth-tests groen.

### Task 5: Persoonlijke voorkeuren en i18n

**Files:**
- Modify: `apps/hr-suite/lib/preferences/user-preferences.test.ts`
- Modify: `apps/hr-suite/lib/preferences/user-preferences.ts`
- Modify: `apps/hr-suite/lib/preferences/server.ts`
- Modify: `apps/hr-suite/app/actions/update-user-preferences.ts`
- Modify: `apps/hr-suite/lib/i18n/config.ts`
- Modify: `apps/hr-suite/lib/i18n/server.ts`
- Create: `apps/hr-suite/messages/nl/reminders.json`
- Create: `apps/hr-suite/messages/en/reminders.json`
- Modify: `apps/hr-suite/messages/nl/settings.json`
- Modify: `apps/hr-suite/messages/en/settings.json`

**Interfaces:**
- Extends `UserPreferences` met `clockMode` en `analogClockStyle`; adds namespace `reminders`.

- [ ] Breid eerst voorkeurentests uit voor defaults, DB-first-resolutie en afwijzing van onbekende klokwaarden; controleer de verwachte failures.
- [ ] Breid schema, defaults, DB-select en Server Action-upsert uit. Klokvelden krijgen geen cookies omdat alleen de ingelogde dashboardlayout ze nodig heeft.
- [ ] Voeg gelijke NL/EN-sleutels toe voor klokstijlen, countdown, composer, doelgroep, statussen, dialogs en errors.
- [ ] Draai `npm.cmd run check:i18n -w @liquid-hr/hr-suite` en voorkeurentests groen.

### Task 6: Klokken en instellingen-tab

**Files:**
- Create: `apps/hr-suite/components/reminders/analog-clock.tsx`
- Create: `apps/hr-suite/components/reminders/digital-clock.tsx`
- Create: `apps/hr-suite/components/reminders/clock-preview.tsx`
- Create: `apps/hr-suite/components/layout/clock-preferences.tsx`
- Modify: `apps/hr-suite/components/layout/settings-modal.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/layout.tsx`

**Interfaces:**
- Produces thematische klokcomponenten en instellingen-tabs `DISPLAY` en `CLOCK_REMINDERS`.

- [ ] Bouw `AnalogClock` als toegankelijke SVG met `clockHandAngles`, CSS-transformen en varianten `CLASSIC`, `MINIMAL`, `LIQUID`; voeg tekstueel tijdalternatief toe.
- [ ] Bouw `DigitalClock` met 24-uursnotatie, `tabular-nums` en datumregel; update maximaal eenmaal per seconde en pauzeer wanneer document verborgen is.
- [ ] Bouw `ClockPreview` voor analoog, digitaal en verborgen zonder afwijkende logica van de sidebarcomponenten.
- [ ] Splits de instellingenmodal visueel in twee tabs en plaats de klokvelden in de bestaande Server Action-form.
- [ ] Controleer focus, Escape, reduced motion, zes thema's en mobile layout; draai lint en typecheck.

### Task 7: Sidebar-Tijdhub en reminderpopup

**Files:**
- Create: `apps/hr-suite/components/reminders/reminder-countdown.tsx`
- Create: `apps/hr-suite/components/reminders/reminder-detail-dialog.tsx`
- Create: `apps/hr-suite/components/reminders/quick-reminder-form.tsx`
- Create: `apps/hr-suite/components/reminders/sidebar-time-hub.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes `getSidebarTimeHub()` en preferences; produces klok, drie upcomingregels, detaildialog en sessiepopup.

- [ ] Laat de serverlayout tegelijk met context/preferences maximaal drie reminders laden en als serialiseerbare props doorgeven.
- [ ] Bouw de Tijdhub tussen navigatie en accountfooter; voorkom dat de footer buiten beeld verdwijnt bij kleine schermhoogte.
- [ ] Bouw relatieve countdownupdates per minuut en per seconde onder één uur, zonder serverrefetch.
- [ ] Bouw een compacte persoonlijke composer en toegankelijke detaildialog met gereed/uitstellen/verbergen.
- [ ] Toon een verlopen reminder eenmaal automatisch per sessie via een in-memory id-set; wijzig database `last_popup_at` alleen na succesvolle weergave.
- [ ] Bouw collapsed badge en mobiele variant; verifieer zonder klok bij `HIDDEN` dat reminders via een bel/klokknop bereikbaar blijven.

### Task 8: Volledige reminderpagina en HR-doelgroep

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/reminders/page.tsx`
- Create: `apps/hr-suite/components/reminders/reminder-page-tabs.tsx`
- Create: `apps/hr-suite/components/reminders/reminder-list.tsx`
- Create: `apps/hr-suite/components/reminders/reminder-composer.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`
- Modify: `apps/hr-suite/messages/nl/navigation.json`
- Modify: `apps/hr-suite/messages/en/navigation.json`

**Interfaces:**
- Produces `/reminders?tab=my|managed&status=...&period=...` en HR-publicatie met ontvangerspreview.

- [ ] Bouw server-rendered `Voor mij` met komende, vervallen en afgeronde filters in URL-state.
- [ ] Bouw `Door HR gepland` alleen bij `reminder:write`, met doelgroep, bereik, publicatiestatus en annulering.
- [ ] Bouw persoonlijke composer met datum, tijd, titel en omschrijving.
- [ ] Bouw HR-composer met `EVERYONE`, multi-afdeling of multi-medewerker; laad opties server-side en toon het berekende bereik vóór bevestiging.
- [ ] Publiceer alleen vanuit een standaard bevestigingsdialog; toon uitgesloten medewerkers zonder auth-koppeling als aantal, niet als datalekgevoelige lijst buiten bevoegd beheer.
- [ ] Voeg het reminderitem data-gedreven aan de sidebar toe en controleer RBAC-zichtbaarheid.

### Task 9: Volledige verificatie en documentatie

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Create: `docs/decisions/FDR-0001-tijdhub-en-reminderdoelgroepen.md`

**Interfaces:**
- Produces reproduceerbaar verificatiebewijs en actuele overdracht.

- [ ] Draai alle Vitest-tests, de nieuwe live databaseproef en relevante bestaande multitenancy-/autorisatietests.
- [ ] Draai Supabase security- en performance-advisors; los nieuwe waarschuwingen op en bevestig typegeneratie.
- [ ] Draai ESLint, strict TypeScript, i18n-pariteit en productiebuild.
- [ ] Start de actuele build geforceerd op poort 3000 en controleer analoog/digitaal/verborgen, drie stijlen, create, detail, snooze en HR-publicatie in een echte ingelogde browser.
- [ ] Controleer desktop, ingeklapte sidebar en 390px mobiel lokaal én via de actuele publieke preview.
- [ ] Werk requirementindex, implementatiestatus, FDR en CURRENT_CONTEXT bij met exacte testresultaten en alleen werkelijk resterend werk.

## Self-review

- Alle onderdelen uit de goedgekeurde specificatie zijn aan een taak gekoppeld.
- De recipientmaterialisatie is één databaseverantwoordelijkheid en wordt niet in clientcode gedupliceerd.
- Persoonlijke toegang gebruikt geen brede HR-permission.
- Browserpush, e-mail, recurrence en vrije groepen blijven expliciet buiten scope.
- Directe implementatie gebeurt inline omdat deze workspace geen Git-repository en de sessie geen expliciete toestemming voor subagents heeft.
