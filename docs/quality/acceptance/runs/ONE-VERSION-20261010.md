# ONE VERSION TEST convergence — gebundelde acceptatie — 2026-10-10

**Status: RELEASE HOLD tot de security-patch is vastgelegd, opnieuw gemerged en op de definitieve SHA gebouwd en gedeployed.** Appversie `1.20261010.1` is eenmaal verhoogd. De oorspronkelijke kandidaat is gecontroleerd gemerged naar `main` (`ae32742c896297b4d73613751096a75789688437`). De aanvullende dependency-patch wordt op dezelfde bestaande kandidaatbranch afgerond. Er is nog geen nieuwe READY-deployment; geen payrollrun of databasefixture is gewijzigd.

## Kandidaat en scope

- Gebruik uitsluitend `work/one-version-test-20261010`, gebaseerd op `main` / `origin/main` `783999044de83c902e63fefb3587fdbbf99d4de3`.
- De kandidaat bevat CONTROL02 PR #12 (`0976c21981b36526ccd6db1342a953fd32990eb1`), APIAI-08 PR #11 (`21e03291181f5f0f2f0dc1cfefdfbfb26f6e6abc`) en Payroll-integratiehead `0337af89d01ea072936b8894e01f46f09f7b3be9`; alle drie zijn opgenomen in `main`.
- `work/payroll-p0-p1` blijft apart en geparkeerd. Laatst geverifieerd: remote `70db447ad15843cac9be75abeaca785136a2e174`, lokaal `4f99b04eab6cc7a79fd86048ccad1cd3dafc3cbe`. Deze branch is niet gewijzigd.
- PR #14 is gecontroleerd gemerged; GitHub gaf `main`-SHA `ae32742c896297b4d73613751096a75789688437`. PR #11 en #12 blijven open Drafts. De repository heeft geen vereiste statuschecks of branchbescherming.
- Edwin bevestigde de GitHub-device-flow met een succesvolle screenshot. Geen nieuwe token is aangemaakt of getoond.

## Lokale checks

- Voor de security-patch slaagden 608 testbestanden en 2.887 tests; HR Suite- en Control-typechecks, i18n (42 namespaces), lint (0 errors, 7 warnings) en `git diff --check` waren groen. Na dependency-updates draaiden 602 HR-testbestanden / 2.844 tests groen en 4 bestanden / 8 tests overgeslagen; alleen de oude versieassertie faalde. Die verwachting is bijgewerkt naar `1.20261010.1` en de gerichte test slaagde (`2/2`). Control-regressies slaagden (`2 bestanden / 11 tests`), payroll-rules (`3 bestanden / 31 tests`) en beide typechecks zijn groen. Gecombineerd bewijs na de patch: 608 testbestanden en 2.887 tests geslaagd, 4 bestanden en 8 tests overgeslagen.
- Metadata-only controle: canonical `.env.local` bestaat en het centrale TEST-pad heeft hetzelfde NTFS-file-ID. Waarden zijn niet gelezen, gekopieerd of gelogd. Officiële Development- en Production-preflights slaagden met de Payroll TEST-configuratie.
- De oorspronkelijke officiële HR-productiebuild op Next.js 16.3.6 slaagde (319 routes, Payroll-clientbundle negatieve controle en scan groen voor 154 browserassets). Na de security-upgrade slaagde de Control-productiebuild op Next.js 16.4.0 (12 routes); de definitieve HR-build op Next.js 16.4.0 en officiële exacte-SHA preflight moeten nog slagen.
- Lokale Production-runtime via de officiële launcher gebruikte loopbackpoort 3011 en de centrale synthetische TEST-backend. Desktop 1440×900 en mobiel 390×844: dashboard en Payroll-pagina zonder horizontale overflow.
- Synthetische `hradmin.fixture`-sessie bleef bruikbaar. Interne route `/imports/interne-representatieve-fixture` laadde en vermeldt dat alleen de synthetische interne JSON-fixture wordt verwerkt; niets is geüpload of verwerkt. Serverguard vereist `payroll-import:write`, actieve administratie en tenant/HR-groepsscope; de tabellen hebben overeenkomstige RLS.
- Ingelogde `/imports/loonaangifte` gaf 404. Analyze/stage-contracttests bewijzen dat `LOONAANGIFTE_XML` vóór servicecalls wordt geweigerd. De route ontbreekt ook in de productie-buildmanifest.
- Payroll Lab-pagina `/payroll-lab/salarisverwerking` gaf 200, maar voor september en oktober ontbreken bevestigde dienstverbanden voor Lisa, Frits en Jaap. Dit blijft OPEN TEST-acceptatiebewijs; er is niets aangemaakt of gewijzigd.
- HeRa-paneel laadde in de lokale Production-build; de development-smoke gaf 200 voor conversatie-read APIs. Er is geen prompt verstuurd of model-/externe MCP-actie uitgevoerd. Hosted OAuth/MCP-, audit- en limiter-readback blijft OPEN.
- Een Next.js HMR-router-/webpackfout trad alleen op bij Development-navigatie. De relevante interne importroute, dashboard-, Payroll- en HeRa-weergaven zijn op de productiebuild geladen; geen vergelijkbare productieruntimefout gezien.

## Releasegrens en vervolg

- De production audit vond drie HIGH dependency findings: Next.js, sharp en source-map-js. Next.js is op beide apps bijgewerkt naar `16.4.0`, sharp naar `0.35.5` en source-map-js naar `1.2.2`; `npm audit --omit=dev` meldt nu nul vulnerabilities. Een Vercel-buildpoging is vóór READY geannuleerd; de bestaande READY-deployment en alias zijn niet gewijzigd.
- De open Payroll-persona- en hosted AI-acceptatiepunten worden niet als GREEN gerapporteerd. De dependency-patch moet nog naar GitHub, via een gecontroleerde PR opnieuw naar `main`, en op de nieuwe exacte main-SHA gebouwd en hosted geverifieerd worden.
- De bestaande Vercel-projectafspraak noemt de `Production`-target de gezamenlijke synthetische TEST-release. Geen Production-database benaderd of gewijzigd.
- Resterend: security-patch committen en via een gecontroleerde PR naar actuele `main` mergen; commitprovenance en heads opnieuw controleren; Vercel READY/SHA/alias en beperkte hosted TEST-smoke verifiëren.
- Pas na de deploy de volledige lokale/remote/Vercel-inventaris maken en per artefact aangeven wat veilig te verwijderen is. Tot die review zijn geen worktrees, branches, PR's, deployments of buildartefacten verwijderd. Geen bulkcleanup of databasecleanup.
