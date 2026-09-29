# CONVERGENCE01 — INS01 + CONTROL01 + AI01-A

- **Datum:** 2026-09-28
- **Status:** **PARTIAL / RELEASE BLOCKED**
- **Supabase TEST:** wnpfloqpjvaacobppbpk
- **Canonical baseline:** 3a0fc67f84bc7dab0acff732afab597142d59ea9
- **Startversie:** 1.20260927.3

## Samenvatting

INS01, CONTROL01 en AI01-A zijn in de opgegeven volgorde op een integratieworktree vanaf de exacte baseline samengebracht. Alle vijf ontbrekende convergence-migrations zijn op Supabase TEST toegepast en teruggelezen. Officiële Supabase-typegeneratie, RLS/grants/advisors-readback, lokale regressies, de volledige testsuites, strict TypeScript, lint, i18n en productiebuilds zijn groen.

De verplichte geauthenticeerde persona/browsermatrix en echte remote AI-concurrency-/lifecycleprobes zijn niet uitgevoerd. Er was geen lokale app op poort 3000, geen reeds geconfigureerde TEST-authsessie in de execution context en geen LiquidHR-sessie in de beschikbare browser. De beschermde apps/hr-suite/.env.local is niet geopend. Dit laat security- en data-integriteitsinvarianten onbewezen; daarom zijn versie-bump, main/push en Production-release geblokkeerd.

## Integratie

De integratieworktree C:\Users\Edwin\.codex\worktrees\CONVERGENCE01-20260928\LiquidHR is gestart vanaf main = origin/main = 3a0fc67f84bc7dab0acff732afab597142d59ea9.

Cherry-picks:

| Slice | Broncommit | Integratiecommit |
|---|---|---|
| INS01 | e0adac8cc1fde88abbb60f55c08d6769df1d951e | e4bf48bed1c85fdff1a2eafd526b789c9200064e |
| AI01-A A1 checkpoint | e36fe9f69cc2d7d3bb24a200111465bacc2c37c3 | ed7bdfa9af716983f521964f2c50b2a8e13b5b21 |
| AI01-A A2 code/migration/tests | 72d79d15608dff516f1adce600fff0b025625111 | 1033ded7e8447d9b0d03012f0cd8435fa4c3c4e7 |
| AI01-A closeout docs | 9f6896d9267739c03ebd3b898477aac00b8138e8 | cd8f9d817bee50942ce33cf59aa9270c0afde6b6 |
| CONTROL01 | 83952aa06d6c605eb222324af458e323ebfee35c | 5282d95bd86da11042f8c407013bba92a693a50c |

De enige inhoudelijke overlap was documentatie in docs/README.md, docs/delivery/CURRENT_CONTEXT.md en docs/delivery/IMPLEMENTATION_STATUS.md. Deze statusdocumenten zijn voor de geïntegreerde uitkomst gereconstrueerd. Historische acceptance reports zijn niet herschreven. Er was geen verloren code-overlap in auth/context, HR-group helpers, permissions, shared UI-primitives of bestaande DB-types. Geïntegreerde typegen- en SQL-hardening staat hieronder.

## Migration inventory en remote readback

Voor writes telde TEST 502 migratieregistraties. Ze waren uniek en oplopend. De actuele ABS02-voorganger 20260927110000_abs02_self_scope_permission_fix.sql was aanwezig (remote historyversie 20260927175438, naam abs02_self_scope_permission_fix). Na apply telt de remote history 507 records; de vijf nieuwe records staan uniek en oplopend na ABS02.

| Bronbestand | Bron | Doel | Afhankelijkheid / volgorde | Remote registratie | Readback |
|---|---|---|---|---|---|
| 20260928072242_ai01_a2_durable_recovery.sql | AI01-A A2 | Duurzame invocation audit/outbox, retrybare credit-release, legacy recovery en serverdeadline voor voice-finalisatie | ABS02-voorganger en bestaande AI-tabellen; eerst toegepast | 20260928095705 / ai01_a2_durable_recovery | Aanwezig; tabellen, functies en constraints gecontroleerd |
| 20260928090000_control01_first_admin_invitation_enum.sql | CONTROL01 | TENANT_FIRST_ADMIN invitation-purpose enum | ABS02-voorganger; vóór bootstrap | 20260928095805 / control01_first_admin_invitation_enum | Aanwezig |
| 20260928090100_control01_customer_bootstrap.sql | CONTROL01 | Tenant/HR-group/administration bootstrap, first-admin invitation, acceptance/revoke lifecycle | Enum en bestaande Control/auth-tabellen | 20260928095820 / control01_customer_bootstrap | Aanwezig; RPC-definities/grants gecontroleerd |
| 20260928090200_control01_payroll_import_staging.sql | CONTROL01 | Payroll-tax-number scope en synthetic import staging/persons/IKVs | ABS02 tenant/HR-group scope en bestaande payroll permissions | 20260928095904 / control01_payroll_import_staging | Aanwezig; RLS/policies/grants gecontroleerd |
| 20260928100207_control01_payroll_import_grants_hardening.sql | CONVERGENCE01-correctie | Verwijdert default authenticated DELETE/TRUNCATE/REFERENCES/TRIGGER-rechten op payroll staging | Na de reeds toegepaste stagingmigration | 20260928100207 / control01_payroll_import_grants_hardening | Aanwezig; effectieve table grants opnieuw gelezen |

De eerste apply van de AI-migratie faalde met PostgreSQL 42P17: een opgeslagen generated expression gebruikte timestamptz + interval, wat niet immutable is. De transactie is teruggedraaid en er was toen geen migration-historyrecord. De SQL is forward-only gecorrigeerd naar een database-trigger die de deadline afleidt uit de server-snapshotduur; daarna is de migratie eenmaal succesvol toegepast. De trigger geldt voor employee- en Team-voice-sessies; de maximale duur blijft geconstraint op 30–3600 seconden.

Supabase MCP gaf remote versies voor de vier bestaande bronmigraties. De logical names en remote volgorde komen overeen; prefixverschillen sluiten aan op reeds bestaande repositoryhistorie-drift. Die historie is niet hernoemd, gerepareerd, teruggespeeld of gereset. De enige onverwachte migration-inventoryregel is de in-run grant-correctie hierboven; er zijn geen andere nieuwe SQL-migrations toegepast.

### SQL-contractcontrole

- Alle nieuwe tabellen hebben RLS in dezelfde migration; er is geen nieuwe anon-exposure of brede authenticated DML-grant bedoeld.
- AI A2-contracten controleren PENDING/RELEASING, FOR UPDATE SKIP LOCKED, begrensde reconcile-batches, unieke audit-/voice-chargekeys, wederzijdse uitsluiting van settlement en release, en legacy crash recovery.
- Bootstrap-/invitation-RPC’s valideren server-side OWNER/OPERATOR, bestaand first-admin state en scope; bootstrap na een bestaande eerste admin faalt gesloten.
- Payroll staging bindt tenant, HR-group en administration. BSN-matching gebruikt uitsluitend een fingerprint en gevalideerde payroll-import:write-scope; raw BSN wordt niet opgeslagen of teruggegeven.
- De AI-generated voice-deadline is vervangen door trigger-afleiding omdat de oorspronkelijke generated expression niet geldig was. De server-snapshotduur blijft begrensd.
- Geen migration reset, schema-recreatie of destructive remote actie is uitgevoerd.

## Officiële DB-typegeneratie

Na remote migrationreadback zijn de types met de officiële Supabase typegenerator vanaf TEST gegenereerd (PostgREST 14.5). Daarna zijn packages/db/types.ts en de geïntegreerde code met de remote output vergeleken.

- Remote heeft 305 table blocks; de vier payroll-importtabellen ontbraken lokaal vóór typegen en zijn toegevoegd.
- Remote heeft 242 function blocks; bootstrap, revoke en BSN-fingerprint-match zijn toegevoegd.
- De bestaande company_activities-typeblock is behouden omdat die lokaal bestaat maar niet in het TEST-project voorkomt.
- De invitation-types zijn aangevuld met de remote bootstrap-/HR-group-velden en relatie.
- De voice finalization_deadline_at blijft op DB-niveau NOT NULL; de INSERT-typeproperty is optioneel gemaakt omdat de database-trigger die waarde invult en de generator die trigger niet modelleert. Dit is de enige beperkte type-adapter.
- AI recovery-/voicevelden zijn verder met de remote schema-output gereconcileerd; er is geen benodigde bestaande type verwijderd.

Strict TypeScript slaagde na deze reconcile voor beide apps.

## Supabase security readback en advisors

### RLS, grants en RPC’s

- De vier payroll-importtabellen hebben RLS aan. anon heeft geen tabelprivileges. authenticated heeft uitsluitend SELECT/INSERT/UPDATE; DELETE, TRUNCATE, REFERENCES en TRIGGER zijn ingetrokken. De tenant-/HR-group-/payroll-permissionpolicy scope is teruggelezen; batch-insert is ook aan actor ownership gebonden.
- user_invitations heeft RLS aan en administratie-/permission-scoped policies voor authenticated read/write; anon heeft geen row policy. accept_user_invitation is SECURITY DEFINER met lege search_path en alleen service-role execute.
- bootstrap_platform_first_admin en revoke_platform_first_admin_invitation zijn SECURITY DEFINER met vaste search_path, execute alleen voor authenticated, en OWNER/OPERATOR plus first-admin-/scopechecks in de body. anon kan ze niet uitvoeren.
- match_payroll_import_employee_bsn_fingerprint controleert tenant, HR-group en payroll-write capability; raw BSN wordt niet teruggegeven.
- AI recovery/outbox/reconciliation-objecten en voice-tabellen zijn gecontroleerd. RLS staat aan; writes verlopen via de bedoelde trusted service/RPC-route. ai_team_sessions heeft bewust geen user-selectpolicy of authenticated table grant en blijft service-only.
- Readback bestrijkt alleen TEST wnpfloqpjvaacobppbpk; geen Production-schema is benaderd.

### Advisor-classificatie

**Security advisor**

| Niveau | Bevinding |
|---|---|
| ERROR | Geen |
| WARN | 4 anon_security_definer_function_executable, 106 authenticated_security_definer_function_executable, 1 auth_leaked_password_protection |
| INFO | 11 rls_enabled_no_policy |

De relevante nieuwe authenticated definer-RPC’s zijn de gecontroleerde bootstrap-, revoke- en fingerprint-matchfuncties. ai_team_sessions is een bewuste service-only RLS/no-policy INFO. De leaked-password-instelling en overige advisorregels zijn projectbreed en buiten deze slice; er is geen nieuwe onbegrensde bypass aangetroffen.

**Performance advisor**

| Niveau | Bevinding |
|---|---|
| ERROR | Geen |
| WARN | 33 multiple_permissive_policies; geen daarvan matcht de nieuwe payroll-objecten |
| INFO | 151 unindexed_foreign_keys, 405 unused_index |

Nieuwe TEST-indexen kunnen als unused worden gemeld doordat de nieuwe tabellen nog geen acceptatiedata bevatten. Geen unrelated schema-cleanupwave is gestart.

## Lokale acceptatie en gates

### Slice-beoordeling

- **INS01 — PARTIAL:** codecorrectheid en regressies groen. De gevraagde HR Admin-, Manager- en Employee-live matrix voor directe routes/API, geforgeerde filters/context, pagination, KPI/tabel/chart-pariteit, exports en downloads is niet live uitgevoerd.
- **CONTROL01 — PARTIAL:** migrations, typegen, static securityreadback, contracttests en builds groen. Login → synthetic tenant → HR group/administration → first-admin invitation → bestaande Auth-account → eenmalige acceptance → normale login → omgevingskeuze → lege geïsoleerde context, revoke/reuse/forged tests, Control responsive UX en de complete synthetic payroll-import zijn niet uitgevoerd. Officiële XML/XSD blijft bewust XSD_PENDING / REAL_XML_PENDING; dit is geen CONTROL01-defect. Er is geen synthetic tenant of invitation remote aangemaakt.
- **AI01-A — PARTIAL:** lokale durability-contracten en SQL readback groen; reservation/settle/release/reconcile met remote testrecords, persona/contextswitch en echte concurrentieprobes/reaper-tweemaal zijn niet uitgevoerd. PostgreSQL contracttests zijn geen bewijs van echte concurrency.

### Geautomatiseerde checks

- Pre-apply relevante migration/auth/context/RLS/type-contractset: 9 bestanden / 50 tests PASS.
- Post-integration regressies: INS/Actual Work/payroll/AI/context-set 52 bestanden / 242 tests PASS; Control migration/schema contract 1 bestand / 5 tests PASS; AI durable-recovery contract 10/10 PASS; Control migration contract 3/3 PASS; payroll + AI targeted set 2 bestanden / 18 tests PASS. Deze selecties overlappen en worden niet opgeteld.
- Volledige hr-suite: 480 bestanden / 1933 tests PASS.
- Control-suite: 2 bestanden / 9 tests PASS.
- Strict non-incremental TypeScript: hr-suite en Control PASS.
- ESLint: hr-suite en Control PASS.
- check:i18n: PASS, 41 gelijke NL/EN-namespaces.
- git diff --check: PASS na de documentatie-closeout en vóór de lokale closeout-commit.
- Productiebuilds: hr-suite Next.js 16.3.6, 304/304 routes/pagina’s PASS; Control 12/12 PASS. Dit zijn lokale buildresultaten, geen Vercel deployment.
- npm audit meldde 2 moderate en 3 high advisories. Volgens scope is geen dependency-upgrade uitgevoerd.

### Test Auth / TEST_CAPTURE production guard

Source en regressietests zijn gecontroleerd. Test Auth vereist lokale development, expliciete flag en het canonieke project; VERCEL/VERCEL_ENV sluiten de feature uit. TEST_CAPTURE vereist expliciete enablement en weigert Production/Preview. De production build bevat het bestaande /api/auth/test-login endpoint, maar de runtime guard weigert Production en de UI toont de testbediening daar niet. Dit is code/buildbewijs; een live Production-routecheck is niet uitgevoerd. Er is geen invitation-token debugendpoint of bootstrapbypass toegevoegd.

## Lokale runtime-start — 2026-09-28

De poorten 3000 en 3001 waren vrij. De bestaande root-scripts npm run dev en npm run dev:control startten de geïntegreerde servers op Next.js 16.3.6; beide meldden Ready.

- HR-suite op http://localhost:3000: de loginrequest eindigde in HTTP 500. De Next runtime-overlay en proxy.ts:26:38 melden dat de Supabase-project-URL en key ontbreken. De ontbrekende runtime-configuratie is NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Een existence-only controle bevestigde dat apps/hr-suite/.env.local niet in deze externe convergence-worktree staat. De canonical beschermde file is niet geopend, gelezen of gekopieerd.
- De bestaande Test Auth UI kon hierdoor niet laden. Browserconsole meldde Fast Refresh full reload na een unrecoverable error; de login gaf de Supabase-clientfout. De lokale Next-assets laadden, maar er is geen authenticated applicatie-API- of Supabase-request bereikt.
- Control op http://localhost:3001: /login stuurde door naar /setup, HTTP 200. De pagina meldde dat Supabase-instellingen ontbreken en noemt apps/liquidhr-control/.env.local met dezelfde twee publieke configuratienamen. De browser had geen app-error of console-error op de setup-pagina; alleen HMR-informatie. Er was geen OWNER/OPERATOR-login of full-circle UI beschikbaar.
- De setup-pagina beschrijft waarden overnemen vanuit de HR-suite-configuratie. Er is geen configuratiebestand gemaakt, gelinkt of gekopieerd; er zijn geen waarden gelezen en geen auth-bypass gebruikt.
- Er is in deze runtime-poging geen Supabase TEST-businessdata geschreven en geen migration aangeraakt.
- De twee servers en browser-sessies zijn gesloten; daarna luisterde geen proces op poort 3000 of 3001. Next dev had de twee next-env.d.ts files automatisch naar .next/dev-types aangepast en het Control-script maakte twee agentinstructiebestanden aan. De next-env.d.ts files zijn exact naar HEAD hersteld en alleen die twee door deze start gegenereerde bestanden zijn verwijderd. De applicatiecode bleef ongewijzigd.

De ontbrekende lokale env-configuratie blokkeert de Test Auth harness en daarmee alle authenticated Control-, INS01- en AI01-A-runtimeacceptatie. Geen alternatief configpad is toegevoegd.

## Environment-gated bewijs — eerste runtimepoging vóór de Runtime Env Bridge

De servers zijn gestart, maar de geïntegreerde worktree mist de Supabase runtime-configuratie en de bestaande Test Auth UI kwam niet beschikbaar. De canonical .env.local is niet gelezen of gekopieerd en er is niet om credentials gevraagd. Daarom zijn niet uitgevoerd:

- authenticated Control full-circle, invitation lifecycle/contextselector en Control UX op desktop/mobile;
- synthetic payroll import live inclusief no-write-preview, duplicate IKV/person, draft-mappingfout en Setup Assistant readback;
- INS01 drie-persona route/API/filter/scope/export/downloadmatrix;
- AI remote settlement/release/reconcile/reaper en A–I concurrency-/revocationprobes;
- hosted login/debug-route/version smoke;
- deploymentprovenance, omdat er geen deployment is gemaakt.

Dit zijn niet uitgevoerde gates, geen geslaagde browserchecks en geen codefouten die op basis van ontbrekend bewijs als defect mogen worden gerapporteerd. De fundamentele autorisatie-, tenant-/HR-group-isolatie- en exactly-once-concurrency-invarianten blijven voor deze release onbewezen.

## AI01-A bekende beperkingen

- Zonder server-side usage heartbeat kan een voice hard crash alleen worden afgerekend tot de opgeslagen, door de server bepaalde deadline en maxduur; de kortere werkelijke gebruiksduur is niet reconstrueerbaar.
- De technical-usage sink heeft nog geen eigen durable retry lifecycle. De verplichte business audit is duurzaam; de sink is observability. Dit staat op AI01-B/ops-backlog en is op basis van de huidige contracten geen releaseblocker.
- Geen echte provider API-call is gedaan.

## Release- en gitstatus

- Canonical main en origin/main staan nog op 3a0fc67f84bc7dab0acff732afab597142d59ea9; geen push of merge uitgevoerd.
- Geen version bump uitgevoerd; 1.20260927.3 blijft staan. De voorgestelde 1.20260928.1 is niet toegepast omdat de acceptatie-/releasevoorwaarden niet groen zijn.
- Geen schone release-checkout aangemaakt; geen Vercel project/deployment aangeraakt; er is dus geen deployment-ID, READY-status of nieuwe alias om te rapporteren.
- Hosted smoke is niet uitgevoerd.
- Geen Docker, containers, Docker Desktop, Compose, Dev Container of WSL gebruikt.
- .env.local is niet geopend, gelezen, gekopieerd, gewijzigd of verwijderd. apps/hr-suite/next-env.d.ts is niet gewijzigd.

## Deliberate backlog

- Officiële Loonaangifte XSD en echte XML (XSD_PENDING / REAL_XML_PENDING).
- INS02, AI01-B, AW02 en WVP01.
- Dependency/security maintenance voor de bestaande npm-auditbevindingen.
- Optionele server-side voice usage heartbeat voor nauwkeuriger herstel na hard crash.

Geen volgende productwave gestart.

## CONVERGENCE01-B runtime acceptance addendum — 2026-09-28

Dit addendum registreert de latere runtimepoging na de expliciete Runtime Env Bridge. De eerdere secties hierboven blijven het bewijs van de oorspronkelijke poging; dit addendum vervangt alleen de toenmalige constatering dat de lokale Supabase-config niet door de child-processen kon worden geladen.

### Native runtimeconfig en appstart

- Node `v22.14.0` ondersteunt `--env-file`. HR-suite is op `localhost:3000` gestart met het bestaande Next dev-entrypoint en de canonical `apps/hr-suite/.env.local` rechtstreeks als Node `--env-file`. Alleen Node-versie/help zijn vooraf geraadpleegd; de env-inhoud is niet door Codex gelezen, geprint, gelogd, gekopieerd, geschreven of persistent gemaakt.
- `apps/liquidhr-control/.env.local` bestond niet (existence-only). Control op `localhost:3001` kreeg in-memory uitsluitend `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `NEXT_PUBLIC_CONTROL_APP_URL=http://localhost:3001`. Geen env-bestand aangemaakt en geen andere variabelen geladen.
- HR `/login` gaf HTTP 200 zonder missing-Supabase-configfout. Control `/login` gaf HTTP 200 en stuurde niet meer naar `/setup`. Beide native servers meldden Ready; er is geen Docker, WSL, container of nieuwe tooling gebruikt.

### Control01 runtime en payroll-import

- HR Test Auth werkte lokaal voor Test HR Admin, Test Manager en Test Medewerker. De bestaande HR testidentiteit kon Control niet gebruiken: de Control-app gaf `/geen-toegang` omdat die identity geen platform OWNER/OPERATOR is en Control geen Test Auth-harness heeft.
- De normale Google-loginflow toonde het bestaande accountkeuzescherm, maar de TEST-authredirect stuurde de callback naar de hosted login in plaats van de lokale Control-callback. De lokale callback is niet aan Supabase Auth toegevoegd en er is geen bypass gebouwd. Er is geen wachtwoord gevraagd of ingevoerd; na de redirect is geen hosted login voltooid en geen Production-write uitgevoerd.
- Daarom zijn synthetic tenant/HR-group/administration, first-admin invitation, TEST_CAPTURE, token accept/revoke/reuse, contextselector/logout-login en forged-bootstrap securitycases niet uitgevoerd. De synthetic payroll-import is evenmin gestart; er is geen preview/finalize, employee-write of importrecord aangemaakt.
- Control desktop/mobile UX en import Setup Assistant zijn niet geaccepteerd. Official XSD/REAL_XML blijft `XSD_PENDING / REAL_XML_PENDING`.

### INS01 authenticated evidence

- HR Admin Test Auth toonde 19 beschikbare rapporten. Frequent Absence met `frequentOnly=1` had KPI’s `1 frequent / 1 medewerker / 3 ziekteperioden` en een tabel met 1/1 rij. Het gegenereerde Excel-compatibele bestand is SpreadsheetML (`application/vnd.ms-excel`), met 1 worksheet, 2 rijen (header + 1 datarij), 10 cellen en geen celwaarde met een formuleprefix. De export bevatte één rij en stemde overeen met de gefilterde KPI/tabel. De response heeft volgens de route `Content-Disposition` voor `.xls`; de UI meldde “CSV-export is gedownload en klaar voor Excel”.
- Bradford `risk=MEDIUM` toonde 7 ziekteperioden, 4,9 dagen, en 1/1 tabelrij met risicoscore 240. De Bradford-exportbutton gaf de succesvolle downloadtoast; serverreadback liet `/api/insights/absence?...format=excel` HTTP 200 zien (`application/vnd.ms-excel`). De Chrome-client bewaart deze tweede download niet op de gecontroleerde standaard-Downloads-locatie, dus het tweede bestand zelf is niet onafhankelijk geparseerd.
- De eerste echte Bradford-filterselectie reproduceerde een React-eventlifetime TypeError doordat deferred state-updaters `event.currentTarget` lazen nadat eventdispatch was afgelopen. De minimale correctie vervangt in de vijf Insights-filtercomponenten de deferred `currentTarget.value`-lezingen door het stabiele `target.value`; de Bradford Medium-filter werkte daarna live en liet de verwachte KPI/tabel zien. Geen i18n- of copywijziging.
- Manager zag 7 rapporten, inclusief Upcoming Events, en twee events in de geselecteerde periode. De view/API-request met een niet-bestaande department-ID en forged employee/team/tenant/HR-group querywaarden gaf een lege eventselectie; server gebruikt de Manager-context en onbekende scopequery’s veranderen die context niet. De directe API-request vanuit de reportflow kwam terug met HTTP 200. Een directe Chrome top-level navigatie naar `/api/...` werd door de browser-client geblokkeerd (`ERR_BLOCKED_BY_CLIENT`) en wordt niet als geslaagde losse direct-API-browserprobe geteld.
- Employee zag `0 rapportages beschikbaar`; een directe Frequent Absence-report URL bleef op 0 managementrapporten. Eerder tijdens dezelfde lokale acceptance gaf de directe absence API voor Employee HTTP 403. Geen HR-managementrij verscheen in de Employee Insights-view.
- Niet live afgedekt: volledige report-permissionmatrix, alle forged employee/team/department/context-cookievarianten, contextwisseling/stale cookies, paginatie, filteropties, alle reports, Analysis V2 historische labels, Actual Work strict `YYYY-MM`, volledige drilldown- en exportmatrix en browser DevTools console dump. De Bradford runtimefout is opgelost en de pagina/API re-test slaagde; geen ongeautoriseerde rij is waargenomen.

### AI01-A remote durability/concurrency

- Geen migratie of typegen opnieuw uitgevoerd. Op Supabase TEST `wnpfloqpjvaacobppbpk` zijn uitsluitend synthetic testrecords gebruikt in de vooraf lege Stap-6-testgroep. Er is één gecontroleerde 25-credit testallocatie aangemaakt; vier synthetic AI-invocations kregen reservations. Geen echte AI/provider-call.
- Dubbele parallelle `settle_ai_invocation` op dezelfde reservation eindigde als één economische settlement: invocation `SUCCEEDED`, reservation `SETTLED`, 1 credit charged en precies 1 business audit.
- In de parallelle settle-vs-release-CAS won settlement; de release-CAS vond geen `SETTLING`-rij. Er is dus geen dubbele charge/refund. De aparte `RELEASING`-recovery eindigde `FAILED/RELEASED`, 0 charged en precies 1 business audit.
- Twee gelijktijdige invocation-reconcilers leverden één effectieve batchuitkomst (`1` recovery en `2` audits) en een tweede no-op (`0`); readback bevestigde voor elke terminale synthetic invocation exact één audit. De legacy crash-sequence settlede eerst alleen het ledger en werd daarna eenmaal tot `SUCCEEDED` en audit gereconcilieerd.
- Een verlopen synthetic voice-sessie werd door twee parallelle reaper-calls éénmaal beëindigd (`TIMEOUT`), 60 seconden / 1 billable minute / 1 credit, met precies één charge en allocation-link. De tweede reaper was `0 processed / 0 finalized / 0 retryable`.
- Niet remote getest in deze run: live AI/Voice-toggle na start, revoked-scope/toolactie en HR Admin/Manager/Employee-forgerymatrix. Bestaande AI runtime/scope tests zijn onderdeel van de volledige lokale suite; remote persona-/feature-togglebewijs blijft open. De voice-heartbeat- en technical-usage-sinklimieten hierboven blijven ongewijzigd.

### Post-fix checks en releasebesluit

- Gerichte regressies na eventfix: 13 bestanden / 53 tests PASS.
- Volledige hr-suite na eventfix: 480 bestanden / 1.933 tests PASS.
- Strict TypeScript: PASS met `--incremental false` (de standaard incremental run werd door de sandbox geweigerd op een write naar `tsconfig.tsbuildinfo`, zonder TypeScript-codefout). Volledige hr-suite ESLint: PASS. NL/EN/i18n-bronnen zijn niet gewijzigd.
- HR production build: PASS, 304/304 routes/pagina’s. Control-code en de eerdere Control-suite/build op dezelfde geïntegreerde HEAD zijn ongewijzigd; Control 2 bestanden / 9 tests en 12/12 build blijven de eerder vastgelegde resultaten.
- Release blijft geblokkeerd: Control operator-authenticatie/full-circle en synthetic payroll-import ontbreken; belangrijke Control bootstrap/import/security-invarianten zijn dus niet bewezen. Versie blijft `1.20260927.3`; main en origin/main blijven op `3a0fc67f84bc7dab0acff732afab597142d59ea9`. Geen commit, push, schone releasecheckout, Vercel-deploy of hosted release smoke uitgevoerd.
- Er is geen migration, schemawijziging, typegen, dependency-update of productwave uitgevoerd. De vijf Insights-filtercomponenten zijn nog on-gecommit op de convergence-worktree. Next dev liet alleen `apps/liquidhr-control/next-env.d.ts` als gegenereerde dirty state achter; dit bestand is niet handmatig gewijzigd of teruggezet. `apps/hr-suite/next-env.d.ts` is clean en niet aangepast.


## CONVERGENCE01-C runtime continuation — 2026-09-28

**Status: PARTIAL / HUMAN_ACTION_REQUIRED: CONTROL_OWNER_LOGIN.** De codebasis staat op branch work/CONVERGENCE01-20260928, HEAD 21c1538929bbea57fe13a22d77a8aa26ead8bd70. De checkpoint commit bevatte de vijf Insights-filter/event fixes en bijgewerkte delivery-evidence; deze C-continuation heeft geen productcode of schema gewijzigd.

### Lokale runtime en browser

- HR-suite is via Node --env-file rechtstreeks gestart met het bestaande canonical apps/hr-suite/.env.local; de inhoud is niet geopend, gelezen, geprint, gelogd of gekopieerd. Control had geen eigen .env.local; het bestaande in-memory bridge-proces kreeg alleen de twee toegestane publieke Supabase-waarden plus de lokale Control URL. Geen tijdelijke env-file gemaakt.
- HR /login en Control /login antwoordden HTTP 200 zonder de eerdere ontbrekende-Supabase-configuratiefout. Beide servers zijn gestopt; poort 3000 en 3001 luisteren nu niet.
- HR Test Auth bleef lokaal. De Manager-context toonde de toegestane Insights-subset van 7 rapporten en Aankomende gebeurtenissen; voor de huidige selectie toonde de pagina de lege toestand. Deze check voegt geen bewijs toe voor de nog open forged-context, pagination, drilldown of volledige exportmatrix.
- De Supabase TEST URL Configuration-flow is geopend, maar stuurde naar auth.openai.com/choose-an-account. De pagina vraagt een bestaande accountkeuze om met ChatGPT bij Supabase aan te melden. Die keuze is niet gemaakt; geen login, callbackallowlist-wijziging, providerinstelling of andere Supabase Auth-mutatie is uitgevoerd. De handofftab staat open op dat scherm.
- Control OWNER OAuth callback, tenant/HR-group/administration bootstrap, invitation/TEST_CAPTURE acceptance, contextselector en securityprobes zijn daardoor niet gestart. Er is geen synthetic Control-data toegevoegd. De payroll-import is niet gestart; preview/finalization en employee-writegedrag zijn niet geclaimd.

### AI01-A continuation

- De eerder gerapporteerde TEST-synthetic settlement/release/reconcile/reaper-concurrencyprobes blijven de eerdere bewijsbasis; deze C-continuation heeft ze niet gedupliceerd en heeft geen remote businessrecords geschreven.
- Gerichte lokale AI-autorisatie-/durabilityregressies: 5 bestanden / 43 tests PASS (settings-service, runtime, realtime voice, employee voice session, durable recovery).
- Read-only TEST-readback bevestigde RLS enabled op ai_invocations, ai_credit_reservations, ai_voice_sessions, ai_team_sessions en ai_group_settings. Voor deze tabellen is geen anon-table grant teruggelezen. Public settlement/release/audit/reconcile/finalize wrappers zijn alleen executeerbaar door service_role; Internal A2 security-definer helpers hebben lege search_path; settlement/release/reconcile helpers hebben service_role-grants, terwijl de interne finalization helper owner-only blijft en alleen de public wrapper service_role execute krijgt. Dit is structuur-/ACL-bewijs, geen nieuwe persona-, toggle- of revocationacceptatie.
- HR Admin en Manager konden de HeRa-shell openen; het lege gespreksscherm maakte geen provider-call. Dit bewijst geen ai:use-runtimeautorisatie. Live AI/Voice-disabled, revoked-scope, HR-group-forgery en employee/team-forgery blijven onbewezen. Geen echte provider gebruikt.
- De voice usage-heartbeat en technical-usage-sinkbeperking blijven de eerder vastgelegde AI01-A/ops-beperkingen.

### Overige gates en closeout

- Bradford export is in de browser als download bevestigd, maar het bestand is in deze C-runtime niet onafhankelijk geparseerd. Browserconsole/networkdump en alle resterende INS01 forged-cookie/drilldown/exportvarianten zijn niet als groen geclaimd.
- Eerder bewezen volledige suites/builds blijven geldig voor dezelfde productcode: HR 480 bestanden / 1.933 tests, Control 2 bestanden / 9 tests, HR build 304/304, Control build 12/12, strict TypeScript en ESLint PASS. Deze continuation draaide alleen de gerichte AI-set; geen productcode gewijzigd.
- apps/liquidhr-control/next-env.d.ts is na het stoppen exact naar HEAD hersteld. Next dev genereerde apps/hr-suite/next-env.d.ts opnieuw met .next/dev/types-referenties; die tracked file bleef buiten de handmatige wijziging en is daarom nog dirty. Geen appproces blijft draaien. Protected .env.local bleef onaangeraakt.
- Er is geen version bump, main-update, push, releasecheckout, Vercel-deploy of hosted smoke uitgevoerd. De release blijft geblokkeerd tot de bestaande accountkeuze de Supabase TEST Dashboard-authenticatie opent; daarna kan alleen de expliciet toegestane callback http://localhost:3001/auth/callback aan de Redirect URLs worden toegevoegd en moet de Control-flow opnieuw worden geaccepteerd.
- Geen Docker, container, WSL, migration, typegen, dependency-update of nieuwe productwave gebruikt.

## CONVERGENCE01-C runtime follow-up — 2026-09-29

### Bradford duplicate-description correction

- The HR Admin browser reproduced the screenshot issue: the Bradford catalog description appeared both in the expanded card header and again above the report filters. `BradfordReportView` no longer accepts or renders that catalog description, and the parent no longer forwards it. The browser now shows the explanation only in the report header; filters, KPIs, table and Excel export remain available.
- Added a focused view regression test. Result: 1 file / 1 test PASS. The existing Bradford Excel download still returned the success toast; the previous browser acceptance recorded 9/9 rows and a successful scoped export.
- Audited the other report views: none of the other expanded report panels render their catalog description inside the panel. AI Usage has its own standalone page and its own `SectionHeader`, so its description is intentional. The 19-report catalog and the visible Bradford/Frequent Absence summaries were checked; the repeated accessibility-tree label is the button name plus its visible text child, not a second rendered paragraph.
- The reported Next.js recoverable webpack error had cleared after reload and was not reproduced on the final successful Bradford render. No browser/server stack trace identified a product root cause; no webpack workaround was added.

### HR persona and payroll runtime follow-up

- Employee direct navigation to `/insights?report=absence-frequent` resolved to the empty catalog (`0 rapportages beschikbaar`); no report card or management data rendered.
- Earlier in the runtime continuation, the existing OWNER session completed the basic Control flow: synthetic tenant, HR group and administration; first-admin invitation and acceptance reusing the existing identity; activation; exit from Control; explicit selection of the new HR environment; isolated empty dashboard; and logout/login with selector reappearance. The duplicate-auth count and negative reused/revoked/forged/AUDITOR/second-bootstrap cases were not independently verified. This follow-up did not repeat that journey or add Control records.
- After the later Control sign-out, the shared localhost auth cookie also signed HR out. The existing local Test Auth button re-authenticated, but the resulting `hradmin.fixture` session had no customer context and `/imports/loonaangifte` returned `/geen-toegang`. No new staging or payroll domain records were created in this follow-up. The internal synthetic payroll contract suite passed 1 file / 8 tests; the browser preflight/preview/finalize flow was not run. No XML fixture exists in the repo; official XML remains `XSD_PENDING / REAL_XML_PENDING`.
- A read-only query against TEST confirmed the provided email has one active `OWNER` row in `platform_operators`. The current local Control browser session nevertheless rendered “Geen platformbeheerder”; its principal was not proven to be the OWNER row. The normal Google button from `http://localhost:3001/login` ended at the hosted HR login. No hosted credentials or forms were used. The exact local callback URL was read back in Supabase TEST URL Configuration; no additional Auth or role change was made.
- The local Control login is left open at `http://localhost:3001/login` for the user to select the existing OWNER account. If the flow reaches the hosted HR login again, stop there and report the redirect; do not enter credentials there. Status remains `HUMAN_ACTION_REQUIRED: CONTROL_OWNER_LOGIN`.

### Regression and build gates after the Bradford fix

- Full HR suite: 481 files / 1,934 tests; 480 files / 1,933 tests passed. The one failure was the existing `lib/document-generation/pdf.test.ts` render case timing out at its 5-second limit. This same PDF timeout is documented in earlier runs; it is unrelated to Insights. It was not retried or changed.
- Strict TypeScript: PASS (`npx tsc --noEmit --incremental false -p apps/hr-suite/tsconfig.json`). Full HR ESLint: PASS. NL/EN files were unchanged. HR production build: PASS, 304/304 static pages. The first build caught an invalid `locale` prop in the new view test; removing that prop made TypeScript and build green.
- The scoped import contract tests and the focused Bradford view test both pass. Existing earlier Control suite/build and remote AI concurrency/RLS evidence were not rerun because neither code nor schema changed in those areas.
- No migration, typegen, dependency update, DB write, version bump, commit to main, push, clean release checkout, Vercel deploy, or hosted release smoke occurred. Release remains blocked on completing the Control OWNER session for negative bootstrap/security acceptance and on the browser synthetic payroll importer. Main/origin-main remain `3a0fc67f84bc7dab0acff732afab597142d59ea9`; app version remains `1.20260927.3`.
- `apps/hr-suite/next-env.d.ts` and `apps/liquidhr-control/next-env.d.ts` remain generated/dirty state from Next dev; neither was staged or manually modified during this follow-up. The protected canonical `.env.local` was not opened or altered. Both local apps remain available for the handoff. No Docker/WSL/container was used.


## Runtime-check update — 2026-09-29

- Commit b6a60a10149fea8b5006016e5a5aa948ed3a4e07 verwijdert de dubbele Bradford-uitleg uit de uitgeklapte rapportview. De lokale browser toont de uitleg één keer in de rapportkop; filters, KPI's en tabel blijven beschikbaar. De broncontrole vond geen andere expanded report view die de catalogusuitleg nogmaals rendert. Frequent verzuimers en Aankomende gebeurtenissen zijn aanvullend in de browser gecontroleerd; daar verschijnt geen tweede uitlegparagraaf.
- Read-only Test Auth-browsercontrole: HR Admin ziet 19 rapporten, Manager 7 en Employee 0. Directe Employee-navigatie naar /insights toont geen managementrapporten. De rechtstreekse browser-API-navigatie werd geblokkeerd met ERR_BLOCKED_BY_CLIENT; live API-weigering is dus niet bewezen. Een verse Test HR Admin-sessie had wel een HR-groep in Insights; de payroll-import is in deze follow-up niet opnieuw uitgevoerd.
- De gemelde Webpack Recoverable Error trad tijdens eerdere navigatie op en verdween na herladen; op de uiteindelijke Bradford-render kwam hij niet terug. Een afzonderlijke Server Runtime Error verscheen één keer bij de eerste Test Auth-redirect naar /dashboard/start; herladen van die route slaagde. Er is geen reproduceerbare oorzaak of onderbouwde veilige codefix vastgesteld.
- Bradford-regressie: 1 bestand / 1 test PASS. De eerder uitgevoerde volledige suite, strict TypeScript, ESLint en productiebuild 304/304 gelden voor dezelfde code-HEAD; in deze follow-up is geen productcode gewijzigd. De volledige suite had één niet-gerelateerde PDF-render-timeout.
- De bestaande lokale servers gaven HTTP 200 op de HR- en Control-loginroutes en zijn blijven draaien. Deze follow-up maakte geen bedrijfsrecords. Geen Docker gebruikt; de beschermde omgevingsconfiguratie is niet door Codex geïnspecteerd of gewijzigd.
- Status blijft PARTIAL: Control OWNER OAuth, resterende bootstrap/import- en live API/securityprobes staan open. Versie 1.20260927.3; main en origin/main blijven 3a0fc67f84bc7dab0acff732afab597142d59ea9. Geen push of deployment uitgevoerd.
