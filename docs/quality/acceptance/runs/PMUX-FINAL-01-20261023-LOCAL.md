# PMUX-FINAL-01 — lokale functionele closeout

Datum: 2026-10-23
Worktree: `C:\Users\Edwin\.codex\worktrees\branch-split-pmux-20261021\LiquidHR`
Branch: `work/BRANCH-SPLIT-PMUX-20261021`
Codebasis: `94cdc8da8a752b834dc1793e762f575d9f0f7277`; daarop staan al branch-documentatiecommits. De bestaande functionaliteits- en testcommits blijven intact.

## Besluit

| Gate | Status | Bewijsgrens |
|---|---|---|
| PMUX FUNCTIONAL LOCAL READY | **YES — code en lokale contracten** | PMUX-02 t/m PMUX-07A zijn lokaal aanwezig; gerichte migratie-, applicatie- en SQL-contracttests zijn groen. Dit is geen browser- of rolacceptatie. |
| PMUX CODE MERGE CANDIDATE | **HOLD** | Geen defect in de gecontroleerde lokale PMUX-contracten vastgesteld. De branch moet nog tegen de actuele remote `main` (`77c9bd548af224c040af788ec7e041494ff8924b`) worden gereconcilieerd; gecombineerde kandidaatgates ontbreken. |
| PMUX TEST MIGRATION GATE | **HOLD** | Acht migraties ontbreken op TEST. Er is geen geverifieerde back-up/herstelproef en geen volledige schone replay van de acht migraties als één keten. |
| BACKUP/RESTORE VERIFIED | **NO** | Geen pre-migratie-export of herstelproef aangemaakt. |
| TIMEZONES VERIFIED | **NO** | De migratie geeft bestaande groepen standaard `Europe/Amsterdam`; de bedoelde zone per groep is niet bevestigd. |
| AUTHENTICATED E2E | **OPEN** | Geen volledige proef met bestaande HR Admin-, Employee-, Manager- én HR-identiteiten in browser. Een reguliere HR-verwerkeridentiteit is niet bevestigd. |
| VERCEL RELEASE READY | **NO** | Geen TEST-migratie, release, scheduleractivatie, secretsreadback of echte cronrun. |

## Scope en lokaal bewijs

De bestaande branch bevat de volledige PMUX-02 t/m PMUX-07A-implementatie. PMUX-06C gebruikt bestaande Foundation-patronen voor de scoped operations-inbox en geautoriseerde retry. PMUX-07A levert alleen geautoriseerde, geaggregeerde Insights. De SECURITY DEFINER wrappers van PMUX-06C/07A zijn bijgewerkt zodat publieke entrypoints via private helpers lopen; scheduler-RPC-wrappers zijn lokaal beperkt tot `service_role`, met controle op JWT-role en ontbrekende user-UID. Dit bewijst de lokale contracten, niet de live functie-eigenaar, grants of effectieve JWT/RLS-grens in Supabase TEST.

Lokale checks op de codebasis:

- PMUX-gerichte suite: **206/206 tests**, 42 bestanden. Dertien parallelle PGlite-time-outs zijn daarna in de bestaande acht migratiecontractbestanden serieel herhaald; die 35 tests slaagden.
- TypeScript `tsc --noEmit --incremental false`: PASS.
- Gewijzigde PMUX-/HR-group ESLint-controle: PASS.
- `check:i18n`: PASS; NL/EN hebben 43 gelijke namespaces.
- Safe-runtime preflight op poort 3011: PASS; configuratievelden en dependencies gecontroleerd zonder waarden te tonen. Geen server gestart en geen browserroutes bewezen.
- De migraties zijn afzonderlijk contractgetest; één schone PGlite-replay van de volledige acht-migratieketen is niet uitgevoerd.
- Geen productcodefix bleek noodzakelijk voor de lokale contractgate. Dit rapport en AA-indexcorrecties zijn documentatie.

## Migraties: TEST mist deze acht

Volg deze timestampvolgorde; PMUX-03A `20261021143000` staat al in de actuele read-only TEST-history. De eerder in AA genoemde `20261021182957` was onjuist; er is geen history-repair nodig.

| Volgorde | Migratie | Lokale inhoud en compatibiliteit | Concreet risico / vereiste readback |
|---|---|---|---|
| 1 | `20261021160000_pmux03b_process_work_experience.sql` | Read-only Manager/HR-werkprojectie, vast aan bestaande scopehelpers en immutable procesversie. | Live rol-/groep-/tenant-scope en grants zijn niet bewezen; test alleen bestaande toegewezen cases en negatieve vreemde IDs. |
| 2 | `20261022203000_pmux05_form_condition_draft_save.sql` | Laat onvolledige conditionele concepten toe; finale validatie vereist zichtbare verplichte velden; verborgen oude waarden verdwijnen uit actieve antwoorden maar blijven in revisiehistorie. | Controleer save/reopen, final-validation en historische revisies; geen onbedoelde wijziging van gepubliceerde versies. |
| 3 | `20261023054930_pmux05_step_participant_field_access.sql` | Rechte tuple is actieve stap plus deelnemer; ontbrekende tuple faalt gesloten. Lokaal getest op HIDDEN/READ/WRITE/WRITE_REQUIRED en actor-/tenantgrenzen. | Hoog securityrisico bij scopefout: negatieve hidden-field read/write en cross-tenant/groep-proeven met echte JWT's zijn verplicht. |
| 4 | `20261023072351_pmux06a_materialize_process_sla_deadlines.sql` | Materialiseert deadlines bij activering op basis van gepinde definitie en groepstijdzone. | Voegt `hr_groups.time_zone text not null default 'Europe/Amsterdam'` toe. De vijf bestaande TEST-groepen krijgen die default; bedoeld lokaal tijdzonebeleid is onbekend. Geen backfill van bestaande workitems. Lees alle vijf waarden terug en bevestig ze met de eigenaar vóór SLA-acceptatie. |
| 5 | `20261023083349_pmux06b_process_reminders_escalations.sql` | Herinneringsjobs en delivery-/idempotentiecontract na deadline-/SLA-laag. | Controleer job-eligibility, duplicate prevention, due-time en dat bestaande reminders niet onverwacht opnieuw worden verstuurd. TEST-readback telde 38 reminder records en 0 deliveries vóór deze migratieketen. |
| 6 | `20261023104819_pmux06b1_process_reminder_system_scheduler.sql` | Systeemworker-wrapper voor de reminderqueue. | SECURITY DEFINER/service-role-grens is lokaal getest; live EXECUTE-grants, owner, JWT-claims en anon/authenticated-weigering ontbreken. Alleen service-role wrapper mag de worker uitvoeren. |
| 7 | `20261023112158_pmux06c_process_operations_workspace.sql` | Scoped operations-projectie en veilige retry via bestaande geautoriseerde requeue-transitie. | Controleer geen payload-/PII-lekkage, correcte paginatie/scope en dat een retry geen job buiten de bestaande transitie forceert. |
| 8 | `20261023131000_pmux07a_process_insights.sql` | Read-only, geaggregeerde procesvolumes, doorlooptijd, eerste-claim-wachttijd en SLA-projecties. | Controleer tenant-/HR-groepsscope, geen individuele prestatie-indicatoren en geen toegang via directe ongeautoriseerde RPC. |

De lokale migratiecontracten volgen bestaande helpers en geen nieuwe rechtenfallback. De nieuwe `time_zone`-kolom wordt ook geselecteerd door bestaande HR-group contextcode; de gecontroleerde Payroll-broncode consumeert deze kolom niet. Dit is een statische impactcontrole, geen volledige regressieacceptatie voor andere modules. Geen remote schemawijziging, grant, user of migration-history-wijziging is uitgevoerd.

## Back-up, herstel en gecontroleerde validatie

De actuele Supabase TEST-projectplanstatus is Free; er is geen automatische backup of restorebewijs uit deze taak. Supabase beschrijft dagelijkse automatische backups voor betaalde plannen; voor Free noemt de documentatie een eigen CLI-dump/offsite-backup. Het Supabase CLI-backup/restorepad vereist lokale tooling, waaronder Docker/psql; deze repo-instructies verbieden Docker/WSL-workarounds. Zie [Supabase backups](https://supabase.com/docs/guides/platform/backups) en [Supabase CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Voor de latere gecontroleerde TEST-migratie:

1. Laat de TEST-eigenaar vóór de change een ondersteunde volledige backup/export maken naar goedgekeurde externe opslag, met schema/data en benodigde rollen; leg project-ID, tijdstip en exportreferentie vast zonder credentials of persoonsgegevens in Git.
2. Laat de eigenaar een restore van die export aantoonbaar testen in een geïsoleerde niet-productieomgeving. Een export zonder gevalideerde herstelroute is geen bewezen backup.
3. Maak vóór toepassing een read-only baseline van migratiehistory, relevante tabellen, policies, grants, functies/eigenaren en alle vijf HR-group IDs/timezones. Deel geen rijen met persoonsgegevens.
4. Pas, na expliciet TEST-mandaat en backup-GO, uitsluitend deze acht forward-only migraties in volgorde toe. Geen automatische rollback of handmatige history-repair.
5. Voer de readback hieronder uit. Bij fout: stop verdere migraties/scheduler; herstel via geteste restore onder change-eigenaar, of via een apart beoordeelde forward-fix. Geen direct businessdataherstel.

## Postmigratie-readback en verplichte rolmatrix

Eerst technische readback: alle acht exacte versies staan éénmaal in Supabase history; tabellen/kolommen/indexen/functies bestaan met verwachte definities; exposed tabellen hebben RLS en passende policies; grants/function owners kloppen; private helpers zijn niet uitvoerbaar door `anon`/`authenticated`; scheduler-wrapper is uitsluitend uitvoerbaar via `service_role`; alle vijf `hr_groups.time_zone`-waarden zijn niet-null en door de eigenaar bevestigd; actieve bestaande workitems bleven ongewijzigd; reminderjobs/deliveries zijn consistent. Voer daarna de onderstaande proeven met echte, bestaande JWT-identiteiten uit.

| Persona | Positieve proef op synthetische Opleidingsaanvraag | Verplichte negatieve scopeproeven |
|---|---|---|
| HR Admin | Maak draft, bewerk formulier/stappen/rollen/SLA, publiceer nieuwe versie; start de reguliere procesreis alleen waar bestaande rechten dat toelaten; controleer revision en immutable pin. | Geen ander tenant/HR-group/administratie lezen of beheren; forged process/version/work-item IDs; geen verborgen velden uitlezen; geen directe private-helper-RPC. |
| Employee | Open gepubliceerde aanvraag, start eigen instantie, conditioneel concept opslaan/heropenen, toegestane velden invullen en indienen; na wijzigingsverzoek aanpassen en opnieuw indienen. | Geen unpublished/foreign proces starten; geen Manager/HR-only velden lezen of schrijven; geen response van andere medewerker; geen stap/actor vervalsen. |
| Manager | Alleen toegewezen/team-scope werkitem openen, historie lezen, wijziging vragen en na herindiening goedkeuren waar de workflow dit toestaat. | Andere teams, ongekoppelde cases, tenant/groep/administratie of vreemde IDs geweigerd; geen HR-beheer of publicatie. |
| HR | Binnen toegewezen HR-scope aanvraag reviewen, goedkeuren/afronden en historie, deadline/herinnerings- en Insights-readback controleren. | Geen andere HR-groep/tenant; geen Manager- of HR Admin-beheerrechten; geen ongeautoriseerde ruwe reminder-/workflowpayloads. |

Voor alle persona's: controleer proceshistorie en audit-events van start, save, submit, change-request, approve en complete; timezone/deadline en reminder-idempotentie; operationele inbox/retry; Insights-aggregaten. Test anon, expired/forged JWT en directe RPC-denial afzonderlijk. Scheduler heeft daarnaast een positieve service-role-run en negatieve authenticated/anon-proeven nodig. Geen service-role bypass voor gebruikersflows.

Bestaande HR Admin-, Manager- en Employee-testtargets zijn in het bestaande role-switcherbewijs genoemd, maar bewezen browseracties en werkelijke JWT-scope ontbreken nog. Er is geen reguliere HR-processoridentiteit bevestigd. Gebruik uitsluitend reeds geautoriseerde TEST-identiteiten; maak geen account, role switcher, impersonatie of rechtenuitbreiding. De bestaande Payroll-persona's zijn geen vervanging voor PMUX-rollen.

## Praktische testroute

**Lokaal:** safe preflight is uitgevoerd met `scripts/start-test-worktree.ps1 -Mode Development -Port 3011 -PreflightOnly`; poort/config-check slaagde en de centrale TEST-runtimeconfig werd via metadata gecontroleerd, zonder waarden te lezen. Geen server/browser gestart. Voor de latere lokale run: gebruik hetzelfde bestaande script op poort 3011 zonder `-PreflightOnly`, mits bevestigd is dat Next de beschermde `apps/hr-suite/next-env.d.ts` niet wijzigt. Daarna alleen bestaande login/session gebruiken en de Processtudio, gepubliceerde Opleidingsaanvraag, medewerker-`/work`, manager/HR-workitem, Operations en Insights via bestaande navigatie openen. Geen login-workaround; leg desktop en 390px vast.

**Gedeelde TEST:** eerst backup/restorebewijs en afzonderlijk TEST-migratiemandaat; daarna de acht migraties, readback, rolmatrix en browseracceptatie. Cron blijft uit tijdens de acceptatie. Pas bij latere TEST-release kan de bestaande Vercel Cron-route worden vrijgegeven nadat plan, secret-aanwezigheid en endpointgrens door de eigenaar zijn gecontroleerd; lees of wijzig secretwaarden niet. De minute-frequentie vereist Vercel Pro/Enterprise volgens [Vercel cron usage/pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing). Remote scheduler, release en secrets zijn in deze taak niet gewijzigd.

## Nog geplande productfinish

De E2E-gate is geen feature-roadmap. Na deze acceptatie blijven op de geconsolideerde PMUX-roadmap als latere productfinish staan: verdere ESS/MSS/Focus- en dashboardintegratie, mobile-first formulierpolish en rijkere visuele route-/status-/resultaatpresentatie. Ook werkdagen/feestdagen-SLA blijven geblokkeerd op een eenduidige kalenderdefinitie. Dit rapport bouwt die features niet.

## Provenance en bescherming

Geen remote databasewrite, push, merge, deployment, cronactivatie of secretwijziging. Geen Payroll-code of andere branch aangeraakt. Bestaande dirty PMUX-04-evidence en `apps/hr-suite/next-env.d.ts` blijven beschermd en buiten deze documentatiecommit.
