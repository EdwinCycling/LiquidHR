# Liquid HR documentatie-index

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

| Domein | Document | Documentstatus | Implementatie |
|---|---|---|---|
| Core HR | [`requirements/core-hr/MEDEWERKER.md`](requirements/core-hr/MEDEWERKER.md) | LEIDEND | GEÏMPLEMENTEERD |
| Contract & dienstverband | [`requirements/employment/CONTRACT_EN_DIENSTVERBAND.md`](requirements/employment/CONTRACT_EN_DIENSTVERBAND.md) | LEIDEND | GEDEELTELIJK |
| Organisatie | [`requirements/organization/AFDELINGEN_EN_ROLLEN.md`](requirements/organization/AFDELINGEN_EN_ROLLEN.md) | LEIDEND | GEÏMPLEMENTEERD |
| Organogram | [`requirements/organization/ORGANOGRAM.md`](requirements/organization/ORGANOGRAM.md) | LEIDEND | NIET GESTART |
| Autorisatie | [`requirements/authorization/AUTORISATIE_EN_RECHTEN.md`](requirements/authorization/AUTORISATIE_EN_RECHTEN.md) | LEIDEND | GEÏMPLEMENTEERD |
| Multitenancy & administraties | [`requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md`](requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md) | LEIDEND | GEDEELTELIJK |
| Vrije velden | [`requirements/custom-fields/VRIJE_VELDEN.md`](requirements/custom-fields/VRIJE_VELDEN.md) | LEIDEND | GEÏMPLEMENTEERD VOOR EMPLOYEE |
| Documenten & compliance | [`requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md`](requirements/documents/DOCUMENTEN_EN_AI_COMPLIANCE.md) | LEIDEND | NIET GESTART |
| Liquid Display aanvulling | [`requirements/liquid-display/LIQUID_DISPLAY_ENGINE.md`](requirements/liquid-display/LIQUID_DISPLAY_ENGINE.md) | LEIDEND | NIET GESTART |
| HR-chatbot | [`requirements/chatbot/HR_CHATBOT_AGENT.md`](requirements/chatbot/HR_CHATBOT_AGENT.md) | CONCEPT | NIET GESTART |
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
| Liquid Display of AI-chat | Alle vijf architectuurdocumenten plus de relevante Liquid Display- en chatbotrequirements |

## Uitvoering en besluiten

- Compacte overdracht voor nieuwe/fork-chats: [`delivery/CURRENT_CONTEXT.md`](delivery/CURRENT_CONTEXT.md)
- Actuele implementatiedrift: [`delivery/IMPLEMENTATION_STATUS.md`](delivery/IMPLEMENTATION_STATUS.md)
- Geaccepteerde tenantgrenzen: [`decisions/ADR-0001-tenant-en-administratiegrenzen.md`](decisions/ADR-0001-tenant-en-administratiegrenzen.md)
- Authenticatie, i18n en persoonlijke thema's: [`decisions/ADR-0002-authenticatie-i18n-en-persoonlijke-themas.md`](decisions/ADR-0002-authenticatie-i18n-en-persoonlijke-themas.md)
- Employee, Employment, IKV en herintreding: [`decisions/ADR-0003-employee-employment-ikv-en-herintreding.md`](decisions/ADR-0003-employee-employment-ikv-en-herintreding.md)
- Uitvoeringsplannen: [`superpowers/plans/`](superpowers/plans/)
- Toekomstige technische en functionele besluiten: `decisions/`

Actuele verticale slice (2026-07-15): dienstverbanddetail, tijdlijnmutaties, ketenadvies, follow-ups en profielkoppelingen zijn beschreven in [`superpowers/specs/2026-07-15-dienstverbanddetail-en-slimme-mutaties-design.md`](superpowers/specs/2026-07-15-dienstverbanddetail-en-slimme-mutaties-design.md). De resterende onderdelen staan in `delivery/IMPLEMENTATION_STATUS.md` en `delivery/CURRENT_CONTEXT.md`.
