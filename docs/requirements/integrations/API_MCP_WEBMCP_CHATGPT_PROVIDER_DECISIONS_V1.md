# LiquidHR: API, MCP, WebMCP, ChatGPT-app en externe integraties

Status: gereconstrueerde productbesluiten, 2026-10-02. Dit is functionele input voor een nieuwe track, geen opdracht om implementatie of remote migrations te starten. Maak steeds onderscheid tussen bedoeld, gebouwd, getest en vrijgegeven.

## Gedeelde architectuur

Een gedeelde catalogus van getypeerde business-tools en bestaande LiquidHR-domainservices ondersteunt de reguliere externe API, MCP-server, WebMCP en ChatGPT-app. Bestaande server-side AuthContext, tenant-, HR-groep-, administratie- en subjectscope, AI-governance, audit en menselijke bevestiging worden niet gedupliceerd. Geen direct Supabase-toegangspad voor modellen, tools of externe clients.

De bestaande interne /api/* blijft een BFF en wordt niet rechtstreeks extern ontsloten. De reguliere API krijgt aparte versieerbare /api/v1/*-contracten met expliciete externe clientautorisatie, validatie, OpenAPI, rate limiting, begrensde paginering, consistente foutcodes en idempotentie voor mutaties. Webhooks en langlopende processen zijn latere afzonderlijke besluiten.

## Eerste ChatGPT-app: Workforce Assistant

Het overeengekomen eerste functionele MVP is read-only:
- get_workforce_summary: samenvatting van toegestane medewerkers-/teamscope met peildatum en filters;
- get_team_skills: zichtbare teamvaardigheden, competenties en ontwikkelbehoeften;
- get_development_plans: toegestane ontwikkelplannen, status en open acties.

De app geeft onderbouwde antwoorden en links naar de relevante LiquidHR-schermen. Dezelfde tools vormen de eerste kandidaat voor MCP en geïntegreerde WebMCP. Daarna kunnen compacte interactieve ChatGPT-schermen/dashboards worden toegevoegd.

De ChatGPT-app is een **extra kanaal voor LiquidHR-tools**, niet een vervanging van de bestaande HeRa-agent of een tweede autorisatie-/memorysysteem. Hergebruik de bestaande, kanaalonafhankelijke service-, governance- en auditcontracten waar toepasselijk. De drie toolnamen hierboven beschrijven de gekozen MVP-richting; exacte ChatGPT-auth, distributie en presentatie blijven te valideren voordat implementatie begint.

Buiten het eerste MVP: persoonsgegevens wijzigen, automatisch ontwikkelplannen aanmaken, autonome HR-processen en een uitgebreide ChatGPT-sidebar. Toekomstige schrijfacties verlopen via voorstel -> controlekaart/review -> expliciete actuele bevestiging -> herautorisatie -> bestaande domeinservice, met idempotentie. Het ChatGPT-auth-/distributiecontract staat nog open.

## Concrete WebMCP-usecases

Geïntegreerde eerste read-only toepassingen: (1) overzicht van mijn geautoriseerde workforce/team, (2) vaardigheden en ontwikkelbehoeften binnen mijn teamscope, (3) open ontwikkelplannen en vervolgacties.

Er is daarnaast een afzonderlijk WebMCP Challenge-project, LiquidHR-Agent-Workspace, met synthetische data. De eerder lokaal bewezen demo 'Prepare my development conversation' gebruikte find_employee -> get_development_context -> prepare_development_conversation -> add_follow_up_action, gevolgd door uitsluitend menselijke Review & save. De laatste save was bewust geen WebMCP-tool. Deze concrete workflow is herbruikbaar als ontwerpvoorbeeld voor een latere productfase, maar is niet automatisch de eerste geïntegreerde production WebMCP-scope. De actuele live/public status van de aparte demo moet afzonderlijk worden geverifieerd.

**Specifieke les uit de afzonderlijke Challenge Edition (augustus 2026):** de vierdemotool `add_follow_up_action` werd pas beschikbaar zodra een gespreksconcept was voorbereid (toolcatalogus 3 → 4 → na menselijke save weer 3). Dit dynamische capabilitypatroon en één gedeelde facade/policy/domain state zijn concrete herbruikbare ontwerpvoorbeelden, **geen bewijs dat de geïntegreerde productvariant of een volledige ChatGPT-natuurlijke-taalbrowserflow al accepted is**. De directe demo-interactie was destijds aangetoond; de volledige ChatGPT-browseracceptatie bleef toen open.

WebMCP gebruikt de geverifieerde LiquidHR-browsersessie; de externe MCP-server vereist zijn eigen gecontroleerde delegatie. Beide passen bij iedere tool-call opnieuw alle actuele actor- en datascopes toe. Een browserkanaal of model mag nooit extra rechten claimen.

## Externe integraties: Nmbrs eerst

Nmbrs is expliciet payrollprovider #1. De architectuur gebruikt een generiek Payroll Provider Contract v0.1 met afzonderlijke provideradapters, neutrale externe identifiers en mappings. Er is maximaal één actieve payrollprovider per HR-groep; deelname is configureerbaar per dienstverband. Toegestane functionaliteit is de doorsnede van providercapabilities, LiquidHR-support en klantrechten/configuratie. Geen stille deletes, ongecontroleerde upserts of secrets in output/audit.

De laatst expliciet afgebakende uitvoeringsvolgorde:
- P0: providerneutrale foundation, geen externe calls.
- P1: Nmbrs OAuth/connect, company selection/binding en status; geen employees, salarissen of mutaties.
- P2: handmatig read & compare voor medewerkers, met zichtbaar matching-/NEW-resultaat.
- P3: afzonderlijk geautoriseerde preview en gecontroleerde import van geselecteerde medewerkers, gevolgd door minimale employmentinformatie volgens vastgelegd contract.
- P4/later: change detection, sync-monitor, retry/idempotency en eventueel outbound HR-naar-payrollwijzigingen na aparte acceptatie.

**Bestaande voorbereiding, niet opnieuw uitvinden:** eerdere Nmbrs-uitvoering had P0 foundation als GREEN en P1 lokaal/DEV GREEN, terwijl de echte hosted Nmbrs-end-to-endverbinding op 9 september nog onbewezen/geblokkeerd was. Dit is gedateerde historische evidence, geen claim over de actuele `main` of het huidige provideraccount. Een nieuwe track inventariseert eerst bestaande Nmbrs-client-, OAuth-, binding- en contractcode en de eigen acceptance-evidence voordat hij opnieuw implementeert.

Als uitbreidbaarheidsvoorbeelden zijn **Loket, AFAS en Exact** eerder genoemd; dit zijn **geen** gekozen provider #2 of geaccordeerde eerste-wave-integraties.

De eerder geopperde bredere ambitie 'LiquidHR-leading HR-mutatie -> payroll -> document -> dossier' blijft een latere richting; zij verandert P1/P2 niet in een schrijf- of bidirectionele integratie. De actuele code- en migrationstatus van eerder Nmbrs-werk moet voor een nieuwe run worden geïnventariseerd. Andere genoemde providers zijn uitbreidbaarheidsvoorbeelden: provider #2 en diens volgorde zijn NIET besloten.

## Globale fasering

Discovery/code- en contractscan -> gedeelde API-/tool-foundation -> MCP read-only MVP -> ChatGPT MVP met later interactieve weergaven -> geïntegreerde WebMCP -> afzonderlijk geaccordeerde schrijfacties -> eventgedreven/proactieve functionaliteit.

Voor nieuwe implementatie: hergebruik bestaande services en AI Foundation, leg permissions/scopes/output per tool vast en test negatieve persona-, forged tenant/group/administration/subject- en revokegevallen. Los bestaande open securityacceptatie niet op door een tweede autorisatiemodel te bouwen. Start geen nieuwe shared-code-wave zonder expliciete dependencycheck en integratieplan.

## Nog niet vastgesteld

Exact ChatGPT-app OAuth/distributiemodel, MCP-delegatie, definitieve WebMCP-productworkflow na de drie read-tools, provider #2, eerste gewone partner-API-mutaties, webhook/eventcontract, en write-agentcatalogus blijven open.

Zie ook docs/architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md, docs/decisions/ADR-0010-ai-runtime-governance.md, docs/requirements/chatbot/HERA_AI_AGENT.md en docs/AA/AA-REQ.md.
