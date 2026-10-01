# AA-NEXT — Short-Term Roadmap

Status: **ACTUEEL / LIVING**  
Bijgewerkt: 2026-10-01

Deze roadmap bevat alleen de komende concrete productwaves. Detailrequirements staan elders.

## CURRENT — CONVERGENCE01

Status: **PARTIAL / RELEASE BLOCKED — nog niet vrijgeven**.

Doel:
- INS01 + CONTROL01 + AI01-A convergeren;
- runtime/persona/securityacceptatie afronden;
- volledige releasegates GREEN;
- version bump en Vercel-release pas daarna.

Laatste bekende convergence HEAD uit de lopende run:
`9029f52e20f7559b6dded2682856f0f544db9bcf`

De eerdere Control OWNER-loginblokkade is opgelost. De huidige primaire blocker is de synthetic payrollfinalisatie: employee is aangemaakt, employment/draft ontbreekt. Eerst dit veilig root-causen en herstellen zonder duplicate, daarna open security/persona-probes en finale gates.

Na GREEN moeten AA-CURRENT, AA-ACCEPT en deze roadmap onmiddellijk worden bijgewerkt.

## NEXT — CONTROL02

**Loonaangifte XML Import V1 + Readiness UI**

Doel:
- HR Admin importscherm onder **Instellingen → Medewerkers & dienstverband → Loonaangifte XML importeren**;
- server-side readiness-paneel dat actuele stamdata controleert;
- groen = gereed, oranje = import kan met draft/follow-up, rood = veilige import geblokkeerd, grijs = niet vereist;
- readiness minimaal voor actieve HR-groep, actieve administratie, importrechten en na parsing LhNr/jaar/tijdvak/source support;
- arbeidsvoorwaarden/contractinrichting mogen als oranje ontbreken en leiden dan tot veilige draft/follow-up;
- afdelingen, functies, kostenplaatsen en salarisstructuur zijn niet automatisch blockers;
- upload → detect → analyse → matching → preview → confirm → result;
- bestaande medewerkers veilig herkennen en aanvullen: EXACT / PROPOSED / MANUAL REVIEW / NEW;
- bestaande medewerker nooit dupliceren omdat dezelfde persoon opnieuw via XML binnenkomt;
- bron-/LiquidHR-verschillen op veldniveau zichtbaar maken; niet blind overschrijven;
- één persoon met meerdere IKV's correct behandelen;
- geen voornaam uit initialen verzinnen;
- BSN uitsluitend via bestaande secure identifier/fingerprintarchitectuur;
- geen fictieve stamdata aanmaken;
- preview = nul definitieve domain writes;
- ontbrekende niet-blokkerende inrichting leidt tot draft/follow-up;
- jaar-/namespaceadapterarchitectuur;
- representative synthetic XML + geanonimiseerde real-world fixture;
- formele XSD-validatie alleen claimen voor jaren met de bijpassende officiële XSD;
- volledige gerichte import/security/UI acceptance, inclusief readiness-statussen en refresh na stamdatawijziging.

Belangrijke input:
- bestaande CONTROL01 stagingtabellen/services;
- echte Exact-achtige 2025 Loonaangifte;
- 2026 gegevensspecificatie;
- 2027 XSD;
- officiële 2026 XSD toevoegen zodra beschikbaar voor formele 2026 XSD-validatie.

## THEN — WVP01

**Wet verbetering poortwachter Case Management**

Niet opnieuw foundation bouwen. Bestaand:
- `absence_tasks`;
- generator/completion RPC;
- milestonecodes;
- task templates;
- case managervelden;
- absence lifecycle/effective clock.

Doel:
- template- en actual-tasklagen convergeren;
- versieerbare SYSTEM milestones;
- custom/recurring tasks;
- future projection timeline;
- exacte case-managerautorisatie;
- werkvoorraad;
- Overzicht / Tijdlijn / Acties / Dossier / Re-integratie / Historie;
- RIV-readiness;
- reminders/reports;
- optioneel per HR-groep;
- veilige backfill actieve cases.

Voor implementatie actuele main opnieuw scannen en actuele wettelijke bronset verifiëren.

## THEN — INS02

**Report Consistency + Headcount/FTE reference report**

Doel:
- bestaande rapporten inventariseren tegen één Report Consistency Contract;
- waar nodig harmoniseren: header, definities, filters, chips/reset, KPI, chart, table, drilldown, export, states, scope;
- KPI/chart/table/drill/export exact dezelfde querysemantiek;
- eerste nieuwe referentierapport: Headcount & FTE Trend;
- Manager dezelfde structuur maar scoped;
- Employee geen management Insights.

## THEN — AI01-B

**Liquid Credits & Commercial Governance**

Doel:
- huidige AI-runtime niet herbouwen;
- allowance/quota;
- charge catalog;
- extra credits/validity;
- usage/budget inzicht;
- admin warnings;
- capabilitymodel verfijnen;
- commerciële tierwaarden pas vastleggen na expliciet productbesluit.

## PARALLELLE PAYROLLTRACK — NA PAYLAB03

PAYLAB03 is lokaal **GREEN voor de beperkte 2026-reguliere maandcase** (zie AA-CURRENT/AA-ACCEPT); er is nog geen push, merge of deployment. De codebranch en de intussen bijgewerkte AA-documentatiebranch moeten vóór de volgende run bewust worden gereconcilieerd, zonder blind te mergen.

Voorgesteld volgende productonderwerp, pas definitief maken na expliciete scopekeuze:

- PAYLAB04: bestaande SYSTEM Payroll Components en het regelpakket ontsluiten via een versioned Payroll Component Library/catalogus; geen volledige designer;
- PAYLAB05 (later): component Designer bovenop de bestaande veilige engine/DSL;
- CAO-BENCH01: publieke Cao Kinderopvang als benchmark voor bestaande componenten, arrangement packages, effective dating en gap-analyse (geen officiële cao-publicatie);
- PROFORMA00/01: aparte, gescopeerde pro-forma-scenario's bovenop dezelfde engine; eerst synthetische full-month what-if + onderbouwde bruto-naar-netto en netto-naar-bruto-inversie. Na live Core-to-IKV-proof en bredere rules volgen HR-kopie bestaande medewerker en medewerker-selfservice; geen kopie van niet-geautoriseerde salarisdata.
- afzonderlijke fiscale vervolgslices: pensioen, werkgeverspremies/VCR, Zvw, bijzondere beloning en overige 2026-situaties op basis van officiële bron- en compliancecases;
- CONTROL02/Core IncomeRelationship-contract expliciet vastleggen vóór echte multi-IKV-integratie;
- iteratieve clusters en gedeelde IKV-grondslagen blijven gereserveerde architectuurinvarianten totdat een afgesproken slice ze implementeert.

Geen van deze onderwerpen is reeds geaccepteerd door PAYLAB03.

## THEN — PAY-CONVERGE

Reconcile bestaande payrollworktrees en migrationlineage tegen dan-actuele main.

- niet blind cherry-picken;
- unieke commits/data-contracten behouden;
- obsolete experimenten expliciet markeren;
- Payroll Lab niet behandelen als standalone gebruikersapp: behoud de bounded-contextarchitectuur binnen LiquidHR, met pure engine package en aparte Payroll-database;
- behoud PAYLAB02 M0 componentengine/ownership/expression-contracten;
- PAYLAB03 versie van de afgebakende NL-2026 fiscale maandcase behouden, met onafhankelijke oracle en officiële tabelankers; overige NL-situaties apart plannen.

## THEN — AW02

Vervolg Actual Work na bovenstaande productwaves, op actuele requirements en accepted baseline.

## Onderhoud

Dependency/security maintenance is een aparte bounded wave en wordt niet opportunistisch in productfeatures gemengd.
