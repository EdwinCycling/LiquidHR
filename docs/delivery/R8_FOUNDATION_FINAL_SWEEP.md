# R8 Foundation Final Sweep — lokale delivery

Datum: 2026-08-28  
Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\r8-foundation-final-sweep`  
Branch: `work/r8-foundation-final-sweep`  
Baseline: `42066ab64c025e4f8b7653d656e0e3e76cccfaf3`  
Zichtbare versie: `1.20260828.6`  

## Status

**R8 FOUNDATION FINAL SWEEP LOCAL GREEN — READY FOR FINAL UX FOUNDATION RELEASE**

R8-1 is lokaal afgerond. De bestaande UI-implementaties in de afgesproken R8-scope zijn geconvergeerd op UX Foundation v1.2. Er is geen version bump uitgevoerd. Er is geen merge, push, Vercel-actie, database-write of productieactie uitgevoerd.

De lokale authenticated browseracceptance is aantoonbaar geblokkeerd door de bestaande OAuth redirect naar Vercel. Dit is vastgelegd als:

`LOCAL AUTHENTICATED BROWSER ACCEPTANCE BLOCKED — OAUTH REDIRECT LIMITATION`

Dit is geen product- of Foundation-blocker. Authenticated browseracceptance wordt verplicht verplaatst naar **R8-2 post-deploy Vercel sanity**.

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

- Gerichte tests: **15/15 testbestanden, 97/97 tests geslaagd**.
- TypeScript: **strict typecheck hr-suite en control geslaagd**.
- i18n: **34 namespaces met gelijke NL/EN-sleutels**.
- ESLint: **geslaagd, geen errors of warnings**.
- Productiebuild: **Webpack geslaagd, 229/229 pagina’s**.
- `git diff --check`: **geslaagd**; alleen bekende CRLF-conversiewaarschuwingen, geen whitespacefouten.

De volledige testsuite is eenmaal uitgevoerd als releasegate en eindigde op **268/269 testbestanden** en **1023/1024 tests**. De enige failure is de bestaande, niet-gerelateerde Journey-baselinefailure in `components/journeys/journey-steps.test.tsx`, met de verwachting `Binnenkort beschikbaar`. Deze failure is niet door R8 veroorzaakt en is bewust niet gewijzigd.

Opdrachtinstructie: na deze delivery wordt geen nieuwe volledige testcarousel uitgevoerd.

## Browserstatus

De lokale Webpack-productieserver is gestart op `http://localhost:3016`. De Playwright-sessie bleef aantoonbaar op `/login?next=%2Fdashboard%2Fstart` door de bestaande OAuth redirect naar Vercel. Daardoor is lokaal geen authenticated route-, persona-, console-, overflow- of mutationbewijs verkregen.

De browserstatus is daarom niet als productfailure geïnterpreteerd. De resterende acceptance is onderdeel van R8-2:

**R8-2 post-deploy Vercel sanity:** authenticated HR/Manager/Employee browseracceptance, desktop `1440x900`, mobiel `390x844`, console, overflow, focus/dirty/dialoggedrag, scope-negatives en readback/refresh tegen de gedeployde Vercel-candidate.

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
- Geen version bump, merge, push of Vercel uitgevoerd.

## Handoff

R8-1 is lokaal klaar voor de finale UX Foundation release. R8-2 moet na deploy de hierboven beschreven authenticated Vercel sanity uitvoeren en de OAuth-beperking vervangen door echte gedeployde browser-evidence.
