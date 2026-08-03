# Adresinvoer voor LiquidHR

Status: LEIDEND  
Domein: Core HR / Employee  
Implementatiestatus: GEDEELTELIJK — lokaal schema, API, UI en tests aanwezig; remote migratie en releasecontrole volgen  
Bron: aangeleverde specificatie van 25 juli 2026

## 1. Doel en scope

Adresinvoer moet snel zijn voor Nederlandse medewerkers en bruikbaar blijven voor adressen in alle andere landen. De gebruiker kiest eerst het land. Nederlandse adressen kunnen worden aangevuld met PDOK; buitenlandse adressen kunnen internationale zoeksuggesties krijgen. Handmatige invoer blijft altijd mogelijk.

De invoer hoort bij de adresgeschiedenis van een `Employee`. Een adres heeft daarom altijd een ingangsdatum en optioneel een einddatum. Deze requirement beschrijft het toekomstige invoer-, provider- en opslagcontract; zij activeert nog geen externe provider en wijzigt de huidige productieflow niet.

## 2. Domeingrenzen en terminologie

- `Employee` is de eigenaar van de adresgeschiedenis. Een adres krijgt geen `employment_id`; parallelle dienstverbanden veranderen niets aan het persoonlijke woonadres.
- `EmployeeAddress` is één tijdgebonden adresrecord. Het huidige adres heeft geen `valid_until`.
- `country_code` is intern altijd een ISO 3166-1 alpha-2-code in hoofdletters, bijvoorbeeld `NL`, `BE` of `DE`.
- **Adres zoeken** is hulp bij het invullen, geen verificatie die de gebruiker verplicht moet accepteren.
- `source` beschrijft de herkomst van de opgeslagen invoer: `manual`, `pdok` of `geoapify`.
- `source_reference` is alleen herkomstmetadata. Het vervangt nooit de opgeslagen adresvelden.
- Door een provider ingevulde waarden blijven bewerkbaar. Na handmatige wijziging mag het record niet als ongewijzigd provider-gevalideerd worden behandeld.

## 3. Productbesluiten

1. **Land eerst.** De interface toont `Land` als eerste veld. De technische naam `country code` verschijnt nooit in de UI.
2. **Nederlandse route.** Nederlandse zoekopdrachten gaan naar PDOK Locatieserver.
3. **Buitenlandse route.** Andere landen gebruiken Geoapify Geocoding met een filter op het gekozen land.
4. **Server-only providers.** Alle providerverzoeken lopen via geautoriseerde serverroutes. API-sleutels komen niet in browsercode, clientbundles, URL's, logs of analytics.
5. **Handmatige uitweg.** De gebruiker kan altijd handmatig invoeren, ook bij lege resultaten, quota-uitputting of een storing.
6. **Geen productie-Nominatim-typeahead.** De publieke OpenStreetMap/Nominatim-service wordt niet als productie-autocomplete gebruikt vanwege het restrictieve gebruiksbeleid.
7. **Adresperiode.** `valid_from` is verplicht en `valid_until` optioneel. `valid_until` mag niet vóór `valid_from` liggen. Overlap wordt voorkomen wanneer het bestaande domeinmodel dat vereist.

## 4. Toekomstige configureerbare landregels

De invoerflow moet provider- en landregels achter één configuratiegrens kunnen gebruiken. De eerste implementatie mag een centrale applicatieconfiguratie gebruiken; tenant- of land-specifieke beheerinstellingen zijn een aparte beslissing.

Minimale configuratie per land:

| Instelling | Betekenis |
|---|---|
| `country_code` | ISO alpha-2-code |
| `display_name_nl`, `display_name_en` | Gelokaliseerde landnaam |
| `address_search_provider` | `pdok`, `geoapify` of `none` |
| `supports_address_search` | Of de brede zoekbalk wordt getoond |
| `supports_postcode_lookup` | Of postcode-plus-huisnummer beschikbaar is |
| `postal_code_required` | Of een postcode bij handmatige invoer verplicht is |
| `house_number_required` | Of een afzonderlijk huisnummer verplicht is |
| `postal_code_format` | Lokale formatterings- en normalisatieregel, indien bekend |
| `region_label_nl`, `region_label_en` | Bijvoorbeeld `Provincie` of `State` |
| `region_required` | Of regio/staat/provincie verplicht is |

Landregels mogen de vrije handmatige invoer niet uitschakelen. Als een land nog geen providerconfiguratie heeft, blijft `address_search_provider: none` met handmatige invoer geldig.

## 5. Formulieropbouw

### 5.1 Gemeenschappelijk blok

De velden staan altijd in deze volgorde:

1. **Land** — verplichte doorzoekbare keuzelijst; voor een Nederlandse organisatie standaard `Nederland`.
2. **Adres zoeken** — alleen zichtbaar wanneer de gekozen landconfiguratie zoeken ondersteunt.
3. Link **Adres handmatig invoeren** — altijd beschikbaar.

De brede zoekbalk gebruikt:

- voor Nederland: `Zoek op straat, plaats of postcode`;
- voor andere landen: `Zoek een adres in [land]`;
- minimaal drie tekens voordat suggesties starten;
- ongeveer 300 ms debounce na de laatste toetsaanslag;
- maximaal vijf suggesties;
- annuleren van een oudere aanvraag wanneer de gebruiker verder typt;
- een compacte laadstatus in de zoekbalk.

### 5.2 Nederland: postcode en huisnummer

Onder de zoekbalk is een tweede route beschikbaar:

1. **Postcode** — verplicht; normaliseren en formatteren naar `1234 AB`.
2. **Huisnummer** — verplicht; positief geheel getal.
3. **Toevoeging** — optioneel, bijvoorbeeld `A`, `bis` of `-1`.
4. **Straat** — door PDOK ingevuld, maar handmatig aanpasbaar.
5. **Plaats** — door PDOK ingevuld, maar handmatig aanpasbaar.
6. **Provincie** — door PDOK ingevuld wanneer beschikbaar; optioneel en minder prominent.

De postcodeopzoeking start zodra postcode en huisnummer geldig zijn. De toevoeging mag daarna worden ingevuld zonder een nieuwe verplichte opzoeking.

Bij geen resultaat toont de interface:

> We vonden geen Nederlands adres bij deze postcode en dit huisnummer. Controleer de gegevens of voer het adres handmatig in.

Bij keuze van een PDOK-suggestie worden straat, huisnummer, toevoeging, postcode, plaats en provincie ingevuld. De velden blijven afzonderlijk zichtbaar en aanpasbaar. Een BAG- of PDOK-referentie mag als herkomstmetadata worden bewaard.

### 5.3 Buitenlandse adressen

Voor een ander land:

1. Beperk suggesties tot het gekozen land.
2. Vul na keuze van een suggestie de beschikbare velden in.
3. Laat de gebruiker altijd overschakelen naar handmatige invoer.
4. Splits een buitenlands adres niet verplicht in straat, huisnummer en toevoeging.

Handmatige buitenlandse invoer gebruikt deze volgorde:

1. **Adresregel 1** — verplicht; normaal de lokale schrijfwijze van straat en huisnummer.
2. **Adresregel 2** — optioneel; bijvoorbeeld appartement, verdieping, gebouw of wijk.
3. **Postcode** — standaard optioneel; alleen verplicht als de landconfiguratie dat vereist.
4. **Plaats** — verplicht.
5. **Regio / staat / provincie** — optioneel; label kan per land wisselen, bijvoorbeeld `State` voor de Verenigde Staten.
6. **Land** — zichtbaar en aanpasbaar.

### 5.4 Adresperiode

Onder het feitelijke adres staat het blok **Adresperiode**:

1. **Geldig vanaf** — verplicht; bij een nieuw huidig adres standaard vandaag.
2. **Geldig tot en met** — optioneel.

Een nieuw huidig adres sluit een bestaand huidig adres af volgens de bestaande adresgeschiedenisregels. De bestaande databaseconstraint die overlappende perioden voorkomt blijft leidend; de UI geeft een begrijpelijke fout bij een conflict.

## 6. Doelopslagmodel

De bestaande `employee_addresses`-tabel blijft de adresgeschiedenis. Voor de internationale flow moet het model kunnen omgaan met zowel gestructureerde Nederlandse velden als vrije lokale buitenlandse adresregels.

| Veld | Verplicht | Doel |
|---|---:|---|
| `id` | Ja | UUID van het adresrecord |
| `tenant_id` | Ja | Tenantgrens en RLS |
| `employee_id` | Ja | Eigenaar: `Employee` |
| `country_code` | Ja | ISO alpha-2 in hoofdletters |
| `address_line_1` | Ja | Canonieke weergave; voor NL afgeleid, voor buitenland primaire invoer |
| `address_line_2` | Nee | Buitenlandse aanvulling |
| `street` | Nee | Voor Nederland normaal gevuld |
| `house_number` | Nee | Voor Nederland normaal gevuld; als tekst vanwege lokale vorm |
| `house_number_addition` | Nee | Voor Nederland normaal gevuld |
| `postal_code` | Nee, behalve volgens landregel | Postcode in lokale schrijfwijze |
| `postal_code_normalized` | Nee | Optionele zoek-/vergelijkingswaarde |
| `city` | Ja | Plaats of locality |
| `region` | Nee | Provincie, staat of regio |
| `valid_from` | Ja | Datum zonder tijdzone |
| `valid_until` | Nee | Datum zonder tijdzone |
| `source` | Ja | `manual`, `pdok` of `geoapify` |
| `source_reference` | Nee | Externe referentie, nooit de adresinhoud zelf |

Voor Nederlandse records is `address_line_1` een consistente afgeleide van straat, huisnummer en toevoeging. Voor buitenlandse records is `address_line_1` de primaire bronwaarde en zijn `street` en `house_number` niet noodzakelijk gevuld.

De bestaande velden `created_at`, `updated_at` en `deleted_at`, de tenant-/employee-scope en de huidige audit- en RLS-regels blijven behouden. Een schemawijziging mag pas samen met policies, grants, gerichte SQL-isolatietests en nieuwe gegenereerde DB-types worden ingevoerd.

## 7. Servercontracten

De browser kent alleen het genormaliseerde interne contract en nooit de vorm van PDOK- of Geoapify-antwoorden.

### 7.1 Routes

| Endpoint | Gebruik |
|---|---|
| `GET /api/address-suggestions?country=NL&q=...` | Nederlandse PDOK-suggesties |
| `GET /api/address-lookup?country=NL&postcode=...&houseNumber=...` | Nederlands postcode-plus-huisnummer |
| `GET /api/address-suggestions?country=BE&q=...` | Buitenlandse Geoapify-suggesties, landgebonden |

De routes controleren landcode, minimale zoeklengte, providerconfiguratie, tenant-/employee-scope en invoerlimieten. Zij sturen geen medewerker-ID, naam, e-mail of andere HR-gegevens naar externe aanbieders.

### 7.2 Genormaliseerde suggestie

```ts
type AddressSuggestion = {
  label: string
  countryCode: string
  addressLine1: string
  addressLine2: string | null
  street: string | null
  houseNumber: string | null
  houseNumberAddition: string | null
  postalCode: string | null
  city: string | null
  region: string | null
  source: 'pdok' | 'geoapify'
  sourceReference: string | null
}
```

De normalizer zorgt voor één veldbetekenis, veilige nullwaarden en een hoofdletter-landcode, ongeacht de leverancier.

## 8. Provider- en privacyregels

### PDOK

PDOK Locatieserver wordt gebruikt voor Nederlandse typeahead op straat, plaats, postcode en volledig adres, met beperking tot BAG-adressen. De implementatie gebruikt debounce en passende korte caching.

### Geoapify

Geoapify Geocoding wordt gebruikt voor buitenlandse suggesties en wordt beperkt tot het gekozen land. De sleutel blijft server-only. Gebruik, fouten, quota en een waarschuwing vóór een limiet worden intern bijgehouden zonder volledige adressen of andere persoonsgegevens te loggen. De actuele quota en commerciële voorwaarden worden bij implementatie opnieuw gecontroleerd.

### Privacy

- Adressen zijn persoonsgegevens en vallen onder dezelfde tenant- en employee-gebaseerde autorisatie als de huidige adresgeschiedenis.
- Externe verzoeken bevatten alleen zoektekst en land.
- Volledige adressen komen niet in foutlogs of analytics.
- Een providerstoring, lege respons of quota-overschrijding blokkeert handmatige invoer niet.
- Providerdata wordt niet zonder normale formulier-, server- en RLS-validatie opgeslagen.

## 9. Fout- en leegestaten

- Leeg resultaat: geen technische foutmelding; toon een vriendelijke handmatige uitweg.
- Technische storing: `Adres zoeken is tijdelijk niet beschikbaar. Je kunt het adres handmatig invoeren.`
- Oud zoekresultaat: negeren wanneer een nieuwere zoekopdracht al actief is.
- Ongeldige periode of overlap: toon een veld-/formulierfout en laat de gebruiker corrigeren.
- Gewijzigde providerwaarden: opslaan als de waarden voldoen aan het gewone adrescontract; geen providerclaim behouden voor de gewijzigde waarden.

## 10. Acceptatiecriteria

1. Bij `Nederland` kan de gebruiker zoeken op straat, plaats of postcode en een PDOK-resultaat kiezen.
2. Bij een geldige Nederlandse postcode en huisnummer worden straat en plaats ingevuld wanneer PDOK een resultaat geeft.
3. Opslaan blijft mogelijk wanneer PDOK geen resultaat geeft, via handmatige invoer.
4. Bij een ander land schakelt de invoer over naar internationale adresregels en een landgebonden suggestieservice.
5. Een buitenlands adres kan zonder huisnummer of postcode worden opgeslagen wanneer de landconfiguratie dat toestaat.
6. API-voorgestelde waarden kunnen vóór opslaan worden gecorrigeerd.
7. Landcode, adresperiode en herkomst worden bewaard.
8. API-sleutels zijn niet zichtbaar in browser of clientbundel.
9. Een externe storing blokkeert handmatige adresinvoer niet.
10. Bestaande adresgeschiedenis blijft employee-scoped, tijdgebonden, tenant-geïsoleerd en zonder overlappende perioden.

## 11. Implementatievolgorde voor later

De feature volgt de projectregel **schema → API/service → UI**:

1. Schema: migratie van `employee_addresses`, constraints voor landafhankelijke verplichtingen, herkomstvelden, RLS/grants, audit en SQL-isolatie-/validatietests.
2. API/service: provideradapters, normalizers, server-only secrets, rate limiting/caching, quota-observatie en typed Zod-contracten.
3. UI: landkeuze, Nederlandse postcodeflow, internationale vrije regels, handmatige uitweg, debounce/annulering, i18n en responsive controle.
4. Releasecontrole: i18n-pariteit, strict TypeScript, gerichte tests, build en geauthenticeerde browsercontrole inclusief lege/storing-/handmatige scenario's.

## 12. Open configuratiebesluiten vóór implementatie

Deze punten zijn bewust niet stil ingevuld:

- of landregels centraal in code blijven of later tenant-/administratiebeheer krijgen;
- welke landen Geoapify actief mogen gebruiken en welke alleen handmatige invoer krijgen;
- waar providerquota en waarschuwingen zichtbaar worden voor beheerders;
- of `postal_code_normalized` als databaseveld nodig is of eerst in de zoekservice kan blijven;
- welke bestaande `address:read`-/`address:write`-rechten exact op de suggestieroutes en mutaties worden toegepast.

## 13. Amendement 2026-08-01: hoofdadres en tweede tijdelijk adres

Dit amendement vervangt de algemene periodebeschrijving in paragraaf 3.7 en 5.4 voor de medewerkerkaart.

- `employee_addresses.address_type` is `PRIMARY` of `SECONDARY`. Het veld is immutable na aanmaken.
- Een medewerker heeft altijd minimaal één niet-gearchiveerd `PRIMARY`-adres. Het laatste hoofdadres kan niet worden verwijderd.
- Een `PRIMARY`-adres heeft in de gebruikersinterface geen veld **Geldig tot**. Bij een nieuw hoofdadres sluit de server het vorige hoofdadres automatisch af op de dag vóór de nieuwe `valid_from`; de adresgeschiedenis blijft behouden.
- Een `SECONDARY`-adres is een tijdelijk adres naast het hoofdadres, bijvoorbeeld voor tijdelijk elders wonen, een verpleegadres of een andere tijdelijke verblijfplaats. Het heeft een verplichte `description`, `valid_from` en `valid_until`, waarbij de einddatum na de startdatum ligt.
- Een `SECONDARY`-adres heeft geen opvolgerlogica. Het kan rechtstreeks worden gewijzigd of verwijderd; verwijderen wijzigt het hoofdadres niet.
- Overlap wordt per `address_type` voorkomen. Een tijdelijk adres mag dus tegelijk lopen met het hoofdadres, maar twee records van hetzelfde type mogen niet overlappen.
- De adres-tab gebruikt twee exclusieve harmonica-vensters: **Hoofdadres** en **Tweede tijdelijk adres**. Er is altijd maximaal één venster open. Toevoegen en wijzigen gebruiken de bestaande serverroutes, RLS, audit en adreszoekcomponenten.

De migratie `20260801130000_employee_address_types.sql` backfilled bestaande demo-adressen als `PRIMARY`; bestaande employee-, tenant- en auditrelaties zijn hergebruikt.

## 13. Bronnen

- [PDOK Locatieserver](https://www.pdok.nl/introductie/-/article/pdok-locatieserver-1)
- [Geoapify forward geocoding](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/)
- [OpenStreetMap Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
