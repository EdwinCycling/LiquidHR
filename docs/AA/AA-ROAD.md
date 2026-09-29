# AA-ROAD — Long-Term Product Roadmap

Status: **STRATEGISCH / LIVING**  
Bijgewerkt: 2026-09-29

De volgorde binnen horizons kan veranderen. AA-NEXT bepaalt de concrete eerstvolgende runs.

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

## PLANNED

### Loonaangifte onboarding/import
CONTROL02 en vervolgstappen:
- jaaradapters;
- readiness;
- matching/upsert;
- IKV/dienstverbandimport;
- gecontroleerde mapping en drafts;
- officiële schemaondersteuning per aangiftejaar.

### WvP / Verzuim
- volledige WvP case workspace;
- milestones/taken;
- case manager;
- re-integratie/dossier;
- RIV;
- reminders en inzichten.

### Workforce Insights
- Headcount/FTE;
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

### Standalone Payroll Engine Lab

Bewust **apart experiment**:
- aparte repository;
- aparte Next.js-app;
- aparte Supabase-projectdatabase;
- aparte Vercel-app indien/wanneer nodig;
- geen LiquidHR migrations/codebase vervuilen zolang haalbaarheid niet bewezen is;
- wel dezelfde architectuur-, security- en testprincipes.

Onderzoek:
- continu berekende conceptloonperiode;
- payroll by exception;
- deterministic calculation engine;
- versioned rules/facts;
- looncomponenten;
- tax;
- pensioen;
- auto;
- WKR;
- TWK;
- approvals;
- payslip/declaration output;
- reproduceerbare snapshots.

Pas na bewezen waarde ontwerpen we een gecontroleerde integratie met LiquidHR.

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

- Geen eigen payroll engine automatisch onderdeel maken van LiquidHR-core.
- Geen externe signing beloven voordat product/security/legal scope expliciet is vastgesteld.
- Geen internationale payroll bouwen als bijproduct van HR-internationalisatie.
- Geen features activeren alleen omdat er technische foundation bestaat.

## Productregel

Nieuwe ideeën verplaatsen pas van Explore → Planned → AA-NEXT na expliciet besluit, dependencycheck en concrete Definition of Done.
