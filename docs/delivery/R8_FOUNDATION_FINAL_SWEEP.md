# R8 Foundation Final Sweep — geïntegreerde release delivery

Datum: 2026-08-28
Source worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r8-foundation-final-sweep`
Source branch: `work/r8-foundation-final-sweep`
Source commit: `b5aca507e007f2e0900216aaec52ea3093aefa98`
Common baseline: `42066ab64c025e4f8b7653d656e0e3e76cccfaf3`
Integrated release worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r5-setup-release-integration`
Integrated central baseline: `9708617b824a3bc4ca630146609671a0902e48d7`
Zichtbare releaseversie: `1.20260828.8`

## Status

**R8 FOUNDATION FINAL SWEEP INTEGRATED GREEN — POST-DEPLOY VERCEL ACCEPTANCE PENDING**

R8-1 is semantisch geïntegreerd op de actuele centrale `main`. De bestaande UI-implementaties in de afgesproken R8-scope zijn geconvergeerd op UX Foundation v1.2. De releaseversie is exact éénmaal verhoogd van `1.20260828.7` naar `1.20260828.8` in `apps/hr-suite/lib/app-version.ts` en de canonieke version-test. Er is geen schema-, migration-, RLS/grant-, Supabase- of andere structurele remote database-write uitgevoerd.

De lokale authenticated browseracceptance is aantoonbaar geblokkeerd door de bestaande OAuth redirect naar Vercel. Dit is vastgelegd als:

`LOCAL AUTHENTICATED BROWSER ACCEPTANCE BLOCKED — OAUTH REDIRECT LIMITATION`

Dit is geen product- of Foundation-blocker. Authenticated browseracceptance wordt verplicht uitgevoerd als **post-deploy Vercel sanity** tegen de exacte uiteindelijke `main`-SHA.

## Geïntegreerde releasegate

De releasegate is éénmaal opnieuw uitgevoerd op de geïntegreerde kandidaat tegen central baseline `9708617b824a3bc4ca630146609671a0902e48d7`:

- Gerichte tests: **21/21 testbestanden, 97/97 tests geslaagd**.
- TypeScript: **strict typecheck `hr-suite` en `control` geslaagd**.
- i18n: **33 namespaces met gelijke NL/EN-sleutels**; de daling ten opzichte van de source-run volgt uit de eerder centraal geïntegreerde AN-retirement van de Dashboard-namespace.
- ESLint: **hr-suite en control geslaagd**.
- Productiebuild: **Webpack geslaagd, 229/229 pagina’s**.
- `git diff --check`: **geslaagd**.

De volledige suite is eenmaal uitgevoerd als geïntegreerde releasegate en eindigde op **262/263 testbestanden** en **1007/1008 tests**. De enige failure is dezelfde bekende, niet-gerelateerde Journey-baselinefailure in `components/journeys/journey-steps.test.tsx`, met de verwachting `Binnenkort beschikbaar`. R8 wijzigt geen Journey-code of -messages; deze failure is daarom non-blocking volgens de releasebrief en wordt niet opnieuw uitgevoerd.

De statische preservation checks zijn groen: geen runtime `window.confirm`/`window.alert`, geen afhankelijkheid van de vier retired Dashboard-tabellen buiten migrations, geen nieuwe `components/ui`- of `components/patterns`-primitive, geen R8-migration en de AN-hub/redirects/startpage zijn intact. De beperkte Dashboard-linkscan bevat uitsluitend de bedoelde `/dashboard/start`-compatibiliteitslinks en employee/control-contexten.

## Uitgevoerde Foundation-convergentie

De volgende bestaande domeinen gebruiken de canonieke Foundation-controls, layouts en patronen waar die van toepassing zijn:

- Custom Fields: lijst, drawer, dirty-state en bevestigde delete/deactivate-acties.
- Team Compass: workspace, assessment, resultaatweergave, lifecycle-dialogen en responsive lijst/tabel.
- Research: settings, survey/eNPS builders, question bank, targets, respondent flow en reminders.
- Reminders en Time Hub: filters, drawers, dialogs, recipient flow, detail overlay en focusgedrag.
- Personal Settings: settings-accordion, radio/switch/choice controls, velden en form actions.
- Talent: management workspace, My Talent, role explorer en Talent Foundation Manager.
- Product Updates: manager, lijst, create/edit drawer, dirty guard en bevestigde lifecycle-acties.
- Process Work Detail: bestaande acties behouden met Foundation-confirmatie voor risicovolle acties.

Bestaande API-routes, services, payloads, permissions, businesslogica, URL-state en data-eigenaarschap zijn behouden. Er zijn geen nieuwe Foundation primitives toegevoegd; `NEW PRODUCT UI MUST USE FOUNDATION BY DEFAULT` blijft de leidende regel.

## Bewijs en gates

De volgende controles zijn vóór deze delivery uitgevoerd en blijven het lokale R8-bewijs:

- Gerichte source-run: **15/15 testbestanden, 97/97 tests geslaagd**.
- TypeScript: **strict typecheck hr-suite en control geslaagd**.
- i18n source-run: **34 namespaces met gelijke NL/EN-sleutels**.
- ESLint: **geslaagd, geen errors of warnings**.
- Productiebuild source-run: **Webpack geslaagd, 229/229 pagina’s**.
- `git diff --check`: **geslaagd**; alleen bekende CRLF-conversiewaarschuwingen, geen whitespacefouten.

De source-branch noteerde een volledige suite van **268/269 testbestanden** en **1023/1024 tests**. De actuele geïntegreerde uitkomst staat hierboven; na deze delivery wordt geen nieuwe volledige testcarousel uitgevoerd.

## Browserstatus

De lokale Webpack-productieserver is eerder gestart op `http://localhost:3016`. De Playwright-sessie bleef aantoonbaar op `/login?next=%2Fdashboard%2Fstart` door de bestaande OAuth redirect naar Vercel. Daardoor is lokaal geen authenticated route-, persona-, console-, overflow- of mutationbewijs verkregen.

De browserstatus is daarom niet als productfailure geïnterpreteerd. De resterende acceptance is onderdeel van R8-2:

**Post-deploy Vercel sanity:** authenticated HR Admin acceptance, desktop `1440x900`, mobiel `390x844`, console, overflow, focus/dirty/dialoggedrag, scope-negatives en readback/refresh tegen de exacte gedeployde Vercel-main-candidate; Manager/Employee worden compact als persona-sanity/negative gecontroleerd wanneer de beschikbare TEST-sessie dat toelaat.

## Geldige uitzonderingen en residuals

- Time Hub gebruikt één geldige anchored portal-exception voor het compacte sidebar/upcoming-overdue-paneel. Het detailvenster gebruikt de canonieke Dialog.
- Product Updates behoudt de domeinspecifieke branded/public banner en login-popup als presentatie-exception. De beheerflow gebruikt wel Foundation.
- Graphical/SVG/canvas/xyflow-onderdelen, native file inputs, native datumvelden waar geen Datepicker-contract bestaat, verborgen accessibility/FormData-inputs en laag-niveau Foundationcode zijn geen generieke Foundation-gaps.
- AN-owned `/dashboard` residuals en oude/ambigue Dashboard-links zijn niet door R8 gewijzigd.
- Analyse/Insights, AI/HeRa, auth/login, publieke foutpagina’s, tests en gegenereerde output blijven buiten R8-scope.

De repo-scan liet binnen de R8-scope geen resterende `window.confirm`/`alert` en geen resterende legacy controls zien. De genoemde uitzonderingen zijn bewust geclassificeerd en geen open R8-1 productblocker.

## Veiligheid en scope

- Geen schemawijziging.
- Geen migration.
- Geen RLS- of grantwijziging.
- Geen Supabase Auth-configuratie of OAuth redirect-configuratie gewijzigd.
- Geen `.env`-bestand gewijzigd; lokale ignored environment is niet in Git opgenomen en secretwaarden zijn niet uitgelezen of gelogd.
- Geen login-code, production settings of remote data gewijzigd.
- Exact één version bump is lokaal voorbereid; merge, push en Vercel-provenance volgen na de laatste pre-push checks.

## Handoff

De geïntegreerde R8-kandidaat is technisch GREEN en klaar voor de geautoriseerde enkele releasecommit/push. Na deploy moet de Vercel-provenance (`READY`, branch `main`, exact dezelfde commit-SHA) en de hierboven beschreven authenticated browser-sanity worden vastgelegd. Alleen daarna kan de delivery definitief als UX Foundation COMPLETE worden gemarkeerd.
