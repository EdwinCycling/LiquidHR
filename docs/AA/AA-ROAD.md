# AA-ROAD — Long-Term Product Roadmap

Status: **STRATEGISCH / LIVING**
Bijgewerkt: 2026-10-18 (STAR-V2-04D-1; Core-prioriteiten blijven leidend)

De volgorde binnen horizons kan veranderen. AA-NEXT bepaalt de concrete eerstvolgende runs.

**Core-productbesluit 2026-10-13:** rond PERF01-B2 (CONTROLLED server-side medewerkerpagination) eerst af. Daarna volgt **WVP01**, vervolgens **INS02**. Dashboardoptimalisaties zijn op synthetische TEST geïntegreerd; AI on-demand bestaat al, maar zonder gekwantificeerde winst. De AI-, Payroll- en Nmbrs-roadmaps worden in andere threads bijgewerkt.

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
- STAR-V2-04C — read-only Talentpaspoort is lokaal geaccepteerd op basis van de gedateerde [acceptance-evidence](../quality/acceptance/runs/STAR-V2-04C-CLOSE-20261018.md); de centrale catalogusuitbreiding volgt als 04D-1;
- STAR-V2-04D-1 — centrale Insights-categorie **Talent & Ontwikkeling** is lokaal geaccepteerd; de catalogus ontsluit alleen bestaande Star Performers- en Talent-rapporten met bestaande scope-, filter- en exportcontracten; zie [acceptance-evidence](../quality/acceptance/runs/STAR-V2-04D-1-LOCAL-20261018.md);
- STAR-V2-04D-2 — afzonderlijke volgende slice voor verdere Talent Insights-integratie; niet onderdeel van 04D-1;
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

### Payroll Lab — geïsoleerde bounded context in dezelfde monorepo

De inmiddels gekozen richting is **niet** een aparte kopie van LiquidHR of een zelfstandige Payroll-gebruikersapp:
- dezelfde `EdwinCycling/LiquidHR`-monorepo;
- pure Supabase-/Next-/React-onafhankelijke TypeScript-engine in `packages/payroll-engine`;
- server-only sourceadapter, application services en repository in de HR-suite;
- een aparte Payroll Lab Supabase-database voor snapshots, rules, runs, componenten, traces en controls;
- één bestaande LiquidHR-login, expliciete tenant/HR-groep/administratieautorisa­tie bij iedere serverrepositoryactie;
- géén rechtstreekse browserverbinding naar Payroll DB, géén cross-database FK's;
- immutable input snapshots + rule- en engineversies voor herleidbaarheid;
- aanvankelijk handmatige source-sync/recalculate, pas later events/outbox.

Bestaand lokaal bewijs: PAYLAB02 synthetic M0 GREEN en PAYLAB03 beperkte NL-2026 reguliere maandcase GREEN; de Payroll-code is nog **niet** in de canonieke `main` geïntegreerd. Verdere PAYLAB04-componentcatalogus en cao-/benchmarkvoorstellen zijn details in `AA-NEXT`; geen algemene NL-payrollcomplianceclaim.

**Parallelisering:** engine en geïsoleerde Lab-database mogelijk onafhankelijk ontwikkelen; shared Control-/Core-/IKV-contracten en migrations alleen na expliciete dependencycheck/integratie. Geen blinde merge van payrollworktrees of migrationlineage.

Onderzoek/vervolg:
- continu berekende conceptloonperiode en payroll by exception;
- deterministic calculation engine, geversioneerde regels/facts;
- looncomponenten, cao-/bedrijfseigen regelpakketten, fiscale regels;
- pensioen, werkgeverspremies/VCR, auto, WKR, TWK;
- approvals, loonstrook/aangifte, reproduceerbare snapshots en betalingen.

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
