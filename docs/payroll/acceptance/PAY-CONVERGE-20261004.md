# PAY-CONVERGE — CAO-BENCH02 + AA-OPEN — 2026-10-04

**Verdict: lokale integratie gereed; lokale codegates PASS; CAO-acceptatie PARTIAL; releaseadvies HOLD.** Dit is een lokale kandidaat. Er is niet gepusht, gemerged, gedeployed of geversion-bumpt.

## Baseline en provenance

- GitHub main is read-only bevestigd op 6349d02538351cd01fc51f298c6e6fa0ba88006c. De bestaande Vercel-deployment dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5 was READY op dezelfde SHA; dit is niet de PAY-CONVERGE-kandidaat.
- Kandidatenbranch en worktree: integration/pay-converge-20261004, gestart vanaf exact main in Integration-PAY-CONVERGE-20261004.
- De vijf CAO-BENCH02-commits zijn in volgorde geïntegreerd. De apps/- en packages/-bestanden op de kandidaat zijn identiek aan de CAO-overdracht na 8a84abcacb6df9e8d05ba8eeb55ac74060df8e2d; de finale productcode is gelijk aan source productcommit 07cb05eabf9cfeadbc1a94eb210f066c116a44f7.
- De volledige tests/type/lint/i18n-gates draaiden op dezelfde productboom; de schone guarded build en lokale serverprovenance zijn exact vastgelegd op 9547f40c2427a249d27fff99ec867869d7c07268. De latere convergentiestatus wijzigde alleen documentatie; apps/ en packages/ zijn sindsdien ongewijzigd.
- De AA-OPEN-broncommit 1a2a0fbbb702b32554e7af247b6b67e3d713a501 heeft als ouder de geverifieerde main. Het register en de bijbehorende AA-regels zijn opgenomen; AA-CURRENT en AA-NEXT zijn voor de geïntegreerde kandidaat bijgewerkt.
- Appversie blijft 1.20261002.1. Er zijn geen Core-, CONTROL02- of API/AI-featurebranches geïntegreerd.

De Core/API-AI-branches zijn alleen geïnventariseerd en blijven onaangeroerd: ABS02 (3a0fc67), AI01-A (9f6896d), CONTROL01 (83952aa), CONTROL02 XML V1 (38af35c), INS01 (e0adac8), APIAI-D0 (ffd0790), APIAI-01 (3a02911), APIAI-02 implementation (36e7adb) en APIAI-02 workforce (1792c15).

## Hergebruikt bewijs

Het volledige fase-2-browserbewijs wordt alleen hergebruikt omdat de apps/- en packages/-boom byte-identiek is aan de bewezen CAO-productboom. De TEST-database is in deze convergence niet opnieuw uitgelezen.

- De zeven persistent opgeslagen scenario’s K1, K2, R1, R2, B1, B2 en C1, H1-applicability, hun traces en runreadbacks staan in het [fase-2-acceptatierapport](CAO-BENCH02-PHASE2-20261003.md).
- K1/K2-conceptstroken en PDF/JSON-inhoudspariteit, bestaande rol-/groepscopeprobes en de desktop- en iPhone 16-weergave 393×852 zijn eerder op diezelfde productboom uitgevoerd. De echte Mars-only actor → Jupiter-negatieve proef is niet uitgevoerd en blijft OPEN.
- Historische M0/NL-2026-traces, de 24 SYSTEM-componenten, CUSTOMER_FORK save/reopen en bestaande Manager-scopeweigering blijven onder de eerder geaccepteerde [PAYLAB-integratieacceptatie](PAYLAB-FOUNDATION-INTEGRATION-20261002.md) en [ONE VERSION-run](../../quality/acceptance/runs/ONE-VERSION-20261002.md). Die resultaten zijn niet opnieuw opgehaald of gemuteerd.

## Payroll-migraties

Alle vijf nieuwe bestanden staan uitsluitend in apps/hr-suite/lib/payroll/supabase/migrations:

- 20261003100000_paylab05_arrangement_foundation.sql
- 20261003123000_paylab05_arrangement_integrity_hardening.sql
- 20261003130000_paylab05_arrangement_availability_validity.sql
- 20261003140000_paylab06_audited_availability_start.sql
- 20261003180000_paylab06_benchmark_fixture_codes.sql

De bestaande Payroll TEST-readbacks registreren de migraties als toegepast. Voor de eerste drie zijn serverversies 20261003122457, 20261003122705 en 20261003124346 vastgelegd; de fase-2-overdracht registreert de laatste twee als toegepast en teruggelezen. De derde bronmigratie is na de oorspronkelijke lege-tabelfixture gehard en is niet opnieuw uitgevoerd. In deze convergence is geen databaseledger opnieuw bevraagd, migration gewijzigd of remote SQL uitgevoerd. Core-migraties en packages/db zijn ongewijzigd.

## Lokale gates

| Gate | Resultaat |
| --- | --- |
| Volledige HR-suite, serial | PASS — 523 bestanden, 2.195 tests; 3 overgeslagen |
| Strict TypeScript | PASS — apps/hr-suite en payroll-rules-cao-bench02 |
| ESLint | PASS — 0 fouten, 6 warnings in de bestaande payroll-import/service.test.ts |
| NL/EN i18n | PASS — 41 namespaces |
| Production build via centrale TEST-launcher | PASS — 309/309 pagina’s |
| Payroll client-boundary | PASS — negatieve controle en scan van 152 browserassets |
| Lokale browser, desktop/mobiel | Login en beschermde redirect bevestigd op 1440×900 en 393×852; geen horizontale overflow |
| Anonieme API-negatieve proef | PASS — K1 validation-pack request kreeg 401; response bevatte geen K1-run-ID |

De volledige suite is gedraaid met --no-file-parallelism, overeenkomstig de fase-2-overdracht. Build en browser draaiden als lokale Production-mode met de centrale Payroll TEST-configuratie; buildprovenance is gecontroleerd. De guarded launcher rapporteerde alleen dat vereiste configvelden aanwezig zijn, nooit hun waarden. De browser was anoniem; er is geen bestaande login ingezonden en geen identiteit aangemaakt. De lokale browserproef bewijst geen persona-/tenant-isolatie en vervangt de eerdere geauthenticeerde featureacceptatie niet.

De lockfile-installatie gaf een niet-blokkerende enginewaarschuwing: de host is Node v22.14.0, terwijl @sparticuz/chromium 149.0.0 Node ^22.17.0 of >=24 vraagt. De suite, typechecks en build slaagden; herhaal de echte PDF-runtimeacceptatie op een ondersteunde Node-versie voordat die runtime wordt vrijgegeven.

## OPEN-punten en releasebesluit

- SEC-PAY-001 blijft OPEN: bewijs van een Mars-only admin die de bestaande Jupiter-K1-run server-side niet kan lezen ontbreekt. Er is geen goedgekeurde provisioner; er is geen identiteit aangemaakt.
- PAY-RULE-002 blijft OPEN: de opgeslagen K2-waarde 1911.735632183908045976 en de HALF_UP-weergave € 1.911,74 bewijzen geen wettelijke afrondingsregel.
- PAY-COVER-003, PAY-CORE-004 en overige platform-, Control-, Insights- en AI-evidence blijven volgens [AA-OPEN](../../AA/AA-OPEN.md) ongewijzigd OPEN.
- Read-only Vercel-metadata van 2026-10-04 toont geen Preview-deployment. De vereiste Payroll Preview-variabelen staan alleen op Production; gedeelde Core Production/Preview entries bewijzen geen gescheiden URL-inhoud. Een gedeelde TEST-database is geen Preview-vervanger.
- Er is geen hosted READY-deployment of safety smoke op deze kandidaat-SHA. De bestaande READY-deployment staat op main 6349d025.

AA-REL §8 laat een beperkte synthetische TEST-release alleen toe na alle lokale gates, exacte candidate provenance, hosted READY/safety smoke, een zichtbare OPEN-matrix en Edwins expliciete besluit. De hosted kandidaatproef ontbreekt en ENV-PREVIEW-010 is niet ingericht.

**Aanbeveling: HOLD.** De codeconvergentie en lokale gates zijn gereed, maar de kandidaat is niet release-ready. Houd SEC-PAY-001 zichtbaar OPEN, claim geen CAO-/fiscale correctheid voor K2 en laat de bestaande main/TEST-deployment ongemoeid totdat de ontbrekende Preview- en hosted gates zijn ingericht en het beperkte TEST-besluit expliciet is genomen.

## PAY-RELEASE-01 voortzetting — 2026-10-05

**Status: definitieve lokale codegates PASS; releasebesluit HOLD tot expliciet akkoord en hosted bewijs.** Remote `main` blijft `6349d02538351cd01fc51f298c6e6fa0ba88006c`; de bestaande Vercel-productiondeployment is READY op die baseline. Er is geen kandidaat-deployment of Preview-deployment. Er is niet gepusht, gemerged, gedeployed, geversion-bumpt of op een database geschreven.

### Aanvullende lokale gates

- De verificatie is opnieuw uitgevoerd onder Node `24.19.0`, passend bij de live projectinstelling `24.x` en de enginevoorwaarde van `@sparticuz/chromium` 149 (`^22.17.0 || >=24.0.0`). De eerdere hostmelding over Node `22.14.0` is hiermee voor deze verificatie ondervangen.
- HR-suite: PASS — 523 testbestanden; 2.195 tests geslaagd, 3 overgeslagen. De bestaande server-only-importscan kreeg uitsluitend een ruimere timeout (20 naar 60 seconden), omdat de scan onder Node 24 de eerdere limiet overschreed; de scanasserties zijn ongewijzigd.
- TypeScript: PASS — `apps/hr-suite` en `payroll-rules-cao-bench02`. NL/EN i18n: PASS — 41 namespaces. ESLint: PASS — 0 fouten en 6 bestaande warnings in `payroll-import/service.test.ts`.
- De bestaande K1- en K2-validation-pack JSON-inputs zijn met de echte `renderCaoBench02ValidationPackPdf`-functie gerenderd onder Node 24 en lokale Chrome. Beide PDF's hebben 13 pagina's; geëxtraheerde inhoud is exact gelijk aan de eerder opgeslagen PDF-inhoud. De PDF-bytes/SHA verschillen door de aanmaak-/wijzigingstijdstempels.
  - K1-run `81160d5e-6eac-4975-bfdb-a540911b8680`: bruto `2777.000000000000000000` (weergave € 2.777,00), arrangement `2026.07`, regels `2026.01`; gegenereerde SHA-256 `81744d5576e0a31667c5fa177333e3682cbc44367c934999d5f10214954822c2`.
  - K2-run `4f5e6cc0-f12a-45c2-9be5-6ff61d1cb064`: bruto `1911.735632183908045976` (weergave € 1.911,74), arrangement/regels `2026.09`; gegenereerde SHA-256 `ed64b1924c949cb984522220fdb74ed651bc8c5b2b323c10aa61c14012a3ae8c`.
- Deze PDF-proef bewijst de directe renderer met historische pack-inputs; zij roept de geauthenticeerde API-route niet aan en bewijst geen serverless-Chromium- of hosted PDF-runtime.
- Read-only migratieledgercontrole bevestigde de zeven reeds geregistreerde Payroll Lab-migraties: twee baselineversies (`20260930125822`, `20261001155314`) plus de vijf PAYLAB05/06-migraties (`20261003122457`, `20261003122705`, `20261003124346`, `20261003171547`, `20261003174936`). Er is niets toegepast of herschreven. De bron van `20261003130000` was na toepassing op de oorspronkelijke lege fixture gehard; die migratie is niet opnieuw uitgevoerd.
- De guarded productiebuild slaagde op kandidaatcommit `0f792665be6fb46ebcc4f3ebe7dc19bf1aba2618`: 309/309 pagina's, TypeScript-build, client-boundary negatieve controle en scan van 152 browserassets; buildprovenance is geschreven voor exact die SHA. Lokale Production-smoke op `127.0.0.1:3011` gaf `/login` 200, `/payroll-lab` 307 naar login, valide anonieme K1-validation-pack 401 zonder run-ID in de response, Test Auth en rolwissel POST beide 404 (`TEST_LOGIN_DISABLED` / `TEST_ROLE_SWITCH_DISABLED`) en `/api/test-capture` 404. De door ons gestarte listener is daarna gestopt; poort 3011 is vrij.
- Dit is uitsluitend lokale runtime-evidence met de centrale TEST-config. Het is geen hosted safety smoke, persona-/tenantbewijs, Vercel-serverless-PDF-proef of bewijs dat Test Auth op de hosted omgeving ontoegankelijk is.

### TEST-HARNESS01 en integratiekeuze

De zelfstandige harnessbranch is exact gecontroleerd: `work/test-harness01-20261004`, implementatiecommit `dfb752ee917f2f138d5dce79d5232b6508738c03`, definitieve HEAD `f0ca2e25ff4f6d17416b47d09374339e360f168c`. De aangeleverde lokale acceptatie is 6/6 browsercombinaties GREEN (HR Admin, Manager, Medewerker op desktop en iPhone 16), met regressietests, securityreview en productiebuild. De oorspronkelijke origin-403 is opgelost en is niet opnieuw onderzocht.

Integratie is uitgesteld naar de eerste PAYLAB05-voorbereiding. De precieze branchdelta omvat gedeelde test-login-, rolwissel-, context-cookie- en Payroll capability-routes en tests, plus een omvangrijke lokale runtime-owner/lock/stop-runner en acceptatiescripts. De onafhankelijke review vond geen P1/P2-codebevindingen, maar wel een documentatiestandaardpunt en twee lage duplicatiesmells in het harnessrapport/runner. Dit valt buiten een smalle release-only wijziging; een integratie vraagt opnieuw auth-/securityreview en de volledige gezamenlijke gates. De PAY-RELEASE-kandidaat blijft daarom inhoudelijk ongewijzigd. Zie de actuele registratie in [AA-OPEN](../../AA/AA-OPEN.md), QA-HARNESS-005.

### Open releasevoorwaarden en besluit

- `SEC-PAY-001`, `PAY-RULE-002`, `PAY-COVER-003`, `PAY-CORE-004` en de overige niet-relevante platform-openpunten blijven zichtbaar in AA-OPEN; geen volledige ACCEPTANCE GREEN-claim.
- `ENV-PREVIEW-010` blijft OPEN: er is geen geïsoleerde Preview-deployment en de benodigde Payroll Preview-configuratie ontbreekt. AA-REL §6 blokkeert daarmee de nieuwe PR-Preview-gate; §8 biedt alleen ruimte voor een bewust beperkte synthetische TEST-release na expliciet besluit en alle daar genoemde eisen. Edwin moet de ontbrekende Preview voor deze kandidaat dus uitdrukkelijk als beperkte TEST-uitzondering accepteren.
- Een hosted kandidaatdeployment, canonical-alias/SHA-readback en hosted safety smoke ontbreken. Na een expliciet GO voor de releaseacties blijft de hosted smoke een harde voltooiingsgate; verifieer daarop expliciet dat Test Auth en rolwissel niet bereikbaar zijn en dat TEST_CAPTURE niet publiek is.
- Lokale releasegates zijn afgerond op codecommit `0f792665be6fb46ebcc4f3ebe7dc19bf1aba2618`; documentatie legt de bewijsupdate vast zonder app-/packagewijzigingen. Appversie blijft voorlopig `1.20261002.1`; voorgestelde volgende versie na GO is `1.20261005.1`.

**Advies blijft HOLD tot die lokale eindgates slagen en Edwin expliciet akkoord geeft met (a) beperkte synthetische TEST met open punten, (b) Preview-uitzondering voor deze kandidaat, (c) één version-only verhoging en (d) gecontroleerde merge/push naar `main` met de bestaande Vercel-gitflow.** Zonder dat akkoord blijven `main`, Vercel en de appversie ongemoeid.
