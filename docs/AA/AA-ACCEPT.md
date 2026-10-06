# AA-ACCEPT — Accepted Baseline

Status: **LIVING INDEX**
Bijgewerkt: 2026-10-02

Dit is geen vervanging voor de gedateerde acceptance reports. Het is de compacte index van wat we als actuele baseline accepteren.

**Open punten en openstaande bewijslast:** zie [AA-OPEN](AA-OPEN.md). Een punt in dat register is geen nieuw GREEN-verdict; de gedateerde acceptance reports en exacte codeprovenance blijven bepalend. Nieuwe lokale feature-overdrachten zijn pas geïntegreerde baseline na gecontroleerde convergence.

**Bijgewerkt onderscheid voor lopende lokale builds (2026-10-04):** remote `main` is gecontroleerd op `6349d025...` / `1.20261002.1`; ONE VERSION hosted acceptance GREEN is **volgens de release-eigenaar**, onafhankelijke volledige bewijsreview PENDING. CONTROL02 XML 2026/XSD/readiness/preview is volgens de lokale handoff op `38af35c2...` gerichte tests en deels remote Core TEST-readbacks verder, maar **PARTIAL / NOT MERGE-READY** wegens de historische secret, ontbrekende bevoegde CONTROL01-testcontext, echte JWT-/desktop-/390-px-acceptatie, niet-toegepaste scope-invariantmigratie en gedeeld Core-/Payroll-contract. De gemelde CAO-BENCH02-voortgang (zeven benchmarks) blijft lokaal `PARTIAL` zonder Mars-only → Jupiter admin-negative. **Geen** van die lokale voortgangen wordt door dit indexbericht als op `main` vrijgegeven of volledig GREEN aangemerkt. Zie [AA-OPEN](AA-OPEN.md) en de oorspronkelijke gescopeerde runrapporten.

**CONTROL02 2026-10-05:** Draft PR #4 is remote reviewbaar maar **PARTIAL / NOT MERGE-READY**. XML/XSD/readiness/matching/preview en scope-/contractartefacten staan in de Draft PR; de lokale FINAL-doorbouw heeft aanvullend gerichte hardening maar is nog niet remote geïntegreerd. Gerichte tests zijn GREEN; een eerdere brede suite bevatte nog twee inmiddels gericht herstelde parserfailures plus timeouts en is niet opnieuw als full-suite GREEN gedraaid. Echte desktop/390-px XML-flow en JWT-negatieven blijven OPEN door de geautoriseerde context/secretgates. Geen definitieve Core-write of releaseclaim.

**CONTROL02 FINAL 2026-10-05 (persisted decisions):** Draft PR #6 is **REVIEWABLE / PARTIAL / NOT MERGE-READY**. Authenticated server-side decision persistence, readback/freshness, persisted previewplans, concurrency-race invalidatie en refresh-safe wizardstate zijn gebouwd. Kritieke 5 bestanden / 48 tests, strict TypeScript, NL/EN en lint zonder errors zijn GREEN. De brede suite heeft 2.261 tests GREEN maar één bestaande server-only timeout en is daarom niet volledig GREEN. Niet accepted: per-action freshness/transaction-lease bescherming voor activering, remote migration/readback/RLS/JWT-negatives, volledige desktop/390px XML-flow, gedeeld Core/Payroll-contract, definitieve XML Core-writes of release.

**CONTROL02 2026-10-06:** De actuele PR #6 is **LOCAL BUILD/SUITE GREEN, ACCEPTANCE PARTIAL / NOT ACTIVATION-READY**. Codex rapporteert 539 HR-testbestanden/2.282 tests GREEN, 3 overgeslagen, strict TypeScript, changed lint, 41 namespaces, 308-route build en 154 browserasset scan. Planner/executor hebben pre-action proof en afhankelijkheden; de ledgerkandidaat heeft leasefencing en de wizard recoverytellingen; contextselectie heeft aparte componenttests. Er is geen echte Core-writeadapter, geen finalizeroute, geen live database/RLS/JWT-negatives of volledige XML-browseracceptatie. Remote ledger-/scope-migraties blijven unapplied. Het technische pre-action-contract is geen bewijs van atomische Core-writeveiligheid. Onafhankelijke review in deze single-agent run niet gedaan. Nieuwe main `38ccbcac...` is nog niet in de gestapelde PR #4/#6 gereconcilieerd. Zie AA-OPEN §3D.

## Verdictdefinities

- **GREEN** — alle verplichte in-scope assertions bewezen.
- **PARTIAL** — waardevol bewijs, maar verplichte assertions open.
- **BLOCKED** — veilige voltooiing niet mogelijk.
- **ENVIRONMENT-GATED** — bewijs begrensd door externe/runtime/toolingcontext zonder automatisch productfalen.

## Actuele accepted baseline

| Slice | Status | Bewijs / opmerking |
| --- | --- | --- |
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
