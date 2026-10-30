# INS-RELEASE-04-PREFLIGHT — 2026-10-30

## Scope en gepinde bron

Alleen read-only controles en dit rapport. Geen migratie, SQL-write, deployment, merge, sessie- of accountwijziging uitgevoerd.

- Repository: EdwinCycling/LiquidHR
- Geïsoleerde checkout: C:/Users/Edwin/AppData/Local/Temp/LiquidHR-INS-RELEASE-01-UNBLOCK-20261029
- Branch: work/ins-release-01-unblock-20261029
- Geteste lokale HEAD, origin branch en PR #71 head: 5f4fd8adb0152f02abd5620bb5819b7b5874e228
- PR #71: open, Draft, base main; niet gemerged.
- Werkboom was schoon vóór dit rapport. De huidige code is gelijk aan de eerder gebouwde code op 34559f75679099b4ed5434bd3bd9a7ea9ac8bdb6; het enige verschil tussen die build-SHA en deze HEAD is het eerdere INS-RELEASE-03-rapport.

## Gate-matrix

| Gate | Oordeel | Bewijs en beperking |
|---|---|---|
| Bron-SHA en checkout | PASS | Lokale HEAD, origin branch en GitHub PR-head zijn gelijk aan 5f4fd8adb0152f02abd5620bb5819b7b5874e228; checkout schoon vóór rapportage. |
| Vercel TEST-target | HOLD | Project-ID, owner, project-root, actieve deployment en aliases zijn gelezen. Actieve deployment heeft geen Git-SHA-metadata; de actieve alias geeft voor /api/runtime/build-provenance HTTP 404. De draaiende app kan daardoor niet aan de gepinde bron-SHA of Core TEST-ref worden gekoppeld. |
| Migratie A security review | PASS | Statische review van migratiebestand en contracttest; geen databaseactie. Details hieronder. |
| Migratie C security review | HOLD | C grant alleen rapportpermissie aan actieve DIRECT_MANAGER-rollen, maar een gedeactiveerde tenantrol kan volgens de huidige helper-/rolbeheer-code de Insights-permissie behouden. Details hieronder. |
| Rollback C | PASS | Het runbook en de PGlite-contracttest verwijderen alleen permission-rijen die C in zijn ledger heeft geregistreerd; bestaande grants blijven behouden. Niet op Core TEST uitgevoerd. |
| Gerichte regressietests | PASS | Exacte HEAD: 7 testbestanden, 32 geslaagd, 0 gefaald, 0 overgeslagen. TypeScript, gerichte ESLint en node --check ook PASS. |
| Identiteiten en private manifest | HOLD | Alleen gedocumenteerde identiteiten bekend. Geen manifestpad, sessies of benodigde D-configuratie onafhankelijk beschikbaar in deze checkout/runtime. |
| Manager-negatieve fixtures | HOLD | Direct-team-allowlist, HR Admin-referentie en aanwezigheid van buiten-team-medewerkers/cases/spells niet vanuit een geautoriseerde sessie bevestigd. |
| Migratiehistorie | PASS | Read-only Supabase-projectreadback op wnpfloqpjvaacobppbpk: 591 migraties; A en C ontbreken. |

## 1. Bronversie en deploymenttarget

Vercel-projectreadback bevestigt project liquidhr, project-ID prj_h3voMtzXGfqG6QTodR5d1VTcC1zP, team edwinitsolutions en rootDirectory apps/hr-suite. De actieve deployment is dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n, state READY, target production, source cli, met lege Git-metadata. De gekoppelde deploymentaliases zijn liquidhr-edwinitsolutions.vercel.app en liquid-hr-hr-suite.vercel.app.

De repositorydocumentatie AA-REL definieert dit Vercel-project als de gedeelde synthetische TEST-app; er is geen aparte commerciële klantproductie-app. De Supabase Management API bevestigt afzonderlijk Core TEST projectref wnpfloqpjvaacobppbpk en status ACTIVE_HEALTHY. De Vercel-variabele NEXT_PUBLIC_SUPABASE_URL bestaat voor production en preview, maar is als gevoelige waarde niet ontsleuteld. Daarmee is niet aangetoond dat de actieve deployment naar die Core TEST-ref wijst.

De actieve alias retourneerde bij de read-only GET naar /api/runtime/build-provenance HTTP 404. De lokale endpointcode retourneert uitsluitend gecontroleerde provenancevelden en heeft geen muterende neveneffecten; de actieve deployment bevat die route niet. De runtime-SHA en runtime-Supabase-ref zijn dus niet onafhankelijk bevestigd.

Vercel CLI-help bevestigt dat --prod shorthand is voor --environment production en dat --project standaard terugvalt op het gelinkte project. Deze checkout heeft geen .vercel-projectlink. Daarom geldt: met expliciete projectselectie naar project-ID prj_h3voMtzXGfqG6QTodR5d1VTcC1zP zou --prod de production-channel van de gedocumenteerde gedeelde TEST-app targeten; een kale, niet-gescopeerde --prod is hier niet aantoonbaar aan dat project gebonden. Geen deployment uitgevoerd. Door de ontbrekende runtime-ref blijft de targetgate HOLD.

## 2. Migratiebeoordeling

### A — 20261030065603_ins_release_02_manager_insights_unblock.sql

De migratie is transactioneel en verandert uitsluitend de functies internal_security.read_frequent_absence_threshold(uuid, uuid) en public.get_frequent_absence_threshold(uuid, uuid), hun EXECUTE-rechten/commentaar en de expliciete USAGE-toekenning op schema internal_security. De functie leest geen medische vrije tekst. Zij vereist auth.uid(), niet-lege tenant-/HR-groepscope en report-absence:read, leest uitsluitend configured en frequent_absence_threshold uit absence_settings en faalt bij dubbele of ongeldige instellingen. Fallback als threshold 3 komt alleen terug bij aantoonbaar ontbrekende configuratie in de applicatie.

De private helper is STABLE SECURITY DEFINER met lege search_path; de public wrapper is STABLE SECURITY INVOKER met lege search_path. EXECUTE wordt beperkt tot authenticated; PUBLIC, anon en service_role worden ingetrokken. De helper is afhankelijk van de bestaande internal_security.current_user_has_hr_group_permission, absence_settings en report-absence:read. De migratie wijzigt geen RLS-policy of operationele absence-rechten. De contracttest controleert functie-eigenaarschap, rechten, scope, foutpaden en de threshold-projectie.

A voegt zelf geen report-absence:read-grant toe. Daarom activeert A op zichzelf geen nieuw Manager-rapportrecht. Employee- en HR Admin-roltoekenningen worden niet gewijzigd; alleen geautoriseerde callers kunnen via de wrapper hun reeds toegestane groepsinstelling lezen.

### C — 20261030120901_ins_release_04_manager_insights_activation.sql

C gebruikt één transactie. Zij controleert dat report-absence:read bestaat, maakt zo nodig de private activation-log-tabel en trekt alle tabelrechten in van PUBLIC, anon, authenticated en service_role. Daarna voegt zij alleen report-absence:read toe aan rollen met code DIRECT_MANAGER die op dat moment actief en niet verwijderd zijn. ON CONFLICT maakt de grant idempotent; alleen nieuw ingevoegde grants komen in de ledger. De migratie verandert geen absence:* operationele rechten of absence-RLS. Employee- en HR Admin-grants worden niet door C aangepast. De scope hoort bij de bestaande groepspermission-helper en directe-team-filter in de applicatie.

Bevinding — security blocker vóór C: lib/organization/management-service.ts updateRole deactiveert een niet-systeem tenantrol met is_active=false en deleted_at. De huidige internal_security.current_user_has_hr_group_permission controleert user_hr_group_access.is_active en actieve HR-groep, maar controleert management_roles.is_active/deleted_at niet. De HR-groepstoegangssynchronisatie wordt niet door een trigger op management_roles gestart. Na C kan een eerder actieve tenant DIRECT_MANAGER-rol dus worden uitgeschakeld terwijl haar actieve toegangssnapshot en nieuw toegekende report-absence:read blijven voldoen aan de helper. De huidige contracttests testen activering en bestaande grants, maar niet deze latere rol-deactivering. Dit is statisch uit de code afgeleid; geen live rol of medewerker is gelezen of gewijzigd. C blijft HOLD totdat het autorisatiecontract deze lifecycle fail-closed maakt en een regressietest dat bewijst.

### Volgorde en rollback

Read-only Core TEST-historie bevat 591 migraties. A (20261030065603) en C (20261030120901) ontbreken; er is geen partial state aangetroffen. De bedoelde volgorde blijft A → B → C → D.

Het bestaande runbook bevat voor containment een transactionele DELETE van public.role_permissions die uitsluitend joint met ledgerregels met migration_version 20261030120901. De ledger blijft behouden. De contracttest rolt C tweemaal uit, controleert de ledger, en bewijst dat de voorgestelde rollback uitsluitend nieuw door C toegevoegde grants verwijdert en vooraf bestaande grants bewaart. De rollback is alleen veilig bij ongewijzigde ledger/grant-identiteit en zonder latere handmatige hergrant van dezelfde sleutel. Geen rollback-SQL is uitgevoerd; rollback vereist later afzonderlijke Core TEST-databaseautorisatie.

## 3. Gerichte controles op de gepinde HEAD

Vitest-commando vanuit apps/hr-suite: npm test -- --reporter=dot scripts/ins-release-04-core-test-acceptance.test.mjs app/api/runtime/build-provenance/route.test.ts supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.contract.test.ts supabase/migrations/absence_insight_manager_scope.contract.test.ts app/api/insights/absence/route.test.ts lib/insights/frequent-absence-report.test.ts lib/payroll/component-catalog.test.ts

Resultaat: 7/7 bestanden PASS; 32 PASS, 0 FAIL, 0 SKIP; Vitest-duration 21.51 s. Alleen npm meldde dat een nieuwere majorversie beschikbaar is; er zijn geen tests of dependencies gewijzigd.

Overige exacte controles vanuit apps/hr-suite:

- npm run type-check — PASS, exit 0.
- npx eslint next.config.ts app/api/runtime/build-provenance/route.ts app/api/runtime/build-provenance/route.test.ts scripts/ins-release-04-core-test-acceptance.mjs scripts/ins-release-04-core-test-acceptance.test.mjs scripts/verify-build-source.mjs scripts/write-build-provenance.mjs app/api/insights/absence/route.test.ts lib/insights/absence-insight-authorization.test.ts lib/insights/absence-insight-scope.ts lib/insights/absence-report.ts lib/insights/frequent-absence-report.ts lib/insights/frequent-absence-report.test.ts — PASS, exit 0; next.config.ts was inbegrepen.
- node --check scripts/ins-release-04-core-test-acceptance.mjs — PASS.
- node --check scripts/verify-build-source.mjs — PASS.
- node --check scripts/write-build-provenance.mjs — PASS.

De bestaande productiebuild slaagde op source-SHA 34559f75679099b4ed5434bd3bd9a7ea9ac8bdb6 met Next.js 16.4.2 en 348 static pages. De enige wijziging tussen die SHA en de geteste HEAD is het eerdere INS-RELEASE-03-acceptatierapport; productcode, inclusief next.config.ts en provenancecode, is identiek. De build is op de huidige HEAD niet herhaald. De eerdere volledige-suitebasis is 4.025 PASS / 8 SKIP / 0 FAIL; de volledige suite is voor deze preflight niet opnieuw gedraaid, dus een nieuwe brede-suite-delta is niet vastgesteld.

## 4. Fase-D-identiteiten en fixtures

| Vereiste | Status | Evidence |
|---|---|---|
| HR Admin NL/EN-sessies | Alleen gedocumenteerd | Geen sessiestate of manifestpad beschikbaar; niets aangemaakt of gewijzigd. |
| Manager NL/EN-sessies | Alleen gedocumenteerd | Geen sessiestate of manifestpad beschikbaar. |
| Lege Manager NL-sessie | Alleen gedocumenteerd | Geen sessiestate of manifestpad beschikbaar. |
| Employee NL-sessie | Alleen gedocumenteerd | Geen sessiestate of manifestpad beschikbaar. |
| Privémanifest buiten repository | Niet geverifieerd | Geen pad aangeleverd; het bestaande LOCALAPPDATA LiquidHR/TestRuntime-pad en de runtime-config ontbreken in deze checkoutomgeving. Er is geen brede lokale zoekactie naar privébestanden gedaan. |
| Onafhankelijke directe-team-allowlist | Niet geverifieerd | Vereist de bestaande geautoriseerde Manager-sessie en de runner-readback. |
| HR Admin-referentie en buiten-teammedewerkers | Niet geverifieerd | Geen HR Admin-referentiesessie beschikbaar. |
| Buiten-team-cases en relevante spells | Niet geverifieerd | Geen geautoriseerde fixture-read uitgevoerd; ontbrekende fixtures kunnen dus niet als PASS tellen. |

Benodigde tooling: Vercel CLI 65.0.0 kon read-only projectinspectie uitvoeren voor edwinitsolutions/liquidhr. Supabase MCP kon alleen project- en migratiehistorie read-only lezen. De Supabase CLI ontbreekt; SUPABASE_ACCESS_TOKEN en LIQUIDHR_CORE_TEST_DB_URL zijn niet aanwezig; de .vercel-projectlink en .vercel/.env.production.local ontbreken. Er is geen credential-, cookie- of tokenwaarde in dit rapport opgenomen.

## Stopvoorwaarden en vervolgbesluit

Start geen fase zolang project, alias, bron-SHA, Core TEST-ref of migratiestaat niet onafhankelijk overeenkomt. Stop fase D bij iedere scope-, fixture-, KPI-, detail- of Excel-mismatch. Als na C een autorisatieprobleem verschijnt: stop D; rollback alleen na afzonderlijke DB-autorisatie en alleen via de ledger. Herstel of wijzig de Vercel-alias uitsluitend na afzonderlijke RELEASE LIQUIDHR TEST-autorisatie.

Fase A zelf is op bron- en migratiehistorieniveau voorbereid en Core TEST-ref wnpfloqpjvaacobppbpk is read-only bevestigd. Zij is hier niet gestart: deze opdracht stopt vóór A en verleent geen databaseautorisatie; bovendien ontbreken Supabase CLI en database-URL in deze omgeving. A kan uitsluitend na expliciet akkoord voor migratie 20261030065603 op dat exacte project worden uitgevoerd. Volledige voortgang naar B vereist daarnaast aparte RELEASE LIQUIDHR TEST-autorisatie en een bevestigde deployment-naar-Core-TEST-koppeling. C vereist een afzonderlijke DB-autorisatie én oplossing van de hierboven beschreven rol-deactivatieblokkade. D vereist daarna de al bestaande geautoriseerde sessies, het private manifest, onafhankelijke allowlist en bewezen negatieve fixtures.

## Eindoordeel

**HOLD — de actieve Vercel-app heeft geen onafhankelijk aantoonbare bron-SHA/Core TEST-ref; het private manifest en de geautoriseerde D-identiteiten/negatieve fixtures zijn niet beschikbaar; en C kan een gedeactiveerde tenant Manager-rol haar Insights-toegang laten behouden.**

Geen fase is gestart. Geen databasewrite, migratie, deployment, merge of sessiewijziging uitgevoerd.
