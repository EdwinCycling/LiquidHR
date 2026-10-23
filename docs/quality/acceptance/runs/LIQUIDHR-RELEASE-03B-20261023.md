# LIQUIDHR-RELEASE-03B — Databasehervatting en releasevoorbereiding

Datum: 2026-10-23
Verdict: **DATABASE PASS — RELEASE-CODE PASS — DEPLOYMENT HOLD op verzoek**

## Scope en bron

- Gedeelde synthetische LiquidHR TEST-app; geen aparte klantproductie.
- Product-/runtimecodebaseline: GitHub `main` SHA `9e2e354422c8b591ed161f58e640de4f913ae4b9`, geïntegreerd via PR #45.
- Doelversie `1.20261023.1` staat al in `apps/hr-suite/lib/app-version.ts`; er is geen tweede versieophoging nodig.
- Eigenaar autoriseerde expliciet deze synthetische TEST-migraties zonder voorafgaande databasebackup. Er is geen backup/restorebewijs en er wordt geen herstelmateriaal aangemaakt.

## Core migraties

Read-only controle bevestigde dat PMUX-03A al was uitgevoerd en dat PMUX-06B ontbrak zonder geregistreerde of gedeeltelijke uitvoering. De al aanwezige vervolghistorie omvatte PMUX-03B, 05, 05C en 06A. De nog ontbrekende migraties zijn daarna met een nieuwe geldige uitvoersessie één voor één toegepast; de eerdere `Invalid or expired requestState` was geen aangetoonde SQL-fout.

| Migratie | Resultaat | Geregistreerde remote versie |
| --- | --- | --- |
| PMUX-06B — reminders en escalaties | PASS — eenmaal, na 06A | `20261023202553` |
| PMUX-06B.1 — system scheduler | PASS — eenmaal, na 06B | `20261023202621` |
| PMUX-06C — operations workspace | PASS — eenmaal, na 06B.1 | `20261023202745` |
| PMUX-07A — insights | PASS — eenmaal, na 06C | `20261023202850` |

Daarmee zijn alle acht migraties na 03A aanwezig; Core-historie telt 578 entries inclusief bestaande historie. PMUX-03A (`20261021143000`) is niet opnieuw toegepast. Geen reset, tabelvervanging of Payroll-historywijziging.

Na iedere migratie is geschiedenis en het relevante schema-/autorisatiecontract teruggelezen. De vijf bestaande HR-groepen hebben `Europe/Amsterdam` in `public.hr_groups.time_zone`; IANA-zoneregels behouden zomer-/wintertijd. Read-only voor/na-vergelijking vond geen delta in bestaande records: instances 13, steps 30, work_items 25, candidates 25, notes 1, events 77, form_responses 9, outputs 4, workflow_jobs 4, reminder_deliveries 0, reminders 38, targets 24, recipients 41.

RLS blijft ingeschakeld op PMUX-instanties, werkitems, kandidaten, notities, events, workflow jobs, reminder deliveries en reminders; bestaande policies zijn aanwezig. Schedulerwrapper-executie is service-role-only; geen `anon`/`authenticated` EXEC op de systeemwrapper. Gebruikersgerichte Operations/Insights-functies blijven authenticated-only en interne helpers zijn niet aan `anon`/`authenticated` toegekend. SQL bevatte geen ongecontroleerde datawissing. De vier migratie-resultaten gaven succes en relevante readbacks.

Payroll Lab (`jhgeriucbkfarxiudzfy`) is afzonderlijk gecontroleerd en ongewijzigd gebleven met 17 bestaande migraties. Er waren geen ontbrekende D2 SQL-contracten; er zijn geen onnodige writes gedaan.

## Scheduler en cron

- PMUX-remindercron blijft `0 6 * * *`; recruitment blijft `0 3 * * *`.
- `CRON_SECRET` is aanwezig in Vercel-project `liquidhr` als Production-only `sensitive`/`secret`; de waarde is niet gelezen, gelogd of getoond.
- Routecontracttests dekken 401 bij ongeldige Bearer-authenticatie vóór scheduleraanroep. De geldige secret is niet gebruikt om de route te testen; er zijn geen reminders verstuurd.
- De actuele due/ready queue is leeg; running en dead-letter tellen zijn 0. De scheduler verwerkt maximaal vijf jobs per uitvoering, waardoor groeiende instroom of retries boven die capaciteit achterstand kan opleveren.
- Vercel Hobby plant dagelijkse jobs binnen het geplande uur, zonder realtimegarantie. BEFORE/AT/BREACH zijn geen realtime-aflevergarantie.

## Code- en releasegates

| Gate | Resultaat |
| --- | --- |
| HR Suite | 741 bestanden; 3.652 tests PASS, 8 SKIP, 0 FAIL |
| Payroll D2-/PMUX-gerichte tests | 14 bestanden / 88 tests PASS; Payroll D2 3 bestanden / 11 tests PASS |
| NL Payroll-regels | 6 bestanden / 49 tests PASS |
| Root TypeScript-check | PASS voor HR Suite, Control, Payroll-engine en Payroll-regelpakketten |
| HR Suite production build | PASS; 339 statische pagina's, routes inclusief beide cronroutes |
| Control production build | PASS; 12 pagina's |

De eerste gecombineerde Windows-testsessie raakte een TEMP-permissiefout; de relevante suites en volledige HR Suite zijn daarna direct met een toegestane tijdelijke directory uitgevoerd en slaagden. De builds zijn op de exacte codebaseline SHA `9e2e354422c8b591ed161f58e640de4f913ae4b9` succesvol afgerond.

## GitHub en Vercel

- Vercel-project `liquidhr` (`prj_h3voMtzXGfqG6QTodR5d1VTcC1zP`) meldt effectief `gitProviderOptions.createDeployments: disabled` na expliciete update en API-readback.
- De GitHub-koppeling blijft `EdwinCycling/LiquidHR`, productiebranch `main`. Bestaande projectdomeinen en Production-envmetadata zijn behouden.
- Bestaande READY-rollback blijft `dpl_CuyAgvBwHr5z9bXNv52Np7SaTxb9`, bron-SHA `c0fa236967ec0708c0a57f72e0dfb29b78b3fead`; geen nieuwe deployment of aliaspromotie gestart.
- De eigenaar stuurde expliciet: nog geen deployment. Daarom is er geen deployment-ID voor `1.20261023.1`; hosted runtime-readback en gezamenlijke geauthenticeerde browseracceptatie zijn OPEN.
- De actieve Deploy Hook met onbekende externe caller staat volgens AA-REL apart OPEN/HOLD voor een latere hosted release.

## Overige open punten

- Work-calendar dependency blijft OPEN voor alleen SLA-recepten met `businessDays: true`; validatie blijft fail-closed. Bestaande Leave-recipe en twee-business-day SLA zijn ongewijzigd en niet geactiveerd.
- Geen salarisrun, finalisatie, betaling, aangifte of echte werknemersmutatie uitgevoerd.
- Reële werkgevers-, pensioen- en fiscale toepasselijkheid en R2 bruto-netto zijn afzonderlijke Payroll SOURCE_GAP-vragen.