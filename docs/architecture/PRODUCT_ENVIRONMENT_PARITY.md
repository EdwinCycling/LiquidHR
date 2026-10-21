# Product Environment Parity

**Status:** LEIDEND product- en architectuurbesluit<br>
**Besluitdatum:** 2026-10-17<br>
**Scope:** alle bestaande en toekomstige LiquidHR-modules

## Besluit

LiquidHR wordt met gecontroleerde fictieve gegevens in TEST ontwikkeld en geaccepteerd. TEST is een eigenschap van de omgeving en gegevensherkomst, niet van de productfunctionaliteit. Dezelfde productcode, klantgerichte werking, rechten en normale gebruikersworkflow zijn daarom geschikt voor TEST en Production.

Deze regel geldt voor Core HR, Workforce, Talent, Salaris/Payroll, Pensioen, CAO, fiscale dossiers, IKV, documenten, ESS/MSS, AI en modules die later worden toegevoegd. Hij staat boven oudere productontwerpen voor zover die een afwijkende TEST-klantworkflow, TEST-only productfunctie of TEST-label in klantuitvoer voorschrijven. Historische acceptance- en deliveryrapporten blijven onveranderd en zijn bewijs van hun eigen run.

## Begrippen en gegevensherkomst

- **Omgeving:** de geïsoleerde uitvoering en haar credentials, integraties en externe-actiesafety, zoals lokaal, TEST of Production.
- **Gegevensherkomst:** of opgeslagen data fictief, echt, door een werkgever opgegeven, door een bron aangeleverd of onafhankelijk juridisch gevalideerd is.
- **Productflow:** de reguliere gebruikershandeling met de bestaande productservices, normale rollen/rechten, opgeslagen administratiegegevens en normale auditregels.
- **Interne tooling:** afgeschermde provisioning-, fixture-, testlogin- en acceptatiehulpmiddelen. Deze mogen gecontroleerde data voorbereiden, maar zijn geen klantworkflow en bewijzen op zichzelf niet de productflow.

Een bedrijfsadministratie zoals **Mars BV** is in Core TEST een gewone administratie. Als een fictieve naam of medewerkernaam expliciet is gekozen en als normale bedrijfsdata is opgeslagen, mag die naam op de gebruikelijke plekken worden getoond. De applicatie verzint geen fictieve bedrijfsdata om een berekening of wettelijke uitkomst aannemelijk te laten lijken.

## Normale productwerking

1. Normale HR Admin-, Payroll Admin-, Manager- en Employee-handelingen verlopen via dezelfde productroutes, services, serverautorisatie, audit en lifecycle in iedere omgeving.
2. Medewerkers, dienstverbanden, fiscale verklaringen, IKV's, pensioenregelingen, salarisregels, documenten en andere klantdata worden via de gewone instellingen en producthandelingen beheerd.
3. Toepasselijke pensioenregelingen kunnen op basis van de werkgeverconfiguratie en geldende selectiecriteria aan werknemers worden gekoppeld. Ontbrekende of ambigue vereisten worden gemeld of ter beoordeling aangeboden; de applicatie leidt geen ontbrekende juridische parameters af.
4. Er bestaat geen vereiste fixture-identiteit, fixtureclaim, synthetisch medewerkertype of speciale TEST-only route voor normale productfunctionaliteit. Een featureflag die uitsluitend interne tooling beveiligt, blijft uit de gewone productflow.
5. Dezelfde geldige bron- en parametercombinatie doorloopt dezelfde productlogica en documentopmaak. Verschillen in uitkomst komen uit werkelijk verschillende opgeslagen data of expliciet geversioneerde regels, niet uit een verborgen omgevingstak.

## Klantgerichte schermen en documenten

Normale klantgerichte schermen, loonstroken, exports en documenten beschrijven de opgeslagen bedrijfsdata en functionele status. Ze gebruiken gewone zakelijke termen zoals medewerker, dienstverband, pensioenregeling, salarisberekening, loonstrook, concept, gecontroleerd en definitief.

Toon daar niet enkel vanwege de omgeving interne termen zoals *synthetische medewerker*, *testregeling*, *DEMO-fixture*, *TEST-payroll*, *fixturebron* of *technische acceptatiestatus*. Voeg geen TEST-, fixture- of synthetisch-watermerk of disclaimer aan PDF's toe enkel omdat de render in TEST plaatsvindt. Een status zoals **Concept** blijft zichtbaar wanneer het document of de berekening werkelijk de conceptstatus heeft.

Een gekozen fictieve bedrijfsnaam, medewerkernaam of scenario-invoer is normale opgeslagen data en mag dus worden weergegeven. Vermom zulke waarden niet als echte feiten en verzin geen aannames. Werkgeveropgegeven parameters zijn niet automatisch juridisch gevalideerd; een geslaagde berekening toont op zichzelf geen wettelijke compliance aan.

## Audit, provenance en interne documentatie

Verberg interne metadata niet uit de audittrail. Sla omgevingsidentiteit en relevante data-/bronherkomst betrouwbaar op naast actor, administratie, versie, effectieve datum, bron-/resultaatreferenties, hashes, controles en lifecycle-events, voor zover het domein dit vereist. Deze metadata zijn standaard niet klantzichtbaar.

Interne technische documentatie en acceptatierapporten benoemen expliciet:

- TEST versus Production en de exacte bewezen omgeving;
- fictieve versus echte gegevens en hun bron;
- door de werkgever opgegeven parameters versus juridisch gevalideerde regelingen;
- een technisch geslaagde berekening versus aangetoonde wettelijke compliance;
- lokale, remote, browser-, release- en productiegeschiktheidsbewijzen als afzonderlijke claims.

Behoud bestaande hashes, controles, auditrecords en immutable historie. Een technische fout of ontbrekend wettelijk bewijs wordt niet met een label, fallback, nulwaarde of gefingeerde lifecycle opgelost.

## Omgevingsgrenzen voor externe acties

TEST biedt geen echte aangiften, SEPA-betalingen, externe loonstrookdistributie of koppelingen met Production-systemen aan. Blokkeer zulke acties fail-closed in de omgeving-, credentials-, integratie- of distributielaag, ook wanneer de normale gebruikersflow beschikbaar blijft. Toon waar nodig een begrijpelijke functionele reden voor een niet-beschikbare externe actie; verander daarvoor de inhoud van een loonstrook of andere klantdocumenten niet.

Een technisch TEST-document blijft in de gecontroleerde omgeving. De distributie- en exportgrens voorkomt dat het als authentiek betaaldocument buiten die omgeving wordt uitgegeven. Deze veiligheidsgrens wordt niet nagebootst met een zichtbaar TEST-watermerk in de PDF.

## Toegestane interne hulpmiddelen

Beveiligde, interne fixture- en provisioningtools mogen blijven bestaan voor deterministische tests, acceptatie en gecontroleerde voorbereiding van TEST-data. Ze zijn afgeschermd van klantnavigatie en normale autorisaties, en mogen de reguliere businessservices niet omzeilen voor een geaccepteerde producthandeling. De interne featureflag `PENSION_TEST_FIXTURES_ENABLED` en speciale claims zijn hoogstens provisioning-/acceptatievoorwaarden; ze zijn nooit voorwaarden voor normale pensioeninstellingen of werknemerskoppeling.

Een fixture mag een standaard productflow ondersteunen. De feature-acceptatie voert daarna de gewone workflow uit met reguliere rollen en leest de normale opgeslagen uitkomst terug.

Een privé connector- of protocolproef mag bewust alleen op TEST worden geactiveerd zolang die nog geen klantfeature is. Leg die scope expliciet vast; gebruik de proefroute niet als normale productworkflow of als reden om dezelfde klantfeature in TEST anders te laten werken. Een product- of veiligheidsfunctie die in alle omgevingen gesloten blijft totdat een vereiste autorisatie-/bevestigingsgrens is gebouwd, is een readinessbesluit en geen omgevingsverschil.

## Verboden antipatterns

- Normale medewerkers-, contract-, IKV-, pensioen- of payrollhandelingen alleen via een testwizard, fixture-runner of speciale claim beschikbaar maken.
- Klantfunctionaliteit verbergen of aanpassen omdat `NODE_ENV`, een TEST-label of een synthetische identiteit actief is.
- Op normale schermen of PDFs TEST-, fixture-, demo- of synthetisch-labels tonen op basis van de omgeving.
- Dezelfde uitkomst of legaliteitsclaim voor fictieve input presenteren alsof die werkgeverdata of juridisch advies bewijst.
- Testpresentatie gebruiken als enige bescherming tegen verzending, betaling of externe integratie.
- Normale rechten, audit, hashes of lifecycle overslaan voor acties op TEST.

## Verplichte Definition of Done

Een productfeature is pas gereed wanneer de toepasselijke punten zijn aangetoond:

1. Dezelfde productcode en gebruikersworkflow werken voor TEST en zijn geschikt voor Production.
2. Klantgerichte schermen en documenten lekken interne omgevings- of fixtureherkomst niet.
3. Normale serverrechten, auditregels, statuslifecycle, bronverantwoording, hashes en controles gelden.
4. Echte externe productieacties zijn in TEST veilig geblokkeerd aan de omgevings-/distributiegrens.
5. De normale productflow is daadwerkelijk getest met passende HR Admin-, Payroll Admin-, Manager- of Employee-rechten; fixture-provisioning alleen telt niet.
6. Benodigde klantgegevens zijn via normale productinstellingen te beheren.
7. Werkgeveropgegeven gegevens en juridische validatie zijn afzonderlijk herkenbaar; technische berekeningssucces wordt niet als compliancebewijs gepresenteerd.

## Canonieke verwijzingen

- Instructies en documentrouter: [`AGENTS.md`](../../AGENTS.md), [`AA-README.md`](../AA/AA-README.md), [`AA-REQ.md`](../AA/AA-REQ.md), [`AA-TEST.md`](../AA/AA-TEST.md) en [`AA-ROAD.md`](../AA/AA-ROAD.md).
- Payroll: [`AA-PAYROLL.md`](../AA/AA-PAYROLL.md), [`PAYPENS01`](../requirements/payroll/PAYPENS01-CORE-PENSION-PRODUCT-DESIGN.md) en [`PAYDOC01`](../requirements/payroll/PAYDOC01-PAYSLIP-ANNUAL-STATEMENT-AND-DESIGNER.md).
- UX, ESS/MSS en documentbeheer: de relevante requirements wijzen naar dit besluit en behouden hun eigen domeinbeveiliging.
