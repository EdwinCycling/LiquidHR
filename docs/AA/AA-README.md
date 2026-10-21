# AA — canonieke documentatierouter

> **Nieuwe Payroll-productroadmap 19-10-2026:** [AA-PAYROLL-COMMERCIAL-ROADMAP-20261019](AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md) — van eerste toonbare loonstrook en K2/Retailscenario's naar commercieel complete NL-payroll, daarna Payroll Flightdeck, Evidence Graph, Cao/Pension Autopilot, Time Machine en AI Payroll Copilot. Plan en hypotheses, geen reeds geaccepteerde functionaliteit. Zie daarnaast de actuele statusoverdracht van 18 oktober.

> **Actueel 21-10-2026:** gezamenlijke STAR/Employee UX/Payroll/AI-code is al geïntegreerd op productcode `c0fa2369` / versie `1.20261021.1` en Vercel is READY. Cleanup 07–09 reduceerde volgens Codex 29 → 2 lokale worktrees; ontbrekende 519-byte Payroll/Nmbrs-`.env.local` is een open herstelincident. `/payroll/runs` en AI/ESS/Payrollease eindgates blijven open. Lees eerst [postrelease- en cleanupstatus](../quality/acceptance/runs/LIQUIDHR-POSTRELEASE-STATUS-20261021.md); historische 18-oktober/03B-verslagen blijven bronbewijs, geen actuele HOLD.

Status: **LEIDEND** · levende afspraken worden in deze bestaande documenten bijgewerkt; Git bewaart de geschiedenis.

## Verantwoordelijkheid per document

| Bestand | Verantwoordelijkheid |
| --- | --- |
| [Postrelease status 21-10-2026](../quality/acceptance/runs/LIQUIDHR-POSTRELEASE-STATUS-20261021.md) | Geïntegreerde code-/Vercelstatus, cleanup, configuratie-incident, actuele OPEN-matrix, GO/HOLD. |\n| [`AGENTS.md`](../../AGENTS.md) | Compact, bindend uitvoeringscontract en niet-onderhandelbare grenzen |
| `AA-README.md` | Deze router: wat lees je voor welke taak? |
| [`AA-OP.md`](AA-OP.md) | Codex-mandaat, bounded execution en Git-/parallelregels |
| [`AA-TEST.md`](AA-TEST.md) | Risicogestuurde teststrategie en verdicts |
| [`AA-REL.md`](AA-REL.md) | PR, integratie, merge, deployment, provenance en cleanup |
| [`AA-CURRENT.md`](AA-CURRENT.md) | Compacte actuele bewezen baseline; richtlijn maximaal 100–150 regels |
| [`AA-NEXT.md`](AA-NEXT.md) | Eerstvolgende productwaves en hun volgorde |
| [`AA-OPEN.md`](AA-OPEN.md) | Open beslissingen, bewijs-/fixturegaten, eigenaar en afsluitproef |
| [`AA-ACCEPT.md`](AA-ACCEPT.md) | Index van accepted baselines; geen vervanging van gedateerde rapporten |
| [`AA-REQ.md`](AA-REQ.md) | Fundamentele product-, data-, security- en architectuurinvarianten |
| [`AA-PAYROLL.md`](AA-PAYROLL.md) | Payrollbounded context, precisie, wettelijke regels, provenance en gates |
| [`AA-ROAD.md`](AA-ROAD.md) | Langetermijnproductrichting |
| [`../architecture/PRODUCT_ENVIRONMENT_PARITY.md`](../architecture/PRODUCT_ENVIRONMENT_PARITY.md) | Bindende productregel voor gelijke werking per omgeving, klantpresentatie, interne herkomst en TEST-veiligheidsgrenzen |
| `docs/requirements/`, ADR/FDR en domeindocumenten | Alleen requirements en architectuur die de feitelijke wijziging raakt |

## Standaard leesroute

1. Lees `AGENTS.md` en de concrete opdracht/acceptatiecriteria.
2. Lees de actuele samenvatting bovenaan `AA-CURRENT.md`.
3. Gebruik deze tabel en taakmatrix om alleen de toepasselijke AA-secties te openen.
4. Lees alleen domeinrequirements, ADR/FDR's en tests die door de feitelijke wijziging worden geraakt.
5. Zoek in historische documenten gericht op een route, identifier, datum of bewijsclaim; laad een heel historisch bestand alleen als de taak dat nodig maakt.

De AA-CURRENT-startcontext blijft compact. Een nieuwe taak hoeft niet standaard het volledige `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md`, `docs/delivery/IMPLEMENTATION_STATUS.md`, `AA-ACCEPT.md`, `AA-OPEN.md` of de volledige AA-set te lezen.

## Taakmatrix

| Taak | Leesroute |
| --- | --- |
| Gewone bugfix/feature | `AGENTS.md`, opdracht, relevante delen van `AA-OP.md` en `AA-TEST.md`, huidige status alleen waar relevant, geraakte domeinrequirement |
| Toolkit-/proceswijziging | `AGENTS.md`, `AA-OP.md`, `AA-TEST.md`, `AA-REL.md` voor integratie, de toolkitbestanden en relevante tests |
| Auth, security, tenant, schema of RLS | Bovenstaande plus relevante delen van `AA-REQ.md`, toepasselijke domeinrequirements/ADR en exacte bestaande acceptance-evidence |
| Payroll | Alleen voor zover geraakt `AA-PAYROLL.md`, `AA-OP.md`, `AA-TEST.md` en relevante Payroll-requirements/evidence |
| Productflow of omgeving-/herkomstverschil | `PRODUCT_ENVIRONMENT_PARITY.md`, `AA-REQ.md`, `AA-TEST.md` en de geraakte domeinrequirement |
| Merge/release/deployment | `AA-OP.md`, `AA-TEST.md`, `AA-REL.md`, actuele `AA-CURRENT.md`; alleen relevante rijen uit `AA-ACCEPT.md`/`AA-OPEN.md` en het exacte runrapport |
| Roadmapbesluit | `AA-NEXT.md`, relevante `AA-ROAD.md`-sectie en alleen de benodigde `AA-CURRENT.md`/`AA-OPEN.md`-status |

Voor lokale TEST-runtime of geïsoleerde Vercel Preview: raadpleeg gericht [`docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`](../delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md).

## Instructieprioriteit

1. Huidige expliciete opdracht en het daarin gegeven mandaat.
2. Niet-onderhandelbare privacy-, security- en data-integriteitsgrenzen.
3. `AGENTS.md` als operationeel contract.
4. Alleen de toepasselijke uitvoeringsregels uit `AA-OP.md`, `AA-TEST.md`, `AA-REL.md` en eventueel `AA-PAYROLL.md`.
5. Goedgekeurde domeinrequirements en architectuur; bij een TEST/Production-productconflict is [PRODUCT_ENVIRONMENT_PARITY](../architecture/PRODUCT_ENVIRONMENT_PARITY.md) leidend boven oudere domeinspecificaties.
6. Historische acceptance-/deliveryrapporten als bewijs of context, nooit als actuele werkinstructie zonder controle.

Bij conflict: stel vast welk document verantwoordelijk is, herstel de afspraak daar en verwijder de tegenstrijdige instructie waar die ontstond. Verander geen historische verdicts retroactief. Een aanname of implementatieclaim wordt niet stilzwijgend `GETEST`, `GREEN` of `RELEASED`.

## Onderhoud

- Werk het canonieke document bij; maak geen `v2-final-final`-kopieën of parallelle archieven.
- Houd `AA-CURRENT.md` op actuele status en compacte links; detailbewijs blijft in het bestaande gedateerde rapport.
- Wijzig `AA-NEXT.md` alleen met de expliciete actuele productvolgorde; verplaats geen onuitgevoerd item stilzwijgend naar `GREEN`.
- Voeg een `AA-OPEN.md`-item alleen toe voor een concreet vastgesteld bewijs-, beslis- of omgevingsgat, met eigenaar, bestaand bewijs, heropeningsvoorwaarde en afsluitproef.
- Bewaar historische rapporten en unieke bewijsvoering; corrigeer een actuele index met een nieuwe verwijzing of status in plaats van een historisch verdict te herschrijven.
