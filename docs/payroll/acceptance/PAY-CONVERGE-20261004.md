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
