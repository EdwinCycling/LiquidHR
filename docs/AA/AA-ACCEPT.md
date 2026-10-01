# AA-ACCEPT — Accepted Baseline

Status: **LIVING INDEX**  
Bijgewerkt: 2026-10-01

Dit is geen vervanging voor de gedateerde acceptance reports. Het is de compacte index van wat we als actuele baseline accepteren.

## Verdictdefinities

- **GREEN** — alle verplichte in-scope assertions bewezen.
- **PARTIAL** — waardevol bewijs, maar verplichte assertions open.
- **BLOCKED** — veilige voltooiing niet mogelijk.
- **ENVIRONMENT-GATED** — bewijs begrensd door externe/runtime/toolingcontext zonder automatisch productfalen.

## Actuele accepted baseline

| Slice | Status | Bewijs / opmerking |
| --- | --- | --- |
| ABS02 | GREEN | `docs/quality/acceptance/runs/ABS02-20260927.md` |
| INS01 | PARTIAL | Kernreports/scopes bewezen; volledige live matrix en laatste Bradford-exportparse nog open |
| CONTROL01 | PARTIAL / RELEASE BLOCKER | Basis full-circle bewezen; synthetic import maakte employee maar geen employment/draft; negatives en finale Control gates open |
| AI01-A/A2 | PARTIAL | Durability/concurrency sterk bewezen; feature-toggle/scope-revocation/persona matrix nog open |
| CONVERGENCE01 | PARTIAL — NIET RELEASED | Payrollfinalisatie + open negatives + finale regressiegates blokkeren release |
| PAYLAB00 | ENVIRONMENT-GATED / CLOSED | Isolated Payroll Lab foundation; geen verdere acceptance-RCA nodig voor deze slice |
| PAYLAB01 | PARTIAL | Server-only source adapter + canonical snapshot gebouwd; live Core→snapshot acceptance blijft open |
| PAYLAB02 M0 | GREEN — SYNTHETIC SCOPE | Authenticated browser → componentengine → persistence → SUCCEEDED; 9 results, trace, 7 controls, repeatable hashes |
| PAYLAB03 | GREEN — AFGEBAKENDE NL-2026 FISCALE SCOPE, LOKAAL | WHITE/NL/STD/onder AOW, reguliere maand; onafhankelijke oracle + maandtabelankers; 2 browserruns met identieke hashes; niet gepusht of gedeployed |

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

## Actuele blockers voor CONVERGENCE01

- Synthetic payrollfinalisatie creëerde een employee maar geen employment/draft; veilige recovery zonder duplicate is nog niet bewezen.
- Negatieve Control-autorisatiematrix is niet volledig.
- AI feature-toggle/scope-revocation/personamatrix is niet volledig.
- Laatste full HR-run was 1.933/1.934 door PDF-timeout.
- Latere Control/UI/payroll/schemawijzigingen hebben nog geen finale volledige test-/buildgate.
- Geen version bump, main/origin release-sync, Vercel deploy of hosted smoke.

## CONVERGENCE01 promotion rule

Promoveer INS01, CONTROL01 en AI01-A hier pas naar GREEN wanneer het finale convergence report dat onderbouwt.

Bij GREEN moeten minimaal worden vastgelegd:
- finale convergence/release SHA;
- full-suite resultaat;
- builds;
- remote migration/readback status;
- runtime persona/securitymatrix;
- version;
- main/origin equality;
- Vercel READY + alias;
- hosted safety smoke;
- expliciete niet-blockerende backlog.

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
