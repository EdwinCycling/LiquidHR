# PMUX-06B — Herinneringen en escalaties

Datum: 23 oktober 2026
Status: **LOKALE SCHEDULER, SYSTEEMAUTORISATIE EN AFLEVERINGSCONTRACT GEREED; REMOTE ACTIVATIE EN ACCEPTATIE OPEN**
Roadmap: [PMUX geconsolideerde roadmap](PMUX_CONSOLIDATED_ROADMAP_20261022.md)

## Productdoel en capabilitymatrix

Maak PMUX-06A-deadlines opvolgbaar met de bestaande Processtudio, queue, LiquidHR-reminders, assignmentcontracten, audit events en procesprojecties. Deze slice voegt geen tweede workflow- of notificatiesysteem toe.

| Onderdeel | Hergebruikt | Geleverd / resterend |
| --- | --- | --- |
| SLA en versies | Typed slaSchema, compiler, immutable gepubliceerde versies en PMUX-06A opgeslagen deadlines. | Optionele notifications-keuzes binnen hetzelfde SLA-contract; geen wijziging aan bestaande actieve of gepubliceerde versies. |
| Queue en worker | workflow_jobs, PROCESS_REMINDER, worker-locking, retries/backoff, dead-letter, bevoegde heruitvoering en operations-status. | Deterministische BEFORE/AT/BREACH-jobs en periodieke route via dezelfde queue; runtime-aflevering/remote readback blijft OPEN. |
| Ontvangers | process_work_item_candidates, bestaande participant-resolver en actieve employee/user-koppelingen. | Gewone reminders naar actuele eligible kandidaten; escalatie naar gekozen bestaande participant. |
| Levering en projectie | Bestaande reminders, reminder_targets, reminder_recipients, Tijdhub/Focus en procesdetail. | Bestaande /work/<id>-route vanuit reminder; geen nieuwe provider of beheerscherm. |
| Scheduling | Bestaande Vercel Cron-configuratie, CRON_SECRET, server-only Supabase RPC-client en workflow-jobrunner. | `/api/cron/process-automation-reminders` iedere minuut in `vercel.json`; daadwerkelijke activering volgt alleen na een afzonderlijk geautoriseerde deployment. |

## HR Admin-configuratie

Bij een stap met deadline kiest HR Admin:

- Geen of één herinnering vooraf: 1 uur of 24 verstreken uren.
- Wel of geen herinnering op het deadline-instant.
- Bestaande breach-actie: verantwoordelijke informeren, escaleren naar een bestaande participant, of markeren voor procesbeheer.

24 uur is een verstreken interval. Er zijn geen cronexpressies, JSON, vrije ontvangers of nieuwe rollen. Zonder deadline legt de Processtudio uit waarom deadlineherinneringen niet kunnen worden ingesteld. ESCALATE vereist een bestaande participant en gebruikt de bestaande compilervalidatie.

## Servergedrag en autorisatie

- Alleen de opgeslagen PMUX-06A-deadline op het werkitem is bron voor planning. Deze migratie herberekent geen deadline.
- Vooraf-job: deadline minus 1 uur of 24 uur, maximaal direct uitvoerbaar als dat moment al is verstreken. Op-deadline-job: exact deadline. Breach-job: deadline plus 1 seconde.
- Idempotency keys zijn deterministisch per werkitem en gebeurtenistype. Bestaande versies zonder notifications behouden de legacy deadline-job.
- Nieuwe instellingen werken niet terug op al actieve werkitems. Gepubliceerde procesversies blijven immutable.
- Afgeronde/geannuleerde stap, proces of werkitem wordt overgeslagen; de worker maakt dan geen reminder.
- Gewone reminders gebruiken de laatste assignment resolution revision met eligible, actieve employee/user-koppeling. Bij geclaimd werkitem krijgt alleen de claimer de reminder.
- Escalatie resolveert de gekozen participant met dezelfde gepinde versie en tenant-/scopecontext. Geen ontvanger geeft PROCESS_ESCALATION_RECIPIENT_MISSING, zodat de bestaande queue retry/dead-letter kan toepassen.
- De menselijke delivery-RPC vereist bestaande `process-operations:write`. De scheduler gebruikt afzonderlijke service-role-RPC's: alleen due `PROCESS_REMINDER`-jobs worden geclaimd; `FOR UPDATE SKIP LOCKED`, worker-ID-eigenaarschap en de bestaande queue-retry/backoff/dead-letter blijven gelden. De systeemroute kan geen documentjobs claimen.
- De schedulerreminder-RPC vereist `service_role`, geen `auth.uid()` en een actieve `RUNNING`-claim met dezelfde worker-ID. Anon en authenticated hebben geen EXECUTE op systeemwrappers. De bestaande gebruikerspermission is niet verbreed.
- Nieuwe reminders bewaren actorherkomst als `SYSTEM` met `created_by_user_id = null`; events hebben geen menselijke actor-ID en bevatten `executionActor=SYSTEM` en `executionPath=SCHEDULED`. Een gebruikersactie blijft als `USER` geaudit.
- Verouderde claims worden na 15 minuten opnieuw beschikbaar gemaakt. Een crash na remindercreatie is veilig door de bestaande unieke deliveryregistratie en idempotente reminderfunctie.
- Payloads bevatten alleen reminder-eventtype; er worden geen formulier-, salaris-, medische of verborgen waarden meegestuurd. Een reminder opent de bestaande geautoriseerde /work/<id>-route.

## Schedulerconfiguratie en operationele status

De route accepteert uitsluitend `GET` met de bestaande `CRON_SECRET` als exacte Bearer-token. Query/bodywaarden sturen geen tenant, actor, job of worker-ID. De server maakt een eigen UUID en verwerkt maximaal vijf jobs per run. De route gebruikt de bestaande server-only `createAdminRpcClient`; de service key of CRON_SECRET wordt niet gelogd.

`vercel.json` bevat `/api/cron/process-automation-reminders` met `* * * * *` (UTC), passend bij BEFORE/AT/BREACH-due-tijden. Vercel Cron vereist voor intervallen per minuut een Pro- of Enterprise-plan; op Hobby kan dit schema de deployment blokkeren. Het accountplan is hier niet geverifieerd. Bevestig plan en exacte deployed SHA vóór activering. Vercel activeert cronjobs alleen op een production deployment; dit lokale werk heeft geen remote job of deployment gestart. Zie [Vercel Cron-gebruik en prijzen](https://vercel.com/docs/cron-jobs/usage-and-pricing), [schedulerbeheer en beveiliging](https://vercel.com/docs/cron-jobs/manage-cron-jobs) en [cronconfiguratie](https://vercel.com/docs/cron-jobs).

De bestaande workflow_jobs-status, pogingsteller, `available_at`, foutcode en dead-letter vormen de operationele status voor latere PMUX-06C-bewaking. Er komt nu geen extra monitor.

## Acceptatiegrenzen

Lokale Vitest/PGlite- en routeintegratietests voeren de scheduler-handler uit en dekken due claims, exacte BEFORE/AT/BREACH-tijden, service-role-grants, anon-weigering, worker-ID-eigenaarschap, SYSTEM-audit, idempotency, gesloten werkitems, tenantgebonden assignmentselectie, parallelle runners, tijdelijke retry en bestaande dead-letterafhandeling.

**LOCAL SCHEDULER READY / SYSTEM AUTHORIZATION VERIFIED / IDEMPOTENCY VERIFIED / DELIVERY VERIFIED LOCALLY.** Remote migratie/readback, bevestiging van Vercel-plan/secretconfiguratie, daadwerkelijke cronactivatie, geauthenticeerde tenant-/JWT-negatieven, browser- en 390px-acceptatie blijven **OPEN**. Geen externe e-mailprovider, remote databasewrite, remote secretwijziging, deployment, push, merge of PMUX-06C/07-werk hoort bij deze slice.
