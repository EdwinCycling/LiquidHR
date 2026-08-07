# Datamodel: Contract & Dienstverband (Module 2 - Effective Dating)

> **Actuele scope vanaf 2026-08-05:** een persoon bestaat één keer binnen een HR-groep en kan nul of meerdere dienstverbanden hebben. Meerdere actieve dienstverbanden zijn toegestaan. Het hoofddienstverband is uitsluitend een UX-keuze. Een dienstverband heeft één vaste CAO; een CAO-wijziging vereist het afsluiten van het oude dienstverband en het aanmaken van een nieuw dienstverband. De oudere tenantbrede persoons- en effective-dated CAO-beschrijvingen hieronder blijven als historische implementatienotities staan, maar zijn niet het doelmodel. Zie [HR-groepen: scope, inrichting en domeingrenzen](../multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md).

> **Implementatiebesluit 2026-07-15 — leidend bij afwijkingen hieronder.** De oorspronkelijke naam `EmploymentContract` vermengde het HR-dienstverband met de fiscale inkomstenverhouding (IKV). De actuele implementatie volgt ADR-0003 en normaliseert dit naar `Employee → Employment ↔ IncomeRelationship`. De gedetailleerde tijdlijnvelden in dit document blijven functionele requirements, maar hun foreign key heet in de implementatie `employmentId`, niet `contractId`.

> **Aanvulling 2026-07-18.** De aanmaakflow publiceert een dienstverband atomair met IKV-koppeling, organisatieplaatsing, arbeidsvoorwaarden, rooster, optioneel salaris en een kostenverdeling van exact 100%. Functies en functiegroepen zijn HR-groepgebonden; salarisschalen en salarisrevisies blijven administratiegebonden en effective-dated. Gepubliceerde revisies zijn onveranderlijk; correcties krijgen een nieuwe geldigheidsperiode.

> **Aanvulling 2026-07-29 — actuele contractstructuur.** Een `Employment` is het dienstverband en bevat land, IKV-nummer, primaire status, begin-/anciënniteitsdatum en de uitdienstgegevens. Eén dienstverband heeft één of meer direct aansluitende `employment_contracts`. Een contract bevat medewerkerstype, arbeidsvoorwaardenregeling, bepaalde/onbepaalde duur en proeftijd. Rooster, salaris, organisatieplaatsing en kostenverdeling blijven afzonderlijke, aansluitende tijdlijnen onder het dienstverband.

### Regelingentijdlijn en fulltime-referentie 2026-08-07

CAO- en bedrijfseigen regelingen worden als opvolgende versies beheerd. Iedere versie heeft een verplichte `valid_from` en optioneel een `predecessor_id`. De vorige versie loopt automatisch tot de dag vóór de start van de opvolger; een opvolger moet strikt later starten, er is maximaal één directe opvolger en cyclische ketens zijn niet toegestaan. In de beheerscherm-UX staan regelingen als lijst met per regeling de volledige opvolgers; iedere versie kan worden gewijzigd en uitsluitend de laatste versie kan een nieuwe opvolger krijgen. Contracten blijven naar de concrete regelingversie verwijzen.

De `standard_hours_per_week` van de op het contract gekozen CAO/bedrijfseigen regeling is de officiële fulltime-norm. `employment_contracts.fulltime_hours_per_week` bewaart daarvan een historische snapshot; nieuwe roosters nemen de snapshot van het geldige contract over in `employment_schedules.fulltime_hours_per_week`. De verloffactor is `min(contracturen, fulltime-norm) / fulltime-norm` en is maximaal 1. De contracturen blijven de feitelijke roosteruren en de salarisverhouding; de cap geldt voor verlof en FTE-limieten.

### Goedgekeurde aanmaakflow 2026-07-29

1. Controleer vóór de wizard personeelsnummer, nationaliteit, geboortedatum, geslacht en voor Nederland het BSN. Ontbrekende gegevens worden eerst in een verplicht tussenscherm aangevuld.
2. Maak het dienstverband aan met een optionele UX-voorkeursaanduiding, IKV 1–99, begin- en anciënniteitsdatum en contractland. De begindatum staat standaard op de eerste dag van de volgende maand; het land komt uit de administratie-inrichting.
3. Leg het eerste contract vast met medewerkerstype, eventuele flexfase, arbeidsvoorwaardenregeling, looptijd en proeftijd. De contractstart is in deze flow gelijk aan de dienstverbandstart en alleen-lezen.
4. Leg rooster en weekuren vast. Oproepstatus, oproepverplichting en voltijd/deeltijd zijn conditioneel; het gemiddelde rooster moet exact gelijk zijn aan de contracturen per week.
5. Leg salaris vast via handmatig, wettelijk minimumuurloon of salaristabel. Frequenties zijn administratiegebonden stamdata; voltijd- en deeltijdbedrag worden met de deeltijdfactor aan elkaar gerelateerd.
6. Leg functie, afdeling, kostenplaats en kostendrager vast en publiceer alle onderdelen atomair.

### Goedgekeurde detail-UX 2026-07-29

- **Overzicht** bevat de dienstverband-/IKV-gegevens en een selecteerbare contracttijdlijn. Contracten kunnen vanuit een dialoog worden bekeken, gewijzigd en aansluitend toegevoegd.
- De oude tabs **Basis/IKV** en **Arbeidsvoorwaarden** vervallen; hun gegevens staan op Overzicht en per contract.
- **Rooster**, **Salaris**, **Organisatie** en **Kostenverdeling** gebruiken dezelfde selecteerbare tijdlijnopzet met detaildialoog, wijzigen en een aansluitende nieuwe periode.
- Het dienstverband blijft alleen-lezen wanneer een nieuw contract aan een bestaand dienstverband wordt toegevoegd.
- Er kunnen meerdere actieve dienstverbanden per persoon bestaan. Een eventuele technische voorkeurs- of primaire aanduiding is uitsluitend UX-context en geen blokkade op een tweede actief dienstverband.

### Implementatiestatus HR-groepen — 2026-08-05

Stap 6 gebruikt `Employee` als persoonskaart binnen één HR-groep en `Employment` als administratiegebonden relatie binnen diezelfde groep. De organisatieplaatsing, arbeidsvoorwaarden, contracten, rooster- en kostenverdelingstijdlijnen dragen de groepssleutel; cross-group combinaties worden door composite foreign keys, servervalidatie en RLS geweigerd. De complete-employment-RPC publiceert een geldig dienstverband atomair en rolt een ongeldige 90%-kostenverdeling volledig terug.

De browserfixture `DEMO-028` toont twee actieve employmentkaarten met de administraties `Liquid HR Operations B.V.` en `Liquid HR Services B.V.`. De administratie staat per kaart zichtbaar naast afdeling en functie. De remote complete-flow-, directory-, RLS- en Step-6-contracttests zijn geslaagd.

## 0. Goedgekeurde domeingrenzen

- Een `Employee` is de persoonskaart binnen precies één HR-groep en heeft **nul, één of meerdere** dienstverbanden. Een bezoeker, beveiliger of andere externe relatie mag dus zonder dienstverband bestaan.
- Een `Employment` is één arbeidsrechtelijke relatie binnen één administratie en HR-groep. Gelijktijdige dienstverbanden zijn toegestaan, ook tweemaal binnen dezelfde administratie.
- Een `IncomeRelationship` is de afzonderlijke fiscale IKV. De tijdsgebonden koppeltabel `EmploymentIncomeRelationship` voorkomt dat IKV-identiteit en arbeidsrechtelijke identiteit worden samengevoegd.
- Arbeidsvoorwaarden, rooster, salaris, organisatieplaatsing en kostenverdeling hebben onafhankelijke halfopen geldigheidsperioden `[startDate, endDate)`. Overlap binnen dezelfde tijdlijn wordt database-side geweigerd.
- Uitdienst gaan is een expliciete workflow met datum, wettelijke Belastingdienstreden en bevestiging. Alleen een verstreken dienstverband met een bevestigde uitdienstmelding bepaalt de status **uit dienst**.
- Een herintreder krijgt nooit een tweede Employee binnen dezelfde HR-groep. Eerst wordt binnen die groep exact op een BSN-HMAC gezocht; zonder BSN volgt een gewogen vergelijking op geboortedatum, naam, e-mail, telefoon en postcode. Bij twijfel beslist de invoerder expliciet en dit besluit wordt geaudit. Een eventuele koppeling met een persoon in een andere HR-groep is een afzonderlijke technische identity-link en geeft geen groepsleesrecht.
- Exacte BSN-matching gebruikt geen leesbaar BSN en geen ongesalte hash. De server berekent een tenantgebonden HMAC met `BSN_HASH_KEY`; deze sleutel is server-only.
- Alle tabellen dragen expliciete tenant-, HR-groep- en waar nodig administratiegrenzen. Cross-tenant- en cross-group foreign keys, services en RLS blokkeren gegevenslekken ook wanneer een client-ID wordt gemanipuleerd.

### Actuele fysieke tabellen

| Domein | Tabel |
|---|---|
| Arbeidsrelatie | `employments` |
| Contractreeks binnen arbeidsrelatie | `employment_contracts` |
| Fiscale inkomstenverhouding | `income_relationships` |
| Tijdgebonden Employment–IKV-koppeling | `employment_income_relationships` |
| Arbeidsvoorwaarden | `employment_labor_conditions` |
| Rooster | `employment_schedules` |
| Salaris | `employment_salaries` |
| Kostenverdeling | `employment_cost_allocations` |
| Uitdienstworkflow | `employment_terminations` |
| Stamtabellen | `job_groups`, `jobs`, `job_revisions`, `salary_scales`, `salary_scale_revisions`, `salary_scale_steps`, `cost_centers`, `cost_carriers`, `labor_condition_sets`, `flex_phases`, `salary_frequencies`, `statutory_minimum_wages`, `employment_end_reasons` |
| HR-wijzigingenprojectie | `hr_change_events` (security-invoker view, zonder salarisbedragen) |
| Duplicaatbesluit | `identity_match_decisions` |

## 1. Inleiding
Dit document beschrijft de architectuur voor contracten, dienstverbanden en salaris (payroll) in het HR-systeem. 
Dit model gebruikt een **Effective Dating** patroon (onafhankelijke tijdlijnen). In plaats van één platte 'mutatie' tabel per medewerker, heeft het overkoepelende `EmploymentContract` (dat de wettelijke basis en inkomstenverhouding definieert) vier onafhankelijke tijdsgebonden entiteiten (tijdlijnen) die onafhankelijk van elkaar kunnen muteren:
1. `EmployeeOrganization` (Waar werkt iemand en op welke kostenplaats?)
2. `EmployeeLaborCondition` (Onder welke CAO valt iemand?)
3. `EmployeeSchedule` (Wanneer werkt iemand?)
4. `EmployeeSalary` (Wat verdient iemand?)

Dit voorkomt data-duplicatie en maakt terugwerkende kracht (TWK) berekeningen in de payroll-engine betrouwbaar.

## 2. Aanwijzingen voor de AI (Vibe Coding Instructions)
- **Taal:** Genereer alle tabellen, kolommen en relaties in het **Engels**.
- **Bedragen en Percentages:** Gebruik `Decimal` (of `Numeric` met voldoende precisie, bijv. 10,2 voor bedragen en 10,6 voor percentages/FTE) in plaats van `Float` of `Int` om afrondingsfouten in de payroll te voorkomen.
- **Tijdlijnen Logica:** Bij het toevoegen van een nieuwe mutatie (bijv. nieuw salaris), moet de applicatielaag automatisch de `endDate` van het voorgaande actieve record op de dag vóór de nieuwe `startDate` zetten.
- **Relaties:** Al deze entiteiten hebben een Foreign Key (`contractId`) die wijst naar het `EmploymentContract`, **niet** direct naar de `Employee`.

---

## 3. Enums

Definieer de volgende Enums in de database/ORM:

- `ContractType`: INDEFINITE, DEFINITE, EXTERNAL
- `ScheduleType`: HOURS_PER_DAY, HOURS_AND_AVG_DAYS, HOURS_AND_SPECIFIC_DAYS, TIMES_PER_DAY
- `SalaryPaymentType`: PERIODIC_FIXED, HOURLY_VARIABLE
- `SalaryFrequency`: MONTHLY, FOUR_WEEKLY
- `SalaryBasis`: MANUAL, MINIMUM_WAGE, CUSTOM_SCALE, CAO_SCALE

---

## 4. Datamodel (Entiteiten)

### 4.1 EmploymentContract (Het Contract)
De wettelijke en overkoepelende afspraak. Bevat de Belastingdienst Inkomstenverhouding (IKV) gegevens.
**Relatie:** `Employee` (1) -> `EmploymentContract` (0..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Foreign Key | Relatie naar `Employee.id`. |
| `sequenceNumber` | Int | Required | Volgnummer van het contract (1, 2, 3...). |
| `contractType` | Enum `ContractType`| Required | Bepaalde tijd, onbepaalde tijd, etc. |
| `startDate` | Date | Required | Ingangsdatum van dit specifieke contract. |
| `endDate` | Date | Optional | Einddatum (Leeg = onbepaalde tijd). |
| `probationEndDate`| Date | Optional | Einddatum proeftijd. |
| `seniorityDate` | Date | Required | "Datum in dienst voor dienstjaren". Vaak gelijk aan startDate, soms afwijkend na overname. |
| `ikvType` | String | Required | Soort Inkomstenverhouding (bijv. "Arbeidsovereenkomst"). Kan evt. Enum worden. |
| `ikvNumber` | Int | Required | IKV-nummer voor de loonaangifte. |
| `isPrimaryIkv` | Boolean | Required, Def: true | Is dit de primaire inkomstenverhouding? |
| `reasonStart` | String | Optional | Reden aanleg (bijv. "Nieuw dienstverband"). |
| `reasonEnd` | String | Optional | Reden einde (bijv. "Einde contract"). |
| `documentUrl` | String | Optional | URL/Pad naar de getekende PDF. |

### 4.2 EmployeeOrganization (Tijdlijn 1: Organisatie)
Tijdsgebonden opslag voor functie en afdeling.
**Relatie:** `EmploymentContract` (1) -> `EmployeeOrganization` (1..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `contractId` | UUID | Foreign Key | Relatie naar `EmploymentContract`. |
| `startDate` | Date | Required | Vanaf wanneer geldig? |
| `endDate` | Date | Optional | Tot wanneer geldig? (Leeg = Huidig). |
| `jobTitle` | String | Required | Functienaam (Kan later FK naar JobPosition worden). |
| `department` | String | Optional | Afdeling (Kan later FK naar Department worden). |
| `costBearer` | String | Optional | Kostendrager. |

### 4.3 CostCenterAllocation (Verdeling Arbeidskosten)
Sub-tabel van `EmployeeOrganization` om kosten procentueel te verdelen over kostenplaatsen.
**Relatie:** `EmployeeOrganization` (1) -> `CostCenterAllocation` (1..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `organizationId` | UUID | Foreign Key | Relatie naar `EmployeeOrganization`. |
| `costCenter` | String | Required | Naam of ID van de kostenplaats. |
| `percentage` | Decimal | Required | Percentage (bijv. 60.00). Som van alle records onder 1 orgId moet 100% zijn. |

### 4.4 EmployeeLaborCondition (Tijdlijn 2: CAO)

> **Actuele doelregel vanaf 2026-08-05:** een dienstverband heeft één vaste CAO. De oudere effective-dated `EmployeeLaborCondition`-beschrijving hieronder is historische implementatiecontext. Een CAO-wijziging binnen het doelmodel sluit het bestaande dienstverband en maakt een nieuw dienstverband aan; de API en database mogen de CAO op een bestaand dienstverband niet wijzigen.
Tijdsgebonden opslag van de toepasselijke CAO of bedrijfsregeling.
**Relatie:** `EmploymentContract` (1) -> `EmployeeLaborCondition` (1..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `contractId` | UUID | Foreign Key | Relatie naar `EmploymentContract`. |
| `startDate` | Date | Required | Ingangsdatum CAO toepassing. |
| `endDate` | Date | Optional | Einddatum CAO toepassing. |
| `conditionGroup` | String | Required | Naam CAO / Arbeidsvoorwaardengroep (bijv. "CAO Metalektro"). |

### 4.5 EmployeeSchedule (Tijdlijn 3: Rooster)
Tijdsgebonden opslag van uren en werktijden. Afhankelijk van de `scheduleType` enum worden specifieke velden gebruikt.
**Relatie:** `EmploymentContract` (1) -> `EmployeeSchedule` (1..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `contractId` | UUID | Foreign Key | Relatie naar `EmploymentContract`. |
| `startDate` | Date | Required | Vanaf wanneer geldt dit rooster? |
| `endDate` | Date | Optional | Tot wanneer geldig? |
| `scheduleType` | Enum `ScheduleType`| Required | Bepaalt welke detail-velden verwacht worden. |
| `startWeek` | Int | Required, Def: 1 | Startweek cyclus (handig bij meer-wekelijkse roosters). |
| `avgDaysPerWeek` | Decimal | Required | Gemiddeld aantal werkdagen per week. |
| `avgHoursPerWeek`| Decimal | Required | Gemiddeld aantal werkuren per week (bijv. 40.00). |
| `partTimeFactor` | Decimal | Required | Deeltijdfactor/Percentage (bijv. 1.0 of 100%). |
| `timeForTimeAccrual`| Decimal| Required, Def: 0 | Vaste opbouw Tijd-voor-Tijd uren (TvT). |
| `mondayHours` | Decimal | Optional | Uren op Maandag (bijv. 8.00). |
| `tuesdayHours` | Decimal | Optional | Uren op Dinsdag. |
| `wednesdayHours` | Decimal | Optional | Uren op Woensdag. |
| `thursdayHours` | Decimal | Optional | Uren op Donderdag. |
| `fridayHours` | Decimal | Optional | Uren op Vrijdag. |
| `saturdayHours` | Decimal | Optional | Uren op Zaterdag. |
| `sundayHours` | Decimal | Optional | Uren op Zondag. |

### 4.6 EmployeeSalary (Tijdlijn 4: Salaris)
Tijdsgebonden opslag van de beloning.
**Relatie:** `EmploymentContract` (1) -> `EmployeeSalary` (1..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `contractId` | UUID | Foreign Key | Relatie naar `EmploymentContract`. |
| `startDate` | Date | Required | Ingangsdatum van dit salaris. |
| `endDate` | Date | Optional | Einddatum van dit salaris. |
| `paymentType` | Enum `SalaryPaymentType`| Required | Periodiek (Vast) of Per Uur (Variabel). |
| `paymentFrequency`| Enum `SalaryFrequency`| Required | Maandelijks of 4-wekelijks uitbetaald. |
| `salaryBasis` | Enum `SalaryBasis` | Required | Bepaalt hoe het bedrag tot stand komt (Handmatig, Schaal, etc). |
| `fulltimeAmount` | Decimal | Optional | Voltijd Bruto Maandsalaris (Gevuld bij `MANUAL` periodic). |
| `hourlyRate` | Decimal | Optional | Bruto Uurloon (Gevuld bij `MANUAL` hourly). |
| `customScaleStepId`| UUID | Optional | FK naar `SalaryScaleStep` (Gebruikt bij `CUSTOM_SCALE`). |
| `caoScaleName` | String | Optional | Vrije tekstnaam CAO Schaal (Gebruikt bij `CAO_SCALE`). |
| `caoStepName` | String | Optional | Vrije tekstnaam CAO Trede (Gebruikt bij `CAO_SCALE`). |

### 4.7 SalaryScale & SalaryScaleStep (Stamtabellen Interne Loonschalen)
Worden gebruikt om dropdowns in de applicatie te vullen voor interne loongebouwen.

#### 4.7.1 SalaryScale (De Schaal)
| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `name` | String | Required | Naam van de schaal (bijv. "Schaal 1", "Directie"). |
| `description` | String | Optional | Optionele beschrijving. |

#### 4.7.2 SalaryScaleStep (De Trede)
**Relatie:** `SalaryScale` (1) -> `SalaryScaleStep` (1..*)
| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `scaleId` | UUID | Foreign Key | Relatie naar `SalaryScale`. |
| `stepName` | String | Required | Naam van de trede (bijv. "Trede 1", "0 Jaren"). |
| `fulltimeAmount` | Decimal | Required | Het Bruto Voltijd bedrag dat hoort bij deze trede. |

## 5. Goedgekeurde detail- en mutatiebesluiten (2026-07-15)

- Ieder dienstverband heeft een eigen detailroute met overzicht, basis/IKV, arbeidsvoorwaarden, rooster, salaris, organisatieplaatsing, kostenverdeling en historie.
- De medewerkerkaart staat bovenaan en bevat foto, contactgegevens, externe profielkoppelingen, compacte/uitgebreide modus en ruimte voor toekomstige modules zoals documenten, verlof, verzuim en gesprekken.
- Iedere tijdlijnmutatie heeft een ingangsdatum, reden en standaard bevestigingspopup. Een datum in het verleden toont een expliciete TWK-waarschuwing over salaris, verlof, pensioen, aangiften en correcties.
- Een tussenliggende mutatie splitst alleen het geraakte tijdblok; reeds geplande latere blokken blijven behouden.
- Correcties verwijderen uitsluitend het blok met de verste toekomstige ingangsdatum. De gebruiker werkt zo stap voor stap terug; het enige resterende blok kan niet worden verwijderd.
- Een kostenverdeling is één atomair tijdblok en telt exact op tot 100%.
- Samenhangende gevolgen worden deterministisch geadviseerd. Per gevolg kiest de gebruiker `direct meenemen`, `later opvolgen` of `niet van toepassing`; latere acties worden als gestructureerde follow-up bij het wijzigingspakket opgeslagen.
- Ketenadvies informeert en blokkeert niet. Onvolledige historie, cao-afwijkingen en uitzonderingen blijven menselijke controle vereisen; doorgaan bij een waarschuwing vraagt een vastgelegde motivering.
- Regelversies zijn datumgebonden: `NL_CHAIN_2020` voor de huidige 3-contracten/3-jaarregel met normale onderbreking van meer dan zes maanden, en `NL_CHAIN_2028` voor het vanaf 1 januari 2028 aangekondigde regime met een onderbreking van drie jaar. Bronnen: [Rijksoverheid huidige ketenregeling](https://www.rijksoverheid.nl/vraag-en-antwoord/arbeidsovereenkomst-en-cao/wanneer-verandert-mijn-tijdelijke-arbeidscontract-in-een-vast-contract), [Rijksoverheid Wet meer zekerheid flexwerkers](https://www.rijksoverheid.nl/actueel/nieuws/2026/07/08/meer-zekerheid-voor-mensen-met-een-flexcontract) en [Eerste Kamer, stemming 7 juli 2026](https://www.eerstekamer.nl/verslag/20260707/verslag).
