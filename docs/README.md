# Liquid HR documentatie-index

## Comprehensive security re-review — 2026-09-02

**Status: REVIEW COMPLETE — READY FOR ROADMAP REVIEW; NO REMEDIATION**

Een onafhankelijke review vanaf exact `origin/main` `155ccbde373a06684e37d9746b01dd65931c870b` is uitgevoerd in een geïsoleerde review-worktree. De review behandelt de historische SEC-001 t/m SEC-011 opnieuw en registreert vier nieuwe bevindingen (SEC-012 t/m SEC-015). De kandidaatwijziging is docs-only; er zijn geen applicatie-, test-, migration-, package-, database-, Vercel- of GitHub-mutaties uitgevoerd. Zie [`security/SECURITY_REVIEW_20260902_LUNA_MAX.md`](security/SECURITY_REVIEW_20260902_LUNA_MAX.md).

## AN-6 Contextual Drill & Compare — 2026-09-01
## Security Wave B — SEC-006/SEC-010 — 2026-08-31

**Status: RELEASED — PRODUCTION GREEN**

Wave B is fast-forward geïntegreerd vanaf candidate `ff8f4ee886018a62df764d8a162241cdb8a7871c` op approved main `0121ff13cb8693687d873b4d33930cd2ec18e35c`. De zichtbare versie is `1.20260831.3`. SEC-006 is **HARDENED WITH RESIDUAL** door ontbrekende malware scanning/quarantaine; SEC-010 is **CLOSED** na de gedeelde database-readback. De beschermde lokale environment-state is vastgelegd in [`AGENTS.md`](../AGENTS.md). Zie [`delivery/SECURITY_WAVE_B.md`](delivery/SECURITY_WAVE_B.md).
**Status: RELEASED — PRODUCTION GREEN**

AN-6 is integrated from approved source commit `dffc3c797adb66f7c3200a8244e4c283b7e2f6af` onto current `origin/main` in temporary branch `release/an6-contextual-drill-compare`; the integration commit is `5719bb602917de16cf1b92cba1afbc96432d8d65`. The leading contract is [`LIQUID_ANALYSE_AN6_CONTEXTUAL_DRILL_COMPARE.md`](requirements/reports/LIQUID_ANALYSE_AN6_CONTEXTUAL_DRILL_COMPARE.md). The release includes visible contextual drill from aggregate results, breadcrumbs with Back/Reset, exactly-two-context aggregate comparison, strict AnalysisSpec validation, aggregate-only ComparisonResult, and saved drilled-analysis fresh execution. It adds no migration, free SQL, AI, or employee raw-data exposure. Authenticated HR Admin and Manager acceptance, Production drill/compare/reset, tamper resistance, and scoped aggregate-only behavior are GREEN. The visible version is `1.20260901.1`; Production is READY on the released main state and the runtime-error check is empty. Production smoke performed no save or persistent business-data mutation.

## Zero-noise quality-gate maintenance — 2026-08-31

**Status: GREEN — CANDIDATE READY FOR REVIEW, NO MAIN INTEGRATION**

De actuele authoritative baseline is `origin/main` `fad1a115b496c1d4e0c211953930b272dde22e4c`, met zichtbare versie `1.20260831.2`. De maintenance-candidate werkt uitsluitend aan terugkerende quality-gate-noise: ESLint, de stale Journey-testfixture, Next `next-env.d.ts`, beperkte typegen-synchronisatie en migration-history-documentatie. De finale gate is groen: full suite hr-suite `309/309` bestanden en `1201/1201` tests, control `2/2` en `7/7`, strict TypeScript, ESLint `0/0`, i18n, diff-check en Webpack. Historische release-evidence hieronder blijft behouden en is geen actieve gate-exceptie. Zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md), [`delivery/MIGRATION_HISTORY_DRIFT.md`](delivery/MIGRATION_HISTORY_DRIFT.md) en [`delivery/SUPABASE_TYPEGEN_DRIFT.md`](delivery/SUPABASE_TYPEGEN_DRIFT.md).

## Final consolidation release candidate — 2026-08-31

**Status: GREEN — RELEASED**

Deze releasecandidate staat in `release/final-consolidation-20260831`, vanaf exact `origin/main` `8b080b06993e9de290d2756e6bef1c93f5a6095d`. AN-4/5 is semantisch overgenomen uit accepted candidate `f6a5844`; uitsluitend SEC-001/002 is overgenomen uit securitybron `3265b3d1faac0049c331aa951dfa7f11adbbccb9`. De Employee Creation Wizard QA-branch en alle bijbehorende probation-, salary-, wizard-, fixture- en `getUser`-wijzigingen zijn uitgesloten. De zichtbare versie is `1.20260831.2`.

De lokale releasegate is groen voor de targeted AN/securityset (`25` bestanden / `90/90` tests), strict TypeScript, i18n (`33` gelijke NL/EN-namespaces), ESLint (`0` errors / `14` bestaande warnings), `git diff --check` en Webpack (`233/233` routes). De éénmalige volledige suite is `307/309` bestanden en `1199/1201` tests: alleen de bekende ongewijzigde Journey-baselinefailure en de oorspronkelijke version-test vóór de bump waren rood; de version-test is daarna gericht groen bevestigd. Production smoke op de finale deployment was groen: HR Admin login/start, versie `1.20260831.2`, vier Analysis-states, role-switch `404`, missing employee `404` en `0` console/page-errors. De release-worktree-root is niet aangeraakt.

Read-only Production Supabase-preflight: gekoppeld project `wnpfloqpjvaacobppbpk` (`LiquidHR`) bevat `public.saved_analysis_definitions`; de AN-migratie is al geregistreerd als `20260831093310 / 20260830143757_saved_analysis_definitions`. De named single-migrationfunctie `mcp__codex_apps__supabase_apply_migration` is beschikbaar, maar niet aangeroepen omdat opnieuw toepassen onjuist zou zijn. De releasecandidate `774d233e8f3a9f038850951d1c7ba3ff823e7f67` is non-force naar `origin/main` gepubliceerd en Vercel Production `dpl_86JsxCCa1gFL9bKUWMU2qYQ83oAP` staat `READY` op die SHA. Er is geen production migration, `db push`, `--include-all` of history repair/pull gebruikt.

## Security Wave A — SEC-003/SEC-004/SEC-005 — 2026-08-31

**Status: GREEN — RELEASED**

Vanaf exact authoritative `origin/main` `9151248f224fb62a2d18c558c2627e1078c2cf0a` en zichtbare versie `1.20260830.2` is de beperkte Wave-A-remediatie uit codecommit `b490cde` en documentcommit `0bb6c81` geïntegreerd in releasecandidate `537b4e2`. De zichtbare versie is exact eenmaal verhoogd naar `1.20260831.1`. SEC-003 sluit test-role switching server-side in iedere production-runtime af, ook met een stale flag; development/test en expliciet geconfigureerde Vercel Preview blijven beschikbaar. SEC-005 valideert forwarded/Host-input tegen de canonical application origin, Vercel deployment-hosts en lokale development-hosts en gebruikt geen onbekende fallback-origin. Auth callback-, OAuth/reset-link-, invitation- en signout-consumers gebruiken dezelfde helper.

Voor SEC-004 is de bestaande Supabase browser-sessionarchitectuur behouden: de `sb-wnpfloqpjvaacobppbpk-auth-token`-cookie blijft browserleesbaar omdat Supabase SSR de browser-refreshcyclus via `document.cookie` uitvoert. De nieuwe kleine hardening zet `Secure` in HTTPS production-contexten; `HttpOnly` blijft een expliciete server-only session-migratiebeslissing. Er is geen migration, schema/RLS/grantwijziging, production env-write of permissionverbreding. Vercel Production is succesvol op de exacte finale `origin/main`-SHA; de production-smoke bevestigde de fail-closed role-switch, Secure-cookie en canonical hostredirect. Zie [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md), [`CURRENT_CONTEXT.md`](CURRENT_CONTEXT.md) en het externe rapport op `C:\Users\Edwin\Documents\Apps\LiquidHR-Test-Evidence\security-review-20260830\SECURITY-WAVE-A.md`.

## AI Usage Insights V1 — 2026-08-30

**Status: GREEN — RELEASED**

AI Usage Insights is geïntegreerd als permission-gated Insights-report op `/insights?report=ai-usage`. De server leest uitsluitend de bestaande canonical AI Foundation-invocations en Liquid Credits-balance, aggregeert tenant/HR-group-scoped data en geeft alleen een typed operationeel rapport door aan de NL/EN UI. De acceptatie bevestigde HR Admin op desktop en `390x844`, periodewisseling, KPI's, trend, capability-, quality- en statusbreakdown, geen horizontale overflow of console-errors, en 403/geen report-oppervlak voor Manager en Employee. De ene expliciet geautoriseerde synthetische Employee Notes-call is via de UI door dezelfde AI Foundation-accountingketen gegaan; er is geen core AI-runtimewijziging, Employee Notes-counter, shadow ledger of migration toegevoegd. Zie [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md) en [`CURRENT_CONTEXT.md`](CURRENT_CONTEXT.md) voor de delivery-evidence.

## AI Improve V1 — Employee Notes

De eerste product-capability bovenop de centrale AI Foundation is geïmplementeerd op de omschrijving van Employee Notes. Zie [`LIQUIDHR_AI_IMPROVE_V1_EMPLOYEE_NOTES.md`](requirements/ai/LIQUIDHR_AI_IMPROVE_V1_EMPLOYEE_NOTES.md) voor het afgebakende contract en de autorisatie-/lifecyclegrenzen. De formele deliverystatus staat in [`IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md) en [`CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md).

## Liquid Analyse AN-4/5 Mijn Analyses en Liquid Explore V1 — 2026-08-30

**Status: AN-4/5 TEST GREEN — READY FOR FINAL INTEGRATION**

AN-4/5 is als geïsoleerde slice vanaf actuele `origin/main` `9151248f224fb62a2d18c558c2627e1078c2cf0a` geïntegreerd in `work/an4-an5-my-analyses-explore-v1`, zonder mergeconflict; de zichtbare versie blijft `1.20260830.2`. De Analyse-hub houdt exact vier tegels: `Nieuwe analyse` blijft gepland; `Verkennen`, `Mijn analyses` en `Rapporten` zijn actief. Liquid Explore gebruikt uitsluitend de bestaande AnalysisSpec/semantic layer en `LiquidCanvas`. Mijn Analyses bewaart alleen de server-gevalideerde analyse-definitie met tenant-, HR-group- en owner-scope; resultaat- en medewerkerdata worden niet opgeslagen.

De migration `apps/hr-suite/supabase/migrations/20260830143757_saved_analysis_definitions.sql` is exact eenmaal op canonical Supabase TEST toegepast via `mcp__codex_apps__supabase_apply_migration`; remote registreerde `20260831093310 / 20260830143757_saved_analysis_definitions`. De validator vereist exact de negen canonieke top-level keys, inclusief nullable `sort`, en weigert unknown keys; de oude `<> 10`-defectcheck is verwijderd. Remote bevat `408` unieke migratieversies; de bestaande drift (`313` remote-only, `292` local-only) is niet gerepareerd. De eindgate is `23` bestanden / `80/80` tests, plus strict TypeScript, lint, i18n, diff-check en Webpack `233/233` groen; DB catalogus/security is groen en pgTAP/RLS is `29/29` groen. Officiële typegen bevat het nieuwe type, maar brede drift betekent `TYPEGEN SYNC REQUIRED`; geen brede types-diff is gecommit. Authenticated acceptance is groen: HR Admin zag `Planeten`, exact vier hub-states, create/open/re-execute/delete werkte via de normale UI, en Manager kreeg voor owner-GET/PATCH/DELETE telkens `404 SAVED_ANALYSIS_NOT_FOUND`. Persistence was configuration-only en cleanup liet `0` rows achter. Current `origin/main` na fetch is `8b080b06993e9de290d2756e6bef1c93f5a6095d`, versie `1.20260831.1`; de candidate is niet geïntegreerd. Er is geen main-merge, push, deploy, version bump of release uitgevoerd. Zie [`requirements/reports/LIQUID_ANALYSE_AN4_AN5.md`](requirements/reports/LIQUID_ANALYSE_AN4_AN5.md) en [`delivery/AN4_5_MY_ANALYSES_EXPLORE_V1.md`](delivery/AN4_5_MY_ANALYSES_EXPLORE_V1.md).

## Liquid Analyse AN-2/3 Analysis Engine V1 — 2026-08-29

**Status: LOKALE IMPLEMENTATIE GREEN — RELEASEGATE OPEN**

De engine-slice is gebouwd vanaf authoritative baseline `4178f3b6e3b4c2e1a69ce50694437c347e37481e` in dedicated branch/worktree `work/an-analysis-engine-v1`. V1 gebruikt uitsluitend de bestaande groepsbrede employee-overviewservice: `employees`/`workforce`, `headcount`, `department`, `job` en `employment_status`, met strict versioned AnalysisSpec, authorization vóór retrieval, typed AnalysisResult en Foundation `LiquidCanvas` KPI/tabel/fallback. De Analyse-hub en de AN-0/AN-1 vier-tegelcontracten zijn niet gewijzigd. Er is geen AI-call, saved-analysismodel, Liquid Explore, conversational UX, migration of remote databasewrite.

Zie [`requirements/reports/LIQUID_ANALYSE_AN2_AN3_ENGINE_V1.md`](requirements/reports/LIQUID_ANALYSE_AN2_AN3_ENGINE_V1.md) en [`delivery/AN2_3_ANALYSIS_ENGINE_V1.md`](delivery/AN2_3_ANALYSIS_ENGINE_V1.md) voor de compacte contract- en deliverybeschrijving. De releasehandelingen volgen pas na de final gate.

## Centrale AI Foundation-integratie — 2026-08-29

**Status: AI FOUNDATION TEST GREEN — READY FOR FIRST PRODUCT CAPABILITY**

De centrale AI Foundation is semantisch geïntegreerd vanaf authoritative `origin/main`/`b9228380f74a4cacfd951e695ff694e2cf1f699c`, met releaseversie `1.20260829.3`. De volgorde is behouden: Wave 0, Wave 1A Runtime/Governance, Wave 1B Liquid Credits, OpenAI Provider en AI1C Provider Safety/FUP. De integration branch is `work/ai-foundation-central-integration`; de dirty root-worktree `work/r5-work-runtime` is niet aangeraakt.

De broncommits zijn semantisch verwerkt als `0b7e9fc`, `0fa6e62`, `ebf400f` + `11de0e5` + `fc1625d`, `7548f2a` en `3238bb9` + `84f7adb`. De Wave 1A types-follow-up `dbbabb9` was inhoudelijk al aanwezig en is als lege cherry-pick gereconcilieerd. De finale integratiecommits zijn `4b580c9`, `42cbe69`, `cc3aae8`, `df26db6`, `0fc46fa`, `8dace5c`, `ccae5f6` en `7e8003f`.

Canonical TEST Supabase `wnpfloqpjvaacobppbpk` heeft uitsluitend corrective migration `20260829134822_ai_provider_safety_internal_service_role_grants` gekregen; lokaal is dit `20260829154355_ai_provider_safety_internal_service_role_grants.sql`. De readback bevestigt interne schema usage/EXECUTE voor `service_role` en deny voor `authenticated`/`anon`, met publieke wrapper-contracten intact. Er is geen production-write of andere remote migration uitgevoerd.

De brede gate blijft als eerder bewezen evidence gelden: AI-targeted `18/18` bestanden en `86/86` tests, strict TypeScript, `check:i18n` (`33` gelijke NL/EN-namespaces), ESLint (`0 errors`, 14 bestaande warnings), `git diff --check` en Webpack production build (`228/228` routes). Na de grant-correctie zijn alleen relevante safety-tests en privilege-readback uitgevoerd; de full suite blijft `1101/1102` met uitsluitend de bekende Journey-baselinefailure op `Binnenkort beschikbaar`. De ene goedgekeurde live-call was synthetisch/no-PII, `gpt-5.6-luna`/low, `store:false`, `maxRetries:0`, provider count `1`, en eindigde `SUCCEEDED/VALIDATED` met credits `1` reserve/`1` settle, FUP `COMPLETED`, `208/85` tokens en `3362 ms`. De eerste product capability/UI is niet gebouwd; HeRa/Gemini, AN-2/3 en `TALENT-1` zijn onaangeraakt.

## R8 UX Foundation Final Release — 2026-08-28

**Status: R8 TEST RELEASE GREEN — LIQUIDHR UX FOUNDATION COMPLETE**

R8 Final Sweep wordt semantisch geïntegreerd vanuit source `work/r8-foundation-final-sweep` / `b5aca507e007f2e0900216aaec52ea3093aefa98`, vanaf common baseline `42066ab64c025e4f8b7653d656e0e3e76cccfaf3`, tegen de actuele central baseline `9708617b824a3bc4ca630146609671a0902e48d7`. De doelversie is exact één centrale bump naar `1.20260828.8`.

R8 convergeert de bestaande Custom Fields, Team Compass, Research, Reminders/Time Hub, Personal Settings, Talent, Product Updates en Process Work Detail op UX Foundation v1.2. API-, service-, permission-, business-, lifecycle-, URL-state- en data-eigendomscontracten blijven behouden. Er worden geen nieuwe Foundation primitives, schemawijzigingen, migrations, RLS/grants of remote databasewrites toegevoegd.

De geïntegreerde releasegate tegen deze actuele central baseline is groen: targeted `21/21` testbestanden en `97/97` tests, strict TypeScript voor `hr-suite` en `control`, i18n `33` gelijke NL/EN-namespaces, ESLint, Webpack `229/229` en `git diff --check`. De full suite is `262/263` bestanden en `1007/1008` tests; uitsluitend de bekende, ongewijzigde Journey-baselinefailure op `Binnenkort beschikbaar` blijft staan. De ene releasecommit/push, Vercel-provenance en authenticated HR Admin post-deploy acceptance moeten nog tegen de uiteindelijke main-SHA worden bewezen. Geldige uitzonderingen blijven de anchored Time Hub portal, Product Updates branded/public presentation, grafische/native/hidden-control onderdelen en de door AN beheerde `/dashboard`-compatibiliteitsroutes. Zie [`delivery/R8_FOUNDATION_FINAL_SWEEP.md`](delivery/R8_FOUNDATION_FINAL_SWEEP.md).

AN-0/AN-1 blijft centraal behouden: de legacy persoonlijke Dashboard-widgetruntime, widgetbeheer en dashboard-API's blijven retired; `/dashboard` en `/settings/dashboard-widgets` redirecten naar `/insights/analysis`, terwijl `/dashboard/start` de dagelijkse Startpagina blijft. De Analyse-hub houdt exact vier opties; latere AN-2/3- en AN-4/5-slices staan afzonderlijk beschreven en zijn niet stil in deze historische AN-0/AN-1-entry geïntegreerd. De forward migration `20260828125223_retire_legacy_dashboard.sql` blijft in deze release unapplied.

`NEW PRODUCT UI MUST USE FOUNDATION BY DEFAULT` blijft de leidende regel.

De formeel geparkeerde post-R8 debts zijn `TALENT-1` (Role Explorer intermittent React #441, oorzaak onbevestigd, geen aangetoonde R8-regressie), `AUTH-UX-1` (`/settings/product-updates` directe ongeautoriseerde route), `AUTH-UX-2` (`/custom-fields` directe ongeautoriseerde route) en `START-1` (`/dashboard/start` hydration #418`). Deze debts blokkeren UX Foundation completion niet en zijn niet onderdeel van R8-afsluiting.

## Setup Assistant HR Admin access-correctie — 2026-08-28

**Status: ACCESS GREEN — READY FOR CENTRALE TEST-RELEASE**

De dedicated branch `work/setup-assistant-hr-admin-access` is gestart vanaf exact `main`/`origin/main` `051c57a998c33d17a8ac1bef166fe58f5c15b133`. Setup Assistant read/open vereist nu uitsluitend `settings:read`; `TENANT_ADMIN` is geen voorwaarde meer. Enable/disable en completion blijven server-side beperkt tot `settings:write`, bestaande stap- en related-route-permissionfilters blijven leidend en de disabled-default blijft behouden.

De gerichte access-/guide-/schema-/version-tests zijn `14/14` groen, strict TypeScript, targeted ESLint en i18n zijn groen, en de Webpack-build genereert `229/229` routes. De volledige suite is `1015/1016` tests groen; alleen de bestaande, niet-gerelateerde Journey-failure op `Binnenkort beschikbaar` blijft staan.

Authenticated TEST HR Admin op de candidate bereikte `/settings/setup-assistant`, enable gaf echte `PATCH 200` met readback, de Settings-tegel en dashboard-trigger waren zichtbaar, en de drawer toonde 4 categorieën en 16 toegankelijke stappen. Desktopdrawer: `420px`; mobile: `390x844` fullscreen; overflow bleef gelijk aan de viewport en de production-mode console eindigde op `0` errors / `0` warnings. De Setup Assistant-instelling is via de normale UI/API **AAN** gelaten in TEST; completion is niet browsergemuteerd. Geen migration, schema/RLS-wijziging of structurele remote DB-write is uitgevoerd. Zichtbare versie: `1.20260828.3`.
## Centrale Navigation Sidebar v2 TEST-release — 2026-08-28

**Status: TEST RELEASE GREEN**

Navigation Sidebar v2 is semantisch geïntegreerd vanaf source `work/navigation-sidebar-v2` (`5cae907c`) op actuele central baseline `778b6016`. De vijf vaste secties, Dashboard-gating onder Insights, Gift Drawer/unread-badge, HR-group switcher, veilige menu-order-normalisatie en mobile/collapsed behavior zijn behouden. Zichtbare versie: `1.20260828.5`; geen Dashboard-redesign, AN-0/AN-1, R7-3, AI of databasewijziging.

De targeted gate is `10/10` bestanden en `32/32` tests groen, met strict TypeScript, i18n (`34` gelijke namespaces), ESLint (`0 errors / 8 bestaande warnings`), diff-check en Webpack `229/229`. De full suite is `267/268` bestanden en `1021/1022` tests groen; uitsluitend de bekende niet-gerelateerde Journey-failure op `Binnenkort beschikbaar` blijft open. Authenticated browser-sanity op desktop `1440x900` en mobile `390x844` bevestigde sidebar, Gift Drawer, Insights → Dashboard, Setup Assistant-trigger, organogram en geen horizontale overflow. Eén aparte avatarrequest in het organogram gaf HTTP `400`; dit valt buiten de Navigation-delta.

## Roadmap 7 Slice 2 — Organization, Access & Context Model — 2026-08-28

**Status: R7-2 TEST RELEASE GREEN — MAIN/VERSION/VERCEL VERIFICATION PENDING**

R7-2 is vanuit dedicated worktree `work/r7-organization-access` (`4e34ea4`) eenmaal geïntegreerd vanaf actuele `main`/`origin/main` `54100b4`. De zeven afgesproken Organization/Access/Context-routes gebruiken de bestaande UX Foundation; API-, service-, schema-, RLS-, grant-, permission- en businesscontracten zijn behouden. De centrale gerichte set, Setup Assistant-regressies, strict TypeScript, i18n, ESLint, Webpack en diff-check zijn groen. De full suite blijft alleen amber door de bekende, niet-gerelateerde Journey-failure rond `Binnenkort beschikbaar`.

De aanvullende organogrambeslissing is verwerkt: `/organization-chart` is read-only, `Afdelingen beheren` verwijst naar `/departments`, alleen `Organisatiestructuur` en `Rapportagelijnen` zijn user-facing, oude `?view=job` valt veilig terug, en orthogonale connectors gebruiken employee source-handles zonder arrows, dashed connectors of glow.

Authenticated HR Admin, Manager en Employee browser-sanity is op desktop `1440x900` en mobile `390x844` gecontroleerd; organogram, authorization/role-assignment en Setup Assistant-context bleven intact, zonder horizontale overflow of relevante consolefouten. Geen testdata-mutatie of structurele remote databaseactie.

Zie [`docs/delivery/R7_2_ORGANIZATION_ACCESS_CONTEXT.md`](delivery/R7_2_ORGANIZATION_ACCESS_CONTEXT.md) voor de route/permission/context-matrix en de volledige handoff.

## Roadmap 7 Slice 1 — Settings Hub & Platform Settings Model — 2026-08-28

**Status: R7-1 TEST RELEASE GREEN — MANAGER/EMPLOYEE SANITY LIMITED BY TEST FIXTURE**

R7-1 is vanaf exact `main`/`origin/main` `1fce3e28accd6385abd0a5e54742b0b6e4060098` geïntegreerd via releasecandidate `f7e90e6` (`release: integrate R7-1 settings foundation`). De zeven Settings-routes gebruiken de bestaande UX Foundation-controls en behouden de bestaande API-, data-, permission- en localStorage-contracten. De centrale gate is groen: gerichte settings/regressieset `8` bestanden en `30/30` tests, strict TypeScript, i18n (`34` gelijke namespaces), ESLint (`0 errors / 8 warnings`), Webpack (`229/229`) en diff-check. De full-suite blijft amber door uitsluitend de bekende Journey-failure rond `Binnenkort beschikbaar` (`263/264` bestanden, `1008/1009` tests). Authenticated HR Admin browser-sanity op de geïntegreerde candidate is groen op desktop `1440x900` en mobiel `390x844` voor `/settings`, `/settings/company-data` en `/settings/modules`, inclusief tabs, FormDrawer open/cancel, Switch-beweging, overflow en console. Manager/Employee blijven beperkt door TEST fixture/auth-omgeving. Zichtbare versie: `1.20260828.2`. Geen migration of remote database write is uitgevoerd.

## Centrale R6 Insights-integratie en TEST-releasegate — 2026-08-28

**Status: LOCAL RELEASE CANDIDATE GREEN — MAIN/PUSH/VERCEL VERIFICATION PENDING**

De dedicated release-worktree `work/r6-integration` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r6-integration` is vanaf exact `main`/`origin/main` `0ae99622609f45d83a8428f8cd4cb22985373f7b` opgebouwd. De goedgekeurde R6-1-tip `32d5c32cb44e0b274a9cbfd1fca81763f5471701` en R6-2-tip `e2c75eb5e9658c4ee899d69e96128357ec3bcedf` zijn éénmaal geïntegreerd; R6-2 bevat R6-1. Er waren uitsluitend documentatieconflicten. De delta bevat geen Supabase-migration, schema/RLS-, auth-, permission- of AI-wijziging. R5 Work/Automation en Setup Assistant zijn behouden.

De gecombineerde technische gate is groen voor de uiteindelijke R6-delta: Insights-tests `17/17` bestanden en `56/56` tests, strict TypeScript, i18n `34` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack `229/229` pagina's en diff-check. De volledige suite is `262/263` bestanden en `1003/1004` tests groen; de enige failure blijft de bekende, niet-gerelateerde Journey-test op `Binnenkort beschikbaar`. Tijdens browseracceptatie is één in-scope parserregressie gevonden en minimaal hersteld: Upcoming gebruikt nu de bestaande `databaseUuid` voor canonieke PostgreSQL-UUID's zonder RFC-variantlabel; de gerichte regressietest is groen.

Authenticated Playwright op `http://localhost:3010` is gecombineerd gecontroleerd voor HR Admin, Manager en Medewerker, op desktop `1440x900` en mobiel `390x844`. Canonical draft/Apply/Reset, active-chip removal, Back/Forward, CSV-export (`200`, `text/csv`), employee-drilldown/return-context, searchable multiselect, Upcoming-chip `Afdeling`, responsive overflow (`scrollWidth === viewport`) en Escape/focus-restore zijn groen. HR Admin kreeg live Upcoming-filterdata; Manager alleen de directe scope; Medewerker zag geen Insights en directe toegang leverde `0 rapportages`. De laatste browserconsole eindigde op `0` errors en `0` warnings. De zichtbare versie is exact éénmaal verhoogd naar `1.20260828.1` in `apps/hr-suite/lib/app-version.ts`; de packageversie bleef ongewijzigd. Geen remote Supabase-write of production-mutatie is uitgevoerd.

## Centrale R5 Work & Automation + Setup Assistant V1 releasegate — 2026-08-27

**Status: LOCAL RELEASE CANDIDATE GREEN — MAIN/PUSH PENDING EXTERNAL GIT-CREDENTIAL CHECK**

De centrale release-worktree `work/r5-setup-release-integration` is vanaf exact lokale `main`/`origin/main`-baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885` opgebouwd. De aangewezen R5 Work List, Runtime, Process Studio en shared TEST-fixture-integraties zijn gecombineerd met de drie lokale Setup Assistant V1-slices. Alleen één in-scope responsive Foundation-override is toegevoegd: de Setup-drawer gebruikt op desktop expliciet maximaal `420px`; routes, API, schema, RLS, permissions en businesslogica zijn verder niet aangepast.

TEST Supabase `wnpfloqpjvaacobppbpk` bevat de twee Setup-migrations al in remote history (`20260827065737_setup_assistant_v1`, `20260827072833_setup_assistant_v1_indexes`); er is geen migration opnieuw toegepast. Read-only schema-readback bevestigde beide tabellen, RLS, acht policies, authenticated CRUD-grants, geen anon-table-grants en audit/update-triggers. De nieuwe Setup-entiteiten staan in de gegenereerde lokale DB-types. Advisors tonen geen Setup-securityfinding; alleen vier Setup-gerelateerde `unused_index`-INFO's blijven naast de bestaande projectbrede advisorbevindingen.

De lokale gate is groen: gecombineerde R5/Setup-tests `15/15` bestanden en `63/63` tests, strict TypeScript, i18n `34` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack-productiebuild `229/229` pagina's en `git diff --check`. De volledige suite blijft RED uitsluitend door de bekende, niet-gerelateerde Journey-test rond `Binnenkort beschikbaar` (`258/259` bestanden, `986/987` tests groen). De R5 shared-fixture-helper blijft de bekende classifier mismatch rapporteren (`safeAsSharedR5Fixture: NO`); `NO_ASSIGNEE`, niet-gematerialiseerde deadlines en blocked-candidate zijn expliciet unsupported en non-blocking volgens de handoff.

Authenticated lokale Playwright-evidence is groen op `127.0.0.1:3003`: HR Admin Work/detail/runtime/Studio HTTP `200`, R5-items en desktop `1440x900` zonder horizontale overflow; Setup enable/readback en disable/cleanup waren echte `PATCH 200`-flows, completion mark/unmark gaf `200` met readback `1 → 0`, desktop drawer `420px`, acht API-suggesties waarvan twee zichtbaar na categorie-open, drie CTA's, mobile `390x844` fullscreen drawer en geen overflow. Beide Setup/HeRa-eventrichtingen sluiten de andere overlay. Manager en Employee kregen Work/detail/runtime `200`, Studio/Setup route `/geen-toegang`, beide API's `403` en geen Setup-edge-tab; negatieve 403-resource-events zijn verwachte probes en er zijn geen onverwachte page errors in de geïsoleerde routeflows.

De zichtbare versie is éénmaal verhoogd naar `1.20260827.1` in `apps/hr-suite/lib/app-version.ts`; `package.json` blijft technische metadata. Er is nog geen production-DB-actie of Vercel-deploy uitgevoerd. De live `git ls-remote`-controle is geblokkeerd door `SEC_E_NO_CREDENTIALS`; lokale main-integratie en de geautoriseerde push volgen alleen wanneer die externe credential-check beschikbaar is.

## Roadmap 5 — lokale Work & Automation-integratie — 2026-08-27

**Status: GREEN FOR SHARED R5 FIXTURE — WITH UNSUPPORTED SCENARIOS**

De dedicated branch `work/r5-integration` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r5-integration` is vanaf de lokaal geverifieerde `main`/`origin/main`-baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885` opgebouwd. De gedeelde fixture-range `053c3d2eb759e83413318be5e44ac051d79727c2^..b5b68ffc42b2fc326338631c4ad294eadd80a3d2`, Work List `833b8d2c927d2d555721dc96eadd19d88f2665c1`, Runtime `58226f839a161ab6ea1ce8f6a38c32ab88e67770` en Process Studio `d1f18009ee47ddc8b86c08695458bef79acd49b8` zijn als vier lokale integratieslices opgenomen. Alleen delivery-documentatie conflicteerde; beide R5-handoffs zijn behouden. Er zijn geen migrations, Setup Assistant-, R6- of Journey-wijzigingen, version bump, main-merge/push, Vercel- of productieacties uitgevoerd.

De gerichte R5-testset is groen (`12/12` bestanden, `41/41` tests), strict TypeScript, i18n (`33` gelijke NL/EN-namespaces), ESLint (`0 errors / 8 warnings`), `git diff --check` en Webpack (`226/226` routes) zijn groen. De volledige suite eindigde op `256/257` bestanden en `981/982` tests; de enige failure is de bekende, niet-gerelateerde Journey-test rond `Binnenkort beschikbaar`.

De canonical readback faalde aanvankelijk op `FIXTURE_UNEXPECTED_FAILURE: fetch failed` omdat `NEXT_PUBLIC_APP_URL` naar de niet-luisterende lokale poort `3107` wees. Met de integration-server op `127.0.0.1:3003` is de fixture-owned idempotency-residual read-only bewezen en daarna verwijderd met een exact TEST-gescopeerde cleanuptransactie. Daarna zijn exact één canonical setup en één readback uitgevoerd met de app-URL process-scoped op 3003. Setup bouwde stabiel 5 definitions, 7 instances en 12 work items op; readback bevestigde `PUBLISHED:3`, `DRAFT:1`, `RETIRED:1`, de claimed/rejected/request-changes/document-open/completed/output-cases en HR/Manager/Employee counts `7/3/3`. De helper rapporteerde setup `outcome: RED` en `safeAsSharedR5Fixture: NO`; dit is **KNOWN FIXTURE CLASSIFIER MISMATCH — UNSUPPORTED SCENARIOS ARE NON-BLOCKING**, omdat `NO_ASSIGNEE`, niet-gematerialiseerde deadlines en het blocked-candidate-pad expliciet unsupported zijn verklaard in de canonical handoff. Readback rapporteerde `READBACK_ONLY`. `migrations: NO` blijft bevestigd.

De eerste `agent-browser`-route faalde tweemaal met `CDP response channel closed`. De bestaande Playwright CLI/runtime-route werkte vervolgens wel. Authenticated HR, Manager en Employee zijn op `/work`, een UUID-workdetail en `/process-runtime/<workItemId>` gecontroleerd op desktop `1440x900` en mobiel `390x844`; de routes gaven HTTP 200, URL-state en terugcontext bleven behouden, overflow bleef gelijk aan de viewport, keyboard-focus was na Tab bereikbaar en de relevante browserconsole bleef fout- en waarschuwingvrij. HR kreeg assignment-options HTTP 200; Manager en Employee HTTP 403. HR kreeg `/settings/process-automation` HTTP 200; Manager en Employee werden naar `/geen-toegang` geweerd. De resterende `net::ERR_ABORTED`-events waren afgebroken Next-prefetches bij navigatie en geen console- of productfouten. De authenticated browsergate en canonical fixture/readback zijn daarmee GREEN; de expliciet unsupported scenario's zijn geen reden om de gedeelde R5-fixture af te keuren.

De live `git ls-remote`-controle werd door ontbrekende Git-credentials (`SEC_E_NO_CREDENTIALS`) geblokkeerd; lokale `main` en `origin/main` wijzen beide naar de genoemde baseline. De volledige suite houdt uitsluitend de bekende, niet-gerelateerde Journey-failure rond `Binnenkort beschikbaar`. Er zijn geen R5-businesscode-, migration-, Setup Assistant-, R6- of Journey-wijzigingen, main-merge/push, Vercel- of productieacties uitgevoerd.

## R5 Shared TEST dataset — 2026-08-26

**Status: GREEN FOR SHARED R5 FIXTURE — WITH UNSUPPORTED SCENARIOS**

De `R5-TEST`-fixture voor Roadmap 5 Work & Automation gebruikt uitsluitend bestaande P9/P10 process-, work-item-, document- en job-contracten. De helper maakt/leest de vijf R5-process definitions en de bereikbare `CLAIMED`, `REJECTED`, `REQUEST_CHANGES`, Employee acknowledgement en succesvolle output-cases idempotent terug. `OPEN_HR_QUEUE_UNCLAIMED`, deadlines, `BLOCKED` en echte non-self cross-scope negatives zijn bekende unsupported scenarios in de huidige remote runtime/RLS-contracten; zij zijn volgens de canonical handoff geen acceptance blockers. Als de helper hiervoor `safeAsSharedR5Fixture: NO` rapporteert, geldt: **KNOWN FIXTURE CLASSIFIER MISMATCH — UNSUPPORTED SCENARIOS ARE NON-BLOCKING**. Er zijn geen migrations, productieacties, version bump, main-merge, main-push of Vercel-acties uitgevoerd. Zie [`delivery/R5_SHARED_TEST_DATASET.md`](delivery/R5_SHARED_TEST_DATASET.md) en [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md).

## R5-2 Work List + Foundation — 2026-08-26

**Status: R5-2 GREEN; FULL SUITE RED ON EXISTING UNRELATED JOURNEY TEST**

De bestaande `/work`-projection is afgemaakt met Foundation v1.2, vijf tab-counts, URL-veilige filters, correcte service-pagination achter de bestaande administratie-wrapper, populated/no-results states, startpage process cards en Employee Detail → Processen-consistentie. Authenticated HR/Manager/Employee browseracceptance is groen op desktop `1440x900` en mobiel `390x844`; de enige suite-failure blijft de bestaande Journey-test op `Binnenkort beschikbaar`. Zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md) voor de actuele gate-status. Geen migration, merge, push, version bump of Vercel.
## R6-2 gedeelde Insights-controls — 2026-08-26

**Status: LOKAAL TECHNISCH GROEN — AUTHENTICATED BROWSER GREEN — GEEN MAIN/REMOTE ACTIES**

Vanaf exact R6-1 `32d5c32cb44e0b274a9cbfd1fca81763f5471701` levert `work/r6-insights-shared-controls` de gedeelde Foundation multiselect, responsive Insights-filterbar, active-filterchips, export shell en report-owned canonical queryserializers. Employee, Salary, Upcoming en Absence gebruiken dezelfde interaction mechanics zonder wijziging van reportsemantiek, privacy, berekeningen of server-authorisatie. Nieuwe tests, typecheck, i18n, lint, Webpack-build en diff-check zijn groen. De full-suite heeft alleen de bestaande Journey-failure op `Binnenkort beschikbaar`; exact gereproduceerd op baseline. Authenticated Playwright is groen op desktop `1440x900` en mobiel `390x844`, inclusief employee multiselect, Apply/Reset, active-filter removal, Back/Forward, exports, drilldowns, keyboard/Escape/focus restore, overflow en console. De twee minimale acceptance-fixes schrijven employee-filter removal naar de canonical URL en tonen Upcoming-chiplabel `Afdeling`. Zie [`delivery/parallel/2026-08-26-r6-2-insights-shared-controls.md`](delivery/parallel/2026-08-26-r6-2-insights-shared-controls.md).

## R6-1 Insights query + navigation seam — 2026-08-26

**Status: SEAM READY FOR R6-2: YES — LOCAL FEATURE BRANCH — NO REMOTE ACTIONS**

Op `work/r6-insights-query-seam`, vanaf exact baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885`, is de typed Insights query/navigation seam toegevoegd. De canonical URL gebruikt `report=<kebab-case-id>`, `groupBy`, `sortBy`, herhaalde arrayparameters en report-owned query keys; legacy aliases worden alleen bij parsing geaccepteerd. Rapportwissels ruimen stale state op, Apply gebruikt `router.push`, presentatie gebruikt `router.replace`, en employee/employment drilldowns behouden alleen een veilige interne Insights-returncontext. Upcoming direct URL rendering blijft achter dezelfde server-side catalog permission gate.

De frozen contract staat in [`requirements/reports/R6_1_INSIGHTS_QUERY_NAVIGATION_SEAM.md`](requirements/reports/R6_1_INSIGHTS_QUERY_NAVIGATION_SEAM.md). Targeted seam/query-tests zijn groen: `7` bestanden, `29` tests. TypeScript, i18n (`33` gelijke namespaces), lint (`0 errors / 8 bestaande warnings`), productiebuild (`226` routes/pages) en `git diff --check` zijn groen. De volledige suite heeft `253/254` testbestanden en `980/981` tests gehaald; alleen de bestaande Journey-test `components/journeys/journey-steps.test.tsx` faalt op ontbrekende tekst `Binnenkort beschikbaar`, buiten deze wijziging.

Authenticated HR browser-evidence op de branch-runtime `localhost:3002` bevestigt canonical employee-state, draft zonder URL-mutatie, Apply/history, stale cleanup bij Verzuim/Upcoming/Salaris en Back/Forward-herstel. Desktop en `390x844` zijn gecontroleerd; mobiel had `scrollWidth=390`. De dev-console bevat bestaande dashboard-shell hydration/state-meldingen; er is geen seam-specifieke fout vastgesteld. Geen migration, remote database-write, merge, push, deploy of version bump; zichtbare versie blijft `1.20260825.1`. Implementatiecommit: `cffcf04`; de documentatie is daarna in `a5d2de9` en `8597bf1` bijgewerkt.

## R4 Recruitment + Journeys centrale integratie — 2026-08-25

**Status: TEST-TRUNK GREEN; AUTHENTICATED COMBINED SANITY GREEN; READY FOR MAIN INTEGRATION**

De 15 approved R4-slices zijn semantisch geïntegreerd op `work/r4-recruitment-journeys-integration` vanaf exact baseline `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`. De lokale gate is groen met `253/253` testbestanden, `971/971` tests, strict TypeScript, i18n `33` namespaces, lint `0 errors / 8 warnings`, Webpack `226/226` routes en diff-check. Authenticated HR/Manager/Employee sanity op desktop `1440x900` en mobiel `390x844` is groen voor de in-scope Recruitment- en Journeys-routes; geen horizontale overflow en geen relevante finale console-errors.

De vier lokale migrations zijn read-only exact vergeleken en genormaliseerd naar remote TEST timestamps `20260825140121`, `20260825140137`, `20260825153223` en `20260825134000`. Er is geen migration rerun, remote apply, publication, Hire, merge, push of deployment uitgevoerd. Remote history bevat een bestaande dubbele Journey-registratie op `20260825150000`; die is bewust niet op afstand gewijzigd. Zichtbare versie: `1.20260825.1`.

## UX v1.2 final integration & acceptance — 2026-08-21

**Status: INTEGRATION COMPLEET; ACCEPTANCE RED / NIET GREEN**

`work/ux-v1-2-integration` is gestart vanaf exact `origin/main` `a65d1daaa9444602f4be52c2d32933cffd285dd0` en bevat de acht aangewezen commits in de gevraagde Batch 4 → 3 → 1 → 2-volgorde. De vier integratieconflicten waren uitsluitend documentatieconflicten; beide batch-evidences zijn behouden. Er zijn geen centrale Foundation-, API-, schema-, RLS-, permission- of businesslogicawijzigingen toegevoegd.

Lokale gates zijn groen: 213 testbestanden/833 tests, strict TypeScript, 33 gelijke NL/EN-namespaces, lint 0 errors/8 warnings, Webpack-productiebuild 225 routes en `git diff --check`. De standaard Turbopack-build faalde aanvankelijk vóór compilatie door worktree-package-resolutie; de geslaagde productiebuild is expliciet met Webpack uitgevoerd.

Authenticated localhost acceptance is deels uitgevoerd op 390×844 met een bestaande lokale HR-sessie. DEMO-035 personal edit/dirty-discard/real PATCH-herstel, notes CRUD, address CRUD-cleanup en avatar-confirmation zijn groen; startpage compact/volledig en geen horizontale overflow zijn gecontroleerd. Default (Liquid Navy) en LinkedHR zijn via persoonlijke instellingen gewisseld en teruggezet. Manager en Employee bereikten op company-data en authorization de geen-toegangssurface. Employment wizard, absence entry en process-studio entry zijn geopend zonder productdata te bewaren.

De document-upload blijft RED: zowel een toegestaan TXT-bestand als de minimale PDF eindigden op `POST /api/employees/<employeeId>/documents` `400` met `DOCUMENT_METADATA_FAILED`; er is geen tijdelijk document achtergebleven. Volledige acceptance van document CRUD, absence mutation/recovery/capacity, employment create, HR authorization create/coverage en process publish/retire is daarom nog niet bewezen. Er is niet naar `main` gemerged.

## UX v1.2 Correction Batch 4 — Foundation polish — 2026-08-21

Op `work/ux-v1-2-foundation-polish`, vanaf `origin/main` `a65d1daaa9444602f4be52c2d32933cffd285dd0`, zijn alleen de authorization-subflows en startpage-presentatie gepolijst. Create role gebruikt de bestaande `FormDrawer` met dirty protection, saving en foutstatus; coverage gebruikt de centrale `Dialog` met focus/Escape/restore. Startpage behoudt compact/uitgebreid, widgets, quick-action-scroll, drag/reorder, scopes en voorkeuren, maar gebruikt Foundation-radius/surfaces zonder zware shadows of hover-lift. Geen API-, database-, RLS-, permission- of businesslogicawijziging.

Lokale gate: 210 testbestanden/826 tests, strict TypeScript, i18n-pariteit met 33 namespaces, lint exit 0 met 6 bestaande warnings, Next-build met 225 routes en diff-check. Authenticated TEST HR/Manager acceptance is `BLOCKED BY ENVIRONMENT`: poort 3000 serveert de actuele app, maar canonical fixture-passwords ontbreken in de lokale environment; anonieme `/api/roles` geeft 401 en beschermde routes redirecten naar `/login`. Alleen deze work-branch is naar origin gepusht; geen main-merge.
## UX v1.2 Correction Batch 2 — permission regression fix — 2026-08-21

Op `work/ux-v1-2-hr-mutation-surfaces` zijn Company Location- en Organization-timeline-rows bij `canWrite=false` teruggebracht naar volledig leesbare statische articles zonder edit-drawer, Save of mutation-UI. Beide save-handlers hebben daarnaast een defense-in-depth permission guard. Bestaande company-location assignments blijven zichtbaar wanneer er nul actieve locaties zijn; Add blijft dan verborgen met empty guidance. Absence Report blijft FormDrawer; Recovery en Capacity blijven inline; de employment wizard en payloads zijn niet gewijzigd. Gerichte regressies zijn groen: 15/15 tests, strict TypeScript, i18n-pariteit met 33 namespaces, gerichte ESLint en `git diff --check`. Authenticated acceptance is geblokkeerd: de canonical fixture-preflight meldt ontbrekende lokale `TALENT_*_PASSWORD`-keys en poort 3000 is al bezet door een niet-herleidbare Node-server; er is geen secret gelogd, remote write gedaan of main-actie uitgevoerd.

## UX Foundation v1.2 + Employee Reminders — authenticated acceptance GREEN 2026-08-21

De interaction- en collection-foundation v1.2 is lokaal geïmplementeerd in de bestaande branch `work/ux-foundation-v1-2-interaction-collections`. De centrale Dialog, Drawer, ActionMenu, Pagination, FormDrawer, FormActions, ConfirmDialog en collection patterns zijn toegevoegd; Employee Reminders gebruikt nu EntityList, FormDrawer, RowActions en ConfirmDialog met behoud van de bestaande API-, mode-, permission- en datumcontracten. Volledige hr-suite: 209 testbestanden/824 tests, strict TypeScript, i18n-pariteit, lint exit 0 met 6 bestaande warnings en build met 225 routes. TEST HR is authenticated getest op localhost:3000; de echte Reminder acceptance op 390×844 is GREEN met tijdelijke create/delete-cleanup, geen horizontale overflow en geen relevante console-errors. De minimale Drawer mobile padding-fix is afgedekt met een regressietest. Er zijn geen schema-, API-, database-, RLS-, permission- of deploymentwijzigingen.

## Foundation Controls v1.1 — lokaal groen 2026-08-20

De centrale UI-foundation is uitgebreid met `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `FormField`, canonical `TabLink`/`TabButton` en geharde `TextInput`, `Button`, `IconButton`, `DropdownSelect` en `ScrollableTabs`. De actuele inventory en FOUNDATION_GAP-kandidaten staan in [`requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md`](requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md). De gate is groen met 203 testbestanden/788 tests, strict TypeScript, i18n-pariteit met 33 namespaces, lint, Webpack-build met 225 routes en diff-check. Browser smoke op `/login` is groen. Deze slice wijzigt geen routes, API, database, auth, permissions, RLS of businesslogica.

## Leidende algemene UX-foundation — Blok 4 afgerond

De algemene HR Suite UX- en stylingrichting staat in [`requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md`](requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md). Dit document is vanaf 2026-08-20 leidend; oudere design-systemdocumenten blijven historische context. Blok 1 legde de CSS-foundation vast, Blok 2 levert de centrale componentlaag in `apps/hr-suite/components/ui`, `patterns` en `layout`, Blok 3 past die toe op `/employees` en `/employees/[employeeId]` als reference implementations en Blok 4 maakt governance verplicht via `AGENTS.md` en de screen-redesignskill. Geen schema-, API-, RLS-, security-, release- of deploymentwijziging in Blok 4.

## Phase 2 Salary Structures + Salary Application — GREEN 2026-08-14

**Status: IMPLEMENTATION COMPLETE — PHASE 2 GREEN / CHECKPOINT BASELINE**

De salary-applicationfundering is in dezelfde `feature/salary-structures`-worktree uitgebreid met administration×CAO-beschikbaarheid inclusief nul-linkfallback, datumgebonden resolutie van gepubliceerde scale-/step- en bandrevisies, en HR-uitzonderingen in het bestaande Insights-patroon. De twee resterende browserdeviations zijn opgelost: de employment-detail i18n-key gebruikt nu de geneste salary-applicationnamespace en directory mode rendert geen beschermde peer-avatarroute. Zie [`requirements/salary-application/SALARY_APPLICATION.md`](requirements/salary-application/SALARY_APPLICATION.md). De actuele gate is groen met 195 testbestanden/741 tests, strict TypeScript, ESLint 0/0, 33 gelijke NL/EN-namespaces, Webpack-build met 224 routes en diff-check. Remote dev/test, RLS/grants, advisors en authenticated desktop/390×844-browserbewijs zijn gecontroleerd. Geen push, merge, deployment, PR of version bump.

## Phase 3 Salary Insights — GREEN 2026-08-15

**Status: GREEN — PHASE 3 CHECKPOINT READY**

Salary Insights is vanaf checkpoint `de3bf54` in dezelfde worktree afgerond met zes server-side salarisrapporten, peildatum, scopefilters, canonical Salary Application-resolutie, CSV-export, responsive NL/EN-i18n en HR Admin-only interne salarispositie. Manager heeft exact vijf reportcards/routes/API's; `salary-internal-position` ontbreekt voor Manager en directe URL/API/export geven `403`, terwijl HR Admin het rapport gebruikt.

De dev/test-fixture bevat 3 actieve minimumloonrijen (REGULAR/BBL, lokaal bedrag null en niet als €0 geaggregeerd) en 6 actieve canonical bandrijen (binnen/onder/boven, FTE/compa/range coverage). De authenticated API/RPC-gate bewijst HR Admin 63, Manager 17 scoped rows, Employee denied, empty/cross-tenant `FORBIDDEN`, geen peer-statistieken in Manager HTML/JSON/network en geen peerwaarden onder de vijf-groepdrempel. Browsergate: HR Admin desktop + 390×844 alle zes met echte band/minimumloon-KPI's/tabellen; Manager desktop + 390×844 alle vijf toegestane; Employee desktop + 390×844 zonder salarisdata. CSV, historische peildatum, NL/EN en responsive gedrag zijn groen.

Lokale gate: `199` testbestanden/`758` tests, strict TypeScript, ESLint 0/0, 33 gelijke NL/EN-namespaces, Webpack-build 225 pagina's/routes en diff-check. Remote dev/test RLS/grants/functie-eigenschappen zijn gecontroleerd; alleen bestaande projectbrede Supabase-advisor-WARNs blijven als apart hardeningpunt. De lokale checkpointcommit gebruikt `feat: add salary insights`; geen push, merge, deployment, PR of version bump. Zie [`requirements/salary-insights/SALARY_INSIGHTS_PRODUCT_REQUIREMENTS.md`](requirements/salary-insights/SALARY_INSIGHTS_PRODUCT_REQUIREMENTS.md), [`requirements/salary-insights/SALARY_INSIGHTS_UX_REFERENCE.md`](requirements/salary-insights/SALARY_INSIGHTS_UX_REFERENCE.md), [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md).

## Salarisstructuren - Stap 2

**Status: IMPLEMENTATION COMPLETE — PHASE 2 GREEN; vervangen door de actuele status hierboven**

De complete HR Admin-ervaring is lokaal aangesloten op de Step 1-architectuur: catalogus met meerdere logische structuren, detail/revisiehistorie, bandeditor met drie invoermethoden en centrale metrics, schalen/treden met vrije labels en expliciete volgorde, publicatiereviews, migratieconflicten en CAO-koppelingen. Gepubliceerde revisies blijven immutable en read-only in de UI. Deze onderliggende Stap 2-scope is bevestigd met de canonical remote fixture; de groene Phase 2-baseline hierboven bevat de volledige runtime-, browser- en release-evidence.

## Salarisstructuren — Stap 1 GREEN 2026-08-14

De canonieke productspecificatie staat in [`requirements/salary-structures/SALARY_STRUCTURES_PRODUCT_REQUIREMENTS.md`](requirements/salary-structures/SALARY_STRUCTURES_PRODUCT_REQUIREMENTS.md) en bevat exact SSR-001 t/m SSR-069. De canonieke schermspecificatie staat in [`requirements/salary-structures/SALARY_STRUCTURES_UX_REFERENCE.md`](requirements/salary-structures/SALARY_STRUCTURES_UX_REFERENCE.md) en bevat exact SS-001 t/m SS-011. De JSON onder [`requirements/salary-structures/testdata/`](requirements/salary-structures/testdata/) is de testbron; [`superpowers/plans/2026-08-14-salary-structures.md`](superpowers/plans/2026-08-14-salary-structures.md) begrenst twee stappen. Stitch is uitsluitend visuele richting.

Stap 1 levert het definitieve HR-groepmodel voor benoemde `SCALE_WITH_STEPS`- en `SALARY_BAND`-structuren, stabiele logische identiteiten, effectieve concept/gepubliceerde revisies, immutable publicatie, decimal-safe bandberekeningen, vrije tredelabels en expliciete volgorde, many-to-many CAO-koppelingen, migratieconflicten, audit, RLS, grants en getypeerde API-services. De bestaande 60 `CUSTOM_SCALE`-verwijzingen zijn zonder orphaned steps behouden. Alle negen migrations staan op dev/test-project `wnpfloqpjvaacobppbpk`; 9/9 tabellen hebben RLS en gesplitste policies, anon heeft nul tabelgrants en de security-advisor meldt geen salarisstructuurbevinding.

De canonieke dev/testfixture bevat 5 structuren, 7 revisies, 403 schaalstappen waarvan exact 198 officiële Rijk-stappen, 19 bandwaarden, 3 CAO-relaties en 1 expliciet migratieconflict; schaal 8/trede 5 is exact €3.741,48. Gerichte tests (21/21), strict TypeScript, gerichte ESLint en `git diff --check` zijn groen. Stap 2 bouwt in dezelfde worktree de volledige SS-001 t/m SS-011-UX; er is nog geen push, merge, deployment, PR of version bump uitgevoerd. **DO NOT recreate previous-step architecture.**

## Guided Recruitment — lokaal geconsolideerde testrelease 2026-08-13

Guided Recruitment is samengevoegd naar `main` en gepubliceerd als zichtbare productversie `1.20260813.1`. De volledige lokale gate is groen: 182 testbestanden/687 tests, strict TypeScript, 33 gelijke NL/EN-namespaces, ESLint zonder warnings, `git diff --check` en Webpack-build met 223 pagina's. GitHub `origin/main` en Vercel Production draaien op release-SHA `446a8f8ecef7b7c06f1c6910a990ecbe3bf84046`; deployment `dpl_JDCAbJkkTy9YDLWCB1UGLxvc7kKd` staat `READY`. De publieke Turnstile-, rate-limit- en malware-scanconfiguratie blijft bewust geparkeerd; publieke submit/upload blijft fail-closed.

## Guided Recruitment — publieke securityconfiguratie geparkeerd 2026-08-13

De publieke Recruitment-securityconfiguratie is bewust geparkeerd voor de development/testfase. De bestaande flow blijft fail-closed zolang Turnstile, rate limiting en malwarecontrole niet zijn geconfigureerd. Het volledige dossier en de latere releasegate staan in [`requirements/recruitment/LIQUIDHR_RECRUITMENT_PUBLIC_SECURITY_PARKED.md`](requirements/recruitment/LIQUIDHR_RECRUITMENT_PUBLIC_SECURITY_PARKED.md). Geen bypass, dummy scanner of productiecredentials toevoegen voordat Guided Recruitment richting productie gaat.
## Actuele implementatiegrens

Guided Recruitment Stap 3 is lokaal gebouwd in `feature/recruitment` en staat beschreven in [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md). De migrations zijn nog niet remote toegepast; de releasegate blijft daarom geblokkeerd voor remote advisors/types, authenticated browser/securitybewijs, version bump en releaseworkflow.

## Guided Recruitment — Stap 2 core experience 2026-08-13

Stap 2 is lokaal gebouwd in de bestaande feature-worktree op de Step 1-foundation. De slice bevat de HR-vacatureflow, zes vaste vacatureblokken, publicatie en configureerbare intake, kandidaat-/sollicitatiebeheer, pipeline-detail, afwijzen/heropenen, hire-keuze, veilige publieke vacatureweergave en proof-/scanner-gebonden publieke inzending. De schema-eerst wijziging staat lokaal in `20260813115443_guided_recruitment_core_experience.sql` en is als `guided_recruitment_core_experience` remote toegepast op dev/test `wnpfloqpjvaacobppbpk`; officiële remote types zijn opnieuw gegenereerd. Remote blijven synthetische inspectie-fixtures beschikbaar: 3 vacatures, 18 secties, 2 publicaties en 4 sollicitaties onder tenant `Planeten`/HR-groep `Planeten Recruitment`. Er zijn geen echte kandidaat- of CV-gegevens gebruikt.

Gerichte recruitmenttests (10/10), strict TypeScript, NL/EN-i18n-pariteit en de Webpack-productiebuild zijn groen. De normale buildvariant blijft door de bekende worktree/Next-resolutie vallen en is met `--webpack` groen uitgevoerd. Repo-lint blijft geblokkeerd door de bestaande ESLint 10/Next-pluginfout. Lokale browsercontrole bereikte de Next-errorlaag omdat de worktree geen `NEXT_PUBLIC_SUPABASE_URL` en publishable key heeft; authenticated UI- en echte public-intake-browserbewijs blijven daarom open. De vereiste Turnstile- en malware-scanconfiguratie blijft fail-closed. Deze beurt stopt bewust na Stap 2; Stap 3 wordt niet uitgevoerd.

## Guided Recruitment — Step 1 foundation 2026-08-13

De leidende requirements staan in [`requirements/recruitment/GUIDED_RECRUITMENT_PRODUCT_REQUIREMENTS.md`](requirements/recruitment/GUIDED_RECRUITMENT_PRODUCT_REQUIREMENTS.md) en de genormaliseerde Stitch-referentie in [`requirements/recruitment/GUIDED_RECRUITMENT_UX_REFERENCE.md`](requirements/recruitment/GUIDED_RECRUITMENT_UX_REFERENCE.md). Step 1 levert uitsluitend de secure foundation: module/permissions, 22 HR-groepgebonden tabellen met RLS en expliciete grants, Candidate/Application-scheiding, twee terminale uitkomsten, versioned/idempotente lifecycle-RPC's, concrete participantprojectie met directe revocation, private documentquarantaine, begrensde public read/write, custom-field/reminder/Employee/Journey/retention-contracten en strict TypeScript-services. De vijf Recruitment-migraties zijn toegepast op linked dev/test-project `wnpfloqpjvaacobppbpk`; het transactionele vier-actorcontract is groen en liet nul fixtures achter. Gerichte tests (45/45), typecheck, 33-namespace i18n, Webpack-build en minimale desktop/390px routeboundary zijn groen. Repo-lint blijft geblokkeerd door de bestaande ESLint 10/Next React-pluginfout. Echte Turnstile- en remote-malwarescannerconfiguratie ontbreekt; public upload blijft daarom fail-closed en Step 2 is **BLOCKED**. Zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) voor de overdracht. **DO NOT recreate Step 1 architecture.**

## LiquidHR Journeys — bouwstap 1 t/m 3 afgerond 2026-08-12

De leidende requirements voor de nieuwe zelfstandige module staan in [`requirements/journeys/JOURNEYS.md`](requirements/journeys/JOURNEYS.md). Het document legt HR-groepownership, blijvende Employee-identiteit, gepinde templateversies, concrete participants, actor-specifieke projecties, eigen permissions/RLS, preboarding-access, routes, het conceptuele datamodel, de 16-schermkaart en exact drie bouwstappen vast. Journeys blijft gescheiden van Process Automation, Recruitment, contract/salaris, dossier en chat.

De extra Stitch-ZIP is volledig geïnventariseerd in [`requirements/journeys/references/STITCH_REVIEW_2026-08-12.md`](requirements/journeys/references/STITCH_REVIEW_2026-08-12.md): 14 scherm-/HTML-paren voor 16 ontwerp-ID's; JY-014 en JY-015 ontbreken als afzonderlijke exports. Stap 1 levert configuratie en immutable publicatie. Stap 2 voegt het acht-tabellen-runtimemodel, write-free preview, concrete teamresolutie, idempotente activatie, gepinde snapshots, HR-lijst/detail, lifecycle, participantvervanging en de bestaande reminderadapter toe. Stap 3 voegt actor-veilige target-/participantprojectie, beperkte preboarding-startpagina, outcomes en browsermatrix toe. De remote migratieregistratie loopt tot `20260812153435`; pgTAP is 18/18 plus 12/12 groen, alle 16 Journey-tabellen uit stap 1–3 hebben RLS en advisors tonen geen nieuwe actionable Journey-securitybevinding. De verwijderbare `JY-S1`/`JY-S2` development/test dataset en de disposable PREBOARDING-fixture blijven beschikbaar. Zichtbare versie: `1.20260812.3`; release staat op GitHub `main` commit `2a9b58e52ca81e6ecd66ec2b85c95d6bcb6a4925` en Vercel Production is `READY` op exact deze SHA. De deployed routechecks bereikten alleen de Vercel SSO-beschermingslaag (`302`); authenticated production-UI is daardoor niet opnieuw bewezen.

## Looncontract aanpassen: contractkeuze en vier wijzigingsflows 2026-08-12

Op de dienstverbanddetails openen de eerste vier tegels onder `Looncontract aanpassen` nu een gedeelde wizard voor urenrooster, urenrooster + salaris, functie/afdeling/kostenplaats en salaris. De wizard toont eerst de contracten en de tijdlijn van het geselecteerde contract, laat de ingangsdatum kiezen via contractstart, huidige maand, volgende maand of een aangepaste datum en gebruikt daarna de rooster-, salaris-, keuze- en verdelingsvelden uit de medewerkerwizard. Een tweeweekse roosterkeuze wordt via de bestaande work-pattern-API als cyclus opgeslagen. De review toont expliciet `Dat contract gaan we aanpassen.` voordat opslaan mogelijk is. De server valideert contract en ingangsdatum opnieuw voordat bestaande timeline-/organisatie-API's worden aangeroepen.

De wijziging is lokaal geïmplementeerd en geverifieerd; er was geen nieuwe migratie, remote schemawijziging, push of deployment. De drie overige tegels tonen na contractkeuze bewust de bestaande niet-beschikbaarkoppeling. Authenticated browserbewijs van de detailpagina blijft open; de lokale browsercontrole bereikte wel `/login` met HTTP 200.

## Nieuwe medewerker- en dienstverbandwizard 2026-08-12

De wizard bevat nu profielfoto-upload onder `Optionele extra gegevens`, correcte periode-einddatums, niet-blokkerende proeftijdwaarschuwingen, automatische deeltijd/voltijd-afleiding en een read-only `Controleren`-tab die pas na `Dienstverband aanmaken` naar de database schrijft. De lokale wijziging is groen op de volledige suite, strict TypeScript, ESLint en i18n-pariteit; de proeftijdmigratie is nog niet remote toegepast en authenticated browserbewijs/deployment blijven open.

Aanvulling 2026-08-16: roosterdagen accepteren nu uren en minuten (`7,30` is 7 uur en 30 minuten, dus 7,5 uur). De avatar-Storage-policy gebruikt dezelfde actorveilige HR-groepsscope als de overige medewerker-subresources vóór de eerste organisatieplaatsing. Migratie `allow_hr_preplacement_avatar_storage` is toegepast op dev/test `wnpfloqpjvaacobppbpk`; de drie policies en de pre-placement schrijffunctie zijn remote gecontroleerd. Een authenticated live uploadcontrole blijft open.

## Navigatie en module-instellingen 2026-08-12

Teamkompas is verplaatst uit de linker navigatie naar een modulevenster op `Ontwikkeling` (`/workforce`). De actieve-modulencatalogus toont geen Documentdossiers meer: documentdossiers zijn altijd actief en worden door de lokale migratie `20260812054853_documents_always_on.sql` ook op databaseniveau niet uitschakelbaar gemaakt. De wijziging is lokaal geïmplementeerd en gericht gecontroleerd; remote migratie, advisors, typegeneratie, browsercontrole en deployment zijn nog niet uitgevoerd.

## Release 2026-08-11: productversie 1.20260811.1 — lokale releasegate

Alle actuele lokale featurecommits voor Process Automation-redesign, Surveys/eNPS, research-draftflows en Teamkompas zijn opgenomen in `main`. De zichtbare appversie staat op `1.20260811.1`. De volledige lokale gate is groen: 156 testbestanden/601 tests, strict TypeScript, 31 gelijke NL/EN-namespaces, volledige ESLint, `git diff --check` en de Webpack-productiebuild met 200 pagina's.

Vóór publicatie is remote een research-wrapperfout hersteld: de vier publieke wrappers zijn afgeschermde `SECURITY DEFINER`-functies met lege `search_path`, alleen `authenticated` execute en bestaande tenant-/HR-groep-/permission-/statusguards; de interne kernels blijven voor `authenticated` en `anon` afgesloten. Het transactionele researchcontract en officiële typegeneratie zijn groen. De advisor toont hiervoor vier bewuste WARNs naast de bestaande projectbaseline. Releasecommit `0598548a218433d1b2ed42db5a317b40f9347d00` staat op GitHub `main`; Vercel Production `dpl_7W8AKP7nAASxrfaiQz4SjbLUQj3F` is `READY` op exact deze SHA. Alias `/login` geeft HTTP 200 en de runtime-error-/error-fatal-scan over het controlevelster is schoon.

## Teamkompas actuele status 2026-08-11

De volledige niet-lege testcyclus is geverifieerd in de feature-worktree: HR Admin maakte en startte één tijdelijke campagne met 14 deelnames; de medewerker vulde 40 dual-ratings in en zag het eigen resultaat; consentvarianten outer-only, outer+inner en anoniem zijn getest; HR en manager zagen de drempelprojectie met drie named outer-profielen; cross-user toegang tot het persoonlijke resultaat werd geweigerd. De campagne, targets, deelnames, 200 antwoorden en vijf profielen zijn na afloop exact verwijderd. De Teamkompas-validator gebruikt `z.guid()` voor bestaande deterministische database-GUIDs en de regressietests zijn 4/4 groen. De feature is lokaal gecommit en in `main` samengevoegd; GitHub-push en deployment vallen onder release `1.20260811.1`.

## Teamkompas 2026-08-10 — historische uitgangssituatie vóór geautoriseerde testdata

De nieuwe optionele module Teamkompas staat lokaal op branch `codex/teamkompas-module` in de aparte feature-worktree. De leidende specificatie staat in [`requirements/team-compass/TEAM_COMPASS.md`](requirements/team-compass/TEAM_COMPASS.md) en het privacybesluit in [`decisions/FDR-0007-teamkompas-privacy-en-interpretatie.md`](decisions/FDR-0007-teamkompas-privacy-en-interpretatie.md). De slice bevat HR-groepgebonden campagnes, immutable tweetalige referentievragen, veertig dual-ratingstellingen, self-only antwoorden/resultaten, expliciete deeltoestemming, een anonimiteitsdrempel van minimaal vijf, manager-scope, HR-beheer, medewerkerflow en rolgestuurde teamoverzichten.

Lokaal zijn 153 testbestanden/584 tests groen; na de remote aansluiting zijn 12/12 gerichte Teamkompas-/modulecatalogustests, strict TypeScript, 30 gelijke NL/EN-namespaces, gerichte ESLint en `git diff --check` opnieuw geslaagd. De Webpack-productiebuild met 190 pagina's was al groen vóór de ongewijzigde follow-upmigraties en de getypeerde RPC-correctie. Remote zijn de Teamkompas-basis, de vijf foreign-key-indexen en het optionele create/update-RPC-contract toegepast; de SQL-contractproef, officiële typegeneratie en advisors zijn uitgevoerd. De advisor meldt geen ontbrekende Teamkompas-RLS of foreign-key-index; vijf bewuste authenticated SECURITY DEFINER-RPC's en twaalf direct na aanleg nog ongebruikte indexen blijven als verklaarde meldingen zichtbaar. De geauthentiseerde lege-toestandmatrix is groen: HR Admin bereikt lijst en 390px-dialoog, manager en medewerker zien hun eigen overzicht, beide niet-adminrollen krijgen op de beheerroute `/geen-toegang`, Escape/focuslus/focus-teruggave werken en de gerichte axe-scan meldt 0 violations; per weergave bleven 1–2 `incomplete` controles voor handmatige beoordeling over. Alleen een niet-lege campagnecyclus met echte uitnodiging, submit, eigen resultaat en geanonimiseerde teamprojectie blijft zonder goedgekeurde testdata open. Er is niet gecommit, gepusht, samengevoegd of gedeployed.

## Release 2026-08-10: productversie 1.20260810.3 — lokale samenvoeging

De hoofdworkspace `main` bevat nu de gecontroleerde lokale employment-/bedrijfsactiviteiten-slice en de Liquid Flow UX-slice uit `codex/liquid-flow-appwide`. De zichtbare appversie is verhoogd volgens de centrale `X.datum.volgnummer`-conventie; packageversie `0.1.2` blijft technische metadata. De lokale gate is groen: 151 testbestanden/575 tests, strict TypeScript, 29 NL/EN-namespaces, volledige ESLint, diff-check en Webpack-productiebuild met 187 pagina's. De releasecode staat op `edf8de9`; `main` bevat daarna docs-only verificatiecommit `f185a58`. Vercel Production `dpl_FtSAqLQqavF5JBg4ax1E6vWVJFme` en de daaropvolgende docs-only deployment zijn `READY`; alias `/login` geeft HTTP 200 en de runtime-scan meldt geen fouten.

## Release 2026-08-10: productversie 1.20260810.2 — remote schema toegepast

De zichtbare appversie is verhoogd volgens de centrale `X.datum.volgnummer`-conventie. De drie employment-migraties zijn remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De bestaande actieve dubbele IKV is transactioneel gerepareerd: de gesloten historische IKV 9 bleef behouden en de latere open relatie kreeg IKV 10. De remote controle geeft nul actieve IKV-duplicaten; security- en performance-advisors en officiële typegeneratie zijn uitgevoerd. Releasecommit `cce23987603bf25d2778672ce5a17a543e1f717a` staat op GitHub `main`; Vercel Production `dpl_A7nVUHc5JhCcAuQy2hiaNkRYno3L` is `READY`, alias `liquid-hr-hr-suite.vercel.app` geeft `/login` HTTP 200. De runtime-scan toont alleen een bestaand projectbaseline-incident (`PGRST303 JWT issued at future` op `/settings/holidays`).

## Feestdagen en bedrijfsactiviteiten 2026-08-10

De feestdageninstellingen ondersteunen naast lokale feestdagen nu HR-groepbrede bedrijfsactiviteiten met naam en datum. Actieve feestdagen en de eerstvolgende bedrijfsactiviteit verschijnen in de startpagina- en medewerkerheader. Zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) voor de lokale verificatie en de nog openstaande remote/browser-gate.
## Dienstverbandwizard: onderhoud en aanmaakregels 2026-08-10

De feature-slice voor de dienstverbandwizard is lokaal samengevoegd in `main` en remote toegepast. De implementatie bevat per-medewerker nummering voor dienstverband en IKV, contracten zonder einddatum, proeftijdvalidatie, einddatum-snelkeuzes, review-vóór-save, annuleren, administratie-informatie, Nederlandse decimale invoer en de fix voor de POST-400 door PostgreSQL-UUID-validatie. De remote unieke indexen zijn actief en de duplicate-IKV-preconditie is opgelost; zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md) voor bewijs.

## Vorige productie-release-status 2026-08-09

De mobiele Google-login hotfix staat live. Mergecommit `54f5f235c2523612008f5425586f72fc19ab0687` staat op GitHub `main`; Vercel Production-deployment `dpl_3g6rdX6aK6imhbcAGsgPNV3M15L4` is `READY` op alias `liquid-hr-hr-suite.vercel.app`. De zichtbare appversie is `1.20260809.2`. De remote `NEXT_PUBLIC_APP_URL` bleef ongewijzigd omdat de beschikbare Vercel-sessie opnieuw login vroeg; de code gebruikt die waarde niet langer als request-origin wanneer de actuele host beschikbaar is.

## Form Builder veldtypen 2026-08-09

De Forms-studio biedt nu alle 16 volwassen invoertypen uit het formuliercontract, gegroepeerd als invoer, keuzevelden en referenties. De builder heeft type-specifieke previews, NL/EN labels en helptekst, een keuzeoptie-editor en een gepubliceerde read-only guard. De documentreferentie is aangesloten op de bestaande RLS-afgeschermde documentleesweg. Herhaalbare groepen blijven volgens de blueprint bewust een vervolgstap; presentatieblokken zijn een aparte scope. Zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md) voor bewijs en open punten.

## Form Builder bindings 2026-08-10

De binding-editor gebruikt nu een gesloten, getypeerde developerregistry: 1 procesbinding, 11 veilige `DOMAIN_READ`-projecties, 3 bestaande `DOMAIN_PROPOSAL`-routes en 7 `COMPUTED`-formules. De studio toont per veld de categorie, geregistreerde sleutel/formule en uitleg in NL/EN; vrije tabellen, kolommen, SQL en formules zijn niet mogelijk. De compiler weigert onbekende registry-items, typeconflicten, schrijfmodi op lees-/computed-velden en voorstellen zonder schrijvende participant. De remote compatibiliteitsfix gebruikt aparte binding-aware projection/save-wrappers; de bestaande gedeelde form-RPC's zijn ongewijzigd gebleven. De wrappermigratie is remote toegepast en geregistreerd, de functiehashes/grants en remote gegenereerde types zijn gecontroleerd. Advisors tonen 1 bestaande security-INFO, 37 projectbaseline-security-WARNs en 389 performance-INFO's; geen wrapper-specifieke bevinding.

## P9/P10 — formulier- en procesproef 2026-08-10

P9 is lokaal en remote doorgezet voor de typed form-builder/runtime en de interne-transfer-adapter. De contextingangen zijn aangevuld volgens `schema -> API -> UI`: aparte `BLOCKED`-projectie op de startpagina, echte medewerker- en employment-proceskaarten/tabs, en geautoriseerde processtarts vanuit afdelingen en het organogram.

De gedeelde outputbrug leest compiled `definition_json.content.output` én top-level output, accepteert geldige PostgreSQL UUID-vormen zonder foutieve RFC-versiebeperking en gebruikt de live categorie `process-internal-transfer`. Live op poort 3000 claimde de HR-admin-worker één job en rondde die af (`succeeded=1`, zonder retry/fouten). Remote zijn job `SUCCEEDED`, output `AVAILABLE`, `PROCESS_OUTPUT`-document/PDF en storage-object aanwezig; de Work-detailpagina toont `Dossier interne overplaatsing`, `Beschikbaar` en `PDF downloaden`.

De drie testrollen zijn opnieuw doorlopen: HR Admin zag 20 afdelingsstarts, 51 organogramstarts, employment-processen en outputdownload; Test Medewerker zag de echte Workflows-kaart, medewerker-Processen-tab en employment-filter; Test Manager kreeg 0 afdelingsstarts. De actuele remote dataset bevatte geen `BLOCKED`-workitem, dus de niet-lege startpagina-blockerkaart blijft als fixturebewijs open. Het algemene medewerkerdossier toont de PDF nog niet aan een HR-admin zonder employee-record; een gerichte audience-uitbreiding naar actieve `TENANT_ADMIN`-rollen is niet toegepast zonder expliciete doelgroepgoedkeuring.

Lokale eindgate: volledige suite 147 bestanden/559 tests, gerichte output/worker-tests 7/7, strict TypeScript, NL/EN-i18n, volledige ESLint, `git diff --check` en Webpack-productiebuild met 187 pagina's zijn groen. Zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md) voor het resterende securitybesluit en exact live bewijs.

## Mobiele Google-login hotfix 2026-08-09

De productie-login stuurde Google OAuth via een verouderde `NEXT_PUBLIC_APP_URL` naar `https://liquidhr.vercel.app/auth/callback`. Dat domein hoort niet bij het actuele Vercel-project en staat niet in de Supabase-redirectallowlist, waardoor Supabase terugviel op de Site URL en de gebruiker zonder sessie op de startpagina belandde. Branch `codex/fix-mobile-google-auth` bepaalt de publieke origin nu uit gevalideerde request-/proxyheaders, gebruikt dezelfde origin na de PKCE-codewisseling, bewaart een veilige `next`, toont een juiste callbackfout en blokkeert herhaalde Google-submits tijdens laden.

Lokaal bewijs: 7 gerichte auth-tests, 145 testbestanden/546 tests, strict typecheck, i18n-pariteit met 29 namespaces en de Webpack-productiebuild met 181 pagina's zijn groen. Op 390x844 gebruikt de gewijzigde build `http://localhost:3100/auth/callback`, ook met de bewust verouderde omgevingswaarde, en heeft het loginscherm geen horizontale overflow. Gerichte ESLint wordt geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit. De hotfix is nog niet samengevoegd, gepusht of gedeployed; productie blijft dus open tot de expliciete feature-release. Als configuratiehygiëne moet `NEXT_PUBLIC_APP_URL` bij die release naar `https://liquid-hr-hr-suite.vercel.app` worden gecorrigeerd.

## Release 2026-08-09: productversie 1.20260809.2

De zichtbare appversie is verhoogd voor de mobiele Google-login hotfix. De release staat lokaal klaar op `codex/fix-mobile-google-auth`; merge, GitHub-push en Vercel-deployment volgen na de releasegate.

## Release 2026-08-09: productversie 1.20260809.1

De zichtbare productversie is verhoogd naar `1.20260809.1` volgens de centrale `X.datum.volgnummer`-conventie. Releasecommit `4813082e9f4a16ace3621d39f3b6d9968b2e716e` staat op `main` en `origin/main`. De automatische Vercel Production-deployment `dpl_GSqHEfvq7J3SCjPzxRwYDT6Bt4c5` staat op `READY`, is exact op deze commit gebouwd en geeft `/login` HTTP 200. De runtime-errorscan over het afgelopen uur vond geen fouten.

## P8-status en lokale voortzettingsbasis 2026-08-09

P8 — proces- en formulierstudio — is schema/API/UI-matig uitgevoerd in de feature-worktree en lokaal samengevoegd naar `main` in mergecommit `2ff60c5`. De remote P8-tabellen/RLS/RPC-grants, lokale tests/build en de authenticated HR-admin lifecycle zijn bewezen. De P8-gate blijft bewust onder 100%: clean live revision-conflictfeedback/stop-retry, volledige field/preview/accessmatrix-herhaling en de P9-controles staan open. Zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md) voor exact bewijs en het handmatige plan. Er is niets naar GitHub gepusht of gedeployed en er is geen down-scenario uitgevoerd.

## Canonieke lokale voortzettingsbasis voor P9 2026-08-09

Gebruik voor de volgende testthread de hoofdworkspace `C:\Users\Edwin\Documents\Apps\LiquidHR` op branch `main`; dit is nu de gecombineerde lokale testbasis. De feature-worktree blijft als bron/checkpoint beschikbaar op `codex/process-automation-p4-p5`. Er is nog niets naar GitHub gepusht of gedeployed.

## Historische P4/P5/P6/P7-gate vóór P8 2026-08-08: Process Automation runtime, werk en automation

P4, P5, P6 en P7 zijn uitsluitend uitgevoerd op featurebranch `codex/process-automation-p4-p5`; dit blok is de historische basis vóór de P8-slice. De P4/P5-handoff is opnieuw tegen remote gecontroleerd en niet blind overgenomen: P4 is functioneel bewezen, P5 heeft nog expliciet participant-DOM/network-bewijs open, en P6/P7 hadden bij de start geen niet-lege remote fixtures.

P4 levert de transactionele `start_process`/`perform_process_work_item_action`-kernel met instance-/step-locks, idempotency en correlation, condition-evaluatie zonder `eval`/raw SQL, assignment- en parallel-`ALL`-afhandeling, terminal outcomes, append-only events en gesaneerde audit. P5 levert versioned form definitions, current/new response revisioning, expected-version autosave, server-side hidden/visibility/access projection, een gedeelde Zod-payload, een toegankelijke NL/EN-renderer onder `/process-runtime/[workItemId]` en dunne API-adapters. Documentreferenties worden server-side gecontroleerd tegen `employee_documents`, `document_audiences`, niet-verwijderde records en het bestaande documentleesrecht.

Lokale migraties staan onder `apps/hr-suite/supabase/migrations/20260808135322_process_automation_p4_runtime_engine.sql` tot en met `20260808152400_process_automation_p5_document_reference_compatibility.sql`; remote zijn de overeenkomstige P4/P5-migraties en compatibiliteitsfixes geregistreerd, inclusief `process_automation_p4_runtime_engine`, `process_automation_p5_form_runtime`, `process_automation_p4_p5_schema_hardening`, `process_automation_p4_p5_hardening`, `process_automation_p4_p5_performance_indexes`, `process_automation_p4_p5_runtime_grants`, de audit/assignment/form/action/start-compatibiliteit en de document-reference-compatibiliteit.

Schema/RLS/grants/audit/types zijn gecontroleerd: alle zes runtime/form-tabellen en `audit_logs` hebben RLS; de twee response-tabellen hebben geen directe authenticated tabelrechten; public wrappers zijn `SECURITY INVOKER` met alleen authenticated execute; interne kernels zijn `SECURITY DEFINER` met authenticated execute en anon geweigerd. Zes runtime-audittriggers schrijven alleen canonieke auditacties (`CREATE`/`UPDATE`) met correlation en zonder formwaarden. `packages/db/types.ts` is opnieuw gegenereerd tegen remote.

Remote tests zijn opnieuw groen voor contract, start/materialisatie, duplicate submit/start, stale versions, forbidden actions, request changes, reject/cancel, half-failure rollback, parallel `ALL` en de vier participant-projections. De P5-test bevestigt exact de toegestane velden per requester/manager/HR/observer en weigert ongeldige of niet-geautoriseerde documentreferenties. Alle fixtures waren transactioneel en er staan nul runtime/form/audit-testrows achter.

Lokaal zijn 140 testbestanden/527 tests, strict typecheck, i18n-pariteit met 29 namespaces, gerichte ESLint en de Webpack-productiebuild met 179 pagina's groen. De repo-brede lintopdracht blijft geblokkeerd door de bestaande ESLint 10 versus `eslint-plugin-react`/`eslint-config-next`-incompatibiliteit; de standaard Turbopack-build blijft door de feature-worktree `node_modules`-junction geblokkeerd, terwijl dezelfde productiebuild met Webpack slaagt.

P6 levert `/work` als lijst-eerst werkruimte met URL-state, tabs, filters, sortering, veilige kleine projecties, detail met subject/opdracht/formulier/current-new-weergave/voortgang/tijdlijn/actiebalk, assignmentuitleg, concurrentiefeedback en NL/EN. De sidebar, startpagina en medewerkerdetailpagina sluiten aan op bestaande patronen. P6-migraties omvatten de werkprojectie, administratie-filter en tenant-specifieke admin-permissions. Browserbewijs bevestigt `/work` voor HR-admin, manager en medewerker in de lege-state; desktop en 390px mobiel hebben geen horizontale overflow. Een geautoriseerde niet-lege queue-kandidaat ontbreekt remote, waardoor claim/action en de queuekandidaat-browserrol nog niet live zijn bewezen.

P7 levert `workflow_jobs`, claim/finish/requeue met locking, retry/backoff/dead-letter, deadlineprojectie naar de bestaande reminderbron, in-app proceswerkprojectie, HTML/PDF-dossieroutput, output-downloadcontext en actor-only documentrechten. Immediate drain en de authenticated schedulerfallback-route bestaan; er is geen persistente schedulerconfiguratie of productie-operatiebewijs toegevoegd. Er is geen externe AI of mailprovider toegevoegd. Nieuwe tests dekken dubbele runners, retry/dead-letter en output-downloadauthorization; de remote P6/P7-contracttest is opnieuw groen (`[]`). Remote advisors tonen geen P6/P7-specifieke securitywaarschuwing; resterende meldingen zijn projectbaseline of ongebruikte-index-informatie voor nieuwe, nog lege tabellen.

Historische conclusie vóór P8: P4 is functioneel bewezen; P5 houdt participant-DOM/network-bewijs open. P6 en P7 zijn schema/API/UI/code- en contractmatig uitgevoerd, maar de vereiste niet-lege queue- en live async recovery/output/reminder-bewijslast, volledige keyboard/focus- en gerichte axe-controle en persistent schedulerbewijs ontbreken. De gecombineerde P4/P5/P6/P7-gate was daarom niet 100% bereikt.

## Release 2026-08-07: productversie 1.20260807.2

De zichtbare productversie is verhoogd naar `1.20260807.2` volgens de centrale `X.datum.volgnummer`-conventie. De versie staat uitsluitend in `apps/hr-suite/lib/app-version.ts`; de bijbehorende unit-test is bijgewerkt. Releasecommit `98ac2ebc3c8c0b15dd73f373ea4f0889cf14d0a3` staat op `main`; Vercel Production-deployment `dpl_66LXmSsJavEWFj34CFZqnjPfCKVy` staat op `READY` en is exact op deze commit gebouwd.

## Historische Process Automation P2/P3-gate 2026-08-08: datamodel, resolver en work-item kernel

P1 is uitgebreid met P2 en P3 volgens de blueprint. P2 bevat de tenant-/HR-groep-/administratiescope, definitiedrafts en immutable gepubliceerde proces- en formulierversies, runtime instances/steps/workitems/events, typed employee/employment-subjectlinks, pinned process versions, RLS, canonical permissions en directe authenticated-SELECT-only grants. P3 bevat de test-first assignment resolver met business date policies, `EXACTLY_ONE`/`ANY_ONE`/`ALL`, scope- en eligibilityfilters, self-assignment/deputyregels, materialiseerbare assignment evidence en de atomaire claim/release/reassign/re-resolve-kernel met optimistic locking en audit-events. De API-adapters staan onder `app/api/process-work-items/[workItemId]/`.

De lokale migraties `20260808121033_process_automation_p2_foundation`, `20260808123429_process_automation_p3_workitem_kernel`, `20260808124952_process_automation_p2_grant_hardening`, `20260808125227_process_automation_p3_rpc_contract` en `20260808130657_process_automation_p2_fk_indexes` zijn op Supabase-project `wnpfloqpjvaacobppbpk` toegepast. De P2/P3-contracttest en de twee-sessie `ANY_ONE`-claimtest zijn remote groen. Er is geen P4-transition engine, studio/runtime-UI, product-AI, seeddata, commit, push of deployment uitgevoerd.

De implementatie-, gedrags- en cleanup-gate is bereikt. De twee tijdelijke concurrency-fixtures (`p3-concurrency-contract` en `p3-concurrency-contract-2`) zijn na de expliciete bevestiging transactioneel verwijderd; de gecontroleerde cascade-relaties rapporteren nul rijen en de append-only/immutable-triggers staan weer actief. De definitieve P2/P3-handoff is daarmee 100% afgerond. De actuele P4/P5-status staat hierboven.

## Historische P1-gate 2026-08-08: Process Automation definitiecompiler

Dit was de pure strict-TypeScript-startfase. De actuele P2/P3-status en resterende cleanup-blocker staan hierboven.

## Actuele medewerker-aanmaakwizard 2026-08-07

## Hotfix 2026-08-08: wizard RLS vóór organisatieplaatsing en vaste controlebalk

De administratievoorwaardestap kon een nieuwe medewerker zonder organisatieplaatsing niet bijwerken: de bestaande `employees_update_group`-policy liet alleen self- of plaatsingsscope toe. Supabase retourneerde daardoor voor de correcte PATCH nul rijen, waarna de service dit onterecht als 409-concurrencyconflict meldde. Migration `20260808144955_allow_hr_group_employee_update_before_placement` laat HR-geautoriseerde `employee:write`-updates binnen dezelfde HR-groep toe, met behoud van de bestaande tenant-/HR-groep- en self-/managementchecks. De migration is remote toegepast op `wnpfloqpjvaacobppbpk`.

De Controle-stap heeft een vaste onderbalk; het middenstuk blijft scrollbaar en de vorige/aanmaakknoppen blijven binnen beeld. De transactionele RLS-regressietest slaagde en liet geen testdata achter. Advisors tonen uitsluitend de bestaande projectbrede meldingen.

De medewerkerwizard bevat partnernaam in de kerngegevens, extra medewerkerentiteitgegevens, een sterretje uitsluitend bij verplichte velden, veldgerichte blur-validatie en een adres zonder invoer van een geldigheidsdatum. Er zijn twee duidelijke controleacties: alleen medewerker aanmaken of medewerker plus dienstverband aanmaken. Bij het dienstverband wordt eerst de administratie gekozen wanneer de HR-groep meerdere administraties bevat; de administratiedetails zijn uitklapbaar. Het medewerkertype staat op dienstverbandniveau met de zes nieuwe keuzes. Daarna kan de gebruiker loon-/contractgegevens toevoegen of overslaan; bij toevoegen worden de contract-, rooster-, salaris- en organisatie/kostenstappen aan de linkerzijde zichtbaar. De wizard vraagt gegevens niet dubbel, toont betaalfrequenties volgens de administratie-instelling, ondersteunt salarisschaal plus trede en toont de bijbehorende beloning. Functiegroep → functie → afdeling en leidinggevende zijn gekoppeld; kostenallocaties kunnen worden gesplitst. Nationaliteit en land zijn zoekbaar, startdatum en ancienniteitsdatum staan op de eerste dienstverbandstap en BSN is optioneel met uitleg. De drie migraties zijn remote toegepast als `20260807185718_allow_hr_address_creation_before_placement`, `20260807185727_allow_employee_administration_assignment_for_employment_creation` en `20260807185745_expand_employment_types_and_wizard_flow`. Security-advisor staat op 1 INFO / 21 WARN en performance op 344 INFO; dit is de bestaande projectbaseline. De officiële database-types zijn opnieuw gegenereerd.

## Hotfix 2026-08-08: bestaande subresources vóór organisatieplaatsing

De herintredingsflow kon een bestaand PRIMARY-adres van een medewerker zonder organisatieplaatsing niet lezen. Daardoor werd een tweede adres aangemaakt en ontstond ten onrechte een 409. Migration `20260808133244_allow_hr_preplacement_subresource_access` geeft HR binnen dezelfde HR-groep toegang tot medewerker-subresources en de activiteitenfeed vóór een organisatieplaatsing; de bestaande tenant-, HR-groep- en permissionchecks blijven actief. De remote controle bevestigde `subresource_read_allowed=true` en één zichtbaar bestaand adres. Security- en performance-advisors tonen alleen de bestaande projectbrede meldingen.

## Bestaande medewerker gebruiken vanuit de medewerkerwizard 2026-08-08

Een gevonden medewerker zonder dienstverband kan nu expliciet worden gekozen met **Deze medewerker gebruiken**; bij een medewerker met alleen een afgesloten dienstverband is de actie **Herintreden met deze medewerker** beschikbaar. De bestaande Employee blijft behouden; de persoonsgegevens, contactgegevens, het primaire adres en vrije veldwaarden worden in de wizard vooringevuld. Op de controlepagina wordt geen tweede Employee aangemaakt: bij een medewerker zonder dienstverband kiest de gebruiker tussen alleen bijwerken of ook een nieuw Employment starten. Voor een herintreding verschijnt bij het nieuwe Employment eerst een keuze om bruikbare gegevens uit het laatst afgesloten dienstverband als voorstel over te nemen of met nieuwe gegevens te beginnen. Als de bestaande match niet wordt gekozen, blijft de route voor een nieuwe medewerker beschikbaar. Voorstellen blijven beperkt tot de gekozen administratie en actuele stamdata. Zie [`requirements/employment/HERINTREDING_IN_MEDEWERKERWIZARD.md`](requirements/employment/HERINTREDING_IN_MEDEWERKERWIZARD.md). De browsercontrole bevestigde beide selectiepaden, het voorvullen en de twee controleacties; een nieuw dienstverband is niet gepubliceerd.

De kerngegevens-tab heeft een rustiger invoeropbouw: het personeelsnummer staat op een eigen rij, roepnaam staat vóór het geboortenaam-tussenvoegsel en het naamvoorbeeld toont uitsluitend de volledige opgebouwde naam. Partnernaam bevat naast de naam ook een afzonderlijk tussenvoegsel dat in de gekozen naamvolgorde wordt verwerkt.

Validatie toont nu een inhoudelijke melding bij ontbrekende verplichte velden of andere veldcorrecties in plaats van de algemene foutmelding. De tabs tonen tussen de navigatieknoppen alleen een subtiele **Meer gegevens**-indicator wanneer er onder de huidige positie nog scrollinhoud staat; Extra gegevens toont **Vrije velden** alleen wanneer voor de actieve HR-groep medewerkerdefinities zijn ingericht.

## Actuele regelingentijdlijn 2026-08-07

CAO- en bedrijfseigen regelingen worden in **Instellingen → Dienstverbanden en contracten → CAO / arbeidsvoorwaarden** als tijdlijn beheerd. Iedere `labor_condition_sets`-rij is een versie met `valid_from` en optioneel `predecessor_id`. De migratie `20260807145526_add_labor_condition_timeline` vult bestaande regelingen veilig met een startdatum, beschermt de opvolgerketen met een foreign key, unieke opvolgerindex en database-trigger, en biedt een transactionele opvolger-RPC. De UI toont per regeling alle opvolgers, berekent automatisch de vorige geldigheidsperiode tot de dag vóór de volgende startdatum en biedt toevoegen/wijzigen per versie. De bestaande contractreferentie en administratiecontext blijven behouden.

## Actuele fulltime-referentie voor verlof en dienstverband 2026-08-07

De `standard_hours_per_week` van de actieve CAO/bedrijfseigen regeling is nu de officiële fulltime-referentie. Zowel het contract als ieder `employment_schedules`-record bewaart daarvan een historische snapshot in `fulltime_hours_per_week`; de verloffactor wordt berekend als `min(contracturen, fulltime-norm) / fulltime-norm`. Daarmee geven 32 uur bij 40 uur fulltime een factor 0,8, 40 uur een factor 1 en meer dan 40 uur maximaal factor 1. De remote migrations `20260807141014_use_labor_condition_fulltime_reference` en `20260807162539_add_employment_contract_fulltime_reference` zijn toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; bestaande contracten en roosters zijn gevuld en gecontroleerd. De wizard en de dienstverbandmutatie tonen de fulltime-norm en rekenen de factor automatisch uit.

## Actuele verlofopbouwinrichting 2026-08-07

De HR-inrichting kiest nu eerst uit vijf beperkingstypen: onbeperkt, verlofopbouw, jaarlijks urenlimiet, jaarlijks urenlimiet met deeltijdfactor en beperking door overuren. De nieuwe leidende specificatie staat in [`requirements/leave/VERLOFOPBOUW_INRICHTING.md`](requirements/leave/VERLOFOPBOUW_INRICHTING.md). De schema-, API- en UI-slice is lokaal en remote uitgevoerd voor de testfase; bestaande testregels zijn waar nodig naar de nieuwe keuzes gerepareerd. Opbouwregelkaarten zijn volledig klikbaar en bewerkbaar; een nieuwe regel neemt de laatste waarden over en kan worden geannuleerd. De vervaltermijn toont de eenheid `Maanden`. De vijf enumkeuzes, RLS-koppeltabel, FTE-berekening en conditionele HR-editor zijn onderdeel van deze slice. De volledige toekomstige opbouwprojectie en overuren-afgeleide engine blijven open.

## Historische update 2026-08-05: productversie volgens centrale releaseconventie

De zichtbare productversie kwam uitsluitend uit `apps/hr-suite/lib/app-version.ts` en volgde `X.datum.volgnummer`. De toenmalige productversie was `1.20260805.1`; de npm-versie in `package.json` is technische package-metadata en bepaalt de zichtbare appversie niet.

## Actuele release 2026-08-06: HR-groepinrichting en productversie 1.20260806.2

De zichtbare appversie is verhoogd naar `1.20260806.2`. De vijf configuratie-entiteiten bedrijfskleuren/logo, feestdagen, eindredenen per land, vrije velden en bedrijfsdocumenten zijn remote omgezet naar HR-groep-eigendom. De remote migraties zijn `20260806174202_hr_group_wide_configuration_scope`, `20260806174221_grant_hr_group_permissions_to_hr_admin` en `20260806174857_harden_hr_group_configuration_policies`; de eerder aangebrachte demo-namen staan remote als `20260806143509_rename_demo_scope_display_names`.

De remote controle bevestigt gevulde `hr_group_id`-koppelingen voor alle tien betrokken tabellen, actieve RLS en geen resterende groepsbrede duplicaten. De officiële Supabase-types zijn opnieuw gegenereerd. Advisors: security `1 INFO / 19 WARN` (bestaande projectbaseline) en performance `348 INFO / 0 WARN`.

De lokale releasegate is groen: 130 testbestanden/481 tests, strict TypeScript, lint, i18n-pariteit met 28 namespaces, productiebuild met 173 gegenereerde pagina's en `git diff --check`. De geauthentiseerde browsercontrole bevestigt de HR-groepcontext `Planeten`, geen administratie-dropdown in de sidebar, alle drie administratiekaarten en zichtbare versie `1.20260806.2`; de console eindigt op 0 errors/0 warnings. GitHub bevat implementatiecommit `b6c5fc5f6ec9d9df79f465ba3f8cc2e2cfebbf8d`. Vercel Production-deployment `dpl_3LTk81cA8YdtGiRL27VQRWum1ADJ` (`liquidhr-p6m6ngtkm-edwinitsolutions.vercel.app`) staat op `READY` en is exact op die commit gebouwd. De runtimefoutscan en error/fatal-logscan zijn leeg; de publieke alias geeft zonder sessie de verwachte Vercel SSO-redirect.

## Actuele performance-optimalisatie 2026-08-07: startpagina en medewerkerslijst

In `main` (commit `f600375b3c5bc24a7d01d852717531be2b8fa8dc`) is de request-opbouw van `/dashboard/start` en `/employees` verkort. Layout en pagina hergebruiken nu dezelfde request-scoped autorisatie, actieve context en Supabase-client. De startpagina voert onafhankelijke data-, vertaal- en voorkeurreads parallel uit; de medewerkerslijst start de employee-read tegelijk met directory-, vertaal- en teamscope-reads en deelt de directe-teamquery met de employee-service. De startpaginatelling gebruikt twee smalle parallelle queries in plaats van de volledige employee-overview-RPC. Er is bewust geen schemawijziging toegevoegd: de live queryplannen/advisors tonen voor deze paden geen ontbrekende index als hoofdprobleem.

Lokaal zijn 130 testbestanden/481 tests, strict TypeScript, lint, i18n en productiebuild groen. Commit `3fcfe7068c4ea796a1544576cdadaa218a959be5` is naar GitHub-branch `feature/performance-startpagina-medewerkerslijst` gepusht. De gekoppelde Vercel-preview [`liquidhr-rgbpt20os-edwinitsolutions.vercel.app`](https://liquidhr-rgbpt20os-edwinitsolutions.vercel.app) staat op `READY`; buildduur was 39 seconden, zonder error/fatal-runtimelogs.

De geauthentiseerde Chrome-meting gebruikte drie runs per route en dezelfde zichtbare contentmarkers. Voor HR Admin ging `/dashboard/start` van mediaan 1.014 ms naar 916 ms en `/employees` van 886 ms naar 835 ms. Voor Manager ging de startpagina van 2.076 ms naar 979 ms en de medewerkerslijst van 1.088 ms naar 973 ms. Voor Employee ging de medewerkerslijst van 938 ms naar 807 ms. De medewerkerrol landt voor de startpagina bewust in de eigen medewerkercontext en rendert daar niet dezelfde startpaginamarker. De meting is richtinggevend: netwerk- en cold/warm-variatie blijft zichtbaar.

Vercel Production is daarna bijgewerkt: deployment `dpl_8pp1LgQBtgqJiMNeA1kwtS7VQ17M` (`liquidhr-hfmd89rkp-edwinitsolutions.vercel.app`) staat op `READY`, target `production`, en is exact op `main`/commit `f600375` gebouwd.

## Vervolg performance 2026-08-07: meetlaag, startpagina en medewerkerdashboard

Commit `d7a3727f5acc4fc9d540e191c7d50db83cca47e0` voegt een opt-in server-trace toe via `?perf=1` en verkort de request-keten van `/dashboard/start` en `/employees/[employeeId]`. De startpagina start de teamscope-read gelijktijdig met onafhankelijke reads en maakt de actieve-verzuimteller parallel. Het medewerkerdashboard gebruikt de request-scoped Supabase-client voor detail/layoutvoorkeuren, haalt dashboarddocumenten met een smalle top-3-read op, paralleliseert overzichtsdata en controleert notitiepermissies alleen op het notitietabblad. De medewerkerslijst is in deze slice niet functioneel gewijzigd.

De volledige lokale gate bleef groen: 130 testbestanden/481 tests, strict TypeScript, lint, 28 gelijke NL/EN-namespaces, productiebuild met 173 routes en `git diff --check`. Supabase is read-only gecontroleerd: relevante bestaande indexes zijn aanwezig, performance-advisor `347 INFO / 0 WARN`; er is geen DDL/RLS-migratie nodig. De code staat op `main`; de eerdere preview `dpl_7yQdNXbyww1gh2pkHhnVvJnmzqA6` blijft als historische tussencontrole geregistreerd.

De authenticated Chrome-meting op deze `main`-Production gebruikte drie runs per route en dezelfde zichtbare contentmarkers. HR Admin: `/dashboard/start` `1312/1207/922` (mediaan `1207 ms`), medewerkerdashboard `/employees/[employeeId]` `1037/994/985` (mediaan `994 ms`) en `/employees` `908/868/762` (mediaan `868 ms`). Manager: startpagina `3474/1128/1295` (mediaan `1295 ms`) en medewerkerslijst `995/752/1109` (mediaan `995 ms`). Medewerker: eigen medewerkerdashboard `1068/1048/1067` (mediaan `1068 ms`) en medewerkerslijst `846/984/879` (mediaan `879 ms`). De Chrome-console eindigde op 0 errors/0 warnings; alle gemeten responses waren HTTP 200. De server-traces op deze deployment bevestigen dat auth/context en parallelle datareads de resterende latency bepalen. Wall-clockresultaten blijven gevoelig voor cold/warm-start en netwerkvariatie.

## Werkafspraak voor alle Luna-stappen vanaf 2026-08-05

Een Luna-stap is pas afgerond na de volledige verticale slice: schema/Supabase (migratie, RLS, grants, audit en gecontroleerde testdata), API, UI, tests, documentatie en relevante lokale, remote en geauthentiseerde browserverificatie. Open onderdelen of blokkades blokkeren de status **afgerond**; de volgende stap start pas na een expliciete per-spec controle.

## Overdracht na Step-9-verificatie 2026-08-06

Step 9 is afgerond. De fixturemigration `apps/hr-suite/supabase/migrations/20260806101419_hr_group_step9_manager_multiple_employment_fixture.sql` staat remote als `20260806130420_hr_group_step9_manager_multiple_employment_fixture`. De minimale RLS-correctie staat lokaal in `20260806133314_hr_group_absence_employment_read_scope.sql` en `20260806133600_consolidate_employments_absence_read_policy.sql`; remote zijn deze als `20260806133414_hr_group_absence_employment_read_scope` en `20260806133633_consolidate_employments_absence_read_policy` toegepast. Omar heeft exact twee actieve employments en twee actuele managerplaatsingen. De herhaalde lokale gates, remote contract-/RLS-controle, typegeneratie en advisors zijn groen; security 1 INFO/19 WARN en performance 342 INFO/0 WARN zijn de bestaande projectbaseline.

De geauthentiseerde browserflow bevestigt HR Admin met Omar tweemaal en Test Manager met beide employmentopties. Eén employment is expliciet geselecteerd zonder opslag; de console eindigt op 0 errors/0 warnings. Remote blijven Omar's absence-cases en spells op 0. Stap 1 t/m 9 zijn hiermee volgens de Luna-werkafspraak doorlopen. Zie [`CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md) voor de volledige handoff. Geen commit, push, merge of deployment uitgevoerd.

## Actueel domeinbesluit 2026-08-05: HR-groepen en employmentgebonden verlof/verzuim

De actuele basis voor de komende LiquidHR-slice staat in:

- [HR-groepen: scope, inrichting en domeingrenzen](requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md)
- [ADR-0009 — HR-groepen als zichtbaarheids- en inrichtingsgrens](decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md)
- [FDR-0006 — Parallel verzuim per dienstverband](decisions/FDR-0006-parallel-verzuim-per-dienstverband.md)
- [Uitvoeringsplan voor Luna](delivery/LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md)
- [Instructie voor de volgende Luna-thread](delivery/LUNA_NEXT_THREAD_INSTRUCTIE_2026-08-06.md)

Deze besluiten vervangen voor het doelmodel de eerdere tenantbrede `SEPARATE`/`COMBINED`-keuze. Een HR-groep is de primaire switch en zichtbaarheidgrens. Bedrijf, bedrijfsinstellingen met kleuren/logo, locaties, afdelingen, functies, rollen, verlofregels, feestdagen, eindredenen per land, vrije velden en bedrijfsdocumenten zijn HR-groepgebonden. Salaris, payroll, administratiegegevens, verlofsaldo en verzuimcasussen blijven gekoppeld aan administratie of dienstverband volgens de nieuwe ownershipmatrix.

Verzuim mag gelijktijdig bestaan op verschillende dienstverbanden en HR-groepen. Alleen overlap binnen hetzelfde dienstverband wordt geblokkeerd. Een herstelmelding op het ene dienstverband wijzigt geen verzuim op een ander dienstverband.

Stap 3 t/m 6 van het Luna-plan zijn uitgevoerd in de migrations `20260805144951_hr_group_schema_and_test_data`, `20260805144952_hr_group_schema_finalize`, `20260805162000_hr_group_context_and_control_plane`, `20260805180000_hr_group_company_administration_locations`, `20260805200000_hr_group_people_organization_roles`, `20260805203000_hr_group_people_rpc_alignment`, `20260805203100_hr_group_complete_employment` en de aansluitende privilege-/FK-indexhardening en fixtures. De schemafundering bevat `hr_groups`, groepskoppelingen, composite foreign keys, restrictive HR-groep-RLS, groeps-toegang, vaste CAO-regels, groepsbrede bedrijf/locaties, groepsgebonden personen/organisatie en een reproduceerbare mapping voor de bestaande synthetische data. `packages/db/types.ts` is opnieuw gegenereerd en de migrations zijn remote toegepast op het gekoppelde Supabase-testproject.

Stap 5 en 6 zijn voor alle eigen specs 100% vastgesteld: bedrijf en locaties zijn groepsbreed, administraties behouden een stabiel intern ID met wijzigbare naam/nummer, personen/afdelingen/functies/rollen zijn HR-groepgebonden, employments blijven administratiegebonden en meerdere employments worden per employment getoond. Cross-group locatie- en persoonsgebruik wordt door API/RPC, composite FK en RLS geweigerd. De gecontroleerde `TEST-BOUNDARY`-fixture bevat één bedrijf, één administratie, één locatie en nul medewerkers; `TEST-MULTIGROUP` bevat de expliciete Step-6-managerfixture. De lokale pgTAP-runner blijft Docker-afhankelijk, maar pgtap is remote versioneerbaar geïnstalleerd en de oude pgTAP-contracttests zijn rechtstreeks groen uitgevoerd. De equivalente remote contract-, RLS- en transactietests zijn geslaagd. Stap 7 is daarna end-to-end uitgevoerd en per alle eigen specs 100% vastgesteld.

Stap 7 is volledig uitgevoerd in de migrations `20260805210000_hr_group_leave_scope` t/m `20260805210800_hr_group_anon_privilege_hardening`. Verlofcatalogi, profielen, regels, employee sets, jaarsturing en overwerk zijn HR-groepgebonden; uitzonderingen, saldo, buckets, grootboek, rollovers, allocaties en aanvragen blijven employmentgebonden. De resolver gebruikt `employment exception -> employee set -> HR-group default`. De fixture bevat `Stap 7 testverlof`, profielwaarden 1.5/2.5 uur, een setlid, een grensgroep zonder catalogusrecords en twee DEMO-028-employment-buckets. Remote RLS, de drie pgTAP-contracttests (37/37, 23/23, 35/35), functionele tests, advisors en de geauthentiseerde HR Admin/manager/medewerker-browserflows zijn groen of conform verwachting.

De huidige database bevat uitsluitend synthetische testdata. De komende implementatie hoeft geen oud gedrag of bestaande productiegegevens te blijven ondersteunen. Er komt geen fallback, dual-read, dual-write of compatibiliteitslaag voor de oude tenant-/administratiescope.

## Actuele update 2026-08-06: Stap 8 verzuim per dienstverband

Stap 8 is functioneel uitgevoerd via migration `20260806120000_hr_group_absence_per_employment.sql`. Verzuiminstellingen zijn uniek per HR-groep; casussen en ziekteperioden dragen een verplicht `employment_id`. Een exclusion constraint blokkeert overlap alleen binnen dezelfde tenant, HR-groep en employment. Composite foreign keys, RLS/policies, grants, auditmutaties, indexes en de capacity-mutatie zijn in dezelfde slice opgenomen. De historische administratieverwijzing in instellingen is nullable metadata en geen scopegrens meer.

De report-, recovery- en partial-capacity-RPC's valideren tenant, HR-groep, medewerker, employment, datum, permission en idempotency server-side. De service gebruikt de gedeelde employment resolver: exact één geldige employment wordt automatisch gekozen, exact één manager-match ook, en nul/meerdere matches blijven een expliciete keuze. De UI ondersteunt ziekmelding, gedeeltelijk herstel, volledig herstel en employmentkeuze vanuit `/absence/new`, het medewerkerdashboard en het verzuimtabblad; alle nieuwe tekst staat in NL/EN-berichten.

## Actuele update 2026-08-06: groepsbrede configuratie-entiteiten

De scope is aanvullend gecorrigeerd voor bedrijfsbranding, feestdagen, eindredenen per land, vrije velden en bedrijfsdocumenten. De migrations `20260806160000_hr_group_wide_configuration_scope` en `20260806161000_grant_hr_group_permissions_to_hr_admin` zijn remote toegepast als `20260806174202_hr_group_wide_configuration_scope` en `20260806174221_grant_hr_group_permissions_to_hr_admin`; de policy-hardening staat als `20260806174857_harden_hr_group_configuration_policies` geregistreerd. Zij leggen `hr_group_id`, groeps-RLS en groepsbrede services/UI vast. Dedicated schermen vragen geen administratiekeuze meer. Alleen de gemengde `/master-data`-overview houdt een administratiekeuze voor documentcategorieën; de aparte eindredenenpagina gebruikt uitsluitend de actieve HR-groep. Officiële typegeneratie, advisors en browsercontrole na deze migrations zijn uitgevoerd en groen.

Remote is de migration toegepast, `packages/db/types.ts` opnieuw gegenereerd, advisors uitgevoerd en `apps/hr-suite/supabase/tests/hr_group_absence_step8_contract.sql` transactioneel geslaagd. Die contracttest controleert overlap op hetzelfde employment, parallelle employments, parallelle HR-groepen, herstelisolatie, partial capacity, RLS, grants, RPC-signatures en afwezigheid van medische kolommen. Lokaal zijn 129 testbestanden/478 tests, strict typecheck, lint, i18n (28 namespaces), productiebuild (171 pagina's) en `git diff --check` groen.

Geauthentiseerde browsercontrole op poort 3000 bevestigde HR Admin-groep A/B-inhoudswissel, twee zichtbare employments met expliciete keuze, volledig herstel en partial-capacity HTTP 200, de manager één-match-flow en de medewerker-self-serviceflow op 390x844 met URL-state en 0 console-errors. De Step-9-fixture bevat nu een teamlid met twee geldige employments; de manager multiple-matchregel is geauthentiseerd in de browser gecontroleerd met expliciete employmentkeuze. De synthetische Fin- en Noah-dossiers zijn voor de herstelacties gebruikt.

## Actuele update 2026-08-04: Supabase security- en performance-hardening

De drie dubbele permissieve SELECT-policy-waarschuwingen op de Star Performer-tabellen zijn opgelost in migration `consolidate_star_performer_select_policies`: de bestaande leespolicy blijft staan en de brede schrijfpolicy is opgesplitst in INSERT, UPDATE en DELETE met dezelfde permissionchecks. Daarnaast zijn de `SECURITY DEFINER`-search paths aangescherpt door `pg_temp` te verwijderen; RPC-signatures, tenantchecks en grants zijn niet gewijzigd. Remote zijn beide migrations toegepast. De performance-advisor heeft geen WARN-meldingen meer. De resterende 15 security-WARNs zijn bewust authenticated RPC's met server-side permissionchecks; de twee RLS-zonder-policy INFO's zijn interne afschermde tabellen en leaked-password protection vereist een Auth-dashboardinstelling.

## Actuele update 2026-08-04: fotoweergave medewerkerslijst

Deze lijst bevat naast de drie fotoformaten en de vierkante variant ook een compacte **Foto collage**-weergave met vierkante foto’s of initialen zonder namen.

Naast Detail, Compact en Kaarten ondersteunt de medewerkerslijst nu vier fotovarianten: **Foto's groot**, **Foto's standaard**, **Foto's klein** en **Alleen foto (vierkant)**. De eerste drie tonen uitsluitend de foto/initialen en voornaam in een responsive grid; de vierkante variant toont alleen de foto/initialen met een dunne rand. De foto-tegels gebruiken dezelfde rolbewuste kliklaag: collega’s openen de veilige popup, eigen en bevoegde medewerkers openen hun bestaande profielroute. De voorkeur wordt via de bestaande `user_preferences.ui_state.employeesList` opgeslagen; er is geen schemawijziging nodig.

## Actuele update 2026-08-04: kaartweergave medewerkerslijst

De medewerkerslijst heeft naast Detail en Compact nu de persoonlijke weergave **Kaarten**. De keuze staat in het bestaande filterpaneel en wordt opgeslagen in `user_preferences.ui_state.employeesList`; na herladen blijft de kaartweergave actief. De responsive grid gebruikt automatisch zoveel kaarten per rij als op het scherm passen. De kaarten volgen dezelfde server-side rol- en directoryprivacy: medewerkercollega's openen de veilige popup zonder personeelsnummer, managers buiten hun directe team krijgen dezelfde popup, en volledige profiel-links blijven beperkt tot de bestaande bevoegde scope. Er is geen schemawijziging nodig geweest; de bestaande voorkeur-API en Supabase JSON-opslag zijn hergebruikt. Typecheck, gerichte tests, ESLint, i18n en authenticated browsercontrole zijn geslaagd.

## Actuele update 2026-08-04: managerbeschikbaarheid op de startpagina

Managers zien op de startpagina een server-side gescopeerd venster **Beschikbaarheid team** voor vandaag plus zes dagen. De brede widget toont rooster, verlof en verzuim per direct teamlid en kan wisselen tussen aanwezigheid en uren; zie [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md) en [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md).

## Actuele update 2026-08-04: manager ziet buiten-teamcollega als medewerker

Een manager krijgt in de medewerkerslijst alleen volledige details van directe teamleden. Een collega buiten het directe team opent dezelfde beperkte, HR-vrijgegeven popup als bij een medewerker. Dezelfde grens geldt server-side voor handmatige detail-URL's. De directory-RPC accepteert hiervoor ook `employee:read`, maar retourneert nog steeds uitsluitend de veilige popup-projectie.

## Actuele update 2026-08-04: medewerkersdirectory voor medewerkers

Medewerkers kunnen de medewerkerslijst openen via de nieuwe administratie-instelling **Medewerkers mogen de medewerkerslijst openen**; de standaardwaarde is `ja`. De directory bevat voor medewerkers uitsluitend actieve, niet-gearchiveerde records; toekomstige, uit dienst zijnde, externe en gearchiveerde records zijn niet zichtbaar en niet als filter beschikbaar. Managers behouden de bestaande status- en archieffilters. Collega's openen voor medewerkers een beperkte popup met door HR vrijgegeven naam, functie/afdeling, zakelijk e-mailadres, zakelijk telefoonnummer, weekaanwezigheid zonder reden en rooster. Naam is altijd zichtbaar en niet uitschakelbaar; de overige vijf velden staan standaard aan en zijn afzonderlijk instelbaar. Dezelfde zichtbaarheid wordt toegepast op de lijst: uitgeschakelde functie/afdeling en e-mail worden daar niet getoond en niet doorzocht. Het personeelsnummer is geen directoryveld en wordt voor medewerker-collega's niet in de lijst, popup of zoektekst gebruikt. De medewerker krijgt geen manager-/HR-detailpagina. De requirements staan in [`requirements/organization/MEDEWERKERSDIRECTORY.md`](requirements/organization/MEDEWERKERSDIRECTORY.md). De Supabase-migrations, RLS/permissionchecks, server-RPC, API en UI zijn remote toegepast en browsermatig gecontroleerd.

## Actuele update 2026-08-04: medewerkerslijst opent gesloten

De medewerkerslijst opent altijd met het filterpaneel gesloten. De open/dicht-status wordt niet meer in `user_preferences` opgeslagen; bestaande opgeslagen waarden worden genegeerd en bij een volgende voorkeursschrijfactie verwijderd. Een geforceerde `Mijn team`-aanroep gebruikt de URL-preset `status=active-future-external&scope=team`, met **Actief + toekomstig + externe personen** en actieve (niet-gearchiveerde) records.

## Actuele update 2026-08-04: startpagina- en medewerkerslijstscope

De operationele kop op de startpagina is rol- en scopegebonden: managers zien **Wat speelt er nu in mijn team**, HR Admins zien **Wat speelt er nu in ons bedrijf**. Een gebruiker met beide rollen kan met **Mijn team** / **Ons bedrijf** wisselen; de gekozen scope staat in de URL en de server laadt de bijbehorende dataset. Achter de teamkop staat een geforceerde link naar `/employees?status=active-future-external&scope=team`.

De medewerkerslijst start voor `DIRECT_MANAGER` standaard met `scope=team`. In het filterpaneel kan de manager expliciet wisselen tussen **Mijn team** en **Alle medewerkers**. De teamscope wordt server-side afgedwongen en de URL-vorm is herbruikbaar voor volgende schermen. HR Admins behouden de volledige actieve administratie-scope.

## Actuele update 2026-08-04: volledig organogram voor medewerkers

Medewerkers mogen het volledige organogram van de actieve administratie lezen via de bestaande `organization-chart:read`-permission. De organogramroute blijft niet-mutatief en toont geen BSN-, bank-, salaris- of star-performerbeoordelingsdata. De RLS-migration is remote toegepast; remote policies, employee-role permissions, advisors en typegeneratie zijn gecontroleerd.

## Actuele update 2026-08-04: Ontwikkeling voor medewerkers

De voormalige Workforce-navigatie heet `Ontwikkeling`. Medewerkers zien op `/workforce` alleen de bestaande self-serviceonderdelen waarvoor zij rechten hebben, momenteel Doorlopende beoordeling en Talentprofielen; managers en HR Admins behouden hun gescopeerde Workforce-werkruimte. De Startpagina gebruikt dezelfde filtering.

## Actuele update 2026-08-10: weerbericht naar medewerkerheader

Het weerbericht is uit de startpagina-header gehaald. De medewerkerheader toont nu een klein weericoon; geautoriseerde kijkers kunnen daar een drawer openen met het weer op het werk. De drawer sluit via het kruisje, Escape of een klik buiten het venster. De bron blijft server-side bepaald op basis van de werkcontext; er is geen schemawijziging.

## Actuele update 2026-08-03: compacte startpagina en persoonlijke venstervolgorde

De startpagina toont één volledige modus met begroeting, komende dagen en de volledige vensters. De brede en smalle startpaginavensters kunnen met slepen of pijlen worden geordend; de volgorde wordt direct per gebruiker opgeslagen in `user_preferences.ui_state.startPage`, zonder schemawijziging of remote write.

## Actuele update 2026-08-03: managerstartacties en teamscope

De startpagina voor managers en HR Admin bevat een uitbreidbare rij met snelacties voor Mijn gegevens, Mijn team en Nieuw ziektegeval. Op kleine schermen blijven alleen de iconen zichtbaar. De managerteamscope gebruikt de actieve directe rapportagelijnen uit `employee_organizations`; de medewerkerslijst en de teamgerichte startpaginaqueries tonen daardoor alleen de eigen directe medewerkers. `/absence/new` hergebruikt de bestaande autorisatie en ziekmeldingsflow. Deze slice voegt geen schemawijziging toe; een geauthenticeerde manager-browsercontrole op poort 3000 bevestigde de drie acties, de teamscope en de mobiele icon-only weergave.

## Actuele update 2026-08-03: gebeurtenissen op de startpagina

De startpagina had al een live venster **Gebeurtenissen** met verjaardagen, werkjubilea en starters, plus de route `/insights/upcoming-events`. De oude dubbele regel **Gebeurtenissen — Bron wordt later aangesloten** in Werk in uitvoering is verwijderd. De startpagina gebruikt voor `DIRECT_MANAGER` uitsluitend de actieve directe teamscope; HR Admin gebruikt de actieve administratie-scope. De bestaande managerdoorklik krijgt hiervoor een lokale rolpermission-migratie en wordt in het rapport eveneens op het directe team begrensd; remote toepassen blijft een expliciete vervolgstap.

## Actuele update 2026-08-03: Workforce-links op de startpagina

De oude tekst over de vrije Dashboard-werkplek is vervangen door een compacte Workforce-strip. De Startpagina toont nu alleen onderdelen waarvoor de actieve rol al toegang heeft: 9-grid, Doorlopende beoordeling, Talentprofielen, Star Performers en Cloud tags. De links hergebruiken de bestaande Workforce-routes en zijn server-side permission-gestuurd; er is geen schemawijziging of remote write uitgevoerd.

## Actuele update 2026-08-03: productiehotfix testrolwisselaar

De productieflag `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED` werd wel door Vercel aangeboden, maar de serverhelper las deze runtimevariabele niet uit wanneer de layout zonder override werd aangeroepen. Dat is hersteld; de waarde wordt nu server-side gelezen en genormaliseerd. Versie `1.20260803.4` bevat daarnaast een regressietest voor de runtimeflag en hoofdletters/spaties. Lokale releasechecks zijn geslaagd. De hotfix staat in GitHub `e8a008c` en Vercel Production `dpl_Fu1T5z3F9P21JdnsMcynaEgfi556` staat op `READY`.

## Actuele update 2026-08-03: doorlopende beoordeling remote en testklaar

De nieuwe requirements [`requirements/Talent/10-LiquidHR-Continuous-Appraisal-Requirements.md`](requirements/Talent/10-LiquidHR-Continuous-Appraisal-Requirements.md) en het functionele besluit [`decisions/FDR-0005-continuous-appraisal-gedeelde-timeline-en-handover.md`](decisions/FDR-0005-continuous-appraisal-gedeelde-timeline-en-handover.md) beschrijven de medewerker-manager-tijdlijn voor notities, acties, afspraken, feedback, doelen/ontwikkelpunten en gesprekssamenvattingen. De remote migrations/RLS/grants, services/API, private Storage voor screenshots/bijlagen, `/my-appraisal`, `/workforce/continuous-appraisal`, startpagina-samenvatting en i18n zijn actief. De remote testtenant bevat 9 items, 3 reacties en 1 veilige voorbeeldbijlage; contract, advisors en authenticated browsercontrole zijn uitgevoerd. Historische items zijn onveranderlijk, verwijderen bestaat niet en reacties zijn maximaal 100 tekens. Deze slice is gepubliceerd in GitHub-commit `d91c554` als versie `1.20260803.3`; Vercel Production staat op `READY`.

## Actuele update 2026-08-03: 9-grid-vlootschouw remote en gepubliceerd

De campagnegestuurde Workforce 9-grid is als nieuwe, tenantgescopeerde verticale slice uitgewerkt volgens `schema -> RLS/permissions -> service/API -> UI`. De leidende requirements staan in [`requirements/Talent/09-LiquidHR-Vlootschouw-9-grid-Requirements.md`](requirements/Talent/09-LiquidHR-Vlootschouw-9-grid-Requirements.md) en het functionele besluit in [`decisions/FDR-0004-talent-vlootschouw-9-grid-campagnes-en-reminders.md`](decisions/FDR-0004-talent-vlootschouw-9-grid-campagnes-en-reminders.md). De migration, API, HR-/managerworkspace, drag-and-drop, historie, campagnevoortgang en automatische/handmatige reminders zijn toegevoegd en remote toegepast. De slice is opgenomen in GitHub-commit `d91c554`; Vercel Production heeft de release als `READY` gebouwd.

## Actuele update 2026-08-03: P3 functioneel gesloten in testfase

P3.0, P3.1, P3.2 en P3.4 zijn lokaal en remote doorgetrokken volgens `schema -> RLS/permissions -> service/API -> UI -> tests`. Talent heeft nu minimale tenantgescopeerde opvolgmeldingen, doelgesprekken/check-ins met gescheiden medewerkerreflectie en managerobservatie, en historische periodefilters voor rapportage en CSV-export. De meldingen zijn geen autorisatiebron en bevatten geen evidence-inhoud. HR Admin ziet tenantbreed; de manager ziet de eigen directe scope; de medewerker ziet alleen eigen meldingen en reflecties.

De drie fixture-accounts zijn op 3 augustus opnieuw gecontroleerd in de Codex-browser op poort 3000. De testset bevat historische, actuele en toekomstige capabilityregistraties en ontwikkeldoelen, drie oorspronkelijke check-ins plus een via de medewerkerflow aangemaakte reflectie, en vijf deduplicerende notificaties. De medewerker ziet `/my-talent` en eigen doelen/rapportage en wordt naar `/geen-toegang` gestuurd voor Workforce- en HR-routes. Manager en HR Admin zien hun toegestane doelen, check-ins, meldingen en rapportage. Detailstappen staan in [`delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md`](delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md).

P3.3 (evidence/documentkoppeling) en P3.5 (delegatie) blijven `GEPARKEERD`; P3.6 blijft bewust uitgesteld omdat LMS/opleidingscatalogus nog niet wordt gebouwd. P4, P5 en P6 zijn niet uitgevoerd. De nieuwe periodeknop `Filters toepassen`, de HR-filter/CSV-browsercontrole en de medewerkerlanding `/dashboard/start` zijn toegevoegd; directe medewerkertoegang tot `/departments` eindigt op `/geen-toegang`. De remote Talent-timeout is aangepakt met gerichte capabilityqueries, korte RLS-short-circuiting en het overslaan van onnodige opties in rapportage. Provider snapshot/restore is op verzoek uitgesloten en staat niet meer als actief open punt. De eerste `TALENT-NEXT-01`-slice voor functieprofiel-radar en ontwikkelverkenning is gebouwd en met alle drie rollen in de Codex-browser op poort 3000 gecontroleerd. Deze wijzigingen zijn opgenomen in GitHub-commit `d91c554` en Vercel Production staat op `READY`.

## Actuele update 2026-08-02: M2 functioneel afgerond in testfase

Het fase-2-plan is uitgevoerd tot en met M2.8. M2.7 biedt tenantgescopeerde ontwikkeldoelen en POP-status zonder automatische score of advies. M2.8 biedt read-only rapportage en CSV-export met vaste rolallowlists; iedere export wordt geaudit met scope, filters en recordaantal. M2.6 is nu ook end-to-end bewezen: HR Admin doorloopt `PREVIEW -> COMMITTED -> ROLLED_BACK`, waarna het aangemaakte record `ARCHIVED` is.

De drie-fixture-gate is opnieuw uitgevoerd in de Codex-browser op poort 3000. HR Admin kan de importflow uitvoeren; manager en medewerker openen hun toegestane Talent-doelenpagina maar worden server-side geweigerd op `/settings/talent/import`. De preview blokkeert database-incompatibele evidence/certificate-metadata vóór commit. De medewerkerlanding is hersteld: `/login` gaat naar `/dashboard/start` en directe `/departments` gaat netjes naar `/geen-toegang`. De representatieve performance-baseline en volledige axe/keyboard-herhaling zijn geslaagd; alleen provider snapshot/restore blijft formeel open. Detailbewijs staat in [`delivery/TALENT_M2_RELEASE_HARDENING_20260802.md`](delivery/TALENT_M2_RELEASE_HARDENING_20260802.md).

Het vervolgdraaiboek staat in [`requirements/Talent/analysis/talent-phase3-implementation-plan-20260802.md`](requirements/Talent/analysis/talent-phase3-implementation-plan-20260802.md). Aanbevolen volgorde: P3.0 release-hardening, daarna P3.1 notificaties/opvolging en P3.2 doelgesprekken/check-ins.

## Actuele update 2026-08-02: M2.5/M2.6 drie-fixture-gate

De lokale fixturecredentials uit `.env.talent-auth.local` zijn gebruikt in de Codex-browser op poort 3000. HR Admin opent de vergelijking en maakt geldige en ongeldige importpreviews; manager opent de directe-scopevergelijking met 22 medewerkers en twee functieprofielen en wordt uit HR-instellingen geweerd; medewerker ziet het eigen `/my-talent`-profiel en wordt uit vergelijking en import geweerd. De `/departments`-landingsroute geeft voor employee nog een bestaande onvoldoende-rechten-serverfout.

De import-commit blijft door bestaande tenant-specifieke RLS geblokkeerd omdat de `TENANT_ADMIN`-override `talent-record:write` mist. Er is geen autorisatie-uitbreiding toegepast. Importaudittriggers zijn gehard en zes Talent foreign-key-indexen zijn remote toegevoegd. Security-advisors tonen geen nieuwe M2.5/M2.6-lint; resterende Talent-advisorregels zijn alleen INFO voor ongebruikte indexen in de kleine demo-dataset.

Verificatie: 116 hr-suite-testbestanden/434 tests, control 2/7 tests, lint, i18n en `git diff --check` slagen. Typecheck en productiebuild stoppen op drie bestaande fouten buiten deze slice in `employee-service.ts:316` en `employment-detail-service.ts:362/369`.

## Laatste Talentcontrole 2026-08-02: M2.5 vergelijking en M2.6 import

M2.5 en M2.6 zijn in de testfase toegevoegd volgens schema → RLS/grants → service/API → UI. M2.5 biedt HR Admin en managers een server-side gescopeerde vergelijking van actieve functieprofielversies met individuele uitkomsten `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`, zonder totaalscore. M2.6 biedt HR Admin een immutable CSV-preview, expliciete idempotente commit en batchspecifieke rollback; geïmporteerde capabilityrecords starten als `DRAFT` en bewijsinhoud wordt niet geïmporteerd.

De remote databasecontractproef voor de nieuwe tabellen, RLS, grants, command-RPC's, permissions en indexen slaagt. Gerichte parser/querytests en strict typecheck slagen. De interne Codex-browser op poort 3000 blijft open; de actuele drie-fixture-herhaling is nog niet opnieuw uitgevoerd omdat de bestaande lokale fixturecredentials niet beschikbaar zijn. De eerder geslaagde drie-rollen-gate blijft referentiebewijs; de nieuwe M2.5/M2.6 interactieve rol- en rollbacktest blijft open.

## Laatste Talentcontrole 2026-08-02: M2.3 en M2.4

M2.3 self-/manager-assessments en M2.4 Team Talent/Skills Matrix zijn toegevoegd volgens schema → RLS/grants → API/service → UI. HR beheert cycli en finale status, medewerkers vullen hun eigen assessment in, managers beoordelen uitsluitend hun actuele directe scope en privé-notities blijven afgeschermd. Team Talent toont individuele capabilitydata zonder onverklaarde scores of aggregaten. De remote contractproef bevestigt RLS, policies en authenticated-only grants voor de vijf assessmenttabellen.

114 testbestanden/428 tests, typecheck, lint, i18n, productiebuild (136 pagina's) en `git diff --check` zijn groen. De lokale browser op poort 3000 is actief; de huidige sessie heeft geen gekoppelde klantomgeving, waardoor de nieuwe authenticated roleflows nog niet opnieuw interactief zijn uitgevoerd. M2.5 en latere fase-2-onderdelen blijven open; performance op representatieve data en rollback/snapshot blijven release-open.

## Laatste Talentcontrole 2026-08-02: M2.2

M2.2 HR-beheerde kwalificaties zijn volgens schema → RLS/grants → API/service → UI toegevoegd. HR beheert certificaatmetadata, evidence-status, geldigheid en archivering via `/settings/talent`; manager- en medewerkersgrenzen blijven die van M2.1. De remote M2.2-contractproef, typecheck, lint, i18n, 112 testbestanden/421 tests, productiebuild en `git diff --check` zijn geslaagd. De interne browser op poort 3000 bevestigde de anonieme loginredirect voor de drie Talent-routes; de geauthenticeerde drie-rollen-gate uit M2.1 blijft het referentiebewijs. Geen commit, push of deployment.

## Laatste Talentcontrole 2026-08-02: M2.1

M2.1 persoonlijke capabilityregistraties zijn volgens schema → RLS/grants → API/service → UI uitgevoerd. HR beheert tenantbreed via `/settings/talent`, managers lezen alleen binnen bestaande medewerkersscope via `/workforce/talent` en medewerkers beheren alleen eigen `SELF_ENTERED` concepten via `/my-talent`. Records zijn typegebonden, datumgeldig, archiveerbaar, geaudit en evidence-minimaal: alleen een referentie wordt opgeslagen en geen evidence-inhoud/signed URL teruggegeven. De remote contractproef, nieuwe permissions, RLS en authenticated-only Data API-grants zijn gecontroleerd.

Checks: typecheck, lint, i18n (25 namespaces), 112 testbestanden/419 tests, productiebuild en `git diff --check` zijn geslaagd. In de interne Codex-browser op `http://localhost:3000` is met de medewerkerfixture een BHV-concept opgeslagen en zichtbaar als `Concept`/`Zelf ingevoerd`; de bestaande drie-rollen-gate blijft referentie voor route-, mutatie-, cross-tenant-, manager-scope- en self-bound-denies. Fase-2-assessments, Team Talent, import, doelen en exports blijven buiten deze slice. Geen commit, push of deployment.

## Laatste Talentcontrole 2026-08-02

De geauthenticeerde drie-rollen-gate is uitgevoerd op poort 3000: 3 rollen, 4 toegestane routes, route-/mutatie-/cross-tenant-denies, manager-scope en medewerker-self-bound slagen; er zijn 0 echte axe-violations. De drie technische `color-contrast`-checks zijn handmatig beoordeeld zonder vastgestelde Talent-contrastfout; twee targets horen bij de gedeelde product-updatebanner. Strict typecheck, i18n (25 namespaces), lint, 112 testbestanden/418 tests, productiebuild en `git diff --check` zijn opnieuw geslaagd. Voor formele productie-release ontbreken alleen nog representatieve performance en een restore/rollback-oefening. Het fase-2-plan staat in [`requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md`](requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md).

## M2.0 gestart 2026-08-02

De eerste fase-2-stap is uitsluitend contract- en gegevensbeschermingsontwerp. De rolmatrix, dataclassificatie, voorgestelde permissions, status-/provenance-/evidence-contracten, logisch schemaontwerp, traceabilitymatrix en de baselineproef staan in [`requirements/Talent/analysis/talent-phase2-m2.0-contracts-and-data-protection-20260802.md`](requirements/Talent/analysis/talent-phase2-m2.0-contracts-and-data-protection-20260802.md), [`requirements/Talent/analysis/talent-phase2-m2.0-traceability-matrix-20260802.md`](requirements/Talent/analysis/talent-phase2-m2.0-traceability-matrix-20260802.md), ADR-0007 en FDR-0003. De beperkte M2.0-securitycorrectie op `public.audit_logs` is uitgevoerd: `anon`/`public` hebben geen tabelgrants meer en `authenticated` uitsluitend `SELECT`; de remote SQL-contractproef slaagt. M2.0 is nog niet gesloten: de zeven beslispunten, het auditcorrelation-contract en de exacte fase-2-permission-seed blijven reviewpunten. Er zijn geen fase-2-tabellen, API-routes, UI-flow, seed of generated types toegevoegd.

De drie rollen zijn daarna in de interne Codex-browser op `http://localhost:3000` gecontroleerd. HR Admin kan `/settings/talent` en `/workforce/talent` openen; manager alleen `/workforce/talent`; medewerker alleen `/my-talent`. Verboden routes tonen `Nog geen toegang`. De employee-login landt eerst op `/departments`, waar een bestaande algemene rechtenfout zichtbaar is; de directe `/my-talent`-route werkt wel. Dit is als open routing/UX-punt vastgelegd en valt buiten M2.0.

## Actuele Talentstatus 2026-08-02

Talentstappen 1-8 zijn lokaal en remote doorgetrokken voor de testfase. Stap 7 biedt actieve Workforce-profielen met directe managerscope; stap 8 biedt een self-bound read-only Mijn Talent-profiel met capabilityvereisten en veilige lege toestand. Voor stap 9 is de functiehuis-audit uitgebreid met triggers voor `jobs`, `job_groups`, `job_revisions` en `job_group_jobs`; de release-contractproef en remote RLS-/RPC-controles slagen. De demo-administratie `Liquid HR Demo Holding` bevat de Job Architecture- en Talent-set plus manager-, medewerker- en HR-admin-authfixtures. Talentfundament blijft HR-admin-only onder `Instellingen -> HR-inrichting` met een exclusieve harmonica. De volledige geauthenticeerde drie-rollen-gate op poort 3000 is uitgevoerd: 3 rollen, 4 toegestane routes, negatieve route-/mutatie-/tenanttests geslaagd, self-bound medewerkercontrole geslaagd en 0 axe-violations. Drie kleurcontrastcontroles blijven als handmatige `incomplete` beoordeling genoteerd. Voor formele release sluiten nog grote-dataset-baseline, rollback/snapshot-oefening en die contrastbeoordeling. De reproduceerbare gate staat in `scripts/talent-release-gate.mjs`. Profielcycli, formulieren, talent pools en opleidingscatalogus volgen later.

Developer workflow: [`DEVELOPER_TOOLKIT.md`](DEVELOPER_TOOLKIT.md) beschrijft de lokale Codex/Git- en EdwinHelp-commando's; [`skills/project-overview/SKILL.md`](skills/project-overview/SKILL.md) beschrijft de herbruikbare projectinventaris; [`../CODING_STANDARDS.md`](../CODING_STANDARDS.md) is de compacte dagelijkse codechecklist.

De herbruikbare Liquid Flow-schermredesignwerkwijze staat in [`skills/edwinhelp-screen-redesign/SKILL.md`](skills/edwinhelp-screen-redesign/SKILL.md); de afgeronde schermen en volgende redesignpagina staan in [`requirements/ux/SCHERM_REDESIGN_STATUS.md`](requirements/ux/SCHERM_REDESIGN_STATUS.md).

Actuele scope-aanvulling productupdates (2026-08-01): eigenaarberichten zijn globaal voor alle klanten; tenant HR Admins kunnen alleen eigen tenantberichten beheren en zien globale eigenaarberichten alleen-lezen.

Actuele weergave-aanvulling productupdates (2026-08-01): banner- en login-popupberichten worden per gebruiker en per kanaal eenmalig getoond; de popup heeft een knop `Gezien`.

Actuele productupdatestatus (2026-08-01): [`requirements/product-updates/PRODUCT_UPDATES.md`](requirements/product-updates/PRODUCT_UPDATES.md) is GEÏMPLEMENTEERD. De tenant-eigen updatecatalogus, doelgroep-/kanaalkeuze, gebruikersstatus, rode cadeauvensterteller, login-popup, bovenbanner en HR Admin-beheer zijn aanwezig; een authenticated browsercontrole blijft open zolang deze sessie geen login-cookie heeft.

Actuele verlofstatus (2026-07-28, versie `1.20260728.4`): werkurentypen hebben nu algemene instellingen, gedeelde beperkingstypen en administratiegebonden uitzonderingen voor één of meerdere medewerkers. De geavanceerde tab blijft voorbereid voor later.

Actuele verlofstatus (2026-07-28): aparte bonusregels voor `AGE` en `SENIORITY` met traptreden, FTE/pro-rata-engine, catalogus/API en HR-admintegels zijn aanwezig. De periodieke bonusmutatie-runner, volledige opbouwprojectie en ingelogde browsercontrole blijven open.

Verificatie afgerond voor deze slice: ESLint, 384 tests, productiebuild en anonieme browsercontrole zijn geslaagd; de browsercontrole vond 0 console-errors en alleen een bestaande preload-warning.

De leidende documentenblueprint voor deze slice staat in [`requirements/documents/Documenten_en_Dossier_Systeem_Master.md`](requirements/documents/Documenten_en_Dossier_Systeem_Master.md). De oudere AI/compliance-notitie blijft aanvullend voor een latere OCR/RAG-slice.

Actuele verlofstatus (2026-07-22): de verlof-engine bevat nu schema/RLS, configuratie- en balans-API, catalogus/opvolger/voorrangsregel-UI, idempotente HR-admin-aanvragen vanuit de kalender en centrale ledgermutaties voor startsaldo, handmatige correcties, jaarafsluiting, overheveling en verval. Feestdagen worden in booking en preview overgeslagen. De flow is remote en op poort 3000 met Lina Bakker gecontroleerd. Resterend zijn toekomstige opbouwprojectie voor maandelijkse regels, volledige saldo-audit/ledgerformulieren en later ESS, managerworkflow en notificaties.

Deze index is de verplichte startpagina voor architectuur- en featurewerk. Hij bepaalt welke documenten leidend zijn en welke volledige bronnen per wijziging gelezen moeten worden.

## Statusdefinities

### Documentstatus

- **LEIDEND** — actuele bron van waarheid binnen het genoemde domein.
- **CONCEPT** — richtinggevend, maar nog niet goedgekeurd voor volledige implementatie.
- **VERVANGEN** — historische bron; niet gebruiken voor nieuwe implementatie.

### Implementatiestatus

- **NIET GESTART** — nog geen productieschema of werkende verticale slice.
- **GEDEELTELIJK** — een deel bestaat, maar het document is nog niet volledig gerealiseerd.
- **GEÏMPLEMENTEERD** — schema, RLS, API, UI en relevante tests zijn aanwezig.

## Architectuurdocumenten

| Document | Status | Wanneer volledig lezen |
|---|---|---|
| [`architecture/BLUEPRINT.md`](architecture/BLUEPRINT.md) | LEIDEND | Altijd bij schema, API, auth, projectstructuur of gedeelde patronen |
| [`architecture/ENVIRONMENT_AND_AI_RULES.md`](architecture/ENVIRONMENT_AND_AI_RULES.md) | LEIDEND | Omgeving, secrets, Supabase, deployment, packages en agentregels |
| [`architecture/LOGIC_AND_WORKFLOW.md`](architecture/LOGIC_AND_WORKFLOW.md) | LEIDEND | Businesslogica, state, validatie, foutafhandeling en workflows |
| [`architecture/UI_FLOW_BLUEPRINT.md`](architecture/UI_FLOW_BLUEPRINT.md) | LEIDEND | Pagina's, layouts, formulieren, navigatie en RBAC-zichtbaarheid |
| [`architecture/DESIGN_SYSTEM_EVOLUTION.md`](architecture/DESIGN_SYSTEM_EVOLUTION.md) | CONCEPT | Nieuwe algemene tokens/componenten of gecontroleerde visuele adoptie |
| [`architecture/LIQUID_DISPLAY_DOCUMENTATIE.md`](architecture/LIQUID_DISPLAY_DOCUMENTATIE.md) | LEIDEND | Alleen volledig bij Liquid Display, AI-querying, widgets of contextmanagement |
| [`architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md`](architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md) | INVENTARISATIE | Bij externe koppelingen, API-ontsluiting, webhooks of AI-providerbeleid |

## Requirements

Adresinvoer: [`requirements/core-hr/ADRESINVOER.md`](requirements/core-hr/ADRESINVOER.md) — LEIDEND: hoofdadres en tweede tijdelijk adres zijn tenant-/employee-scoped gemodelleerd met servervalidatie, RLS, audit, i18n en harmonica-UI; verhuisactie, adres-harmonica en verzuimlinks zijn lokaal browsergecontroleerd.

| Domein | Document | Documentstatus | Implementatie |
|---|---|---|---|
| Bedrijf en locatie per dienstverband | [`requirements/employment/BEDRIJF_EN_LOCATIE_PER_DIENSTVERBAND.md`](requirements/employment/BEDRIJF_EN_LOCATIE_PER_DIENSTVERBAND.md) | LEIDEND | GEDEELTELIJK — lokale schema/RLS/RPC, API, eigen dienstverbandtab, read-only bedrijfskaart en locatie-opvolging zijn toegevoegd; remote migratie en authenticated browserbewijs volgen |
| Verlof: opbouw-, saldo- en configuratie-engine | [`requirements/leave/VERLOF_OPBOUW_ENGINE.md`](requirements/leave/VERLOF_OPBOUW_ENGINE.md) | LEIDEND | GEDEELTELIJK — schema/RLS, pure engine/report, catalogus/API, direct bewerkbare en intern effective-dated opbouwregels, kleurgebruik, overwerkbeperkingen en de eerste verloftype-/uitzonderingen-UI zijn aanwezig; age/seniority-regels en volledige opbouwprojectie volgen |
| Verlof: HR-admin aanvragen vanuit kalender | [`requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md`](requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md) | LEIDEND | GEDEELTELIJK — geautoriseerde HR-admin/managerflow, priority/FIFO, directe goedkeuring, saldo-overzicht en kalenderweergave zijn geïmplementeerd; ESS, notificaties en manager-UI volgen later |
| Verzuim en herstel | [`requirements/absence/VERZUIM_EN_HERSTEL.md`](requirements/absence/VERZUIM_EN_HERSTEL.md) | LEIDEND | GEDEELTELIJK — schema/RLS/RPC, API, dashboardvenster, startpagina, kalenderactie, medewerker-tab, herstel, instellingen en verzuimrapportage zijn live; voorziening en verdere WvP blijven open |
| WvP Poortwachter | [`requirements/absence/WVP_POORTWACHTER_ENGINE.md`](requirements/absence/WVP_POORTWACHTER_ENGINE.md) | LEIDEND | GEDEELTELIJK — HR Admin kan eigen niet-wettelijke taaktemplates beheren; wettelijke milestone-engine, casustaken, dossier en signaleringen blijven open totdat de set inhoudelijk is bevestigd |
| Verzuiminstellingen | [`requirements/absence/VERZUIM_INSTELLINGEN.md`](requirements/absence/VERZUIM_INSTELLINGEN.md) | LEIDEND | GEDEELTELIJK — drempel, geldige standaardcasemanager en eigen taaktemplates zijn administratiegebonden beschikbaar; contacttypen en documentcategorieën blijven open |
| Rapportages en Inzichten | [`requirements/reports/RAPPORTAGES_EN_INZICHTEN.md`](requirements/reports/RAPPORTAGES_EN_INZICHTEN.md) | LEIDEND | GEDEELTELIJK — medewerkerprojecties, Aankomende gebeurtenissen, Verzuim en Bradford factor zijn live; verlof, voorziening en WvP volgen per rapport; de oude globale Dashboard-bestemming is vervangen door Analyse |
| Liquid Analyse AN-0/AN-1 | [`requirements/reports/LIQUID_ANALYSE_AN0_AN1.md`](requirements/reports/LIQUID_ANALYSE_AN0_AN1.md) | LEIDEND | LOKALE FEATURE-SLICE — legacy Dashboard in code retired, Analyse-hub active, DB-retirement migration ready maar nog niet toegepast |
| Liquid Analyse AN-2/AN-3 Engine V1 | [`requirements/reports/LIQUID_ANALYSE_AN2_AN3_ENGINE_V1.md`](requirements/reports/LIQUID_ANALYSE_AN2_AN3_ENGINE_V1.md) | LEIDEND | LOKALE IMPLEMENTATIE GREEN — typed semantic layer, AnalysisSpec, authorized retrieval, AnalysisResult en Liquid Canvas; releasegate open |
| Liquid Analyse AN-4/AN-5 Mijn Analyses + Liquid Explore V1 | [`requirements/reports/LIQUID_ANALYSE_AN4_AN5.md`](requirements/reports/LIQUID_ANALYSE_AN4_AN5.md) | LEIDEND | LOKALE IMPLEMENTATIE READY — persistent saved definitions, guided Explore en scoped API/UI; migration approval required |
| Surveys en eNPS | [`requirements/research/SURVEYS_AND_ENPS.md`](requirements/research/SURVEYS_AND_ENPS.md) | LEIDEND | GEDEELTELIJK — tenantmodules, schema/RLS, draft-campagnebeheer, medewerkerhub, respondentflow, HR-instellingen, monitor, privacydrempel, grafieken, CSV en rolgebonden widgets zijn remote en op main/browser geverifieerd. Automatische e-mail-/schedulerbezorging voor eNPS-herinneringen is bewust uitgesteld; segmentprivacy blijft een apart besluit |
| Process Automation | [`requirements/workflows/LIQUID_PROCESS_AUTOMATION_BLUEPRINT.md`](requirements/workflows/LIQUID_PROCESS_AUTOMATION_BLUEPRINT.md) | LEIDEND | P2-P9 schema/API/UI en contextstarts zijn uitgevoerd; P10-outputbrug is live end-to-end bewezen. Open: niet-lege `BLOCKED`-startpaginafixture en expliciete doelgroepgoedkeuring voor HR-admin-dossierzichtbaarheid; daarom nog geen 100%-gate |
| Journeys | [`requirements/journeys/JOURNEYS.md`](requirements/journeys/JOURNEYS.md) | LEIDEND | BOUWSTAP 1 EN 2 GEREED — configuratie plus gepinde HR-runtime, activatiepreview, teamresolutie, lifecycle, replacement en reminders remote/browser geverifieerd; stap 3 en deployment niet gestart |
| Formulierlabels en validatie | [`requirements/ux/FORMULIER_VALIDATIE_EN_LABELS.md`](requirements/ux/FORMULIER_VALIDATIE_EN_LABELS.md) | LEIDEND | NIEUW — sterretje alleen bij verplichte velden en veld-/blurvalidatie volgens het UX-contract |
| Wizard UX-standaard | [`requirements/ux/WIZARD_UX_STANDARD.md`](requirements/ux/WIZARD_UX_STANDARD.md) | LEIDEND | NIEUW — vaste shellhoogte, scrollbaar middenstuk, compacte sticky onderbalk en contextuele scrollhint |
| Core HR | [`requirements/core-hr/MEDEWERKER.md`](requirements/core-hr/MEDEWERKER.md) | LEIDEND | GEÏMPLEMENTEERD |
| Medewerkerdashboard | [`requirements/core-hr/MEDEWERKER_DASHBOARD.md`](requirements/core-hr/MEDEWERKER_DASHBOARD.md) | LEIDEND | GEDEELTELIJK — dashboard-UI, lazy salaris, reminders, activity-notities en persoonlijke widgetvolgorde aanwezig; remote schema/advisors en per-rol browsercontrole volgen |
| Contract & dienstverband | [`requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`](requirements/employment/CONTRACT_EN_DIENSTVERBAND.md) | LEIDEND | GEÏMPLEMENTEERD — contractreeks, vernieuwde wizard, contract-/rooster-/salaris-/organisatie-/kostentijdlijnen en HR-inrichting gereed |
| Organisatie | [`requirements/organization/AFDELINGEN_EN_ROLLEN.md`](requirements/organization/AFDELINGEN_EN_ROLLEN.md) | LEIDEND | GEÏMPLEMENTEERD |
| Organogram | [`requirements/organization/ORGANOGRAM.md`](requirements/organization/ORGANOGRAM.md) | LEIDEND | GEÏMPLEMENTEERD |

| Workforce Talent | [`requirements/Talent/01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md`](requirements/Talent/01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md) | LEIDEND | GEDEELTELIJK — stappen 1-8 zijn uitgevoerd; stap 9 is inhoudelijk ingezet maar de geauthenticeerde drie-rollen-gate, volledige axe-audit, grote-dataset-baseline en rollbackbewijs staan open; cycli, formulieren, talent pools en opleidingscatalogus volgen later |
| Teamkompas | [`requirements/team-compass/TEAM_COMPASS.md`](requirements/team-compass/TEAM_COMPASS.md) | LEIDEND | VOLLEDIGE TESTCYCLUS GEVERIFIEERD — schema/RLS/grants/RPC, API, module-toggle, HR-/manager-/medewerker-UI, consentvarianten, projecties en cleanup zijn bewezen; nog niet gecommit/gedeployed |
| Doorlopende beoordeling | [`requirements/Talent/10-LiquidHR-Continuous-Appraisal-Requirements.md`](requirements/Talent/10-LiquidHR-Continuous-Appraisal-Requirements.md) | LEIDEND | TESTKLAAR — remote schema/RLS, private tenant Storage, API, medewerker-/managerworkspace, startpagina-link, fixturedata, contract/advisors en authenticated browsergate zijn uitgevoerd |

| Workforce 9-grid / Vlootschouw | [`requirements/Talent/09-LiquidHR-Vlootschouw-9-grid-Requirements.md`](requirements/Talent/09-LiquidHR-Vlootschouw-9-grid-Requirements.md) | LEIDEND | GEDEELTELIJK - lokale schema/RLS, API, HR-/managerworkspace, historie en reminders zijn toegevoegd; remote migratie en geauthenticeerde browsergate volgen |

### Actuele Talentstatus 2026-08-02

Talentfundament is bereikbaar voor HR Admin via `Instellingen -> HR-inrichting` en gebruikt daar een exclusieve harmonica. De remote testmigraties, demo-seed, authfixtures, functiehuis-audittriggers en de version/requirement-contracten zijn toegepast. De HR-admin axe-audit is groen met 0 violations; de volledige drie-rollen-gate is nog niet gesloten zolang manager-/medewerkercredentials, de open contrastchecks, grote-datasetmeting en rollbackbewijs ontbreken. Het functie-inventaris- en gate-rapport staat in [`requirements/Talent/analysis/talent-phase1-function-inventory-and-m9-gate-20260802.md`](requirements/Talent/analysis/talent-phase1-function-inventory-and-m9-gate-20260802.md). Cycli, formulieren, talent pools en opleidingscatalogus volgen later.

## Branch- en deploymentafspraak

`main` is de enige blijvende bron van waarheid voor testen en live. Werkbranches en worktrees zijn tijdelijk: na tests, i18n, typecheck, build en browsercontrole worden ze naar `main` samengevoegd en verwijderd. Vercel Production bouwt vanaf GitHub `main`; preview-URL's zijn uitsluitend testomgevingen. Supabase-migraties worden gecontroleerd toegepast vóór de main-deploy. Controleer na iedere push de GitHub-commit en de Vercel-deployment-commit.
| Autorisatie | [`requirements/authorization/AUTORISATIE_EN_RECHTEN.md`](requirements/authorization/AUTORISATIE_EN_RECHTEN.md) | LEIDEND | GEÏMPLEMENTEERD |
| Multitenancy & administraties | [`requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md`](requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md) | LEIDEND | GEDEELTELIJK |
| LiquidHR Control Plane | [`requirements/platform/LIQUIDHR_CONTROL_PLANE.md`](requirements/platform/LIQUIDHR_CONTROL_PLANE.md) | LEIDEND | LOKALE BASIS GEIMPLEMENTEERD — aparte app op poort 3001; migratie en eerste operator moeten nog handmatig worden toegepast |
| Entiteiteigendom en koppelingen | [`requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`](requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md) | LEIDEND | INSTRUCTIE VOOR NIEUWE MODULES |
| Vrije velden | [`requirements/custom-fields/VRIJE_VELDEN.md`](requirements/custom-fields/VRIJE_VELDEN.md) | LEIDEND | GEÏMPLEMENTEERD VOOR EMPLOYEE, HR-groepbreed inclusief beheer-CRUD, actieve status, landcode en preview |
| Documenten & compliance | [`requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md`](requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md) | LEIDEND | GEDEELTELIJK — veilig medewerkersdossier gereed; globale documenten en AI-compliance volgen later |
| Instellingen, modules, roosters en kalender | [`requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`](requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md) | LEIDEND | GEÏMPLEMENTEERD — groepsbrede bedrijfsgegevens, branding, feestdagen, medewerker-pop-up en menuvolgorde; legacy Dashboard Widget-beheer is retired |
| Liquid Display aanvulling | [`requirements/liquid-display/LIQUID_DISPLAY_ENGINE.md`](requirements/liquid-display/LIQUID_DISPLAY_ENGINE.md) | LEIDEND | GEDEELTELIJK |
| HeRa AI Agent | [`requirements/chatbot/HERA_AI_AGENT.md`](requirements/chatbot/HERA_AI_AGENT.md) | LEIDEND | GEÏMPLEMENTEERD EN PRODUCTIE-GEVERIFIEERD |
| Historische HR-chatbotblauwdruk | [`requirements/chatbot/HR_CHATBOT_AGENT.md`](requirements/chatbot/HR_CHATBOT_AGENT.md) | VERVANGEN | NIET GESTART |
| Chatbot lees/schrijftools | [`requirements/chatbot/HR_CHATBOT_LEES_EN_SCHRIJFTOOLS.md`](requirements/chatbot/HR_CHATBOT_LEES_EN_SCHRIJFTOOLS.md) | CONCEPT | NIET GESTART |
| Chatbot transactietools | [`requirements/chatbot/HR_CHATBOT_TRANSACTIONELE_TOOLS.md`](requirements/chatbot/HR_CHATBOT_TRANSACTIONELE_TOOLS.md) | CONCEPT | NIET GESTART |

Er zijn momenteel geen documenten met status **VERVANGEN**. Zodra een document wordt opgevolgd, blijft het bewaard met een expliciete verwijzing naar zijn vervanger.

## Leesrouting per wijziging

| Wijziging | Verplicht lezen naast deze index |
|---|---|
| Medewerkergegevens | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `MEDEWERKER.md`, `AUTORISATIE_EN_RECHTEN.md` |
| Afdelingen, rollen of organogram | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `AFDELINGEN_EN_ROLLEN.md`, `AUTORISATIE_EN_RECHTEN.md` |
| Auth, RLS of permissions | Alle vijf architectuurdocumenten plus `AUTORISATIE_EN_RECHTEN.md` |
| Tenant, administratie of contextswitch | Alle vijf architectuurdocumenten plus `MULTITENANCY_EN_MULTI_ADMINISTRATIE.md` en `AUTORISATIE_EN_RECHTEN.md` |
| Nieuwe module of nieuwe stamdata | `ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`, alle vijf architectuurdocumenten, `MULTITENANCY_EN_MULTI_ADMINISTRATIE.md` en `AUTORISATIE_EN_RECHTEN.md` |
| Contract, salaris of payroll | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `CONTRACT_EN_DIENSTVERBAND.md`, `AUTORISATIE_EN_RECHTEN.md` |
| UI/layout/formulieren | `BLUEPRINT.md`, `UI_FLOW_BLUEPRINT.md` en het relevante requirementdocument |
| Verzuim, herstel of WvP | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `UI_FLOW_BLUEPRINT.md`, `VERZUIM_EN_HERSTEL.md`, `WVP_POORTWACHTER_ENGINE.md`, `VERZUIM_INSTELLINGEN.md`, `AUTORISATIE_EN_RECHTEN.md`, `CONTRACT_EN_DIENSTVERBAND.md` |
| Rapportages en exports | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `UI_FLOW_BLUEPRINT.md`, `requirements/reports/RAPPORTAGES_EN_INZICHTEN.md` en `AUTORISATIE_EN_RECHTEN.md` |
| Workforce Talent of functiehuis | De vijf Talent-documenten, `requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`, ADR-0006, alle vijf architectuurdocumenten en `AUTORISATIE_EN_RECHTEN.md` |
| Liquid Display of AI-chat | Alle vijf architectuurdocumenten plus de relevante Liquid Display- en chatbotrequirements |

## Uitvoering en besluiten

- Compacte overdracht voor nieuwe/fork-chats: [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md)
- Actuele implementatiedrift: [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md)
- Geaccepteerde tenantgrenzen: [`decisions/ADR-0001-tenant-en-administratiegrenzen.md`](decisions/ADR-0001-tenant-en-administratiegrenzen.md)
- Authenticatie, i18n en persoonlijke thema's: [`decisions/ADR-0002-authenticatie-i18n-en-persoonlijke-themas.md`](decisions/ADR-0002-authenticatie-i18n-en-persoonlijke-themas.md)
- Employee, Employment, IKV en herintreding: [`decisions/ADR-0003-employee-employment-ikv-en-herintreding.md`](decisions/ADR-0003-employee-employment-ikv-en-herintreding.md)
- Performancebudgetten en tabprojecties: [`decisions/ADR-0004-performancebudgetten-en-tabprojecties.md`](decisions/ADR-0004-performancebudgetten-en-tabprojecties.md)
- Documentzichtbaarheid en gecombineerde reminderdoelen: [`decisions/FDR-0001-document-en-reminderdoelgroepen.md`](decisions/FDR-0001-document-en-reminderdoelgroepen.md)
- Uitvoeringsplannen: [`superpowers/plans/`](superpowers/plans/)
- Toekomstige technische en functionele besluiten: `decisions/`
- Verzuimcasus per dienstverband en ziekteperioden: [`decisions/ADR-0005-verzuimcasus-en-ziekteperioden.md`](decisions/ADR-0005-verzuimcasus-en-ziekteperioden.md)
- Entiteiteigendom en koppelingen tussen tenant en administratie: [`decisions/ADR-0006-entiteitseigendom-en-koppelingen.md`](decisions/ADR-0006-entiteitseigendom-en-koppelingen.md)
- Afzonderlijk leveranciersbeheer: [`decisions/ADR-0008-afzonderlijk-liquidhr-control-plane.md`](decisions/ADR-0008-afzonderlijk-liquidhr-control-plane.md)
- Verzuimcasusscope en privacy: [`decisions/FDR-0002-verzuim-casusscope-en-privacy.md`](decisions/FDR-0002-verzuim-casusscope-en-privacy.md)

Actuele verticale slice (2026-07-29): dienstverbanden ondersteunen parallelle en sequentiële relaties met één actief primair dienstverband, een eigen contractreeks en onafhankelijke tijdlijnen. De vernieuwde aanmaakwizard controleert eerst de basisgegevens en publiceert daarna dienstverband, contract, rooster, salaris, organisatie en kosten atomair. Contractinrichting is als administratiegebonden stamdata beschikbaar onder Instellingen. De actuele status staat in `delivery/IMPLEMENTATION_STATUS.md` en `delivery/CURRENT_CONTEXT.md`.

Het autorisatiebeheer en grafische rechtenoverzicht zijn beschreven in [`superpowers/specs/2026-07-18-autorisatieoverzicht-design.md`](superpowers/specs/2026-07-18-autorisatieoverzicht-design.md).

De HR-instellingenhub, tenantmodules, repeterende werkpatronen, feestdagenimport en gecombineerde medewerkerskalender zijn beschreven in [`requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`](requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md) en ontworpen in [`superpowers/specs/2026-07-18-settings-modules-rosters-holidays-calendar-design.md`](superpowers/specs/2026-07-18-settings-modules-rosters-holidays-calendar-design.md).

De medewerkerlijst/persoonskaart-UX-slice van 2026-07-19 is geïmplementeerd: gebruikersgebonden lijstvoorkeuren zonder zoekterm, Enter-zoeken met afzonderlijk wissen, volledige klikrij, hoofdtab Overzicht vóór Persoonsgegevens en een effective-dated samenvatting van het huidige dienstverband met beschermd salaris-hover.

De HR-admin-stamtabellen staan op `/master-data`: Redenen uitdienst, documentcategorieën en tenant-relatietypen zijn afzonderlijke onderdelen. Redenen uitdienst zijn landgebonden en HR-groepbreed; documentcategorieën blijven administratiegebonden. Nederland gebruikt de actuele codes 01-99 en andere landen krijgen bij ontbrekende inrichting de veilige standaardreden `Einde contract`.
