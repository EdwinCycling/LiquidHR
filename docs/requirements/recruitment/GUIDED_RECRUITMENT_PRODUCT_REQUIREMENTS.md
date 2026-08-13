> Repositorybron: ongewijzigd overgenomen uit `LIQUIDHR_GUIDED_RECRUITMENT_PRODUCT_REQUIREMENTS(1).md` van 13 augustus 2026. De bron noemt ZIP `(8)` + `(9)`, met RC-007 uit ZIP `(7)`. Requirements en bestaande LiquidHR-architectuur zijn leidend; Stitch vereist normalisatie en is niet letterlijk bindend.

**PRODUCT REQUIREMENTS**

LiquidHR Guided Recruitment

Definitieve requirements- en productspecificatie — inclusief UX-traceability naar Stitch RC-001 t/m RC-032

| **Status**  | Definitief functioneel ontwerp                    |
|-------------|---------------------------------------------------|
| **Datum**   | 13 augustus 2026                                  |
| **Product** | LiquidHR — Recruitment Light / Guided Recruitment |

> *“Start extreem eenvoudig; voeg structuur toe waar de klant daar waarde aan heeft.”*

## Documenthiërarchie en UX-bronnen

Deze requirements zijn de **normatieve productbron**. De Stitch-schermen zijn een visuele en interactionele referentie, geen vervanging van de requirements. Gebruik bij implementatie deze volgorde wanneer bronnen elkaar tegenspreken:

1. **Dit requirementsdocument** — functioneel gedrag, domeinregels, security, privacy en V1-scope.
2. **`LIQUIDHR_GUIDED_RECRUITMENT_GOOGLE_STITCH_UX_BRIEF.md`** — UX-regels, schermdoelen en interactionele intentie.
3. **RC-001 t/m RC-032 Stitch-schermen** — visuele referentie en componentrichting.
4. **Stitch `DESIGN.md`** — visuele tokens en algemene designrichting.
5. **Bestaande LiquidHR-code en patterns** — shell, componenten, i18n, accessibility en technische conventies.

> **Belangrijk bij de Stitch-export**
> De laatste Stitch-export bestaat uit ZIP `(8)` en `(9)`. RC-007 ontbreekt daarin en wordt canoniek aangevuld met de goedgekeurde versie uit ZIP `(7)`. Enkele screenshots/HTML-fragmenten tonen nog legacy labels zoals `Recruitment Suite`, `Talent Pool`, `Reports/Rapportages`, `All Jobs` of een globale `Assessments`-ingang. Die labels zijn **niet functioneel leidend en mogen niet worden geïmplementeerd**. Recruitment is de module **Sollicitaties** binnen de bestaande LiquidHR-shell. Ook een eventueel zichtbaar derde terminal outcome zoals `Teruggetrokken` is geen V1-requirement: V1 kent alleen de vaste terminal outcomes `AFGEWEZEN` en `AANGENOMEN`.

# 1. Doel en positionering

LiquidHR Guided Recruitment is een lichte recruitmentmodule voor Nederlandse MKB-organisaties. De module moet bruikbaar zijn voor een organisatie die alleen sollicitanten wil registreren én voor een organisatie die gestructureerde gesprekken, vragen, beoordelingssets en meerdere beoordelaars wil gebruiken. Het product wordt bewust geen volledig ATS-platform.

> **Productbelofte**
> Eén recruitmentdomein, van ultra-simpel tot guided recruitment. Geen aparte Simple/Advanced-modus; dezelfde configurabele engine ondersteunt beide.

- **Primaire doelgroep:** MKB-organisaties, vaak zonder gespecialiseerde recruiter.

- **Kernwaarde:** niet alleen administreren, maar helpen een professioneel en consistenter selectieproces te voeren.

- **Architectuurgrens:** Recruitment blijft los van Journeys, Core HR/Employment en Process Automation.

- **V1-beheer:** alleen HR maakt en beheert vacatures; autorisatie is permission-based zodat later andere rollen kunnen worden geautoriseerd.

# 2. Besloten scope en productprincipes

| **PR-001** | **MUST** | Dezelfde module ondersteunt minimaal één werkfase plus twee vaste einduitkomsten: AFGEWEZEN en AANGENOMEN. |
|------------|----------|------------------------------------------------------------------------------------------------------------|

| **PR-002** | **MUST** | Een klant moet een ultra-simpel proces kunnen gebruiken: Sollicitatie → Afgewezen / Aangenomen. |
|------------|----------|-------------------------------------------------------------------------------------------------|

| **PR-003** | **MUST** | Een klant moet desgewenst meerdere werkfases kunnen configureren, bijvoorbeeld Nieuw → Screening → Eerste gesprek → Tweede gesprek → Aanbod. |
|------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------|

| **PR-004** | **MUST** | AFGEWEZEN en AANGENOMEN zijn terminal outcomes, geen gewone configureerbare fases. |
|------------|----------|------------------------------------------------------------------------------------|

| **PR-005** | **MUST** | Communicatie met kandidaten blijft buiten LiquidHR V1. LiquidHR verstuurt geen e-mail of WhatsApp-bericht. |
|------------|----------|------------------------------------------------------------------------------------------------------------|

| **PR-006** | **MUST** | Een publieke vacaturepagina is optioneel per vacature. Handmatig kandidaten toevoegen blijft volwaardig ondersteund. |
|------------|----------|----------------------------------------------------------------------------------------------------------------------|

| **PR-007** | **MUST** | Een kandidaat heeft geen kandidaataccount of kandidaatportaal in V1. |
|------------|----------|----------------------------------------------------------------------|

| **PR-008** | **MUST** | LiquidHR levert een ruime gecureerde standaardbibliotheek van recruitmentvragen en sets mee. Runtime AI-generatie is niet onderdeel van V1. |
|------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------|

| **PR-009** | **MUST** | De module rangschikt kandidaten niet automatisch en geeft geen magische fit- of matchscore. |
|------------|----------|---------------------------------------------------------------------------------------------|

| **PR-010** | **MUST** | Na aannemen of afwijzen vervallen alle participatiegebaseerde rechten van managers/selectieleden direct. |
|------------|----------|----------------------------------------------------------------------------------------------------------|

# 3. Domeinmodel

## 3.1 Vacature

Vacature is het centrale recruitmentobject voor de open positie. Een vacature is HR-group-owned en kan intern blijven of optioneel publiek worden gepubliceerd.

| **Veld/groep** | **Requirement**                                                                |
|----------------|--------------------------------------------------------------------------------|
| Identiteit     | interne UUID; aparte publieke identifier voor publieke publicatie              |
| Titel          | vacaturetitel, los van maar optioneel gekoppeld aan bestaande LiquidHR-functie |
| Organisatie    | afdeling/team, standplaats en interne context                                  |
| Werkcontext    | werkvorm, uren van/tot, dienstverband                                          |
| Beloning       | optionele salarisrange en periode; per vacature al dan niet tonen              |
| Planning       | optionele gewenste startdatum en sluitingsdatum                                |
| Contact        | interne contactpersoon en optionele publieke contactinformatie                 |
| Selectieteam   | HR plus optionele manager/collega’s met beperkte participatierechten           |
| Publicatie     | concept / gepubliceerd / gesloten / gearchiveerd                               |
| Taal           | vacaturetaal; V1 moet minimaal NL/EN-architectuur niet blokkeren               |

## 3.2 Kandidaat

Kandidaat is de persoon vóór indiensttreding. Eén kandidaat kan meerdere sollicitaties hebben. Een kandidaat is niet automatisch een Employee.

| **Categorie**         | **Velden**                                                                                   |
|-----------------------|----------------------------------------------------------------------------------------------|
| Verplicht             | voornaam, achternaam, e-mailadres                                                            |
| Optioneel             | tussenvoegsel, telefoonnummer                                                                |
| Niet standaard vragen | geboortedatum, adres, geslacht, nationaliteit, BSN, burgerlijke staat en andere Core HR-data |

| **CAN-001** | **MUST** | Candidate gebruikt een eigen UUID. E-mailadres is geen technische unieke sleutel. |
|-------------|----------|-----------------------------------------------------------------------------------|

| **CAN-002** | **MUST** | Genormaliseerd e-mailadres wordt gebruikt voor duplicaatsignalering; naam/telefoon mogen ondersteunend zijn. LiquidHR merge nooit automatisch. |
|-------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------|

| **CAN-003** | **MUST** | HR beslist altijd of een gevonden kandidaat/medewerker dezelfde persoon is. |
|-------------|----------|-----------------------------------------------------------------------------|

## 3.3 Sollicitatie (Application)

Application koppelt één Candidate aan één Vacancy. Alles wat specifiek is voor die sollicitatie hoort hier, zodat één persoon op meerdere vacatures kan solliciteren zonder dat context door elkaar loopt.

- vacature en kandidaat

- ontvangstdatum/tijd

- bron

- huidige werkfase

- terminal outcome indien van toepassing

- CV-versie voor deze sollicitatie

- motivatie

- antwoorden op vacaturevragen

- gesprekken

- beoordelingen

- interne notities

- audit/historie

| **APP-001** | **MUST** | CV, motivatie, antwoorden, gesprekken, beoordelingen en uitkomst blijven sollicitatie-specifiek. |
|-------------|----------|--------------------------------------------------------------------------------------------------|

| **APP-002** | **MUST** | Een negatieve beoordeling op vacature A mag niet als algemene eigenschap van Candidate bij vacature B worden gepresenteerd. |
|-------------|----------|-----------------------------------------------------------------------------------------------------------------------------|

## 3.4 Gesprek en beoordeling

| **Object** | **Kern**                                                                                                                          |
|------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Interview  | titel/type, datum/tijd, deelnemers, gekozen vragenset, optionele kandidaatvoorbereiding, interne notities                         |
| Assessment | één onafhankelijke scorecard per beoordelaar, gekoppeld aan sollicitatie/gesprek, met scores per criterium/kenmerk en toelichting |

| **ASM-001** | **MUST** | Beoordelaars vullen onafhankelijk hun eigen scorecard in. |
|-------------|----------|-----------------------------------------------------------|

| **ASM-002** | **MUST** | Scores van andere beoordelaars worden bij voorkeur pas zichtbaar nadat de eigen scorecard is ingediend. |
|-------------|----------|---------------------------------------------------------------------------------------------------------|

| **ASM-003** | **MUST** | Ingediende beoordelingen worden niet stil overschreven; correcties zijn expliciet en geaudit. |
|-------------|----------|-----------------------------------------------------------------------------------------------|

# 4. Vacature maken

**UX-referenties:** RC-002, RC-003, RC-004, RC-005.


## 4.1 Gestructureerde vacaturedata

Vacaturegegevens worden waar mogelijk gestructureerd opgeslagen. Hierdoor zijn ze bruikbaar voor UI, zoeken, analytics, integraties en Google for Jobs. De vacaturetekst wordt niet als één ongestructureerd tekstveld beschouwd.

| **VAC-001** | **MUST** | HR kan een bestaande LiquidHR-functie koppelen, maar vacaturetitel en vacaturetekst blijven zelfstandig en wervend aanpasbaar. |
|-------------|----------|--------------------------------------------------------------------------------------------------------------------------------|

| **VAC-002** | **MUST** | Salaris is optioneel en HR bepaalt per vacature of het publiek wordt getoond. |
|-------------|----------|-------------------------------------------------------------------------------|

| **VAC-003** | **MUST** | Werkvorm ondersteunt minimaal op locatie, hybride en volledig remote. |
|-------------|----------|-----------------------------------------------------------------------|

## 4.2 Flexibele vaste contentblokken

V1 gebruikt zes standaardblokken. Geen algemene page builder. HR mag blokken verbergen, titel wijzigen en volgorde aanpassen.

**1.** Over de functie / intro

**2.** Jouw rol / werkzaamheden

**3.** Wat breng je mee?

**4.** Wat bieden wij?

**5.** Sollicitatieprocedure

**6.** Aanvullende informatie

| **VAC-004** | **MUST** | Ieder contentblok ondersteunt rich text. |
|-------------|----------|------------------------------------------|

| **VAC-005** | **MUST** | Een blok mag leeg/verborgen zijn en de zichtbare titel mag door HR worden aangepast. |
|-------------|----------|--------------------------------------------------------------------------------------|

| **VAC-006** | **MUST** | V1 biedt geen willekeurige blokkenbouwer of careers-site CMS. |
|-------------|----------|---------------------------------------------------------------|

# 5. Publieke vacaturepagina

**UX-referenties:** RC-005, RC-006, RC-007, RC-008, RC-028.


Publieke publicatie is per vacature optioneel. Dezelfde vacature kan intern worden behandeld zonder ooit een publieke pagina te hebben.

| **PUB-001** | **MUST** | Bij publiceren maakt LiquidHR één zelfstandige publieke pagina per vacature. |
|-------------|----------|------------------------------------------------------------------------------|

| **PUB-002** | **MUST** | De URL combineert een leesbare slug met een aparte publieke UUID/identifier. Interne database-ID’s worden niet als publieke sleutel gebruikt. |
|-------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------|

| **PUB-003** | **MUST** | De publieke identifier is identificatie, geen geheim autorisatietoken. |
|-------------|----------|------------------------------------------------------------------------|

| **PUB-004** | **MUST** | HR krijgt acties: Kopieer link, Bekijk pagina, Publicatie stoppen/sluiten. |
|-------------|----------|----------------------------------------------------------------------------|

| **PUB-005** | **MUST** | De link kan extern gedeeld worden via eigen website, LinkedIn, social media, WhatsApp, QR-code of andere kanalen. |
|-------------|----------|-------------------------------------------------------------------------------------------------------------------|

## 5.1 Branding

- bedrijfsnaam

- bedrijfslogo

- optionele primaire/accentkleur

- bewust gepubliceerde contactinformatie

- link naar privacyverklaring

| **PUB-006** | **MUST** | Branding blijft eenvoudig; V1 bouwt geen volledige werken-bij-site. |
|-------------|----------|---------------------------------------------------------------------|

## 5.2 Kandidaatervaring

| **PUB-007** | **MUST** | Publieke pagina toont eerst duidelijke vacaturekern: titel, bedrijf, locatie, uren, werkvorm, dienstverband en salaris indien geconfigureerd. |
|-------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------|

| **PUB-008** | **MUST** | Daarna volgen de configureerbare vacaturetekstblokken en een duidelijke sollicitatie-CTA. |
|-------------|----------|-------------------------------------------------------------------------------------------|

| **PUB-009** | **MUST** | De pagina is zelfstandig, rustig, mobiel uitstekend bruikbaar en voelt niet als een ingelogd HR-appscherm. |
|-------------|----------|------------------------------------------------------------------------------------------------------------|

## 5.3 Sluiten en archiveren

| **PUB-010** | **MUST** | Na sluiten kunnen geen nieuwe sollicitaties worden ingestuurd. |
|-------------|----------|----------------------------------------------------------------|

| **PUB-011** | **MUST** | De publieke pagina kan tijdelijk “Deze vacature is gesloten” tonen; bestaande sollicitaties blijven intact. |
|-------------|----------|-------------------------------------------------------------------------------------------------------------|

| **PUB-012** | **MUST** | Archiveren mag de publieke pagina de-publiceren zonder recruitmenthistorie te verwijderen. |
|-------------|----------|--------------------------------------------------------------------------------------------|

# 6. Google for Jobs readiness

**UX-referenties:** RC-005, RC-006.


> **Besluit**
> Publieke vacaturepagina’s worden vanaf dag één gemodelleerd zodat JobPosting structured data kan worden toegevoegd. Google for Jobs-ready architectuur is onderdeel van V1, ook als indexatiebeheer later verder wordt uitgebreid.

- één unieke publieke URL per vacature

- gestructureerde functietitel

- organisatie

- locatie

- publicatiedatum

- optionele sluitingsdatum/validThrough

- employment type

- optioneel salaris

- zichtbare content moet overeenkomen met structured data

# 7. Sollicitatieformulier en instroom

**UX-referenties:** RC-004, RC-006, RC-007, RC-008.


## 7.1 Vaste velden

| **Veld**   | **Gedrag**                                                       |
|------------|------------------------------------------------------------------|
| Voornaam   | altijd verplicht                                                 |
| Achternaam | altijd verplicht                                                 |
| E-mail     | altijd verplicht                                                 |
| Telefoon   | verborgen / optioneel / verplicht per vacature                   |
| CV         | verborgen / optioneel / verplicht per vacature                   |
| Motivatie  | verborgen / optioneel / verplicht per vacature                   |
| Privacy    | privacyinformatie beschikbaar en bevestiging dat deze is gelezen |

| **FORM-001** | **MUST** | LiquidHR hardcode niet dat toestemming de juridische grondslag is. Gebruik neutrale privacybevestiging en link naar privacyverklaring. |
|--------------|----------|----------------------------------------------------------------------------------------------------------------------------------------|

## 7.2 Extra sollicitatievragen via vrije-veldenprincipe

Extra vragen hergebruiken het bestaande LiquidHR-concept voor vrije velden/custom fields. Er komt geen tweede recruitment-formbuilder-engine.

- tekst

- tekstgebied

- getal

- datum

- ja/nee

- select

- multi-select

| **FORM-002** | **MUST** | Antwoorden horen bij Application, niet bij Candidate. |
|--------------|----------|-------------------------------------------------------|

| **FORM-003** | **MUST** | Een ingestuurde sollicitatie blijft historisch interpreteerbaar als een vraag of antwoordoptie later wordt gewijzigd. |
|--------------|----------|-----------------------------------------------------------------------------------------------------------------------|

## 7.3 Instroomkanalen

| **IN-001** | **MUST** | Publieke LiquidHR-pagina is één optioneel instroomkanaal. |
|------------|----------|-----------------------------------------------------------|

| **IN-002** | **MUST** | HR kan altijd handmatig een kandidaat aan een vacature toevoegen, bijvoorbeeld na e-mail, recruiter, netwerk of LinkedIn. |
|------------|----------|---------------------------------------------------------------------------------------------------------------------------|

| **IN-003** | **MUST** | Na instroom komt de sollicitatie in de eerste actieve werkfase, ongeacht instroomkanaal. |
|------------|----------|------------------------------------------------------------------------------------------|

| **IN-004** | **MUST** | Na publieke inzending ziet kandidaat alleen een eenvoudige bevestigingspagina; geen login, account of statusportal. |
|------------|----------|---------------------------------------------------------------------------------------------------------------------|

## 7.4 Publieke security

- rate limiting

- bot/spambescherming

- veilige file upload

- allowlist bestandstypen

- maximale bestandsgrootte

- malware/viruscontrole

- beschermde object storage

- geen interne storage-URL’s

- publieke endpoint mag nooit kandidaat- of HR-lijsten kunnen lezen

# 8. Recruitmentbibliotheek

**UX-referenties:** RC-024, RC-025.


Guided Recruitment onderscheidt zich doordat LiquidHR niet leeg begint. Wij leveren veel bruikbare, vaste productcontent mee die HR kan activeren/deactiveren en combineren.

| **Type**             | **Doel**                                              | **Indicatieve standaardinhoud** |
|----------------------|-------------------------------------------------------|---------------------------------|
| Sollicitatievragen   | Door kandidaat ingevuld op formulier                  | ±25                             |
| Gespreksvragen       | Voor interviewer tijdens gesprek                      | ±80–100                         |
| Beoordelingscriteria | Gestructureerde score door beoordelaar                | ±40–50                          |
| Voorbereidingsvragen | Extern meegeven zodat kandidaat zich kan voorbereiden | ±30–40                          |

| **LIB-001** | **MUST** | LiquidHR-standaarditems zijn vaste productcontent. HR mag ze actief/inactief zetten maar niet overschrijven. |
|-------------|----------|--------------------------------------------------------------------------------------------------------------|

| **LIB-002** | **MUST** | HR kan eigen vragen/criteria toevoegen, wijzigen en deactiveren. |
|-------------|----------|------------------------------------------------------------------|

| **LIB-003** | **MUST** | Geen runtime AI-generatie van vragen of criteria in V1. |
|-------------|----------|---------------------------------------------------------|

| **LIB-004** | **MUST** | AI mag buiten runtime gebruikt worden om de standaardbibliotheek te creëren, waarna menselijke curatie de definitieve vaste content bepaalt. |
|-------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------|

## 8.1 Kenmerken als verbindende laag

Gespreksvragen en vooral beoordelingscriteria kunnen gekoppeld worden aan canonieke kenmerken. Dit creëert een transparant fit-profiel en maakt een latere verbinding met Talent mogelijk zonder V1 al aan performance te koppelen.

- communicatie

- eigenaarschap

- samenwerken

- analytisch vermogen

- klantgerichtheid

- leervermogen

- leiderschap

- aanpassingsvermogen

| **LIB-005** | **MUST** | Beoordelingscriteria gebruiken een schaal 1–5 en krijgen waar mogelijk duidelijke beoordelingsankers voor lage, middelhoge en hoge score. |
|-------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------|

| **LIB-006** | **MUST** | Kenmerk-id’s moeten later herbruikbaar/koppelbaar zijn met LiquidHR Talent/skills, zonder Recruitment van dat domein afhankelijk te maken. |
|-------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------|

# 9. Herbruikbare sets

**UX-referenties:** RC-026, RC-027.


| **SET-001** | **MUST** | HR kan herbruikbare sets maken met titel, beschrijving en geordende inhoud. |
|-------------|----------|-----------------------------------------------------------------------------|

| **SET-002** | **MUST** | Een set kan gespreksvragen, beoordelingscriteria en voorbereidingsvragen combineren. |
|-------------|----------|--------------------------------------------------------------------------------------|

| **SET-003** | **MUST** | Sollicitatievragen voor het publieke formulier worden per vacature geconfigureerd en blijven buiten de gespreksets. |
|-------------|----------|---------------------------------------------------------------------------------------------------------------------|

| **SET-004** | **MUST** | LiquidHR levert circa 10–15 nuttige standaardsets, bijvoorbeeld Eerste kennismaking, Tweede gesprek, Commercieel, Leidinggevend, Klantcontact, Starter, Specialist en Senior professional. |
|-------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

| **SET-005** | **MUST** | Geen automatische koppeling tussen pipelinefase en set in V1. HR kiest de set bij het gesprek. |
|-------------|----------|------------------------------------------------------------------------------------------------|

# 10. Gesprekken

**UX-referenties:** RC-013, RC-014.


| **INT-001** | **MUST** | HR kan bij een sollicitatie één of meer gesprekken registreren. |
|-------------|----------|-----------------------------------------------------------------|

| **INT-002** | **MUST** | Gesprek bevat minimaal titel/type, datum/tijd, deelnemers en optioneel gekoppelde set. |
|-------------|----------|----------------------------------------------------------------------------------------|

| **INT-003** | **MUST** | Kandidaatvoorbereidingsvragen worden niet in LiquidHR door kandidaat beantwoord; HR kan een voorbereidingstekst eenvoudig kopiëren voor e-mail/agenda/WhatsApp buiten LiquidHR. |
|-------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

| **INT-004** | **MUST** | Geen agenda- of Outlook-integratie in V1. |
|-------------|----------|-------------------------------------------|

## 10.1 Interviewmodus

- kandidaat + vacature prominent bovenaan

- gespreksvragen in duidelijke volgorde

- optionele interne notitie per vraag

- beoordelingscriteria in dezelfde sessie of aansluitend

- rustig en focusgericht scherm

# 11. Gestructureerde beoordelingen en fit-profiel

**UX-referenties:** RC-015, RC-016, RC-017, RC-031.


| **FIT-001** | **MUST** | Iedere beoordelaar vult een eigen scorecard in; scorecards worden niet samengevoegd tot één bronrecord. |
|-------------|----------|---------------------------------------------------------------------------------------------------------|

| **FIT-002** | **MUST** | LiquidHR berekent per kenmerk een transparante samenvatting, bijvoorbeeld Communicatie 4,3; Eigenaarschap 3,7. |
|-------------|----------|----------------------------------------------------------------------------------------------------------------|

| **FIT-003** | **MUST** | HR kan per kenmerk openklappen welke beoordelaar welke score en toelichting heeft gegeven. |
|-------------|----------|--------------------------------------------------------------------------------------------|

| **FIT-004** | **MUST** | Geen algemene 0–100 fit-score, geen automatische kandidaatranking en geen AI-aannameadvies. |
|-------------|----------|---------------------------------------------------------------------------------------------|

| **FIT-005** | **MUST** | Binnen één vacature mag HR kandidaten beschrijvend vergelijken op dezelfde beschikbare kenmerken, zonder automatisch rangnummer. |
|-------------|----------|----------------------------------------------------------------------------------------------------------------------------------|

| **FIT-006** | **MUST** | Post-hire vergelijking Selection Fit → Actual Fit is expliciet later; V1 maakt alleen de semantische koppeling mogelijk. |
|-------------|----------|--------------------------------------------------------------------------------------------------------------------------|

# 12. Operationele werkomgeving voor HR

**UX-referenties:** RC-001, RC-009, RC-010, RC-011, RC-012.


## 12.1 Hoofdingang Sollicitaties

De hoofdingang opent eerst een vacatureoverzicht en niet één groot cross-vacancy Kanban-bord.

- open vacatures

- actieve sollicitaties

- nieuwe sollicitaties

- geplande gesprekken

| **OPS-001** | **MUST** | Per vacature toont LiquidHR compacte aantallen zoals sollicitaties, nieuw, in gesprek en openstaande beoordelingen. |
|-------------|----------|---------------------------------------------------------------------------------------------------------------------|

## 12.2 Pipeline

| **PIPE-001** | **MUST** | Pipeline-instellingen zijn organisatiebreed, niet per vacature in V1. |
|--------------|----------|-----------------------------------------------------------------------|

| **PIPE-002** | **MUST** | HR Admin kan werkfases hernoemen, toevoegen, rangschikken en actief/inactief zetten. |
|--------------|----------|--------------------------------------------------------------------------------------|

| **PIPE-003** | **MUST** | Minimaal één werkfase moet actief blijven. |
|--------------|----------|--------------------------------------------|

| **PIPE-004** | **MUST** | Een klant kan dus bewust slechts één werkfase “Sollicitatie” gebruiken. |
|--------------|----------|-------------------------------------------------------------------------|

| **PIPE-005** | **MUST** | HR mag kandidaten drag-and-drop tussen normale werkfases verplaatsen. Einduitkomsten vereisen expliciete acties. |
|--------------|----------|------------------------------------------------------------------------------------------------------------------|

## 12.3 Kandidaatkaart en detail

| **OPS-002** | **MUST** | Kanban-kaart toont bewust weinig: naam, ouderdom sollicitatie, interviewindicator en beoordelingstatus. |
|-------------|----------|---------------------------------------------------------------------------------------------------------|

| **OPS-003** | **MUST** | Kandidaat-/sollicitatiedetail bevat tabs: Overzicht, Gesprekken, Beoordelingen, Notities, Historie. |
|-------------|----------|-----------------------------------------------------------------------------------------------------|

| **OPS-004** | **MUST** | Als kandidaat meerdere sollicitaties heeft, zijn deze zichtbaar maar inhoud blijft per sollicitatie gescheiden. |
|-------------|----------|-----------------------------------------------------------------------------------------------------------------|

# 13. Afwijzen

**UX-referenties:** RC-018, RC-019, RC-032.


| **REJ-001** | **MUST** | Afwijzen is een expliciete terminale handeling en kan niet alleen door drag-and-drop worden uitgevoerd. |
|-------------|----------|---------------------------------------------------------------------------------------------------------|

| **REJ-002** | **MUST** | HR kan een interne afwijsreden kiezen en optioneel toelichting toevoegen. |
|-------------|----------|---------------------------------------------------------------------------|

| **REJ-003** | **MUST** | Na bevestigen vervallen alle participatierechten voor manager/beoordelaar/selectielid onmiddellijk. |
|-------------|----------|-----------------------------------------------------------------------------------------------------|

| **REJ-004** | **MUST** | Afgewezen sollicitatie verdwijnt uit participant-overzichten en oude deeplinks tonen geen kandidaatdata meer. |
|-------------|----------|---------------------------------------------------------------------------------------------------------------|

| **REJ-005** | **MUST** | HR met zelfstandige recruitmentrechten behoudt toegang volgens bewaarbeleid. |
|-------------|----------|------------------------------------------------------------------------------|

| **REJ-006** | **MUST** | Bij later heropenen worden oude participatierechten niet automatisch hersteld. |
|-------------|----------|--------------------------------------------------------------------------------|

## 13.1 Optionele contacthulp

| **REJ-007** | **MUST** | Na afwijzen mag LiquidHR een afhandelpop-up tonen met e-mail en telefoon plus Kopieer-acties. |
|-------------|----------|-----------------------------------------------------------------------------------------------|

| **REJ-008** | **MUST** | LiquidHR mag optioneel de standaard mailclient of WhatsApp openen, maar verstuurt zelf niets en bewaart geen communicatiehistorie. |
|-------------|----------|------------------------------------------------------------------------------------------------------------------------------------|

| **REJ-009** | **MUST** | HR hoeft niets te doen in deze pop-up en mag deze direct sluiten. |
|-------------|----------|-------------------------------------------------------------------|

## 13.2 Optionele reminder

| **REM-001** | **MUST** | HR kan optioneel een persoonlijke reminder aanmaken: bijvoorbeeld “Morgen Hup Le Pup informeren over afwijzing”. |
|-------------|----------|------------------------------------------------------------------------------------------------------------------|

| **REM-002** | **MUST** | Gebruik de bestaande LiquidHR Reminder-engine; bouw geen recruitment-remindersubsystem. |
|-------------|----------|-----------------------------------------------------------------------------------------|

| **REM-003** | **MUST** | Snelle keuzes: Herinner mij morgen, Andere datum/tijd, Geen reminder. |
|-------------|----------|-----------------------------------------------------------------------|

| **REM-004** | **MUST** | Reminder bevat minimale persoonsgegevens en een beveiligde deeplink naar de sollicitatie. |
|-------------|----------|-------------------------------------------------------------------------------------------|

| **REM-005** | **MUST** | Geen reminder is verplicht en afwijzen wordt nooit geblokkeerd door communicatieafhandeling. |
|-------------|----------|----------------------------------------------------------------------------------------------|

# 14. Aannemen en overgang naar Employee

**UX-referenties:** RC-020, RC-021, RC-022, RC-032.


| **HIRE-001** | **MUST** | Aannemen is een expliciete overgang en geen normale faseverplaatsing. |
|--------------|----------|-----------------------------------------------------------------------|

| **HIRE-002** | **MUST** | Voor conversie controleert LiquidHR op mogelijke bestaande Employee-identiteit. |
|--------------|----------|---------------------------------------------------------------------------------|

| **HIRE-003** | **MUST** | HR kan kiezen uit nieuw Employee, bestaand Employee/interne kandidaat of oud-medewerker/herintreder wanneer relevant. |
|--------------|----------|-----------------------------------------------------------------------------------------------------------------------|

| **HIRE-004** | **MUST** | LiquidHR signaleert mogelijke matches; HR beslist. Geen automatische merge. |
|--------------|----------|-----------------------------------------------------------------------------|

| **HIRE-005** | **MUST** | Bij aannemen vervallen participatierechten voor selectieleden direct, net als bij afwijzen. |
|--------------|----------|---------------------------------------------------------------------------------------------|

| **HIRE-006** | **MUST** | Sollicitatie bewaart link naar Employee en optioneel Employment, datum en actor van conversie. |
|--------------|----------|------------------------------------------------------------------------------------------------|

## 14.1 Minimale dataoverdracht

| **Mag worden voorgesteld aan Core HR**                                      | **Blijft recruitment-only**                                                                                                 |
|-----------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| voornaam, tussenvoegsel, achternaam, privé-e-mail, telefoon indien aanwezig | CV, motivatie, antwoorden, interviewnotities, scorecards, beoordelaarstoelichtingen, kandidaatvergelijkingen, afwijsredenen |

| **HIRE-007** | **MUST** | Recruitmenthistorie wordt niet automatisch personeelsdossierinhoud. |
|--------------|----------|---------------------------------------------------------------------|

## 14.2 Handoff naar Journeys

| **JY-001** | **MUST** | Na succesvolle Employee-koppeling vraagt LiquidHR optioneel “Preboarding Journey starten?”. |
|------------|----------|---------------------------------------------------------------------------------------------|

| **JY-002** | **MUST** | HR kan Preboarding starten of Later doen. Recruitment is niet de Journey-engine. |
|------------|----------|----------------------------------------------------------------------------------|

# 15. Medewerker toevoegen buiten Recruitment

**UX-referentie:** RC-030.


De bestaande actie Medewerker toevoegen blijft bestaan. De centrale persoonscheck wordt uitgebreid zodat ook Candidates worden gevonden.

| **EMP-001** | **MUST** | Nieuwe Employee-flow zoekt mogelijke matches in Employees én Candidates. |
|-------------|----------|--------------------------------------------------------------------------|

| **EMP-002** | **MUST** | Bij Candidate-match toont LiquidHR beperkte kandidaatidentiteit en relevante huidige/vorige sollicitaties. |
|-------------|----------|------------------------------------------------------------------------------------------------------------|

| **EMP-003** | **MUST** | HR kan minimale kandidaatgegevens overnemen of toch zelfstandig een Employee aanmaken. |
|-------------|----------|----------------------------------------------------------------------------------------|

| **EMP-004** | **MUST** | Een historische afgewezen sollicitatie blijft afgewezen als de persoon later buiten die procedure wordt aangenomen. |
|-------------|----------|---------------------------------------------------------------------------------------------------------------------|

| **EMP-005** | **MUST** | Bij actieve sollicitatie vraagt LiquidHR optioneel of deze aanname uit die sollicitatie voortkomt. Bij Ja wordt dezelfde gecontroleerde Hire-transitie gebruikt. |
|-------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|

| **EMP-006** | **MUST** | Bij Nee blijft de actieve sollicitatie inhoudelijk ongewijzigd en wordt alleen Employee aangemaakt/gekoppeld. |
|-------------|----------|---------------------------------------------------------------------------------------------------------------|

# 16. Autorisatie en toegang

**UX-referenties:** RC-031, RC-032 en alle authenticated schermen volgens least privilege.


> **Hoofdregel**
> Autorisatie is permission-based. V1 geeft HR beheerrechten, maar code mag niet afhankelijk zijn van hardcoded HR_ADMIN checks.

| **Permissionrichting**                 | **Doel**                                                       |
|----------------------------------------|----------------------------------------------------------------|
| recruitment-vacancy:read/write/publish | vacatures raadplegen, beheren, publiceren                      |
| recruitment-candidate:read/write       | kandidaat- en sollicitatiedata beheren binnen juiste scope     |
| recruitment-assessment:read/write      | beoordelingen raadplegen/invullen                              |
| recruitment-settings:manage            | pipeline, bibliotheek, sets, publicatie- en privacydefaults    |
| recruitment-participation:read/write   | beperkte toegang op concrete deelname aan sollicitatie/gesprek |

| **AUTH-001** | **MUST** | Manager/selectielid krijgt geen algemeen employee:read of recruitment-candidate:read omdat hij participant is. |
|--------------|----------|----------------------------------------------------------------------------------------------------------------|

| **AUTH-002** | **MUST** | Participant ziet alleen toegewezen kandidaat/applicationdata die nodig is voor zijn rol. |
|--------------|----------|------------------------------------------------------------------------------------------|

| **AUTH-003** | **MUST** | Na terminal outcome wordt participatie als autorisatiebron direct ongeldig. |
|--------------|----------|-----------------------------------------------------------------------------|

| **AUTH-004** | **MUST** | Een zelfstandige HR-permission blijft uiteraard geldig; alleen participatiegebaseerde rechten verdwijnen. |
|--------------|----------|-----------------------------------------------------------------------------------------------------------|

# 17. Privacy, bewaartermijn en gegevensverwijdering

**UX-referenties:** RC-029, aanvullend RC-004/006/018/019/030.


## 17.1 Dataminimalisatie

| **PRIV-001** | **MUST** | Standaard worden uitsluitend voornaam, achternaam en e-mail verplicht verzameld. |
|--------------|----------|----------------------------------------------------------------------------------|

| **PRIV-002** | **MUST** | Telefoon, CV, motivatie en extra vragen zijn per vacature configureerbaar. |
|--------------|----------|----------------------------------------------------------------------------|

| **PRIV-003** | **MUST** | Core HR-persoonsgegevens worden niet standaard in Recruitment verzameld. |
|--------------|----------|--------------------------------------------------------------------------|

## 17.2 Bewaartermijn

| **RET-001** | **MUST** | HR Admin configureert het aantal dagen dat recruitmentpersoonsgegevens na einde van de sollicitatieprocedure worden bewaard. |
|-------------|----------|------------------------------------------------------------------------------------------------------------------------------|

| **RET-002** | **MUST** | Aanbevolen productdefault is 28 dagen. Dit wordt niet gepresenteerd als wettelijk minimum. |
|-------------|----------|--------------------------------------------------------------------------------------------|

| **RET-003** | **MUST** | Configureerbare productrange: 1 t/m 3650 dagen. |
|-------------|----------|-------------------------------------------------|

| **RET-004** | **MUST** | Bij een ongebruikelijk lange termijn, bijvoorbeeld meer dan 365 dagen, toont LiquidHR een duidelijke privacywaarschuwing dat de organisatie de termijn zelf moet kunnen onderbouwen. |
|-------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

| **RET-005** | **MUST** | Als HR de organisatiebrede bewaartermijn wijzigt, wordt de vervaldatum van nog aanwezige recruitmentrecords overeenkomstig aangepast. Reeds verwijderde data keert niet terug. |
|-------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

| **RET-006** | **MUST** | V1 kent geen talentpoolbewaarregime als tweede verwerkingsdoel. |
|-------------|----------|-----------------------------------------------------------------|

## 17.3 Verwijderen/anonimiseren

| **DEL-001** | **MUST** | HR kan een privacyactie uitvoeren om recruitmentpersoonsgegevens te verwijderen/anonimiseren. |
|-------------|----------|-----------------------------------------------------------------------------------------------|

| **DEL-002** | **MUST** | Dit omvat waar van toepassing Candidate-data, CV/documenten, antwoorden, interviewnotities en assessments. |
|-------------|----------|------------------------------------------------------------------------------------------------------------|

| **DEL-003** | **MUST** | Niet-persoonlijke geaggregeerde statistieken mogen waar passend behouden blijven, bijvoorbeeld aantal sollicitaties op een vacature. |
|-------------|----------|--------------------------------------------------------------------------------------------------------------------------------------|

| **DEL-004** | **MUST** | Alleen bevoegde HR-gebruikers kunnen verwijderen/anonimiseren. |
|-------------|----------|----------------------------------------------------------------|

# 18. Instellingen

**UX-referenties:** RC-023 t/m RC-029.


| **Instellingen → Sollicitaties** | **Inhoud**                                                                  |
|----------------------------------|-----------------------------------------------------------------------------|
| Proces / Pipeline                | werkfases, volgorde, actief/inactief; vaste einduitkomsten                  |
| Bibliotheek                      | vier contentcategorieën; LiquidHR-standaard en eigen HR-content             |
| Sets                             | herbruikbare gespreks-/beoordelings-/voorbereidingssets                     |
| Publicatie                       | logo, bedrijfsnaam, accentkleur, contactinfo, privacy-URL, standaardteksten |
| Privacy                          | bewaartermijn en waarschuwingen                                             |

# 19. Analytics

**UX-referenties:** RC-001, RC-009, RC-010.


| **ANA-001** | **MUST** | V1 analytics blijven eenvoudig en bruikbaar zonder BI-complexiteit. |
|-------------|----------|---------------------------------------------------------------------|

| **ANA-002** | **MUST** | Globaal minimaal: open vacatures, actieve sollicitaties, nieuwe sollicitaties, geplande gesprekken. |
|-------------|----------|-----------------------------------------------------------------------------------------------------|

| **ANA-003** | **MUST** | Per vacature minimaal: totaal sollicitaties, nieuw, afgewezen, aangenomen. |
|-------------|----------|----------------------------------------------------------------------------|

| **ANA-004** | **MUST** | Eenvoudige later-in-V1 metrics mogen omvatten: doorlooptijd tot uitkomst, bronverdeling en conversie per fase. |
|-------------|----------|----------------------------------------------------------------------------------------------------------------|

| **ANA-005** | **MUST** | Analytics moeten ook zinvol werken met één werkfase. |
|-------------|----------|------------------------------------------------------|

# 20. Marktpositie en USP

De marktvergelijking met onder andere Daywize bevestigt dat vacancy management, kandidaatoverzicht, samenwerking, beoordelingen, publicatie en onboarding gangbare ATS-capabilities zijn. LiquidHR onderscheidt zich niet door méér ATS-features, maar door Guided Recruitment voor MKB en een naadloze grens naar Core HR en Journeys.

- **Niet leeg beginnen:** LiquidHR levert een grote, zorgvuldig gecureerde vragenbibliotheek en standaardsets.

- **Transparante structuur:** meerdere onafhankelijke beoordelaars en score per kenmerk in plaats van een ondoorzichtige AI-matchscore.

- **Extreem eenvoudig als gewenst:** één kolom Sollicitatie plus Afgewezen/Aangenomen is voldoende.

- **Doorlopende HR-keten:** Candidate → Application → Hire → Employee → Preboarding Journey, zonder recruitmentdata ongecontroleerd naar personeelsdossier te kopiëren.

- **Toekomstige differentiatie:** kenmerken kunnen later Selection Fit met ontwikkeling/performance verbinden, maar dat valt buiten V1.

# 21. Expliciet buiten V1

- e-mail verzenden vanuit LiquidHR

- e-mailhistorie of inbox

- kandidaataccount/portaal

- Outlook- of agenda-integratie

- volledige werken-bij-site/CMS

- brede jobboarddistributie

- pipeline per vacature

- recruitment workflow/automation engine

- digitaal aanbod/contractondertekening

- recruitmentbureauportal

- talentpool

- AI-kandidaatranking

- AI-matchpercentage

- runtime AI-gegenereerde recruitmentvragen

- automatische duplicate merges

- post-hire Selection Fit vs Performance-analyse

- volwaardige recruitment-BI

# 22. Conceptueel datamodel

| **Entiteit**                    | **Verantwoordelijkheid**                                                                  |
|---------------------------------|-------------------------------------------------------------------------------------------|
| recruitment_vacancies           | vacature-identiteit, structured fields, lifecycle en publicatie                           |
| recruitment_vacancy_sections    | geordende vaste contentblokken met aangepaste titels/zichtbaarheid                        |
| recruitment_candidates          | minimale kandidaatidentiteit                                                              |
| recruitment_applications        | Candidate \<-\> Vacancy, fase/outcome, bron en kernmetadata                               |
| recruitment_application_answers | snapshot/antwoorden van extra sollicitatievragen                                          |
| recruitment_documents / refs    | CV en eventuele application-specifieke documenten via bestaande document/storage patterns |
| recruitment_pipeline_stages     | organisatiebrede configureerbare werkfases                                                |
| recruitment_participants        | concrete HR/manager/selectieleden en participatiestatus                                   |
| recruitment_library_items       | standaard/eigen vragen, criteria en voorbereidingsprompts                                 |
| recruitment_sets                | titel/beschrijving van herbruikbare set                                                   |
| recruitment_set_items           | geordende selectie uit bibliotheek                                                        |
| recruitment_interviews          | selectiemomenten en gekoppelde set                                                        |
| recruitment_assessments         | beoordelaarsscorecard                                                                     |
| recruitment_assessment_scores   | score/toelichting per criterium/kenmerk                                                   |
| recruitment_notes / events      | interne notities en auditwaardige historie volgens bestaand patroon                       |

Exacte tabelnamen en kolommen zijn richtinggevend. Implementatie moet eerst bestaande LiquidHR-patronen voor HR-group ownership, RLS, audit, documenten, custom fields, reminders, Employee/Employment en permissions inspecteren.

# 23. Hoofdflows

## 23.1 Publieke instroom

**1.** HR maakt vacature

**2.** HR kiest optioneel publieke publicatie

**3.** LiquidHR genereert publieke vacaturepagina

**4.** Kandidaat vult formulier in en uploadt optioneel CV

**5.** LiquidHR suggereert mogelijke Candidate-duplicate maar maakt geen automatische merge

**6.** Application komt in eerste werkfase

**7.** HR behandelt intern

## 23.2 Handmatige instroom

**1.** HR opent vacature

**2.** HR kiest Kandidaat toevoegen

**3.** Voert minimale data in en uploadt eventueel CV

**4.** Application komt in eerste werkfase

**5.** Verder identiek aan publieke instroom

## 23.3 Gestructureerde selectie

**1.** HR registreert gesprek

**2.** Kiest optioneel herbruikbare set

**3.** Kopieert desgewenst kandidaatvoorbereiding extern

**4.** Beoordelaars voeren gesprek

**5.** Iedere beoordelaar dient eigen scorecard in

**6.** LiquidHR toont transparant kenmerkprofiel

**7.** HR beslist over vervolgstap

## 23.4 Afwijzen

**1.** HR kiest Afwijzen

**2.** Interne reden/toelichting

**3.** Bevestigen

**4.** Outcome wordt AFGEWEZEN

**5.** Participatierechten vervallen

**6.** Optionele contactpop-up

**7.** Optionele persoonlijke reminder

**8.** Bewaartermijn loopt

## 23.5 Aannemen

**1.** HR kiest Aannemen

**2.** Employee-duplicatecheck

**3.** HR kiest nieuwe/bestaande/herintreder

**4.** Minimale kandidaatgegevens worden voorgesteld

**5.** Employee/Employment-context wordt gekoppeld

**6.** Outcome wordt AANGENOMEN en participatierechten vervallen

**7.** Optioneel Preboarding Journey starten

## 23.6 Medewerker toevoegen buiten sollicitatie

**1.** HR kiest bestaande Medewerker toevoegen-knop

**2.** Persoonscheck zoekt Employee én Candidate

**3.** Bij Candidate-match kan HR minimale data overnemen

**4.** Historische sollicitatie blijft historisch correct

**5.** Bij actieve sollicitatie kan HR expliciet aangeven of de aanname daaruit voortkomt

# 24. Acceptatiecriteria op productniveau

- Een nieuwe klant kan zonder instellingen een vacature maken en handmatig een kandidaat toevoegen.

- Een klant kan de pipeline terugbrengen tot één werkfase zonder functionele problemen.

- Een HR-gebruiker kan een vacature publiek maken en de gegenereerde link delen.

- Een publieke kandidaat kan mobiel solliciteren zonder account en zonder interne HR-data te kunnen lezen.

- Eén Candidate kan twee Applications hebben met gescheiden antwoorden, CV’s, beoordelingen en outcomes.

- Een manager die participant is kan alleen toegewezen recruitmentinformatie zien en verliest deze toegang direct na Afgewezen/Aangenomen.

- HR kan een gesprek met set registreren en meerdere beoordelaars kunnen onafhankelijk scoren.

- Het fit-profiel toont kenmerkscores transparant zonder overall ranking.

- Afwijzen kan volledig zonder communicatieactie; optionele contacthulp en reminder zijn beschikbaar maar nooit verplicht.

- Aannemen kopieert uitsluitend minimale kandidaatgegevens naar Core HR en kan Preboarding starten.

- Medewerker toevoegen signaleert ook bestaande Candidates.

- Bewaartermijn is organisatiebreed configureerbaar tussen 1 en 3650 dagen, default 28, en aanpassing werkt door op nog aanwezige records.

- Publieke vacaturedata is structureel geschikt voor Google JobPosting.

# 25. Implementatie- en testprincipes voor latere bouw

- **Development/test:** LiquidHR bevindt zich in development/test. Realistische testdata mag worden aangemaakt en tijdelijk blijven voor visuele inspectie, maar is wegwerpbare testdata en nooit productafhankelijk.

- **Supabase:** noodzakelijke databasewijzigingen mogen direct op de gekoppelde development/test-omgeving, met RLS, grants en tests. Geen Docker/local Supabase/helpercontainers.

- **Git:** één feature = één branch/worktree. Voor Recruitment één feature/recruitment-branch; niet per bouwstap nieuwe branches.

- **Security:** tenant/HR-group isolatie, least privilege, participant-scope en terminale rechtenintrekking moeten expliciet cross-role getest worden.

- **UI:** Stitch is visuele richting, niet parallelle architectuur. Bestaande LiquidHR-shell, tokens, components, routing, i18n en accessibility blijven leidend.

- **Versie:** na goedgekeurde bouwstappen verhogen volgens bestaand LiquidHR-repositoryprotocol.

# 26. Beslissingslog

| **Besluit**                 | **Uitkomst**                                                                            |
|-----------------------------|-----------------------------------------------------------------------------------------|
| Publieke instroom           | Optionele publieke vacaturelink per vacature                                            |
| Pipeline                    | Organisatiebreed configureerbaar; ultra-simpel mogelijk                                 |
| Vacaturebeheer V1           | Alleen HR, maar permission-based                                                        |
| Candidate \<-\> Application | Eén Candidate kan meerdere Applications hebben                                          |
| Kandidaataccount            | Geen account/portal in V1                                                               |
| Communicatie                | Buiten LiquidHR; alleen optionele copy/open helpers                                     |
| Extra sollicitatievragen    | Bestaand vrije-veldenprincipe                                                           |
| Vragenbibliotheek           | 4 typen; LiquidHR levert veel vaste content; HR kan eigen items toevoegen               |
| Sets                        | Herbruikbaar met titel + beschrijving; geen fase-auto-koppeling                         |
| Beoordeling                 | Gestructureerd, meerdere beoordelaars, fit per kenmerk                                  |
| AI                          | Geen runtime vraaggeneratie/ranking; AI alleen gebruikt bij onze contentcreatie/curatie |
| Google for Jobs             | Vanaf dag één architectuur-ready                                                        |
| Terminal outcomes           | Afgewezen/Aangenomen trekken participatierechten direct in                              |
| Reminder bij afwijzen       | Optioneel; bestaande Reminder-module                                                    |
| Kandidaatminimum            | Voornaam, achternaam, e-mail                                                            |
| Retention                   | Default 28 dagen; HR configureert 1–3650 dagen; lange-termijnwaarschuwing               |
| Employee toevoegen          | Persoonscheck uitgebreid met Candidates; minimale data overneembaar                     |

# 27. UX-traceability — requirements naar Stitch-schermen

Deze matrix koppelt de functionele requirements aan de canonieke Stitch-referenties. Een RC-referentie betekent **visuele/interactionele richting**; de MUST-requirements in dit document blijven leidend.

| **Requirementgebied** | **Primair RC** | **Aanvullend RC** | **Implementatienoot** |
|---|---|---|---|
| Vacatureoverzicht en instroom naar vacaturebeheer | RC-001 | RC-009, RC-010 | Vacature-first hoofdroute. |
| Nieuwe vacature / gestructureerde vacaturedata | RC-002 | RC-003 | Bestaande LiquidHR-functie is optionele koppeling, vacaturetitel blijft zelfstandig. |
| Vaste flexibele contentblokken | RC-003 | RC-006 | Exact zes blokken; geen generieke page builder. |
| Sollicitatieformulier / vrije velden | RC-004 | RC-007 | Voornaam, achternaam, e-mail verplicht; telefoon/CV/motivatie configureerbaar. |
| Publicatie en deelbare link | RC-005 | RC-006, RC-028 | Handmatig delen; geen jobboardintegratie. |
| Publieke vacature-ervaring | RC-006 | RC-007, RC-008 | Klantbranding, geen ingelogde LiquidHR-shell. |
| Mobiel solliciteren | RC-007 | RC-004 | Canonieke RC-007 komt uit Stitch ZIP `(7)`. |
| Ontvangstbevestiging | RC-008 | — | Geen account, statusportal, automatische e-mailbelofte of vaste reactietermijn. |
| Eenvoudige pipeline | RC-009 | RC-023 | Terminal outcomes zijn expliciete acties, geen drag/drop-fases. |
| Uitgebreide pipeline | RC-010 | RC-023 | Drag/drop alleen tussen werkfases; geen ranking/sorteren op score. |
| Kandidaat/application detail | RC-011 | RC-012 | Sollicitatiedata blijft application-scoped. |
| Meerdere sollicitaties per Candidate | RC-012 | RC-011, RC-030 | Geen globale kandidaatstatus of globale fit-score. |
| Gesprek plannen/aanmaken | RC-013 | RC-014 | Geen agenda-/mailintegratie in V1. |
| Interviewmodus | RC-014 | RC-013, RC-015 | Rustige focusmodus; geen verplicht timermechanisme. |
| Onafhankelijke scorecard | RC-015 | RC-031 | 1–5 criteria, eigen beoordeling eerst; geen overall advies. |
| Fit-profiel | RC-016 | RC-015, RC-017 | Transparant per kenmerk; geen totaalscore/matchpercentage. |
| Kandidaten vergelijken | RC-017 | RC-016 | Vergelijk kenmerken, niet kandidaten rangschikken. |
| Afwijzen | RC-018 | RC-019, RC-032 | Expliciete terminal action; participatierechten direct weg. |
| Externe contacthulp / reminder | RC-019 | RC-018 | LiquidHR verstuurt niets; reminder is volledig optioneel en hergebruikt bestaande Reminders. |
| Aannemen — identity check | RC-020 | RC-021, RC-030 | Candidate/Employee match signaleren; HR beslist; nooit auto-merge. |
| Minimale dataoverdracht naar Core HR | RC-021 | RC-020, RC-030 | Alleen voornaam, tussenvoegsel, achternaam, privé-e-mail, telefoon indien aanwezig. |
| Preboarding Journey handoff | RC-022 | RC-020, RC-021 | Journey optioneel starten ná Employee/Employment-handoff. |
| Pipeline-instellingen | RC-023 | RC-009, RC-010 | Minimaal één werkfase; alleen AFGEWEZEN/AANGENOMEN vaste terminal outcomes. |
| Recruitmentbibliotheek | RC-024 | RC-025 | Vier contenttypen, standaard versus eigen content. |
| Bibliotheekitem/eigen vraag | RC-025 | RC-024 | Itemtype scheiden van input-/scoretype; standard read-only behalve actief/inactief/kopiëren. |
| Sets overzicht | RC-026 | RC-027 | Standaard- en eigen sets. |
| Vragenset samenstellen | RC-027 | RC-026, RC-013 | Gespreksvragen + beoordelingscriteria + voorbereidingsvragen; geen sollicitatieformulier-vragen. |
| Publicatiebranding | RC-028 | RC-005, RC-006 | Beperkte klantbranding, geen careers-site builder. |
| Privacy / bewaartermijn | RC-029 | RC-004, RC-006 | Default 28 dagen, range 1–3650; >365 alleen waarschuwing, geen vaste juridische grondslagclaim. |
| Medewerker toevoegen — Candidate match | RC-030 | RC-020, RC-021 | Zoek ook Candidates; minimale basisdata overnemen; oude Application-outcome niet herschrijven. |
| Participant/manager view | RC-031 | RC-015, RC-032 | Alleen toegewezen sollicitatie en benodigde data; geen algemene recruitmentrechten. |
| Toegang na terminal outcome | RC-032 | RC-018, RC-022, RC-031 | Geen kandidaatdata lekken; participation-based access direct ongeldig. |
| Analytics | RC-001 | RC-009, RC-010 | Alleen eenvoudige operationele metrics; geen BI/ranking. |

## 27.1 Canonieke Stitch-screenregister

| **ID** | **Canonieke schermnaam** | **Stitch-map** | **Bronexport** |
|---|---|---|---|
| RC-001 | Sollicitaties — overzicht | `rc_001_sollicitaties_overzicht` | (8) |
| RC-002 | Nieuwe vacature — basisgegevens | `rc_002_nieuwe_vacature_basisgegevens` | (8) |
| RC-003 | Vacature-editor — contentblokken | `rc_003_vacature_editor_contentblokken` | (8) |
| RC-004 | Sollicitatieformulier configureren | `rc_004_sollicitatieformulier_configureren` | (8) |
| RC-005 | Vacature — publicatie | `rc_005_vacature_publicatie` | (8) |
| RC-006 | Publieke vacaturepagina — desktop | `rc_006_publieke_vacaturepagina_desktop` | (8) |
| RC-007 | Publieke sollicitatie — mobiel | `rc_007_publieke_sollicitatie_mobiel` | (7) — canonieke eerdere versie |
| RC-008 | Publieke ontvangstbevestiging — desktop | `rc_008_publieke_ontvangstbevestiging_desktop` | (8) |
| RC-009 | Kandidaatboard — eenvoudig | `rc_009_kandidaatboard_eenvoudig` | (8) |
| RC-010 | Kandidaatboard — uitgebreid | `rc_010_kandidaatboard_uitgebreid` | (8) |
| RC-011 | Kandidaatdetail — overzicht | `rc_011_kandidaatdetail_overzicht` | (8) |
| RC-012 | Kandidaat — meerdere sollicitaties | `rc_012_meerdere_sollicitaties` | (8) |
| RC-013 | Gesprek toevoegen | `rc_013_gesprek_toevoegen` | (8) |
| RC-014 | Interviewmodus | `rc_014_interviewmodus` | (8) |
| RC-015 | Beoordelaar — eigen scorecard | `rc_015_beoordelaar_eigen_scorecard` | (8) |
| RC-016 | Fit-profiel en individuele scores | `rc_016_fit_profiel_en_individuele_scores` | (9) |
| RC-017 | Kandidaten vergelijken | `rc_017_kandidaten_vergelijken` | (8) |
| RC-018 | Afwijzen — bevestiging | `rc_018_afwijzen_bevestiging` | (8) |
| RC-019 | Afgewezen — contact/reminder afhandeling | `rc_019_afgewezen_contact_reminder_afhandeling` | (9) |
| RC-020 | Aannemen — persoonscheck | `rc_020_aannemen_persoonscheck` | (9) |
| RC-021 | Aannemen — minimale dataoverdracht | `rc_021_aannemen_minimale_dataoverdracht` | (9) |
| RC-022 | Aangenomen — Preboarding Journey handoff | `rc_022_aangenomen_preboarding_journey_handoff` | (9) |
| RC-023 | Instellingen — pipeline | `rc_023_instellingen_pipeline` | (9) |
| RC-024 | Instellingen — bibliotheek | `rc_024_instellingen_bibliotheek` | (9) |
| RC-025 | Instellingen — bibliotheekitem / eigen vraag | `rc_025_instellingen_bibliotheekitem_eigen_vraag` | (9) |
| RC-026 | Instellingen — sets overzicht | `rc_026_instellingen_sets_overzicht` | (9) |
| RC-027 | Instellingen — vragenset samenstellen | `rc_027_instellingen_vragenset_samenstellen` | (8) |
| RC-028 | Instellingen — publicatiebranding | `rc_028_instellingen_publicatiebranding` | (9) |
| RC-029 | Instellingen — privacy / bewaartermijn | `rc_029_instellingen_privacy_bewaartermijn` | (9) |
| RC-030 | Medewerker toevoegen — mogelijke kandidaat gevonden | `rc_030_medewerker_toevoegen_mogelijke_kandidaat_gevonden` | (9) |
| RC-031 | Participant/manager — toegewezen sollicitatie | `rc_031_participant_manager_toegewezen_sollicitatie` | (9) |
| RC-032 | Terminal state — participant heeft geen toegang meer | `rc_032_terminal_state_participant_heeft_geen_toegang_meer` | (9) |

## 27.2 Bekende Stitch-afwijkingen die **niet** gebouwd mogen worden

- Legacy standalone recruitmentnavigatie (`Recruitment Suite`, `Guided Recruitment` als suite, `Talent Pool`, `Reports/Rapportages`, `All Jobs`, globale `Assessments`).
- Een derde vaste terminalstatus zoals `Teruggetrokken`; in V1 zijn alleen `AFGEWEZEN` en `AANGENOMEN` terminal outcomes. Kandidaat trekt zich terug kan als interne uitkomst-/redenregistratie binnen de afgesproken domeinlogica worden verwerkt zonder een derde vaste outcome te introduceren.
- Candidate ranking, `score hoog-laag`, overall match-/fitpercentages of aanbevelingen.
- Jobboardintegraties; de publieke URL wordt handmatig gedeeld.
- Verplichte privacytoestemming als universele rechtsgrond.
- Overdracht van CV, documenten, motivatie, antwoorden, interviewnotities of assessments naar Core HR.
- Een overall `Eindoordeel`/`Mijn advies` in participant-scorecards.
