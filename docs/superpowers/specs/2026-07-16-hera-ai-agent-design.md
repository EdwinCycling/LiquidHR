# Ontwerp HeRa AI Agent

Datum: 2026-07-16
Status: goedgekeurd ontwerp, gereed voor review door opdrachtgever

## Doel

HeRa wordt de veilige, persoonlijke AI-interface voor Liquid HR. De eerste verticale slice levert een volwaardige webchat die bestaande data kan uitleggen, bestaande processen kan voorbereiden en gebruikers proactief kan wijzen op een nuttige vervolgstap. De kern is vanaf het begin geschikt voor toekomstige 24x7-communicatie via Slack, Teams, Telegram en andere kanalen.

## Gekozen richting

We bouwen een provider- en kanaalonafhankelijke agentkern met Gemini als eerste modeladapter en web als eerste kanaaladapter. Dit is verkozen boven:

1. een passieve chatbot, omdat die onvoldoende voordeel biedt boven traditionele navigatie;
2. een Google-beheerde stateful agent, omdat Liquid HR dan minder controle heeft over privacy, verwijderen, export en providerwissels;
3. een autonome schrijvende agent, omdat die niet past bij HR-risico, audit en menselijke bevestiging.

HeRa is daarom **proactief maar begrensd**. Zij kan constateren dat iets opgeslagen, gewijzigd of opgevolgd kan worden en vraagt vervolgens toestemming. Een voorstel en een uitvoeringsbevestiging zijn twee verschillende stappen.

## Systeemgrenzen

```text
Kanaaladapter -> Agent Orchestrator -> Gemini-adapter
                         |
                         +-> Conversation & Memory Service
                         +-> Tool Registry -> bestaande domeinservices
                         +-> Draft/Confirmation Service
                         +-> Liquid Display Renderer
```

- De kanaaladapter normaliseert berichten en rendert antwoorden.
- De orchestrator stelt context samen, selecteert tools en bewaakt limieten.
- De provideradapter kent alleen het Gemini-protocol en centrale modelconfiguratie.
- Conversation & Memory beheert opslag, compressie, verwijderen en export.
- De tool registry bevat uitsluitend getypeerde, geautoriseerde functies.
- De draftservice maakt idempotente concepten; bestaande domeinservices blijven de enige schrijfweg.
- Liquid Display rendert veilige, vooraf gebouwde bericht- en bevestigingscomponenten.

## Datamodel

De implementatie gebruikt afzonderlijke tabellen met Engelse identifiers:

### `ai_conversations`

Bevat tenant, eigenaar (`auth_user_id`), optionele actieve administratie, titel, oorsprongskanaal, status, gecomprimeerde samenvatting, samenvattingscursor en timestamps. Een gesprek is persoonlijk en niet deelbaar in v1.

### `ai_messages`

Bevat conversation-id, rol (`USER`, `ASSISTANT`, `TOOL`), zichtbare inhoud, beperkte typed metadata, kanaal-message-id, modelnaam en timestamps. Interne modelredenering en secrets worden niet opgeslagen.

### `ai_memory_items`

Bevat tenant, eigenaar, categorie, gecomprimeerde inhoud, bronconversation, expliciete toestemmingsdatum en timestamps. Elk item is zichtbaar en verwijderbaar voor de eigenaar. HR-bronfeiten horen niet in deze tabel.

### `ai_action_drafts`

Bevat eigenaar, conversation, toolnaam, veilige conceptpayload, verwachte bronversie, status, vervaldatum, idempotency key en timestamps. Een databaseconstraint borgt dat één bevestiging maximaal één uitvoering oplevert.

Alle tabellen krijgen RLS, eigenaarsfilters, tenantgrenzen, expliciete grants en indexes voor eigenaar/recente gesprekken in dezelfde migratie. Cascade-delete verwijdert berichten en open concepten bij het verwijderen van een gesprek. Memory wordt alleen verwijderd wanneer het bij die chat hoort en niet afzonderlijk voor later gebruik is goedgekeurd.

## Request- en datastroom

1. De server verifieert de Supabase-sessie en laadt tenant, administratie, employee-koppeling, permissions en persona.
2. De invoer wordt gevalideerd, begrensd en als gebruikersbericht opgeslagen.
3. De memoryservice combineert recente berichten, de sessiesamenvatting en goedgekeurde memory binnen een tokenbudget.
4. De Gemini-adapter verstuurt een stateless request met `GEMINI_MODEL`; provideropslag staat uit.
5. Bij een toolcall valideert de server toolnaam en argumenten opnieuw. Actor en scope komen uit stap 1, nooit uit modeloutput.
6. Leestools retourneren minimale geautoriseerde data. Schrijfintenties leveren alleen een voorstel of concept op.
7. Het antwoord en veilige metadata worden opgeslagen en naar de client gestreamd.
8. Na de ingestelde grens comprimeert een aparte stap oudere berichten. Een mislukte compressie blokkeert het gesprek niet; de volgende beurt gebruikt tijdelijk minder historie.

## Proactieve HeRa-flow

HeRa mag een voorstel doen wanneer de gebruiker een duidelijke intentie of ontbrekende opvolging noemt. Zij formuleert dit als een keuze, bijvoorbeeld: *"Je hebt een nieuwe ingangsdatum genoemd. Zal ik deze salariswijziging als concept voorbereiden?"*

Na toestemming verzamelt HeRa ontbrekende velden en maakt de server een concept. De controlekaart toont minimaal doel, oud/nieuw, ingangsdatum, gevolgen en waarschuwingen. Uitvoering vereist een aparte knop. Voor uitvoering worden permissions, scope, bronversie en vervaldatum opnieuw gecontroleerd. Bij drift wordt het concept afgekeurd en opnieuw opgebouwd.

## Memory, verwijderen en export

Sessiecompressie is automatisch en blijft binnen het gesprek. Persoonlijk langetermijngeheugen is altijd opt-in. De prompt die vraagt om toestemming maakt duidelijk wat wordt opgeslagen en waarvoor.

Verwijderen is een echte, transactionele delete. De audit bewaart geen inhoud. Export werkt per gesprek en voor alle persoonlijke chatdata en levert Markdown plus JSON. Exports sluiten prompts, chain-of-thought, secrets en interne securitymetadata uit.

## Persona

De basispersona is een senior HR-businesspartner: deskundig, betrouwbaar, warm en direct. De presentatielaag kiest een employee-, manager- of HR-profiel op basis van server-side rollen. Persona verandert lengte, vaktaal en nadruk, maar nooit permissions, feiten of veiligheidsbeleid. HeRa noemt onzekerheden en verwijst bij gevoelige of onvolledige gegevens naar verificatie.

## Kanalen en 24x7

De kern accepteert een message envelope met kanaal, externe message-id en geverifieerde Liquid HR-identiteit. De webadapter gebruikt de bestaande sessie. Toekomstige adapters moeten account linking, webhook-signatures, replaybescherming en idempotentie implementeren.

Voor gevoelige informatie of definitieve bevestiging mag een extern kanaal alleen een korte melding met een beveiligde deeplink tonen. Achtergrondtriggers kunnen HeRa 24x7 reminders, signalen en conceptberichten laten voorbereiden. Ze kunnen nooit namens een gebruiker bevestigen.

## Model- en privacybeleid

De stabiele Model ID is `gemini-3.1-flash-lite`. Het model ondersteunt function calling en structured output en is geschikt voor een snelle eerste agent. De gratis tier wordt alleen met testdata gebruikt. Productie met echte HR-data vereist een betaalde/privacygeschikte configuratie.

Liquid HR verstuurt stateless requests en bewaart conversation state zelf. Expliciete providercontextcaches en provider-fileopslag worden niet gebruikt voor persoonlijke chatcontext. Een providerinterface voorkomt dat conversation-, tool- en UI-code van Gemini afhankelijk wordt.

## Foutafhandeling

- Provider timeout: behoud het gebruikersbericht en bied opnieuw proberen aan zonder duplicatie.
- Rate limit: toon een rustige melding en een begrensde retry-after.
- Ongeldige toolcall: voer niets uit, log typed metadata en laat HeRa veilig herformuleren.
- Geen permission: geef geen afleidbare data terug en leg in gewone taal uit dat toegang ontbreekt.
- Verouderd concept: blokkeer uitvoering en genereer na toestemming een nieuwe controlekaart.
- Exportfout: laat chatdata ongemoeid en bied opnieuw genereren aan.
- Compressiefout: behoud originele berichten en ga verder met een kleiner contextvenster.

## Teststrategie

1. Pure unit-tests voor contextbudget, compressie-invarianten, persona, exportredactie en conceptstatussen.
2. Route- en servicetests voor auth, Zod-validatie, providerfouten en toolselectie.
3. Database-tests voor RLS, cross-tenant isolatie, cascade-delete en idempotente bevestiging.
4. Contracttests met een fake provider voor streaming, function calling en structured output.
5. End-to-endtests voor gesprek hervatten, memorytoestemming, verwijderen, exporteren en een bevestigde bestaande mutatie.
6. Mobiele en publieke previewcontrole op de webchat.
7. Een provider smoke-test met uitsluitend testdata en het centraal ingestelde model.

## Afbakening eerste implementatie

De implementatie bouwt in de volgorde `schema -> API/service -> UI`. Webchat, conversation lifecycle, compressed memory, opt-in memory, verwijderen/export, persona, bestaande leestools en minimaal één reeds bestaande bevestigbare mutatie vormen de eerste slice. Externe kanaaladapters, voice, document-RAG en tools voor nog niet gebouwde modules volgen later zonder de kern te vervangen.
