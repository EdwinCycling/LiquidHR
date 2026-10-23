# PMUX-06B.1 — lokale scheduleracceptatie

Datum: 23 oktober 2026
Branch: `work/BRANCH-SPLIT-PMUX-20261021`
Uitgangs-HEAD: `9ba08f67662362ba40fea88f43b191232cabc59e`
Status: **LOCAL SCHEDULER READY / SYSTEM AUTHORIZATION VERIFIED / IDEMPOTENCY VERIFIED / DELIVERY VERIFIED LOCALLY; REMOTE ACTIVATION OPEN**

## Hergebruikte bouwstenen

- Bestaand typed `slaSchema`, compiler, immutable procesversies en gematerialiseerde PMUX-06A-deadlines.
- Bestaande `workflow_jobs`-queue, `PROCESS_REMINDER`-jobtype, worker-locks, retry/backoff, dead-letter en herstel na verlopen lock.
- Bestaande `create_process_deadline_reminder`-businesslogica, idempotencyregistratie `process_reminder_deliveries`, huidige assignmentresolver en escalation-participantresolver.
- Bestaande `reminders`, recipients/targets, append-only procesevents, `createAdminRpcClient`, Vercel Cron en `CRON_SECRET`-patroon van recruitmentretentie. Recruitmentretentie zelf is niet gewijzigd.

Er is geen tweede queue, reminderbron, workflowengine, externe provider, browserpoller, logininfrastructuur of beheerscherm toegevoegd. RLS- en gewone gebruikerspermissions zijn niet verruimd.

## Lokale implementatie

- `GET /api/cron/process-automation-reminders` weigert ontbrekende/verkeerde Bearer-authenticatie en leest geen tenant-, actor- of job-ID uit requestinput.
- `vercel.json` plant de route elke minuut in UTC. De handler start dezelfde gedeelde queueworker; die maakt zelf een worker-ID en verwerkt maximaal vijf jobs.
- Aparte, niet-publieke service-role-RPC's claimen/finishen alleen due `PROCESS_REMINDER`-jobs. Claim gebruikt `FOR UPDATE SKIP LOCKED`; remindercreatie vereist `RUNNING` plus dezelfde `locked_by` worker-ID. De systeemroute kan geen documentoutputjobs claimen.
- Vervallen claims worden na 15 minuten herstelbaar. Tijdelijke fouten volgen de bestaande retry/backoff; pogingen blijven begrensd en kunnen dead-letter worden.
- De bestaande reminderfunctie blijft eigenaar van assignmentcontrole, tenantcontext, suppressie bij afgesloten taken, escalatie en idempotency. Herhaling na een crash maakt geen tweede delivery of audit-event.
- `reminders.created_by_actor_type` maakt `USER` versus `SYSTEM` expliciet. Systeemreminders hebben `created_by_user_id = null`; systeemevents bewaren geen menselijke actor-ID en labelen `executionActor=SYSTEM`, `executionPath=SCHEDULED`.
- Queue `status`, attempts, `available_at`, foutcode en dead-letter blijven operationele status voor toekomstige PMUX-06C-bewaking.

## Lokale testbewijzen

| Controle | Resultaat |
| --- | --- |
| Worker + route-integratie + PGlite-migratiecontract | **PASS — 3 testbestanden, 13 tests** |
| Scheduler GET met ontbrekende Bearer | **PASS — 401; service client niet aangemaakt** |
| Echte route-handler tot worker-RPC-sequentie | **PASS — claim → bestaande reminderdelivery → finish; geen gebruikerssessie** |
| Periodieke configuratie | **PASS — test leest de route en minuutcron uit `vercel.json`** |
| PGlite SQL-migratie | **PASS — exacte BEFORE/AT/BREACH-tijden, due-only claim, PROCESS_REMINDER-begrenzing, lockeigenaarschap, SYSTEM-attributie, replay, gesloten taak, tenant-/assignmentcontext en grants** |
| Parallelle scheduled runners | **PASS — één mock-queueclaim/delivery voor dezelfde due job** |
| Bestaande retry en dead-letter regressie | **PASS — bestaande worker-tests op gedeelde runner** |
| TypeScript `npm run type-check` | **PASS** |
| Gewijzigde bestanden ESLint | **PASS — geen meldingen** |
| NL/EN `check:i18n` | **PASS — 43 namespaces, gelijke keys** |
| `git diff --check` | **PASS — staged changes** |

Gerichte testopdracht: `npm run test --workspace @liquid-hr/hr-suite -- --testTimeout=20000 lib/process-automation/workflow-job-service.test.ts app/api/cron/process-automation-reminders/route.test.ts supabase/migrations/20261023083349_pmux06b_process_reminders_escalations.contract.test.ts`.

## Remote en browsergates

Geen remote migratie, schema/databasewrite, remote secretwijziging, Vercel-cronactivatie, push, merge of deployment uitgevoerd. De lokale migratie is forward-only en met PGlite uitgevoerd.

Vercel Cron met `* * * * *` vereist volgens de huidige platformdocumentatie Pro/Enterprise; het accountplan is niet vastgesteld. Bevestig dit en de bestaande `CRON_SECRET`-configuratie voordat een aparte deployment wordt geautoriseerd. Vercel activeert cron alleen op een production deployment; minute-cron kan niet op Hobby worden gedeployed. Zie [Vercel Cron-gebruik en prijzen](https://vercel.com/docs/cron-jobs/usage-and-pricing) en [cronbeheer/beveiliging](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

**OPEN:** remote schema/grants/readback, plan- en secretconfiguratie, exacte deployed SHA, echte periodieke invocation en delivery, live JWT/RLS/recipientnegatieven, desktop- en 390px-browseracceptatie. Lokale route-/SQL-tests bewijzen deze externe gates niet.

## Commits

Implementatiecommit: `063d9e6643958d35e2f4a767d49a7d85b27678d8`.
