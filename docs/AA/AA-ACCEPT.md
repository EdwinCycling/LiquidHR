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
| INS01 | IN CONVERGENCE | Definitief verdict volgt uit CONVERGENCE01 |
| CONTROL01 | IN CONVERGENCE | Definitief verdict volgt uit CONVERGENCE01 |
| AI01-A/A2 | IN CONVERGENCE | Durability/concurrency sterk bewezen; persona closeout loopt |
| CONVERGENCE01 | IN FLIGHT | Huidige releasecloseout loopt op `work/CONVERGENCE01-20260928` |

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

- alle 19 Insights reports volledig geharmoniseerd: **niet impliceren**; INS02 is de harmonisatiewave;
- official Loonaangifte XML/XSD support: **niet CONTROL01 claimen**; CONTROL02;
- AI commercial tiers/creditvalues: **AI01-B/productbesluit**;
- full WvP case management: **WVP01**;
- standalone Payroll Engine: **experiment, buiten LiquidHR core**.

## Acceptance bron

Voor volledige evidence:
`docs/quality/acceptance/runs/`

Rapporteer nooit een test als uitgevoerd alleen omdat de code of een aangrenzende test bestaat.
