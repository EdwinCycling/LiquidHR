# AA-ROAD — Long-Term Product Roadmap

> **Actuele integratiestatus 21-10-2026:** STAR V2, Employee UX, Payroll en AI/MCP/Focus zitten in de live productcode `1.20261021.1` (`c0fa2369`), Vercel READY. De bredere onderstaande productroadmap verandert hierdoor niet in 'geleverd'. Frits/Jupiter november is een opgeslagen fictieve **CONCEPT**, niet netto/FINALIZED; `/payroll/runs` moet nog worden hersteld. De beschermde Payroll/Nmbrs-omgeving heeft een ontbrekende originele `.env.local`. Zie [postrelease status](../quality/acceptance/runs/LIQUIDHR-POSTRELEASE-STATUS-20261021.md).

> **Strategische Payroll-roadmap 19-10-2026:** [AA-PAYROLL-COMMERCIAL-ROADMAP-20261019](AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md) is leidend voor de gewenste commerciële positionering en productfasen. Productprincipe: een deterministische, wettelijk onderbouwde salarisengine met transparante bron-/berekeningstraces, effectieve versiecorrecties, proactief exceptionbeheer en onder menselijke controle staande AI-acties. De roadmap onderscheidt expliciet een demo-PDF, een technisch werkende cao-run, een beperkte pilot en volledig commerciële NL-payroll met jaarwerk, aangifte en betalingen. Genoemde iteraties zijn ramingen, geen product-releasegaranties.

> **Productrichting 18-10-2026 (historische status-snapshot):** Payroll groeit van historische Lab-onderzoekslijn naar **volwaardige reguliere klantmodule**, met centraal officieel cao-/pensioenregister, versieerbare salarisbronnen, bedrijfseigen regelingen en employer/employee-UI, continue bron- en kwaliteitscontroles, periodieke payroll-by-exception, cumulatieven, jaaropgaaf, loonaangifte en betalingstraject (apart te autoriseren). Zie [AA-PAYROLL-CONVERGENCE-20261018](AA-PAYROLL-CONVERGENCE-20261018.md) voor de toenmalige DONE/HOLD per fase; de geselecteerde code is inmiddels geïntegreerd en Git-gekoppeld naar Vercel uitgerold; roadmap-items en volledige wettelijke/productacceptatieclaims blijven afzonderlijk te bewijzen. De oude Lab-notities hieronder zijn ontwikkelhistorie, geen gewenst eindproduct.
>
> **STAR/Workforce UX-roadmap:** Employee UX-code is geïntegreerd in de live code-release; vervolgpunten blijven medewerkerpagina vereenvoudigen, minder scrollen, lazy loading en responsive kaartteksten. Activa, Software, Wagenpark en Budgetten uit huidige betrokken navigatie/schermen verwijderen, **maar als toekomstige afzonderlijke modules op de roadmap behouden**.

Status: **STRATEGISCH / LIVING**
Bijgewerkt: 2026-10-22 (PMUX-04R5; Core-prioriteiten blijven leidend)

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

### Process Automation — PMUX
- PMUX-02A/02B en 03A zijn lokaal gebouwd; PMUX-03B breidt de bestaande `/work`-details uit voor MSS/HR met besluiten, terugstuurreden, voortgang en historie.
- PMUX-03C is lokaal afgerond op `9a526a6dbd55092c8fc97d341f1014a9200052eb` (voortbouwend op `76c258013eb6d3ded81e7f2c6be2d0b0023129d7`): stap ordenen/verwijderen, alleen servergeautoriseerde Focus-catalogusnavigatie, gespecificeerde Focus-statussen en terugkeer naar de juiste Focus-context. De capabilitymatrix en zes-vragenbeoordeling zijn vastgelegd; browser-/rolacceptatie is nog OPEN.
- PMUX-04 blijft de afzonderlijke geauthenticeerde browseracceptatie met synthetische gegevens. PMUX-04R5 bevestigt dat HR Admin-routes lokaal op TEST-context laden, maar owner/Manager/Employee, live securityproeven en PNG-bestanden blijven OPEN; /focus/aanvragen geeft 404 en Opleidingsaanvraag is niet beschikbaar in het getoonde procesoverzicht. De catalogusmigratie is eerder op TEST toegepast en de migratiehistorie is volgens PMUX-04R2 gereconcilieerd; PMUX-03B-historiemigratie blijft LOCAL ONLY. Geen volledige acceptatie. Zie [AA-OPEN](AA-OPEN.md), [PMUX-04R5 evidence](../quality/acceptance/runs/PMUX-04R5-20261022-BROWSER-RESULTS.md) en de eerdere [PMUX-04 evidence](../quality/acceptance/runs/PMUX-04-20261021-TEST-ACCEPTANCE.md).
- Zie [AA-OPEN](AA-OPEN.md), [PMUX-03C evidence](../quality/acceptance/runs/PMUX-03C-20261021-LOCAL.md) en de eerdere [PMUX-03B evidence](../quality/acceptance/runs/PMUX-03B-20261021-LOCAL.md).

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
- STAR-V2-04D-2A — geaggregeerd **Functieprofiel & skillgaps** is **LOCAL DONE** met bestaande bronservices, het bestaande `talent_job_profile_readmodel`, bestaande teamscope/RLS en zonder schema-/permissiewijziging. HR Admin, Manager-empty-state, gecontroleerde positieve Manager-fixture en Employee-deny zijn bewezen; zie [acceptance-evidence](../quality/acceptance/runs/STAR-V2-04D-2A-LOCAL-20261018.md);
- STAR-V2-04D-2B — POP-dekking & ontwikkelvoortgang is **LOCAL DONE** met bestaande development-goals- en Continuous Appraisal-readservices, unieke denominatorpariteit, Manager-direct-team-scope en Employee-deny; zie [acceptance-evidence](../quality/acceptance/runs/STAR-V2-04D-2B-LOCAL-20261018.md);
- STAR-V2-04D-2C — **9-gridbeweging & campagnehistorie** is **LOCAL DONE**. De live TEST-campagnes zijn correct als niet-vergelijkbaar gemarkeerd omdat geen `previous_campaign_id` is vastgelegd; vergelijkbare beweging, unchanged/no-history en incompatibele campagnes zijn met geïsoleerde fixtures bewezen. Zie [acceptance-evidence](../quality/acceptance/runs/STAR-V2-04D-2C-LOCAL-20261018.md);
- STAR-V2-04D-2D — **Continuous Appraisal Insights** is **LOCAL DONE** met bestaande appraisal-readservices, unieke geautoriseerde denominators, agreement-/follow-upstatussen, metadata-only CSV en HR Admin/Manager/Employee-rolbewijs; zie [acceptance-evidence](../quality/acceptance/runs/STAR-V2-04D-2D-LOCAL-20261018.md);
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

### Employee profile — later modules

Activa, Wagenpark, Softwarelicenties en Budgetten blijven toekomstige productmodules. Hun kaarten zijn vanaf 2026-10-18 uitsluitend in de medewerkerprofiel-UI tijdelijk verborgen totdat de modules functioneel klaar zijn. Dit is een zichtbaarheidkeuze voor deze pagina, geen functionele verwijdering van de productrichting. Opleidingen valt buiten deze keuze.

### Payroll Lab — geïsoleerde bounded context in dezelfde monorepo

Actuele productstatus 2026-10-16 (boven oudere M0/PAYLAB-historie):** PAYFULL-02 heeft op Draft PR #33 twee controleerbare Mars TEST-maandgevallen met volledige netto- en werkgeverskostenberekening, FINALIZED-lifecycle en persistente PDF-loonstroken. Een derde variabele-loonrevisie blijft CONCEPT. Dit is geen generieke NL Payroll-compliance of release op `main`. Prioriteit: gerichte ESS/PDF-closeout (huidig PARTIAL; artifactbytes en routechecks bewezen, inline browser-PDF nog OPEN), daarna verbreding naar LHK/deeltijd/andere tabellen/bijzondere beloningen/meer IKV's, TWK en payroll by exception. Vergelijking met andere pakketten is geen LiquidHR-ontwikkelwerk. Zie [actuele Payroll-roadmap](AA-NEXT.md) en [validatiescenario's](../payroll/PAYFULL-02-VALIDATIE-EN-ROADMAP-20261016.md).

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

### Internationale HR
Onderzoek/gefaseerd:
- België;
- Duitsland;
- landspecifieke identificatievelden;
- voorkomen dat NL-only velden buiten NL foutief dominant zijn.
