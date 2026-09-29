# AA-ACCEPT — Accepted Baseline

Status: **LIVING INDEX**  
Bijgewerkt: 2026-09-29

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
- standalone Payroll Engine: **experiment, buiten LiquidHR core**.

## Acceptance bron

Voor volledige evidence:
`docs/quality/acceptance/runs/`

Rapporteer nooit een test als uitgevoerd alleen omdat de code of een aangrenzende test bestaat.
