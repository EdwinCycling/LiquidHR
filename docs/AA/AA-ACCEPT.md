# AA-ACCEPT — Accepted Baseline

> **Acceptatie-afbakening 18-10-2026:** zie [AA-PAYROLL-CONVERGENCE-20261018](AA-PAYROLL-CONVERGENCE-20261018.md). Historisch bewezen Emma/Noah FINALIZED zijn aparte geldige casussen. CAO-SETUP/PENSION/SOURCE is qua UI en gerichte tests gebouwd, maar Kinderopvang K2/Retail R1/R2 zijn **nog niet als volledige Core-payrollruns met nieuwe PDF's bewezen**. Vereist: echte geautoriseerde broninvoer en readback per werkgever, effectieve schaal/trede/pensioen/looncomponenten, cumulatieven, fiscale controle, 32/32 waar toepasselijk, immutable FINALIZED/PDF/hash, persona- en scope-negatives. Geen review-only status of cataloguspercentage aanmerken als juridisch of end-to-end payrollbewijs.

Status: **LIVING INDEX**
Bijgewerkt: 2026-10-21 (postrelease; historische acceptaties ongewijzigd)

Dit is geen vervanging voor de gedateerde acceptance reports. Het is de compacte index van wat we als actuele baseline accepteren.

## Actuele productcode-baseline — 1.20261021.1 (21 oktober 2026)

**Geïntegreerd en deployed:** source-SHA `c0fa236967ec0708c0a57f72e0dfb29b78b3fead`, Vercel `dpl_CuyAgvBwHr5z9bXNv52Np7SaTxb9` **READY**. De GitHub-developmenthead kan door afzonderlijke docs-only commits verder bewegen zonder de Vercel-runtime te wijzigen. De beperkte geauthenticeerde smoke toont HR Admin/Jupiter, STAR-data, Payroll-hoofdoverzicht, Employee Journey en HeRa-paneel.

**Nog niet accepted:** `/payroll/runs` laadt niet door; Employee FINALIZED-payslip via juiste hosted actor, AI-generatie/Focus-host consent-/revoke-matrix, artifactfingerprint en uitgebreide Payroll/security/GA-gates OPEN. Gedeelde runtime is geen commerciële klantproductiecertificering. **Frits november Jupiter:** opgeslagen gesimuleerde CONCEPT `d8508395-2e25-59be-bc0b-ff2f0b83f7dc`, geen FINALIZED of definitief nettoloon/PDF.

**Cleanup-bewijs na release:** GitHub 10 geïntegreerde remote branches en Vercel negen verweesde previews plus één mislukte build verwijderd; lokaal volgens Codex **2 worktrees over**, met herstelbare refs/stashes. De originele unieke 519-byte `.env.local` van beschermde `work/payroll-p0-p1` is **verloren/geblokkeerd voor runtimegebruik** tot herstel uit oorspronkelijke secretopslag. Zie [postrelease dossier](../quality/acceptance/runs/LIQUIDHR-POSTRELEASE-STATUS-20261021.md). Geen lokale code- of functietests opnieuw gedraaid voor die cleanup.

## Historische main-codebaseline — 1.20261011.2

GitHub `main` staat op `a5d1b3ff61e8c1d1af05a0c89b08a4fe73472495`; appversie is nog `1.20261011.2`. PR #18 is gemerged. Automatische Vercel-deployment `dpl_7HBAyX61sjs1YNtmMZJU55NpNii6` is **READY** op exact die SHA met canonieke alias `liquid-hr-hr-suite.vercel.app`. Dit is beperkt tot de synthetische TEST-omgeving. `APP_VERSION` is niet gebumpt; de §3-metadata-afwijking staat OPEN. APIAI-08 en APIAI-09 hosted acceptance blijven OPEN; zie het [closeoutrapport](../quality/acceptance/runs/APIAI-09-20261012-TEST-RELEASE.md). De vorige NMBRS-01-release, SEC-01-migratiegeschiedenis en eerdere baselines blijven historische context.

PR #16 is gemerged op `ffdca4822fb4cca6e675d9c969b59a12ca664c51`; alleen de geselecteerde, bijgewerkte roadmap/Focus-context is overgenomen. PR #13 is gesloten zonder merge; de niet-goedgekeurde PR #2 is niet gemerged. Oude ONE VERSION-voorstatussen hieronder blijven gedateerde historie en worden niet retroactief gewijzigd.

**Open punten en openstaande bewijslast:** zie [AA-OPEN](AA-OPEN.md). Een punt in dat register is geen nieuw GREEN-verdict; de gedateerde acceptance reports en exacte codeprovenance blijven bepalend. Nieuwe lokale feature-overdrachten zijn pas geïntegreerde baseline na gecontroleerde convergence.

**PMUX-03B branch-kandidaat — LOCAL CODE GREEN, niet onderdeel van de accepted main-baseline:** bestaande Manager-/HR-workdetails tonen routes, besluiten, wijzigingsredenen en voortgang op basis van immutable process versions en bestaande leesrechten. Het formulier past nu in de bestaande taakpagina zonder tweede paginakop of geneste viewportscroll. De volledige lokale read-only RPC-migratie is in PGlite uitgevoerd met de bestaande work-item read-helperdefinities; auth.uid en lagere RBAC-functies zijn testfixtures. De migratie is niet toegepast op Supabase. Database/RLS-autorisatie en echte browser-/390px-acceptatie blijven OPEN. Zie [PMUX-03B evidence](../quality/acceptance/runs/PMUX-03B-20261021-LOCAL.md) en [AA-OPEN](AA-OPEN.md).

**PMUX-03C branch-kandidaat — LOCAL CODE GREEN, niet onderdeel van de accepted main-baseline:** commits `76c258013eb6d3ded81e7f2c6be2d0b0023129d7` en `9a526a6dbd55092c8fc97d341f1014a9200052eb` maken processtappen ordenbaar/verwijderbaar, verbinden Focus-aanvragen alleen bij servergemelde startbaarheid met de gedeelde catalogus, geven begrijpelijke aanvraagstatussen en bewaren terugkeer naar de bestaande Focus-view. 34/34 gerichte tests, TypeScript, changed-file ESLint, i18n en CRLF-aware diff-check zijn groen. Er zijn geen browser-/390px-screenshots, geauthenticeerde rolproeven, DB-readback, remote migratie of synthetische processtarts gedaan. PMUX-03A/03B blijven LOCAL ONLY; zie [PMUX-03C evidence en PMUX-04-plan](../quality/acceptance/runs/PMUX-03C-20261021-LOCAL.md) en [AA-OPEN](AA-OPEN.md).

**APIAI-MASTER-RUN 2026-10-12 — TEST RELEASED — LIMITED; APIAI-08 ACCEPTANCE OPEN; APIAI-09 ACCEPTANCE OPEN:** PR #18-code/test-SHA `27d534fd06fee7868b3bf0534bc3fdb9a3736cd1` (PR-head `c5906d7469ef47fd5b9edf36c412772e9ac98a30`) is gemerged als main-SHA `a5d1b3ff61e8c1d1af05a0c89b08a4fe73472495`. Vercel `dpl_7HBAyX61sjs1YNtmMZJU55NpNii6` is READY op exact die SHA; anonieme login/API/MCP-smoke slaagde. Geauthenticeerde login/sessie- en bestaande hosted regressie-smoke zijn niet uitgevoerd. Pre-release TypeScript, gerichte ESLint, i18n (43 namespaces), diff-check, 19 bestanden/180 tests en full suite (616 bestanden, 2.930 tests; 4/8 overgeslagen) slaagden. Onafhankelijke lokale spec-/standaardenreviews vonden geen blocker; formele GitHub review submissions waren 0 en waren niet vereist door de geconfigureerde repo-regels. Manager consent blijft server-side fail-closed; bestaande OAuth-grants openen Manager-tools niet en Remote Execute blijft UIT. Na release faalde Tools vernieuwen opnieuw en vier oude Talent-calls gaven `-32603`; connectoroorzaak is onbekend. Hosted tests blijven Employee **0/8**, Manager **0/6**; balans, scope/RLS, consent/revoke/reconnect, audit en limiter OPEN; Preview-isolatie OPEN. Geen volledige ACCEPTANCE GREEN. `APP_VERSION` bleef `1.20261011.2`; version bump per AA-REL §3 staat als aparte metadata-afwijking OPEN. Zie [APIAI-09 closeout](../quality/acceptance/runs/APIAI-09-20261012-TEST-RELEASE.md).

**PAY-CONVERGE 2026-10-04:** de CAO-BENCH02-productcode is lokaal geïntegreerd vanaf main 6349d025 en de passende lokale codegates zijn PASS. De integratieacceptatie is PARTIAL en de release-aanbeveling is HOLD: SEC-PAY-001, PAY-RULE-002 en ENV-PREVIEW-010 zijn OPEN; er is geen hosted kandidaatacceptatie of release. Zie het [PAY-CONVERGE-rapport](../payroll/acceptance/PAY-CONVERGE-20261004.md). Dit voegt geen nieuwe accepted TEST-release toe.

**PAY-RELEASE-01 pre-harness voortzetting 2026-10-05:** de extra suite/type/lint/i18n-gates, guarded build op codecommit `0f792665`, directe K1/K2-PDF-rendering en lokale Production-smoke zijn bewijs voor die pre-harness kandidaat. Zie de huidige kandidaatstatus hieronder.

**PAYRUN01 closeout — 2026-10-05:** de lokale geïntegreerde kandidaat c04d8e615afd3d1f42067c38840f8c83f43c3b3f slaagde voor guarded build/provenance, Production-smoke, de geauthenticeerde matrix 6/6 en Payroll Lab Admin-matrix 2/2. De serial suite slaagde met 523 bestanden, 2.217 tests; 3 overgeslagen. Individuele Jan/Lisa payroll-DoD blijft OPEN/UNSUPPORTED wegens geaccepteerde bron-, autorisatie-, CAO-/bedrijfs-, YTD-, kosten- en result lifecycle-gaten. Geen kandidaatdeployment en geen nieuwe TEST-release. Zie het [PAYRUN01-readinessrapport](../quality/acceptance/runs/PAYRUN01-READINESS-20261005.md) en [AA-OPEN](AA-OPEN.md).

## Verdictdefinities

- **GREEN** — alle verplichte in-scope assertions bewezen.
- **PARTIAL** — waardevol bewijs, maar verplichte assertions open.
- **BLOCKED** — veilige voltooiing niet mogelijk.
- **ENVIRONMENT-GATED** — bewijs begrensd door externe/runtime/toolingcontext zonder automatisch productfalen.

## Actuele accepted baseline

| Slice | Status | Bewijs / opmerking |
| --- | --- | --- |
| APIAI-09 limited TEST | **TEST RELEASED — LIMITED; APIAI-08/09 ACCEPTANCE OPEN** | Main `a5d1b3ff61e8c1d1af05a0c89b08a4fe73472495`; Vercel `dpl_7HBAyX61sjs1YNtmMZJU55NpNii6` READY, exact main SHA, canonical alias. Anonymous safety smoke passed. No authenticated login/regression smoke; Employee 0/8, Manager 0/6; Preview isolation and version metadata OPEN. [Run report](../quality/acceptance/runs/APIAI-09-20261012-TEST-RELEASE.md) |
| Vorige TEST-release 1.20261011.2 (NMBRS-01) | **TEST RELEASED — LIMITED; NMBRS OAUTH/PREVIEW AND SEC-01 HOSTED ACCEPTANCE OPEN** | Automatic READY `dpl_BVuywDYacYZk2DXn9ZNkgVRgkvkp` on exact main SHA `58dc758c950b4e6da45c43a1692f45eb0fc019e9`; canonical alias `liquid-hr-hr-suite.vercel.app`; AA-REL §7 smoke passed. SEC-01 TEST-applied, source/registration versions `20261011120317` / `20261011130922` |
| ABS02 | GREEN | `docs/quality/acceptance/runs/ABS02-20260927.md` |
| INS01 | TEST RELEASED; ACCEPTANCE PARTIAL | Persona-catalogus/live Bradford-route bewezen; volledige API-/scope-/exportmatrix en laatste CSV-inhoudcontrole nog OPEN |
| CONTROL01 | TEST RELEASED; ACCEPTANCE PARTIAL | Full-circle/OWNER en nieuwe synthetische payroll-import met employment draft runtime-bewezen; live actor-/invite-/cross-tenant-negatives OPEN |
| AI01-A/A2 | TEST RELEASED; ACCEPTANCE PARTIAL | Durability/concurrency bewezen, 37 gerichte tests; live toggle/revoke/persona-negatives OPEN |
| CONVERGENCE01 | **TEST RELEASED; SECURITY ACCEPTANCE OPEN** | App `1.20260928.1`; `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`; Vercel `dpl_CANMAQydQcYGy9Xe7JhNm8grJuvH` READY |
| PAYLAB00 | ENVIRONMENT-GATED / CLOSED | Isolated Payroll Lab foundation; geen verdere acceptance-RCA nodig voor deze slice |
| PAYLAB01 | PARTIAL | Server-only source adapter + canonical snapshot gebouwd; live Core→snapshot acceptance blijft open |
| PAYLAB02 M0 | GREEN — SYNTHETIC SCOPE | Authenticated browser → componentengine → persistence → SUCCEEDED; 9 results, trace, 7 controls, repeatable hashes |
| PAYLAB03 | GREEN — AFGEBAKENDE NL-2026 FISCALE SCOPE, LOKAAL | WHITE/NL/STD/onder AOW, reguliere maand; onafhankelijke oracle + maandtabelankers; 2 browserruns met identieke hashes; niet gepusht of gedeployed |
| PAYLAB04 | GREEN | Componentbibliotheek: 24 SYSTEM-definities read-only; CUSTOMER_FORK detached/save/reopen; RegisteredRule niet kopieerbaar; negatieve auth-/scopeprobes |
| PAYLAB00–04 integrated candidate | **MERGE-READY** | `integration/payroll-foundation-20261002` at `3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96`; desktop/390 px production browser acceptance and independent LUNA MAX review passed. ONE VERSION release evidence is in `docs/quality/acceptance/runs/ONE-VERSION-20261002.md`. |

## ABS02 accepted kern

Accepted onder meer:
- manager/employee absence scope;
- multi-employment KPI;
- recovery-window normalisatie;
- direct DML hardening;
- ACT-AS START/STOP;
- WvP foundation/tasks/idempotency;
- gerichte regressies + volledige suite/build van die release.

Gebruik voor detail uitsluitend het acceptance report.

## CONVERGENCE01 TEST-release: bewezen en nog OPEN

**Bewezen TEST-release:**
- Appversie `1.20260928.1`; GitHub `main`/vrijgegeven codecommit `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`; Codex bevestigde dezelfde lokale `main`.
- Vercel `liquidhr` `dpl_CANMAQydQcYGy9Xe7JhNm8grJuvH` READY, beide bestaande aliases; geen Git-SHA in CLI-deploymentmetadata, dus niet onafhankelijk uit Vercel metadata te herleiden.
- Payroll met geldige synthetic interne fixture runtime: employee + employment draft + twee IKV's. `EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING` correct; 20/20 regressietests voor o.a. safe resume. Oude ongeldige historische batch bleef onaangeraakt.
- HR 1.954 tests geslaagd, één parallelle PDF-timeout; dezelfde test geïsoleerd PASS in 3,03 s. Geen volledige timeoutvrije full-suite claim.
- Control 11/11 tests; TypeScript beide apps; ESLint zonder errors/6 HR-warnings; i18n 41 HR namespaces en 182 Control keys; HR build 304/304 en Control build 12/12; remote Vercel HR-build geslaagd.
- Hosted login en minimale anonieme API/auth-beveiligingssmoke positief.

**Nog OPEN in gerichte TEST-acceptatie (niet stilzwijgend promoveren):**
- Control: live AUDITOR-write, uitnodigingstoken reuse/revoke, forged tenant/group/administration, cross-tenant en tweede bootstrap.
- INS01: CSV-bestandsinhoud op rijscope, filterpariteit en spreadsheet-formuleveiligheid; resterende directe API-/forged context-/reportmatrix.
- AI01-A: live feature-toggle na sessiestart, scope-revoke en complete gescopeerde HR Admin/Manager/Employee forgerymatrix.
- Officiële loonaangifte XML/XSD-adapter is CONTROL02 en niet door de synthetische interne JSON-test bewezen.

**Promotion rule:** pas de in-scope securityacceptatie op GREEN zetten na gedateerde, daadwerkelijke live-negative-evidence. De reeds gedane TEST-release hoeft niet opnieuw als geblokkeerd te worden beschreven. Elke opvolgende bugfix krijgt een eigen commit/deployment en controle op dezelfde baseline.

Detail: `docs/quality/acceptance/runs/CONVERGENCE01-20260928.md` op `main` plus Codex-releasehandoff 2026-10-02.

## Niet als GREEN behandelen zonder bewijs

- alle 19 Insights reports volledig geharmoniseerd: **niet impliceren**; catalogus-/regressiebewijs is niet hetzelfde als end-to-end reportharmonisatie; INS02 is de harmonisatiewave;
- official Loonaangifte XML/XSD support: **niet CONTROL01 claimen**; CONTROL01 bewijst foundation/staging/contracts, CONTROL02 levert jaaradapter, readiness UI en productimport;
- parser/stagingbewijs is niet automatisch bewijs dat bestaande-medewerker matching, conflictresolutie en de volledige HR Admin importwizard productaccepted zijn;
- AI commercial tiers/creditvalues: **AI01-B/productbesluit**;
- full WvP case management: **WVP01**;
- Payroll: **geen aparte gebruikersapp**; bounded context binnen dezelfde LiquidHR-app/repository met pure engine package en aparte Payroll-database. PAYLAB02 blijft uitsluitend synthetic M0. PAYLAB03 bewijst alleen de expliciet afgebakende NL-2026 reguliere maandcase, geen algemene fiscale NL-2026-compliance.

## PAYLAB02 accepted kern

Accepted voor synthetic M0:
- bestaande HR Admin Test Auth → Payroll → Payroll Lab;
- echte componentengine-uitvoering;
- `SUCCEEDED` persistence;
- netto € 3.175,00 en werkgeverskosten € 4.910,00 voor GC-NL-001;
- 9 componentresultaten, trace en 7 passing controls;
- repeatability met identieke source/input/result hashes;
- SYSTEM / CUSTOMER_FORK / CUSTOMER_CUSTOM ownership/provenance;
- bounded typed expression engine;
- geen Core-write of permissionwijziging;
- bestaande LiquidHR UI-shell/styles/componenten hergebruikt.

Niet accepted door PAYLAB02:
- fiscale Nederlandse 2026-correctheid;
- live Core employment/IKV end-to-end source acceptance;
- CONTROL02/IncomeRelationship-contracten;
- production release/deployment van Payroll.

Detailbewijs:
`docs/payroll/acceptance/PAYLAB02-M0-20260930.md`

## PAYLAB03 accepted kern

Volgens het gedateerde lokale PAYLAB03-acceptatierapport:

- supported: reguliere volledige maand 2026, WHITE/NL/STD, jonger dan AOW, loonheffingskorting aan (uit afzonderlijk formulegetest), één synthetische werknemer/employment/IKV;
- CC-NL-2026-001: fiscaal loon € 4.000,00; loonheffing € 818,67; netto € 3.181,33;
- 21 onafhankelijke cases, 10 onafhankelijke officiële witte-maandtabelankers;
- 2 echte geauthenticeerde browserruns SUCCEEDED, 4 componentresultaten + 4 interne PASS-aansluitcontroles, trace, DB-readback en repeatable source/input/result hashes;
- exact-decimal/breukberekeningen, expliciete wettelijke rounding stages en volledige rounding trace;
- codecommit `5d7e9fc5e19ff4582787b51e0104c885ac83370a`; documentatiecommit `ab2e1d5`, beide nog lokaal;
- geen Core-write, nieuwe migratie, rolwijziging, push, merge of deployment.

De vier controls zijn interne aansluitcontroles; fiscale uitkomsten zijn afzonderlijk door de oracle en officiële tabelankers getoetst.

Niet accepted: pensioen, werkgeverspremies, VCR/YTD, shared bases, multi-IKV, iteratie, boven-Lmax, loonaangifte of de live Core-sourceadapter. Geen algemene fiscale of productiereleaseclaim.

Detailbewijs is vooralsnog **alleen lokaal** op de Payroll worktree:
`docs/payroll/acceptance/PAYLAB03-NL2026-REGULAR-WAGE-20260930.md`.
Voeg pas een GitHub-acceptancelink toe nadat de Payroll branch daadwerkelijk is gepusht/geïntegreerd.

## Acceptance bron

Voor volledige evidence:
`docs/quality/acceptance/runs/`

Rapporteer nooit een test als uitgevoerd alleen omdat de code of een aangrenzende test bestaat.

