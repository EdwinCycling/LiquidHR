# PMUX-06A.1 — Core TEST eindacceptatie

Datum: 25 oktober 2026. **GO voor de goedgekeurde werkkalender/P9-acceptatie binnen De Sterren → Planeten → Jupiter BV, kalenderjaar 2026.** Geen release/deploymentclaim of kalenderpublicatie voor andere scopes/jaren.

## Mandaat en herkomst

Edwin autoriseerde in deze chat expliciet de ene kalendermigratie, één beschreven Jupiter-publicatie via de gewone HR Admin-interface en maximaal één P9-start voor DEMO-028 met business-ingangsdatum 24 oktober 2026. Bestaande server `http://127.0.0.1:3010` en Chrome/Playwright-runner zijn hergebruikt; geen nieuwe accounts of infrastructuur.

Checkout HEAD bleef `630df89c84bc2be4774072d387ecb5dc7df10f91`. Bestaande lokale patches zijn behouden. Geen staging/commit/push/merge/deployment of Git-cleanup. De bestaande index.lock is behouden. Focus SHA256 bleef `A8134B54351065DB6EFF5CBED717511A979AB85118810DA2941195DF8BAEEAEA`; geen secretwaarden gelezen of gelogd.

## Migratie — PASS

Project `wnpfloqpjvaacobppbpk`. Alleen `20261025100000_pmux06a1_work_calendars.sql` toegepast. Bron-SHA256 `0BA7D4BBB79A3CCB73916ED9D1374B499BFC3E4ECC98D63096EE3F784A7A16A0`; geregistreerde remote migratieversie **`20261025131521`**.

Vooraf waren de drie nieuwe tabellen afwezig en de vereiste scopekeys aanwezig. De oude private calculator werd uitsluitend door `set_process_step_deadline()` aangeroepen; alleen de oude `process_step_deadline_before`-trigger gebruikte die functie. De gecontroleerde migratie verwijderde dit pad, behield definitienormalisatie en integreerde de bestaande materialisatie met de canonieke kalenderresolver/calculator. Readback bevestigt alle nieuwe RLS-policies/grants en de nieuwe triggers. Alle zes private helpers zijn niet uitvoerbaar door anon/authenticated; de drie publieke RPC's zijn alleen voor authenticated en controleren hun eigen scope/permission.

De 30 bestaande stapdeadlines hadden vóór én na migratie én na P9-start fingerprint `f2219d5f439ab59739e7c1a3aab1cecc`. Geen backfill of herberekening. Gewone rolrechten en bestaande RLS bleven ongewijzigd.

Supabase-types zijn remote gegenereerd en de betrokken drie tabellen/FK's, drie RPC's en stapkolom zijn vergeleken met de lokale types. De nullable administratieparameter is bewust verfijnd volgens het echte SQL-contract. Security-/performanceadvisors zijn gecontroleerd: drie bedoelde, intern geautoriseerde SECURITY DEFINER-RPC's worden gemeld; geen nieuwe anon-uitvoering of ontbrekende kalender-RLS. Twee informatieve ontbrekende FK-indexadviezen (`created_by` en current-version-FK) zijn vastgelegd, zonder extra schemawijziging. Historische projectadviezen vallen buiten deze opdracht. Zie [migratie-readback](PMUX-06A1-20261025-MIGRATION.readback.json).

## Kalenderpublicatie — PASS

Normale HR Admin-login en contextselectie, vervolgens `/settings/work-calendars`, administratie-editor, expliciete feestdagselectie/bevestiging en **Nieuwe versie publiceren**. De onderschepte aanvraag werd vóór doorsturen exact tegen de goedgekeurde payload gecontroleerd; er is geen SQL/configuratie-bypass gebruikt. HTTP **201**, echte zichtbare pagina en preview; geen console-/paginafouten.

- Kalender `3fa12abe-e828-4037-a02c-cdad4da114df`, naam **Jupiter werkweek**.
- Revisie **1**, versie-ID `d1d60e40-51d3-4545-b23e-b91452657981`.
- De Sterren holding / Planeten / Jupiter BV, tijdzone Europe/Amsterdam.
- Maandag–vrijdag, geldig 01-01-2026 t/m 31-12-2026.
- Negen vrije dagen: 1 januari, 5/6 april, 27 april, 14 mei, 24/25 mei, 25/26 december.
- Goede Vrijdag, Bevrijdingsdag en Prinsjesdag niet geselecteerd; geen overige sluitingen.
- Eén publicatie, één header, één immutable versie, negen uitzonderingsrijen en één publicatie-auditrecord. Geen andere kalender aangemaakt en geen bronfeestdagen gewijzigd.

Preview via dezelfde SQL-engine: **24-10-2026 09:00 lokaal + twee werkdagen → 27-10-2026 09:00 CET / 08:00 UTC**. Werkdatums 26 en 27 oktober; 25 oktober overgeslagen. De zichtbare preview en HTTP 200 komen overeen met de opgeslagen versie.

## P9-start, deadline en audit — PASS

Vooraf: geen passende case voor subject/datum/`internal-transfer%` en geen bestaande vaste sleutel. Daarna precies één gewone HR Admin-start via `/work/new/internal-transfer`, DEMO-028, businessdatum 24-10-2026. HTTP **200**. Geen tweede start of formulierindiening.

| Bewijs | Waarde |
| --- | --- |
| Case-ID | `c20e10fd-14ca-44bb-bb4f-09d6a999b320` |
| Subject | DEMO-028, `9048f02b-4fdc-3c4c-e1aa-fd339660029c` |
| Proces | `internal-transfer-v2`, gepubliceerde versie 41 |
| Status / stap | RUNNING / request ACTIVE |
| Activatie | 25-10-2026 13:20:41.353403 UTC = 14:20:41.353403 CET |
| Deadline | **27-10-2026 13:20:41.353403 UTC = 14:20:41.353403 CET** |
| Werkdatums | 26 en 27 oktober 2026 |
| Kalenderbinding | versie `d1d60e40-51d3-4545-b23e-b91452657981` |
| Werkitemdeadline | exact gelijk aan stapdeadline |
| Idempotentiesleutel | `PMUX-P9:9048f02b-4fdc-3c4c-e1aa-fd339660029c:2026-10-24` |
| Readback aantal passende sleutel | **1** |

De echte SLA begint bij de daadwerkelijke stapactivatie, niet bij de business-ingangsdatum. De canonieke SQL-readback berekent exact dezelfde deadline. Audit bevat `WORK_CALENDAR_PUBLISHED`, `PROCESS_INSTANCE_CREATED`, `PROCESS_STEP_ACTIVATED`, `PROCESS_WORKDAY_DEADLINE_SET`, werkitemcreatie en processtart.

Geverifieerde P9-rijen: één instance, één employee-subject, één employment-subject, één actieve stap, één open werkitem, één eligible initiatorcandidate, twee procesevents, twee normale reminderjobs en negen gecorreleerde auditrecords. De reminders staan READY op de deadline en één seconde daarna volgens de bestaande engine. Geen jobaflevering uitgevoerd of geclaimd. Gewone login-/sessiehandelingen zijn geen nieuwe businessrecords.

## Directe autorisatie — PASS

| Rol | Werkelijke identiteit/relatie | Directe controle |
| --- | --- | --- |
| HR Admin | Auth-user `f9157157-6527-4348-8200-57ef57e28df1`, initiator-employee `01c349f0-be6f-01dc-4d96-b5bf66085a56`, Jupiter-context | GET `/api/process-instances/c20e10fd-14ca-44bb-bb4f-09d6a999b320` **200**; kalender-GET **200** |
| Employee | Auth-user `f38fe229-494e-4294-822d-90c19188232f`, employee `c6b1c7a9-c250-3d19-b1a0-87e317e80b13`, normale bestaande handoff en Planeten-context | dezelfde directe instance-GET **403 FORBIDDEN**; eigen werk-GET **200**, case afwezig; kalenderbeheer-GET **403** |

Readback bevestigt dat Employee geen initiator, employee-/employment-subject, kandidaat of toegewezen uitvoerder is. Het enige werkitem heeft participant `initiator` en is aan HR Admin toegewezen. Alle nieuwe kalender- en casegegevens en audit/jobscopes liggen binnen Jupiter. Geen kalender buiten de geselecteerde administratie gepubliceerd; geen nieuwe rechten of algemene RLS-/tenantbypass. De bestaande Manager-kalenderweigering uit de eerdere gerichte browserproef is hergebruikt; algemene rolwissel-, HR-groep- en directoryacceptatie zijn niet opnieuw uitgevoerd.

## Browserherstel en bewijs

Eerste run: kalenderpagina/API 200, daarna veldlocator-timeout vóór schrijven. Gerichte runneraanpassing wacht op de zichtbare editor; herproef publiceerde de kalender en startte de P9-case. Die run stopte daarna bij persona-navigatie. Geen productrechten of databasefuncties hiervoor gewijzigd.

De resterende autorisatieproef gebruikte uitsluitend de al opgeslagen case: normale Admin-login, directe positieve GET en normale Employee-handoff, daarna de negatieve GET. De runner wacht op DOMContentLoaded en registreert de navigatie afzonderlijk. Die proef eindigde met **final.pass=true en exitcode 0**, writes=0/writeAttempts=0. De eerdere mislukte runs blijven behouden, exitcode 1. De writes zijn dus één kalenderpublicatie en één P9-start, niet het aantal browserruns.

- [Publicatie en P9-start](PMUX-06A1-20261025-APPROVED-RETRY.browser.json)
- [Definitieve read-only autorisatieproef](PMUX-06A1-20261025-CASE-READONLY.browser.json)
- [Kalender/case/deadline/audit-readback](PMUX-06A1-20261025-BUSINESS.readback.json)
- [Afhankelijke writes en scope](PMUX-06A1-20261025-DEPENDENT.readback.json)
- [Eerdere lokale 86 tests en commitselectie](PMUX-06A1-20261025-LOCAL.md)

De 86 gerichte tests, TypeScript, ESLint en i18n-gates uit de lokale kandidaat blijven geldig: feature-SQL en productcode zijn sinds die groene kandidaat niet gewijzigd. In deze closeout zijn runner-syntax en diff-check opnieuw uitgevoerd. Geen nieuwe testarchitectuur of brede suite/herinstallatie/build gestart.

## Begrenzing

**GO voor deze afgebakende TEST-acceptatie.** Kalender is expliciet alleen voor Jupiter/2026 gepubliceerd. Andere scopes en 2027 blijven zonder eigen geldige publicatie fail-closed. Geen automatische verlenging, rolverruiming of deployment. De twee indexadviezen zijn niet blokkerend voor de bewezen correctheid en vereisen een afzonderlijk beoordeelde vervolgwijziging als optimalisatie nodig wordt.
