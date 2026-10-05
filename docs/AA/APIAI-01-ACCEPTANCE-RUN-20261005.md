# APIAI-01 — voortzetting en acceptatierun

- **Datum:** 2026-10-05 (Europe/Amsterdam)
- **Status:** **PARTIAL / NOT SECURITY-ACCEPTED / ROUTES UNMOUNTED**
- **Worktree:** apiai01-build-20261003
- **Branch:** work/apiai-01-build-20261003
- **Geteste applicatie-/migratiekandidaat:** e01006e8206d6a605960f5175ad2e1b197338206
- **Remote PR-head op controlemoment:** 547b5cc2c425d9b8bc9e8a63383f230d548b95a2
- **Lokale code-/migratiecommits na die PR-head:** f39cead (bearer- en contextguards), e01006e (alleen migratieversie/contracttestpad). Deze acceptatierun wordt apart en lokaal vastgelegd.
- **Remotestatus:** PR #3 blijft open en Draft; niets gepusht of gemerged.

Deze run vult de historische [APIAI-01-ACCEPTANCE-RUN-20261004.md](./APIAI-01-ACCEPTANCE-RUN-20261004.md) aan. Deze acceptatierun is nu zelf een historische snapshot; het actuele lokale bewijs staat in [de acceptatievoortzetting](APIAI-01-ACCEPTANCE-CONTINUATION-20261005.md). Geen van beide rapporten keurt een provider, remote migration of externe activering goed.

## 1. Uitgevoerde lokale wijzigingen

- De branded Supabase Auth-client weigert caller-supplied getClaims-opties en vraagt claims alleen op met de exact gebonden bearer.
- De bearer/RLS-binding vereist nu een niet-lege issuer en subject, een gemapte account-user-ID en gelijkheid tussen de gekoppelde user-ID en Supabase sub.
- De self-only Development Plans-adapter weigert lege tenant- of employeecontext voordat de bestaande Talent-service wordt aangeroepen.
- De niet-toegepaste kandidaatmigration en bijbehorende contracttest zijn hernoemd van 20261004104735 naar 20261005051804. De SQL-inhoud is niet gewijzigd. De timestamp is later dan de actuele TEST-history; herlees die geschiedenis opnieuw vóór een toekomstige branch-apply.
- Er zijn geen /api/v1-routebestanden gemount. Er is geen provideradapter, OAuth callback of persistente identity bridge toegevoegd.

## 2. Actueel lokaal bewijs

| Controle | Resultaat | Grens |
| --- | --- | --- |
| Volledige hr-suite Vitest na bearer-/Development Plans-wijzigingen | **529 bestanden PASS / 4 SKIP; 2.250 tests PASS / 8 SKIP** | Lokale unit-, component- en contracttests |
| APIAI SQL-migratie contracttest na versiecorrectie, uitgevoerd vanuit apps/hr-suite | **1 bestand / 3 tests PASS** | Statische SQL-tekstcontracten; geen PostgreSQL-bewijs |
| Strict TypeScript npm.cmd run type-check -- --incremental false | **PASS** | Geen runtime-RLS-bewijs |
| ESLint npm.cmd run lint | **0 errors / 7 bestaande Payroll-testwaarschuwingen** | Waarschuwingen zijn buiten APIAI-01 |
| npm.cmd run check:i18n | **PASS; 41 NL/EN-namespaces met gelijke sleutels** | Geen databasebewijs |
| git diff --check | **PASS** | Kandidaatcode |
| Officiële scripts/start-test-worktree.ps1 -Mode Production -Build -Port 3015 | **PASS** op exact e01006e; 308 pagina’s gegenereerd; TypeScript en Payroll client-boundary-scan (152 browserassets) geslaagd | Lokale build met centrale TEST-config; geen deployment |
| Officiële Production-runtime op loopback 127.0.0.1:3015 | /login **200**; anonieme /dashboard/start **307** naar /login | Lokale runtime |
| GET /api/v1/workforce/summary, /api/v1/team-skills en /api/v1/development-plans | alle drie **404** | Bewijst uitsluitend dat routes ongemount zijn; geen bearer-, permission- of RLS-test |
| Development-runtime op localhost:3010, normale lokale Test Auth | Test HR Admin-login geslaagd; gewone rolwissel naar Test Manager en Test Medewerker geslaagd | Lokale synthetische persona's; geen externe OAuth |
| Runtime-preflight met officiële launcher | **PASS**; vereiste centrale TEST-variabelen aanwezig, waarden verborgen | Geen Supabase schema-write |

De eerste Test Auth-poging op 127.0.0.1:3010 faalde door een originverschil; de normale login- en rolwisselflow slaagde daarna op localhost:3010. De lokale serverlog toonde tijdens de sessie twee Invalid Refresh Token-fouten bij een oude sessie. De nieuwe login en rolwissels slaagden; dit levert geen bearer-token- of RLS-bewijs op. De initiële filterrun vanuit de monorepo-root startte ook een niet-relevante control-workspace zonder overeenkomende test; de canonieke hr-suite-invocation slaagde.

## 3. Read-only Supabase-inventaris

Op het controlemoment is via bestaande Supabase-read-only tooling vastgesteld:

- LiquidHR TEST-project wnpfloqpjvaacobppbpk is ACTIVE_HEALTHY in eu-west-3.
- De Payroll Lab is een apart project en is niet gebruikt. Er zijn geen Supabase-branches in de LiquidHR-projectinventaris.
- De TEST-migrationhistory bevat **512** entries. De laatste twee zijn 20261004113111 control02_xml_import_provenance_guard en 20261004113209 control01_payroll_import_role_override_permissions.
- De APIAI-migration is niet toegepast en staat niet in die history. public en internal_security bestaan; APIAI-kandidaattabellen api_rate_limit_policies, api_client_registrations, api_rate_limit_buckets en functies consume_api_rate_limit, record_api_read_audit ontbreken.
- Bestaande public.employees, tenants, employee_organizations, administrations, employee_administration_assignments, user_access, user_hr_group_access, audit_logs en talent_development_goals hebben RLS ingeschakeld. audit_logs en talent_development_goals hebben bestaande scoped policies en authenticated grants; de kandidaat-RPC/policies zijn daarmee niet bewezen.
- Er is geen gedeelde Core TEST-migratie, reset of seed uitgevoerd. Docker, containers, lokale Supabase en workarounds zijn niet gebruikt.

## 4. Geïsoleerde databaseproef — voorstel, niet uitgevoerd

Voor de 40 pgTAP-asserties en echte RLS/grants/limiter/auditproeven bestaat momenteel geen geïsoleerde APIAI-database. De huidige pgTAP-bron zoekt de synthetische hradmin.fixture- en employee.fixture-gebruikers in auth.users en vereist bijbehorende tenant-, HR-groep- en twee verschillende administratie-scopefixtures. Een data-less branch bevat die records niet; de suite kan daar dus niet ongewijzigd draaien. Voorgestelde uitvoeringsstap na expliciete toestemming:

1. Maak uitsluitend via de bestaande Supabase-tooling een tijdelijke data-less branch van LiquidHR TEST met naam apiai01-dbtest-20261005. De actuele schatting is **$0.01344 per uur** (ongeveer **$0.32 per 24 uur**); dit is een prijsindicatie, geen branch of toestemming.
2. Lees na het aanmaken de branch-eigen migrationhistory opnieuw. Pas de lokale kandidaatversie 20261005051804 alleen toe als die nog hoger is dan de branch-head; retimestamp uitsluitend lokaal wanneer er intussen een nieuwere migration bestaat.
3. Voorzie uitsluitend op die branch de minimale synthetische gebruikers- en scopefixtures die de pgTAP-bron vereist, of kies een reeds geïsoleerde database waar die fixtures al bestaan. Dit is een afzonderlijke remote data-write en valt eveneens onder expliciete toestemming.
4. Pas alleen deze APIAI-kandidaatmigration forward-only toe op die geïsoleerde branch.
5. Voer daar de SQL-test met plan(40) uit, gevolgd door catalog-readback van tabellen, RLS, policies, grants en RPC-signatures; echte concurrency met twee onafhankelijke sessies; audit-write én readback; Supabase advisors en typegeneratie.
6. Bewaar exacte branch-ID, migrationversie, testuitvoer en readback als bewijs. Verwijder of reset geen gedeelde Core TEST-data.

**Niets uit deze lijst is uitgevoerd.** Branchcreatie is extern en kostendrager; migration toepassen is een remote schemawijziging. Beide wachten op expliciete toestemming.

## 5. GitHub, Vercel en onafhankelijke review

- GitHub PR #3 is **open, Draft en mergeable**; remote head is nog 547b5cc2… De applicatie-/migratiekandidaat e01006e bevat twee lokale commits na die head. De aparte acceptatiedocumentatie blijft eveneens lokaal; geen van deze commits is gepusht.
- Vercel-project liquidhr: nieuwste Production-deployment is **READY** op main SHA 6349d025… Er zijn **0 branch-deployments** voor work/apiai-01-build-20261003; er is niets gedeployed vanuit deze run.
- De onafhankelijke LUNA MAX-review op de actuele lokale codewijzigingen vond geen P0/P1 in de bekeken diff, maar gaf **NO-GO voor route-activatie**. De volledige bearer/AuthContext/RLS-, provider-, database- en auditketen is niet live bewezen.
- De bestaande geïsoleerde Keycloak-proef blijft alleen providerbewijs; zij bewijst geen LiquidHR identity bridge, actuele Supabase auth.uid() of RLS.

De oude P-05-statusnotitie noemt 36 assertions voor een oudere momentopname. De actuele SQL-bron declareert plan(40); die assertions zijn nog niet tegen PostgreSQL uitgevoerd.

## 6. Exacte open gates

1. **P-01 t/m P-05 zijn proposals / not approved.** Product/Security/Privacy/Data/Operations moeten provider, identity-link/lifecycle, scope mapping, eerste resource/veldcontract, privacygrenzen, quota, auditbron/provenance en foutbeleid formeel besluiten.
2. Er ontbreekt een goedgekeurde productieprovideradapter, consent/callback-levenscyclus, clientregistratie en persistente (issuer, subject) → auth.users.id-bridge. De code blijft fail-closed.
3. De productie-routefactory en route-wiring ontbreken. De Development Plans-handler is alleen lokaal met mocks/contracten getest.
4. De 40 pgTAP-asserties zijn **OPEN** tegen PostgreSQL en de huidige test verwacht branch-local synthetische HR Admin-/medewerker- en scopefixtures. Echte RLS-positieven/-negatieven, grants/policies/RPC-readback, twee-sessie limiterconcurrency, audit-write/readback, advisors en gegenereerde DB-types zijn **OPEN**.
5. Echte externe bearer-, client-/audiencebinding-, tokenrevocatie- en Supabase auth.uid()-proeven zijn **OPEN**.
6. PR #3 heeft deze lokale commits nog niet; push en merge zijn hier niet uitgevoerd.
7. Acceptatie van andere ontwikkelsporen is geen directe APIAI-01-voorwaarde zolang hun code/schema niet door deze APIAI-slice wordt gewijzigd.

## 7. Direct uitvoerbare vervolgbouwopdracht na goedkeuring

> Houd alle /api/v1-routes ongemount. Verwerk eerst schriftelijke goedkeuring voor P-01 t/m P-05 en de gekozen eerste resource. Vraag daarna expliciete toestemming om de tijdelijke geïsoleerde Supabase-branch apiai01-dbtest-20261005 aan te maken, de minimale branch-local synthetische gebruiker-/scopefixtures te voorzien en uitsluitend daar de APIAI-migration en databasesuite uit te voeren. Lees de branch-history opnieuw en houd migrationversies strikt forward-only. Laat 40 pgTAP-asserties, catalog-readback van RLS/grants/policies/RPC’s, tweesessie-limiterconcurrency, audit-write/readback, advisors en typegeneratie slagen. Bouw vervolgens de gekozen OAuth-adapter en persistente identity bridge zonder e-mail-, cookie- of service-rolefallback; laad AuthContext en de resource uitsluitend via dezelfde bearergebonden RLS-client. Implementeer alleen de goedgekeurde read-only resource met strikte runtimeprojectie, actuele canonieke permissions, limiter en fail-closed audit. Test positieve en negatieve persona-, subject-, tenant-, HR-groep-, administratie-, permission-, client-, expiry- en revocationpaden met synthetische TEST-identiteiten. Volg bouwen → testen → bugfixen → opnieuw testen; laat een onafhankelijke securityreview uitvoeren. Mount of publiceer niets voordat alle relevante Product-, Security-, Privacy-, Data- en Operations-gates expliciet goedgekeurd zijn.
