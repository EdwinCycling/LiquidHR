# LiquidHR Vlootschouw / 9-grid

**Status:** Leidende product- en implementatierequirement voor de 9-grid-slice
**Datum:** 3 augustus 2026
**Bronnen:** `C:\Users\Edwin\Downloads\vlootschouw.md` en de vier aangeleverde WhatsApp-referenties
**Gerelateerd:** Talent Blueprint v2.0, Decision Register & Glossary, FDR-0003

## 1. Doel en positionering

De Vlootschouw is een campagnegestuurd HR-proces waarin managers hun eigen team op een 9-grid plaatsen. De grid combineert **prestatie** en **potentieel** in negen vaste vakken. Scores horen altijd bij een campagne en mogen niet als actuele eigenschap van een medewerker worden overschreven.

De module is onderdeel van Workforce. Een HR Admin start en bewaakt de campagne; een Manager vult uitsluitend de eigen actuele directe medewerkers in. Een medewerker krijgt geen toegang tot campagne- of scoregegevens.

De mockups zijn richtinggevend voor de informatiehiërarchie: campagne-overzicht, duidelijke voortgang, een centrale 3x3-matrix, medewerkerkaarten met avatar/initialen, zoekbare teamlijst, detailpaneel en historische context. Bestaande LiquidHR-componenten, thema-variabelen, toegankelijkheid en echte medewerkerdata blijven leidend boven pixel-perfect namaken.

## 2. Rollen en grenzen

### 2.1 HR Admin

Een HR Admin met `talent-review:manage` kan:

- een campagne als concept aanmaken met naam, startdatum, beoogde einddatum en optionele toelichting;
- een vorige campagne kiezen als historische referentie;
- een campagne starten en daarmee de actuele teamtoewijzingen vastleggen;
- tenantbreed campagnevoortgang, managers, medewerkerstatussen en de bedrijfsgrid bekijken;
- een manager vanuit de voortgangslijst handmatig herinneren;
- een campagne afsluiten wanneer iedere toegewezen medewerker een prestatie- en potentiepositie heeft;
- een afgesloten campagne heropenen; heropenen en wijzigingen worden geaudit;
- oude campagnes en teamoverzichten read-only terughalen.

### 2.2 Manager

Een Manager met `talent-review:read` en `talent-review:write` kan:

- actieve en afgesloten campagnes zien waarin hij of zij op startmoment een teamtoewijzing had;
- uitsluitend de medewerkers in de vastgelegde eigen teamtoewijzing zien;
- medewerkers zoeken en via drag-and-drop of een toegankelijke scorekeuze in één van de negen cellen plaatsen;
- een concept opslaan, een medewerkerdetail openen, een notitie toevoegen en de vorige score raadplegen;
- de eigen teamcampagne indienen wanneer alle medewerkers zijn geplaatst;
- oude scores en het vorige teamoverzicht read-only terugkijken.

Een Manager kan geen campagne starten, geen andere manager wijzigen, geen bedrijfsbreed overzicht openen en geen afgesloten score wijzigen.

### 2.3 Medewerker

Een medewerker zonder de expliciete 9-grid-permissions krijgt een server-side deny. De module lekt geen score, notitie of teamoverzicht via client- of API-input.

Dit blijft ook gelden wanneer dezelfde persoon in de organisatiestructuur als leidinggevende van de eigen afdeling staat. Een Manager mag de eigen directe medewerkers beoordelen, maar zijn eigen medewerkerrecord wordt nooit als teamlid in een campagne-snapshot opgenomen en nooit door manager-RLS, historie, API of scorefunctionaliteit teruggegeven. Een medewerker kan dus niet via een self-assignment alsnog eigen gegevens zien of de reviewfunctionaliteit starten.

## 3. Campagneproces

De statusmachine is:

```text
DRAFT -> SCHEDULED -> ACTIVE -> HR_REVIEW -> CLOSED -> ARCHIVED
                           \-> CLOSED (na HR-actie)
```

Een concept met een startdatum in de toekomst wordt bij starten `SCHEDULED`; op of na de startdatum wordt het `ACTIVE`. Op de startdatum wordt de actuele effectieve `employee_organizations.direct_manager_id`-relatie gebruikt om assignments en teamleden vast te leggen. Daarna verandert een managerwissel de historische campagne niet.

Een campagne is geldig wanneer de beoogde einddatum na de startdatum ligt. De campagne blijft actief tot HR afsluit of archiveert. Een Manager kan tijdens `ACTIVE` concepten opslaan; na `CLOSED` en `ARCHIVED` is alles read-only. HR heropenen is een expliciete, geauditbare opdracht.

## 4. 9-grid-scoremodel

De twee assen zijn vaste, niet-configureerbare waarden:

| Prestatie \ Potentieel | Laag | Normaal | Hoog |
|---|---|---|---|
| **Hoog** | Hoog potentieel / hoge prestatie | Toekomstige sterren | Sterren |
| **Normaal** | Ondermaats / vraagteken | Kernspelers | High performers |
| **Laag** | Ondermaats presteerders | Effectieve werkers | Solide professionals |

Intern zijn de waarden `LOW`, `NORMAL` en `HIGH`. De cel wordt server-side uit de twee waarden afgeleid. Een onafgemaakte score mag in `DRAFT` beide waarden nog missen; indienen vereist beide waarden.

De eerste slice gebruikt geen vitaliteit als derde dimensie. Een optionele `vitality_score` mag in het schema worden gereserveerd voor compatibele vervolgbouw, maar mag nu niet de 9-gridpositie, voortgang of toegangsbeslissing beïnvloeden.

## 5. Team- en historiecontract

Bij start maakt de database per huidige directe manager een assignment en per medewerker een immutable campagne-lidmaatschap met snapshot van naam, personeelsnummer, avatarreferentie, functie en afdeling. Scores bewaren daarnaast de manager, campagne, status, positie, notitie en timestamps.

De manager ziet bij een medewerker:

- de huidige concept- of ingediende score;
- de score uit `previous_campaign_id`, als die campagne en medewerker een vorige score hebben;
- de vorige gridpositie en de huidige positie;
- de opgeslagen snapshotgegevens van de vorige campagne, wanneer die beschikbaar zijn.

Een campagne zonder vorige referentie toont een neutrale lege historische toestand. Een medewerker die nieuw is in de huidige campagne krijgt geen verzonnen vorige score.

## 6. Reminders

Reminders gebruiken de bestaande tenant-/administratiegescopeerde `reminders`-infrastructuur en verschijnen in de bestaande Tijdhub. Een reminder is een opvolghulp en geen autorisatiebron.

### 6.1 Automatisch bij starten

Voor iedere toegewezen manager met een gekoppeld actief gebruikersaccount wordt bij het starten maximaal één automatische reminder aangemaakt:

- standaard op zeven kalenderdagen vóór de beoogde einddatum;
- als die datum vóór de startdatum valt, op de beoogde einddatum;
- voor een campagne korter dan zeven dagen dus op de beoogde einddatum;
- met de campagne als bron in titel en omschrijving;
- alleen zolang de manager de assignment nog niet heeft ingediend.

Een campagne die te laat op dezelfde dag wordt gestart mag een reminder op het eerstvolgende uitvoerbare moment plannen, zodat de campagne niet faalt door een reminder-tijdstip in het verleden. De UI toont dit niet als een afwijkende deadline.

### 6.2 Handmatig

HR kan vanuit een open assignment één reminder opnieuw sturen. Een ingediende assignment krijgt geen nieuwe reminder.

## 7. HR-overzicht

Het HR-overzicht bevat:

- lijst-eerst campagnes met status, periode en voortgang;
- totaal toegewezen medewerkers, geplaatst, openstaand en percentage;
- status per manager: niet gestart, bezig, ingediend of te laat;
- actie om een manager te herinneren;
- bedrijfsbrede 3x3-grid voor de gekozen campagne;
- keuze voor vorige campagne en beweging per medewerker;
- campagne openen, sluiten, heropenen en read-only historie.

De bedrijfsgrid gebruikt uitsluitend echte toegewezen en opgeslagen scores. Zonder data wordt een duidelijke lege toestand getoond; er worden geen voorbeeldpercentages of fictieve medewerkers gerenderd.

## 8. Manager-UX

De managerpagina volgt de aangeleverde referenties:

- campagnekop met periode, deadline en voortgang `x van y geplaatst`;
- zoekbare lijst met teamleden die nog niet zijn geplaatst;
- medewerkerkaarten met bestaande avatarfoto of initialenfallback, naam en functie;
- centrale 3x3-matrix met aantallen per cel;
- native drag-and-drop met toetsenbord-/selectfallback;
- detailpaneel met vorige score, huidige keuze en notitie;
- `Opslaan als concept` en `Indienen`;
- read-only rendering voor afgesloten campagnes.

Alle zichtbare tekst komt uit de NL/EN-message-namespace `talentReview`.

## 9. Gegevensmodel

De kernentiteiten zijn tenant-owned en sluiten aan op bestaande `employees`, `employee_organizations`, `audit_logs` en `reminders`:

- `talent_review_campaigns`: campagne, periode, status, vorige campagne en lifecycle/auditvelden;
- `talent_review_assignments`: managerverantwoordelijkheid en voortgang per campagne;
- `talent_review_assignment_members`: immutable teamlidmaatschap met employee snapshot;
- `talent_review_scores`: één score per campagne/medewerker, met positie, status, notitie en snapshot;
- `audit_logs`: campagne-, assignment- en scoremutaties, inclusief heropenen en herinneren.

Alle tabellen krijgen RLS, authenticated-only Data API-grants, tenant foreign keys, relevante indexes en policies voor HR tenantbreed en manager uitsluitend op de toegewezen eigen teamleden.

## 10. API-contract

De routes worden onder `/api/talent/review` toegevoegd:

| Route | Doel | Rol |
|---|---|---|
| `GET/POST /campaigns` | campagnes lezen/aanmaken | HR Admin |
| `GET/PATCH /campaigns/:id` | detail, wijzigen concept, lifecycle | HR Admin |
| `POST /campaigns/:id/start` | starten, assignments/snapshots/reminders maken | HR Admin |
| `POST /campaigns/:id/close` | sluiten na volledigheidscontrole | HR Admin |
| `POST /campaigns/:id/reopen` | heropenen | HR Admin |
| `POST /campaigns/:id/reminders` | manager handmatig herinneren | HR Admin |
| `GET /campaigns/:id/workspace` | scoped manager- of HR-overzicht | HR/Manager |
| `PUT /campaigns/:id/scores/:employeeId` | conceptscore opslaan | Manager/HR |
| `POST /campaigns/:id/submit` | eigen assignment indienen | Manager |

De service valideert alle UUID's, datums, statuses, concurrencyversies en scope. RLS herhaalt de grens in de database.

## 11. MVP-acceptatiecriteria voor deze slice

- [ ] HR Admin kan een campagne aanmaken met start- en einddatum.
- [ ] Starten maakt alleen echte huidige manager-/teamtoewijzingen.
- [ ] Starten maakt de automatische reminder volgens de 7-dagenregel, inclusief korte campagnes.
- [ ] Manager ziet uitsluitend het vastgelegde eigen team.
- [ ] Manager kan via drag-and-drop en een toegankelijke fallback alle teamleden plaatsen.
- [ ] Concepten kunnen worden opgeslagen; indienen blokkeert incompleet werk.
- [ ] HR ziet per manager en campagne hoeveel is geplaatst.
- [ ] HR kan vanuit die lijst een open manager handmatig herinneren.
- [ ] HR ziet een bedrijfsgrid en de manager ziet een teamscope-grid.
- [ ] Een vorige campagne en vorige score zijn read-only terug te kijken.
- [ ] Afsluiten blokkeert managerwijzigingen; heropenen werkt alleen voor HR en wordt geaudit.
- [ ] Avatarfoto's uit het bestaande employee-model worden gebruikt; ontbrekende foto’s vallen terug op initialen.
- [ ] NL en EN hebben gelijke message keys; employee-, manager- en HR-routes zijn server-side begrensd.

## 12. Bewust uitgestelde uitbreidingen

Deze requirementsbron beschrijft ook mogelijke vervolgstappen, maar ze zijn geen verborgen MVP-acceptatiecriteria: vitaliteit als derde dimensie, salaris- en leeftijdfilters, employee compare, uitgebreide notitietypen, actieplannen, performance-integratie, custom fields, trenddashboard en Excel-export. Voor elk daarvan is een afzonderlijk productbesluit of een expliciete uitbreiding van deze requirement nodig.
