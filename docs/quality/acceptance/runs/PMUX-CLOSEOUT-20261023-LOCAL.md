# PMUX-CLOSEOUT — Definitieve integratieoverdracht

Datum: 2026-10-23
PMUX-worktree: C:\Users\Edwin\.codex\worktrees\branch-split-pmux-20261021\LiquidHR
Branch: work/BRANCH-SPLIT-PMUX-20261021
PMUX-HEAD vóór dit rapport: 6cb0d459ce4b43ea2dec1f9a71cab784b0827731
Vastgestelde strategie: PMUX afronden → Payroll afronden → één gecontroleerde gezamenlijke merge → één LiquidHR TEST-release op Vercel → gebruikersacceptatie → gecontroleerde cleanup.

## Eindoordeel

| Gate | Status | Bewijs en grens |
|---|---|---|
| PMUX FUNCTIONAL LOCAL READY | **GO** | PMUX-02 t/m PMUX-07A lokaal aanwezig. Bestaand bewijs: PMUX-suite 206/206 tests, met 35/35 gerichte 06C/07A-SQL-RPC-regressies; TypeScript, gerichte ESLint, i18n en safe-runtime-preflight groen. Geen echte rol-/browseracceptatie. |
| PMUX CODE MERGE CANDIDATE | **HOLD** | Geen lokaal productdefect dat de afgesproken reis blokkeert vastgesteld. Remote main is nieuwer dan de branchbasis, vier AA-documenten overlappen Payroll en gecombineerde kandidaatchecks ontbreken. |
| PMUX TEST MIGRATION GATE | **HOLD** | Acht PMUX-migraties ontbreken op TEST; backup/restore is niet bewezen en alle vijf deadlinezones vereisen eigenaarbevestiging. |
| BACKUP/RESTORE VERIFIED | **HOLD** | Geen export of restoreproef. Op deze Windows-machine zijn geen PostgreSQL/Supabase-clienttools gevonden; de gedocumenteerde Supabase CLI-backuproute vereist Docker. |
| TIMEZONES VERIFIED | **HOLD** | Europe/Amsterdam staat in AI-creditconfiguratie, maar dat is geen canonieke HR-/deadlineconfiguratie. De eigenaar moet de juiste zone voor alle vijf groepen bevestigen. |
| AUTHENTICATED E2E | **OPEN** | Geen volledige browserreis met echte HR Admin-, Employee-, Manager- én HR-JWT's. Een reguliere HR-verwerkeridentiteit is niet bevestigd. |
| VERCEL RELEASE READY | **HOLD** | Geen TEST-migraties/readback, gecombineerde kandidaat, CRON_SECRET-/planreadback of releaseautorisatie. Geen cron/deployment geactiveerd. |

## 1. PMUX-FINAL-01 en lokaal bewijs

De bestaande PMUX-implementatie ondersteunt de afgesproken reis: HR Admin ontwerpt en publiceert een immutable versie; Employee start, bewaart en dient in; Manager behandelt alleen toegewezen werk en kan wijzigingen vragen of besluiten; toegewezen HR kan de laatste stap afronden; historie, SLA/reminders, Operations en geaggregeerde Insights gebruiken dezelfde procesregistratie. Opleidingsaanvraag blijft de synthetische acceptatiecase.

PMUX-06C Operations en PMUX-07A Insights zijn lokaal gereed. De 06C/07A SECURITY DEFINER-wrappercorrecties en service-role-schedulergrens zijn lokaal verwerkt; de opgegeven regressie is 35/35 groen. De PMUX-suite telt 206/206 tests over 42 bestanden. Parallelle PGlite-time-outs zijn in acht migratiecontractbestanden serieel herhaald en de 35 betrokken tests slaagden. TypeScript, gerichte ESLint, check:i18n en safe preflight op poort 3011 slaagden.

In deze closeout is geen productcode gewijzigd; tests zijn daarom niet opnieuw uitgevoerd. De 3011-preflight bewijst geen gestarte server of browserreis. Volledige end-to-end-, desktop- en 390px-acceptatie ontbreekt.

## 2. TEST-history en migratievolgorde

Read-only Supabase-history eindigt op 20261021143000 / pmux03a_ess_process_start_catalog. De volgende acht versies ontbreken. De oude PMUX-03A-verwijzing in AA-OPEN is gecorrigeerd; migratiehistory is niet aangepast.

| Volgorde | Exacte migratie | Wijziging en voornaamste postmigratierisico |
|---|---|---|
| 1 | 20261021160000_pmux03b_process_work_experience.sql | Gescopeerde Manager/HR-werkdetailprojectie. Test toegewezen case, cross-group/tenant-weigering en publieke wrapper. |
| 2 | 20261022203000_pmux05_form_condition_draft_save.sql | Conditionele conceptsave en actieve antwoorden. Controleer save/heropen, finale required-validatie, verborgen oude waarden en behoud van revisie-/publicatiehistorie. |
| 3 | 20261023054930_pmux05_step_participant_field_access.sql | Veldrechten per actieve stap, deelnemer en veld; ontbrekende tuples falen gesloten. Verplicht: echte JWT-negatives voor hidden read/write, actor en cross-scope. |
| 4 | 20261023072351_pmux06a_materialize_process_sla_deadlines.sql | Voegt hr_groups.time_zone toe en materialiseert deadline_at bij stapactivatie. De vijf bestaande groepen krijgen de database-default Europe/Amsterdam; eigenaar heeft die niet bevestigd. Bestaande deadlines worden niet herberekend. |
| 5 | 20261023083349_pmux06b_process_reminders_escalations.sql | SLA-reminderjobs, afleveringen en idempotente triggers. Controleer bestaande jobs/reminders, due-time, duplicaten en onverwachte afleveringen. |
| 6 | 20261023104819_pmux06b1_process_reminder_system_scheduler.sql | Scheduler-RPC-wrappers. Lokaal eisen wrappers JWT-role service_role én auth.uid() IS NULL; EXECUTE is ingetrokken voor PUBLIC/anon/authenticated en verleend aan service_role. Live grants/owner/deny-proeven zijn niet bewezen. |
| 7 | 20261023112158_pmux06c_process_operations_workspace.sql | Gescopeerde Operations-inbox en bestaande retry-transitie. Controleer scope/paginering, payloadlekkage en dat retry uitsluitend de toegestane requeue_workflow_job-transitie gebruikt. |
| 8 | 20261023131000_pmux07a_process_insights.sql | Indexen en read-only geaggregeerde projectie. Controleer HR-groepsscope, directe RPC-denial en afwezigheid van individuele prestatie-indicatoren. |

De migraties zijn forward-only en lokaal per migratie getest. Een volledige schone PGlite-replay van alle acht als één keten ontbreekt. Op TEST geen migraties voordat backup/restore, timezonebesluiten en expliciete TEST-changeautorisatie groen zijn.

## 3. HR-groepen en deadlinetijdzones

Read-only TEST-inventarisatie: project wnpfloqpjvaacobppbpk, PostgreSQL 17.6.1.141 / engine 17. hr_groups heeft nog geen time_zone-kolom; alle vijf groepen zijn actief. De 06A-migratie documenteert dat de AI-creditzone afzonderlijk is van HR-deadlines.

| Organisatie | HR-groep / administratie(s) | Betrouwbare algemene HR-zone | AI-creditconfiguratie | Bevestiging vóór eerste SLA-start |
|---|---|---|---|---|
| CONTROL01 Test BV | Hoofdadministratie HR-groep / Hoofdadministratie | Niet aangetroffen | Actief beleid Europe/Amsterdam; 0 allocation-rijen | **Ja** |
| De Sterren holding | Planeten / Jupiter BV, Mars BV, Mercurius BV | Niet aangetroffen | Actief beleid Europe/Amsterdam; 3 allocations met Europe/Amsterdam | **Ja** |
| De Sterren holding | Stap 6 testgroep meerdere autorisaties / DGA administratie | Niet aangetroffen | Actief beleid Europe/Amsterdam; 2 allocations met Europe/Amsterdam | **Ja** |
| De Sterren holding | TEST (leeg) / Test BV | Niet aangetroffen | Actief beleid Europe/Amsterdam; 1 allocation met Europe/Amsterdam | **Ja** |
| Noorderlicht Zorggroep | Noorderlicht Zorggroep HR-groep / Noorderlicht Zorg B.V. | Niet aangetroffen | Actief beleid Europe/Amsterdam; 0 allocation-rijen | **Ja** |

Normale route vóór deadlineprocesstart: eigenaar bevestigt per groep de zakelijke IANA-zone; na schema- en apprelease gebruikt HR Admin met bestaande hr-group:manage-rechten Instellingen → HR-groepen, slaat de bevestigde zone op en leest de vijf waarden via dezelfde beheerroute terug. Start geen proces met kalenderdag-SLA voordat de betrokken zone is bevestigd en teruggelezen. Er zijn geen HR-groepen aangepast.

## 4. Backup- en herstelroute

TEST staat op het Supabase Free-plan. Supabase documenteert automatische dagelijkse databasebackups voor betaalde plannen; Free-projecten worden verwezen naar eigen CLI-export en off-site backup ([Supabase database backups](https://supabase.com/docs/guides/platform/backups)). De officiële CLI-stappen vereisen Docker Desktop en PostgreSQL/psql-clients ([Supabase backup/restore CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)). psql, pg_dump, pg_dumpall, pg_restore en supabase zijn lokaal niet beschikbaar. Er zijn geen credentialwaarden gelezen en geen tools geïnstalleerd. Er is dus nu geen uitvoerbare, gevalideerde export/restore op deze machine.

TEST draait PostgreSQL 17.6.1.141. PostgreSQL 17-clients zijn passend; pg_dump kan niet dumpen van een server met een nieuwere major-version dan zijn eigen ([PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)). pg_dumpall omvat clusterbrede rollen maar vereist doorgaans superuserrechten, die voor managed Supabase niet mogen worden verondersteld ([PostgreSQL 17 pg_dumpall](https://www.postgresql.org/docs/17/app-pg-dumpall.html)).

Toekomstige route, alleen na afzonderlijke autorisatie en beveiligde connectie van de TEST-eigenaar:

1. Voer de Supabase-ondersteunde CLI-route uit op een geautoriseerde Windows-host met Docker Desktop en PostgreSQL 17-clients. Bewaar de connection string alleen in de beveiligde sessie. Supabase gebruikt standaard de Session Pooler; direct connect alleen wanneer de netwerkroute dit ondersteunt.
2. Maak gescheiden rollen-, schema- en dataexports met de actuele Supabase CLI-instructies. Exporteer supabase_migrations-schema en -data afzonderlijk als naar een nieuw project wordt hersteld.
3. Inventariseer extensies, webhooks, publicaties, auth/storage-customizations, custom login-rollen en Storage-buckets. Database-export bewaart Storage-metadata, geen Storage API-bestanden. Kopieer objecten apart via de goedgekeurde Storage-route. Controleer eventueel Vault/column encryption en encryption-root-key vereisten.
4. Hash de exportbestanden en controleer ze met restore-diagnostiek. Herstel uitsluitend naar een lege, geïsoleerde PostgreSQL 17/Supabase-target, nooit over gedeelde TEST. Gebruik gedocumenteerde psql-restore met ON_ERROR_STOP in één transactie; configureer vereiste extensies/webhooks en herstel migratiehistory en auth/storage-customizations afzonderlijk. Custom role-wachtwoorden vereisen apart beheerd reset.
5. Vergelijk schema, relevante aantallen, RLS/policies, grants/eigenaren, SECURITY DEFINER/search_path, migration versions, extensies/webhooks, Auth-inventaris en Storage-bucket/object-aantallen. Laat de eigenaar de geïsoleerde restore functioneel valideren. Pas dan is BACKUP/RESTORE VERIFIED GO.

Een ruwe pg_dump of alleen een exportbestand is geen GREEN. De restore is niet uitgevoerd; upgrade, toolinstallatie, nieuw Supabase-target en databasewrites vallen buiten deze opdracht.

## 5. Authenticated postmigratiematrix

Gebruik uitsluitend bestaande reguliere TEST-identiteiten met hun feitelijke tenant-, HR-groep-, administratie-, employee- en teamscope. Bestaande role-switcherbronnen noemen hr-admin, manager en employee, maar bewijzen geen JWT-scope of volledige browseractie. Een reguliere HR-verwerkeridentiteit is niet bevestigd. Maak geen gebruiker, role-switcher, impersonatie of permissie-uitbreiding.

| Rol | Positieve Opleidingsaanvraagproef | Verplichte negatieve scopeproef |
|---|---|---|
| HR Admin | Draft/stappen/deelnemers/formulier/voorwaarden/veldrechten instellen, Procesproef, immutable versie publiceren, Operations en geaggregeerde Insights openen. | Andere tenant/groep/administratie, forged IDs, private helper, andermans actie en verborgen veld lezen/schrijven. |
| Employee | Eigen gepubliceerde aanvraag starten, concept opslaan/heropenen, indienen, wijzigingsverzoek verwerken, opnieuw indienen en eigen historie lezen. | Unpublished/foreign proces, andermans case, verborgen of Manager/HR-only veld, vervalste actor/stap. |
| Manager | Alleen toegewezen/team-scope werk openen, historie bekijken, wijzigingen vragen en geldige herindiening besluiten. | Andere teams/groepen/tenant/cases of vreemde IDs; geen HR Admin/publicatierechten. |
| HR-verwerker | Toegewezen HR-stap binnen bestaande scope beoordelen/afronden; historie/audit, deadline/reminder en Insights teruglezen. | Niet-toegewezen case, andere groep/tenant of beheer buiten bestaande rechten. |

Daarnaast: positieve scheduler-run als service_role en expliciete anon/authenticated/gewone-user RPC-weigering; controleer idempotentie en job-readback. Valideer historie/audit van start, save, submit, change request, approve en complete, naast deadline, reminders, Operations retry en Insights van dezelfde instantie. Geen JWT-acceptatie uitvoeren zolang TEST-migraties ontbreken.

## 6. Payroll/main handoff en Vercel

| Basis | Read-only status |
|---|---|
| PMUX | work/BRANCH-SPLIT-PMUX-20261021, HEAD 6cb0d459ce4b43ea2dec1f9a71cab784b0827731. PMUX-INT-02 evidence commit 35cce86b09e5c26ef3fa73a7cface6c296aaebc0. |
| Payroll | work/BRANCH-SPLIT-PAYROLL-20261021, HEAD 86386eed7dc41a8e11c8469614bb4d5706719fd9. Worktree niet gewijzigd. |
| main | lokale HEAD 602ba2376ab453248f4d5f7121b2d35cb227b2d4; live origin/main read-only gemeten op 77c9bd548af224c040af788ec7e041494ff8924b. Main-worktree niet gewijzigd. |
| Gemeenschappelijke basis | 14803473c1157285b52cc234fbb6ac70860e9eb1. |

Integratiepunten:
- Exacte committed file-overlap tussen PMUX en Payroll vanaf de gemeenschappelijke basis: docs/AA/AA-ACCEPT.md, AA-CURRENT.md, AA-NEXT.md en AA-OPEN.md. Los inhoudelijk op; kies niet blind één kant.
- PMUX wijzigt apps/hr-suite/package.json (Next.js 16.4.0 → 16.4.2), package-lock.json (+219 regels) en packages/db/types.ts (+62 regels). Payroll staat op Next.js 16.4.0; beide gebruiken PostCSS 8.5.24. Behoud Next.js 16.4.2 en valideer/regeneer de lockfile op de exacte gecombineerde kandidaat.
- PMUX wijzigt vercel.json: deploymentEnabled=false; nieuwe cron /api/cron/process-automation-reminders elke minuut naast recruitment-retention dagelijks. Nieuwe serverroutes: /api/cron/process-automation-reminders, /api/process-automation/operations, /api/process-automation/studio en /api/processes/start. HR-group routes ondersteunen timezonebeheer. Geen PMUX-productroute overlapt Payroll-productcode.
- Shared schema/contracts: hr_groups.time_zone; deadline_at op process_step_instances/process_work_items; reminder/workflow-job-keten; SECURITY DEFINER private helpers met lege search_path en beveiligde wrappers; Operations inbox/requeue en aggregate Insights. De gecontroleerde Payroll-broncode consumeert hr_groups.time_zone niet.
- Cron-route controleert Authorization: Bearer CRON_SECRET; ontbrekende secret geeft 503 en mismatch 401. Vercel registreert crons na deployment. Volgens de actuele Vercel-documentatie kan Hobby alleen dagelijks plannen; deze minuutfrequentie vraagt Pro/Enterprise ([Vercel Cron-beheer en beveiliging](https://vercel.com/docs/cron-jobs/manage-cron-jobs)). Projectplan en secret-aanwezigheid zijn niet geverifieerd; secretwaarden zijn niet gelezen. Later: controleer via bestaande Vercel-configuratie de juiste synthetic TEST-target, plan en CRON_SECRET zonder waarde te tonen; activeer pas bij expliciete TEST-release en lees één gecontroleerde run terug.

Beschermde lokale wijzigingen, door deze closeout niet aangepast:
- PMUX: apps/hr-suite/next-env.d.ts; PMUX-04-20261021-TEST-ACCEPTANCE.md; PMUX-04-20261021-TEST-ACCEPTANCE/PMUX-04R4-ROLE-SWITCHER-INDEX.md; PMUX-04R8-20261022-BROWSER-RESULTS.md.
- Payroll: apps/hr-suite/next-env.d.ts.
- main: apps/hr-suite/lib/workforce-tools/mcp/focus-widget-resource.ts.
- PMUX-04- en next-env-hashes zijn vóór opslag gelezen en worden erna gecontroleerd.

Voor gezamenlijke TEST-release: reconcileer eerst met live main-SHA; combineer daarna de afgeronde Payroll-branch met deze exacte PMUX-kandidaat; los de vier AA-conflicten op; behoud Next 16.4.2 en DB-types; voer op de gecombineerde kandidaat CONTROLLED-tests, type/lint/i18n, production-build, Supabase advisors en migratiecontractchecks uit. Pas na backup/restore-GO, eigenaarbevestigde zones, de acht geautoriseerde TEST-migraties/readback en echte rol-/browseracceptatie kan releaseautorisatie volgen. Dit rapport voert geen van die remote stappen uit.

## 7. Roadmap na de E2E-gate

PMUX-07A Insights en PMUX-06C Operations zijn lokaal gereed. Resterende PMUX-07-roadmap los van de E2E-gate: verdere ESS/MSS/Focus-integratie, mobile-first formulierafwerking, visuele route-/statusweergave, dashboard-integratie en handmatige UX-review. E2E en releasevoorbereiding zijn acceptatiestappen, geen productfeatures. Scopegebonden herverdeling, uitval van Manager/behandelaar en operationele prognoses blijven daarnaast latere PMUX-06-capabilities.

## Afgeronde grenzen

Geen productcodefix of nieuwe feature, remote databasewrite/migratie, credential- of secretswijziging, cronactivering, push, merge, deployment, branch/agent of cleanup. PMUX-03A-history bleef intact. Stop na deze overdracht.
