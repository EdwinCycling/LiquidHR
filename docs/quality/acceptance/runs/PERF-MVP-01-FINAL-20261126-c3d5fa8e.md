# PERF-MVP-01 finale acceptatie-closeout — 26 november 2026

## Besluit

**NO-GO voor formele integratieacceptatie.** De kandidaat heeft 30 PASS, 2 NOT_RUN en 2 BLOCKED. A13 mist een geautoriseerde tweede-medewerker-Storagefixture; A26 mist de expliciet vereiste onafhankelijke tweede-tenantproef; A27 mist een bestaande managerwissel/deputyfixture; A30 heeft geen betrouwbare volledige EN-readback. Er zijn geen nieuwe accounts, tenants of rechten gemaakt.

## Kandidaat en bewijsgrenzen

- Code-HEAD: `c3d5fa8e13124b0d3555c7d3d391505ddcb2b244`.
- Correctiecommit boven de eerder geaccepteerde basis `07444df5dc163dbf070f6b3115fa49282ab70463`: `c3d5fa8e13124b0d3555c7d3d391505ddcb2b244` — historie leest de PostgREST-acknowledgement als object én als array. De regressie voor `completedAt` is toegevoegd.
- Testomgeving: lokale LiquidHR-runtime met de bestaande HR Admin-, Manager- en Employee-identiteiten; TEST Supabase-project `wnpfloqpjvaacobppbpk`. De afzonderlijke cross-tenantproef is niet uitgevoerd.
- Geen service-role-bypass gebruikt als autorisatiebewijs. SQL-readbacks in dit rapport waren uitsluitend read-only status-/aggregaatqueries; geen migratie, Auth-mutatie, rechtenwijziging, push, merge of release uitgevoerd.
- De eerdere finale suite/build en persona-flow staan in [de acceptatierun van 25 november](PERF-MVP-01-FINAL-20261125-07444df5.md) en golden op code-SHA `07444df5…`. De gerichte c3-correctie is opnieuw getest met 13 Vitest-contracttests, TypeScript en ESLint. De volledige suite en production-build zijn niet opnieuw gestart op c3.
- De 26 november persona-closeout [JSON](PERF-MVP-01-20261126/persona-browser-final-closeout-c3d5fa8e.json) is op code-SHA c3 uitgevoerd. De oudere E1-run is bruikbaar voor ongewijzigde flows op SHA 07444df5; screenshots hebben geen ingebedde code-SHA en worden niet als zelfstandig SHA-bewijs behandeld.
- `apps/hr-suite/next-env.d.ts` is teruggezet naar de vooraf vastgelegde SHA-256 `B8B3A344484B959AF5E4E3FC1A1609DAC3CB9ECE0CDEB6C145BE29BC4C491000`. Bestaande wijzigingen aan packagebestanden, screenshots en andere lokale bestanden zijn niet gestaged.

## Closeoutproeven

### A13 — Documenten en Storage

Met bestaande Manager- en Employee-sessies op dezelfde dossierbijlage antwoordde de directe Storage REST-download voor Manager `200` en voor Employee `400`; Employee-upload werd `403`, delete `403` en de dossier-bijlageread `404`. De bijlage was nog niet vrijgegeven. Dit bewijst afwijzing voor de eigen dossiercontext.

Een directe Storage-proef met een bijlage van een andere medewerker is **BLOCKED**. De database had geen tweede-medewerker Performance Review-bijlage (`0` andere-medewerker-bijlagen). De poging om een geldig tweede dossier met de bestaande Manager te vullen stopte bij de bedoelde fasegrens: upload is alleen toegestaan in `WAITING_MANAGER`, waarvoor de tweede medewerker zelf eerst moet indienen. Er is geen bestaande tweede-medewerker-Employee-identiteit beschikbaar om dat normale pad te doorlopen. Vereiste fixture: een bestaande geautoriseerde Employee-identiteit voor een tweede medewerker met een bestaande dossierbijlage, of die medewerker via een reeds beschikbare normale sessie tot een managerbeoordeling laten indienen. Geen account aanmaken.

### A14 en A25 — Vertrouwelijke informatie

De bestaande Employee-sessie ontving geen interne notitie in dossier-, Continuous Appraisal-, historie-, algemene Documenten- of self-exportresponse. De algemene documenten- en self-exportroutes antwoordden `200`; de private-note-route antwoordde `403`. Een unieke synthetische notitiecanary kwam in geen van die projecties voor. Dit dekt de bestaande exportpaden en de gedeelde document-/appraisal-projecties.

### A19 — Voortijdige rondeafsluiting

Met de drie bestaande rollen zijn dossiers in `WAITING_EMPLOYEE`, `WAITING_MANAGER` en `WAITING_ACKNOWLEDGEMENT` voortijdig gesloten. De ronde werd `CLOSED`, terwijl de dossierfase ongewijzigd bleef en in historie als `CLOSED_OPEN` zichtbaar bleef. Medewerker- en Manager-dashboard toonden geen resterende actie voor deze dossiers.

Read-only TEST-readback voor die drie process instances: `3 CANCELLED`; gekoppelde workitems `3 CANCELLED` en `3 COMPLETED`; `0` reminder deliveries. Er staan nog `12 PROCESS_REMINDER:READY`-jobs (vier per process instance) in de queue. De bestaande reminderfunctie weigert een levering wanneer de process instance niet `RUNNING` is, de stap niet actief is, of het workitem niet `OPEN`/`CLAIMED` is; het PMUX-contracttestbestand dekt de skip-conditie. Er zijn geen reminders afgeleverd. De READY-queue-items zijn niet zelf geannuleerd; dit is een expliciete operationele caveat, geen bewijs van queue-opruiming.

### A23 — Historie

Op code-SHA c3 bevestigt de HR Admin-detailresponse auteur en timestamp voor zelfreflectie en managerreactie, definitieve inhoud, twee vrijgegeven bijlagen met timestamps en zowel akkoord als niet-akkoord. De Employee-historie bevat de definitieve status en de drie `CLOSED_OPEN`-dossiers. De regressietest ving een objectvorm van de acknowledgement-relatie op; de oude array-aanname liet `completedAt` leeg. De service accepteert nu beide PostgREST-vormen.

### A26 — Volledige autorisatiematrix

Met de bestaande personas zijn cross-employee en cross-team dossierverzoeken geweigerd; HR Admin-verzoeken met een niet-geautoriseerde HR-groep zijn geweigerd; dezelfde-dossier Storage-mutaties door Employee en toegang tot de niet-vrijgegeven bijlage zijn geweigerd. De Manager kreeg ook `404` bij een bestaand dossier in een andere administratie buiten het eigen team, via de normale role-switchsessie. PGlite-contracts dekken aanvullende rol-/scopegrenzen; geen van deze proeven vervangt een tweede-tenant persona.

De onafhankelijke cross-tenantproef is **NOT_RUN**, conform Edwin's expliciete instructie: er is geen geautoriseerde tweede-tenantpersona via de role switcher aangetoond. Exact benodigde fixture: één reeds bestaande, geautoriseerde identiteit met tenantlidmaatschap in een tweede tenant, plus een bestaand dossier of Storage-object waarvan de toegang met de eerste-tenantpersona kan worden geweigerd. Geen nieuwe accounts, tenants of grants.

### A27 — Managerwissel

De lokale contracttests bewijzen dat een reviewerwissel de PMUX-taak overdraagt. De live negatieve proef met de oude Manager na herverdeling is **BLOCKED**: de huidige Manager heeft zes directe medewerkers, maar geen van hen heeft een actieve deputy; ook is geen bestaande geautoriseerde tweede-manageridentiteit voor een geldige overdracht via de role switcher beschikbaar. Vereiste fixture: één bestaande medewerker met actieve Manager/deputy-relatie en twee reeds geautoriseerde Manager-identiteiten; daarna kan dezelfde oude Manager op dossier, historie en open taak worden getest. Er zijn geen rechten gewijzigd.

### A29 — Datalekscan

De A14-canary ontbrak in alle vijf Employee-projecties. Een read-only Supabase unified-logscan over `2026-11-26 07:00–08:51 UTC` vond `0` canaryhits in `auth_audit_logs` (72 entries), `auth_logs` (271), `edge_logs` (18.598), `pgbouncer_logs` (292), `postgres_logs` (56), `postgrest_logs` (10) en `storage_logs` (197). De auditfunctie schrijft voor notitieopslag alleen de actie `PRIVATE_NOTE_SAVED`; de notitietekst staat niet in het audit-event. De review-notitie wordt niet geselecteerd in dossier-/medewerkerresponses, Continuous Appraisal, talent-export, notificatieprojecties of de bestaande AI-contextcode. Er is geen externe AI-call met HR-notitie-inhoud uitgevoerd.

### A30 — UI-acceptatie

De eerdere E1-run op SHA `07444df5…` heeft de drie roldashboards en dossierflows op desktop en 390px mobiel doorlopen; zes axe-scans vonden nul overtredingen. De UI-evidence omvat 403/404/409-conflictgevallen en ronde-raceafhandeling. De nieuwe keyboardrun op c3 bereikte voor alle drie rollen via Tab/Enter de gesprekkenroute, met zichtbare focus en correcte Nederlandse heading. De taalrunner meldde na een geslaagde save `LOCALE_SAVE_READBACK_MISMATCH_EN`; de run legde geen volledige tussenresultaten vast. Dit wordt niet als bewezen productdefect of als EN-pass geclassificeerd. Omdat Engelse browserweergave niet bewezen is, blijft de samengestelde A30-criterion **NOT_RUN**. Zie de [keyboardresultaten](PERF-MVP-01-20261126/persona-browser-keyboard-closeout-c3d5fa8e.json) en screenshots in `PERF-MVP-01-20261126/screenshots/`.

Screenshots van de bestaande E1-run staan in `PERF-MVP-01-20261125/screenshots/`; onder meer de HR Admin-, Manager- en Employee-dashboards en conversatietab/dossiers. Ze zijn voor visuele beoordeling bruikbaar, maar bevatten zelf geen code-SHA.

## PERF-A01 t/m A34

| ID | Status | Actor en omgeving | Bewijs, code-SHA en resultaat |
|---|---|---|---|
| A01 | PASS | HR Admin; lokale browser / TEST, eerdere E1 | Concept opslaan en API-readback. [25-11 matrix](PERF-MVP-01-FINAL-20261125-07444df5.md), SHA `07444df5dc163dbf070f6b3115fa49282ab70463`; UI-gedrag niet geraakt door c3. |
| A02 | PASS | HR Admin; lokale browser / TEST, eerdere E1 | Naamzoekactie en zeven populatiefilters, preview en scope. Zelfde E1-bewijs/SHA `07444df5…`. |
| A03 | PASS | HR Admin; lokale browser + PGlite | Publicatie, deelnemer, dossier, PMUX-idempotency. E1/E4 SHA `07444df5…`; ongewijzigd door c3. |
| A04 | PASS | Scheduler-contract; PGlite | Geplande ronde activeert op datum en idempotent. E4 SHA `07444df5…`. |
| A05 | PASS | Unit-/DB-contract; PGlite | Rating-schaalkeuzes en snapshotvalidatie. E4 SHA `07444df5…`. |
| A06 | PASS | HR Admin/Manager; browser + API-contract | Scorevelden en onderbouwing alleen bij rating. E1/E4 SHA `07444df5…`. |
| A07 | PASS | HR Admin; lokale browser + PGlite | Deelnemer toevoegen na publicatie; duplicaat/scope geweigerd. E1/E4 SHA `07444df5…`. |
| A08 | PASS | Employee en Manager; lokale browser + PGlite | Eigen concept zichtbaar, manager ziet concept niet; definitieve tekst vergrendeld. E1/E4 SHA `07444df5…`. |
| A09 | PASS | Employee en Manager; lokale browser | Managerindiening vóór zelfindiening geweigerd; daarna ingediend. E1 SHA `07444df5…`. |
| A10 | PASS | HR Admin/Manager; browser + API-contract | Datum optioneel; rated-flow vereist score en toelichting. E1/E4 SHA `07444df5…`. |
| A11 | PASS | Manager; lokale browser + PGlite | Upload, retry, verwijderen/vervangen en MIME/metadata-contract. E1/E4 SHA `07444df5…`. |
| A12 | PASS | Manager en Employee; lokale browser / TEST | Vrijgegeven download werkt; vóór vrijgave geweigerd. E1 SHA `07444df5…`. |
| A13 | BLOCKED | Manager + Employee; directe TEST Storage REST/API | Manager GET `200`; Employee GET `400`, upload `403`, delete `403`, bijlage-API `404`; unreleased object niet leesbaar. Andere-medewerker-object ontbreekt. [Closeout JSON](PERF-MVP-01-20261126/persona-browser-final-closeout-c3d5fa8e.json), SHA `c3d5fa8e13124b0d3555c7d3d391505ddcb2b244`. |
| A14 | PASS | Employee; lokale API, Continuous Appraisal, documenten en export / TEST | Canaryniet-lek in dossier, appraisal, historie, algemene Documenten en self-export; private-note-route `403`. Closeout JSON, SHA `c3d5fa8e…`. |
| A15 | PASS | Employee; lokale browser / TEST, eerdere E1 | Definitieve beoordeling gelezen en akkoord geregistreerd zonder motivatie. E1 SHA `07444df5…`; c3 wijzigt alleen historie-readback. |
| A16 | PASS | Employee; API/PGlite, eerdere E1/E4 | Niet-akkoord vereist reden; acknowledgement één keer opgeslagen. SHA `07444df5…`; c3 historie-readback regressie staat daarnaast in de huidige unitrun. |
| A17 | PASS | Employee/Manager; PGlite + browser, eerdere E1/E4 | Definitieve submissions immutabel; ongeldige fase-/versieschrijfacties geweigerd. SHA `07444df5…`. |
| A18 | PASS | Employee; lokale browser / TEST, eerdere E1 | Zachte deadline zichtbaar en formulier bewerkbaar. E1 SHA `07444df5…`. |
| A19 | PASS | HR Admin, Manager, Employee; lokale API + TEST read-only DB | Drie open fasen gesloten; historie behoudt fase, dashboards stoppen acties; workitems 3 CANCELLED/3 COMPLETED, 0 deliveries. Er blijven 12 READY jobs; functie-guard en contracttest skippen gesloten processen. Closeout JSON + read-only query, SHA `c3d5fa8e…`. |
| A20 | PASS | Alle drie rollen; lokale browser / desktop + 390px mobiel | Dashboard-/rolscope en axe-scans uit eerdere E1, SHA `07444df5…`; c3 raakt UI niet. Screenshots in genoemde map. |
| A21 | PASS | PMUX-contract; PGlite | Bestaande `/work`-taken en idempotente workitems, geen tweede taakmodel. E1/E4 SHA `07444df5…`; reminder-skip extra getest in huidige contractrun. |
| A22 | PASS | HR Admin/Manager/Employee; lokale browser / TEST | Tab Gesprekken op medewerkerkaart zonder Talent Passport; E1 SHA `07444df5…`. |
| A23 | PASS | HR Admin + Employee; lokale API en historie / TEST | Definitieve teksten, auteurs/timestamps, 2 vrijgegeven bijlagen, akkoord/niet-akkoord en `CLOSED_OPEN` historie bevestigd; objectvorm acknowledgement hersteld. Closeout JSON + huidige regressietest, SHA `c3d5fa8e…`. |
| A24 | PASS | Employee; lokale API / TEST, eerdere E1/E4 | Continuous Appraisal veilige verwijzing; geen inhoudskopie of Employee-link-write. E1/E4 SHA `07444df5…`; A14-projecties bevestigd op c3. |
| A25 | PASS | Employee; lokale API / TEST | Interne notitie ontbreekt in appraisal, dossier, algemene documenten en exportprojecties. Closeout JSON, SHA `c3d5fa8e…`. |
| A26 | NOT_RUN | HR Admin, Manager, Employee; lokale API/Storage + PGlite | Cross-employee/team/HR-group/admin en directe Storage-denials bewezen; contractmatige rol- en scopechecks. Alleen onafhankelijke cross-tenantproef niet uitgevoerd: tweede-tenant-identiteit/object ontbreekt. E1 SHA `07444df5…`; cross-admin API SHA `c3d5fa8e…` in [JSON](PERF-MVP-01-20261126/persona-browser-cross-administration-c3d5fa8e.json). |
| A27 | BLOCKED | Oude Manager; TEST persona en fixture-readback | Revieweroverdracht staat in contracttests; live oude-Manager-toegang en taakoverdracht na herverdeling niet getest: geen actieve deputy voor de zes directe medewerkers en geen tweede Manager-fixture. PGlite SHA `07444df5…`; fixturereadback op `c3d5fa8e…`. |
| A28 | PASS | HR Admin/Manager/Employee; browser + PGlite | Idempotente retries, versieconflict en race sluiten 200/409; fase blijft historie. E1/E4 SHA `07444df5…`; A19 sluitingsreadback SHA `c3d5fa8e…`. |
| A29 | PASS | Employee/API + Supabase logs + broninspectie | Canarys afwezig in vijf projecties en 7 logbronnen; audit bevat actie, geen notitietekst; notificatie-/AI-contextpad bevat geen reviewnote. Geen AI-providercall. Closeout/logscan op `c3d5fa8e…`. |
| A30 | NOT_RUN | HR Admin, Manager, Employee; lokale browser | E1 desktop/390px en zes axe-scans op SHA `07444df5…`; keyboard route, focus-visible en NL-headings PASS voor 3/3 op c3. EN-save/readback gaf mismatch; volledige NL/EN-matrix niet bewezen. [Keyboard JSON](PERF-MVP-01-20261126/persona-browser-keyboard-closeout-c3d5fa8e.json) en screenshots; code-SHA `c3d5fa8e…`. |
| A31 | PASS | Migratie-/RLS-contracten + TEST advisors, eerdere E5 | Forward-only migrations, grants/RLS en advisors geverifieerd in eerdere finale run, SHA `07444df5…`; c3 wijzigt schema niet; geen migratie herhaald. |
| A32 | PASS | HR Admin, Manager, Employee; bestaande role-switcher | Alle drie bestaande personas hebben op c3 ingelogd via normale switchflow. Closeout JSON SHA `c3d5fa8e…`. |
| A33 | PASS | Lokale tests en geïsoleerde build, gecombineerd bewijs | E2/E3/E6 eerdere volledige suite/typecheck/lint/i18n/build op SHA `07444df5…`; op c3 gerichte 13 Vitest-tests, typecheck en ESLint PASS. Volledige suite/build niet opnieuw uitgevoerd op c3. |
| A34 | PASS | Git/TEST/Vercel-begrenzing; huidige run | Alleen lokale codefixcommit c3 en geselecteerde acceptance-evidence; geen push, merge, Vercel-release, Auth-account- of rechtenwijziging. Beschermde `next-env.d.ts` SHA hersteld. |

**Matrix:** 30 PASS, 2 NOT_RUN (A26 cross-tenantdeel en samengestelde A30), 2 BLOCKED (A13 andere-medewerker Storagefixture, A27 managerwisselfixture), 0 FAIL, 0 NOT_IMPLEMENTED.

## Gerichte checks op code-SHA c3d5fa8e

- `npm.cmd exec -- vitest run lib/performance-reviews/service.test.ts supabase/migrations/20261023083349_pmux06b_process_reminders_escalations.contract.test.ts` — **PASS**, 2 bestanden / 13 tests.
- `npm.cmd run type-check` — **PASS**.
- `npm.cmd exec -- eslint lib/performance-reviews/service.ts lib/performance-reviews/service.test.ts scripts/performance-review-final-closeout.mjs` — **PASS**.
- Lokale authenticated persona-closeout — **PASS** voor de daadwerkelijk in de JSON opgenomen tests; A30 locale-run bevat de beschreven onopgeloste mismatch.
- Volledige suite en production-build zijn voor c3 niet opnieuw uitgevoerd; E2/E6 blijven historisch bewijs op SHA `07444df5…`.

## Integratieadvies

**NO-GO.** De MVP-code kan als kandidaat worden beoordeeld, maar formele integratieacceptatie vereist de twee bestaande-persona fixtures voor A13/A27, de tweede-tenantidentiteit voor A26 en betrouwbare complete taal-/keyboard-readback voor A30. De 12 READY PMUX-reminderjobs zijn niet afgeleverd en worden door de gesloten-procesguard overgeslagen, maar de jobs zelf blijven in de queue; als integratie-eis expliciete queue-annulering betekent, moet dat apart worden opgelost en getest. Geen push, merge of Vercel-release uitgevoerd.
