# AA-ROAD — Long-Term Product Roadmap

Status: **STRATEGISCH / LIVING**
Bijgewerkt: 2026-10-13 (Core/PERF- en Payroll-status)

De volgorde binnen horizons kan veranderen. AA-NEXT bepaalt de concrete eerstvolgende runs.

**Core-productbesluit 2026-10-13:** rond PERF01-B2 (CONTROLLED server-side medewerkerpagination) eerst af. Daarna volgt **WVP01**, vervolgens **INS02**. Dashboardoptimalisaties zijn op synthetische TEST geïntegreerd; AI on-demand bestaat al, maar zonder gekwantificeerde winst. De AI-, Payroll- en Nmbrs-roadmaps worden per eigen thread onderhouden; de Payroll-update van 2026-10-13 is hieronder selectief verwerkt.

### AI-roadmap

De actuele AI-productvolgorde en status staan in de [LiquidHR AI Master Roadmap](../requirements/ai/LIQUIDHR_AI_MASTER_ROADMAP.md). AA-ROAD blijft de brede productroadmap; AA-NEXT bepaalt de eerstvolgende concrete uitvoeringswave. Technische acceptatie blijft leidend in AA-CURRENT, AA-ACCEPT en de gedateerde runrapporten.

## COMMITTED FOUNDATIONS

### Core HR
- medewerker;
- dienstverband;
- contract;
- HR-groep / administratie;
- organisatie;
- autorisatie;
- instellingen;
- dossier/documenten;
- leave/absence foundation.

### Control Plane
- gesloten leveranciersapp;
- tenant lifecycle;
- HR-groepen/administraties bootstrap;
- platformrollen;
- first-admin lifecycle;
- contextselectie.

### Insights
- scoped reportcatalogus;
- betrouwbaar filter/exportmodel;
- verdere harmonisatie via INS02.

### AI Foundation
- governed AI actions;
- credits/accountingfoundation;
- durable settlement/recovery;
- employee/team sessions/tools;
- voice foundation.

### Payroll — actief gebouwd productspoor

De Payroll-foundation is niet langer slechts een verkenning. Reeds op de gezamenlijke synthetische TEST uitgerold: componentenbibliotheek en -editor (SYSTEM + gescopeerde klant-DRAFTs), Payroll Lab UX, versiegebonden NL-2026-rekenbasis voor afgebakende cases, PAYRUN01-lifecycle en LiquidHR Standard PDF-loonstrook. De volledige generieke Nederlandse salarisberekening is **niet** bewezen.

- Bounded context in dezelfde HR-suite en monorepo, met pure componentgraph-engine (`packages/payroll-engine`) en eigen Payroll Supabase-database; geen tweede gebruikersapp of browser→Payroll-DB.
- Immutable source snapshots, inputsets, calculation runs, controls, trace, componentversies en FINALIZED-documenten.
- **PAYESS-01** medewerkerdashboard, maandhistorie en gecombineerd geïmporteerd/gegenereerd loonstrokendossier: gebouwd/gepusht, geauthenticeerde security-acceptatie en TEST-release nog OPEN.
- **PAYCALC-REAL-01** PayrollCycle/werklijst: uitsluitend lokale foundation; generieke Core-backed bruto/netto is geblokkeerd op ontbrekend geaccepteerd fiscaal broncontract.
- Voorgenomen richting: daadwerkelijke generieke berekening → meerdere conceptrevisies/uitzonderingen per periode → review/finalisatie → eventgedreven continuous payroll, nooit automatische betaling/aangifte.

Leidende, gedateerde Payroll-status en gedetailleerde volgorde: [Payroll roadmap 2026-10-13](../payroll/PAYROLL-ROADMAP-20261013.md). Release-/security-OPEN blijft leidend in [AA-OPEN](AA-OPEN.md). In deze Payroll-thread is geen nieuwe AI-capability uitgebracht; de AI Master Roadmap blijft een afzonderlijk spoor.

## CANCELLED

### Loonaangifte onboarding/import — CONTROL02

**Status: CANCELLED — 2026-10-10.** De officiële Loonaangifte-XML-import,
CONTROL02-finalisatie en bijbehorende E2E-acceptatie zijn beëindigd. Een
eventuele herstart vereist een nieuw projectbesluit. De bestaande interne
representatieve import en CONTROL01 blijven afzonderlijke functionaliteit.
TEST-records en CONTROL02-databaseobjecten blijven behouden totdat een exact
decommissionplan afzonderlijk is goedgekeurd.

## PLANNED

### WvP / Verzuim — WVP01, volgende Core-wave na PERF01-B2
- hergebruik bestaande `absence_tasks`, milestone-/generator- en casemanagerfoundation;
- volledige caseworkspace: Overzicht / Tijdlijn / Acties / Dossier / Re-integratie / Historie;
- versieerbare SYSTEM-milestones, custom/recurring taken en toekomstprojectie;
- expliciete casemanagerautorisatie, HR-groepoptie en veilige backfill voor actieve cases;
- RIV-readiness, werkvoorraad, reminders en inzichten;
- verifieer de actuele wettelijke bronset vóór de eerste implementatieslice.

### Workforce Insights — INS02, na WVP01
- Report Consistency Contract voor filters, definities, KPI/chart/tabel/drilldown/export en scopes;
- Headcount/FTE als referentierapport;
- hires/exits;
- turnover;
- tenure;
- contractmix/expirations;
- workforce composition;
- salary/workforce analyses;
- cross-domain reports.

### Talent
- skills/competencies;
- POP;
- vlootschouw/9-grid;
- continuous appraisal;
- talentdashboards.

### Journeys
- preboarding;
- onboarding;
- buddy;
- configurable employee journeys;
- automation/timeline.

### Recruitment
- guided/light ATS;
- vacature/kandidaatflows;
- promote-to-employee;
- veilige publieke recruitmentlaag.

### Documents & Signing
- templates;
- placeholders;
- editor;
- AI generation;
- multi-send;
- dossieropslag;
- signing;
- interne signing eerst, externe signing gefaseerd.

### AI Commercialization
- Liquid Credits;
- subscription tiers;
- budget/usage governance;
- feature-depth controls;
- agents/automation waar aantoonbaar waardevol.

## EXPLORE

### Payroll — gereserveerde uitbreidingen

Het operationele Payroll-spoor staat hierboven bij **COMMITTED FOUNDATIONS**, met de actuele [gedetailleerde Payroll-roadmap](../payroll/PAYROLL-ROADMAP-20261013.md). Nog te verkennen of afzonderlijk te accepteren: bredere fiscale en cao-dekking, PFZW/wettelijke allocatie en cumulatieven, multi-IKV, variable mutaties/TWK, jaaropgaven, veilige betalings-/aangifte-adapters en later eventgedreven `Payroll by Exception`.

**PAYLAB-COMPARE-01 is bewust PARKED**; een echte run-tegen-run-vergelijking is niet gestart. Een mogelijke AI-agent voor uitleg of voorbereiding van uitzonderingen vereist een afzonderlijke governance-/veiligheidswave en is niet onderdeel van de gerealiseerde Payroll-engine.

### Internationale HR
Onderzoek/gefaseerd:
- België;
- Duitsland;
- landspecifieke identificatievelden;
- voorkomen dat NL-only velden buiten NL foutief dominant zijn.

### Integratie-ecosysteem
- payrollproviders;
- MCP/API;
- geselecteerde third-party HR/payroll/integratiepartners;
- import/exportconnectors.

### Mobile / ESS / MSS
- verdere employee/manager self-service;
- mobile-first workflows waar taakfrequentie dit rechtvaardigt.

## PARKED / EXPLICITLY NOT AUTOMATIC

- Payroll Lab blijft een geïsoleerde bounded context binnen de monorepo; niet automatisch in LiquidHR-Core-schema, auth of gedeelde migrations inbouwen.
- Geen externe signing beloven voordat product/security/legal scope expliciet is vastgesteld.
- Geen internationale payroll bouwen als bijproduct van HR-internationalisatie.
- Geen features activeren alleen omdat er technische foundation bestaat.

## Productregel

Nieuwe ideeën verplaatsen pas van Explore → Planned → AA-NEXT na expliciet besluit, dependencycheck en concrete Definition of Done.
