# CAO-BENCH02 — Twee cao's, vier bestaande testprofielen en onafhankelijke payrollcontrole

**Status:** gekozen uitvoeringsplan, nog niet geïmplementeerd/geaccepteerd.  
**Datum onderzoek:** 2026-10-01  
**Volgorde:** na PAYLAB04 (actuele code/evidence eerst lezen), voortbouwend op CAO-BENCH01, AA-PAYROLL en officiële 2026 NL rule packages.  
**Doel:** Codex configureert twee echte publieke cao's zelf vanuit actuele officiële bronmaterialen, laat de resulterende arrangement packages door de bestaande Payroll Component Graph Engine gebruiken en bewijst de afgebakende werking op vier bestaande, gescopeerd gelezen testprofielen. Geen handmatige datainvoer door Edwin.

## 1. Cao's

1. **Kinderopvang 2025–2026**: moederpakket plus afzonderlijke versies/bijlagen/tussentijdse besluiten; salaris-/deeltijdtabellen, vakantietoeslag en eindejaarsuitkering, werkurentoeslagen, kilometervergoeding, afhankelijk van bewezen inputs. Correcte september 2026 loonschaalwijziging en juli 2026 vergoedingsbesluit testen.
2. **Retail Non-Food 2026–2027 — branchemodule Mode**: één variant van de overkoepelende cao; nog niet alle andere branchemodules. Per januari en juli 2026 versioned tabellen, deeltijd-/uurloon, functie-/schaal-/stapselectie en toepasselijke uurtoeslagen met conflictregel: bij overlap alleen de voor medewerker gunstigste van de tegelijk toepasselijke toeslagregelingen, niet blind cumuleren. Een specifieke e-commerce-uitzondering bestaat in art. 7.2; neem alleen in scope indien de fixture en regels die expliciet ondersteunen.

Officiële bronnen en bronnenversies bij uitvoering opnieuw checken:
- https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026
- https://www.kinderopvang-werkt.nl/alles-over-de-cao-kinderopvang/tussentijdse-cao-besluiten
- https://www.inretail.nl/kennisbank/personeel/arbeidsvoorwaarden-en-cao/cao-retail-non-food
- officiële juli-2026 consolidatietekst: https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf
- https://www.inretail.nl/kennisbank/personeel/loontabellen-cao-retail-non-food-per-1-januari-2026/
- https://www.inretail.nl/kennisbank/personeel/loontabellen-cao-retail-non-food-per-1-juli-2026/

**Niet 'twee volledig ondersteunde cao's' claimen** wanneer alleen een expliciet subset aan payrollregels is gevalideerd. Output moet per cao een artikel-naar-regel mapping en coverage matrix `SUPPORTED / PARTIAL / UNSUPPORTED / OUT_OF_SCOPE` bevatten.

## 2. Read-only onderzoek huidige Core- en Payroll-Lab-databases

De volgende feiten zijn op 2026-10-01 **read-only gecontroleerd**, zonder employee-PII te exporteren of te wijzigen.

Supabase Core LiquidHR project `wnpfloqpjvaacobppbpk`:
- `departments`, `employee_organizations`, `department_management`;
- `employees`, `employments`, `employment_contracts`, `employment_salaries`, `employment_schedules`;
- `employment_income_relationships`, `labor_condition_sets`, `labor_condition_salary_structures`, `salary_structures` en scale-tabellen bestaan;
- `employment_contracts.labor_condition_set_id` verwijst naar de Core-arbeidsvoorwaardenset; `employment_salaries` bevat schaal-/tredevelden;
- `labor_condition_sets` bevatten in Planeten/Jupiter, Mars, Mercurius elk een actief bestaand `COMPANY`-pakket, maar dit is **niet** hetzelfde als een versioned berekenbaar arrangement-/cao-package;
- `payroll_import_income_relationships.cao_code` is import-/staginginformatie, **geen** afdoende operationele cao-toewijzing;
- `employment_income_relationships` bevat 89 links in de getelde database; het definitieve CONTROL02/Core IKV-contract blijft apart te accepteren.

**Testafdeling:** HR-groep `Planeten`, department code `RICH-02`, naam `Test Operations`.

September 2026, bestaande linked records:
- in de gehele afdeling zijn 13 medewerkers gekoppeld, verspreid over juridische administraties;
- in **Jupiter BV** zijn **4 onderscheiden testprofielen** met bestaande Employment, salarisrecord, rooster, IKV-link én gekoppelde arbeidsvoorwaardenset;
- Jupiter-deelgroep heeft 1 toegewezen direct manager met gekoppelde `auth_user_id` en 2 formele department-management-toewijzingen; dit is **geen** bewijs dat de identiteit reeds geldige Payroll-salarisrechten bezit. Test toegang met bestaande normale autorisatie, creëer geen nieuwe managerrole/account;
- in **Mercurius BV** zijn 5 complete profielen, maar de daar geconstateerde direct manager heeft geen aangetoonde auth_user-link. Jupiter is daardoor de praktische eerste benchmarkcontext;
- dit zijn schema-/datacontroles, **geen** volledige read-through-acceptatie van de PAYLAB01 Core Payroll source adapter.

Supabase Payroll Lab project `jhgeriucbkfarxiudzfy`:
- goedgekeurde `PAYLAB GC-NL-001 — Jupiter BV` administratiekoppeling aanwezig en `ACTIVE` / `capability_enabled=true`;
- `customer_component_versions` bestaat inmiddels met ownership/provenance, scopes en JSON-definities;
- `payroll_administrations`, `source_snapshots`, `calculation_input_sets` bestaan;
- op 2026-10-01 zijn geen complete gepubliceerde centrale CAO arrangement packages en contract-/employee-level package assignments in deze schema-inventaris aangetoond.

**Conclusie:** op Core-contractniveau kan een contract één labor-condition set selecteren. Dit bewijst **niet** dat één cao al integraal als versioned Payroll ArrangementPackage aan een medewerker kan worden gekoppeld en berekend. Daarvoor is de nieuwe package-/assignment-/compositionlaag nodig.

## 3. Vier testprofielen in één afdeling

Werk veilig vanaf **vier bestaande Jupiter BV / Planeten / Test Operations testprofielen**; zoek hun opaque IDs via bestaande server-side scopegecontroleerde Core-services en inspecteer of hun dataset daadwerkelijk synthetisch is. Bepaal geen identiteit op basis van een alleen op naam veronderstelde teststatus.

Maak per profiel een afzonderlijke, **synthetische en gepseudonimiseerde** canonieke kopie in Payroll Lab. Gebruik géén echte naam, BSN, bankrekening, adres, privécontact of andere onnodige Core-PII in fixtures, repository of output. Leg de actuele bestaande contract-/salaris-/roosterwaarden veilig vast als pinned brondata waar nodig en label afwijkingen naar cao-conforme benchmarkwaarden als expliciete **scenario-overrides**, nooit als bestaande contractwaarheid.

Vier benchmarkpersona's:
- K1: Kinderopvang, fulltime maandloon, schaal/trede conform gekozen officiële versie;
- K2: Kinderopvang, parttime + één duidelijk onderbouwde werkurentoeslag;
- R1: Retail Non-Food Mode, reguliere werkzaamheden, juiste schaal/trede en July-2026 tabel;
- R2: Retail Non-Food Mode, parttime + avond-/zondag-/overwerkinterval waarvoor overlappende toeslagregels onafhankelijk zijn uitgetest.

Toewijzing is **per synthetic source employment/package assignment**, niet als ongedifferentieerde cao op de hele tenant of afdeling. Een tenant/administratie kan dus meerdere arrangement packages bevatten zonder dat werknemers de verkeerde cao erven. Eén employment mag niet ambigu twee concurrerende primaire arbeidscao's tegelijk toepassen; afzonderlijke fondsen/pensioenregelingen kunnen later als afzonderlijk, compatible package worden toegevoegd.

**Juridische kanttekening:** dat twee cao's in één fictieve Jupiter-benchmarkadministratie worden getest is uitsluitend technische testdata en geen oordeel dat beide cao's juridisch gelijktijdig op de daadwerkelijke onderneming of werknemers van toepassing zijn. Controleer later echte cao-werkingssfeer vóór live-toewijzing.

## 4. Codex-verantwoordelijkheid en subagents

Codex krijgt de volledige bron→configuratie→uitvoering→review-opdracht. Edwin voert geen salaristabellen, componentpercentages of mappings handmatig in.

**Alle gespecialiseerde subagents = LUNA MAX; de hoofdagent orkestreert.** Geen stilzwijgende fallback. Verdeel minstens:
- Bron-/cao-analist Kinderopvang;
- Bron-/cao-analist Retail Non-Food Mode;
- Generieke component-/arrangement-package implementatie;
- Source-adapter / scoped test-fixture integration;
- Onafhankelijke per-cao compliance oracle, los van productiecalculators;
- Security/persistence/manager-scope reviewer;
- UI/UX en browseracceptatie indien schermen geraakt.

Laat beide cao-analisten elkaar niet kopiëren en laat de oracle niet de productiecalculator als expected oracle gebruiken. Sla bronversie/sha/pagina/artikel/ingangsdatum naast de config op. Productiecalculator kan niet tegelijk zijn eigen onafhankelijke waarheid leveren.

## 5. Uitvoering: kleinste generieke oplossing

1. Inventariseer actuele PAYLAB04 Component Library, bestaande rule packages, Core contracts en PAYLAB01 source adapter; lees nieuwste AA-branch.
2. Definieer/implementeer het kleinste `ArrangementPackage` / `PackageAssignment` / `CalculationCompositionSnapshot`-contract (zie CAO-BENCH01), met module- en effectieve versies, conflictvalidatie, bronmetadata en gepinde hashes. Statische SYSTEM-registered fiscale code blijft in de bestaande gecontroleerde registry; DB krijgt geen willekeurige executable broncode.
3. Laat Codex de twee officiële bronsets lezen en parameter-/tabeldata en componentconfiguraties **zelf** samenstellen. Geen hardcoded werknemer-ID-to-cao-switch, geen 'als Retail dan deze salarisfunctie' in generic engine.
4. Lees de vier bronprofielen via existing Core domain/service auth-boundary. Als dit niet aantoonbaar veilig werkt, gebruik synthetische canonical fixtures en rapporteer live Core-sourceproof als OPEN; geen Core-write of auth-bypass.
5. Maak vier veilige synthetic Lab assignment snapshots (K1/K2/R1/R2); bestaande Core CONTRACTS, COMPANY labor sets, employment salary/schedule en rolgegevens volledig ongemoeid laten.
6. Bevries per profile `CalculationInputSet` inclusief gepinde `NL-PAYROLL-2026`, cao-package+moduleversies en exact per-werkgever/employee/period resolved composition. Draai waar in scope correcte bruto-cao-componenten en de reeds geaccepteerde NL-fiscale rule; **geen** netto salaris claimen als pension/Zvw/other taxbase ontbreekt.
7. Maak onafhankelijke verwachtingstabellen per cao + 2026 versiegrens (Kinderopvang augustus vs september, Retail Mode juni vs juli) en toets minimum schaal, deeltijd en overlapping/exceptionregels. Test per profiel terugkerende run en exact hashpariteit.
8. Test dat gewijzigde K1 toewijzing of R2 toeslag **niet** onbedoeld K2/R1 of andere tenant/administratie raakt. Test expliciet dezelfde cao bij twee profielen.
9. Evalueer manager: bestaande authlinked manager in Jupiter Test Operations mag alleen HR/Payroll-salarisdetails zien als de **bestaande** permissionmatrix die daadwerkelijk toelaat. Anders verwacht server-side deny; verander geen rollen.
10. Rapporteer een component-coverage matrix en de ontbrekende capabilities met heldere oorzaak (regels, brondata, Core/IKV, rekenengine, pension, VCR, output) en stel de volgende bounded slice voor.

## 6. Golden acceptance

- 2 echte brongebonden packages, waaronder Retail-variant Mode, verschillende versie-/module-identiteiten.
- 4 gescheiden safe synthetic employee cases van 1 Core testafdeling, twee per cao, dezelfde juridisch-fictieve testwerkgever/context.
- Bronwijzigingsgrenzen getoetst zonder actieve oude package te muteren; historische berekeningen stabiel.
- Elke uitvoer gebruikt uitsluitend zijn eigen resolved cao-/NL-rulecompositie; geen employee-ID-conditionals.
- Opgegeven uren, salaris/parttimepercentage en schaal-/tredegegevens komen uit gepinde source snapshot of als verklaarde synthetic scenario-overrides.
- Onafhankelijke gross/cao golden cases en aparte fiscaal-netto-acceptatie **uitsluitend voor bewezen en complete fiscale scope**.
- Bij missing pension, sectorpremie, bijzondere beloning, multi-IKV etc. = EXPLICIT PARTIAL/UNSUPPORTED; geen schijnexacte eindloonstrook.
- Eén manager-permission-positive als bestaande autorisatie dit ondersteunt, anders manager-negatives; onafhankelijke forged scope-/cross-admin-tests.
- Targeted tests, typecheck, changed-area lint, client-secret scan, i18n waar UI geraakt, opt-in Lab readback en geauthenticeerde browseracceptatie.
- Geen full test suite tijdens normale feature; geen push/merge/deploy zonder afzonderlijk besluit.
- Stop bij noodzakelijke Core-schemawijziging, gewijzigde CONTROL02-contracten, security/PII risico of destructieve actie.

## 7. Positionering

De twee CAO's worden **intern als benchmark/testpakket** geaccepteerd met zichtbare `SupportedRules` en `UnsupportedRules`. Zij mogen pas commercieel als door LiquidHR ondersteunde cao's worden geadverteerd nadat volledige relevante payroll-/juridische/actualiteitsdekking inclusief pensioen/fondsen, cumulatieven, output en onafhankelijke reviews is aangetoond.

Definitieve centrale cataloguspublicatie en automatische klantupgrade worden als eigen Control/inrichtingapp-slice gepland; deze benchmark bewijst eerst herbruikbare package-/assignment-/composition-contracten met echte scenario's.

## 8. Besluit na bron-/schemaonderzoek: loonmodellen en administratie→dienstverband

**Officiële bronnen opnieuw gecontroleerd op 2026-10-01:**
- Kinderopvang heeft functiematrix → salarisschaal → salarisnummer → effectief maandbedrag, incl. tabel van 1 september 2026 (cao art. 5.1–5.3 en bijlage 2): https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen
- Retail Non-Food 2026–2027, module Mode, heeft functiegroepen A–I, leeftijd-/ervaringsjaar- en schaaltrede-afhankelijke **uurlonen**, plus voor bepaalde medewerkers een beoordelings-/extra loongebouw en feitelijk loon boven tabelmaximum (art. 6.2 en bijlage 1a/1b): https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf. Let op: de tekst bevat een bijzondere situatie zonder reguliere ervaringsjaar-tredeverhoging in 2026; importeer niet alleen de matrix, maar ook de geldige overgangs- en verhogingsregels.

**Geen aanname dat iedere cao schaal + vaste treden heeft.** Het generieke salary policy contract moet minimaal ondersteunen:
- `DISCRETE_SCALE_STEP`: functie/functiegroep, schaal, salarisnummer/trede/ervaringsjaar, effectieve tabelwaarde, afgesproken fulltime urenbasis en payrollperiode;
- `OPEN_SALARY_BAND`: functie/schaal, min/max en individuele overeengekomen beloning binnen toepasselijke grenzen, evt. relatieve salarispositie;
- `FREELY_NEGOTIATED`: vrij bedrag zonder tabel, maar nog steeds wettelijke en eventueel toepasselijke collectieve garanties beoordelen;
- voor cao's zoals Retail: `ACTUAL_PAY` versus `TABLE_GUARANTEE` onderscheiden, inclusief boven-schaal- en overgangssituaties;
- keuze uur-/maandbasis, WML/cao-ondergrens en deeltijdberekening volgens de **specifieke** cao, niet één universeel maand-omrekengetal.

**Gewenste administratieve configuratie:**
1. Bevoegde HR Admin configureert per **juridische administratie** een gescopeerde `AdministrationArrangementAvailability`: welke gepubliceerde cao-/branchemodules en/of bedrijfseigen primaire arrangementen selecteerbaar zijn, met hun geldigheid.
2. Elk relevant Employment krijgt binnen zijn administratie precies één **primaire loon-/arbeidsvoorwaardenregeling**: `COLLECTIVE_AGREEMENT` of `COMPANY_ARRANGEMENT` of expliciet `NO_CAO_WITH_STATUTORY_BASELINE` wanneer er juridisch geen cao geldt. Niet ieder dienstverband valt automatisch onder een cao; laat applicability/juridische werkingssfeer apart valideren.
3. Kies tijdens het Employment-aanmaakproces uitsluitend primaire regelingen die voor die administratie zijn geactiveerd. Leg de keuze gescopeerd, effectief gedateerd en auditeerbaar vast, met passende Core-ownership. Dezelfde administratie kan meerdere verschillende primaire regelingen beschikbaar stellen; niet twee primaire cao's tegelijk op één employment toepassen zonder later uit te werken expliciet juridisch conflictmodel.
4. Aanvullende compatibele pakketten (pensioen-/sectorfonds/bedrijfseigen aanvullende componenten) volgen een **separate scoped assignment**, niet een tweede primaire cao.
5. Zodra een employment zijn primaire arrangement heeft, wordt de *identiteit* in deze eerste productfase niet vrij wijzigbaar gemaakt; een ander primair arrangement tijdens hetzelfde employment = gereserveerd wijzigingsproces/impactreview voor later. Nieuwe **versies van hetzelfde** arrangement volgen wel hun juridische effective dates en gepinde payrollrun-compositie, zonder de oorspronkelijke assignment in-place te overschrijven.
6. Schaal/trede hoort bij het **employment salary segment**, niet globaal bij Employee of afdeling; nieuwe tabellen leveren geldende bedragen voor berekeningen, maar herschrijven geen historische salary segments of afgesloten runs.
7. Een Core `labor_condition_set_id` verwijst momenteel naar een eigen arbeidsvoorwaardenset; dit is niet bewezen dezelfde entiteit als de centrale versieerbare Payroll `ArrangementPackage`. Definieer een expliciete mapping/contract vóór live writes. PAYLAB-benchmark mag vooralsnog uitsluitend gescheiden synthetic assignments gebruiken. Geen Core-schema- of CONTROL02-wijziging zonder afzonderlijk besluit.

**Waarom dit nodig is:** de database bevat al `labor_condition_sets`, `employment_contracts.labor_condition_set_id`, `employment_salaries` met `salary_scale_id/salary_scale_step_id` en loonroute, en `employment_income_relationships`. Dit levert *inrichtingsaanknopingspunten* maar nog geen bewezen volledige gepubliceerde cao-packagecompositie of gebruik van packagevalues bij de engine. Codex moet de feitelijke actuele services inspecteren en aantonen dat selectie→salarisconfiguratie→snapshot→componentengine werkt.

## 9. Correctie testmedewerkeridentiteiten

Bij de eerste read-only inspectie was Planeten → Test Operations → Jupiter BV gekozen omdat daar **vier bestaande profielen met gekoppelde employment, salaris, rooster, IKV en arbeidsvoorwaardenset** zijn gevonden, plus een auth-linked manager.

**Vervolgvraag van Edwin:** zijn dit de medewerkers die eerder met voornaam en achternaam 'Test' zijn aangemaakt? **Nee, die gelijkstelling is niet onderbouwd.** Een afzonderlijke read-only telling op 2026-10-01 vond **11 employees met 'test' in de `birth_name` binnen Planeten, maar 0 in de eerder bekeken afdeling Test Operations**. Er is niet bevestigd waar alle elf medewerkers organisatorisch hangen of dat zij volledige payrollinput hebben. Koppel de eerdere 4 Jupiter-profielen niet stilzwijgend aan deze elf.

**Nieuwe selectievolgorde bij Codex-start:**
1. Zoek binnen de normale server-side geautoriseerde Core-testscope de **bedoelde bestaande voornaam + achternaam-'Test'** profielen en controleer via opaque IDs hun afdeling, juridische administratie, manager én completeness (employment, contract, salary, schedule, IKV, perioden).
2. Als vier geschikte bedoelde 'Test'-profielen veilig binnen één bestaande administratie/testafdeling met bruikbare manager beschikbaar zijn, gebruik juist die; persoonsgegevens alleen in beveiligde Core-services, externe benchmarkfixture uitsluitend synthetisch/pseudoniem.
3. Zo niet: behoud de vier technisch complete Test Operations/Jupiter-profielen uitsluitend als **gepseudonimiseerde synthetische Payroll Lab-baseline**, label expliciet dat dit NIET de eerdere 'Test'-achternaamprofielen zijn. Niet verplaatsen, hernoemen, van cao veranderen of een manager aanmaken in Core om een test te forceren.
4. Maak geen namen, BSN, IBAN of privécontact openbaar. Geen Core-write zonder afzonderlijke expliciete scopebeslissing. De gewenste UI-flow voor 'primaire cao per employment' wordt dan bewezen via synthetic Lab-assignments totdat het live Core-contract is aanvaard.

Deze correctie heeft voorrang op eerdere passages in dit document die de vier Jubilee/Jupiter-testprofielen zonder onderscheid als de bedoelde Test-medewerkers zouden kunnen laten lezen.

## 10. Besloten testset: 2 cao's + 1 bedrijfseigen open-bandenregeling

**Definitieve keuze van Edwin op 2026-10-01:** de benchmark omvat **drie primaire arrangementen** binnen de gescopeerde synthetische Payroll Lab-testadministratie. Dit zijn **twee cao's en één bedrijfseigen regeling**, dus nadrukkelijk niet drie cao's.

1. `KINDEROPVANG_2025_2026`: officiële Kinderopvang-cao; discrete salaris-/tredetabel plus selectief ondersteunde cao-componenten.
2. `RETAIL_NON_FOOD_MODE_2026_2027`: officiële Retail Non-Food, branchevariant Mode; relevante functiegroep/ervaringsjaar-/uurtabel plus selectief ondersteunde cao-componenten.
3. `COMPANY_OPEN_BANDS_V1`: door Codex uitdrukkelijk **synthetisch** ingericht bedrijfseigen pakket met **alleen salarisstructuur, open schalen/bandbreedtes en compa-ratio**; geen vaste treden, geen ongevraagde extra cao-/pensioen-/fondsregels. Algemene wettelijke fiscale SYSTEM-regels blijven vanzelf afzonderlijk van kracht waar ondersteund.

### Contract bedrijfseigen regeling

- Schalen hebben `code`, `name`, `effectiveFrom/To`, `basis` (fulltime bruto maand/uur, expliciet), `fullTimeHours`, `currency`, `min`, `referenceMidpoint`, `max`. Het midpoint mag expliciet configureerbaar zijn en hoeft niet altijd `(min + max) / 2` te zijn. Als het beleid een berekend midden voorschrijft, leg die formule/versie dan vast.
- Validatie: `min <= referenceMidpoint <= max`; alleen positieve, toepasselijke referentiewaarden. Andere minima/maxima alleen met expliciete bron- en beleidsvoorwaarden.
- Werknemerssalaris is **vrij binnen de gekozen schaalband**; géén trede. Bewaar daadwerkelijk afgesproken salaris apart van de band en het afgeleide referentiesalaris.
- **Compa-ratio = (individueel salaris op dezelfde fulltime/geannualiseerde basis / schaal-referenceMidpoint) × 100%.** Gebruik exact-decimal en expliciete display-rounding. Vergelijk nooit deeltijdloon rechtstreeks met een fulltime midden; normaliseer beide naar dezelfde uur-, maand- of jaarbasis. Gebruik voor de payrollberekening de juiste contractueel vastgelegde deeltijdloongegevens, niet de com­pa-ratio als salarisberekeningsgrondslag.
- Onderscheid `BELOW_MIN`, `WITHIN_BAND`, `AT_MIDPOINT`, `ABOVE_MAX` als uitlegbare, door policy te sturen controles. De policy beslist of buiten-band een blokkade of een expliciet goed te keuren uitzondering is; de simulatietest moet de uitkomst tonen.
- Geen automatische verhoging, periodiek, afgedwongen middenstap of fictieve juridische rechten afleiden uit compa-ratio. Dit is een beloningsanalyse- en inrichtingskengetal, niet een wettelijk verplichte cao-berekening.
- Publiceer minstens twee **versies** van een synthetische bedrijfsschaal om behoud van eerdere band-/ratio-berekeningen en effectieve datums te verifiëren, zonder bestaande gepinde payrollruns te herschrijven.

### Uit te voeren benchmarkmatrix

Plan **minimaal zes** gescheiden synthetische testscenario's (twee per arrangement):

| ID | Arrangement | Salarisinstelling | Controle |
| --- | --- | --- | --- |
| K1 | Kinderopvang | fulltime salarisnummer/schaal | officiële periodetabel en componenten |
| K2 | Kinderopvang | parttime salarisnummer + relevante toeslag | deeltijd en cao-grondslag |
| R1 | Retail Mode | functiegroep/ervaringsjaar | officiële uurtabel en maandresultaat |
| R2 | Retail Mode | parttime plus overlappende tijdvensters | toepasselijke toeslagconflictregel |
| B1 | Company open bands | fulltime, exact referentiemidden | 100% compa-ratio |
| B2 | Company open bands | deeltijd, gekozen salaris t.o.v. midden | correcte fulltime-normalisatie en verhouding, onafhankelijk van FTE |

Voeg gerichte boundarycases toe voor onder minimum, precies minimum, precies maximum, boven maximum, en voor een gepinde oudere bandversie.

Gebruik eerst de door Edwin bedoelde Test-achternaamprofielen **als hun scope en payrollinput toereikend zijn**; raadpleeg ze alleen via de bestaande geautoriseerde Core-services. Anders mogen maximaal beschikbare complete bestaande testprofielen als bron voor gepseudonimiseerde snapshots dienen, aangevuld met **zuiver synthetische Lab-profielen** voor de extra twee cases. Eerdere read-only controle bewees vier complete Test Operations/Jupiter-profielen, **niet** zes. Verplaats of wijzig geen Core-medewerkers, contracten, afdelingen, bestaande labor-condition assignments of managerrechten om de matrix vol te maken.

### Functionele acceptance

- Op de synthetische Jupiter-testadministratie zijn **exact de drie gekozen primaire arrangementen** als selecteerbare testconfiguraties zichtbaar. Productbreed moet het model meer dan drie regelingen ondersteunen.
- Eén gescopeerd employment-scenario selecteert **exact één** primaire regeling uit de beschikbaar gestelde lijst; niet tegelijk een cao en de bedrijfseigen **primaire** regeling. Aanvullende fondsen/pensioenpakketten blijven een apart toekomstig concept.
- Cao's gebruiken hun gedocumenteerde schalen/treden en ingangsdatums; bedrijfseigen pakket heeft alleen open band, afgesproken salaris en compa-ratio zonder tredeselectie.
- Compa-ratio voor B1 = 100%; voor B2 onafhankelijk verifieerbaar bij een expliciete deeltijdfactor, inclusief correcte vergelijking van fulltime-equivalenten.
- Voor alle zes blijven component-, package- en snapshotidentiteiten geïsoleerd en reproduceerbaar; dezelfde scalaire engine berekent alleen aanwezige, geaccepteerde componenten. **Vergelijk compa-ratio niet met eindnetto**: de ratio is een salarispositie, geen fiscaal outputbedrag.
- Geen claim 'drie cao's ondersteund'; twee cao's zijn nog interne benchmarkpakketten met beperkte bewezen dekking, het derde is een synthetische bedrijfspolicy.
- Codex maakt **alle** drie de arrangementen, tabellen en fixtures zelf, met onafhankelijke oracles/subagents op LUNA MAX; Edwin hoeft geen bandwaarden, percentagetabellen of werknemerskoppelingen handmatig in te voeren.

Dit hoofdstuk verduidelijkt en **vervangt** eerdere aantalsformuleringen elders in dit plan die nog uitgaan van slechts vier scenario's/twee arrangementen. De acceptatiematrix is vanaf nu zes scenario's/drie arrangementen.
