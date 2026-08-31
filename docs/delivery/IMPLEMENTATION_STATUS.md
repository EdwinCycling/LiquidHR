# Implementatiestatus Liquid HR

## Security Wave A — SEC-003/SEC-004/SEC-005 — 2026-08-31

**Status: INTEGRATION GATE GREEN — APPROVED FOR PRODUCTION RELEASE**

De Wave-A-slice is geïsoleerd vanaf exact `origin/main` `9151248f224fb62a2d18c558c2627e1078c2cf0a`, bronbranch `security/wave-a-auth-boundaries` (`0bb6c81`) en geïntegreerd in releasecandidate `537b4e2`; de zichtbare appversie is exact eenmaal verhoogd naar `1.20260831.1`. Scope is uitsluitend SEC-003, SEC-004 en SEC-005.

- **SEC-003:** `isTestRoleSwitchEnabled()` weigert altijd `VERCEL_ENV=production` en een lokale `NODE_ENV=production` zonder non-production runtimecontext; de confirm-route heeft dezelfde server-side deny. Preview behoudt alleen de bestaande allowlisted handoff met expliciete flag. Directe productie-POSTs geven `404 TEST_ROLE_SWITCH_DISABLED`; arbitrary targets geven `403` vóór de admin-handoff.
- **SEC-004:** de bestaande Supabase SSR browsercookie blijft `sb-<project-ref>-auth-token`, `HttpOnly=false`, `SameSite=Lax`, host-only en browserleesbaar voor access/refresh/session JSON. Alleen `Secure` is centraal geconfigureerd voor HTTPS production-contexten; een HttpOnly server-session bridge blijft een product-/architectuurbesluit.
- **SEC-005:** forwarded host, Host, callback, OAuth/reset-link, invitation-link en signout-origin lopen door één allowlistende helper. Canonical `NEXT_PUBLIC_APP_URL`, Vercel `VERCEL_URL`/`VERCEL_BRANCH_URL`/`VERCEL_PROJECT_PRODUCTION_URL`, expliciete trusted hosts en lokale development-hosts zijn geldig; onbekende hosts en onveilige fallbacks vallen veilig terug.

Gerichte regressies zijn `17` testbestanden / `75/75` tests groen. Authenticated browseracceptance met de drie canonical TEST-persona’s bereikte `/dashboard/start`; development/test role-switch deed één HR Admin → Manager → HR Admin round-trip; de rebuilt production-mode candidate hield de role-switch UI verborgen en bleef voor alle drie persona’s op `/dashboard/start`, met `0` console- en page-errors. De éénmalige volledige suite is `298/299` bestanden en `1167/1168` tests; uitsluitend de bekende ongewijzigde Journey-baselinefailure op `Binnenkort beschikbaar` blijft staan. Strict TypeScript, ESLint (`0` errors, `14` bestaande warnings), `git diff --check` en Webpack production build (`230/230` routes) zijn groen. Supabase is uitsluitend read-only gecontroleerd: fixture-count `1/1/1`; security advisors `89` bestaande meldingen (`5` INFO zonder policy op service-only tabellen, `9` anon- en `74` authenticated SECURITY DEFINER-WARNs, `1` leaked-password-WARN), zonder Wave-A migration of remote write.

Open beslissingen na release zijn uitsluitend de SEC-004 server-only HttpOnly-sessionmigratie en de expliciete productie-/Preview-hostpolicy. Het volledige evidence-rapport staat buiten de repository op `C:\Users\Edwin\Documents\Apps\LiquidHR-Test-Evidence\security-review-20260830\SECURITY-WAVE-A.md`; de finale Vercel-provenance en productie-smoke worden op de uiteindelijke main-SHA vastgelegd.

## AI Usage Insights V1 — 2026-08-30

**Status: GREEN — RELEASED**

Vanaf exact `origin/main` `50ece02d78f7024d9e92a93b26346a0318c10b6e` is AI Usage Insights geïntegreerd als `/insights?report=ai-usage`. De reportlaag consumeert uitsluitend canonical AI Foundation-accounting: `ai_invocations` binnen actieve tenant/HR-groep en `get_ai_group_credit_balance`. `requests` gebruikt `created_at`, `credits used` positieve `charged_credits` op `finished_at`, `remaining` is `available_credits`, en success rate is `SUCCEEDED / (SUCCEEDED + FAILED)` met rejected/incomplete uitgesloten.

De route en UI zijn aggregate-only en tonen geen prompts, bron-/gegenereerde tekst, employee-/actor-/business-objectdata, provider/model/request-id, raw errors of HR-payloads. De releasegate is groen: Insights/AI Usage/Employee Notes/Improve-route `31` bestanden / `105/105` tests, AI Foundation/Improve-regressies `99/99`, strict TypeScript, ESLint `0 errors / 14` bestaande warnings, i18n `33` gelijke namespaces, `git diff --check` en Webpack `230` gegenereerde pagina's. De volledige suite was `1147/1148`; de enige failure is de bekende, ongewijzigde Journey-baselinefailure op `Binnenkort beschikbaar`.

Authenticated browseracceptance is groen voor HR Admin op desktop `1440x900` en mobiel `390x844`: KPI's, trend, capabilities, quality, status, periodeselector, scope-tampering, no-overflow en `0` console-errors. Manager en Employee kregen API `403` en geen AI Usage report-oppervlak. De ene UI-geïnitieerde synthetische Employee Notes-call (`improve_writing`, `EFFICIENT`) gaf een voorstel, liet de originele Description tot Apply intact en schreef geen Employee Note; de deterministic TEST-provider normaliseerde deze al getrimde voorbeeldtekst naar dezelfde tekst, terwijl de componenttest het gewijzigde lokale Apply-pad en Save-only-persistence afdekt. Canonical TEST-readback bevestigt de nieuwste invocation `SUCCEEDED`/`VALIDATED`, `1` reserved / `1` charged, reservation `SETTLED` met `1` settled / `0` released, en elk `1` technical-usage- en business-auditrecord. De before/after-projectie in `this-month` is: remaining `98→97`, charged `2→3`, requests `5→6`, Improve `5→6`, Efficient `5→6`, successful `2→3`, success rate `40%→50%`.

Er is geen migration, schema-, RLS-, grant- of productieconfiguratie-wijziging. De zichtbare versie is exact eenmaal verhoogd van `1.20260830.1` naar `1.20260830.2`; de release wordt vanaf deze worktree non-force naar `origin/main` gepusht. Vercel Production en de production smoke worden na de push gecontroleerd op `READY` en exacte finale SHA-alignment.

## AI Improve V1 — Employee Notes — 2026-08-30

**Status: GREEN — RELEASED**

De eerste product-capability bovenop de centrale AI Foundation is toegevoegd aan alleen de omschrijving van Employee Notes. De server-only adapter gebruikt `employee-note:write` met target employee-id, daarna de bestaande `ai:use`/governance/quality/quota/Liquid Credits/provider-safety/provider/validation/usage/audit-keten. De feature gebruikt de bestaande `improve-existing-hr-text` registry-entry met `EFFICIENT` als productkwaliteit en één Liquid Credit. Provider-input bevat uitsluitend source text, transformation en locale; de employee-id wordt niet naar het model gestuurd. AI is proposal-only: Apply wijzigt alleen lokale form state en het bestaande Save-pad blijft de enige persistence.

Er is geen migration, schema-, RLS- of grantwijziging. De AI-route schrijft nooit `employee_notes`; voor de expliciete TEST-acceptance zijn bestaande AI Foundation/credits-tabellen en de bestaande note Save/delete-flow gebruikt. De relevante regressies zijn `31` bestanden / `148/148` tests groen; de volledige suite is `290` bestanden / `1134/1135` tests met uitsluitend de bekende, ongewijzigde Journey-baselinefailure op `Binnenkort beschikbaar`. Strict TypeScript, i18n `33` gelijke NL/EN-namespaces, ESLint `0 errors` / `14` bestaande warnings, `git diff --check` en webpack production build `229/229` zijn groen. Authenticated browseracceptance is op desktop en `390x844` uitgevoerd; remote TEST-readback bevestigt één `SUCCEEDED`/`VALIDATED` invocation, credits `1` reserve/`1` settle, settled allocation, usage/audit en na cleanup nul synthetic employee notes. De zichtbare versie is exact eenmaal verhoogd naar `1.20260830.1`; de feature is geïntegreerd en gepusht. De Vercel-productieprovenance is gecontroleerd op `READY`, `main` en exacte SHA-alignment.

## AN-2/3 Analysis Engine V1 — 2026-08-29

**Status: LOKALE IMPLEMENTATIE GREEN — RELEASEGATE OPEN**

Vanaf authoritative baseline `4178f3b6e3b4c2e1a69ce50694437c347e37481e` is in dedicated `work/an-analysis-engine-v1` een kleine application-only analysis engine toegevoegd. De V1 semantic layer gebruikt alleen de bestaande HR-group-scoped employee-overviewservice met `employees`/`workforce`, `headcount`, `department`, `job` en `employment_status`. De server valideert een versioned AnalysisSpec strikt, autoriseert `dashboard:read` plus `employee:read` of `employee-directory:read` vóór retrieval en geeft uitsluitend een typed, deterministic AnalysisResult aan de Foundation `LiquidCanvas` KPI/tabel/fallback-renderer. De bestaande `/insights/analysis`-hub, AI Foundation, AN-0/AN-1, Liquid Explore, Mijn Analyses en conversational analysis zijn niet gewijzigd of geactiveerd. Geen migration, schema/RLS/grantwijziging, AI-call of remote databasewrite.

De gerichte AN-2/3-set inclusief version-test is `6` bestanden / `27/27` tests groen; strict TypeScript, i18n (`33` gelijke namespaces), volledige ESLint (`0 errors / 14 bestaande warnings`), Webpack production build (`229/229`) en `git diff --check` zijn groen. De volledige suite is `288` bestanden / `1127` tests, `1126` groen; alleen de bekende Journey-baselinefailure op `Binnenkort beschikbaar` blijft staan. Een tijdelijke lokale renderer-harness is op desktop `1440x900` en mobiel `390x844` gecontroleerd en verwijderd. De exacte version bump naar `1.20260829.4` is eenmaal uitgevoerd; live `git ls-remote`/push/Vercel provenance blijven open door `SEC_E_NO_CREDENTIALS` in Windows Git.

## Centrale AI Foundation-integratie — 2026-08-29

**Status: AI FOUNDATION TEST GREEN — READY FOR FIRST PRODUCT CAPABILITY**

De centrale integratie is afgerond in dedicated worktree `work/ai-foundation-central-integration`, vanaf exact authoritative `origin/main`/`b9228380f74a4cacfd951e695ff694e2cf1f699c`. Wave 1A, Wave 1B Liquid Credits, OpenAI Provider en AI1C Provider Safety/FUP zijn in volgorde semantisch geïntegreerd. De zichtbare versie is exact eenmaal verhoogd naar `1.20260829.3`. De dirty root-worktree `work/r5-work-runtime` bleef onaangeraakt.

Op canonical TEST Supabase `wnpfloqpjvaacobppbpk` is uitsluitend de forward migration `20260829134822_ai_provider_safety_internal_service_role_grants` toegepast. De lokale migration is `apps/hr-suite/supabase/migrations/20260829154355_ai_provider_safety_internal_service_role_grants.sql` en bevat alleen `EXECUTE` voor `service_role` op de twee interne provider-safetyfuncties. Readback: `internal_security` USAGE/EXECUTE voor `service_role` is toegestaan; `authenticated` en `anon` blijven zowel intern als via de publieke wrappers geweigerd. Er is geen production-write, HeRa/Gemini-wijziging of andere remote migration uitgevoerd.

De ene goedgekeurde live E2E-call was synthetisch en zonder HR-data/PII: Responses API, `gpt-5.6-luna`, reasoning `low`, `store:false`, SDK `maxRetries:0`. Invocation `3c011465-d7eb-4125-b7cd-ebbb7c457506` bereikte authenticated context/permission, TEST governance (`FOUNDATION`, `EFFICIENT`), Liquid Credits reserve `1` en settle `1`, FUP lease `test/COMPLETED`, precies één provider-call, structured result `VALIDATED`, usage `208` input/`85` output tokens en `3362 ms`. Remote readback bevestigt `SUCCEEDED`, één technical-usage-rij, één business-audit-rij en één allocation-rij; credit balance ging van `100` beschikbare units naar `99` na de settlement. Geen tweede call of retry.

De eerder bewezen brede gate blijft als bestaande evidence gelden: `18/18` AI-testbestanden, `86/86` tests, strict TypeScript, i18n `33` gelijke NL/EN-namespaces, ESLint `0 errors` met 14 bestaande warnings, `git diff --check` en Webpack `228/228` routes. Na de corrective migration zijn alleen de relevante lokale safety-tests (`2` bestanden, `13/13` tests) en de privilege-contractreadback uitgevoerd; de full suite blijft `1101/1102` met uitsluitend de bekende Journey-baselinefailure op `Binnenkort beschikbaar`. De eerste product capability/UI is niet gebouwd; HeRa/Gemini, AN-2/3 en `TALENT-1` zijn niet gestart of gewijzigd.

## START-1 `/dashboard/start` hydration-fix — 2026-08-29

**Status: START-1 GREEN — HYDRATION #418 RESOLVED**

De hydration mismatch kwam door een datumafhankelijke render in `StartPage`: server en client berekenden tijdens dezelfde initial render onafhankelijk `new Date()`, waardoor een daggrens verschillende zichtbare datums kon opleveren. De route maakt nu één server-side tijdsnapshot, geeft de `today`-waarde expliciet door en formatteert datumafhankelijke Startpage-uitvoer deterministisch in UTC. Er is geen `suppressHydrationWarning`, route/API-, auth-, permission-, schema-, migration-, RLS- of databasewijziging.

De regressiontest reproduceert de klokwissel en bevestigt identieke markup. De gerichte set inclusief version-test is `3/3` bestanden en `9/9` tests; strict TypeScript, ESLint (`0` errors), Webpack (`228/228` pagina's) en diff-check zijn groen. Authenticated Playwright tegen de exacte production-mode kandidaat op `localhost:3003` bevestigde normale navigatie en hard refresh met HTTP `200`, zichtbare Startpagina, `0` page/console errors en `0` warnings; mobile `390x844` had geen horizontale overflow. Vercel production is `READY` met GitHub-SHA gelijk aan `origin/main`; de eerste verse check tijdens alias-settling gaf tijdelijk `PGRST303: JWT issued at future`/React #441, maar de verse retry na settling was groen met HTTP `200`, zichtbare Startpagina, hard refresh en `0` page/console errors en warnings. Geen authfix is binnen START-1 uitgevoerd. Zichtbare versie: `1.20260829.2`. `TALENT-1` blijft geparkeerd.

## AUTH-UX-1/2 Unauthorized direct routes — 2026-08-29

**Status: AUTH-UX GREEN — AUTH-UX-1 EN AUTH-UX-2 RESOLVED**

De bestaande route-loaders voor `/settings/product-updates` en `/custom-fields` behouden hun server-side permission- en RLS-contract. De pages vangen alleen `AuthorizationError` af en redirecten naar `/geen-toegang`; overige fouten blijven fouten. Product Updates is voor HR Admin toegestaan en voor Manager/Employee canonical no-access. Custom Fields is voor HR Admin toegestaan, Manager behoudt het bestaande `custom-field-values:read`-contract en Employee krijgt canonical no-access. Er is geen API-, schema-, migration-, RLS-, grant- of permission-wijziging.

De route-regressieset is `6/6` groen en de finale targeted set inclusief version-test `8/8`, strict TypeScript is groen, ESLint eindigde op `0 errors` met `14` bestaande warnings buiten deze delta, de Webpack-build genereerde `228/228` pagina's en `git diff --check` is groen. Authenticated Playwright tegen de exacte lokale productiebuild op `localhost:3000` bevestigde alle zes checks op `1440x900` met HTTP `200`, `0` page errors en `0` console errors. Zichtbare versie: `1.20260829.1`. `TALENT-1` bleef geparkeerd; `START-1` is in de opvolgende release hierboven opgelost.

## R8 UX Foundation Final Release — 2026-08-28

**Status: R8 TEST RELEASE GREEN — LIQUIDHR UX FOUNDATION COMPLETE**

R8 Final Sweep wordt semantisch geïntegreerd vanuit `work/r8-foundation-final-sweep` / `b5aca507e007f2e0900216aaec52ea3093aefa98`, vanaf common baseline `42066ab64c025e4f8b7653d656e0e3e76cccfaf3`, tegen central main `9708617b824a3bc4ca630146609671a0902e48d7`. De bron convergeerde Custom Fields, Team Compass, Research, Reminders/Time Hub, Personal Settings, Talent, Product Updates en Process Work Detail op bestaande Foundation v1.2. De geïntegreerde kandidaat bewaart routes, API/services, permissions, businessregels, lifecycle, URL-state, data-eigendom en AN-0/AN-1.

De doelversie is exact één centrale bump naar `1.20260828.8`. R8 voegt geen Foundation primitive, schemawijziging, migration, RLS/grantwijziging of remote DB-write toe. De AN-forward migration `20260828125223_retire_legacy_dashboard.sql` blijft unapplied; oude Dashboard-runtime en afhankelijkheid van verwijderde Dashboard-tabellen mogen niet terugkeren.

Source-evidence was lokaal GREEN: targeted `15/15` bestanden en `97/97` tests, strict TypeScript, 34 gelijke NL/EN-namespaces, ESLint, Webpack `229/229` en diff-check; full suite `1023/1024` met alleen de bekende niet-gerelateerde Journey-failure op `Binnenkort beschikbaar`. De actuele geïntegreerde gate is éénmaal uitgevoerd vóór de releasecommit: targeted `21/21` bestanden en `97/97` tests, strict TypeScript voor `hr-suite` en `control`, i18n `33` gelijke NL/EN-namespaces, ESLint, Webpack `229/229` en diff-check zijn groen. De geïntegreerde full suite is `262/263` bestanden en `1007/1008` tests; alleen dezelfde bekende Journey-failure blijft open. Lokale authenticated browseracceptance bleef geblokkeerd door de bestaande OAuth-redirect; de verplichte browsergate is post-deploy op de exacte Vercel main-SHA.

Zie [`R8_FOUNDATION_FINAL_SWEEP.md`](R8_FOUNDATION_FINAL_SWEEP.md) voor de bronhandoff, uitzonderingen en acceptance-matrix.

R8 is formeel afgesloten. De geparkeerde post-R8 debts zijn `TALENT-1` (Role Explorer intermittent React #441, oorzaak onbevestigd, geen aangetoonde R8-regressie), `AUTH-UX-1` (`/settings/product-updates` directe ongeautoriseerde route), `AUTH-UX-2` (`/custom-fields` directe ongeautoriseerde route) en `START-1` (`/dashboard/start` hydration #418). Geen van deze debts is in deze statusafsluiting opgelost. `NEW PRODUCT UI MUST USE FOUNDATION BY DEFAULT` blijft leidend.

## Liquid Analyse AN-0/AN-1 — 2026-08-28

**Status: CENTRALLY INTEGRATED — PRESERVED BY R8**

AN-0/AN-1 blijft centraal actief met Analyse, de `/dashboard`- en `/settings/dashboard-widgets`-redirects en de behouden `/dashboard/start`-Startpagina. De Analyse-hub heeft exact vier opties; alleen Rapporten is actief en linkt naar `/insights`. De legacy persoonlijke Dashboard-widgetruntime, widgetbeheer, dashboard-API's en het oude Insights Dashboard-item zijn retired. AN-2+ is niet geïmplementeerd.

`20260828125223_retire_legacy_dashboard.sql` blijft unapplied in deze release. Er is geen remote migration, schema write, dashboard-table drop of generated DB-types sync. Deze AN-contracten zijn expliciete R8-preservation checks.

## R7-3 Employment, Calendar & Master Data Convergence — 2026-08-28

**Status: R7-3 TEST RELEASE GREEN — READY FOR TEST PROVENANCE; REQUIREMENTS GATE RECORDED**

R7-3 is implemented in the existing dedicated worktree `work/r7-employment-masterdata` from exact baseline `778b601670c87ca7596000937d895859498b483a`. The affected existing routes use Foundation surfaces, fields, searchable choices, drawers, dialogs, row actions, tables and empty states. Holiday native date fields remain intentionally native. No API/service/permission/business-rule redesign, migration, schema/RLS/RPC change or standalone work-pattern route was introduced.

The targeted integrated regression set is `11/11` green, the targeted Organogram projectortest is `6/6` green, strict TypeScript and i18n parity (`34` namespaces) are green, ESLint is `0 errors / 14 warnings`, and the Webpack production build generates `229/229` pages. The one full-suite failure is the unchanged baseline Journey expectation for `Binnenkort beschikbaar` (`1023/1024` tests green); it was not changed. Authenticated HR Admin browser acceptance is green on the integrated production-mode candidate at `http://localhost:3002`: all requested desktop main routes and relevant leave subroutes returned `200`, Foundation data/drawers/actions were usable, the safe anniversary create/readback/delete probe was cleaned up, Sidebar v2/Wat-is-nieuw/Setup Assistant/Organogram remained usable, and desktop/mobile overflow checks were clean. Final integrated production browser console: `0` errors and `0` warnings, with no hydration evidence. The only integration compatibility fix was the private-avatar browser render boundary in Organogram. Manager/Employee browser personas were unavailable from the authenticated HR Admin session because no role switch is exposed; targeted permission tests remain green. Salary capability remains explicitly gated as `REQUIREMENTS GATE — SALARY CAPABILITY VISIBILITY UNRESOLVED`.

## Setup Assistant HR Admin access-correctie — 2026-08-28

**Status: ACCESS GREEN — READY FOR CENTRALE TEST-RELEASE**

De geïsoleerde branch `work/setup-assistant-hr-admin-access` is vanaf exact `main`/`origin/main` `051c57a998c33d17a8ac1bef166fe58f5c15b133` opgebouwd. `canUseSetupAssistant` en de Settings-hub gebruiken nu alleen `settings:read` voor read/open; de dashboardlayout, `/settings/setup-assistant` en beide Setup-API's blijven op de bestaande service-permissioncontracten aangesloten. `settings:write` blijft vereist voor enable/disable en completion; guide-step- en related-route-filtering zijn niet verbreed.

De access-contracttests dekken TENANT_ADMIN en HR Admin read, HR Admin write, read-only settings access, unauthorized access, visible-step filtering en related-route filtering. Gerichte tests zijn `14/14` groen, strict TypeScript, targeted ESLint, `check:i18n` en Webpack-production build (`229/229`) zijn groen. De volledige suite is `1015/1016` groen met uitsluitend de bekende ongewijzigde Journey-failure `components/journeys/journey-steps.test.tsx` op `Binnenkort beschikbaar`.

Authenticated TEST HR Admin acceptance op de production-mode candidate (`127.0.0.1:3003`) is groen: `/settings/setup-assistant` toegankelijk, echte enable-`PATCH 200` en readback, Settings-tegel, dashboard-trigger, drawer met 4 categorieën/16 toegankelijke stappen, desktop `420px`, mobile `390x844`, geen horizontale overflow en `0` console errors/warnings. De bestaande Setup-instelling staat aan in TEST; completion is volgens browsermutatiescope niet gewijzigd. Geen migration, schema/RLS-wijziging of structurele remote DB-write. Zichtbare versie: `1.20260828.3`.
## Centrale Navigation Sidebar v2 TEST-release — 2026-08-28

**Status: TEST RELEASE GREEN**

De Navigation Sidebar v2 is vanaf `work/navigation-sidebar-v2` (`5cae907c`) geïntegreerd op central baseline `778b6016`. De vijf vaste secties, Insights → Dashboard-gating, Gift Drawer/unread-badge, HR-group switcher, veilige menu-order-normalisatie en mobile/collapsed behavior blijven intact. De zichtbare versie is `1.20260828.5`; er zijn geen Dashboard-, AN-0/AN-1-, R7-3-, AI- of databasewijzigingen toegevoegd.

De gerichte gate is `10/10` bestanden en `32/32` tests groen; strict TypeScript, i18n (`34` gelijke namespaces), ESLint (`0 errors / 8 bestaande warnings`), diff-check en Webpack `229/229` zijn groen. Full suite: `267/268` bestanden en `1021/1022` tests; alleen de bekende niet-gerelateerde Journey-failure `Binnenkort beschikbaar` blijft open. Browser-sanity op `1440x900` en `390x844` bevestigde de sidebar, Gift Drawer, Insights → Dashboard, Setup Assistant-trigger, organogram en viewport-gelijke scrollbreedte. De losse organogram-avatarrequest met HTTP `400` valt buiten deze delta.

## Roadmap 7 Slice 2 — Organization, Access & Context Model — 2026-08-28

**Status: R7-2 TEST RELEASE GREEN — MAIN/VERSION/VERCEL VERIFICATION PENDING**

R7-2 is vanuit dedicated worktree `work/r7-organization-access` (`4e34ea4`) eenmaal geïntegreerd vanaf actuele `main`/`origin/main` `54100b4`. De zeven afgesproken Organization/Access/Context-routes gebruiken de bestaande Foundation-patronen voor page shell, forms, collections, drawers, dialogs, row actions en chart surfaces. Route-, API-, service-, schema-, RLS-, grant-, permission-, context- en businesscontracten zijn niet gewijzigd.

De organogrambeslissing is read-only behouden: geen afdeling-CRUD, beheer via `/departments`, alleen `Organisatiestructuur` en `Rapportagelijnen`, veilige fallback van `?view=job`, en orthogonale connectors met employee source-handles. Job/talent-data is niet verwijderd.

De centrale gerichte R7-2- en Setup Assistant-set, strict TypeScript, i18n (`34` gelijke NL/EN-namespaces), ESLint (`0 errors / 8 warnings`), Webpack `229/229` en diff-check zijn groen. De full suite blijft uitsluitend door de bekende ongewijzigde Journey-failure rond `Binnenkort beschikbaar` amber.

Authenticated browser-sanity is op de geïntegreerde candidate gecontroleerd voor HR Admin, Manager en Employee op desktop `1440x900` en mobile `390x844`; de routes, permission/context-scope, organogram, console/overflow en Setup Assistant-access bleven intact. Geen testdata-mutatie, migration of structurele remote DB-write. Zie [`R7_2_ORGANIZATION_ACCESS_CONTEXT.md`](R7_2_ORGANIZATION_ACCESS_CONTEXT.md).

## Roadmap 7 Slice 1 — Settings Hub & Platform Settings Model — 2026-08-28

**Status: R7-1 TEST RELEASE GREEN — MANAGER/EMPLOYEE ACCEPTANCE LIMITED BY TEST FIXTURES**

R7-1 is vanaf exact `main`/`origin/main` `1fce3e28accd6385abd0a5e54742b0b6e4060098` opgebouwd in `work/r7-settings-platform`, gecontroleerd in release-worktree `work/r7-1-release` en vastgelegd in releasecandidate `f7e90e6`. De zichtbare versie is exact éénmaal verhoogd naar `1.20260828.2` in `apps/hr-suite/lib/app-version.ts` inclusief de canonieke testverwachting. R7-1 convergeert `/settings`, `/settings/company-data`, `/settings/company-branding`, `/settings/employee-directory`, `/settings/modules`, `/settings/dashboard-widgets` en `/settings/menu-order` op bestaande Foundation PageShell/PageHeader, Surface, FormField/FormActions, TextInput/Textarea, Checkbox, Switch, Badge, CountryPicker, ScrollableTabs, FormDrawer en ConfirmDialog. Het employee-placeholder en menuvolgorde-localStoragecontract bleven behouden.

Er zijn geen API-, service-, schema-, migration-, RLS-, grant-, permission-, businessregel-, remote- of production-wijzigingen gemaakt. De wijziging is UI/Foundation-convergentie plus NL/EN-sleutels voor cancel/discard states en exact één version bump. De bestaande routes en payloads blijven leidend. Nieuwe gerichte tests dekken canonical switches/checkboxes, menu-acties, submit/cancel en het ontbreken van `window.confirm` in de company-data-manager.

Lokale gates: gerichte settings-/regressieset `8/8` bestanden en `30/30` tests groen, strict TypeScript groen, i18n `34` gelijke NL/EN-namespaces groen, ESLint `0 errors / 8 bestaande warnings`, Webpack `229/229` routes en `git diff --check` groen. De volledige suite is `263/264` bestanden en `1008/1009` tests groen; de enige failure is de bekende, niet-gerelateerde Journey-verwachting rond `Binnenkort beschikbaar`.

Authenticated browser: HR Admin heeft de geïntegreerde candidate op `http://localhost:3011` compact gecontroleerd op desktop `1440x900` en mobiel `390x844` voor `/settings`, `/settings/company-data` en `/settings/modules`; de company-data Locaties-tab en FormDrawer zijn geopend en zonder wijziging gesloten, een canonical Switch is bediend en via Annuleren hersteld, overflow was afwezig en de finale console was leeg. Manager bereikte op de settingsroutes de bestaande “geen klantomgeving”-toestand. Employee kon met de beschikbare lokale TEST-fixturecredentials niet aanmelden. Deze twee persona-gates blijven daarom **BLOCKED BY TEST FIXTURE/AUTH ENVIRONMENT**; er zijn geen instellingen opgeslagen, geen testdata gewijzigd en geen cleanup nodig.

## Centrale R6 Insights-integratie en TEST-releasegate — 2026-08-28

**Status: LOCAL RELEASE CANDIDATE GREEN — MAIN/PUSH/VERCEL VERIFICATION PENDING**

De release-worktree `work/r6-integration` is vanaf exact `main`/`origin/main` `0ae99622609f45d83a8428f8cd4cb22985373f7b` opgebouwd. De goedgekeurde R6-1- en R6-2-tips (`32d5c32cb44e0b274a9cbfd1fca81763f5471701` en `e2c75eb5e9658c4ee899d69e96128357ec3bcedf`) zijn éénmaal gecombineerd; R6-2 bevat R6-1. Alleen docs-conflicten zijn semantisch opgelost. R5/Setup Assistant blijven intact. Er zijn geen migrations, Supabase-schema/RLS/grants, auth/permissions, AI of production writes toegevoegd.

De uiteindelijke gerichte gate is groen: `17/17` Insights-testbestanden en `56/56` tests, strict TypeScript, `34` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack `229/229` pagina's en `git diff --check`. De volledige suite blijft `262/263` bestanden en `1003/1004` tests door uitsluitend de bekende Journey-failure rond `Binnenkort beschikbaar`. Een browsergevonden Upcoming-parserprobleem met niet-RFC-gelabelde database-UUID's is opgelost via de bestaande `databaseUuid`-validator en gericht groen getest.

Authenticated Playwright op `localhost:3010` is groen voor HR Admin, Manager en Medewerker op `1440x900` en `390x844`: canonical URL-state, draft/Apply/Reset, active-filter removal, Back/Forward, CSV-export HTTP `200`, safe drilldown-return, searchable multiselect, Upcoming-chip `Afdeling`, direct-team/self-scope, responsive overflow en Escape/focus-restore. HR Admin kreeg de juiste gefilterde Upcoming-rows; Manager uitsluitend direct-teamdata; Medewerker zag geen Insights en directe toegang gaf `0 rapportages`. Laatste browserconsole: `0` errors en `0` warnings.

De zichtbare versie is exact eenmaal verhoogd naar `1.20260828.1` in `apps/hr-suite/lib/app-version.ts` en de bijbehorende testverwachting; `package.json` bleef ongewijzigd. Main-integratie, de ene push en Vercel TEST-verificatie volgen als releasehandelingen; geen remote Supabase- of production-mutatie is uitgevoerd.

## Centrale R5 Work & Automation + Setup Assistant V1 releasegate — 2026-08-27

**Status: LOCAL RELEASE CANDIDATE GREEN — MAIN/PUSH PENDING EXTERNAL GIT-CREDENTIAL CHECK**

De release-worktree `work/r5-setup-release-integration` is vanaf exact baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885` opgebouwd met de aangewezen R5 Work List, Runtime, Process Studio, shared TEST-fixture en Setup Assistant V1. De Setup-drawer heeft daarnaast een minimale in-scope CSS-correctie gekregen naar `420px` op desktop omdat de bestaande Foundation utility-cascade anders `640px` opleverde. Er zijn geen routes, API-contracten, schema's, RLS-policies, permissions of businessregels verbreed.

Remote TEST is uitsluitend read-only gecontroleerd. `20260827065737_setup_assistant_v1` en `20260827072833_setup_assistant_v1_indexes` bestaan al in Supabase-project `wnpfloqpjvaacobppbpk`; geen apply of `db push`. De Setup-contracten lezen groen terug met RLS, acht policies, authenticated CRUD-grants, geen anon-table-grants, composite indexes, audit/update-triggers en gegenereerde types. Security-advisor heeft geen Setup-finding; de vier nieuwe FK-indexen verschijnen als ongebruikte performance-INFO's.

De gecombineerde codegate is groen: `15/15` testbestanden en `63/63` tests voor R5/Setup, strict TypeScript, i18n `34` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack `229/229` pagina's en `git diff --check`. De volledige suite blijft `258/259` bestanden en `986/987` tests door uitsluitend de bekende ongewijzigde Journey-failure op `Binnenkort beschikbaar`. De R5 shared-fixture classifier mismatch (`safeAsSharedR5Fixture: NO`) betreft alleen de expliciet unsupported `NO_ASSIGNEE`/deadline/blocked-scenario's en blokkeert deze release niet.

Authenticated Playwright is gecombineerd bewezen op desktop `1440x900` en mobile `390x844`: HR Admin Work/detail/runtime/Studio zijn `200` met R5-data en geen horizontale overflow; Setup enable, completion mark/unmark, refresh/readback, suggesties, CTA's, `420px` desktop drawer, `390px` fullscreen mobile drawer en beide Setup/HeRa-overlayrichtingen zijn groen. Manager en Employee behouden scoped Work/detail/runtime `200`, krijgen Studio/Setup route `/geen-toegang`, Studio/Setup API `403` en geen Setup-edge-tab. De geïsoleerde productrouteflows hebben nul onverwachte page errors; negatieve API-probes geven uitsluitend de verwachte 403-resource-events.

De zichtbare applicatieversie is exact éénmaal verhoogd naar `1.20260827.1`; de packageversie blijft `0.1.2`. Main-integratie, push en Vercel TEST-verificatie zijn nog niet uitgevoerd: `git ls-remote` werd geblokkeerd door `SEC_E_NO_CREDENTIALS`. Production DB/configuration en deployments zijn onaangeroerd.

## Roadmap 5 — lokale Work & Automation-integratie — 2026-08-27

**Status: GREEN FOR SHARED R5 FIXTURE — WITH UNSUPPORTED SCENARIOS**

De dedicated `work/r5-integration`-worktree is gestart vanaf lokale `main`/`origin/main` `e13c50f418cb327a6e4e99e266d58ab7370e4885`. De source ranges zijn shared fixture `053c3d2eb759e83413318be5e44ac051d79727c2^..b5b68ffc42b2fc326338631c4ad294eadd80a3d2`, Work List `833b8d2c927d2d555721dc96eadd19d88f2665c1`, Runtime `58226f839a161ab6ea1ce8f6a38c32ab88e67770` en Process Studio `d1f18009ee47ddc8b86c08695458bef79acd49b8`. Ze zijn vastgelegd in vier lokale integration commits (`9339071`, `2bbc38a`, `8ffb70a`, `b1cc24e`). Alleen de twee delivery-documentconflicten zijn opgelost; Work List en Runtime behouden gezamenlijk tab-counts/pagination, detail/back-context, assignment-options en runtime-acties. Geen nieuwe architectuur, Foundation-redesign, migration, Setup/R6/Journey-code, version bump, main-merge/push, Vercel of productieactie.

De gerichte R5-set is groen met `12/12` testbestanden en `41/41` tests. Strict TypeScript, `check:i18n` (`33` gelijke NL/EN-namespaces), ESLint (`0 errors / 8 warnings`), `git diff --check` en de Webpack-productiebuild (`226/226` routes) zijn groen. De volledige suite is `256/257` bestanden en `981/982` tests groen; de enige failure is de bekende, niet-gerelateerde `components/journeys/journey-steps.test.tsx`-failure op `Binnenkort beschikbaar`.

De canonical readback faalde aanvankelijk op `FIXTURE_UNEXPECTED_FAILURE: fetch failed` doordat `NEXT_PUBLIC_APP_URL` naar de niet-luisterende lokale poort `3107` wees. Met `127.0.0.1:3003` is de fixture-owned residual read-only bewezen en daarna verwijderd via een exact TEST-gescopeerde transactie. Exact één setup en één readback bouwden daarna 5 definitions, 7 instances en 12 work items op en bevestigden de claimed/rejected/request-changes/document/output-cases en persona-counts HR/Manager/Employee `7/3/3`. De helper rapporteerde setup `outcome: RED` en `safeAsSharedR5Fixture: NO`; dit is **KNOWN FIXTURE CLASSIFIER MISMATCH — UNSUPPORTED SCENARIOS ARE NON-BLOCKING** volgens de canonical handoff. `NO_ASSIGNEE`, niet-gematerialiseerde deadlines en het blocked-candidate-pad zijn expliciet unsupported en geen acceptance blockers; readback rapporteerde `READBACK_ONLY`. `migrations: NO`.

`agent-browser` faalde tweemaal met `CDP response channel closed`; dit is niet opnieuw geprobeerd. De bestaande Playwright CLI/runtime-route werkte op de integration-build-server op `127.0.0.1:3003`. HR, Manager en Employee login en read-only routes `/work`, UUID-workdetail en `/process-runtime/<workItemId>` gaven op desktop `1440x900` en mobiel `390x844` HTTP 200. URL-state en detail-back-context bleven behouden; `scrollWidth` was gelijk aan de viewportbreedte; keyboard-focus was na Tab bereikbaar; relevante browserconsole errors/warnings waren `0`. HR kreeg assignment-options `200`, Manager en Employee `403`. HR kreeg Studio `200`; Manager en Employee eindigden op `/geen-toegang`. De resterende `net::ERR_ABORTED`-events waren Next-prefetches die door navigatie werden afgebroken. Er zijn geen runtime- of domeinmutaties via de browser uitgevoerd.

De lokale acceptance en canonical fixture/readback zijn GREEN. De expliciet unsupported scenario's zijn non-blocking volgens de canonical handoff; er is geen aangetoonde R5-code-regressie en geen code gewijzigd. De bekende Journey-suitefailure rond `Binnenkort beschikbaar` blijft buiten scope en is niet gewijzigd. De helperwaarde `safeAsSharedR5Fixture: NO` is uitsluitend een classifier mismatch en geen R5 integration blocker. De live remote-maincontrole faalde door `SEC_E_NO_CREDENTIALS`; lokale `main` en `origin/main` zijn wel gelijk aan de baseline.

## R5-2 Work List + Foundation — 2026-08-26

**Status: R5-2 GREEN — FULL SUITE RED ON EXISTING UNRELATED TEST**

`work/r5-work-list` is vanaf exact baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885` uitgevoerd in de geïsoleerde worktree. `/work` gebruikt de bestaande process-work projection, vijf tabs met counts, URL-state voor filters en tabs, bestaande searchable Foundation-dropdowns, zoek/filter/sortering en offset/limit-pagination. De administratie-wrapper wordt service-side eerst authorization-filtered gelezen binnen de bestaande contractgrens en daarna correct gepagineerd. Startpage process cards en Employee Detail → Processen blijven op dezelfde projectie aangesloten. Geen schema-, migration-, trigger-, scheduler-, runtime-mutation-, fixture-, version-, merge-, push- of Vercel-wijziging.

De lokale slice-gates zijn groen: gerichte Work/service `4/4`, strict TypeScript, i18n `33` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings` en Webpack `226/226` static pages/routes. `git diff --check` is groen. De volledige suite eindigde op `254` bestanden met `974/975` tests groen; de enige failure is de ongewijzigde `components/journeys/journey-steps.test.tsx`-verwachting voor `Binnenkort beschikbaar`.

Authenticated browser acceptance is groen uitgevoerd op een fresh Webpack-server met de canonical ignored `.env.local`. HR `/work` toonde live TODO/CLAIMED/WAITING/COMPLETED/ALL-counts `7/0/0/14/21`; status/proces/administratie/search/sort, gecombineerde filters, zero-result, URL-refresh, page-reset en detail/back zijn gecontroleerd. Manager zag uitsluitend bestaande direct-report work van Noah Hendriks; Employee uitsluitend self work van Noah Hendriks. Startpage process card en Employee Detail → Processen zijn gecontroleerd. Desktop `1440x900` en mobiel `390x844` hadden op de gecontroleerde routes geen horizontale overflow; browserconsole bevatte geen relevante warnings/errors of hydration errors. De live dataset past met 21 items binnen page-size 25; pagination is daarom live niet afgedwongen, maar wel door de service- en workspace-tests gedekt. Geen credentials of env-bestand is gecommit en geen remote/fixture-mutatie is uitgevoerd.

## R5-4 Process Studio + lifecycle acceptance — 2026-08-26

**Status: TEST ACCEPTANCE GREEN — FULL SUITE AMBER DOOR BESTAANDE JOURNEY-FAILURE — MAIN/RELEASE NIET UITGEVOERD**

Op branch `work/r5-process-studio` vanaf exact baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885` is de bestaande Process Automation Studio/lifecycle authenticated op TEST bewezen. De HR-flow omvat create + fresh readback, edit/autosave revision 2, stale revision HTTP 409, clone, preview, no-write Procesproef, compilerfeedback, publish + changelog, immutable published version/hash, retire met reden en fresh readback. Lege publish/retire-input gaf HTTP 400; DELETE/PATCH bleven HTTP 405. Certified recipes en activation-buttons zijn read-only als bestaand contract gecontroleerd; geen recipe-activatie uitgevoerd.

De twee eigen `R5-STUDIO-20260826-1857` records zijn na afloop hard verwijderd: 2 definitions, 4 drafts en 1 version, strikt op vooraf vastgestelde IDs. De immutable-trigger is uitsluitend binnen de cleanup-transactie tijdelijk uitgeschakeld en vóór commit hersteld. De gedeelde R5-dataset blijft intact met één DRAFT, drie PUBLISHED en één RETIRED definition. Manager en Employee kregen op de route `/geen-toegang` en de Studio-API HTTP 403.

De enige productwijziging is een minimale servicefix: Postgres SQLSTATE `40001` wordt vertaald naar het bestaande `PROCESS_DEFINITION_DRAFT_CONFLICT`-contract, met twee gerichte regressieasserties. Geen schema-, migration-, `definition-schemas.ts`-, compiler-, engine-, version-, merge-, push- of deploymentwijziging.

Gerichte Studio-tests zijn `10 files / 49 tests` groen; strict TypeScript, i18n `33` gelijke NL/EN-namespaces, lint `0 errors / 8 warnings`, Webpack-build `226` routes en `git diff --check` zijn groen. De volledige suite is `254 files / 973 tests`, waarvan `253/254` files en `972/973` tests groen; één bestaande, niet-gerelateerde Journey-test faalt op ontbrekende tekst `Binnenkort beschikbaar`.
## Setup Assistent V1 — 2026-08-27

**Status: SETUP ASSISTENT V1 GREEN — READY FOR REVIEW/INTEGRATION — NO MAIN/PRODUCTION RELEASE**

De geïsoleerde branch `work/setup-assistant-v1` is vanaf exact `e13c50f418cb327a6e4e99e266d58ab7370e4885` opgebouwd in `.codex-worktrees/setup-assistant-v1` met drie sequentiële lokale slices. De verticale slice bevat de statische CORE-guide, Setup-instelling en completion API's, tenant/HR-groepgebonden RLS-tabellen, audit, veilige upsert/uncomplete, i18n, edge-tab, Foundation Drawer, responsive mobile surface, HeRa-mutual-exclusion en permission-gated suggestions. Salaris blijft bewust verborgen zonder betrouwbare expliciete resolver.

Op TEST-project `wnpfloqpjvaacobppbpk` zijn uitsluitend de twee Setup-migrations toegepast en gecontroleerd. De remote SQL-contracttest is groen; beide Setup-tabellen hebben RLS, policies, grants, composite keys en audittriggers. De gebruikte TEST-records zijn na de browseracceptatie exact verwijderd; readback is `0/0`. Security-advisor heeft geen Setup-finding; performance toont uitsluitend vier nieuwe `unused_index`-INFO's voor de FK-indexen.

De authenticated browserflow is bewezen voor TEST HR Admin op desktop en `390x844`: enable/readback, suggesties, completion mark/unmark/readback, static 16-step rendering, CTA's, mobile fullscreen en overflow. Manager en Medewerker zijn negatief bewezen met geen edge-tab en Setup-API `403`. Geen productie-DB, production config, version bump, merge, push of deploy.

Lokale Setup-tests zijn `5/5`, typecheck en i18n zijn groen, ESLint is exit `0`, en de Webpack-build is groen. De volledige suite meldt `975/976` tests (`254/255` files); de ene failure is de ongewijzigde bestaande Journey-test `components/journeys/journey-steps.test.tsx` en valt buiten deze Setup-delta.
## R6-2 gedeelde Insights-controls — 2026-08-26

**Status: LOKAAL TECHNISCH GROEN — AUTHENTICATED BROWSER GREEN — RELEASE / PRODUCTION: NOT TOUCHED**

De branch `work/r6-insights-shared-controls` is vanaf exact R6-1 `32d5c32cb44e0b274a9cbfd1fca81763f5471701` opgebouwd. De Foundation multiselect en shared Insights-controls zijn toegevoegd; employee FacetFilter, Salary FilterMenu, Upcoming FilterDropdown en absence active summaries gebruiken nu dezelfde zoekbare/selecteerbare interaction mechanics. Report-owned filters, serializers, berekeningen, privacy, permissions, loaders en exportsemantiek zijn behouden. Applied URL-state blijft canonical met lokale draft, `router.push` voor Apply en bestaande veilige drilldown-returncontext.

Technische verificatie is groen: nieuwe shared tests `7/7`, targeted Insights `53/53`, strict TypeScript, i18n `33` gelijke namespaces, ESLint `0 errors` met bestaande warnings, Webpack-build `226` routes/pages en `git diff --check`. De volledige suite heeft `257` bestanden en `988` tests uitgevoerd; `987` zijn groen en alleen de bestaande Journey-test faalt op `Binnenkort beschikbaar`, ook op baseline `e13c50f` en buiten scope.

Authenticated browseracceptance is **GREEN**. De canonical `apps/hr-suite/.env.local` is naar de worktree gekopieerd en alleen op aanwezigheid/SHA-256-match gecontroleerd. Playwright desktop `1440x900` en mobiel `390x844` bevestigden employee searchable multiselect, Apply/Reset, active-filter remove, Clear all, Back/Forward, refresh, absence, Bradford, Upcoming, salary primary/secondary, export, drilldown return-context, keyboard/Escape/focus restore en geen page-level horizontal overflow. De browserconsole eindigde op `0` errors en `0` warnings. Minimale browserfixes: employee active-filter actions schrijven de canonical URL bij; Upcoming labelt de afdelingschip correct als `Afdeling`. Geen migration, remote schema/RLS/permission/auth-wijziging, merge, push, deployment of version bump. Zie `docs/delivery/parallel/2026-08-26-r6-2-insights-shared-controls.md`.

## R6-1 Insights query + navigation seam — 2026-08-26

**Status: SEAM READY FOR R6-2: YES — LOCAL FEATURE BRANCH — RELEASE / PRODUCTION: NOT TOUCHED**

Branch `work/r6-insights-query-seam` is vanaf exact `e13c50f418cb327a6e4e99e266d58ab7370e4885` opgebouwd. De seam centraliseert typed report-id canonicalisatie, URL query ownership, repeated-array serialization, safe report switching, Apply/history semantics en interne drilldown-returncontext. `upcoming-events` is de canonical report-id; de oude `upcomingEvents` alias wordt alleen geaccepteerd bij parsing. De Upcoming server-loader controleert bovendien de zichtbare, permission-filtered report catalog voordat data wordt geladen. De frozen contract staat in `docs/requirements/reports/R6_1_INSIGHTS_QUERY_NAVIGATION_SEAM.md`.

Verificatie: seam/query-tests `7/7` bestanden en `29/29` tests groen; typecheck groen; i18n `33` NL/EN-namespaces gelijk; lint `0 errors / 8 bestaande warnings`; production build `226` routes/pages; `git diff --check` groen. Volledige suite: `253/254` bestanden, `980/981` tests; de enige failure is de bestaande Journey-test op `Binnenkort beschikbaar`, buiten R6-1. Branch-browser op `localhost:3002`: HR Admin, canonical employee URL/filters, Apply via history, report switch cleanup, Upcoming direct view, Salary, Back/Forward en mobile `390x844` zonder horizontale overflow zijn gecontroleerd. De bestaande Next-dev dashboard-shell geeft hydration/state-consolemeldingen; deze run vond geen R6-1-specifieke consolefout.

Geen schema/migration, remote Supabase-mutatie, remote auth/permissionwijziging, merge, push, deployment of version bump. Zichtbare versie: `1.20260825.1`. Lokale implementatiecommit: `cffcf04` (`feat: add insights query navigation seam`); de documentatie is daarna in `a5d2de9` en `8597bf1` bijgewerkt.

## R4 Recruitment + Journeys centrale integratie — 2026-08-25

**Status: TEST-TRUNK GREEN — AUTHENTICATED COMBINED SANITY GREEN — READY TO INTEGRATE INTO MAIN — RELEASE PENDING**

De integratiebranch `work/r4-recruitment-journeys-integration` is vanaf exact baseline `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64` opgebouwd in `.codex-worktrees/r4-integration`. De 15 aangewezen Recruitment- en Journeys-slices zijn semantisch geïntegreerd, inclusief de bestaande Foundation-contracten en zonder nieuwe generieke componentfamilie. Root `main` is niet gewijzigd tijdens de integratie.

De read-only TEST migration reconciliation is afgerond. De vier lokale SQL-bestanden zijn inhoudelijk exact gelijk aan de toegepaste remote SQL en dragen nu de canonical timestamps `20260825140121`, `20260825140137`, `20260825153223` en `20260825134000`. Lokale repository-equivalenten zijn `4/4` met `0` lokale semantische duplicates. Remote history heeft al een tweede registratie op `20260825150000` met dezelfde Journey-migrationnaam en een ontbrekende afsluitende puntkomma; daarom is `duplicate migrations 0` voor de remote history **NO**. Dit is niet remote gerepareerd omdat deze run geen remote write toestaat.

Technisch is de branch GREEN met `253/253` testbestanden, `971/971` tests, strict TypeScript, `33` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack-build `226/226` en `git diff --check`. De Vacancy Detail hydration mismatch door locale-afhankelijke `toLocaleString()` is opgelost met deterministische NL/EN UTC-formattering.

Authenticated TEST-sanity is gecombineerd bewezen: HR op Recruitment/Journeys desktop `1440x900` en mobiel `390x844`, inclusief overview, vacancy detail/pipeline/report/promote, Applicant Detail, Journey overview/participants/steps en template catalog/designer; Manager/Employee Recruitment deny en Journey self/participant scope zijn gecontroleerd. Alle finale routechecks hadden HTTP `200`, geen horizontale overflow en geen relevante console-errors. External publication en Hire zijn bewust niet uitgevoerd.

Zichtbare versie: `1.20260825.1`. De branch is klaar voor lokale integratie naar `main`; merge, push en Vercel-release zijn nog niet uitgevoerd.

## Goals security hardening — 2026-08-23 — actuele status

**Status: TEST-TRUNK GREEN — AUTHENTICATED BROWSER NOT EXECUTED — TOOLING LIMITATION — RELEASE / PRODUCTION AMBER**

Op `main` is vanaf exact geverifieerde `origin/main` `e8cc329dfaf026919d7996b74470ee9380f83828` de branch `work/goals-security-hardening` fast-forward geïntegreerd. De forward migration `20260823172440_talent_goals_security_hardening.sql` hardent terminal-goal/check-in locking, server-controlled terminal timestamps, het bestaande HR/Manager scopecontract zonder onbedoelde author-blokkade en alle vijf Goals `SECURITY DEFINER` functies met lege `search_path`, expliciete schema's en beperkte execute-rechten. Read-only history/SELECT van terminale doelen en check-ins blijft toegestaan; de vier security debts zijn OPGELOST.

De pgTAP-regressietest is op TEST groen met `18/18`; de remote migration is geregistreerd als `20260823172732`. Testdata is rollbackbaar en de baseline bleef `8 goals / 7 check-ins`, zonder hardening-records. Lokaal zijn `234/234` testbestanden en `899/899` tests, de gerichte Goals-tests `9/9`, strict TypeScript, lint `0 errors / 8 warnings` en `git diff --check` groen. Browser acceptance is **NOT EXECUTED — TOOLING LIMITATION** door CDP-channel failure, niet door product failure; release browser evidence blijft open. Zichtbare versie: `1.20260823.2`.

## Centrale Talent + Bugfix GREEN-integratie — 2026-08-23 — actuele status

**Status: TEST-TRUNK: GREEN — READY TO INTEGRATE INTO MAIN: YES — RELEASE / PRODUCTION: AMBER**

`work/talent-bugfix-integration` is vanaf exact `main` `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21` opgebouwd met de volledige tien aangewezen branchdelta's. De drie bugfixes en zeven Talent-feature-islands zijn lokaal geïntegreerd; de enige mergeconflicten zaten in NL/EN `talent.json` en zijn opgelost door alle feature-keysets te behouden. Geen generic Foundation-bestanden zijn gewijzigd.

TEST-migration history is read-only gecontroleerd op project `wnpfloqpjvaacobppbpk`. Employment is lokaal genormaliseerd naar `20260823134108_fix_employment_labor_condition_mutation_hr_group_scope`; assessments naar `20260823134149_align_talent_assessment_role_overrides` en `20260823135555_fix_talent_assessment_audit`. De remote functie-/permissionstaat matcht de lokale SQL-contracten. De verwijderde Goals-hardeningmigration en incomplete contracttest zijn niet opnieuw ingevoerd. Geen remote schema apply.

De volledige lokale gate is groen: `234/234` testbestanden, `899/899` tests, strict TypeScript, `33` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack-build `224/224` routes/pages en `git diff --check`. Authenticated TEST sanity is permission-first uitgevoerd met HR Admin voor general/settings, Manager voor workforce Talent en Employee voor self/negative routes. Desktop en 390x844 zijn gecontroleerd; Liquid Navy en LinkedHR zijn getest en de preference is hersteld. Geen storage-scheme-leak is waargenomen.

De open Goals-security-debt blijft apart: terminal goal lock, server-controlled terminal timestamps, manager/HR update-policy versus `author_user_id`, en `SECURITY DEFINER` `search_path` review. Versioning blijft ongewijzigd: `apps/hr-suite/lib/app-version.ts`, huidige `1.20260816.1`, conventie `1.<YYYYMMDD>.<volgnummer>`, met de bijbehorende testverwachting in `apps/hr-suite/lib/app-version.test.ts`; package `0.1.2` is niet leidend.

Geen push, merge naar `main`, deploy, production write, remote migration apply, version bump of branch cleanup uitgevoerd.

## Centrale R2/R3 GREEN-integratie — 2026-08-23 — actuele status

**Status: TEST-TRUNK: GREEN — RELEASE / PRODUCTION: AMBER**

`work/r2-r3-integration` staat op `d65d74fa0ec3378bb1b082d9dd366e38244a97d6` en is vanaf exact `abfa0bbb7db628f588faa3d4818a4f4663f27b46` opgebouwd met de volledige relevante delta van 11 aangewezen GREEN-branches. De enige overlap betrof `lib/organization/schemas.ts` en de bijbehorende test; beide semantische wijzigingen zijn behouden. De actuele Process-branchtip `f53cabf` is meegenomen naast de opgegeven `5953f22`, omdat deze de direct relevante `force-dynamic` acceptance-fix bevat.

Roadmap 2 (Absence Core, Absence Insights en HR Calendar + Leave) en Roadmap 3 (Organization/Departments, Continuous Appraisal, Star Performers en 9-grid) zijn lokaal technisch geïntegreerd. Authorization Coverage, Startpage, Process Automation lifecycle en Company Documents zijn eveneens geïntegreerd. De twee opgegeven TEST-migrations waren al toegepast; de migrationbestanden zijn onderdeel van de code-integratie, maar zijn niet opnieuw remote uitgevoerd.

De technische gates zijn volledig groen: `219/219` testbestanden, `857/857` tests, strict TypeScript, `33` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack-build met `224` gegenereerde static pages/routes en `git diff --check`. Er zijn geen verboden generated/env/secrets-bestanden geïntegreerd.

Canonical `apps/hr-suite/.env.local` bestaat; de fixture-auth reset is GREEN uitgevoerd voor uitsluitend de drie canonical TEST-fixtures. Authenticated TEST HR-route-sanity gaf voor alle tien gevraagde routes HTTP 200 met zichtbare content en zonder relevante console/runtime-errors. Manager/Employee spot-checks, 390x844 responsive checks en Liquid Navy/LinkedHR theme checks zijn GREEN. De Employee unauthorized pagina's `/absence/new` en `/authorization` tonen een generieke `AuthorizationError`-pagina; independent review heeft dit bevestigd als bestaande debt en geen integration regression.

Open debt voor een volgende bugfix-batch:

1. Employment labor-condition mutation.
2. Employee `/absence/new` unauthorized route toont generic AuthorizationError page (bestaande debt, geen integration regression).
3. Employee `/authorization` unauthorized route toont generic AuthorizationError page (bestaande debt, geen integration regression).

**Eindclassificatie: TEST-TRUNK: GREEN; RELEASE / PRODUCTION: AMBER.** Deze branch is gereed voor fast-forward-integratie naar `main`; geen production database-mutaties, schema apply of deploy.

## UX v1.2 final integration & acceptance — 2026-08-21 — actuele status

**Status: TEST-TRUNK: GREEN — RELEASE / PRODUCTION ACCEPTANCE: AMBER**

De branch `work/ux-v1-2-integration` bevat de bestaande integrationbasis plus de forward TEST-RLS-migration, remote regression test en twee noodzakelijke document-uploadfixes. Alleen de nieuwe migration is op TEST toegepast; `main` is niet gewijzigd.

Remote schema-evidence is groen: write-helper `can_manage_document_for_write`, document-audience write policies en de invoker-RPC zijn gecontroleerd; read policies/RLS zijn behouden. De remote SQL-regressietest bewijst positieve HR document/audience write/read, negatieve no-write en geen algemene read zonder audience. Security/performance advisors zijn uitgevoerd; er is geen nieuwe document-specifieke finding. Types zijn opnieuw gegenereerd zonder relevante exposed-typewijziging.

Bewezen GREEN-resultaten: Document PDF/TXT CRUD + cleanup, RLS migration + regressietest, HR Absence report/recovery, Authorization role CRUD + negative 403, `833/833` tests, TypeScript, i18n, lint, Webpack build en diff-check. De technische gate omvat `213/213` testbestanden, `33` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings` en Webpack-productiebuild met `225` routes.

Authenticated browser-evidence is gedeeltelijk groen op localhost:3000: document PDF/TXT upload HTTP 201, download HTTP 307 plus signed-storage HTTP 200, delete/restore/final-delete HTTP 200 voor beide controlled files, en daarna 9/9 acceptance-records soft-deleted met 9/9 storage objects verwijderd en 0 orphans. Absence report/recovery is groen met readback; capacity leest 25% terug maar heeft geen vastgelegde response-status. HR role create/cleanup en manager/employee negative POST 403 zijn groen. Employment real mutation, authorization coverage/save, process create/publish/retire/changelog, volledige desktop/390-consolematrix en afzonderlijke Default-theme acceptance blijven open. Tijdelijke absence-cases blijven staan omdat het product geen delete-contract aanbiedt.

Residual acceptance backlog voor release/production acceptance:

- Absence Manager/Employee volledige matrix
- Employment mutation met geschikte non-CAO testfixture
- Authorization Coverage-dialog/save
- Process Automation volledige create/publish/retire lifecycle
- resterende volledige theme/responsive matrix

**Eindclassificatie: TEST-TRUNK: GREEN; RELEASE / PRODUCTION ACCEPTANCE: AMBER.** Geen merge, deployment, release of push naar `main`.

## UX v1.2 Correction Batch 4 — Foundation polish — 2026-08-21

**Status: LOKAAL GEIMPLEMENTEERD; AUTHENTICATED BROWSERGATE BLOCKED BY ENVIRONMENT**

Branch `work/ux-v1-2-foundation-polish` start vanaf exact `origin/main` `a65d1daaa9444602f4be52c2d32933cffd285dd0`. Authorization role-create gebruikt `FormDrawer` met controlled dirty-state, centrale discard-confirm, saving/double-submit protection en lokale foutmelding. Coverage inspection gebruikt `Dialog`; de bestaande permission-editing en save-payloads blijven behouden. Startpage gebruikt Foundation-radius en semantic surfaces zonder zware shadows of normale hover-lift; compact/expanded, widgets, quick actions, scopes, drag/reorder en voorkeuren zijn niet functioneel herbouwd.

Gericht: startpage/v1.2 12/12 tests. Volledig: 210 testbestanden/826 tests, strict TypeScript, i18n 33 gelijke NL/EN-namespaces, lint 0 errors/6 bestaande warnings, Next-build 225 routes en `git diff --check` groen. Browser: lokale `/dashboard/start` redirect 307 naar login en anonieme `/api/roles` 401; authenticated TEST HR/Manager, desktop/390×844 en Default/LinkedHR blijven open omdat canonical `TALENT_*_PASSWORD`-waarden niet beschikbaar zijn. Geen API-, database-, RLS-, permission-, businesslogic- of mainwijziging; alleen deze work-branch is naar origin gepusht. Bestaande `apps/hr-suite/next-env.d.ts`-wijziging blijft buiten scope.
## UX v1.2 correction batch 3 — Process Automation interactions — 2026-08-21

**Status: LOKAAL GROEN; AUTHENTICATED BROWSERACCEPTANCE GEBLOKKEERD; WACHT OP PUSH**

De create-interactie van `/settings/process-automation` is gemigreerd van een custom dialog naar een full-page driestapsflow met sticky `FormActions`, Back/Continue/Cancel, dirty protection en bestaande create-draft API/navigation semantics. Publish en retire gebruiken de centrale `Dialog`; de verplichte changelog en reason zijn behouden. Er zijn geen Foundation-, route-, API-, database-, RLS-, permission- of businesslogicawijzigingen.

De lokale gate is groen: process-automation tests 8/8 bestanden en 46/46 tests, volledige hr-suite 210/210 testbestanden en 826/826 tests, strict TypeScript, i18n-pariteit met 33 namespaces, targeted lint, volledige lint met 6 bestaande warnings, productiebuild met 225 routes en `git diff --check`. Authenticated acceptance met TEST HR, read-only/unauthorized negative, create/edit/publish/retire cleanup, desktop, 390×844 en 0 relevante console-errors is niet uitgevoerd: deze worktree heeft geen `.env.local` en poort 3000 is bezet door een andere lokale server. Er zijn geen secrets gekopieerd en geen andere worktree gebruikt voor bewijs.
## UX v1.2 Correction Batch 2 — HR mutation surfaces — 2026-08-21

**Status: LOKAAL GERICHT GROEN; AUTHENTICATED BROWSERACCEPTANCE OPEN op `work/ux-v1-2-hr-mutation-surfaces`**

Vanaf `origin/main` `a65d1daaa9444602f4be52c2d32933cffd285dd0` is absence report naar de bestaande `FormDrawer` gemigreerd en is de complexe employment mutation-wizard full-page gemaakt. Recovery/capacity blijven inline. Organization- en company-location-rows zijn bij `canWrite=false` statisch leesbaar zonder FormDrawer, Save of mutation-UI; beide saves hebben een defense-in-depth guard. Bestaande company-location assignments blijven zichtbaar bij nul actieve locaties. Payloads, validatie, self-service/scope, warnings, wizardgedrag en timelinecontracten zijn behouden. Gerichte gates zijn groen: 15/15 tests, strict TypeScript, 33 gelijke NL/EN-namespaces, gerichte ESLint en diff-check. Volledige suite/build zijn voor deze niet-cross-cutting correctie niet opnieuw uitgevoerd. Echte desktop/390×844 authenticated browseracceptance is geblokkeerd door ontbrekende canonical fixture-password keys en doordat poort 3000 al door een niet-herleidbare Node-server bezet is. Geen API-, schema-, database-, RLS-, remote-, main-, release- of deploymentwijziging.

## UX Foundation v1.2 + Employee Reminders — 2026-08-21

**Status: GREEN — AUTHENTICATED 390×844 ACCEPTANCE COMPLETE**

Op `work/ux-foundation-v1-2-interaction-collections` zijn de v1.2 interaction- en collection-primitives/patterns toegevoegd en is Employee Reminders als enige productflow gemigreerd. De bestaande PERSONAL/HR-mode, `canManageHr`/`canAdd`/`canManageItem`, targetvelden, datumverschuivingen, `router.refresh()` en de POST/PATCH/DELETE/publish-API-contracten zijn behouden. Delete gebruikt nu ActionMenu → ConfirmDialog; Create/Edit gebruiken dezelfde FormDrawer met dirty-close protection en een vaste footer.

Groen: gerichte v1.2/reminder- en Drawer-regressietests, volledige hr-suite 209 testbestanden/824 tests, strict TypeScript, i18n-pariteit met 33 namespaces, lint exit 0 met 6 bestaande warnings buiten deze slice, productiebuild met 225 routes en diff-check. TEST HR is authenticated gebruikt op localhost:3000. De echte Playwright Reminder acceptance op 390×844 voor DEMO-035 is GREEN; de mobiele Drawer vult exact de viewport, footer en intended body-scroll zijn bereikbaar, dirty-close/ConfirmDialog en ActionMenu/delete zijn bewezen, zonder horizontale overflow of relevante console-errors. De tijdelijke testreminder is verwijderd. De Drawer kreeg alleen de minimale mobile padding-fix met regressiedekking. Er zijn geen schema-, API-, RLS-, permission-, database- of deploymentwijzigingen uitgevoerd.

## Employee 360 final integration + Dashboard/Overview — 2026-08-21

**Status: GEIMPLEMENTEERD / WACHT OP ACCEPTANCE op `work/emp360-dashboard-integration`**

De drie gereviewde Employee 360-slices zijn vanaf de exacte `origin/main`-baseline conflictvrij geïntegreerd. Dashboard/Overview gebruikt nu de bestaande UX Foundation voor kaarten, empty states, formulieren, employment-tabs en reorder-controls. De globale dashboard-editactie is verwijderd; de contextuele Personal-editactie blijft beschikbaar. Bestaande routes, API-contracten, datafetches, permissions, salary reveal, PATCH-payload, drag/drop, compact/expanded gedrag en A/B/C-functionaliteit zijn behouden.

Lokale gate: 208 testbestanden/809 tests, strict TypeScript, lint exit 0 met zes bestaande warnings buiten deze slice, i18n 33 gelijke NL/EN-namespaces, Webpack-build met 225 routes en diff-check groen. Authenticated browsercontrole blijft open voor de branch-preview omdat deze worktree geen lokale env heeft en poort 3000 niet luistert. Geen database-, RLS-, security-, main-, release- of deploymentwijziging.

## Foundation Controls v1.1 — 2026-08-20

**Status: LOKAAL GROEN; WACHT OP PUSH/REVIEW OP `work/foundation-controls-v1-1`**

Vanaf baseline `3dc4dc038940fdca731f292098a9b0760411c3d7` zijn de Foundation-controls aangevuld met `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `FormField`, canonical route/button tabs en interactieve overflowcontrols. `TextInput`, `Button`, `IconButton` en `DropdownSelect` zijn backwards-compatible gehard; `DropdownSelect` gebruikt nu Foundation-tokens en behoudt regular/searchable/native-formgedrag. De gerichte controlgate staat op 23/23 tests en strict TypeScript. `happy-dom` is uitsluitend als dev-testdependency toegevoegd voor echte DOM-interactiechecks.

De concrete use-case-inventaris en FOUNDATION_GAP-kandidaten (multiselect, datepicker, dialog en tooltip) staan compact in `docs/requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md`. De volledige lokale gate is groen: 203 testbestanden/788 tests, strict TypeScript, `check:i18n` met 33 gelijke NL/EN-namespaces, lint, Webpack-build met 225 routes/pages en `git diff --check`. Browser smoke op `/login` laadde inhoud met zichtbare interactieve elementen en zonder runtime-console-errors; alleen React DevTools/HMR-logs waren aanwezig. Er zijn geen productmodules gemigreerd en geen API-, route-, database-, RLS-, permission-, auth- of businesslogica gewijzigd.

## LinkedHR polish + compact fixes — 2026-08-20

**Status: LOKAAL GEREED; LINT INHERITED BLOCKER; AUTHENTICATED BROWSERGATE GEBLOKKEERD**

De aparte branch `feature/ux-linkedhr-polish` bouwt vanaf `origin/feature/ux-employment-workspace` (`5af3123`) en beperkt zich tot LinkedHR-theme-polish, Foundation-buttons, gedeelde overflow-tabs, employee/employment-presentatie en een compacte dashboard-fallback. Er zijn geen nieuwe features, API-, database-, RLS-, permission-, migration-, Supabase-, release- of versionwijzigingen uitgevoerd.

De LinkedHR-radiuscontracten zijn circa 6px voor surfaces/inputs, 8px voor buttons/controls en overlays. `ScrollableTabs` maakt actieve tabs duidelijker en toont rustige randcontrols uitsluitend bij echte overflow. Employee-fotoacties zijn icon-only met aria-label/title; de compacte employment-header verbergt de extra metadata-rij. De dashboard-layout filtert ontbrekende nodes en gebruikt een hoofdkolomfallback zodat compact geen lege hoofdcontent toont wanneer data beschikbaar is.

Groen: volledige hr-suite 202 testbestanden/777 tests, strict TypeScript, i18n-pariteit met 33 namespaces, Webpack-productiebuild met 225 routes/pages en `git diff --check`. Lint start niet inhoudelijk door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit (`contextOrFilename.getFilename is not a function`). Authenticated browserreview is niet uitgevoerd: er is geen Supabase-env in de worktree en de Playwright-browserdaemon kon de machinebrede browserdirectory niet openen; `/login` gaf lokaal 500 door ontbrekende Supabase URL/key.

## Employee Personal Tab — final correction 2026-08-20

**Status: LOKAAL GEREED; LINT INHERITED BLOCKER; GEEN MAIN-MERGE**

De PersonalPanel-redesignuitbreiding is functioneel teruggebracht naar de bestaande bewerkbare velden. De actieve address form is volledig naar Foundation-controls en semantic overlay-/sectiestyling gemigreerd; de onbereikbare legacy fallback is verwijderd. Er zijn geen API-, schema-, security-, theme-, remote-, release- of versionwijzigingen gedaan.

Gericht groen: employee-person-card 1/1, relevante employee-tests 9 suites/30 tests, strict TypeScript, i18n-pariteit met 33 namespaces, Webpack-productiebuild met 225 routes/pages en `git diff --check`. De volledige lintopdracht blijft geblokkeerd door de reeds bekende ESLint 10/`eslint-plugin-react` incompatibiliteit (`contextOrFilename.getFilename is not a function`).

## UX Foundation v1 — Blok 4 governance afgerond 2026-08-20

**Status: GEREED VOOR BREDERE SCHERMMIGRATIE; GEEN MAIN-MERGE**

Blok 1 t/m 4 van UX Foundation v1 zijn afgerond. De canonieke componentarchitectuur is `components/ui` voor primitives, `components/patterns` voor herbruikbare composities en `components/layout` voor generieke layoutcontracten. `/employees` en `/employees/[employeeId]` zijn de reference implementations; LinkedHR is een officieel theme.

`AGENTS.md`, de screen-redesignskill en dit deliverydocument leggen de governance vast. Blok 4 was documentatie/governance-only: geen code-, design-, component-API-, database-, migration- of remote Supabase-wijziging. De eerdere LinkedHR-migratie en remote toepassing zijn niet aangepast. Volgende stap: bredere gecontroleerde schermmigratie. Deze featurebranch is niet naar `main` gemerged.

## Employee Detail profile polish + LinkedHR — 2026-08-20

**Status: LOKAAL GEVERIFIEERD; AUTHENTICATED BROWSERGATE OPEN**

De Employee Detail-header gebruikt nu een rustige profile-cardopbouw met subtiele bovenband, avatar-overlap, compacte metadata, bestaande profielactie, secundaire utilities en vlakke tabs. Compact mode deelt dezelfde profile language. Het nieuwe `linkedhr`-theme is toegevoegd aan de bestaande preference/selectieflow, inclusief NL/EN-labels, theme-level kleur-/font-/radius-/input-/buttontokens en de Supabase-enum. De remote migratie `20260820081814_add_linkedhr_theme` is toegepast op `wnpfloqpjvaacobppbpk`; data, permissions, API-routes en Employee Detail-functionaliteit zijn verder niet gewijzigd.

Gericht groen: voorkeurstest 10/10, strict TypeScript, ESLint, i18n (33 gelijke namespaces), Webpack-build en diff-check. De anonieme LinkedHR-preview op 390x844 bevestigde `data-theme=linkedhr`, de blauwe/lichte tokens en geen horizontale overflow. Expanded/compact Employee Detail, `/employees`, generieke settings/form surface en desktop/mobile authenticated browsercontrole wachten op een beschikbare ingelogde browser-sessie.

## Release 2026-08-16: lokale consolidatie en productversie 1.20260816.1

Alle lokale branches zijn geïnventariseerd en blijken al in `main` opgenomen. De resterende medewerkerwizard-, roosterinvoer- en pre-placement avatar-storagebron is toegevoegd aan de releasebasis. De zichtbare productversie is verhoogd naar `1.20260816.1`; de npm-packageversie blijft `0.1.2`. De lokale releasegate is groen met 200 testbestanden/763 tests, strict TypeScript, ESLint 0/0, 33 gelijke NL/EN-namespaces, Webpack-build met 225 routes/pages en diff-check. GitHub `origin/main` staat op releasecommit `18cf531`.

## Medewerker-avatar vóór eerste plaatsing — Supabase 2026-08-16

De Storage-RLS-migratie `allow_hr_preplacement_avatar_storage` is remote toegepast op dev/test `wnpfloqpjvaacobppbpk` (geregistreerd als `20260816151833`). Insert-, update- en delete-policy verwijzen naar `employee_subresource_can_write`; de gerichte transactietest en policy-inspectie zijn groen. Security-advisor toont alleen bestaande projectbrede meldingen (83; 1 INFO, 82 WARN), performance-advisor 0 meldingen. Authenticated browserbewijs van de daadwerkelijke upload blijft open.

## Phase 2 Salary Structures + Salary Application — GREEN 2026-08-14

**Status: IMPLEMENTATION COMPLETE — PHASE 2 GREEN / CHECKPOINT BASELINE**

De resterende ESLint-blocker is eerst op de feature-base/baseline gereproduceerd: root ESLint 10 botste met `eslint-plugin-react@7.37.5` en de Next ESLint-integratie (`contextOrFilename.getFilename is not a function`). De oorzaak was baseline-tooling, niet Salary Structures of Salary Application. Root ESLint is daarom compatibel vastgezet op `9.39.5`; er is geen suppression of configverlaging gebruikt.

De vier bevindingen na die toolingfix zijn systematisch herleid en minimaal opgelost: twee werkelijk ongebruikte dubbele salarisberekeningen in `employment-create-form.tsx` verwijderd; de ongebruikte `employmentById` in `salary-exceptions.ts` verwijderd; en `react-hooks/set-state-in-effect` in `salary-band-percentage-control.tsx` opgelost door source-keyed draft/display-state zonder synchroniserend effect. De control heeft een regressietest voor transient lege invoer en herafleiding bij gewijzigde salaris/band-bron.

Volledige lokale fase-2-verificatie is groen: `195` testbestanden en `741` tests, strict TypeScript, ESLint met `--max-warnings=0` op `0 errors / 0 warnings`, i18n met `33` gelijke NL/EN-namespaces, Webpack productiebuild met `224` statische pagina's en `git diff --check`.

De remote Supabase gate is na identity-verificatie opnieuw uitgevoerd op `wnpfloqpjvaacobppbpk`: migrations, RLS/CRUD-policies, grants, tenant/HR-group isolation, administration x CAO filtering, historische schaal/trede- en salarisband-resolutie, exceptions, audit en advisors zijn gecontroleerd. De ene ontbrekende dev/test settings-fixture voor `TEST-BOUNDARY-ADMIN` is uitsluitend daar toegevoegd. Er is geen salary-specifieke security-advisorbevinding; bredere bestaande advisor-INFO/WARNs zijn behouden en gedocumenteerd.

De twee resterende browserdeviations zijn daarna op root cause onderzocht en opgelost. De employment-detailmapping gebruikt nu `salaryApplication.salaryBand` via een centrale sleutelresolver met regressietest. De Employee-directory rendert voor peers geen protected avatar-route meer; de bestaande avatarautorisatie is niet verruimd. HR Admin employment detail, Manager dashboard/teamavatar en Employee directory zijn op 390×844 opnieuw geladen zonder runtime- of consolefouten.

De actuele eindgate is groen: `195` testbestanden en `741` tests, strict TypeScript, ESLint met `--max-warnings=0` op `0 errors / 0 warnings`, i18n met `33` gelijke NL/EN-namespaces, Webpack productiebuild met `224` statische pagina's en `git diff --check`.

Deze groene baseline is de afgesproken lokale checkpoint voor Salary Structures + Salary Application. Geen push, merge, deploy, PR of version bump.

## Phase 3 Salary Insights — GREEN 2026-08-15

**Status: GREEN — PHASE 3 CHECKPOINT READY**

De slice staat in dezelfde `feature/salary-structures`-worktree vanaf `de3bf54` en volgt schema → API → UI. HR Admin heeft zes rapporten; Manager precies vijf (`salary-overview`, `salary-band-position`, `salary-band-status`, `salary-scale-steps`, `salary-structure-exceptions`); Employee heeft geen Salary Insights-data. `salary-internal-position` is aantoonbaar HR Admin-only: Manager ziet geen card, directe URL/browser-fetch/API en export geven `403 SALARY_INSIGHTS_INTERNAL_POSITION_FORBIDDEN`; HR Admin krijgt `200`.

Dev/test-fixture `20260815090000_salary_insights_test_fixtures.sql` bevat 3 actieve minimumloonrijen (2 REGULAR, 1 BBL, bedragen null en niet als €0 geaggregeerd) en 6 actieve canonical salary-bandrijen (3 binnen, 2 onder, 1 boven; FTE 1.0/0.8/0.2; compa/range geldig). De canonical expected values zijn niet gewijzigd. HR Admin API/browsertotaal is 63, Manager 17; Employee API's zijn alle zes `403`. Empty HR-groep en cross-tenant zijn voor alle rollen `0/FORBIDDEN`; de Managerresultaten bleven binnen HR Admin-scope.

De server-side authenticated gate is onafhankelijk van de in-app browser uitgevoerd. De projection-RPC heeft lege `search_path`, alleen authenticated EXECUTE en de dedicated managerguard; relevante remote tabellen hebben RLS. De API/RPC-, HTML- en browser-networkresponses bevatten geen niet-null peer-statistieken. HR Admin internal-position rapporteerde `0` voldoende en `63` onvoldoende peer-groepen; geen median/average/percentile is vrijgegeven. De security advisor bevat 83 bestaande projectbrede lints, met één verwachte actor-geautoriseerde salary-RPC-waarschuwing en geen nieuwe Salary Insights-RLS/scopebevinding; performance bevat geen Salary Insights-match.

Authenticated browserbewijs is opnieuw groen: HR Admin desktop 1440×900 en 390×844 voor alle zes rapporten met echte band/minimumloonresultaten; band-KPI onder/binnen/boven `2/2/2`, compa `106.55`, range penetration `72.21`, overview salary sum `215435.00`, scale/steps `42`, internal `63`, exceptions `0` als correcte lege staat. Manager desktop en 390×844 voor alle vijf toegestane rapporten; Employee desktop en 390×844 zonder cards/data. CSV, historische peildatum `2026-07-31` (HR `60`, Manager `16`), actuele peildatum `2026-08-15`, NL/EN en responsive gedrag zijn gecontroleerd.

Lokale eindgate: `199` testbestanden / `758` tests, strict TypeScript, ESLint `0 errors / 0 warnings`, i18n `33` gelijke namespaces, Webpack-build `225` pagina's/routes en `git diff --check` groen. De releasegate staat in `apps/hr-suite/scripts/salary-insights-release-gate.mjs`. Phase 3 wordt nu lokaal gecommit met `feat: add salary insights`; geen push, merge, deployment, PR of version bump.

Leidende documenten: [`requirements/salary-insights/SALARY_INSIGHTS_PRODUCT_REQUIREMENTS.md`](../requirements/salary-insights/SALARY_INSIGHTS_PRODUCT_REQUIREMENTS.md), [`requirements/salary-insights/SALARY_INSIGHTS_UX_REFERENCE.md`](../requirements/salary-insights/SALARY_INSIGHTS_UX_REFERENCE.md), [`CURRENT_CONTEXT.md`](CURRENT_CONTEXT.md).

## Salaristoepassing - vervolgslice 2026-08-14

**Status: IMPLEMENTATION COMPLETE — PHASE 2 GREEN; vervangen door de actuele status hierboven**

De bestaande Salary Structures-fundering is aangevuld met de administration×CAO-intersectie inclusief expliciete nul-linkfallback, een centrale datumgebonden resolver voor gepubliceerde scale-/step- en bandrevisies, en HR-uitzonderingen in het bestaande Insights-patroon. Het salarisbedrag blijft geldig bij een verdwenen band; een ongeldige schaal/trede levert geen verondersteld bedrag op en verwijst HR naar de bestaande Salaris aanpassen-flow. De strikte bandvoorwaarde is `minimum < midpoint < maximum`.

De vervolgslice is opgenomen in de groene Phase 2-baseline; de actuele eindgate hierboven bevat de volledige 195 testbestanden/741 tests, strict TypeScript, volledige ESLint, i18n-pariteit, Webpack-build en diff-check.

Remote dev/test `wnpfloqpjvaacobppbpk` is geverifieerd en bevat de vier salary-applicationmigrations: domain, resolution/exceptions, anon-grant hardening en samengestelde FK-indexen. De gegenereerde types zijn gecontroleerd; 11 salary-tabellen hebben RLS, anon heeft nul tabelgrants en de salary application RPC's zijn alleen uitvoerbaar door `authenticated`. De security-advisor heeft geen salary-specifieke bevindingen. Twee settings-policy performance-WARNs blijven bewust staan om `contract:*` en `salary:*` niet tot één bredere autorisatiepolicy samen te voegen.

Authenticated browserbewijs is uitgevoerd voor HR Admin, manager en employee op desktop en 390×844. De salary administration- en exceptions-reportflows zijn bereikbaar; manager en employee zien geen salarydata en krijgen op directe salary-settingsroutes de bestaande no-access-ervaring. Er is geen commit, push, merge, deployment, PR of version bump uitgevoerd. Zie [`requirements/salary-application/SALARY_APPLICATION.md`](../requirements/salary-application/SALARY_APPLICATION.md) en [`CURRENT_CONTEXT.md`](CURRENT_CONTEXT.md).

## Salarisstructuren - Stap 2

**Status: Historische tussenstand — vervangen door Phase 2 GREEN hierboven**

Stap 2 levert de definitieve SS-001 t/m SS-011 HR Admin-UX zonder de Step 1-architectuur opnieuw te bouwen. De nieuwe manager gebruikt de bestaande `salary_structures`/revision API's en berekeningservice, toont twee aparte structuurtypen, meerdere revisies en CAO-beschikbaarheid, en houdt gepubliceerde revisies read-only. Bandmetrics zijn centraal en decimal-safe; validatie maakt alleen echte ongeldige ankers blokkerend en laat spread/progression/overlap/gap als waarschuwing staan. De migration-conflict-actie wordt server-side opgeslagen met tenant- en HR-groepfiltering.

Lokaal: 186 testbestanden/710 tests, strict TypeScript, i18n-pariteit, gerichte ESLint, Webpack-build en `git diff --check` waren groen. Dit is de historische tussenstand vóór de latere runtime-, browser- en releaseverificatie; zie de actuele Phase 2 GREEN-sectie hierboven.

## Salarisstructuren — Stap 1 GREEN 2026-08-14

De verouderde requirements en UX-reference zijn vóór implementatie vervangen door het canonieke pakket. De Product Requirements zijn volledig en aaneengesloten SSR-001 t/m SSR-069; de UX Reference is volledig en aaneengesloten SS-001 t/m SS-011. De herlezing en scopecheck zijn uitgevoerd in de opgegeven volgorde: Product Requirements → UX Reference → testdataset README → testdataset JSON → implementatieplan → Stitch uitsluitend visueel. Het enige niet-blokkerende bronverschil is dat de losse ready-to-paste prompt onderaan het plan README/JSON omdraait; de hoofdroute en deze uitvoering gebruiken de expliciet opgedragen volgorde. Verouderde Stitch-termen en voorbeeldwaarden zijn niet als productcontract gebruikt.

Stap 1 is schema-eerst uitgevoerd in `feature/salary-structures`. Het model is HR-groepbreed en ondersteunt meerdere benoemde structuren, twee vaste structuurtypen, effectieve revisies, immutable publicatie, stabiele schaal-/bandidentiteiten, concrete revision content, decimal-safe berekeningen, vrije tredelabels, progressionmetadata zonder automatisering, CAO ↔ logische structuur many-to-many en expliciete migratieconflicten. De bestaande administratiegebonden schaaldata is gemigreerd met behoud van alle concrete step-ID's: 60 bestaande `employment_salaries.salary_scale_step_id`-verwijzingen blijven geldig en orphan count is nul. Bestaande salarisinserts mogen `hr_group_id` blijven weglaten; een gecontroleerde BEFORE-trigger leidt dit actor-onafhankelijk af uit het Employment en valideert mismatches.

Remote dev/test `wnpfloqpjvaacobppbpk` bevat alle negen migrations. De databasecontrole bevestigt 9/9 RLS-tabellen, per tabel precies één SELECT/INSERT/UPDATE/DELETE-policy, expliciete authenticated grants en nul anon-tabelgrants. Aangemaakt zijn getypeerde root/draft/publish/CAO-RPC's en Next API-routes. Transactioneel bewijs is groen voor create → draft → publish, optimistic lock, duplicate effective-date blokkade, immutable published content, CAO met twee structuren, cross-HR-group relation deny en employment-salary HR-groepafleiding. De security-advisor bevat geen Salary Structures-bevinding; de performance-advisor toont uitsluitend verwachte `unused_index`-INFO voor nieuwe indexen.

De canonieke JSON is via een deterministische, productie-afwijzende generator in de bestaande lege dev/test-HR-groep geladen: 5 structuren (2 schaal/3 band), 7 revisies (5 gepubliceerd/2 concept), 20 logische schalen, 38 schaalwaarden, 403 stappen, 13 logische banden, 19 bandwaarden, 3 CAO-relaties en 1 migratieconflict. De officiële Rijkrevisie bevat exact 18 schalen/198 stappen en de regressiewaarde schaal 8/trede 5 is €3.741,48. Alle canonieke bandmetrics en de vier legacy regressiemodi worden door tests afgedekt.

Verificatie: 4 gerichte testbestanden/21 tests groen, strict TypeScript groen, gerichte ESLint zonder warnings en `git diff --check` groen. Officiële remote types zijn gegenereerd met behoud van de reeds gedocumenteerde lokale `company_activities`-compatibiliteit, omdat die bestaande lokale migration nog niet in remote dev/test staat. Stap 2, volledige UX SS-001 t/m SS-011, NL/EN-i18n, browser-/responsive-/accessibilitybewijs, build/releasegate, push, merge, deployment, PR en version bump zijn nog niet uitgevoerd. **DO NOT recreate previous-step architecture.**

## Guided Recruitment — lokaal geconsolideerde testrelease 2026-08-13

Guided Recruitment is samengevoegd naar `main` en gepubliceerd met zichtbare productversie `1.20260813.1`. De definitieve lokale gate is groen: 182 testbestanden/687 tests, strict TypeScript, 33 gelijke NL/EN-namespaces, ESLint zonder warnings, `git diff --check` en Webpack-build met 223 pagina's. De Recruitment-migrations, tests, fixture, i18n, requirements en generated DB-types zijn gecommit; er zijn in deze releaseprocedure geen migrations opnieuw uitgevoerd of via `db push` toegepast. GitHub `origin/main` en Vercel Production zijn geverifieerd op SHA `446a8f8ecef7b7c06f1c6910a990ecbe3bf84046`; deployment `dpl_JDCAbJkkTy9YDLWCB1UGLxvc7kKd` staat `READY`. `/login` gaf 200, de beschermde Recruitment-settingsroute bereikte de loginlaag en een onbekende publieke vacancy gaf veilig 404. Runtime error/fatal-logs waren leeg. De publieke Turnstile-, rate-limit- en malware-scanconfiguratie blijft bewust geparkeerd en publieke submit/upload blijft fail-closed.

## Guided Recruitment — publieke securityconfiguratie geparkeerd 2026-08-13

De publieke Recruitment-securityboundary is bewust geparkeerd voor development/test. Zonder Turnstile, rate-limit-pepper en malware-scanconfiguratie blijft publieke submit/upload fail-closed; vacatureweergave en interne Recruitment-functionaliteit mogen blijven werken. Het volledige, later uitbreidbare dossier staat in `docs/requirements/recruitment/LIQUIDHR_RECRUITMENT_PUBLIC_SECURITY_PARKED.md`. Er is geen bypass, dummy scanner, productiecredential, remote wijziging of deployment toegevoegd.
## Guided Recruitment 2026-08-13 - STEP 3 RELEASE VERIFICATION: PUBLIC GATE BLOCKED

De drie pending Step-3 migrations zijn individueel en in volgorde op remote Supabase toegepast: `20260813142035_guided_recruitment_guided_content`, `20260813142057_guided_recruitment_retention_and_analytics` en `20260813144216_guided_recruitment_retention_anonymize_ambiguity_fix`. De remote Recruitment-contracten zijn groen; de bestaande `TEST-RECRUITMENT-*` fixtures zijn geladen en behouden. Officiele remote types zijn opnieuw gegenereerd. De advisors tonen geen nieuwe actionable Recruitment security- of performancebevinding: alleen de begrensde SECURITY DEFINER-wrappers en Recruitment unused-index-info blijven.

Authenticated browserbewijs is groen voor NL desktop/390x844 voor HR Admin, reviewer A/B, isolatie, andere HR-groep, revoked URL, settings/library/sets/privacy en non-identifiable analytics. Aanvullend is EN gecontroleerd voor HR Admin Recruitmentlijst/vacature-/sollicitatiedetail, library, interviewsets, privacy, analytics, reviewer A scorecard en 390x844 Recruitment zonder overflow. Publieke securityconfiguratie ontbreekt volledig; de public submit blijft aantoonbaar fail-closed met `RECRUITMENT_PUBLIC_INPUT_INVALID` en upload happy path is niet bewezen.

Volledige hr-suite-tests zijn `182 bestanden / 687 tests` groen, i18n, strict TypeScript met ruime heap, Webpack-build met 223 pagina's en diff-check zijn groen. Repo- en Recruitment-lint stoppen voor analyse op de bestaande ESLint 10/`eslint-plugin-react`-compatibiliteitsfout. Productversie en `finish-feature.ps1` zijn niet uitgevoerd. Eindstatus: **IMPLEMENTATION COMPLETE, RELEASE VERIFICATION INCOMPLETE**; alleen de publieke securityconfiguratie en daarmee de publieke happy path ontbreken.

## Guided Recruitment 2026-08-13 — STEP 3 LOKAAL GEBOUWD, RELEASE GATE BLOCKED

Stap 3 levert lokaal de begeleide bibliotheek en immutable systemcontent, HR-groepbeheer van eigen content en sets, interviews/participants/assessment-adapters, actor-safe assigned participantflow, scorecard, pipeline/privacy/retention/analytics en de dagelijkse retention-cronroute. De twee migrations en de `TEST-RECRUITMENT-*` fixture staan in de recruitment-worktree; systemcontent telt 25 application questions, 84 interview questions, 45 criteria, 35 preparation items en 12 sets. Application questions worden niet in sets toegelaten; peer assessments zijn vóór eigen submit niet in de participantprojection aanwezig; terminale applications blijven uitgesloten.

Lokaal bewijs: 182 testbestanden/686 tests, strict TypeScript, 33 gelijke NL/EN-namespaces, `git diff --check` en `next build --webpack` groen. Repo-lint is geblokkeerd door de bestaande ESLint 10/Next-pluginfout op een ongewijzigde absence-pagina. De Stap 3 migrations zijn nog niet remote toegepast: de Supabase-connector heeft de specifieke remote write afgewezen wegens ontbrekende expliciete bevestiging. Daarom zijn remote migrationstatus, post-migration advisors, officiële typegeneratie, SQL-contracttest, fixtureproef, authenticated browsermatrix en securityconfiguratie open. Productversie, merge, push, deployment en `finish-feature.ps1` zijn bewust niet uitgevoerd.

## Guided Recruitment 2026-08-13 — STEP 2 CORE EXPERIENCE GEBOUWD, AUTHENTICATED BROWSER OPEN

De Step 2-slice is gebouwd op branch `feature/recruitment` in `.worktrees/recruitment`; Step 1 is niet opnieuw ontworpen. De HR-flow ondersteunt vacaturelijst/detail, aanmaken en wijzigen als server-side gevalideerde schrijfgrens, zes vaste inhoudsblokken, vacaturepublicatie, configuratie voor telefoon/motivatie/CV, kandidaat- en sollicitatielijst/detail, handmatige invoer, pipeline-fase, afwijzen/heropenen en expliciete hire-keuze. De publieke route toont uitsluitend een open vacatureprojectie, houdt een gesloten vacature veilig gesloten en verwerkt inzendingen pas na server-side honeypot-, configuratie-, proof-, rate-limit-, bestandstype/-grootte-, magic-byte- en malware-scancontroles. CLEAN-documenten blijven in de private quarantinebucket.

Remote is migratie `guided_recruitment_core_experience` toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; de lokale bron is `20260813115443_guided_recruitment_core_experience.sql` (de remote migratieregistratie kreeg een eigen timestamp). De publieke vacaturestatus gebruikt een begrensde anon/authenticated wrapper; HR-writes gebruiken de bestaande tenant-, HR-groep-, permission- en lifecyclegrenzen. Remote inspectie-fixtures blijven bewust staan onder tenant `Planeten`: 3 vacatures, 18 secties, 2 publicaties, 4 kandidaten, 4 sollicitaties en 4 events. De module blijft voor deze dev/test-inspectie actief.

Verificatie: 5 gerichte testbestanden/10 tests, strict TypeScript, 33 NL/EN-namespaces, `git diff --check` en `next build --webpack` groen; de build genereerde 211 pagina's. De eerste normale buildvariant faalde alleen op Next package-resolutie in deze worktree en is niet als productiefailure behandeld. De bestaande repo-lintfout `contextOrFilename.getFilename is not a function` bleef onveranderd. Supabase advisors tonen de verwachte SECURITY DEFINER-wrapperwaarschuwingen; er is geen nieuwe actionable Recruitment-RLS-bevinding vastgesteld.

Open: authentieke browserverificatie is niet geleverd. De lokale devserver startte met `--webpack`, maar `/login` gaf een Next runtimefout omdat `NEXT_PUBLIC_SUPABASE_URL` en de publishable key in deze worktree ontbreken. Turnstile- en malwarescanconfiguratie ontbreken eveneens; publieke upload blijft fail-closed. Stap 3, deployment, push en versie-update zijn bewust niet uitgevoerd.

## Guided Recruitment 2026-08-13 — STEP 1 FOUNDATION AFGEROND, STEP 2 BLOCKED

Branch `feature/recruitment` in `.worktrees/recruitment` bevat de duurzame requirements en de secure domain foundation. Remote dev/test heeft 22 Recruitment-tabellen met tenant + HR-groepownership, 10 canonieke permissions, RLS op iedere exposed tabel, nul anon-tabelgrants, een private `recruitment-documents`-bucket, concrete participantprojecties, idempotente/versioned stage/reject/hire/reopen-kernels, heropening zonder participantrestore, fase-minimum, retentieherberekening en twee begrensde anon-RPC's. Candidate en Application blijven afzonderlijke identiteiten; genormaliseerde e-mail is alleen een niet-uniek duplicaarsignaal. De adapters voor fail-closed botchallenge/malwarescan, persoonlijke reminders, expliciete Employee-match/hire en Journey-handoff zijn aanwezig. Er is geen product-UX uit Step 2 gebouwd.

Bewijs: linked project `wnpfloqpjvaacobppbpk` (`LiquidHR`, `eu-west-3`, `ACTIVE_HEALTHY`), vijf toegepaste migraties, 22/22 RLS, 10 permissions, transactioneel HR/participant/unrelated/cross-group/cross-tenant/anon/reject/hire/reopen/idempotent-replay/document/retention-contract groen met cleanup `0/0/0`, officiële remote typegeneratie plus behoud van de bestaande lokale `company_activities`-typeafwijking, 45/45 gerichte tests, strict TypeScript, 33 gelijke NL/EN-namespaces, Webpack-build met 209 pagina's en browserbewijs voor module-uit 404/geen nav, HR Admin route-shell, manager `/geen-toegang` en publieke unknown UUID 404 op desktop/390px. Advisors hebben geen ontbrekende Recruitment-RLS of FK-index meer; alleen de bewust begrensde SECURITY DEFINER-waarschuwingen en nieuwe unused-index-info blijven. Repo-lint is geblokkeerd door de bestaande `contextOrFilename.getFilename is not a function`-incompatibiliteit. Turnstile- en scannerconfiguratie ontbreken, dus live uploadbewijs is niet geleverd en Step 2 blijft **BLOCKED**. **DO NOT recreate Step 1 architecture.**

## LiquidHR Journeys 2026-08-12 — BOUWSTAP 3 VOLLEDIG AFGEROND

De leidende requirements staan in `docs/requirements/journeys/JOURNEYS.md`. Vastgelegd zijn: zelfstandige domeingrens, HR-groepownership, blijvende Employee-identiteit, optionele expliciete Employment-context, immutable templateversies, concrete participant snapshots, eigen permission-/RLS-contract, preboarding-access, actor-specifieke projecties, applicatiekaart, conceptueel datamodel, testmatrix en exact drie verticale bouwstappen.

Gebouwd zijn de configuratieslice uit stap 1, de HR-runtimeslice uit stap 2 en stap 3: actor-filtered projection-RPC’s met minimale topic-/naam-/voortgangsdata, append-only topic outcomes, self-/participantdetail, de bestaande startpagina- en medewerkerdashboardwidgets, een bestaande reminderdeep-link en de beperkte Journey-only preboarding-startpagina. De Stitch-schermen zijn visuele richting; shell, herbruikbare cards, layoutvoorkeuren, tokens, permissions, RLS, i18n en routing blijven LiquidHR-native. Routes/services blijven de schrijfgrens.

Bewijs voor de bestaande stap-1/2-basis: project `wnpfloqpjvaacobppbpk` bevat de Journey-migraties tot en met `20260812153435`; remote pgTAP is 18/18 plus 12/12 groen. Stap 3 bevat remote de projection/outcome-, FK-index-, shellscope-, next-action- en employeeprojectionmigraties. Alle 16 Journey-tabellen uit stap 1–3 hebben RLS; wrapper-security en officiële typegeneratie zijn gecontroleerd. De globale `DIRECT_MANAGER`-grant voor participantpermissions is niet toegepast. De bestaande Journey-participant permissionroute en actor-veilige projectionservice zijn gebruikt: shelltoegang vereist concrete actieve/assigned participatie, topics/outcomes blijven zichtbare-assignment-gebonden. Employee-preboarding, managerparticipant en buddy/participant zijn authenticated browsermatig getest op desktop en 390x844; console-errors zijn nul en de gecontroleerde networkresponses zijn succesvol. De disposable PREBOARDING-testdata blijft handmatig inspecteerbaar en is geen functionele dependency. Release `1.20260812.3` staat op `main`/GitHub commit `2a9b58e52ca81e6ecd66ec2b85c95d6bcb6a4925`; Vercel Production `dpl_BVf4pDiu8kbEWhot2QZS633L9PeE` is `READY` op exact deze SHA. De deployed checks waren door Vercel SSO beperkt tot `302`-bereikbaarheid; runtime-errors en deployment errorlogs zijn schoon.

## Looncontract aanpassen: vier flows 2026-08-12

De eerste vier acties op de dienstverbanddetailpagina zijn lokaal aangesloten op één gedeelde wizard. De contractselectie toont bij ieder contract de relevante periode-, arbeidsvoorwaarde-, werkvorm- en fulltimegegevens; na selectie staat expliciet `Dat contract gaan we aanpassen.`. Voor iedere flow worden de relevante historische waarden vóór de wijziging getoond en kan de ingangsdatum snel worden gekozen als contractstart, begin huidige maand, begin volgende maand of als aangepaste datum.

De flows ondersteunen urenrooster, urenrooster + salaris, functie/afdeling/kostenplaats en salaris. De roostereditor volgt de medewerkerwizard met voltijd/deeltijd-afleiding, weekuren, factor, daguren, tweede roosterweek en tijd-voor-tijd. Een één- of tweeweekse keuze wordt na de schedule-write ook gepubliceerd via de bestaande work-pattern-API. De salaris-, keuze- en kostenverdelingsvelden zijn in dezelfde detail/review/save-cyclus opgenomen. De service controleert de gekozen `contractId` en ingangsdatum server-side; bestaande API's en RLS blijven de schrijfgrens. De overige drie actietegels geven na contractkeuze nog een bewuste niet-beschikbaarmelding.

Status: lokaal geïmplementeerd en statisch geverifieerd met 156 testbestanden/606 tests, strict TypeScript, volledige ESLint, 31 gelijke NL/EN-namespaces, `git diff --check` en `next build --webpack` met 200 pagina's. De lokale browsercontrole bevestigt `/login` HTTP 200, maar authenticated detail-, contractkeuze- en savebewijs is niet uitgevoerd. Geen migratie, remote wijziging, commit, push of deployment.

## Nieuwe medewerker- en dienstverbandwizard 2026-08-12

De foto-upload staat als nieuw harmonica-venster onder `Optionele extra gegevens` in de nieuwe medewerkerwizard. Contract- en proeftijdsnelkeuzes rekenen de periode-einddatum inclusief laatste dag uit. Proeftijdregels voor wel/niet toegestaan en maximale duur zijn waarschuwingen; de lokale migratie `20260812110000_probation_rule_warnings.sql` laat alleen ontbrekende of chronologisch ongeldige datums blokkeren. De roosterband bepaalt `FULL_TIME` uitsluitend bij exact gelijke weekuren met de fulltime-referentie.

De dienstverbandwizard blijft read-only bij de overgang van `Overige` naar `Controleren`. De review toont naam, geboortedatum en geslacht; de POST naar `/api/employees/:employeeId/employments` gebeurt uitsluitend na `Dienstverband aanmaken` en dubbele eindacties worden client-side afgevangen. De 409-responsen voor nummer/IKV-conflicten krijgen een gerichte melding.

Status: lokaal geïmplementeerd en geverifieerd met 156 testbestanden/605 tests, strict TypeScript, volledige ESLint en 31 gelijke NL/EN-namespaces. De nieuwe Supabase-migratie is niet remote toegepast; deployment en authenticated browserbewijs zijn open omdat poort 3000 in deze beheerde sessie niet blijvend kon worden gestart.

## Navigatie en module-instellingen 2026-08-12

De standalone sidebar-link voor Teamkompas en de bijbehorende menuvolgorde-optie zijn verwijderd. Teamkompas verschijnt nu als permission- en modulegestuurd venster op `/workforce` (Ontwikkeling), naast de bestaande ontwikkelonderdelen. De NL/EN-teksten zijn toegevoegd.

Documentdossiers zijn geen optionele module meer in de instellingenpagina: de catalogus, Zod-selectie en save-payload accepteren alleen de zes werkelijk schakelbare uitbreidingen. Migratie `20260812054853_documents_always_on.sql` zet bestaande en toekomstige `DOCUMENTS`-tenantregels aan, voegt een database-check constraint toe en maakt de centrale `tenant_module_enabled`-helper voor deze code altijd positief na tenanttoegangscontrole.

Status: lokaal geïmplementeerd en gericht geverifieerd. 2 gerichte testbestanden/3 tests, strict TypeScript, volledige ESLint, 31 gelijke NL/EN-namespaces en `git diff --check` zijn groen. Niet remote toegepast, niet gedeployed. Read-only advisors en typegeneratie zijn tegen de bestaande remote toestand uitgevoerd; post-migratie advisors/typevalidatie en authenticated browserbewijs volgen alleen bij expliciete schema-/releaseverificatie.

## Release 2026-08-11 — productie geverifieerd

Alle actuele featurecommits staan op lokaal `main`; de zichtbare versie is `1.20260811.1`. De releasegate is groen met 156 testbestanden/601 tests, strict TypeScript, 31 gelijke NL/EN-namespaces, volledige ESLint, diff-check en een Webpack-productiebuild met 200 pagina's.

De aangetroffen research-wrapperpermissionfout is schema-eerst remote hersteld via `research_wrapper_execution_grants`. Publieke wrappers zijn afgeschermde `SECURITY DEFINER`-functies met lege `search_path` en alleen `authenticated` execute; interne kernels blijven voor `authenticated` en `anon` afgesloten en behouden de bestaande autorisatiechecks. Het remote researchcontract is groen. De vier bijbehorende advisor-WARNs zijn bewust en gedocumenteerd. Releasecommit `0598548a218433d1b2ed42db5a317b40f9347d00` staat op GitHub `main`; Vercel Production `dpl_7W8AKP7nAASxrfaiQz4SjbLUQj3F` is `READY` op die SHA, `/login` geeft HTTP 200 en de runtimecontroles zijn schoon.

## Surveys en eNPS — follow-up 2026-08-11

Conceptcampagnes zijn nu wijzigbaar zolang zij `DRAFT` zijn. De PUT-routes, edit-links, transactionele RPC's en afgeschermde publieke wrappers zijn lokaal en remote gecontroleerd. Een geautoriseerde fixtureproef activeerde een survey en eNPS-campagne, liet één medewerker beide antwoorden insturen en bevestigde in de HR-monitor `1 van 3` respons; surveyresultaten waren zichtbaar en eNPS-resultaten bleven door de vijf-responsdrempel verborgen. De campagnehoofdrijen en alle twaalf bijbehorende tabellen zijn daarna verwijderd; de cleanup-query retourneerde overal nul.

De status blijft `GEDEELTELIJK` uitsluitend omdat automatische e-mailherinneringen en de scheduler bewust zijn uitgesteld. Segmentatie van kleine groepen blijft afhankelijk van een apart privacybesluit. Supabase-types zijn opnieuw gegenereerd; de advisor meldt vier bewuste research-wrapper-WARNs voor de afgeschermde publieke `SECURITY DEFINER`-grens. Push en deployment zijn nog niet uitgevoerd.

## Surveys en eNPS 2026-08-10 — GEDEELTELIJK / main browsergeverifieerd

De verticale slice bevat lokaal de volledige basis van beide tenantmodules: schema/RLS/grants, privacyveilige inzend-RPC's, systeem- en eigen eNPS-vragenbank, campagnebouwers, doelgroepen inclusief entiteiten, medewerkerhub/respondentflow, HR-instellingen, HR-monitor/resultaten, CSV en rolgebonden dashboardwidgets. Alleen `TENANT_ADMIN` krijgt beheer/resultaten; `DIRECT_MANAGER` krijgt geen onderzoeksrechten en medewerkers blijven self-bound.

Verificatie is groen voor de volledige hr-suite (154 testbestanden/591 tests), 10 gerichte testbestanden/31 tests, strict TypeScript, 30 gelijke NL/EN-namespaces, volledige ESLint, Webpack-productiebuild met 197 routes en diff-check. De researchmigraties staan remote; het remote SQL-contract is groen. De Supabase-advisors melden na wrapper-hardening geen research-specifieke securitybevinding en geen performance-WARN, en de officiële types zijn opnieuw gegenereerd met behoud van de lokaal al bestaande `company_activities`-typedefinitie.

Authenticated browserbewijs op de samengevoegde `main`-versie is groen voor HR Admin, manager en medewerker: beheer/monitor/bouwers/vragenbank voor HR, persoonlijke hub voor manager en medewerker en `/geen-toegang` op hun verboden routes. Desktop, 390x844, browserconsole, responseflow en cleanup zijn gecontroleerd. Alleen de automatische e-mailherinnering/scheduler blijft bewust uitgesteld; er is lokaal gemerged, maar niet gepusht of gedeployed.
## Teamkompas 2026-08-11

### Actuele niet-lege gate

De volledige campagnecyclus is op 2026-08-11 in de testomgeving doorlopen: HR Admin maakte en startte één tijdelijke campagne met 14 deelnames; de testmedewerker vulde alle 40 dual-ratings in, zag het eigen resultaat en diende `share_outer=true`/`share_inner=false` in. Vier bestaande directe teammedewerkers kregen gecontroleerde synthetische antwoorden/profielen met anonimiteit, outer-only en outer+inner. HR en manager zagen boven drempel vijf een veilige projectie met drie named outer-profielen; een manager kreeg op een cross-user resultaat `/geen-toegang`. Daarna zijn campagne, targets, deelnames, 200 antwoorden en vijf profielen exact verwijderd; de cleanup-query geeft voor het tijdelijke campagne-ID overal nul.

De Teamkompas-schema-validator gebruikt nu `z.guid()` in plaats van RFC-versie/variantstrikte `z.uuid()`, met een regressietest voor bestaande deterministische database-GUIDs. De gerichte schematests zijn 4/4 groen. Er is niet gecommit, gepusht, samengevoegd of gedeployed.

### Baseline vóór geautoriseerde testdata

**Status: remote schema en lege-toestand-browsermatrix geverifieerd; niet-lege campagnegate open.** De feature-worktree `codex/teamkompas-module` bevat de leidende requirement/FDR, zeven RLS-tabellen, expliciete Data-API-grants, atomaire RPC's, permissions en module-toggle. De service/API-laag dwingt actieve HR-groep, managementscope, self-only antwoorden/resultaten, optimistic concurrency, minimaal vijf deelnemers en afzonderlijke deeltoestemming af. De UI levert HR Admin-campagnebeheer, HR-/managerteamprojectie, medewerkersinvoer en persoonlijk resultaat in NL/EN.

Bewijs: volledige hr-suite 153 testbestanden/584 tests, Webpack-build met 190 pagina's en volledige ESLint waren groen; na remote aansluiting zijn 12/12 gerichte tests, strict TypeScript, 30 gelijke NL/EN-namespaces, gerichte ESLint en diff-check opnieuw geslaagd. De drie Teamkompas-migraties, SQL-contractproef, officiële scopezuivere typegeneratie en advisors zijn uitgevoerd. Er is geen ontbrekende Teamkompas-RLS of foreign-key-index; vijf bewuste authenticated SECURITY DEFINER-meldingen en twaalf nog ongebruikte nieuwe indexen zijn verklaard. De drie testrollen, beide beheer-denies, 390px-dialoog, Escape/focuslus/focus-teruggave en vier gerichte axe-scans (0 violations, 1–2 `incomplete` controles per weergave) zijn live bewezen. Open: de niet-lege campagnecyclus met uitnodiging, submit, resultaat, toestemming en teamprojectie; daarvoor is nog geen testdata goedgekeurd. Er is niet gecommit, gepusht, samengevoegd of gedeployed.

## Release 2026-08-10: productversie 1.20260810.3 — lokale samenvoeging

De lokale `main`-basis bevat de bedrijfsactiviteiten/feestdagen- en employment-overzichtslice plus de gecontroleerde Liquid Flow UX-slice. De zichtbare appversie is verhoogd in `apps/hr-suite/lib/app-version.ts`; de technische npm-versie blijft ongewijzigd. De lokale releasegate is groen: 151 testbestanden/575 tests, strict TypeScript, 29 NL/EN-namespaces, volledige ESLint, diff-check en Webpack-productiebuild met 187 pagina's. De releasecode staat op `edf8de9`; `main` bevat daarna docs-only verificatiecommit `f185a58`. Vercel Production `dpl_FtSAqLQqavF5JBg4ax1E6vWVJFme` en de daaropvolgende docs-only deployment zijn `READY`, `/login` geeft HTTP 200 en de runtime-scan over het laatste uur is schoon.

## Release 2026-08-10: productversie 1.20260810.2 — remote schema toegepast

De zichtbare appversie is verhoogd volgens de centrale `X.datum.volgnummer`-conventie. De drie employment-migraties zijn remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De bestaande actieve dubbele IKV is transactioneel gerepareerd zonder verwijdering: de gesloten historische IKV 9 bleef behouden en de latere open relatie kreeg IKV 10. De duplicate-controle retourneert nul actieve groepen; security- en performance-advisors en officiële typegeneratie zijn uitgevoerd. Releasecommit `cce23987603bf25d2778672ce5a17a543e1f717a` staat op GitHub `main`; Vercel Production `dpl_A7nVUHc5JhCcAuQy2hiaNkRYno3L` is `READY` op exact deze commit en `/login` geeft HTTP 200. De runtime-scan toont alleen het bestaande projectbaseline-incident `PGRST303 JWT issued at future` op `/settings/holidays`.

## Weerbericht verhuisd naar medewerkerheader 2026-08-10 — geverifieerd

Het weerinstrument en de Compact-schakelaar zijn uit de startpagina-header verwijderd, evenals het daar getoonde logo. De medewerkerheader heeft nu een klein weericoon met een responsive drawer voor werktemperatuur, maximum, luchtvochtigheid, wind en luchtdruk. De privé-adresoptie wordt alleen voor de eigen medewerkerkaart geladen en getoond. Sluiten werkt via kruisje, Escape en klik buiten het venster. Strict TypeScript, gerichte ESLint, i18n-pariteit, `git diff --check` en desktop-/390px-browsercontrole zijn uitgevoerd. Geen schema-, API- of remotewijziging.

## Medewerkerdashboard profielheader 2026-08-10 — geverifieerd

De uitgebreide medewerkerheader heeft dezelfde gegevens en acties in een nieuwe responsive compositie: een compacte ronde avatar, prominente naam met personeelsnummer/status, foto-acties in dezelfde naamkleur, 40x40 weer- en compact/uitgebreid-iconen naast elkaar en de archiveeractie onderaan boven de contactonderregel. Op mobiel stapelt de header verticaal; de bestaande compacte variant blijft via dezelfde URL-state beschikbaar. Gerichte ESLint, strict TypeScript, `git diff --check` en desktopbrowsercontrole zijn gecontroleerd. Geen schema-, API- of remotewijziging.
## Dienstverbandwizard: onderhoud en contractregels 2026-08-10

**Status: lokaal gedaan, geverifieerd, samengevoegd in `main`, remote schema toegepast en gedeployed.** Vanuit worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\employment-wizard-fixes` zijn de wizard, employment API-validatie, contract-/detailroutes, i18n, migraties en regressietests samengevoegd. De gebruiker voert nu de functionele test uit.

De wizard gebruikt per medewerker het hoogste numerieke dienstverbandnummer plus één en behandelt het IKV-nummer als uniek per medewerker, niet organisatiebreed. Contracten zonder einddatum, proeftijdregels, kalendermaand-snelkeuzes, Nederlandse decimale invoer, nuluren voor oproepkrachten, review-vóór-save, Annuleren, administratie-informatie en de footerfix zijn aangesloten. De POST-400 is opgelost door de te strenge RFC-UUID-check in de employmentpayload te vervangen door PostgreSQL-UUID-opmaakvalidatie; een exacte browserpayload-regressietest dekt dit af.

Bewijs: 149/569 Vitest, strict typecheck, 29 NL/EN-namespaces, `git diff --check`, Webpack-build met 185 pagina's en gerichte localhost-browsercontrole zijn groen. Remote zijn de drie migraties geregistreerd; de gesloten IKV 9 is behouden, de latere open relatie is IKV 10, en actieve IKV-duplicaten ontbreken. De bestaande ESLint 10/`eslint-plugin-react`-fout blijft een niet-inhoudelijke repo-blokkade.

## Vorige productie-release-status 2026-08-09

De mobiele Google-login hotfix is productie-live. Mergecommit `54f5f235c2523612008f5425586f72fc19ab0687` staat op GitHub `main`; Vercel Production-deployment `dpl_3g6rdX6aK6imhbcAGsgPNV3M15L4` staat `READY` met alias `liquid-hr-hr-suite.vercel.app`. De zichtbare appversie is `1.20260809.2`. De remote `NEXT_PUBLIC_APP_URL` bleef ongewijzigd omdat de beschikbare Vercel-sessie opnieuw login vroeg; de code gebruikt bij actuele requestheaders de stale waarde niet langer als origin.

## Mobiele Google-login hotfix 2026-08-09 — productie live

De oorzaak is in productie gereproduceerd: de Google OAuth-aanvraag gebruikte via de verouderde `NEXT_PUBLIC_APP_URL` het niet-actuele en niet-geallowliste callbackdomein `liquidhr.vercel.app`. Supabase viel daardoor terug op de Site URL en rondde de PKCE-sessie niet af. De lokale hotfix op `codex/fix-mobile-google-auth` geeft gevalideerde request-/proxyheaders voorrang, gebruikt dezelfde publieke origin in de callback, bewaart een veilige doelroute, toont callbackfouten nauwkeurig en voorkomt dubbele submits tijdens de redirect.

Bewijs: 7/7 gerichte auth-tests, volledige Vitest-suite 145/546, strict typecheck, i18n 29 namespaces en Webpack-build 181 pagina's zijn groen. De mobiele browserproef op 390x844 bewijst dat de gewijzigde build ondanks een bewust stale env-waarde naar de actuele requesthost terugstuurt en geen horizontale overflow heeft. Gerichte ESLint is niet uitvoerbaar door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit. Er zijn geen remote configuratie- of productiewijzigingen gedaan; merge, push, deployment en het corrigeren van `NEXT_PUBLIC_APP_URL` naar `https://liquid-hr-hr-suite.vercel.app` wachten op de expliciete feature-release.

De zichtbare productversie is voor deze release verhoogd naar `1.20260809.2` in `apps/hr-suite/lib/app-version.ts`; de unit-test verwacht dezelfde waarde.

## Form Builder: volwassen veldtypen 2026-08-09

Het formuliercontract bevatte al 16 volwassen invoertypen, maar de Form Builder bood er eerder slechts 5 aan. De nieuwe centrale catalogus exposeert nu alle 16 typen in drie herkenbare groepen: 9 invoervelden (`SHORT_TEXT`, `LONG_TEXT`, `INTEGER`, `DECIMAL`, `MONEY`, `DATE`, `TIME`, `DATETIME`, `BOOLEAN`), 2 keuzevelden (`SINGLE_SELECT`, `MULTI_SELECT`) en 5 referenties (`EMPLOYEE_REFERENCE`, `DEPARTMENT_REFERENCE`, `JOB_REFERENCE`, `EMPLOYMENT_REFERENCE`, `DOCUMENT_REFERENCE`).

De studio heeft type-specifieke previews, stabiele technische veldsleutels en bindings, Nederlandse en Engelse labels/helptekst, keuzeopties met toevoegen/wijzigen/verwijderen en een read-only guard voor gepubliceerde definities. De runtime gebruikt voor document-/bijlagereferenties de bestaande `employee_documents`-leesweg met tenant-, administratie- en verwijderfilter; remote is read-only bevestigd dat de tabel bestaat, RLS aan heeft en authenticated policies voor lezen/schrijven gebruikt. Er was geen nieuwe Supabase-migratie nodig.

Bewijs: de HR-admin test-draft `internal-transfer-mslq73xj-copy-mslqd4ax` bevat na reload alle 16 typen; de keuze-editor en NL/EN desktop/390px-preview zijn in de Codex-browser doorlopen. Manager en medewerker kregen bij directe toegang tot de studio `/geen-toegang`. Lokaal zijn 21/21 gerichte tests, strict TypeScript, i18n-pariteit, lint zonder warnings, `git diff --check` en de Webpack-productiebuild met 183 pagina's geslaagd. De blueprint houdt de herhaalbare groep expliciet aan als vervolgstap nadat de basis stabiel is; presentatieblokken zijn een aparte buildercategorie en vallen niet onder deze 16 invoertypen. Er is niets gecommit, gepusht of gedeployed.

## Form Builder bindings 2026-08-10

De vier contractcategorieën zijn uitgewerkt in een gesloten developerregistry: `PROCESS_ONLY` voor procesantwoorden, 11 getypeerde `DOMAIN_READ`-projecties voor subject/organisatie/dienstverband/documentcontext, de 3 bestaande `DOMAIN_PROPOSAL`-routes voor interne overplaatsing en 7 `COMPUTED`-formules voor veilige contextberekeningen. De builder filtert bindings op veldtype en toont categorie, registry key/formula en NL/EN beschrijving; administrators kiezen geen tabel, kolom, SQL of vrije formule.

De compiler valideert registrybestaan, typecompatibiliteit en write-semantiek. `DOMAIN_READ` en `COMPUTED` zijn server-side read-only; `DOMAIN_PROPOSAL` vereist minimaal één schrijvende participant. De migratie `apps/hr-suite/supabase/migrations/20260810062127_process_automation_form_binding_runtime_compatibility.sql` bevat de private resolver en forged-write guard in aparte binding-aware projection/save-wrappers; de bestaande gedeelde RPC's blijven compatibel en ongewijzigd.

Bewijs: de gerichte form-field/compiler-tests zijn 21/21 groen, strict TypeScript, NL/EN-i18n, gerichte ESLint en `git diff --check` zijn groen. De remote wrappermigratie is uitgevoerd via de gekoppelde CLI, als `20260810062127` geregistreerd en gecontroleerd met functiehashes, grants en het gegenereerde typecontract. Advisors zijn opnieuw uitgevoerd: security 38 totaal (1 INFO/37 bestaande WARN), performance 389 INFO; geen wrapper-specifieke bevinding.

De lokale browsercontrole op poort 3000 bevestigde de nieuwe binding-editor voor HR Admin met 20 binding-selectors in de P9-draft en correcte studio-weigering voor manager en medewerker (`/geen-toegang`). Een schone HR-admin-herhaling van de workspace had geen nieuwe console-error. De actieve en afgeronde work-itemroutes bereikten via de nieuwe wrapper de verwachte serverguards `FORM_REQUIRED` en `STEP_NOT_ACTIVE`; daarmee is de service-route naar de compatibiliteitsbrug bewezen. Bij de eerdere client-side testrolwisseling verscheen alleen een Next development-only `ProcessAutomationSettingsPage`-negative-timestamp uit de performance-instrumentatie; er was geen Forms-modulefout.

## P9/P10 — formulier- en procesproef 2026-08-10

P9 is uitgebreid met contextuele Work-ingangen: afzonderlijke `BLOCKED`-projectie op de startpagina, echte medewerker- en employment-proceskaarten/tabs, en geautoriseerde processtarts vanuit afdelingen en het organogram. De employment-RPC filtert server-side op `subjectEmploymentId`; de bestaande medewerkerfilter blijft beschikbaar.

De gedeelde outputbrug gebruikt nu zowel compiled als top-level outputconfiguratie, accepteert database-UUID's zonder onjuiste RFC-versievariantbeperking, en heeft de live documentcategorie `process-internal-transfer`. De remote P9-compatibiliteitsmigraties, context-RPC/grants/schema-cache en categoriezaad zijn toegepast op `wnpfloqpjvaacobppbpk`; types zijn opnieuw gegenereerd.

Live P10-bewijs: HR Admin draaide `/api/process-automation/jobs/run` met `claimed=1`, `succeeded=1`, `retried=0`, `errors=[]`. Remote zijn workflowjob `SUCCEEDED`, process output `AVAILABLE`, `employee_documents` `PROCESS_OUTPUT`/PDF en het storage-object aantoonbaar aanwezig. Work-detail toont het outputdocument, een downloadlink en `PROCESS_DOCUMENT_OUTPUT / SUCCEEDED`. Het algemene medewerkerdossier toont de PDF voor een HR-admin zonder employee-record nog niet: de bestaande audience is alleen de process-subject employee. Een uitbreiding naar actieve `TENANT_ADMIN`-audiences is als security-sensitive optie beschreven maar niet toegepast zonder expliciete doelgroepgoedkeuring.

De drie-rol-browsercontrole op poort 3000 is opnieuw uitgevoerd: HR Admin 20 afdelingsstarts/51 organogramstarts plus employment-work en outputdownload; Test Medewerker echte Workflows-kaart, medewerker-Processen-tab en employment-processen; Test Manager 0 afdelingsstarts. De actuele remote dataset had geen `BLOCKED`-workitem, dus de niet-lege startpagina-blockerprojectie blijft als open fixturebewijs gemarkeerd.

Lokale eindgate: volledige hr-suite 147 bestanden/559 tests, gerichte output/worker-tests 7/7, strict TypeScript, i18n-pariteit, volledige ESLint, `git diff --check` en Webpack-productiebuild met 187 pagina's zijn groen. Supabase security- en performance-advisors zijn opnieuw uitgevoerd; bestaande baseline-meldingen zijn niet aan deze slice toegeschreven.

## P8 — proces- en formulierstudio 2026-08-09

P8 is geïmplementeerd in de feature-worktree en lokaal samengevoegd naar `main` in mergecommit `2ff60c5`. `main` is nu de gecombineerde lokale testbasis; er is niets naar GitHub gepusht of gedeployed en er is geen down-scenario uitgevoerd. Alleen synthetische testdata en de drie bestaande interne testaccounts zijn gebruikt.

Actuele lokale runtimecontrole: de `main`-devserver draait vanuit `apps/hr-suite` op poort 3000 (actueel PID 39284); `/login`, `/employees` en `/settings/process-automation` geven HTTP 200. De gemelde authenticated `/employees`-runtime-overlay viel samen met remote Supabase HTTP 504-responses op `user_access`, `user_hr_group_access` en `user_preferences`. Het project staat momenteel `ACTIVE_HEALTHY`; na lokale serverherstart is geen nieuwe serverfout geproduceerd. Dit is als externe/transiënte backendstoring geregistreerd, niet als bewezen codefailure; een browser-reload blijft de eerstvolgende gebruikerscontrole.

Aanvullende diagnose: read-only `pg_stat_activity` liet tijdelijk elf gelijktijdige `save_process_definition_draft`-requests zien, waarvan meerdere op dezelfde draft-lock wachtten. De lokale Next-processen zijn gecontroleerd gestopt en er draait nu opnieuw één schone `main`-devserver op poort 3000. Er is geen remote data verwijderd of teruggedraaid. De oorspronkelijke pooluitputting wordt daarom geregistreerd als overlappende studio-save-testaanvragen; de UI-stopguard blijft open als authenticated browserbewijs.

Incident na login: een afgebroken transactionele P8-save hield een tuple-lock op `process_definitions` vast; acht actieve save-sessies wachtten daarop en veroorzaakten `PGRST003` in het dashboard. Alleen deze vastgelopen authenticated test-sessies zijn beëindigd; er is geen rij verwijderd, geen migratie teruggedraaid en geen down-scenario uitgevoerd. Nacontrole is groen: nul wachtende definition-locks en nul afgebroken transacties. De gebruiker moet de bestaande tab reloaden en opnieuw inloggen; open geen tweede studio-tab totdat de revision-conflict/stop-retrybrowserproef opnieuw wordt uitgevoerd.

De slice is in de vereiste volgorde gebouwd: schema -> API -> UI. Schema/RLS/grants staan in de drie P8-migraties; API-routes leveren catalogus/detail, draft autosave met expected revision, clone, publish, retire en no-write trial; de UI levert list-first Procesen/Formulieren, toegankelijke staplijst/canvas, form fields/secties/properties, participant access, compilerfeedback, preview, diff, publish-confirmatie/changelog, read-only published state en clone/archive. `packages/db/types.ts` is opnieuw gegenereerd en NL/EN-pariteit is groen.

### Bewijs

- Remote: de zes P8-tabellen hebben RLS aan en exact één policy. Publieke RPC-wrappers zijn invoker-only met authenticated execute; interne mutatiekernfuncties zijn security-definer met authenticated execute en anon geweigerd. De P8-migraties zijn geregistreerd.
- Remote synthetic state: `internal-transfer-mslq73xj` is `PUBLISHED` met één version; `internal-transfer-mslq73xj-copy-mslqd4ax` is `DRAFT` zonder published version. De revision guard leverde `PROCESS_DEFINITION_DRAFT_CONFLICT` in de remote stale-concurrencyproef.
- Advisors: security 22 totaal, 0 P8-specifieke securitywaarschuwingen; performance 383 totaal, uitsluitend INFO’s over ongebruikte indexen op de kleine testtabellen.
- Lokaal: 143 Vitest-bestanden/539 tests, gerichte compiler/resolver 19/19, strict typecheck, gerichte ESLint (`--max-warnings=0`), i18n 29 namespaces, `git diff --check` en Webpack-build met 181 statische pagina’s geslaagd.
- Authenticated localhost-browser: HR-admin catalogus, draft, autosave/revisie, trial zonder runtime-writes, publish versie 1/read-only en clone zijn doorlopen; trialpad/SLA/output/blockers waren zichtbaar en de console was leeg.
- Main-herverificatie na mergecommit `2ff60c5`: 143/539 tests, `type-check`, `check:i18n`, volledige ESLint en Webpack-build met 181 pagina’s groen; lokaal geven `/login` en `/settings/process-automation` HTTP 200. De laatste Codex in-app authenticated smokecheck bleef hangen tijdens navigatie.

### Open en geblokkeerd

- Open: een schone twee-tab authenticated browserherhaling die de zichtbare revision-conflictmelding én het stoppen van autosave-retries bewijst. De serverrespons is remote bewezen; de laatste Codex in-app browserherhaling bleef tijdens login/navigatie hangen.
- Open: volledige live herhaling van field/preview/accessmatrix, een volledig succesvolle resolverfixture en de formele P9-controles (keyboard/axe, cross-role deny, scheduler/restart, HTML/PDF-inhoud en cross-role download).
- Geblokkeerd: de standaard Turbopack-productiebuild op deze worktree door de externe `node_modules`-symlink/junction. De Webpack-productiebuild slaagt; er is geen inhoudelijke P8-buildfailure vastgesteld.

De P8-status is daarom bewezen maar niet als 100%-gate gesloten. De uitvoering stopt vóór P9.

### Handmatig testplan na P9

1. Gebruik `hradmin.fixture@liquidhr.test`, `manager.fixture@liquidhr.test` en `employee.fixture@liquidhr.test` met de behouden synthetische P8-clone. Open dezelfde draft in twee HR-admin-tabs, schrijf tab A, submit stale tab B en controleer gelokaliseerde conflictfeedback, geen retry-loop en reload.
2. Test één ongeldige draft voor exacte compiler-code/pad/boodschap; herstel de draft. Controleer preview op participant/stap/NL/EN/desktop/390px, participant access en keyboard/focus.
3. Vul een synthetische employee/manager-resolverfixture aan en controleer zowel success als blockers. Vergelijk database-tellingen vóór/na: trial mag geen runtime instance, work item, event of output maken.
4. Controleer publish changelog, immutable read-only, diff, clone, archive/retire en impact. Herhaal route/API-deny voor manager en employee en voer daarna de P9 keyboard/axe-, scheduler/restart- en HTML/PDF/cross-role-downloadcontroles uit.

## Historische P4/P5/P6/P7-verificatie vóór P8 2026-08-09

Dit historische blok beschrijft de gecontroleerde P4/P5/P6/P7-basis vóór de P8-slice. De gecombineerde gate van die eerdere fasen bleef onder 100%.

## Canonieke lokale voortzettingsbasis voor P9 2026-08-09

De samengevoegde lokale versie staat als actieve voortzettingsbasis in `C:\Users\Edwin\Documents\Apps\LiquidHR`, branch `main`, mergecommit `2ff60c5`. De feature-worktree blijft behouden als checkpoint `c33e799`. Er is niets naar GitHub gepusht of gedeployed.

Schema/API/UI-fixes: additive P5-scope-RPC-hardening op Supabase; database-UUID-validatie in de work-projecties; en een process-output-downloadpad dat na context-autorisatie exact het geautoriseerde document via de admin storage-client signeert. De laatste gerichte tests zijn groen: 3 bestanden, 8/8 tests. Strict typecheck is groen. Repo-lint blijft geblokkeerd vóór inhoudelijke linting door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit.

Remote SQL: P5 participant access en P6/P7 contracttest geslaagd zonder fout. De tijdelijke, geautoriseerde fixture `p4-p7-live-gate` bewees een niet-lege queue, vier P5-rollen, role projections, claim/action, één winnaar bij concurrency, negatieve HTTP-403, retry/backoff/dead-letter/requeue, reminder-idempotency en output/download. Authenticated browser op localhost:3000 bewees de vier P5-DOM-projecties, manager- en employee-flows, P6 action, keyboard/autosave, lege console en HR-admin/employee output-download. Supabase advisors: security 22 (1 INFO/21 WARN), performance 383 INFO; geen P4/P5/P6/P7-securitytarget.

Cleanup is aantoonbaar groen: exacte fixture-rows in form/process/runtime/audit en het storage-object zijn allemaal 0. De bestaande drie interne testaccounts zijn niet verwijderd; cleanup raakte alleen de synthetische fixturedata. Er is geen down-migratiescenario uitgevoerd.

Open voor fase 9: HR-admin zonder employee-context heeft een UI-affordance voor claim/action terwijl de server correct 403 geeft; expliciete candidate-before-claim negatieve action; volledige keyboard/focus- en axe-eindcontrole; persistente scheduler-fallback/restart; en inhoudelijke HTML/PDF-bestandscontrole plus cross-role downloaddeny. Zie het handmatige testplan in `CURRENT_CONTEXT.md`.

## Actuele P4/P5/P6/P7-gate 2026-08-08: Process Automation runtime, werk en automation

Deze voortzetting voert uitsluitend P6 en P7 uit op featurebranch `codex/process-automation-p4-p5`. P8, product-AI, visual builder, commit, push, merge en deployment zijn niet uitgevoerd. De actuele P4/P5-handoff is opnieuw gecontroleerd: P4 is functioneel bewezen en P5 houdt participant-DOM/network-bewijs open; P6/P7 hadden geen niet-lege remote fixtures.

P6 levert `/work` als lijst-eerst werkruimte met zoeken, URL-state, tabs, filters, sortering, veilige kleine projecties, detail met subject/opdracht/formulier/current-new, voortgang, tijdlijn, actiebalk, assignmentuitleg en concurrencyfeedback. Sidebar, `/dashboard/start` en de medewerkerdetail-Processen-tab zijn aangesloten; NL/EN-sleutels zijn gelijk.

P7 levert de gedeelde `workflow_jobs`-queue, claim/finish/requeue met locking, retry/backoff/dead-letter, deadlineprojectie naar bestaande reminders, in-app aandacht, HTML/PDF-dossieroutput, downloadcontext, output-permissions en operatorrequeue. Immediate drain en de authenticated schedulerfallback bestaan; een persistente schedulerconfiguratie is niet toegevoegd. Er is geen externe AI of mailprovider toegevoegd.

Lokale migraties voor P6/P7 staan in `apps/hr-suite/supabase/migrations/20260808170000_process_automation_p6_work_projection.sql` tot en met `20260808171200_process_automation_p6_p7_wrapper_execution.sql`; de relevante P6/P7-files zijn schema, API, UI, role-permissions, output-download en advisor/runtime hardening. `packages/db/types.ts` is opnieuw gegenereerd.

Remote bewijs: P6/P7-contracttest `[]`; `workflow_jobs`, `process_outputs` en `process_reminder_deliveries` hebben RLS, elk exact één policy en geen directe `anon`/`authenticated`-tabelrechten. De 14 interne security-definerhelpers en 14 publieke invoker-wrappers hebben authenticated execute en anon geweigerd. De tenant-specifieke HR/TENANT-adminrollen hebben de benodigde Process Automation-permissions. Advisors tonen geen P6/P7-specifieke securitywaarschuwing; projectbaseline en unused-index-INFO's op lege proces-tabellen blijven apart.

Lokale gate: gerichte P6/P7-tests 3 bestanden/8 tests, volledige hr-suite 140 bestanden/527 tests, strict typecheck, i18n 29 namespaces, gerichte ESLint en Webpack-productiebuild met 179 pagina's zijn groen. De volledige lintopdracht blijft geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit; de standaard Turbopack-build blijft geblokkeerd door de externe `node_modules`-junction, terwijl Webpack slaagt. Browserbewijs voor HR-admin, manager en medewerker op `/work` is groen in de lege-state; desktop 1280px en 390×844 mobiel hebben geen overflow.

Open: P5 participant-DOM/network, P6 queuekandidaat en niet-lege claim/action-rolflows, volledige keyboard/focus- en gerichte axe-controle, P7 live dubbele runner/crash-retry/dead-letter/verlopen-job/output/reminder/download en persistente scheduler-operatie. De gecombineerde P4/P5/P6/P7-gate is niet 100%; uitvoering stopt vóór P8.

## Historische P4/P5-gate 2026-08-08: Process Automation runtime en formulieren

Deze slice voert uitsluitend P4 en P5 uit in featurebranch `codex/process-automation-p4-p5`; P6, product-AI, visual builder, commit, push, merge en deployment zijn niet uitgevoerd. De P2/P3-handoff is opnieuw remote gecontroleerd: de twee tijdelijke concurrency-fixtures zijn weg en runtime-/form-/event-/audit-testtabellen zijn leeg.

P4 is gebouwd als transactionele runtime-kernel: start en work-item actions gebruiken locks, expected versions, idempotency en correlation; conditions worden allowlisted geevalueerd; assignment, terminal outcomes, request changes, cancel en parallel `ALL` zijn atomaire paden. Events zijn append-only en runtime-mutaties schrijven gesaneerde CRUD-audit zonder formwaarden. P5 voegt form definitions/versions, current/new response revisions, expected-version autosave, server-side access/visibility/hidden projection, typed values, shared Zod-payloads, NL/EN en een toegankelijke `/process-runtime/[workItemId]`-renderer toe. `DOCUMENT_REFERENCE` verwijst uitsluitend naar een niet-verwijderde, tenantgescopeerde `employee_documents`-record waarvoor het bestaande `document:read`-domeinrecht en `document_audiences` gelden.

Remote controles zijn groen voor schema, RLS, grants, audit en types: alle zes runtime/form-tabellen en `audit_logs` hebben RLS; form response-tabellen hebben geen authenticated tabelgrants; public wrappers zijn invoker-only/authenticated-only; interne kernels zijn definer/authenticated-only en anon is geweigerd. Zes runtime-audittriggers zijn actief, de bestaande auditactiecheck blijft canoniek, en `packages/db/types.ts` is opnieuw gegenereerd. Supabase security advisor bleef projectbaseline (22 meldingen, 1 INFO/21 WARN) zonder P4/P5-target; performance had geen P4/P5-FK-indexmelding.

Remote SQL-tests zijn opnieuw geslaagd voor contract, start/materialisatie, duplicate submit/start, stale/forbidden, request changes/reject/cancel, half-failure rollback, parallel `ALL` en vier participant access projections. De participant-test dekt requester/manager/HR/observer exact af, inclusief hidden/conditional fields, NL/EN labels en documentreferentievalidatie tegen het bestaande documentdomein. Alle fixtures rolden terug.

Lokale gate: 137 testbestanden/519 tests, strict typecheck, i18n 29 namespaces, gerichte ESLint en Webpack-productiebuild met 176 pagina's zijn groen. Repo-brede ESLint faalt vóór deze slice op de bestaande ESLint 10/`eslint-plugin-react`-compatibiliteit; de standaard Turbopack-build faalt vóór compilatie op de externe `node_modules`-junction van de feature-worktree. De Webpack-build is de geslaagde productiebuild. Authenticated browsercontrole laadde `/dashboard/start`; de 390x844 runtime-route zonder blijvende fixture gaf correct 404. De expliciete vier-participant DOM/network-browsergate blijft open omdat geen persistente fixture is achtergelaten.

Gatebesluit: P4 is volledig bewezen; P5 is schema/API/UI/code- en remote-testmatig uitgevoerd, maar de expliciete participant-DOM/network-browserverificatie ontbreekt. De gecombineerde P4/P5-gate is dus niet 100% bereikt. Stop vóór P6.

## Historische P2/P3-gate 2026-08-08: Process Automation datamodel en work-item kernel

P1, P2 en P3 zijn lokaal en remote doorgetrokken. P2 levert de scopevaste proces-/formulierdefinities, immutable published versions, runtime instances/steps/workitems/events, typed subjectlinks, pinned process versions, RLS, canonical permissions, authenticated-SELECT-only grants en FK-indexen. P3 levert de assignment resolver met business date policies, `EXACTLY_ONE`/`ANY_ONE`/`ALL`, eligibility/scope/self-assignment/deputyregels, evidence-materialisatie en atomaire claim/release/reassign/re-resolve-RPC's met optimistic locking en audit-events. De server-adapters staan in `apps/hr-suite/app/api/process-work-items/[workItemId]/`; er is bewust geen runtime-transition-engine of user-facing studio/runtime-UI gebouwd.

Remote toegepaste migraties: `20260808122825_process_automation_p2_foundation`, `20260808124007_process_automation_p3_workitem_kernel`, `20260808125031_process_automation_p2_grant_hardening`, `20260808125355_process_automation_p3_rpc_contract` en de additive FK-indexmigratie. Remote contractverificatie is groen: RLS/policies, typed constraints, immutable/append-only triggers, SELECT-only grants, optimistic locking, audit-events, directe mutatieblokkade en de echte twee-sessie `ANY_ONE`-claim met één winnaar.

Verse lokale verificatie: gerichte Process Automation-tests 3 bestanden/20 tests, volledige hr-suite 137 bestanden/514 tests, strict TypeScript, ESLint, i18n-pariteit (28 namespaces), productiebuild (175 pagina's) en `git diff --check` zijn groen. Supabase security-advisor toont geen nieuwe P2/P3-waarschuwing; performance toont alleen INFO's, waaronder unused-indexmeldingen omdat de nieuwe tabellen leeg zijn. Er is geen productseed, P4-transition-engine, UI/browserflow, commit, push of deployment uitgevoerd.

De definitieve P2/P3-handoff is 100% afgerond. De twee-sessie remote test gebruikte uitsluitend tijdelijke fixturekeys `p3-concurrency-contract` en `p3-concurrency-contract-2`; na expliciete bevestiging zijn deze in één gecontroleerde cleanup-transactie verwijderd. De nul-rijencontrole van definities, drafts, versions, instances, subjectlinks, steps, workitems, candidates en events is groen; de drie immutable/append-only-triggers staan weer actief. P4 en P5 zijn nog niet gestart. Er is geen commit, push, merge of deployment uitgevoerd.

## Historische P1-gate 2026-08-08: Process Automation definitiecompiler

De zin "P4 en P5 zijn nog niet gestart" in de historische P2/P3-handoff hierboven beschreef de status vóór deze branch. Lees voor de actuele status de P4/P5-sectie bovenaan.

Dit was de pure strict-TypeScript-startfase; de actuele P2/P3-status staat hierboven.

## Release 2026-08-07: productversie 1.20260807.2

De zichtbare productversie is verhoogd naar `1.20260807.2`; de versie-unit-test is bijgewerkt. De releasegate is lokaal groen: 132 testbestanden/490 tests, strict TypeScript, ESLint, i18n-pariteit en productiebuild met 175 pagina's. Commit `98ac2ebc3c8c0b15dd73f373ea4f0889cf14d0a3` staat op `main` en is naar GitHub gepusht.

## Actuele slice 2026-08-07: medewerker-aanmaakwizard

Aanvulling 2026-08-08: de resterende adres-409 bleek een tweede RLS-scopefout. Een bestaand PRIMARY-adres werd vóór organisatieplaatsing niet gelezen, waardoor de herintredingsflow een dubbele POST deed. `20260808133244_allow_hr_preplacement_subresource_access` is remote toegepast; de gerichte remote controle ziet het bestaande adres weer. Ook de activiteitenfeed gebruikt nu dezelfde geldige HR-groepsscope vóór plaatsing.

Aanvulling 2026-08-08: de terugkerende 409 bleek geen echte concurrencywijziging maar een RLS-policy die een nieuwe medewerker zonder organisatieplaatsing niet liet wijzigen. `20260808144955_allow_hr_group_employee_update_before_placement` is remote toegepast; de transactionele regressietest is groen en de tijdelijke fixture is teruggedraaid. De Controle-onderbalk blijft nu vast in beeld terwijl het middenstuk scrolt.

Aanvulling 2026-08-08: de dienstverbandopties worden cachevrij opgehaald. Bij een `EMPLOYEE_CONCURRENCY_CONFLICT` ververst de wizard de snapshot en herhaalt alleen wanneer de relevante persoonsgegevens ongewijzigd zijn; als de actuele waarden al overeenkomen met de invoer, gaat de wizard direct verder. Gerichte tests, strict TypeScript en lint zijn groen; er is geen schemawijziging.

Aanvulling 2026-08-08: de nieuwe medewerkerwizard accepteert voor geboortedatum alleen een leeftijd van 10 tot en met 90 jaar. De administratie-voorwaardestap voorkomt dubbele medewerker-PATCHes met dezelfde concurrency-token via een synchrone opslagguard. Leeftijds-/wizardtests, strict TypeScript, i18n en gerichte ESLint zijn groen; er is geen schemawijziging.

Aanvulling 2026-08-08: de validatie van de dienstverbandwizard is gecentraliseerd. De administratie-/voorwaardestap controleert nu lokaal alle verplichte velden vóór de medewerker-PATCH. Dezelfde verplichte-veldenmelding geldt voor alle dienstverbandtabs en voor 400-validatiefouten bij opslaan. De gerichte validatietest staat in `components/employment/employment-wizard-validation.test.ts`; er is geen schemawijziging.

De vervolgactie voor **medewerker + dienstverband** blijft in dezelfde wizard. Bij meerdere administraties begint de dienstverbandflow met een expliciete, zoekbare administratiekeuze en uitklapbare details. Het medewerkertype staat op dienstverbandniveau met zes keuzes; `employment_contracts.worker_type` blijft alleen technische compatibiliteit. Na het dienstverband kiest de gebruiker loon-/contractgegevens toevoegen of overslaan. Bij toevoegen komen contract, rooster, salaris, organisatie en kosten als dynamische stappen in de linker navigatie. De administratie-instelling ondersteunt maand en 4 weken als multi-select; de wizard toont één frequentie automatisch of laat bij twee frequenties kiezen. Salarisschaal + trede toont het bijbehorende bedrag; functiegroep → functie → afdeling → leidinggevende en gesplitste kostenallocatie zijn aangesloten. Nationaliteit en land zijn zoekbare landkeuzes; startdatum en ancienniteitsdatum staan op de eerste dienstverbandstap. Het medewerker-/personeelsnummer blijft medewerker-niveau, het dienstverbandnummer staat op employment-niveau. De wizard geeft nummergebruik en live uniekheid terug, toont BSN als optioneel met uitleg en voorkomt dubbele medewerker-PATCHes vanuit de dienstverband-prerequisites.

De remote migraties `20260807185718_allow_hr_address_creation_before_placement`, `20260807185727_allow_employee_administration_assignment_for_employment_creation` en `20260807185745_expand_employment_types_and_wizard_flow` zijn toegepast. De employment-enum, RLS-policies en `publish_complete_employment` zijn read-only gecontroleerd; de officiële database-types zijn opnieuw gegenereerd. Security-advisor staat op 1 INFO / 21 WARN en performance op 344 INFO, zonder nieuwe melding voor deze slice. Vercel Production-deployment `dpl_66LXmSsJavEWFj34CFZqnjPfCKVy` staat op `READY` en is exact op deze commit gebouwd; `/login` geeft HTTP 200. De runtime-error- en error/fatal-logscans over het afgelopen uur zijn leeg. Geauthentiseerde browsercontrole van de wizard blijft open. Lokaal zijn i18n, 132/490 tests, strict TypeScript, ESLint, productiebuild met 175 pagina's en `git diff --check` groen.

De wizard is uitgebreid met partnernaam, extra velden van de medewerkerentiteit, required/optional-markering, adresopslag met interne `valid_from = 1900-01-01` en een controlepagina met afzonderlijke acties voor medewerker aanmaken en medewerker plus dienstverband aanmaken. Na een geslaagde creatie verlaat de flow de wizard via de persoonskaart of het nieuwe dienstverband.

De kerngegevens-tab toont het personeelsnummer op een eigen rij, daarna roepnaam en tussenvoegsel. Het naamvoorbeeld toont alleen de volledige opgebouwde naam; partnernaam gebruikt nu ook het afzonderlijke partner-tussenvoegsel.

Validatiefouten tonen een gerichte samenvatting in plaats van de algemene foutmelding. De wizard toont tussen de navigatieknoppen alleen een subtiele **Meer gegevens**-indicator wanneer er onder de huidige positie nog scrollinhoud staat. Extra gegevens gebruikt de optionele inklapsectie en toont **Vrije velden** alleen wanneer actieve medewerkerdefinities voor de HR-groep aanwezig zijn.

De migratie `20260807185718_allow_hr_address_creation_before_placement` laat HR het adres opslaan vóór een organisatieplaatsing of dienstverband en voorkomt daarmee de bestaande 403-situatie in deze wizard. Status: remote toegepast en read-only gecontroleerd; er is geen medewerker/testrecord aangemaakt. Lokale verificatie is groen voor 132 testbestanden/490 tests, strict TypeScript, ESLint, i18n en productiebuild.

## Actuele slice 2026-08-07: CAO-/bedrijfsregelingentijdlijn

De bestaande regelingencatalogus is uitgebreid naar een echte opvolgende tijdlijn. Iedere `labor_condition_sets`-versie heeft een verplichte `valid_from` en optionele `predecessor_id`; een opvolger moet na de vorige versie starten, er kan maar één directe opvolger zijn en de database-trigger voorkomt cycli en ongeldige terugdatering. `create_labor_condition_successor` maakt de opvolger en zet de vorige versie inactief in één databasebewerking. De route `/settings/employment-contracts` gebruikt een nieuw lijst-eerst tijdlijnscherm onder `CAO / arbeidsvoorwaarden` met zoeken, regeling toevoegen, versie wijzigen en opvolger toevoegen.

Remote migratie `20260807145526_add_labor_condition_timeline` is toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; de vier bestaande regelingen zijn als roots behouden. Gecontroleerd: kolommen, trigger, authenticated RPC-recht, tijdlijnmodeltests, i18n, strict TypeScript en gerichte linting. Geen commit, push, merge of deployment uitgevoerd.

## Actuele slice 2026-08-07: fulltime-referentie voor verlof en dienstverband

De fulltime-norm komt nu uit de op het dienstverband geldende CAO/bedrijfseigen regeling (`standard_hours_per_week`) en wordt als historische snapshot op het contract en ieder rooster opgeslagen in `fulltime_hours_per_week`. De factor voor verlof en FTE-limieten is `min(contracturen, fulltime-norm) / fulltime-norm`, met een maximum van 1. De database-trigger, verlofservices, pure engine, aanvraaglimiet, rapportage, dienstverbandwizard en contract-/roostermutaties gebruiken dezelfde regel. De remote migrations `20260807141014_use_labor_condition_fulltime_reference` en `20260807162539_add_employment_contract_fulltime_reference` zijn toegepast; bestaande contracten en roosters zijn gecontroleerd en er zijn geen ontbrekende snapshots of formulemismatches. De salarisweergave blijft de bestaande verhouding voor contracturen gebruiken; de fulltime-cap is specifiek voor verlof/FTE.

Lokale verificatie: 131 testbestanden/488 tests, strict TypeScript, i18n-pariteit en productiebuild geslaagd. Supabase advisors zijn opnieuw uitgevoerd; alleen bestaande projectbrede security/performance-meldingen blijven staan. Deze featurebranch is niet gecommit, gepusht of gedeployed.

## Correctie 2026-08-07: uitzonderingen, samenvatting en verplichte naam

De uitzondering-editor toont geen vervaltermijn wanneer geen verlofopbouw wordt toegepast en bewaart dan geen expiry-waarde. De samenvattingen gebruiken leesbare zinnen en tonen werkurentypen alleen voor `WORKED_HOURS`. Naam is verplicht; dubbele verloftypenamen binnen dezelfde HR-groep worden vooraf gemeld en aanvullend door de unieke index `leave_types_tenant_hr_group_name_unique` beschermd. Remote migratie `20260807134827_leave_type_name_uniqueness` is toegepast; er zijn geen dubbele genormaliseerde testnamen.

## Actuele slice 2026-08-07: verlofopbouwinrichting

De HR-admininrichting voor verloftypen is opnieuw opgebouwd rond vijf expliciete keuzes: `UNLIMITED`, `ACCRUAL`, `ANNUAL_HOURS_CAP`, `ANNUAL_HOURS_FTE_CAP` en `OVERTIME_HOURS`. Bestaande catalogusrijen openen nu via de volledige klikbare rij, met handcursor en toetsenbordbediening, en bestaande verloftypen kunnen worden gewijzigd. De oude `Soort verlof`- en profielkeuze zijn verwijderd. De opbouweditor toont `Contracturen` of `Werkuren`; bij werkuren staat de multi-selectie direct onder `Type`. Periodes ondersteunen verloningsperiode of specifiek 4-wekelijks, maandelijks en jaarlijks. Bestaande opbouwregelkaarten zijn volledig klikbaar en direct wijzigbaar; een nieuwe regel neemt de laatste waarden over, ondersteunt annuleren en toont de vervaltermijn met de eenheid `Maanden`.

Remote zijn op Supabase-project `wnpfloqpjvaacobppbpk` de lokale migraties `20260807100345_leave_accrual_enum_options`, `20260807100842_redesign_leave_accrual_configuration`, `20260807103107_apply_leave_fte_cap_to_requests`, `20260807104155_optimize_leave_type_overtime_indexes` en `20260807130219_update_leave_accrual_rule` toegepast; de laatste staat remote geregistreerd als `20260807130439_update_leave_accrual_rule`. De nieuwe `leave_type_overtime_work_hours`-tabel heeft RLS, policies, grants, audit en samengestelde foreign keys; de update-RPC voor directe wijziging is permission- en scopegevalideerd. De FTE-cap wordt in preview en bevestiging server-side met de geldige parttimefactor berekend; de oude weekfactor-testregels zijn naar de deeltijdfactor-keuze gerepareerd en er zijn geen actieve legacy-rijen meer. `packages/db/types.ts` is opnieuw gegenereerd.

Verificatie: i18n-pariteit, strict TypeScript, 130 testbestanden/482 tests, volledige ESLint en productiebuild zijn geslaagd. De geauthentiseerde browsercontrole bevestigde de klikbare regelkaart met `cursor: pointer`, directe wijziging van een bestaande regel, kopiëren van de laatste waarden bij toevoegen, annuleren, de eenheid `Maanden` en 0 browserfouten of waarschuwingen. Supabase security-advisor toont geen RLS-melding voor de nieuwe koppeltabel; de SECURITY DEFINER-melding voor de expliciet geautoriseerde update-RPC valt binnen het bestaande RPC-patroon. De performance-advisor toont alleen bestaande databaseadviezen.

Open: de volledige toekomstige opbouwprojectie en overuren-afgeleide opbouwberekening blijven afzonderlijke engine-scope. Deze branch is niet gecommit, gepusht of gedeployed.

## Correctie 2026-08-07: werkuren- en overureninrichting

Werkuren en overuren kunnen nu worden gewijzigd inclusief naam en kleur. De naam is verplicht en uniek binnen de HR-groep, hoofdletter- en spatieongevoelig; de database-index beschermt ook gelijktijdige mutaties. Het oude veld `Werkurentype` is verwijderd. Beide typen gebruiken dezelfde vier beperkingen: onbeperkt, maximum per jaar, maximum per maand en maximum per week op basis van contracturen maal factor.

Op Basisinformatie staan voor beide typen de ja/nee-instellingen voor goedkeuring van invoer, manager informeren, actief en selfservice. Opslaan staat vóór Archiveren; archiveren opent een ja/nee-bevestiging. De schermtitel is `Uren opbouw/schrijven` en de tab heet `Verlofopbouw`. Remote migratie `20260807151500_work_hour_configuration_controls` is toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; `requires_manager_approval` en de unieke werkurentype-index zijn gecontroleerd, en de officiële DB-types zijn bijgewerkt.

## Historische update 2026-08-05: productversie gecorrigeerd

De zichtbare productversie volgt de gedocumenteerde bron `apps/hr-suite/lib/app-version.ts` en de conventie `X.datum.volgnummer`. De vorige productversie was `1.20260805.1`. De npm-packageversie blijft `0.1.2`, omdat die niet de zichtbare productrelease bepaalt.

## Actuele release 2026-08-06: versie 1.20260806.2 en remote scopecorrectie

De productversie is verhoogd naar `1.20260806.2`. Remote zijn de groepsbrede configuratiemigraties `20260806174202_hr_group_wide_configuration_scope`, `20260806174221_grant_hr_group_permissions_to_hr_admin` en `20260806174857_harden_hr_group_configuration_policies` toegepast. De remote data- en RLS-controle is groen; alle betrokken configuratieregels hebben een HR-groep, de nieuwe group-scoped functies bestaan en er zijn geen groepsbrede duplicaten.

De officiële Supabase-types zijn opnieuw gegenereerd. Advisors: security `1 INFO / 19 WARN` als bestaande projectbaseline; performance `348 INFO / 0 WARN` na het splitsen van permissive write-policies en toevoegen van FK-indexes. Lokale releasegate: 130/130 testbestanden, 481/481 tests, strict TypeScript, lint, 28 gelijke NL/EN-namespaces, productiebuild met 173 pagina's en `git diff --check`. Authenticated browsercontrole is groen met `Planeten`, administratiekaarten Mars/Jupiter/Mercurius, geen administratie-dropdown in de sidebar, zichtbare versie `1.20260806.2` en 0 console errors/warnings. GitHub bevat implementatiecommit `b6c5fc5f6ec9d9df79f465ba3f8cc2e2cfebbf8d`. Vercel Production-deployment `dpl_3LTk81cA8YdtGiRL27VQRWum1ADJ` (`liquidhr-p6m6ngtkm-edwinitsolutions.vercel.app`) staat op `READY` en is exact op die commit gebouwd. Runtime errors en error/fatal logs zijn niet gevonden.

## Actuele performance-optimalisatie gepubliceerd naar main/Production 2026-08-07: startpagina en medewerkerslijst

`main` (commit `f600375b3c5bc24a7d01d852717531be2b8fa8dc`) optimaliseert de request-keten van `/dashboard/start` en `/employees`. Een request-scoped autorisatiecontext deelt nu claims, actieve context en Supabase-client tussen layout, pagina en onderliggende services. Onafhankelijke reads lopen parallel. De startpagina telt medewerkers via twee smalle parallelle queries; de medewerkerslijst deelt de directe teamscope-query met de employee-overview-read. Directory- en voorkeurservices kunnen de bestaande context/client hergebruiken. Hierdoor wordt vooral dubbele setup en waterfall-latency verminderd.

Er is geen databasewijziging nodig gebleken: relevante employee/employment-indexen zijn aanwezig en de live `list_employee_overviews`-RPC is niet de dominante bottleneck. De live performance-advisorcontrole gaf 347 INFO en 0 WARN; dit is een read-only controle, zonder remote DDL. Lokaal zijn 130/130 testbestanden, 481/481 tests, strict TypeScript, lint, 28 NL/EN-namespaces en de productiebuild met 173 pagina's groen. De code staat op GitHub `main`; Vercel Production `dpl_8pp1LgQBtgqJiMNeA1kwtS7VQ17M` is `READY` en heeft de main-commit exact gebouwd.

De authenticated after-change meting in Chrome op main/Production gebruikte drie runs per route. HR Admin: `/dashboard/start` `1312/1207/922` (mediaan 1207 ms), medewerkerdashboard `/employees/[employeeId]` `1037/994/985` (994 ms) en `/employees` `908/868/762` (868 ms). Manager: `/dashboard/start` `3474/1128/1295` (1295 ms) en `/employees` `995/752/1109` (995 ms). Employee: eigen medewerkerdashboard `1068/1048/1067` (1068 ms) en `/employees` `846/984/879` (879 ms). De Employee-rol landt voor de startpagina in de eigen medewerkercontext en toont daar niet dezelfde startpaginamarker. Chrome-console: 0 errors/0 warnings; alle gemeten routes HTTP 200. De resultaten zijn richtinggevend door cold/warm- en netwerkvariatie.

## Performance implementatie uitgevoerd 2026-08-07: startpagina en medewerkerdashboard

De featurebranch bevat in commit `d7a3727f5acc4fc9d540e191c7d50db83cca47e0` een opt-in server-timinglaag (`?perf=1`) en veilige request-optimalisaties voor `/dashboard/start` en `/employees/[employeeId]`: teamscope en onafhankelijke startpaginareads starten zonder onnodige waterfall, actieve verzuimtelling gebruikt parallelle queries, overzichtsdata op het medewerkerdashboard loopt parallel, dashboarddocumenten zijn beperkt tot een actieve top-3-read en de notitiepermission wordt alleen voor het notitietabblad geladen. De medewerkerslijst is niet functioneel aangepast.

De volledige lokale releasegate blijft groen: 130 testbestanden/481 tests, strict TypeScript, lint, i18n met 28 namespaces, productiebuild met 173 routes en `git diff --check`. Supabase is read-only gecontroleerd; de relevante bestaande indexes zijn aanwezig en performance-advisor staat op 347 INFO/0 WARN. Er is bewust geen database-migratie gemaakt. De code staat op `main`; de eerdere Vercel-preview `dpl_7yQdNXbyww1gh2pkHhnVvJnmzqA6` blijft als tussencontrole geregistreerd.

Chrome-resultaat met drie runs: de actuele main/Production-resultaten staan in de sectie hierboven. De server-traces op deployment `dpl_8pp1LgQBtgqJiMNeA1kwtS7VQ17M` bevestigen HTTP 200 en parallelle datareads na auth/context. Een oude refresh-token errorgroep op `/middleware` hoort bij een eerdere previewdeployment en blokkeert deze main-deployment niet.

## Werkafspraak voor alle Luna-stappen vanaf 2026-08-05

Een Luna-stap is pas afgerond na de volledige verticale slice: schema/Supabase (migratie, RLS, grants, audit en gecontroleerde testdata), API, UI, tests, documentatie en relevante lokale, remote en geauthentiseerde browserverificatie. Open onderdelen of blokkades blokkeren de status **afgerond**; de volgende stap start pas na een expliciete per-spec controle.

## Actuele update 2026-08-06: vijf configuratie-entiteiten naar HR-groep-scope

Bedrijfsinstellingen met kleuren/logo, feestdagen, eindredenen per land, vrije velden en bedrijfsdocumenten zijn in de lokale vertical slice gecorrigeerd van administratie- naar HR-groep-eigendom. `20260806160000_hr_group_wide_configuration_scope.sql` backfillt en verplicht `hr_group_id`, dedupliceert bestaande configuratierecords per groep, vervangt administratiegebonden foreign keys/unieke sleutels en vernieuwt de RLS/policies. De administratiekolom blijft alleen nullable historische provenance. `20260806161000_grant_hr_group_permissions_to_hr_admin.sql` vult HR-adminrechten voor de groepskeuze aan.

Services, routes en de vijf dedicated schermen gebruiken de actieve HR-groep zonder administratiekeuze. De gecombineerde `/master-data`-pagina blijft gemengd: documentcategorieën zijn nog administratiegebonden, terwijl de aparte eindredenenpagina groepsbreed is. De migrations zijn remote toegepast, de officiële types zijn gegenereerd, advisors zijn gecontroleerd en de geauthentiseerde browsercontrole is groen. De release is gepubliceerd in GitHub en Vercel Production.

## Step-9-verificatie afgerond 2026-08-06

Step 9 is **VOLLEDIG UITGEVOERD**. De fixturemigration `20260806101419_hr_group_step9_manager_multiple_employment_fixture.sql` staat remote als `20260806130420_hr_group_step9_manager_multiple_employment_fixture`. De minimale RLS-correctie staat lokaal in `20260806133314_hr_group_absence_employment_read_scope.sql` en `20260806133600_consolidate_employments_absence_read_policy.sql`; remote staan deze als `20260806133414_hr_group_absence_employment_read_scope` en `20260806133633_consolidate_employments_absence_read_policy` geregistreerd.

De geconsolideerde `employments`-selectpolicy leest voor een manager met `absence:write` alleen bevestigde, niet-verwijderde employments binnen de bestaande managerautorisatie. Er is geen brede `contract:read` toegekend en de tijdelijke dubbele-permissieve-policywaarschuwing is opgelost.

Remote contract-/RLS-bewijs is groen. Omar (`DEMO-037`) heeft exact twee actieve employments, exact twee actuele managerplaatsingen onder `DEMO-028` en 0 absence-cases/0 absence-spells. DB-types zijn opnieuw gegenereerd. Advisors blijven op de projectbaseline: security 1 INFO/19 WARN en performance 342 INFO/0 WARN.

De herhaalde lokale gate is groen: 129 testbestanden/478 tests, strict typecheck, lint, 28 gelijke NL/EN-i18n-namespaces, productiebuild met 171 routes en `git diff --check`. Browser: HR Admin ziet Omar tweemaal; Test Manager ziet beide employmentopties, selecteert expliciet één optie en gebruikt de opslagknop niet; de browserconsole eindigt op 0 errors/0 warnings.

De controle tegen de Luna-werkafspraak bevestigt dat stap 1 t/m 9 zijn doorlopen. Alleen de expliciet latere deactivatie-, verwijder-, merge- en splitfase blijft buiten scope. Geen commit, push, merge of deployment uitgevoerd.

## Documentatiebaseline 2026-08-05: HR-groepen en parallel verzuim

De leidende scope voor de volgende implementatieslice staat in [HR_GROEP_SCOPE_EN_INRICHTING.md](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md), [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md), [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md) en het [Luna-uitvoeringsplan](LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md).

Status: **stap 1 t/m 9 functioneel uitgevoerd en per eigen specs gecontroleerd; de integrale eindverificatie en handoff zijn afgerond**.

De nieuwe scope maakt HR-groep de primaire context en zichtbaarheidgrens. Bedrijf, locaties, afdelingen, functies, rollen, verlofregels en verzuiminstellingen zijn HR-groepgebonden. Administratiegegevens, salaris, payroll en CAO blijven administratiegebonden. Verlofsaldo en verzuimcasus blijven dienstverbandgebonden.

De verzuimregel is expliciet gecorrigeerd: overlap tussen verschillende dienstverbanden of HR-groepen is toegestaan. Alleen overlap binnen hetzelfde dienstverband wordt geweigerd. Dit ondersteunt bijvoorbeeld een medewerker die voor het dienstverband als portier hersteld is gemeld en voor het dienstverband als badmeester gelijktijdig ziek is.

De schemafundering staat in `apps/hr-suite/supabase/migrations/20260805144951_hr_group_schema_and_test_data.sql` en de contractproef in `apps/hr-suite/supabase/tests/hr_group_schema.sql`. De context- en Control-Plane-slice staat in `20260805162000_hr_group_context_and_control_plane.sql`; de bedrijf-, administratie- en locatieslice in `20260805180000_hr_group_company_administration_locations.sql`, met privilege- en FK-indexhardening. De remote migrations zijn toegepast op het gekoppelde Supabase-testproject; `packages/db/types.ts` is officieel opnieuw gegenereerd. Er is geen commit, push of deployment uitgevoerd.

De lokale Supabase-reset/lint is geblokkeerd door een niet-actieve Docker Desktop Linux Engine; de lokale pgTAP-runner kan daarom niet worden uitgevoerd. De equivalente remote structurele, RLS- en transactietests zijn geslaagd. De geauthenticeerde browsercontrole bevestigde de HR-groepsswitch, groepsbrede bedrijf/locaties zonder administratiekeuze en administratiebeheer. Stap 5 is per alle eigen specs 100% vastgesteld; Step 6 is daarna volledig uitgevoerd en per alle eigen specs gecontroleerd.

De huidige database bevat uitsluitend synthetische testdata. De eerstvolgende implementatie mag bestaande records zonder productie-compatibiliteitsdoel opnieuw koppelen, aanpassen, vervangen of opnieuw seeden. Luna mag geen fallback, dual-read, dual-write of verborgen legacy-ondersteuning voor het oude tenant-/administratiemodel bouwen. De nieuwe HR-groepimplementatie wordt het enige uitvoermodel.

## Actuele update 2026-08-05: Stap 5 bedrijf, administraties en locaties volledig uitgevoerd

De bedrijf- en locatieslice volgt nu het HR-groepmodel van schema tot browser. `administration_company_data` en `administration_locations` hebben `hr_group_id`, RLS, policies, grants, audittriggers en groepsforeign keys; de legacy `administration_id`-eigenaarskolom is verwijderd. `employee_organizations` heeft een composite locatie-FK met tenant en HR-groep. De service, API en `/settings/company-data` gebruiken de actieve HR-groep en vragen geen administratiekeuze. De route `/api/hr-groups/administrations/[administrationId]` wijzigt alleen naam en nummer; intern ID, tenant, groep en code blijven immutable.

De idempotente testmigraties zijn lokaal aanwezig en remote toegepast: `hr_group_schema_and_test_data`, `hr_group_schema_finalize`, `hr_group_context_and_control_plane`, `hr_group_company_administration_locations`, `hr_group_company_location_privileges`, `hr_group_scope_column_privileges`, `hr_group_admin_role_permissions`, `hr_group_admin_read_permission` en `hr_group_fk_indexes`. De gecontroleerde `TEST-BOUNDARY`-fixture bevat één bedrijf, één administratie (`TEST-BOUNDARY-ADMIN`), één locatie (`Testgroep B locatie`) en nul medewerkers. De bestaande demo-`DEFAULT`-groep heeft één bedrijf, vier locaties, drie administraties en 62 medewerkers.

Remote bewijs: RLS gaf onder beperkte fixturetoegang één `DEFAULT`-bedrijf en vier locaties terug en nul `TEST-BOUNDARY`-bedrijf/locaties; anon heeft geen directe leestabelrechten. De cross-group locatie-RPC is transactioneel geweigerd. Een administratie-nummerwijziging naar `TEST-BOUNDARY-002` behield het interne ID en alle foreign-keyrelaties; de fixture staat terug op `TEST-BOUNDARY-001`. De browser op poort 3000 bevestigde groepwissel, groepsspecifieke locatiecatalogus, bedrijf zonder administratiekeuze en HR-admin-beheer van naam/nummer/stabiel ID; consolecontrole: 0 errors, 1 bestaande warning.

Lokale gate: hr-suite 128 testbestanden/474 tests, i18n-pariteit, strict typecheck, volledige lint en productiebuild geslaagd; Control Plane strict typecheck, lint, i18n en productiebuild geslaagd. Supabase-advisors zijn na DDL opnieuw uitgevoerd: geen nieuwe security- of HR-groep-FK-waarschuwing; bestaande projectbrede meldingen en ongebruikte index-INFO's blijven als baseline geregistreerd. De lokale pgTAP-runner blijft geblokkeerd door Docker Desktop Linux Engine; equivalente remote contract-/transactietests zijn groen.

Stap 5 is voor alle eigen specs **100% gevolgd en vastgesteld**.

## Actuele update 2026-08-05: Stap 6 personen, dienstverbanden, organisatie en rollen

Stap 6 is end-to-end uitgevoerd. De lokale migrations `20260805200000_hr_group_people_organization_roles.sql`, `20260805203000_hr_group_people_rpc_alignment.sql`, `20260805203100_hr_group_complete_employment.sql` en `20260805203200_hr_group_step6_cross_admin_fixture.sql` leggen de HR-groepgrens vast voor personen, afdelingen, functies, roltoewijzingen en organisatieplaatsingen. Employments blijven administratiegebonden maar dragen dezelfde HR-groep; de complete-employment-RPC publiceert alle onderliggende tijdlijnen atomair en weigert een ongeldige kostenverdeling zonder partial writes.

De services en UI gebruiken dezelfde groepscontext. `list_employee_overviews` is group-aware, roltoewijzingen en organogrammen gebruiken groepsafdelingen, en medewerkerkaarten tonen per employment de administratie. De directoryroute weigert een medewerker zonder geldige administratiecontext nu expliciet met `/geen-toegang` in plaats van een runtime-fout; een geldige medewerkercontext blijft ongewijzigd werken.

Remote zijn de Step-6-structurele, RLS-, document-, directory- en complete-employmenttests plus de runner-onafhankelijke `hr_group_step6_contract.sql` geslaagd. De gecontroleerde data bevat `TEST-BOUNDARY` met nul personen, `TEST-MULTIGROUP` met één persoon, dezelfde managerlogin in twee HR-groepen, twee employments voor `DEMO-028` over `OPERATIONS` en `SERVICES`, en twee managers over twee administraties binnen `RICH-02`. Officiële DB-types zijn opnieuw gegenereerd.

De interne browser op poort 3000 bevestigde voor HR Admin de inhoudswissel `DEFAULT` (58 medewerkers), `TEST-MULTIGROUP` (1) en `TEST-BOUNDARY` (0), plus groepsgebonden organogram en roltoewijzingen. De managerflow toonde de eigen teamscope in `DEFAULT` en geen personen in de multigroep zonder eigen teammatch. De medewerkerfixture is in geldige administratiecontext gecontroleerd; de nieuwe negatieve contextcontrole geeft voor een groep zonder eigen administratiecontext een normale toegangweigering.

Lokale verificatie na Step 7: 128 testbestanden/475 tests, strict typecheck, volledige lint, i18n-pariteit met 28 namespaces, productiebuild met 170 pagina's en `git diff --check` zijn groen. Advisors na alle Step-7-DDL: security 1 INFO/19 WARN en performance 340 INFO/0 WARN; er zijn 0 Step-7-specifieke ongeindexeerde foreign keys. De remote pgtap-extensie is versioneerbaar geinstalleerd. De bestaande pgTAP-contracttests zijn rechtstreeks uitgevoerd: 37/37, 23/23 en 35/35; daarnaast zijn de runner-onafhankelijke Step-6/7-contracttests en functionele remote tests groen.

Stap 6 is voor alle eigen specs **100% gevolgd en vastgesteld**. Stap 7 is daarna end-to-end uitgevoerd en voor alle eigen specs **100% gevolgd en vastgesteld**. De algemene Definition of Done blijft alleen open voor stap 8 en 9.

## Actuele update 2026-08-05: Stap 7 verlof per HR-groep en employment

Stap 7 is end-to-end uitgevoerd volgens de verticale-slice-afspraak. De groepscatalogi voor verloftypen, profielen, opbouwregels, bonusregels, voorrang, jaarsturing, employee sets en overwerk zijn HR-groepgebonden. Profielkeuzes, uitzonderingen, buckets, transacties, rollovers, allocaties en aanvragen blijven gekoppeld aan exact één employment; er is geen persoonsbreed verlofsaldo.

De lokale migrations `20260805210000_hr_group_leave_scope.sql` t/m `20260805210800_hr_group_anon_privilege_hardening.sql` zijn remote toegepast. Zij bevatten de groepsforeign keys, RLS/policies, grants, audittriggers, unieke groepssleutels, FK-indexen, resolverfuncties, group-RPC's, testfixture en least-privilege hardening. `packages/db/types.ts` is officieel opnieuw gegenereerd.

De resolver gebruikt de vastgelegde volgorde `employment exception -> employee set -> HR-group default`. De server controleert tenant, HR-groep, medewerker, employment, geldigheidsdatums en dubbele keuzes opnieuw. De group-RPC's voor opbouwregel, bonusregel, opening balance, handmatige correctie, jaarafsluiting en aanvraag zijn permission-checked, atomair en waar relevant idempotent; oude administration-RPC's zijn niet meer uitvoerbaar voor `authenticated`.

De gecontroleerde testdata bevat `TEST-MULTIGROUP` met `Stap 7 testverlof`, een groepsstandaard van 1.5 uur, een employee-setprofiel van 2.5 uur en een setlid. `TEST-BOUNDARY` heeft geen Step-7-catalogusrecords. `DEMO-028` heeft twee employment-buckets voor 2026. Remote zijn de drie pgTAP-contracten (37/37, 23/23, 35/35), de Step-6-contracttests, employmenttests en de verlof-/overurentests (12 relevante tests) groen. RLS gaf multigroup 1 verloftype/1 set, boundary 0, twee DEMO-028-balances en resolverbron `EMPLOYEE_SET`.

De interne browsercontrole op `http://localhost:3000` bevestigde voor HR Admin de multigroup-catalogus, employee set en beide profielversies; de uitzonderingsmodal toonde de twee DEMO-028-employments en liet een expliciete employmentkeuze zien. Manager werd voor HR-verlofbeheer naar de startpagina gestuurd en medewerker kreeg `Nog geen toegang`. De cross-group grens is aanvullend rechtstreeks met remote RLS- en contracttests vastgesteld.

Stap 7 is voor alle eigen specs **100% gevolgd en vastgesteld**. Stap 8 en stap 9 zijn daarna end-to-end uitgevoerd en per alle eigen specs gecontroleerd; de integrale eindverificatie en handoff zijn afgerond.

## Actuele update 2026-08-06: Stap 8 verzuim per HR-groep en employment

Stap 8 is uitgevoerd volgens `schema -> RLS/grants/audit -> API/service -> UI -> tests -> remote -> browser`. Migration `20260806120000_hr_group_absence_per_employment.sql` maakt instellingen uniek per HR-groep, maakt `absence_cases` en `absence_spells` employmentgebonden, backfillt en verplicht `absence_spells.employment_id`, en blokkeert overlap met een tenant/groep/employment-exclusion constraint. De capaciteitstabel kreeg een composite casus/spell-FK; de oude administratiegebonden settings policies en report/recovery-RPC's zijn vervangen door groeps- en employmentgecontroleerde varianten.

De report-, recovery- en partial-capacity-routes gebruiken typed servicefouten, groepscontext, de gedeelde employment resolver en safe error responses. `/absence/new`, het medewerkerdashboard, het verzuimtabblad en de instellingenflow tonen alleen groepsgescopeerde data; bij meerdere geldige employments is de keuze zoekbaar en expliciet. De nieuwe employment-resolver regressietests leggen automatische selectie bij één kandidaat, selectie bij exact één manager-match en expliciete keuze bij nul/meerdere matches vast.

Remote is de migration toegepast, officiële DB-types zijn opnieuw gegenereerd, advisors zijn uitgevoerd en `hr_group_absence_step8_contract.sql` is transactioneel groen. De contracttest controleert dezelfde-employment-overlap, parallelle employments/groepen, herstelisolatie, 50% capacity, RLS, grants, RPC-signatures en het ontbreken van medische kolommen. Eindgate: 129 testbestanden/478 tests, strict typecheck, lint, i18n met 28 namespaces, productiebuild met 171 pagina's en `git diff --check` zijn groen. De browsercontrole bevestigde HR Admin groep A/B, expliciete twee-employmentkeuze, full recovery, partial capacity HTTP 200, manager één-match en medewerker-self-service op 390x844 met URL-state en 0 console-errors.

De Step-9-fixture bevat nu een teamlid met twee geldige employments. De manager multiple-match-browservariant is geauthentiseerd uitgevoerd met beide opties zichtbaar en één expliciete keuze; de typed resolvertest blijft groen (3/3). Geen commit, push, merge of deployment uitgevoerd.

## Actuele update 2026-08-05: afdelingsdropdown roltoewijzingen administratiegebonden

De pagina `/role-assignments` toonde eerder alle actieve tenantafdelingen, terwijl roltoewijzingen per administratie worden opgeslagen. De service filtert de afdelingen nu op actuele organisatieplaatsingen en bestaande roltoewijzingen binnen de actieve administratie. Een afdeling zonder actuele plaatsing blijft daardoor alleen zichtbaar wanneer er in die administratie al een roltoewijzing voor bestaat; afdelingen uit andere administraties vervuilen de dropdowns en de lijst **Afdelingen zonder leidinggevende** niet meer.

Lokaal geslaagd: de scope-regressietests, bestaande manager-resolvertests, strict TypeScript en ESLint. Remote read-only geslaagd: de testtenant levert verschillende afdelingssets per administratie op. Geen migration, remote write, commit of deployment.

## Actuele update 2026-08-05: company-data PATCH 400 opgelost

De bedrijfsgegevensmanager stuurde het read-only veld `id` mee naar `PATCH /api/settings/company-data`. Omdat de updatevalidator strict is, werd elke opslag met HTTP 400 afgewezen. De client gebruikt nu een expliciete payload met uitsluitend wijzigbare velden en heeft een regressietest die de payload tegen de echte schema-validator controleert.

Verificatie: gerichte company-data-tests (4 tests), strict TypeScript, gerichte ESLint en `git diff --check` zijn geslaagd. Een directe schema-reproductie accepteert de nieuwe payload zonder `id`.

## Actuele update 2026-08-04: Test Medewerker toegevoegd aan Yara-team

Migration `20260804193021_move_test_employee_to_yara_team.sql` is remote toegepast. De gekoppelde fixture-account **Test Medewerker** is Noah Hendriks (`DEMO-035`). Hij staat nu in **Test Operations** (`RICH-02`) met functie **Operations specialist** en rapporteert direct aan Yara (`DEMO-028`). Yara's actuele directe team bevat hierdoor vijf medewerkers.

## Actuele update 2026-08-04: Yara-testteam en herkenbare leidinggevende-status

Migration `20260804191903_manager_assignment_status_and_yara_team.sql` is remote toegepast op het gekoppelde Supabase-testproject. De bestaande brede synthetische directe-managerrelaties naar Yara (`DEMO-028`) zijn leeggemaakt. Yara staat nu in **Test Operations** (`RICH-02`) met vier expliciete directe teamleden: Maya Bos (`DEMO-032`), Omar Kaya (`DEMO-037`), Sophie De Vries (`DEMO-042`) en Milan Visser (`DEMO-047`). Haar `DIRECT_MANAGER`-roltoewijzing gebruikt dezelfde afdeling.

De roltoewijzingenlijst gebruikt niet langer **Controle nodig**. De statuskolom heet **Type** en toont `LG-Afd` bij dezelfde afdeling en `LG-Afd-Plus` bij een andere toegewezen afdeling. Yara hoort hierdoor `LG-Afd` te zien; haar managerteamscope hoort vier medewerkers te tonen.

## Actuele update 2026-08-04: administratiegebonden roltoewijzingen

Roltoewijzingen tonen en accepteren alleen medewerkers met een actueel bevestigd primair dienstverband in de actieve administratie. De server voert dezelfde controle uit vóór een nieuwe `department_management`-regel. De pagina toont bovendien wanneer de gebruiker alleen leesrechten heeft en schakelt de schrijfknoppen dan uit. Hiermee voorkomt de UI dat een medewerker uit een andere administratie, zoals Yara/`DEMO-028` uit Operations vanuit de Holding, als geldige rolhouder wordt aangeboden.

Strict TypeScript, i18n-pariteit en gerichte ESLint zijn geslaagd. Geen migration of remote datamutatie nodig.

## Actuele update 2026-08-04: rijke synthetische medewerkerdataset

Migration `20260804180940_seed_rich_employee_dataset.sql` is remote toegepast op het gekoppelde Supabase-testproject. De idempotente fixture verrijkt 72 bestaande testmedewerkers met telefoons, avatars, adressen, testbankgegevens, relaties, actuele dienstverbanden, salarissen, roosters, organisatieplaatsingen, afdelingen, functies, locaties, kostenstructuur en beperkte dossier-/verzuimactiviteit. Er zijn geen auth-users of echte persoonsgegevens aangemaakt; avatars zijn ingebedde synthetische SVG-data en IBAN-velden gebruiken alleen fixture-ciphertext.

Eindcontrole: 68 actieve medewerkers hebben allemaal een actueel bevestigd primair dienstverband, salaris, rooster, organisatie, primair adres, primaire bankrekening en relatie. De transactionele dry-run en remote uitvoering zijn geslaagd. Database-types zijn opnieuw opgehaald; er was geen typecontractwijziging. Advisors zijn opnieuw uitgevoerd: security 2 INFO/15 WARN en performance 255 INFO/0 WARN; dit zijn projectbrede bestaande meldingen en geen fixture-specifieke fout.

De migration herstelt daarnaast de bestaande locatie-guardfunctie die bij een locatie-insert naar een niet-bestaande `single_location`-kolom verwees. Deze gerichte functiecorrectie was nodig voor de locatie-fixture; er is geen bestaande gebruikersdata verwijderd.

## Actuele update 2026-08-04: Supabase security- en performance-hardening

De Star Performer-RLS policies zijn performance-neutraal geconsolideerd: `read` blijft de enige SELECT-policy en de bestaande `write`-policy is per tabel vervangen door afzonderlijke INSERT-, UPDATE- en DELETE-policies met dezelfde permissionchecks. Daarnaast bevatten de relevante `SECURITY DEFINER`-RPC's geen `pg_temp` meer in hun search path. Beide migrations zijn remote toegepast en de officiële types zijn opnieuw opgevraagd; er wijzigde geen databasecontract.

Advisorresultaat: performance 0 WARN en 258 INFO; security 15 bestaande authenticated SECURITY DEFINER-WARNs en 2 bewuste RLS-zonder-policy INFO's. De Auth-melding voor gelekte wachtwoorden blijft afhankelijk van Supabase Auth-inrichting. Tests, strict typecheck, ESLint en productiebuild zijn groen.

## Actuele update 2026-08-04: compactere fotoweergave medewerkerslijst

Aanvulling: **Foto collage** is toegevoegd als extra view-keuze met vierkante foto’s of initialen, zonder namen, in een strak responsive raster.

De medewerkerslijst ondersteunt nu zeven view-keuzes: Detail, Compact, Kaarten, Foto's groot, Foto's standaard, Foto's klein en Alleen foto (vierkant). De drie benoemde fotoweergaven renderen uitsluitend foto/initialen en voornaam; de vierkante variant rendert alleen foto/initialen met een dunne rand. Voor medewerkercollega's en managerrecords buiten het directe team blijft de veilige popupkliklaag actief; directe teamleden, eigen records en HR-bevoegde records behouden hun normale detailroute. Geen personeelsnummer of andere verborgen directoryvelden worden in de fototegel toegevoegd.

`photo` is opgenomen in de voorkeur-parser, PATCH-validatie, URL-state en i18n. Er is geen schemawijziging of migration nodig.

## Actuele update 2026-08-04: kaartweergave medewerkerslijst

De lijstweergave is uitgebreid met **Kaarten** naast Detail en Compact. Het filter gebruikt de bestaande voorkeursschrijfroute; de parser, URL-helper en `user_preferences.ui_state.employeesList` accepteren de nieuwe waarde `card`. De kaart gebruikt een responsive `auto-fit`-grid, avatar/initialen, status, functie, afdeling en zakelijk e-mailadres wanneer die velden voor de kijker zichtbaar zijn. De kliklaag blijft rolbewust: medewerkercollega's en managerrecords buiten het directe team openen de beperkte directory-popup; eigen/directe bevoegde records openen de bestaande detailroute. Personeelsnummers worden niet in de beperkte kaarten gerenderd.

Lokaal geslaagd: 9/9 voorkeurentests, strict typecheck, gerichte ESLint, i18n-pariteit en `git diff --check`. Remote geslaagd: één opgeslagen `card`-voorkeur in de Supabase `user_preferences`-JSON-scope. Browsercontrole op poort 3000 geslaagd voor manager- en medewerkerrol, inclusief herladen, 3-kaarten-per-rij op desktop, 20 medewerkerskaarten, 19 collega-popupknoppen, één eigen profiel-link en een popup met de vrijgegeven directoryvelden. Geen migratie, commit, push of deployment uitgevoerd.

## Actuele update 2026-08-04: managerbeschikbaarheid op de startpagina

De startpagina heeft voor managers een breed venster **Beschikbaarheid team** met een horizon van zeven dagen inclusief vandaag. Teamleden staan verticaal; de dagen staan horizontaal. De manager kan wisselen tussen **Aanwezig** en **Uren aanwezig**. Beschikbaarheid is server-side opgebouwd uit het bestaande werkpatroon/legacy-rooster, goedgekeurd verlof en actieve verzuimspells, met alleen de directe managerstam als bron. HR Admins zonder managerrol en medewerkers krijgen dit venster niet. De widget staat standaard links in de brede kolom en blijft onderdeel van de persoonlijke vensterordening. Geen schemawijziging of remote write.

Lokale verificatie: i18n-pariteit, strict TypeScript, ESLint, de layouttests en `git diff --check` zijn geslaagd. De authenticated browsercontrole op poort 3000 bevestigde beide weergaves, de 7 dagkolommen en dat de HR Admin-startpagina de managerwidget niet toont.

## Actuele update 2026-08-04: medewerkerdirectory beperkt tot actieve niet-gearchiveerde records

De directoryservice forceert voor medewerkers `activeDirectoryOnly`: alleen `ACTIVE_EMPLOYEE` en niet-gearchiveerde records gaan naar de lijstweergave. De filter-UI toont voor medewerkers alleen Actief en Niet-gearchiveerd; managers behouden hun bestaande status- en archiefkeuzes. De huidige tenant heeft geen toekomstige of gearchiveerde testrecords, maar de servergrens en rolafhankelijke filters zijn browsermatig gecontroleerd. Geen migration nodig.

## Actuele update 2026-08-04: personeelsnummer uitgesloten van medewerker-collegaweergave

Het personeelsnummer wordt niet gerenderd en niet doorzocht wanneer een medewerker de directory bekijkt. Voor een manager buiten het directe team geldt dezelfde beperking. De directory-popup bevat het nummer server-side al niet; de remote SQL-check op `get_employee_directory_detail` bevestigde beide mogelijke sleutelvormen als afwezig. Typecheck en gerichte ESLint zijn geslaagd; er is geen nieuwe migration nodig.

## Actuele update 2026-08-04: directoryvelden worden ook uit de medewerkerslijst verwijderd

Naam is niet uit te schakelen: de HR-instelling blijft aangevinkt en disabled, en de server forceert `showName: true` bij lezen en schrijven. De andere vijf velden zijn afzonderlijk instelbaar. De zichtbaarheid geldt nu voor popup én lijst; functie/afdeling en zakelijk e-mailadres worden bij uitschakelen niet gerenderd en niet meegenomen in de lijstzoektekst.

Migration `20260804190000_employee_directory_visibility.sql` is remote toegepast. De browsercontrole bevestigde de disabled Naam-checkbox en een medewerkerslijst zonder functie/afdeling of e-maillinks bij tijdelijk uitgeschakelde instellingen; de testpopup had dezelfde beperking. De testadministraties zijn teruggezet naar alle defaults `true`. Typecheck, i18n, gerichte ESLint en Supabase advisors zijn uitgevoerd. Advisors zijn projectbreed 17 security- en 261 performance-meldingen; de extra securitymelding betreft de nieuwe authenticated SECURITY DEFINER visibility-RPC met interne permissioncheck.

## Actuele update 2026-08-04: manager-buiten-team als collega-popup

Managers krijgen in `scope=all` alleen voor directe teamleden de volledige medewerkerdetailroute. Niet-teamleden worden via dezelfde beperkte directory-popup behandeld als medewerkers. Dit wordt zowel in de lijst als in de server-side detailroute afgedwongen; handmatige detail-URL's voor niet-teamleden redirecten terug naar `/employees`. `TENANT_ADMIN` blijft volledig bevoegd. De directory-RPC accepteert voor deze veilige lezing ook `employee:read`, zonder uitbreiding van de detailprojectie.

De remote migration `manager_non_team_directory_privacy` is toegepast en de functie is met een remote SQL-check gecontroleerd op beide permissionpaden. De interne browsercontrole bevestigde popup voor Bas de Jong buiten het team, volledige detailpagina voor teamlid Lina Bakker en redirect bij directe URL. Typecheck, gerichte ESLint en Supabase advisors zijn uitgevoerd. Advisors blijven projectbreed op 16 security- en 261 performance-meldingen staan; de directory SECURITY DEFINER-waarschuwing is bestaand patroon en de functie voert interne permissionchecks uit.

## Actuele update 2026-08-04: medewerkersdirectory voor medewerkers

De medewerker krijgt `employee-directory:read` en kan daardoor de medewerkerslijst van de actieve administratie openen zolang de HR-instelling **Medewerkers mogen de medewerkerslijst openen** aan staat. Nieuwe administratievelden voor directorytoegang en zes afzonderlijke popupvelden hebben default `true`. Collega's zijn voor medewerkers geen links naar manager-/HR-detailpagina's maar knoppen met een veilige popup. De server-RPC geeft alleen vrijgegeven naam, functie/afdeling, zakelijk e-mailadres, zakelijk telefoonnummer, weekstatus (`WORKING`/`OFF`/`ABSENT`) en rooster terug; absence-redenen en overige HR-data worden niet geprojecteerd.

De migrations `20260804180000_employee_directory_settings.sql` en `20260804180500_employee_directory_access.sql` zijn remote toegepast, inclusief RLS/permissionchecks, schedule-fallback en datumserialisatie. TypeScript-types zijn opnieuw gegenereerd. De browsercontrole met de medewerkerfixture bevestigde 20 records en de popup. Een HR-toggletest op zakelijk e-mailadres bevestigde dat dit veld verdwijnt terwijl telefoon, aanwezigheid en rooster zichtbaar blijven; de defaults zijn na de test hersteld. `type-check`, `check:i18n`, gerichte ESLint en `git diff --check` zijn uitgevoerd. Supabase-advisors bevatten 16 security- en 261 performance-meldingen, projectbreed; de enige nieuwe securitymeldingen zijn de twee SECURITY DEFINER directory-RPC's, die server-side permissionchecks uitvoeren en via de bestaande authenticated-RPC-patroon worden aangeroepen.

## Actuele update 2026-08-04: gesloten medewerkerslijst en expliciete teamscopefilters

De medewerkerslijst start altijd gesloten; de open/dicht-state wordt niet meer via `/api/preferences/employees` naar `user_preferences` opgeslagen. Oude `filterPanelOpen`-waarden worden genegeerd en bij een volgende opslag opgeschoond. De bestaande persoonlijke voorkeuren voor status, archief, sortering en weergave blijven behouden.

Een geforceerde Mijn team-link gebruikt nu de expliciete preset **Actief + toekomstig + externe personen**, `archive=active` en `scope=team`. De service filtert deze preset als actieve, toekomstige en externe personen en sluit voormalige medewerkers uit. De Startpagina gebruikt de herbruikbare URL-helper.

Authenticated browsercontrole op poort 3000 bevestigde dat de managerlink exact `status=active-future-external&scope=team` gebruikt, 17 teamrecords toont, het filterpaneel gesloten opent en na expliciete actieve filtering 13 actieve teamrecords toont. HR Admin opent de medewerkerslijst eveneens gesloten.

## Actuele update 2026-08-04: rolgebonden startpagina- en medewerkerslijstscope

Lokaal geïmplementeerd: de startpagina toont voor managers **Wat speelt er nu in mijn team** en voor HR Admins **Wat speelt er nu in ons bedrijf**. De combinatie `DIRECT_MANAGER` + `TENANT_ADMIN` krijgt een server-gedreven switch tussen beide scopes. De knop achter de teamkop opent de medewerkerslijst geforceerd met `scope=team`.

De medewerkerslijst gebruikt voor managers standaard de teamscope en biedt in het filterpaneel **Mijn team** en **Alle medewerkers**. De scope wordt door de route en `listEmployeesOverview` server-side bepaald; alleen een manager kan `scope=team` aanvragen. Teamgerichte startpaginacijfers en operationele lijsten gebruiken dezelfde directe teamscope. De Startpagina geeft voor de geforceerde teamlijst ook `status=active-future-external` mee.

De bestaande placeholder **Taken & Poortwachter** blijft een managementplaceholder en wordt niet aan medewerkers getoond. De huidige codebase bevat wel taaktemplates voor verzuiminstellingen, maar geen taakinstantiebron voor een betrouwbare startpaginacount; er is daarom niets verzonnen.

Checks: `check:i18n`, strict `type-check`, `lint`, de gerichte `employee-list-state`-tests, `git diff --check` en authenticated browsercontrole op poort 3000 zijn geslaagd. Geen schemawijziging, remote write, commit, push of deployment.

## Actuele update 2026-08-04: volledig organogram voor medewerkers

De medewerker krijgt volledige organogramleesrechten binnen de actieve administratie via `organization-chart:read`; managementrechten blijven ongewijzigd. De service slaat star-performerbeoordelingen over voor medewerkers. De migration `20260804170000_employee_full_organization_chart_read.sql` herziet de RLS-policies voor de organogrambrondata en is remote toegepast. Advisors en DB-typegeneratie zijn uitgevoerd; bestaande security/performance-waarschuwingen zijn niet slice-specifiek opgelost. Authenticated browsercontrole volgt.

## Actuele update 2026-08-04: Ontwikkeling voor medewerkers

De navigatie toont `Ontwikkeling` in plaats van `Workforce`. Medewerkers openen dezelfde route met een beperkte self-serviceweergave: alleen bestaande, toegestane routes voor Doorlopende beoordeling (`/my-appraisal`) en Talentprofielen (`/my-talent`) verschijnen. Managementrollen behouden de bestaande 9-grid-, doorlopende-beoordeling-, talentprofiel-, Star Performer- en Cloud-tags-tegels. De Startpagina gebruikt dezelfde rolgebonden filtering. Geen schemawijziging of remote write; i18n, strict TypeScript en gerichte ESLint zijn geslaagd.

## Actuele update 2026-08-03: Full/Compact en persoonlijke startpagina-layout

Lokaal geïmplementeerd: de startpagina-header ondersteunt Full en Compact. Compact verbergt weer, komende dagen en reorder-controls; Full behoudt de bestaande header en maakt de brede/smalle vensters ordelijk verplaatsbaar met drag-and-drop en pijlen. De voorkeuren worden direct per user bewaard in `user_preferences.ui_state.startPage` via `/api/preferences/start-page`, analoog aan het medewerkerdashboard. Geen schemawijziging of remote write. i18n, strict typecheck, ESLint, gerichte browsercontrole en `git diff --check` zijn geslaagd.

## Actuele update 2026-08-03: Workforce-links op de startpagina

De verouderde Dashboard-werkplekzin is vervangen door een permission-gestuurde Workforce-strip. De Startpagina linkt naar de bestaande 9-grid-, continuous-appraisal-, talentprofielen-, Star Performers- en Cloud-tags-routes wanneer de gebruiker daarvoor de bijbehorende permission heeft. Geen schemawijziging of remote write.

## Actuele update 2026-08-03: gebeurtenissen op de startpagina

Het bestaande live venster **Gebeurtenissen** op `/dashboard/start` blijft gekoppeld aan de bestaande gebeurtenisservice en `/insights/upcoming-events`. De verouderde dubbele placeholder **Gebeurtenissen — Bron wordt later aangesloten** is verwijderd. `DIRECT_MANAGER` krijgt alleen gebeurtenissen van actieve directe teamleden; HR Admin krijgt de actieve administratie-scope. De lokale migratie `20260803200000_allow_manager_upcoming_events_report` geeft managers toegang tot de bestaande rapportdoorklik; remote toepassen is nog open. Geen schemawijziging of remote write.

## Actuele update 2026-08-03: persoonlijke medewerkerdashboard-samenvatting

De medewerker-overview gebruikt de nieuwe `EmployeeDashboardSummary` als zelfstandige persoonlijke samenvatting. De kaart toont alleen persoonsgegevens en persoonlijke contactcontext: naam, leeftijd/verjaardag, werk- en privécontact, adres, primaire bankrekening en noodcontacten. Het algemene dashboard behoudt de overige eigen-medewerkermodules; management-KPI's en teamscope-informatie blijven uitsluitend in de Startpagina.

Er is geen schema-, API- of RLS-wijziging nodig geweest. De bestaande server-side detailservice en route blijven de gegevensgrenzen bepalen. Strict typecheck, gerichte ESLint, `git diff --check` en de bestaande dashboardlayouttest (2/2) zijn geslaagd; geen commit, push of deployment.

## Actuele update 2026-08-03: managerstartacties en teamscope

Lokaal geïmplementeerd: de manager-/HR-startpagina toont een uitbreidbare quick-action-rij voor Mijn gegevens, Mijn team en Nieuw ziektegeval; op kleine schermen worden alleen iconen getoond. De managerteamscope is beschikbaar via `scope=team`, wordt uitsluitend voor `DIRECT_MANAGER` aangeboden en gebruikt actieve directe rapportagelijnen. De startpaginafilters voor teamcijfers, afwezigheden, verlof en gebeurtenissen en de medewerkerslijst gebruiken dezelfde server-side scope. De ziekmeldingsroute hergebruikt `AbsenceQuickForm` en autoriseert de medewerkerkeuze via de bestaande service.

Geen nieuwe schemawijziging of remote write voor deze slice. Lokaal geslaagd: strict typecheck, ESLint, i18n-pariteit, gerichte tests (3 bestanden, 10 tests), productiebuild en `git diff --check`. De geauthenticeerde manager-browsercontrole bevestigde de drie snelacties, de teamscope (13 actieve medewerkers binnen 22 directe teamtoewijzingen), de teamgerichte startpagina en de mobiele icon-only weergave op 390px.

## Actuele update 2026-08-03: rolgebonden werkruimtes en medewerkerlanding

De autorisatie-defaults zijn dynamisch aan canonieke rechten gekoppeld. `EMPLOYEE` krijgt `employee-directory:read` en geen `start-page:read`, `dashboard:read` of `workforce:read`; `DIRECT_MANAGER` en `TENANT_ADMIN` krijgen deze drie werkruimterechten. De bestaande HR Admin-override in de demo-tenant is bijgewerkt. De medewerkerlijst accepteert nu ook het directoryrecht via een authenticated-only, permission-checked RPC. De dashboardlayout, Start-, Dashboard- en Workforce-routes volgen dezelfde server-side rechten; medewerkers landen vanuit `/dashboard/start` op hun eigen medewerkerpagina, managers en HR Admin op Start.

Remote bewijs: migraties `20260803192309_role_based_workspace_permissions` en `20260803192414_restrict_employee_overview_rpc` zijn toegepast op `wnpfloqpjvaacobppbpk`; de effectieve rechten van de drie demo-fixtureaccounts zijn gecontroleerd. Lokale verificatie: strict typecheck, gerichte ESLint en 10/10 gerichte tests geslaagd. De security-advisorwaarschuwing voor de directory-SECURITY-DEFINER is bewust en wordt door de functie zelf tenant- en permission-checked. Authenticated browserbewijs voor deze nieuwe landing/menucombinatie blijft open door het ontbreken van beschikbare fixturecredentials in deze runtime.

## Actuele update 2026-08-03: productiehotfix testrolwisselaar

De Vercel-flag `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED` werd niet uit `process.env` gelezen door de dashboardlayout; daardoor bleef de testrolwisselaar in Production verborgen ondanks een correcte Vercel-variabele en redeploy. De helper leest de runtimeflag nu server-side uit en normaliseert de waarde. Versie `1.20260803.4` bevat een regressietest voor de runtimeflag en voor hoofdletters/spaties. Lokaal geslaagd: 125 testbestanden/459 tests, strict typecheck, ESLint, i18n-pariteit en productiebuild met 163 pagina's. GitHub `e8a008c` en Vercel Production `dpl_Fu1T5z3F9P21JdnsMcynaEgfi556` staan op `READY`.

## Actuele update 2026-08-03: doorlopende beoordeling remote en testklaar

De Continuous Appraisal-slice is remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`: tenant-owned timeline, RLS/permissions, audit, FK-indexen en private screenshot-/bijlagenopslag. De services/API ondersteunen upload, metadata-RLS en signed downloads; de UI toont bijlagen op de timeline en biedt upload voor toekomstige items. De routes zijn `/my-appraisal`, `/workforce/continuous-appraisal` en de startpagina-samenvatting/link.

Remote contracttest slaagt. Security-advisor meldt geen nieuwe Continuous Appraisal-securitybevinding; performance-advisor meldt geen nieuwe unindexed-FK-bevinding. De kleine remote testdataset bevat 9 items, 3 reacties en 1 attachment. Authenticated browsercontrole heeft de drie fixtureaccounts doorlopen; de finale managercontrole toonde Noahs 8 items, `screen-4.png` en de download als `image/png`. Lokale verificatie: 125 testbestanden/458 tests, i18n-pariteit met 28 namespaces, strict typecheck en productiebuild met 163 pagina’s geslaagd. De slice is gepubliceerd in GitHub-commit `d91c554`; Vercel Production staat op `READY`.

## Actuele update 2026-08-03: testrolwissel voor fixtureaccounts

De lokale/testomgeving heeft in de ingelogde sidebar een allowlisted testrolwisselaar voor Edwin, de test-HR-admin, testmanager en testmedewerker. De server voert volledige logout/login uit via een eenmalige Supabase Auth magic-link-handoff zonder wachtwoord in de browser. De functie staat lokaal/test aan en productie uit tenzij `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED=true` expliciet wordt gezet. De vier vaste accounts kunnen onderling wisselen zodat een volledige testcyclus kan worden herhaald.

Verificatie: 125 hr-suite-testbestanden/458 tests, strict typecheck, ESLint, i18n-pariteit met 28 namespaces, productiebuild met 163 pagina's en een lokale browsercyclus HR Admin -> Manager -> Medewerker -> Edwin zijn geslaagd. Geen schemawijziging of remote write in deze testrolwisselslice; de code is gepubliceerd in GitHub-commit `d91c554` en Vercel Production staat op `READY`.

## Actuele update 2026-08-03: doorlopende beoordeling lokaal toegevoegd

De lokale verticale slice voor doorlopende beoordeling bevat de tenant-owned timeline, permissions/RLS, audit, managerwissel-systeemevent, services/API, `/my-appraisal`, `/workforce/continuous-appraisal`, startpagina-samenvatting en NL/EN i18n. De database voorkomt verwijderen, vergrendelt historische inhoud en begrenst reacties op 100 tekens. De nieuwe migration `20260803133000_continuous_appraisal_timeline.sql` is nog niet remote toegepast; daardoor zijn remote contractcontrole, advisors, echte testdata en authenticated browsergate nog open. Geen remote write, commit, push of deployment uitgevoerd.

## Actuele update 2026-08-03: Workforce 9-grid-vlootschouw remote toegepast

De nieuwe requirements en het besluit staan in `docs/requirements/Talent/09-LiquidHR-Vlootschouw-9-grid-Requirements.md` en `docs/decisions/FDR-0004-talent-vlootschouw-9-grid-campagnes-en-reminders.md`. De tenant-owned campagnetabellen met RLS/policies/audit, de `talent-review:*` permissions, campaign-start met teamsnapshot, 7-dagen-/korte-campagnereminders, managerstatus, HR-reminderactie, manager-drag-and-drop, scorehistorie en de role-aware route `/workforce/9-grid` zijn gebouwd en remote toegepast. De slice gebruikt bestaande employee-scope- en reminderpatronen; er is geen fake seeddata toegevoegd.

De self-scope is extra afgedwongen. Een medewerker zonder review-permission kan geen route, campagne of scorefunctionaliteit starten. Ook een Manager kan zichzelf nooit als reviewsubject zien of scoren, ook niet bij een zelfverwijzende `direct_manager_id`; de grens zit in de campaign-start-query, databaseconstraints, RLS, service en UI.

Remote contractproef geslaagd voor vier RLS-tabellen, authenticated-only table/RPC-grants, lifecycle-RPC's, self-scope constraints en RLS-policytekst. Security-advisor: geen nieuwe 9-grid-bevinding. Performance-advisor: geen nieuwe 9-grid unindexed-FK-bevinding; ongebruikte nieuwe indexen blijven als verwachte INFO zichtbaar zolang er nog geen campagnegegevens zijn. De officiële DB-types zijn via Supabase MCP opnieuw gegenereerd. De authenticated browsergate is met de drie fixtureaccounts geslaagd: HR-admin en manager openen `/workforce/9-grid`, medewerker wordt naar `/geen-toegang` gestuurd en krijgt geen 9-grid-heading of functionaliteit, review-API's geven voor manager/medewerker `403`, en de volledige Talent-gate rapporteert 0 axe-violations. Er blijft 1 axe-`incomplete` color-contrast-check op de select voor vorige campagne. De slice is opgenomen in GitHub-commit `d91c554`; Vercel Production staat op `READY`.

## Uitgebreide Talent Management-testhandleiding 2026-08-03

Een afzonderlijk Markdown-testdocument is toegevoegd: `docs/delivery/TALENT_MANAGEMENT_FUNCTIONAL_TEST_GUIDE_20260803.md`. Dit document is de praktische testbasis voor de drie fixtureaccounts en beschrijft wat HR Admin, manager en medewerker mogen openen, zien, instellen en niet mogen zien, inclusief de verwachte demo-seeddata, dashboards, periodefilters, check-ins, Role Explorer, negatieve autorisatiechecks en performancecontrole. Wachtwoorden en tokens zijn bewust uitgesloten. Geen databasewijziging, deployment of seedreset uitgevoerd.

## Performance- en Talent Management-update 2026-08-03

De HR-adminpagina `/settings/talent` is start-first gemaakt: de eerste load haalt geen Talent-fundament, functieprofielen of persoonlijke capabilityregistraties meer op. Elke sectie wordt exclusief geopend via één accordion, laadt op dat moment via de bestaande geautoriseerde API's en hergebruikt geladen data bij opnieuw openen. De losse Talent-navigatie staat nu binnen Start. De naamgeving onderscheidt `Talent Management`, `Functieprofielen - gekoppeld aan het functiehuis` en `Bestaande functie` van het bestaande beheer van `Functies en functiegroepen`; beheeracties in het fundament staan binnen de accordion.

De capability-record read gebruikt alleen benodigde kolommen en tenantfilters voor referentiequeries. Geen schemawijziging, remote write, commit of deployment. Checks: 447 hr-suite-tests + 7 control-tests, lint, i18n en productiebuild (156 pagina's) geslaagd. Productie-smoke: `/login` 200; beveiligde representatieve hoofd-routes 307 naar login met circa 5-28 ms guardtijd. Geauthenticeerde accordion-/rolcontrole blijft open wegens ontbrekende lokale fixturecredentials. Losse `type-check` blijft falen op bestaande `apps/hr-suite/lib/weather/open-meteo.ts:102`; de productiebuild heeft de nieuwe code wel succesvol gecompileerd en door TypeScript verwerkt.

## UI-update 2026-08-03: werkweer op landing-header

De startpagina koppelt de actuele werkcontext aan een server-side Open-Meteo-forecast. Een toegewezen actieve bedrijfslocatie gaat voor het bedrijfsadres; zonder vindbare werklocatie gebruikt de kaart Amsterdam als vaste fallback. De kaart toont de actuele temperatuur met daaronder klein de maximale temperatuur van vandaag (`temperature_2m_max`), circa 25% kleinere luchtvochtigheidscijfers, luchtdrukbalk en trendpijl, plus een windrichtingcirkel met Nederlandse kompasrichtingen; onderaan staat uitsluitend de volledige stadnaam. De kantoorlocatie is standaard geselecteerd. Via de compacte kantoor/thuis-iconen kan een medewerker wisselen naar het weer van de actuele primaire thuislocatie; alleen stad en land worden server-side uit `employee_addresses` gebruikt. Zonder gekoppelde thuislocatie blijft die keuze uitgeschakeld. De begroeting is eveneens verkleind. Onder de begroeting verschijnen server-side conditioneel de dagen tot het volgende goedgekeurde persoonlijke verlof en de eerstvolgende actieve feestdag; ontbrekende verlofdata wordt niet getoond. Onder de headerdrempel wordt de kaart verborgen in plaats van onder de begroeting te stapelen. Geen commit, push of deployment.

## UI-update 2026-08-03: accountmenu typografie en versieregel

Het ingelogde accountmenu in de sidebar heeft gelijke standaardtypografie voor persoonlijke instellingen en uitloggen. De actieve appversie staat daaronder als gewone, niet-klikbare informatieregel. Gerichte browsercontrole bevestigt `Versie 1.20260803.3`; geen schema/API-wijziging.

## UI-update 2026-08-03: ingeklapte sidebar-controls uitgelijnd

De ingeklapte desktop-sidebar gebruikt voor alle icon-controls dezelfde 44px hit-area en centrering: collapse, navigatie, productupdates, reminders, persoonlijke instellingen en uitloggen. Browsercontrole op 80px sidebarbreedte bevestigt dezelfde x-positie, breedte en hoogte voor de controls. Geen schema/API-wijziging.

## Besluitupdate 2026-08-03

Provider snapshot/restore is op verzoek uitgesloten en is geen actief releasepunt. LMS/P3.6 wordt niet gebouwd zonder nieuw productbesluit; P3.3 en P3.5 blijven `GEPARKEERD`; P4-P6 zijn niet uitgevoerd. De gerichte Supabase-timeout is aangepakt met nieuwe Talent-scope-indexen, RLS-short-circuiting en lazy rapportopties. `TALENT-NEXT-01` is gebouwd met drie rolroutes, spiderweb plus toegankelijke tabel en browserbewijs voor medewerker, manager en HR-admin op poort 3000. Oudere historische regels hieronder kunnen nog eerdere openpunten noemen; deze update is leidend.

## UI-update 2026-08-03: app-brede controlbasis en gedeelde dropdownset

De gedeelde controlbasis in `apps/hr-suite/app/globals.css` behandelt native selects, multi-selects, `.form-field`/`.input`-velden en gedeelde primaire/secundaire knoppen consistent. Selects hebben theme-based chevrons, vaste maatvoering en focus/hover-states; primaire knoplabels blijven op één regel en hebben duidelijker contrast. De Talent-capabilityfilters gebruiken aanvullend zichtbare micro-labels en korte waarden. De nieuwe `components/ui/dropdown-select.tsx` levert daarnaast één zoekbare, toegankelijke single-select voor CountryPicker, administratie, Talent, Insights, employee-landen/talen en organisatie-rolkeuzes; bestaande complexe multi-selects gebruiken dezelfde gedeelde trigger/menu/optie-styling.

Verificatie na de uitbreiding: strict typecheck, gerichte ESLint, `git diff --check` en geauthenticeerde Talent-browsercontrole met openen, kiezen, sluiten en Escape zijn geslaagd. De volledige testsuite en productiebuild worden nog als afsluitende controle uitgevoerd. Geen schema/API-wijziging, commit, push of deployment.

## Actuele update 2026-08-03: P3 functioneel gesloten en rolgetest

P3.0, P3.1, P3.2 en P3.4 zijn uitgevoerd in de lokale/testfase. Er zijn twee nieuwe tenant-owned tabellen toegevoegd met RLS, policies, audittriggers en authenticated-only RPC-grant: `talent_notifications` voor minimale opvolgmeldingen en `talent_goal_check_ins` voor gescheiden medewerkerreflecties, managerobservaties en vervolgacties. De service- en API-laag ondersteunt lijst/lezen, statusupdates, check-in CRUD, versioning en veilige scopecontrole. De Talent-doelpagina's tonen check-ins voor self, manager en HR; de rapportage heeft periodefilters die ook in CSV-export/audit worden meegenomen.

Remote seeddata bevat voor `employee.fixture` drie capabilityregistraties (historisch, actueel en toekomstig), drie ontwikkeldoelen (historisch, actueel en toekomstig), een employee-reflection, manager-observation en follow-up, plus vijf deduplicerende notificaties verdeeld over medewerker en manager. In de Codex-browser op poort 3000 zijn de drie rollen opnieuw gecontroleerd: employee ziet eigen Talent, meldingen en reflecties en ontvangt `/geen-toegang` op Workforce/HR; manager ziet directe teamscope, drie eigen meldingen en doelen/check-ins; HR Admin ziet tenantbrede meldingen, doelen/check-ins en rapportage.

Verificatie deze slice: 120 testbestanden/446 tests, strict typecheck, ESLint zonder warnings, i18n-pariteit (26 namespaces), productiebuild (152 pagina's), remote contractproef voor tabellen/RLS/indexen/RPC, security/performance advisors na DDL en browserrolgate. De interactieve HR-periodefilter en CSV-export zijn in de Codex-browser bevestigd; de medewerkerlanding gebruikt `/dashboard/start` en directe `/departments` gaat naar `/geen-toegang`. De gerichte Talent-timeout is aangepakt met nieuwe scope-indexen, RLS-short-circuiting en lazy rapportopties. `TALENT-NEXT-01` is als spiderwebslice gebouwd en met medewerker, manager en HR-admin in de Codex-browser op poort 3000 gecontroleerd. De bestaande projectbrede advisor-meldingen blijven los van deze slice. P3.3 evidence/documentkoppeling en P3.5 delegatie zijn `GEPARKEERD`; LMS/P3.6 wordt niet gebouwd zonder nieuw besluit. P4-P6 zijn niet uitgevoerd. Provider snapshot/restore is op verzoek uitgesloten; de thematische axe-`incomplete`, eventuele manager-/medewerker filter/CSV-herhaling en formele release-eigenaarsacceptatie blijven als releasebesluiten zichtbaar. Geen deploy, commit of push uitgevoerd.

## Actuele update 2026-08-02: stap 1 alleen-lezen supportmodus

Stap 1 van de supportfunctie is uitgevoerd. Een actieve `OWNER`/`OPERATOR` kan vanuit klantdetails een tijdelijke supportsessie starten met verplichte reden en 15, 30 of 60 minuten duur. De route opent `/support` in de HR-app op poort 3000, toont een blijvende alleen-lezenbanner en maakt het operatoraccount zichtbaar. De read-only projectie bevat klantmodel, administraties, tellingen van medewerkers/actieve dienstverbanden en maximaal 100 medewerkerprofielen; alle mutaties en klantacties zijn buiten scope.

De Supabase-migraties `20260802234000_add_platform_support_sessions.sql` en `20260802242000_close_expired_platform_support_sessions.sql` zijn remote toegepast. De sessie wordt via HttpOnly-cookie doorgegeven, nooit als URL-token; de database controleert actieve platformrol, actieve tenant, duur, eigenaar van de sessie en vervaldatum. Verlopen sessies worden automatisch beëindigd bij een nieuwe start en ook die beëindiging wordt geaudit. De directe sessietabel heeft RLS zonder authenticated/anon table-read; alleen de beperkte RPC-wrappers zijn uitvoerbaar.

Verificatie: control/HR strict typecheck, ESLint, i18n-pariteit, 7 controltests en beide productiebuilds geslaagd. De remote contractcontrole voor tabel, RLS, wrappers en grants is geslaagd. De browserflow is geblokkeerd op de bestaande niet-platformbeheerder-sessie in de Codex-browser; hiervoor moet handmatig met de geregistreerde OWNER/OPERATOR worden ingelogd. Geen deploy, commit of push uitgevoerd.

## Actuele status 2026-08-02: M2 functioneel afgerond in testfase

M2.0 t/m M2.8 zijn geïmplementeerd en getest. M2.7 bevat tenant-owned ontwikkeldoelen met self-/manager-/HR-scope, statusmachine, versioning en audit. M2.8 bevat read-only rapportage en CSV-export met rolallowlist, scopefilters en `EXPORT`-audit. M2.6 is end-to-end bewezen met `PREVIEW -> COMMITTED -> ROLLED_BACK`; rollback archiveert het aangemaakte record en behoudt auditdata. De importpreview weigert nu ook database-incompatibele evidence/certificate-metadata vóór commit.

Rolbewijs: HR Admin tenantbreed; manager directe medewerkersscope; medewerker self-bound. HR Admin kan importeren en terugdraaien; manager en medewerker worden server-side naar `Nog geen toegang` gestuurd voor `/settings/talent/import`. De demo-tenantseed beperkt de extra importrechten tot `TENANT_ADMIN`; er is geen manager- of medewerker-writepad geopend.

Checks: 119 testbestanden/442 tests, gerichte importtests 6/6, strict typecheck, ESLint zonder warnings, i18n-pariteit (26 namespaces), productiebuild (151 pagina's), `git diff --check`, remote comparison/import- en goals/reporting-contracten slagen. De veilige grote-datasetproef gebruikte tijdelijke tabellen met 20.000 synthetische rijen en draaide volledig terug; de zwaarste importselectie bleef op 7,545 ms. De drie-rollen axe/keyboard-herhaling slaagde met 0 violations. De medewerkerlanding is hersteld: `/login` gaat naar `/dashboard/start` en directe `/departments` gaat naar `/geen-toegang`. Alleen provider snapshot/restore blijft formeel open; detailbewijs staat in `docs/delivery/TALENT_M2_RELEASE_HARDENING_20260802.md`. Geen commit, push of deployment.

## Actuele hardeningcontrole 2026-08-02

De drie fixtures zijn opnieuw gebruikt in de lokale Codex-browser op poort 3000. HR Admin, manager en medewerker behouden hun eigen Talentroutes en server-side denies; manager-scope, cross-tenant-denies, self-bound gedrag en negatieve mutaties zijn geslaagd. Keyboard-focus is op alle vier toegestane routes vastgesteld en axe rapporteert 0 echte violations. Eén kleurcontrole blijft technisch `incomplete` door het themed/gedeelde oppervlak, maar is handmatig gecontroleerd zonder vastgestelde contrastfout. De performance-baseline en applicatieve importrollback zijn gesloten. Een echte provider-database snapshot/restore is bewust niet uitgevoerd zonder expliciete toestemming voor een tijdelijke Supabase-branch van $0,01344 per uur.

## Actuele update 2026-08-02: LiquidHR Control-login

De afzonderlijke control-app op poort 3001 ondersteunt nu naast wachtwoordlogin ook Google OAuth via `/auth/callback`. De bestaande actieve `OWNER`-registratie van Edwin blijft de autorisatiegrens; een geldige Google-login alleen geeft geen platformbeheerrechten. De knop op `/geen-toegang` gebruikt nu leesbaar contrast.

Verificatie: control strict typecheck, ESLint, 7 tests, i18n-pariteit (121 sleutels) en productiebuild geslaagd. De ingelogde Codex-browser toonde het control-dashboard met 2 klanten, 72 medewerkers en 91,7 KB opslag. De knop en klantenteller hebben nu duidelijk contrast; dashboardcopy legt uit dat klantdetails geen impersonatie zijn, dat de technische naam de zoekterm is en wat onder recente platformactiviteiten verschijnt. Handmatig resterend: registreer `http://localhost:3001/auth/callback` onder Supabase Auth → URL Configuration → Redirect URLs.

## Actuele update 2026-08-02: M2.5/M2.6 drie-fixture-gate

De lokale `.env.talent-auth.local`-fixtures zijn gebruikt in de Codex-browser. HR Admin: vergelijking en ongeldige/geldige importpreview geslaagd. Manager: `/workforce/talent/comparison` toegankelijk met scope 22 en twee functieprofielen; HR-instellingen/import geweigerd. Employee: `/my-talent` en eigen capabilitylijst zichtbaar; vergelijking/import geweigerd. De employee-landingsroute `/departments` heeft nog een bestaande onvoldoende-rechten-serverfout.

De importcommit blijft door bestaande tenant-specifieke RLS geblokkeerd omdat `TENANT_ADMIN` daar `talent-record:write` mist. De noodzakelijke autorisatie-uitbreiding is niet toegepast. Importaudittriggers zijn gehard en `20260802232000_talent_capability_fk_indexes` is remote toegepast. Geen nieuwe M2.5/M2.6-securitylint; Talent foreign-key-advisorregels zijn opgelost.

Verificatie: 116 hr-suite-testbestanden/434 tests, control 2/7 tests, lint, i18n en `git diff --check` slagen. Typecheck en productiebuild stoppen op drie bestaande fouten buiten deze slice in `apps/hr-suite/lib/employees/employee-service.ts:316` en `apps/hr-suite/lib/employment/employment-detail-service.ts:362/369`.

## Laatste verificatie 2026-08-02: M2.5 vergelijking en M2.6 import

M2.5 en M2.6 zijn in de testfase end-to-end aangesloten volgens schema → RLS/grants → service/API → UI. M2.5 biedt HR Admin en managers een gescopeerde vergelijking van actieve functieprofielversies met individuele uitkomsten `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`, zonder totaalscore en zonder bronrecord-ID voor niet-vrijgegeven gegevens. M2.6 biedt HR Admin een immutable CSV-preview, expliciete idempotente commit en batchspecifieke rollback; nieuwe geïmporteerde capabilityrecords blijven `DRAFT`.

Remote toegepast: `20260802220000_talent_comparison_and_import` en `20260802223000_talent_import_policy_indexes`. Het remote contract `apps/hr-suite/supabase/tests/talent_comparison_and_import_contract.sql` slaagt. Gerichte schema-tests en strict typecheck slagen. Security-advisors tonen geen nieuwe lint voor deze slice; performance toont nog uitsluitend kleine-dataset `unused_index`-meldingen voor importindexen. De nieuwe drie-fixture-browserherhaling en echte HR-rollbacktest zijn open door ontbrekende lokale fixturecredentials; de eerdere drie-rollen-gate blijft referentiebewijs. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: M2.3 assessments en M2.4 Team Talent

M2.3 self-/manager-assessments en M2.4 Team Talent/Skills Matrix zijn end-to-end toegevoegd. De migration `20260802210000_talent_assessments_and_team_matrix` bevat tenant-owned cycli, onderdelen, responses, antwoorden en managernotities met composite tenant-FK's, status-/datum-/versieguards, auditmetadata, per-actie-RLS en authenticated-only Data API-grants. HR beheert cycli en finale status; medewerkers schrijven alleen eigen self-assessments; managers schrijven alleen de actuele directe scope; managernotities zijn niet zichtbaar voor medewerkers. De medewerker ziet manageruitkomsten pas na `FINALIZED`.

De API/service gebruikt allowlisted DTO's en batchqueries. De nieuwe assessmentpagina's ondersteunen cyclusbeheer, antwoorden, concept opslaan/submitten, HR lock/finalize/reopen en afgeschermde notities. Team Talent toont HR tenantbreed en managers hun directe team; de matrix toont individuele capabilitystatus/bron/geldigheid/evidence-status zonder scores of aggregaten. De nieuwe contractproef en gerichte schema-tests slagen.

Verificatie: 114 testbestanden/428 tests, strict typecheck, lint, i18n (25 namespaces), productiebuild (136 pagina's) en `git diff --check` slagen. Remote RLS/grants/policycontrole is groen; advisors tonen alleen bestaande projectbrede meldingen en kleine-dataset ongebruikte-indexmeldingen. De browser op poort 3000 is actief, maar de huidige sessie heeft geen gekoppelde klantomgeving; authenticated drie-rollenbewijs voor deze nieuwe pagina's blijft daarom open totdat de bestaande fixturesessie opnieuw in de juiste tenant is ingelogd. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: M2.2 HR-kwalificaties

M2.2 is end-to-end toegevoegd bovenop de tenant-owned `talent_employee_capability_records`. HR kan certificaten beheren met uitgever, code, geldigheidsduur, permanentie, verlengingsplicht, evidence-status en een server-side vastgelegde verantwoordelijke. De migratie bevat datum-, evidence- en HR/tenant-guards, actieve duplicaatpreventie op certificaatcode, een verantwoordelijke-index en behoud van de bestaande RLS/grants/auditgrens. De service/API gebruikt allowlisted DTO's en geeft alleen `qualificationResponsibleAssigned` terug; bewijsinhoud en ruwe verantwoordelijke-ID's worden niet blootgesteld.

De HR UI bevat zoeken op uitgever/code, bijna-verlopen binnen 30 dagen, evidence-status en archiveren met impactinformatie zonder stille historische verwijdering. De remote M2.2-contractproef slaagt. Typecheck, lint, i18n, 112 testbestanden/421 tests, productiebuild en `git diff --check` zijn geslaagd. De browsercontrole op poort 3000 bevestigde de anonieme redirect van `/settings/talent`, `/workforce/talent` en `/my-talent`; de eerder geslaagde drie-rollen-gate blijft referentiebewijs voor de toegangsgrenzen. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: M2.1 capabilityregistraties

M2.1 is als eerste uitvoerbare fase-2-slice end-to-end geïmplementeerd volgens schema → RLS/grants → API/service → UI. `talent_employee_capability_records` is tenant-owned en bevat typegebonden waarden, herkomst, geldigheid, status, evidence-reference, versie/concurrency en audit. Databaseconstraints blokkeren verkeerde capabilitywaarden, ongeldige datums en foreign-tenant/document-scope. RLS beperkt HR tenantbreed, managers tot bestaande medewerkersscope en medewerkers tot eigen `SELF_ENTERED` `DRAFT`-records. De Data API-grants zijn beperkt tot authenticated SELECT/INSERT/UPDATE; anon/public zijn uitgesloten.

De vier nieuwe permissions zijn seeded en server-side gebruikt. `/settings/talent` biedt HR-beheer; `/workforce/talent` een manager read-only lijst; `/my-talent` een self-bound lijst met modal voor eigen conceptregistraties. Responses zijn allowlisted en bevatten geen evidence-inhoud of signed URL. Zod accepteert voor deze nieuwe recordinputs de volledige PostgreSQL UUID-stringvorm, zodat bestaande fixture-ID’s niet onterecht door RFC-variantcontrole worden afgewezen.

Verificatie: remote contractproef geslaagd; 112 testbestanden/419 tests, strict typecheck, lint, i18n, productiebuild en `git diff --check` geslaagd. Browser: employee maakte een BHV-record aan; dit verscheen als Concept, Zelf ingevoerd en zonder bewijsinhoud. De bestaande HR-/manager-/employee-routegate blijft het referentiebewijs voor de drie rollen; formele release blijft open voor representatieve performance, rollback/snapshot en de bestaande projectbrede advisorwaarschuwingen. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: M2.0 security en drie rollen

De eerste M2.0-uitvoering is afgerond binnen de afgesproken grens: contractdocumenten, traceability en de SQL-contractproef zijn toegevoegd; er zijn geen fase-2-tabellen, API-routes, UI-flow, seed of generated DB types gebouwd. De beperkte securitycorrectie `apps/hr-suite/supabase/migrations/20260802173000_harden_audit_log_data_api_grants.sql` is remote toegepast als `20260802131815_harden_audit_log_data_api_grants`. Live controle bevestigt voor `public.audit_logs` alleen `authenticated: SELECT`; `anon` en `public` hebben geen tabelgrants. De remote M2.0-contractproef slaagt volledig. Omdat uitsluitend grants/RLS-beleid is gewijzigd, was regeneratie van `packages/db/types.ts` niet nodig.

De interne Codex-browser op `http://localhost:3000` controleerde drie rollen. HR Admin opent `/settings/talent` en `/workforce/talent`; manager opent alleen `/workforce/talent`; employee opent alleen `/my-talent`. Verboden settings/workforce-routes tonen `Nog geen toegang`. De employee-landingsroute `/departments` geeft na login een bestaande onvoldoende-rechten-serverfout, terwijl directe `/my-talent` werkt; dit blijft een open routing/UX-punt buiten M2.0. Advisorcontrole blijft niet leeg: projectbrede bestaande meldingen over `SECURITY DEFINER`, gelekte-wachtwoordbescherming en RLS/permissies moeten later afzonderlijk worden beoordeeld. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: Talent rol-gate en fase 2

De volledige Talent-gate is opnieuw uitgevoerd met HR Admin, manager en medewerker: 3 rollen, 4 toegestane routes, correcte route-/mutatie-/cross-tenant-denies, manager-scopecontrole, medewerker-self-bound controle en 0 echte axe-violations. De technische `color-contrast`-checks zijn handmatig beoordeeld zonder vastgestelde Talent-contrastfout; gedeelde product-updatebanner-doelen blijven als axe `incomplete` traceerbaar. Strict typecheck, i18n, lint, 112 testbestanden/418 tests, productiebuild, de vier remote Talent-contractproeven en `git diff --check` zijn geslaagd. Formele productie-release blijft beperkt open voor representatieve grote-dataset-performance en restore/rollback. Het zelfstandige uitvoeringsplan voor fase 2 staat in `docs/requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md`.

## M2.0 gestart 2026-08-02: contracten en gegevensbescherming

M2.0 is gestart als ontwerp- en baselinecontrole vóór M2.1. ADR-0007, FDR-0003, de M2.0-contractspecificatie en de traceabilitymatrix leggen rolmatrix, dataclassificatie, status/provenance/evidence, audit, permissions en het logische schema vast. De SQL-baselineproef staat in `apps/hr-suite/supabase/tests/talent_phase2_m2_0_contract.sql` en bewaakt dat fase-2-tabellen en permissions niet vóór review ontstaan. De read-only remote controle toont dat de vier bestaande fase-1-Talentpermissions aanwezig zijn en dat fase-2-permissions/-tabellen nog ontbreken. De proef is geblokkeerd door bestaande brede `anon`-tabelgrants op `public.audit_logs`; er is geen remote wijziging uitgevoerd. M2.1, UI, API, migration, seed en typesgeneratie blijven geblokkeerd tot M2.0 is reviewed.

## Update 2026-08-02: Talent stap 9 — hardening en functiecontrole

Stap 9 is de laatste milestone van het opgeslagen Talent-implementatieplan. De remote hardeningmigratie `20260802150000_harden_talent_job_catalog_audit` voegt audittriggers toe aan de tenant-owned functiehuistabellen `jobs`, `job_groups`, `job_revisions` en `job_group_jobs`. De nieuwe release-contractproef `apps/hr-suite/supabase/tests/talent_m9_release_contract.sql` slaagt: 13 relevante tabellen hebben RLS, de self-RPC's zijn niet beschikbaar voor `anon`, en de verwachte Talent-indexen en audittriggers bestaan. De remote profielquery is met `EXPLAIN` gecontroleerd; de service leest requirements, capabilities en levels in batches.

De reproduceerbare geauthenticeerde gate staat in `apps/hr-suite/scripts/talent-release-gate.mjs` en is beschikbaar als `audit:talent-release`. De drie lokale Auth Admin-fixtures zijn met de server-side helper van wachtwoorden voorzien. De gate is daarna succesvol uitgevoerd met drie geïsoleerde sessies: 3 rollen, 4 toegestane routes, correcte denies voor HR Admin/manager/medewerker, 403/404 cross-tenant-denies, manager-scopecontrole, self-bound medewerkercontrole en 0 axe-violations. Drie `color-contrast`-controles blijven `incomplete` voor handmatige beoordeling. De cross-tenant capability-fixture is als niet-productieve remote testdata toegevoegd via `20260802160000_seed_talent_cross_tenant_release_fixture.sql`. Open voor formele release blijven de contrastbeoordeling, representatieve grote-dataset-baseline en rollback/snapshot-oefening. De functie-inventaris en volledige rol-/uitbreidingslijst staan in `docs/requirements/Talent/analysis/talent-phase1-function-inventory-and-m9-gate-20260802.md`.

## Supabase advisor-status 2026-08-02

Security- en performance-advisors zijn opnieuw uitgevoerd. Ze geven projectbrede bestaande `WARN`/`INFO`-meldingen terug, waaronder bewust aangeroepen authenticated `SECURITY DEFINER`-RPC's, uitgeschakelde gelekte-wachtwoordbescherming en bestaande permissive-policy-/RLS-meldingen. De Talent-contractproef bevestigt dat `anon` de self-RPC's niet kan uitvoeren; advisor-output is dus niet volledig leeg en blijft onderdeel van de formele releasebeoordeling.

## Update 2026-08-02: Talent stappen 7 en 8, read-only Workforce en Mijn Talent

Stap 7 en 8 zijn volgens schema -> API -> UI geïmplementeerd. `/workforce/talent` is lijst-eerst en doorzoekbaar: HR Admin ziet actieve tenantprofielen; een direct manager krijgt alleen actuele profielen uit de eigen directe medewerkersscope. `/my-talent` is self-bound en read-only: de actuele primaire functie, organisatiecontext, senioriteit, profielinhoud en capabilityvereisten komen uit beveiligde serverqueries/RPC's. Ontbrekende context levert een neutrale lege toestand op. Er is bewust geen score-, match-, voortgangs-, ontwikkel- of mutatiefunctionaliteit toegevoegd.

Remote is `20260802123000_complete_talent_read_models` toegepast. De migratie koppelt de drie demo-fixtures aan `TEST-MANAGER`, `TEST-PLANNER` en `TEST-CUSTOMER`, verscherpt actuele datumvensters in Talent- en job-readpolicies en voegt de self-requirements-RPC toe. Beide self-RPC's zijn `SECURITY DEFINER` met `search_path=''`, alleen `authenticated` kan ze uitvoeren, en de readmodel-view is `security_invoker=true`. De nieuwe contractproef `apps/hr-suite/supabase/tests/talent_read_models_completion.sql` is remote geslaagd.

Checks: `type-check`, `lint`, `check:i18n`, `test` (112/418), `build` en `git diff --check` zijn groen. De HR-adminsessie is lokaal op poort 3000 gecontroleerd voor instellingen, tenantbrede Workforce-profielen, vier capabilityvereisten en exclusieve accordionstatus. Open release-gatepunt: aparte manager-/medewerker-browserlogins en een volledige geauthenticeerde axe-run voor alle rolroutes; de repository bevat geen fixturewachtwoorden en er is niets geraden. De Supabase-advisors tonen alleen projectbrede bestaande meldingen plus de bewust geauthenticeerde SECURITY DEFINER-self-RPC-waarschuwingen. Geen deploy, push of commit.

## Update 2026-08-02: Talent stappen 5 en 6, authfixtures en axe-gate

De release-gate voor de Talentbasis is aangevuld. In de testadministratie `liquid-hr-demo-holding` zijn drie niet-productieve authfixtures aanwezig: `manager.fixture@liquidhr.test` als `DIRECT_MANAGER` met directe managerscope, `employee.fixture@liquidhr.test` als `EMPLOYEE` met gekoppelde medewerker en `hradmin.fixture@liquidhr.test` als `TENANT_ADMIN` met tenant-scope. De manager kreeg terecht geen toegang tot `/settings/talent`; de HR-admin kon in de geselecteerde demo-administratie het Talentfundament openen.

Stap 5 en 6 zijn uitgevoerd volgens schema -> API -> UI. De remote migratie `apps/hr-suite/supabase/migrations/20260802110000_complete_talent_profiles_and_configuration.sql` voegt version metadata en activatie-informatie toe, normaliseert requirement types, bewaakt één conceptversie en niet-overlappende geldigheidsperioden, valideert type/levelcombinaties en biedt geautoriseerde copy- en activation-RPC's. De API ondersteunt profieloverzicht/detail, versiebeheer en CRUD voor capabilityvereisten. `/settings/talent` toont nu lijst-eerst profielbeheer, versiehistorie, inhoud, requirementbeheer en dashboardtelling; de bestaande HR-admin foundation-accordions blijven exclusief.

De nieuwe geauthenticeerde axe-runner `apps/hr-suite/scripts/axe-audit.mjs` controleerde op poort 3000 zes routes (`/dashboard/start`, `/workforce`, `/employees`, `/settings`, `/settings/talent`, `/workforce/talent`): 6/6 bereikbaar, 0 violations. Drie `incomplete` kleurcontrastcontroles op overlappende of puur decoratieve elementen blijven als handmatige beoordeling geregistreerd; target-size en aria-prohibited findings zijn opgelost. De browsercontrole bevestigde de Talent-editor, de idempotente conceptversie-actie (HTTP 201) en de exclusieve accordion.

Geslaagd: 112 testbestanden/418 tests, ESLint zonder warnings, i18n-pariteit (25 namespaces), strict typecheck, productiebuild (126 pagina's) en `git diff --check`. Supabase RLS staat aan op de drie talent-profieltables; de overlaptrigger en vier talent-RPC/validatiefuncties zijn remote gecontroleerd. Security/performance advisors tonen daarnaast projectbrede bestaande meldingen, waaronder de bewust geautoriseerde SECURITY DEFINER-RPC's, ongebruikte indexen en bestaande permissive-policy-meldingen. Geen deploy, push of commit uitgevoerd.

## Update 2026-08-02: Job Architecture stap 4 en release-gate

Stap 4 is toegevoegd volgens schema -> API -> UI: tenant-owned families/groepen/functies, optionele families en senioriteiten, CRUD/status, impactguards, filters, explorerweergave en een databaseguard voor unieke actieve functie + groep + senioriteit. De bestaande employee-organization-plaatsingen zijn behouden. De nullability-fout in `apps/hr-suite/lib/employees/employee-service.ts:316` is opgelost.

De remote migratiehistorie bevat de Talent-foundation, testcatalogus, hardening, `complete_job_architecture_contract` en `seed_job_architecture_matrix`. `Liquid HR Demo Holding` bevat 6 families, 3 actieve groepen, 7 actieve functies, 1 groep zonder family, 6 functies met senioriteit, 1 functie zonder senioriteit en 68 functieplaatsingen. De contractproef slaagt inclusief orphan/duplicate checks en negatieve duplicate/cross-tenant tests.

De vorige release-gate-notitie hieronder beschrijft de tussenstand vóór de fixtures en axe-audit; de actuele gate-status staat in de update hierboven.

## Historische update 2026-08-02: Talentfundament onder HR-inrichting

Talentfundament staat nu als HR-admin-tegel onder `Instellingen -> HR-inrichting`; de losse zijbalkingang is verwijderd. De bestaande pagina `/settings/talent` en het formulier zijn behouden. De vijf configuratieblokken gebruiken de gedeelde exclusieve `SettingsAccordion`, waarbij maximaal één blok tegelijk openstaat.

De tegel en route zijn begrensd met `talent:manage`. De remote Talent-contractmigratie, de testcatalogus, de hardeningmigratie `20260802063946_harden_talent_remote_contracts` en de remote contractproef zijn uitgevoerd op de testdatabase; de eerdere status hieronder dat remote toepassing nog openstond is daarmee achterhaald. De demo-set bleef behouden: 7 categorieën, 9 tags, 34 capabilities, 92 levelinhouden, 20 tagrelaties, 24 profieleisen, 6 actieve profielversies en 16 functieplaatsingen.

Verificatie voor deze wijziging: authenticated in-app-browsercontrole van `Instellingen -> HR-inrichting -> Talentfundament` en `/settings/talent`, inclusief exclusief sluiten/openen van de harmonica; ESLint en i18n-pariteit geslaagd. Typecheck blijft geblokkeerd door de bestaande nullability-fout in `apps/hr-suite/lib/employees/employee-service.ts:316`. Geen deploy, push of commit uitgevoerd.

## Update 2026-08-02: Talent stappen 1, 2 en 3 lokaal doorgetrokken

De drie afgesproken Talentstappen zijn in de checkout uitgebreid. Ownership/modulegate/permissions/routes zijn aangescherpt; manager-read toont alleen actieve, datumgeldige profielen uit de directe managerscope. Levelmodel en senioriteiten hebben nu beheer-API's, dynamische levelconfiguratie, volgorde/status en usage/lockguards. De capabilitybibliotheek ondersteunt alle vijf capabilitytypen, typebewuste velden, categorieën met typescope, Cloud Tag-relaties via de bestaande `star_performer_tags`, CRUD/status, zoekfilters/paginering, usage counts en dynamische levelinhoud.

De nieuwe lokale migratie is `20260802052246_talent_management_foundation_completion.sql`; de read-only SQL-contractproef staat in `apps/hr-suite/supabase/tests/talent_management_foundation_completion.sql`. Remote toepassing is nog niet uitgevoerd wegens ontbrekende expliciete toestemming voor een remote schemawijziging. Tot die toepassing blijft de nieuwe tagrelatie op de readpagina leeg terugvallen; nieuwe mutation-contracten zijn lokaal typechecked maar nog niet remote uitvoerbaar. De gegenereerde DB-types moeten na toepassing officieel opnieuw worden gegenereerd.

Geslaagd: 112 testbestanden/418 tests, strict typecheck, ESLint zonder fouten, i18n-pariteit (25 namespaces), `git diff --check` en de bestaande productiebuild. In de authenticated Codex-browser is `/settings/talent` gecontroleerd met levels, senioriteiten, categorieën, capabilityfilters, modal en levelinhoud; remote SQL/RLS/advisors en een authenticated mutationmatrix blijven het eerstvolgende handoff-punt. Geen deploy, push of commit uitgevoerd.

## Update 2026-08-01: liquid metallic bannerstijl

De bovenbanner voor productupdates heeft een warme koper/oranje/goudgele liquid-glow gekregen met overlappende radialen, metallic sweep, subtiele diepte en een leesbare hover-link. De kleuren gebruiken bestaande thema-variabelen; lint en strict typecheck zijn geslaagd. De anonieme browserroute redirect correct naar login.

## Update 2026-08-01: verhuizing en verzuimdetail-navigatie

De adresactie voor een nieuw hoofdadres heet nu `Verhuizen`. De lopende verzuimkaart op het medewerkerdashboard opent als klikbare kaart met hand-icoon het bestaande casusdetail met `caseId`. Het casusdetail gebruikt één dossierkop met datum en toont ziekteperioden als compacte, toegankelijke uitklapregels met alle detailvelden in de open toestand.

Verificatie: 112 Vitest-bestanden/415 tests, strict typecheck en i18n-pariteit (25 namespaces) geslaagd. De lokale browsercontrole bevestigde de verhuisactie, casuslink, opgeschoonde kop en periodedetails. Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/React-plugincompatibiliteit.

## Update 2026-08-01: eenmalige banner en login-popup

De dashboardbanner en login-popup worden nu per gebruiker, productupdate en kanaal geregistreerd in `product_update_surface_dismissals`. De banner wordt bij tonen automatisch geregistreerd; de popup heeft een expliciete knop `Gezien` onder de berichten. De nieuwe tabel heeft RLS, self-policies en een remote migratie `20260801105005_product_update_surface_dismissals`.

## Update 2026-08-01: eigenaar- en tenant-scope productupdates

De productupdates-slice ondersteunt nu globale eigenaarberichten (`tenant_id is null`) en tenantberichten. De globale systeemrol `TENANT_ADMIN` krijgt `product-updates:global-write`; tenant HR Admin-overrides krijgen alleen `product-updates:write`. HR Admins kunnen globale berichten lezen maar niet wijzigen of verwijderen. Remote migratie `20260801143000_product_updates_global_owner_scope` is toegepast en twee `[TEST OWNER]`-berichten zijn aangemaakt. Lint, 112/415 tests, i18n-pariteit, strict typecheck en productiebuild met 122 routes zijn geslaagd. Een authenticated browsercontrole blijft open door ontbrekende login-cookie.

## Update 2026-08-01: hoofdadres en tweede tijdelijk adres

De bestaande `employee_addresses`-entiteit is uitgebreid met `address_type` (`PRIMARY`/`SECONDARY`) en een verplichte omschrijving voor tijdelijke adressen. Het laatste hoofdadres blijft server-side verplicht; een nieuw hoofdadres sluit het vorige automatisch af. Tijdelijke adressen hebben een eigen `valid_from`/`valid_until`, mogen naast het hoofdadres lopen en kunnen zonder opvolger worden verwijderd. De UI gebruikt één open harmonica tegelijk en verbergt de einddatum bij het hoofdadres.

Remote migratie: `20260801130000_employee_address_types`; demo-adressen zijn hergebruikt en als hoofdadres gebackfilled. API/service, RLS/audit en gegenereerde DB-types zijn bijgewerkt.

Verificatie: adres- en schema-tests 12/12, strict typecheck groen. ESLint is niet uitvoerbaar door de bestaande ESLint 10/React-plugincompatibiliteit; i18n en geauthenticeerde browsercontrole zijn nog uit te voeren.

## Update 2026-08-01: productupdates en cadeauvenster

Productupdates zijn tenant-eigen toegevoegd met de remote migratie `20260801093124_product_updates` (lokale bron: `apps/hr-suite/supabase/migrations/20260801093124_product_updates.sql`). De tabellen `product_updates` en `product_update_user_state` hebben RLS, gerichte policies, grants, datum-/kanaal-/doelgroepchecks en de beheerpermission `product-updates:write` voor `TENANT_ADMIN`. Database-types zijn opnieuw gegenereerd.

De route `/product-updates` toont actieve updates; de zijbalk heeft een cadeau-icoon met rode teller voor alleen ongeziene `GIFT_WINDOW`-updates. `LOGIN_POPUP` en `TOP_BANNER` worden vanuit de dashboardlayout getoond. `/settings/product-updates` biedt lijst-eerst beheer met zoeken, toevoegen, wijzigen, doelgroep-/kanaal-multiselect en verwijderen. Er zijn vier herhaalbare `[TEST]`-updates in de twee actieve testtenants aangemaakt.

Verificatie: 112 Vitest-bestanden/413 tests, volledige ESLint, strict typecheck, i18n-pariteit (25 namespaces) en productiebuild (122 routes) geslaagd. Remote controle bevestigt beide tabellen met RLS en samen zeven policies. Anonieme browsercontrole van `/product-updates` redirect naar login geslaagd; authenticated browsercontrole blijft open door ontbrekende login-cookie in deze browsercontext.

## Update 2026-08-01: verzuimgeval-detail en lopend verzuim

De verzuimacties volgen nu de casusstatus: een actieve casus toont geen nieuwe ziekmelding, en `(Gedeeltelijk) beter melden` op het dashboard verwijst naar het detail van die lopende casus. De verzuimlijst heeft geen dubbele herstelactie meer; bestaande casuskaarten zijn klikbaar en openen een detailweergave met de aanwezige casus-, periode- en capaciteitsvelden. Alleen in dat detail blijft de bestaande herstelactie met datum beschikbaar. De implementatie hergebruikt de bestaande `listEmployeeAbsence`-service, API's, permissies, RLS en demo-records.

Verificatie: 112 Vitest-bestanden/413 tests, ESLint en i18n-pariteit (25 namespaces) geslaagd. De actuele volledige typecheck wordt geblokkeerd door de bestaande, losstaande fout in `apps/hr-suite/app/(dashboard)/settings/company-data/page.tsx` (ontbrekende `CompanyDataLabels`-sleutels). Poort 3000 antwoordt HTTP 200; de geauthenticeerde browsercontrole bevestigde de actieve demo-casus en het detailpad. Geen database- of dependencywijziging uitgevoerd.

## Update 2026-08-01: enkele scrollbar medewerkerdetail

De `(dashboard)`-shell gebruikt nu een vaste viewportlaag met `overflow-hidden`; de contentkolom behoudt de bestaande interne `overflow-y-auto`. Hiermee is de dubbele scrollbar op medewerkerkaarten opgelost zonder wijzigingen aan medewerkerdata, API's of database. Browsercontrole op poort 3000 toont één scrollbar en de console meldt geen waarschuwingen of fouten. ESLint en strict typecheck zijn geslaagd.

## Update 2026-08-01: medewerkerprofiel-, adres- en reminderfeedback

De medewerkerkaart heeft een doorzoekbare taalkeuze met internationale taal/regio-opties; de actieve status staat direct naast het personeelsnummer. De Nederlandse adreslookup verschijnt uitsluitend bij een ingevulde postcode en huisnummer en een lege plaats. Een adres kan een optionele `Geldig tot`-datum invullen of wissen; nieuwe adressen blijven open-ended. In de reminderdetailmodal staan **Verbergen** en **Annuleren** onderaan naast elkaar met de bestaande secundaire knopstijl.

De bestaande activiteitenfeed is hergebruikt. De services schrijven regels voor algemene persoonsgegevens, adres toevoegen/wijzigen/archiveren, bankrekening toevoegen/wijzigen/archiveren en relatie toevoegen/wijzigen/archiveren. De vertalingen staan in de bestaande NL/EN-employee-namespace. Er zijn geen database- of dependencywijzigingen uitgevoerd.

Verificatie: 111 Vitest-bestanden/410 tests, strict typecheck, ESLint, i18n-pariteit (24 namespaces), Next.js-productiebuild (115 statische pagina's) en poort-3000-logincontrole (HTTP 200) geslaagd. Authenticated browsercontrole bevestigde de genoemde interacties en de nieuwe feedregel zonder consolefouten.

## Update 2026-07-31: ownership cleanup en Talent Foundation

De ownershipbeslissing is nu doorgevoerd in de testdatabase. De oude `administration_id`-compatibilitykolommen zijn uit het tenant-owned functiehuis verwijderd; de bestaande functie-, groep-, revisie- en plaatsings-ID's zijn behouden. De unieke tenant-job-groupregel is database- en service-side afgedwongen. Er is één administrationele demo-afdeling (`LEGAL-DEMO`) aanwezig om de expliciete `scope_type`-variant te testen.

De Talent Foundation is geïmplementeerd met remote migraties `20260731140701`, `20260731141652`, `20260731142030`, `20260731142342`, `20260731143627`, `20260731144246` en `20260731150748`: level model/levels, seniorities, optionele job families, capability library, profile/profile versions, requirements, tenant readmodel, audittriggers, RLS-per-action, modulegate, self-profile RPC, manager-scope en tenant-FK-covering-indexes. Voor de zes bestaande demo-functies zijn Draft-profielen uit bestaande job revisions aangemaakt; er is geen tweede functiebron gemaakt. Settings, Workforce, My Talent, API-routes, sidebar, i18n en bestaande `jobs`/placements zijn aangesloten.

De Talent-navigatie is daarna aangescherpt: `Talentprofielen` is alleen zichtbaar met `talent:manager-read` en `Talentfundament` alleen met `talent:read`, zodat managers geen onbruikbare instellingenlink zien. De dashboard-layout hergebruikt per render de bestaande authcontext en Supabase-client voor menu-permissions, modules en reminders; hiermee zijn onnodige dubbele contextqueries verwijderd.

Verificatie: 111 testbestanden en 410 tests slagen; strict typecheck, lint, check:i18n (24 namespaces) en productiebuild (115 routes) slagen. `curl.exe` gaf op poort 3000 HTTP 200 voor `/login` en 401 voor de beschermde jobs-, departments- en talent-API's. De authenticated in-app-browser toonde `LEGAL-DEMO` in `/departments`, gaf Workforce Talent toegang tot niveaus/senioriteiten en weigerde `/settings/talent` zonder `talent:manage`. Advisoruitvoer bevat geen nieuwe ownership-RLS-waarschuwing; bestaande projectbrede adviezen en de intentionele beveiligde self-profile/activatie SECURITY DEFINER-RPC's zijn vastgelegd.

## Requirements-update 2026-07-31: tenant- en administratie-eigendom

De leidende ownershipmatrix staat in `docs/requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`; ADR-0006 vult ADR-0001 aan. Functiehuis, Talent-/Performancecatalogi, Cloud Tags en niet-juridische organisatiecatalogi zijn tenant-owned. Employment, contract, payroll, salaris, verlof, verzuim, declaraties, rooster, feestdagen en kosten blijven administration-owned. `employees` is de tenantbrede persoon; meerdere employments mogen naar dezelfde tenantfunctie verwijzen.

Deze ownershipslice is uitgevoerd zonder parallelle domeinobjecten: de remote migraties `20260731130502_align_tenant_owned_job_catalog_and_departments`, `20260731131136_align_star_performer_job_catalog_scope`, `20260731132359_align_tenant_department_consumers` en `20260731135658_remove_job_catalog_compatibility_and_seed_admin_department` zijn toegepast. `jobs`, `job_groups`, `job_revisions`, `job_group_jobs` en departments gebruiken tenant-FK's, tenant-RLS en tenantservices; de oude compatibilitykolommen zijn verwijderd. Employments, placements, assessments, documents, reminders, payroll, salaris, verlof en verzuim blijven administrationeel. De aangepaste consumers en de dataresultaten staan in `docs/requirements/Talent/analysis/`.

De volledige Talentfoundation (levels, competenties, profielen, Workforce-readmodel en Talent-audit) is uitgevoerd volgens schema → API → UI, met bestaande `jobs`, employees, tags en audit als bronnen. De volgende taak is een geauthenticeerde browser-smoketest met de bestaande demo-accounts en daarna pas uitbreiding van capability-inhoud wanneer die productmatig is goedgekeurd.

## Release 2026-07-29: versie 1.20260729.7

De volledige release staat op `main` en `origin/main` als commit `3e324e7`. De releasechecks zijn groen: 110 testbestanden/405 tests, ESLint, i18n-pariteit, strict TypeScript en productiebuild. Vercel Production is `READY` op deployment `dpl_6Wwho9qoYsKBK8DZrxrAh6PC5aAU`, gekoppeld aan dezelfde commit. De productiehost antwoordt anoniem met de loginpagina; runtime errors zijn in het afgelopen uur niet gevonden.

## Update 2026-07-29: verlofconfiguratie gecorrigeerd

De beheer-UX voor verloftypen, opbouwregels, werkuren en overuren is compleet aangesloten op de bestaande administratiegebonden services. Nieuwe en bestaande opbouwregels zijn vanuit de tab Beperkingen zichtbaar, opvolgers worden als keten gekozen, leeftijd en anciënniteit blijven afzonderlijke bonustypen, en uitzonderingen ondersteunen één of meerdere medewerkers met paginering per tien. Werkuren en overuren gebruiken dezelfde vier beperkingsvormen en hebben hun algemene instellingen op Basisinformatie. Versie: `1.20260729.6`.

Remote Supabase is gecontroleerd: HR Admin heeft `leave:read` en `leave:write`, de relevante tabellen hebben per actie RLS-policies en de demo-administratie bevat testvoorbeelden van alle vormen. 405 tests, gerichte ESLint en i18n-pariteit slagen. Buildcompilatie slaagt; de totale typecheck blijft geblokkeerd door twee reeds aanwezige fouten buiten verlof.

## Update 2026-07-29: Next.js dev-servergeheugenonderzoek

Het geheugenonderzoek staat in [`docs/delivery/NEXT_DEV_MEMORY_INVESTIGATION.md`](NEXT_DEV_MEMORY_INVESTIGATION.md). De standaard lokale dev-run gebruikt Webpack na een gecontroleerde vergelijking met Turbopack: Webpack bleef rond 1,20 GB na vijf minuten, terwijl Turbopack onder actieve routeverkenning naar 3,04 GB working set na 60 minuten groeide. De historische 11,12 GB is niet opnieuw gereproduceerd; de diagnose wijst op Turbopack compilergraph-/dev-stategroei, niet op een server-side applicatiecache. `npm run dev:turbopack` blijft beschikbaar. De afsluitende typecheck heeft bestaande fouten gemeld rond `createHeRaLabels` en `hasActiveEmployment`; die staan los van deze slice.

## Update 2026-07-29: medewerkerdashboardvensters

De dashboardkaarten zijn aangescherpt op basis van de visuele controlefeedback. Persoonlijke informatie toont naam, leeftijd/verjaardag, telefoons, e-mailadressen en adres; geslacht, geboortedatum en geboorteplaats zijn uit deze kaart verwijderd. De avatar toont geen technische opslaguitleg meer en behoudt de geautoriseerde upload-/wijzig-/verwijderacties. Verzuim toont expliciet de actuele status en laatste geschiedenis; nieuwe ziekmeldingen openen in een aparte modal met de bestaande operationele velden. De drag-toolbar staat niet meer over kaartlinks. Bij meerdere actieve dienstverbanden kan Contract en salaris per dienstverband worden gewisseld en wordt de salarisreveal per `employmentId` geladen. `check:i18n`, strict typecheck, ESLint en productiebuild zijn geslaagd. Niet gedeployed of gepusht.

## Update 2026-07-29: dienstverbandweergave op medewerkerdashboard

Het medewerkerdashboard toont nu per dienstverband actuele projectiedata en een duidelijke status. Regels zijn volledig klikbaar naar het dienstverbanddetail en behouden een terugpad naar het dashboard; bij geen actieve dienstverbanden verschijnt een afsluitingsmelding en voor geautoriseerde gebruikers een link naar de bestaande aanmaakwizard. De persoonsheader toont geen functie, afdeling of manager; de dienstverbandheader toont het medewerkertype naast het statusblok. Statuslogica voor actief, toekomstig, beëindigd en geannuleerd heeft drie gerichte tests. Typecheck, ESLint, i18n-pariteit en productiebuild zijn geslaagd. Niet gedeployed of gepusht.

## Release-status 2026-07-28

Branding-migratie `20260728110000_administration_branding.sql` is remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; tabel, bucket, RLS, roltoewijzing en `use_company_theme` zijn live gecontroleerd. Applicatieversie: `1.20260728.5`. Commit `f650279` staat op `origin/main`; Vercel production deployment `dpl_FPXqx9mrjiY5aDo1dN2kSRJAXdZj` is `READY`.

## Update 2026-07-28: dienstverbandprojectie en bedrijfsstijl

De medewerkerdetailtab Dienstverbanden gebruikt nu dezelfde tenant-brede, geautoriseerde dienstverbandprojectie als de medewerkerslijst; Lina Bakker met twee dienstverbanden wordt daardoor volledig getoond. Dienstverbandkaarten zijn volledige detailkoppelingen met een duidelijke detailactie, en klikbare lijst-/kaartinteractie gebruikt consequent de handcursor.

Onder Admin instellingen → Platform en uitbreidingen is lokaal een bedrijfsinstellingenpagina toegevoegd. De eerste harmonica bevat bedrijfskleuren en een privé logo-upload; de bedrijfsstijl wordt als standaardthema toegepast en kan in persoonlijke instellingen worden overschreven. De lokale migratie `20260728110000_administration_branding.sql` en gegenereerde type-uitbreiding staan klaar. Remote toepassen, advisors en officiële typegeneratie blijven open totdat daarvoor expliciet toestemming is gegeven. Typecheck, ESLint, i18n-pariteit en productiebuild zijn lokaal geslaagd; deployment, push en commit blijven uitgesteld.

## Update 2026-07-28: werkurentypen bij verlofregels

Werkurentypen hebben nu drie algemene instellingen, gedeelde beperkingstypen met overuren en uitzonderingen voor één of meerdere administratie-medewerkers met selfservice-keuze. De geavanceerde tab blijft leeg voor toekomstige instellingen. Migratie `20260728072505_work_hour_type_settings_and_restrictions.sql` is remote toegepast en de officiële types zijn opnieuw gegenereerd. Typecheck, i18n en de gerichte schema-tests zijn geslaagd. Versie `1.20260728.4`; deployment, push en commit blijven uitgesteld.

Afronding: ESLint, volledige testset (384 tests) en productiebuild zijn geslaagd. De anonieme instellingenroute is op poort 3000 gecontroleerd met 0 console-errors; alleen een bestaande preload-warning blijft open.

## Update 2026-07-28: aparte bonusregels voor leeftijd en anciënniteit

De gewone opbouweditor accepteert nu uitsluitend `CONTRACT_HOURS` en `WORKED_HOURS`. Leeftijd en anciënniteit zijn als afzonderlijke bonusregeltegels uitgewerkt. Elke tegel toont de gekoppelde profielkeuze, trigger, timing, pro-rata-instelling en één of meer unieke traptreden. De catalogus/API levert de traptreden mee; de schema-constraint voorkomt dat de legacy-enumwaarde `AGE_SENIORITY` nog voor een gewone regel wordt gebruikt. De pure engine bevat selectie van de hoogste blijvende trede, triggerdatum, FTE-relatieve toekenning en pro-rata in het eerste triggerjaar.

Migratie `20260728065641_separate_bonus_accrual_basis.sql` is remote toegepast op de gekoppelde Supabase-testdatabase en als `applied` geregistreerd. Live controle bevestigde de constraint, `AGE`/`SENIORITY`-enums, RLS op beide bonustabellen en de rollback-contracttest. Advisors geven alleen bestaande waarschuwingen buiten deze wijziging. Typecheck, i18n en 20 gerichte tests zijn geslaagd. Applicatieversie `1.20260728.3`; lint, volledige tests, productiebuild en ingelogde browsercontrole moeten nog worden uitgevoerd. Deployment, push en commit blijven bewust uitgesteld.

## Update 2026-07-28: verloftype-instellingen en opvolgende opbouwregels

De verloftype-editor bevat nu de uitgebreide algemene instellingen zonder afwezigheid-specifieke opties. De kleurkeuze gebruikt dezelfde uitgebreide tokens als overuren en toont bestaand gebruik. De tab Beperkingen toont de opbouwketen met ingangsdata, voorgangerselectie, basis (contracturen, werkuren of voorbereid leeftijd/anciënniteit), periode, moment, hoeveelheden, één of meer werkurentypen, pauzes, vervaltermijn en een samenvatting. Bestaande versies blijven alleen-lezen; een opvolger sluit de voorganger op de nieuwe startdatum. De geavanceerde tab is als latere uitbreidingsplek gemarkeerd.

Uitzonderingen zijn administratiegebonden, ondersteunen één of meerdere medewerkers, selfservice, geen opbouw of een aangepaste hoeveelheid, tonen een samenvatting en worden na bewaren/annuleren opnieuw geladen met paginering van tien regels.

De migraties `20260728062208_leave_accrual_rule_basis_and_leave_type_settings.sql` en `20260728063339_leave_accrual_rule_age_seniority_rpc.sql` zijn uitgevoerd op de gekoppelde Supabase-testdatabase en als `applied` geregistreerd. Live controle bevestigde `AGE_SENIORITY`, vijf nieuwe verloftype-instellingen, de hoeveelheidconstraint, successor-RPC en bestaande RLS op verloftypen en opbouwregels. Advisors tonen alleen eerder bekende waarschuwingen buiten deze slice. `packages/db/types.ts` is opnieuw gegenereerd. Typecheck, ESLint, i18n-pariteit en 382 tests zijn geslaagd; productiebuild en ingelogde browsercontrole blijven nog open. Applicatieversie `1.20260728.2`; deployment, push en commit blijven bewust uitgesteld.

## Update 2026-07-28: verlofopbouw en overwerkbeheer lokaal uitgebreid

De verlofopbouwcatalogus gebruikt nu duidelijk gemarkeerde actieve tabs, een werkende driepuntmenukaart met kleurgebruik-overzicht en een uitgebreidere kleurkeuze. Bestaande verloftypen, werkurentypen en opbouwregelversies zijn in de UI alleen-lezen; archiveren en een successor voor opbouwregels blijven de expliciete mutatiepaden. De migratie `20260728052250_configure_overtime_restrictions_and_immutable_catalog.sql` voegt immutable database-triggers toe en introduceert administratiegebonden overwerkconfiguratie met een globale limiet (`UNLIMITED`, maanduren, jaaruren of contracturen × factor), managernotificatie, selfservice en medewerkeruitzonderingen inclusief `mag geen overuren schrijven`. De uitzonderingendialoog ondersteunt één of meerdere medewerkers; de lijst wordt na toevoegen vernieuwd en toont medewerkernaam en beperkingstype.

Lokaal geslaagd: strict typecheck, ESLint, i18n-pariteit, 380 tests en productiebuild. De migratie is toegepast op de gekoppelde testdatabase; tabellen, enum, RLS/policies, audittriggers en immutable triggers zijn live gecontroleerd. De nieuwe migratie staat als `applied` in de remote historie. Advisors tonen alleen bestaande waarschuwingen buiten deze slice. `packages/db/types.ts` is officieel opnieuw gegenereerd; alleen ingelogde browsercontrole blijft open. Applicatieversie `1.20260728.1`; deployment blijft bewust uitgesteld.

## Update 2026-07-27: interactieve reminders

De Tijdhub heeft naast de klok een compacte reminderknop met teller, popover en directe link naar Reminderbeheer. `/reminders` ondersteunt zoeken, statusfiltering inclusief oudere reminders, sortering, kleurcodering op urgentie, multi-selectie met bulk afronden, detailmodal en links naar medewerkerdossiers. De weergave blijft gebaseerd op echte, server-side geautoriseerde en administratiegebonden reminders; er is geen fake data toegevoegd. Lokale tests, i18n, strict typecheck, lint, build en een ingelogde browsercontrole zijn geslaagd.

## Update 2026-07-26: éénknopswissel employment-header

De employmentdetailheader heeft nu één wisselknop voor de compacte en uitgebreide weergave, gelijk aan de medewerkerdetailheader. De knop toont steeds alleen de beschikbare tegenactie: **Compact** of **Uitgebreid**. Versie `1.20260726.5`; typecheck, lint, versiecheck en lokale runtimecontrole zijn geslaagd. Deployment blijft bewust uitgesteld.

## Update 2026-07-26: custom fields en functiecatalogusbeheer

De HR Admin-instellingen bevatten nu een lijst-eerst-beheer voor custom fields en functies. Custom fields zijn bewerkbaar op label, landcode, toegang en overige niet-technische instellingen; de technische sleutel en het veldtype blijven onveranderlijk. Nieuwe velden openen in een collapsed venster met een live preview onderaan. Activeren/deactiveren blijft databasebehoudend en inactive velden worden uit medewerkerformulieren gefilterd. Verwijderen vereist bevestiging en wordt server-side geblokkeerd zodra waarden het veld gebruiken. Functies hebben via `job_group_jobs` een many-to-many-relatie met functiegroepen, zonder start-/einddatum in de UI. Beide catalogi ondersteunen active/inactive, CRUD en gebruikscontroles bij verwijderen. De drie nieuwe migraties zijn remote toegepast op de testdatabase; de RLS-policies zijn gescheiden per actie en de nieuwe koppeltabel heeft scope-indexen. Versie `1.20260726.4`; deployment blijft bewust uitgesteld.

## Update 2026-07-26: employmentlijst, dienstverbandvenster en dashboard-refresh

Deze slice is lokaal geïmplementeerd. Dienstverbandkaarten hebben nu duidelijke wijzigingsactie, responsive tweekolomsweergave en datum/primary-sortering; de overbodige teller en verwijderactie zijn weg. De dienstverbandkop en medewerkerkop ondersteunen uitgebreid/compact, met e-mail en telefoon in de uitgebreide variant en expliciete dienstverbandcontext. De overview toont **Werk in uitvoering**; follow-ups en het venster More about this employee zijn volledig uit de actieve codeflow verwijderd. Het dashboard laadt de widgets één keer server-side in plaats van via de foutgevoelige streaminglaag, zodat de refreshlus stopt. Versie `1.20260726.3`; deployment blijft bewust uitgesteld. Typecheck, lint, i18n, 353 tests en productiebuild zijn geslaagd. De lokale server draait op poort 3000 en de open interne browser-tab bleef vijf seconden zonder waarschuwingen of fouten.

## Update 2026-07-26: medewerkerdetail, notities en reminders

De medewerkerdetailwijzigingen zijn volledig lokaal geïmplementeerd. Notes staat na Dossier en is server-side beperkt tot HR Admin en Manager; beide rollen kunnen lezen en bewerken, alleen HR Admin kan verwijderen. Profile/external links zijn naar het medewerkerdashboard verplaatst, Additional Information staat als eigen tab na Relations en de kop toont functie, afdeling, manager en groene actieve status. Reminders tonen eerst de lijst en hebben beschrijving, standaard datum/tijd, verschuifknoppen, wijzigen en verwijderen. De twee employee-notes-migraties zijn remote toegepast op de testdatabase en de RLS/grants zijn gecontroleerd. Versie `1.20260726.2`; deployment blijft bewust uitgesteld. Volledige tests, lint, strict typecheck, i18n, build en browsercontrole zijn geslaagd.

## Update 2026-07-26: Personal Details beheer en adresreminders

De Personal Details-formulieren zijn gegroepeerd en uitgelijnd; Adressen, Bankaccounts en Relaties tonen nu eerst de bestaande gegevens en daarna de actie om toe te voegen. Bestaande records kunnen via dezelfde tab worden gewijzigd en verwijderd, met bescherming tegen het verwijderen van het enige actieve adres. Adresaanmaak kan transactioneel directe reminders publiceren naar de geselecteerde HR Admin-, Manager- en Medewerker-ontvangers. De remote databasefunctie is expliciet geautoriseerd, de trigger en privileges zijn gecontroleerd en de bestaande bankrekeningfunctie blijft standaard alleen beschikbaar voor HR Admin via `bank-account:write`. Versie `1.20260726.1` is verhoogd. De volledige lokale testset (97 bestanden/354 tests), ESLint, strict typecheck, i18n, SQL-contractproef en productiebuild zijn geslaagd; deployment is bewust uitgesteld.

## Update 2026-07-25: adresinvoer

De nieuwe Nederlandse/internationale adresinvoer is lokaal gebouwd met landkeuze, debounce-suggesties, PDOK-postcodeaanvulling, server-only provideradapters, handmatige fallback, herkomstmetadata en internationale adresregels. De zoek-UX focust standaard het adreszoekveld, gebruikt zoek-/locatie-iconen, houdt land en resultaten netjes uitgelijnd en verduidelijkt de postcode+huisnummer-actie als het automatisch invullen van straat en plaats. Migratie `20260725132351_address_input_internationalization.sql` is op 2026-07-25 toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De live schema-controle bevestigde de nieuwe kolommen, vijf constraints, index en één gemigreerd adresrecord; types zijn opnieuw uit de gekoppelde database gegenereerd. Lint, strict typecheck en i18n-controle zijn geslaagd. De browsercontrole kon niet afronden omdat de lokale devserver op poort 3000 geen HTTP-response teruggaf.

## Update 2026-07-24: medewerkerdashboard tweede UI-slice

Het medewerkerdashboard bevat nu foto-/genderfallbacks, lazy salaris-reveal via een apart geautoriseerd endpoint, echte reminders onder contract/salaris, vaste brede/smalle kolommen met persoonlijke drag-and-drop-volgorde en een handmatige activiteitenfeed. Activiteitnotities worden tenant-/medewerkergebonden opgeslagen via migratie `20260724160000_add_employee_activity_entries.sql` met `employee-activity:read/write` en RLS. De migratie en hardeningmigratie `20260724172716_harden_employee_activity_entries.sql` zijn remote toegepast; grants, RLS, policies, FK-indexen en advisorbevindingen zijn gecontroleerd en `packages/db/types.ts` is opnieuw gegenereerd.

Gerichte tests, ESLint, strict TypeScript, i18n-pariteit en productiebuild zijn geslaagd. De ingelogde Chrome-controle bevestigde salaris-hover/verbergen, persistente en herstelde widgetvolgorde, echte lege reminderdata en de beschikbare man/vrouw-avatarfallbacks zonder consolefouten. De anonieme salarisroute weigert met `401`. Een beperkte-rol-browserdeny en `OTHER`/`PREFER_NOT_TO_SAY`-fixture blijven open omdat remote alleen één actieve `TENANT_ADMIN` en geen passende genderfixtures bevat.

## Update 2026-07-24: medewerkerdashboard en navigatiekoppelingen

De eerste UI-slice van `docs/requirements/core-hr/MEDEWERKER_DASHBOARD.md` staat op `/employees/[employeeId]`: het dashboard gebruikt bestaande geautoriseerde medewerkerprojecties, heeft een duidelijke knop naar de detailtabs en toont niet-bestaande modules als lege vensters zonder fake data. Medewerkerlijst, organogram, kalender en Insights (inclusief aankomende gebeurtenissen) openen nu dezelfde dashboardroute; de dashboardpagina biedt expliciet terugnavigatie naar medewerkerdetails. Server-side permission/RLS-verificatie en een ingelogde browsercontrole moeten nog per rol worden uitgevoerd.

## Update 2026-07-24: Inzichten-permissions, CSV en persoonlijke rapportvoorkeuren

`/insights` is nu ingedeeld in Medewerkers, Verlof, Verzuim en Overige rapportages. Iedere rapportage heeft een afzonderlijk permission in de rechtenmatrix; de lokale migratie `20260724095433_insights_report_permissions.sql` kent alle rapportrechten standaard toe aan `TENANT_ADMIN` en `HR_ADMIN`. De teller en navigatie volgen uitsluitend de werkelijk toegekende rapportrechten.

De vier live medewerkersrapporten gebruiken uitsluitend RLS-gebonden databasegegevens en hebben per geopend harmonica-item een CSV-export met de actieve filters. De pagina heeft kleurrijke KPI's/diagrammen, geen overbodige weergaveteksten of beschikbaarheidsbadge, een inklapbare actieve-selectiekaart en een persoonlijke optie om filters per rapport te bewaren. TypeScript en i18n-pariteit zijn geslaagd. De migratie staat remote; een ingelogde browsercontrole met een beperkte rol voor de nieuwe rechtenmatrix blijft open.

## Update 2026-07-23: tabgerichte medewerker- en dienstverbandperformance

De medewerkerdetailroute en dienstverbanddetailroute laden alleen de actieve tabprojectie. Persoonsgegevens, dienstverbandoverzicht, salaris, historie en HR-events worden niet meer standaard op iedere tabwissel gelezen. Onafhankelijke autorisatie-/databasereads lopen parallel; dubbele employee-employment-permissionread is verwijderd. Beide detailroutes hebben een route-skeleton en dynamische medewerker-/dienstverband-/tablinks prefetchen niet meer collectief.

Architectuurbesluit ADR-0004 (`docs/decisions/ADR-0004-performancebudgetten-en-tabprojecties.md`) beschrijft de p75-budgetten, meetmethode, lazy tabdata, loading states en prefetchgrens voor toekomstige schermen.

Verificatie: 90 Vitest-bestanden/336 tests, ESLint, strict TypeScript, i18n-check en productiebuild geslaagd. Commits `a433a46` en `6405d0f` staan op `main`; Vercel `dpl_Gg9oC6KQdksDBkwoD8DxRiaTcAze` is `READY`. Runtime-errorscan: geen fouten. Chrome had voor de laatste prefetchmeting een niet-bestuurbare ingelogde tab; de gemeten individuele eindlatencies na die fix zijn daarom nog open.

## Update 2026-07-23: performance-slice Medewerkerslijst, Organogram en Kalender

De Medewerkerslijst gebruikt nu de security-invoker RPC `list_employee_overviews` om scope, medewerker, dienstverbandhistorie en actuele organisatieplaatsing in één leesronde op te halen. De bestaande dienstverbandstatus- en archieffilters blijven server-side correct; de RPC heeft een remote structuurproef op unieke rijen en geldige JSON-historie. Voor Medewerkers, Organogram en Kalender zijn route-specifieke laadstaten toegevoegd. Dashboard en Instellingen zijn bewust niet gewijzigd.

Verificatie: remote Supabase-migratie `optimize_employee_overview`, Supabase performance/security-advisors, 90 Vitest-bestanden/336 tests, ESLint, strict TypeScript, i18n-pariteit en productiebuild geslaagd. De productieklikmeting volgt na de nieuwe deployment.

Actuele verlofstatus (2026-07-22): de verlofconfiguratie, priority/FIFO-aanvraagflow vanuit `/hr-calendar` en centrale ledger-RPC's/API zijn geïmplementeerd en remote gecontroleerd. De settingspagina bevat ook de jaarsturing. De huidige demo is met Lina Bakker geboekt en in de kalender geverifieerd; feestdagen worden in booking en preview overgeslagen. Resterend zijn vooral de volledige ledger/auditformulieren, toekomstige opbouwprojectie voor maandelijkse regels en later ESS, managerworkflow en notificaties.

 Laatste controle: 2026-07-22. Verlofkleuren voor verlof-/werkuren-/overurentypen, kalenderprojectie en lokale poort-3000-smoke zijn gevalideerd; de bestaande migraties voor dossieruploadregels, weeknummering en Star Performers blijven live en transactioneel getest.

## Fundering

| Onderdeel | Status | Bewijs / resterend werk |
|---|---|---|
| npm-workspace en Next.js-app | GEÏMPLEMENTEERD | `apps/hr-suite` draait verplicht op poort 3000 |
| Supabase SSR-clients | GEÏMPLEMENTEERD | Browser-, server- en strikt server-only adminclient aanwezig |
| Wachtwoordauthenticatie | GEÏMPLEMENTEERD | E-mail/wachtwoord, Google OAuth-start, herstelactie, callback en sign-out aanwezig; app blijft invitation-only |
| Uitnodigingsmodel | GEDEELTELIJK | Tenant-/administratiescope, privé-/businessmail en acceptatie zijn gebouwd; echte mailverzending vereist nog `SUPABASE_SECRET_KEY` en eigen SMTP |
| i18n | GEÏMPLEMENTEERD | Nederlands is standaard, Engels heeft verplichte pariteit; iedere namespace heeft een afzonderlijk JSON-bestand per taal |
| Persoonlijke thema's | GEÏMPLEMENTEERD | Zes thema's op een afzonderlijke persoonlijke instellingenpagina, DB-first voorkeuren en cookie/default-fallback |
| Gedeelde databasetypes | GEÏMPLEMENTEERD | `packages/db/types.ts`; opnieuw genereren na iedere migratie |
| Documentatierouting | GEÏMPLEMENTEERD | Root `AGENTS.md`, architectuurindex, deze status en verplichte `CURRENT_CONTEXT.md`-overdracht voor nieuwe/fork-chats |

### Hotfix 2026-07-29: medewerkerlijst en administratiecontext

De medewerkerlijst schrijft zoektekst niet meer naar `user_preferences`; zoeken blijft URL-state en veroorzaakt daardoor geen 400 meer op `PATCH /api/preferences/employees`. Na een succesvolle administratie-wissel navigeert de UI altijd naar `/dashboard/start`, zodat de geselecteerde administratie direct als nieuwe startcontext wordt geladen.

| Tijdhub en reminders | GEDEELTELIJK | Klokvoorkeuren, Tijdhub, persoonlijke en HR-reminders, RLS, API-routes en live browserflow zijn aanwezig. De afzonderlijke databaseproef en regressietest moeten nog worden herhaald; de klok voorkomt SSR-hydrationverschillen en de sidebar blijft op viewporthoogte staan. |
| Persoonlijke Liquid Dashboard | RETIRED IN CODE | De globale persoonlijke dashboards, widgetindeling, CRUD/API en widgetcatalogus zijn door AN-0 verwijderd. De forward migration voor de vier legacy-tabellen staat lokaal klaar maar is nog niet op TEST toegepast; zie de frozen Analyse-roadmap. |
| HeRa AI-agent | GEÏMPLEMENTEERD | Data-first orchestratie, echte rol/permissioncontext, owner- en tenantgebonden memory/voorkeuren, beheer-UI, toon/detail/senioriteit, salaris-/medewerker-/dienstverband-/organisatietools en vijf bevestigbare schrijftools zijn gebouwd. RLS en serverautorisatie zijn live transactioneel negatief getest; lokale, preview- en Production-eindtests zijn geslaagd. |

## Core HR, organisatie en autorisatie

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Employee-persoonskaart | GEÏMPLEMENTEERD | Lijst met opgeslagen detail/compact-, sorteer-, arbeidsstatus- en archiefvoorkeuren (zoekterm niet opgeslagen), volledige klikrij, wizard, detail met hoofdtabbladen inclusief Dashboard vóór Persoonsgegevens, effectieve dienstverbandssamenvatting, verborgen salaris-hover, mutaties, adresgeschiedenis, relaties, gemaskeerde bankrekening, foto-beheer en capabilities zijn aanwezig |
| Medewerkerdashboard | GEIMPLEMENTEERD / WACHT OP ACCEPTANCE | Bestaande dashboardprojectie, lazy salarisreveal, reminders, activity-feed, persoonlijke drag-and-drop-widgetvolgorde, geautoriseerde velden, documents/payslips, notes, absence/processes, journeys en rustige Foundation-kaarten zijn aanwezig. De globale dashboard-editactie is verwijderd; Personal-edit blijft contextueel. Branch-preview desktop/390px en default/LinkedHR blijven open voor acceptance. |
| Dubbele-medewerkercontrole | GEÏMPLEMENTEERD | Tenantgebonden BSN-HMAC of gewogen persoonsgegevens, expliciet besluit en auditlog; exact BSN-matchen vereist `BSN_HASH_KEY` |
| Afdelingenboom | GEÏMPLEMENTEERD | Beheer staat onder de HR-admin instellingen/stamgegevens; lezen, aanmaken, wijzigen/archiveren, RLS en database-cyclusbeveiliging werken |
| Managementrollen | GEÏMPLEMENTEERD | Tenantrollen zijn beheerbaar; globale systeemrollen zijn database-breed onveranderlijk |
| DepartmentManagement | GEÏMPLEMENTEERD | Effective-dated API/UI, overlapbeveiliging, RLS en audit aanwezig |
| EmployeeOrganization | GEÏMPLEMENTEERD | Tijdsgebonden plaatsingen zijn aan parallelle dienstverbanden te koppelen en beheerbaar |
| Organogram | GEDEELTELIJK | Afdelingsview, managerrelatie-view en functiegroep → functie → star performer → medewerker zijn technisch gebouwd, inclusief view-keuze, URL-state en opgeslagen filtervoorkeur. Een ingelogde visuele datasetcontrole voor de nieuwe views blijft open. |
| Permissionmatrix | GEÏMPLEMENTEERD | Zoekbare rollenwerkruimte, gegroepeerde functiepunten, dirty/herstel-flow, grafische dekkingsheatmap, tenantrollen, API, RLS en audit aanwezig |
| Vrije velden (Employee) | GEÏMPLEMENTEERD | Definities, opties, beheer-CRUD, landcode, preview, actieve status, audience-toegang, atomaire nummering, waarden-API/UI en JSONB-spiegeling |
| BSN-beveiliging | GEÏMPLEMENTEERD | Afzonderlijke RLS-tabel; HR-admin en medewerker-self mogen lezen, managers niet; reveal wordt geaudit |
| Autorisatiehelper en managementscope | GEÏMPLEMENTEERD | Selfrechten, actieve rollen, afdelingsscope en RLS zijn getest |
| Managerresolver | GEÏMPLEMENTEERD | Override, deputy en parent-escalatie zijn getest |

## Multitenancy en administraties

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Absolute tenantgrens | GEÏMPLEMENTEERD | Expliciete toegang, samengestelde tenant-FK's, RLS en negatieve isolatietests zijn live |
| Hiërarchische administraties | GEÏMPLEMENTEERD | Parentconstraint, tenantgelijkheid, cyclusbeveiliging en drie demo-administraties zijn live |
| Administratiecontext en switcher | GEÏMPLEMENTEERD | Resolver, context-API en HTTP-only cookie blijven server-side gecontroleerd. De sidebar toont alleen de HR-groep; administratiegebonden instellingen gebruiken `/settings/administration` met kaartkeuze, laatst gekozen administratie en een vaste contextbalk. |
| Stamtabellenscope | GEÏMPLEMENTEERD | Afdelingen, functies, functiegroepen, uitdienstredenen per land en vrije velden zijn HR-groepgebonden. Loonschalen/revisies, kostenplaatsen, contractcatalogi en documentcategorieën blijven administratiegebonden. |
| Onomkeerbaar combineren | GEÏMPLEMENTEERD | Alleen `SEPARATE → COMBINED`; database blokkeert terugkeer |
| Demo-omgevingen | GEÏMPLEMENTEERD | Hoofdtenant: 3 administraties/50 medewerkers; tweede tenant: 1 administratie/10 medewerkers |

## Dienstverband, IKV en tijdlijnen

| Onderdeel | Status | Resterend werk |
|---|---|---|
| 0..n dienstverbanden per medewerker | GEÏMPLEMENTEERD | Geen dienstverband, toekomstig, actief, voormalig, herintreding en parallel zijn gemodelleerd |
| Parallel binnen één administratie | GEÏMPLEMENTEERD | Meerdere gelijktijdige dienstverbanden zijn toegestaan en als demo aanwezig |
| IKV los van dienstverband | GEÏMPLEMENTEERD | `income_relationships` plus tijdsgebonden koppeltabel; één IKV kan gecontroleerd aan dienstverbanden worden gekoppeld |
| Arbeidsvoorwaarden, urenafspraak, werkpatroon, salaris en kostenverdeling | GEDEELTELIJK | Atomaire apply/rollback-RPC's, afzonderlijke 1–4-weeks werkpatroontijdlijn met exacte urencontrole, TWK-splitsing, 100%-kostenverdeling, audit en mutatieformulieren zijn aanwezig. Eén multi-domein-RPC voor direct gecombineerde wijzigingen volgt nog. |
| Uitdienstmelding | GEÏMPLEMENTEERD | Workflow met wettelijke reden, datum en bevestiging; beëindiging wordt pas definitief via de confirm-RPC |
| Bestaande medewerker gebruiken en herintreding | GEÏMPLEMENTEERD | Identity-match voorkomt stil dupliceren. Een match zonder dienstverband kan worden aangevuld of met een nieuw Employment worden vervolgd; een afgesloten match kan als herintreder worden gebruikt met een optionele kopieerkeuze voor het nieuwe Employment |
| Medewerker- en dienstverband-UI | GEÏMPLEMENTEERD | Medewerkerkaart toont effective-dated dienstverbanden met anciënniteit vanaf de afwijkende datum en actuele samenvatting (afdeling, functie, uren, CAO en medewerkerstype). De dienstverbanddetailroute bundelt basis/IKV en de selecteerbare contractreeks op Overzicht; rooster, salaris, organisatie en kostenverdeling gebruiken uniforme, wijzigbare tijdlijnen. Persoonsgegevens gebruiken doorzoekbare landkeuzes voor geboorteland en nationaliteit, met het administratie-standaardland als beginwaarde. De verplichte basisgegevenscontrole en volledige dienstverband-/contractwizard zijn aanwezig. Aanmaak van een volledig nieuwe persoonskaart na 'geen match' blijft een afzonderlijke toekomstige flow. |
| Ketenadvies nieuwe contracten | GEÏMPLEMENTEERD | Datumgebonden 2020/2028-regels, bekende interne/externe historie, niet-blokkerende waarschuwing en verplichte motivering bij risico of onvolledige historie. |
| Volledige dienstverbandpublicatie | GEÏMPLEMENTEERD | De wizard controleert eerst verplichte medewerkergegevens en publiceert daarna Employment, IKV-koppeling, eerste contract, arbeidsvoorwaarden, rooster, salaris, plaatsing en exact 100% kostenverdeling in één transactie. |
| Functie- en salarisschaalbeheer | GEÏMPLEMENTEERD | Functies en salarisschalen hebben volledig gescheiden routes en schermen. Functies tonen een standaard ingeklapt zoek-/filterblok, losse aanmaakacties en een grafisch groepsoverzicht; groepsbewerking toont de gekoppelde functies. Schalen hebben een vrij aantal treden en gepubliceerde revisies zijn onveranderlijk. |
| Tijdkaart medewerker | GEÏMPLEMENTEERD | De dienstverbandhistorie toont alle tijdvakken responsief op één tijdas, met veilige salarisprojectie. |
| HR-maandkalender | GEÏMPLEMENTEERD | Groot adaptief desktop/tabletraster met actieve medewerkers, foto's, rooster/niet-werkdagen, feestdagen, reminders, HR-wijzigingen, opgenomen verlof, goedgekeurde werkuren/overuren, ingestelde kleuren, typepatronen, gecombineerde dagdetails, zoekfilters en 10/25/alle-max-100 paginering op `/hr-calendar`; dagkolommen zijn uitbreidbaar voor acties. |

## Documentdossiers

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Medewerkersdossier | GEÏMPLEMENTEERD | Private opslag, metadata, actieve Cloud tags uit `star_performer_tags`, signed downloads, soft-delete/herstel en auditbare toevoeger/verwijderaar. |
| Documentzichtbaarheid | GEÏMPLEMENTEERD | Permission én doelgroep; medewerker, rol en afdelingstak zijn combineerbaar en server-side/RLS afgedwongen. |
| Vervaldatum en reminders | GEÏMPLEMENTEERD | Persoon, rol en organogramdoelgroepen worden gecombineerd en naar gededupliceerde ontvangers gepubliceerd. |
| Globale documenten en AI-compliance | NIET GESTART | Bulk-loonstroken, globaal beleid, OCR/RAG en compliance-audits blijven een afzonderlijke slice. |

| Bedrijfsdocumenten | GEIMPLEMENTEERD | Lijst per actieve HR-groep, private opslag, HR-admin upload/delete, signed downloads, viewer en dashboardwidget. |
| Loonstroken | GEDEELTELIJK | Eigen medewerkerkaart-tab, employment-koppeling, bronvelden, private opslag en permission/RLS-readpad zijn aanwezig; Nmbrs/Loket- en bulkimport volgen later. |
| Globale documenten en AI-compliance | GEDEELTELIJK | Bedrijfsdocumenten zijn gerealiseerd; OCR/RAG en compliance-audits blijven een afzonderlijke slice. |

## Instellingen en tenantmodules

De functiecatalogus is verder aangescherpt naar een lijst-eerst scherm met zoeken, sortering, functiegroepfilter en modal-CRUD. De async formulierreset is veilig gemaakt door `currentTarget` vóór de request te bewaren; desktop en 390px zijn lokaal gecontroleerd.

| Bedrijf gegevens en locaties | GEÏMPLEMENTEERD | `/settings/company-data` is toegevoegd aan de HR-beheerhub. Bedrijfsadres en locatiebeheer gebruiken `administration_company_data` en `administration_locations` met serverautorisatie, RLS, actieve status, gebruiksblokkade op verwijderen en toekomstige `employee_organizations.location_id`-koppeling. Beide adresformulieren hebben dezelfde intelligente NL/internationale invoer als medewerker-woonadressen, inclusief optionele internationale adresregel 2. Alleen de HR-adminrol `TENANT_ADMIN` krijgt `company-data:read` en `company-data:write`. |
| Bedrijf en locatie per dienstverband | GEDEELTELIJK | De lokale slice voegt de tab `/employees/[employeeId]/employments/[employmentId]?tab=company-location` toe. Eén bedrijfsadres wordt als alleen-lezen bedrijfskaart getoond; bij meerdere actieve locaties is er per dienstverband een zoekbare locatiekeuze met overzicht, wijzigen en opvolgende ingangsdatum. De lokale migratie `20260802210500_manage_employment_company_location.sql` bevat RLS-uitbreiding, locatievalidatie en beide mutatie-RPC's. Remote toepassing en authenticated browserbewijs staan open. |

## Rapportages en Inzichten

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Rapportagecatalogus | GEDEELTELIJK | `/insights` staat onder Kalender in de navigatie met rapport-specifieke filteropzet, sortering en URL-selectie. Medewerkerprojecties, Aankomende gebeurtenissen, het Verzuimrapport en de Bradford-factor gebruiken geautoriseerde productiedata; verlof, voorziening en WvP blijven open. |
| Medewerkerbestandrapporten | GEDEELTELIJK | Personeel per afdeling, geslacht, leeftijd en reden uit dienst lezen via `employee:read` en bestaande RLS-scoped medewerkers-, dienstverband-, organisatie- en terminationdata. Visualisaties en detailtabellen zijn live; `insights:read`, privacydrempel en exports volgen. |
| Verzuim, voorziening en WvP | GEDEELTELIJK | De kernverzuimslice is remote toegepast. `/settings/absence` beheert een HR-groepbrede drempel en standaardcasemanager plus administratiegebonden eigen WvP-taaktemplates via `absence_task_templates` met RLS/audit, activatie/deactivatie en servervalidatie. Startpagina en `/insights?report=absence` tonen actieve dossiers, roostergewogen maand/jaar-rapportage, afdelingsfilter en Excel-export; `/insights?report=absence-bradford` voegt Bradford-factoranalyse toe voor laatste 52 weken, dit jaar en vorig jaar met team/afdelingsfilter, risicobanden, uitlegmodal en Excel-export. Wettelijke milestones/casustaken/dossier, voorziening, bewaarmatrix, payroll/13-wekenmodel en externe integraties blijven open. |
| Rapportexport | GEDEELTELIJK | Medewerkerprojecties en Aankomende gebeurtenissen leveren Excel-compatibele CSV op. Excel/PDF en immutable exportaudit volgen later. |

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Verlofopbouw-engine | GEDEELTELIJK | Schema/RLS, pure engine/report, catalogus/opvolgers/voorrangsregels, kleuren, HR-admin-aanvragen, FIFO-booking, feestdaguitsluiting en de centrale ledger-operaties staan in de migraties `20260722142551_add_leave_engine_foundation.sql`, `20260722151920_add_leave_configuration_mutation_functions.sql`, `20260722173000_add_work_hour_type_colors.sql`, `20260722190000_add_leave_request_booking_engine.sql`, `20260722192000_add_leave_ledger_operations.sql`, `20260722192100_seed_leave_demo_year_controls.sql` en `20260722192500_skip_holidays_in_leave_requests.sql`, met routes onder `/api/leave` en UI onder `/settings/leave-accrual` en `/hr-calendar`. Toekomstige opbouwprojectie en volledige saldo-auditformulieren blijven open. |
| Persoonlijke instellingen | GEÏMPLEMENTEERD | Afzonderlijke pagina voor taal, thema, Tijdhubklok, datumformaat (DMY/MDY/YMD) en tijdformaat (24H/12H) voor iedere ingelogde gebruiker; voorkeuren worden centraal toegepast op relevante datum- en tijdweergaven. Gedeelde knoppen gebruiken een iOS-geïnspireerde glasstijl; medewerker-tabs verbergen de native scrollbar met behoud van horizontale bediening. |
| HR-admininstellingenhub | GEÏMPLEMENTEERD | Eén permission-gestuurde hub met standaard gesloten onderdelen. `/settings/administration` kiest administratiegebonden instellingen via kaartknoppen en onthoudt de laatste keuze. `/master-data` beheert Redenen uitdienst per land, documentcategorieën en tenant-relatietypen; functies en salarisschalen staan uitsluitend in hun eigen instellingenschermen. |
| Actieve extra modules | GEÏMPLEMENTEERD | HeRa, documenten en reminders tenantbreed schakelbaar; serverguards en restrictieve RLS bewaren data maar blokkeren gebruik. |
| Feestdagen en bedrijfsactiviteiten | GEÏMPLEMENTEERD | Nager.Date-preview/import per actieve HR-groep, jaar en land, lokale feestdagen, expliciet activeren/deactiveren, bedrijfsactiviteiten met naam/datum en weergave van eerstvolgende actieve kalenderitems in start- en medewerkerheader. Remote migratie, advisors en browserbewijs voor deze uitbreiding staan open. |

## Dashboard startpagina

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Gebruiker Startpagina | GEDEELTELIJK | `/dashboard/start` gebruikt echte medewerkers-, organisatie-, verzuim-, gebeurtenissen-, bedrijfsdocumenten- en reminderbronnen binnen de actieve administratie en rol/RLS-scope. Lopende verzuimgevallen bevatten nu medewerker, startdatum, duur en een link naar het verzuimdossier. Declaraties, contractsignering, assets en taken/Poortwachter volgen later. Een volledige rolmatrix blijft open. |

## Security en handmatige productieconfiguratie

## Vervolgslice medewerker, dienstverband en HeRa

- HeRa staat niet meer in de linker navigatie. De zwevende knop links onder opent een overlay; docken naar rechts en de breedte zijn gebruikersvoorkeuren die lokaal worden bewaard.
- De medewerkerkaart heeft een reminders-tab. Dienstverbanden openen als primaire knop, verwijderen is een bevestigde soft-delete en de teruglink bewaart de medewerker-brontab.
- Redenen uitdienst zijn onder `/master-data/end-reasons` per land beheerbaar met toevoegen, wijzigen, activeren/deactiveren en een blokkade wanneer een reden al is gebruikt. Nederland gebruikt de officiële codes 01, 02, 03, 04, 20, 21, 30, 32, 33, 34, 40, 41, 90 en 99; zonder landspecifieke inrichting geldt `Einde contract`.

## Dashboard widgetbibliotheek (historisch — AN-0 retired)

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Typed widgetcatalogus | GEÏMPLEMENTEERD | Catalogus bevat kern HR, dienstverband, documenten, beloning en organisatie/tijd; toekomstige verlof- en verzuimcategorieën blijven bewust leeg totdat brondata beschikbaar is. |
| Tenantconfiguratie en roltoegang | GEÏMPLEMENTEERD | HR-admin kan widgets tenantbreed activeren en per managementrol beschikbaar maken; wijzigingen zijn RLS-beveiligd en auditbaar. |
| Dashboardselectie | GEÏMPLEMENTEERD | Uitgeschakelde of niet-geautoriseerde widgets verdwijnen server-side uit bestaande dashboards; nieuwe widgets zijn uitbreidbaar via de registry. |
| Grafische basis | GEDEELTELIJK | Dashboard toont direct stabiele widgetcontouren, laadt aangesloten bronnen parallel met individuele Suspense-grenzen, toont globale voortgang en ondersteunt read-only refresh. De gecategoriseerde picker en vertaalde widgetmetadata zijn klaar; specifieke loaders en rijke datavisualisaties voor overige cataloguswidgets worden per datadomein verder gevuld. |
| Dashboardervaring | GEÏMPLEMENTEERD | Serverbootstrap voorkomt de dubbele eerste fetch; WELCOME, reminders, organisatie en medewerkers gebruiken bestaande betrouwbare bronnen. Niet-aangesloten bronnen tonen een vertaalde lege staat. Nieuwe dashboards starten leeg; de automatisch aangemaakte persoonlijke startdashboard behoudt de standaardindeling. |
| Medewerkerinstellingen-tegel | GEÏMPLEMENTEERD | De tegel op `/settings` opent een tijdelijke pop-up; de navigatielink `/employees` blijft ongewijzigd. |

- HeRa-migraties voor veilige memory-FK's, gebruikersvoorkeuren, berichtmetadata en indexen zijn live toegepast. Een transactionele rollbackproef bevestigde cross-user-isolatie, veilige gespreksverwijdering en owner-only voorkeurtoegang.
- HeRa gebruikt nooit service-role voor chattools. Tenant, gebruiker, administratie en permissions komen uitsluitend uit de server-side sessie; hostile scopevelden in modelargumenten worden geweigerd.

- Tijdhub/reminders: de drie migraties `20260716081000_add_time_hub_reminders.sql`, `20260716090000_fix_reminder_recipient_rls_recursion.sql` en `20260716092000_fix_reminder_publish_auth_lookup.sql` zijn live toegepast. Een RLS-recursie in de recipient-selectie en een niet-toegestane `auth.users`-lookup in publicatie zijn daarmee hersteld.
- Alle nieuwe publieke tabellen hebben RLS en policies in dezelfde migratie. Tenant- en administratiescope wordt zowel in de servicelaag als database-side afgedwongen.
- RLS-policyhelpers voor medewerkerssubresources en vrije veldwaarden hebben expliciete `EXECUTE`-rechten voor `authenticated`; dit is live hersteld in migratie `20260715173629_restore_employee_subresource_grants.sql` en met een regressiecontrole afgedekt.
- Supabase security advisor meldt alleen dat leaked-password protection uitstaat. Supabase biedt dit vanaf Pro; binnen het huidige abonnement is dit niet inschakelbaar en daarom als geaccepteerde abonnementsbeperking vastgelegd.
- `npm audit --omit=dev` meldt 2 moderate PostCSS-meldingen via `next@16.2.10`. De aangeboden `--force`-route installeert Next 9 en wordt daarom niet toegepast; opnieuw beoordelen zodra Next.js een compatibele gepatchte dependency levert.
- Voor echte uitnodigingsmails: stel `SUPABASE_SECRET_KEY` server-only in en configureer eigen SMTP in Supabase. Publiceer deze sleutel nooit als `NEXT_PUBLIC_*`.

## LiquidHR Control Plane — lokale basis 2026-08-02

`apps/liquidhr-control` is als zelfstandige Next.js-app toegevoegd en gebruikt lokaal altijd poort 3001. Gesloten wachtwoordlogin, platformrollen, dashboard, tenantlijst/detail, onboarding, gecombineerd/gescheiden administratiemodel, lifecyclecommando's, live omvang, gebruikssnapshots en append-only audit zijn gebouwd. De databasebasis en RPC-hardening zijn remote toegepast als `20260802172255_add_liquidhr_control_plane` en `20260802172601_harden_liquidhr_control_plane_rpcs`; vijf control-tabellen hebben RLS, publieke RPC's zijn `SECURITY INVOKER`-wrappers en privileged implementaties staan in `internal_security`. Edwin is als actieve `OWNER` gebootstrapt en database-types zijn opnieuw gegenereerd. Er is niet gedeployed.
- Voor exacte BSN-deduplicatie: `BSN_HASH_KEY` en `EMPLOYEE_PII_ENCRYPTION_KEY` zijn lokaal server-only gegenereerd. Stel in iedere publieke omgeving eigen stabiele waarden in en roteer alleen via een gecontroleerde datamigratie.
- Voor Google-login: activeer Google in Supabase en voeg de callback `https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1/callback` toe bij Google. Voeg daarna localhost en iedere publieke app-URL aan Supabase' redirect-allowlist toe.
- Edwin kan pas met wachtwoord inloggen nadat voor `edwin@editsolutions.nl` een wachtwoord is gezet via een uitnodiging of de herstelactie. Een sessie is per browser/profiel; een andere browser moet afzonderlijk inloggen.

## Verificatiebewijs

### HR-admin/stamtabellen en Cloud tags (2026-07-19)

- `/settings` gebruikt standaard gesloten accordions; teruglinks kunnen `?section=...` meegeven zodat de juiste sectie opent en naar beeld scrollt.
- `/master-data` beheert interne uitdienstredenen, documentcategorieën en tenant-relatietypen. Relatietypen zijn tenant-scoped met RLS en standaardseedrecords.
- Documentuploads bieden actieve `star_performer_tags` als Cloud-tagselectie; de verouderde uploadintroductie is verwijderd.
- Org-chart-lagen hebben extra verticale scheiding; organisatieroutes zijn zwaarder en medewerkerrelaties visueel onderscheiden.
- Live smokecheck voor de nieuwe tabel: RLS actief, vier policies, unieke tenant/code-index en 14 seedrecords. De repository-pgTAP-test staat klaar; de MCP SQL-runner heeft geen pgTAP-functies.

- Samengevoegde releasegate 2026-07-18: 79 Vitest-bestanden en 286 tests geslaagd; 18 gelijke NL/EN-namespaces, ESLint zonder waarschuwingen, strict TypeScript en de Next.js-productiebuild met 53 routes zijn groen.
- Verificatie 2026-07-19: gerichte ESLint `--fix` met cache op de in deze beurt gewijzigde organogrambestanden is geslaagd. Strict TypeScript, `check:i18n` en gerichte Vitest voor `app/api/organization-chart/route.test.ts`, `lib/organization-chart/schemas.test.ts` en `lib/organization-chart/projector.test.ts` zijn geslaagd. Runtimecontrole met `curl.exe -I --max-time 2` bevestigt een actieve devserver op `http://127.0.0.1:3000/`; `/employees` en `/organization-chart` redirecten zonder serverfouten naar login. Poort `3001` reageert niet en wordt niet door deze worktree gebruikt.
- Browsercontrole lokaal op poort 3000 met ingelogde Chrome-sessie: medewerkerinstellingenschermpje opent zonder navigatie; dashboard toont streamende widgets, voortgang eindigt op "Dashboard is bijgewerkt", refresh behoudt vijf widgetkaarten, editor/picker toont geen technische widgetcodes, widgetbeheer toont 41 vertaalde kaarten met actief/niet-actief en rollen. Desktop en 390px hebben geen horizontale overflow; console bevat geen errors.
- Supabase migration `20260718172051_grant_dashboard_widget_admin_permissions.sql` is toegepast; security advisor meldt alleen de bestaande waarschuwing dat gelekte-wachtwoordbeveiliging uitstaat. Performance advisor meldt bestaande INFO-meldingen over ontbrekende/indexen die nog niet gebruikt zijn.
- Release `1.20260718.3`: preview en productie zijn `READY`. De veilige anonieme instellingenredirect, de ingelogde HR-adminhub, tenantmodules, Nager.Date-preview, afzonderlijke persoonlijke instellingen en het gelokaliseerde maandraster met medewerkers, uren, filters en paginering zijn browsermatig gecontroleerd.
- Vercel Production van mergecommit `d9ff660` is `READY` op `https://liquid-hr-hr-suite.vercel.app`. Een frisse 390px-browsersessie bevestigde de veilige autorisatieredirect zonder overflow. De beschermde productie-UI is aansluitend ingelogd gevalideerd: versie `1.20260718.2`, alle drie tabbladen, 6 rollen, 12 functiegebieden, 103 functiepunttoekenningen en de doorklik van matrixcel naar rol en rechtencategorie werken zonder gegevens te wijzigen. Een aanvankelijke `PGRST303`-JWT-tijdfout hoorde bij de voorgaande deployment en herstelde bij een nieuwe poging; op deployment `dpl_3zkhTF3Y3M9ccHk4E5s6bvZGTpxz` zijn tijdens de eindcontrole geen error- of fatal-logs gevonden.
- HeRa-incidentherstel: de provincievraag kon na een geautoriseerde leestool leiden tot een lege tweede modelreactie. De daaropvolgende insert in `ai_messages` schond de verplichte contentconstraint (`23514`) en resulteerde in een 500. De orchestrator bewaakt nu zowel afgewezen toolselecties als lege vervolgreplies met een veilige, geautoriseerde fallback. De exacte browservraag is lokaal zonder 500 geverifieerd.
- Volledige Vitest-suite: 59 testbestanden en 234 tests geslaagd. ESLint, strict TypeScript, 15 gelijke NL/EN-namespaces en de Next.js-productiebuild met 36 pagina's zijn geslaagd.
- Tijdhub/reminders zijn lokaal op poort 3000 in een ingelogde browsersessie geverifieerd: persoonlijke reminder aanmaken/afronden, HR-reminder voor iedereen publiceren, sidebar-badge en countdown, en annuleren. De weergave is ook op 390px gecontroleerd zonder horizontale overflow.
- De eerder gemelde `POST /api/context/administration 400` is lokaal gereproduceerd en opgelost; de wissel naar de Operations-administratie gaf daarna `200` en de UI selecteerde de nieuwe context.
- De detailpagina van Edwin Testbeheerder is na de RLS-herstelmigratie lokaal op poort 3000 succesvol geladen; adres-, relatie- en vrije-veldqueries geven geen 403 meer.
- HeRa is browsermatig geverifieerd met geautoriseerde salarisgronding, geheugen create/update/delete, antwoordvoorkeuren, tijdzonebewuste remindercontrole en veilige conceptannulering. De lege vervolgreactie die eerder constraint `23514` en een 500 veroorzaakte, heeft een geteste fallback.
- Gemini 3-function calling bewaart de versleutelde `thoughtSignature` tussen toolrondes.
- Vijf aanvullende live databaseproeven voor volledige dienstverbandpublicatie, stamtabellen/salarisrevisies, documentdossiers, HR-wijzigingsprojectie en kalenderautorisatie zijn geslaagd.
- Publieke Vercel-preview: `https://liquidhr-git-codex-hera-data-agent-edwinitsolutions.vercel.app`; login en 390px-weergave zijn gecontroleerd. Beschermde flows vereisen een afzonderlijke geldige previewsessie.
- Lokale productiebuild luistert op `http://localhost:3000` en blijft actief; login is desktop en op 390px zonder consolefouten gecontroleerd.
- Login, herstel, uitnodiging en beschermde redirects zijn op desktop en 390px mobiel zonder consolefouten gecontroleerd.
- Alle 13 database-integratie- en isolatietests voor tenant, administratie, voorkeuren, identity matching, beveiligde BSN-opslag, vrije velden, autorisatie, dienstverbanden, tijdlijnen, uitdienstmelding en demodata zijn live tegen Supabase geslaagd.
- Supabase bevat exact 50 demo-medewerkers in de hoofdtenant en 10 in de tweede tenant, inclusief representatieve dienstverbandscenario's.
- Tijdelijke publieke preview tijdens ontwikkeling: `https://unmerited-diuretically-angeline.ngrok-free.dev`. De actuele loginpagina is na **Visit Site** bereikbaar. Deze URL verandert wanneer de tunnel opnieuw wordt gestart; voor OAuth/herstel moet hij expliciet in Supabase worden toegestaan.
- Demo-inrichting: 12 vrije-velddefinities, 183 administration-scoped waarden, 6 tenantrollen en 4 HR-rolhouders verdeeld over beide testtenants.
- Definitieve Vercel/OpenAI-hosting wacht op de afgesproken Git-publicatiestap en op de twee server-only secrets hierboven. `vercel.json` is voorbereid.
# Release update 2026-07-19

- HR-stamtabellen: tenant-relatietypen kunnen worden toegevoegd via `/master-data`; codes zijn vrije tenantcataloguswaarden met validatie, unieke tenant-scope en RLS.
- Feestdagen: handmatige records zijn visueel onderscheiden van geïmporteerde records.
- Organogram: de weergavekeuze staat zichtbaar in het filterblok; manager-only en functiegroep/functie/medewerker zijn beschikbaar, inclusief afdeling op medewerkerkaarten.
- Branch/deploy: `main` is de enige blijvende test/live-branch; previews zijn uitsluitend voor controle.
### Hotfix 2026-07-29: medewerkerfoto's

Foto wijzigen/verwijderen is zichtbaar op de medewerkerdetailpagina voor gebruikers met `employee:write`, ook in compacte weergave. Uploads worden server-side naar maximaal 512x512 WebP en maximaal 750 KB gecompacteerd. De migratie voor de bucketlimiet staat klaar maar is nog niet live toegepast.

### Update 2026-07-31: Talent-navigatie en performance

- Talentfundament staat op `/settings/talent` en is permission-gestuurd via `talent:manage`. Talentprofielen staat niet meer als tweede zijbalkitem, maar als Workforce-tegel op `/workforce` voor `talent:manager-read`.
- Voor de actieve demo-tenant van Edwin is de tenant-specifieke TENANT_ADMIN-override aangevuld met `talent:manage`, `talent:manager-read` en `talent:read` via lokaal migratiebestand `20260731193000_grant_talent_permissions_to_demo_tenant_admin.sql`; Supabase registreerde de uitvoering als `20260731172748_grant_talent_permissions_to_demo_tenant_admin` door de bestaande remote tijdlijn. Bestaande tenant-owned functies, groepen en profielen zijn hergebruikt.
- De gedeelde dashboard-layout geeft bestaande Supabase- en authcontext door aan voorkeuren en branding; dubbele initialisaties zijn verwijderd. Lokale warme routecontroles liggen rond 0,8--1,3 seconden. Next.js dev-cold-compilatie blijft afzonderlijk herkenbaar als circa 9--15 seconden en is geen productiebenchmark.
- Verificatie: 111 testbestanden/410 tests, typecheck, lint, i18n (24 namespaces), build (115 statische pagina's) en poort-3000-logincontrole geslaagd. Ingelogde browserflow bevestigde de enkele actieve menu-highlight en de twee juiste Talenttoegangen. Geen dependency-installatie, database-schemawijziging, deploy of commit uitgevoerd in deze slice.

### Update 2026-08-01: Talentfundament- en Tijdhub-UX

- Talentfundament volgt nu de bestaande `SettingsAccordion` met `alwaysOpen`: precies één paneel blijft open. De extra eyebrow en subtitel zijn verwijderd; de sidebarlink is niet langer ingesprongen als nested menu-item.
- Tijdhub-reminders gebruiken voor het eerstvolgende item een bestaande warning-surface in notitiekaartstijl. Reminderpanelen berekenen een positie naast of boven de trigger en hebben een expliciete sluitknop. Er is geen demo-record voor verlopen reminders aangemaakt of gewijzigd.
- Browsercontrole op poort 3000 bevestigde de Talentfundament-header, sidebaruitlijning, één-open-regel, geel kaartje, niet-overlappende popover en sluiten; browserconsole: geen errors.
- Verificatie: typecheck, lint, i18n-pariteit (24 namespaces), 111 testbestanden/410 tests en productiebuild (115 statische pagina's) geslaagd. Geen dependency-installatie, schemawijziging, deploy of commit.
# UX-redesign Workflows en formulieren 2026-08-10

De beheerroute `/settings/process-automation` heeft nu een expliciet statusoverzicht, een compacte lijst-eerst catalogus en een genummerde studioflow. Concept, gepubliceerd/in productie en gearchiveerd zijn als afzonderlijke aantallen zichtbaar. Proces, formulier, preview, Procesproef en versieverschil worden per onderwerp geopend in plaats van als één lange pagina.

`Nieuw proces` gebruikt een driestapswizard met basisgegevens, startpunt en review vóór aanmaken. De bestaande create-route, autorisatie, autosave, compiler, recepten en publicatiegrenzen zijn ongewijzigd. Strict TypeScript, i18n en diff-check zijn groen. ESLint blijft geblokkeerd door de bestaande ESLint 10/plugin-incompatibiliteit; browserbewijs is geblokkeerd doordat lokale Supabase-env bewust niet naar de worktree is gekopieerd.
Aanvulling 2026-08-16: de aanmaakwizard verwerkt roosterdagen voortaan als uren plus minuten; `7,30` wordt als 7,5 uur gevalideerd en gepubliceerd. De savegrens blijft de Controleren-stap; Overige kan niet publiceren. Voor profielfoto's is de lokale Storage/RLS-migratie `20260816140854_allow_hr_preplacement_avatar_storage` toegevoegd: HR behoudt tenant-, HR-groep- en permissionchecks, ook vóór de eerste organisatieplaatsing. De remote toepassing en live uploadcontrole wachten op expliciete toestemming.
# UX Foundation v1 — Employee Personal Tab

De featurebranch `feature/ux-employee-personal-tab` migreert de vijf subtabs van `/employees/[employeeId]?tab=personal` naar Foundation v1. De outer surface, tablist, persoonsgegevens read/edit, rolweergave, BSN-presentatie, bank- en relatiepresentatie en embedded custom fields zijn aangepast zonder schema-, API-, permission-, RLS- of securitywijziging. De finale test-, build- en browserverificatie staat nog open.
