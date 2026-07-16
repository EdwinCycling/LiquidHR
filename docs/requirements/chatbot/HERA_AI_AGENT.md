# HeRa AI Agent

## 1. Status en doel

**Status:** LEIDEND.

HeRa is de persoonlijke, veilige AI-agent van Liquid HR. Zij helpt medewerkers, managers en HR-professionals met uitleg, analyse en bestaande Liquid HR-processen. HeRa is proactief: zij mag tijdens een gesprek een relevante vervolgstap voorstellen, maar voert nooit zelfstandig een HR-mutatie uit.

De webchat is het eerste kanaal. De agentkern wordt kanaalonafhankelijk ontworpen, zodat later onder meer Slack, Microsoft Teams en Telegram dezelfde gesprekken, rechten, tools, memory en bevestigingsregels kunnen gebruiken. HeRa moet uiteindelijk 24x7 beschikbaar kunnen zijn zonder dat kanalen of achtergrondtriggers extra bevoegdheden introduceren.

## 2. Vastgestelde functionele besluiten

- De productnaam van de agent is **HeRa**.
- Het eerste model is centraal configureerbaar via `GEMINI_MODEL` en start met `gemini-3.1-flash-lite`.
- De Gemini-sleutel blijft server-only in `GEMINI_KEY` en wordt nooit gelogd, naar de browser gestuurd of gecommit.
- HeRa gebruikt uitsluitend vooraf gedefinieerde, getypeerde backendtools. Zij krijgt geen SQL-, service-role- of generieke databasefunctie.
- De server leidt actor, tenant, administratie en permissions af uit de geverifieerde sessie. Het model levert nooit een vertrouwde `actorId` aan.
- HeRa v1 gebruikt alleen functies die werkelijk in Liquid HR bestaan. Niet-bestaande verlof-, document-, ziekmeldings- of onboardingfuncties worden niet gesimuleerd.
- Iedere schrijfhandeling volgt `voorstel -> concept -> controlekaart -> expliciete bevestiging -> uitvoering -> resultaat`.
- Een gewone bevestiging in lopende tekst geldt niet als uitvoeringsbevestiging. Uitvoering vereist de afzonderlijke bevestigingsactie bij het actuele concept.
- HeRa mag proactief vragen: *"Zal ik dit opslaan?"*, *"Zal ik deze wijziging voorbereiden?"* of *"Wil je hiervan een reminder maken?"*
- Proactieve signalering is geen toestemming. Zonder bevestiging verandert er niets.
- HeRa gebruikt uitsluitend echte, geautoriseerde brondata en verzint geen HR-feiten, historie, trends of bronverwijzingen.

## 3. Persona, toon en senioriteit

HeRa gedraagt zich als een senior HR-businesspartner: warm, scherp, discreet, praktisch en rustig. Zij schrijft helder, benoemt onzekerheid en maakt onderscheid tussen een feit uit Liquid HR, een berekening, een suggestie en algemeen advies.

De rol beïnvloedt de presentatie, niet de autorisatie:

| Gebruikerscontext | Toon | Nadruk |
|---|---|---|
| Medewerker | Empathisch, toegankelijk en begeleidend | Selfservice, uitleg en persoonlijke acties |
| Manager | Bondig, professioneel en actiegericht | Teamcontext, open acties en besluiten |
| HR-professional | Precies, discreet en datagericht | Mutaties, controles, organisatie en compliance |

HeRa reageert in de taal van het gesprek en valt bij twijfel terug op de gebruikersvoorkeur. Nederlands en Engels worden vanaf de eerste versie ondersteund. De gebruiker kan later een persoonlijke voorkeur voor bondigheid vastleggen, maar kan daarmee geen rechten of veiligheidsregels wijzigen.

## 4. Gesprekken en memory

### 4.1 Gespreksgeheugen

Berichten worden in Liquid HR opgeslagen. Voor een nieuwe modelaanroep gebruikt HeRa een begrensde combinatie van:

1. de actuele gebruikersvraag;
2. de meest recente relevante berichten;
3. een gecomprimeerde samenvatting van het oudere deel van hetzelfde gesprek;
4. expliciet goedgekeurde persoonlijke memory;
5. alleen de gegevens die geautoriseerde tools voor deze vraag retourneren.

Compressie is verliesbewust: openstaande conceptacties, bevestigingsstatus, relevante identifiers, genoemde datums en expliciete voorkeuren mogen niet stil verdwijnen. De originele berichten blijven de bron van waarheid totdat de gebruiker de chat verwijdert.

### 4.2 Persoonlijk langetermijngeheugen

Langetermijngeheugen is opt-in. HeRa vraagt expliciet of iets voor volgende gesprekken mag worden onthouden. Memory bevat alleen duurzame voorkeuren of werkcontext, bijvoorbeeld gewenste bondigheid. Operationele HR-feiten worden niet gedupliceerd in AI-memory; die worden telkens via de bronmodule gelezen.

De gebruiker kan memory bekijken en per item of volledig verwijderen. Memory is gebonden aan exact één gebruiker en tenant en wordt nooit tussen tenants gedeeld.

### 4.3 Providerstate

Liquid HR blijft de bron van waarheid voor gesprekken en memory. Aanroepen naar Gemini zijn stateless en gebruiken geen duurzame providerconversatie. Waar de API dit ondersteunt wordt provideropslag uitgeschakeld (`store=false`). Expliciete provider-caches worden niet gebruikt voor persoonlijke HR-context.

## 5. Chatbeheer en gegevensrechten

- Een gebruiker kan meerdere gesprekken starten, hernoemen en hervatten.
- Een gebruiker kan één gesprek verwijderen. Dit verwijdert sessie, berichten, sessiesamenvatting en niet-uitgevoerde conceptacties transactioneel.
- Een gebruiker kan alle eigen chatdata verwijderen. Expliciete langetermijnmemory wordt apart zichtbaar gemaakt en kan gelijktijdig of afzonderlijk worden verwijderd.
- Een verwijderaudit bevat alleen actor, tijdstip, scope en aantallen; geen verwijderde inhoud.
- Een gebruiker kan één gesprek of alle eigen chatdata exporteren als leesbaar Markdown en gestructureerd JSON.
- Een export bevat berichten, tijdstippen, gesprekstitel, uitgevoerde toolnamen en resultaten die de gebruiker zelf mocht zien. Secrets, interne prompts, chain-of-thought en verborgen beveiligingsmetadata worden nooit geëxporteerd.
- Downloadlinks zijn kortlevend of de export wordt direct gestreamd; exports worden niet onbeperkt als publiek bestand bewaard.

## 6. Veilige tools en proactieve voorstellen

Een tool heeft één duidelijke taak, een Zod-schema, canonieke permissions en een server-side scopecontrole. Leesgereedschap retourneert het minimum dat nodig is. Schrijfgereedschap maakt eerst een server-side concept met een vervaltijd en een onveranderbare samenvatting van oud en nieuw.

HeRa mag op basis van de conversatie een mogelijkheid herkennen, maar volgt altijd deze flow:

1. HeRa benoemt wat zij heeft geconstateerd.
2. HeRa vraagt of zij een concept mag voorbereiden.
3. Na toestemming verzamelt zij ontbrekende gegevens via vragen of veilige leestools.
4. De server maakt een concept en controleert de rechten opnieuw.
5. De UI toont een Liquid Display-controlekaart met gevolgen, ingangsdatum en eventuele waarschuwingen.
6. De gebruiker bevestigt of annuleert via de kaart.
7. Bij bevestiging controleert de server identiteit, context, permissions, vervaldatum en actuele brondata opnieuw.
8. Alleen de bestaande domeinservice voert de mutatie uit en schrijft de gebruikelijke audit.

Concepten zijn idempotent. Een dubbele klik of opnieuw bezorgd kanaalbericht mag nooit een dubbele mutatie veroorzaken.

## 7. Kanaalonafhankelijke en 24x7-architectuur

De kern verwerkt een genormaliseerde message envelope met gebruiker, tenant, administratie, kanaal, conversation-id, message-id, locale en inhoud. Kanaaladapters zetten web-, Slack-, Teams- of Telegramevents om naar dit formaat en renderen het antwoord passend voor het kanaal.

Vaste regels voor externe kanalen:

- Een extern account wordt eerst expliciet en verifieerbaar aan een Liquid HR-account gekoppeld.
- Iedere boodschap doorloopt dezelfde server-side context- en permissioncontrole als web.
- Een kanaal bepaalt alleen presentatie en aflevermethode; nooit scope of rechten.
- Inkomende events hebben signatureverificatie, replaybescherming en idempotency keys.
- Gevoelige details worden alleen getoond wanneer het kanaal en de conversatie daarvoor geschikt zijn; anders verwijst HeRa naar de beveiligde webapp.
- Bevestiging van gevoelige mutaties kan verplicht naar de beveiligde webapp worden verplaatst.

24x7-proactiviteit wordt later gevoed door geautoriseerde domeinevents, reminders en geplande controles. De achtergrondlaag mag berichten of voorstellen klaarzetten, maar geen menselijke bevestiging simuleren en geen HR-mutatie zelfstandig uitvoeren.

## 8. Providerlaag en modelbeleid

De applicatie gebruikt een dunne providerinterface. Model-ID, time-outs en generatie-instellingen staan centraal en niet verspreid door routes of componenten. Gemini is de eerste adapter; een providerwissel mag geen wijziging vereisen in conversation-, memory-, tool- of UI-code.

`gemini-3.1-flash-lite` wordt gebruikt voor de eerste testversie omdat het function calling en structured output ondersteunt en een lage latency heeft. De gratis tier is uitsluitend toegestaan met testdata. Voor echte HR-data moet vóór productie een betaalde, privacygeschikte configuratie actief zijn en aantoonbaar zijn gecontroleerd dat providerdata niet voor productverbetering wordt gebruikt.

## 9. Beveiliging en privacy

- Alle gesprekstabellen hebben RLS en expliciete grants in dezelfde migratie.
- Eigenaarschap is gebaseerd op de geverifieerde Supabase-user; tenant en administratie worden afzonderlijk gevalideerd.
- Chatinhoud verleent nooit autorisatie.
- Toolresultaten worden niet ruimer in berichten of memory opgeslagen dan de gebruiker op dat moment mocht zien.
- Systeem-prompts, modelredenering, secrets en ruwe gevoelige toolpayloads worden niet als chatbericht opgeslagen.
- Logging bevat request-id, model, timing, tokengebruik, toolnaam en status, maar geen volledige prompts of HR-inhoud.
- Rate limiting, maximale invoerlengte, time-outs, retry met begrenzing en kostenlimieten zijn verplicht.
- Prompt injection in gebruikers- of brondocumenten kan tools, permissions en bevestigingsregels niet overschrijven.

## 10. Scope van de eerste verticale slice

HeRa v1 bevat:

- webchat met streaming antwoord;
- meerdere persoonlijke gesprekken;
- persistente berichten en gecomprimeerde sessiesamenvatting;
- expliciet goedgekeurd persoonlijk memory;
- verwijderen en exporteren;
- rol- en taalbewuste persona;
- veilige leestools voor reeds bestaande Liquid HR-data;
- proactieve voorstellen;
- bevestigbare conceptacties voor uitsluitend reeds bestaande mutatiepaden;
- een kanaalonafhankelijke agentkern met webadapter;
- volledige NL/EN-interface, RLS-, autorisatie- en regressietests.

Niet in v1: Slack-, Teams- en Telegramadapters, voice, autonome mutaties, niet-bestaande HR-modules, RAG over documenten en providerbeheerde duurzame conversations. Deze uitbreidingen gebruiken later dezelfde kern.

## 11. Acceptatiecriteria

- Een gebruiker kan uitsluitend eigen gesprekken en memory lezen, exporteren en verwijderen.
- Verwijderde chatinhoud wordt niet opnieuw als context gebruikt.
- Een lange chat blijft coherent nadat oudere berichten zijn gecomprimeerd.
- HeRa vraagt toestemming voordat zij langetermijnmemory opslaat.
- Een proactief voorstel verandert geen data zonder een afzonderlijke, actuele bevestiging.
- Een tool kan niet buiten de permissions, tenant of administratiescope van de gebruiker lezen of schrijven.
- Een dubbele bevestiging veroorzaakt maximaal één mutatie.
- HeRa past toon en detailniveau aan zonder de autorisatie te veranderen.
- De Gemini-sleutel en systeeminstructies bereiken de browser niet.
- Providerfouten en rate limits leveren een herstelbare Nederlandse of Engelse foutmelding op.
- De kern kan later een tweede kanaaladapter ontvangen zonder de tool- en memorylaag te dupliceren.
