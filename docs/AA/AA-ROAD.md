# AA-ROAD — Long-Term Product Roadmap

Status: **STRATEGISCH / LIVING**
Bijgewerkt: 2026-09-29

De volgorde binnen horizons kan veranderen. AA-NEXT bepaalt de concrete eerstvolgende runs.

### AI-roadmap (actuele productbesluiten 2026-10-10)

De volledige AI-productvolgorde, evidence-status, implementatie-/acceptatiegates en iteratieraming staan in de **[LiquidHR AI Master Roadmap](../requirements/ai/LIQUIDHR_AI_MASTER_ROADMAP.md)**. Deze is de AI-specifieke detailroadmap; AA-ROAD blijft de algemene productroadmap en AA-NEXT bepaalt de eerstvolgende uitvoeringswave.

Actuele beoogde volgorde: ONE VERSION stabiliseren → APIAI-08 ESS afmaken → APIAI-09 MSS in één grote bouwslag → APIAI-10 Focus Plugin Extensions voor ChatGPT → APIAI-11 Trusted Actions. Brede HR Admin-/publieke API-/agentuitbreiding is geparkeerd. De huidige technische/release-status moet vóór iedere bouwslag opnieuw tegen main, Vercel en acceptance evidence worden vastgesteld.

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
