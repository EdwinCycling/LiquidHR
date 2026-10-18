# AA-CURRENT — Current LiquidHR State

Status: **ACTUEEL / LIVING**
Momentopname: 2026-10-18 (historische acceptance-evidence blijft ongewijzigd)

## STAR-V2-04C — lokaal gesloten read-only Talentpaspoort (2026-10-18)

- De eerder gedeeltelijk aanwezige 04C-code is lokaal op main vastgelegd in code-SHA c7237c8c041051eab40a3274679a46662f8a27d9. Er is geen push, deployment, databasewrite of migratie uitgevoerd.
- De browseracceptatie is met de lokale synthetische TEST-runtime bewezen voor HR Admin, Manager en Employee. HR Admin zag een Talentpaspoort binnen scope; Manager zag uitsluitend directe teamleden en werd voor een medewerker buiten het team teruggestuurd; Employee zag geen Talentpaspoort, 9-grid of kritikaliteit.
- Directe URL-, forged-ID- en buiten-scope-controles zijn uitgevoerd. De bestaande read-services, direct-team-scope en bronlinks zijn hergebruikt; geen nieuwe workflow of dubbele berekening.
- Gerichte tests (9/9), gewijzigde-bestanden-ESLint, i18n-pariteit (43 namespaces) en CRLF-aware diff-check zijn groen. Typecheck blijft rood op de bestaande ongerelateerde TS2367 in apps/hr-suite/components/talent/talent-workforce-overview.tsx:271.
- De standaard Playwright-Chrome-route bleef geblokkeerd door Crashpad; de in-app browsercontrole is daarom als lokale browser-evidence gebruikt. De al dirty zijnde apps/hr-suite/next-env.d.ts bleef buiten de commit. Zie [STAR-V2-04C-CLOSE](../quality/acceptance/runs/STAR-V2-04C-CLOSE-20261018.md).
- Verdict: STAR-V2-04C lokaal geaccepteerd; de 04C-run zelf bevatte nog geen 04D-1-wijzigingen.

## STAR-V2-04D-1 — centrale Insights-categorie Talent & Ontwikkeling (2026-10-18)

- De centrale `/insights`-catalogus heeft de categorie **Talent & Ontwikkeling** gekregen met zes werkelijk bestaande, read-only rapportingangen: Toptalent (9-grid), Sleutelmedewerkers, Skills & afhankelijkheden, Ontwikkeling & acties, Skills & competenties en POP & ontwikkeldoelen.
- De Star Performers-rapporten gebruiken de bestaande Star Performers-services, filters en Manager-readscope. De twee Talent-rapporten gebruiken de bestaande `all/goals/capabilities`-route, periode/statusfilters en CSV-export. 9-grid en Continuous Appraisal blijven bronmodules; er is geen fictieve zelfstandige catalogusroute toegevoegd.
- Lokale browseracceptatie in de in-app browser is bewezen voor HR Admin, Manager en Employee. HR Admin zag 25 catalogusrapporten en de Talent-categorie; Manager zag 13 rapporten en uitsluitend de directe teamscope; Employee zag 0 rapporten en geen Talentmetadata. Directe Employee-URL's eindigden op `/geen-toegang`; een Manager-request met een forged all-zero employee-ID bleef op 6 teammedewerkers en 6 goedgekeurde 9-gridrecords.
- Er zijn geen permissions, SQL, migraties, schema's, RLS-policies, databasegegevens, Payroll-code of bestaande Star-/Talentpaspoortroutes gewijzigd. De browsercontrole gebruikte de target-checkout op `http://localhost:3013` nadat de bestaande lokale devserver een `25P02`-runtimefout had; `next-env.d.ts` bleef dirty en buiten scope.
- Gerichte catalogus-, query-, Talent-report- en Star-authorizationtests, gewijzigde-bestanden-ESLint, i18n-pariteit en diff-check zijn groen. Typecheck blijft uitsluitend rood op de bestaande ongerelateerde TS2367 in `apps/hr-suite/components/talent/talent-workforce-overview.tsx:271`.
- Verdict: **STAR-V2-04D-1 LOCAL DONE**. Zie [STAR-V2-04D-1 acceptance-evidence](../quality/acceptance/runs/STAR-V2-04D-1-LOCAL-20261018.md). STAR-V2-04D-2 blijft een afzonderlijke volgende slice.

## STAR-V2-04D-2A — geaggregeerde Functieprofiel & skillgaps (2026-10-18)

- De kandidaat voegt in **Talent & Ontwikkeling** het zevende rapport **Functieprofiel & skillgaps** toe. Het rapport hergebruikt de bestaande Star Performers-populatie, functieprofielvereisten, talentlevels, employee-capabilityservice, filters, bronprofielen, medewerker-drilldowns en een read-only CSV-route; de zes bestaande catalogusrapporten blijven intact.
- De HR Admin-browserproef op `http://localhost:3013/workforce/talent/reports/star-performers?report=skill-gaps&status=assessed` toonde echte synthetische TEST-data: 6 relevante medewerkers, 1 beoordeeld (17%), 12 skillgaps, 0 onderbouwde één-persoonsafhankelijkheden en peildatum 18 oktober 2026. De tabel toonde zowel **Niet beoordeeld** als **Onvoldoende niveau**, bestaande functieprofielen, bronprofiel-/role-explorerlinks en de statusfilters. De read-only CSV was parseerbaar met 20 records en 16 kolommen.
- De eerdere Manager-applicatiedenial had als oorzaak dat `readInsightSkills` het bestaande `getTalentLevelModel()` aanriep, waarvoor `talent:manage` nodig is. De closeout gebruikt nu het bestaande `talent_job_profile_readmodel` en leest alleen tenantgebonden level-ranks via de bestaande `talent:manager-read`-route. Het readmodel blijft `security_invoker`; bestaande Manager-RLS/policies zijn niet gewijzigd.
- De live Manager-route blijft terecht leeg: de actieve directe teamscope bevat 6 medewerkers, maar de selectie heeft geen actieve functieprofielvereisten. De route/API geeft daarom `no-data` en toont **Geen functieprofiel-skillgapdata**. Een read-only Vitest-fixture met één directe medewerker, een actieve vereiste en een lager vrijgegeven skilllevel produceert aantoonbaar `INSUFFICIENT_LEVEL`; een buiten-scope medewerker wordt niet verwerkt.
- Employee ziet geen Talent Insights: `/insights` toont 0 rapporten, de directe skillgap-URL eindigt op `/geen-toegang` en de directe CSV-route geeft HTTP 403 zonder rapportdata. Manager forged job-ID geeft een lege, geautoriseerde scope; forged employee-URL eindigt op `/geen-toegang`.
- De HR Admin-pariteit is bewust gelaagd: **11** is de bredere Star Performers-populatie vóór de functieprofiel-/rapportfilters, **6** is de actieve skillgaprapportselectie, en **20** zijn detailrecords in CSV (niet unieke medewerkers; een medewerker kan meerdere functievereisten opleveren). Tabel, filters en CSV gebruiken dezelfde `getStarPerformersInsights`-populatie en CSV-builder.
- Gerichte Vitest-regressies zijn **6 bestanden / 21 tests groen**, inclusief de positieve Manager-fixture; gewijzigde Star Performers-bestanden zijn gericht ESLint-groen; i18n-pariteit (43 namespaces) en diff-check zijn groen. De volledige repository-lint stopt uitsluitend op de bestaande ongerelateerde `prefer-const` in `lib/document-generation/distribution-read-service.test.ts:47`; typecheck stopt uitsluitend op bestaande `TS2367` in `apps/hr-suite/components/talent/talent-workforce-overview.tsx:271`. Playwright Chrome bleef door Crashpad onbruikbaar; de in-app browser is gebruikt.
- TEST-connectiviteit was read-only bereikbaar (health-endpoint HTTP 401 zonder credentials; geen 521). Er zijn geen databasewrites, migraties, RLS-/permissionwijzigingen, Payroll-wijzigingen, push, deployment of cleanup uitgevoerd. `apps/hr-suite/next-env.d.ts` en andere dirty worktrees bleven buiten scope.
- Verdict: **STAR-V2-04D-2A LOCAL DONE** — Manager-positief is met gecontroleerde fixtures bewezen; de actuele TEST-selectie blijft terecht leeg wegens ontbrekende actieve profielvereisten. Zie [04D-2A acceptance-evidence](../quality/acceptance/runs/STAR-V2-04D-2A-LOCAL-20261018.md). 04D-2B/C/D wordt niet gestart.

## TALENT-CONVERGENCE-01 — lokale codeconvergentie (2026-10-16)

- De Talent-code staat lokaal op main via code-SHA 1d175ae4ee6cece9b44c26f22ff728c9a75f1ea1. De sourcebranch is fast-forward geïntegreerd; origin/main is niet gewijzigd. Er is geen GitHub-push, PR-merge, deployment of nieuwe Supabase-migratie uitgevoerd.
- Read-only Supabase TEST-baseline: project wnpfloqpjvaacobppbpk, LiquidHR, ACTIVE_HEALTHY; migratiekop 20261015182721. Deze follow-up wijzigde geen schema of databasegegevens.
- Op de geïntegreerde code-SHA slaagden type-check, gewijzigde-bestanden-ESLint, i18n-pariteit (43 namespaces) en de volledige suite (632 bestanden; 3.067 geslaagd, 8 overgeslagen).
- Lokale read-only browsercontroles vóór de laatste navigation-only permissiefilter: 9-grid-resultaten en bestaande synthetische records, 1280/1024/390 px, LinkedHR licht en Nacht donker; zes appraisaltypen en aanmaakdefaults. Geen browserconsolefouten of datawijzigingen. De laatste permissiefilter is na de serverherstart niet via de browser geverifieerd.
- De volledige reduced-motion-runtimecontrole blijft open. De browseromgeving bood geen reduced-motion-emulatie; de gedeelde gereduceerde-motion CSS is aanwezig. Zie TALENT-9GRID-V2-TEST-021.
- De productiebuild is niet uitgevoerd: de Next.js-start had apps/hr-suite/next-env.d.ts gegenereerd gewijzigd; auto-review wees het terugzetten af met verwijzing naar de repo-regel dat dit bestand nooit wordt gewijzigd en de waarschuwing om de uncommitted wijziging niet weg te gooien. De herstartte dev-server luisterde lokaal op 127.0.0.1:3020, maar de ingebouwde browser kreeg ERR_CONNECTION_REFUSED. Details en beperkingen staan in het [lokale acceptance-rapport](../quality/acceptance/runs/TALENT-CONVERGENCE-01-20261016-LOCAL.md).

Verdict: LOCAL MAIN CODE INTEGRATED / TYPE, LINT, I18N EN FULL SUITE PASS / BUILD EN LAATSTE BROWSERFILTER HOLD / GEEN RELEASE.

## TALENT-UX-V2 — lokale Workforce-UX (2026-10-16)

- `/workforce/talent` mount alleen het actieve tabgebied. Medewerkers laden in pagina's van 25; functieprofielen laden samenvattingen en halen het gekozen profieldetail op; vaardigheden/bewijs laden pas bij openen en tonen details via uitklappen. Talentmeldingen staan achter een compacte teller en apart venster. De bestaande V2-beheereditor en vergelijkings-/radarflows zijn behouden.
- De oorzaak van de trage browsertest was een oude serverbron op poort 3020: de listener kwam uit de beschermde Talent-worktree op SHA `18d2ed3b`; die worktree bleef onaangeroerd. De actuele lokale codecommit `cd21d01f` draait voor browsertest op `http://127.0.0.1:3021/workforce/talent`; er is geen build gestart.
- Bestaande autorisatie en scoped gegevens bleven intact; geen schema-, databank- of Payroll-wijziging. Geen push of deployment.
- Gerichte controles: 7 tests in 3 bestanden, ESLint op gewijzigde TS-bestanden en i18n-pariteit (43 namespaces) geslaagd. De app-typecheck stopt alleen op ontbrekende `pdf-lib`/`pdfjs-dist`-afhankelijkheden in bestaande PDF-tests; volledige suite, build en geauthenticeerde browseracceptatie zijn niet uitgevoerd.
- Verdict: LOCAL UX INTEGRATED / ACTIVE-AREA LAZY LOAD / TARGETED CHECKS PASS / TYPECHECK PARTIAL / NO RELEASE.

## TALENT-CONVERGENCE-01 — TEST-migraties en kernflows bevestigd; volledige 9-grid-acceptatie HOLD (historische baseline 2026-10-15)

- Lokale main bevat de herstelcommit 3816b81d1ab3942eeef86649ed4a9aaa22380ea1. origin/main is read-only vastgesteld op 0708d25190562e43a96417ba406648fd04207266; er is niet gepusht, geen PR aangemaakt en niets gedeployed.
- Supabase TEST wnpfloqpjvaacobppbpk is ACTIVE_HEALTHY (LiquidHR, eu-west-3, PostgreSQL 17.6.1.141). De eerdere remote kop 20261015125424 is vóór migraties opnieuw gecontroleerd. De huidige kop is 20261015182721 met 558 registraties; alle vier migraties staan in volgorde geregistreerd. De fout Invalid or expired requestState is niet teruggekomen.
- Read-only schema-/datacontrole: 6 reviewcampagnes, 14 assignments, 53 teamleden, 37 scores; Continuous Appraisal 34 items, 6 comments en 2 attachments. De betrokken tabellen hebben RLS ingeschakeld. De post-migratie grants- en routinecontractcontrole staat met details in de [eerder bijgewerkte rerun](../quality/acceptance/runs/TALENT-CONVERGENCE-01-20261015-RERUN.md).
- De twee geïsoleerde synthetische campagnes zijn via de normale UI volledig afgerond. HYBRID en HR_ONLY hebben elk 11/11 teamleden geplaatst, 11 scores en 3/3 ingediende teams; beide staan in TEST op CLOSED. HYBRID doorliep close → reopen met reden → resubmit van alle teams → close. Een Manager kreeg voor de HR_ONLY-campagne een normale 404; HR-score-invoer en indiening werkten. De HR Admin self-score werd geweigerd; geen autorisatie is omzeild. De bestaande T01R-campagne bleef ongewijzigd.
- De herstelcode beperkt 9-grid-celtellingen tot de geselecteerde assignment en vertaalt een onzichtbare campagne naar een normale 404. Een nieuwe regressietest dekt de teamtelling. Continuous Appraisal TEST-acceptatie blijft gesloten onder TALENT-APPRAISAL-V2-TEST-020.
- Finale checks op herstelcommit: volledige hr-suite 632 bestanden; 3.067 geslaagd, 8 overgeslagen. TypeScript, gerichte ESLint, regressionstest en Webpack-productiebuild slaagden; bundel-, function-trace- en provenancechecks slaagden. De standaard Turbopack-build stopte vóór compilatie op de bestaande node_modules-resolverfout; dezelfde productiebuild slaagde via ondersteunde Webpack. De volledige 9-grid matrix voor resultaten, drag/drop, keyboard, reduced motion, thema’s en doelviewports is niet bewezen.
- Verdict: LOCAL MAIN INTEGRATED / ENGINEERING GREEN / SUPABASE TEST FLOWS ACCEPTED / 9-GRID V2 FULL ACCEPTANCE HOLD. Dit is geen hosted TEST-release of Production-acceptatie. Zie de [herstel-follow-up](../quality/acceptance/runs/TALENT-CONVERGENCE-01-20261015-RECOVERY.md); de eerdere closeouts blijven historisch ongewijzigd.

## PAYCOMP-EDIT-01 — controlled synthetic TEST release 1.20261012.3 (LIMITED)

- Bij integratie waren release SHA `5c539b11b6ed478fc03152fa5b1f4a09591d05d2` exact gelijk aan local `main`, `origin/main` en Vercel `liquidhr` Git deployment `dpl_9Su59wRcQ4PtPwqW8tWjcKXnmj5K`, **READY**, op canonical alias `liquid-hr-hr-suite.vercel.app`.
- Feature source `625eabcc93992f71beb6f143341bb15adf9b8c1c` contains the component editor, save/reopen/version history, safe formula validation, and traced previews. Authenticated Payroll Admin scope is resolved server-side. Exactly three synthetic DRAFT records were created through application services; no schema or historical-data changes.
- Editor acceptance: fork v1/v2 and custom v1 saved and reopened; v2 preview `643.92`, custom preview `105.00`, with calculation traces and all four NL 2026 controls passing. Relevant Vitest suites: 92 tests passed. TypeScript, changed-area ESLint, 43-namespace i18n, `git diff --check`, and the exact-release-SHA production build passed.
- Hosted anonymous safety smoke: `/login` 200, `/dashboard/start` 307 to login, `/api/context` and `/api/employees` 401, Test Auth UI absent, Test Auth and role-switch POSTs 404, `/api/test-capture` and `/api/control-plane` 404.
- Full hr-suite remains **OPEN** because the final run emitted no collected tests/results within four minutes; this is not a pass. The automatic feature-branch Preview `dpl_6GiFZkgikdo1goPoKvHckqwCymTq` was not used or tested; Preview isolation remains OPEN under [AA-OPEN](AA-OPEN.md). This release is **limited TEST**, not full acceptance GREEN. See [PAYCOMP-EDIT-01 acceptance](../quality/acceptance/runs/PAYCOMP-EDIT-01-20261012-TEST.md).

## Vorige releasebaseline — 1.20261011.2 (TEST RELEASED — LIMITED; APIAI-08/09 ACCEPTANCE OPEN)

- PR #18 is op 2026-10-12 gemerged: code/test-SHA `27d534fd06fee7868b3bf0534bc3fdb9a3736cd1` (PR-head `c5906d7469ef47fd5b9edf36c412772e9ac98a30`; de latere delta was documentatie), merge/main-SHA `a5d1b3ff61e8c1d1af05a0c89b08a4fe73472495`. Vercel `liquidhr`-deployment `dpl_7HBAyX61sjs1YNtmMZJU55NpNii6` is **READY** op exact main-SHA, source Git, met canonieke alias `liquid-hr-hr-suite.vercel.app`. Vercel `production` is hier de deploymentchannel van de bestaande synthetische TEST-omgeving.
- Vorige TEST-release (NMBRS-01): beperkte synthetic TEST-release op SHA `58dc758c950b4e6da45c43a1692f45eb0fc019e9`; bij release stonden lokale `main`, `origin/main` en GitHub `main` gelijk. Vercel `liquidhr`-deployment `dpl_BVuywDYacYZk2DXn9ZNkgVRgkvkp` is **READY**, `source=git`, `meta.githubCommitRef=main`, met dezelfde SHA. Canonieke alias: `liquid-hr-hr-suite.vercel.app`; tweede main-alias: `liquidhr-git-main-edwinitsolutions.vercel.app`. `production` is hier de deploymentchannel van de bestaande synthetic TEST-omgeving.
- De ontbrekende Git-buildtrigger kwam door `vercel.json` met globale `git.deploymentEnabled: false` (commit `987a98a8`); de repo-koppeling, productiebranch `main`, Ignored Build Step en monorepo-root zijn correct. PR #20 zou ook door de root/dependency-skip zijn overgeslagen; PR #19 wijzigde wel `apps/hr-suite`. PR #22 activeerde alleen `main` via de bestaande Git-integratie en veroorzaakte de READY-release; geen handmatige deployment.
- Vercel maakte daarnaast automatisch een Preview voor PR #22-head `a5dfca90d6151f2cf3d609ac633026a450ecc847` (`dpl_GRTVKK9zTCN2dvo4uAMtRDExdyPU`). Die Preview is niet getest; Preview-isolatie en ontbrekende Preview-configuratie blijven **OPEN**. Geen secrets of Preview-variabelen gewijzigd.
- SEC-01 migrationbron `20261011120317_secure_continuous_appraisal_attachment_storage_keys`; read-only TEST-migrationlijst registreert dezelfde naam als `20261011130922`. De historische versies verschillen; niet hernoemen, herschrijven of opnieuw toepassen.
- De geauthenticeerde hosted security-/persona-acceptatie voor SEC-01 blijft **OPEN**. Deployment READY en toepassing op TEST zijn daarvoor geen vervangend bewijs; zie [AA-OPEN](AA-OPEN.md).
- CONTROL02 en de officiële Loonaangifte-XML-import blijven **CANCELLED**. NMBRS-01 is selectief gemerged via PR #19; code merge-SHA `deba6c0d5489bbe1ab15a77e1f60169661121816`, gevolgd door docs-only PR #20 (`fae79d8ef1d3d186ff254c0f1032f4b9674bc2dd`), P2-documentatie PR #21 en Git-trigger PR #22. De volledige non-live suite en lokale gates slaagden eerder op codekandidaat `ceb7df9c973920b382af9ed8d02037c09cc373bd`; de Vercel-build slaagde op release-SHA `58dc758c950b4e6da45c43a1692f45eb0fc019e9`. Hosted smoke: login laadt zonder Test Auth; beschermde Payroll-routes redirecten anoniem; `/api/context` en `/api/employees` geven 401; Test Auth/role-switch POST geven 404; geauthenticeerd laden Payroll Lab en Nmbrs-UI zonder credentialvelden of console-errors. Exact verdict: **TEST RELEASED — LIMITED / NMBRS OAUTH ACCEPTANCE OPEN**. Preview-isolatie, OAuth/company discovery-binding en SEC-01 hosted persona/securitybewijs blijven OPEN. De P2-readinessdocumentatie staat met historische waarschuwing op main; de legacy worktree/branch blijven behouden omdat `.env.local` beschermd aanwezig is en 13 branchcommits niet in `origin/main` zitten. Geen P2-implementatie. Zie [NMBRS-01 convergence acceptance](../quality/acceptance/runs/NMBRS-01-CONVERGENCE-20261011.md).
- **APIAI-08 final-release follow-up (2026-10-12):** de ondersteunde toolrefresh faalde en de bestaande ChatGPT-app toont nog vier Talent-tools; de bijbehorende vier calls eindigden vóór de route met `-32603`. Edwin bevestigde de ChatGPT-contextdelingsstap van de bestaande-account-reconnect. LiquidHR main vond daarna geen Employee-self-context en bood alleen **Deny**; er volgde geen LiquidHR OAuth-goedkeuring/callback. Nog steeds **0/8** geauthenticeerde reads; de canonieke verlofbalans, audit en limiter zijn niet gelezen. Zie [APIAI-08 acceptance](../quality/acceptance/runs/APIAI-08-20261009.md).
- **APIAI-09 pre-release:** TypeScript (alle workspaces), gerichte ESLint, i18n (43 namespaces), `git diff --check`, 19 gerichte bestanden/180 tests en de volledige suite (616 bestanden; 2.930 tests geslaagd, 8 overgeslagen) slaagden. Preview `dpl_4wdGu1WWCbjqbLqRV5qbhZfKCCkz` was READY op exact de code/test-SHA. Onafhankelijke lokale spec-/standaardenreviews vonden geen blocker in de beoordeelde codepaden; dit waren geen formele GitHub approvals. Preview-isolatie blijft OPEN.
- **Post-release safety smoke:** op de canonieke alias `/login` 200, `/dashboard/start` 307 naar login, `/api/context` en `/api/employees` 401. MCP `initialize` en publieke `tools/list` gaven 200; 14 tools zijn zichtbaar (8 Employee, 6 Manager). Een anonieme Manager-`tools/call` werd geweigerd met `isError=true` en “Authentication is required”. Er is geen geauthenticeerde browserlogin/sessiesmoke of hosted regressierun voor bestaande functies uitgevoerd; dit blijft OPEN.
- De bestaande ChatGPT-verbinding blijft onbruikbaar voor nieuwe tests: ondersteunde `Tools vernieuwen` gaf opnieuw “De app kan niet worden bijgewerkt. Probeer het opnieuw.”; de vier reeds zichtbare Talent-toolcalls gaven `-32603 Internal error`. Correlatie-/runtime- en consolechecks bewezen geen root cause. Geen onafhankelijke geauthenticeerde MCP-client of geautoriseerde APIAI-identiteit beschikbaar; root cause blijft **onbekend**.
- Verdict: **TEST RELEASED — LIMITED**; **APIAI-08 ACCEPTANCE OPEN (0/8 Employee reads)**; **APIAI-09 ACCEPTANCE OPEN (0/6 Manager reads)**. Canonieke 96/0-uurreadback, geauthenticeerde RLS-/tenant-/teamscope, consent/revoke/reconnect, audit en limiter blijven OPEN. Preview-isolatie is OPEN; volledige ACCEPTANCE GREEN wordt niet geclaimd. Manager-consent blijft server-side fail-closed, bestaande grants geven geen Manager-opt-in en Remote Execute blijft UIT.
- APP_VERSION bleef `1.20261011.2`. AA-REL §3 schrijft een bump per release voor; het ontbrekende release-metadata-bewijs staat als afzonderlijk OPEN-punt in [AA-OPEN](AA-OPEN.md). De vorige READY-deployment `dpl_841Lz4YpcDrPUQ6aTzNA9KLjS7Ka` op SHA `db23b12446b4d04c823710ae48780dd0b47cc5b8` is de rollback-kandidaat; er is niet teruggerold. Zie [APIAI-09 TEST-release closeout](../quality/acceptance/runs/APIAI-09-20261012-TEST-RELEASE.md).
- PR #16 is gemerged op `ffdca4822fb4cca6e675d9c969b59a12ca664c51` en bracht de selectief bijgewerkte roadmap/Focus-context mee. PR #13 en de niet-goedgekeurde PR #2 zijn niet gemerged; zie [PR #16](https://github.com/EdwinCycling/LiquidHR/pull/16).

De kandidaatstatus van ONE VERSION op 2026-10-10 is historisch vastgelegd in [het acceptatierapport](../quality/acceptance/runs/ONE-VERSION-20261010.md); die status is niet de actuele main-/deploymentstatus.

> **Statusupdate 2026-10-10:** CONTROL02 en de officiële Loonaangifte-XML-import zijn CANCELLED. Er komt geen vervolgontwikkeling, herstelmigratie of E2E-acceptatie. De interne representatieve import en CONTROL01 blijven behouden; TEST-data en databaseobjecten zijn read-only geïnventariseerd en blijven staan totdat een exact cleanupvoorstel apart is goedgekeurd.

> **PAYLAB update 2026-10-02:** die oudere branchstatus is superseded. PAYLAB00–04 zijn geïntegreerd en browser-geaccepteerd op `integration/payroll-foundation-20261002`, exact accepted HEAD `3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96`. De onafhankelijke LUNA MAX-review en desktop/390 px productie-acceptatie zijn GREEN. ONE VERSION gebruikt kandidaatversie `1.20261002.1`; de gezamenlijke TEST-release blijft pas RELEASED nadat main, Vercel en hosted smoke exact zijn geverifieerd. Zie `docs/quality/acceptance/runs/ONE-VERSION-20261002.md`.

## Canonieke repository

- Repo: `EdwinCycling/LiquidHR`
- Canonieke branch: `main`
- Canonieke Vercel HR-app: `liquidhr`
- Canonieke Supabase TEST/projectomgeving: `wnpfloqpjvaacobppbpk`
- Eén operationele LiquidHR-omgeving; Vercel “Production” is deploymentchannelnaam.

## Historische canonieke baseline vóór release 1.20261011.1 — 2026-10-10

De volgende deploymentgegevens beschrijven de baseline vóór de release hierboven en zijn behouden als historische context.

- Appversie: `1.20261002.1`.
- `origin/main`: `783999044de83c902e63fefb3587fdbbf99d4de3`.
- Vercel-project `liquidhr` (`prj_h3voMtzXGfqG6QTodR5d1VTcC1zP`): deployment `dpl_A9iNj25sybqbsS5zwghbYBSzYhUR` is READY op exact dezelfde main-SHA. Het targetlabel is `production`; dit project is de bestaande synthetic TEST-omgeving.
- Alias `liquid-hr-hr-suite.vercel.app` wijst naar die deployment; de huidige deployment is als rollback candidate gemarkeerd.
- GitHub main-SHA en Vercel deploymentstatus/alias zijn onafhankelijk gecontroleerd. Vercel CLI-upload toont zelf geen Git-SHA; de schone checkout en gebruikte release-SHA zijn in de Codex-handoff vastgelegd.
- Historische ABS02-baseline vóór convergence: `3a0fc67f84bc7dab0acff732afab597142d59ea9`, appversie `1.20260927.3`.
- **Status:** TEST RELEASED; resterende live security-/persona-/exportacceptatie OPEN, dus geen volledige acceptance GREEN.

### Bewezen bij release

- CONTROL01 payrollruntime: synthetische interne JSON-fixture met IKV 1 en 2 verwerkt; één employee, één conceptdienstverband met `EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING`, twee IKV's. 20/20 gerichte payrolltests inclusief veilige resume zonder dubbele employee. De officiële XML/XSD-import is CANCELLED; de interne fixture blijft apart.
- INS01: HR Admin 19 rapporten, Manager 7, Employee 0; directe Bradford-route geeft Manager/Employee geen rapport. CSV-download is gemeld; de laatste inhoudelijke rijscope/filter/formulecontrole blijft OPEN.
- AI01-A: 7 bestanden / 37 gerichte tests GREEN; eerdere remote durability/concurrency-evidence behouden. Live toggle/revocation- en persona-negatives OPEN.
- Control: OWNER werkt; 2 bestanden / 11 tests GREEN. AUDITOR write, invitation reuse/revoke, forged scopes en cross-tenant bootstrap live nog OPEN.
- Kwaliteit: HR full-suite 1.954 geslaagde tests met één PDF-render-timeout tijdens parallelrun; die test geïsoleerd geslaagd in 3,03 s. Geen onjuiste claim van timeoutvrije full-suite-GREEN.
- TypeScript HR/Control, ESLint zonder errors (6 HR-warnings), i18n 41 HR namespaces en 182 Control keys, builds 304 HR / 12 Control routes geslaagd; Vercel HR-build 304 routes.
- Hosted smoke: /login HTTP 200; normale loginopties, Test Auth niet zichtbaar; protected pages redirecten naar login; anonieme /api/context en /api/employees HTTP 401, testauth POST 404.
- Bij de release-closeout geen nieuwe migrations/schemawijzigingen.

Acceptancebron op `main`: `docs/quality/acceptance/runs/CONVERGENCE01-20260928.md`; volg voor de vrijgegeven SHA de releasehandoff van 2 oktober.

## Payroll Lab — PAYLAB00–04 integrated candidate

Payroll wordt niet als aparte gebruikersapp ontwikkeld. Het is een bounded context binnen dezelfde LiquidHR-app/repository, met een pure `packages/payroll-engine` en een aparte Payroll Lab Supabase-database. De geïntegreerde kandidaat is MERGE-READY; de ONE VERSION-releasegate staat hierboven.

Accepted integration:
- branch: `integration/payroll-foundation-20261002`;
- HEAD: `3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96`;
- bronworktree `LiquidHR-Payroll/Code` en oude featurebranches blijven behouden; er is geen cleanup uitgevoerd.
- Desktop en 390 px browserflow, M0/NL-2026-runs en traces, 24 SYSTEM-definities, CUSTOMER_FORK bewaren/heropenen, read-only/copy-regels en negatieve auth-/scopeprobes zijn GREEN.

PAYLAB00:
- **ENVIRONMENT-GATED / CLOSED**;
- isolation foundation en separate Payroll Lab-database staan;
- Core bleef ongewijzigd.

PAYLAB01:
- **PARTIAL**;
- server-only source adapter + canonical source snapshot gebouwd;
- live Core→snapshot browserbewijs bleef buiten die slice/open door eerdere auth/environmentissues;
- IncomeRelationship blijft een expliciet onopgeloste Payroll/Core-source gap; CONTROL02 is CANCELLED.

PAYLAB02 / Engine M0:
- **GREEN voor synthetic M0-scope** op 2026-09-30;
- authenticated HR Admin Test Auth browserflow: Payroll → Payroll Lab → Bereken test payroll;
- run `SUCCEEDED`;
- 9 componentresultaten;
- trace;
- 7 controls PASS;
- GC-NL-001 netto € 3.175,00;
- totale werkgeverskosten € 4.910,00;
- herhaalrun met identieke source/input/result hashes;
- SYSTEM / CUSTOMER_FORK / CUSTOMER_CUSTOM ownership + provenance aanwezig;
- veilige bounded typed expression engine aanwezig;
- productiebuild, typecheck, changed-area lint, i18n en client-secret scan GREEN;
- separate Payroll Lab persistence/readback bewezen;
- alleen expliciet goedgekeurde Lab-testcontextkoppeling toegepast;
- geen Core-writes of permissionwijzigingen.

Bewijsgrens:
PAYLAB02 bewijst de generieke componentengine + synthetic vertical slice; deze synthetic GC blijft als regressiecase naast de afzonderlijke PAYLAB03 compliancecase bestaan.

PAYLAB03 / NL 2026 regular monthly wage:
- **GREEN — uitsluitend WHITE/NL/STD/onder AOW/reguliere volledige maand 2026**; loonheffingskorting aan, en korting uit in de geteste formulevariant.
- CC-NL-2026-001: bruto/fiscaal loon € 4.000,00 → echte loonheffing € 818,67 → netto € 3.181,33.
- Systeemregelset `NL-PAYROLL-2026` versie `2026.1`, engine `0.2.0`; SYS-only registered statutory rule, exact Decimal/breukrekenen en expliciet geversioneerde wettelijke rounding stages met volledige trace.
- 21 onafhankelijk vooraf opgestelde rekengevallen, 10 onafhankelijke officiële witte-maandtabelankers; fiscale oracle onafhankelijk van productiecalculator.
- 2 authenticated browserruns SUCCEEDED, 4 componentresultaten en 4 interne PASS-aansluitcontroles per run, persisted trace en identieke source/input/result hashes.
- Gerichte engine/package/app-tests, typechecks, lint, i18n, productiebuild en client-secret scan volgens acceptance report GREEN; geen volledige hr-suite-regressierun.
- Code-SHA lokaal: `5d7e9fc5e19ff4582787b51e0104c885ac83370a`; bewijsregistratiecommit `ab2e1d5`.
- Alleen synthetische Lab-artefacten; geen Core-write/migration/permissionwijziging. Geen push/merge/deployment.
- De actieve Codex-run las destijds AA op `b71d663`, vóór de latere AA-documentatiecommits; lees bij de volgende run de **nieuwste** AA-branch inclusief rounding/iterative/IKV-invariants en de vaste LUNA MAX-subagentregel. Niet automatisch mergen.

**Bewijsgrens:** dit is niet algemene Nederlandse payrollcompliance. Buiten scope: pensioen, werkgeverspremies, VCR/YTD, gedeelde grondslagen, multi-IKV, iteratie, reserveringen, aangifte, boven-Lmax en live Core→IKV-sourceacceptatie. GC-NL-001 blijft als aparte synthetische M0-regressiecase bestaan.

Acceptancebron (lokaal op de Payroll worktree, nog niet op GitHub): `docs/payroll/acceptance/PAYLAB03-NL2026-REGULAR-WAGE-20260930.md`.


## CONVERGENCE01 — na de TEST-release

De vroegere werkstatus, debugging en checkpoints zijn historische informatie en staan in het gedateerde convergence-acceptatierapport. De actueel geldige toestand is hierboven vastgelegd.

**Eerstvolgende taak:** hervat Nmbrs vanuit de bestaande P0/P1-basis en de bijbehorende acceptatiedocumentatie. CONTROL02 wordt niet hervat. Losse `packages/payroll-engine`-ontwikkeling blijft alleen na dependencycheck afzonderlijk te plannen.

**Belangrijk:** `docs/AA/` staat nog op een afzonderlijke documentatiebranch. Rebase/cherry-pick alleen de definitieve AA-bestanden bovenop de nieuwste `main` wanneer integratie expliciet wordt gepland; merge geen oude baselines blind.

