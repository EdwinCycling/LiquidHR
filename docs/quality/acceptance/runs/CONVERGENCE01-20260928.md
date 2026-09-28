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

## Environment-gated bewijs

Geen lokaal proces luisterde op poort 3000; de huidige integration-execution context bood geen bestaande geconfigureerde TEST-authsessie; de beschikbare browser had geen LiquidHR-sessie. De canonical .env.local is niet gelezen of gekopieerd en er is niet om credentials gevraagd. Daarom zijn niet uitgevoerd:

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