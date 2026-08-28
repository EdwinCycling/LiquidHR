# Actuele overdracht Liquid HR

## R7-3 Employment, Calendar & Master Data Convergence — 2026-08-28

**Status: R7-3 LOCAL GREEN — READY FOR CENTRAL INTEGRATION; REQUIREMENTS GATE RECORDED**

- Dedicated worktree/branch: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r7-employment-masterdata`, `work/r7-employment-masterdata`; exact baseline `778b601670c87ca7596000937d895859498b483a`; visible version remains `1.20260828.4`.
- Converged existing employment contracts, holidays, leave-accrual configuration, absence settings, anniversary rules, jobs, salary structures, end reasons, document categories and relation types onto existing Foundation controls/patterns. Existing API payloads, permissions, validation and business semantics were retained. No Setup Assistant redesign, work-pattern route or schema/migration was added.
- Technical verification: targeted R7-3 Foundation tests `2/2`, strict TypeScript, i18n (`34` equal NL/EN namespaces), ESLint, Webpack production build and `git diff --check` green. Full suite `1017/1018`; the only failure is the exact known Journey baseline expectation for `Binnenkort beschikbaar`.
- Browser: authenticated HR Admin acceptance is groen op production-mode candidate `http://localhost:3001`, met de canonieke root `.env.local` byte-identiek gekopieerd naar het genegeerde targetbestand; secretwaarden zijn niet uitgelezen of opgeslagen. Alle gevraagde desktop-hoofdroutes en relevante leave-subroutes gaven `200`; bestaande data, Foundation controls, drawers, cancel, Escape/dirty-close, validation, RowActions en ConfirmDialog zijn gecontroleerd. Jubileumregel `42` is veilig aangemaakt, na reload teruggelezen en via bevestigde delete-cleanup verwijderd; tweede reload bevestigde de oorspronkelijke lijst. Desktop `1440x900` en representatieve mobile `390x844` hebben `scrollWidth === viewport`; finale production-console `0/0` errors/warnings en geen hydrationmeldingen. Manager/Employee zijn niet als browserpersona uitgevoerd omdat de HR Admin-sessie geen rolwissel exposeert; de gerichte permission-tests blijven daarvoor leidend.
- Requirements gates: exact `REQUIREMENTS GATE — SALARY CAPABILITY VISIBILITY UNRESOLVED`; work-pattern/schedule remains an intentional no-route gap. No migration, schema/RLS/RPC, merge, push, version bump, Vercel action or structural remote database write was performed. The intended R7-3 changes are locally committed on this branch; `origin/main` was not rebased or changed. Handoff: [`R7_3_EMPLOYMENT_CALENDAR_MASTERDATA.md`](R7_3_EMPLOYMENT_CALENDAR_MASTERDATA.md).

## Setup Assistant HR Admin access-correctie — 2026-08-28

**Status: ACCESS GREEN — READY FOR CENTRALE TEST-RELEASE**

- Dedicated worktree/branch: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\setup-assistant-hr-admin-access`, `work/setup-assistant-hr-admin-access`; baseline `main`/`origin/main` `051c57a998c33d17a8ac1bef166fe58f5c15b133`.
- Read/open gebruikt uitsluitend `settings:read`; `TENANT_ADMIN` is verwijderd als harde voorwaarde. Enable/disable/completion gebruiken onveranderd `settings:write`; bestaande CORE-step- en related-route-filtering, disabled-default en data-eigenaarschap zijn behouden.
- Verificatie: access/guide/schema/version `14/14` tests groen, strict TypeScript, targeted ESLint, i18n, Webpack-build `229/229` en diff-check groen. Full suite `1015/1016`; alleen de bekende Journey-failure op `Binnenkort beschikbaar` blijft buiten scope.
- Browser: TEST HR Admin op production-mode candidate `127.0.0.1:3003`; `/settings/setup-assistant` `200`, echte enable `PATCH 200` en GET-readback `200`, Settings-tegel en dashboard-trigger zichtbaar, drawer 4 categorieën/16 stappen, desktop `420px`, mobile `390x844`, `scrollWidth === viewport`, console `0/0`. Setup-instelling bewust AAN gelaten; completion niet gewijzigd.
- Database/scope: geen migration, schema, RLS of structurele remote DB-write; alleen de bestaande Setup-instelling via de normale product-API gewijzigd. R7-2, AI/HeRa en de dirty root-worktree zijn niet aangeraakt. Zichtbare versie: `1.20260828.3`.
## Roadmap 7 Slice 2 — Organization, Access & Context Model — 2026-08-28

**Status: R7-2 TEST RELEASE GREEN — MAIN/VERSION/VERCEL VERIFICATION PENDING**

- Dedicated source branch: `work/r7-organization-access` at `4e34ea4`; source baseline `051c57a`. Integrated once in dedicated release-worktree from `main`/`origin/main` `54100b4`.
- Scope: `/settings/business-structure`, `/settings/hr-groups`, `/settings/administration`, `/authorization`, `/role-assignments`, `/departments`, `/organization-chart`. Existing API/service/schema/RLS/grant/permission/context/business contracts remain unchanged.
- Organogram: read-only; `Afdelingen beheren` linkt naar `/departments`; alleen `Organisatiestructuur` en `Rapportagelijnen`; legacy `?view=job` valt veilig terug; top-down orthogonale connectors en employee source-handles blijven; mobile tree is behouden.
- Foundation: canonical PageShell/PageHeader, surfaces, fields, choice controls, collection toolbar/table, drawers, dialogs, row actions and chart surface conventions reused. No migration, schema/RLS/grant or structural remote write.
- Gates/browser: central R7-2 and Setup Assistant tests, strict TypeScript, i18n, ESLint, Webpack and diff-check are green; full suite has only the known unrelated Journey failure on `Binnenkort beschikbaar`. HR Admin, Manager and Employee sanity was verified on desktop `1440x900` and mobile `390x844`, including overflow/console checks and Setup Assistant access.
- Handoff: [`R7_2_ORGANIZATION_ACCESS_CONTEXT.md`](R7_2_ORGANIZATION_ACCESS_CONTEXT.md).

## Roadmap 7 Slice 1 — Settings Hub & Platform Settings Model — 2026-08-28

**Status: R7-1 TEST RELEASE GREEN — MANAGER/EMPLOYEE SANITY LIMITED BY TEST FIXTURE**

- Source branch/worktree: `work/r7-settings-platform` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r7-settings-platform`; release-worktree `work/r7-1-release`; exact baseline `main`/`origin/main` `1fce3e28accd6385abd0a5e54742b0b6e4060098`; releasecandidate `f7e90e6`; zichtbare versie `1.20260828.2`.
- Scope: `/settings`, `/settings/company-data`, `/settings/company-branding`, `/settings/employee-directory`, `/settings/modules`, `/settings/dashboard-widgets`, `/settings/menu-order`. Existing API/service/schema/RLS/grant/permission/business contracts are untouched. Menu order remains localStorage/self preference; employee directory remains “Komt later”.
- Foundation convergence: PageShell/PageHeader, Surface, TextInput/Textarea, FormField/FormActions, Checkbox, Switch, Badge, CountryPicker, ScrollableTabs, FormDrawer and ConfirmDialog are reused. Company-data custom portal/`window.confirm`, raw settings toggles, local action buttons and card styling were converged without changing payloads or route semantics.
- Gates: targeted `8/8` files and `30/30` tests, strict TypeScript, i18n `34` equal namespaces, ESLint `0 errors / 8 warnings`, Webpack `229/229` and diff-check green. Full suite `263/264` files and `1008/1009` tests; only the known unrelated Journey failure for `Binnenkort beschikbaar` remains.
- Browser: HR Admin candidate-sanity on `http://localhost:3011` is green for `/settings`, `/settings/company-data` and `/settings/modules` on `1440x900` and `390x844`; no horizontal overflow, company-data tabs and FormDrawer open/cancel verified, canonical Switch toggled and cancelled, console empty. Manager reaches the existing no-customer-environment state; Employee fixture login is rejected. Persona acceptance is limited by TEST auth/tenant fixtures, not by an R7 code failure. No browser mutation was submitted; no cleanup required.
- Release: the releasecandidate is fast-forward integrated into local `main`; no migration or remote database write was performed. Vercel verification uses the single main push and exact resulting `origin/main` SHA.

## Centrale R6 Insights-integratie en TEST-releasegate — 2026-08-28

**Status: LOCAL RELEASE CANDIDATE GREEN — MAIN/PUSH/VERCEL VERIFICATION PENDING**

- Release-worktree/branch: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r6-integration`, `work/r6-integration`; exact baseline `main`/`origin/main` `0ae99622609f45d83a8428f8cd4cb22985373f7b`. R6-1 `32d5c32cb44e0b274a9cbfd1fca81763f5471701` en R6-2 `e2c75eb5e9658c4ee899d69e96128357ec3bcedf` zijn éénmaal gecombineerd; R6-2 bevat R6-1. Alleen delivery-documentatie conflicteerde. R5 en Setup Assistant zijn behouden.
- Scope/safety: geen migration, Supabase-schema/RLS/grant-, auth/permission-, AI- of production-wijziging. De Upcoming-querygrens gebruikt de bestaande `databaseUuid`-validator; dit is de enige extra in-scope correctie na browseracceptatie, met gerichte regressietest.
- Technische gate: Insights `17/17` bestanden en `56/56` tests, strict TypeScript, i18n `34` gelijke namespaces, ESLint `0 errors / 8 warnings`, Webpack `229/229` pagina's en diff-check groen. Full suite `262/263` bestanden en `1003/1004` tests; uitsluitend de bekende niet-gerelateerde Journey-failure op `Binnenkort beschikbaar` blijft open.
- Authenticated browser op `localhost:3010`: HR Admin, Manager en Medewerker; desktop `1440x900` en mobile `390x844`. Canonical URL/draft/Apply/Reset, chip removal, Back/Forward, CSV HTTP `200`, drilldown-return, multiselect search, Upcoming `Afdeling`, overflow en Escape/focus-restore groen. HR Admin kreeg de gefilterde Upcoming-data; Manager alleen direct-teamdata; Medewerker geen Insights en directe route `0 rapportages`. Laatste console: `0` errors/`0` warnings.
- Versie: exact één bump naar `1.20260828.1` in `apps/hr-suite/lib/app-version.ts`, inclusief testverwachting; packageversie niet gewijzigd. Main-integratie, één push en Vercel TEST-verificatie zijn de resterende releasehandelingen. Geen remote Supabase-write of production-mutatie uitgevoerd.

## Centrale R5 Work & Automation + Setup Assistant V1 releasegate — 2026-08-27

**Status: LOCAL RELEASE CANDIDATE GREEN — MAIN/PUSH PENDING EXTERNAL GIT-CREDENTIAL CHECK**

- Release-worktree/branch: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r5-setup-release-integration`, `work/r5-setup-release-integration`; exact lokale `main`/`origin/main`-baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885`. R5 Work List, Runtime, Process Studio, shared TEST-fixture en Setup Assistant V1 zijn lokaal gecombineerd. De enige extra productwijziging is de Setup-drawerbreedte-override naar `420px` op desktop.
- Remote TEST Supabase `wnpfloqpjvaacobppbpk` read-only gereconcilieerd: Setup-migrations `20260827065737_setup_assistant_v1` en `20260827072833_setup_assistant_v1_indexes` zijn al toegepast. Geen `db push`, migration apply of productie-DB-mutatie. Readback: beide Setup-tabellen, RLS, acht policies, authenticated CRUD-grants, geen anon-table-grants, audit/update-triggers en nieuwe types-definities aanwezig. Advisors: geen Setup-securityfinding; vier Setup-FK-indexen als `unused_index`-INFO.
- Lokale gates: R5/Setup gericht `15/15` bestanden en `63/63` tests, strict TypeScript, i18n `34` gelijke namespaces, ESLint `0 errors / 8 warnings`, Webpack `229/229` pagina's en diff-check groen. Volledige suite: `258/259` bestanden en `986/987` tests groen; alleen de bekende niet-gerelateerde Journey-failure rond `Binnenkort beschikbaar` blijft open.
- Authenticated Playwright op `127.0.0.1:3003`: HR Admin `/work`, workdetail, `/process-runtime/<workItemId>` en Studio `200`, R5 zichtbaar, desktop `1440x900` zonder overflow. Setup echte enable/readback en cleanup `PATCH 200`; completion mark/unmark `PATCH 200`, refresh/readback `1 → 0`; 16 zichtbare stappen, acht API-suggesties/twee zichtbare suggestiekaarten, drie CTA's, drawer `420px`, mobile `390x844` drawer `390x844`, geen overflow. Setup/HeRa mutual exclusion is in beide eventrichtingen bewezen. Manager/Employee Work/detail/runtime `200`; Studio en Setup route `/geen-toegang`; Studio- en Setup-API `403`; geen Setup-edge-tab. Geïsoleerde routeflows hebben geen onverwachte page errors; 403-resource-consolemeldingen horen bij de expliciete negatieve probes.
- TEST-fixture blijft canoniek behouden. De R5-helper-classifier `safeAsSharedR5Fixture: NO` blijft de bekende, volgens handoff non-blocking mismatch voor `NO_ASSIGNEE`, deadlines en blocked-candidate. Geen Journey-fix, R6, AI, fixture-classifierfix of extra Setup-scope uitgevoerd.
- Versie exact éénmaal verhoogd naar `1.20260827.1` in `apps/hr-suite/lib/app-version.ts`; packageversie niet gewijzigd. Main is lokaal nog niet geïntegreerd en er is niet gepusht. Live `git ls-remote` faalt met `SEC_E_NO_CREDENTIALS`; dit is de actuele externe releaseblocker. Geen Vercel-deploy of production write uitgevoerd.

## Roadmap 5 — lokale Work & Automation-integratie — 2026-08-27

**Status: GREEN FOR SHARED R5 FIXTURE — WITH UNSUPPORTED SCENARIOS**

- Branch/worktree: `work/r5-integration` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r5-integration`; baseline lokale `main` en `origin/main` `e13c50f418cb327a6e4e99e266d58ab7370e4885`. De live `git ls-remote`-controle faalde met `SEC_E_NO_CREDENTIALS`; `main` is niet gewijzigd.
- Geïntegreerd als lokale slices: shared fixture `053c3d2^..b5b68ff`, Work List `833b8d2`, Runtime `58226f8` en Process Studio `d1f1800`. De vier integration commits zijn `9339071`, `2bbc38a`, `8ffb70a` en `b1cc24e`; alleen docs-conflicten zijn semantisch samengevoegd met behoud van beide handoffs. Geen migration, generated `next-env.d.ts`, `.env`, Setup Assistant-, R6- of Journey-delta.
- Lokale gate: gerichte R5-tests `12/12` bestanden, `41/41` tests; volledige suite `256/257` bestanden en `981/982` tests. De ene failure is de bestaande `components/journeys/journey-steps.test.tsx`-verwachting voor `Binnenkort beschikbaar`. Strict TypeScript, i18n `33` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, `git diff --check` en Webpack `226/226` routes zijn groen.
- Root cause: canonical `readback` faalde aanvankelijk met `FIXTURE_UNEXPECTED_FAILURE: fetch failed` omdat `NEXT_PUBLIC_APP_URL` naar lokale poort `3107` wees zonder listener. Met de integration-server op `127.0.0.1:3003` is de fixture-owned residual read-only bewezen en daarna verwijderd via een exact TEST-gescopeerde transactie. Exact één setup en één readback bouwden daarna 5 definitions, 7 instances en 12 work items op en bevestigden de claimed/rejected/request-changes/document/output-cases en persona-counts HR/Manager/Employee `7/3/3`. De helper rapporteerde `safeAsSharedR5Fixture: NO`; dit is **KNOWN FIXTURE CLASSIFIER MISMATCH — UNSUPPORTED SCENARIOS ARE NON-BLOCKING** volgens de canonical handoff. `NO_ASSIGNEE`, niet-gematerialiseerde deadlines en het blocked-candidate-pad zijn expliciet unsupported en geen acceptance blockers; `migrations: NO`.
- Browsergate: `agent-browser` faalde tweemaal met `CDP response channel closed`. De bestaande Playwright CLI/runtime-route werkte wel. HR, Manager en Employee zijn authenticated gecontroleerd op `/work`, UUID-workdetail en `/process-runtime/<workItemId>` op `1440x900` en `390x844`: HTTP 200, URL-state/back-context, overflow en keyboard-focus na Tab zijn groen; console error/warning is `0`. Assignment-options gaf HR `200` en Manager/Employee `403`; Studio gaf HR `200` en Manager/Employee `/geen-toegang`. `net::ERR_ABORTED` betrof alleen afgebroken Next-prefetches.
- Eindstatus: **GREEN FOR SHARED R5 FIXTURE — WITH UNSUPPORTED SCENARIOS**. Er is geen aangetoonde R5-code-regressie en geen code gewijzigd. De shared fixture staat opgebouwd in TEST. Geen main-merge, push, version bump, Vercel, production migration of branch cleanup. De aparte Journey-suitefailure blijft bekende baseline-debt en is niet gewijzigd. De helperwaarde `safeAsSharedR5Fixture: NO` is uitsluitend een classifier mismatch en geen R5 integration blocker.

## R5 Shared TEST dataset — 2026-08-26

- Branch/worktree: `work/r5-shared-test-dataset` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r5-shared-test-dataset`; exact baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885`; zichtbare versie ongewijzigd `1.20260825.1`.
- De helper `apps/hr-suite/scripts/r5-shared-test-dataset.mjs` plus contracttest gebruikt bestaande P9/P10 APIs/RPC's, `R5-TEST` idempotency keys en setup/readback/cleanup-modes. Remote TEST-project is `wnpfloqpjvaacobppbpk`; geen migration, production, version bump, Vercel, main-merge of main-push.
- Remote readback: vijf R5-definities (`PUBLISHED` internal/document/overdue, `DRAFT`, `RETIRED`), een `CLAIMED` Manager work item, `REJECTED` en `REQUEST_CHANGES`, Employee acknowledgement `OPEN` en `COMPLETED`, plus output `AVAILABLE` en job `SUCCEEDED`. De actuele `TODO`-service-readback gaf HR 7 items, Manager 3 direct-report items en Employee 3 self-items. De setup is tweemaal rerunnable uitgevoerd met stabiel 5 definitions, 7 instances en 12 work items.
- Hard cleanup is op het gekoppelde TEST-project/tenant uitgevoerd via storage-API plus één exact gescopeerde transactionele SQL-delete, omdat append-only triggers REST-hard-delete blokkeren. Before/after: 59 documenten en 59 audiences in scope vóór cleanup, alle geïnventariseerde records daarna `0`; storage-readback 0 scoped objects. Daarna is de canonical dataset opnieuw opgebouwd en bewust in TEST achtergelaten. Geen migration, production, main-merge/push, version bump of Vercel.
- Known unsupported scenarios: same-manager HR route geeft `409 NO_ASSIGNEE`; published SLA geeft `deadlineAt: null` door remote trigger-path drift; blocked candidate geeft `400 PROCESS_RUNTIME_INPUT_INVALID`; en de echte non-self negative persona ontbreekt veilig beschikbaar. Deze bekende capability gaps zijn volgens de canonical handoff geen acceptance blockers. De Employee-read op Manager approval van het eigen Employee-subject gaf `200` en is correct self-scope, geen negative cross-scope bewijs. `/api/process-work` heeft daarnaast strikte `z.uuid()`-queryvalidatie; rolreadback gebruikt daarom de bestaande service-RPC.
- Browserbewijs op `/work` is uitgevoerd voor HR/Manager/Employee op desktop `1440x900` en mobiel `390x844`; de populated states staan in `.artifacts/r5-hard-cleanup-*-work-*.png`, met `scrollWidth` gelijk aan de viewportbreedte en zonder relevante console-errors. De definitieve runstatus is **GREEN FOR SHARED R5 FIXTURE — WITH UNSUPPORTED SCENARIOS**. De fixture-helper kan intern nog `safeAsSharedR5Fixture: NO` rapporteren; dit is **KNOWN FIXTURE CLASSIFIER MISMATCH — UNSUPPORTED SCENARIOS ARE NON-BLOCKING**. Zie [`R5_SHARED_TEST_DATASET.md`](R5_SHARED_TEST_DATASET.md).

## R5-2 Work List + Foundation — 2026-08-26

- Branch/worktree: `work/r5-work-list` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r5-work-list`, vanaf exact baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885`; `main` is niet gewijzigd.
- `/work` gebruikt de bestaande process-work projection met Foundation `PageShell`, `PageHeader`, `FilterBar`, `DataTableShell`, `EmptyState`, `Surface`, `Badge`, `TextInput`, `DropdownSelect` en `ScrollableTabs`. De vijf bestaande tabs tonen projection-counts; status/proces/administratie/search/sort blijven URL-state en filters resetten pagination naar pagina 1.
- De bestaande service ondersteunt nu de bestaande offset/limit-paginering ook correct achter de administratie-wrapper (maximaal de bestaande 200-record contractgrens); `BLOCKED` wordt vanuit instance-status zichtbaar gemaakt. Startpage process work en Employee Detail → Processen gebruiken dezelfde status-/Foundation-presentatie. Geen migration, nieuwe task-entiteit, runtime redesign, version bump, merge, push of Vercel.
- Lokale verificatie: gerichte Work/service `4/4`; TypeScript groen; i18n `33` gelijke NL/EN-namespaces; lint `0 errors / 8 bestaande warnings`; Webpack-build groen met `226/226` static pages/routes; `git diff --check` groen. Volledige suite: `974/975` tests groen; één bestaande, niet-gerelateerde Journey-test faalt op ontbrekende tekst `Binnenkort beschikbaar`.
- Authenticated browseracceptance is uitgevoerd tegen de fresh Webpack-server op poort 3003 met de canonical ignored `.env.local`: HR `/work` populated met live counts TODO 7, CLAIMED 0, WAITING 0, COMPLETED 14, ALL 21; Manager toont uitsluitend bestaande direct-report work van Noah Hendriks; Employee uitsluitend self work van Noah Hendriks. Tabs, gecombineerde status/proces/administratie/search/sort-filters, URL-refresh, page-reset, zero-result, detail/back, startpage process card en Employee Detail → Processen zijn gecontroleerd.
- Browserformaten: desktop `1440x900` en mobiel `390x844`; op alle gecontroleerde routes is `scrollWidth === innerWidth`. Consolecontrole gaf geen warnings/errors of hydration errors. Live pagination-controls waren niet nodig omdat de zichtbare dataset 21 items bevat bij page-size 25; service- en workspace-tests dekken pagination en resetcontract.
- Eindstatus: **R5-2 GREEN; CODE GREEN; FULL SUITE RED door bestaande, niet-gerelateerde Journey-test op `Binnenkort beschikbaar`**.

## R5-4 Process Studio + lifecycle acceptance — 2026-08-26

- Branch/worktree: `work/r5-process-studio`, exact baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885`; `main` is niet gewijzigd. De bestaande Studio/lifecycle is authenticated op TEST doorlopen met eigen records `R5-STUDIO-20260826-1857` en clone.
- Bewezen: create/fresh readback, edit + autosave revision 2, stale revision HTTP 409, clone HTTP 201/readback, mobile preview, Procesproef HTTP 200 met `writesPerformed:false`, resolver/compilerfeedback, publish + changelog, immutable version/hash/readback, retire met reden, empty publish/retire HTTP 400 en DELETE/PATCH HTTP 405.
- Minimale productfix: `studio-service.ts` vertaalt Postgres SQLSTATE `40001` naar `PROCESS_DEFINITION_DRAFT_CONFLICT`; gerichte regressietest toegevoegd. Geen schema-, migration-, compiler- of enginewijziging.
- HR Admin Studio UI: forms-tab/list-first catalog, search/status controls, wizard, pending/dirty guards en version-diff zijn gecontroleerd. Desktop `1440x900` en mobiel `390x844` hadden `scrollWidth=clientWidth`; Tab-focus landde op de navigatieknop. Certified recipes en bestaande activation-buttons zijn read-only als huidig contract bewezen; geen recipe geactiveerd.
- Manager en Employee: Studio-route `/geen-toegang` en `/api/process-automation/studio` HTTP 403. Eigen TEST-data is na afloop transactioneel hard verwijderd (2 definitions, 4 drafts, 1 version); de immutable-trigger is tijdelijk binnen dezelfde cleanup-transactie uitgeschakeld en vóór commit hersteld. Shared R5 keys lezen nog `r5-test-draft-process=DRAFT`, drie PUBLISHED en `r5-test-retired-process=RETIRED`.
- Gates: gerichte Studio-tests `10 files / 49 tests` groen; typecheck, i18n `33` gelijke NL/EN-namespaces, lint `0 errors / 8 warnings`, Webpack-build `226` routes en `git diff --check` groen. Full suite `254 files / 973 tests` bevat `253/254` groene files en `972/973` groene tests; één bestaande, niet-gerelateerde Journey-failure (`Binnenkort beschikbaar`).
- Open: full-suite Journey-testfailure buiten deze scope. Geen migration, main-merge/push, version bump, Vercel of productionactie uitgevoerd.
## Setup Assistent V1 — 2026-08-27

- Geïmplementeerd in geïsoleerde worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\setup-assistant-v1`, branch `work/setup-assistant-v1`, vanaf exact `main`/`origin/main` `e13c50f418cb327a6e4e99e266d58ab7370e4885`. De drie lokale slices zijn sequentieel vastgelegd; root `main`, productie, push, merge en deploy zijn niet gewijzigd.
- CORE bevat 17 statische stappen in 4 categorieën; 16 stappen zijn zichtbaar in de TEST HR Admin-context. De salarisstap blijft verborgen zolang geen betrouwbare expliciete resolver bestaat. Checklist, instelling, completion/readback, suggesties, edge-tab, HeRa-exclusie, mobile fullscreen drawer en instellingenroute zijn aangesloten via bestaande Foundation-primitives.
- TEST Supabase `wnpfloqpjvaacobppbpk`: migrations `20260827065737_setup_assistant_v1` en `20260827072833_setup_assistant_v1_indexes` zijn toegepast. Beide tabellen hebben RLS, tenant+HR-groep policies, authenticated CRUD-grants, audittriggers en composite keys; remote SQL-contracttest is groen. Na acceptance-cleanup staan beide Setup-tabellen voor de gebruikte TEST-scope op `0` records; productie is niet geraakt.
- Authenticated browserbewijs: TEST HR Admin gaf settings-PATCH `200`, completion-PATCH `200` voor markeren én ongedaan maken, readback van `1` naar `0`, echte suggesties uit bestaande TEST-reads, desktop `1280` zonder overflow, mobile `390x844` met drawerbreedte `390` zonder overflow, en beide richtingen van Setup/HeRa-overlay-exclusie. Manager en Medewerker kregen Setup-API `403` en geen edge-tab; de instellingenroute eindigde op `/geen-toegang`.
- Lokale gates: gerichte Setup `2/2` testfiles en `5/5` tests, strict TypeScript, i18n `34` gelijke NL/EN-namespaces, ESLint exit `0`, Webpack-build groen en `git diff --check` groen. Volledige suite is `254/255` testfiles en `975/976` tests: één ongewijzigde Journey-test faalt buiten deze delta op de bestaande verwachting `Binnenkort beschikbaar`; dit is geen Setup-failure.
- Remote advisors na wijziging: security `85` findings (`84 WARN` bestaande projectbrede baseline, geen Setup-finding); performance `460` (`11 WARN` bestaande baseline, Setup alleen vier nieuwe `unused_index`-INFO's voor de FK-indexen). Zichtbare productversie bleef `1.20260825.1`; geen version bump.
- Eindstatus: **SETUP ASSISTENT V1 GREEN; READY FOR REVIEW/INTEGRATION; FULL SUITE HAS ONE UNRELATED EXISTING JOURNEY FAILURE**.
## R6-2 gedeelde Insights-controls — overdracht 2026-08-26

- Branch/worktree: `work/r6-insights-shared-controls` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r6-insights-shared-controls`, gestart vanaf exact R6-1 `32d5c32cb44e0b274a9cbfd1fca81763f5471701`.
- Afgerond: Foundation `MultiSelect`, shared Insights filter bar/active chips/export shell, en migratie van employee FacetFilter, salary FilterMenu, Upcoming FilterDropdown en absence summaries. URL blijft applied canonical state; draft is lokaal, Apply gebruikt `router.push`, exports gebruiken applied query en report-owned serializers, drilldowns behouden return context.
- Verificatie: nieuwe shared tests `7/7`, targeted Insights `53/53`, typecheck, i18n `33` namespaces, lint `0 errors` en Webpack build `226` routes groen; full suite `987/988` met uitsluitend de bestaande Journey-assertion `Binnenkort beschikbaar`, ook rood op baseline `e13c50f`.
- Browser: **GREEN**. Canonical `.env.local` is gekopieerd en SHA-256 gelijk geverifieerd zonder secrets te tonen. Authenticated Playwright op desktop `1440x900` en mobiel `390x844` controleerde alle gevraagde shared-control-, report-, export-, drilldown-, keyboard/Escape/focus- en overflowflows; console eindigde op `0` errors en `0` warnings. Minimale fixes: employee active-filter actions gebruiken canonical URL-state; Upcoming labelmapping voor `Afdeling`.
- Geen migration, remote write, RLS/permission/auth wijziging, version bump, merge, push of deploy. Zie [`docs/delivery/parallel/2026-08-26-r6-2-insights-shared-controls.md`](parallel/2026-08-26-r6-2-insights-shared-controls.md).

## R6-1 Insights query + navigation seam — overdracht 2026-08-26

- Branch/worktree: `work/r6-insights-query-seam` in `C:\Users\Edwin\Documents\Apps\LiquidHR`; exact baseline `e13c50f418cb327a6e4e99e266d58ab7370e4885`. Main is niet gewijzigd. Implementatiecommit `cffcf04`; documentatiecommits `a5d2de9` en `8597bf1` volgen daarop.
- Afgerond: `lib/insights/query-seam.ts` met typed adapter/frozen seam-contract, canonical report ids, report-owned query-key cleanup, repeated-array canonicalisatie, Apply/report-switch helpers en safe internal drilldown-context. Bestaande report-owned querymodules blijven eigenaar van hun filters/berekeningen.
- Runtime: Insights gebruikt canonical `report=<kebab-case-id>`, `groupBy`, `sortBy`, repeated arrays en legacy parse aliases. Employee Apply gebruikt `router.push`; presentation `view` gebruikt `router.replace`; employee direct URL state heeft voorrang op preferences/defaults; report switching verwijdert stale state; Upcoming direct URL laadt alleen wanneer het report in de server-side permission-filtered catalog staat.
- Drilldowns: employee/employment links dragen `from=insights` plus een genormaliseerde interne `returnTo`; externe of niet-Insights return paths vallen veilig terug op `/insights`.
- Documentatie: `docs/requirements/reports/R6_1_INSIGHTS_QUERY_NAVIGATION_SEAM.md` bevat de exact frozen query-, navigation-, permission- en R6-2 handoff-contracten. README en IMPLEMENTATION_STATUS zijn bijgewerkt.
- Tests/gates: targeted seam/query `7/7` files, `29/29` tests; typecheck groen; i18n `33` namespaces; lint `0 errors / 8 warnings` (bestaand); build `226` routes/pages; `git diff --check` groen. Volledige suite `253/254` files, `980/981` tests; alleen bestaande `components/journeys/journey-steps.test.tsx` faalt op `Binnenkort beschikbaar`.
- Browser: branch-runtime `http://localhost:3002` authenticated HR Admin. Canonical employee direct URL, draft-versus-Apply, employee → absence → upcoming → salary, stale cleanup, Back/Forward restoration en employee drilldown return links zijn gecontroleerd. Desktop en `390x844`; mobile `scrollWidth=390`. Bestaande Next-dev dashboard-shell hydration/state-meldingen zijn apart gehouden van de seam-evidence.
- Governance: geen Supabase migration/schema/RLS/grant, remote write, merge, push, deployment of version bump. Zichtbare versie blijft `1.20260825.1`. R6-2 kan voortbouwen op de frozen seam; controleer de actuele branch-HEAD met `git rev-parse HEAD`.

## R4 Recruitment + Journeys centrale integratie — 2026-08-25

- Branch/worktree: `work/r4-recruitment-journeys-integration` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r4-integration`; baseline exact `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`. Alle 15 approved R4-slices zijn semantisch geïntegreerd; root `main` bleef tijdens deze run ongewijzigd.
- Canonical TEST migration history is read-only gecontroleerd op project `wnpfloqpjvaacobppbpk`. De vier lokale SQL-bestanden matchen exact met de toegepaste SQL en zijn naar de remote timestamps genormaliseerd: `20260825140121_recruitment_application_normalized_email_fix.sql` (oorspronkelijk `20260824172115`), `20260825140137_guided_recruitment_archive_draft_fix.sql` (oorspronkelijk `20260824183100`), `20260825153223_fix_recruitment_guided_interview_participation_conflict.sql` (oorspronkelijk `20260825152132`) en `20260825134000_fix_journey_version_conflict_retry.sql` (oorspronkelijk `20260825150000`).
- De remote history bevat daarnaast al een tweede registratie `20260825150000_fix_journey_version_conflict_retry` met dezelfde naam maar zonder afsluitende puntkomma; de exacte SQL-match is `20260825134000`. Er is geen remote write, migration rerun, brede `db push` of poging tot remote repair uitgevoerd. Repository-equivalenten: `4/4`; lokale semantische duplicates: `0`; remote `duplicate migrations 0`: **NO** door deze bestaande registratie.
- Lokale gates: `253/253` testbestanden en `971/971` tests, strict TypeScript, i18n `33` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack-build `226/226` static pages/routes en `git diff --check` groen. De acht lintwarnings zijn bestaande waarschuwingen buiten deze R4-delta.
- Authenticated TEST browser-sanity: HR Recruitment/Journeys-detailroutes gaven HTTP `200` op desktop `1440x900` en mobiel `390x844`, zonder horizontale overflow of relevante console-errors. Manager en Employee kregen Recruitment `Nog geen toegang`; hun Journey-lijst/detail renderde de self/participant-scope (`Jouw Journeys`/`Jouw Journey`) zonder overflow. De eerste Manager-detailprobe had een transient 500-consolemelding; dezelfde route gaf in een schone herhaling geen 500 en geen console-error.
- Safety: geen external publication, geen Hire en geen nieuwe migration uitgevoerd. De canonical test `.env.local` staat alleen in de ignored integration-worktree en is niet gecommit. Zichtbare versie is `1.20260825.1`.
- Eindstatus: **R4 INTEGRATION GREEN; READY TO INTEGRATE INTO MAIN; RELEASE/PUBLICATION/HIRE SAFETY GATES REMAIN EXPLICIT**.

## R4 Applicant Detail — Guided Interview ON CONFLICT-fix 2026-08-25

- Branch/worktree: `work/r4-recruitment-applicant-detail`; de authenticated TEST-flow reproduceerde `POST /api/recruitment/interviews` als HTTP 500 `RECRUITMENT_OPERATION_FAILED`. De onderliggende RPC-call `public.create_recruitment_interview(uuid,text,timestamptz,uuid,jsonb)` gaf PostgreSQL `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`.
- Read-only remote inspectie bevestigde dat `recruitment_participations` uniek is op `(tenant_id, hr_group_id, application_id, interview_id, employee_id)`, terwijl de bestaande function `(tenant_id, hr_group_id, interview_id, employee_id)` targette. De canonical forward migration `20260825153223_fix_recruitment_guided_interview_participation_conflict.sql` vervangt uitsluitend deze function met het bestaande vijfkolomstarget; geen tabel, index, RLS of grant wordt gewijzigd.
- Regressie: `guided-interview-migration-contract.test.ts` verifieert de function en het exacte vijfkolomstarget. Na expliciete approval is de migration op TEST geregistreerd als `20260825153223_fix_recruitment_guided_interview_participation_conflict`; de authenticated runtime-flow is daarna groen bewezen: application `201`, Guided Interview `201`, interviews readback `200` en applicant detail readback `200`. Eigen reproductiedata is via archive/privacy/reject opgeruimd en heeft geen actieve application achtergelaten.
- Gates na wijziging: gerichte Guided Interview `2 testfiles / 3 tests`, volledige hr-suite `237 testfiles / 903 tests`, strict TypeScript, i18n `33` namespaces, lint `0 errors / 8 warnings` en `git diff --check` groen. Hire is niet uitgevoerd wegens `NOT EXECUTED — CROSS-DOMAIN SAFETY BOUNDARY`.
- Eindstatus: **GUIDED INTERVIEW GREEN; R4 APPLICANT DETAIL GREEN**. Geen `db push`, productieactie, merge, push of version bump.

## Goals security hardening — 2026-08-23 — actuele overdracht

- Branch/worktree: `main`; Goals-hardening fast-forward geïntegreerd vanaf `057f762eaab9f17b353a7600858ec174bedaa824`, na exacte verificatie van `origin/main` `e8cc329dfaf026919d7996b74470ee9380f83828`.
- Opgelost in forward migration `20260823172440_talent_goals_security_hardening.sql`: terminale goals blokkeren inhoudelijke updates van open check-ins; bestaande SELECT/history blijft toegestaan; terminale timestamps worden server-side bepaald en historische waarden blijven behouden; HR/Manager RLS-scope en `author_user_id`-immutability zijn consistent; vijf Goals `SECURITY DEFINER` functies gebruiken `search_path=''`, expliciete schema's en revoke van publieke execute.
- Test-first: `talent_goals_security_hardening.sql` is op TEST groen met 18/18 pgTAP-asserties. Remote TEST project `wnpfloqpjvaacobppbpk` heeft de migration geregistreerd als `20260823172732`; rollbackbare fixtures lieten 8 goals/7 check-ins intact en 0 hardening-records achter.
- Lokale gates: volledige hr-suite `234/234` testbestanden en `899/899` tests, gerichte Goals-tests `9/9`, strict TypeScript, lint `0 errors / 8 warnings`, Supabase advisors/types en `git diff --check` groen. Geen domain- of i18n-wijziging; alleen de version-only bump is toegevoegd.
- Authenticated browser sanity: `/login` renderde lokaal, maar agent-browser verloor de CDP-response channel bij de loginactie en een nieuwe geïsoleerde sessie; HR/Manager/Employee browser/API sanity is daarom **NOT EXECUTED — TOOLING LIMITATION**, niet releasebewijs. Geen processen gestopt en geen secrets gelogd.
- Versioning: authoritative `apps/hr-suite/lib/app-version.ts` is verhoogd naar `1.20260823.2`; packageversie blijft technische metadata.
- Eindstatus: **TEST-TRUNK GREEN; AUTHENTICATED BROWSER ACCEPTANCE NOT EXECUTED — TOOLING LIMITATION; RELEASE browser evidence OPEN**. Productie is niet geraakt.

## Centrale Talent + Bugfix GREEN-integratie — 2026-08-23 — actuele overdracht

- Branch/worktree: `work/talent-bugfix-integration` in `C:\Users\Edwin\Documents\Apps\LiquidHR`; baseline exact `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`; main is niet gewijzigd.
- Geïntegreerd: `work/bug-unauthorized-routes` (`73d51f3`), `work/bug-storage-image-url` (`96d505c`), `work/bug-employment-labor-condition` (`c837c30^..a0c195d`), `work/r3-talent-overview` (`3ef0190`), `work/r3-talent-assessments` (`1d69c35^..e52790a`), `work/r3-talent-comparison` (`5f9b085`), `work/r3-talent-goals` (`da5d08d^..b89ce7b`), `work/r3-role-explorer` (`d1a0195`), `work/r3-team-talent` (`f3fde0b`) en `work/r3-talent-reports` (`c31e0f3`).
- Conflictoplossing: uitsluitend NL/EN `apps/hr-suite/messages/*/talent.json`; de keysets van alle zeven Talent-slices zijn semantisch samengevoegd, zonder duplicate keys. `check:i18n` bevestigt 33 gelijke namespaces.
- Migration governance: TEST-project `wnpfloqpjvaacobppbpk` registreert employment als `20260823134108_fix_employment_labor_condition_mutation_hr_group_scope`, assessments als `20260823134149_align_talent_assessment_role_overrides` en `20260823135555_fix_talent_assessment_audit`. De lokale SQL is inhoudelijk gecontroleerd tegen de remote functie-/permissionstaat en naar die geregistreerde filenames genormaliseerd. Goals-hardeningmigration en incomplete contracttest zijn niet aanwezig. Geen remote apply.
- Scopecontrole: geen generic Foundation-uitbreiding, `.env*`, secrets, `next-env.d.ts` of caches geïntegreerd. Unauthorized route debt, storage-image URL debt en employment labor-condition mutation zijn onderdeel van deze batch; Goals security hardening blijft deferred.
- Lokale gates: `234/234` testbestanden en `899/899` tests, strict TypeScript, i18n `33` gelijke NL/EN-namespaces, ESLint `0 errors / 8 warnings`, Webpack-productiebuild `224/224` static pages/routes en `git diff --check` groen.
- Authenticated sanity: de exacte root-worktree integration-runtime op localhost:3000 is gebruikt. HR Admin op `/dashboard/start`, `/absence/new`, `/authorization`, `/workforce/talent` en Talent-settings; Manager op alle zeven `/workforce/talent/*`-routes; Employee op self-routes en negatieve workforce/settings-routes. Zichtbare hoofdcontent en permission boundaries zijn groen. 390x844 Overview, Goals, Assessments en Team hadden `scrollWidth=390` bij `innerWidth=390`; Liquid Navy en LinkedHR zijn gecontroleerd en de voorkeur is teruggezet naar Liquid Navy. Geen `storage://`-URL is aangetroffen.
- Browsernuance: `/workforce/talent/{assessments,goals,role-explorer,reports}` is de manager-workspace en is daarom met TEST Manager getest; HR-positive gebruikt de corresponderende `/settings/talent/*`-routes. De eerste parallelle dev-HMR-compilatie gaf tijdelijke parse/runtime-output; frisse, warme snapshots na correcte persona-routing waren groen.
- Versioning: authoritative `apps/hr-suite/lib/app-version.ts`, huidige zichtbare versie `1.20260816.1`; formaat `1.<YYYYMMDD>.<volgnummer>`. Een latere release bump wijzigt die file en de exacte verwachting in `apps/hr-suite/lib/app-version.test.ts`; packageversie `0.1.2` is technische metadata. Geen bump in deze run.
- Eindstatus: **TEST-TRUNK: GREEN; RELEASE / PRODUCTION: AMBER**. `READY TO INTEGRATE INTO MAIN = YES`; geen main-merge, push, Vercel-deploy, productieactie, remote schema apply of branch cleanup uitgevoerd.

## Centrale R2/R3 GREEN-integratie — 2026-08-23 — actuele overdracht

- Branch/worktree: `work/r2-r3-integration` in `C:\Users\Edwin\Documents\Apps\LiquidHR`, integration HEAD `d65d74fa0ec3378bb1b082d9dd366e38244a97d6`, gebaseerd op `abfa0bbb7db628f588faa3d4818a4f4663f27b46`.
- Geïntegreerd: de volledige relevante delta van Authorization Coverage, Startpage, Organization/Departments, Continuous Appraisal, Star Performers, 9-grid, Absence Core, Absence Insights, HR Calendar + Leave, Process Automation lifecycle en Company Documents. De commitranges zijn achtereenvolgens `e1f1d09..38954db`, `4cfe002..6f92aeb`, `b56dbd4`, `3da0306..ba107f1`, `3a36118..f3b1b56`, `3d52ece..77c5301`, `a20d414..8e38e95`, `01040b8..d1d3cb8`, `65843ac..bc46703`, `5953f22..f53cabf` en `3adca06..439e820`.
- Overlap/conflict: er was één gedeelde schema-overlap in `lib/organization/schemas.ts` en `schemas.test.ts`; de uiteindelijke code behoudt zowel koppeltekens in role-guides als GUID-compatibele department-parent-IDs. Git meldde geen onopgeloste cherry-pick-conflict. De Process-branch had na de opgegeven laatste bekende SHA `5953f22` nog de direct relevante `f53cabf`-fix (`force-dynamic`); die is meegenomen en expliciet gerapporteerd.
- Scopecontrole: geen `next-env.d.ts`, `.env*`, secrets of employment labor-condition-delta geïntegreerd. De 9-grid-migration `20260823110000_fix_talent_review_start_rpc_rls.sql` en Company Documents-migration `20260823073015_company_document_soft_delete_rls.sql` zijn code-delta's; beide TEST-migrations waren volgens de opdracht al toegepast. Geen remote migration, productieactie, push, merge of deploy uitgevoerd.
- Environment preflight: canonical `apps/hr-suite/.env.local` bestaat; alleen env-key-namen zijn gecontroleerd, waarden zijn niet gelogd. Canonical TEST fixture-auth is GREEN uitgevoerd voor uitsluitend TEST HR, TEST MANAGER en TEST EMPLOYEE.
- Technische gates op de integratiebranch: `git diff --check` groen; strict TypeScript groen; i18n `33` gelijke NL/EN-namespaces; ESLint `0 errors / 8 warnings`; volledige hr-suite `219/219` testbestanden en `857/857` tests; Webpack-productiebuild groen met `224` gegenereerde static pages/routes.
- Browser-sanity: `/dashboard/start`, `/absence/new`, `/hr-calendar`, `/company-documents`, `/authorization`, `/settings/process-automation`, `/departments`, `/workforce/9-grid`, `/workforce/continuous-appraisal` en `/workforce/star-performers` zijn met TEST HR authenticated HTTP 200 en zichtbare hoofdcontent gecontroleerd. Manager/Employee spot-checks, 390x844 op dashboard/kalender/9-grid en Liquid Navy/LinkedHR zijn uitgevoerd. Employee `/absence/new` en `/authorization` tonen bij directe unauthorized toegang een generieke `AuthorizationError`-pagina; dit is bestaande debt en geen regression van deze integration batch.
- Roadmapstatus: Roadmap 2 Absence & Operations en Roadmap 3 Organization & Talent zijn geïntegreerd en TEST-trunk GREEN. Release/production blijft AMBER door de open debt: (1) Employment labor-condition mutation, (2) Employee `/absence/new` unauthorized route toont generic AuthorizationError page, (3) Employee `/authorization` unauthorized route toont generic AuthorizationError page. De laatste twee zijn bestaande debt, geen integration regressions.
- Eindstatus: **TEST-TRUNK: GREEN; RELEASE / PRODUCTION: AMBER**. Klaar voor integratie naar `main`; geen production database-mutaties, schema apply of deploy.

## UX v1.2 final integration & acceptance — 2026-08-21 — actuele overdracht

- Branch/worktree: `work/ux-v1-2-integration` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\ux-v1-2-integration`, exact acceptance-HEAD `b3ba2097eb5b7b606fe49220bb912cf37174eeb5`; `main` is niet gewijzigd. `apps/hr-suite/next-env.d.ts` in de hoofdwerkplek blijft bestaande out-of-scope werkboomdata.
- Classificatie: **TEST-TRUNK: GREEN**. **RELEASE / PRODUCTION ACCEPTANCE: AMBER** door de residual acceptance backlog hieronder.
- TEST-doel bevestigd als Supabase-project `wnpfloqpjvaacobppbpk` (Planeten/testproject). Alleen de nieuwe forward migration `20260821150000_fix_employee_document_metadata_rls.sql` is toegepast; de server registreerde deze als `20260821144840 / fix_employee_document_metadata_rls`. Geen bestaande migration is gewijzigd.
- Schemafix: `internal_security.can_manage_document_for_write(uuid)` is stable, `SECURITY DEFINER`, `search_path=''`, alleen uitvoerbaar voor `authenticated`; document-audience INSERT/UPDATE/DELETE gebruikt deze write-helper. Read policies en RLS zijn niet versoepeld. `create_employee_document_metadata` blijft `SECURITY INVOKER`, genereert de UUID vóór insert en gebruikt een expliciete `id` zonder `RETURNING`.
- Remote regressietest `apps/hr-suite/supabase/tests/employee_document_metadata_rls.sql` is groen: HR write/create + audience/read werkt, employee zonder write wordt geweigerd en een document zonder toegestane audience blijft onzichtbaar. Security/performance advisors zijn opnieuw uitgevoerd; er is geen nieuwe document-specifieke finding. Types zijn opnieuw gegenereerd; er was geen relevante exposed-typewijziging.
- Productfixes die tijdens acceptance nodig bleken: async upload bewaart het formulier vóór `await` (`formElement.reset()`), en de document-default audience accepteert het canonieke `TENANT_ADMIN` naast legacy `HR_ADMIN`. Strict typecheck, volledige tests, i18n, lint, Webpack-build en diff-check zijn daarna groen.
- Gates: `213/213` testbestanden, `833/833` tests; typecheck exit 0; i18n `33` gelijke NL/EN-namespaces; lint `0 errors / 8 warnings`; Webpack-build `225` routes; `git diff --check` groen. De warnings zijn bestaande waarschuwingen buiten deze wijziging.
- Browserstatus op de exacte localhost:3000 integration-runtime (PID 33660, juiste worktree): fresh TEST HR-login en de kritieke routes HTTP 200. De gecontroleerde documentflow gaf PDF/TXT upload HTTP 201, download redirect HTTP 307 en signed-storage-follow-up HTTP 200; delete → restore → final delete gaf voor beide bestanden HTTP 200. Daarna zijn alle 9 tijdelijke `TEST acceptance%`-records soft-deleted, 9 storage objects verwijderd en 0 orphans overgebleven.
- Absence: HR report gaf HTTP 201 op DEMO-035 en DEMO-037; recovery gaf HTTP 200 met readback van het herstelvenster. Capacity op TEST-VERZ-048 is met een latere effectieve datum uitgevoerd en las 25% terug; de exacte response-status is door de automatische reload niet vastgelegd. Oude/ongeldige fixture-UUID’s gaven correct HTTP 400 `ABSENCE_INPUT_INVALID`; tijdelijke absence-cases blijven staan omdat er geen ondersteund delete-contract is.
- Authorization: HR create-role gaf HTTP 201 en zichtbaarheid; de tijdelijke role is via PATCH HTTP 200 gedeactiveerd. Een geldige manager- en employee-POST naar `/api/roles` werd server-side geweigerd met HTTP 403. Coverage-dialog/save is niet volledig browserbewezen.
- Nog niet volledig bewezen: echte employment contract/CAO/location/organization-mutatie (CAO-stap meldt dat de wijziging niet beschikbaar is), process create/publish/retire/changelog/cleanup, volledige responsive consolematrix en een afzonderlijke Default-theme run. De actieve preference was LinkedHR; er is geen preference-write uitgevoerd. Process- en employment-routes zijn wel geopend en HTTP 200 geverifieerd.
- Bewezen GREEN-resultaten: Document PDF/TXT CRUD + cleanup; RLS migration + regressietest; HR Absence report/recovery; Authorization role CRUD + negative 403; `833/833` tests; TypeScript; i18n; lint; Webpack build; diff-check.
- Residual acceptance backlog voor release/production acceptance: Absence Manager/Employee volledige matrix; Employment mutation met geschikte non-CAO testfixture; Authorization Coverage-dialog/save; Process Automation volledige create/publish/retire lifecycle; resterende volledige theme/responsive matrix.
- Eindstatus voor deze run: **TEST-TRUNK: GREEN; RELEASE / PRODUCTION ACCEPTANCE: AMBER**. Er is niet gemerged, gedeployed of naar `main` gepusht.

## UX v1.2 Correction Batch 4 — Foundation polish — 2026-08-21

- Branch: `work/ux-v1-2-foundation-polish`, exact baseline `origin/main` `a65d1daaa9444602f4be52c2d32933cffd285dd0`; commit `219b00f` staat op origin; geen main-merge.
- Authorization: Create role is gemigreerd van inline `<details>` naar de bestaande `FormDrawer` met dirty-close protection, saving/double-submit protection, lokale foutstatus en bestaande POST-payload. Coverage inspection gebruikt de centrale `Dialog` met focus/Escape/restore; permissionselectie en PUT-save blijven behouden. Hoofdpermission-editor niet herontworpen.
- Startpage: alleen Foundation-polish. Zware shadows, normale hover-lift en niet-canonieke surface-radius zijn verwijderd; semantic Foundation surfaces/tokens zijn gebruikt. Compact/expanded, widgets, quick-action horizontal scroll, drag/reorder, scopes, order en preferences zijn behouden.
- Verificatie: gerichte 12/12, volledige 210/826, strict TypeScript, i18n 33 namespaces, lint 0 errors/6 bestaande warnings, build 225 routes en diff-check groen.
- Browser: `/dashboard/start` geeft lokaal 307 naar `/login`; anonieme `/api/roles` geeft 401. Authenticated TEST HR/Manager acceptance op desktop/390×844 en Default/LinkedHR is `BLOCKED BY ENVIRONMENT` omdat canonical fixture-passwords niet beschikbaar zijn. Geen secrets gekopieerd of gelogd. Bestaande dirty `apps/hr-suite/next-env.d.ts` blijft buiten scope.
## UX v1.2 correction batch 3 — Process Automation interactions — 2026-08-21

- Branch/worktree: `work/ux-v1-2-process-automation-interactions` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\ux-v1-2-process-automation-interactions`, gestart vanaf `origin/main` `a65d1daaa9444602f4be52c2d32933cffd285dd0`.
- `/settings/process-automation` create gebruikt een full-page driestapsflow met sticky `FormActions`, Back/Continue/Cancel, browser dirty protection en centrale discard-confirmatie. Publish en retire gebruiken de centrale `Dialog`; tijdens pending verdwijnen de X en alle close-signalen, dubbele starts zijn geblokkeerd, en API-fouten blijven zichtbaar in de open Dialog met behoud van changelog/reason. Catalogus, studio, route, API, permissions en businesslogica zijn niet gewijzigd.
- Lokale gates GREEN: pending-dialog regressietest 1/1, strict TypeScript en `git diff --check`. I18n is niet gewijzigd en daarom niet opnieuw gedraaid; volledige suite/build blijven cumulatief voor de integration branch.
- Auth: de ignored `apps/hr-suite/.env.local` is lokaal gekopieerd vanuit de hoofdwerkplek; waarden zijn niet gelogd of gecommit.
- Browseracceptance: `BLOCKED BY ENVIRONMENT`. De bestaande poort-3000-server is niet aantoonbaar deze worktree en de gekopieerde `.env.local` bevat geen fixture-logincredentials. Loginpagina gaf 0 console-errors en alleen de bekende Next dev/HMR/preload-waarschuwing; TEST HR/TENANT_ADMIN create/read/publish/retire, unauthorized negative, desktop/390x844 en echte API-cleanup blijven open.
- Open: branch commit en push; niet naar `main` mergen. Bestaande parallelle dirty wijziging in de hoofdwerkplek (`apps/hr-suite/next-env.d.ts`) blijft buiten scope.
## UX v1.2 correction batch 1 — Employee CRUD surfaces — 2026-08-21

- Eigen branch/worktree: `work/ux-v1-2-employee-crud-surfaces` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\ux-v1-2-employee-crud-surfaces`, gestart vanaf `origin/main` `a65d1daaa9444602f4be52c2d32933cffd285dd0`.
- Geïmplementeerd: Personal addresses/bank accounts/relations via FormDrawer met RowActions en ConfirmDialog-delete; Personal full-page form met sticky FormActions en dirty protection; Notes via EntityList/FormDrawer/RowActions; Documents als in-page complex upload-form met FormActions, ActionMenu en verplicht delete-reason-contract; Avatar remove via ConfirmDialog. Deze correctie markeert document file-picker/drag-drop/controlled changes dirty en verwijdert alleen de lokale `overflow-hidden`-clipping rond Personal full-page edit. API-, database-, RLS-, permission- en businesscontracten zijn behouden; Foundation-mappen zijn niet gewijzigd.
- Verificatie groen: correctiegerichte tests 4/4; volledige hr-suite 210 testbestanden/826 tests vóór deze correctie; strict TypeScript; targeted lint 0 errors met 4 bestaande warnings; i18n ongewijzigd; `git diff --check`.
- Browserstatus: exacte worktree-server draait op poort 3456; Playwright `/login` HTTP 200, desktop en 390×844 redirect-smoke met 0 console-errors en 1 bestaande preload-warning. Beschermde DEMO-035-route redirect naar `/login`; anonieme GET notes/documents/employee en PATCH employee geven 401. Authenticated DEMO-035 CRUD, negative persona, desktop employee-detail en 390×844 employee-detail blijven geblokkeerd omdat deze worktree en hoofdwerkplek geen fixture-passwords bevatten; `fixtures:talent-auth` kon daarom niet uitvoeren. Niet naar `main` mergen.
- Open: authenticated browseracceptance en real CRUD HTTP-statussen moeten nog worden uitgevoerd zodra TEST-fixture-auth beschikbaar is. Niet naar `main` mergen.
## UX v1.2 Correction Batch 2 — HR mutation surfaces — 2026-08-21

- Branch/worktree: `work/ux-v1-2-hr-mutation-surfaces` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\ux-v1-2-hr-mutation-surfaces`, gestart vanaf exact `origin/main` `a65d1daaa9444602f4be52c2d32933cffd285dd0`.
- Geïmplementeerd: absence report gebruikt `FormDrawer` met desktop right-drawer/mobile fullscreen, vaste FormActions-footer, dirty protection, saving/error en bestaande employment/self-service payloads. Recovery en capacity blijven inline met Foundation loading/error.
- Geïmplementeerd: employment contract-change wizard is full-page met sticky `FormActions`, bestaande stappen/payloads/timelinegedrag en dirty/beforeunload protection. Organization- en company-location-mutaties gebruiken alleen bij `canWrite=true` een `FormDrawer`; read-only rows zijn statische articles en bestaande assignments blijven zichtbaar zonder actieve locaties.
- Verificatie lokaal groen: gerichte regressie- en bestaande employmenttests 15/15, strict TypeScript, i18n 33 gelijke NL/EN-namespaces, gerichte ESLint en `git diff --check`. De volledige suite/build zijn voor deze niet-cross-cutting correctie niet opnieuw uitgevoerd.
- Authenticated browseracceptance staat open: de gekopieerde `apps/hr-suite/.env.local` bevat geen canonical fixture-password keys; `fixtures:talent-auth` stopt daarom vóór login. De targetserver kon niet op `http://localhost:3000` starten door `EADDRINUSE`; de bestaande listener kon niet betrouwbaar aan deze worktree worden toegeschreven. Anonieme checks: `/login` HTTP 200, `/dashboard/start` HTTP 307. Geen secrets gelogd of remote writes gebruikt.
- Geen centrale Foundation-, API-, schema-, database-, RLS-, permission- of businesscontractwijziging. Niet gemerged of gepusht naar `main`.

## UX Foundation v1.2 + Employee Reminders — 2026-08-21

- Centrale acceptancebron: [`TEST_ACCEPTANCE_MATRIX.md`](TEST_ACCEPTANCE_MATRIX.md) is vanaf deze slice verplicht voor lokale, browser- en functionele acceptance.

- Branch/worktree: `work/ux-foundation-v1-2-interaction-collections` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\ux-foundation-v1-2-interaction-collections`, acceptance-docs zijn gepusht op `a365aca22704e824bf0efc60bec4db523e884f54`; `origin/main` is `c4e176aec1a22bb927ac8b82ce890f71c72618a0`.
- Geïmplementeerd: v1.2 `Dialog`, `Drawer`, `ActionMenu`, `Pagination`, `FormDrawer`, `FormActions`, `ConfirmDialog`, `CollectionToolbar`, `RowActions`, `CollectionPagination`, `DataTableShell` en `EntityList`. `IconButton` ondersteunt ref-forwarding voor focus restore.
- Employee Reminders gebruikt nu EntityList + dezelfde FormDrawer voor Create/Edit, vaste footer, saving/double-submit protection, dirty-close ConfirmDialog, ActionMenu → delete ConfirmDialog en NL/EN reminderlabels. PERSONAL/HR, `canManageHr`, `canAdd`, `canManageItem`, target/publish-flow, bestaande reminder API's, datumshift en `router.refresh()` zijn behouden.
- Verificatie groen: v1.2/reminder gericht 11/11 plus mobile Drawer-regressietest; Reminder real CRUD CREATE 201, PUBLISH 200, PATCH 200 en DELETE 200; dirty-close GREEN; LinkedHR GREEN; volledige hr-suite 209 testbestanden/824 tests; strict TypeScript; i18n 33 gelijke NL/EN-namespaces; lint exit 0 met 6 bestaande warnings buiten deze slice; productiebuild 225 routes; `git diff --check`.
- Test acceptance matrix is actief en bevat ook de canonical fixture-auth preflight. `fixtures:talent-auth` laadt `.env.local` expliciet. De drie TEST-users zijn lokaal bijgewerkt; secrets blijven uitsluitend in `.env.local`.
- Responsive fix: de Foundation Drawer overschrijft op mobile de Dialog-backdrop-padding met `!p-0`, zodat de full-screen sheet exact de viewport vult; een gerichte componentregressietest dekt dit contract.
- Authenticated browserstatus: TEST HR op `/dashboard/start` is HTTP 200 zonder PGRST303 of relevante console-errors. De 390×844 Playwright Reminder acceptance voor DEMO-035 is GREEN: employee/detail/tab, full-screen drawer, bruikbare velden, Save/Cancel, dirty ConfirmDialog, keyboard/focus, intended scroll, ActionMenu/delete en cleanup zijn bewezen; `scrollWidth = 390` en 0 console-errors.
- Open: geen acceptance-acties meer voor deze slice. Bestaande wijziging in `apps/hr-suite/next-env.d.ts` blijft buiten scope; niet naar `main` mergen.

## Employee 360 final integration + Dashboard/Overview — 2026-08-21

- De geïsoleerde branch `work/emp360-dashboard-integration` is gestart vanaf exact `origin/main` `ff487e256ce4460c5a85fdde1e3542fe4ac5692d`. De drie gereviewde slices zijn conflictvrij geïntegreerd: Documents + Payslips `8ffb73c0b37b77cc38c2b712657036e89286f04b`, Reminders + Notes `6aae44a93bd1efd78bfbdb2472c04b1785b046e3` en Absence + Processes `1027ac278eab13de68672a3cfb19a4116004d153`. De mergecommit is `8f0bc6a9ee20023cc12387ad6fa78b3501393f2e`; alle drie commits zijn ancestors van de branch-HEAD.
- Dashboard/Overview is presentationeel gemigreerd naar Foundation v1. `employee-dashboard.tsx`, `employee-dashboard-summary.tsx`, `employee-dashboard-layout.tsx`, `employment-dashboard-summary.tsx`, `employee-activity-feed.tsx` en `profile-link-form.tsx` behouden de bestaande data, permissions, salary reveal, tabs, API-routes, PATCH-payload, drag/drop, compact/expanded gedrag en A/B/C-integratie. De globale dashboard-editactie is verwijderd; Personal-edit blijft contextueel beschikbaar.
- Nieuw requirementsdocument: [`REDESIGN_EMPLOYEE_360_DASHBOARD.md`](../requirements/ux/REDESIGN_EMPLOYEE_360_DASHBOARD.md). Status staat op `GEIMPLEMENTEERD / WACHT OP ACCEPTANCE`; volgende roadmap-item is Absence & HR Operations. Geen nieuwe FOUNDATION_GAP; Dialog en Multiselect blijven LATER.
- Verificatie: gerichte dashboardcontracttest 7/7; volledige hr-suite 208 testbestanden/809 tests; strict TypeScript; lint exit 0 met zes bestaande warnings buiten deze slice; i18n 33 gelijke NL/EN-namespaces; Webpack-production build 225 routes; `git diff --check` groen.
- Browserstatus: niet uitgevoerd en niet geclaimd. Deze geïsoleerde worktree bevat geen `.env`-bestand en er luistert geen passende lokale server op poort 3000. Authenticated desktop/390px/default/LinkedHR-controle blijft open voor de branch-previewacceptatie. Er is geen Supabase-write, main-merge, release, version bump of deployment uitgevoerd.

## UX acceptance follow-up — 2026-08-21

- Employment Detail acceptance-correcties: Compact/Uitgebreid is nu een icon-only link met aria-label en title; ScrollableTabs-overflowknoppen gebruiken een contrasterende accentkleur; Contract verwijderen gebruikt een zachte destructieve surface met behoud van de bestaande actie- en dialoogsemantiek.
- Verificatie: gerichte lint, strict typecheck, Turbopack-build (225 routes), `git diff --check` en authenticated browsercontrole op de employment detail-route zijn groen. Viewport-override naar 390px blijft niet beschikbaar in de in-app browser.
- Geen API-, database-, RLS-, permission-, service- of businesslogicawijziging.

## UX acceptance polish + governance sync — 2026-08-21

- Vanaf actuele `origin/main` `8de7df809f89b270c62c3ea5ea498d2d94826136` zijn de employee action tiles lokaal verbreed/gewrapt met maximaal drie kolommen op normale desktop en vier vanaf `2xl`; de employment overview kreeg lokale SectionHeader-spacing; de uitgebreide profile-header-editactie is verwijderd terwijl Personal-edit behouden bleef.
- UX Foundation, EdwinHelp, screen-redesign-roadmap en AGENTS-workflow zijn aangescherpt voor action wrapping, header hierarchy, content separation, browser acceptance en runtime-i18ncontrole. De suitebrede roadmap loopt nu van Foundation + Controls tot Final Product UX Sweep.
- Verificatie en browserstatus staan in de oplevering van deze slice; geen API-, database-, RLS-, permission-, service- of businesslogicawijziging.

## Foundation Controls v1.1 — 2026-08-20

- Branch `work/foundation-controls-v1-1` is gestart vanaf exact `main`/`origin/main` SHA `3dc4dc038940fdca731f292098a9b0760411c3d7`; de werkboom was schoon.
- Geïmplementeerd: `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `FormField`, `TabLink`, `TabButton`, `TextInput` adornments, Button/IconButton icon-contract, DropdownSelect token-hardening en canonical ScrollableTabs overflowcontrols. `happy-dom` is toegevoegd als dev-testdependency voor DOM-contracttests.
- Vooronderzoek: native multiple-selects, date-inputs en domeinmodalen bestaan concreet; zij zijn als FOUNDATION_GAP **LATER** vastgelegd. Een generieke tooltip is nu geen noodzakelijke gap.
- Verificatie: gerichte Foundation-tests 23/23 groen; volledige suite 203 testbestanden/788 tests, strict TypeScript, `check:i18n` (33 gelijke NL/EN-namespaces), lint, Webpack-build (225 routes/pages), `git diff --check` en browser smoke op `/login` zijn groen. Browserconsole bevatte alleen React DevTools/HMR-logs.
- Scopegrens behouden: geen productmodulemigratie, route/API/database/Supabase/RLS/permission/auth/businesslogicwijziging.

## LinkedHR polish + compact fixes 2026-08-20

- Nieuwe worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\linkedhr-polish` op branch `feature/ux-linkedhr-polish`, gestart vanaf baseline `5af312353beaf0512a200d40fa84b98135a4ded9` (`origin/feature/ux-employment-workspace`). De bron-worktree was schoon.
- LinkedHR-only tokens zijn aangescherpt naar circa 6px voor surfaces/inputs, 8px voor buttons/controls en 8px voor overlays. LinkedHR-buttons gebruiken geen blur, hover-lift of overdreven pill-radius; andere theme-tokenwaarden zijn niet gewijzigd.
- `ScrollableTabs` is toegevoegd als gedeeld pattern voor employee detail, personal subtabs en employment workspace: actieve tabs hebben een 3px underline; left/right controls verschijnen alleen bij echte overflow. Foto-upload/verwijdering gebruikt compacte toegankelijke icon-actions. De compacte employment-header verbergt alleen de extra metadata-rij; expanded blijft behouden.
- Compact dashboard render-fallback voorkomt lege widgetwrappers bij ontbrekende opgeslagen nodes en zet beschikbare inhoud gecontroleerd terug naar de hoofdkolom wanneer de brede kolom niet renderbaar is. Geen API-, database-, permission-, RLS- of Supabase-wijziging.
- Verificatie: volledige hr-suite 202/777, strict TypeScript, i18n 33 gelijke NL/EN-namespaces, Webpack-build 225 routes en `git diff --check` groen. Lint blijft geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-fout `contextOrFilename.getFilename is not a function`.
- Authenticated browserreview is niet uitgevoerd: deze worktree heeft geen Supabase-env; de lokale devserver gaf daardoor 500 op `/login` en de Playwright-browserdaemon kon de machinebrede browserdirectory niet openen. Er is geen Supabase-write, main-merge, release of version bump uitgevoerd.

## Employment Workspace UX-redesign 2026-08-20

- Nieuwe worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\employment-workspace` op branch `feature/ux-employment-workspace`, gestart vanaf `debbe8fccd235375d0fdfbcdbb80a36dc7f677a8` (`origin/feature/ux-employee-personal-tab` volgens de lokale remote-tracking ref). Live `ls-remote` kon niet worden uitgevoerd door ontbrekende Git-credentials; er is geen remote write gedaan.
- Employment Detail gebruikt nu een vlakke Compact Work Context Header met avatar/naam, functie, afdeling, administratie, nummers, status, primaire markering, start/einddatum en de bestaande compact/uitgebreid-actie. De acht bestaande workspace-tabs staan direct eronder als vlakke underline-tabs.
- De route, URL-state, permissions, API's, schema/RLS, bestaande timeline- en contractmutaties en overige acties zijn behouden. Alleen de eerder goedgekeurde organisatiecontext-read voor de stabiele header blijft actief; er is geen bredere data-fetchuitbreiding toegevoegd.
- De volledige presentation slice is gemigreerd: employment-overviewingang, header, alle acht tabs, EmploymentTimeline, SelectableTimelineList, WorkPatternPanel, EmploymentTimeMap, organization/company-location managers, SalaryBandPositionCard en percentage-control, EmploymentContractTimeline, EmploymentMutationPanel, EmploymentOverviewActions, ConfirmationDialog en de zichtbare EmploymentContractChangeDialog/editor-presentatie.
- Gewijzigd: de genoemde Employment/Salary-presentatiecomponenten, employment-detailpagina, NL/EN employment-vertalingen en UX-redesignstatus/documentatie. Geen Supabase-write, release/version bump, main-merge of deployment.
- Verificatie: strict typecheck groen; `check:i18n` groen met 33 gelijke NL/EN-namespaces; volledige hr-suite groen met 202 testbestanden en 777 tests; Webpack-productiebuild groen met 225 routes; `git diff --check` groen. Volledige lint blijft geblokkeerd door de bekende ESLint 10 / `eslint-plugin-react`-incompatibiliteit (`contextOrFilename.getFilename is not a function`) op de ongerelateerde absence-pagina. Browsercontrole is niet uitgevoerd: de worktree heeft geen `.env.local` en poort 3000 luistert niet; secrets zijn niet gekopieerd.
- Deze slice wordt afgesloten met exact één extra commit `fix: complete employment workspace foundation migration` en een push naar `origin/feature/ux-employment-workspace`; geen main-merge.

## Employee Personal Tab — final correction 2026-08-20

- Op `feature/ux-employee-personal-tab` is de onbedoelde functionele uitbreiding uit `PersonalPanel` verwijderd: titel, initialen, partnernaamvelden, voornaamwoorden, burgerlijke staat/-datum en opleidingsniveau zijn niet langer bewerkbaar, leesbaar of onderdeel van het labelcontract/PATCH-body. De bestaande onderliggende velden en API/schema zijn niet gewijzigd.
- De actieve `AddressFormV2` gebruikt Foundation `TextInput`, `Button`, `SELECT_CLASS` en semantic overlay-/subsectiestyling. De onbereikbare `LegacyAddressesPanel`/`AddressForm` fallback is verwijderd; address search, postcode lookup, reminders, controlled state en validatie zijn behouden.
- Verificatie: gerichte personal-cardtest 1/1, relevante employee-tests 9 suites/30 tests, strict typecheck, i18n 33 namespaces, Webpack-productiebuild 225 routes en `git diff --check` groen. Lint blijft geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react` incompatibiliteit (`contextOrFilename.getFilename is not a function`). Geen schema-, API-, security-, theme-, remote-, main-, release- of versionwijziging.

## UX Foundation v1 — Blok 4 governance afgerond 2026-08-20

- UX Foundation v1 is compleet: Blok 1 t/m 4 zijn afgerond. `AGENTS.md` en de screen-redesignskill maken Foundation v1 nu verplicht voor toekomstige HR Suite UI-ontwikkeling.
- Reference screens zijn `/employees` als list/workbench en `/employees/[employeeId]` als profile/detail; Employee Detail gebruikt `DetailColumns` met ongeveer 2/3 hoofdinhoud en 1/3 aside. LinkedHR is een officieel theme op dezelfde Foundation.
- De gebruiker heeft de actuele feature-preview handmatig visueel beoordeeld, inclusief Employee Detail dashboard en Employee Detail persoonsgegevens/adressen. Dit is gebruikersreview en geen geautomatiseerde browserverificatie.
- De volgende stap is bredere, gecontroleerde schermmigratie. Blok 4 bevatte geen code-, design-, component-API-, database-, migration- of Supabase-wijziging; de eerder goedgekeurde LinkedHR-migratie bleef ongewijzigd.
- Finale branchgate en commit/push horen bij deze afsluiting; er is niet naar `main` gemerged.

## Employee Detail profile polish + LinkedHR 2026-08-20

- Op `feature/ux-foundation-v1` is `/employees/[employeeId]` visueel aangescherpt: lichte profielkaart met subtiele coverzone, overlappende avatar, duidelijke identity/status/meta-hiërarchie, bestaande edit-/archive-/weather-/compactacties en vlakke tabs. Functie en afdeling komen uitsluitend uit de al geladen `currentEmploymentSummary`; geen nieuwe fetch.
- Het nieuwe thema `linkedhr` gebruikt theme-level tokens voor lichte workspace/surfaces, blauw accent, lichte sidebar, system/UI-font en aangepaste radius/input/buttontokens. Bestaande zes themes houden hun bestaande tokenwaarden.
- Supabase-migratie `20260820081814_add_linkedhr_theme` is met expliciete toestemming toegepast op project `wnpfloqpjvaacobppbpk`; `public.ui_theme` bevat nu `linkedhr` en `packages/db/types.ts` is bijgewerkt. Advisors tonen alleen bestaande projectbrede meldingen.
- Verificatie: gerichte voorkeurstest 10/10, strict typecheck, ESLint, i18n-pariteit (33 namespaces), Webpack-productiebuild en `git diff --check` groen. Lokale LinkedHR-preview op 390x844 gebruikt de juiste tokens en heeft geen horizontale overflow; Employee Detail expanded/compact browsercontrole blijft open wegens ontbrekende ingelogde browser-sessie.

## UX Foundation v1 — Blok 3 eindgate 2026-08-20

- Blok 3 is uitgevoerd op `feature/ux-foundation-v1` voor `/employees` en `/employees/[employeeId]`. De Employees reference implementation gebruikt `PageShell`, `PageHeader`, `Surface`, `EmptyState`; Employee Detail gebruikt een vlakke zakelijke profielheader met `Surface`/`Badge`; het dashboard gebruikt `DetailColumns` en behoudt wide/narrow, drag/reorder en opgeslagen voorkeuren.
- Alle bestaande employee view modes, filters, URL-state, scope, permissions, tabs, weather, widgets, documenten, reminders, journeys, absence, workflows, salary visibility en notes zijn behouden. Geen schema-, API-, RLS-, security-, release- of deploymentwijziging. **Blok 4 niet gestart.**

## UX Foundation v1 — Blok 2 gecorrigeerde baseline 2026-08-20

- Blok 2 is uitgevoerd op `feature/ux-foundation-v1`: generieke UI-primitives in `components/ui`, composities in `components/patterns` en layoutcontracten in `components/layout`.
- Beschikbaar: `Button`, `IconButton`, `TextInput`, `Surface`, `Badge`, `EmptyState`, `PageHeader`, `SectionHeader`, `PageToolbar`, `FilterBar`, `InfoList`, `PageShell` en `DetailColumns`. `DropdownSelect` en `CountryPicker` zijn behouden.
- Gerichte foundationtests: 12/12 groen. De volledige Blok-2-baseline was 201 testbestanden / 775 tests, 33 i18n-namespaces en een build met 225 routes/pages.
- Alleen foundationcomponenten en documentatiestatus zijn gewijzigd. Geen schema-, API-, permission-, businesslogic-, release-, deployment- of Supabase-wijziging. **Blok 3 niet gestart.**

## Controlecorrectie UX Foundation v1 — Blok 1-baseline 2026-08-20

- Historische Blok 1-baseline op dezelfde featurebranch: de CSS-split naar `app/styles/tokens.css`, `themes.css`, `base.css` en `components.css`, Work Sans, bestaande classes, theme support en additive semantic aliases zijn behouden.
- De bestaande UI-flow/security/data/sidebar/RBAC/URL-state-regels zijn behouden. `packages/ui` is niet ingevoerd.
- De eerdere Blok 1-gates waren groen; de actuele Blok 2-eindgate staat in de nieuwe overdracht hierboven en vervangt de oude scopevermelding.

## Release 2026-08-16: lokale consolidatie en productversie 1.20260816.1

- Alle lokale featurebranches zijn gecontroleerd; hun tips zijn al ancestors van `main`. De resterende medewerkerwizard/avatar/rooster-wijzigingen zijn in `main` vastgelegd.
- De zichtbare productversie is volgens `X.datum.volgnummer` verhoogd naar `1.20260816.1`; de technische npm-versie blijft ongewijzigd.
- Releasegate: 200 testbestanden/763 tests, strict TypeScript, ESLint 0/0, 33 gelijke NL/EN-namespaces, Webpack-build met 225 routes/pages en diff-check zijn groen. GitHub `origin/main` is gepubliceerd op commit `18cf531`.

## Supabase-avatar-RLS 2026-08-16

- Na expliciete toestemming is `allow_hr_preplacement_avatar_storage` toegepast op dev/test-project `wnpfloqpjvaacobppbpk` (remote geregistreerd als versie `20260816151833`). De `employee-avatars`-policies voor insert, update en delete gebruiken nu `internal_security.employee_subresource_can_write`.
- Remote controle is groen: alle drie policies bestaan voor `authenticated`, beperken tot bucket `employee-avatars` en verwijzen naar de pre-placement schrijver. De transactietest voor medewerker `a256a3cc-c3be-4c57-a351-4d63a24e6524` gaf geen fout; de functie staat dus voor de gekozen `employee:write`-actor toe vóór de eerste organisatieplaatsing. Geen uploaddata is aangemaakt of achtergelaten.
- Supabase security-advisor: 83 bestaande projectbrede meldingen (1 INFO, 82 WARN), geen nieuwe avatar/storage-bevinding. Performance-advisor: 0 meldingen. Open: authenticated browsercontrole van de echte foto-upload en de volledige aanmaakflow.

## Lokale main-consolidatie en Employees UX vNext — 2026-08-16

- `main` bevat de lokaal gemaakte wijzigingen uit de relevante worktrees. De Employee/employment-wijzigingen staan in `5a01fd9` (`feat: consolidate local employee and employment work`) en de Startpagina-compactwijziging is lokaal samengevoegd in `a7db6dc` (`merge: add startpage compact view`). Er is niet gepusht of gedeployed; de bestaande stash met handmatige acties is behouden.
- De lokale consolidatiegate is groen: `199` testbestanden / `760` tests, strict TypeScript, lint, i18n met 33 gelijke NL/EN-namespaces en productiebuild met 225 routes/pages.
- De Employees UX vNext-pilot op `/employees` is lokaal geïmplementeerd volgens `docs/requirements/ux/REDESIGN_EMPLOYEES_VNEXT.md`: Work Sans via `next/font/google`, rustigere vlakke filter-/lijstpresentatie, compactere detail- en kaartweergave en responsieve filtercontrols. Bestaande query-, URL-, autorisatie-, directory- en medewerkerstype-/archiefgedragingen zijn behouden.
- De browsercontrole met Test HR Admin op `localhost:3000` is groen op desktop en 390×844: filters openen, zoeken en resetten, detail/card-switching, 0 console-errors, Work Sans actief en geen horizontale overflow (`scrollWidth = 390`). Alleen Next dev/HMR/preload-waarschuwingen zijn gezien.
- Open: Edwin's visuele beoordeling. Zonder akkoord wordt geen volgende UX/UI-pagina aangepakt. Geen schema-, API-, remote-, versie-, push- of deploymentwijziging.

## Medewerkerswizard — verplicht medewerkertype 2026-08-16

- Het veld `Medewerkertype` in het dienstverbandgedeelte start leeg met een expliciete keuze-placeholder. De keuze is verplicht: `Volgende` blijft disabled totdat een type is gekozen en de wizardvalidatie weigert een lege waarde ook serverpayload-voorbereidend.
- Verificatie: gerichte wizardvalidatietest 8/8, `check:i18n` met 33 gelijke NL/EN-namespaces, strict TypeScript, `git diff --check` en authenticated browsercontrole op poort 3000. In de browser bleef `Volgende` disabled op de lege stap en ging de wizard na `Medewerker` door naar `Looncontractgegevens toevoegen`. Geen schema-, API-, remote-, commit-, push- of deploymentwijziging.

## Dienstverbandwijzigingen — UX-redesign en test 2026-08-16

- De wijzigingswizard op het dienstverband toont contractvelden met expliciete labels en i18n-fallbacks, gebruikt in de startdatumstap één compacte contractsamenvatting en heeft in de uren-/roosterstap de herkenbare groepen `Urenafspraak` en `Rooster`. Uren- en roostervelden werken met hele uren; de vier actieve flows zijn op dezelfde label- en structuurregels gebracht. De niet-ondersteunde CAO-, contracttype/startdatum- en verwijderacties blijven expliciet beschikbaarheidsmeldingen tonen.
- Het werkpatroonendpoint gebruikt dezelfde tenant-/medewerkergrens als de bestaande employment-detailservice; de controle op een exacte actieve administratie is verwijderd omdat een HR-admin met tenant/HR-groeprecht anders een dienstverband in een andere administratie ten onrechte als 404 zag. Bij een retroactieve urenwijziging begrenst de wizard het nieuwe werkpatroon op het eerstvolgende urenblok of contracteinde.
- Testdata voor Lina Bakker / `EMP-DEMO-026-A` is met gebruikersautorisatie gecontroleerd en consistent gemaakt: 40 uur vanaf `2024-01-06`, 38 uur van `2026-08-01` tot `2026-09-01` en 39 uur vanaf `2026-09-01`, inclusief werkpatronen. Er is geen schemawijziging uitgevoerd.
- Verificatie: desktop- en 390×844-browsercontrole met Test HR Admin, vier actieve wijzigingsflows zonder `undefined`, werkpatroonkaart zichtbaar, definitieve browserreload zonder console-errors/warnings; i18n 33 namespaces, strict typecheck, gerichte ESLint, 9 gerichte tests en `git diff --check` groen. Volledige testsuite/productiebuild/releasegate zijn niet uitgevoerd.
- Zie [`requirements/ux/REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md`](../requirements/ux/REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md) voor de UX-besluiten en acceptatiepunten. Geen commit, push, merge of deployment uitgevoerd.

## Medewerkerslijst: medewerkerstype en archieflabel 2026-08-16

- De medewerkerslijst toont rechts niet langer dienstverband-aantallen of actieve/toekomstige statuslabels. De lijstservice verrijkt de bestaande veilige employee-overview voor `employee:read` met het actuele, anders toekomstige of anders meest recente `employment_type`; de UI toont de bestaande NL/EN-typenamen. Medewerkers zonder dienstverband vallen terug op `Externe persoon`.
- `Gearchiveerd` wordt alleen bij `isArchived` getoond; niet-gearchiveerde medewerkers krijgen geen statusbadge. Compacte metadata, administratievoorwaarden, URL-state en directorybeperkingen blijven behouden.
- Verificatie: `employee-overview.test.ts` 4/4, authenticated browsercontrole op de compacte lijst met geen dienstverband-aantallen en geen Actief/Toekomstig-labels, plus `git diff --check`. Volledige TypeScript-check blijft geblokkeerd door niet-gerelateerde dirty wijzigingen in `components/employment/employment-contract-change-dialog.tsx` (`intersectsContract`/`items` buiten scope). Geen schema-, remote-, commit-, push- of deploymentwijziging uitgevoerd.

## Medewerkerslijst: lege ontbrekende velden en headeractie 2026-08-16

- Compacte medewerkersregels tonen geen `Niet vastgelegd` meer: ontbrekende afdeling, functie en administratie worden weggelaten zonder losse scheidingstekens. Dezelfde lege-waarde-regel geldt voor Detail en Card.
- `Nieuwe medewerker` staat nu rechts in de filterheader naast de filterbediening; het medewerkersaantal staat als footer onder de lijst. De bestaande URL-state, filters en autorisatie blijven behouden.
- Browsercontrole en `git diff --check` zijn groen. De volledige TypeScript-check wordt geblokkeerd door niet-gerelateerde dirty wijzigingen in `components/employment/employment-contract-change-dialog.tsx` (`intersectsContract`/`items` buiten scope); de medewerkerslijstwijziging introduceert daar geen wijzigingen. Geen schema-, API-, remote-, commit-, push- of deploymentwijziging uitgevoerd.

## Medewerkerdetail Compact: dashboardkolommen zonder drag/drop 2026-08-16

- Op de medewerkerdetailpagina geeft de server-side `view=compact`-status nu door aan het dashboard. Compact behoudt bij voldoende schermbreedte de bestaande 8/4-dashboardkolommen en valt op smallere schermen terug naar één kolom; de drag-and-drop-attributen en de verplaatsbalk met omhoog/omlaag-bediening worden niet gerenderd. Uitgebreid behoudt de bestaande twee kolommen en persoonlijke layoutvoorkeur.
- Geen schema-, API-, remote-, commit-, push- of deploymentwijziging uitgevoerd. Gerichte browsercontrole en TypeScriptcontrole volgen voor deze wijziging.

## Medewerkerslijst: administratie en compacte regel 2026-08-16

- De medewerkerslijst leest voor bevoegde `employee:read`-kijkers de unieke actieve HR-groepadministraties van de niet-geannuleerde employments. In Detail verschijnt `Administratie: ...`; bij meerdere administraties worden namen één keer getoond. Directory- en beperkte managerrecords krijgen deze gegevens niet.
- Compact toont nu één regel als `Naam [nummer] - afdeling - functie (administratie)`; het label `Personeelsnummer:` is in Compact verwijderd. De administratie wordt alleen toegevoegd wanneer de HR-groep twee of meer actieve administraties heeft. Bestaande directory/privacy- en URL-state blijven behouden.
- Verificatie: gerichte `employee-overview`-tests 4/4, i18n-check 33 gelijke NL/EN-namespaces, `git diff --check` en authenticated browsercontrole op poort 3000 voor HR Admin in Compact en Detail; de browser toonde onder meer `Lina Bakker [DEMO-046]` met `Mars BV, Jupiter BV` en Detail met dezelfde unieke namen. Browserconsole: 0 errors/warnings.
- Open: volledige typecheck stopt op een al bestaande dubbele objectkey in `app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx:469`; gerichte ESLint stopt op de bekende ESLint 10/`eslint-plugin-react`-incompatibiliteit. Geen schema-, remote-, commit-, push- of deploymentwijziging uitgevoerd.

## Phase 2 Salary Structures + Salary Application — GREEN 2026-08-14

**Status: IMPLEMENTATION COMPLETE — PHASE 2 GREEN / CHECKPOINT BASELINE**

- **Scope en baselinebewijs:** uitgevoerd in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\salary-structures` op `feature/salary-structures`; `main` is niet gewijzigd. De bestaande Salary Structures- en Salary Application-architectuur is gebruikt.
- **Employment-detail root cause:** `salaryBand` werd in de mutation-labelmapping als top-level employment-key vertaald, terwijl de NL/EN-berichten onder `salaryApplication.salaryBand` staan. De mapping gebruikt nu één getypeerde sleutelresolver; de regressietest voorkomt opnieuw een top-level lookup.
- **Avatar root cause:** directory mode gaf voor een andere medewerker een beschermde `/api/employees/:employeeId/avatar`-URL door aan de Employee-UI. De avatarservice en `employee:read`-autorisatie zijn correct; alleen de directoryprojectie filtert deze protected route voor peers. `data:`-avatars blijven beschikbaar en de eigen avatar blijft toegestaan. De remote fixture bevatte voor de Employee-fixture een `data:`-avatar; de ene `storage://`-avatar heeft een bestaand object. Supabase API- en storage-logs bevatten geen 403.
- **Lokale gate:** volledige testsuite `195 testbestanden / 741 tests` groen; strict TypeScript groen; ESLint met `--max-warnings=0` groen met `0 errors / 0 warnings`; i18n groen met 33 gelijke NL/EN-namespaces; Webpack productiebuild groen met 224 statische pagina's; `git diff --check` groen.
- **Authenticated browsergate:** HR Admin employment detail laadt op 390×844 zonder runtimefout; Manager dashboard en geautoriseerde teamavatar laden zonder consolefouten; Employee directory op 390×844 vraagt geen beschermde avatarresource meer en heeft geen consolefouten. De bestaande Salary Structures-rolgrenzen zijn opnieuw gecontroleerd op de authenticated testrollen.
- **Remote Supabase gate:** identity `wnpfloqpjvaacobppbpk` (`LiquidHR`, eu-west-3, ACTIVE_HEALTHY) is opnieuw read-only geverifieerd; de Phase 2-migrations, RLS/grants, fixture en advisors blijven groen volgens de vorige gate. Er is in deze blockerfix geen remote schema- of securitywijziging uitgevoerd.
- **Git/deployment:** deze groene baseline is de afgesproken lokale checkpoint voor Salary Structures + Salary Application. Geen push, merge, deploy, PR of version bump.

## Phase 3 Salary Insights — GREEN 2026-08-15

**Status: GREEN — PHASE 3 CHECKPOINT READY**

- **Basis en checkpoint:** uitgevoerd in dezelfde worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\salary-structures`, branch `feature/salary-structures`, vanaf Phase 2-checkpoint `de3bf54` (`feat: checkpoint salary structures and salary application`). De bestaande Insights-architectuur, Salary Application-resolutie, URL-state, filters, tabel/charts, CSV-patroon en NL/EN-i18n zijn behouden.
- **Rapporten:** zes server-side, peildatumgebonden rapporten zijn beschikbaar voor HR Admin: `salary-overview`, `salary-band-position`, `salary-band-status`, `salary-scale-steps`, `salary-structure-exceptions` en `salary-internal-position`. Het interne rapport blijft HR Admin-only.
- **Exacte Manager-scope:** Manager kan precies vijf Salary Insights-reportcards/routes/API-rapporten gebruiken: `salary-overview`, `salary-band-position`, `salary-band-status`, `salary-scale-steps` en `salary-structure-exceptions`. `salary-internal-position` staat niet in de catalogus; directe URL en browser-fetch/API geven `403 SALARY_INSIGHTS_INTERNAL_POSITION_FORBIDDEN`. HR Admin kan dit zesde rapport gebruiken. Manager had in HTML, JSON en browser-networkresponses geen niet-null peer-median, average, percentile, delta of relative-positionvelden.
- **Fixtures:** de dev/test-only migratie `20260815090000_salary_insights_test_fixtures.sql` is transactioneel toegepast op Supabase `wnpfloqpjvaacobppbpk` na tenant/HR-groep/publisher-identitychecks. Er zijn 3 actieve `MINIMUM_WAGE`-rijen (2× `REGULAR`, 1× `BBL`), zonder lokaal salarisbedrag; de minimumloonrijen verschijnen niet als €0 in salary-sum/averages. Er zijn 6 actieve `SALARY_BAND`-rijen uit de bestaande canonical E1/E2/E3/S1-structuren: 3 binnen de band, 2 onder minimum en 1 boven maximum, inclusief FTE `1.0`, `0.8` en `0.2`, geldige compa-ratio's en range penetration. Canonical expected values zijn niet aangepast; de bestaande open-max E6-structuur blijft ongewijzigd.
- **API/RPC/securitybewijs:** de projectie gebruikt `SECURITY DEFINER` met `search_path = ''` en de dedicated `can_view_salary_insights_employee`-guard; `authenticated` heeft alleen de bedoelde projectie-EXECUTE, `anon`/`public` niet. HR Admin API/RPC: authorized population/row count `63`; Manager: `17`, als subset van HR Admin; Employee: alle zes API's `403` en RPC `FORBIDDEN`. Empty HR-groep en cross-tenant RPC zijn voor HR Admin, Manager en Employee `rowCount=0 / FORBIDDEN`. De HR Admin internal-position-response had `sufficientGroups=0` en `insufficientGroups=63`, zonder verborgen peer-statistieken. De vijf relevante tabellen hebben remote RLS; cross-tenant/HR-groep-leakage is in de authenticated gate niet reproduceerbaar.
- **Remote advisor-context:** security advisor: `83` projectbrede lints (`82 WARN`, `1 INFO`), waarvan één verwachte salary-specifieke algemene waarschuwing over authenticated EXECUTE op de actor-geautoriseerde projectie-RPC; geen ontbrekende Salary Insights-RLS/grant/scopebevinding. Performance advisor: `475` projectbrede lints, zonder Salary Insights-match. Deze bestaande/projectbrede meldingen zijn geen nieuwe Phase 3-deviation; productiehardening blijft een apart projectbreed werkpunt.
- **Browsermatrix:** authenticated Playwright-gate `apps/hr-suite/scripts/salary-insights-release-gate.mjs` is na de productiebuild opnieuw groen. HR Admin: desktop 1440×900 én 390×844, alle zes rapporten; overview totaal `63`, band position/status totaal `6`, statussen `UNDER_MINIMUM`, `WITHIN_RANGE`, `ABOVE_MAXIMUM`, scale/steps totaal `42`, exceptions totaal `0` met correcte lege staat, internal totaal `63`. Band-KPI's: onder `2`, binnen `2`, boven `2`, geen geldige band `0`, gemiddelde compa `106.55`, gemiddelde range penetration `72.21`; overview salary sum `215435.00` sluit null minimumloonbedragen uit. Manager: desktop én 390×844, precies vijf toegestane rapporten; band position/status totaal `3`, scope `17`, geen peer-statistieken; directe internal-URL geblokkeerd. Employee: desktop én 390×844, nul Salary Insights-cards/data.
- **Overige gates:** CSV-export is voor HR Admin en Manager toegestaan en niet-leeg; Manager internal-export is `403`; Employee-export is denied. Historische peildatum `2026-07-31` gaf HR Admin `200`/totaal `60` en Manager `200`/totaal `16`; actuele datum `2026-08-15` is exact in API/KPI's teruggevonden. NL en EN zijn authenticated gecontroleerd; EN toont “Salary overview” met `lang="en"`, daarna is de HR Admin-fixture teruggezet naar NL. De in-app `ERR_BLOCKED_BY_CLIENT`-beperking is niet als API-evidence gebruikt: server-side authenticated API/RPC- en Playwright-networkbewijs is geleverd.
- **Lokale eindgate:** `199` testbestanden / `758` tests groen; strict TypeScript groen; ESLint `--max-warnings=0` met `0 errors / 0 warnings`; i18n `33` gelijke NL/EN-namespaces; Webpack-productiebuild met `225` pagina's/routes; `git diff --check` groen. De gegenereerde browser-screenshots zijn alleen gate-output en worden niet in de checkpointcommit opgenomen.
- **Releasegrens:** Phase 3 wordt lokaal gecommit als checkpoint met `feat: add salary insights`. Er is geen push, merge, deploy, PR of version bump uitgevoerd.

## Salaristoepassing en salarisstructuren — vervolgslice 2026-08-14

**Status: IMPLEMENTATION COMPLETE — PHASE 2 GREEN; vervangen door de actuele status hierboven**

- **Worktree:** `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\salary-structures`, branch `feature/salary-structures`; `main` is niet gewijzigd. Geen commit, push, merge, deployment, PR of version bump.
- **Gebouwd:** de administration×CAO-intersectie met de expliciete nul-linkfallback; een centrale datumgebonden revision resolver voor schaal/trede en salarisband; HR-uitzonderingen in het bestaande Insights-patroon; route-, band- en schaal/tredevelden in de bestaande salarisflows; server-side unauthorized redirect naar `/geen-toegang` voor salary administration settings. De equality guard is `minimum < midpoint < maximum`.
- **Lokaal bewijs:** de vervolgslice is opgenomen in de groene Phase 2-baseline; de actuele eindgate staat hierboven met 195 testbestanden/741 tests, strict TypeScript, volledige ESLint, i18n-pariteit, Webpack-build en diff-check.
- **Remote dev/test:** project `wnpfloqpjvaacobppbpk` (`LiquidHR`, `eu-west-3`, PostgreSQL 17.6) is geverifieerd. De vier salary-applicationmigrations zijn remote toegepast: domain, resolution/exceptions, anon-grant hardening en covering indexes. De gegenereerde types bevatten de salary route-enums en RPC's; `packages/db/types.ts` bevat deze definities.
- **Remote data:** canonical HR-groep `80975e8a-b0dd-4552-be20-cd3944da9b2b` heeft 5 structuren, 7 revisies (5 gepubliceerd/2 draft), 3 CAO-relaties met 0/1/2 links, 1 open migratieconflict, 18 Rijk-schalen en 198 Rijk-tredes per revision. De canonical assertions voor twee schaalstructuren, drie bandstructuren, open top, twee-stapsschaal en multiple revisions zijn bevestigd.
- **Remote security/performance:** 11 blootgestelde salary-tabellen hebben RLS; `anon` heeft 0 tabelgrants en de 5 salary application RPC's zijn alleen uitvoerbaar door `authenticated`. De security-advisor heeft 0 salary-specifieke bevindingen. De vier ontbrekende samengestelde employment-salary-FK-indexes zijn toegevoegd; de resterende settings-policy performance-WARNs blijven bewust staan om `contract:*` en `salary:*` niet tot één brede autorisatiepolicy samen te voegen.
- **Browserbewijs:** HR Admin opende login, administratiekeuze, CAO-hostsectie, salarisroutes, salarisstructuren en `insights?report=salary-exceptions` op desktop en 390×844; succesvolle flows hadden geen console-errors. Het exceptions-report is zichtbaar en leeg voor de huidige demo-administratie, omdat daar geen ongeldige regels zijn. Manager en employee zagen geen salarybeheer in de navigatie; directe salary-settingsroutes tonen geen salarydata en eindigen op de bestaande no-access-ervaring. De manager denial is na de fix opnieuw browsermatig bevestigd zonder console-error.
- **Open:** de repositorybrede lint-toolchain is de enige bekende lokale releaseblocker. Remote settings-policy performance-WARNs zijn gedocumenteerd als bewust securitytrade-off; er is geen veilige policy-merge toegepast. Geen deployment, push, merge, PR of version bump zonder expliciete opdracht.

## Salarisstructuren — Stap 1 GREEN 2026-08-14

- **Branch/worktree:** `feature/salary-structures` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\salary-structures`, gebaseerd op `49d99069961ed414cd8effbdeed3fb7eae66499f`. Er is niet gecommit, gepusht, gemerged, gedeployed en de productversie is niet gewijzigd. Stap 2 blijft in exact deze branch/worktree.
- **Canonieke bronnen:** het authoritative package is byte-identiek opgeslagen onder `docs/requirements/salary-structures/` en `docs/superpowers/plans/2026-08-14-salary-structures.md`. Product Requirements: exact SSR-001 t/m SSR-069. UX Reference: exact SS-001 t/m SS-011. Gelezen en herbeoordeeld in de volgorde Product Requirements → UX Reference → dataset README → dataset JSON → plan → Stitch alleen visueel. De planprompt die README/JSON omdraait en verouderde Stitch-termen/voorbeeldwaarden zijn niet leidend.
- **Supabase:** dev/test-project `wnpfloqpjvaacobppbpk` (`LiquidHR`, `eu-west-3`, PostgreSQL 17.6) bevat de negen lokale Salary Structures-migrations van `20260814065647` t/m `20260814075803`. Gebruik geen ongerichte `db push`.
- **Schema:** HR-groepbrede `salary_structures` → `salary_structure_revisions`, stabiele `salary_scales`/`salary_bands`, revision content in `salary_scale_revision_values`, `salary_scale_steps` en `salary_band_values`, plus `labor_condition_salary_structures` en `salary_structure_migration_conflicts`. Structure type en HR-groepidentity zijn stabiel; gepubliceerd revision content en ingangsdatum zijn immutable; duplicate effective dates worden geweigerd.
- **Legacycompatibiliteit:** bestaande concrete step-ID's zijn behouden. Vóór migratie waren er 4 schalen/4 revisies/4 steps en 60 employment salary-links; na migratie zijn alle 60 links geldig en zijn er nul orphans. Drie legacy `DEMO`-codes binnen één HR-groep zijn niet stil samengevoegd maar als één open conflict vastgelegd. Employment salary-writers blijven werken zonder nieuw verplicht HR-groepveld; de database leidt en valideert dit vanuit Employment.
- **Security:** 9/9 exposed tabellen hebben RLS, gesplitste SELECT/INSERT/UPDATE/DELETE-policies en expliciete grants; anon heeft nul tabelgrants. Bedragrijen vereisen naast `salary-structure:read/write` ook `salary:read/write`. Root/draft/save/publish en CAO-relation RPC's controleren auth, tenant, HR-groep en permissions server-side. De laatste security-advisor heeft nul Salary Structures-bevindingen; performance bevat alleen nieuwe unused-index-INFO.
- **Calculations/API:** geld en percentages worden als decimal strings aangeleverd en met integer-decimal arithmetic berekend. Midpoint+spread, min+max, range spread, midpoint progression, overlap en gap matchen alle canonieke expected metrics. De API-routes staan onder `/api/master-data/salary-structures` en `/api/settings/employment/labor-condition-sets/:id/salary-structures`. Bestaande employment-keuzes lezen uitsluitend de nieuwste effectieve gepubliceerde revision per logical structure.
- **Testdataset:** de deterministische generator `apps/hr-suite/scripts/generate-salary-structures-fixture.mjs` leest uitsluitend de canonieke JSON en weigert impliciet gebruik zonder expliciete tenant/HR-groep/administratie/publisher. Remote fixture in de bestaande lege testgroep: 5 structures, 7 revisions, 20 logical scales, 38 scale values, 403 steps, 13 logical bands, 19 band values, 3 CAO relations en 1 migration conflict. Officiële Rijkrevision: 18 schalen/198 steps; schaal 8/trede 5: €3.741,48. De fixture is test-only en geen runtime dependency.
- **Bewijs:** transactioneel create/draft/publish groen; duplicate effective date geblokkeerd; published mutation geblokkeerd; twee CAO-relaties toegestaan; cross-HR-group relation geblokkeerd; ontbrekend employment salary HR-groepveld correct afgeleid. Lokaal 4 testbestanden/21 tests groen, strict TypeScript groen, gerichte ESLint zonder warnings en `git diff --check` groen. Remote types zijn gegenereerd met behoud van de bestaande lokale `company_activities`-compatibiliteitsdefinitie; de bijbehorende reeds bestaande local-only migration ontbreekt nog remote en is niet opportunistisch toegepast.
- **Open voor Stap 2:** bouw uitsluitend de complete SS-001 t/m SS-011 HR Admin-UX, CAO-hostsectie en migratieconflict-UX op deze architectuur; voeg NL/EN-i18n toe en voer daarna volledige browser-, 390×844-, keyboard/focus-, leakage-, build- en releaseverificatie uit. Geen push, merge, deployment, PR of version bump zonder expliciete opdracht.

**DO NOT recreate previous-step architecture.**

## Guided Recruitment — lokaal geconsolideerde testrelease 2026-08-13

- De volledige Guided Recruitment-feature is vanuit `feature/recruitment` lokaal samengevoegd naar `main`. De feature-afrondingscommit is `fd367ff`; de normale mergecommit was `98fc2f0`; versie-/lintfix en release-documentatie zijn daarna gecontroleerd gecommit.
- Zichtbare productversie: `1.20260813.1`. De definitieve lokale gate is groen: 182 testbestanden/687 tests, strict TypeScript, 33 gelijke NL/EN-namespaces, ESLint zonder warnings, `git diff --check` en Webpack-build met 223 pagina's.
- De Recruitment-migrations, contracttests, fixture, requirements, i18n en generated DB-types zijn lokaal behouden en gecommit; bestaande remote migrationclaims uit de Recruitment-handoff zijn niet opnieuw uitgevoerd. De lokale worktree was niet aan Supabase gelinkt, daarom is geen ongerichte remote write of `db push` uitgevoerd.
- De publieke securityconfiguratie blijft bewust geparkeerd: Turnstile, rate-limit-pepper en malware-scanner ontbreken; publieke submit/upload blijft fail-closed. Zie [`docs/requirements/recruitment/LIQUIDHR_RECRUITMENT_PUBLIC_SECURITY_PARKED.md`](../requirements/recruitment/LIQUIDHR_RECRUITMENT_PUBLIC_SECURITY_PARKED.md).
- GitHub `origin/main` en Vercel Production zijn geverifieerd op release-SHA `446a8f8ecef7b7c06f1c6910a990ecbe3bf84046`. Vercel deployment `dpl_JDCAbJkkTy9YDLWCB1UGLxvc7kKd` staat `READY` via de bestaande Git-integratie, met alias `liquid-hr-hr-suite.vercel.app`. `/login` gaf 200; `/settings/recruitment` bereikte de normale loginbescherming; een onbekende publieke vacancy gaf veilig 404. Runtime error/fatal-logs voor de deployment waren leeg.

## Guided Recruitment — publieke securityconfiguratie geparkeerd 2026-08-13

- Het dossier staat in [`docs/requirements/recruitment/LIQUIDHR_RECRUITMENT_PUBLIC_SECURITY_PARKED.md`](../requirements/recruitment/LIQUIDHR_RECRUITMENT_PUBLIC_SECURITY_PARKED.md) en is bewust bewaard als uitbreidbaar security-werkpunt.
- De publieke Recruitment-submit/upload blijft fail-closed zolang Turnstile, `RECRUITMENT_RATE_LIMIT_PEPPER` en malware-scanconfiguratie ontbreken. Geen bypass, dummy scanner of hardcoded testsecret toevoegen.
- Heropenen bij productievoorbereiding, externe bereikbaarheid, echte kandidaatuploads of een gedeelde public-ingestion security service. Er is in deze parkeeractie geen remote wijziging, deployment of credentialactie uitgevoerd.
## Guided Recruitment - Stap 3 releasegate continuation 2026-08-13

- **Scope:** gecontroleerd in `C:\Users\Edwin\Documents\Apps\LiquidHR\.worktrees\recruitment` op branch `feature/recruitment`. Preflight was clean en HEAD was/blijft `037b669128914b3936fcf17277c70961500a04f5` (`037b669 feat: complete guided recruitment`). Geen reset, merge, push, deployment, version bump of `finish-feature.ps1`.
- **Remote migrations:** Supabase `wnpfloqpjvaacobppbpk` read-only geidentificeerd en lokale/remote historie vergeleken. Individueel toegepast, in volgorde: `20260813142035_guided_recruitment_guided_content`, `20260813142057_guided_recruitment_retention_and_analytics`, `20260813144216_guided_recruitment_retention_anonymize_ambiguity_fix`. Geen Docker, lokale Supabase-stack of `db push`.
- **Remote bewijs:** Recruitment guided-, foundation- en Step-3-releasecontracten zijn transactioneel groen, inclusief cross-tenant/cross-HR-group, reviewer A/B pre-submit-isolatie, submit/correctie-audit, participant/revocation, reopen zonder restore, system-content-immutability, last-stage guard, retention, anonymise/delete, cron, storage cleanup en non-identifiable analytics. Bestaande `TEST-RECRUITMENT-*` fixtures zijn geladen en behouden. Officiele remote DB-types zijn opnieuw gegenereerd en `packages/db/types.ts` is bijgewerkt. Security advisor: 82 meldingen (81 WARN, 1 INFO); Recruitment-matches zijn begrensde, intentionele SECURITY DEFINER-wrappers. Performance advisor: 464 meldingen (456 INFO, 8 WARN); Recruitment-matches zijn alleen unused-index-info. Geen nieuwe actionable Recruitment-bevinding.
- **Browser:** NL desktop en 390x844 zijn authenticated gecontroleerd voor HR Admin Recruitment, reviewer A/B voor en na submit, reviewer B-isolatie, unrelated employee URL, andere HR-groep, revoked oude URL, settings/library/sets/privacy en analytics endpoint. Aanvullend is EN authenticated gecontroleerd voor HR Admin Recruitmentlijst, vacaturedetail, sollicitatiedetail, library, interviewsets, privacy, analytics, reviewer A scorecard en Recruitment op 390x844. Geen PII in analytics, geen horizontale overflow en geen console-errors op de echte geslaagde paginaflows; de directe analytics-JSONpagina gaf alleen de bestaande favicon-404.
- **Publieke boundary:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RECRUITMENT_RATE_LIMIT_PEPPER`, `RECRUITMENT_MALWARE_SCAN_URL` en `RECRUITMENT_MALWARE_SCAN_API_KEY` ontbreken allemaal. Een synthetic public submit/upload bleef fail-closed met `RECRUITMENT_PUBLIC_INPUT_INVALID`; geen happy path is doorgedrukt.
- **Lokale gates:** volledige hr-suite-tests `182 bestanden / 687 tests` groen; assessment-RPC mappingtest `1 bestand / 3 tests` groen; i18n `33` namespaces groen; strict TypeScript GREEN met `NODE_OPTIONS=--max-old-space-size=8192`; Webpack-productiebuild GREEN met `223` gegenereerde pagina's; `git diff --check` groen. De officiële remote types misten de bestaande lokale `company_activities`-compatibiliteitsaanvulling; die niet-Recruitment type-aanvulling is lokaal behouden. Repo-lint en direct Recruitment-lint stoppen voor analyse met de bestaande ESLint 10/`eslint-plugin-react`-fout `contextOrFilename.getFilename is not a function`.
- **Release:** productversie bleef `1.20260812.3`; `app-version.test.ts` is niet rood/groen doorlopen, geen version commit en geen `finish-feature.ps1`. De worktree bevat alleen de releasegatewijzigingen en blijft bewust on-gecommit.
- **Eindstatus:** **IMPLEMENTATION COMPLETE, RELEASE VERIFICATION INCOMPLETE**. Alle lokale en EN-browsergates zijn nu groen; de enige resterende releaseblocker is de ontbrekende verplichte publieke Turnstile/rate-limit/malwarescanconfiguratie, waardoor de volledige publieke sollicitatie + upload happy path nog niet fail-closed én happy-path bewezen kan worden.

## Guided Recruitment — Stap 3 handoff 2026-08-13

- **Branch/worktree:** `feature/recruitment` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.worktrees\recruitment`, HEAD `07c5ca6` vóór deze lokale slice. Alleen deze worktree is gewijzigd; `main` is niet aangepast, er is niet gemerged, gepusht of gedeployed en de productversie bleef `1.20260812.3`.
- **Gebouwd:** Guided content- en setservices, seeded systembibliotheek (25 sollicitatievragen, 84 gespreksvragen, 45 criteria, 35 voorbereidingsitems, 12 sets), HR-groep CRUD/toggles, interview/assessment-RPC-adapters, actor-safe assigned participantprojecties, scorecard met autosave/submit, pipeline/privacy-instellingen, analyticsprojection, HR-delete/retentionkernel, storage cleanup via dagelijkse `/api/cron/recruitment-retention` (`0 3 * * *`), NL/EN UI en synthetische fixture/contracttest.
- **Lokale migrations:** `20260813131401_guided_recruitment_guided_content.sql` en `20260813131411_guided_recruitment_retention_and_analytics.sql`. De criterion-snapshot bevat de characteristic-ID naast de 1–5-anchorinhoud. De officiële `packages/db/types.ts` is nog niet opnieuw gegenereerd omdat de nieuwe migrations niet remote zijn toegepast; de serverservice gebruikt tijdelijk een smalle getypeerde RPC-adapter.
- **Remote:** project `wnpfloqpjvaacobppbpk` is read-only gecontroleerd. De connector wees de remote migratie-write af wegens expliciete projecttoestemming; er is geen workaround of herhaalde write uitgevoerd. De twee Stap 3 migrations, fixture en contracttest staan dus lokaal en zijn **niet remote toegepast**. Post-migration advisors, remote contracttest, remote fixture en remote types zijn daardoor open.
- **Verificatie:** 182 testbestanden/686 tests groen, strict TypeScript groen, `check:i18n` groen (33 gelijke NL/EN-namespaces), `git diff --check` groen en `next build --webpack` groen. Repo-lint blijft geblokkeerd door de bestaande ESLint 10/Next-pluginfout `contextOrFilename.getFilename is not a function` op een ongewijzigde absence-pagina.
- **Browser/security:** authenticated HR-, participant- en 390×844-browserbewijs is niet uitgevoerd; de worktree heeft volgens de Stap 2-handoff geen Supabase runtime/securityconfiguratie. Publieke intake blijft fail-closed zonder Turnstile/malwarescannerconfiguratie. HTTP-bereikbaarheid mag niet als authenticated bewijs worden geteld.
- **Testdata/release:** de nieuwe `recruitment_demo.sql` is niet toegepast; er is geen nieuwe remote testdata aangemaakt. Geen versie-update en geen `finish-feature.ps1` zolang remote, advisors, types, securityconfiguratie en browsermatrix niet groen zijn. Eindstatus: **IMPLEMENTATION COMPLETE — RELEASE GATE BLOCKED**.

## Guided Recruitment — Stap 2 handoff

- **Branch/worktree:** `feature/recruitment` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.worktrees\recruitment`, voortbouwend op foundationcommit `8b4d9f4430e564a787fb1aa66c260747469dff07`. Alleen deze worktree is gewijzigd. Er is niet naar `main` geschreven, niet gemerged, niet gepusht, niet gedeployed en de productversie is niet aangepast.
- **Gebouwd:** HR-vacatureoverzicht, nieuwe/edit/detailpagina's, zes vaste inhoudsblokken, publicatiepanel, telefoon/motivatie/CV-intakeconfiguratie, kandidaat-/sollicitatieoverzicht en -detail, handmatige sollicitatie, pipeline-board, reject/reopen, expliciete bestaande Employee-match bij hire en een beperkte Journey-handoff via de bestaande Step 1-adapter.
- **Publieke route:** veilige open/gesloten vacatureprojectie met JobPosting JSON-LD voor open vacatures, vaste sectieweergave, neutrale privacycopy, honeypot en bevestigings-/security-blocked-states. De POST-route leest de veilige formconfiguratie, valideert REQUIRED-velden server-side, vereist proof en rate limit, scant bestanden vóór persistence en schrijft alleen naar de private quarantinebucket wanneer de scan CLEAN is.
- **Schema/API:** lokale migratie `apps/hr-suite/supabase/migrations/20260813115443_guided_recruitment_core_experience.sql`; remote toegepast als `guided_recruitment_core_experience` op project `wnpfloqpjvaacobppbpk`. De migratie voegt veilige sectietitels en guarded RPC's toe voor vacancy/application/publication/hire en de publieke vacancy-state. `packages/db/types.ts` is opnieuw gegenereerd en gecontroleerd.
- **Remote fixtures:** module `RECRUITMENT` blijft actief in dev/test. Tenant `Planeten` (`07249eb9-545c-883b-b26b-d52f83b4f4a1`) en HR-groep `Planeten Recruitment` (`6ba6f1df-e376-40f2-abff-ffdf000172e1`) bevatten 3 vacatures, 18 secties, 2 publicaties, 4 synthetische kandidaten, 4 sollicitaties en 4 events. De dataset gebruikt `example.invalid`-adressen en bevat geen echte kandidaat-, CV- of scannerdata; de records zijn bedoeld voor handmatige inspectie en mogen blijven staan.
- **Security:** HR-writes blijven server-side én via Step 1-RLS/permissions begrensd. De publieke read is een minimale projection; een gesloten publicatie geeft geen candidate/application-data. Publieke inzending blijft fail-closed zonder `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RECRUITMENT_RATE_LIMIT_PEPPER`, `RECRUITMENT_MALWARE_SCAN_URL` en `RECRUITMENT_MALWARE_SCAN_API_KEY`.
- **Verificatie:** gerichte Recruitment-tests 5 bestanden/10 tests groen; strict TypeScript groen; `check:i18n` groen met 33 gelijke NL/EN-namespaces; `git diff --check` groen; `next build --webpack` groen met 211 pagina's. De normale buildvariant viel alleen om door Next package-resolutie in de worktree. De bestaande lintgate blijft geblokkeerd door `contextOrFilename.getFilename is not a function`. Remote advisors tonen de verwachte SECURITY DEFINER-wrapperwaarschuwingen en geen nieuwe actionable Recruitment-RLS-bevinding.
- **Browserboundary:** met de lokale server op `localhost:3000` bereikte `agent-browser` `/login`, maar Next gaf 500 omdat de worktree geen `NEXT_PUBLIC_SUPABASE_URL` en Supabase publishable key heeft. Er is dus geen authenticated HR- of publieke browserflow bewezen; HTTP-bereikbaarheid of een SQL-state-query vervangt dat bewijs niet.
- **Volgende handoff:** Stap 2 is functioneel lokaal aanwezig maar de volledige gate is niet groen door ontbrekende runtime/securityconfiguratie, lintbaseline en browserbewijs. Stop hier zoals gevraagd; voer geen Stap 3, deployment, push, merge of version bump uit totdat daarvoor expliciet opdracht en configuratie beschikbaar zijn.

## Guided Recruitment — Step 1 handoff

- **Branch/worktree:** `feature/recruitment` in `C:\Users\Edwin\Documents\Apps\LiquidHR\.worktrees\recruitment`. Foundationcommit: `8b4d9f4430e564a787fb1aa66c260747469dff07` (`feat: establish secure recruitment foundation`). De worktree blijft bestaan voor Step 2; er is niet gepusht, gemerged, gedeployed of van versie gewisseld.
- **Remote dev/test:** bevestigd project `wnpfloqpjvaacobppbpk`, naam `LiquidHR`, regio `eu-west-3`, status `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.141`. Voor iedere remote write zijn projectidentiteit, migratiehistorie, lokale/remote status en beide advisors read-only herbevestigd. Live `git ls-remote` bleef lokaal geblokkeerd door ontbrekende Windows Git-credentials; lokale `main`, `last-good` en `origin/main` stonden bij preflight alle op `f51c8220162e6a3f67fecb8a4bce797da92dbead`.
- **Gemaakt en toegepast:** `20260813102722_guided_recruitment_foundation.sql`, `20260813102725_guided_recruitment_security_and_public_intake.sql`, `20260813105706_guided_recruitment_public_intake_ambiguity_fix.sql`, `20260813110008_guided_recruitment_advisor_hardening.sql` en `20260813113105_guided_recruitment_idempotency_replay_fix.sql`. Alle vijf staan op het gekoppelde dev/test-project; er is geen Docker, lokale Supabase-stack of `db push` gebruikt.
- **Datamodel/security:** 22 exposed Recruitment-tabellen zijn tenant- én HR-groepgebonden en hebben 22/22 RLS plus expliciete grants. Er zijn 10 canonieke permissions. Candidate en Application zijn afzonderlijk; genormaliseerde e-mail is alleen een niet-uniek duplicaarsignaal. Alleen `AFGEWEZEN` en `AANGENOMEN` zijn terminaal. De private bucket `recruitment-documents` heeft nul anon/auth objectpolicies; alleen `CLEAN`-documenten kunnen na een geautoriseerde document-ID-claim server-side naar een 60-seconden-URL worden vertaald.
- **RPC-kernels:** versioned/idempotente stage-, terminale en reopen-transitions; historisch exacte replay; onmiddellijke participant-revocation en geen herstel bij reopen; laatste-actieve-faseguard; retentie-instelling met herberekening; minimale concrete participantprojectie; documentclaim zonder storage-key; maximaal-één OPEN public vacancy; proof-gebonden public write zonder table list/read. `anon` heeft nul Recruitment-tabelgrants en geen toegang tot `internal_recruitment`.
- **TypeScript-grenzen:** `RecruitmentActorContext`, `ApplicationState`, `ApplicationProjection`, `ParticipantProjection`, `TerminalTransitionInput`, `HireConversionInput`, `AssessmentRevision`, `PublicVacancyProjection` en `PublicApplicationInput`; centrale repositories/services, stable errors, actorprojectie, fail-closed Turnstile/malwarescan, MIME/magic-byte/sizecontrole, private documentservice, persoonlijke Reminder-deeplink, expliciete Employee-match/hirekeuze met `employee:match`-authorisatie en Journey preview/activate-handoff na Employee-link. Officiële remote types zijn gegenereerd; alleen het bestaande lokale `company_activities`-type is behouden omdat die lokale tabel nog niet in remote dev/test staat.
- **Automatisch bewijs:** gerichte RED is uitgevoerd vóór implementatie. Definitief: 10 testbestanden/45 tests groen, strict TypeScript groen, i18n groen met 33 gelijke NL/EN-namespaces, `git diff --check` groen en `next build --webpack` groen met 209 pagina's. Repo-lint bereikt geen Recruitment-code en blijft geblokkeerd door de bestaande ESLint 10/Next-pluginfout `contextOrFilename.getFilename is not a function`; de ongewijzigde falende opdracht is niet herhaald.
- **Remote actorbewijs:** transactioneel contract groen voor HR met rechten, concrete deelnemer, niet-betrokken medewerker, andere HR-groep en andere tenant; anon read/write-only; reject, hire, exacte idempotente replay, terminale oude directe URL/RPC, reopen zonder rechtenherstel, private documentclaim, fase-minimum en retentieherberekening. Cleanup na `ROLLBACK`: vacatures `0`, tenants `0`, documenten `0`.
- **Advisors:** geen ontbrekende Recruitment-RLS/policy of unindexed-FK-bevinding meer. Security houdt 11 verklaarde waarschuwingen over voor de bewust begrensde en intern autoriserende SECURITY DEFINER-RPC's (2 anon, 9 authenticated); performance houdt 31 `unused_index`-INFO's over voor de zojuist gemaakte lege/nieuwe indexes. Remediatieverwijzing: `https://supabase.com/docs/guides/database/database-linter`.
- **Browserboundary:** module uit gaf ingelogd 404 en geen Recruitmentnavigatie; tijdelijk aan gaf HR Admin de minimale `/recruitment`-shell; Test Manager werd naar `/geen-toegang` geleid; onbekende publieke UUID/slug gaf veilige 404 op desktop en 390×844. De gecontroleerde route-shell/no-access-console had 0 errors/0 warnings; de public-404-console bevatte alleen de verwachte 404-resource en dev-preloadwaarschuwingen. De module is daarna teruggezet naar disabled en de lokale devserver is gestopt.
- **Testdata:** er blijft geen `TEST-RECRUITMENT-*` securityfixture of visuele Recruitmentdata achter. Bestaande Journey/Talent-fixtures zijn niet gewijzigd. De tijdelijke module-activatie is teruggedraaid.
- **BLOCKED / NO-GO Step 2:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RECRUITMENT_MALWARE_SCAN_URL` en `RECRUITMENT_MALWARE_SCAN_API_KEY` zijn niet geconfigureerd. De uploadboundary faalt aantoonbaar gesloten, maar echte botchallenge en remote malwarescan zijn niet live bewezen. Samen met de bestaande linttoolingblokkade is de volledige Step-1-gate niet GREEN. Step 2 mag publieke upload niet als bewezen beschouwen en is **BLOCKED** tot goedgekeurde dev/testconfiguratie én een groene lintgate beschikbaar zijn.
- **Step 2 moet hergebruiken:** ownership, Candidate/Application-identiteit, permissions, RLS/grants, lifecycle/outcomes, version/idempotency, participantprojectie/revocation, public wrappers, private documentquarantaine, custom-fieldsnapshot, Reminder-, Employee- en Journey-adapters, retentiemodel, repositories/services en stable errors. **DO NOT recreate Step 1 architecture.**

## Journeys bouwstap 3 — volledig afgerond

- De globale `DIRECT_MANAGER`-grant is niet toegevoegd. De oorzaak van de blocker was dat Journey-shelltoegang ten onrechte aan een zichtbare topicassignment was gekoppeld. De minimale oplossing gebruikt de bestaande `journey-participation:read`-route plus concrete `journey_participants` met status `ASSIGNED` of `ACTIVE`; dit verleent geen algemene `employee:read` en geen brede Journey-scope.
- Topicprojecties en outcomes blijven afzonderlijk begrensd door zichtbare topicassignments, participantstatus en bestaande actor-veilige projectionservices. De next-action RPC-contractfix voegt alleen de al vereiste topicvelden toe (`key` en `ownerRoleKey`); er is geen nieuwe functionele flow toegevoegd.
- Remote Supabase-migraties omvatten de shellscopefix en next-action-contractfix; RLS, wrapper-execute, remote types en advisors zijn opnieuw gecontroleerd. Managerparticipant Yara en buddy/participant Noah zijn via de bestaande testflow geverifieerd; testdata is disposable en geen productiedependency.
- Authenticated browserbewijs: employee-preboarding startpagina/widget en detail, managerparticipant-dashboard en buddy/participant-dashboard op desktop en 390x844. De Journey-only startpagina toont alleen veilige Journey-context; de detailprojectie toont welkomstmoment, topicstatus, volgende actie en Journey Team, zonder salaris, BSN, contractinhoud, verzuim of HR-dossierdata. Geslaagde routes hebben 0 console-errors en uitsluitend succesvolle appresponses; de responsive flow heeft geen horizontale overflow.
- De dashboardfix hergebruikt `get_employee_journey_projection`: target óf concrete participant met status `ASSIGNED`/`ACTIVE`, plus bestaande tenant/HR-groep- en actorchecks. Er is geen parallelle Journey-query of bredere employee-readpermission toegevoegd. `DIRECT_MANAGER` heeft geen Journey-permissions.
- Remote controle: 16 Journey-tabellen uit stap 1–3 hebben RLS; pgTAP stap 1 is 18/18 en stap 2 is 12/12; officiële types zijn opnieuw gegenereerd. Security-advisor: 47 bestaande projectbrede meldingen, 0 Journey-matches. Performance-advisor: bestaande/verse Journey-indexmeldingen en de bekende dubbele SELECT-policies; geen nieuwe actionable securitybevinding.
- Development/testdata: disposable PREBOARDING-template `stap3-preboarding-disposable` en Journey `041c69df-daab-4e2e-a9db-3dc28f532a0f` voor bestaande Employee Noah Hendriks, anchor `2026-09-01`, status `PLANNED`; data mag blijven voor handmatige inspectie en is geen functionele dependency.
- Release afgerond: versie `1.20260812.3` staat op `main` en GitHub `origin/main` op commit `2a9b58e52ca81e6ecd66ec2b85c95d6bcb6a4925`. Vercel Production `dpl_BVf4pDiu8kbEWhot2QZS633L9PeE` is `READY` op exact deze SHA. De deployed routechecks bereikten de Vercel-beschermingslaag met `302`; inhoudelijke authenticated production-UI blijft door Vercel SSO niet bewezen. Runtime-errors en deployment errorlogs zijn schoon.

## LiquidHR Journeys — bouwstap 3 uitgevoerd 2026-08-12

- De leidende modulevoorbereiding staat in `docs/requirements/journeys/JOURNEYS.md`. Journeys is HR-groep-owned, gebruikt dezelfde blijvende Employee-identiteit en optioneel één expliciet Employment als context, pint een immutable templateversie en materialiseert concrete deelnemers en datums bij activatie.
- De eerdere feature-worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\journeys-step-1` en branch `feature/journeys` zijn na succesvolle integratie, GitHub-push en Vercel-verificatie verwijderd. De resterende historische worktrees en het niet-geregistreerde `liquid-flow-appwide`-bronrepo zijn bewust behouden.
- Stap 1 bevat HR-configuratie; stap 2 bevat de gepinde runtime, preview/activatie, concrete participants, HR Live-lijst/detail, lifecycle, replacementhistorie en bestaande reminderadapter. Stap 3 bevat lokaal de actor-filtered projection/outcome-contracten, participant/self-detail, startpagina- en medewerkerdashboardwidgets en reminderdeep-link. Stitch is richtinggevend; bestaande LiquidHR-shell, componenten, tokens, security, data, responsive gedrag en i18n blijven leidend.
- De afzonderlijke Stitch `screen.png`/`code.html`-assets zijn niet aangetroffen in de actuele repository- of attachmentmount; de lokale UI-review gebruikt `docs/requirements/journeys/references/STITCH_REVIEW_2026-08-12.md`. Exacte asset-hercontrole blijft open bij beschikbaarheid van de bronbestanden.
- Gekoppelde Supabase-testomgeving: `wnpfloqpjvaacobppbpk`. Stap 3 is remote toegepast via de projection/outcome-, FK-, shellscope-, next-action- en employeeprojectionmigraties tot `20260812153435`. Alle 16 Journey-tabellen uit stap 1–3 hebben RLS; de publieke wrappers zijn invokerfuncties met alleen `authenticated` execute en de interne kernels zijn voor `anon` afgesloten. Officiële types zijn opnieuw gegenereerd. De security-advisor heeft 0 Journey-matches; de bekende performance-indexmeldingen en dubbele SELECT-policies zijn niet nieuw en niet security-actionable.
- Lokale verificatie: gerichte en volledige hr-suite-tests, strict TypeScript, volledige ESLint, i18n/diff-check en Webpack-productiebuild zijn groen. Geauthenticeerde employee-preboarding, managerparticipant en buddy/participant zijn via de bestaande Journey-route gecontroleerd op desktop en 390x844 met 0 console-errors en zonder horizontale overflow. De globale `DIRECT_MANAGER`-grant voor `journey-participation:*` is niet toegepast.
- Verwijderbare development/test dataset in testtenant `LiquidHR Test Tenant`: `JY-S1 01 Concepttemplate` (`jy-s1-concept`), `JY-S1 02 Gepubliceerde template` (`jy-s1-published`), `JY-S1 03 Gepubliceerd + draft r2` (`jy-s1-published-draft-r2`) en `JY-S1 04 Uitgefaseerde template` (`jy-s1-retired`). Bestaande medewerkers Noah Hendriks en Yara Meijer dienen als resolverkeuzes; hun gegevens zijn niet gewijzigd. Productcode en tests zijn niet afhankelijk van deze records en alle `jy-s1-%`-records kunnen later worden vervangen of verwijderd.
- Aanvullende verwijderbare `JY-S2` development/test dataset: `jy-s2-01-planned-v1` gepland (Sophie), `jy-s2-02-new-active-v1` nieuw actief + handmatige buddy (Daan), `jy-s2-03-underway-v1` onderweg (Nora), `jy-s2-04-upcoming-v1` aankomend (Bram), `jy-s2-05-overdue-v1` overdue (Milan), `jy-s2-06-paused-v1` gepauzeerd (Yara), `jy-s2-07-completed-v1` afgerond (Lucas), `jy-s2-08-cancelled-v1` geannuleerd (Sara), `jy-s2-09-replacement-v1` buddyvervanging met historie (Finn), template `jy-s2-unresolved-validation` / `JY-S2 10 Validatie — verplichte coach ontbreekt`, en `jy-s2-11-manager-resolution-v1` met echte directe-managerresolutie + gepubliceerde reminder (Sophie/Edwin). Productcode/tests zijn niet afhankelijk van deze records; alle `jy-s2-%`-data kan later worden verwijderd of vervangen.
- Zichtbare appversie blijft `1.20260812.3`; de remote rolegrant voor directe managers is bewust niet toegepast. Remote migrationnamen/timestamps wijken historisch af van enkele lokale bronbestanden; er zijn tijdens consolidatie geen migrations opnieuw uitgevoerd.

## Looncontract aanpassen: vier gedeelde flows 2026-08-12

- Op de dienstverbanddetails gebruiken `hoursSchedule`, `hoursScheduleSalary`, `functionDepartmentCostCenter` en `salary` een gedeelde contractwijzigingswizard. Eerst wordt het contract gekozen (één contract wordt automatisch geselecteerd), daarna worden contractgegevens en de bestaande tijdlijn getoond. De gebruiker kiest een ingangsdatum via contractstart, begin huidige maand, begin volgende maand of een aangepaste datum.
- De detailstap ondersteunt het medewerkerwizard-principe: afleiding voltijd/deeltijd, uren, deeltijdfactor, één- of tweeweekse roosters met daguren en tijd-voor-tijd; daarnaast salarisvelden, organisatiekeuzes en 100%-kostenverdeling. De review bevat `Dat contract gaan we aanpassen.` en een verplichte reden.
- De bestaande API's blijven de schrijfgrens. `contractId` wordt server-side gecontroleerd op medewerker en contractperiode voordat schedule-, salary-, combined- of organization-wijzigingen worden toegepast. Een roosterwijziging publiceert aansluitend via de bestaande work-pattern-API de één- of tweeweekse cyclus; organisatie/kostenplaats doet eveneens twee bestaande writes, omdat er geen gecombineerde endpoints bestaan.
- Verificatie: hr-suite 156 testbestanden/606 tests, strict TypeScript, volledige ESLint, 31 gelijke NL/EN-namespaces, Webpack-build met 200 pagina's en `git diff --check` groen. De lokale browsercontrole bereikte `/login` met HTTP 200; authenticated detail-/saveflow en remote/deploymentbewijs zijn nog open. Er is geen migratie aangemaakt of remote wijziging uitgevoerd.

## Nieuwe medewerker- en dienstverbandwizard 2026-08-12

- De nieuwe medewerkerwizard heeft op `Extra gegevens` een accordion voor profielfoto-upload met lokale preview, type-/5 MB-validatie en opslag via de bestaande avatarroute bij het aanmaken of tussentijds opslaan.
- De snelkeuzes voor contract- en proeftijd-einddatums gebruiken nu de laatste dag van de gekozen periode: 1 september plus 1/3/6/12 maanden eindigt op respectievelijk 30 september, 30 november, 28 februari en 31 augustus. De wettelijke proeftijdregels worden als waarschuwingen getoond; alleen ontbrekende of chronologisch ongeldige datums blokkeren.
- Op `Rooster en uren` wordt deeltijd/voltijd afgeleid uit weekuren versus de fulltime-referentie; handmatig kiezen is verwijderd. De laatste `Controleren`-tab toont naam, geboortedatum en geslacht over de volledige breedte. De overgang naar die tab doet geen POST; alleen `Dienstverband aanmaken` bewaart, met een in-flight guard tegen dubbele submits.
- Verificatie: volledige hr-suite 156 testbestanden/605 tests, strict TypeScript, volledige ESLint en NL/EN-i18n-pariteit met 31 namespaces zijn groen. De proeftijdconstraint-migratie `20260812110000_probation_rule_warnings.sql` is lokaal aanwezig en niet remote toegepast of gedeployed. Authenticated browserbewijs is niet uitgevoerd omdat een blijvende poort-3000-server in de beheerde omgeving niet beschikbaar bleef.

## Navigatie en module-instellingen 2026-08-12

- Teamkompas staat niet meer als zelfstandig sidebar-item of menuvolgorde-item. Rollen met een actieve `TEAM_COMPASS`-module en een bestaande Teamkompas-permission krijgen het als venster op `/workforce` (Ontwikkeling); de route, serviceautorisatie en instellingenbeheer blijven ongewijzigd.
- De actieve-modulencatalogus bevat nu uitsluitend werkelijk schakelbare uitbreidingen: HeRa, Reminders, Talent, Surveys, eNPS en Teamkompas. Documentdossiers zijn uit UI, schema-validatie en save-payload verwijderd; de lokale migratie `20260812054853_documents_always_on.sql` zet bestaande/nieuwe tenantregels aan, legt `DOCUMENTS` altijd actief vast en laat de centrale database-modulefunctie deze code niet meer blokkeren.
- Verificatie in deze beurt: gerichte modulecatalogus-/schemasuite 2 bestanden/3 tests groen, strict TypeScript, volledige ESLint, i18n-pariteit (31 NL/EN-namespaces) en `git diff --check` groen. Poort 3000 had geen listener, dus er is geen nieuwe authenticated browsercontrole uitgevoerd. De migratie is lokaal aangemaakt maar niet remote toegepast; read-only advisors en typegeneratie zijn wel tegen de bestaande remote toestand uitgevoerd, waardoor post-migratie advisors/typevalidatie nog bij een geautoriseerde schema-/releasebeurt horen.

## Release 2026-08-11 — productie geverifieerd

- `main` bevat alle actuele lokale featurecommits voor Process Automation-redesign, Surveys/eNPS, research-draftflows en Teamkompas. Alle featurebranches zijn voorouders van `main`; er ontbreken geen featurecommits.
- De zichtbare appversie en unit-test staan op `1.20260811.1`. De lokale releasegate is groen: 156 testbestanden/601 tests, strict TypeScript, 31 gelijke NL/EN-namespaces, volledige ESLint, `git diff --check` en `next build --webpack` met 200 pagina's.
- Remote is `research_wrapper_execution_grants` toegepast. De vier publieke researchwrappers zijn afgeschermde `SECURITY DEFINER`-functies met lege `search_path`, alleen `authenticated` execute en bestaande kernelguards. De vier interne kernels blijven voor `authenticated` en `anon` afgesloten. Een transactionele dummy-aanroep bereikt de inhoudelijke validator en het volledige research-SQL-contract is groen.
- Officiële remote typegeneratie is opnieuw uitgevoerd; de privilegewijziging verandert geen TypeScript-contract. Advisors: security 47 totaal (1 INFO/46 WARN), inclusief vier bewuste research-wrappermeldingen en vijf bestaande Teamkompas-RPC-meldingen; performance 405 INFO. De relevante remediatiepagina is <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable>.
- De build heeft `apps/hr-suite/next-env.d.ts` niet inhoudelijk gewijzigd. De oude OAuth-worktree had alleen verouderde Git-indexmetadata voor hetzelfde bestand; die metadata is ververst en de worktree is schoon.
- Releasecommit `0598548a218433d1b2ed42db5a317b40f9347d00` staat op GitHub `main`. Vercel Production `dpl_7W8AKP7nAASxrfaiQz4SjbLUQj3F` is `READY` op exact deze SHA; alias `/login` geeft HTTP 200, de research-API-route is bereikbaar en de runtime-error-/error-fatal-scan over het controlevelster is schoon. `.codex-worktrees/` blijft een lokale, niet te publiceren worktreecontainer.

## Surveys en eNPS — follow-up 2026-08-11

De draft-edit slice is lokaal samengevoegd in `main` en de RPC-migraties plus wrapper-hardening en de aanvullende execution-correctie zijn remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De lokale `main`-versie draait op poort 3000; er is niets gepusht of gedeployed.

### Afgerond

- Conceptcampagnes zijn wijzigbaar zolang hun status `DRAFT` is. De transactionele interne RPC's behouden tenant-, HR-groep-, permission- en statusguards; de publieke wrappers zijn afgeschermde `SECURITY DEFINER`-functies met alleen `authenticated` execute en de interne kernels zijn niet rechtstreeks uitvoerbaar. De PUT-routes, edit-links en survey/eNPS-builders laden en bewaren bestaande concepten.
- De geautoriseerde E2E-proef gebruikte synthetische survey- en eNPS-campagnes met drie uitnodigingen per campagne. Beide campagnes zijn geactiveerd, via `employee.fixture@liquidhr.test` één keer beantwoord en in de HR-monitor gecontroleerd op `1 van 3` (33%). De surveyrespons verscheen in de resultaten; de eNPS-inhoud bleef verborgen onder de privacydrempel van vijf.
- Cleanup is transactioneel uitgevoerd door beide campagnehoofdrijen te verwijderen. Nacontrole gaf `0` resterende rijen in surveys, survey_questions, survey_question_options, survey_matrix_rows, survey_invitations, survey_responses, survey_answers, enps_campaigns, enps_questions, enps_invitations, enps_responses en enps_answers. De bestaande audittrail is append-only en is niet verwijderd.
- Na de execution-correctie geeft de security-advisor vier bewuste research-wrapper-WARNs voor de gecontroleerde publieke `SECURITY DEFINER`-grens. Typegeneratie is opnieuw uitgevoerd; performance geeft alleen de verwachte INFO-meldingen voor indexen op kleine/nieuwe tabellen.

### Open / bewust uitgesteld

- Automatische e-mailherinneringen en de scheduler zijn op verzoek uitgesteld. De bestaande handmatige HR-herinnering en het in-app signaal blijven beschikbaar; er is geen externe e-mailbezorging geclaimd.
- Segmentatie van resultaten op kleine groepen blijft afhankelijk van een afzonderlijk privacybesluit.

## Surveys en eNPS 2026-08-10 — samengevoegd en browsergeverifieerd

De nieuwe modules zijn vanuit branch `codex/survey-enps-modules` lokaal met `main` samengevoegd. De twee migraties zijn remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De lokale `main`-versie draait voor handmatige controle op poort 3000; er is niets gepusht of gedeployed.

### Gedaan

- Schema -> API -> UI is aangehouden. De additive migratie voegt twee modulecodes, veertien RLS-tabellen, vier canonieke permissions, respondent-RPC's, de volledige systeemvragenbank van 150 vragen in 15 categorieën en de twee dashboardwidgets toe.
- HR Admin heeft `/settings/research`, survey- en eNPS-builders, beheer van eigen vragen/categorieën en `/research/monitor`. Medewerkers hebben `/research`, eigen uitnodigingen en de open-onderzoekenwidget. Leidinggevenden krijgen geen beheer, resultaten of monitorwidget; zij kunnen alleen als geselecteerde medewerker zelf reageren.
- Survey ondersteunt tekst, keuzes, getal, datum/tijd en matrix, anonimiteit, afdelingen/locaties/entiteiten/medewerkers als doelgroep, toegankelijke volgorde, statusmonitor, individuele en bulkherinnering, taart-/staaf-/gestapelde grafieken, numerieke aggregaties en CSV met identiteiten uitsluitend bij niet-anonieme campagnes.
- eNPS ondersteunt de onverplaatsbare 0-10-hoofdvraag, campagnebrede driverschaal, eigen vragen, aan/uitzetten, volgorde, benchmark, promoter/passive/detractor-aantallen, drivers, uitklapbare verdelingen en open reacties. Onder vijf responses blokkeert zowel UI als RLS alle inhoudelijke resultaten. Responses bevatten geen medewerker-, gebruiker-, e-mail-, IP- of apparaatkoppeling; uitnodigingen bevatten geen respons-ID of indientijdstip.

### Geverifieerd

- De volledige hr-suite is groen met 154 testbestanden/590 tests; na de browserfixes telt de gerichte research/module/widget-suite 10 bestanden/31 tests. Strict TypeScript, 30 gelijke NL/EN-namespaces, de Webpack-productiebuild met 197 routes en `git diff --check` zijn eveneens groen.
- De seed is statisch gecontroleerd op 150 unieke nummers van 1 t/m 150. Het remote SQL-contract is groen voor RLS op alle veertien tabellen, rollen, functiegrants, zero-traceability, de database-privacydrempel en vragenbanktoegang.
- Supabase-migraties `add_survey_and_enps_modules` en `optimize_research_rls_and_indexes` zijn transactioneel toegepast. De advisors melden geen research-specifieke securitybevinding en geen performance-WARN; verse indexen geven uitsluitend verwachte INFO-meldingen voor nog ongebruikt. De officiële remote types zijn gegenereerd; de lokaal al aanwezige maar remote nog ontbrekende `company_activities`-typedefinitie is behouden.
- Authenticated browserbewijs op de samengevoegde `main`-versie is groen. HR Admin opent instellingen, monitor, vragenbank, surveybuilder en eNPS-builder; de vragenbank toont 15 categorieën en de builder zoekt in 150 vragen. Manager en medewerker bereiken hun persoonlijke onderzoekshub maar worden voor instellingen en monitor naar `/geen-toegang` gestuurd. De instellingenpagina is ook op 390x844 visueel gecontroleerd. De verse browserconsole heeft nul errors en de verse Next-errorlog is leeg.
- De browserproef vond en herstelde twee niet-serialiseerbare labelprops tussen Server en Client Components. Alle dynamische researchlabels worden nu als stringtemplate doorgegeven; de widgettest bewijst aanvullend dat alleen HR met `research:read` de monitorwidget krijgt, terwijl een manager zonder onderzoeksrecht die niet krijgt.
- Repo-lint blijft vóór bestandsanalyse geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit (`contextOrFilename.getFilename is not a function`). De lokale SQL-test kon niet draaien omdat Docker niet actief is, maar hetzelfde contract is succesvol op het gekoppelde remote project uitgevoerd.

### Open / geblokkeerd

- De beschreven automatische eNPS-herinneringsmail vereist nog een gekozen mailprovider en geplande worker/cron. De huidige werkende herinnering is een HR-actie die het signaal in de medewerkerhub toont; er is geen externe e-mailbezorging geclaimd.
- Dit historische open-punt is opgevolgd in de follow-up van 2026-08-11: DRAFT-campagnes zijn wijzigbaar en de geautoriseerde campagne-/responseproef plus cleanup is afgerond.
## Teamkompas 2026-08-11 — feature-worktree, remote schema toegepast

### Gedaan

- Werk uitsluitend verder in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\teamkompas-module` op branch `codex/teamkompas-module`; de bestaande Survey/eNPS-werkboom en dirty hoofdworkspace zijn niet gewijzigd.
- De slice volgt `schema -> API -> UI`: zeven Teamkompas-tabellen, RLS, expliciete grants/revokes, vier permissions, module-toggle, atomaire campagne-/lifecycle-/antwoord-RPC's en een veilige teamprojectie. De productvragenlijst bevat veertig NL/EN-stellingen en is immutable.
- HR Admin heeft lijst-eerst campagnebeheer met zoeken, statusfilter, klikrij en dialoog; manager en HR zien uitsluitend scopegebonden aggregaten boven de anonimiteitsdrempel; medewerker heeft een mobiele dual-ratingflow, volledig eigen resultaat en afzonderlijke toestemming voor buitenrol/binnenstijl.
- Teamkompas is nadrukkelijk een samenwerkingstool en geen klinische of gevalideerde Jung/DISC/MBTI-diagnose. Ruwe antwoorden en volledige profielen blijven self-only.
- De API-schema's gebruiken PostgreSQL-GUID-vormvalidatie zodat bestaande deterministische testrecords zonder RFC-versie/variantbits niet ten onrechte worden geweigerd; hiervoor is een regressietest toegevoegd.

### Geverifieerd

- Volledige hr-suite: 153 testbestanden/584 tests groen; de Teamkompas-/modulecatalogusselectie is daarin 10/10 gericht groen.
- Strict TypeScript, i18n-pariteit (30 namespaces), volledige ESLint 9.39.5, `git diff --check` en `next build --webpack` met 190 pagina's groen.
- De nieuwe routes staan in het buildmanifest: `/team-compass`, assessment/resultaat, `/settings/team-compass` en drie Teamkompas-API-routes.
- Remote zijn `add_team_compass_module`, `optimize_team_compass_foreign_keys` en `align_team_compass_campaign_rpc` op Supabase-project `wnpfloqpjvaacobppbpk` toegepast. De SQL-contracttest slaagt, alle zeven tabellen hebben RLS, de veertig vragen zijn 10/10/10/10 verdeeld, vier permissions en vijf publieke RPC's bestaan, anon is geweigerd en de gevoelige directe writes zijn niet verleend.
- Officiële remote typegeneratie is uitgevoerd. Vanwege al aanwezige, nog niet in deze branch samengevoegde Survey/eNPS- en andere remotewijzigingen zijn alleen de exact gegenereerde zeven Teamkompas-tabellen en vijf RPC-contracten scopebewust in `packages/db/types.ts` opgenomen. De volledige remote typefile liet `tsc` boven 2 GB vastlopen; met de scopezuivere contracten eindigt strict TypeScript weer groen in circa 32 seconden.
- De herhaalde advisors tonen geen ontbrekende Teamkompas-RLS en geen ontbrekende foreign-key-index. De vijf security-WARNs zijn de bewust aan `authenticated` verleende SECURITY DEFINER-RPC-grenzen, die intern tenant-/HR-groep-/permissionchecks afdwingen. De twaalf performance-INFO's zijn pas aangelegde en daarom nog ongebruikte Teamkompas-indexen.
- Na de remote aansluiting zijn 12/12 gerichte tests, strict TypeScript, 30 NL/EN-namespaces, gerichte ESLint en `git diff --check` opnieuw groen.
- Geauthentiseerde browsermatrix op `localhost:3100`: HR Admin ziet `/team-compass` en `/settings/team-compass`, lijst-eerst beheer en de nieuwe-campagnedialoog; manager ziet uitsluitend het scopegebonden campagneoverzicht; medewerker ziet `Mijn kompas` en de lege uitnodigingstoestand. Manager en medewerker landen bij directe beheerroute op `/geen-toegang`.
- De volledige niet-lege proef is op 2026-08-11 in de testomgeving uitgevoerd met één tijdelijke campagne, veertien vaste deelnames en vijf inzendingen. De medewerkerflow vulde 40 dual-ratings in, toonde het eigen resultaat en sloeg `outer=true`/`inner=false` op. Vier extra bestaande testmedewerkers kregen gecontroleerde synthetische antwoorden/profielen met de varianten anonimiteit, outer-only en outer+inner; HR en manager zagen een beschikbare projectie vanaf drempel vijf met drie named outer-profielen.
- De manager kon het persoonlijke resultaat van een andere medewerker niet openen en werd naar `/geen-toegang` gestuurd. Na de browserproef zijn campagne, targets, deelnames, 200 antwoorden en vijf profielen verwijderd; de cleanup-assertie en losse naverificatie geven voor het tijdelijke ID overal nul inhoudelijke Teamkompas-rijen.
- De HR Admin-dialoog is op 390x844 visueel gecontroleerd. Escape sluit, de focus blijft binnen de dialoog en keert terug naar `Nieuwe campagne`; de horizontale campagneregio is toetsenbordfocusbaar. Een gerichte axe-scan van HR Admin, mobiele dialoog, manager en medewerker geeft 0 violations; per weergave bleven 1–2 `incomplete` controles voor handmatige beoordeling over.

### Resultaat van de niet-lege gate

- De niet-lege Teamkompas-campagnegate is gesloten: uitnodigingen, invullen, indienen, eigen resultaat, consentvarianten, HR-projectie, manager-projectie en deny van een cross-user resultaat zijn live bewezen. De tijdelijke inhoud is opgeruimd; append-only auditmetadata blijft volgens het auditcontract behouden.
- Er is niet gecommit, gepusht, samengevoegd, gedeployed of productieconfiguratie gewijzigd. De feature-worktree blijft dirty met de volledige Teamkompas-slice en de GUID-validatorfix.

### Open / geblokkeerd — historische uitgangssituatie

- Er is geen synthetische campagne/deelnemer/antwoordfixture toegestaan of aangemaakt; een volledige niet-lege campagnecyclus met uitnodiging, submit, eigen resultaat, toestemmingsvarianten en teamprojectie blijft daarom open totdat Edwin expliciet testdata goedkeurt of geschikte bestaande data beschikbaar is.
- Geen synthetische deelnemers of antwoorden aangemaakt; geen commit, push, merge, deployment of productieconfiguratie gewijzigd.

## Release 2026-08-10: productversie 1.20260810.3 — lokale samenvoeging

- `main` bevat de lokale commits `f907eb8` (bedrijfsactiviteiten, feestdagen en employment-overzicht) en `5077aa0` (Liquid Flow applicatiebrede UX). De bronwerkmap `codex/liquid-flow-appwide` is gecontroleerd vastgelegd als `4d2e262`; gegenereerde `next-env.d.ts`-wijzigingen zijn bewust niet meegenomen.
- De zichtbare appversie is verhoogd van `1.20260810.2` naar `1.20260810.3` in `apps/hr-suite/lib/app-version.ts`; de unit-test verwacht dezelfde waarde. De packageversie blijft technische metadata.
- De lokale releasegate is groen: 151 testbestanden/575 tests, strict TypeScript, 29 NL/EN-namespaces, volledige ESLint, diff-check en Webpack-productiebuild met 187 pagina's. De releasecode staat op `edf8de9`; `main` bevat daarna docs-only verificatiecommit `f185a58`. Vercel Production `dpl_FtSAqLQqavF5JBg4ax1E6vWVJFme` en de daaropvolgende docs-only deployment zijn `READY`, alias `liquid-hr-hr-suite.vercel.app` geeft `/login` HTTP 200 en de runtime-scan over het laatste uur meldt geen fouten.

## Feestdagen en bedrijfsactiviteiten 2026-08-10 — lokaal bijgewerkt

- `/settings/holidays` toont lokale feestdagen en bedrijfsactiviteiten nu als volle, onder elkaar gestapelde instellingenvensters. Beide typen staan samen in één datumlijst; bedrijfsactiviteiten hebben een afwijkende primaire kleurset en een wijzigingsmodal met naam, datum en actieve status.
- Activeren/deactiveren van feestdagen geeft een toast. Een dubbele bedrijfsactiviteit geeft voortaan een specifieke conflictmelding; de nieuwe PATCH-route ondersteunt gecontroleerd wijzigen en behoudt de bestaande tenant-/HR-groepautorisatie.
- De instellingen- en schermtitels zijn in NL/EN hernoemd naar Feestdagen en Bedrijfsactiviteiten / Holidays and Company Activities. De modal is hydration-safe gemaakt met een stabiele server/client-mountgrens.
- Lokaal bewijs: volledige hr-suite 151 testbestanden en 575 tests groen; strict TypeScript, i18n-pariteit, volledige ESLint en `git diff --check` groen. De browsercontrole bereikte zonder sessie alleen `/login`; daar was geen error-overlay zichtbaar. Geen remote wijziging, commit, push of deployment uitgevoerd.

## Dienstverbandoverzicht en contractweergave 2026-08-10

- Op `/employees/[employeeId]?tab=employments` toont een dienstverbandkaart geen contractvorm meer. De kaart toont nummer, periode/status, anciënniteitsdatum met duur eronder en administratie; actuele contractgegevens staan onder een dunne scheidingslijn.
- Contractgegevens tonen alleen wanneer er een vandaag geldig contract is. Zonder geldig contract verschijnt `Geen actief contract bij dit dienstverband`; toekomstige contracten worden niet als actueel gekozen.
- Op het dienstverbanddetail staan contractvorm, CAO, uren, afdeling, functie en medewerkertype in het contractblok. De losse wijzigingsacties verschijnen alleen bij een geldig contract. De AI-samenvatting-placeholder is verwijderd.
- Verificatie: employment-card-state/seniority 6/6 tests groen, strict TypeScript, volledige ESLint, `git diff --check`, browsercontrole op poort 3000 voor overzicht en detail groen; NL/EN `employment.json` 391/391 sleutels gelijk en de volledige i18n-check meldt 29 namespaces met gelijke sleutels. Geen schema-, API-, remote-, commit-, push- of deploymentwijziging.

## Release 2026-08-10: productversie 1.20260810.2

- De zichtbare productversie is verhoogd naar `1.20260810.2` volgens de centrale `X.datum.volgnummer`-conventie.
- `main` bevat de lokale consolidatie en employment-merge. Releasecommit `cce23987603bf25d2778672ce5a17a543e1f717a` staat op GitHub `main`; Vercel Production `dpl_A7nVUHc5JhCcAuQy2hiaNkRYno3L` is `READY` op exact deze commit met alias `liquid-hr-hr-suite.vercel.app`.
- De drie employment-migraties zijn remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`: `add_temporary_no_end_contract_type`, `employment_number_ikv_and_probation_rules` en `add_cao_probation_override`.
- De bestaande actieve dubbele IKV is binnen de migratie gerepareerd zonder verwijdering: gesloten historische IKV 9 bleef 9; de latere open conceptrelatie kreeg IKV 10. De remote controle geeft nul actieve dubbele IKV-groepen. Advisors en officiële typegeneratie zijn uitgevoerd.

## Feestdagen en bedrijfsactiviteiten 2026-08-10

- `/settings/holidays` heeft naast lokale feestdagen een HR-groepbrede invoer voor bedrijfsactiviteiten met naam en datum. De bestaande landelijke feestdagen kunnen per record expliciet worden geactiveerd of gedeactiveerd; gedeactiveerde dagen blijven buiten de kalender- en verlofselecties.
- Het land voor de feestdagenimport wordt nu gekozen via een zoekbare dropdown. De opties worden via `/api/settings/holidays/countries` uit de Nager.Date-feestdagenprovider opgehaald; bij tijdelijke provideruitval blijft de bestaande ISO-landfallback beschikbaar.
- De nieuwe `company_activities`-tabel heeft RLS, audit, een HR-adminschrijfpad en een leespad voor gekoppelde medewerkers van dezelfde HR-groep. Startpagina en medewerkerheader tonen de eerstvolgende actieve feestdag en bedrijfsactiviteit wanneer die bestaat.
- De HR-kalender laadt actieve bedrijfsactiviteiten binnen de maand en toont per dag een subtiel kalendericoon; de dagdetailweergave toont de activiteit(en) naast een eventuele feestdag.
- Lokaal gecontroleerd met strict TypeScript, i18n-pariteit en `git diff --check`. De migratie is nog niet remote toegepast; browsercontrole, Supabase-advisors, commit, push en deployment blijven open.

## Weerbericht verhuisd naar medewerkerheader 2026-08-10

- De startpagina toont geen bedrijfslogo meer in de startpagina-header en bevat daar geen weerinstrument of Compact-schakelaar meer. De volledige startpagina en de ordening van de vensters blijven behouden.
- De medewerkerheader toont voor iedere geautoriseerde kijker een klein weericoon. De server bepaalt het werkweer uit de actieve werkcontext met Eindhoven als fallback; de drawer toont temperatuur, maximum, luchtvochtigheid, wind en luchtdruk.
- De drawer sluit via het kruisje, Escape of een klik buiten het venster. Lokaal gecontroleerd op desktop en 390x844; geen schema-, API-, remote-, commit-, push- of deploymentwijziging.

## Medewerkerdashboard profielheader 2026-08-10

- De uitgebreide profielheader op `/employees/[employeeId]` volgt de nieuwe visuele opzet: compacte ronde avatar, duidelijke naam/status-hiërarchie, foto-acties in dezelfde naamkleur, weer- en compact/uitgebreid-iconen van 40x40 naast elkaar en de archiveeractie onderaan boven de contactstreep. De bestaande velden, autorisatie en compact/uitgebreid-URL-state zijn behouden.
- De header stapelt op 390 px zonder horizontale overflow. Gerichte ESLint, strict TypeScript, `git diff --check`, desktop-/390px-browsercontrole, compact/uitgebreid-navigatie en browserconsole zijn groen.
- Geen schema-, API- of remote-wijziging buiten de nieuwe lokale migraties uitgevoerd. De wijzigingen zijn nu lokaal opgenomen in `main`; push en deployment blijven apart open.
## Dienstverbandwizard: nummering, contractregels en aanmaakflow 2026-08-10

Deze verticale slice is lokaal samengevoegd in `main` vanuit worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\employment-wizard-fixes`. De drie remote migraties zijn toegepast en de release staat op GitHub/Vercel; de gebruiker voert nu de functionele test uit.

### Gedaan

- Schema/API/UI volgen `schema -> API -> UI`: dienstverbandnummers zijn niet-negatieve numerieke volgnummers per medewerker; het IKV-nummer is alleen per medewerker uniek. De nieuwe contractduur `TEMPORARY_NO_END` is toegevoegd aan het lokale typecontract.
- Proeftijdregels zijn gedeeld tussen wizard, contractroute en servervalidatie. Er zijn kalendermaandknoppen en einddatumknoppen voor 1/3/6/12 maanden; oproepuren worden bij een lege keuze op 0 gezet. De roosterverplichte ster staat alleen bij de titel.
- De wizard gaat na **Overige** naar **Controleren** en bewaart pas via **Dienstverband aanmaken**. Annuleren en een viewport-veilige footer zijn toegevoegd. Administratiedetails tonen over de volle breedte administratiegegevens, actieve/gearchiveerde medewerkers en beschikbare CAO's.
- Getallen accepteren `,`, `.` en Nederlandse duizendscheiding in invoervelden. Gangbaar vervolgontwerp is een persoonlijke locale-/nummernotatievoorkeur; een nieuwe voorkeur is in deze slice nog niet toegevoegd.
- De gemelde POST-400 is gereproduceerd met de exacte browserpayload. De oorzaak was `z.string().uuid()` op geldige PostgreSQL-UUID-opmaak met niet-RFC-variant/version-nibbles; de employment-envelope en relevante nested IDs gebruiken nu een database-UUID-validator. De exacte full-on-call-payload heeft een regressietest.

### Verificatie

- Volledige hr-suite: 149 testbestanden en 569 tests groen; strict TypeScript, i18n-pariteit (29 namespaces), `git diff --check` en Webpack-productiebuild met 185 pagina's groen.
- Browser op `127.0.0.1:3000`: administratie-informatie, oplopend nummer/IKV, tijdelijk-zonder-einddatum, einddatumknoppen, proeftijdmeldingen, roosterster, oproep-0-uren, review-vóór-save en Annuleren gecontroleerd. De knop **Dienstverband aanmaken** is niet aangeklikt; er is geen persistent testdienstverband aangemaakt.
- Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit (`contextOrFilename.getFilename is not a function`); dit is geen inhoudelijke wizardfout.

### Open / geblokkeerd

- De drie Supabase-migraties zijn remote toegepast. Voor de unieke IKV-index is de bestaande dubbele groep deterministisch gerepareerd: de vroegste historische relatie behield IKV 9 en de latere open relatie kreeg de eerst vrije IKV 10. Er zijn geen rijen verwijderd; de duplicate-controle retourneert nul actieve groepen.
- Remote staan de per-medewerker unieke indexen, `TEMPORARY_NO_END`-enumwaarden, de numerieke dienstverbandtrigger, contract-/proeftijdguards en `probation_maximum_months` actief. De lokale code/API-fix voor de 400 en de wizard-UX blijven lokaal bewezen.

## Vorige productie-release-status 2026-08-09

- De mobiele Google-login hotfix is live op `main`. Mergecommit `54f5f235c2523612008f5425586f72fc19ab0687` staat op GitHub; Vercel Production `dpl_3g6rdX6aK6imhbcAGsgPNV3M15L4` staat `READY` met alias `liquid-hr-hr-suite.vercel.app`.
- De zichtbare productversie is `1.20260809.2`. `NEXT_PUBLIC_APP_URL` is remote niet gewijzigd omdat de beschikbare Vercel-sessie opnieuw login vroeg; de request-origin-fix maakt de stale waarde niet langer bepalend.

## Form Builder veldtypen 2026-08-09

- De studio-catalogus exposeert nu alle 16 volwassen contracttypen: invoer, keuzevelden en employee/department/job/employment/document-referenties.
- De builder ondersteunt per type een passende preview; keuzevelden hebben een echte NL/EN-optie-editor; labels, helptekst, technische key/binding en gepubliceerde read-only status zijn zichtbaar en bewaakt.
- De documentreferentie gebruikt de bestaande RLS-afgeschermde `employee_documents`-leesweg. Remote schema/policies zijn read-only gecontroleerd; er is geen migration nodig.
- HR-admin browserbewijs: alle 16 typen toegevoegd aan de synthetische P8-clone, na reload behouden, NL/EN en desktop/390px gecontroleerd. Manager/medewerker kregen `/geen-toegang`. 21/21 gerichte tests, typecheck, i18n, lint, diff-check en Webpack-build zijn groen.
- Open volgens blueprint: herhaalbare groepen zijn bewust nog uitgesteld tot na stabilisatie van de basis; presentatieblokken zijn een aparte toekomstige builderlaag.

## Form Builder bindings 2026-08-10

- De studio gebruikt een gesloten developerregistry met 22 keuzes: `PROCESS_ONLY`, 11 getypeerde `DOMAIN_READ`-projecties, de 3 bestaande P9-voorstelroutes en 7 serverformules onder `COMPUTED`.
- De builder toont per veld de categorie, registry key/formula en NL/EN uitleg. Onbekende bindings, typeconflicten, write access op `DOMAIN_READ`/`COMPUTED` en niet-schrijfbare `DOMAIN_PROPOSAL`-velden worden door de compiler geblokkeerd. Bij het kiezen van read/computed wordt bestaande write access veilig naar read omgezet.
- Lokaal bewijs: de gerichte form-field/compiler-suite is 21/21 groen; strict TypeScript, i18n, gerichte ESLint en `git diff --check` zijn groen.
- Browserbewijs: HR Admin ziet de getypeerde binding-editor op poort 3000 met 20 selectors in de P9-draft; manager wordt naar `/geen-toegang` geweigerd en medewerker naar `/geen-toegang` geweigerd. Een schone HR-admin-herhaling van de Forms-workspace had geen nieuwe console-error. De actieve en afgeronde work-itemroutes bereikten via de nieuwe wrapper respectievelijk de verwachte serverguards `FORM_REQUIRED` en `STEP_NOT_ACTIVE`; er is geen oude output-RPC aangeroepen. Tijdens de eerdere client-side testrolwisseling logde Next development-only een `ProcessAutomationSettingsPage`-negative-timestamp uit zijn eigen performance-instrumentatie; dit is geen Forms-fout.
- Remote compatibiliteit is toegepast in `20260810062127_process_automation_form_binding_runtime_compatibility.sql` en `20260810063300_process_automation_output_content_compatibility.sql`. De eerste migratie maakt aparte binding-aware projection/save-wrappers met dezelfde actor-, scope-, document- en concurrencychecks; de bestaande gedeelde form-RPC's zijn ongewijzigd gebleven. De tweede normaliseert de gedeelde P7-outputtrigger en `process_output_source` via `process_definition_content(...)`, zodat top-level en compiled `definition_json.content` werken. Remote functiehashes, wrapperbestaan, authenticated grants en het gegenereerde typecontract zijn gecontroleerd. Advisors zijn opnieuw uitgevoerd: 1 bestaande security-INFO, 37 projectbaseline-security-WARNs en 389 performance-INFO's; geen wrapper- of outputcompatibiliteitsbevinding.

## P9/P10 — actuele overdracht 2026-08-10

- P9-contextingangen zijn aangesloten volgens `schema -> API -> UI`: aparte `BLOCKED`-projectie op de startpagina, een echte Workflows-kaart en Processen-tab op medewerkerdetail, een employment-gefilterde Processen-tab, en server-geautoriseerde startlinks vanuit afdelingen en het organogram.
- De gedeelde outputbrug is compatibel gemaakt met compiled `definition_json.content.output`, niet-RFC-versiegebonden PostgreSQL UUID-vormen, ontbrekende `process-internal-transfer`-documentcategorieën en de benodigde PostgREST/grant/schema-cache-keten. De bestaande form-RPC's zijn niet aangepast.
- Live P10-bewijs op poort 3000: de HR-admin-worker claimde 1 job en rondde die af met `succeeded=1`, zonder retry/fout. Remote staan de job en output op `SUCCEEDED`/`AVAILABLE`; het `employee-documents`-object bestaat als 908-byte `application/pdf`, documenttag `PROCESS_OUTPUT`, categorie `process-internal-transfer`. De Work-detailpagina toont `Dossier interne overplaatsing`, `Beschikbaar` en `PDF downloaden`; de technische status staat op `PROCESS_DOCUMENT_OUTPUT / SUCCEEDED`.
- Browsermatrix op localhost:3000 is opnieuw gecontroleerd met de drie testrollen. HR Admin ziet 20 afdelingsstarts, 51 organogramstarts, employment-processen en de beschikbare PDF. Test Medewerker ziet de echte Workflows-kaart, medewerker-Processen-tab en employment-filter. Test Manager krijgt 0 afdelingsstarts; routeguards geven geen ongeautoriseerde content vrij.
- De startpagina-code projecteert blokkades afzonderlijk, maar de actuele remote testdataset bevat op het controlemoment geen `BLOCKED`-workitem; daardoor is de gevulde blockerkaart live nog niet met een niet-lege fixture bewezen. De code- en UI-route zijn wel door build/typecheck en browser-statecontrole geraakt.
- Open securitybesluit: het algemene medewerkerdossier toont de nieuwe PDF nog niet aan een HR-admin zonder medewerkerrecord, omdat de bestaande document-RLS alleen de onderwerp-audience ziet. Een voorgestelde audience-uitbreiding naar actieve `TENANT_ADMIN`-rollen is bewust niet remote toegepast; daarvoor is expliciete goedkeuring van de exacte doelgroep nodig. De subject-audience en de bestaande geautoriseerde Work/PDF-download blijven intact.
- Lokale eindchecks zijn groen: volledige suite 147 bestanden/559 tests, gerichte output/worker-suite 7/7, strict TypeScript, NL/EN-i18n, volledige ESLint, `git diff --check` en Webpack-productiebuild met 187 pagina's. Supabase security- en performance-advisors zijn opnieuw uitgevoerd; bestaande projectbaseline-meldingen blijven afzonderlijk staan.

## Mobiele Google-login hotfix 2026-08-09

- Oorzaak bewezen in de actuele productieflow: de OAuth-aanvraag bevatte `redirect_to=https://liquidhr.vercel.app/auth/callback?...`, afkomstig uit een verouderde `NEXT_PUBLIC_APP_URL`. Dit domein is geen actueel projectdomein en staat niet in de Supabase-redirectallowlist. Supabase verwerkte Google `/authorize` en `/callback` met 302, maar daarna volgde geen PKCE-tokenwisseling; de fallback naar de Site URL verklaart de terugkeer naar de startpagina zonder sessie.
- Fix staat uitsluitend op branch `codex/fix-mobile-google-auth` in worktree `.worktrees/fix-mobile-google-auth`: gevalideerde request-/forwarded-hostorigin vóór omgevingsfallback, dezelfde publieke origin in de callback, veilige `next`-retour bij succes en fout, een correcte callbackfoutmelding en een pending/disabled Google-knop tegen herhaalde submits.
- Verificatie groen: 7/7 gerichte auth-tests; volledige suite 145 testbestanden/546 tests; strict typecheck; NL/EN-pariteit voor 29 namespaces; Webpack-productiebuild met 181 pagina's. Een 390x844-browserproef tegen de gewijzigde productiebuild op poort 3100 koos ondanks de bewust verouderde env-waarde correct `http://localhost:3100/auth/callback` en liet geen horizontale overflow zien.
- Bestaande blokkade: gerichte ESLint start niet door ESLint 10 versus `eslint-plugin-react` (`contextOrFilename.getFilename is not a function`); deze niet-inhoudelijke repofout is niet opnieuw uitgevoerd of verbreed.
- Open: niets is samengevoegd, gepusht, gedeployed of remote gewijzigd. Productie blijft defect tot de expliciete feature-release. Corrigeer bij of vóór die release ook `NEXT_PUBLIC_APP_URL` naar `https://liquid-hr-hr-suite.vercel.app`; de codefix is daar niet langer afhankelijk van voor requestgebonden OAuth.

## Releaseversie 2026-08-09

- `apps/hr-suite/lib/app-version.ts` en de bijbehorende test zijn verhoogd naar `1.20260809.2` voor deze hotfix.

## Release 2026-08-09

- Productversie verhoogd naar `1.20260809.1`; releasecommit `4813082e9f4a16ace3621d39f3b6d9968b2e716e` staat op `main` en `origin/main`.
- Lokale releasecheck: 143 testbestanden/539 tests, strict typecheck, i18n-pariteit met 29 namespaces, lint en Webpack-productiebuild met 181 pagina's geslaagd. De standaard Turbopack-build blijft omgevingsmatig afhankelijk van de bekende worktree-junction.
- Vercel Production `dpl_GSqHEfvq7J3SCjPzxRwYDT6Bt4c5` staat op `READY`, aliases zijn `liquidhr-edwinitsolutions.vercel.app` en `liquid-hr-hr-suite.vercel.app`; `/login` gaf HTTP 200 en de runtime-errorscan over het laatste uur gaf nul fouten.
- Er is geen directe Vercel-mutatie uitgevoerd; de deployment kwam automatisch via de push naar `main`. De bestaande ongetrackte `.codex-worktrees/` is ongemoeid gelaten.

## P8-verificatie — proces- en formulierstudio 2026-08-09

P8 is uitgevoerd in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\process-automation-p4-p5` en daarna lokaal samengevoegd naar `main` in mergecommit `2ff60c5`. De hoofdworkspace op `main` is nu de gecombineerde testbasis voor poort 3000. Er is niets naar GitHub gepusht of gedeployed. Er is alleen synthetische testdata gebruikt; er is geen down-scenario uitgevoerd.

Actuele lokale runtimecontrole: de `main`-devserver draait vanuit `apps/hr-suite` op poort 3000 (actueel PID 39284); `/login`, `/employees` en `/settings/process-automation` geven lokaal HTTP 200. De gemelde Next-runtime-overlay op een eerder geladen authenticated `/employees`-tab viel samen met Supabase API-logs met HTTP 504 op `user_access`, `user_hr_group_access` en `user_preferences`. Het Supabase-project staat momenteel `ACTIVE_HEALTHY`; er is daarom geen codewijziging voor deze melding doorgevoerd. Na herstart van de lokale server is de route opnieuw HTTP 200; bij de gebruiker is een reload nodig om de oude development-overlay te vervangen.

Aanvullende diagnose: read-only `pg_stat_activity` liet tijdelijk elf gelijktijdige `save_process_definition_draft`-requests zien, waarvan meerdere op dezelfde draft-lock wachtten. De lokale Next-processen zijn gecontroleerd gestopt en er draait nu opnieuw één schone `main`-devserver op poort 3000. Er is geen remote data verwijderd of teruggedraaid. De oorzaak van de oorspronkelijke pooluitputting is daarmee vastgesteld als een open/overlappende studio-save-testaanvraag; de bestaande UI-stopguard blijft een open authenticated browserbewijs en wordt niet als volledig bewezen geclaimd.

Incident na login: een afgebroken transactionele P8-save hield een tuple-lock op `process_definitions` vast; acht actieve save-sessies wachtten daarop en veroorzaakten `PGRST003` in het dashboard. Alleen deze vastgelopen authenticated test-sessies zijn beëindigd; er is geen rij verwijderd, geen migratie teruggedraaid en geen down-scenario uitgevoerd. Nacontrole is groen: nul wachtende definition-locks en nul afgebroken transacties. De gebruiker moet de bestaande tab reloaden en opnieuw inloggen; open geen tweede studio-tab totdat de revision-conflict/stop-retrybrowserproef opnieuw wordt uitgevoerd.

De noodzakelijke bouwvolgorde is aangehouden: schema -> API -> UI.

- Schema: `20260809100000_process_automation_p8_studio.sql`, `20260809100500_process_automation_p8_studio_security.sql` en `20260809101000_process_automation_p8_studio_security_grants.sql` voegen de studio-RPC’s, immutable publish/version/changelog-guards en interne security-definerkern toe. De database-types zijn opnieuw gegenereerd.
- API: catalogus/detail, draft autosave met expected revision, clone, publish, retire en trial zijn aangesloten. Compilerissues bevatten code, pad en boodschap. Trial gebruikt de bestaande assignment-resolver, rapporteert pad, deelnemers, rechten, SLA, output en blockers en schrijft geen runtime-data.
- UI: list-first Procesen/Formulieren, canvas plus toegankelijke staplijst, field library/secties/properties, participant-accessmatrix, compilerfeedback, preview voor participant/stap/taal/desktop/390, diff, publish-confirmatie/changelog, published read-only en clone/archive zijn aangesloten. NL/EN hebben gelijke nieuwe sleutels.

Remote en lokaal bewijs:

- Remote zijn alle zes P8-tabellen gecontroleerd met RLS aan en exact één policy. Publieke mutation-wrappers zijn `SECURITY INVOKER`, alleen authenticated uitvoerbaar; interne mutationfuncties zijn `SECURITY DEFINER`, met `anon` geweigerd en `authenticated` toegestaan. De drie P8-migraties staan geregistreerd.
- De synthetische catalogus bevat `internal-transfer-mslq73xj` als `PUBLISHED` met één published version en `internal-transfer-mslq73xj-copy-mslqd4ax` als `DRAFT` zonder published version. De stale-revision guard gaf remote `PROCESS_DEFINITION_DRAFT_CONFLICT`; de serverguard is daarmee bewezen.
- Supabase advisors zijn na de laatste grants opnieuw uitgevoerd: security totaal 22 met 0 P8-specifieke securitywaarschuwingen; performance totaal 383 met alleen INFO-meldingen over nog ongebruikte kleine-dataset-indexen.
- Lokaal: volledige hr-suite 143 bestanden/539 tests groen, gerichte compiler/resolvertests 19/19 groen, strict typecheck, gerichte ESLint met nul warnings, i18n-pariteit (29 namespaces) en `git diff --check` groen. De Webpack-productiebuild is groen (181 statische pagina’s). De standaard Turbopack-build blijft omgevingsmatig geblokkeerd door de externe `node_modules`-symlink/junction; dit is geen P8-codefailure.
- Na de lokale main-samenvoeging is opnieuw gecontroleerd vanuit `main`: 143/539 tests, `type-check`, `check:i18n`, volledige ESLint (`--max-warnings=0`) en Webpack-build met 181 pagina’s zijn groen. `http://127.0.0.1:3000/login` en `/settings/process-automation` geven lokaal HTTP 200; de Codex in-app authenticated target bleef bij deze laatste smokecheck hangen.

Authenticated browserbewijs op de lokale devserver:

- De HR-admin-flow bewees catalogus -> draft aanmaken -> autosave/revisie -> trial zonder runtime-writes (pad, SLA, output en blockers zichtbaar) -> publish versie 1/read-only -> clone. De browserconsole was in die run leeg. De trial liet bewust de niet-volledige resolver zien: initiator/source-manager/target-manager blockers en een HR-queue-uitkomst; dit is correcte blocker-weergave, geen succesvolle volledige businessfixture.
- De laatste gerichte wijziging voegde de stop/retry-guard voor stale autosave toe. Een nieuwe schone twee-tab authenticated browserrun die specifiek de zichtbare revision-conflictmelding en het stoppen van retries bewijst, kon in de Codex in-app browser niet worden afgerond doordat het lokale browser-target tijdens login/navigatie bleef hangen. Dit bewijs blijft open; de remote conflictrespons is wel bewezen. Een lokale loginrequest op poort 3000 gaf HTTP 200.

### P8-status vóór P9

Bewezen: schema/RLS/grants, API-contracten, compiler/resolvertests, lokale gates, remote publish/versioning, HR-admin studio lifecycle en no-runtime-write trial. Open: schone live UI-evidence voor revision conflict/stop-retry, volledige live field/preview/accessmatrix-herhaling en een volledige succesvolle resolverfixture. Geblokkeerd: standaard Turbopack door worktree-symlink en de laatste Codex-browserherhaling door het browser-target. P8 wordt daarom niet als 100%-gate gemarkeerd. P9 is niet uitgevoerd.

### Handmatig testplan na P9

1. Gebruik de bestaande drie interne fixtures (`hradmin.fixture@liquidhr.test`, `manager.fixture@liquidhr.test`, `employee.fixture@liquidhr.test`) en uitsluitend de behouden P8-clone. Open dezelfde draft in twee HR-admin-tabs; sla tab A op, submit daarna vanuit tab B met stale revision en verwacht de gelokaliseerde conflictmelding, geen retry-loop en een correcte reload.
2. Maak in de testfase één tijdelijk ongeldige draft-inhoud, controleer exacte compiler-code/pad/boodschap en herstel daarna. Controleer preview voor participant, stap, NL/EN, desktop en 390px; controleer de participant-accessmatrix en keyboard/focus.
3. Doorloop Procesproef met een synthetische employee/managerfixture die alle resolverpaden vult. Controleer success en blocker-modus afzonderlijk en bevestig vóór/na dat geen process instance, work item, event of output is geschreven.
4. Controleer publish-confirmatie/changelog, immutable published read-only, diff, clone, archive/retire en impactweergave. Herhaal manager/employee-deny op route en API. Voer daarna de P9-controles uit: volledige keyboard/axe, scheduler/restart en inhoudelijke HTML/PDF/cross-role-downloadcontrole.

## Historische P4/P5/P6/P7-verificatie vóór P8 2026-08-09

Dit blok is de gecontroleerde P4/P5/P6/P7-basis waarop P8 is voortgebouwd; de gecombineerde gate van die eerdere fasen is bewust niet als 100% gemarkeerd.

## Canonieke lokale voortzettingsbasis voor P9 2026-08-09

De gecombineerde lokale versie staat nu in `C:\Users\Edwin\Documents\Apps\LiquidHR`, branch `main`, mergecommit `2ff60c5`. Dit is de actieve basis voor de volgende testthread en handmatige P9-opvolging. De feature-worktree en checkpoint `c33e799` blijven behouden als herstelbare bron. Er is niets naar GitHub gepusht of gedeployed.

De noodzakelijke fixes zijn beperkt gehouden en in de volgorde schema -> API -> UI uitgevoerd. Remote staat de additive P5-scope-RPC-hardening geregistreerd. De form-projectie en autosave behouden de documentreferentie- en scopevalidatie; een actor zonder employee-context kan via de expliciete task-scope branch lezen en opslaan. De API-downloadroute gebruikt na de context-RPC het bestaande admin storage-signing pad voor exact het geautoriseerde process-document. De work- en work-item-projecties accepteren database-UUID's met geldige Postgres UUID-opmaak, ook wanneer de variantnibble niet RFC-4122 is.

Remote SQL-bewijs: `process_automation_p5_participant_access.sql` en `process_automation_p6_p7.sql` zijn na de hardening zonder fout geslaagd. Een expliciet geautoriseerde synthetische fixture `p4-p7-live-gate` leverde 4 P5-participant-items en een niet-lege P6-queuekandidaat. De live P7-proeven bewezen dubbele-runner-claim met één winnaar, crash/retry/backoff, expired-job naar dead-letter, operator-requeue, reminder-idempotency, output completion en job-success. De output werd `AVAILABLE` met HTML/PDF-metadata; de authenticated download gaf voor de geautoriseerde HR-admin/employee-context een lokale redirect naar het exact gesigneerde synthetische document.

Authenticated browser-bewijs op localhost:3000: HR-admin zag de vier P5-rollen met respectievelijk `Aanvrager`, `Manager`, `Voorwaardelijk HR` en `Observator`, inclusief formulier/submit en zonder load-, forbidden- of console-error. Manager claimde en actioneerde de P6-work-item; employee claimde de requester-item en autosave schreef een response revision. Twee gelijktijdige requester-claims hadden precies één winnaar. Keyboardbewijs toont focus op het formulierinput en autosave `Opgeslagen`. De queue bevatte tijdens de fixture zes zichtbare items voor HR-admin en manager. Een HR-admin zonder employee-context kreeg bij claim terecht HTTP 403; dit is tegelijk een open UI-contractpunt omdat de projectie daar nog een claim/action affordance toont.

Lokale verificatie na de laatste fix: 3 gerichte bestanden, 8/8 Vitest-tests groen (`workflow-job-service`, `process-output`, output-download route), strict typecheck groen en `git diff --check` zonder inhoudelijke fout. Repo-lint stopt vóór linting op de bestaande ESLint 10/`eslint-plugin-react`-compatibiliteit. Supabase advisors en types zijn opnieuw uitgevoerd.

De fixture is transactioneel en aantoonbaar opgeruimd: alle exacte form/process/instance/step/work-item/candidate/event/response/revision/job/output/document/audit-rows en het storage-object staan op 0. De bestaande drie fixtureaccounts zijn niet verwijderd; cleanup raakte alleen de synthetische fixturedata. Er is geen down-migratiescenario uitgevoerd.

### Open / handmatig na fase 9

- P5/P6: HR-admin scope-only claim/action moet productmatig worden beslist: affordance verbergen of een expliciete actor/reassign-flow toevoegen; de negatieve HTTP-403 is bewezen.
- P6: voer nog de expliciete kandidaat-zonder-claim negatieve action-check uit en leg de verwachte status vast.
- P6: volledige focus-ring/keyboardmatrix en axe-resultaat op `/work` en detail per rol zijn nog niet als eindbewijs vastgelegd.
- P7: persistente scheduler/cron-fallback en een echte live dubbele runner over procesrestart heen blijven handmatig te bewijzen; de SQL-kernelproeven zijn wel groen.
- P7: controleer na fase 9 nog het gedownloade bestand inhoudelijk (PDF-header/HTML-download) en cross-role downloaddeny voor een niet-geautoriseerde context.

### Handmatig testplan na fase 9

1. Log in als HR-admin, manager en employee en open `/work`; controleer lijst, zoek/filter/sortering, detail, vier P5-velden, NL/EN en geen cross-role data.
2. Gebruik twee sessies op één OPEN item: één claim moet winnen, de andere krijgt `ALREADY_CLAIMED`; controleer daarna release, toegestane action en stale expected-version.
3. Probeer vóór claim een action, een onjuiste HTTP-action en cross-tenant/output-download; verwacht respectievelijk de gedocumenteerde negatieve status, 403/404 en geen documentlek.
4. Doorloop alleen met toetsenbord: skip-links, combobox, tabs, formulier, submit, focus-ring en escape/terug; voer daarna axe uit op lijst en detail en noteer violations/incomplete apart.
5. Laat de scheduler minstens twee runners, crash/retry/backoff, expired/dead-letter, requeue en reminder opnieuw uitvoeren; controleer job-idempotency en persistence na restart.
6. Download HTML/PDF als geautoriseerde actor, controleer bestandstype/inhoud en herhaal als niet-geautoriseerde rol. Noteer elk resultaat naast dit document.

## Actuele P4/P5/P6/P7-gate 2026-08-08: Process Automation runtime, werk en automation

Deze overdracht gaat uitsluitend over P6 en P7 van `LIQUID_PROCESS_AUTOMATION_BLUEPRINT.md`, met de actuele P4/P5-handoff als gecontroleerde context. Het werk staat in featurebranch `codex/process-automation-p4-p5`; P8, product-AI, visual builder, commit, push, merge en deployment zijn bewust niet uitgevoerd. P4 is functioneel bewezen; P5 houdt participant-DOM/network-bewijs open. P6/P7 zijn opnieuw lokaal en remote gecontroleerd en hadden geen niet-lege remote fixtures.

Schema is remote toegepast via de P4/P5-runtime-, form-runtime-, schema-hardening-, hardening-, performance-, grants-, audit-, assignment-, form/action/start-alias-, label-text- en document-reference-compatibiliteitsmigraties. P4 bevat atomic start/action, locks, idempotency/correlation, conditions, assignment, terminal outcomes, parallel `ALL`, append-only events en gesaneerde audit. P5 bevat form versions, current/new revisions, expected-version autosave, server-side access/visibility/hidden projection, typed values, NL/EN labels, shared Zod payloads, accessible renderer en documentreferenties via `employee_documents` plus `document_audiences` en het bestaande documentleesrecht.

Remote security- en datatoegangcontrole voor P4/P5: RLS staat aan op alle zes runtime/form-tabellen en `audit_logs`; response-tabellen hebben geen directe authenticated tabelgrants. Public RPC-wrappers zijn invoker-only met authenticated execute; interne kernels zijn definer met authenticated execute en anon execute uit. Zes runtime-audittriggers zijn aanwezig; audit blijft beperkt tot canonieke CRUD-acties en slaat geen formwaarden op. `packages/db/types.ts` is opnieuw gegenereerd tegen het actuele remote schema.

Remote regressies zijn opnieuw geslaagd: P4/P5-contract, runtime/idempotency/stale concurrency, request changes/reject/cancel/rollback, parallel `ALL` en P5 vier-participant access projection/document domain. Iedere SQL-fixture gebruikte een transactie met rollback; remote tellingen zijn nul voor process instances, steps, workitems, events, form responses, revisions en P4/P5-auditrows. Supabase security advisor bleef projectbaseline (22 meldingen, 1 INFO/21 WARN) zonder P4/P5-target; performance had geen P4/P5-unindexed-FK-melding en alleen verwachte unused-index-INFO's op lege/tabellen.

De daaropvolgende P4/P5-statusregel is de historische handoff vóór de P6/P7-voortzetting; de actuele P6/P7-status staat in het blok eronder.

Lokale verificatie voor deze voortzetting: volledige Vitest 140 bestanden/527 tests, strict typecheck, i18n 29 namespaces, gerichte ESLint en Webpack-productiebuild met 179 pagina's zijn groen. Repo-brede ESLint blijft geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit; de standaard Turbopack-build kan de externe `node_modules`-junction van deze feature-worktree niet verwerken, maar de Webpack-build slaagt.

Status: P4 is volledig bewezen. P5 is functioneel, remote en lokaal code-/testmatig uitgevoerd; participant-DOM/network-bewijs blijft open. De gecombineerde P4/P5-gate is niet 100%; stop vóór P6. Geen remote testdata, commit, push, merge of deployment achtergelaten.

### P6/P7-voortzetting en actuele deliverystatus

De vorige P4/P5-regels hierboven beschrijven de handoff vóór deze voortzetting. P6 is daarna gebouwd met lokale migraties `20260808170000_process_automation_p6_work_projection.sql`, `20260808170700_process_automation_p6_administration_filter.sql` en `20260808171100_process_automation_p6_role_permissions.sql`. De werkruimte `/work` gebruikt URL-state voor zoeken, tabs, filters en sortering en toont veilige projecties; het detail bevat subject/opdracht/formulier/current-new, voortgang, tijdlijn, actiebalk, assignmentuitleg en concurrentiefeedback. Sidebar, startpagina en medewerkerdetail-tab zijn aangesloten met gelijke NL/EN-sleutels.

P7 is gebouwd met de job-, kernel-, deadline-, output-, download- en hardeningmigraties `20260808170100` t/m `20260808171200` in de lokale worktree. Dit omvat locking, retry/backoff/dead-letter, deadlineprojectie naar bestaande reminders, in-app proceswerkprojectie, HTML/PDF-dossieroutput, actor-only outputrechten, operations/requeue en de wrapper-executionfix. Immediate drain en de authenticated schedulerfallback bestaan; een persistente schedulerconfiguratie is niet toegevoegd. Er is geen product-AI of externe mailprovider toegevoegd.

Remote bewijs is opnieuw gecontroleerd: de P6/P7-contracttest geeft `[]`; de drie nieuwe tabellen hebben RLS, elk één policy en geen directe `anon`/`authenticated`-tabelrechten. Er zijn 14 interne security-definerhelpers en 14 publieke invoker-wrappers met authenticated execute en anon geweigerd. Tenant-specifieke HR/TENANT-adminrollen hebben de Process Automation-permissions; `packages/db/types.ts` is opnieuw gegenereerd. P6/P7-specifieke securityadvisorwaarschuwingen ontbreken; resterende meldingen zijn inherited baseline of INFO's voor ongebruikte indexen op lege proces-tabellen.

Browserbewijs is groen voor HR-admin, manager en medewerker op `/work` in de lege-state; desktop 1280px en mobiel 390×844 hebben geen horizontale overflow. Een geautoriseerde niet-lege queue-kandidaat ontbreekt remote en er is geen seeddata achtergelaten. Open blijven P5 participant-DOM/network, queuekandidaat en niet-lege claim/action-rolflows, volledige keyboard/focus- en gerichte axe-controle, live P7 dubbele runner/crash-retry/dead-letter/verlopen-job/output/reminder/download, en persistente scheduler-operatie. De gecombineerde P4/P5/P6/P7-gate is daarom niet 100%; uitvoering stopt vóór P8.

## Historische P2/P3-gate 2026-08-08: Process Automation datamodel en work-item kernel

P1 is uitgebreid met P2 en P3. P2 staat remote als scopevast proces-/formulierdatamodel met drafts, immutable published versions, runtime instances/steps/workitems/events, typed employee/employment-subjectlinks, pinned process versions, RLS, canonical permissions, authenticated-SELECT-only grants en FK-indexen. P3 staat remote als assignment resolver/kernel: business date policies, `EXACTLY_ONE`/`ANY_ONE`/`ALL`, candidate eligibility, scope/self-assignment/deputyregels, evidence-materialisatie, claim/release/reassign/re-resolve, expected-version locking en audit-events. De API-adapters staan onder `apps/hr-suite/app/api/process-work-items/[workItemId]/`; P4 transition engine, studio/runtime-UI en product-AI zijn niet gestart.

Remote migraties: `20260808122825_process_automation_p2_foundation`, `20260808124007_process_automation_p3_workitem_kernel`, `20260808125031_process_automation_p2_grant_hardening`, `20260808125355_process_automation_p3_rpc_contract` en de additive FK-indexmigratie. De remote P2/P3-contracttest slaagt. De echte twee-sessie `ANY_ONE`-test slaagt: één claim wint op de instance-lock, de tweede krijgt `ALREADY_CLAIMED`; stale release, audit-events en directe tabelmutatie zijn eveneens gecontroleerd.

Verse lokale gate: 137 testbestanden/514 tests, gerichte Process Automation-tests 20/20, strict TypeScript, ESLint, i18n 28 namespaces, productiebuild 175 pagina's en `git diff --check` groen. De database-types zijn opnieuw gegenereerd en bevatten de nieuwe tabellen/enums/RPC's. Geen commit, push, merge of deployment.

De definitieve P2/P3-handoff is 100% afgerond. Na expliciete bevestiging zijn de twee tijdelijke concurrency-fixtures (`p3-concurrency-contract` en `p3-concurrency-contract-2`) in één gecontroleerde transactie verwijderd; de nul-rijencontrole omvatte definities, drafts, versions, instances, subjectlinks, steps, workitems, candidates en events. De drie tijdelijk uitgeschakelde immutable/append-only-triggers zijn in dezelfde transactie weer actief gezet. P4 en P5 zijn nog niet gestart. De lokale gates, remote contracttests, twee-sessie-concurrencytest, advisors, typegeneratie en migratielijst zijn gecontroleerd; er is geen commit, push, merge of deployment uitgevoerd.

## Historische P1-gate 2026-08-08: Process Automation definitiecompiler

De zin "P4 en P5 zijn nog niet gestart" in de historische P2/P3-handoff hierboven beschreef de status vóór deze branch. Lees voor de actuele status de P4/P5-sectie bovenaan.

Dit was de P1-startstatus; de actuele P2/P3-status en de resterende cleanup-blocker staan hierboven.

## Hotfix 2026-08-08: verplichte velden in dienstverbandwizard

## Hotfix 2026-08-08: administratie-409 en controlebalk

De terugkerende 409 bij de administratievoorwaardestap kwam door `employees_update_group`: een nieuwe medewerker heeft nog geen organisatieplaatsing en viel daardoor buiten `can_manage_employee`, ondanks een geldig HR-groepsrecht. Migration `20260808144955_allow_hr_group_employee_update_before_placement` is met expliciete toestemming remote toegepast op `wnpfloqpjvaacobppbpk`. De transactionele RLS-regressietest slaagde; tijdelijke testdata is teruggedraaid. De Controle-onderbalk staat nu absoluut vast binnen de wizardkaart met een scrollbaar middendeel.

Verificatie: leeftijds-/wizardtests 4/4, strict TypeScript, gerichte ESLint, i18n 28 namespaces, lokale browsercontrole van vaste onderbalk, remote policycontrole en Supabase security/performance advisors. Advisors tonen alleen bestaande projectbrede meldingen.

De dienstverbandwizard gebruikt nu één gedeelde validatie voor Administratie, Dienstverband, Contract, Rooster en uren, Salaris en Overige. Ook de voorafgaande medewerkergegevenscontrole valideert land, nationaliteit, geboortedatum en geslacht vóór de PATCH. Bij een ontbrekend verplicht veld wordt overal **Vul eerst alle verplichte velden in.** getoond; de technische 400- of algemene foutmelding wordt niet meer aan de gebruiker getoond. Een regressietest dekt de voorwaardestap en iedere wizardtab af.

Verificatie: gerichte Vitest (2 tests), strict TypeScript, gerichte ESLint en `git diff --check` zijn groen. De lokale authenticated browserflow bereikte de dienstverbandaanmaak maar bleef tijdens de bestaande medewerker-aanmaakrequest wachten; de uiteindelijke zichtbare dienstverbandtab is daardoor in deze run niet opnieuw bevestigd.

## Hotfix 2026-08-08: adres-409 bij herintreding vóór organisatieplaatsing

De resterende 409 kwam door een tweede RLS-scopefout. Een bestaand PRIMARY-adres van een medewerker zonder organisatieplaatsing was voor HR niet leesbaar, waardoor de herintredingsflow een dubbele adres-POST deed. Migration `20260808133244_allow_hr_preplacement_subresource_access` is met expliciete toestemming remote toegepast. De migration geeft HR binnen dezelfde HR-groep toegang tot medewerker-subresources en de activiteitenfeed vóór organisatieplaatsing, met behoud van tenant-, HR-groep- en permissionchecks.

Verificatie: remote `subresource_read_allowed=true` en één zichtbaar bestaand adres, remote migratielijst bevestigd, security/performance advisors uitgevoerd en lokale testsuite 137/514 groen. Advisors tonen alleen bestaande projectbrede meldingen.

## Update 2026-08-08: dienstverbandwizard voorkomt verouderde optiesnapshot

De dienstverbandopties worden bij het laden expliciet zonder browsercache opgehaald. Als de medewerker toch tussen laden en opslaan wijzigt, ververst de wizard de opties en probeert alleen opnieuw wanneer de relevante nationaliteit, geboortedatum en het geslacht niet door een andere wijziging zijn aangepast. Wanneer de actuele gegevens al overeenkomen met de invoer, gaat de wizard direct verder. Een echte wijziging van dezelfde persoonsgegevens blijft een controleerbare conflictmelding.

Verificatie: gerichte Vitest, strict TypeScript, gerichte ESLint en `git diff --check` zijn groen. Er is geen databasewijziging uitgevoerd.

## Update 2026-08-08: leeftijdsgrens en dubbele administratie-opslag

De nieuwe medewerkerwizard controleert een ingevulde geboortedatum op een leeftijd van minimaal 10 en maximaal 90 jaar, inclusief de grenswaarden. De controle geldt in de identiteitscontrole, de kerngegevens en de voorafgaande gegevensstap van het dienstverband; NL/EN-meldingen zijn toegevoegd.

De terugkerende 409 in Administratie is read-only bevestigd als een dubbele PATCH met dezelfde `updatedAt`-waarde: de eerste poging slaagt, de tweede poging wordt door de optimistic-concurrencycontrole geweigerd. De wizard blokkeert nu synchroon een tweede opslagactie totdat de eerste klaar is. Er is geen databasewijziging uitgevoerd.

Verificatie: leeftijds- en wizardvalidatietests (4 tests), strict TypeScript, i18n-pariteit, gerichte ESLint en `git diff --check` zijn groen.

## Update 2026-08-08: exacte BSN-match bepaalt wizardroute

Een exacte BSN-match kan niet meer via **Nieuwe medewerker aanmaken** verdergaan. Bij een bestaand actief dienstverband stopt de wizard en blijft alleen de route naar de bestaande medewerker beschikbaar. Bij een afgesloten dienstverband of een bestaande medewerker zonder dienstverband kan de gebruiker de bestaande persoonskaart laden, gegevens bijwerken en kiezen voor alleen bijwerken of bijwerken plus een nieuw dienstverband. Deze route gebruikt de bestaande Employee en gaat niet via `POST /api/employees`.

## Update 2026-08-08: wizardkop en aanmaakconflict

De overbodige subtitel boven de medewerkerwizard is verwijderd en de wizard start daardoor hoger. De stappennavigatie gebruikt op desktop geen sticky-top-offset meer en staat gelijk met de bovenkant van het invoerpaneel. De aanmaakactie behandelt elk `EMPLOYEE_NUMBER_CONFLICT`, ook zonder voorgesteld nummer, gericht op de kerngegevens; een dubbele BSN krijgt een eigen melding en verwijst terug naar de identiteitscontrole. TypeScript, ESLint, i18n, diff-check en authenticated browsercontrole zijn groen.

## Update 2026-08-08: lege controlesectie en dienstverbandconflict

Op de controlepagina wordt **Extra gegevens** alleen nog getoond wanneer minstens één aanvullend veld is ingevuld; een lege sectie verdwijnt volledig uit de samenvatting. In de eerste dienstverbandstap wordt na een geslaagde medewerker-PATCH de door de API teruggegeven `updatedAt` in de lokale optiesnapshot bijgewerkt. Daarmee blijft de optimistic-concurrencywaarde actueel voor vervolgacties. Een echte `EMPLOYEE_CONCURRENCY_CONFLICT` krijgt bovendien een gerichte NL/EN-melding. TypeScript, ESLint, i18n en een authenticated browsercontrole van de lege controlesectie zijn groen. Er is geen medewerker of dienstverband aangemaakt.

## Update 2026-08-08: medewerkerwizard controle en adreslayout

In Extra gegevens verschijnt het blok **Vrije velden** alleen wanneer de actieve HR-groep minstens één actieve medewerkerdefinitie heeft waarvoor de gebruiker schrijfrechten heeft. Zonder ingerichte medewerker-velden blijft het blok volledig weg. De adresinvoer gebruikt voor straat, huisnummer en toevoeging een vaste, nette veldverdeling. Bij binnenkomst op Controle wordt de scrollpositie naar boven gezet. De controle groepeert de volledige naamopbouw, naamgebruik, partnernaam en overige kerngegevens onder Identiteit; partnernaam staat niet meer los onder Extra gegevens. De controlefooter blijft op één regel met compactere knoptekst. Tijdens het aanmaken van een medewerker met dienstverband toont de wizard dezelfde blokkerende voortgangsweergave als bij de identiteitscontrole. TypeScript, lint, i18n en authenticated browsercontrole zijn groen.

## Update 2026-08-08: validatiemeldingen en Meer gegevens in medewerkerwizard

De medewerkerwizard toont bij ontbrekende verplichte kerngegevens nu **Vul de gemarkeerde verplichte velden in.** in plaats van de algemene foutmelding. Overige veldvalidatie gebruikt **Corrigeer de gemarkeerde velden**; adrescombinaties behouden hun specifieke adresmelding. Het grote blok **Meer gegevens** met toelichting en aanvullende kerngegevens is uit de kerngegevens-tab verwijderd. De wizard toont alleen een subtiele **Meer gegevens**-indicator tussen de navigatieknoppen wanneer er onder de huidige positie nog scrollinhoud staat. De extra-gegevens-tab behoudt haar eigen inklapbare blokken; identiteit en contact tonen hetzelfde signaal alleen wanneer er daar nog inhoud onder staat. TypeScript, lint, i18n en authenticated browsercontrole zijn groen.

## Update 2026-08-08: kerngegevens-tab medewerkerwizard

De kerngegevens-tab toont het personeelsnummer op een eigen rij, gevolgd door roepnaam en geboortenaam-tussenvoegsel. Het naamvoorbeeld toont alleen de volledige opgebouwde naam. Partnernaam heeft nu ook een afzonderlijk tussenvoegselveld; de naamopbouw gebruikt dit veld in alle partnernaam-volgordes. TypeScript, lint, i18n en authenticated browsercontrole zijn groen.

## Update 2026-08-08: bestaande medewerker gebruiken in medewerkerwizard

De medewerkerwizard biedt bij een gevonden persoon zonder dienstverband de expliciete actie **Deze medewerker gebruiken** en bij een persoon met alleen een afgesloten dienstverband **Herintreden met deze medewerker**. De bestaande Employee blijft behouden; de wizard laadt de persoons-, contact-, adres- en vrije-veldgegevens in de volgende tabs en maakt geen tweede Employee. Bij een medewerker zonder dienstverband kan de gebruiker op de controlepagina kiezen voor alleen **Medewerker bijwerken** of **Medewerker + dienstverband aanmaken**. Bij herintreding verschijnt bij de overgang naar het nieuwe dienstverband een tussenkeuze om bruikbare gegevens uit het laatst afgesloten dienstverband als voorstellen over te nemen of met nieuwe gegevens te beginnen. Contract-, rooster-, salaris-, organisatie- en kostenverdelingsvoorstellen worden server-side beperkt tot de gekozen administratie en actuele stamdata. Als de gebruiker de bestaande match niet kiest, blijft de route voor een nieuwe medewerker beschikbaar. Hiervoor was geen schemawijziging nodig.

Strict TypeScript, volledige ESLint, i18n-pariteit met 28 namespaces en `git diff --check` zijn groen. De authenticated lokale browsercontrole bevestigde de herintredingsactie voor Iris de Boer en het voorvullen van kern-, extra- en contactgegevens. De laatste opslagactie en publicatie van een nieuw testdienstverband zijn niet uitgevoerd om testdata niet te muteren.

## Update 2026-08-08: identiteitscontrole overslaan

De medewerker-aanmaakwizard heeft onderaan de identiteitsstap een actie om de controle over te slaan. Deze actie haalt wel het volgende personeelsnummer op en gaat door naar de kerngegevens, maar neemt geen ongeteste identiteitsvelden mee. NL/EN i18n-check en strict TypeScript zijn groen; een authenticated browsercontrole van deze nieuwe actie blijft open.

De navigatieknoppen van iedere wizardstap staan nu als onderbalk onderaan de vaste wizardhoogte en blijven tijdens scrollen zichtbaar. Boven de knoppen staat een subtiele dunne scheidingslijn. TypeScript, lint en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

Tijdens de identiteitscontrole wordt stap 1 tijdelijk geblokkeerd met een interactieve voortgangsweergave met drie fasen, voortgangsbalk en statusiconen. De controle gebruikt NL/EN i18n en verdwijnt automatisch zodra de matchrespons terugkomt. TypeScript, lint, i18n en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

De melding dat er meer inhoud onderaan staat is hoger boven de navigatiebalk geplaatst en gebruikt nu een subtiele groenige successtijl met duidelijke pijl. TypeScript, lint en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

De identiteitsstap toont geen apart `Identiteit`-label meer en de identiteits-progressiekaart toont geen extra toelichtingszin meer. Daarmee is verticale ruimte teruggewonnen; de voortgangstitel, fasen en balk blijven behouden.

De wizardonderbalk gebruikt nu minder verticale padding, waardoor meer ruimte beschikbaar blijft voor formulierinvoer. De scrollhint blijft erboven geplaatst. De herbruikbare UX-standaard staat in [`requirements/ux/WIZARD_UX_STANDARD.md`](../requirements/ux/WIZARD_UX_STANDARD.md) en is toegevoegd aan de documentatie-index.

De wizard heeft daarnaast een vaste hoogte per stap. De adresmelding blijft bij het straatveld uitgelijnd, geselecteerde adreszoekresultaten verdwijnen na keuze en de identiteitsacties staan op één regel met overslaan links en controleren rechts. TypeScript, lint, i18n en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

Na een afgeronde identiteitscontrole wisselt de onderbalk naar **Invoer nieuwe medewerker afbreken** links en **Doorgaan** rechts. De actie om de controle over te slaan en de controleknop verdwijnen dan. Bij een exacte match blijft de waarschuwing zichtbaar, maar kan de gebruiker zelf alsnog doorgaan met het invoeren van een nieuwe medewerker. TypeScript, lint, i18n en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

Na het voltooien van de kerngegevens toont de wizard onder de stappen **Nog niet opgeslagen** met een save-icoon. Handmatig opslaan maakt de medewerker met de beschikbare kerngegevens aan via de bestaande medewerker-API; daarna toont de wizard **Opgeslagen** en blijft de save-actie beschikbaar voor latere wijzigingen. Het afronden van de wizard werkt vervolgens de opgeslagen medewerker bij in plaats van een dubbele medewerker aan te maken. TypeScript, lint, i18n en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

De mobiele medewerkerwizard begrenst de breedte van de wizard, scrollcontainer, formulieren en veldlabels expliciet en verbergt horizontale overflow. Daarmee blijven tekstvelden op smalle schermen binnen het paneel. TypeScript, lint en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

De kerngegevensstap gebruikt nu `Geboortenaam/Achternaam` en toont tijdens het typen een live naamvoorbeeld met roepnaam, achternaam, partnernaam en de gekozen naamvolgorde. De Extra gegevensstap bestaat uit twee standaard ingeklapte vensters: Optionele extra gegevens en Vrije velden; bestaande actieve HR-groepsvrije velden kunnen daar worden ingevuld en na het aanmaken opgeslagen. De wizard gebruikt een begrensd scrollbaar middenstuk, sticky onderknoppen en een verdwijnende pijlmelding wanneer er meer inhoud onderaan staat. Lokale controles: strict TypeScript, i18n-pariteit met 28 namespaces en `git diff --check` zijn groen. Authenticated browsercontrole van deze visuele flow blijft open.

## Update 2026-08-08: identiteitsmatch en medewerkerarchivering

De medewerker-aanmaakwizard toont bij gevonden medewerkers een uitklapbaar informatieblok met archiefstatus, medewerkertype, actief of laatst bevestigde dienstverband en administratie-nummer plus naam. De identiteitsmatch en de aanvullende dienstverbandread zijn beperkt tot de actieve HR-groep; daarmee worden cross-group kandidaten niet meer als bestaande medewerker aangeboden. De archiefmelding maakt een 404 door ontbrekende of niet-zichtbare HR-groepsscope expliciet. Lokale controles: strict TypeScript, ESLint, i18n-pariteit met 28 namespaces en `git diff --check` zijn groen. Authenticated browsercontrole van de nieuwe informatieweergave en de daadwerkelijke archive-mutatie blijft nog open.

De wizard berekent het voorgestelde personeelsnummer nu uit het hoogste werkelijk gebruikte numerieke nummer plus één. De reserverings-RPC wordt niet meer aangeroepen voor alleen het tonen van het voorstel; daarmee kunnen verlaten wizards het zichtbare nummer niet meer kunstmatig verhogen. De definitieve creatie blijft bij ontbrekende invoer via de bestaande reserveringsroute concurrencyveilig.

De wizard toont geen optionele-labels meer; verplichte velden tonen alleen een sterretje. Veldfouten worden bij blur opnieuw gecontroleerd en verdwijnen wanneer het veld geldig is; samengestelde fouten blijven staan tot alle betrokken velden samen geldig zijn. Dit UX-contract staat leidend in `docs/requirements/ux/FORMULIER_VALIDATIE_EN_LABELS.md`. Lokale controles na deze wijziging: strict TypeScript, ESLint, i18n-pariteit met 28 namespaces en `git diff --check` zijn groen.

De adresstap van de medewerkerwizard gebruikt nu dezelfde adreszoekopdracht en postcode/huisnummer-aanvulling als de persoonskaart. Suggesties vullen straat, huisnummer, toevoeging, postcode en plaats in; handmatige invoer blijft beschikbaar. Wanneer een straatnaam cijfers bevat, verschijnt in zowel de wizard als het bestaande woonadresformulier een niet-blokkerende controleopmerking dat dit onderdeel van de straatnaam kan zijn en dat het huisnummer apart moet worden gecontroleerd. Lokale controles na deze uitbreiding zijn groen; authenticated browsercontrole van de nieuwe wizard-adresflow blijft open.

## Release 2026-08-07: productversie 1.20260807.2

De zichtbare productversie is verhoogd naar `1.20260807.2` volgens de centrale releaseconventie. De versie-unit-test is bijgewerkt. Lokale releasegate: 132 testbestanden/490 tests, strict TypeScript, ESLint, i18n-pariteit met 28 namespaces en productiebuild met 175 pagina's zijn groen. Commit `98ac2ebc3c8c0b15dd73f373ea4f0889cf14d0a3` staat op `main` en is naar GitHub gepusht.

## Update 2026-08-07: medewerker-aanmaakwizard

De wizard is uitgebreid met een expliciete administratiekeuze als eerste dienstverbandstap bij meerdere administraties, uitklapbare administratiedetails en het medewerkertype op dienstverbandniveau: Medewerker, Stagiair, Uitzendkracht / Externe, ZZP / Freelancer, Vrijwilliger en Geen verloning (diverse). Na het dienstverband kiest de gebruiker of loon-/contractgegevens worden toegevoegd; bij ja worden contract, rooster, salaris, organisatie en kosten als extra wizardstappen aan de linkerzijde toegevoegd. De administratie-instelling ondersteunt nu één of beide betaalfrequenties (maand en 4 weken). De salarisstap ondersteunt salarisschaal + trede met bedrag, en de organisatiesectie functiegroep → functie → afdeling → leidinggevende plus gesplitste kostenallocatie.

De bestaande contractkolom `employment_contracts.worker_type` blijft alleen technische compatibiliteit; de UI vraagt het type niet meer op contractniveau en toont het type vanuit `employments.employment_type`. De migratie `20260807185745_expand_employment_types_and_wizard_flow` breidt de enum uit en maakt de complete employment-RPC geschikt voor zowel alleen dienstverband als dienstverband met looncontract. Samen met `20260807185718_allow_hr_address_creation_before_placement` en `20260807185727_allow_employee_administration_assignment_for_employment_creation` is deze remote toegepast. Security-advisor staat op 1 INFO / 21 WARN en performance op 344 INFO; dit is de bestaande projectbaseline. De officiële database-types zijn opnieuw gegenereerd. Vercel Production-deployment `dpl_66LXmSsJavEWFj34CFZqnjPfCKVy` (`liquidhr-9qqlv4578-edwinitsolutions.vercel.app`) staat op `READY` en is exact op deze commit gebouwd. De publieke alias `/login` geeft HTTP 200; de geauthentiseerde browsercontrole van de wizard blijft als handmatige vervolgstap open.

Lokale verificatie na deze uitbreiding: i18n 28 namespaces, 132 testbestanden/490 tests, strict TypeScript, ESLint, productiebuild met 175 pagina's en `git diff --check` zijn groen.

## Update 2026-08-07: dienstverband vervolgen in dezelfde wizard

De actie **Medewerker + dienstverband aanmaken** blijft nu in dezelfde wizard. De linker stappenlijst wordt uitgebreid met de zes dienstverbandstappen en gebruikt het bestaande dienstverbandformulier zonder medewerkergegevens opnieuw te vragen. Nationaliteit en land gebruiken een zoekbare landkeuze. De eerste dienstverbandstap bevat dienstverbandnummer, startdatum en ancienniteitsdatum; het medewerker-/personeelsnummer blijft op `employees`, terwijl het dienstverband een eigen `employment_number` heeft. Het medewerker-/personeelsnummer toont het hoogste gebruikte nummer, een lijst met gebruikte nummers en een debounced live uniekheidscontrole.

BSN is in de dienstverbandstap optioneel en toont uitleg wanneer het leeg blijft. De bestaande dienstverband-prerequisite-PATCH schrijft niet langer het medewerker-/personeelsnummer terug; daarmee wordt de gemelde 409 niet meer door een dubbele medewerker-update veroorzaakt. Voor een nieuwe medewerker wordt vóór het laden van de dienstverbandstappen een administratie-koppeling gelegd. De lokale migratie `20260807183000_allow_employee_administration_assignment_for_employment_creation.sql` bevat daarvoor de beperkte insert-policy voor gebruikers met `contract:write`.

Verificatie: strict TypeScript, volledige ESLint, 132 testbestanden/490 tests, i18n-pariteit met 28 namespaces, productiebuild met 175 gegenereerde pagina's en `git diff --check` zijn groen. De drie migraties zijn remote geregistreerd als `20260807185718`, `20260807185727` en `20260807185745`; de remote RLS/enum/RPC-controle en typegeneratie zijn groen. De geauthentiseerde browserflow volgt na de code-deployment. De read-only browsercontrole is niet opnieuw uitgevoerd omdat de lokale Playwright-daemon op deze sessie met `EPERM` startte.

De wizard heeft nu een afzonderlijk tabblad voor extra medewerkergegevens, toont partnernaam zodra een partnernaamvariant wordt gekozen, markeert verplichte en optionele velden en heeft op de controlepagina aparte acties voor alleen medewerker aanmaken en medewerker plus dienstverband aanmaken. Na opslaan navigeert de wizard naar de persoonskaart of direct naar het nieuwe dienstverband. De adresdatum wordt niet meer gevraagd; een nieuw adres krijgt onder water `1900-01-01` als `valid_from`.

De migratie `20260807185718_allow_hr_address_creation_before_placement` verruimt de bestaande helper voor HR-beheerders, zodat een adres van een zojuist aangemaakte medewerker ook vóór organisatieplaatsing of dienstverband kan worden opgeslagen. Dit adresseert de gemelde 403. De migratie is remote toegepast; de security-advisor blijft op de bestaande baseline en de officiële `packages/db/types.ts` is opnieuw gegenereerd.

Verificatie na de laatste codewijziging: 132 testbestanden/490 tests, strict TypeScript, volledige ESLint, i18n-pariteit met 28 namespaces, productiebuild met 173 pagina's en `git diff --check` zijn groen. De geauthentiseerde lokale browsercontrole bevestigde de nieuwe partnernaam-, extra-gegevens-, required/optional- en controleacties; daarbij is een stapindexfout gevonden en direct hersteld. Er is geen medewerker opgeslagen, geen commit, push, merge of deployment uitgevoerd.

## Testdatareset verlofopbouw 2026-08-07

Op Supabase-project `wnpfloqpjvaacobppbpk` is de verlof-/urenconfiguratie van tenant **De Sterren holding** gecontroleerd leeggemaakt voor de volgende testfase. Verlofaanvragen, allocations, append-only verloftransacties, saldo-buckets, opbouwregels, uitzonderingen, profielen, verloftypen, werkurentypen, overureninstellingen en gekoppelde testdata zijn verwijderd. Medewerkers, dienstverbanden, contracten, algemene verlofinstellingen en jaarcontroles zijn behouden. De append-only en immutable triggers zijn binnen de transactie tijdelijk uitgeschakeld voor deze expliciet toegestane testreset en daarna gecontroleerd weer ingeschakeld. Controle na afloop: alle tien relevante tenanttabellen staan op 0 rijen.

## Update 2026-08-07: CAO-/bedrijfsregelingentijdlijn

Het instellingenpad **Dienstverbanden en contracten → CAO / arbeidsvoorwaarden** beheert nu regelingen als opvolgende tijdlijnen. `labor_condition_sets` heeft `valid_from` en `predecessor_id`; bestaande vier regelingen zijn gevuld met startdatum en blijven roots zonder opvolger. De migratie `20260807145526_add_labor_condition_timeline` bevat de samengestelde predecessor-FK, index op tijdlijn, unieke opvolgerindex, trigger tegen ongeldige startdatums/cycli en de transactionele `create_labor_condition_successor`-RPC. De UI toont per regeling alle versies, geldigheid tot de dag vóór de volgende startdatum, huidige/historische status en toevoegen/wijzigen.

Verificatie: remote kolommen, trigger, authenticated RPC-execute en negatieve validatietest zijn gecontroleerd; 132 testbestanden/490 tests, i18n-pariteit (28 namespaces), strict TypeScript, volledige ESLint en productiebuild met 173 pagina's zijn groen. Geen commit, push, merge of deployment uitgevoerd.

## Update 2026-08-07: werkuren en overuren

Werkuren en overuren zijn gelijkgetrokken: bestaande namen en kleuren zijn bewerkbaar, naam is verplicht en hoofdletter-/spatieongevoelig uniek binnen de HR-groep, en het oude veld `Werkurentype` is vervangen door vier gedeelde beperkingen: onbeperkt, maximum uren per jaar, maximum uren per maand en maximum uren per week op basis van contracturen maal factor. Beide schermen tonen goedkeuring invoer, manager informeren, actief en selfservice als ja/nee-instellingen. Opslaan staat vóór archiveren; archiveren vraagt een ja/nee-bevestiging.

De instellingenpagina heet `Uren opbouw/schrijven` en de tab `Verlofopbouw`. Remote migratie `20260807151500_work_hour_configuration_controls` is toegepast op project `wnpfloqpjvaacobppbpk`; de nieuwe goedkeuringskolom, de unieke werkurentype-index en nul dubbele genormaliseerde werkurentypen zijn gecontroleerd. Lokale typecheck en i18n-check zijn na deze wijziging groen; lint, tests, build en browsercontrole volgen nog. Geen commit, push, merge of deployment uitgevoerd.

## Update 2026-08-07: fulltime-referentie voor verlof en dienstverband

De standaarduren van de gekozen CAO/bedrijfseigen regeling zijn de officiële fulltime-norm. De remote migrations `20260807141014_use_labor_condition_fulltime_reference` en `20260807162539_add_employment_contract_fulltime_reference` voegen op zowel `employment_contracts` als `employment_schedules` de verplichte snapshot `fulltime_hours_per_week` toe. Bestaande records zijn gevuld vanuit de gekoppelde regeling. De database-trigger houdt de contractsnapshot vast en laat nieuwe roosters de contractsnapshot gebruiken; de factor is `min(average_hours_per_week, fulltime_hours_per_week) / fulltime_hours_per_week`. De factor is begrensd op 1 en `work_scope` is nullable voor oproepkrachten.

De verlofservice, verlofaanvraaglimieten, verlofrapportage en pure leave-engine gebruiken deze begrensde factor. De nieuwe dienstverbandwizard en contract-/roostermutaties tonen de fulltime-norm en berekenen de factor automatisch; de dienstverbanddetailpagina toont de opgeslagen norm. Remote controle: 89 contracten en 88 roosters, geen ontbrekende fulltime-snapshot, geen formulemismatches en geen factoren boven 1. Lokale verificatie: 131 testbestanden/488 tests, strict TypeScript, i18n en productiebuild geslaagd. Supabase security- en performance-advisors tonen alleen de bestaande projectbaseline; er is geen nieuwe migratiespecifieke RLS-waarschuwing. Geen commit, push, merge of deployment uitgevoerd.

## Correctie 2026-08-07: uitzonderingen, samenvatting en verplichte naam

De uitzondering-editor verbergt de vervaltermijn zodra `Geen verlofopbouw` is geselecteerd en slaat dan expliciet `expirationMonths = null` op. De lijst en samenvatting tonen in dat geval geen vervaltermijn. Samenvattingen zijn uitgeschreven als leesbare zinnen; `Werkurentypen` wordt alleen genoemd bij opbouw op basis van werkuren. Een verloftypenaam is verplicht in de UI en wordt server-side en via een unieke, hoofdletterongevoelige HR-groep-index gecontroleerd. De remote migratie `20260807134827_leave_type_name_uniqueness` is toegepast en de controle vond geen dubbele namen.

## Update 2026-08-07: verlofopbouwinrichting

Afgerond in branch `feature/verlofopbouw-inrichting`: de catalogusrij voor een verloftype is volledig klikbaar met handcursor en Enter/spatiebediening; bestaande verloftypen zijn bewerkbaar. De beperking start nu met vijf keuzes: onbeperkt, verlofopbouw, uren per jaar, uren per jaar met deeltijdfactor en beperking door overuren. De oude `Soort verlof`- en profielvelden zijn verwijderd. De opbouweditor gebruikt `Contracturen` of `Werkuren`; de werkurentypen staan direct onder de keuze en specifieke periodes zijn 4-wekelijks, maandelijks of jaarlijks. Opbouwregelkaarten zijn volledig klikbaar en openen directe wijziging; `Opbouwregel toevoegen` neemt de laatste waarden over, heeft annuleren en toont de vervaltermijn als `6 Maanden`.

Remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`: lokale migrations `20260807100345_leave_accrual_enum_options`, `20260807100842_redesign_leave_accrual_configuration`, `20260807103107_apply_leave_fte_cap_to_requests`, `20260807104155_optimize_leave_type_overtime_indexes` en `20260807130219_update_leave_accrual_rule`; de laatste staat remote geregistreerd als `20260807130439_update_leave_accrual_rule`. De nieuwe overuren-koppeltabel heeft RLS/policies/grants/audit; de update-RPC valideert HR-groep, permission, referenties en typecombinaties transactioneel. Testdata is direct gerepareerd: oude weekfactorregels zijn deeltijdfactorregels geworden met `160` uren als testcap; actieve legacy-weekfactorregels zijn `0`. `packages/db/types.ts` is opnieuw gegenereerd.

Verificatie is groen voor i18n, strict typecheck, 130 testbestanden/482 tests, lint en productiebuild. De ingelogde Codex-browser met Test HR Admin bevestigde de klikbare wijzigingskaart, directe bestaande wijziging, kopie van de laatste waarden bij toevoegen, annuleren, zichtbare eenheid `Maanden` en 0 browserfouten of waarschuwingen. Geen commit, push of deployment uitgevoerd. Open blijft de volledige toekomstige opbouwprojectie en overuren-afgeleide engineberekening; die vallen buiten deze inrichting.

## Historische correctie 2026-08-05: productversie volgens documentatie

De zichtbare appversie wordt bepaald door `apps/hr-suite/lib/app-version.ts`, niet door de npm-versie in `package.json`. Volgens de vastgelegde conventie `X.datum.volgnummer` was de vorige productversie `1.20260805.1`. De technische packageversie blijft `0.1.2`; de versiecheck bewaakt de productversie.

## Release 2026-08-06: HR-groepconfiguratie en versie 1.20260806.2

De zichtbare productversie is verhoogd naar `1.20260806.2`. De remote migrations `20260806174202_hr_group_wide_configuration_scope`, `20260806174221_grant_hr_group_permissions_to_hr_admin` en `20260806174857_harden_hr_group_configuration_policies` zijn toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. Branding, feestdagen, eindredenen per land, vrije velden en bedrijfsdocumenten zijn daarmee HR-groepgescopeerd; `administration_id` blijft uitsluitend nullable historische provenance. Demo-namen zijn remote aanwezig via `20260806143509_rename_demo_scope_display_names`.

Remote bewijs: alle tien betrokken tabellen hebben geen lege `hr_group_id`, RLS is actief, de nieuwe holiday-RPC en custom-field securityfuncties bestaan en de groepsbrede unieke sleutels bevatten geen duplicaten. De officiële `packages/db/types.ts` is opnieuw gegenereerd. Advisors zijn security `1 INFO / 19 WARN` (projectbaseline) en performance `348 INFO / 0 WARN`.

Lokale releasegate: 130/130 testbestanden, 481/481 tests, strict TypeScript, lint, i18n-pariteit met 28 namespaces, productiebuild met 173 pagina's en `git diff --check` zijn groen. Geauthentiseerde browsercontrole: HR Admin ziet alleen HR-groep `Planeten`, de administratiekeuze ontbreekt in de sidebar, administratiegebonden contracten tonen `Jupiter BV` met wisselknop, de keuze-pagina toont Mars/Jupiter/Mercurius als kaarten en de accountweergave toont `Versie 1.20260806.2`; console 0 errors/0 warnings. GitHub bevat implementatiecommit `b6c5fc5f6ec9d9df79f465ba3f8cc2e2cfebbf8d`. Vercel Production-deployment `dpl_3LTk81cA8YdtGiRL27VQRWum1ADJ` (`liquidhr-p6m6ngtkm-edwinitsolutions.vercel.app`) staat op `READY` en is exact op die commit gebouwd. De runtimefoutscan en error/fatal-logscan zijn leeg; de publieke alias geeft zonder sessie de verwachte Vercel SSO-redirect.

## Performance-optimalisatie gepubliceerd naar main/Production 2026-08-07: startpagina en medewerkerslijst

Op `main` (commit `f600375b3c5bc24a7d01d852717531be2b8fa8dc`) is de request-keten van `/dashboard/start` en `/employees` geoptimaliseerd. Layout en pagina's hergebruiken één request-scoped autorisatiecontext, actieve context en Supabase-client. Onafhankelijke vertaal-, voorkeur-, directory- en databasereads lopen parallel. De startpagina gebruikt voor de medewerkerstelling twee smalle parallelle reads; de medewerkerslijst deelt de directe teamscope-query met de employee-overview-read. Dit verlaagt dubbele auth/client-setup en waterfall-latency zonder de autorisatiegrenzen te wijzigen.

Er is geen database-DDL toegevoegd: de relevante indexes zijn aanwezig en de live query/advisorcontrole gaf geen aanwijzing dat een nieuwe index voor deze routes de hoofdwinst oplevert. De lokale checks zijn groen: 130 testbestanden/481 tests, strict TypeScript, lint, 28 gelijke NL/EN-namespaces, productiebuild met 173 pagina's en `git diff --check`. De eerdere previews blijven als tussencontrole geregistreerd; de uiteindelijke GitHub-branch is `main`. Vercel Production `dpl_8pp1LgQBtgqJiMNeA1kwtS7VQ17M` is `READY` op `liquidhr-hfmd89rkp-edwinitsolutions.vercel.app`, exact op commit `f600375`.

Authenticated Chrome after-change meting op main/Production, drie runs per route: HR Admin startpagina `1312/1207/922` (mediaan 1207 ms), medewerkerdashboard `1037/994/985` (994 ms) en medewerkerslijst `908/868/762` (868 ms); Manager startpagina `3474/1128/1295` (1295 ms) en medewerkerslijst `995/752/1109` (995 ms); Employee eigen medewerkerdashboard `1068/1048/1067` (1068 ms) en medewerkerslijst `846/984/879` (879 ms). De Employee-rol rendert de startpagina niet als dezelfde route maar landt in de eigen medewerkercontext. Chrome-console: 0 errors/0 warnings; alle routes HTTP 200. Dit is een richtinggevende wall-clockvergelijking met normale cold/warm- en netwerkvariatie.

## Performance implementatie uitgevoerd 2026-08-07: meetlaag, startpagina en medewerkerdashboard

Commit `d7a3727f5acc4fc9d540e191c7d50db83cca47e0` voegt een opt-in server-trace toe via `?perf=1`. De startpagina start de teamscope-read samen met onafhankelijke reads, maakt de actieve-verzuimteller parallel en meet de afzonderlijke bronnen. Het medewerkerdashboard hergebruikt de request-scoped Supabase-client voor de detail/layoutvoorkeuren, leest alleen de drie nieuwste actieve dashboarddocumenten, paralleliseert overzichtsdata en slaat de notitiepermissiecontrole over op alle andere tabbladen. De medewerkerslijst is in deze slice niet functioneel gewijzigd.

Lokale gate: 130 testbestanden/481 tests, strict TypeScript, volledige lint, i18n-pariteit met 28 namespaces, productiebuild met 173 routes en `git diff --check` zijn groen. Supabase is read-only gecontroleerd op project `wnpfloqpjvaacobppbpk`: relevante indexes bestaan en de performance-advisor geeft 347 INFO/0 WARN; er is geen database-DDL, RLS- of typewijziging nodig. De code staat op `main`; de eerdere preview `dpl_7yQdNXbyww1gh2pkHhnVvJnmzqA6` blijft als tussencontrole geregistreerd.

Authenticated Chrome: de actuele main/Production-resultaten staan in de sectie hierboven. De server-traces op deployment `dpl_8pp1LgQBtgqJiMNeA1kwtS7VQ17M` tonen HTTP 200 voor `/dashboard/start` en `/employees/[employeeId]`, met parallelle reads na auth/context. De runtime-errorgroep die tijdens de controle zichtbaar was betreft een oude verlopen refresh-token op `/middleware` van een eerdere previewdeployment, niet deze main-deployment.

## Werkafspraak voor alle Luna-stappen vanaf 2026-08-05

Een Luna-stap is pas afgerond wanneer de volledige verticale slice is uitgevoerd: schema/Supabase (migratie, RLS, grants, audit en gecontroleerde testdata), API, UI, tests, documentatie en de relevante lokale, remote en geauthenticeerde browserverificatie. Open onderdelen of blokkades worden expliciet gemeld en blokkeren de status **afgerond**. Ga pas door naar de volgende stap nadat de huidige stap per alle eigen specs is beoordeeld.

## Demo-scope namen bijgewerkt 2026-08-06

De zichtbare namen van de synthetische `liquid-hr-demo-holding`-testdata zijn remote aangepast via migration `20260806143509_rename_demo_scope_display_names`. De klant heet **De Sterren holding**; HR-groep `DEFAULT` heet **Planeten** en bevat **Mars BV**, **Jupiter BV** en **Mercurius BV**. HR-groep `TEST-BOUNDARY` heet **TEST (leeg)** en bevat **Test BV** zonder medewerkers. De bestaande `TEST-MULTIGROUP`-groep bevat **DGA administratie** met één medewerker. Technische codes, ids, relaties, medewerkers en autorisaties zijn niet gewijzigd.

## Administratiekeuze voor HR-admininstellingen 2026-08-06

De administratie-dropdown is uit de HR-suite-sidebar verwijderd. De sidebar toont voor HR-admins nu alleen de HR-groepcontext; de administratie blijft wel server-side als actieve cookie/context beschikbaar voor schermen die die scope nodig hebben. De eerder bestaande administratie-switch API blijft de gecontroleerde cookie-wissel uitvoeren.

Voor administratiegebonden inrichting is `/settings/administration` toegevoegd. De route toont alle toegankelijke administraties binnen de actieve HR-groep als duidelijke kaartknoppen, markeert de laatst gekozen administratie en keert na keuze terug naar het oorspronkelijke scherm. Op het instellingen-scherm staat dezelfde vaste contextbalk met administratie, code/nummer, HR-groep en knop **Administratie wijzigen**. De route valideert de administratie tegen de servercontext en accepteert alleen interne instellingenbestemmingen als terugkeerpad.

De keuze-flow is aangesloten op: dienstverband-/contractcatalogi, medewerkerdirectory, eigen verzuimtaaktemplates, salarisstructuren en administratiegebonden stamdata (documentcategorieën). `/master-data` is gemengd en gebruikt daarom dezelfde keuze voor documentcategorieën; HR-groep-/tenantbrede schermen zoals bedrijf/locaties, afdelingen, functies, verlofcatalogus, algemene verzuiminstellingen, feestdagen, bedrijfsbranding, eindredenen, vrije velden, bedrijfsdocumenten, modules en jubileumregels krijgen geen administratiekeuze. De misleidende administratiekaart bij Afdelingen is verwijderd.

Verificatie: i18n-pariteit (28 namespaces), strict TypeScript, gerichte ESLint en nieuwe selectie-helpertests zijn groen. De volledige Vitest-run heeft 129 geslaagde testbestanden/480 geslaagde tests; één bestaande `lib/app-version.test.ts` faalt omdat de test `1.20260805.1` verwacht terwijl de bron al `1.20260806.1` bevat. Browsercontrole op poort 3000 bevestigde geen administratie-dropdown in de sidebar, keuze vóór `/settings/holidays`, zichtbare kaarten voor Jupiter/Mars/Mercurius, herinnering van Mars als laatst gekozen en wisselen naar Jupiter met zichtbare contextbalk. Geen schemawijziging, commit, push, merge of deployment voor deze UI-slice.

## Scopecorrectie groepsbrede HR-admininstellingen 2026-08-06

Bedrijfsinstellingen met kleuren/logo, feestdagen, eindredenen per land, vrije velden en bedrijfsdocumenten zijn gecorrigeerd naar HR-groep-eigendom. De lokale migration `20260806160000_hr_group_wide_configuration_scope.sql` backfillt `hr_group_id`, dedupliceert bestaande synthetische records binnen een groep, vervangt de administratiegebonden foreign keys/unieke sleutels en policies, en laat `administration_id` alleen als nullable historische provenance staan. `20260806161000_grant_hr_group_permissions_to_hr_admin.sql` vult de noodzakelijke HR-adminrechten aan.

De services, routes en dedicated UI-schermen gebruiken nu de actieve HR-groep en tonen daar geen administratiekeuze meer. De branding- en bedrijfsdocumentopslag gebruikt voor nieuwe bestanden een groepspad; bestaande paden blijven via het gekoppelde groepsrecord leesbaar. De gecombineerde Stamdata-overview blijft bewust administratiegekozen voor documentcategorieën; de aparte eindredenenpagina is groepsbreed.

Lokaal gecontroleerd: strict TypeScript, lint, i18n, tests en productiebuild zijn groen. De nieuwe migrations zijn remote toegepast, officiële DB-types zijn opnieuw gegenereerd, Supabase-advisors zijn uitgevoerd en de geauthentiseerde browsercontrole na de schemawijziging is geslaagd. De policy-hardening is aanvullend remote toegepast; security blijft op de bestaande projectbaseline en performance heeft geen waarschuwingen.

## Step-9-verificatie afgerond 2026-08-06

Step 9 is **afgerond**. De gecontroleerde fixturemigration `20260806101419_hr_group_step9_manager_multiple_employment_fixture.sql` staat één keer remote toegepast als `20260806130420_hr_group_step9_manager_multiple_employment_fixture`. De minimaal gescopeerde RLS-correctie staat lokaal in `20260806133314_hr_group_absence_employment_read_scope.sql` en `20260806133600_consolidate_employments_absence_read_policy.sql`; remote zijn deze geregistreerd als `20260806133414_hr_group_absence_employment_read_scope` en `20260806133633_consolidate_employments_absence_read_policy`.

De policy voegt geen brede `contract:read` toe. Zij laat een manager met `absence:write` uitsluitend bevestigde, niet-verwijderde employments lezen voor een medewerker die server-side binnen de managerrelatie valt. De dubbele permissieve policy-waarschuwing van de eerste correctie is met de tweede migratie geconsolideerd.

Remote bewijs: Omar (`DEMO-037`) heeft exact twee bevestigde actieve employments (`EMP-DEMO-037-A` en `RICH-TEST-0037`), exact twee actuele plaatsingen onder Yara (`DEMO-028`) en 0 absence-cases/0 absence-spells. De Step-8-contractproef is transactioneel groen; de finale remote policy-/invariantcontrole is groen. DB-types zijn opnieuw gegenereerd; advisors tonen de bestaande projectbrede baseline: security 1 INFO/19 WARN en performance 342 INFO/0 WARN.

De herhaalde lokale gate is groen: 129 testbestanden/478 tests, strict TypeScript, lint, i18n met 28 gelijke NL/EN-namespaces, productiebuild met 171 routes en `git diff --check`. Authenticated browserbewijs op poort 3000: HR Admin ziet Omar tweemaal; Test Manager ziet Omar in het eigen team, opent `/absence/new?employeeId=237affe2-7f4c-3c7f-b9bf-a37b2365eb6d`, ziet beide employmentopties, selecteert expliciet `RICH-TEST-0037` en slaat niets op. De finale browserconsole eindigt op 0 errors/0 warnings.

De Luna-controle bevestigt hiermee dat stap 1 t/m 9 volgens de werkafspraak zijn doorlopen. Alleen latere deactivatie-, verwijder-, merge- en splitfunctionaliteit blijft buiten deze slice. Geen commit, push, merge of deployment uitgevoerd.

## Domeinbaseline 2026-08-05: HR-groepen, verlof en parallel verzuim

De komende grote slice gebruikt [HR-groepen: scope, inrichting en domeingrenzen](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md) als actuele bron. De bijbehorende besluiten staan in [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md) en [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md); het uitvoeringsplan voor Luna staat in [LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md](LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md).

Vastgelegd:

- HR-groep is de primaire switch en harde zichtbaarheidgrens binnen een holding/tenant.
- Een HR-admin switcht expliciet tussen HR-groepen; binnen de gekozen groep is administratiecontext optioneel.
- Edwin maakt HR-groepen aan via de Control Plane. Een HR-admin kan vanuit een geselecteerde HR-groep administraties aanmaken.
- Een bestaande administratie kan nooit naar een andere HR-groep worden verplaatst. Naam en nummer van een administratie zijn beheerbaar; het interne ID blijft stabiel.
- Bedrijf, locaties, afdelingen, functies, rollen, verlofregels en verzuiminstellingen zijn HR-groepbreed.
- Een persoon bestaat één keer binnen een HR-groep en kan nul of meerdere dienstverbanden hebben. Hetzelfde natuurlijke persoon kan in meerdere HR-groepen voorkomen met groepsspecifieke gegevens en eventueel zakelijke e-mailadressen.
- Salaris, payroll, CAO, verlofsaldo en verzuimcasus blijven dienstverband-/administratiegebonden.
- Een CAO is vast op een dienstverband. Overstappen betekent oud dienstverband afsluiten en nieuw dienstverband aanmaken.
- Verzuim is altijd per dienstverband. Overlap tussen verschillende dienstverbanden of HR-groepen is toegestaan; alleen overlap binnen hetzelfde dienstverband wordt geblokkeerd.
- Bij meerdere actieve dienstverbanden kiest de gebruiker eerst het dienstverband, tenzij de afdeling/functiecontext van de leidinggevende exact één geldig dienstverband bepaalt. Dit geldt voor verlof en verzuim.

Documentatie, schema, context/API/UI en de gecontroleerde remote testdata zijn in deze beurt aangepast; bestaande dirty wijzigingen van Edwin blijven onaangeroerd. De remote wijzigingen staan uitsluitend op het gekoppelde Supabase-testproject.

### Testdatabesluit

De huidige database bevat uitsluitend synthetische testdata. Voor de komende HR-groep-slice mag bestaande testdata worden aangepast, opnieuw gekoppeld, vervangen of opnieuw geseed. Zij mag geen belemmering vormen voor het nieuwe model. Er wordt geen fallback, dual-read, dual-write of compatibiliteitslaag voor het oude tenant-/administratiemodel gebouwd. Oude scopekolommen, filters, RPC-parameters en constraints mogen in een gecontroleerde, reproduceerbare testmigratie worden vervangen of verwijderd.

## Stap 3–5 uitgevoerd 2026-08-05: HR-groep-schema, context en bedrijf/locaties

De lokale migration `apps/hr-suite/supabase/migrations/20260805144951_hr_group_schema_and_test_data.sql` legt de eerste databasefundering vast: `hr_groups`, administratie- en domeinkoppelingen, groepsgebonden personen/catalogi/configuratie, employment-scoped verlof-, CAO- en verzuimrecords, composite foreign keys, immutable bestaande administratie-/groepskoppelingen, maximaal drie actieve CAO-sets per administratie, een vaste CAO per dienstverband, groepsgerichte toegang en restrictive HR-groep-policies bovenop de bestaande RLS-policies. De twee bestaande synthetische tenants krijgen ieder idempotent één `DEFAULT`-groep; er zijn geen extra productieachtige groepen of personen verzonnen.

De negatieve en structurele contractproef staat in `apps/hr-suite/supabase/tests/hr_group_schema.sql`. Die controleert onder meer RLS, volledige backfill, dezelfde groep voor administratie/dienstverband/verzuim, composite foreign keys, privileges, restrictive policies en de weigering van een cross-group verplaatsing van een bestaande administratie.

Verificatie: de remote migrations voor stap 3, 4 en 5 zijn toegepast, de officiële `packages/db/types.ts` is opnieuw gegenereerd, structurele en transactionele RLS-controles zijn geslaagd en de advisors zijn na de DDL opnieuw uitgevoerd. De lokale pgTAP-runner kan niet starten zolang Docker Desktop Linux Engine niet actief is; de equivalente remote contract- en transactietests zijn wel uitgevoerd. `TEST-BOUNDARY` is een idempotente grensfixture met één bedrijf, één administratie, één locatie en nul medewerkers.

## Stap 8 uitgevoerd 2026-08-06: verzuim per HR-groep en employment

De lokale migration `apps/hr-suite/supabase/migrations/20260806120000_hr_group_absence_per_employment.sql` is rechtstreeks op het gekoppelde Supabase-testproject toegepast onder de naam `hr_group_absence_per_employment`, omdat de lokale Supabase CLI op Windows door een EPERM/npm-cacheblokkade niet kon worden gestart. De migration maakt `absence_settings` uniek per `tenant_id, hr_group_id`, maakt casussen en ziekteperioden verplicht employmentgebonden, backfillt `absence_spells.employment_id`, legt composite casus/spell/capacity-FK's vast en blokkeert overlap alleen binnen dezelfde tenant, HR-groep en employment. De oude administratiegebonden settings policies en report/recovery-RPC's zijn vervangen door groepsgescopeerde varianten; `change_absence_capacity` is toegevoegd.

De report-, recovery- en capacity-services gebruiken de actieve HR-groep, server-side permissionchecks, veilige typed fouten en de gedeelde employment resolver. Exact één geldige employment wordt automatisch gekozen; exact één manager-match ook; nul of meerdere matches leveren een expliciete keuze op. `/absence/new`, het medewerkerdashboard en het verzuimdetail ondersteunen ziekmelding, gedeeltelijk herstel, volledig herstel en zoekbare employmentkeuze. De HR-groep-switcher ververst na een wissel de server-layout, zodat selector en inhoud dezelfde groep tonen. Nieuwe NL/EN-sleutels staan in de employees-namespace.

Remote controle: officiële `packages/db/types.ts` is opnieuw gegenereerd; advisors na de DDL tonen alleen de bestaande projectbrede/inherente baseline; de runner-onafhankelijke `apps/hr-suite/supabase/tests/hr_group_absence_step8_contract.sql` is transactioneel groen. De test controleert de vijf absence-tabellen met RLS/policies, groepssettings, employment-FK's, overlapconstraint, capacity-FK, grants/RPC-signatures, geen medische kolommen, parallelle employments/groepen, 50% capacity en herstelisolatie. De typed resolver-regressietest is 3/3 groen.

Lokale eindgate na deze slice: 129 testbestanden/478 tests, strict TypeScript, volledige lint, i18n-pariteit met 28 namespaces, productiebuild met 171 pagina's en `git diff --check` zijn groen. Op `http://localhost:3000` bevestigde de geauthentiseerde browser HR Admin groep A/B-inhoudswissel, twee zichtbare employments met expliciete keuze, volledig herstel op het synthetische Fin-dossier, partial capacity HTTP 200 op het synthetische Noah-dossier, manager één-match en medewerker-self-service op 390x844 met URL-state en 0 console-errors. De Step-9-fixture bevat nu een teamlid met meerdere geldige employments; die browservariant is in Stap 9 geauthentiseerd uitgevoerd. De twee herstelacties hebben uitsluitend bestaande synthetische testdossiers gebruikt.

**Status:** Stap 8 is functioneel uitgevoerd; de integrale Definition of Done en het toevoegen/herhalen van een browserfixture voor manager-meerdere-matches horen bij Stap 9. Geen commit, push, merge of deployment uitgevoerd.

## Stap 4 uitgevoerd 2026-08-05: context, autorisatie en Control Plane

De primaire HR-groepcontext staat lokaal in `apps/hr-suite/lib/context/administration-context.ts` en `apps/hr-suite/lib/context/server-context.ts`. De server leest toegestane groepsrelaties, valideert tenant → HR-groep → administratie en gebruikt de actieve groepsrelatie voor `AuthContext`, rollen en managementscope. De administratiecookie wordt bij een groepswissel gewist en een administratie uit een andere groep wordt niet geaccepteerd.

De HR-suite bevat lokaal de HR-groep-switcher, `/api/context/hr-group`, `/settings/hr-groups`, `/api/hr-groups` en de lijst-eerst groepsbeheer-UI. HR-admins kunnen binnen de actieve groep een administratie toevoegen en groepsnaam/omschrijving wijzigen. Bestaande administratie-groepkoppelingen zijn database-side immutable en HR-groepverwijdering is geblokkeerd. De aparte `apps/liquidhr-control` toont groepen per tenant en maakt groepen aan via de platformoperator-RPC.

Lokale verificatie: HR-suite 128 testbestanden/474 tests, strict typecheck, volledige lint, i18n-check en productiebuild geslaagd; Control Plane strict typecheck, volledige lint, i18n-check en productiebuild geslaagd. Remote verificatie bevestigde tenant → groep → administratie-scope, RLS, permissions, stabiele administratie-identiteit en de negatieve groep-A/B-controle. De geauthenticeerde browsercontrole bevestigde de primaire HR-groepswitch en de groepsbeheerflow.

Stap 4 is voor de eigen specs 100% vastgesteld. De volgende afgeronde slice is Stap 5 — bedrijf, administraties en locaties.

## Stap 5 uitgevoerd 2026-08-05: bedrijf, administraties en locaties

De tabellen `administration_company_data` en `administration_locations` zijn groepsbreed gemaakt met `hr_group_id`; de legacy administratie-eigenaarskolom is verwijderd. Bedrijven en locaties worden in de service/API/UI uitsluitend via de actieve HR-groep beheerd en de pagina `/settings/company-data` vraagt geen administratiekeuze. `employee_organizations` gebruikt een composite locatie-FK met tenant en HR-groep, en de locatie-RPC weigert een locatie uit een andere groep.

Administratienaam en `administration_number` zijn HR-admin-beheerbaar, auditbaar en wijzigen het stabiele interne ID niet. De remote `TEST-BOUNDARY`-fixture bevat één bedrijf, `TEST-BOUNDARY-ADMIN`, `Testgroep B locatie` en nul medewerkers. De gecontroleerde nummerwijziging en browserflow zijn na verificatie teruggezet naar `TEST-BOUNDARY-001`; het interne ID bleef `0ad929be-8dbf-4b8f-884e-46852f182512`.

Remote resultaat: standaardgroep 1 bedrijf/4 locaties zichtbaar, boundary-groep 0 bedrijf/0 locaties zichtbaar onder de tijdelijk beperkte fixturetoegang; anon heeft geen directe leesrechten. De cross-group locatie-RPC is transactioneel geweigerd. Lokale tests, i18n, strict typecheck, lint, productiebuild en Control-Plane-build zijn groen. Supabase-advisors tonen geen nieuwe security- of HR-groep-FK-waarschuwing; bestaande projectbrede baseline-meldingen zijn apart geregistreerd.

Stap 5 is voor alle eigen specs 100% vastgesteld. Stap 6 is daarna volledig uitgevoerd en per alle eigen specs gecontroleerd.

## Stap 6 uitgevoerd 2026-08-05: personen, dienstverbanden, organisatie en rollen

De Step-6-migrations `20260805200000_hr_group_people_organization_roles.sql`, `20260805203000_hr_group_people_rpc_alignment.sql`, `20260805203100_hr_group_complete_employment.sql` en `20260805203200_hr_group_step6_cross_admin_fixture.sql` maken personen, afdelingen, functies, roltoewijzingen en organisatieplaatsingen HR-groepgebonden. Employments blijven administratiegebonden maar dragen dezelfde `hr_group_id`; `DEMO-028` heeft twee actieve employments over `OPERATIONS` en `SERVICES`. Oude administratie-/tenantpolicies op deze domeintabellen zijn vervangen door groepspolicies met composite foreign keys, scopeguards, grants en audit.

De bijgewerkte services en UI gebruiken één groepscontext voor medewerkers, employmentoverzichten, organisatie, managementrollen, functies, organogram en startpagina. `list_employee_overviews` is group-aware. De employee-directorypagina weigert nu expliciet een medewerker zonder geldige administratiecontext met `/geen-toegang`, zodat een groep zonder eigen employment geen runtime-500 veroorzaakt; de geldige medewerkercontext blijft beschikbaar.

Remote gecontroleerd: `hr_group_people_organization_roles.sql`, `employee_overview.sql`, `employee_document_dossiers.sql`, `employment_complete_flow.sql` en `hr_group_step6_contract.sql` zijn geslaagd. De fixtures zijn `TEST-BOUNDARY` (0 personen), `TEST-MULTIGROUP` (1 groepspersoon), dezelfde managerlogin in twee groepen, `DEMO-028` met twee employments en minimaal twee managers over twee administraties in `RICH-02`. De officiële `packages/db/types.ts` is opnieuw gegenereerd.

Browserbewijs op localhost:3000: HR Admin zag `DEFAULT` met 58, `TEST-MULTIGROUP` met 1 en `TEST-BOUNDARY` met 0 medewerkers; organogram en roltoewijzingen wisselden mee met de groep. Manager zag 5 teammedewerkers in `DEFAULT` en geen medewerkers in `TEST-MULTIGROUP` zonder eigen teammatch. De employee-fixture is in een geldige administratiecontext gecontroleerd; zonder eigen administratiecontext volgt een normale server-side toegangweigering.

Lokale eindgate na Step 7: 128 testbestanden/475 tests, strict typecheck, volledige lint, i18n (28 namespaces), productiebuild (170 pagina's) en `git diff --check` zijn groen. Advisors na Step-7-DDL: security 1 INFO/19 WARN en performance 340 INFO/0 WARN; projectbrede/inherente meldingen zijn apart gehouden van Step-7-RLS. Remote is pgtap versioneerbaar geïnstalleerd; de drie relevante pgTAP-contracttests zijn rechtstreeks groen met 37/37, 23/23 en 35/35 assertions. De runner-onafhankelijke Step-6/7-contracttests en functionele remote tests zijn eveneens groen.

**Status:** Step 6 t/m Step 9 zijn voor alle eigen specs 100% vastgesteld. De integrale eindverificatie en handoff zijn afgerond. Geen commit, push, merge of deployment uitgevoerd.

## Step 7 uitgevoerd 2026-08-05: verlof per HR-groep en employment

De Step-7-migrations `20260805210000_hr_group_leave_scope.sql` t/m `20260805210800_hr_group_anon_privilege_hardening.sql` zijn lokaal aanwezig en remote toegepast. De groepscatalogi voor verloftypen, profielen, opbouwregels, bonusregels, voorrang, jaarsturing, employee sets en overwerk zijn HR-groepgebonden. Profielkeuzes, uitzonderingen, buckets, transacties, rollovers, allocaties en aanvragen blijven employmentgebonden; een persoonsbreed saldo bestaat niet.

De resolver volgt `employment exception -> employee set -> HR-group default`. API en service valideren tenant, groep, medewerker, employment, datums en dubbele keuzes server-side. De group-RPC's voor opbouwregel, bonusregel, opening balance, handmatige correctie, jaarafsluiting en aanvraag zijn permission-checked, atomair en waar nodig idempotent. Oude administration-RPC's zijn niet meer uitvoerbaar voor `authenticated`. `packages/db/types.ts` is officieel opnieuw gegenereerd.

De fixture bevat in `TEST-MULTIGROUP` `Stap 7 testverlof`, groepsstandaard 1.5 uur, employee-setprofiel 2.5 uur en één setlid. `TEST-BOUNDARY` heeft geen Step-7-catalogusrecords; `DEMO-028` heeft twee 2026-employment-buckets. Remote RLS gaf multigroup 1 verloftype/1 set, boundary 0, twee DEMO-028-balances en resolverbron `EMPLOYEE_SET`. De drie pgTAP-contracttests, Step-6-contracttests en relevante leave/overtime/employmenttests zijn groen.

Browserbewijs op localhost:3000: HR Admin zag de multigroup-catalogus, employee set, het setlid en beide profielversies; de uitzonderingsmodal toonde beide DEMO-028-employments en accepteerde een expliciete selectie zonder opslaan. Manager werd buiten HR-verlofbeheer naar de startpagina gestuurd; medewerker kreeg de verwachte `Nog geen toegang`. De cross-group grens is rechtstreeks met remote RLS en contracttests vastgesteld.

## Overdracht naar de volgende Luna-thread 2026-08-06

De volledige handoff staat in [LUNA_NEXT_THREAD_INSTRUCTIE_2026-08-06.md](LUNA_NEXT_THREAD_INSTRUCTIE_2026-08-06.md). Stap 6 en 7 zijn end-to-end uitgevoerd en per alle eigen specs 100% vastgesteld. Stap 8 is op 2026-08-06 functioneel uitgevoerd: verzuiminstellingen per HR-groep, verzuimcasus en ziekteperiode per employment, parallel verzuim over employments/groepen toegestaan en overlap alleen binnen hetzelfde employment blokkeren. De volgende thread gaat verder met Stap 9; de manager-multiple-match browserfixture blijft daar een expliciet open punt.

Lees vóór uitvoering de handoff, het Luna-plan, ADR-0009, FDR-0006, `VERZUIM_EN_HERSTEL.md` en `VERZUIM_INSTELLINGEN.md`. Houd de volledige verticale volgorde aan: schema/Supabase/RLS/grants/audit/testdata → API/service → UI/i18n → lokale en remote tests → geauthentiseerde browserflows → documentatie. Open punten, Docker-beperkingen, advisor-baseline en de dirty worktree staan in de handoff. Geen commit, push, merge of deployment zonder expliciete opdracht.

## Bugfix 2026-08-05: roltoewijzingen tonen alleen afdelingen uit actieve administratie

De afdelingskeuzes op `/role-assignments` waren tenantbreed, terwijl `department_management` per administratie wordt gelezen en opgeslagen. De service scoped de keuzelijst nu tot actieve afdelingen uit organisatieplaatsingen en bestaande roltoewijzingen binnen de actieve administratie. Daardoor verdwijnen afdelingen uit andere administraties uit de formulieren en blijft een bestaande historische/lege roltoewijzing zichtbaar in de juiste administratie.

Verificatie: 2 gerichte scope-tests plus de bestaande manager-resolvertests (7 tests), strict TypeScript en ESLint geslaagd. Een read-only query op de testtenant bevestigde dat de afdelingssets per administratie verschillen. Geen schemawijziging of remote datamutatie.

## Bugfix 2026-08-05: company-data PATCH payload

De bedrijfsgegevenspagina stuurde bij opslaan het volledige leesmodel mee, inclusief `id`. De strikte PATCH-validator accepteert alleen de wijzigbare bedrijfs- en adresvelden en gaf daardoor HTTP 400. De client maakt nu een expliciete updatepayload zonder `id`; een regressietest controleert dat deze payload door dezelfde schema-validator wordt geaccepteerd.

Verificatie: gerichte company-data-tests (4 tests), strict TypeScript, gerichte ESLint en `git diff --check` zijn geslaagd. Een directe schema-reproductie accepteert de nieuwe payload zonder `id`.

## Test Medewerker in Yara-team 2026-08-04

Remote toegepast via migration `20260804193021_move_test_employee_to_yara_team`. De bestaande fixture-account **Test Medewerker** is Noah Hendriks (`DEMO-035`). Zijn actuele organisatieplaatsing staat nu in `RICH-02` / **Test Operations**, met functie **Operations specialist** en Yara (`DEMO-028`) als directe leidinggevende. De medewerker valt daarmee binnen Yara's directe teamscope; Yara's team telt nu vijf medewerkers inclusief Noah.

## Testdata en statuslabels 2026-08-04: Yara-team voor rolcontrole

Remote toegepast via migration `20260804191903_manager_assignment_status_and_yara_team`. De eerdere brede synthetische directe-managerkoppelingen naar Yara (`DEMO-028`) zijn verwijderd. Yara staat nu in `RICH-02` / **Test Operations**, haar actieve `DIRECT_MANAGER`-toewijzing wijst naar dezelfde afdeling en haar actuele directe team bestaat uit `DEMO-032` Maya Bos, `DEMO-037` Omar Kaya, `DEMO-042` Sophie De Vries en `DEMO-047` Milan Visser.

De kolom **Controle nodig** is vervangen door **Type**. Voor een actuele afdelingstoewijzing van de systeemrol `DIRECT_MANAGER` toont de UI `LG-Afd` wanneer de leidinggevende zelf in dezelfde afdeling zit en `LG-Afd-Plus` wanneer de toegewezen afdeling afwijkt. Andere rollen of ontbrekende actuele plaatsingen tonen een liggend streepje. Daarmee hoort Yara nu `LG-Afd` te tonen.

## Bugfix 2026-08-04: roltoewijzingen volgen actieve administratie

De pagina Roltoewijzingen bood eerder alle tenant-medewerkers aan, ook wanneer zij geen actueel primair dienstverband in de actieve administratie hadden. Daardoor kon bijvoorbeeld Yara (`DEMO-028`, actief in Operations) vanuit de Holding worden geselecteerd en eindigde opslaan alleen met een generieke foutmelding. De lijst filtert medewerkers nu op een actueel bevestigd primair dienstverband in de actieve administratie; de server controleert dezelfde scope vóór insert. Gebruikers zonder `management-assignment:write` zien een duidelijke read-only melding en kunnen geen opslag starten.

Verificatie: strict TypeScript, i18n-pariteit en gerichte ESLint zijn geslaagd. Er is geen schemawijziging of remote datamutatie uitgevoerd.

## Nieuwe datafixture 2026-08-04: rijke synthetische medewerkerdataset

Remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk` via migration `20260804180940_seed_rich_employee_dataset`. De fixture is idempotent en gebruikt uitsluitend bestaande testrecords; auth-koppelingen en bestaande e-mailadressen zijn behouden. Er zijn geen echte personen, BSN's, IBAN's, foto's of storage-bytes gebruikt: bankvelden bevatten herkenbare fixture-ciphertext/laatste vier cijfers en avatars zijn ingebedde synthetische SVG-data.

De 72 medewerkers hebben nu telefoons, ingebedde avatars of bestaande avatars, primaire en secundaire adressen, primaire testbankrekening, partnerrelatie en waar van toepassing een kindrelatie. De 68 actieve medewerkers hebben allemaal een actueel bevestigd primair dienstverband, salaris, rooster en organisatieplaatsing met afdeling, functie, locatie en waar mogelijk een testmanager. Aanvullend zijn tenant-functiegroepen/functies, afdelingen, administratie-locaties, kostenplaatsen/kostendragers, 15 gesloten verzuimcasussen, 36 notities en 23 activiteiten toegevoegd. De bestaande testdata is niet opgeschoond of verwijderd.

Remote controle: alle genoemde actieve records missen geen dienstverband, salaris, rooster, organisatie, primair adres, primaire bankrekening of relatie. De transactionele dry-run vóór uitvoering was groen. Database-types zijn opnieuw opgevraagd; deze fixture wijzigde geen typecontract. Advisors na uitvoering: security 2 INFO en 15 WARN (bestaande authenticated SECURITY DEFINER/RLS-meldingen), performance 255 INFO en 0 WARN (bestaande index/FK-meldingen). Een echte productiebenchmark moet nog apart worden uitgevoerd; deze datafixture maakt de dataset daarvoor representatiever.

De migration herstelt ook de bestaande locatie-guardfunctie zodat een insert in `administration_locations` niet langer een kolom van een andere tabel probeert te lezen. Dit was nodig om de synthetische locaties veilig te vullen; er is geen gebruikersdata verwijderd.

## Nieuwe hardening 2026-08-04: Supabase security en performance

Remote toegepast: `consolidate_star_performer_select_policies` en `harden_security_definer_search_paths`. De drie dubbele permissieve SELECT-policy-waarschuwingen zijn verdwenen door de bestaande `FOR ALL`-writepolicies op `star_performer_assessment_tags`, `star_performer_assessments` en `star_performer_tags` op te splitsen in INSERT/UPDATE/DELETE; de bestaande read- en write-expressies zijn behouden. Voor de relevante `SECURITY DEFINER`-RPC's is `pg_temp` uit `search_path` verwijderd om tijdelijke-object-shadowing te voorkomen. Authenticated execute, tenantchecks, permissionchecks en RPC-signatures zijn niet aangepast.

Live advisors na de migraties: performance 258 INFO en 0 WARN; security 2 INFO en 15 WARN. De security-WARNs zijn de bewust via `authenticated` aangeroepen permission-checked RPC's. `absence_mutations` en `platform_support_sessions` blijven bewust RLS-only zonder directe policy. Leaked-password protection blijft een handmatige Supabase Auth-instelling. Gegenereerde database-types zijn opnieuw opgehaald; de wijzigingen veranderden geen tabel- of RPC-signature en daarom was er geen types-diff. Tests (480), strict typecheck, lint en productiebuild zijn geslaagd.

## Nieuwe slice 2026-08-04: fotoweergave medewerkerslijst

Aanvulling: naast de bestaande fotoformaten ondersteunt de lijst nu ook **Foto collage**: een strak vierkant raster met foto’s of initialen zonder namen.

De medewerkerslijst heeft naast Detail, Compact en Kaarten nu vier fotovarianten: **Foto's groot**, **Foto's standaard**, **Foto's klein** en **Alleen foto (vierkant)**. De eerste drie tonen alleen de foto of initialen en de voornaam; de vierkante variant toont alleen de foto/initialen met een dunne rand en zonder naam. Er verschijnen geen status, functie, afdeling, e-mail, personeelsnummer of actie-tekst. De responsive grid gebruikt per variant een passende minimumtegel; de standaardvariant kan op de gecontroleerde desktopbreedte acht kolommen vullen. Als een avatarroute voor de huidige rol niet toegankelijk is, valt de tegel veilig terug op initialen zonder de autorisatie te verruimen. De bestaande rolbewuste overlay blijft actief voor volledige profielroutes en collega-popups.

Er is geen Supabase-schemawijziging nodig: `photo` is toegevoegd aan de bestaande gevalideerde `employeesList`-voorkeur. Tests, strict typecheck, gerichte ESLint en i18n-controle volgen na de browsercontrole.

## Nieuwe slice 2026-08-04: kaartweergave medewerkerslijst

De medewerkerslijst ondersteunt nu **Detail**, **Compact** en **Kaarten**. De keuze staat in het bestaande filterpaneel en wordt via `/api/preferences/employees` opgeslagen in `user_preferences.ui_state.employeesList`; er is geen schemawijziging nodig. De kaartweergave is responsive met `auto-fit`, toont alleen velden die volgens de bestaande rol- en HR-directoryinstellingen zijn toegestaan en gebruikt voor medewerkerscollega's dezelfde popup als de lijstweergave. Daardoor verschijnen personeelsnummers niet in employee-directorykaarten, terwijl directe teamleden en bevoegde HR-weergaven hun bestaande profielroute behouden.

Verificatie: employee-list-state-tests (9/9), strict typecheck, gerichte ESLint, i18n-pariteit, Supabase SQL-controle (`saved_card_preferences = 1`) en authenticated browsercontrole op poort 3000. De browser toonde 20 medewerkerkaarten zonder personeelsnummer, met 19 veilige collega-popups en uitsluitend de eigen profiel-link; de Lina-popup bevatte functie, afdeling, zakelijk e-mailadres, telefoon, weekaanwezigheid zonder reden en rooster. De interne browser staat op de medewerkerkaartlijst klaar voor handoff.

## Nieuwe slice 2026-08-04: managerbeschikbaarheid op de startpagina

Managers zien op de startpagina als eerste brede venster **Beschikbaarheid team**. Het venster toont vandaag tot en met zes dagen vooruit, met teamleden verticaal en dagen horizontaal. De weergave kan wisselen tussen **Aanwezig** (beschikbaar, niet ingepland, verlof of verzuim) en **Uren aanwezig** (geplande uren; verlof en verzuim tonen nul). De data wordt server-side beperkt tot de directe managerstam en gebruikt bestaande werkpatronen met legacy-roosterfallback, goedgekeurde verlofaanvragen en actieve verzuimspells. Niet-managers krijgen geen teamdata. Er is geen schemawijziging of remote write uitgevoerd.

De widget staat als nieuw breed venster vooraan in de bestaande persoonlijke startpaginalayout; een opgeslagen layout krijgt dit nieuwe venster eenmalig vooraan en kan daarna in Full met de bestaande drag-and-drop/pijlen worden verplaatst. i18n-pariteit, strict typecheck, ESLint, de nieuwe layouttests en `git diff --check` zijn lokaal geslaagd. Authenticated browsercontrole op poort 3000 bevestigde de managerkop, de 7 dagen, de links naar teamleden, de aanwezigheidstekens, de urenweergave en de brede linkerkolom. Dezelfde controle bevestigde dat HR Admin geen teamwidget krijgt.

## Nieuwe controle 2026-08-04: medewerkersdirectory alleen actieve medewerkers

Voor `employee-directory:read` forceert de server `archive=active` en filtert de geladen overviewdataset na statusbepaling op `ACTIVE_EMPLOYEE`. De medewerkerpagina biedt alleen de arbeidsstatus **Actief** en archiefstatus **Niet-gearchiveerd**; URL- of opgeslagen voorkeuren voor toekomstige, uit-dienst-, externe of gearchiveerde records kunnen de directoryscope niet uitbreiden. Managers gebruiken de bestaande volledige status- en archiefopties.

Browsercontrole op poort 3000: `Test Medewerker` zag alleen de actieve directoryweergave en miste de filters Toekomstig, Uit dienst, Externe persoon, Gearchiveerd en Alle medewerkers. `Test Manager` op `scope=all` behield de filters Toekomstig, Uit dienst, Externe persoon, Gearchiveerd en Alle medewerkers. Remote SQL telde in de huidige tenant 0 toekomstige en 0 gearchiveerde records; daarom is de managerbehoudcontrole via filters en serverlogica bevestigd. Typecheck, gerichte ESLint en `git diff --check` zijn uitgevoerd. Geen Supabase-schemawijziging nodig.

## Nieuwe controle 2026-08-04: personeelsnummer niet zichtbaar in medewerker-directory

De medewerkerdirectory toont het personeelsnummer niet meer in de medewerkerslijst en gebruikt het ook niet voor zoeken. De veilige popup projecteert het nummer al niet; de remote SQL-controle bevestigde dat `get_employee_directory_detail` geen `employeeNumber` of `employee_number` teruggeeft. Dezelfde lijstbeperking geldt voor managerrecords buiten het directe team, die als medewerker-collega worden behandeld.

Interne browsercontrole op poort 3000 met `Test Medewerker`: 20 records zichtbaar, namen/functie/afdeling/e-mail aanwezig volgens de vrijgave-instellingen, geen `Personeelsnummer:` in de lijst; Lina Bakker-popup geopend zonder personeelsnummer. Typecheck en gerichte ESLint zijn geslaagd. Geen Supabase-schemawijziging nodig.

## Nieuwe slice 2026-08-04: directoryzichtbaarheid geldt ook voor de lijst

Naam is server-side verplicht zichtbaar en de HR-checkbox is aangevinkt maar disabled. De overige vijf HR-instellingen worden zowel in de collega-popup als in de medewerkerslijst toegepast; verborgen functie/afdeling en zakelijk e-mailadres worden bovendien niet opgenomen in de lijstzoektekst.

Remote migration `employee_directory_visibility` is toegepast. De visibility-RPC geeft `showName: true` terug en behoudt tenant-, administratie- en permissionchecks. In de interne Codex-browser op poort 3000 bevestigde HR de disabled Naam-checkbox. Met functie/afdeling en zakelijk e-mailadres tijdelijk uit zag `Test Medewerker` de namen nog wel, zonder die velden in de lijst of popup; telefoon, aanwezigheid en rooster bleven zichtbaar. Alle drie demo-administraties staan na de test terug op alle defaults `true`. Typecheck, gerichte ESLint, i18n-check, Supabase advisors en `git diff --check` zijn uitgevoerd; de projectbrede advisors blijven bestaande security/performance-meldingen tonen, inclusief de bewust authenticated SECURITY DEFINER visibility-RPC.

## Nieuwe slice 2026-08-04: manager buiten team krijgt collega-popup

De medewerkerslijst begrenst nu ook managers: directe teamleden blijven links naar de volledige detailpagina; records buiten het directe team worden knoppen die de bestaande beperkte collega-popup openen. `TENANT_ADMIN` behoudt zijn volledige administratie-scope. Dezelfde grens staat in de detailroute: een manager kan een niet-teamlid niet via een handmatige URL openen. De directory-detail-RPC accepteert naast `employee-directory:read` ook `employee:read`, maar blijft server-side beperkt tot de HR-vrijgegeven directoryvelden.

Browsercontrole met `Test Manager` op poort 3000: `scope=all` toonde 20 medewerkers, Bas de Jong buiten het team opende als popup met telefoon/aanwezigheid/rooster en zonder manager-tabs, Lina Bakker als teamlid opende de volledige detailpagina. Een directe URL naar Bas werd naar `/employees` teruggestuurd. Remote migration `manager_non_team_directory_privacy` is toegepast; advisors opnieuw uitgevoerd.

## Nieuwe slice 2026-08-04: medewerkersdirectory voor medewerkers

De medewerkerslijst is beschikbaar voor `EMPLOYEE` via `employee-directory:read`, met de nieuwe HR-inrichting **Medewerkers mogen de medewerkerslijst openen** (default `true`). Collega's openen voor medewerkers een veilige popup; de volledige collega-detailroute blijft server-side geblokkeerd. HR kan naam, functie/afdeling, zakelijk e-mailadres, zakelijk telefoonnummer, weekaanwezigheid zonder reden en rooster afzonderlijk vrijgeven; alle velden starten aan. De Supabase-RPC gebruikt alleen deze veilige projectie, controleert tenant/administratie/permission en exposeert geen absence-reden of HR-detaildata.

Remote toegepast: `employee_directory_settings_v5`, `employee_directory_access`, `employee_directory_schedule_fallback`, `employee_directory_schedule_fallback_v2`, `employee_directory_presence_date_v2` en `employee_directory_presence_date_v3`. DB-types zijn opnieuw gegenereerd. In de interne Codex-browser op poort 3000 zag de medewerker 20 collega-records, opende Lina Bakker in een popup met telefoon, aanwezigheid en rooster, en zag na het uitzetten van zakelijk e-mailadres dat veld niet meer. De instelling is daarna op de geteste administraties teruggezet naar alle defaults `true`. Typecheck, i18n, gerichte ESLint, Supabase security/performance advisors en `git diff --check` zijn uitgevoerd; advisors tonen bestaande projectbrede definer-/indexmeldingen, waaronder de twee nieuwe bewust server-side permission-checked RPC's.

## Nieuwe slice 2026-08-04: medewerkerslijst opent gesloten met Mijn team-preset

De medewerkerslijst opent altijd met het filterpaneel gesloten. De eerdere `filterPanelOpen`-waarde uit `user_preferences.ui_state.employeesList` wordt niet meer gelezen of opgeslagen; tijdens een volgende opslag wordt de oude sleutel uit die JSON-scope verwijderd. Status, archief, sortering en weergave blijven wel persoonlijke lijstvoorkeuren.

De herbruikbare `employeeListMyTeamHref()` forceert `status=active-future-external`, `archive=active` en `scope=team`. De preset omvat `ACTIVE_EMPLOYEE`, `FUTURE_EMPLOYEE` en `NEVER_EMPLOYED` (de UI-tekst **Actief + toekomstig + externe personen**) en sluit voormalige medewerkers uit. De startpagina gebruikt deze helper voor beide Mijn team-doorklikken.

Authenticated browsercontrole op poort 3000 bevestigde de manager-startpaginadoorklik met exact deze URL, 17 teamrecords met externe personen, een gesloten filterpaneel bij openen en een expliciete `status=ACTIVE_EMPLOYEE`-variant met 13 actieve teamrecords. HR Admin opent de lijst eveneens gesloten.

## Nieuwe slice 2026-08-04: rolgebonden startpagina- en medewerkerslijstscope

De startpagina gebruikt voor `DIRECT_MANAGER` de kop **Wat speelt er nu in mijn team** en voor `TENANT_ADMIN` **Wat speelt er nu in ons bedrijf**. Bij beide actieve rollen staat een teamscope/bedrijfsscope-switch. De managerlink achter de kop opent `/employees?status=active-future-external&scope=team`, zodat andere schermen deze scope en filterpreset geforceerd kunnen doorgeven.

De medewerkerslijst bepaalt zonder `scope` voor een manager standaard `team`; het filterpaneel toont daarna de actieve keuzes **Mijn team** en **Alle medewerkers**. `scope=team` wordt in de service alleen voor `DIRECT_MANAGER` geaccepteerd. De startpagina filtert teamgerichte medewerkers-, verzuim-, verlof- en gebeurtenisdata op dezelfde directe teamscope; een gecombineerde manager/HR-admin kan bewust naar bedrijfsscope schakelen.

De bestaande Werk-in-uitvoering-placeholder **Taken & Poortwachter** is alleen zichtbaar voor manager/HR Admin; medewerkers krijgen deze managementactie niet. Er is geen taakinstantiebron in de huidige Workforce-code, dus er wordt geen fictieve taakcount getoond.

Verificatie in deze beurt: i18n-pariteit, strict TypeScript, ESLint, gerichte employee-list-state-tests, `git diff --check` en authenticated browsercontrole op poort 3000 zijn geslaagd. Er is geen schemawijziging, remote write, commit, push of deployment uitgevoerd.

## Nieuwe slice 2026-08-04: volledig organogram voor medewerkers

De medewerker mag het volledige organogram van de actieve administratie lezen. De route gebruikt hiervoor de bestaande canonieke `organization-chart:read`-permission als zelfstandige leespermission; medewerkers krijgen geen managementrechten, HR-schrijfopties of star-performerbeoordelingen. De migration `20260804170000_employee_full_organization_chart_read.sql` is remote toegepast en de relevante RLS-policies, employee-role permission en veilige projectie zijn gecontroleerd. Security- en performance-advisors tonen alleen bestaande projectwaarschuwingen. Strict TypeScript, gerichte ESLint en DB-typegeneratie zijn geslaagd. Authenticated browsercontrole blijft open.

## Nieuwe slice 2026-08-04: Ontwikkeling voor medewerkers

De sidebarlabel `Workforce` heet nu `Ontwikkeling`. De route `/workforce` is voor medewerkers een self-service landingspagina: alleen `Doorlopende beoordeling` naar `/my-appraisal` en `Talentprofielen` naar `/my-talent` worden getoond wanneer de medewerker daarvoor de bestaande self-permissions heeft. Managers en HR Admins behouden hun bestaande Workforce-tegels en routes. Dezelfde persoonlijke filtering is doorgetrokken naar de Workforce-strip op de Startpagina. Lokaal zijn i18n, strict TypeScript en gerichte ESLint geslaagd; er is geen schemawijziging of remote write uitgevoerd.

## Nieuwe slice 2026-08-03: Full/Compact en persoonlijke startpagina-layout

De Startpagina-header heeft een persoonlijke Full/Compact-schakelaar. Full toont weer, komende dagen en de reorder-controls; Compact maakt de header korter en toont alleen de begroeting/naam. De brede vensters (documenten, beoordeling, afwezigheden, verzuimgevallen, gebeurtenissen en KPI's) en smalle vensters (reminders en werk in uitvoering) kunnen in Full per kolom met pijlen of drag-and-drop worden geordend. De directe PATCH-opslag hergebruikt `user_preferences.ui_state` onder `startPage`, met behoud van bestaande voorkeuren en zonder schemawijziging, remote write, commit, push of deployment.

Verificatie in deze run: i18n, strict TypeScript, ESLint en `git diff --check` zijn geslaagd. De geauthenticeerde browsercontrole bevestigde HR Admin Compact na herladen, Full met zichtbare weer/komende-dagen en controls, een opgeslagen herordening na herladen, en de managerstartpagina met eigen Full-voorkeur, Mijn gegevens, Mijn team, Nieuw ziektegeval en 13 actieve medewerkers in scope.

## Nieuwe slice 2026-08-03: Workforce-links op de startpagina

De zin **Je vrije dashboardwerkplek blijft beschikbaar via Dashboard.** is verwijderd. De onderste Snel naar-sectie bevat nu een uitbreidbare Workforce-strip met de bestaande functies 9-grid, Doorlopende beoordeling, Talentprofielen, Star Performers en Cloud tags. De Startpagina bouwt deze links vanuit de actieve permissions; managers en HR Admins krijgen daarmee alleen routes die zij al mogen openen. Geen schemawijziging, remote write, commit, push of deployment.

Verificatie in deze run: i18n, strict TypeScript en ESLint zijn geslaagd. De geauthenticeerde browsercontrole bevestigde voor manager en HR Admin de correcte rolgebonden Workforce-links en de bestaande `/workforce`-bestemming.

## Nieuwe slice 2026-08-03: bestaande gebeurtenissenbron op startpagina hersteld

De startpagina bevatte al het echte venster **Gebeurtenissen** met een link naar `/insights/upcoming-events`, maar toonde daarnaast nog een verouderde Werk-in-uitvoering-placeholder met dezelfde naam. Die dubbele placeholder is verwijderd. De service filtert gebeurtenissen voor `DIRECT_MANAGER` op actieve directe teamleden; HR Admin blijft binnen de actieve administratie-scope. De managerdoorklik naar het bestaande gebeurtenissenrapport gebruikt de remote toegepaste migratie `20260803200000_allow_manager_upcoming_events_report` en dezelfde teamscope. Geen commit, push of deployment.

Verificatie in deze run: i18n-pariteit, strict TypeScript, ESLint, `git diff --check` en 3 gerichte testbestanden/11 tests zijn geslaagd. De geauthenticeerde browsercontrole bevestigde de managerstartpagina (13 actieve teamleden, teamlinks en echte gebeurtenissenkaart), de HR Admin-startpagina (8 actieve medewerkers binnen de administratie) en het HR Admin-gebeurtenissenrapport. De managerdoorklik wacht nog op remote toepassen van de nieuwe rolpermission-migratie.

## Nieuwe slice 2026-08-03: persoonlijke medewerkerdashboard-samenvatting

De overview van een medewerker gebruikt nu de aparte component `EmployeeDashboardSummary`. Deze component bevat uitsluitend persoonlijke gegevens: naam, leeftijd/verjaardag, zakelijke en privécontactgegevens, woonadres, primaire bankrekening en noodcontacten. De component gebruikt dezelfde server-side geladen `EmployeeDetailViewModel`; er is geen nieuwe autorisatie- of database-entiteit toegevoegd.

Managementinformatie blijft op de Startpagina: de Startpagina bevat de tenant-/teamscope-KPI's en operationele managementblokken. De medewerkerlanding blijft door de rolrechten rechtstreeks naar de eigen medewerkerpagina sturen. Lokale controle van deze UI-slice: strict typecheck, gerichte ESLint, `git diff --check` en de bestaande dashboardlayouttest (2/2) zijn geslaagd. Geen commit, push of deployment.

## Nieuwe slice 2026-08-03: managerstartacties en teamscope

De startpagina voor managers en HR Admin heeft bovenaan een uitbreidbare rij snelacties: Mijn gegevens opent het eigen medewerkerdashboard, Mijn team opent de medewerkerslijst op de directe teamscope en Nieuw ziektegeval opent de bestaande ziekmeldingsflow. Op kleine schermen blijven de iconen zichtbaar. Alleen gebruikers met de `DIRECT_MANAGER`-rol krijgen de teamscope-optie in de medewerkerslijst.

De teamscope wordt server-side bepaald uit actieve `employee_organizations`-regels met `direct_manager_id`; de manager krijgt zichzelf niet terug als teamlid. De startpagina filtert teamgerichte aantallen, afwezigheden, verlof en gebeurtenissen op deze scope. HR Admin werkt binnen de actieve administratie-scope. Er is voor deze slice geen nieuwe migratie of remote write uitgevoerd.

Lokale verificatie: strict typecheck, ESLint, i18n-pariteit, gerichte tests (3 bestanden, 10 tests), productiebuild en `git diff --check` zijn geslaagd. De geauthenticeerde manager-browsercontrole op poort 3000 bevestigde de drie links, 13 actieve medewerkers binnen de 22 directe teamtoewijzingen, de startpaginacijfers op teamscope en de icon-only weergave op 390px. `/absence/new` opende met de geautoriseerde medewerkerkeuze.

## Nieuwe slice 2026-08-03: rolgebonden werkruimtes en medewerkerlanding

Afgerond in code en remote testtenant: de rolcatalogus heeft nu `employee-directory:read`, `start-page:read`, `dashboard:read` en `workforce:read`. De globale `EMPLOYEE`-default krijgt alleen het directoryrecht; `DIRECT_MANAGER` en `TENANT_ADMIN` krijgen de drie werkruimte-rechten. De bestaande tenantoverride `HR Admin` in `liquid-hr-demo-holding` is hiermee bijgewerkt. De medewerkerlijst gebruikt een authenticated-only, permission-checked directory-RPC en staat daarmee open voor medewerkers zonder algemene `employee:read`-beheertoegang.

De dashboardlayout en routes zijn server-side op deze rechten aangesloten. Medewerkers zien de medewerkerslijst, niet Dashboard, Start of Workforce; `/dashboard/start` stuurt een medewerker na login direct naar `/employees/{eigen employeeId}`. Manager en HR Admin behouden Start als landing; Dashboard en Workforce zijn voor deze rollen eveneens beschikbaar. Organisatiekaart is bovendien niet meer zichtbaar zonder `organization-chart:read`.

Remote migraties `20260803192309_role_based_workspace_permissions` en `20260803192414_restrict_employee_overview_rpc` zijn toegepast op project `wnpfloqpjvaacobppbpk`; anonieme uitvoering van de directory-RPC is ingetrokken. De security-advisor toont hiervoor alleen de bewuste bestaande waarschuwing dat deze geautoriseerde directory-RPC een SECURITY DEFINER is; de performance-advisor heeft geen nieuwe slice-specifieke fout opgeleverd. De drie fixtureaccounts zijn remote gecontroleerd op de effectieve workspace-rechten. Lokale verificatie: strict typecheck, gerichte lint en 2 bestanden/10 tests geslaagd; de authenticated drie-rollen-browsercheck kon in deze run niet worden uitgevoerd omdat de beschikbare browser-sessie geen gekoppelde klantomgeving had en fixturewachtwoorden niet lokaal beschikbaar waren. Geen commit, push of deployment.

## Nieuwe hotfix 2026-08-03: productieflag testrolwisselaar

Bevinding: `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED` stond correct in Vercel, maar `isTestRoleSwitchEnabled()` las zonder override alleen `NODE_ENV` en niet de runtimeflag. Daardoor bleef de sidebarwisselaar in Production verborgen. Dit is hersteld in versie `1.20260803.4`; de helper leest de servervariabele direct uit en normaliseert `true`/hoofdletters/spaties. Regressietest, volledige tests (125/459), strict typecheck, lint, i18n-pariteit en productiebuild (163 pagina's) zijn geslaagd. GitHub `e8a008c` en Vercel Production `dpl_Fu1T5z3F9P21JdnsMcynaEgfi556` staan op `READY`; een geauthenticeerde productie-browsercontrole blijft als handmatige laatste controle over.

## Nieuwe slice 2026-08-03: doorlopende beoordeling remote en testklaar

De doorlopende beoordeling is end-to-end op de remote Supabase-tenant toegepast. Naast de timeline-migratie zijn FK-indexen en tenant-private Storage voor screenshots/bijlagen toegevoegd. De tabel `continuous_appraisal_attachments` heeft RLS, authenticated-only grants, audit, MIME-/groottechecks en een private bucket; uploads gaan server-side via de admin client nadat de sessie door de gewone tenant-/managerrechten is gevalideerd. Historische timeline-items blijven immutable, inclusief bijlagen toevoegen aan items uit het verleden.

Remote verificatie: contracttest geslaagd; security-advisor toont geen Continuous Appraisal-bevinding en performance-advisor geen nieuwe unindexed-FK-bevinding. De resterende performance-INFO’s zijn ongebruikte indexen op de kleine dataset. Remote fixturedata is idempotent aanwezig voor de drie testrollen: 9 items, 3 reacties en 1 veilige voorbeeldbijlage (`screen-4.png`) voor Noah Hendriks. De manager ziet Noah via `/workforce/continuous-appraisal`; de medewerker ziet `/my-appraisal`; HR Admin heeft tenantbreed Workforce-overzicht.

Authenticated browsercontrole op poort 3002 bevestigde de medewerker-, manager- en HR-routes in de voorafgaande gate; de finale managercontrole bevestigde Noah met 8 items, de bijlagelink en uploadcontrol. De downloadroute leverde `image/png` via een kortlevende signed URL. Lokale verificatie: 125 testbestanden/458 tests, i18n-pariteit met 28 namespaces, strict typecheck en productiebuild met 163 pagina’s geslaagd. De slice is gepubliceerd in GitHub-commit `d91c554`; de actuele Vercel Production deployment `dpl_9ZrhSMrtEJZrJ7ZojL5VKXuRJCNq` staat op `READY` voor de eindcommit.

## Nieuwe slice 2026-08-03: testrolwissel voor fixtureaccounts

Afgerond: de ingelogde testaccounts kunnen via de sidebar boven de Tijdhub tussen Edwin en de drie vaste fixtureaccounts wisselen. De server valideert eerst de huidige sessie, accepteert uitsluitend de allowlist en maakt via Supabase Auth Admin een eenmalige magic-link-handoff aan; de service key blijft server-only en de handoff staat maximaal 60 seconden in een HttpOnly-cookie. Lokaal/test is de functie actief; productie blijft uit tenzij `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED=true` expliciet is ingesteld. De wisselaar blijft beschikbaar voor de vier allowlisted accounts, zodat terugschakelen naar Edwin en een volledige testcyclus mogelijk zijn.

Verificatie: helpertests 3/3, volledige hr-suite 125 testbestanden/458 tests, i18n-pariteit 28 namespaces, strict typecheck, ESLint en productiebuild met 163 pagina's geslaagd. In de lokale browser werkte HR Admin -> Manager -> Medewerker -> Edwin; iedere stap toonde de nieuwe naam en rolgebonden navigatie, met 0 console-errors. De functie is opgenomen in GitHub-commit `d91c554`; productie blijft bewust afhankelijk van de expliciete Vercel-variabele `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED=true`.

## Nieuwe slice 2026-08-03: doorlopende beoordeling lokaal gebouwd

Afgerond: requirement/FDR, lokale schema/RLS/audit-migration, handmatig aangevulde lokale DB-types, strict Zod-schemas, serverservice, API-routes, medewerkerroute `/my-appraisal`, manager-/HR-route `/workforce/continuous-appraisal`, startpagina-samenvatting, Workforce-link en NL/EN i18n. De timeline ondersteunt notitie, actie, afspraak, managerfeedback, doel/ontwikkelpunt en gesprekssamenvatting; reacties zijn uitklapbaar en maximaal 100 tekens. Verleden is DB- en UI-vergrendeld; verwijderen is niet beschikbaar; managerwissel kan als systeemevent zichtbaar worden.

Open: migration `20260803133000_continuous_appraisal_timeline.sql` remote toepassen na expliciete toestemming, advisors/contracttest, representatieve echte testdata, authenticated browsergate en eventuele veilige tenant Storage-slice voor screenshots/bijlagen. De screenshotfunctionaliteit is bewust niet via onveilige publieke URLs gebouwd. Lokale verificatie: 124 testbestanden/455 tests, i18n-pariteit, strict typecheck, volledige ESLint, productiebuild met 163 pagina's en `git diff --check` zijn geslaagd; remote/browsercontrole en SQL-contracttest op de nieuwe remote tabellen blijven open. Geen remote write, commit, push of deployment uitgevoerd.

## Nieuwe slice 2026-08-03: Workforce 9-grid-vlootschouw

Afgerond: requirements/FDR, remote migraties `talent_review_9_grid`, `harden_talent_review_9_grid`, `move_talent_review_activation_security` en `talent_review_fk_indexes`, officieel gegenereerde `packages/db/types.ts`, pure reminder-/gridregels met tests, service/API-routes, i18n en role-aware `/workforce/9-grid` met HR-campagneoverzicht en manager-teamworkspace. HR start campagnes met begin/einddatum; start snapshot huidige directe teams en maakt reminders op zeven dagen vóór einddatum, of op de einddatum voor campagnes korter dan zeven dagen. Managers scoren alleen actieve campagnes, kunnen medewerkers slepen, opslaan/indienen en vorige scores bekijken. HR ziet managerstatus en kan herinneren.

Verificatie deze slice: 455 hr-suite-tests, i18n-pariteit met 27 namespaces, strict typecheck, volledige lint, productiebuild met 158 pagina's en `git diff --check` zijn groen. De remote SQL-contractproef slaagt voor vier RLS-tabellen, authenticated-only grants/RPC's, self-scope constraints en RLS-policytekst. De security-advisor toont geen nieuwe 9-grid-bevinding; de performance-advisor heeft geen nieuwe 9-grid unindexed-FK-bevinding. De anonieme routecheck van `/workforce/9-grid` gaf correct `307` naar login. De authenticated Talent-releasegate is met de drie fixtureaccounts geslaagd: 3 rollen, 6 toegestane routes, 0 axe-violations, keyboard-focus op alle toegestane routes, correcte route-/API-denies, cross-tenant-denies en self-bound employee-read. De medewerker wordt voor 9-grid naar `/geen-toegang` gestuurd, ziet geen 9-grid-heading of functionaliteit en krijgt `403` op review-campagnes en start; de manager krijgt `403` op HR-campagnebeheer en de HR-admin krijgt `404` op de gebruikte onbekende start-id. Axe rapporteert alleen 1 `incomplete` color-contrast-check op de select voor vorige campagne. De gate is bijgewerkt met de actuele `Talent Management`-tekst en `/workforce/9-grid`-checks.

De lokale Supabase CLI bleef geblokkeerd door de telemetrymap; de officiële types zijn daarom via de Supabase MCP gegenereerd. Er is geen seed, commit, push of deployment uitgevoerd.

## Uitgebreide Talent Management-testhandleiding 2026-08-03

De herhaalbare handleiding voor Talent Management staat in `docs/delivery/TALENT_MANAGEMENT_FUNCTIONAL_TEST_GUIDE_20260803.md`. Het document bevat de drie fixtureaccounts zonder wachtwoorden, rol- en routegrenzen, verwachte capability-/doel-/check-indata, HR-, manager- en medewerkerflows, negatieve autorisatietests, performancecontrole, veilige mutatietests en een bevindingentabel. Gebruik dit document als handmatige testbasis; ontbrekende seeddata moet als omgevingsbevinding worden gemeld en niet worden verzonnen. Geen databasewijziging, deployment of seedreset uitgevoerd.

## Security-hardening update 2026-08-03

Login gebruikt nu ook vóór het renderen `safeNextPath`, zodat een externe of protocol-relative `next`-waarde niet in het formulier wordt teruggekaatst. `apps/hr-suite/next.config.ts` levert HSTS, `nosniff`, frame-denial, een strikte referrer policy en een beperkte Permissions Policy; bewust is geen CSP toegevoegd omdat OAuth, Supabase en adresproviders eerst volledig moeten worden geïnventariseerd. Het Talent-recordpaneel laadt opties en records sequentieel om gelijktijdige RLS-belasting op `talent_capabilities` en `talent_levels` te beperken.

Verificatie na deze hardening: 448 hr-suite-tests en 7 control-tests groen, lint, beide strict typechecks, i18n-pariteit en beide productiebuilds groen (156 HR-pagina's, 12 control-pagina's). De lokale security-smokecheck bevestigde alle vijf headers, normalisatie van externe/protocol-relative/XSS-achtige login-`next`-waarden naar `/dashboard/start` en HTTP 401 op een onbevoegde employee-API. Er is geen remote Supabase-migratie toegepast en Vercel Production staat nog op commit `4f00eeca4f2a79172d72964eb4fe234843a958c1`; publicatie blijft wachten op herstel van write-authenticatie. De audit heeft nog drie high-meldingen die via de geneste, door Next `16.2.12` vastgepinde `postcss@8.4.31` en optionele `sharp@0.34.5` komen; een override die dit niet betrouwbaar in de lockfile oplost is bewust niet behouden.

## Performance- en Talent Management-update 2026-08-03

`/settings/talent` laadt bij de eerste paginaweergave alleen autorisatie, vertalingen en de Start-sectie. Talentfunctieprofielen, persoonlijke capabilityregistraties en het Talentfundament worden pas geladen wanneer de betreffende accordion-sectie wordt geopend en blijven daarna in de clientcache. De initiële losse Talent-knoppen zijn naar Start verplaatst; het fundament heeft geen beheerknoppen meer buiten de accordion. De naamgeving is verduidelijkt naar `Talent Management`, `Functieprofielen - gekoppeld aan het functiehuis` en `Bestaande functie`, zodat dit niet concurreert met `Functies en functiegroepen` in HR-inrichting.

De capability-recordquery gebruikt een allowlisted select en tenantfilters op de drie referentielezingen. Er is in deze wijziging geen remote databasewijziging of deployment uitgevoerd. Verificatie: 447 hr-suite-tests en 7 control-tests groen, volledige lint groen, i18n-pariteit groen en productiebuild met 156 pagina's groen. Een lokale productie-smokecheck gaf voor `/login` HTTP 200 en voor de representatieve beveiligde hoofd-routes HTTP 307 naar login binnen circa 5-28 ms; dit is guard-performance, geen geauthenticeerde UI-meting. De drie-rollen Talent-releasegate kon niet opnieuw draaien omdat de lokale fixturecredentials ontbreken. De losse `type-check` blijft geblokkeerd door de bestaande fout `apps/hr-suite/lib/weather/open-meteo.ts:102`.

## UI-update 2026-08-03: werkweer op landing-header

De landing-header toont server-side een compact barometerachtig werkweerinstrument via Open-Meteo. De actieve `employee_organizations`-werklocatie heeft voorrang; zonder bruikbare locatie valt werkweer terug op Amsterdam (52.3676, 4.9041). De kaart toont de actuele temperatuur met daaronder klein de maximale temperatuur van vandaag (`temperature_2m_max`), luchtdruk met kleurenschaal en stijg/daal/stabiel-indicator in het midden, luchtvochtigheid onder en windrichting als roterende pijl in een cirkel. De zichtbare windrichting gebruikt Nederlandse kompasrichtingen (`N`, `NO`, `O`, `ZO`, `Z`, `ZW`, `W`, `NW`); alleen de volledige stadnaam staat onderaan. In het midden van de bovenste rij schakelt een kantoor/thuiskeuze tussen kantoorweer (standaard) en het weer op de actuele primaire thuislocatie; de server leest voor thuisweer alleen stad en land uit `employee_addresses`. Zonder beschikbare thuislocatie blijft de thuiskeuze uitgeschakeld en wordt niet naar Amsterdam gefallbackt. De temperatuur, luchtvochtigheid en totale kaart/hero zijn opnieuw circa 25% compacter gemaakt; de begroeting volgt dezelfde kleinere typografische schaal. Onder de begroeting verschijnen alleen wanneer de brondata bestaat de resterende dagen tot persoonlijk goedgekeurd verlof en de eerstvolgende actieve feestdag. Bij een te kleine header wordt het weerinstrument volledig verborgen. Strict typecheck, gerichte ESLint en i18n-pariteit zijn geslaagd; browsercontrole bevestigde de maximale dagtemperatuur, kantoor als standaard, de uitgeschakelde thuiskeuze zonder gekoppelde thuislocatie en geen overflow.

## UI-update 2026-08-03: accountmenu typografie en versieregel

Het uitklapmenu van de ingelogde gebruiker in de sidebar gebruikt voor `Persoonlijke instellingen` en `Uitloggen` nu dezelfde expliciete 14px-standaardtypografie. De appversie wordt onder een scheidingslijn als niet-klikbare informatieregel getoond (`Versie 1.20260803.3`). Geen schema-, API- of autorisatiewijziging.

## UI-update 2026-08-03: ingeklapte sidebar-controls uitgelijnd

In de ingeklapte desktop-sidebar gebruiken de collapseknop, navigatie-items, productupdates, reminderknop, persoonlijke instellingen en uitloggen nu dezelfde 44px vierkante hit-area met gecentreerd icoon. Daardoor vallen de horizontale centra en hover-oppervlakken gelijk; de actieve navigatie behoudt zijn accent. Geen schema-, API- of autorisatiewijziging.

## Releaseupdate 2026-08-03: main en Vercel Production bijgewerkt

De volledige codewerkboom is gepubliceerd naar `main` in commit `d91c554` (`release: publish LiquidHR 1.20260803.3`); `.playwright-state/` is bewust lokaal gebleven en niet gecommit. De actuele deliverydocumentatie staat in commit `b946223` (`docs: align final release commit references`); `origin/main` en de lokale `main` wijzen nu naar `b946223`.

Lokale verificatie voor `d91c554`: 125 testbestanden/458 tests, strict typecheck, lint, i18n (28 namespaces), `git diff --check` en productiebuild met 163 pagina's zijn geslaagd. Vercel Production deployment `dpl_9ZrhSMrtEJZrJ7ZojL5VKXuRJCNq` is voor eindcommit `b946223` als `READY` gemarkeerd; de build compileerde, doorliep TypeScript en genereerde 163 pagina's. De productie-aliasen zijn `liquid-hr-hr-suite.vercel.app`, `liquidhr-edwinitsolutions.vercel.app` en `liquidhr-git-main-edwinitsolutions.vercel.app`. De runtime-errorcontrole voor de nieuwe deployment vond geen error- of fatal-logs.

Vercel meldt tijdens `npm install` nog 4 high-severity dependency-auditmeldingen. Die zijn in deze release niet automatisch aangepast omdat `npm audit fix --force` breaking changes kan veroorzaken; dit blijft een afzonderlijk security-opvolgpunt.

## Besluitupdate 2026-08-03

Snapshot/restore via providerbranch is bewust uitgesloten en is geen open releaseactie. LMS/P3.6 wordt niet gebouwd zonder nieuw productbesluit; P3.3 en P3.5 blijven `GEPARKEERD`; P4-P6 worden niet gestart. De gerichte Supabase-timeout in Talent is aangepakt met scope-indexen, RLS-short-circuiting en lazy rapportopties. `TALENT-NEXT-01` is als eerste read-only spiderwebslice gebouwd en met medewerker, manager en HR-admin op poort 3000 getest. Onderstaande oudere overdrachtsteksten zijn historische context; deze besluitupdate is leidend.

## Meest recente overdracht 2026-08-03: P3 functioneel gesloten in testfase

P3 is voor medewerker, manager en HR Admin functioneel afgerond. De drie-rollen releasegate is opnieuw uitgevoerd met 0 echte axe-violations, keyboard-focus op alle toegestane routes en geslaagde route-, mutatie-, cross-tenant- en self-bound-denies. HR Admin heeft periodefilter 2026-01-01 t/m 2026-03-31 en CSV-export in de Codex-browser op poort 3000 doorlopen; de exportresponse was `200`. De medewerkerlanding is aangepast naar `/dashboard/start`; directe onbevoegde toegang tot `/departments` eindigt op `/geen-toegang`.

Open voor formele productacceptatie: formele acceptatie van één thematische axe-`incomplete` contrastcheck, eventuele herhaling van manager-/medewerkerperiodefilter en CSV als releasebewijs, en P3.7 release-eigenaarsacceptatie. De eerdere brede Supabase-timeout is voor de gerichte Talentvergelijking en rapportopties aangepakt met indexen, RLS-short-circuiting en lazy opties. Provider snapshot/restore is op verzoek uitgesloten; LMS/P3.6 wordt niet gebouwd zonder nieuw productbesluit. P3.3 en P3.5 blijven `GEPARKEERD`. P4-P6 worden niet gestart. `TALENT-NEXT-01` is nu als eerste read-only spiderwebslice gebouwd; zie het handoffdocument en de requirementsanalyse. De releasepublicatie staat op `d91c554` en Vercel `READY`.

De complete testset, de drie-rollenstappen en de extra volgende-taakinstructie staan in `docs/delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md`.

## Meest recente overdracht 2026-08-03: P3 gebouwd in testfase

P3.0, P3.1, P3.2 en P3.4 zijn uitgevoerd. De nieuwe Talent-notificatielaag is tenantgescopeerd, deduplicerend en minimaal van inhoud; HR kan tenantbreed opvolgen, manager en medewerker zien alleen hun toegestane ontvangers. Check-ins gebruiken `talent_goal_check_ins` met RLS, audit en versioning: medewerkerreflectie, managerobservatie en follow-up blijven afzonderlijke entry types. De bestaande doel- en rapportservices zijn hergebruikt; rapportage heeft periode vanaf/tot en dezelfde filters voor scherm, API, export en exportaudit.

De testdatabase bevat voor Noah Hendriks historische/actuele/toekomstige capabilityrecords, historische/actuele/toekomstige doelen en check-ins. De medewerkerflow heeft aanvullend een geldige reflectie aangemaakt; daarmee is zowel seeddata als een echte self-write getest. De vijf fixturemeldingen zijn verdeeld over medewerker en manager en blijven open voor herhaaltesten. De drie fixtureaccounts zijn op poort 3000 opnieuw doorlopen; detailteststappen en verwachte uitkomsten staan in `docs/delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md`.

Open: P3.3 en P3.5 zijn `GEPARKEERD`; P3.6/LMS wordt niet gebouwd zonder nieuw productbesluit; P4-P6 zijn niet gestart. Provider snapshot/restore is bewust uitgesloten. De `/departments`-rechtenroute is voor de directe medewerkerroute opgelost; labelkwaliteit van bestaande manager-capabilityrecords blijft een datakwaliteitsopvolgpunt. Geen commit, push of deployment.

## UI-update 2026-08-03: app-brede controlbasis en gedeelde dropdownset

De gedeelde controlbasis van `apps/hr-suite` behandelt nu alle native selects consistent met vaste maatvoering, afgeronde randen, theme-based chevrons, hover/focus-states en een herkenbare multi-selectvariant. `.form-field` en het bestaande `.input`-patroon gebruiken dezelfde strakke veldstijl; primaire/secondaire knoppen breken hun labels niet meer af en primaire acties hebben duidelijker contrast. De filterbalk op `/workforce/talent` gebruikt daarnaast zichtbare micro-labels, korte waarden (`Alle`, `Concept`, enz.) en een responsive grid zonder horizontale overflow.

`apps/hr-suite/components/ui/dropdown-select.tsx` is toegevoegd als gedeelde single-select voor zoekbare, toetsenbordbedienbare keuzes met zichtbare selectie, portal-menu, disabled/error-states en native form-submission. CountryPicker, de administratiekeuze, Talentfilters/-modal, Insights-selects, employee-landen/talen, organisatie-rolkeuzes en de Insights custom menus gebruiken deze gedeelde controltaal. Niet-gemigreerde eenvoudige/native en multiple selects blijven functioneel via de globale fallbackstyling. Er zijn geen schema- of API-wijzigingen gedaan. Strict typecheck, gerichte ESLint, `git diff --check` en geauthenticeerde Talent-browsercontrole zijn na de uitbreiding geslaagd; volledige testsuite en productiebuild volgen als afsluitende controle. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.9 hardening grotendeels gesloten

De medewerkerlanding is hersteld. Een geauthenticeerde `/login` gaat nu naar `/dashboard/start`, zodat een medewerker niet meer onbedoeld op `/departments` belandt; directe toegang tot `/departments` eindigt netjes op `/geen-toegang` in plaats van een serverfout. De drie-rollen-gate is opnieuw uitgevoerd in de Codex-browser op poort 3000: HR Admin, manager en medewerker behouden hun eigen Talentroutes, manager-scope, cross-tenant-denies, negatieve mutatiedenies en medewerker-self-bound gedrag.

De veilige grote-dataset-baseline gebruikt tijdelijke tabellen met 20.000 synthetische rijen en een volledige transactionele rollback. Doelen, capabilityrecords en importregels gebruiken op schaal hun tenant-/scope-indexen; de zwaarste importselectie van 5.000 regels bleef op 7,545 ms. De volledige axe/keyboard-herhaling heeft 0 echte axe-violations en keyboard-focus op alle vier toegestane routes. Eén themed/shared color-contrastcheck blijft technisch `incomplete`, maar is handmatig gecontroleerd zonder vastgestelde contrastfout.

Applicatieve importrollback is bewezen: de batch en rij zijn `ROLLED_BACK`, het nieuw aangemaakte imported capabilityrecord is `ARCHIVED`, auditdata blijft staan en er is geen actief imported record achtergebleven. Een provider-database snapshot/restore is nog formeel open. Een tijdelijke Supabase-branch kost $0,01344 per uur en is zonder expliciete kosten-/hersteltoestemming niet aangemaakt. Detailbewijs staat in `docs/delivery/TALENT_M2_RELEASE_HARDENING_20260802.md`. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2 functioneel afgerond in testfase

M2.0 t/m M2.8 zijn lokaal en remote volgens `schema -> RLS/grants -> service/API -> UI` uitgevoerd. M2.7 levert tenantgescopeerde ontwikkeldoelen met statusmachine, versioning en audit. M2.8 levert read-only rapportage en CSV-export met vaste rolallowlists, scopefilters en `EXPORT`-audit. Er zijn geen automatische scores, adviezen, AI-besluiten of notificaties toegevoegd.

M2.6 is nu end-to-end bewezen: HR Admin doorloopt in `/settings/talent/import` `PREVIEW -> COMMITTED -> ROLLED_BACK`. De rollback archiveert het door de batch aangemaakte capabilityrecord en laat batch- en auditdata intact. De demo-tenant heeft hiervoor uitsluitend voor `TENANT_ADMIN` de bestaande canonieke rechten `talent-import:manage` en `talent-record:write` gekregen; manager en medewerker hebben geen importschrijfrechten. De preview valideert nu ook de database-compatibele waarden voor capabilitytypes, zodat een ongeldige evidence/certificate-combinatie vóór commit wordt afgewezen.

Drie-fixture-browserbewijs op `http://localhost:3000` is opnieuw uitgevoerd met lokale fixtures, zonder credentials te documenteren. HR Admin kan Talentbeheer/import gebruiken; manager opent `/workforce/talent/goals` maar krijgt `/geen-toegang` voor `/settings/talent/import`; medewerker opent `/my-talent/goals` maar krijgt eveneens `/geen-toegang` voor import. Het medewerkerlandingspad `/departments` geeft nog een bestaande algemene rechten-serverfout; de directe Talent-route werkt en dit valt buiten de M2-scope.

Verificatie: 119 testbestanden/442 tests, gerichte importtests 6/6, strict typecheck, ESLint zonder warnings, i18n-pariteit (26 namespaces), productiebuild (151 pagina's), `git diff --check`, remote comparison/import- en goals/reporting-contracten slagen. Naast de kleine fixture-EXPLAIN is nu een tijdelijke 20.000-rijen-baseline uitgevoerd; de zwaarste importselectie bleef op 7,545 ms en alle tijdelijke data is teruggedraaid. De formele M2.9-release-hardening blijft alleen open voor provider snapshot/restore. Supabase-advisors tonen projectbreed security 12 (10 WARN/2 INFO) en performance 237 (3 WARN/234 INFO), vooral bestaande `SECURITY DEFINER`, auth- en index/policy-meldingen. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.5/M2.6 drie-fixture-gate

De lokale fixturecredentials uit `.env.talent-auth.local` zijn gebruikt in de Codex-browser op poort 3000. HR Admin opent M2.5 en maakt M2.6 previews; manager opent de directe-scopevergelijking met 22 medewerkers en twee profielen en wordt uit HR-instellingen/import geweerd; employee ziet `/my-talent` en wordt uit vergelijking/import geweerd. De employee-landingsroute `/departments` geeft nog een bestaande onvoldoende-rechten-serverfout.

M2.6 preview is functioneel bewezen met ongeldige en geldige CSV-rijen. De commit wordt door de bestaande tenant-specifieke RLS geweigerd: de `TENANT_ADMIN`-override mist `talent-record:write`. Er is geen remote autorisatie-uitbreiding toegepast; echte commit/rollback blijft open tot die exacte securitykeuze expliciet is goedgekeurd. Importaudittriggers zijn gehard. `20260802232000_talent_capability_fk_indexes` is remote toegepast; Talent foreign-key-advisorregels zijn daarna weg.

Verificatie: tests 116/434 plus control 2/7, lint, i18n en `git diff --check` zijn groen. Typecheck en productiebuild stoppen op drie bestaande fouten buiten deze slice: `employee-service.ts:316` en `employment-detail-service.ts:362/369`. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.5 vergelijking en M2.6 import

M2.5 en M2.6 zijn lokaal en remote volgens `schema → RLS/grants → service/API → UI` toegevoegd. M2.5 gebruikt actieve, actuele functieprofielversies, tenant-/directe managerscope en uitsluitend actuele vrijgegeven capabilityrecords als bron voor individuele `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`-uitkomsten. Concepten, verlopen en niet-vrijgegeven records krijgen geen bronrecord-ID en er wordt geen totaalscore berekend. De routes zijn `/settings/talent/comparison` voor HR Admin en `/workforce/talent/comparison` voor managers.

M2.6 gebruikt `talent_import_batches` en `talent_import_rows` met immutable invoer, RLS, authenticated-only grants, statusguards, gesaneerde auditmetadata en HR-only idempotente commit-/rollback-RPC's. `/settings/talent/import` toont CSV-preview, rijvalidatie, expliciete commit en batchrollback. Rollback archiveert nieuwe geïmporteerde records of herstelt updates en laat auditdata staan; er is geen hard delete. De remote migrations `20260802220000_talent_comparison_and_import` en `20260802223000_talent_import_policy_indexes` zijn toegepast. Het remote contract `apps/hr-suite/supabase/tests/talent_comparison_and_import_contract.sql` slaagt; gerichte parser/querytests en strict typecheck slagen. Advisors hebben geen nieuwe securitylint voor deze slice; performance meldt alleen nog ongebruikte importindexen in de kleine demo-dataset.

Functioneel open: de volledige nieuwe drie-fixture-gate en een echte HR-preview → commit → rollback met de lokale fixtures. De huidige Codex-browser-sessie heeft geen gekoppelde klantomgeving; credentials worden niet in chat of repository opgeslagen. De eerdere geauthenticeerde drie-rollen-gate blijft referentiebewijs voor de bestaande route-, scope-, tenant- en self-bound-grenzen. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.3 assessments en M2.4 Team Talent uitgevoerd

M2.3 en M2.4 zijn volgens `schema → RLS/grants → service/API → UI` uitgevoerd. De remote migration `20260802210000_talent_assessments_and_team_matrix` voegt assessmentcycli, onderdelen, self-/managerresponses, antwoorden en afgeschermde managernotities toe. Statusovergangen, optimistic versioning, cyclusvensters, manager-scope, self-bound writes, HR-finalisatie/heropenen en auditmetadata worden server-side én in databaseguards bewaakt. Managernotities blijven buiten medewerkerselecties; evidence blijft metadata-only.

De nieuwe pagina's zijn `/settings/talent/assessments`, `/workforce/talent/assessments`, `/my-talent/assessments`, `/settings/talent/team` en `/workforce/talent/team`. Team Talent gebruikt batchqueries en toont alleen individuele capabilityregels; aggregaten zijn uitgeschakeld. Canonieke permissions zijn `talent-assessment:*`, `self:talent-assessment:*` en `talent-team:read`; alle vijf nieuwe tabellen hebben RLS, policies en uitsluitend authenticated Data API-grants. Het remote assessment/Team-Matrix-contract en de gerichte schema-tests slagen.

Verificatie: 114 testbestanden/428 tests, strict typecheck, lint, i18n (25 namespaces), productiebuild (136 pagina's), `git diff --check` en remote security/performance-advisors zijn uitgevoerd. Advisors melden bestaande projectbrede waarschuwingen en kleine-dataset `unused_index`-meldingen, geen nieuwe ontbrekende RLS-policy voor deze slice. De interne Codex-browser op `http://localhost:3000` staat open, maar de bestaande sessie heeft geen gekoppelde klantomgeving en eindigt daardoor op `Nog geen toegang`; de drie authenticated rolflows zijn in deze run niet opnieuw geclaimd. Geen commit, push of deployment.

## Update 2026-08-02: bedrijf en locatie per dienstverband lokaal toegevoegd

De dienstverbanddetailpagina heeft een zelfstandige tab **Bedrijf en locatie**. Bij een administratie zonder afzonderlijke locaties toont de tab de echte bedrijfsnaam en het bedrijfsadres als alleen-lezen kaart. Bij meerdere actieve locaties toont de tab per dienstverband een overzicht met huidige/historische perioden, een zoekbare locatiekeuze, wijzigen en een nieuwe opvolgende ingangsdatum; de einddatum wordt automatisch op de vorige dag gezet.

De slice gebruikt de bestaande `employee_organizations.location_id`-koppeling en bevat `apps/hr-suite/supabase/migrations/20260802210500_manage_employment_company_location.sql` met locatie-RLS, een validatietrigger, de RPC `manage_employment_company_location` en behoud van de locatie bij organisatie-opvolgers. API en i18n zijn toegevoegd; `packages/db/types.ts` bevat de nieuwe RPC-signature. De migration new-opdracht kon niet schrijven naar de sandbox-beperkte Supabase-telemetrymap, daarom is het lokaal aangemaakte migrationbestand via patch toegevoegd.

Verificatie: 113 testbestanden/424 tests, strict typecheck, lint, i18n (25 namespaces), productiebuild (128 pagina's) en `git diff --check` zijn groen. De nieuwe schema-unit-test is 3/3 groen. De lokale devserver viel tijdens de browsercontrole weg door bestaande auth/HMR-fouten (`Invalid Refresh Token`, ontbrekende bestaande Talent-bron en Webpack-modulefouten); authenticated UI- en remote RPC-bewijs zijn daarom niet geclaimd. De nieuwe migration is nog niet remote toegepast; er is geen remote write, commit, push of deployment uitgevoerd.

## Meest recente overdracht 2026-08-02: M2.2 HR-kwalificaties uitgevoerd

M2.2 is volgens schema → RLS/grants → service/API → UI bovenop `talent_employee_capability_records` uitgevoerd. HR kan bij certificaten issuing body, certificaatcode, geldigheid in maanden, permanentie, verlenging, evidence-status en verantwoordelijke vastleggen. De database bewaakt certificaatdatumlogica, evidence-status, tenant-/medewerker-/capability-gebonden duplicaten en HR-verantwoordelijkheid binnen dezelfde tenant. De API retourneert alleen een allowlisted verantwoordelijke-aanwezigheid; bewijsinhoud, signed URL's en ruwe gebruikers-ID's blijven buiten de response.

De HR-lijst/modal ondersteunt zoeken op uitgever/code, een filter voor bijna verlopen binnen 30 dagen en expliciet archiveren met impactinformatie. Historie blijft bewaard en wordt geaudit. De remote M2.1/M2.2-contractproeven slagen. Typecheck, lint, i18n (25 namespaces), 112 testbestanden/421 tests en productiebuild (128 statische pagina's) zijn groen. De interne Codex-browser op poort 3000 bevestigt voor alle drie Talent-routes de anonieme loginredirect; de bestaande geauthenticeerde drie-rollen-gate uit M2.1 blijft het referentiebewijs. Nieuwe interactieve M2.2-velden per rol zijn in deze run niet opnieuw geopend omdat fixture-logincredentials niet beschikbaar waren. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.1 persoonlijke capabilityregistraties uitgevoerd

De eerste uitvoerbare fase-2-slice is volgens het plan doorgetrokken van schema → RLS/grants → service/API → UI. De tenant-owned tabel `talent_employee_capability_records` is remote toegepast met typegebonden databaseguards, geldigheidsinterval, archivering, evidence-reference zonder inhoud, audittrigger, indexes en RLS. De tabel geeft `authenticated` alleen SELECT/INSERT/UPDATE; `anon` en `public` hebben geen grants. Nieuwe canonieke permissions zijn `talent-record:read`, `talent-record:write`, `self:talent-record:read` en `self:talent-record:write`, met veilige roltoewijzing voor HR Admin, manager-lezen en medewerker-self.

De service/API gebruikt allowlisted DTO's, server-side tenant/employee/manager-scope, self-bound medewerkerwrites, optimistic concurrency via `version` en geen `employeeId` uit de self-body. `/settings/talent` biedt HR lijst-eerst beheer, `/workforce/talent` toont manager alleen-lezen records binnen scope en `/my-talent` biedt de medewerker eigen conceptregistraties. Eigen invoer wordt altijd `DRAFT`; HR bepaalt release/archive; evidence-inhoud of downloadreferentie komt niet in deze response.

Verificatie: remote M2.1-contractproef geslaagd; typecheck, lint, i18n, 112 testbestanden/419 tests, productiebuild en `git diff --check` geslaagd. In de interne Codex-browser op `http://localhost:3000` is met de employee-fixture een echte BHV-registratie opgeslagen en opnieuw zichtbaar als `Concept`, bron `Zelf ingevoerd`, zonder evidence-inhoud. De bestaande drie-rollen-gate blijft geldig voor route-/mutatie-/cross-tenant-scope; HR- en managerpagina’s zijn in code en servergrenzen aangesloten. Supabase-advisors tonen voor M2.1 geen nieuwe securitywaarschuwing; de performance-advisor meldt de nieuwe indexes nog als ongebruikt in de kleine demo-dataset. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.0 security en rollencontrole uitgevoerd

M2.0 van het fase-2-plan is als contract- en gegevensbeschermingsslice uitgevoerd. De nieuwe artefacts zijn `docs/decisions/ADR-0007-talent-fase-2-eigendom-en-gegevensbescherming.md`, `docs/decisions/FDR-0003-talent-fase-2-assessment-en-evidencebeleid.md`, `docs/requirements/Talent/analysis/talent-phase2-m2.0-contracts-and-data-protection-20260802.md`, `docs/requirements/Talent/analysis/talent-phase2-m2.0-traceability-matrix-20260802.md` en `apps/hr-suite/supabase/tests/talent_phase2_m2_0_contract.sql`. Zij bevatten de rolmatrix, dataclassificatie, canonieke permissionvoorstellen, status-/datum-/provenance-/evidencecontracten, logisch schemaontwerp, RLS/API-grenzen en acceptatie-/traceabilityregels. Daarnaast is alleen de bestaande audit-Data-API-grens aangescherpt; er zijn geen fase-2-tabellen, API-routes, UI-flow, seed of generated types toegevoegd. Geen commit, push of deployment.

Remote op Supabase-project `wnpfloqpjvaacobppbpk`: de migration `20260802131815_harden_audit_log_data_api_grants` is toegepast. De live grants op `public.audit_logs` zijn nu alleen `authenticated: SELECT`; `anon` en `public` hebben geen tabelgrants, en het exacte M2.0-contract retourneert zonder failures. Traceability M20-T09 is daarmee PASS. M2.0 blijft inhoudelijk open voor ADR/FDR-review, audit-correlation/source-channel/denied-action en de exacte fase-2-permission-seed; de vier bestaande fase-1-permissions en het ontbreken van fase-2-tabellen blijven bevestigd.

In de interne Codex-browser op `http://localhost:3000` zijn drie geïsoleerde loginrollen gecontroleerd. HR Admin: `/settings/talent` en `/workforce/talent` toegestaan, `/my-talent` geweigerd. Manager: `/workforce/talent` toegestaan, `/settings/talent` geweigerd, `/my-talent` bleef als lege route renderen zonder Talentinhoud. Employee: `/my-talent` toegestaan, `/settings/talent` en `/workforce/talent` tonen `Nog geen toegang`. De directe employee-route werkt; na login wordt eerst `/departments` geladen en die bestaande pagina geeft onvoldoende-rechten als serverfout. Dit routing/UX-punt is niet in M2.0 geïmplementeerd.

## Meest recente overdracht 2026-08-02: fase 1 gecontroleerd, fase 2 voorbereid

De Talent-stappen 1 t/m 9 zijn functioneel uitgevoerd en de drie-rollen-authenticatie-/autorisatiegate is opnieuw groen: HR Admin, manager en medewerker zijn in geïsoleerde sessies getest op toegestane routes, denies, mutaties, cross-tenant-isolatie, manager-scope en medewerker-self-bound gedrag. De gate rapporteert 0 echte axe-violations. De drie technische `color-contrast`-checks zijn handmatig beoordeeld zonder vastgestelde Talent-contrastfout; twee targets komen uit de gedeelde product-updatebanner. Typecheck, i18n (25 namespaces), lint, 112 testbestanden/418 tests, productiebuild, remote Talent-contractproeven en `git diff --check` zijn geslaagd. De formele productie-release is nog niet vrijgegeven: performance op representatieve grote data en een restore/rollback-oefening moeten nog worden bewezen. Het fase-2-plan staat in `docs/requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md`; een nieuwe thread start met M2.0 contracten en gegevensbescherming, zonder direct schema/UI te wijzigen. Geen deploy, push of commit.

## Supabase advisor-status 2026-08-02

Security- en performance-advisors zijn opnieuw uitgevoerd. De output bevat projectbrede bestaande `WARN`/`INFO`-meldingen, waaronder bewust aangeroepen authenticated `SECURITY DEFINER`-RPC's, uitgeschakelde gelekte-wachtwoordbescherming en bestaande permissive-policy-/RLS-meldingen. De Talent-contracttest blokkeert `anon` correct; dit is geen volledig lege advisor-output en blijft onderdeel van de formele releasebeoordeling.

## Update 2026-08-02: Talent stap 9 en functie-inventaris

Stap 9 is de laatste milestone in het opgeslagen Talent-implementatieplan. De remote migratie `20260802150000_harden_talent_job_catalog_audit` is toegepast; daarmee hebben ook `jobs`, `job_groups`, `job_revisions` en `job_group_jobs` append-only Talent-functiehuisaudittriggers. De remote stap-9-contractproef bevestigt 13 RLS-tabellen, de self-RPC-grens voor `anon`, de nieuwe audittriggers en de relevante indexen. De Workforce-profielquery is met `EXPLAIN` gecontroleerd en de service gebruikt batchreads voor requirements/capabilities/levels.

Nieuwe lokale artefacts: `apps/hr-suite/scripts/talent-release-gate.mjs`, het script `audit:talent-release` en `docs/requirements/Talent/analysis/talent-phase1-function-inventory-and-m9-gate-20260802.md`. De functie-inventaris onderscheidt fase-1-kern, gedeeltelijke Blueprintdetails en latere uitbreidingen per HR Admin, Manager en Medewerker.

Voor de bestaande drie testfixtures is daarnaast `apps/hr-suite/scripts/set-talent-fixture-passwords.mjs` toegevoegd. Dit gebruikt uitsluitend de server-side Supabase Auth Admin API met lokale environment variables; er worden geen wachtwoorden in repositorybestanden of uitvoer opgeslagen. De helper is uitgevoerd voor HR Admin, manager en medewerker. De remote cross-tenant capability-fixture `CROSS_TENANT_NEGATIVE_TEST` is toegevoegd via `20260802160000_seed_talent_cross_tenant_release_fixture.sql`.

De volledige geauthenticeerde drie-rollen axe/keyboard-gate is uitgevoerd: 3 rollen, 4 toegestane routes, route-/mutatie-/tenant-denies geslaagd, manager-scope geslaagd, medewerker self-bound geslaagd en 0 axe-violations. Drie `color-contrast`-controles blijven `incomplete` voor handmatige beoordeling. Open release-gate: die contrastbeoordeling, representatieve grote-dataset-performancebaseline en restore/rollback-oefening. Geen deploy, push of commit.

## Update 2026-08-02: Talent stappen 7 en 8 geïmplementeerd

De Workforce Talent-readmodel en Mijn Talent zijn nu als read-only verticale slice aanwezig. `/workforce/talent` toont HR Admin tenantbreed actieve, actuele profielen; een direct manager krijgt uitsluitend functies uit de actuele directe scope. `/my-talent` resolveert server-side de eigen actuele primaire plaatsing en actieve profielversie met capabilityvereisten; ontbrekende medewerker- of profielcontext eindigt veilig in een lege toestand. Er zijn geen scores, matches, voortgang, ontwikkeltrajecten of mutatieknoppen toegevoegd.

Remote staat `20260802123000_complete_talent_read_models` op project `wnpfloqpjvaacobppbpk`. De demo-fixtures `DEMO-028`, `DEMO-032` en `DEMO-035` zijn gekoppeld aan `TEST-MANAGER`, `TEST-PLANNER` en `TEST-CUSTOMER`; de laatste twee vallen onder directe manager `DEMO-028`. De twee self-RPC's gebruiken `SECURITY DEFINER` met lege `search_path`, zijn niet uitvoerbaar voor `anon`, en `talent_job_profile_readmodel` gebruikt `security_invoker=true`. De nieuwe SQL-contractproef `apps/hr-suite/supabase/tests/talent_read_models_completion.sql` is remote uitgevoerd en geslaagd.

Verificatie: typecheck, lint, i18n, 112 testbestanden/418 tests, productiebuild en `git diff --check` zijn groen. In de lokale Codex-browser bevestigde de HR-adminsessie `/settings/talent`, tenantbrede Workforce-profielen, capabilityvereisten en exclusieve accordionwerking. De afzonderlijke manager- en medewerker-browserlogin en de volledige geauthenticeerde axe-run met credentials blijven open; de credentials zijn niet in de repository aanwezig en niet geraden. Geen deploy, push of commit.

## Update 2026-08-02: Talent release-gate, stappen 5 en 6 afgerond

De Talent-basis is nu klaar voor de volgende manager- en medewerkerfuncties in de testfase. De demo-administratie `liquid-hr-demo-holding` heeft drie authfixtures: `manager.fixture@liquidhr.test` (`DIRECT_MANAGER`, directe managerscope), `employee.fixture@liquidhr.test` (`EMPLOYEE`, gekoppelde medewerker) en `hradmin.fixture@liquidhr.test` (`TENANT_ADMIN`, tenant-scope). De manager werd browsermatig geweigerd op `/settings/talent`; de HR-admin opende daar het Talentfundament in de juiste demo-administratie.

Stappen 5 en 6 zijn end-to-end uitgevoerd. Remote migration `20260802110000_complete_talent_profiles_and_configuration.sql` bevat version metadata, activatie, requirement-types, één conceptversie per profiel, overlap-/typeguards en geautoriseerde copy-/activation-RPC's. API en UI bieden profieloverzicht, versiehistorie, concepteditor, capabilityvereisten en dashboardtellingen via `/settings/talent`. De demo bevat 6 functies, 34 capabilities, 6 actieve profielen, 1 conceptversie en 7 versies.

Accessibility/auth-verificatie: de axe-runner controleerde zes kernroutes op poort 3000; alle 6 routes waren bereikbaar, met 0 axe-violations en 3 handmatige `incomplete` kleurcontrastcontroles op overlappende/decoratieve elementen. De browser bevestigde ook de idempotente conceptversie-actie en de exclusieve Talentfundament-accordion. Checks: lint, i18n (25 namespaces), strict typecheck, 112 testbestanden/418 tests, productiebuild (126 pagina's) en `git diff --check` zijn groen. Geen deploy, push of commit.

Open voor de volgende slice: manager- en medewerkerfunctionaliteit bovenop deze lees- en beheerbasis (bijvoorbeeld managerfeedback, medewerkerweergave en workflows). Supabase-advisors blijven projectbreed waarschuwen voor bestaande policy/index-issues en voor de bewust aangeroepen SECURITY DEFINER-RPC's; de nieuwe Talent-RLS, overlaptrigger en RPC's zijn gecontroleerd.

## Update 2026-08-02: Job Architecture en release-gate

Talent stap 4 is nu lokaal en remote doorgetrokken volgens schema -> API -> UI: tenant-owned families/groepen/functies, optionele `job_family_id` en `seniority_id`, CRUD/status, impactguards, zoek/sort/familyfilters, explorerweergave en databaseguards voor unieke actieve naam + groep + senioriteit. Bestaande employee-organization-plaatsingen blijven intact. De typecheckfout in `apps/hr-suite/lib/employees/employee-service.ts:316` is opgelost door de RPC-typing voor nullable `requested_valid_until` te corrigeren.

Remote staan de Talent-foundation, demo-seed, hardening, `complete_job_architecture_contract` en `seed_job_architecture_matrix` in de migratiehistorie. `Liquid HR Demo Holding` bevat 6 families, 3 actieve groepen, 7 actieve functies, 1 groep zonder family, 6 functies met senioriteit, 1 functie zonder senioriteit en 68 functieplaatsingen. De Job Architecture-contractproef slaagt inclusief orphan/duplicate checks, duplicate-business-key negative test en cross-tenant foreign-key negative test.

De vorige release-gate-notitie hieronder beschrijft de tussenstand vóór de manager-/medewerkerfixtures en de axe-audit; zie de actuele update hierboven.

## Historische update 2026-08-02: Talentfundament naar HR-inrichting

Het Talentfundament is nu alleen bereikbaar voor HR Admin via de tegel `Instellingen -> HR-inrichting -> Talentfundament`. De losse Talentfundament-ingang in de zijbalk is verwijderd; de bestaande pagina en het bestaande formulier blijven op `/settings/talent` staan.

De configuratiesecties op de pagina gebruiken nu de gedeelde exclusieve `SettingsAccordion`: standaard staat Niveaumodellen open en bij openen van een andere sectie sluiten alle overige secties. De tegel en route gebruiken `talent:manage`; de server-side routegrens blijft daarmee intact.

Authenticated in-app-browsercontrole op 2026-08-02 bevestigde de tegel, de route en het exclusieve gedrag van Senioriteiten en Competentiewoordenboek. Lint en i18n zijn geslaagd. De volledige typecheck blijft geblokkeerd door de bestaande fout in `apps/hr-suite/lib/employees/employee-service.ts:316`. De remote Talent-testmigraties, demo-catalogus en `20260802063946_harden_talent_remote_contracts` zijn toegepast. De demo-set bleef behouden: 7 categorieën, 9 tags, 34 capabilities, 92 levelinhouden, 20 tagrelaties, 24 profieleisen, 6 actieve profielversies en 16 functieplaatsingen. De contractproef slaagt; nieuwe Talent-triggerfuncties zijn niet meer uitvoerbaar voor public/anon/authenticated.

## Update 2026-08-02: EdwinHelp en projectoverzicht

De bestaande project-overview-skill is nu opgenomen in de natuurlijke commandocatalogus van `scripts/edwin-help.ps1`. `EdwinHelp` toont read-only de Git-workflow, `Maak project overview` met `docs/skills/project-overview/SKILL.md` en `Meet Next geheugen`, inclusief bron, veiligheidsniveau en voorbeeld. Nieuwe commando's worden centraal aan deze catalogus toegevoegd.

## Historische tussenstand 2026-08-02: Talent stappen 1, 2 en 3 lokaal doorgetrokken

Deze tussenstand is ingehaald door de actuele update bovenaan: de beschreven migratie is inmiddels remote toegepast, de types zijn opnieuw gegenereerd en de CRUD-/RLS-/advisorcontrole is afgerond.

De lokale code voor de drie afgesproken Talentblokken is nu doorgetrokken volgens schema → API → UI. Ownership, `TALENT`-modulegate, routegrenzen en permissionchecks blijven tenant-owned; Workforce-profielen worden bovendien alleen uit actieve, datumgeldige directe managerscope gelezen. Het levelmodel heeft beheerbare levels, volgorde, status en een databaseguard die het model bij eerste levelinhoud/gebruik vergrendelt. Senioriteiten hebben list/create/update/status/delete met een gebruiksblokkerende impactguard.

De capabilitybibliotheek heeft typebewuste CRUD, genormaliseerde duplicaatpreventie, categorieën met typescope, status/usage guards, server-side zoekfilters en paginering, Language CEFR, Certificate-metadata, dynamische levelinhoud voor Competency/Skill/Knowledge en relaties naar de bestaande `star_performer_tags`-catalogus. De UI is lijst-eerst met filters en modals; er zijn geen demo-capabilities of tweede tagcatalogus toegevoegd.

Lokale bron: `apps/hr-suite/supabase/migrations/20260802052246_talent_management_foundation_completion.sql` en de contractproef `apps/hr-suite/supabase/tests/talent_management_foundation_completion.sql`. De migratie is bewust nog niet remote toegepast: daarvoor is expliciete scope nodig. Daarom gebruikt de readpagina tijdelijk een veilige lege fallback voor de nog niet aanwezige nieuwe tagrelatietabel; mutation-endpoints voor de nieuwe velden zijn pas volledig uitvoerbaar na migratie. `packages/db/types.ts` is lokaal bijgewerkt voor de nieuwe contracten, maar moet na remote toepassing officieel opnieuw worden gegenereerd.

Verificatie lokaal: 112 testbestanden/418 tests, strict typecheck, ESLint zonder fouten, i18n-pariteit (25 namespaces), `git diff --check` en de bestaande productiebuild. De authenticated Codex-browser opent `/settings/talent` en toont de dynamische levels, senioriteiten, categorie-/capabilityfilters, modals en levelinhoud; de CRUD-mutatiematrix en remote RLS/advisorcontrole blijven open tot de migratie is toegepast. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-08-02: Codex Developer Toolkit

De repository bevat nu de lokale Developer Toolkit in `scripts/`: `backup.ps1`, `restore.ps1`, `new-feature.ps1` en `finish-feature.ps1`, met gedeelde Git-validatie in `_git-toolkit-common.ps1`. De vier natuurlijke commando's en de veiligheidsgrenzen staan in `AGENTS.md` en `docs/DEVELOPER_TOOLKIT.md`. Restore vraagt exact `HERSTEL`, weigert standaard dirty tracked wijzigingen en verwijdert standaard geen ongetrackte bestanden. De scripts pushen en mergen nooit automatisch.

De werkboom was bij implementatie al dirty met bestaande product- en documentatiewijzigingen. Er is daarom geen backup-commit, branchwissel, reset, push of merge uitgevoerd. Niet-destructieve PowerShell- en Git-scriptcontroles volgen; Edwin moet vóór de eerste feature zelf `.\scripts\backup.ps1` uitvoeren en de resulterende commit controleren.

## Update 2026-08-01: liquid metallic bannerstijl

De bovenbanner gebruikt nu een koper/oranje/goudgele liquid-glow met overlappende lichtvelden, metallic sweep en een subtiele hover-link. De stijl is toegevoegd met bestaande CSS-thema-variabelen. Lint en strict typecheck zijn geslaagd; de anonieme browsercontrole redirect naar login.

## Update 2026-08-01: verhuizing en verzuimdetail-navigatie

Het hoofdadres toevoegen heet in de medewerkerkaart nu `Verhuizen`. De lopende verzuimkaart op het medewerkerdashboard is een klikbare kaart met hand-icoon naar het bestaande verzuimgeval (`caseId`). Het verzuimgevaldetail heeft één dossierkop met datum; de ziekteperioden staan compact als exclusief uitklapbare details met een samenvattingsregel.

Verificatie: `npm.cmd test -w @liquid-hr/hr-suite -- --run` geeft 112 bestanden/415 tests; strict typecheck en i18n-pariteit (25 namespaces) zijn groen. De authenticated browsercontrole bevestigde de verhuisactie, de `caseId`-link en het uitklappen van een ziekteperiode. Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/React-pluginfout `contextOrFilename.getFilename`.

## Update 2026-08-01: eenmalige banner en login-popup

Banner- en login-popupberichten worden per gebruiker, bericht en kanaal eenmalig getoond via `product_update_surface_dismissals`. De banner wordt automatisch als gezien vastgelegd zodra hij wordt geladen; de popup heeft onderaan de knop `Gezien`. Remote migratie `20260801105005_product_update_surface_dismissals` is toegepast, RLS is gecontroleerd en de nieuwe types zijn gegenereerd. Lint, i18n, 112/415 tests, typecheck en build zijn geslaagd; de anonieme browserroute redirect correct naar login.

## Update 2026-08-01: eigenaar- en tenant-scope productupdates

Productupdates hebben nu twee scopes: globale eigenaarberichten zonder `tenant_id` voor alle klanten en tenantberichten met de eigen tenant. De eigenaar beheert globale berichten; HR Admin beheert alleen eigen tenantberichten en krijgt globale berichten alleen-lezen. De remote migratie `20260801143000_product_updates_global_owner_scope` is toegepast, optionele start/einddatums zijn actief en twee `[TEST OWNER]`-berichten zijn aangemaakt. Lint, 112/415 tests, i18n-pariteit, strict typecheck en productiebuild met 122 routes zijn geslaagd. De anonieme browserroute geeft 307 naar login; authenticated browsercontrole blijft open door ontbrekende login-cookie.

## Update 2026-08-01: hoofdadres en tweede tijdelijk adres

De medewerker-adrestab gebruikt nu twee exclusieve harmonica-vensters: Hoofdadres en Tweede tijdelijk adres. Bestaande adressen zijn in de testdatabase behouden en als `PRIMARY` gemarkeerd. Het hoofdadres blijft verplicht; de UI toont daarvoor geen einddatum. Een `SECONDARY`-adres heeft een verplichte omschrijving, een eigen start- en einddatum, mag naast het hoofdadres lopen en heeft geen opvolgerlogica.

De migratie `20260801130000_employee_address_types` is op Supabase-project `wnpfloqpjvaacobppbpk` toegepast. Zij voegt type/omschrijving toe, beperkt overlap per type, beschermt het laatste hoofdadres en breidt de bestaande geautoriseerde adres-RPC uit. `packages/db/types.ts` is bijgewerkt.

Verificatie: remote query toont 3 bestaande open `PRIMARY`-demo-adressen en geen secundaire records; `npm.cmd test -w @liquid-hr/hr-suite -- lib/employees/address-input.test.ts lib/employees/schemas.test.ts --run` slaagt (2 bestanden/12 tests); strict typecheck slaagt. Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/React-plugincompatibiliteit (`contextOrFilename.getFilename`). Browsercontrole en i18n-check volgen.

## Update 2026-08-01: productupdates en cadeauvenster

De testdatabase bevat tenant-eigen `product_updates` en `product_update_user_state`. Updates ondersteunen type Nieuwe functionaliteit/Verbetering, optionele einddatum, startdatum met standaard nu, kanaal-multiselect (`GIFT_WINDOW`, `LOGIN_POPUP`, `TOP_BANNER`) en doelgroep-multiselect (`TENANT_ADMIN`, `DIRECT_MANAGER`, `EMPLOYEE`). HR Admin beheert via `/settings/product-updates`; gebruikers lezen via `/product-updates`, de dashboard-banner en login-popup. De zijbalkbadge telt alleen ongeziene actieve cadeauvenster-updates; openen van `/product-updates` schrijft de laatste gezien-status per gebruiker.

Remote migratie: `20260801093124_product_updates`; lokale migratie: `apps/hr-suite/supabase/migrations/20260801093124_product_updates.sql`. Testdata: twee `[TEST]`-updates per actieve tenant, idempotent aangemaakt. `packages/db/types.ts` is opnieuw gegenereerd. Verificatie: remote RLS/policies gecontroleerd, Supabase security/performance advisors uitgevoerd, 112/413 tests, strict typecheck, lint, i18n en build groen. Anonieme routecontrole is groen; authenticated browsercontrole blijft open door ontbrekende login-cookie in de huidige Playwright-context.

## Update 2026-08-01: intelligente adresinvoer bedrijfsgegevens

De bedrijfsadres- en locatieformulieren gebruiken nu dezelfde intelligente adresinvoer als het woonadres van medewerkers: landgebonden suggesties, Nederlandse postcode/huisnummer-aanvulling en handmatige fallback. Voor niet-Nederlandse adressen zijn adresregel 1, de optionele adresregel 2, postcode, plaats en regio beschikbaar. Er is geen nieuwe migratie nodig; `address_line_2` en de bijbehorende validatie/API-koppeling bestonden al.

Verificatie: gerichte schematest (3/3), strict typecheck, productiebuild en i18n-pariteit (25 namespaces) zijn geslaagd; de ingelogde browsercontrole bevestigde Nederlandse suggesties, de internationale adresregel 2 en dezelfde invoer in een nieuwe locatie. Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/React-plugincompatibiliteit.

## Update 2026-08-01: verzuimgeval-detail en lopend verzuim

De medewerkerweergave gebruikt nu de bestaande geautoriseerde verzuimprojectie voor een consistente lopend-verzuimervaring. Bij een actieve casus wordt `Ziek melden` niet getoond. Op het medewerkerdashboard opent `(Gedeeltelijk) beter melden` de bestaande verzuimtab met `caseId`; de datum staat niet meer naast die actie. De verzuimtab heeft geen herstelactie boven de lijst. Iedere bestaande casuskaart opent hetzelfde detailpad en toont de beschikbare casus-, ziekteperiode- en capaciteitsgegevens. De herstelactie met datum blijft uitsluitend op de casusdetailweergave beschikbaar.

Er zijn geen tabellen, migraties, RLS-policies of dependencies gewijzigd. `absence_cases`, `absence_spells` en `absence_capacity_changes` zijn alleen uitgebreid gelezen via de bestaande service; geen medische of andere niet-bestaande gegevens zijn toegevoegd.

Verificatie: `npm.cmd run lint --workspace @liquid-hr/hr-suite`, `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` en `npm.cmd test --workspace @liquid-hr/hr-suite` zijn geslaagd (112 testbestanden/413 tests; 25 NL/EN-namespaces). De actuele volledige typecheck wordt geblokkeerd door de bestaande, losstaande fout in `apps/hr-suite/app/(dashboard)/settings/company-data/page.tsx`: ontbrekende `CompanyDataLabels`-sleutels. De lokale server antwoordt op poort 3000 met HTTP 200. De ingelogde browsercontrole met demo-medewerker Noah bevestigde dashboard, verzuimoverzicht en casusdetail.

## Update 2026-08-01: bedrijf gegevens en locaties

Instellingen → Organisatie & toegang bevat nu de tegel Bedrijfsgegevens en de route `/settings/company-data`. De pagina gebruikt één exclusieve harmonica met Bedrijfsdata en Locaties. Het bedrijfsadres ondersteunt Nederlandse en internationale adressen; één locatie kan als bedrijfsadres worden vastgezet waardoor locatiebeheer wordt uitgeschakeld. Bij meerdere locaties is er lijst-eerst beheer met toevoegen, wijzigen, actief/inactief en verwijderen. Verwijderen wordt zowel in de UI als via de bestaande FK naar `employee_organizations.location_id` geblokkeerd zodra een locatie gebruikt is.

De migraties `20260801090305_add_company_data_and_locations`, `20260801091902_grant_company_data_to_tenant_admin` en `20260801092039_harden_company_data_policies_and_indexes` zijn remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; lokale bronbestanden staan onder `apps/hr-suite/supabase/migrations/`. De rolnaam in de live database is `TENANT_ADMIN` met weergavenaam HR Admin. `packages/db/types.ts` is opnieuw gegenereerd. De startpagina-groet is kleiner gemaakt en het hand-emoji is verwijderd.

Verificatie: schema-invoerunit-tests (3/3), strict typecheck, gerichte ESLint, i18n-pariteit (24 namespaces), productiebuild en ingelogde in-app-browsercontrole van `/settings/company-data` en `/dashboard/start` geslaagd. Supabase security/performance advisors tonen alleen projectbrede bestaande meldingen; de nieuwe tabellen/policies zijn gecontroleerd. Er is niet gecommit, gepusht of gedeployed.

## Update 2026-08-01: enkele scrollbar medewerkerdetail

De gedeelde dashboard-shell is viewport-vast gemaakt (`fixed inset-0`). Daardoor blijft `main` de enige scrollcontainer voor lange medewerkerkaarten; de document-scroll loopt niet meer parallel mee. De medewerkerdetailpagina is op de bestaande ingelogde demo-route gecontroleerd: één zichtbare verticale scrollbar, geen browserwaarschuwingen of fouten.

## Update 2026-08-01: medewerkerprofiel- en reminderfeedback

De medewerkerdetailpagina gebruikt nu een doorzoekbare internationale voorkeurstaalkeuze, plaatst de actieve status naast het personeelsnummer en toont de adreslookup alleen wanneer postcode en huisnummer gevuld zijn en de plaats leeg is. `Geldig tot` blijft optioneel, kan worden ingevuld en expliciet gewist; nieuwe adressen starten zonder einddatum. De reminderdetailmodal zet **Verbergen** naast **Annuleren** in de onderste knopgroep, met dezelfde secundaire knopstijl.

Geslaagde wijzigingen in persoonsgegevens, adressen, bankrekeningen en relaties schrijven naast de bestaande database-audit een gelokaliseerde regel naar de bestaande `employee_activity_entries`-feed. Er is geen schemawijziging, migratie, dependency-installatie of nieuwe demo-data uitgevoerd.

Authenticated browsercontrole op poort 3000 met demo-medewerker Noah bevestigde: status naast personeelsnummer, taalzoekveld met internationale opties, verborgen/zichtbare adreslookup op basis van de invoer, wisbare optionele einddatum, reminderknoppen onderaan en de feedregel `Persoonsgegevens gewijzigd`. De lokale login gaf HTTP 200. Verificatie: 111 testbestanden/410 tests, strict typecheck, ESLint, i18n-pariteit (24 namespaces) en productiebuild (115 statische pagina's) geslaagd.

## Update 2026-07-31: tenant-owned functiehuis en Talent Foundation uitgevoerd

De testfase-regel is toegepast: de demo-database is behouden, maar de oude administrationele compatibilitykolommen en scopefilters voor `jobs`, `job_groups`, `job_revisions` en `job_group_jobs` zijn verwijderd. Bestaande IDs en plaatsingsrelaties zijn hergebruikt; de database dwingt nu één tenant-functiegroep per functie af. Er is één expliciete demo-afdeling `LEGAL-DEMO` op administratie-niveau toegevoegd naast de tenantafdelingen.

De remote migraties zijn geregistreerd als `20260731135658_remove_job_catalog_compatibility_and_seed_admin_department`, `20260731140701_add_talent_foundation`, `20260731141652_add_talent_self_profile_rpc`, `20260731142030_tighten_talent_rls_policies`, `20260731142342_enforce_talent_level_and_profile_invariants`, `20260731143627_seed_talent_profiles_from_existing_jobs`, `20260731144246_enforce_talent_manager_read_scope` en `20260731150748_add_tenant_fk_covering_indexes`. Talent bevat nu tenant-owned level models/levels, senioriteiten, optionele job families, categorieën, capabilities, profile versions, requirements, readmodel en audittriggers. Voor alle zes bestaande demo-functies is het logische profiel als Draft aangemaakt uit de bestaande job revisions; er is geen nieuwe functie of medewerker toegevoegd. De module `TALENT` is enabled voor beide demo-tenants. Self Talent leest via een gecontroleerde RPC; profile activation sluit vorige actieve versies atomair af en het levelmodel lockt bij eerste levelgebruik. Workforce Talent is managergescopeerd op actieve `employee_organizations`; algemene Talent-configuratie vereist `talent:manage`.

Nieuwe routes zijn `/settings/talent`, `/workforce/talent`, `/my-talent` en `/api/talent/*`. De bestaande modulecatalogus, sidebar, i18n, master-data en tests zijn daarop aangesloten. `packages/db/types.ts` is opnieuw gegenereerd vanaf remote. De administratie-afdeling is met SQL en een bestaande authenticated in-app-browser-sessie gecontroleerd: `LEGAL-DEMO` verschijnt in de afdelingskeuze. Dezelfde sessie kan `/workforce/talent` lezen; `/settings/talent` weigert terecht zonder `talent:manage`. Anonieme API's geven 401; `/login` geeft HTTP 200.

Laatste verificatie: 111 testbestanden/410 tests geslaagd, strict typecheck geslaagd, ESLint geslaagd, i18n-pariteit geslaagd (24 namespaces), productiebuild geslaagd (115 routes), en lokale poort-3000 checks voor login, jobs, departments en talent uitgevoerd. Supabase advisors tonen alleen bestaande projectbrede waarschuwingen plus de bewust beveiligde self-profile SECURITY DEFINER RPC.

## Hotfix 2026-07-31: Talent-navigatie en dashboardcontext (gecorrigeerd)

De eerste hotfix-samenvatting beschreef de permissiegrens onjuist. De definitieve regel is: Talentprofielen wordt via de Workforce-tegel aangeboden aan `talent:manager-read`; Talentfundament staat onder `/settings/talent` en vereist `talent:manage`. Er staat geen tweede Talentprofielen-item in de sidebar. De dashboard-layout hergebruikt binnen één render de bestaande Supabase-client en authcontext voor permissions, tenantmodules en reminders.

De authenticated in-app-browser bevestigde daarna dat `/workforce` één Talentprofielen-tegel toont, `/workforce/talent` alleen Workforce als actieve ouder markeert en `/settings/talent` alleen Talentfundament markeert. De tenant-specifieke TENANT_ADMIN-override van Edwin's actieve demo-tenant is hiervoor gericht aangevuld; de andere demo-tenant is niet gewijzigd. De warme metingen en actuele eindverificatie staan in de latere sectie `Update 2026-07-31: Talent-navigatie, tenantrechten en performance`.

## Release 2026-07-29: versie 1.20260729.7

De volledige release staat op `main` en `origin/main` als commit `3e324e7`. Vercel Production is `READY` op deployment `dpl_6Wwho9qoYsKBK8DZrxrAh6PC5aAU`, met aliases `liquid-hr-hr-suite.vercel.app`, `liquidhr-edwinitsolutions.vercel.app` en `liquidhr-git-main-edwinitsolutions.vercel.app`. De anonieme productiecontrole toont de loginpagina en Vercel meldt geen runtime errors in het afgelopen uur. Een ingelogde productiecontrole blijft handmatig.

## Update 2026-07-29: verlofopbouw, werkuren en overuren zichtbaar gemaakt

Versie `1.20260729.7` herstelt de volledige configuratiestroom onder HR-beheer → Verlofopbouw. De catalogus toont contextafhankelijke toevoegknoppen, Voorrangsregels alleen bij Afwezigheden en uitsluitend Kleuren en gebruik in het driepuntsmenu. Nieuwe verloftypen hebben Annuleren, Soort verlof en Opbouw; bij regelopbouw staat de effectieve opbouweditor inline met contracturen, één of meer werkurentypen, periode, moment, uren/minuten/seconden, pauzetypen, vervaltermijn, opvolgerketen en samenvatting. Uitzonderingen blijven voor iedere opbouwvorm beschikbaar. Werkuren en overuren tonen algemene instellingen op Basisinformatie en de vier beperkingstypen plus administratiegebonden uitzonderingen op Beperkingen; Geavanceerd blijft bewust leeg.

Supabase-project `wnpfloqpjvaacobppbpk` is gecontroleerd op rollen, administratie-RLS en migratiehistorie. De ontbrekende lokale no-op historie-entry `20260729101206_syntax_probe_ops.sql` is hersteld. In de demo-administratie zijn idempotente testtypen toegevoegd voor alle verlofvormen, gewerkte-urenopbouw en maand-, jaar- en contractfactorbeperkingen voor werkuren en overuren. Gerichte ESLint, i18n-pariteit en 405 tests slagen. De productiecompilatie slaagt, maar de afsluitende typecheck/build stopt op twee bestaande wijzigingen buiten deze slice (`createHeRaLabels` en `hasActiveEmployment`). De server is op poort 3000 bereikbaar; zonder nieuwe ingelogde browsersessie kon alleen de login/redirect en console worden gecontroleerd, niet de afgeschermde HR-route.

## Update 2026-07-29: Next.js dev-servergeheugenonderzoek

Het volledige onderzoek staat in [`docs/delivery/NEXT_DEV_MEMORY_INVESTIGATION.md`](NEXT_DEV_MEMORY_INVESTIGATION.md). Next `16.2.12` gebruikt standaard Turbopack; een routeverkenning van 60 minuten groeide van circa 1,30 naar 3,04 GB working set, terwijl een korte Webpack-vergelijking rond 1,20 GB bleef. De historische 11,12 GB is niet opnieuw bereikt en er is geen applicatie-side globale cache, timerlek of watcher gevonden. De standaard lokale `dev`-script gebruikt daarom Webpack; `npm run dev:turbopack` blijft beschikbaar voor diagnose. `turbopack.root` is stabiel aan `__dirname` gekoppeld. De meethelper staat in `scripts/measure-next-memory.ps1`. Cache-/devservers zijn lokaal gecontroleerd; er is niet gedeployed, gepusht of gemigreerd. De afsluitende typecheck heeft twee bestaande, losstaande fouten gemeld; zie het onderzoeksdocument.

## Update 2026-07-29: dashboardvensters medewerker

- Het dashboardvenster Persoonlijke informatie toont nu naam, leeftijd, dagen tot verjaardag, zakelijke/privé telefoons, e-mailadressen en huidig adres; geslacht, geboortedatum en geboorteplaats worden daar niet meer getoond.
- De foto-uitlegtekst is verwijderd. Foto uploaden/wijzigen/verwijderen blijft zichtbaar voor gebruikers met `employee:write`; de bestaande servervalidatie en opslag blijven leidend.
- De verzuimkaart onderscheidt **Nu ziek** en **Nu niet ziek** met een rood/groen statusvlak. Bij geen lopende ziekmelding blijft het laatste verzuimgeval zichtbaar. De ziekmeldingsvelden staan nu in een aparte viewport-modal; medische oorzaken of vrije medische tekst zijn niet toegevoegd.
- De dashboard-drag-toolbar staat niet meer absoluut over links heen. Bij meerdere actieve dienstverbanden toont Contract en salaris tabs per dienstverband; de salarisreveal haalt de gekozen `employmentId` server-side op.
- Verificatie: `check:i18n`, strict typecheck, ESLint en productiebuild geslaagd. Geen schemawijziging, Supabase-migratie, push of deployment uitgevoerd. Een nieuwe ingelogde browsercontrole kon niet worden afgerond omdat poort 3000 tijdens deze beurt niet bleef luisteren; de build compileerde de nieuwe route en componenten wel volledig.

## Update 2026-07-29: dienstverbandweergave op medewerkerdashboard

De persoonsheader toont geen functie, afdeling of manager meer. De dienstverbandheader toont rechts het medewerkertype van het actuele/laatste contract. Het dashboardvenster Dienstverbanden toont per dienstverband de periode, status, functie, afdeling, uren, arbeidsvoorwaarden en medewerkertype; iedere regel is volledig klikbaar naar het dienstverbanddetail. Wanneer geen actief dienstverband bestaat, wordt dit expliciet gemarkeerd en ziet een geautoriseerde gebruiker de knop naar de bestaande wizard. Statuslogica en de scenario's actief, toekomstig, beëindigd en geannuleerd zijn getest. Typecheck, ESLint, i18n-pariteit en productiebuild zijn geslaagd. Niet gedeployed of gepusht.

## Update 2026-07-29: API-landschap vastgelegd

De inventarisatie van de API's staat in [`docs/architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md`](../architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md). Liquid HR heeft 112 interne Next.js-BFF-routes onder `/api/*`, met Supabase-claims, server-side permissies, actieve tenant-/administratiecontext en RLS als datagrens. Er is nog geen publieke/partner-API, versionering, uniform pagineringscontract, OpenAPI-contract, generieke rate limiting of inkomende webhooklaag. Uitgaande diensten zijn Supabase, Google Gemini voor HeRa, PDOK, Geoapify en Nager.Date. Toekomstige externe ontsluiting start afzonderlijk onder `/api/v1/*`; bestaande interne routes worden niet geopend. Geen code-, database- of deploymentwijziging uitgevoerd.

## Release-status 2026-07-28

Branding is nu remote actief op Supabase-project `wnpfloqpjvaacobppbpk`: migratie `20260728110000_administration_branding.sql`, private storage-bucket, RLS/policies, `settings:write` voor `TENANT_ADMIN` en `user_preferences.use_company_theme` zijn live gecontroleerd. Applicatieversie: `1.20260728.5`. Commit `f650279` staat op `origin/main`; Vercel production deployment `dpl_FPXqx9mrjiY5aDo1dN2kSRJAXdZj` is `READY`.

## Update 2026-07-28: consistente dienstverbandprojectie en bedrijfsstijl

De medewerkerslijst en medewerkerdetailpagina gebruiken voor dienstverbanden dezelfde RLS-geautoriseerde tenantprojectie. De detailroute blokkeert niet langer ten onrechte een zichtbaar dienstverband uit een andere administratie; de tenant- en permissiongrenzen blijven server-side en via RLS gelden. Lina Bakker met twee dienstverbanden wordt hierdoor in beide schermen consistent weergegeven. Klikbare medewerker- en dienstverbandkaarten gebruiken expliciet `cursor-pointer` en behouden `prefetch={false}` op dynamische detailroutes.

Onder Instellingen → Platform & uitbreidingen is lokaal een tegel **Bedrijfsinstellingen** toegevoegd. De pagina heeft een harmonica-onderdeel voor bedrijfskleuren en logo. De nieuwe administratiegebonden tabel/storage-bucket/RLS staan in migratie `20260728110000_administration_branding.sql`; de API ondersteunt kleuren, privé-logo-upload en verwijderen. De bedrijfsstijl wordt server-side als standaardthema geladen en kan in persoonlijke instellingen door een gebruiker worden overschreven; logo's verschijnen in de sidebar-header en de startbanner. i18n, strict typecheck en lint zijn geslaagd. Remote migratie toepassen, Supabase-advisors en officiële typegeneratie blijven open omdat remote writes niet zonder expliciete toestemming zijn uitgevoerd; de gekoppelde Supabase-MCP-readverbinding werkt wel. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-28: dienstverbandkaarten en aanmaakwizard

De medewerkerdetailpagina toont dienstverbanden administratiegebonden, zodat een zichtbare kaart niet meer naar een andere administratie kan verwijzen en daardoor 404 geeft. De kaarten zijn samenvattingen zonder beëindig- of verwijderactie, vullen de beschikbare breedte en staan vanaf twee dienstverbanden in twee kolommen. Iedere kaart is als geheel klikbaar en bevat een duidelijke detailactie met pointer-cursor. **Nieuw dienstverband** staat rechts onder de lijst en opent een modal met de bestaande wizard; annuleren sluit de modal en bewaren gaat door naar het nieuwe dienstverbanddetail. Primaire knoppen gebruiken nu overal de handcursor; employment-kaarten doen dat expliciet als klikbare lijstitems. Check:i18n, strict typecheck en lint zijn geslaagd. De lokale runtimecontrole kon niet worden uitgevoerd omdat poort 3000 niet luistert na een bestaande startconflictmelding; er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-28: verzuimvisualisatie in kalender

De kalender gebruikt nu de administratiegebonden actieve verzuimcasusprojectie. Zieke dagen krijgen rode cellen; dagen na vandaag tot en met `expected_recovery_on` krijgen rood gearceerde cellen. Naast medewerkers met een actieve casus staat in de eerste kolom een klikbaar ziekte-icoon naar `/employees/[employeeId]?tab=absence`. `RECOVERY_WINDOW` wordt niet als ziek weergegeven. Zonder `absence:read` worden verzuimdetails niet geladen. De databasecontrole bevestigde de gebruikte kolommen en twee actieve casussen op testproject `wnpfloqpjvaacobppbpk`. De datumhelpertest (11 tests), check:i18n, strict typecheck en lint zijn geslaagd.

## Update 2026-07-28: Star Performers naar Workforce verplaatst

Star Performers en Cloud tags zijn uit `Instellingen` verwijderd en verhuisd naar `/workforce` met de routes `/workforce/star-performers` en `/workforce/star-performer-tags`. Oude `/settings/...`-routes blijven als redirects bestaan; de bestaande permission `star-performer:read` blijft server-side gelden. De Workforce-pagina toont deze twee beschikbare vensters naast de eerdere work-in-progress-vensters. Check:i18n, strict typecheck en lint zijn geslaagd; anonieme routechecks redirecten correct naar login.

## Update 2026-07-28: Workforce-navigatie en WIP-pagina

De hoofdnavigatie bevat nu `Workforce` direct boven `Instellingen`, inclusief opname in Menu sorting en migratie van bestaande opgeslagen menuvolgordes. `/workforce` toont een responsive tweekoloms-pagina met de work-in-progress-vensters `9-grid` en `Functioneringsgesprekken`. Beide NL/EN-vertalingen zijn toegevoegd. Check:i18n, strict typecheck en lint zijn geslaagd; de anonieme runtimecontrole bevestigde de verwachte redirect naar `/login?next=%2Fworkforce`.

## Update 2026-07-28: reminder-dialog boven dashboardlaag

De reminder-detaildialog vanuit de Tijdhub wordt via een portal naar `document.body` gerenderd. Daarmee blijft de dialog niet langer gevangen in de getransformeerde, `overflow-hidden` sidebar en opent hij viewport-gecentreerd boven het hoofdscherm. De hydration-guard gebruikt `useSyncExternalStore`. Gerichte ESLint en strict TypeScript zijn geslaagd; ingelogde browsercontrole van de reminderklik blijft open omdat de lokale browser geen sessie had.

## Update 2026-07-28: werkurentypen bij verlofregels

Werkurentypen ondersteunen drie algemene instellingen (actief, selfservice en vastpinnen in de kalender), dezelfde vier beperkingstypen als overuren en administratiegebonden uitzonderingen voor één of meerdere medewerkers. De geavanceerde tab blijft leeg als toekomstige uitbreidingsplek.

Migraties `20260728072505_work_hour_type_settings_and_restrictions.sql` en `20260728074000_harden_work_hour_restriction_grants.sql` zijn toegepast op gekoppeld Supabase-testproject `wnpfloqpjvaacobppbpk`; officiële DB-types zijn opnieuw gegenereerd. Werkuren delen bewust de bestaande overwerkbeperkingstabellen en administratie-/RLS-scoping. De SQL-configuratiecheck, 385 tests, lint, TypeScript, i18n en productiebuild zijn geslaagd. Applicatieversie is `1.20260728.4`. Er is nog niet gedeployed naar GitHub.

Afronding van deze slice: ESLint, volledige testset (384 tests), productiebuild en anonieme browsercontrole zijn inmiddels ook geslaagd. De instellingenroute stuurt zonder sessie veilig naar login met 0 console-errors; alleen een bestaande preload-warning blijft zichtbaar.

## Update 2026-07-28: bonusverlof leeftijd en anciënniteit

Leeftijd en anciënniteit zijn nu een afzonderlijk verlofopbouwtype naast contracturen en werkuren. De officiële aanvulling staat in [`docs/requirements/leave/Verlof_Bonus_Regelingen_Addendum.md`](../requirements/leave/Verlof_Bonus_Regelingen_Addendum.md). De bestaande bonusentiteiten, enums, RPC, RLS en audittriggers zijn aangevuld met een constraint die `AGE_SENIORITY` uit gewone opbouwregels houdt. De catalogus-API levert nu ook traptreden; het verloftype toont aparte tegels voor `AGE` en `SENIORITY`, met meerdere treden, timing, pro-rata eerste jaar, FTE-basis en samenvatting. De pure engine berekent de hoogste blijvende trede, triggerdatum, FTE en pro-rata.

Migratie `20260728065641_separate_bonus_accrual_basis.sql` is toegepast op gekoppeld Supabase-testproject `wnpfloqpjvaacobppbpk`; live verificatie bevestigde de nieuwe constraint zonder `AGE_SENIORITY`, beide bonus-enums, RLS op `leave_bonus_rules`/`leave_bonus_tiers` en de migratiestatus `applied`. De read-only SQL-contracttest is geslaagd. Advisors tonen alleen eerder bekende waarschuwingen buiten deze slice. `packages/db/types.ts` is opnieuw gegenereerd. Typecheck, i18n en de relevante 20 tests zijn geslaagd; lint, volledige tests, build en ingelogde browsercontrole blijven open. Applicatieversie is `1.20260728.3`. Er is niet gedeployed, gepusht of gecommit; ongerelateerde `.qoder/repowiki`-wijzigingen zijn behouden.

## Update 2026-07-28: verloftype-instellingen en opvolgende opbouwregels

De verlofopbouwbeheerflow is uitgebreid met algemene verloftype-instellingen, uitgebreide kleurkeuze/kleurgebruik, effectieve opbouwregelketens en uitzonderingen. Bestaande verloftypen en regelversies blijven alleen-lezen; wijzigingen lopen via archiveren of een opvolger. De regel-editor ondersteunt contracturen, werkuren met één of meer gewone/overwerktypen, de voorbereidende basis leeftijd/anciënniteit, periode, opbouwmoment, uren/minuten(/seconden), pauzes, vervaltermijn en een onderste samenvatting. Uitzonderingen ondersteunen één of meerdere medewerkers, selfservice, geen opbouw/aangepaste hoeveelheid, samenvatting en paginering per tien.

Supabase-migraties `20260728062208` en `20260728063339` zijn uitgevoerd op de gekoppelde testdatabase en als `applied` geregistreerd. Live schema-controle bevestigde de enumwaarde `AGE_SENIORITY`, vijf verloftypekolommen, de regelconstraint, successor-RPC en RLS op `leave_types`/`leave_accrual_rules`. Advisors tonen alleen bestaande waarschuwingen buiten deze slice. `packages/db/types.ts` is opnieuw gegenereerd. Typecheck, lint, i18n en 382 tests zijn geslaagd; productiebuild en ingelogde browsercontrole blijven open. Applicatieversie is `1.20260728.2`. Er is niet gedeployed, gepusht of gecommit; ongerelateerde `.qoder/repowiki`-wijzigingen zijn behouden.

## Update 2026-07-28: verlofopbouw en overwerkbeheer lokaal uitgebreid

De lokale slice voor `/settings/leave-accrual` is uitgebreid. Actieve catalogustabbladen zijn visueel duidelijker, de driepuntmenukaart opent acties en een overzicht van bestaand kleurgebruik. De kleurkeuze bevat nu twaalf CSS-tokens. Bestaande verloftypen, werkurentypen en opbouwregels kunnen niet meer vanuit de UI worden bewerkt; opbouwregels worden via successor-versies gewijzigd en catalogusitems kunnen alleen worden gearchiveerd. De migratie `apps/hr-suite/supabase/migrations/20260728052250_configure_overtime_restrictions_and_immutable_catalog.sql` voegt immutable triggers toe.

Overuren hebben nu een aparte, administratiegebonden configuratielaag: globale beperking onbeperkt/maanduren/jaaruren/contracturen × factor, manager inlichten bij invoer, selfservice en medewerkeruitzonderingen. De uitzonderingendialoog ondersteunt één persoon of meerdere medewerkers en de optie **Mag geen overuren schrijven**. `/api/leave/overtime` verwerkt instellingen en uitzonderingen server-side met `leave:write`; na succes ververst de UI de lijst en toont zij een toast.

Verificatie: strict typecheck, lint, i18n, 380 tests en productiebuild zijn geslaagd. De migratie is op de gekoppelde testdatabase uitgevoerd en de nieuwe tabellen, enum, RLS/policies en triggers zijn live gecontroleerd. De migratiehistorie toont `20260728052250` als applied. Supabase advisors geven alleen bestaande waarschuwingen buiten deze slice. `packages/db/types.ts` is officieel opnieuw gegenereerd vanaf de testdatabase; ingelogde browsercontrole blijft open. Applicatieversie is `1.20260728.1`. Er is niet gedeployed, gepusht of gecommit. De bestaande ongerelateerde `.qoder/repowiki`-wijzigingen zijn behouden.

## Update 2026-07-27: release naar GitHub en Vercel

Applicatieversie `1.20260727.6` en de volledige geautoriseerde werkboom zijn vastgelegd in commits `c1a7fbe` en `eaf850a` op `main` en naar `origin/main` gepusht. GitHub bevestigt remote commit `eaf850ae513a04e942944a3cce078a3b3cd939c6`. De gekoppelde Vercel-deployment is voltooid (`success`) via [deployment 4GZVgjp5SY5wHfmnXdGGBej2Hjnt](https://vercel.com/edwinitsolutions/liquidhr/4GZVgjp5SY5wHfmnXdGGBej2Hjnt). De productiehost `https://liquid-hr-hr-suite.vercel.app` is bereikbaar en stuurt anonieme dashboardbezoeken correct naar `/login`; een ingelogde productiecontrole blijft een handmatige vervolgstap.

## Update 2026-07-26: éénknopswissel employment-header

De header op de employmentdetailpagina gebruikt nu dezelfde bediening als de medewerkerheader: er is altijd precies één knop zichtbaar. In uitgebreide modus toont de knop **Compact**; in compacte modus toont de knop **Uitgebreid**. De bestaande tab- en view-queryparameters blijven behouden. Applicatieversie is `1.20260726.5`. Typecheck, lint, de versiecheck en lokale runtimecontrole zijn geslaagd; de server luistert op poort 3000 en de interne browser gaf geen errors of warnings. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-26: start uitvoering Verzuim

De Verzuim- en WvP-brondocumenten uit `C:\Users\Edwin\Downloads` zijn vertaald naar leidende requirements, ADR-0005 en FDR-0002. Het model gebruikt `absence_case` per `employment_id` met één of meer `absence_spells`; medische oorzaken, diagnoses en vrij medische tekst zijn uitgesloten. De gebruiker heeft volledige uitvoering met databasewijzigingen, versienummerverhoging en browsercontrole op poort 3000 gevraagd. Supabase-project: `wnpfloqpjvaacobppbpk`.

## Update 2026-07-26: verzuim verticale slice lokaal uitgevoerd

De pure verzuimengine en Zod-contracten zijn geïmplementeerd met 9 geslaagde tests. De lokale migratie `20260726150000_add_absence_core.sql` bevat `absence_settings`, `absence_cases`, `absence_spells`, `absence_capacity_changes`, RLS/policies, audittriggers en de beveiligde RPC's `report_absence` en `recover_absence`. De API-routes `/api/absence/report`, `/api/absence/recovery` en `/api/absence/employees/[employeeId]` zijn toegevoegd. Het medewerkerdashboard heeft een echt verzuimvenster, de medewerkerdetailpagina een tab Verzuim en de kalender linkt vanuit de medewerkeractie naar ziek melden. Applicatieversie is `1.20260726.7`.

Typecheck, lint, i18n-pariteit, productiebuild en lokale login/browsercontrole op poort 3000 zijn geslaagd. Remote toepassing van de migratie en officiële typesgeneratie konden in deze beurt niet worden uitgevoerd omdat de Supabase-MCP-bewerking niet beschikbaar was en de CLI geen databasewachtwoord heeft; voer dit uit vóór live gebruik en controleer daarna advisors, RLS-isolatie en `packages/db/types.ts` opnieuw.

## Handoff voor volgende chat

Start vanuit `C:\Users\Edwin\Documents\Apps\LiquidHR`, lees eerst `AGENTS.md` en ga verder vanaf dit bestand. Alle bestaande wijzigingen horen bij één nog niet gedeployde release. Behoud versie `1.20260728.3` tenzij de volgende wijziging opnieuw een versieophoging vereist. Controleer bij hervatten opnieuw de lokale server, git-status en Supabase-migratiehistorie; neem de huidige poort-3000-processen en browser-tabs niet blind over.

## Update 2026-07-26: custom fields en functiecatalogusbeheer

Custom fields kunnen in HR Admin worden beheerd met een lijst-eerst-scherm, bewerken van niet-technische eigenschappen, actieve/inactieve status, sortering op label of status, landcode en een live preview onderaan het ingeklapte formulier voor nieuwe velden. De technische sleutel en het veldtype blijven bewust onveranderlijk. Verwijderen vraagt bevestiging en wordt geblokkeerd wanneer waarden het veld gebruiken. Inactieve velden blijven in de database maar worden niet meer aan medewerkers getoond. Functies kunnen aan meerdere functiegroepen worden gekoppeld; de HR Admin-catalogus begint met functiegroepen en toont daarna de gerelateerde functies. Functies en groepen hebben CRUD en een actieve status; verwijderen is geblokkeerd wanneer relaties bestaan. Migraties `20260726093311_custom_fields_and_job_catalog_management.sql`, `20260726094618_split_job_group_jobs_policies.sql` en `20260726094654_index_job_group_jobs_group_scope.sql` zijn toegepast op test-Supabase-project `wnpfloqpjvaacobppbpk`. De SQL-regressieproeven voor countrycode, meerdere functiegroepen en inactieve functiegroepen zijn geslaagd. 97 testbestanden/355 tests, typecheck, lint, i18n, productiebuild en de lokale browsercontrole zijn geslaagd. Applicatieversie is `1.20260726.4`. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-26: employmentlijst, dienstverbandvenster en dashboard-refresh

De employmentlijst toont geen overbodig aantal meer, verwijdert de onduidelijke verwijderactie, gebruikt **Dienstverband wijzigen**, toont meerdere kaarten in twee kolommen en sorteert op startdatum aflopend met primaire dienstverbanden eerst bij gelijke datum. De dienstverbanddetailkop gebruikt dezelfde compacte/uitgebreide opzet als de medewerkerkop, toont e-mail en telefoon onderaan en markeert expliciet dat het om een dienstverband gaat. Compact toont alleen een kleine foto en naam; dit geldt voor medewerkerdetail en dienstverbanddetail. Het employment-overview toont **Werk in uitvoering** als AI-samenvatting; Follow-up actions en More about this employee zijn uit de applicatiecode verwijderd. De dashboardwidgets worden niet meer via de instabiele server-Suspense-stream geladen, waardoor de automatische refreshlus is gestopt; handmatig vernieuwen blijft beschikbaar. Applicatieversie is `1.20260726.3`. Typecheck, lint, i18n, 353 tests en productiebuild zijn geslaagd. De lokale server draait op poort 3000 en de open interne browser-tab bleef vijf seconden zonder waarschuwingen of fouten. Er is geen databasewijziging nodig en er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-26: medewerkerdetail, notities en reminders

De medewerkerdetailpagina heeft nu Notes na Dossier met server-side toegang voor HR Admin en Manager, automatische auteur/tijdregistratie, aflopende sortering en rolafhankelijke verwijderrechten. Profile/external links staan op het medewerkerdashboard; Additional Information is een eigen tab na Relations. Reminders tonen eerst de bestaande lijst, ondersteunen beschrijving, wijzigen/verwijderen en datumverschuivingen; nieuwe reminders starten op de huidige lokale datum/tijd. De medewerkerkop toont actieve status, huidige functie, afdeling en manager. Migraties `20260726061219_employee_notes_and_detail_access.sql` en `20260726062600_harden_employee_notes_grants.sql` zijn toegepast op test-Supabase-project `wnpfloqpjvaacobppbpk` en gecontroleerd met RLS/grants. Applicatieversie is `1.20260726.2`. Typecheck, lint, i18n, 354 tests, build en een ingelogde lokale browsercontrole zijn geslaagd. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-26: Personal Details beheer en adresreminders

De tabs Persoonsgegevens, Adressen, Bankrekeningen en Relaties zijn opnieuw ingericht met gegroepeerde formulieren, lijst-eerst-weergave, wijzigen en verwijderen. Het enige actieve adres kan niet worden verwijderd; de database-trigger `prevent_last_employee_address_archive` bewaakt dit ook buiten de UI. Een nieuw adres kan optioneel direct reminders publiceren voor HR Admin, Manager en/of Medewerker. De HR Admin-reminder bevat aanvullend `Controleer reiskosten etc.`. Migratie `20260726054248_personal_details_management.sql` is toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; de bestaande bank-account-permission blijft standaard HR-admin-only en is via de bestaande autorisatiematrix instelbaar. Applicatieversie is `1.20260726.1`. Tests, lint, strict TypeScript, i18n, SQL-contractproef en productiebuild zijn geslaagd. Er is niet gedeployed; de lokale ingelogde Personal Details-browsercontrole blijft open omdat de lokale browser geen gebruikerssessie had.

## Update 2026-07-25: adresinvoer gebouwd en remote schema toegepast

De adresinvoerflow is lokaal gebouwd volgens de requirements in `docs/requirements/core-hr/ADRESINVOER.md`. `employee_addresses` ondersteunt nu vrije internationale adresregels, herkomstmetadata (`manual`, `pdok`, `geoapify`), genormaliseerde postcodes en landafhankelijke verplichtingen in migratie `20260725132351_address_input_internationalization.sql`. De serverroutes `/api/address-suggestions` en `/api/address-lookup` houden providercalls server-only; zonder `GEOAPIFY_API_KEY` blijft buitenlandse handmatige invoer beschikbaar. De medewerkerkaart ondersteunt landkeuze, debounce-suggesties, PDOK-postcodeaanvulling en handmatige invoer. De zoek-UX focust standaard het adreszoekveld, toont een zoek-/locatie-icoon, houdt land en resultaten bovenaan uitgelijnd en verduidelijkt dat postcode + huisnummer straat en plaats automatisch invullen. De applicatieversie is `1.20260725.2`. Lokaal zijn 97 testbestanden/353 tests, lint, strict TypeScript, i18n-pariteit en productiebuild geslaagd. De migratie is op 2026-07-25 toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; live controle bevestigde de nieuwe kolommen, vijf constraints, index en één gemigreerd adresrecord. De lokale browsercontrole kon in deze beurt niet afronden omdat de devserver op poort 3000 geen HTTP-response teruggaf.

## Update 2026-07-24: release naar main en lokale runtime

De release is volgens de vaste workflow fast-forward naar `main` gebracht en naar `https://github.com/EdwinCycling/LiquidHR.git` gepusht als commit `24b278b`. Daarmee kan Vercel Production de versie vanaf GitHub `main` bouwen. De eerdere featurebranchtekst hieronder is historische releasevoorbereiding; de actuele bron van waarheid is `main`.

Lokale runtime: de Next-devserver draait als losgekoppeld Windows-proces op poort `3000`; een controle op `http://localhost:3000/` geeft de verwachte `307`-redirect naar login.

## Update 2026-07-24: medewerkerdashboard tweede UI-slice

Applicatieversie verhoogd naar `1.20260724.2`.

Releasevoorbereiding: de feature-release staat op branch `agent/employee-dashboard-release` als commit `22af0f3` (`feat: release employee dashboard and reporting updates`). Remote schemahardening, officiële DB-types en verificatiedocumentatie staan in commit `4e7dc10` (`chore: verify employee dashboard release`). Beide commits zijn naar `https://github.com/EdwinCycling/LiquidHR.git` gepusht. De gekoppelde Vercel-preview `dpl_FdgnfHrhT4tPi6W7gtLQZY4R9jKD` is `READY` op `https://liquidhr-git-agent-employee-dashboard-release-edwinitsolutions.vercel.app` en verwijst exact naar commit `4e7dc10083655b31ff04e5092542caf896e049f8`. Productie volgt nog steeds `main`; deze featurebranch is niet naar productie gepromoveerd.

Het dashboard heeft nu genderafhankelijke avatarfallbacks: foto, anders een man-/vrouw-silhouet en voor `OTHER`/`PREFER_NOT_TO_SAY` initialen. Reminders worden als echte, geautoriseerde kaart onder contract/salaris geladen. Salaris wordt bij openen van het dashboard niet meer opgehaald; na `salary:read` en hover/toetsenbordfocus haalt `/api/employees/[employeeId]/salary` de waarde op en verbergt de kaart haar weer bij verlaten.

De brede en smalle widgets hebben vaste kolomgrenzen en een persoonlijke, via drag-and-drop of toetsenbord te wijzigen volgorde in `user_preferences.ui_state.employeeDashboard`. De nieuwe activity-feed ondersteunt een echte handmatige notitie via `employee_activity_entries`, met server- en RLS-permissions `employee-activity:read/write`; er wordt geen demo-inhoud ingezaaid. Migratie `20260724160000_add_employee_activity_entries.sql` is remote toegepast. De aanvullende migratie `20260724172716_harden_employee_activity_entries.sql` voegt de ontbrekende FK-indexen toe, initialiseert `auth.uid()` eenmaal per statement en trekt onbedoelde default grants voor `anon` in. Remote controle bevestigt RLS, twee policies, alleen `SELECT`/`INSERT` voor `authenticated` en geen toegang voor `anon`. De advisors tonen voor deze tabel geen open security- of FK-indexbevindingen; de resterende advisorbevindingen zijn bestaand. `packages/db/types.ts` is opnieuw uit de gekoppelde database gegenereerd.

Verificatie: na de officiële typesgeneratie en schemahardening is de volledige releasegate opnieuw groen: 95 Vitest-bestanden/347 tests, ESLint, strict TypeScript, 21 paritaire i18n-namespaces en productiebuild met 85 pagina's. Een ingelogde Chrome-controle op de actuele branch bevestigde: salaris blijft gemaskeerd tot hover en wordt daarna weer verborgen; widgetvolgorde wijzigt, blijft na herladen staan en is na de proef hersteld; de geautoriseerde reminderkaart en Tijdhub tonen de echte lege toestand; de beschikbare mannelijke en vrouwelijke profielfixtures gebruiken de bedoelde silhouetfallback; de console bleef zonder errors. Een anonieme salarisaanvraag krijgt `401`. Een ingelogde beperkte-rol-deny en de initialenfallback voor `OTHER`/`PREFER_NOT_TO_SAY` konden niet live worden beproefd, omdat de gekoppelde database slechts één actieve `TENANT_ADMIN`-toewijzing en geen zulke genderfixtures bevat; productie-rollen en persoonsgegevens zijn daarvoor bewust niet tijdelijk gewijzigd.

## Update 2026-07-24: medewerkerdashboard eerste UI-slice

De leidende requirements staan in `docs/requirements/core-hr/MEDEWERKER_DASHBOARD.md`. De standaardroute `/employees/[employeeId]` toont nu een kleurrijk medewerkerdashboard met een vaste knop naar **Medewerkerdetails** en de bestaande detailtabs er direct achter. Persoons-, contact-, organisatie-, dienstverband-, salaris-, vrije-veld- en documentinformatie wordt alleen uit bestaande geautoriseerde projecties getoond. Niet-bestaande modules (onder meer verzuim, activa, wagenpark en performance) zijn herkenbare lege vensters zonder voorbeeldrecords, cijfers of andere fake data.

Medewerkerlijst, organogram, kalender en Insights verwijzen naar dezelfde dashboardroute; medewerkersnamen in Insights en aankomende gebeurtenissen zijn klikbare links. Vanuit het dashboard blijven dienstverbanden en de knop **Medewerkerdetails openen** expliciete terugpaden naar detailtabs. De requirements leggen per rol en per widget self-, manager-, HR/admin- en custom-scope vast, inclusief server-side permissionchecks en RLS.

Verificatie: strict TypeScript, gerichte ESLint, i18n-pariteit en productiebuild zijn geslaagd. De lokale browserroute is alleen anoniem gecontroleerd en redirect naar login; een ingelogde visuele controle van dashboard en deny-cases blijft open. De volgende stap is een geauthenticeerde matrixcontrole en releasegate met de nieuwe links.

## Update 2026-07-24: rapportexports en periodeweergave

Insights-exports bevatten nu standaard `Administratienr` en `Medewerkernr` als eerste twee kolommen, vóór de medewerkernaam; dit geldt voor medewerker- en aankomende-gebeurtenissenexports. Rapportperioden ondersteunen maand, volledig jaar en meerjarige vensters van 3 of 5 jaar. Trendgrafieken tonen een numerieke y-as; datumreeksen in de rapportweergave gebruiken een pijl als scheidingsteken.
Bij langere trendperioden worden x-aslabels automatisch uitgedund zodat de volledige trend leesbaar blijft; alle datapunten en tooltips blijven aanwezig.

## Update 2026-07-24: Inzichten-permissions en persoonlijke rapportvoorkeuren

De Insights-catalogus is gegroepeerd in Medewerkers, Verlof, Verzuim en Overige rapportages. Elke rapportage heeft een eigen functiepunt in de lokale migratie `20260724095433_insights_report_permissions.sql`; `TENANT_ADMIN` en `HR_ADMIN` krijgen alle rapportrechten standaard. De navigatie en rapportteller gebruiken uitsluitend deze rapportrechten. De live medewerkersrapporten gebruiken RLS-gebonden databasegegevens en bieden per geopend harmonica-item CSV-export met precies de actieve filters. De actieve-selectiekaart is inklapbaar en, samen met de optionele per-rapport filteropslag, persoonlijk bewaard in `user_preferences.ui_state.insights`.

Verificatie: strict TypeScript en i18n-pariteit zijn geslaagd. De migratie staat in de remote migratie-inventaris. Open: rechtenmatrix/browser met een beperkte rol controleren, privacydrempel voor kleine groepen en exportaudit.

## Update 2026-07-24: Inzichten-catalogus en rapportagefundering

De nieuwe route `/insights` staat in de linker navigatie onder Kalender en boven Instellingen. De pagina heeft een gesloten harmonica-catalogus voor **Verlof in beeld**, **Medewerkerbestand**, **Verzuim**, **Balansvoorziening verlof** en **WvP-voortgang**. Verlof en medewerkerbestand hebben een rapport-specifieke filteropzet met groepering, periode, afdelingsfacet, aanvullende domeinfilters, sortering en weergavekeuze; de geselecteerde rapportkaart staat deelbaar in `?report=`. De UI toont bewust geen gefingeerde cijfers: alleen de rapportvisualisatie en actieve selectie staan klaar totdat veilige data-projecties bestaan. Verzuim, voorziening en WvP zijn eerlijk gemarkeerd als later werk.

Het leidende document is `docs/requirements/reports/RAPPORTAGES_EN_INZICHTEN.md`. De medewerkercatalogus is nu gesplitst in **Personeel per afdeling**, **Personeel per geslacht**, **Personeel per leeftijd** en **Reden uit dienst**. De route gebruikt de bestaande `employee:read`-autorisatie en RLS-scoped medewerker-, dienstverband-, organisatie- en terminationdata via `lib/insights/employee-report-service.ts`; filteropties komen uit dezelfde administratie, en foutpaden tonen geen demo-data. Team, segment, reden en medewerkerstatus zijn afzonderlijke filters; de periode heeft maand-/jaargrid, Vandaag en Volledig jaar tonen. Vóór verdere publicatie moet de zelfstandige canonieke permission `insights:read` worden toegevoegd, gevolgd door kleine-groepenbescherming en exportaudit. Verificatie van deze slice: i18n-pariteit en strict TypeScript zijn geslaagd.

## Update 2026-07-23: medewerkerdetail en dienstverbandtabs tabgericht geladen

De keten Medewerkerslijst → medewerkerdetail → Persoonsgegevens/Dienstverbanden → dienstverbanddetail → dienstverbandtabs is geoptimaliseerd. `getEmployeeEmploymentDetail` en `getEmploymentDetail` lezen nu alleen de projectie voor de actieve tab; historie en HR-events worden niet meer op iedere dienstverbandtab opgehaald. Onafhankelijke rechten- en datalezingen starten parallel, de dubbele employments-permissionread in de medewerkerprojectie is verwijderd en detailroutes hebben compacte `loading.tsx`-skeletons. Dynamische medewerker-, dienstverband- en tablinks hebben `prefetch={false}` zodat verborgen tabs geen collectieve serverrequests veroorzaken.

Architectuur is vastgelegd in `docs/decisions/ADR-0004-performancebudgetten-en-tabprojecties.md` en aangevuld in `docs/architecture/BLUEPRINT.md`, `docs/architecture/UI_FLOW_BLUEPRINT.md` en `docs/README.md`. Nieuwe detailroutes krijgen voortaan een gerichte p75-meting (standaard ≤1.500 ms eerste detailnavigatie, ≤1.000 ms warme tabwissel), tabprojecties en loading state.

Verificatie: 90 Vitest-bestanden/336 tests, ESLint, strict TypeScript, i18n-pariteit en productiebuild zijn groen. Commit `a433a46` bracht de tabprojecties; commit `6405d0f` zette brede prefetch uit en staat op GitHub `main`. Vercel Production deployment `dpl_Gg9oC6KQdksDBkwoD8DxRiaTcAze` is `READY` op `https://liquid-hr-hr-suite.vercel.app`; applicatieversie blijft `1.20260723.2`.

Voor/na-bewijs: de bestaande geauthenticeerde baseline was lijst→detail 1.127 ms, Persoonsgegevens 1.354 ms, Dienstverbanden 1.072 ms en warme dienstverbandtabs 811–1.079 ms. Op de eerste nieuwe deployment waren routes door koude productie/cache 1.867–2.370 ms; de meting liet bovendien brede tabrequests zien. Na `6405d0f` registreerde Vercel voor de einddeployment slechts 14 `/employees`, 4 medewerkerdetail- en 7 dienstverbanddetailrequests in de controleperiode, zonder runtime-errors; de vastgelopen Chrome-tab kon de laatste individuele latencymeting niet betrouwbaar afronden. Niet bevestigd: een nieuwe p75-latency na de prefetchfix. Handmatige vervolgstap is één nieuwe Chrome-meting zodra de ingelogde tab weer bestuurbaar is.

## Update 2026-07-23: Medewerkerslijst geoptimaliseerd voor nieuwe release

De prioriteitsslice voor performance richt zich op Medewerkers; Dashboard en Instellingen zijn bewust buiten scope gelaten. `listEmployeesOverview` gebruikt nu de security-invoker RPC `list_employee_overviews` uit migratie `20260723131241_optimize_employee_overview`, die de administratie-scope, medewerkerprojectie, dienstverbandhistorie en actuele organisatieplaatsing in één databaseleesronde teruggeeft. De RPC filtert ook de archiefstatus en blijft alleen uitvoerbaar voor `authenticated`; RLS blijft op de onderliggende tabellen actief. `packages/db/types.ts` is bijgewerkt met de nieuwe functie. Route-specifieke laadstaten zijn toegevoegd voor `/employees`, `/organization-chart` en `/hr-calendar`.

Remote verificatie: de RPC-structuurproef voor de actieve demo-administratie is geslaagd; de performance-advisor toont geen nieuwe waarschuwing en de security-advisor alleen eerder geaccepteerde meldingen. Lokale releasegate: 90 Vitest-bestanden/336 tests, ESLint, strict TypeScript, i18n-check en productiebuild geslaagd. Applicatieversie voor deze release: `1.20260723.2`. Productie staat op deployment `dpl_AbybcQKa7Z232jFG66dM9qamjfev` (`READY`) met alias `https://liquid-hr-hr-suite.vercel.app`; de runtime-errorscan over de laatste 30 minuten vond geen fouten.

Geauthenticeerde Chrome-meting na deployment: dashboard → Medewerkers 1.651 ms (koude eerste overgang), daarna Organogram 1.046 ms, Medewerkers 813 ms, Kalender 1.045 ms en Medewerkers 798 ms. De herhaalde Medewerkers-overgangen hebben daarmee een mediaan van 813 ms, tegenover circa 926 ms in de vorige gerichte meting en circa 4.560 ms in de oudere warme baseline. De eerste overgang blijft netwerk-/cachegevoelig; Dashboard en Instellingen zijn in deze slice niet aangepast.

## Update 2026-07-23: performance-slice en volledige release gedeployed

De trage overgang tussen dashboardroutes heeft drie maatregelen gekregen. `vercel.json` stuurt Vercel Functions naar `cdg1` (Parijs-regio), zodat de server dichter bij Supabase `eu-west-3` draait. De dashboardroutegroep heeft een algemene skeleton-loading UI. Hoge-cardinaliteitslinks naar medewerkerkaarten en kalender-events prefetchen niet meer automatisch. In `lib/auth/permissions.ts` delen permission-checks binnen één Server Component-request dezelfde Supabase-client en opgeloste auth/context/rollen/permissions; selfservice-permissions worden binnen die request eveneens gedeeld.

De volledige werkboom is vastgelegd in commit `77dc4d8` met applicatieversie `1.20260723.1` en naar GitHub `main` gepusht. Vercel Production deployment `dpl_E4tT9cTmashfnhv95vy4ENNTYryT` is `READY` op `https://liquid-hr-hr-suite.vercel.app` met regio `cdg1`.

Verificatie 2026-07-23: volledige ESLint, strict typecheck, i18n-pariteit met 20 NL/EN-namespaces, alle 89 Vitest-bestanden/334 tests en lokale productiebuild geslaagd. Productie-smoke gaf beschermde redirects/200-responses en de runtime-errorscan vond geen fouten in de laatste 30 minuten. Een nieuwe geauthenticeerde klik-tijdmeting wacht op een bestuurbare Chrome-sessie; de eerdere baseline blijft circa 4,3–5,0 seconden warm en circa 6,1 seconden koud.

## Update 2026-07-22: verlof aanvraag, ledger en Lina-demo gecontroleerd

De HR-admin-verlofflow is nu als verticale slice aanwezig. Vanuit `/hr-calendar` staan de acties **Verlof aanvragen via voorrangsregels** en **Verlof aanvragen zonder voorrangsregels** direct open in het dagpaneel. De aanvraag is altijd per `Employment`, wordt server-side beschermd met `leave:request`, boekt direct goedgekeurd en gebruikt FIFO over de actieve verloftypen van de gekozen voorrangsregel. De route toont saldo nu, saldo einde jaar/onbeperkt en detail per verloftype. De kalender toont daarna de opgenomen kleur/type-indicator.

De centrale ledger-operaties staan in `20260722192000_add_leave_ledger_operations.sql`: immutable migratie-startsaldo, HR-handmatige plus/min-correcties met reden, jaarafsluiting met carry-forward en behoud van oorspronkelijke vervaldatum, lock van afgesloten jaren en idempotente vervalboekingen. De API staat onder `/api/leave/ledger`; `/settings/leave-accrual` bevat jaarstatus en afsluitactie. De seed `20260722192100_seed_leave_demo_year_controls.sql` geeft het demojaar 2026 en toekomstjaar 2027 de status ACTIVE.

De bestaande medewerker is **Lina Bakker** (niet Linda) met employment `8bc9fd97-bb8d-c2aa-2694-4db65c654dbe`, geldig vanaf 01-01-2026, bevestigd salarisrecord en rooster. Het verloftype **Wettelijk verlof** is geldig vanaf 01-01-2026 met jaaropbouw van 160 uur. De gecontroleerde HR-adminboeking op 22-07-2026 is één volledige roosterdag van 8 uur; de remote database toont status `APPROVED`, één `TAKEN`-boeking en resterend saldo 152 uur.

Gate op 2026-07-22: strict typecheck, ESLint, i18n-pariteit, 334 tests en productiebuild geslaagd; remote Supabase-migraties en structuur/advisor-controles uitgevoerd. De security-advisor-waarschuwing voor de callable security-definer RPC's is bewust: de RPC's controleren zelf tenant, employment en permissions. De bestaande waarschuwing voor leaked-password protection blijft een abonnementsbeperking.

Bewust resterend: de report-service projecteert toekomstige periodieke opbouw nog niet volledig in `projectedEndBalance`/maandmomenten; volledige UI voor startsaldo/handmatige correctie en een detailaudit ontbreekt nog. Feestdagen worden nu in de remote booking-RPC én de preview overgeslagen. ESS/selfservice, medewerkerkalenderaanvraag, managerworkflow-UI, functiegroepnotificaties en mail zijn niet onderdeel van deze slice.

## Update 2026-07-22: kleuren en kalenderprojectie voor verlofengine

De verlofcatalogus ondersteunt nu een beheerbare kleur per verloftype en per werkurentype (waaronder overuren en informatieve planning). De migraties `20260722173000_add_work_hour_type_colors.sql` en `20260722173100_normalize_catalog_color_defaults.sql` zijn lokaal vastgelegd en live toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; work-hour catalogus-API en editor sturen `colorCode` mee. De kalender leest voor de gekozen administratie alleen `TAKEN`-transacties en `APPROVED` werkurenentries, behoudt het `employmentId`, toont een legenda, type-icoon/patroon en meerdere items per dag met detailpaneel. Strict typecheck, i18n-check, lint, productiebuild en 334 tests zijn geslaagd; de anonieme poort-3000-smoke bevestigt de beschermde redirects/401. Een inhoudelijke kalendercontrole met tenantdata wacht nog op een ingelogde browsersessie.

## Werkafspraak 2026-07-22: Supabase- en GitHub-MCP beschikbaar

Edwin heeft bevestigd dat deze omgeving werkende MCP-integraties voor Supabase en GitHub heeft. Gebruik in volgende chats de Supabase-MCP voor projectinspectie, SQL/migraties, advisors en typesgeneratie; gebruik de GitHub-MCP voor repository-, commit-, PR- en CI-taken wanneer die binnen de opdracht vallen. Een eerdere poging om dit ook in de externe Codex-memorymap te schrijven werd door filesystemrechten geweigerd; deze repository-overdracht is daarom de duurzame bron.

## Update 2026-07-22: HR-admin-verlofaanvraag als stap 8 vastgelegd

De nieuwe requirements staan in `docs/requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md`. De scope is uitsluitend verlof aanvragen door een geautoriseerde HR-admin of geautoriseerde manager vanuit een aangeklikte medewerkerdag in `/hr-calendar`; ESS/selfservice en chatbot blijven buiten scope. Het harmonica-menu krijgt onder **Medewerker**, boven **Acties**, de acties voor aanvragen via voorrangsregels en zonder voorrangsregels.

De flow is altijd per `Employment`: bij één geldig actief dienstverband automatisch, bij parallelle dienstverbanden expliciet kiezen en nooit aggregeren. De nieuwe canonieke permission wordt `leave:request`, standaard gekoppeld aan `TENANT_ADMIN`/HR-admin en tenantbreed aanvullend selecteerbaar via de bestaande rechtenmatrix. Een geautoriseerde manager boekt direct goedgekeurd binnen de bestaande scope; medewerkers krijgen dit recht nooit. De requirements leggen de keuze bij nul/één/meerdere priority-bundels, directe keuze zonder bundel, volledige dag/voor-/namiddag/specifieke uren, een per administratie configureerbare halve-dagduur (standaard vier uur), meerdaagse volledige dagen, roosterberekening, saldo nu versus saldo einde kalenderjaar, saldo-/limietcontrole, detail per verloftype, FIFO, atomische boeking, idempotentie en audit vast.

De functionele keuzes voor deze stap zijn nu compleet: feestdagen worden in meerdaagse reeksen overgeslagen; zonder priority-bundel toont de route alle actieve verloftypen met saldo nu, saldo einde kalenderjaar of onbeperkt. Functiegroepnotificatie is bewust doorgeschoven naar de latere mail/notificatiestap. Er is in deze beurt geen database-, API- of UI-code gewijzigd.

## Update 2026-07-22: stap 3 t/m 5 en priority-sub-slice van stap 6 uitgevoerd

De configuratie-mutaties gebruiken nu de RLS-gebonden API en voor samengestelde wijzigingen de remote functies uit `20260722151920_add_leave_configuration_mutation_functions`: opvolgerregels worden in één transactie aangesloten, bonusregels worden met treden aangemaakt, en profieltoewijzing, uitzonderingen, priority-regels en catalogus archiveren/bewerken zijn beschikbaar. De functies zijn op Supabase gecontroleerd met execute-rechten voor `authenticated`; types zijn lokaal bijgewerkt.

Stap 4 staat in `/settings/leave-accrual`: de permission-gestuurde instellingstegel, klantcatalogus met tabs voor verlof/overuren/werkuren en formulieren voor aanmaken, bewerken en archiveren. Stap 5 bevat de profielgebonden opvolgerketen en opbouwregel-editor voor frequentie, moment, hoeveelheid/ratio, gekoppelde uren, pauzetypen en vervaltermijn. De priority-sub-slice van stap 6 staat in `/settings/leave-accrual/priority-rules`: een jaargeselecteerde lijst en editor voor profiel, geldigheid, actieve status, unieke aaneengesloten afboekvolgorde, eerste/laatste afboeken en FIFO-uitleg. Jaarafsluiting, carry-forward en saldo-audit uit stap 6 zijn nog niet gebouwd. Screenshots zijn alleen als layoutreferentie gebruikt; fictieve testdata is niet ingezaaid. De lokale controle is uitgevoerd met lint, strict typecheck, 333 tests, i18n-check, productiebuild en beschermde routesmoke op poort 3000.

Bewust nog open: startsaldo-mutaties, centrale bucket/grootboekopbouw, jaarafsluiting/carry-forward, saldo-audit en verlofaanvragen. Directe writes naar buckets/transacties blijven geblokkeerd totdat die centrale engine inclusief jaar-lock en idempotentie als aparte veilige slice is gebouwd. Lokale Supabase-validatie blijft afhankelijk van Docker; remote structuur/advisors zijn gecontroleerd.

## Update 2026-07-22: stap 1 t/m 3 verlofopbouw-engine uitgevoerd

De Supabase-MCP heeft de databasefundering toegepast als `20260722142551_add_leave_engine_foundation`, aangevuld met FK-indexen in `20260722144232_add_leave_engine_fk_indexes` en `20260722144344_add_leave_transaction_bucket_fk_index`. De SQL-structuurtest `apps/hr-suite/supabase/tests/leave_engine_foundation.sql` is tegen de gekoppelde database uitgevoerd. `packages/db/types.ts` is opnieuw gegenereerd. De security-advisor toont alleen de al bestaande waarschuwing dat gelekte-wachtwoordbescherming uitstaat; de nieuwe verlof-FK-waarschuwingen zijn met de aanvullende indexmigraties opgelost.

Stap 2 staat in `apps/hr-suite/lib/leave/leave-engine.ts` en `report.ts`, met test-first dekking voor contracturen, goedgekeurde gewone/overwerkuren, informatieve uren, ratio/pauze, upfront/arrears, expliciete payroll-frequentiefout, verval, bonus-/triggerdatum, schrikkeldagbeleid en FIFO. Stap 3 staat in `apps/hr-suite/lib/leave/leave-service.ts` en de routes `/api/leave/balance-report` en `/api/leave/catalog`: server-auth/RLS-scope, één automatisch geselecteerd actief dienstverband, selectiegegevens bij meerdere parallelle dienstverbanden, catalogus-GET en geautoriseerde basiscreatie van verloftypen, werkurentypen en profielen.

Lokale Supabase/Postgres-validatie blijft afhankelijk van een gestarte Docker-container; de gekoppelde MCP-database, advisors, types en remote SQL-structuurtest zijn wel gecontroleerd. Nog open: HR-admin UI, volledige opvolger-/bonus-/priority-/jaarafsluit-/startsaldoflows, centrale schrijfengine voor buckets/grootboek, publieke preview en verlofaanvragen.

## Update 2026-07-21: verlofopbouw-engine als nieuwe modulebasis

De leidende requirements voor de nieuwe verlofmodule staan in `docs/requirements/leave/VERLOF_OPBOUW_ENGINE.md`. De eerste slice is uitsluitend de HR-adminpagina `/settings/leave-accrual` plus de dienstverbandgebonden opbouw-, saldo-, verval- en configuratie-engine. Een Employee kan parallelle Employments hebben; ieder Employment krijgt daarom eigen profieltoewijzingen, buckets, grootboek en saldo. Verlofaanvragen, selfservice, accordering en daadwerkelijke TAKEN-boekingen volgen pas later, al zijn de priority/FIFO-regels en cross-year-voorwaarden nu vastgelegd.

De opbouwregels zijn aangescherpt: geen opbouw buiten een geldig dienstverband; nuluren- en overwerkopbouw komt uitsluitend uit goedgekeurde, dienstverbandgebonden werkurenentries van gekoppelde typen; informatieve werkurentypen (zoals thuiswerken, opleiding en beurs) tellen nooit mee. De ratio verlofuren per gewerkt uur is per opbouwregel configureerbaar, zonder vaste standaard. Ieder verloftype is opbouwend, onbeperkt, vast-gelimiteerd per kalenderjaar of begrensd als gemiddelde weekuren maal factor. Een opbouwregel kan gericht pauzeren tijdens één of meer geselecteerde opgenomen verloftypen; vermindering is pro rata per getroffen uren. Toekenning kan aan het begin of einde van de gekozen frequentie gebeuren. Opbouwregels vormen per profiel/verloftype een aansluitende voorganger-/opvolgerketen; HR selecteert iedere versie in het overzicht, maar wijziging maakt altijd een opvolger. Jaarafsluiting maakt een immutable carry-forward-snapshot van positieve buckets met hun originele vervaldatum voor het volgende jaar, zonder saldo te dupliceren, en bevriest alle regelversies die in het afgesloten jaar golden. De verplichte `getLeaveBalanceReport`-projectie levert per dienstverband en verloftype voor medewerker en geautoriseerde manager het beginsaldo inclusief carry-forwards, saldo nu, prognose einde kalenderjaar/dienstverband, maandelijkse opbouwmomenten, verval, handmatige HR-mutaties en later opnames. Migratiesaldi worden als datumgebonden, immutable startbucket geboekt. Leeftijdsbonus volgt de verjaardag, anciënniteitsbonus `employments.seniority_date` of voor beide 1 januari; verval wordt op de ingestelde datum afgetrokken, na de geconfigureerde maanden vanaf einde opbouwjaar.

Vóór de engine- en API-bouw resten alleen de fallback voor een geldige `PAYROLL_PERIOD` zonder salarisfrequentie en de niet-schrikkeljaar-datum voor 29 februari. Het stap-1-schema staat klaar; route, UI en engine ontbreken nog.

## Update 2026-07-19: medewerkerlijst- en persoonskaart UX

De medewerkerslijst bewaart nu per ingelogde gebruiker de filterpaneelstatus, weergave (detail/compact), sortering, arbeidsstatusfilter en archiefstatus in `user_preferences.ui_state.employeesList`; de zoekterm wordt bewust niet opgeslagen. Filterwijzigingen worden via `/api/preferences/employees` gevalideerd opgeslagen. Enter voert de zoekopdracht uit en de wisactie in het zoekveld verwijdert alleen de zoekterm. In detail- en compactweergave is de volledige medewerkersrij klikbaar.

De medewerkerdetailpagina opent nu op de hoofdtab `Overzicht`, vóór `Persoonsgegevens`. Het overzicht bevat contact/adres/bank/noodcontact en een peildatum-samenvatting van het huidige dienstverband met arbeidsvoorwaardengroep, uren per week, salaris, afdeling en functie. Salarisdata wordt alleen opgehaald met `salary:read` en visueel vervaagd achter een lock-icoon; hover/focus toont de waarde. De aanvullende gegevenskaart blijft uitsluitend onder `Persoonsgegevens` zichtbaar. De subtab `Overzicht` is uit de persoonskaart verwijderd.

Verificatie 2026-07-19: 84 Vitest-bestanden/313 tests, ESLint, strict TypeScript, i18n-check en productiebuild met 64 static pages/routes geslaagd. Poort 3000 draait; anonieme `/employees`-controle redirecteert naar `/login?next=%2Femployees`. Een ingelogde medewerkerdataset-browsercontrole is in deze beurt niet beschikbaar in de verse Playwright-sessie.

## Update 2026-07-19: main als enige live/testbranch

De afgesproken workflow is voortaan eenvoudig: `main` is de enige blijvende branch voor test en live; featurebranches/worktrees zijn tijdelijk en worden na geslaagde controles naar `main` gemerged en verwijderd. Vercel Production volgt GitHub `main`; preview-deployments zijn test-only. Controleer na push altijd de Vercel deployment-commit en de GitHub `main`-commit.

De HR-admin-stamtabellen bevatten nu ook aanpasbare tenant-relatietypen. De nieuwe relatie-typecatalogus is live toegepast, inclusief tekstcodes, tenant-FK, index en RLS uit de eerdere migratie. Feestdagen die handmatig zijn toegevoegd zijn in de instellingenlijst accentkleurig gemarkeerd. Het organogram heeft altijd zichtbare weergavekeuze: afdelingen, managerrelaties zonder afdelingsvensters en functiegroep → functie → medewerker met afdeling op de medewerkerkaart.

Vervolgslice 2026-07-19: HR-admininstellingen gebruiken standaard gesloten accordions met terugnavigatie naar de juiste sectie. `/master-data` bevat beheersbare interne uitdienstredenen, documentcategorieën en tenant-relatietypen, plus links naar functie- en salariscatalogi. Documentuploads selecteren uitsluitend actieve Cloud tags uit `star_performer_tags`; de oude upload-uitlegtekst is verwijderd. De org-chart canvas gebruikt meer laagruimte en duidelijk onderscheiden verbindingslijnen. Migratie `20260719170000_add_tenant_relation_type_catalog.sql` is live toegepast met RLS, seedrecords en database-smokecontrole. Applicatieversie volgt na de releasegate.

Vervolgslice 2026-07-19: de medewerkerslijst en het organogram in worktree `settings-rosters-calendar` zijn functioneel verdergetrokken. De medewerkerslijst filtert nu standaard op `ACTIVE_EMPLOYEE`, zodat de telling logischer aansluit op de kalender. De lijst toont daarnaast expliciet het personeelsnummer per rij, zodat twee verschillende personen met dezelfde naam niet meer ogen als een render-dubbeling. De bestaande analyse blijft: het eerdere verschil `11` versus `23` kwam vooral voort uit verschillende definities van "zichtbare medewerker" tussen kalender en medewerkerslijst, niet uit een eenvoudige dubbele-renderbug.

De migraties voor strengere dossieruploads, persoonlijke weeknummering en Star Performers zijn op 2026-07-19 live toegepast. De Star Performer- en Cloud tags-tegels zijn actief voor geautoriseerde beheerders; de drie databaseproeven, typesgeneratie en security-advisor zijn uitgevoerd. Applicatieversie: `1.20260719.5`.
Het organogram ondersteunt nu drie views via de filterbalk: `Afdelingen`, `Managerrelaties` en `Functiegroepen en star performers`. De managerweergave tekent direct op medewerker-managerrelaties zonder afdelingsvensters; de functieweergave groepeert op functiegroep → functie → star performer-niveau → medewerker en ondersteunt daardoor meerdere startpunten en losse medewerkers. De gekozen organogramview wordt nu ook correct in `user_preferences.ui_state.organizationChart` bewaard.

## Update 2026-07-24: inzichten, roltoewijzingen en platforminstellingen

De Insights-werkruimte heeft nu een blijvende smalle instellingenrail die na inklappen opnieuw geopend kan worden, een semikolon-CSV met UTF-8-BOM voor Excel, en toastmeldingen voor exportresultaten. De trendweergave gebruikt één lijn-grafiek op basis van dezelfde geselecteerde, geautoriseerde rapportdata.

Organisatietoewijzingen zijn uit Rollen en autorisaties gehaald. De nieuwe pagina `/role-assignments` beheert expliciete leidinggevende en tenantbrede aanvullende rollen met zoeken, rolfilter, matrixlijst, verwijderen, export en controlewaarschuwing wanneer de actuele afdelingsplaatsing van een medewerker niet meer overeenkomt met de rolscope. Een functiewijziging binnen dezelfde afdeling laat de rol bestaan; een afdelingswijziging vraagt HR om de toewijzing bewust te beëindigen of te verplaatsen. De medewerkerkaart toont de actieve roltoewijzingen en afdelingsscope.

Migratie `20260724112407_add_role_assignment_scope.sql` is live toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. `TENANT_ADMIN` en `EMPLOYEE` zijn tenantbreed; `DIRECT_MANAGER` en zelfgemaakte organisatiegebonden rollen vereisen een afdeling. Organogramprojectie gebruikt alleen organisatiegebonden toewijzingen met afdeling. Module-opslag ververst nu de layout direct. Platforminstellingen bevatten een menuvolgorde-paneel; de volgorde wordt per browser opgeslagen en op de linker navigatie toegepast.

Verificatie 2026-07-24: Supabase SQL-controle voor de drie systeemrollen, security advisor zonder nieuwe waarschuwing, volledige Vitest (92 bestanden/340 tests), strict TypeScript, ESLint, NL/EN i18n-check en productiebuild geslaagd. Een ingelogde visuele browsercontrole en de laatste release/public-preview handelingen blijven nog open.

Aanvulling 2026-07-24: `/insights/upcoming-events` gebruikt de bestaande live tabel `tenant_anniversary_rules` en toont echte verjaardagen, werkjubilea (`employments.seniority_date`) en nieuwe indiensttredingen. De periode is 7 dagen, 4 weken of 12 weken; filters ondersteunen één of meer afdelingen en de drie gebeurtenistypen. Export is Excel-compatibele CSV. `/settings/anniversary-rules` beheert per tenant de jubileumjaren; de bestaande regels zijn 1, 5 en 25 jaar. Dit staat los van verlofbonus-treden: die horen functioneel bij Verlofopbouw (`leave_bonus_rules`) en zijn nog niet als afzonderlijk formulier in de settings-UI ontsloten.

## Vaste architectuur

Liquid HR is een Nederlandstalig, i18n-klaar HR/payrollplatform op Next.js, Supabase en strict TypeScript. Bouwvolgorde is `schema → API → UI`. Tenantgrenzen zijn absoluut, autorisatie wordt server-side én met RLS afgedwongen en zichtbare tekst komt uit paritaire NL/EN-taalbestanden.

## Actuele stand

- HeRa is een data-first HR-agent met echte sessierollen/permissions, geautoriseerde lees- en voorsteltools, ownergebonden geheugen en voorkeuren. Lege toolvervolgreacties krijgen een veilige fallback in plaats van een databaseconstraint/500.
- De vijfstappenwizard publiceert atomair Employment, IKV-koppeling, plaatsing, arbeidsvoorwaarden, rooster, optioneel salaris en een kostenverdeling van exact 100%.
- Functiegroepen, functies en effective-dated functie- en salarisschaalrevisies zijn per administratie beheerbaar. Gepubliceerde revisies zijn onveranderlijk.
- Iedere medewerker heeft een veilig documentdossier met private opslag, metadata, tags, gecombineerde zichtbaarheid, signed downloads, soft-delete/herstel en vervalreminders.
- De dienstverbanddetailpagina bevat een responsieve tijdkaart en een afzonderlijke roosterpagina met 1–4-weeks werkpatronen, begin/einddatum en exacte controle tegen de contracturen.
- `/hr-calendar` toont alle medewerkers in een groot gelokaliseerd maandraster met roosters, niet-werkdagen, feestdagen, reminders en HR-wijzigingen. Zoeken, medewerker-/afdelingsfilters, 10/25/alle-max-100 paginering, doorklik en een uitbreidbaar dagdetail zijn aanwezig.
- HR-beheer staat achter één permission-gestuurde instellingenhub. Extra modules gelden tenantbreed; feestdagen kunnen per jaar en land vanuit Nager.Date worden geïmporteerd en lokaal worden aangevuld. Persoonlijke taal-, thema- en klokvoorkeuren blijven op een afzonderlijke pagina voor iedere ingelogde gebruiker.
- Autorisatiebeheer heeft drie werkruimtes: zoekbaar rechtenbeheer met groepsacties/dirty-state, een toegankelijke dekkingsheatmap en afzonderlijke organisatietoewijzingen. De visualisatie verleent nooit toegang; exacte permissions, scope en RLS blijven beslissend.
- Medewerkers kunnen nu als reversible archiefvlag worden beheerd. De lijst ondersteunt niet-gearchiveerd/gearchiveerd/alles, organogram en kalender sluiten gearchiveerden standaard uit, en de persoonskaart heeft duidelijke tabs voor persoonsgegevens, dossier en dienstverbanden. Foto's zijn private uploadbaar/verwijderbaar en zichtbaar in lijst en kalender; het organogramfilter onthoudt de laatste selectie per gebruiker.
- De medewerkerslijst gebruikt nu `ACTIVE_EMPLOYEE` als impliciete statusdefault en neemt in de zoekindex ook tussenvoegsel, afdeling en functie mee. Daardoor sluit de standaardtelling beter aan op de kalender. Personeelsnummers zijn zichtbaar in de lijst, zodat naamgelijkheden niet meer ogen als onbedoelde duplicaten.
- Het organogram ondersteunt nu naast de afdelingsboom ook een managerrelatie-weergave en een functieweergave met star performer-groepering. De mobile tree, canvasnodes, schema's, services en URL-state zijn daarop aangepast; de view-keuze wordt per gebruiker opgeslagen.
- Applicatieversie: `1.20260719.5` in `apps/hr-suite/lib/app-version.ts`; dashboardervaring, HR-adminaccordions, stamtabellen en Cloud-tagdocumentuploads staan op `main`.

## Live database en verificatie

- Supabase-project `wnpfloqpjvaacobppbpk` is gezond. De HeRa-migraties en migraties `20260718090000` t/m `20260718132000` zijn live toegepast.
- Live SQL-proeven voor HeRa-isolatie, volledige dienstverbandpublicatie, functie/salarisrevisies, documentdossiers, HR-change-projectie en kalenderautorisatie zijn geslaagd.
- De samengevoegde releasegate is geslaagd: 72 Vitest-bestanden met 271 tests, 18 gelijke NL/EN-namespaces, strict TypeScript, ESLint en een productiebuild met 51 routes.
- Supabase security advisor meldt alleen uitgeschakelde leaked-password protection. Deze functie is vanaf Pro beschikbaar en binnen het huidige abonnement niet inschakelbaar; dit is een geaccepteerde abonnementsbeperking.
- Preview `https://liquidhr-pbftcw6t7-edwinitsolutions.vercel.app` is `READY`; een anonieme aanvraag voor `/settings` gaat veilig naar `/login?next=%2Fsettings`.
- Release `1.20260718.3` staat op `https://liquid-hr-hr-suite.vercel.app`. De instellingenhub, tenantmodules, Nager.Date-preview, persoonlijke instellingen en de volledige maandkalender zijn met een bestaande ingelogde HR-adminsessie gecontroleerd. De kalenderformattering volgt nu de actieve NL/EN-taal.
- Release `1.20260718.4` is lokaal gebouwd en branch `codex/settings-rosters-calendar` is naar GitHub gepusht. Een Vercel CLI-deploy kon in deze sessie niet starten omdat de lokale Vercel-credentials ontbreken; de gekoppelde Git-deployment kan de branch als preview oppakken.
- Runtime-hotfix: `employees.is_archived` had in Supabase wel de kolom maar geen expliciete `SELECT`/`UPDATE`-grant voor `authenticated`. De grants zijn live toegevoegd en de PostgREST-schema-cache is herladen; dit herstelt de medewerkerlijst en kalender.
- Verificatie 2026-07-19 (medewerkerslijst + organogramviews): gerichte ESLint `--fix` met cache op de in deze beurt gewijzigde organogrambestanden is geslaagd. Strict TypeScript, `check:i18n` en gerichte Vitest voor `app/api/organization-chart/route.test.ts`, `lib/organization-chart/schemas.test.ts` en `lib/organization-chart/projector.test.ts` zijn geslaagd. Runtimecontrole met timeouts bevestigt opnieuw een actieve Next-devserver op poort `3000`; `/`, `/employees` en `/organization-chart` reageren zonder serverfouten en redirecten beschermd naar login. Poort `3001` reageert niet en wordt in deze worktree niet gebruikt.

## Bewust resterend werk

1. Basis/IKV en organisatieplaatsing op de bestaande dienstverbanddetailtabs mutabel maken.
2. Nieuwe persoonskaart vanuit de dienstverbandflow bij geen identity-match.
3. Externe ketenhistorie en cao-uitzonderingen beheren.
4. Globale documenten, bulk-loonstrookimport en AI-compliance/OCR/RAG.
5. Vrije Liquid Display-query's en verdere HeRa-transactietools.
6. Dashboardwidgets hebben nu tenantconfiguratie, roltoegang, registry, vertaalde metadata, categorie-picker, serverbootstrap, parallelle streaming, skeletons, globale laadvoortgang en refresh. WELCOME, reminders, organisatie en medewerkers laden echte bestaande bronnen; overige cataloguswidgets tonen eerlijk dat hun bron nog wordt aangesloten, zonder fictieve HR-cijfers.
7. De nieuwe organogramviews zijn technisch gevalideerd, maar vragen nog een ingelogde visuele browsersessie om de echte dataset, meerdere startpunten en star performer-groepering UX-matig te controleren.

## Handmatige productieacties

- Heroverweeg leaked-password protection alleen bij een toekomstige Supabase-upgrade naar Pro of hoger.
- Configureer SMTP, Google OAuth/redirects en stabiele server-only secrets per omgeving.

Zie `docs/delivery/HANDMATIGE_ACTIES.md` voor de externe actielijst. Gebruikerswijzigingen in dat bestand en `package-lock.json` worden niet overschreven.

Documentenslice 2026-07-26: de leidende blueprint staat in `docs/requirements/documents/Documenten_en_Dossier_Systeem_Master.md`. Het medewerkersdossier heeft een viewer en expliciete categorie-verwijderguardrail; bedrijfsdocumenten hebben private tenantbrede opslag, HR-beheer en dashboardwidget; loonstroken hebben een eigen tab, employment-koppeling en strict permission/RLS-readpad. De vier nieuwe Supabase-migraties zijn op de testdatabase toegepast en met lege documenttabellen gecontroleerd. Bulkimport, Nmbrs/Loket-koppelingen en AI/OCR/RAG zijn bewust later.

Functiecatalogus-UI 2026-07-26: de job- en functiegroepbeheerpagina is nu lijst-eerst met zoeken, sortering, groepsfilter, duidelijke add-knoppen en modal-formulieren voor toevoegen/wijzigen/verwijderen. De `event.currentTarget.reset()`-crash is opgelost door het form-element vóór de async request vast te leggen. Typecheck, lint, i18n, build en lokale desktop/390px-browsercontrole zijn geslaagd.

## Update 2026-07-27: Supabase-connectie en lokale runtime

De Supabase REST- en Auth-endpoints zijn read-only gecontroleerd voor project `wnpfloqpjvaacobppbpk`: REST-query `tenants` gaf HTTP 200 en Auth settings gaf HTTP 200. De officiële MCP-endpoint is bereikbaar maar geeft zonder OAuth-sessie HTTP 401. De projectconfiguratie staat nu in `.mcp.json`; authenticatie en de remote migratie-uitrol moeten nog vanuit een MCP-sessie worden afgerond. De lokale Next-server is op poort 3000 gereset; het oude listenerproces is gestopt, een nieuw proces luistert op 3000 en `/login` geeft HTTP 200. Browsercontrole van `/login` is uitgevoerd.

## Update 2026-07-27: verzuim remote uitgerold en releasegate

De migratie `20260726150000_add_absence_core.sql` is rechtstreeks op het gekoppelde Supabase-project toegepast nadat de FK-unieke constraint voor tenant/casus was gecorrigeerd. De aanvullende migraties `20260727155229_harden_absence_security.sql`, `20260727181000_revoke_absence_anon_grants.sql` en `20260727182000_harden_absence_recovery_idempotency.sql` verplaatsen de interne SECURITY DEFINER-logica naar `internal_security`, trekken anonieme tabelrechten in, laten alleen authenticated de publieke invoker-wrappers aanroepen, splitsen de instellingenpolicies en maken herstel idempotent. Alle vier migraties zijn als applied geregistreerd. De historische remote migratiegeschiedenis bevat oudere versies die niet in deze checkout staan; daarom is `db push` niet als migratiebron gebruikt en zijn bestaande versies niet gerepareerd.

Remote bewijs: `absence_cases`, `absence_spells`, `absence_capacity_changes`, `absence_mutations` en `absence_settings` hebben RLS; de privacycontractproef bevestigt geen medische oorzaakvelden, een verzuimselectpolicy en geen leesrecht op mutatiesleutels. De PostgREST-query op `absence_cases` geeft voor de publieke sleutel HTTP 200 met een lege dataset. De Supabase security-advisor toont geen nieuwe verzuimbevindingen; alleen bestaande waarschuwingen voor oudere leave-RPC's, enkele bestaande dubbele policies en uitgeschakelde leaked-password protection blijven staan. `packages/db/types.ts` is opnieuw gegenereerd met de officiële gekoppelde database-types.

Releasegate 2026-07-27: applicatieversie `1.20260727.2`; 101 testbestanden/369 tests, strict typecheck, ESLint, i18n-pariteit en productiebuild zijn geslaagd. De devserver is opnieuw gestart en luistert op poort 3000; `/login` geeft HTTP 200. De in-app browser had geen bestaande ingelogde tab, dus alleen de publieke loginstaat is gecontroleerd. Een ingelogde end-to-end verzuimactie blijft handmatig open totdat een gebruiker in de browser is aangemeld. De kernverzuimslice en HR-admininstellingen zijn af; wettelijke WvP-milestones/casustaken/dossier, voorziening/bewaarduur, payroll/13-wekenmodel, rapportages en externe integraties zijn niet onderdeel van deze afgeronde slice.

## Update 2026-07-27: Gebruiker Startpagina

De nieuwe server-rendered Startpagina staat op `/dashboard/start` en is als ingesprongen item **Startpagina** onder **Dashboard** toegevoegd aan het hoofdmenu. `/` verwijst nu naar deze startpagina; `/dashboard` blijft de bestaande vrije dashboardwerkplek voor later besluitvorming. De UI gebruikt alleen bestaande RLS-scoped bronnen: medewerkers, afdelingen, verzuim, bedrijfsdocumenten en gepubliceerde persoonlijke reminders. Declaraties, contractondertekening, activumaanvragen, taken/Poortwachter en gebeurtenissen tonen bewust **Werk in uitvoering** zonder voorbeelddata. NL/EN heeft een volledige `startpage`-namespace.

Verificatie: `check:i18n`, strict TypeScript, ESLint, 99 Vitest-bestanden/364 tests en productiebuild geslaagd. Poort 3000 geeft `/login` HTTP 200 en `/dashboard/start` zonder sessie een veilige 307 naar `/login?next=%2Fdashboard%2Fstart`; de verse browser had geen ingelogde sessie, dus de beschermde Startpagina-dataset en 390px-UI blijven handmatig open.

## Update 2026-07-27: Startpagina login- en autorisatiescope

De veilige fallback van de login- en auth-callbackflow is gewijzigd naar `/dashboard/start`; een expliciete veilige `next`-bestemming blijft leidend. De startpagina, reminderwidgets, bedrijfsdocumentenservice en bestaande dashboardwidgets filteren nu expliciet op de actieve administratie wanneer die context van toepassing is. Medewerkerstellingen gebruiken actuele `employee_administration_assignments` en blijven daarna onder de bestaande permission- en RLS-scope vallen. In gecombineerde tenants blijft de tenantbrede context intact.

De read-only live-audit van Supabase bevestigde RLS op medewerkers, administratie-toewijzingen, afdelingen, verzuim, bedrijfsdocumenten en reminders. Er was één echte omissie: `company_documents` en private `company-documents` storage-objecten waren alleen tenant-scoped. Migratie `20260727161805_harden_company_document_administration_scope` is live toegepast en beide read-policies gebruiken nu `has_administration_access`. De security advisor meldt daarnaast alleen bestaande, niet aan deze wijziging gerelateerde bevindingen. De anonieme routecontrole blijft geslaagd; een echte ingelogde rolmatrix voor desktop/390px vraagt nog een beschikbare browsersessie met testgebruikers.

De Startpagina is daarna als volwaardig hoofdmenu-item naast Dashboard gezet. `/dashboard/start` staat ook in de beheerpagina Menuvolgorde; ontbrekende nieuwe items vallen bij bestaande lokale menuvoorkeuren terug op hun standaardpositie.

## Update 2026-07-27: HR-admin verzuimbeheer en eigen WvP-taaktemplates

`/settings/absence` is uitgebreid van een statisch formulier naar een administratiegebonden HR-adminscherm. De pagina laadt de echte frequentieverzuimdrempel en alleen actieve medewerkers met een Liquid HR-gebruikersaccount als standaardcasemanager. De API valideert bereik, administratie en casemanagerkeuze server-side en toont duidelijke foutstatussen in de UI.

De nieuwe migraties `20260727164511_absence_task_templates.sql` en `20260727165641_absence_task_template_immutability.sql` zijn remote toegepast en als applied geregistreerd. `absence_task_templates` heeft tenant-/administratiescope, RLS, audittrigger, geen anon-grants, soft-deactivatie en immutable tenant-, administratie-, code- en systeemvelden. De nieuwe API `/api/settings/absence/tasks` en het lijst-eerst scherm ondersteunen eigen niet-wettelijke taaktemplates met code, deadline na casusstart, bewijsvereiste en activatie/deactivatie. Er zijn bewust geen wettelijke taken geseed zolang de inhoudelijke validatie ontbreekt; de remote beginstand is leeg.

Verificatie: remote RLS/grants zijn groen (`rls_enabled=true`, anon select=false, authenticated select=true); Supabase SQL-lint toont alleen bestaande bevindingen buiten verzuim. De nieuwe schema-, settings- en tasktests zijn geslaagd, i18n-pariteit, strict typecheck, ESLint en productiebuild zijn geslaagd. De in-app browser heeft nog geen beschikbare ingelogde tab; `/settings/absence` redirecteert zonder sessie veilig naar `/login?next=%2Fsettings%2Fabsence`.

## Update 2026-07-27: ingelogde browsercontrole verzuim

De bestaande Codex-in-app-browser-tab op `http://localhost:3000/dashboard/start` is succesvol geclaimd; de sessie is ingelogd als `edwin@editsolutions.nl` in administratie `Liquid HR Demo Holding B.V.`. De startpagina toont echte tellingen (6 actieve medewerkers, 0 actieve verzuimgevallen) en versie `1.20260727.2`. `/settings/absence` rendert de echte frequentiedrempel (3), casemanagerkeuze en het lijst-eerst scherm voor eigen WvP-taaktemplates. De medewerkerkaart van Lina Bakker rendert het tabblad **Verzuim** met eerste ziektedag, arbeidsongeschiktheidspercentage, verwacht herstel en opslaanknop. In `/hr-calendar` is na selectie van Lina's dagcel de actie **Ziek melden** zichtbaar met de datumparameter; de kalender toont daarnaast de personeelskaartactie. Geen demo-ziekmelding of taaktemplate is opgeslagen tijdens deze read-only controle.

## Update 2026-07-27: rijke verzuimtestfixture Fin en Noah

De expliciet geautoriseerde testfixture `20260727171300_seed_rich_absence_demo_employees.sql` is rechtstreeks toegepast op Supabase-project `wnpfloqpjvaacobppbpk` en als applied geregistreerd. De migratie gebruikt vaste UUID's, is idempotent uitgevoerd (tweede run gaf dezelfde aantallen) en raakt uitsluitend de demo-tenant `Liquid HR Demo Holding`.

Toegevoegd voor **Fin de Groot** (`TEST-VERZ-047`) en **Noah Hendriks** (`TEST-VERZ-048`): actieve medewerkerprofielen, administratie-toewijzing, organisatieplaatsing met afdeling/functie/manager, primair dienstverband en contract, loonrelatie/IKV, arbeidsvoorwaarden, rooster, salaris, kostenallocatie, adres, gemaskeerde bankrekening, twee relaties, vier gepubliceerde HR-reminders, twee verzuimcasussen per medewerker (één actief en één gesloten met herstelhistorie), ziekteperiodes/capaciteitswijzigingen en drie eigen niet-wettelijke testtaaktemplates. Er zijn geen BSN's, medische oorzaken of echte contactgegevens gebruikt; e-mailadressen eindigen op `.invalid`.

Remote verificatie: 2 medewerkers, 2 toewijzingen, 2 organisatiekaarten, 2 dienstverbanden, 2 loonrelaties, 2 arbeidsvoorwaarden, 2 roosters, 2 salarissen, 2 kostenallocaties, 2 adressen, 2 bankrekeningen, 4 relaties, 4 reminder-ontvangers, 4 verzuimcasussen, 4 ziekteperiodes, 4 capaciteitsregels en 3 testtemplates. De actieve casussen zijn Fin 70% vanaf 2026-07-18 en Noah 50% vanaf 2026-07-08; de historische casussen zijn gesloten.

Applicatieversie verhoogd naar `1.20260727.3`; de versie-unit-test en de zichtbare versietekst op `/dashboard/start` zijn geslaagd.

Ingelogde browsercontrole geslaagd: `/employees` toont beide medewerkers, hun detailkaarten tonen organisatie-, adres-, relatie-, bank- en dienstverbandgegevens, het tabblad **Verzuim** toont actieve en gesloten historie, `/hr-calendar` toont beide namen en `/dashboard/start` toont 2 lopende verzuimgevallen. Het geopende tabblad staat op de startpagina. Supabase `db lint` gaf alleen reeds bestaande waarschuwingen buiten deze fixture (`create_job_with_revision`, `upsert_star_performer_assessment` en de bestaande leave-RPC `create_leave_opening_balance`).

## Update 2026-07-27: Startpagina en verzuimrapportage

De Startpagina toont naast de verzuim-KPI nu een compacte lijst met lopende verzuimgevallen. Iedere rij bevat medewerker, startdatum, duur, status en een directe link naar het tabblad **Verzuim** in het medewerkerdossier; de lijst blijft administratie-, permission- en RLS-gebonden.

`/insights?report=absence` is beschikbaar als standaard Verzuimrapport. Het rapport ondersteunt maand of volledig kalenderjaar, afdeling, KPI's, maandtrend, dossierlinks en een Excel-compatibele `.xls`-export via `/api/insights/absence`. Het percentage gebruikt geplande verzuimuren gedeeld door beschikbare geplande uren × 100, met rooster-, deeltijd- en gedeeltelijke-verzuimweging. De startpagina- en rapportlabels hebben volledige NL/EN-pariteit.

Applicatieversie verhoogd naar `1.20260727.4`. Verificatie: strict TypeScript, `check:i18n`, lint, vier gerichte verzuimquery/exporttests, productiebuild en ingelogde browsercontrole op poort 3000 zijn geslaagd.

## Update 2026-07-27: Bradford-factorrapport

Het verzuimrapport heeft een tweede rapport gekregen via `/insights?report=absence-bradford`. De Bradford-factor gebruikt `S² × D`, waarbij `S` afzonderlijke ziekteperioden telt en `D` roostergewogen verzuimdagen. De filters zijn laatste 52 weken, dit jaar, vorig jaar, team als afdeling, risiconiveau en medewerkerzoekopdracht; segment en kalendertype zijn bewust niet opgenomen. De uitlegmodal beschrijft formule, risicobanden en de menselijke beoordelingsgrens. De bestaande Excel-route exporteert ook Bradford-resultaten met actieve periode- en afdelingsfilter.

De datalaag blijft RLS-gebonden aan de bestaande `absence_cases`, `absence_spells`, capaciteit, dienstverbanden, roosters en afdelingen; er was voor deze rapportageslice geen nieuw schema nodig. Applicatieversie verhoogd naar `1.20260727.6`. Verificatie: typecheck, lint, i18n-pariteit, volledige testsuite (106 bestanden/379 tests), productiebuild en ingelogde browsercontrole op poort 3000 zijn geslaagd. De browsercontrole bevestigde de drie periodekeuzes, team/afdelingsfilter, risicofilter, uitlegmodal, dossierlinks en Excel-download.

## Update 2026-07-27: Reminderbeheer en Tijdhub

De Tijdhub in de linkerzijbalk toont nu een compacte reminderknop naast de klok. De knop opent maximaal drie actuele reminders, meldt extra reminders expliciet en bevat een werkende link naar Reminderbeheer. Een reminder opent vanuit de Tijdhub in het bestaande standaardvenster met details en acties.

`/reminders` is uitgebreid naar een interactief persoonlijk overzicht met zoeken, filteren op openstaand/alles/afgerond/verborgen, sorteren op eerstvolgende/laatste/titel, kleurcodering voor verlopen en naderende reminders, bulkselectie en bulk afronden. Kaarten tonen waar beschikbaar de medewerker en linken naar het medewerkerdossier; de detailmodal bevat dezelfde context en acties. De lijst gebruikt uitsluitend echte reminders uit de bestaande administratie- en autorisatiescope.

Verificatie: i18n-pariteit, gerichte reminder-tests, volledige lokale tests, strict typecheck, productiebuild en ESLint zijn uitgevoerd. De ingelogde browsercontrole bevestigde de Tijdhubknop, `+1 meer reminder`, de detailmodal en de filter voor oudere reminders. Er is geen schemawijziging of deployment nodig voor deze UI-slice.

## Update 2026-08-01: Talentfundament- en Tijdhub-UX

- Talentfundament gebruikt nu het bestaande instellingen-accordionpatroon met altijd precies één geopend onderdeel. De overbodige `TALENTFUNDAMENT`-eyebrow en toelichtende subtitel zijn verwijderd. De sidebarlink gebruikt dezelfde uitlijning als de overige hoofdnavigatie.
- De eerstvolgende reminder gebruikt de bestaande warning-surface als geel-notitiekaartje. Tijdhub-panelen positioneren zich naast de knop of erboven wanneer de onderzijde onvoldoende ruimte heeft en bevatten altijd een zichtbare sluitknop. De demo bevat tijdens deze controle geen verlopen reminderrecord; de gedeelde verlopen-codepad gebruikt dezelfde positionerings- en sluitlogica.
- Browsercontrole op de ingelogde lokale sessie: `/settings/talent` toont één actieve sidebarlink, geen eyebrow/subtitel en één open paneel; wisselen en opnieuw klikken op het geopende paneel laat één paneel open. Het komende-reminderpaneel had een sluitknop, overlapte de trigger niet en sloot daarna correct. De console bevatte geen errors.
- Verificatie: 111 testbestanden/410 tests geslaagd, strict typecheck, ESLint, i18n-pariteit (24 namespaces) en productiebuild (115 statische pagina's) geslaagd. Poort 3000 bleef luisteren en `/login` gaf HTTP 200.

## Hervatten

## Update 2026-08-02: stap 1 alleen-lezen supportmodus

- Vanuit een klantdetail in `apps/liquidhr-control` kunnen actieve `OWNER`/`OPERATOR`-beheerders nu een tijdelijke alleen-lezen supportsessie starten met reden en 15/30/60 minuten geldigheid. De sessie gebruikt een HttpOnly-cookie zonder token in de URL, eindigt expliciet of via vervaldatum en schrijft start/eind naar `platform_audit_logs`.
- De HR-app heeft daarvoor een aparte route `/support`, buiten de normale klantdashboard-layout. Deze toont uitsluitend een beveiligd read-model: klantmodel, administraties, aantallen actieve dienstverbanden en maximaal de eerste 100 medewerkers. Er zijn geen schrijf-, upload-, verwijder- of normale klantacties beschikbaar. Dit is bewust nog geen volledige navigatie door alle bestaande HR-schermen.
- Remote migraties `20260802234000_add_platform_support_sessions.sql` en `20260802242000_close_expired_platform_support_sessions.sql` zijn toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De supporttabel heeft RLS zonder directe table grants; publieke RPC's zijn `SECURITY INVOKER`-wrappers en interne functies zijn `SECURITY DEFINER` met operator-, tenant-, duur-, sessie- en vervaldatumcontrole. Remote controle: RLS aan, drie wrappers en drie interne definerfuncties aanwezig, nul supportsessies.
- Verificatie: control en HR strict typecheck, ESLint, i18n-pariteit, 7 controltests en beide productiebuilds geslaagd. De lokale servers antwoorden op `http://localhost:3000/login` en `http://localhost:3001/login`. De volledige browserflow is nog open: de huidige Codex-browsersessie is geldig maar geen actieve platformbeheerder en is daarom veilig op `/geen-toegang` gebleven; niet uitgelogd en geen Google-account gekozen.

## Update 2026-08-02: afzonderlijk LiquidHR Control Plane en Google-login

- Nieuwe app: `apps/liquidhr-control`, lokaal altijd via `npm.cmd run dev:control` op poort 3001. De devstarter leest alleen de publieke Supabase-waarden uit `apps/hr-suite/.env.local`; er worden geen secrets gekopieerd.
- Functies: gesloten login zonder registratie, rollen `OWNER/OPERATOR/AUDITOR`, dashboard, zoeken/filteren, klantdetail, onboarding met meerdere administraties, keuze `COMBINED/SEPARATE`, lifecycle, gebruikssnapshot en platformaudit.
- Schema: lokale migratiebestanden `20260802230000_add_liquidhr_control_plane.sql` en `20260802231000_harden_liquidhr_control_plane_rpcs.sql` plus pgTAP-contract. Remote geregistreerd als `20260802172255_add_liquidhr_control_plane` en `20260802172601_harden_liquidhr_control_plane_rpcs`; niets gedeployed.
- Verificatie: 7 domeintests, control-i18n (121 sleutels), ESLint, strict TypeScript en Next-productiebuild geslaagd. De control-app is op poort 3001 in de echte Codex-browser gecontroleerd: de eigenaar zag het dashboard met 2 klanten, 72 medewerkers en 91,7 KB opslag. De knoppen en klantenteller gebruiken nu een duidelijk licht/donker contrast. De dashboardcopy maakt expliciet dat klantdetails geen impersonatie zijn, de technische naam is de zoekterm en recente platformactiviteiten worden daar geregistreerd. De login bevat naast wachtwoord ook Google OAuth met een server-side callbackroute.
- Remote verificatie: vijf control-tabellen en vijf RLS-configuraties aanwezig; beide bestaande tenants bleven `ACTIVE`; anonieme RPC-execute is geblokkeerd; Edwin is actieve `OWNER`; een niet-geregistreerde Auth-identiteit krijgt geen platformtoegang; control-plane security-advisor heeft 0 bevindingen. Gedeelde DB-types zijn opnieuw gegenereerd.
- Handmatig resterend: voeg in Supabase Auth → URL Configuration de exacte redirect-URL `http://localhost:3001/auth/callback` toe. Google-provider en de bestaande operatorregistratie blijven gedeeld met de HR-app; een wachtwoordreset is niet nodig voor Google-login.

## Update 2026-07-31: Talent-navigatie, tenantrechten en performance

- De dubbele Talent-navigatie is verwijderd. `/settings/talent` is het Talentfundament en verschijnt uitsluitend met `talent:manage`; `/workforce/talent` is niet langer een zijbalkitem. Managers met `talent:manager-read` openen Talentprofielen via de tegel op `/workforce`. De actieve navigatiestatus gebruikt exacte matching voor `/settings` en houdt `/workforce` als enige actieve ouder op Talentprofielen.
- De tenant-specifieke TENANT_ADMIN-override van Edwin's actieve demo-tenant miste de drie Talentrechten. Het lokale migratiebestand `20260731193000_grant_talent_permissions_to_demo_tenant_admin.sql` is alleen op die demo-tenant toegepast voor `talent:manage`, `talent:manager-read` en `talent:read`; Supabase registreerde de uitvoering als `20260731172748_grant_talent_permissions_to_demo_tenant_admin` door de bestaande remote tijdlijn. De andere demo-tenant is niet aangepast.
- De dashboard-layout hergebruikt nu de bestaande Supabase-client en auth-/tenantcontext bij gebruikersvoorkeuren en branding. Daarmee vervallen dubbele auth-, administratie- en clientinitialisaties bij iedere dashboardroute.
- Ingelogde browsercontrole op poort 3000 bevestigde: `/workforce` heeft één actieve navigatielink en de Talentprofielen-tegel; `/workforce/talent` heeft alleen Workforce actief; `/settings/talent` heeft alleen Talentfundament actief. De routes laden met de bestaande demo-data.
- Performancebewijs: een eerste dev-compile kan door Next.js ongeveer 9--15 seconden duren; warme serverrequests voor de gecontroleerde routes lagen rond 0,8--1,3 seconden. Dit is een lokale dev-observatie, geen productiebenchmark. Een volgende performance-slice moet server-timing per gedeelde dashboardbron vastleggen voordat verdere optimalisatie wordt gekozen.
- Verificatie: 111 Vitest-bestanden/410 tests geslaagd, strict typecheck, ESLint, i18n-pariteit (24 namespaces) en productiebuild (115 statische pagina's) geslaagd. `curl.exe http://127.0.0.1:3000/login` gaf na iedere hoofdcontrole HTTP 200. Supabase-migratielijst bevat de Talentmigraties en security/performance-advisors zijn opnieuw uitgevoerd; de gemelde waarschuwingen zijn bestaande projectbrede functies/indexen/policies.

## Update 2026-07-29: instellingenbeheer afgerond

- Rollen en rechten heet nu correct; iedere grafische dekkingscel opent een modal met de onderliggende autorisaties. Ook globale systeemrollen zijn veilig bewerkbaar via een administratiegebonden override, zonder de globale rol te muteren.
- Roltoewijzingen bieden drie standaard ingeklapte werkwijzen naast elkaar: vanaf medewerker, vanaf afdeling en voor meerdere afdelingen zonder leidinggevende. Medewerkers met gelijke namen zijn herkenbaar aan personeelsnummer, functie en afdeling. De lijst zoekt, filtert en sorteert, en een klikrij opent details met verwijderactie.
- Afdelingen kunnen ook vanuit de organisatiestructuur worden toegevoegd; formulieren resetten en verversen na opslaan.
- Vrije velden starten met entiteitkeuze medewerker/document. Rijen zijn volledig klikbaar, toevoegen en annuleren legen/sluiten het formulier, vereiste sleutel en label worden gevalideerd en documentvelden worden als metadata bij upload en weergave in het dossier gebruikt.
- Functies en salarisschalen zijn volledig gescheiden. Het functiescherm heeft losse aanmaakacties, standaard ingeklapte filters, een grafisch groepsoverzicht en toont gekoppelde functies bij groepsbewerking.
- Stamtabellen tonen geen overig-paneel meer. Redenen uitdienst zijn per land beheerbaar met CRUD en actief/inactief. Nederland gebruikt codes 01, 02, 03, 04, 20, 21, 30, 32, 33, 34, 40, 41, 90 en 99; ontbrekende landspecifieke inrichting valt terug op `Einde contract`.
- Remote migraties `20260729061253_extend_custom_fields_to_documents`, `20260729064035_country_scoped_employment_end_reasons` en `20260729070552_normalize_nl_employment_end_reasons` zijn toegepast. Database-types zijn vernieuwd.
- Applicatieversie: `1.20260729.2`. Typecheck, lint, i18n, volledige testsuite, productiebuild, ingelogde desktop-/390px-browsercontrole en de definitieve herstart op poort 3000 zijn uitgevoerd.

## Hotfix 2026-07-29: behoud eigen autorisatiebeheer

- De demo-HR Admin-override miste `authorization:read`, waardoor de kaarten op Instellingen zichtbaar bleven maar `/authorization` na een verversing terecht met onvoldoende rechten stopte. Het recht is gericht hersteld.
- Bij het opslaan van rechten voorkomt de server nu dat een gebruiker lezen of beheren van Rollen en autorisaties uit de eigen actieve rol verwijdert. De UI toont hiervoor een concrete uitleg in plaats van een generieke fout.
- Verificatie: strict TypeScript, ESLint, i18n-pariteit en de remote controle van beide autorisatierechten zijn groen. Applicatieversie: `1.20260729.3`.

## Update 2026-07-29: dienstverband- en contractherstructurering

- Dienstverbanden dragen nu de primaire status, IKV 1–99, begin-/anciënniteitsdatum en contractland. Parallelle en sequentiële dienstverbanden blijven ondersteund; per medewerker kan maar één primair dienstverband tegelijk actief zijn.
- Ieder dienstverband heeft een rechtstreeks aansluitende reeks `employment_contracts` met medewerkerstype, flexfase, arbeidsvoorwaardenregeling, looptijd en proeftijd. DGA is niet meer beschikbaar.
- De nieuwe wizard controleert vooraf personeelsnummer, nationaliteit, geboortedatum, geslacht en bij Nederland het BSN. Daarna worden dienstverband, contract, rooster, salaris, organisatie en kosten in één transactie gepubliceerd.
- HR-instellingen bevatten Algemeen met het standaard contractland en beheerbare arbeidsvoorwaarden, flexfasen, salarisfrequenties en kostendragers. `Bedrijfseigen regeling`, maand, 4-weken en de gevraagde flexfasen zijn voorgevuld.
- Overzicht toont dienstverband-/IKV-gegevens en selecteerbare contractkaarten. Basis/IKV en Arbeidsvoorwaarden zijn geen losse tabs meer. Rooster, Salaris, Organisatie en Kostenverdeling gebruiken dezelfde selecteerbare tijdlijnopzet.
- Wettelijke minimumuurlonen voor Nederland zijn per leeftijd en ingangsdatum als administratiegebonden gegevens opgenomen. Applicatieversie: `1.20260729.4`.
- De schema-, API- en UI-slices zijn lokaal gebouwd en remote op het gekoppelde Supabase-testproject toegepast. De lokale en remote historische migratieversies verschillen al uit eerder werk; daarom is de bestaande historie niet gerepareerd en zijn deze migraties gecontroleerd op naam toegepast.
- Browsercontrole op poort 3000 is ingelogd uitgevoerd voor HR-inrichting, de verplichte basisgegevenscontrole, alle wizardstappen, contractkaarten en de rooster-, salaris-, organisatie- en kostentijdlijnen. Hiervoor is bij testmedewerker Lina de nationaliteit genormaliseerd naar `NL` en een synthetisch geldig test-BSN veilig opgeslagen; er is geen extra dienstverband gepubliceerd.
- Eindverificatie: strict TypeScript, ESLint zonder waarschuwingen, i18n-pariteit, 107 testbestanden/396 tests en de productiebuild zijn geslaagd. De Supabase security-advisor meldt geen nieuwe domeinbevindingen; de vijf nieuwe ontbrekende FK-indexen en dubbele permissieve cataloguspolicies zijn opgelost. Remote staan 60 contracten op 60 dienstverbanden en er zijn geen ongeldige contractopvolgingen.

## Update 2026-07-29: compact dienstverband- en landenoverzicht

- De dienstverbandkaarten op Persoonsgegevens tonen anciënniteit als jaren plus maanden, berekend vanaf `seniority_date`. Voor uitsluitend actieve dienstverbanden tonen ze ook afdeling, functie, uren per week, CAO/arbeidsvoorwaarden en medewerkerstype.
- Het minioverzicht op de dienstverbanddetailpagina toont dezelfde anciënniteitsduur plus de actuele CAO en het medewerkerstype.
- Geboorteland en nationaliteit zijn geen vrije ISO-tekstvelden meer: beide gebruiken een doorzoekbare landenkeuze. Lege waarden starten met het ingestelde standaardland van de actieve administratie.
- Verificatie: gerichte anciënniteitstest (3 assertions), strict TypeScript, ESLint en i18n-pariteit geslaagd. Een ingelogde browsercontrole van de nieuwe weergave blijft nog open.

## Update 2026-07-29: Operations B.V. tienjarige dienstverbandfixture

De expliciet gevraagde synthetische fixture `20260729101802_seed_operations_employment_history.sql` is toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De data is volledig herkenbaar met personeelsnummers `OPS-TEST-001` t/m `OPS-TEST-010`, vaste UUID's en `.invalid`-e-mailadressen; bestaande testdata buiten deze scope is niet geraakt.

De fixture bevat 10 medewerkers, 12 dienstverbanden en 18 contracten: historische en actuele dienstverbanden, een herindiensttreding, parallelle primaire/secundaire dienstverbanden, contractreeksen van bepaalde naar onbepaalde tijd, drie opeenvolgende bepaalde contracten, verschillende landen/IKV's, functies, afdelingen, salarissen, roosters, kostenplaatsen en kostendragers. Vier medewerkers zijn uit dienst met verschillende reden/initiator-combinaties (werkgever, werknemer, wederzijds en van rechtswege). Er zijn 17 salarisregels, 16 organisatieplaatsingen en 18 kostenregels.

Remote invariantcontrole: geen overlappende primaire dienstverbanden, geen gebroken contractopvolgingen, alle roosters sluiten exact aan op de contracturen en alle kostenverdelingen tellen op tot 100%. De statusverdeling is 6 actieve en 4 vertrokken medewerkers. De migratie staat als applied geregistreerd; wegens de bestaande lokale/remote migratiehistorie is zij rechtstreeks op naam toegepast en niet via een brede `db push`.

Ingelogde browsercontrole op poort 3000 is geslaagd in administratie `Liquid HR Operations B.V.`. Anna Vermeer (`OPS-TEST-001`) toont op Overzicht haar drie contracten door de tijd; de tabbladen Salaris, Organisatie en Kostenverdeling tonen respectievelijk drie salarisperioden, drie organisatieperioden en vijf kostenverdelingen. Applicatieversie blijft `1.20260729.4` omdat dit een datafixture is.

## Hotfix 2026-07-29: medewerkerfilters en administratiecontext

De medewerkerlijst slaat zoektekst niet langer mee op als blijvende gebruikersvoorkeur. Zoektekst blijft URL-state; alleen status, archiefstatus, sortering, weergave en de open/dicht-status van het filterpaneel worden naar `user_preferences` geschreven. Daarmee verdwijnt de 400 op `PATCH /api/preferences/employees` bij zoeken.

Na een geslaagde administratie-wissel wordt de gebruiker altijd naar `/dashboard/start` gestuurd. De startpagina laadt daarna opnieuw met de gegevens van de gekozen administratie; de actieve context blijft server-side gevalideerd.

Supabase security- en performance-advisors zijn opnieuw uitgevoerd. De meldingen zijn bestaande projectbrede adviezen buiten deze fixture (onder andere absence-RLS zonder policy, SECURITY DEFINER-rechten en bestaande index/permissive-policy adviezen); er is geen nieuwe fixture-specifieke bevinding vastgesteld. De bestaande schema-inconsistentie rond een echt `is_on_call`-rooster blijft als open productpunt bestaan; Daan is daarom veilig als parttime-contract met oproepscenario in custom data opgenomen zonder de databasecheck te omzeilen.

1. Lees `AGENTS.md`, `docs/README.md` en dit bestand.
2. Controleer werkboom, branch, poort 3000, Supabase en Vercel opnieuw.
3. Gebruik `docs/delivery/IMPLEMENTATION_STATUS.md` en de relevante requirements voor resterend werk.
4. Werk na iedere materiële slice dit bestand en de status bij.
## Hotfix 2026-07-29: medewerkerfoto wijzigen en compact opslaan

Op de medewerkerdetailpagina kan een gebruiker met `employee:write` de profielfoto wijzigen of verwijderen. De bediening is ook in de compacte detailweergave zichtbaar. Nieuwe uploads worden server-side geroteerd, naar maximaal 512x512 verkleind en als WebP van maximaal 750 KB opgeslagen. De nieuwe migratie `20260729130000_compact_employee_avatars.sql` verlaagt daarnaast de bucketlimiet naar 1 MB; deze moet nog naar Supabase worden uitgerold.

## Requirements-update 2026-07-31: tenant- en administratie-eigendom

De nieuwe leidende matrix staat in `docs/requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`; ADR-0006 legt de beslissing vast. Functies, functiegroepen, functiefamilies, niveaus, senioriteiten, capabilities, Talent-/Performance-templates, Cloud Tags en niet-juridische afdelingen zijn tenant-owned. Employees zijn tenantbrede personen; employments, contracten, payroll, salaris, verlof, verzuim, declaraties, roosters, feestdagen en kosten zijn administration-owned. Een employment/organisatieplaatsing koppelt beide werelden zonder een tweede functiecatalogus.

De ownershipslice is nu uitgevoerd. Remote zijn `20260731130502_align_tenant_owned_job_catalog_and_departments`, `20260731131136_align_star_performer_job_catalog_scope` en `20260731132359_align_tenant_department_consumers` toegepast. De bestaande job-, group-, revision-, junction- en department-ID's zijn behouden; de dubbele demo-ROOT is samengevoegd zodat 17 tenantafdelingen overblijven. Jobcatalogus, Star Performer job/group lookups, afdelingsbeheer en alle gevonden organization/document/reminder/calendar/insights consumers gebruiken tenantcontext; employments, employee placements, salary, payroll, leave, absence, expenses, assessments, reminders en documents houden hun administrationele context. `packages/db/types.ts` is opnieuw gegenereerd.

Verificatie voor deze slice: na iedere hoofdwijziging gaf `curl.exe http://127.0.0.1:3000/login` HTTP 200. Exacte eindresultaten: `npm.cmd test --workspace @liquid-hr/hr-suite` exit 0 (110 testbestanden, 405 tests, 0 failures); `npm.cmd run type-check --workspace @liquid-hr/hr-suite` exit 0; `npm.cmd run lint --workspace @liquid-hr/hr-suite` exit 0; `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` exit 0 (23 namespaces); `npm.cmd run build --workspace @liquid-hr/hr-suite` exit 0 (Next.js-build, 106 static pages); lokale/remote migration list is voor oudere historie al afwijkend, de drie nieuwe remote migrationnamen zijn gecontroleerd; Supabase security/performance advisors melden alleen bestaande projectbrede waarschuwingen/informatie. Een authenticated browserflow kon in deze run niet worden uitgevoerd omdat geen ingelogde testsessie beschikbaar was; anonieme beschermde API's geven 401 en routes redirecten naar login.

Historische overdrachtstekst; vervangen door de actuele Talent Foundation-update bovenaan dit document. De genoemde Foundation-onderdelen zijn uitgevoerd; resterend zijn alleen de afzonderlijke Blueprint-slices die in `docs/README.md` als toekomstig staan.
## Update 2026-08-04: medewerker-selfservice voor ziekmelden lokaal voorbereid

De lokale migration `20260804153000_employee_self_service_absence_reporting.sql` voegt per administratie `employee_self_report_enabled` toe, standaard `false`. De beveiligde verzuim-RPC accepteert bij ingeschakelde self-service alleen de eerste ziektedag voor de ingelogde medewerker; herstel, wijzigen en aanvullende verzuimgegevens blijven server-side geblokkeerd. De medewerkerpopup toont alleen deze datum en de afgesproken uitlegtekst. Na een self-service-melding worden direct gepubliceerde reminders aangemaakt voor de directe manager en actieve HR Admin/TENANT_ADMIN-accounts, met de eerste ziektedag in de omschrijving.

Lokaal gecontroleerd: strict TypeScript en i18n-pariteit geslaagd. Remote migration, Supabase-advisors, officiële DB-types en authenticated browsercontrole moeten nog worden uitgevoerd.

## UX-tooling update 2026-08-07: EdwinHelp screen redesign

- De herbruikbare skill [`docs/skills/edwinhelp-screen-redesign/SKILL.md`](../skills/edwinhelp-screen-redesign/SKILL.md) is toegevoegd en opgenomen in EdwinHelp, `AGENTS.md`, `docs/README.md` en `docs/DEVELOPER_TOOLKIT.md`.
- Het schermregister staat in [`docs/requirements/ux/SCHERM_REDESIGN_STATUS.md`](../requirements/ux/SCHERM_REDESIGN_STATUS.md). `/settings/company-data` is als eerste Liquid Flow-redesign geregistreerd; `/authorization` Rollen en autorisatie is de volgende pagina.
- De per-scherm requirements gebruiken [`docs/requirements/ux/SCREEN_REDESIGN_TEMPLATE.md`](../requirements/ux/SCREEN_REDESIGN_TEMPLATE.md). Na ieder afgerond scherm worden requirements, status en dit contextdocument bijgewerkt.
- De instructie bevat geen verplichte aparte featurebranch. De bestaande veiligheidsgrenzen blijven gelden: ongerelateerde wijzigingen niet aanraken en geen schema-, remote-, merge-, push- of deployactie zonder aparte opdracht.

## UX-redesignvoorstel 2026-08-07: Rollen en autorisatie

- Voor `/authorization` is het requirements- en ontwerpdocument [`REDESIGN_ROLLEN_EN_AUTORISATIE.md`](../requirements/ux/REDESIGN_ROLLEN_EN_AUTORISATIE.md) toegevoegd.
- Het voorstel beschrijft een rustigere, minder ronde beheerflow voor rolkeuze, rechtenmatrix, heatmap, statusmeldingen, opslaan, dialogen, mobiel 390px, toegankelijkheid en NL/EN i18n.
- De bestaande grens blijft leidend: `/authorization` beheert exacte rechten; `/role-assignments` beheert organisatiescope en rolhouders. Er zijn geen API-, database-, RLS-, remote- of autorisatiewijzigingen uitgevoerd.
- De implementatie staat nu in de basiswerkplek `feature/verlofopbouw-inrichting`, zodat poort 3000 beide redesigns toont.
- Typecheck, lint, i18n-check, `git diff --check` en browsercontrole op desktop/390px zijn geslaagd.

## UX-redesign implementatie 2026-08-07: Rollen en autorisatie

- Het voorgestelde visuele redesign van `/authorization` is vanuit de geïsoleerde werkplek overgezet naar de basiswerkplek `feature/verlofopbouw-inrichting`.
- De autorisatieflow en API-contracten zijn behouden. De wijziging beperkt zich tot de autorisatiemanager: minder ronde hoeken, rustigere statuskaarten, compactere fout/statusmelding, semantische tabs en een duidelijke link naar `/role-assignments`.
- Typecheck, lint, i18n-check en `git diff --check` zijn groen. Poort 3000 toont beide redesigns; desktop- en 390px-browsercontrole zijn geslaagd. Credentials zijn niet gekopieerd.
- Status: `GEVERIFIEERD`; Edwin bepaalt het volgende scherm.

## Hotfix 2026-08-07: hydration op bedrijfsgegevens

- De hydrationfout op `/settings/company-data` kwam door server/client-verschillen in `Intl.DisplayNames` voor landlabels; bijvoorbeeld `FK` kon tijdens SSR een andere tekst krijgen dan in de browser.
- `CountryPicker` en `AddressFields` gebruiken nu een deterministische SSR/eerste-client-render via `useSyncExternalStore`. Gelokaliseerde landnamen worden daarna client-side geactiveerd, zonder functionele wijziging aan het adresformulier.
- Strict TypeScript, lint en browsercontrole op poort 3000 zijn geslaagd: de pagina laadt, zonder runtimefout en zonder hydration- of mismatchmeldingen.
## UX-update 2026-08-07: Liquid Flow applicatiebrede stijl

- In geïsoleerde featurebranch `codex/liquid-flow-appwide` zijn de gedeelde radius-tokens, formulier-/dropdown-/knopstijlen, instellingenheaders en accordions aangescherpt. De bestaande `globals.css` blijft de centrale stijlbron; er is geen tweede stylesheet-thema nodig.
- `/settings/company-data` gebruikt nu een rustige tweestapsflow voor bedrijfsadres en locaties. Het grote informatievenster is op deze pagina verwijderd; adreszoeker, handmatige invoer, locatiebeheer en bestaande API-opslag zijn behouden.
- NL/EN-teksten zijn gelijkgetrokken en uitgebreid voor de nieuwe status- en zoekuitleg. Er zijn geen schema-, migratie- of remote wijzigingen uitgevoerd.
- Verificatie: strict typecheck, ESLint, i18n-pariteit (28 namespaces), diff-check, Next productiebuild via Webpack en ingelogde desktop-/390px-browsercontrole geslaagd. De browser gaf alleen de bestaande CountryPicker hydration-waarschuwing voor de landnaam `Falklandeilanden`; dit staat los van deze UX-slice.
- De feature is lokaal samengevoegd naar `main` als onderdeel van deze releasebasis; push en deployment volgen pas na de releasegate.
# UX-redesign Workflows en formulieren 2026-08-10

- In feature-worktree `codex/process-automation-redesign` is `/settings/process-automation` heringericht van één lange studiopagina naar overzicht → catalogus → één actieve studiostap.
- Het overzicht onderscheidt alle processen, concepten, gepubliceerde productieversies en gearchiveerde definities. De bestaande catalogus blijft lijst-eerst en behoudt zoeken/filteren/selectie.
- Een nieuwe driestapswizard volgt het patroon van de medewerkerwizard: Basis, Startpunt en Controleren. Hij maakt via de bestaande API uitsluitend een concept aan; schema, API-contracten, RLS en permissies zijn niet gewijzigd.
- Processtudio, formulierstudio, preview, Procesproef en versieverschil zijn als genummerde stappen bereikbaar en worden niet meer tegelijk onder elkaar getoond.
- Strict TypeScript, i18n-pariteit en diff-check zijn groen. Gerichte ESLint wordt geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit. Desktop-/390px-browsercontrole is geblokkeerd omdat de geïsoleerde worktree geen lokale Supabase-env bevat; er zijn geen secrets gekopieerd of gelinkt.

## UX-redesign startpagina compact en uitgebreid 2026-08-16

- In aparte worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\startpage-compact` op branch `codex/startpage-compact` is `/dashboard/start` aangepast volgens [`REDESIGN_STARTPAGINA.md`](../requirements/ux/REDESIGN_STARTPAGINA.md). De bestaande dirty `main`-workspace is niet gewijzigd.
- De bestaande opgeslagen `viewMode` wordt nu gebruikt. Compact toont alleen een éénregelige begroeting, hetzelfde éénknops wisselicoon als de medewerkerkaart en horizontale informatietegels voor beschikbare volgende kalenderregels. Uitgebreid behoudt de hogere header, dashboardvensters en drag-and-drop.
- Er zijn geen schema-, API-, RLS-, permissie- of dataladingswijzigingen uitgevoerd. Gerichte typecheck, i18n, lint en geauthenticeerde desktop/390px-browsercontrole moeten nog worden uitgevoerd.
## Hotfix 2026-08-16: medewerkerfoto en roosterinvoer bij aanmaak

De avatarupload van een net aangemaakte medewerker faalde doordat de Storage-policy nog `can_manage_employee` gebruikte en dus een organisatieplaatsing vereiste. De nieuwe lokale migratie `20260816140854_allow_hr_preplacement_avatar_storage` gebruikt de bestaande actorveilige `employee_subresource_can_write`-scope voor insert, update en delete. De read-only remote proef bevestigt dat dezelfde HR-gebruikersrol vóór plaatsing schrijfrecht heeft; de migratie is nog niet remote toegepast.

Roosterdagen interpreteren `uu,mm`, `uu:mm` en `uu.mm` als uren en minuten: `7,30` betekent 7,5 uur. De Controleren-stap blijft de enige stap die een dienstverband kan publiceren; een regressietest dekt ook Overige expliciet af. Lokale verificatie: 11 gerichte Vitest-tests, strict TypeScript, i18n-pariteit, gerichte ESLint en `git diff --check` groen. Open: remote migration, Supabase-advisors en authenticated browsercontrole van foto-upload en de volledige aanmaakflow.
# Employee Personal Tab UX Foundation v1 — 2026-08-20

- Worktree: `.codex-worktrees/employee-personal-tab`, branch `feature/ux-employee-personal-tab`, baseline `origin/feature/ux-foundation-v1` / `16a2022`.
- Geïmplementeerd: volledige personal-tab met vijf subtabs. Foundation `Surface`, `SectionHeader`, `InfoList`, `Badge`, `Button`, `TextInput` en `EmptyState` zijn aangesloten; bestaande data-, mutation-, permission-, RLS-, API- en auditcontracten zijn behouden.
- Gerichte componentcontracttest, volledige testsuite, strict typecheck, i18n en Webpack-production build zijn groen. Lint blijft geblokkeerd door de bestaande ESLint 10/plugin-incompatibiliteit; authenticated browsercontrole desktop/390px in LiquidHR/LinkedHR staat open omdat poort 3000 door een niet-identificeerbare bestaande server bezet is.
- Geen remote Supabase-write, migration, release, deployment, merge of main-push uitgevoerd.

## Hotfix 2026-08-21: startpagina compact toont weer datavensters

- De compacte `/dashboard/start`-weergave hield na de eerdere redesign alleen de begroeting over. De bestaande datavensters worden nu ook in compact gerenderd; vensterdragging en volgordeacties blijven daar verborgen. Uitgebreid behoudt de bestaande vensteracties.
- Geen schema-, API-, RLS-, permissie- of dataladingswijziging. Definitieve verificatie: 2 gerichte start-page regressietests, strict typecheck, productiebuild, `git diff --check` en authenticated Test HR-browsercontrole op localhost:3000. Compacte widgets, verborgen drag/reorder en refresh zijn groen; uitgebreide widgets, drag/reorder en refresh zijn groen; 0 relevante console-errors. De voorgeschreven `docs/delivery/TEST_ACCEPTANCE_MATRIX.md` ontbreekt in deze checkout.
