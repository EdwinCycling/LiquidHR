# PMUX-05 — Servercontract lokale acceptance

Datum: 2026-10-22
Branch: work/BRANCH-SPLIT-PMUX-20261021
Basis-HEAD: 0b3934c486b11ff68d915045b7d81a240fe05d26

## Resultaat

**LOKAAL GREEN / LIVE ACCEPTANCE OPEN.** De bestaande response-RPC accepteert onvolledige draft-antwoorden wanneer nieuwe bronwaarden conditionele velden zichtbaar/verplicht maken. Definitieve submit/approve blijft server-side verplichtingen valideren met de bestaande condition-evaluator en projectie. Een veld dat verborgen raakt, wordt uit de actieve new_values en process runtime field set verwijderd; de vorige waarde blijft alleen in append-only response-revisiehistorie als auditprovenance; de bestaande RLS-policy en privileges weigeren directe authenticated SELECT. Een latere heractivering van de conditie toont dus geen oude actieve invoer.

Bestaande onbekende-, verborgen- en read-only-veldchecks, deelnemer- en tenantcontroles, proces-/formulier-versiepins, audit/revisies en document-reference compatibiliteit blijven behouden. De migratie wijzigt geen RLS, grants of rolrechten; alleen de nieuwe interne helper is niet uitvoerbaar voor public/authenticated.

## SQL-contracten daadwerkelijk uitgevoerd

De PGlite-test 20261022203000_pmux05_form_condition_draft_save.contract.test.ts laadt en voert de bestaande SQL-bronnen uit voor:

- 20260808142249_process_automation_p4_runtime_engine.sql
- 20260808143934_process_automation_p5_form_runtime.sql
- 20260808150735_process_automation_p4_p5_hardening_v2.sql
- 20260808160102_process_automation_p5_document_reference_compatibility.sql
- Nieuwe forward-only kandidaat: 20261022203000_pmux05_form_condition_draft_save.sql

De test voert bestaande actor guard, condition evaluator, runtime-fields, form projection, response-save en prepare-action RPCs uit. Alleen minimale fixturetabellen en subject/employee/scope-fixturehelpers zijn stubbed. De test zet plpgsql.variable_conflict = use_column om bestaande kolomsemantiek in PGlite uit te voeren; dit is een testinstelling, geen migratiegedrag.

Twee PGlite-tests groen: draft met conditioneel verplicht veld, definitieve fout met field detail, volledig submit, lege/fout getypeerde kosten, €750/€1.000/€1.250-zichtbaarheid, verbergen en actieve antwoordpurge, revision history, heractivering zonder oude waarde, verborgen/read-only/onbekende velden, cross-tenant weigering, ongeconditioneerd bestaand proces, immutable process/form versiepin en behoud van document-reference checks.

## Applicatiegates

- Gerichte Vitest: 6 files, 25 tests groen (renderer, process action detail, form/runtime services en PGlite SQL-contract).
- TypeScript: npm run type-check -- --pretty false groen.
- ESLint op gewijzigde app-/contracttestbestanden groen.
- NL/EN i18n: 43 namespaces met gelijke keys.
- Geen browserrun of echte actor-login in deze slice.

## Grenzen

Migratiebestand is alleen lokaal aanwezig; niet toegepast op Supabase TEST of productie. Geen remote database-write, procespublicatie, aanvraag, push, merge of deployment uitgevoerd. PGlite bewijst niet de remote function owner, JWT-identiteit, live RLS/grants/advisors of echte HR Admin/Manager/Employee-scope. Authenticated save/readback en browserdesktop/390px blijven open. Fijnmazige veldrechten per stap/deelnemer zijn buiten scope; geen rechten toegevoegd.

PMUX-04 blijft een afzonderlijke release/securitygate: owner-switcher browserbewijs, live JWT/RPC scope-negatives, resterende rolacties en volledige desktop-/390px captures moeten nog worden gesloten volgens [AA-OPEN](../../AA/AA-OPEN.md) en [PMUX-04R6](PMUX-04R6-20261022-LOCAL.md). Deze lokale servertest sluit PMUX-04 releaseacceptatie niet.
