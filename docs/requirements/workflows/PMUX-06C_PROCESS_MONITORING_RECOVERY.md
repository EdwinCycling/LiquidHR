# PMUX-06C — Procesbewaking en operationeel herstel

Datum: 23 oktober 2026  
Status: **LOKALE IMPLEMENTATIE EN CONTRACTTESTS GEREED; REMOTE ACCEPTATIE OPEN**  
Roadmap: [PMUX geconsolideerde roadmap](PMUX_CONSOLIDATED_ROADMAP_20261022.md)

## Productdoel

Bevoegde HR Admins vinden vanuit de bestaande Process Automation-beheeromgeving processen en automatiseringen die aandacht vragen. Zij zien in gewone taal wat aandacht nodig heeft en gebruiken uitsluitend herstelacties waarvoor de bestaande servercontracten veilige, geautoriseerde semantiek bieden.

PMUX-06C introduceert geen tweede queue, monitor-engine, procesadministratie, scheduler, actorrol of directe databasebeheerfunctie.

## Capabilitymatrix

| Onderdeel | Bestaande bouwsteen | PMUX-06C-uitwerking |
| --- | --- | --- |
| Proces- en taakstatus | `process_instances`, `process_work_items`, bestaande deadlineprojectie, proceshistorie en audit | Eén operationele inbox toont geblokkeerde processen, achterstallige open taken en automation-jobs met gefilterde totalen en pagina's. |
| Queue en retries | `workflow_jobs`, bestaande workerstatussen, `attempt_count`, `available_at`, retry/backoff en DEAD_LETTER | De workspace leest dezelfde jobs en toont wanneer automatisch opnieuw wordt geprobeerd of handmatige aandacht nodig is. |
| Reminderdiagnostiek | Bestaande `PROCESS_REMINDER`-jobs, reminderleveringen en PMUX-06B.1-scheduler | Herinneringsfouten zijn zichtbaar via de bestaande jobstatus en menselijke probleemtekst; geen reminderduplicaat- of verzendpad toegevoegd. |
| Herstel | Bestaande `requeue_workflow_job(uuid)`-RPC | Alleen dezelfde herstelbare RETRY/DEAD_LETTER-job wordt opnieuw READY gezet; status, scope, jobtype en procescontext worden server-side gevalideerd. |
| Autorisatie en audit | `process-operations:read/write`, bestaande proces-/tenant-/HR-groepsscope en bestaande queue-audit | Lezen is per projectierij gescopeerd; herstelbaarheid wordt server-side per rij bepaald. Rechtstreekse API/RPC-aanroepen blijven begrensd door dezelfde contracten. |
| Presentatie | UX Foundation v1.2 en de bestaande `/settings`-beheeromgeving | Een lijst-eerst-werkplek hergebruikt de Foundation-layouts en componenten; er is geen tweede UI-primitivesysteem toegevoegd. |

## Beheerwerkplek

De pagina `/settings/process-automation/operations` is alleen bereikbaar via de bestaande `process-operations:read`-toegang en toont:

- gefilterde totalen voor geblokkeerde processen, achterstallige open taken, mislukte automatiseringen en geplande retries;
- een doorzoekbare en filterbare lijst met exacte totalen en bestaande paginering;
- proces, stap, status, verantwoordelijke binnen de toegestane scope, deadline, begrijpelijke probleemuitleg en laatste poging;
- probleemdetails, waaronder herstelbaarheid en de gevolgen van opnieuw aanbieden;
- technische foutcode uitsluitend in een uitklapbaar diagnostiekgedeelte.

De projectie retourneert geen jobpayload, formulierantwoord, correlation-id of gevoelige personeelsdata. Als er geen records zijn, toont de pagina een empty state; tijdens ophalen, bij scopeweigering, fout of verouderde resultaten zijn aparte loading/denied/error/stale-staten beschikbaar. NL- en EN-teksten zijn gelijkgetrokken.

## Herstelcontract

De UI verstuurt geen payloadwijzigingen en schrijft geen jobstatus rechtstreeks. Alleen jobs die de serverprojectie als herstelbaar markeert, bieden opnieuw aanbieden aan. Het bestaande `requeue_workflow_job`-contract controleert `process-operations:write`, neemt de bestaande queue-rij onder lock en accepteert alleen RETRY of DEAD_LETTER. Dezelfde jobrij wordt teruggezet naar READY; een tweede herstelpoging op de inmiddels READY-job wordt geweigerd. De SQL-projectie begrenst reminderherstel aanvullend tot de bijbehorende actieve processtap en een open/geclaimd werkitem. Voltooide, geannuleerde of buiten-scope processen bieden geen herstelactie.

Een retry blijft onderworpen aan de bestaande worker-idempotentie, attempt/backoff- en auditcontracten. Als die bestaande voorwaarden herstel niet veilig toestaan, blijft de actie afwezig of geweigerd. Er is geen handmatige statusoverschrijving, actor-impersonatie, gewijzigde queuepayload of tweede businessmutatiepad.

## Autorisatie en privacy

De server controleert `process-operations:read` en `process-operations:write`. SQL-projectie en bestaande herstel-RPC handhaven tenant-, HR-groep-, proces- en actorgrenzen; de UI-knop is geen beveiligingsgrens. Onafhankelijke cross-tenant/cross-HR-groep en ongeautoriseerde retry-tests zijn vereist voor de lokale contractacceptatie. Deze PGlite-tests vervangen geen live Supabase RLS, grants, JWT of rolreadback.

Foutcodes worden alleen getoond voor bevoegde gebruikers in de diagnostieksectie. Algemene meldingen bevatten geen rauwe foutdetails. Workflowpayloads en gevoelige formulierwaarden verlaten de databaseprojectie niet.

## Vercel-minutecron: statische operationele randvoorwaarden

`vercel.json` plant `/api/cron/process-automation-reminders` met `* * * * *` (UTC). Vercel-documentatie geeft voor Hobby maximaal één uitvoering per dag met uurprecisie; Pro en Enterprise ondersteunen intervallen per minuut met minuutprecisie. De configuratie is dus alleen geschikt voor activatie op een Pro- of Enterprise-project. Het daadwerkelijk gekoppelde projectplan is lokaal niet geverifieerd.

`CRON_SECRET` moet als server-side environment variable op het juiste project/deploymenttarget bestaan en als gevoelige waarde worden beheerd. De route geeft `503` als deze ontbreekt en `401` bij een onjuiste Authorization-header. Geen secretwaarde hoort in logs, evidence of clientcode.

Vercel registreert cronjobs op de Production deployment. Daarom vereist activering een afzonderlijk geautoriseerde Production-targetdeployment; deze lokale wijziging heeft geen instelling gewijzigd of deployment gestart. Een echte cronrun en de bestaande Production-targetconfiguratie zijn niet bewezen.

Vercel herhaalt een mislukte croninvocatie niet automatisch. Operations controleert de Cron Jobs-weergave en de View Logs-runtimefilter voor `/api/cron/process-automation-reminders`; daarna blijft queueherstel via de bestaande workflow retry/dead-letter-status lopen. De jobworker verwerkt maximaal vijf due jobs per invocation. Bij één succesvolle invocation per minuut is 300 jobs per uur slechts de theoretische bovengrens; werkelijke capaciteit hangt af van uitvoeringstijd, function limits, databasebelasting, locks en eventuele overlap. Vercel kan een tweede invocatie starten als de vorige langer duurt dan het interval. De applicatie heeft daarom nog geen bewezen duurzame throughput/SLO of automatische backlog-alert: bewaak READY/RETRY due-count, oudste `available_at`, DEAD_LETTER-aantal, invocationfouten en looptijd. Geen remote capaciteitstest of operationele alertconfiguratie is in PMUX-06C uitgevoerd.

Referenties: [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Vercel Cron management, security and errors](https://vercel.com/docs/cron-jobs/manage-cron-jobs) en [Vercel Cron overview](https://vercel.com/docs/cron-jobs). Deze openbare planregels zijn op 23 oktober 2026 statisch gecontroleerd; het accountplan en de remote secretconfiguratie blijven onbevestigd.

## Foundation en toegankelijkheid

De werkplek gebruikt de bestaande `PageShell`, `PageHeader`, `CollectionToolbar`, `FilterBar`, `DataTableShell`, `Badge`, `Surface`, `Button`, `Dialog`, `EmptyState`, `TextInput`, `DropdownSelect` en `Pagination`. Er zijn geen generieke UI-primitives, nieuwe shadows, hardcoded kleuren of card-on-card-opbouw toegevoegd.

Labels, foutmeldingen, empty states en statussen zijn in NL/EN beschikbaar. Semantische tabellen/lijsten en benoemde controls ondersteunen toetsenbordgebruik; definitieve focus- en schermlezertests plus desktop- en 390px-viewportacceptatie vereisen een bestaande geautoriseerde browser-/actorcontext en blijven OPEN.

## Acceptatiegrenzen

Lokale acceptatie dekt lege/volle inbox, blokkades, achterstallige taken, RETRY en DEAD_LETTER, filters en totalen, privacy, tenant- en HR-groepsisolatie, proces-/stapeligibility, ongeautoriseerde en herhaalde retry en hergebruik van de bestaande queue-rij. Regressies voor PMUX-05B/C en PMUX-06A/B/B.1 blijven onderdeel van de gerichte run.

**LOKAAL GEREED; REMOTE ACCEPTATIE OPEN.** Sluit remote gates alleen met afzonderlijk mandaat: migratietoepassing en readback, live actor-/tenant-/HR-groep-proeven, bestaande geautoriseerde HR Admin-browserinteractie op desktop/390px, Vercel Pro/Enterprise en `CRON_SECRET`-readback, Production-targetactivatie en monitoring van echte cron-/queuecapaciteit. PMUX-07 blijft buiten deze scope.
