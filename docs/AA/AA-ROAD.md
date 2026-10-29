# AA-ROAD — Long-Term Product Roadmap

> **PAY-W04-CONTROLLED-MERGE-15 — 29-10-2026:** PR #51 is met normale mergecommit `3852618b7fa6ee3e1c70a95a510e871e7fa2f308` geïntegreerd. Actual Work → Payroll-bronconsumptie **PASS**: 1,00 vrijgegeven uur × EUR 20,00 levert tweemaal bronhash `29c4df0df85cbd3125594f590996cc0135cf858c4ee3006a334c0d8793aca348` en EUR 20,00 bruto-componentbasis. Volledige Payroll-berekening, vierwekenberekening en Vercel TEST-release blijven **HOLD**; er is geen loonrun/deployment uitgevoerd. Na merge: 201/201 gerichte tests, root TypeScript en rootbuild PASS. De mappingtabel erft anon SELECT/TRUNCATE uit platform-default privileges; authenticated-only RLS-policy en weigering op mutatie-RPC's blijven actief. Dit least-privilege-punt blijft open en vraagt aparte geautoriseerde hardening vóór verdere schema-uitrol of TEST-release; afwijkende remote migratieversies zijn read-only gereconcilieerd. Zie [W04-acceptatie](../quality/acceptance/runs/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026.md).

> **Insights-roadmap update 29-10-2026 — actuele integratiestatus.** INS-00 inventaris gereed; **INS-01 Headcount/FTE [#57](https://github.com/EdwinCycling/LiquidHR/pull/57), INS-02 Instroom/Uitstroom [#60](https://github.com/EdwinCycling/LiquidHR/pull/60) en INS-03A verzuimautorisatie/databetrouwbaarheid [#65](https://github.com/EdwinCycling/LiquidHR/pull/65) zijn MERGED** in development `main` (INS-03A mergecommit `fa3edc5bbe746479b7227c2b9bdcdbf90bb10ade`). **NEXT INS-03B** frequentie-/Bradford-semantiek en tijdvensters ([#66](https://github.com/EdwinCycling/LiquidHR/issues/66), [contract](../requirements/reports/INS-03B_ABSENCE_FREQUENCY_BRADFORD.md)); daarna **INS-03C WVP Insights** pas na gevalideerde wettelijke milestones, PMUX/WVP-bronnen en privacy/RLS; WVP blijft disabled. Parallel lifecycle-owner/cadence [#67](https://github.com/EdwinCycling/LiquidHR/issues/67) vóór functionele releaseclaim. Daarna Talent/ontwikkeling → Payroll-actuals → recruitment/proces/compliance → executive. **Code-integratie ≠ Vercel TEST-deployment of brede rol/RLS/browseracceptatie.** Geen deployment of DB-writes.


> **29-10-2026, na INS-02 merge.** **Insights-roadmap:** INS-00 inventaris gereed; **INS-01 Headcount & FTE MERGED** ([#57](https://github.com/EdwinCycling/LiquidHR/pull/57)); **INS-02 Instroom & Uitstroom MERGED** ([#60](https://github.com/EdwinCycling/LiquidHR/pull/60)), Development `main` `cc6d4b56f3ed4705012aac88a57cbccccef0b608`. INS-02 heeft geen bewezen verlooppercentage en houdt soft-deleted termination-events in aparte reconciliatie. **NEXT INS-03 verzuim/WVP-rapportages**, afhankelijk van read-only bron-, privacy- en rolcontract; daarna Talent/ontwikkeling, Payroll-kosten op canonieke payrollactuals, recruitment/proces/compliance en executive Insights. Nummering is een roadmapvolgorde, geen claim dat bestaande verzuim- of talentrapporten ontbreken. Geïntegreerd in GitHub ≠ gedeployed of breed geaccepteerd. Gezamenlijke Vercel TEST-acceptatie blijft OPEN; gerichte lokale INS-02-checks 37/37 PASS. Zie [AA-NEXT](AA-NEXT.md) en [AA-OPEN](AA-OPEN.md).


> **Roadmapupdate 29-10-2026 — Insights als gefaseerde productlijn.** INS-00 inventaris ([#55](https://github.com/EdwinCycling/LiquidHR/issues/55)) is afgerond; INS-01 Headcount & FTE is technisch en lokaal rolgericht geaccepteerd maar staat nog in [Draft PR #57](https://github.com/EdwinCycling/LiquidHR/pull/57), **niet in main of een nieuwe deployment**. Volgorde: **(1)** INS-01 review/integratie en apart releasebewijs, **(2)** INS-02 instroom/uitstroom/turnover met canonieke historische noemer, **(3)** verzuim/WVP-rapportages waar bron en privacycontract bewezen zijn, **(4)** Talent-rapportages, **(5)** Payroll-kosten uitsluitend op echte canonieke payrollactuals, **(6)** recruitment/proces/compliance en daarna executive overzicht op herbruikbare KPI's. Geen functionaliteit als 'geleverd' markeren vóór merge en benodigde acceptatie. Behoud de bestaande Insights-catalogus, typed URL-filters, serverautorisatie, KPI/grafiek/tabel/CSV-pariteit en NL/EN. De oudere WVP01→INS02-vermelding is een historische productprioriteit; INS-01 is nu de concrete eerstvolgende integratiekandidaat. Zie [AA-NEXT](AA-NEXT.md) en [AA-REQ](AA-REQ.md).


> **PAY-W04-UNBLOCK-07 — 28-10-2026:** alternatieve transactionele Core TEST-schrijfroute één keer geprobeerd na read-only preflight; aanvraag geweigerd met `Invalid or expired requestState`. Postcheck bevestigt dat er geen schema-, migration-history- of businessdatawijziging was (22 entries/34 revisies/0 releases). De rapportage bevat de gecontroleerde SQL Editor-procedure voor een bevoegde beheerder; geen nieuwe migratiepoging. HR Admin/RLS-runtime blijft onbewezen, Mars `AW_WORK` blijft `SOURCE_GAP` en vierweken-brutonet blijft fail-closed. PR #51 wordt bijgewerkt met documentatie, integratie **HOLD**, TEST-release **HOLD**; zie [W04-acceptatierapport](../quality/acceptance/runs/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026.md).

> **PAY-W04-FUNCTIONAL-CLOSEOUT-02 — 26-10-2026:** W04 hergebruikt de bestaande Actual Work-bron en Payroll-kalender. De lokale implementatie voegt expliciete TVT-ledgerboeking met configureerbaar verval, atomaire HR Admin-goedkeuring en versiegebonden vrijgave aan `MONTHLY`/`FOUR_WEEKLY` periode-ID’s toe. De W04 Payroll-sourceprovider en componentcontracten blijven bewust fail-closed voor vierwekenconsumptie, betaalde over-/meeruren en toeslagcomponenten; deze verbindingen vragen latere Payroll-sourcecontracten en lokale DB-/persona-acceptatie. Integratie **HOLD**; TEST-release **HOLD**. Zie [W04-acceptatierapport](../quality/acceptance/runs/PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026.md).


> **Historische runtime-status — 24 oktober 2026 (vervangen door W04-closeout hierboven) (vervangt gedateerde 'actueel'-koppen hieronder).** Edwin heeft één gedeelde synthetische LiquidHR TEST-app; Vercel gebruikt hiervoor technisch het target `production`, maar dit is geen commerciële payroll-GA. GitHub en gerapporteerde lokale `main` staan op `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf` (PR #45 productintegratie, PR #46 documentatie). Appversie `1.20261023.1` is op **24-10-2026 daadwerkelijk uitgerold**: Vercel deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` **READY**, exact dezelfde GitHub-SHA en alle drie bestaande aliassen gekoppeld; anonieme homepage-smoke HTTP 200. Vorige `dpl_CuyAgvBwHr5z9bXNv52Np7SaTxb9` blijft READY als rollback. Vercel automatische Git-deploytriggers staan uit; releases gebeuren op expliciet mandaat.
>
> **Database:** Supabase LiquidHR Core bevat **578 geregistreerde migraties**: PMUX-03A en alle acht daaropvolgende PMUX 03B/05/05C/06A/06B/06B.1/06C/07A eenmaal toegepast en read-only gecontroleerd. De vijf bestaande HR-groepen gebruiken `Europe/Amsterdam`. Payroll Lab blijft een afzonderlijke database met 17 migraties, zonder extra Payroll D2 SQL. Edwin heeft deze synthetische TEST-migraties uitdrukkelijk toegestaan **zonder voorafgaande backup**; dit is bewust aanvaard herstelrisico, niet een algemeen veiligheidsbeleid. De eerdere database-/release-HOLD is hiermee afgesloten voor deze versie.
>
> **Technische gate:** finale HR Suite 3.652 PASS, 8 SKIP; TypeScript en beide productiebuilds PASS. Payroll D2 Retail R1 en PMUX 02–07A zijn geïntegreerd, ook onderdelen waarvan de volledige geauthenticeerde desktop-/390px-browseracceptatie nog OPEN is. R2 bruto-netto, echte fiscale/pensioenbronbevestiging en commerciële payroll-GA blijven OPEN/HOLD voor reële salarisverwerking. SLA's met `businessDays: true` blijven fail-closed; de bestaande Leave-recipe met twee werkdagen blijft ongewijzigd totdat **PMUX-06A.1 canonieke werkkalender** wordt gebouwd en aanvaard. Dagelijkse cron: recruitment `0 3 * * *`, PMUX-reminders `0 6 * * *` UTC; `CRON_SECRET` aanwezig als geheime Vercel Production-variabele. Maximaal vijf reminderjobs per run, vertraging/achterstand mogelijk; een echte cronafleverproef is nog OPEN.
>
> **Postrelease:** CLEANUP-11 is door Edwin gestart en **loopt nog**; claim geen verwijdering van branches/PR's/worktrees zonder eindbewijs. Bescherm unieke ref/stashes, de dirty AI/MCP Focus-wijziging, historische acceptance evidence en de rollback-deployment. De aparte Payroll/Nmbrs-herstelwerkboom mist de historische 519-byte `.env.local` en blijft daarvoor een eigen herstelpunt. In *nieuwe* besluiten, opdrachten en statuskoppen: noem de opdrachtgever **Edwin** in plaats van ‘de eigenaar’. Historische originele rapportteksten blijven onveranderd.
>
> **Bronnen:** [PR #45](https://github.com/EdwinCycling/LiquidHR/pull/45), [PR #46](https://github.com/EdwinCycling/LiquidHR/pull/46), [03B-evidence](../quality/acceptance/runs/LIQUIDHR-RELEASE-03B-20261023.md); Vercel deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` en de afzonderlijke Supabase-migratiereadback (24-10-2026).


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

### Process Automation — geconsolideerde PMUX-roadmap

De enige actieve toekomstige productwaves zijn **PMUX-05 Slimme formulieren en gegevens**, **PMUX-06 Deadlines, uitval en procesregie** en **PMUX-07 ESS, Focus en productfinish**. De [besluitnotitie van 22-10-2026](../requirements/workflows/PMUX_CONSOLIDATED_ROADMAP_20261022.md) is leidend.

- **PMUX-05 — ACTIEF / PARTIAL:** PMUX-05A/B/C blijven op het bestaande typed contract, compiler/evaluator, bindingcatalogi en server-RPC. PMUX-05B draftsave/conditionele validatie/actieve-antwoordfiltering en PMUX-05C step-participant-field-access zijn lokaal PGlite-getest; migraties `20261022203000` en `20261023054930` staan alleen lokaal klaar. Live TEST-migratie/readback, authenticated role-/tenantbewijs, browser/390px en PMUX-04 security-/releaseacceptatie blijven OPEN. Zie [PMUX-05C evidence](../quality/acceptance/runs/PMUX-05C-20261023-LOCAL.md) en [AA-OPEN](AA-OPEN.md).
- **PMUX-06A — LOKALE IMPLEMENTATIE GEREED / REMOTE ACCEPTATIE OPEN:** SLA-configuratie, server-side deadline-materialisatie en gedeelde urgentieprojectie in Mijn werk, Focus, dashboard en procesdetail. Werkdagen blijven geblokkeerd zonder gekwalificeerde kalender. Zie [PMUX-06A requirement](../requirements/workflows/PMUX-06A_SLA_DEADLINES.md) en [acceptatie](../quality/acceptance/runs/PMUX-06A-20261023-LOCAL.md).
- **PMUX-06B.1 — LOCAL SCHEDULER READY / REMOTE ACTIVATION OPEN:** route en minuutplanning gebruiken de bestaande workflow-jobs/reminders; beperkte service-workerautorisatie, idempotency en lokale delivery zijn met route-, worker- en PGlite-contracttests bewezen. Remote schema/readback, Vercel-plan/secretbevestiging, echte cronrun en browseracceptatie blijven OPEN. Zie [requirement](../requirements/workflows/PMUX-06B_REMINDERS_ESCALATIONS.md) en [PMUX-06B.1 acceptatie](../quality/acceptance/runs/PMUX-06B.1-20261023-LOCAL.md). Overige uitval-, herverdelings- en prognosemogelijkheden zijn niet gestart.
- **PMUX-07 — GEPLAND:** ESS/MSS/Focus, mobile-first formulieren, routes/status, dashboard, handmatige UX-review, E2E en releasevoorbereiding.
- **PMUX-04 — AFZONDERLIJKE GATE:** PMUX-04 blijft security-/releaseacceptatie, geen wave. Live JWT-scope, actor-/roltests en visueel browserbewijs staan nog OPEN in [AA-OPEN](AA-OPEN.md); zie [PMUX-04R5](../quality/acceptance/runs/PMUX-04R5-20261022-BROWSER-RESULTS.md) en [PMUX-04R6](../quality/acceptance/runs/PMUX-04R6-20261022-LOCAL.md).

PMUX-01 tot en met PMUX-03 en de individuele PMUX-05A/B/C-labels zijn historische capability-/evidenceverwijzingen, geen aparte toekomstige roadmapwaves. Zie [PMUX-03C evidence](../quality/acceptance/runs/PMUX-03C-20261021-LOCAL.md), [PMUX-05A](../quality/acceptance/runs/PMUX-05A-20261022-LOCAL.md) en [PMUX-05B](../quality/acceptance/runs/PMUX-05B-20261022-LOCAL.md).

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
