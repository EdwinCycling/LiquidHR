# Liquid HR documentatie-index

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

## Requirements

Adresinvoer: [`requirements/core-hr/ADRESINVOER.md`](requirements/core-hr/ADRESINVOER.md) — LEIDEND, GEDEELTELIJK: schema/migratie, serverroutes, provider-normalisatie en invoer-UI zijn lokaal gebouwd; de remote migratie is toegepast, releasegate/browsercontrole volgen.

| Domein | Document | Documentstatus | Implementatie |
|---|---|---|---|
| Verlof: opbouw-, saldo- en configuratie-engine | [`requirements/leave/VERLOF_OPBOUW_ENGINE.md`](requirements/leave/VERLOF_OPBOUW_ENGINE.md) | LEIDEND | GEDEELTELIJK — schema/RLS, pure engine/report, catalogus/opvolgers/voorrangsregels, ledger-RPC's/API en settings-UI zijn aanwezig; toekomstige opbouwprojectie, volledige auditformulieren en enkele rapportdetails volgen |
| Verlof: HR-admin aanvragen vanuit kalender | [`requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md`](requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md) | LEIDEND | GEDEELTELIJK — geautoriseerde HR-admin/managerflow, priority/FIFO, directe goedkeuring, saldo-overzicht en kalenderweergave zijn geïmplementeerd; ESS, notificaties en manager-UI volgen later |
| Verzuim en herstel | [`requirements/absence/VERZUIM_EN_HERSTEL.md`](requirements/absence/VERZUIM_EN_HERSTEL.md) | LEIDEND | GEDEELTELIJK — schema/RLS/RPC, API, dashboardvenster, startpagina, kalenderactie, medewerker-tab, herstel, instellingen en verzuimrapportage zijn live; voorziening en verdere WvP blijven open |
| WvP Poortwachter | [`requirements/absence/WVP_POORTWACHTER_ENGINE.md`](requirements/absence/WVP_POORTWACHTER_ENGINE.md) | LEIDEND | GEDEELTELIJK — HR Admin kan eigen niet-wettelijke taaktemplates beheren; wettelijke milestone-engine, casustaken, dossier en signaleringen blijven open totdat de set inhoudelijk is bevestigd |
| Verzuiminstellingen | [`requirements/absence/VERZUIM_INSTELLINGEN.md`](requirements/absence/VERZUIM_INSTELLINGEN.md) | LEIDEND | GEDEELTELIJK — drempel, geldige standaardcasemanager en eigen taaktemplates zijn administratiegebonden beschikbaar; contacttypen en documentcategorieën blijven open |
| Rapportages en Inzichten | [`requirements/reports/RAPPORTAGES_EN_INZICHTEN.md`](requirements/reports/RAPPORTAGES_EN_INZICHTEN.md) | LEIDEND | GEDEELTELIJK — medewerkerprojecties, Aankomende gebeurtenissen, Verzuim en Bradford factor zijn live; verlof, voorziening en WvP volgen per rapport |
| Core HR | [`requirements/core-hr/MEDEWERKER.md`](requirements/core-hr/MEDEWERKER.md) | LEIDEND | GEÏMPLEMENTEERD |
| Medewerkerdashboard | [`requirements/core-hr/MEDEWERKER_DASHBOARD.md`](requirements/core-hr/MEDEWERKER_DASHBOARD.md) | LEIDEND | GEDEELTELIJK — dashboard-UI, lazy salaris, reminders, activity-notities en persoonlijke widgetvolgorde aanwezig; remote schema/advisors en per-rol browsercontrole volgen |
| Contract & dienstverband | [`requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`](requirements/employment/CONTRACT_EN_DIENSTVERBAND.md) | LEIDEND | GEDEELTELIJK — volledige publicatieflow en tijdkaart gereed; detailmutaties basis/IKV blijven open |
| Organisatie | [`requirements/organization/AFDELINGEN_EN_ROLLEN.md`](requirements/organization/AFDELINGEN_EN_ROLLEN.md) | LEIDEND | GEÏMPLEMENTEERD |
| Organogram | [`requirements/organization/ORGANOGRAM.md`](requirements/organization/ORGANOGRAM.md) | LEIDEND | GEÏMPLEMENTEERD |

## Branch- en deploymentafspraak

`main` is de enige blijvende bron van waarheid voor testen en live. Werkbranches en worktrees zijn tijdelijk: na tests, i18n, typecheck, build en browsercontrole worden ze naar `main` samengevoegd en verwijderd. Vercel Production bouwt vanaf GitHub `main`; preview-URL's zijn uitsluitend testomgevingen. Supabase-migraties worden gecontroleerd toegepast vóór de main-deploy. Controleer na iedere push de GitHub-commit en de Vercel-deployment-commit.
| Autorisatie | [`requirements/authorization/AUTORISATIE_EN_RECHTEN.md`](requirements/authorization/AUTORISATIE_EN_RECHTEN.md) | LEIDEND | GEÏMPLEMENTEERD |
| Multitenancy & administraties | [`requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md`](requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md) | LEIDEND | GEDEELTELIJK |
| Vrije velden | [`requirements/custom-fields/VRIJE_VELDEN.md`](requirements/custom-fields/VRIJE_VELDEN.md) | LEIDEND | GEÏMPLEMENTEERD VOOR EMPLOYEE, inclusief beheer-CRUD, actieve status, landcode en preview |
| Documenten & compliance | [`requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md`](requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md) | LEIDEND | GEDEELTELIJK — veilig medewerkersdossier gereed; globale documenten en AI-compliance volgen later |
| Instellingen, modules, roosters en kalender | [`requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`](requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md) | LEIDEND | GEÏMPLEMENTEERD — medewerker-pop-up en dashboardwidgetbeheer toegevoegd |
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
| Contract, salaris of payroll | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `CONTRACT_EN_DIENSTVERBAND.md`, `AUTORISATIE_EN_RECHTEN.md` |
| UI/layout/formulieren | `BLUEPRINT.md`, `UI_FLOW_BLUEPRINT.md` en het relevante requirementdocument |
| Verzuim, herstel of WvP | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `UI_FLOW_BLUEPRINT.md`, `VERZUIM_EN_HERSTEL.md`, `WVP_POORTWACHTER_ENGINE.md`, `VERZUIM_INSTELLINGEN.md`, `AUTORISATIE_EN_RECHTEN.md`, `CONTRACT_EN_DIENSTVERBAND.md` |
| Rapportages en exports | `BLUEPRINT.md`, `LOGIC_AND_WORKFLOW.md`, `UI_FLOW_BLUEPRINT.md`, `requirements/reports/RAPPORTAGES_EN_INZICHTEN.md` en `AUTORISATIE_EN_RECHTEN.md` |
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
- Verzuimcasusscope en privacy: [`decisions/FDR-0002-verzuim-casusscope-en-privacy.md`](decisions/FDR-0002-verzuim-casusscope-en-privacy.md)

Actuele verticale slice (2026-07-27): de server-rendered Startpagina is de veilige loginbestemming en is expliciet administratie- en rol/RLS-gescoord; ontbrekende bronnen tonen Werk in uitvoering zonder fictieve data. De bedrijfsdocument-read-policies zijn live administratiegebonden gehard. De employment-header, custom-fieldbeheer, functiecatalogusbeheer en eerdere medewerkerverbeteringen blijven onderdeel van dezelfde release. De actuele status staat in `delivery/IMPLEMENTATION_STATUS.md` en `delivery/CURRENT_CONTEXT.md`.

Het autorisatiebeheer en grafische rechtenoverzicht zijn beschreven in [`superpowers/specs/2026-07-18-autorisatieoverzicht-design.md`](superpowers/specs/2026-07-18-autorisatieoverzicht-design.md).

De HR-instellingenhub, tenantmodules, repeterende werkpatronen, feestdagenimport en gecombineerde medewerkerskalender zijn beschreven in [`requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md`](requirements/settings/INSTELLINGEN_MODULES_ROOSTERS_FEESTDAGEN_KALENDER.md) en ontworpen in [`superpowers/specs/2026-07-18-settings-modules-rosters-holidays-calendar-design.md`](superpowers/specs/2026-07-18-settings-modules-rosters-holidays-calendar-design.md).

De medewerkerlijst/persoonskaart-UX-slice van 2026-07-19 is geïmplementeerd: gebruikersgebonden lijstvoorkeuren zonder zoekterm, Enter-zoeken met afzonderlijk wissen, volledige klikrij, hoofdtab Overzicht vóór Persoonsgegevens en een effective-dated samenvatting van het huidige dienstverband met beschermd salaris-hover.

De HR-admin-stamtabellenslice van 2026-07-19 staat op `codex/settings-rosters-calendar`: `/master-data` gebruikt gesloten accordions voor interne redenen, documentcategorieën en tenant-relatietypen; documenten gebruiken actieve Cloud tags. De relation-typecatalogus staat in migratie `20260719170000_add_tenant_relation_type_catalog.sql` met RLS en standaardseedrecords.
