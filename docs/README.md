# Liquid HR documentatie-index

## Actuele update 2026-08-03: P3 functioneel gesloten in testfase

P3.0, P3.1, P3.2 en P3.4 zijn lokaal en remote doorgetrokken volgens `schema -> RLS/permissions -> service/API -> UI -> tests`. Talent heeft nu minimale tenantgescopeerde opvolgmeldingen, doelgesprekken/check-ins met gescheiden medewerkerreflectie en managerobservatie, en historische periodefilters voor rapportage en CSV-export. De meldingen zijn geen autorisatiebron en bevatten geen evidence-inhoud. HR Admin ziet tenantbreed; de manager ziet de eigen directe scope; de medewerker ziet alleen eigen meldingen en reflecties.

De drie fixture-accounts zijn op 3 augustus opnieuw gecontroleerd in de Codex-browser op poort 3000. De testset bevat historische, actuele en toekomstige capabilityregistraties en ontwikkeldoelen, drie oorspronkelijke check-ins plus een via de medewerkerflow aangemaakte reflectie, en vijf deduplicerende notificaties. De medewerker ziet `/my-talent` en eigen doelen/rapportage en wordt naar `/geen-toegang` gestuurd voor Workforce- en HR-routes. Manager en HR Admin zien hun toegestane doelen, check-ins, meldingen en rapportage. Detailstappen staan in [`delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md`](delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md).

P3.3 (evidence/documentkoppeling) en P3.5 (delegatie) blijven `GEPARKEERD`; P3.6 blijft bewust uitgesteld omdat LMS/opleidingscatalogus nog niet wordt gebouwd. P4, P5 en P6 zijn niet uitgevoerd. De nieuwe periodeknop `Filters toepassen`, de HR-filter/CSV-browsercontrole en de medewerkerlanding `/dashboard/start` zijn toegevoegd; directe medewerkertoegang tot `/departments` eindigt op `/geen-toegang`. De remote Talent-timeout is aangepakt met gerichte capabilityqueries, korte RLS-short-circuiting en het overslaan van onnodige opties in rapportage. Provider snapshot/restore is op verzoek uitgesloten en staat niet meer als actief open punt. De eerste `TALENT-NEXT-01`-slice voor functieprofiel-radar en ontwikkelverkenning is gebouwd en met alle drie rollen in de Codex-browser op poort 3000 gecontroleerd. Er is geen commit, push of deployment uitgevoerd.

## Actuele update 2026-08-02: M2 functioneel afgerond in testfase

Het fase-2-plan is uitgevoerd tot en met M2.8. M2.7 biedt tenantgescopeerde ontwikkeldoelen en POP-status zonder automatische score of advies. M2.8 biedt read-only rapportage en CSV-export met vaste rolallowlists; iedere export wordt geaudit met scope, filters en recordaantal. M2.6 is nu ook end-to-end bewezen: HR Admin doorloopt `PREVIEW -> COMMITTED -> ROLLED_BACK`, waarna het aangemaakte record `ARCHIVED` is.

De drie-fixture-gate is opnieuw uitgevoerd in de Codex-browser op poort 3000. HR Admin kan de importflow uitvoeren; manager en medewerker openen hun toegestane Talent-doelenpagina maar worden server-side geweigerd op `/settings/talent/import`. De preview blokkeert database-incompatibele evidence/certificate-metadata vóór commit. De medewerkerlanding is hersteld: `/login` gaat naar `/dashboard/start` en directe `/departments` gaat netjes naar `/geen-toegang`. De representatieve performance-baseline en volledige axe/keyboard-herhaling zijn geslaagd; alleen provider snapshot/restore blijft formeel open. Detailbewijs staat in [`delivery/TALENT_M2_RELEASE_HARDENING_20260802.md`](delivery/TALENT_M2_RELEASE_HARDENING_20260802.md).

Het vervolgdraaiboek staat in [`requirements/Talent/analysis/talent-phase3-implementation-plan-20260802.md`](requirements/Talent/analysis/talent-phase3-implementation-plan-20260802.md). Aanbevolen volgorde: P3.0 release-hardening, daarna P3.1 notificaties/opvolging en P3.2 doelgesprekken/check-ins.

## Actuele update 2026-08-02: M2.5/M2.6 drie-fixture-gate

De lokale fixturecredentials uit `.env.talent-auth.local` zijn gebruikt in de Codex-browser op poort 3000. HR Admin opent de vergelijking en maakt geldige en ongeldige importpreviews; manager opent de directe-scopevergelijking met 22 medewerkers en twee functieprofielen en wordt uit HR-instellingen geweerd; medewerker ziet het eigen `/my-talent`-profiel en wordt uit vergelijking en import geweerd. De `/departments`-landingsroute geeft voor employee nog een bestaande onvoldoende-rechten-serverfout.

De import-commit blijft door bestaande tenant-specifieke RLS geblokkeerd omdat de `TENANT_ADMIN`-override `talent-record:write` mist. Er is geen autorisatie-uitbreiding toegepast. Importaudittriggers zijn gehard en zes Talent foreign-key-indexen zijn remote toegevoegd. Security-advisors tonen geen nieuwe M2.5/M2.6-lint; resterende Talent-advisorregels zijn alleen INFO voor ongebruikte indexen in de kleine demo-dataset.

Verificatie: 116 hr-suite-testbestanden/434 tests, control 2/7 tests, lint, i18n en `git diff --check` slagen. Typecheck en productiebuild stoppen op drie bestaande fouten buiten deze slice in `employee-service.ts:316` en `employment-detail-service.ts:362/369`.

## Laatste Talentcontrole 2026-08-02: M2.5 vergelijking en M2.6 import

M2.5 en M2.6 zijn in de testfase toegevoegd volgens schema → RLS/grants → service/API → UI. M2.5 biedt HR Admin en managers een server-side gescopeerde vergelijking van actieve functieprofielversies met individuele uitkomsten `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`, zonder totaalscore. M2.6 biedt HR Admin een immutable CSV-preview, expliciete idempotente commit en batchspecifieke rollback; geïmporteerde capabilityrecords starten als `DRAFT` en bewijsinhoud wordt niet geïmporteerd.

De remote databasecontractproef voor de nieuwe tabellen, RLS, grants, command-RPC's, permissions en indexen slaagt. Gerichte parser/querytests en strict typecheck slagen. De interne Codex-browser op poort 3000 blijft open; de actuele drie-fixture-herhaling is nog niet opnieuw uitgevoerd omdat de bestaande lokale fixturecredentials niet beschikbaar zijn. De eerder geslaagde drie-rollen-gate blijft referentiebewijs; de nieuwe M2.5/M2.6 interactieve rol- en rollbacktest blijft open.

## Laatste Talentcontrole 2026-08-02: M2.3 en M2.4

M2.3 self-/manager-assessments en M2.4 Team Talent/Skills Matrix zijn toegevoegd volgens schema → RLS/grants → API/service → UI. HR beheert cycli en finale status, medewerkers vullen hun eigen assessment in, managers beoordelen uitsluitend hun actuele directe scope en privé-notities blijven afgeschermd. Team Talent toont individuele capabilitydata zonder onverklaarde scores of aggregaten. De remote contractproef bevestigt RLS, policies en authenticated-only grants voor de vijf assessmenttabellen.

114 testbestanden/428 tests, typecheck, lint, i18n, productiebuild (136 pagina's) en `git diff --check` zijn groen. De lokale browser op poort 3000 is actief; de huidige sessie heeft geen gekoppelde klantomgeving, waardoor de nieuwe authenticated roleflows nog niet opnieuw interactief zijn uitgevoerd. M2.5 en latere fase-2-onderdelen blijven open; performance op representatieve data en rollback/snapshot blijven release-open.

## Laatste Talentcontrole 2026-08-02: M2.2

M2.2 HR-beheerde kwalificaties zijn volgens schema → RLS/grants → API/service → UI toegevoegd. HR beheert certificaatmetadata, evidence-status, geldigheid en archivering via `/settings/talent`; manager- en medewerkersgrenzen blijven die van M2.1. De remote M2.2-contractproef, typecheck, lint, i18n, 112 testbestanden/421 tests, productiebuild en `git diff --check` zijn geslaagd. De interne browser op poort 3000 bevestigde de anonieme loginredirect voor de drie Talent-routes; de geauthenticeerde drie-rollen-gate uit M2.1 blijft het referentiebewijs. Geen commit, push of deployment.

## Laatste Talentcontrole 2026-08-02: M2.1

M2.1 persoonlijke capabilityregistraties zijn volgens schema → RLS/grants → API/service → UI uitgevoerd. HR beheert tenantbreed via `/settings/talent`, managers lezen alleen binnen bestaande medewerkersscope via `/workforce/talent` en medewerkers beheren alleen eigen `SELF_ENTERED` concepten via `/my-talent`. Records zijn typegebonden, datumgeldig, archiveerbaar, geaudit en evidence-minimaal: alleen een referentie wordt opgeslagen en geen evidence-inhoud/signed URL teruggegeven. De remote contractproef, nieuwe permissions, RLS en authenticated-only Data API-grants zijn gecontroleerd.

Checks: typecheck, lint, i18n (25 namespaces), 112 testbestanden/419 tests, productiebuild en `git diff --check` zijn geslaagd. In de interne Codex-browser op `http://localhost:3000` is met de medewerkerfixture een BHV-concept opgeslagen en zichtbaar als `Concept`/`Zelf ingevoerd`; de bestaande drie-rollen-gate blijft referentie voor route-, mutatie-, cross-tenant-, manager-scope- en self-bound-denies. Fase-2-assessments, Team Talent, import, doelen en exports blijven buiten deze slice. Geen commit, push of deployment.

## Laatste Talentcontrole 2026-08-02

De geauthenticeerde drie-rollen-gate is uitgevoerd op poort 3000: 3 rollen, 4 toegestane routes, route-/mutatie-/cross-tenant-denies, manager-scope en medewerker-self-bound slagen; er zijn 0 echte axe-violations. De drie technische `color-contrast`-checks zijn handmatig beoordeeld zonder vastgestelde Talent-contrastfout; twee targets horen bij de gedeelde product-updatebanner. Strict typecheck, i18n (25 namespaces), lint, 112 testbestanden/418 tests, productiebuild en `git diff --check` zijn opnieuw geslaagd. Voor formele productie-release ontbreken alleen nog representatieve performance en een restore/rollback-oefening. Het fase-2-plan staat in [`requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md`](requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md).

## M2.0 gestart 2026-08-02

De eerste fase-2-stap is uitsluitend contract- en gegevensbeschermingsontwerp. De rolmatrix, dataclassificatie, voorgestelde permissions, status-/provenance-/evidence-contracten, logisch schemaontwerp, traceabilitymatrix en de baselineproef staan in [`requirements/Talent/analysis/talent-phase2-m2.0-contracts-and-data-protection-20260802.md`](requirements/Talent/analysis/talent-phase2-m2.0-contracts-and-data-protection-20260802.md), [`requirements/Talent/analysis/talent-phase2-m2.0-traceability-matrix-20260802.md`](requirements/Talent/analysis/talent-phase2-m2.0-traceability-matrix-20260802.md), ADR-0007 en FDR-0003. De beperkte M2.0-securitycorrectie op `public.audit_logs` is uitgevoerd: `anon`/`public` hebben geen tabelgrants meer en `authenticated` uitsluitend `SELECT`; de remote SQL-contractproef slaagt. M2.0 is nog niet gesloten: de zeven beslispunten, het auditcorrelation-contract en de exacte fase-2-permission-seed blijven reviewpunten. Er zijn geen fase-2-tabellen, API-routes, UI-flow, seed of generated types toegevoegd.

De drie rollen zijn daarna in de interne Codex-browser op `http://localhost:3000` gecontroleerd. HR Admin kan `/settings/talent` en `/workforce/talent` openen; manager alleen `/workforce/talent`; medewerker alleen `/my-talent`. Verboden routes tonen `Nog geen toegang`. De employee-login landt eerst op `/departments`, waar een bestaande algemene rechtenfout zichtbaar is; de directe `/my-talent`-route werkt wel. Dit is als open routing/UX-punt vastgelegd en valt buiten M2.0.

## Actuele Talentstatus 2026-08-02

Talentstappen 1-8 zijn lokaal en remote doorgetrokken voor de testfase. Stap 7 biedt actieve Workforce-profielen met directe managerscope; stap 8 biedt een self-bound read-only Mijn Talent-profiel met capabilityvereisten en veilige lege toestand. Voor stap 9 is de functiehuis-audit uitgebreid met triggers voor `jobs`, `job_groups`, `job_revisions` en `job_group_jobs`; de release-contractproef en remote RLS-/RPC-controles slagen. De demo-administratie `Liquid HR Demo Holding` bevat de Job Architecture- en Talent-set plus manager-, medewerker- en HR-admin-authfixtures. Talentfundament blijft HR-admin-only onder `Instellingen -> HR-inrichting` met een exclusieve harmonica. De volledige geauthenticeerde drie-rollen-gate op poort 3000 is uitgevoerd: 3 rollen, 4 toegestane routes, negatieve route-/mutatie-/tenanttests geslaagd, self-bound medewerkercontrole geslaagd en 0 axe-violations. Drie kleurcontrastcontroles blijven als handmatige `incomplete` beoordeling genoteerd. Voor formele release sluiten nog grote-dataset-baseline, rollback/snapshot-oefening en die contrastbeoordeling. De reproduceerbare gate staat in `scripts/talent-release-gate.mjs`. Profielcycli, formulieren, talent pools en opleidingscatalogus volgen later.

Developer workflow: [`DEVELOPER_TOOLKIT.md`](DEVELOPER_TOOLKIT.md) beschrijft de lokale Codex/Git- en EdwinHelp-commando's; [`skills/project-overview/SKILL.md`](skills/project-overview/SKILL.md) beschrijft de herbruikbare projectinventaris; [`../CODING_STANDARDS.md`](../CODING_STANDARDS.md) is de compacte dagelijkse codechecklist.

Actuele scope-aanvulling productupdates (2026-08-01): eigenaarberichten zijn globaal voor alle klanten; tenant HR Admins kunnen alleen eigen tenantberichten beheren en zien globale eigenaarberichten alleen-lezen.

Actuele weergave-aanvulling productupdates (2026-08-01): banner- en login-popupberichten worden per gebruiker en per kanaal eenmalig getoond; de popup heeft een knop `Gezien`.

Actuele productupdatestatus (2026-08-01): [`requirements/product-updates/PRODUCT_UPDATES.md`](requirements/product-updates/PRODUCT_UPDATES.md) is GEÏMPLEMENTEERD. De tenant-eigen updatecatalogus, doelgroep-/kanaalkeuze, gebruikersstatus, rode cadeauvensterteller, login-popup, bovenbanner en HR Admin-beheer zijn aanwezig; een authenticated browsercontrole blijft open zolang deze sessie geen login-cookie heeft.

Actuele verlofstatus (2026-07-28, versie `1.20260728.4`): werkurentypen hebben nu algemene instellingen, gedeelde beperkingstypen en administratiegebonden uitzonderingen voor één of meerdere medewerkers. De geavanceerde tab blijft voorbereid voor later.

Actuele verlofstatus (2026-07-28): aparte bonusregels voor `AGE` en `SENIORITY` met traptreden, FTE/pro-rata-engine, catalogus/API en HR-admintegels zijn aanwezig. De periodieke bonusmutatie-runner, volledige opbouwprojectie en ingelogde browsercontrole blijven open.

Verificatie afgerond voor deze slice: ESLint, 384 tests, productiebuild en anonieme browsercontrole zijn geslaagd; de browsercontrole vond 0 console-errors en alleen een bestaande preload-warning.

De leidende documentenblueprint voor deze slice staat in [`requirements/documents/Documenten_en_Dossier_Systeem_Master.md`](requirements/documents/Documenten_en_Dossier_Systeem_Master.md). De oudere AI/compliance-notitie blijft aanvullend voor een latere OCR/RAG-slice.

Actuele verlofstatus (2026-07-22): de verlof-engine bevat nu schema/RLS, configuratie- en balans-API, catalogus/opvolger/voorrangsregel-UI, idempotente HR-admin-aanvragen vanuit de kalender en centrale ledgermutaties voor startsaldo, handmatige correcties, jaarafsluiting, overheveling en verval. Feestdagen worden in booking en preview overgeslagen. De flow is remote en op poort 3000 met Lina Bakker gecontroleerd. Resterend zijn toekomstige opbouwprojectie voor maandelijkse regels, volledige saldo-audit/ledgerformulieren en later ESS, managerworkflow en notificaties.

Deze index is de verplichte startpagina voor architectuur- en featurewerk. Hij bepaalt welke documenten leidend zijn en welke volledige bronnen per wijziging gelezen moeten worden.

## Statusdefinities

### Documentstatus

- **LEIDEND** — actuele bron van waarheid binnen het genoemde domein.
- **CONCEPT** — richtinggevend, maar nog niet goedgekeurd voor volledige implementatie.
- **VERVANGEN** — historische bron; niet gebruiken voor nieuwe implementatie.

### Implementatiestatus

- **NIET GESTART** — nog geen productieschema of werkende verticale slice.
- **GEDEELTELIJK** — een deel bestaat, maar het document is nog niet volledig gerealiseerd.
- **GEÏMPLEMENTEERD** — schema, RLS, API, UI en relevante tests zijn aanwezig.

## Architectuurdocumenten

| Document | Status | Wanneer volledig lezen |
|---|---|---|
| [`architecture/BLUEPRINT.md`](architecture/BLUEPRINT.md) | LEIDEND | Altijd bij schema, API, auth, projectstructuur of gedeelde patronen |
| [`architecture/ENVIRONMENT_AND_AI_RULES.md`](architecture/ENVIRONMENT_AND_AI_RULES.md) | LEIDEND | Omgeving, secrets, Supabase, deployment, packages en agentregels |
| [`architecture/LOGIC_AND_WORKFLOW.md`](architecture/LOGIC_AND_WORKFLOW.md) | LEIDEND | Businesslogica, state, validatie, foutafhandeling en workflows |
| [`architecture/UI_FLOW_BLUEPRINT.md`](architecture/UI_FLOW_BLUEPRINT.md) | LEIDEND | Pagina's, layouts, formulieren, navigatie en RBAC-zichtbaarheid |
| [`architecture/LIQUID_DISPLAY_DOCUMENTATIE.md`](architecture/LIQUID_DISPLAY_DOCUMENTATIE.md) | LEIDEND | Alleen volledig bij Liquid Display, AI-querying, widgets of contextmanagement |
| [`architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md`](architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md) | INVENTARISATIE | Bij externe koppelingen, API-ontsluiting, webhooks of AI-providerbeleid |

## Requirements

Adresinvoer: [`requirements/core-hr/ADRESINVOER.md`](requirements/core-hr/ADRESINVOER.md) — LEIDEND: hoofdadres en tweede tijdelijk adres zijn tenant-/employee-scoped gemodelleerd met servervalidatie, RLS, audit, i18n en harmonica-UI; verhuisactie, adres-harmonica en verzuimlinks zijn lokaal browsergecontroleerd.

| Domein | Document | Documentstatus | Implementatie |
|---|---|---|---|
| Bedrijf en locatie per dienstverband | [`requirements/employment/BEDRIJF_EN_LOCATIE_PER_DIENSTVERBAND.md`](requirements/employment/BEDRIJF_EN_LOCATIE_PER_DIENSTVERBAND.md) | LEIDEND | GEDEELTELIJK — lokale schema/RLS/RPC, API, eigen dienstverbandtab, read-only bedrijfskaart en locatie-opvolging zijn toegevoegd; remote migratie en authenticated browserbewijs volgen |
| Verlof: opbouw-, saldo- en configuratie-engine | [`requirements/leave/VERLOF_OPBOUW_ENGINE.md`](requirements/leave/VERLOF_OPBOUW_ENGINE.md) | LEIDEND | GEDEELTELIJK — schema/RLS, pure engine/report, catalogus/API, opvolgende opbouwregels, kleurgebruik, overwerkbeperkingen en de eerste verloftype-/uitzonderingen-UI zijn aanwezig; age/seniority-regels, volledige opbouwprojectie en ingelogde browsercontrole volgen |
| Verlof: HR-admin aanvragen vanuit kalender | [`requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md`](requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md) | LEIDEND | GEDEELTELIJK — geautoriseerde HR-admin/managerflow, priority/FIFO, directe goedkeuring, saldo-overzicht en kalenderweergave zijn geïmplementeerd; ESS, notificaties en manager-UI volgen later |
| Verzuim en herstel | [`requirements/absence/VERZUIM_EN_HERSTEL.md`](requirements/absence/VERZUIM_EN_HERSTEL.md) | LEIDEND | GEDEELTELIJK — schema/RLS/RPC, API, dashboardvenster, startpagina, kalenderactie, medewerker-tab, herstel, instellingen en verzuimrapportage zijn live; voorziening en verdere WvP blijven open |
| WvP Poortwachter | [`requirements/absence/WVP_POORTWACHTER_ENGINE.md`](requirements/absence/WVP_POORTWACHTER_ENGINE.md) | LEIDEND | GEDEELTELIJK — HR Admin kan eigen niet-wettelijke taaktemplates beheren; wettelijke milestone-engine, casustaken, dossier en signaleringen blijven open totdat de set inhoudelijk is bevestigd |
| Verzuiminstellingen | [`requirements/absence/VERZUIM_INSTELLINGEN.md`](requirements/absence/VERZUIM_INSTELLINGEN.md) | LEIDEND | GEDEELTELIJK — drempel, geldige standaardcasemanager en eigen taaktemplates zijn administratiegebonden beschikbaar; contacttypen en documentcategorieën blijven open |
| Rapportages en Inzichten | [`requirements/reports/RAPPORTAGES_EN_INZICHTEN.md`](requirements/reports/RAPPORTAGES_EN_INZICHTEN.md) | LEIDEND | GEDEELTELIJK — medewerkerprojecties, Aankomende gebeurtenissen, Verzuim en Bradford factor zijn live; verlof, voorziening en WvP volgen per rapport |
| Core HR | [`requirements/core-hr/MEDEWERKER.md`](requirements/core-hr/MEDEWERKER.md) | LEIDEND | GEÏMPLEMENTEERD |
| Medewerkerdashboard | [`requirements/core-hr/MEDEWERKER_DASHBOARD.md`](requirements/core-hr/MEDEWERKER_DASHBOARD.md) | LEIDEND | GEDEELTELIJK — dashboard-UI, lazy salaris, reminders, activity-notities en persoonlijke widgetvolgorde aanwezig; remote schema/advisors en per-rol browsercontrole volgen |
| Contract & dienstverband | [`requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`](requirements/employment/CONTRACT_EN_DIENSTVERBAND.md) | LEIDEND | GEÏMPLEMENTEERD — contractreeks, vernieuwde wizard, contract-/rooster-/salaris-/organisatie-/kostentijdlijnen en HR-inrichting gereed |
| Organisatie | [`requirements/organization/AFDELINGEN_EN_ROLLEN.md`](requirements/organization/AFDELINGEN_EN_ROLLEN.md) | LEIDEND | GEÏMPLEMENTEERD |
| Organogram | [`requirements/organization/ORGANOGRAM.md`](requirements/organization/ORGANOGRAM.md) | LEIDEND | GEÏMPLEMENTEERD |

| Workforce Talent | [`requirements/Talent/01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md`](requirements/Talent/01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md) | LEIDEND | GEDEELTELIJK — stappen 1-8 zijn uitgevoerd; stap 9 is inhoudelijk ingezet maar de geauthenticeerde drie-rollen-gate, volledige axe-audit, grote-dataset-baseline en rollbackbewijs staan open; cycli, formulieren, talent pools en opleidingscatalogus volgen later |

### Actuele Talentstatus 2026-08-02

Talentfundament is bereikbaar voor HR Admin via `Instellingen -> HR-inrichting` en gebruikt daar een exclusieve harmonica. De remote testmigraties, demo-seed, authfixtures, functiehuis-audittriggers en de version/requirement-contracten zijn toegepast. De HR-admin axe-audit is groen met 0 violations; de volledige drie-rollen-gate is nog niet gesloten zolang manager-/medewerkercredentials, de open contrastchecks, grote-datasetmeting en rollbackbewijs ontbreken. Het functie-inventaris- en gate-rapport staat in [`requirements/Talent/analysis/talent-phase1-function-inventory-and-m9-gate-20260802.md`](requirements/Talent/analysis/talent-phase1-function-inventory-and-m9-gate-20260802.md). Cycli, formulieren, talent pools en opleidingscatalogus volgen later.

## Branch- en deploymentafspraak

`main` is de enige blijvende bron van waarheid voor testen en live. Werkbranches en worktrees zijn tijdelijk: na tests, i18n, typecheck, build en browsercontrole worden ze naar `main` samengevoegd en verwijderd. Vercel Production bouwt vanaf GitHub `main`; preview-URL's zijn uitsluitend testomgevingen. Supabase-migraties worden gecontroleerd toegepast vóór de main-deploy. Controleer na iedere push de GitHub-commit en de Vercel-deployment-commit.
| Autorisatie | [`requirements/authorization/AUTORISATIE_EN_RECHTEN.md`](requirements/authorization/AUTORISATIE_EN_RECHTEN.md) | LEIDEND | GEÏMPLEMENTEERD |
| Multitenancy & administraties | [`requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md`](requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md) | LEIDEND | GEDEELTELIJK |
| LiquidHR Control Plane | [`requirements/platform/LIQUIDHR_CONTROL_PLANE.md`](requirements/platform/LIQUIDHR_CONTROL_PLANE.md) | LEIDEND | LOKALE BASIS GEIMPLEMENTEERD — aparte app op poort 3001; migratie en eerste operator moeten nog handmatig worden toegepast |
| Entiteiteigendom en koppelingen | [`requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`](requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md) | LEIDEND | INSTRUCTIE VOOR NIEUWE MODULES |
| Vrije velden | [`requirements/custom-fields/VRIJE_VELDEN.md`](requirements/custom-fields/VRIJE_VELDEN.md) | LEIDEND | GEÏMPLEMENTEERD VOOR EMPLOYEE, inclusief beheer-CRUD, actieve status, landcode en preview |
| Documenten & compliance | [`requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md`](requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md) | LEIDEND | GEDEELTELIJK — veilig medewerkersdossier gereed; globale documenten en AI-compliance volgen later |
| Instellingen, modules, roosters en kalender | [`requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`](requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md) | LEIDEND | GEÏMPLEMENTEERD — bedrijf gegevens, intelligente bedrijfs-/locatieadresinvoer, medewerker-pop-up en dashboardwidgetbeheer toegevoegd |
| Liquid Display aanvulling | [`requirements/liquid-display/LIQUID_DISPLAY_ENGINE.md`](requirements/liquid-display/LIQUID_DISPLAY_ENGINE.md) | LEIDEND | GEDEELTELIJK |
| HeRa AI Agent | [`requirements/chatbot/HERA_AI_AGENT.md`](requirements/chatbot/HERA_AI_AGENT.md) | LEIDEND | GEÏMPLEMENTEERD EN PRODUCTIE-GEVERIFIEERD |
| Historische HR-chatbotblauwdruk | [`requirements/chatbot/HR_CHATBOT_AGENT.md`](requirements/chatbot/HR_CHATBOT_AGENT.md) | VERVANGEN | NIET GESTART |
| Chatbot lees/schrijftools | [`requirements/chatbot/HR_CHATBOT_LEES_EN_SCHRIJFTOOLS.md`](requirements/chatbot/HR_CHATBOT_LEES_EN_SCHRIJFTOOLS.md) | CONCEPT | NIET GESTART |
| Chatbot transactietools | [`requirements/chatbot/HR_CHATBOT_TRANSACTIONELE_TOOLS.md`](requirements/chatbot/HR_CHATBOT_TRANSACTIONELE_TOOLS.md) | CONCEPT | NIET GESTART |

Er zijn momenteel geen documenten met status **VERVANGEN**. Zodra een document wordt opgevolgd, blijft het bewaard met een expliciete verwijzing naar zijn vervanger.

## Leesrouting per wijziging

| Wijziging | Verplicht lezen naast deze index |
|---|---|
| Medewerkergegevens | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `MEDEWERKER.md`, `AUTORISATIE_EN_RECHTEN.md` |
| Afdelingen, rollen of organogram | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `AFDELINGEN_EN_ROLLEN.md`, `AUTORISATIE_EN_RECHTEN.md` |
| Auth, RLS of permissions | Alle vijf architectuurdocumenten plus `AUTORISATIE_EN_RECHTEN.md` |
| Tenant, administratie of contextswitch | Alle vijf architectuurdocumenten plus `MULTITENANCY_EN_MULTI_ADMINISTRATIE.md` en `AUTORISATIE_EN_RECHTEN.md` |
| Nieuwe module of nieuwe stamdata | `ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`, alle vijf architectuurdocumenten, `MULTITENANCY_EN_MULTI_ADMINISTRATIE.md` en `AUTORISATIE_EN_RECHTEN.md` |
| Contract, salaris of payroll | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `CONTRACT_EN_DIENSTVERBAND.md`, `AUTORISATIE_EN_RECHTEN.md` |
| UI/layout/formulieren | `BLUEPRINT.md`, `UI_FLOW_BLUEPRINT.md` en het relevante requirementdocument |
| Verzuim, herstel of WvP | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `UI_FLOW_BLUEPRINT.md`, `VERZUIM_EN_HERSTEL.md`, `WVP_POORTWACHTER_ENGINE.md`, `VERZUIM_INSTELLINGEN.md`, `AUTORISATIE_EN_RECHTEN.md`, `CONTRACT_EN_DIENSTVERBAND.md` |
| Rapportages en exports | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `UI_FLOW_BLUEPRINT.md`, `requirements/reports/RAPPORTAGES_EN_INZICHTEN.md` en `AUTORISATIE_EN_RECHTEN.md` |
| Workforce Talent of functiehuis | De vijf Talent-documenten, `requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`, ADR-0006, alle vijf architectuurdocumenten en `AUTORISATIE_EN_RECHTEN.md` |
| Liquid Display of AI-chat | Alle vijf architectuurdocumenten plus de relevante Liquid Display- en chatbotrequirements |

## Uitvoering en besluiten

- Compacte overdracht voor nieuwe/fork-chats: [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md)
- Actuele implementatiedrift: [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md)
- Geaccepteerde tenantgrenzen: [`decisions/ADR-0001-tenant-en-administratiegrenzen.md`](decisions/ADR-0001-tenant-en-administratiegrenzen.md)
- Authenticatie, i18n en persoonlijke thema's: [`decisions/ADR-0002-authenticatie-i18n-en-persoonlijke-themas.md`](decisions/ADR-0002-authenticatie-i18n-en-persoonlijke-themas.md)
- Employee, Employment, IKV en herintreding: [`decisions/ADR-0003-employee-employment-ikv-en-herintreding.md`](decisions/ADR-0003-employee-employment-ikv-en-herintreding.md)
- Performancebudgetten en tabprojecties: [`decisions/ADR-0004-performancebudgetten-en-tabprojecties.md`](decisions/ADR-0004-performancebudgetten-en-tabprojecties.md)
- Documentzichtbaarheid en gecombineerde reminderdoelen: [`decisions/FDR-0001-document-en-reminderdoelgroepen.md`](decisions/FDR-0001-document-en-reminderdoelgroepen.md)
- Uitvoeringsplannen: [`superpowers/plans/`](superpowers/plans/)
- Toekomstige technische en functionele besluiten: `decisions/`
- Verzuimcasus per dienstverband en ziekteperioden: [`decisions/ADR-0005-verzuimcasus-en-ziekteperioden.md`](decisions/ADR-0005-verzuimcasus-en-ziekteperioden.md)
- Entiteiteigendom en koppelingen tussen tenant en administratie: [`decisions/ADR-0006-entiteitseigendom-en-koppelingen.md`](decisions/ADR-0006-entiteitseigendom-en-koppelingen.md)
- Afzonderlijk leveranciersbeheer: [`decisions/ADR-0008-afzonderlijk-liquidhr-control-plane.md`](decisions/ADR-0008-afzonderlijk-liquidhr-control-plane.md)
- Verzuimcasusscope en privacy: [`decisions/FDR-0002-verzuim-casusscope-en-privacy.md`](decisions/FDR-0002-verzuim-casusscope-en-privacy.md)

Actuele verticale slice (2026-07-29): dienstverbanden ondersteunen parallelle en sequentiële relaties met één actief primair dienstverband, een eigen contractreeks en onafhankelijke tijdlijnen. De vernieuwde aanmaakwizard controleert eerst de basisgegevens en publiceert daarna dienstverband, contract, rooster, salaris, organisatie en kosten atomair. Contractinrichting is als administratiegebonden stamdata beschikbaar onder Instellingen. De actuele status staat in `delivery/IMPLEMENTATION_STATUS.md` en `delivery/CURRENT_CONTEXT.md`.

Het autorisatiebeheer en grafische rechtenoverzicht zijn beschreven in [`superpowers/specs/2026-07-18-autorisatieoverzicht-design.md`](superpowers/specs/2026-07-18-autorisatieoverzicht-design.md).

De HR-instellingenhub, tenantmodules, repeterende werkpatronen, feestdagenimport en gecombineerde medewerkerskalender zijn beschreven in [`requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`](requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md) en ontworpen in [`superpowers/specs/2026-07-18-settings-modules-rosters-holidays-calendar-design.md`](superpowers/specs/2026-07-18-settings-modules-rosters-holidays-calendar-design.md).

De medewerkerlijst/persoonskaart-UX-slice van 2026-07-19 is geïmplementeerd: gebruikersgebonden lijstvoorkeuren zonder zoekterm, Enter-zoeken met afzonderlijk wissen, volledige klikrij, hoofdtab Overzicht vóór Persoonsgegevens en een effective-dated samenvatting van het huidige dienstverband met beschermd salaris-hover.

De HR-admin-stamtabellen staan op `/master-data`: Redenen uitdienst, documentcategorieën en tenant-relatietypen zijn afzonderlijke onderdelen. Redenen uitdienst zijn landgebonden; Nederland gebruikt de actuele codes 01-99 en andere landen krijgen bij ontbrekende inrichting de veilige standaardreden `Einde contract`.
