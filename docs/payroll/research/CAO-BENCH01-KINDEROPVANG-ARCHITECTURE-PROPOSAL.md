# CAO-BENCH01 — Cao Kinderopvang en centrale LiquidHR-regelcatalogus

Status: **gekozen benchmark; architectuurvoorstel, nog niet geïmplementeerd, fiscaal/juridisch niet extern gevalideerd**  
Datum: 2026-10-01  
Werkspoor: na PAYLAB04 Component Library; ontwerpinput voor PAYLAB05 Component Designer en Control/inrichtingapp.

## Update 2026-10-01 — tweede cao en daadwerkelijke testprofielen

De benchmark wordt uitgebreid naar **twee publiek brongebonden cao's**: (1) Kinderopvang 2025–2026 en (2) Retail Non-Food 2026–2027, eerst branchemodule **Mode**. Van beide komen afzonderlijke versioned ArrangementPackages met een per-artikel dekkingsmatrix.

Een read-only Core-/Payroll-Lab-inspectie bevestigde in Planeten → Test Operations → Jupiter BV vier bestaande medewerkersprofielen met employment, salaris, rooster, IKV-link en Core-arbeidsvoorwaardenset. Er is een toegewezen manager met gekoppelde auth_user-identiteit; daadwerkelijke payrollrechten en PAYLAB01 live source-read blijven afzonderlijk te bewijzen. De goedgekeurde Jupiter Payroll Lab administratie bestaat.

Codex bouwt twee configuraties uit de officiële bronnen, richt vier **synthetisch gekopieerde, gepseudonimiseerde** Payroll Lab-benchmarkprofielen in (2 Kinderopvang + 2 Retail Mode) en berekent uitsluitend wat volgens de actuele engine/rules echt is ondersteund. Bestaande Core-arbeidsvoorwaarden/salarissen/managers worden in deze benchmark niet gewijzigd. Een Core labor-condition set is **nog niet** hetzelfde als een gepubliceerde, berekenbare cao-packageassignment.

Gedetailleerd uitvoeringsplan: [CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN](CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN.md). Dit gaat **na** de lopende PAYLAB04-run; geen scope-creep in PAYLAB04.

## Doel

Gebruik Cao Kinderopvang 2025–2026 als eerste echte praktijktest voor de bestaande Payroll Component Graph Engine. Onderzoek twee vragen gescheiden:

1. Welke cao-bepalingen kunnen we met bestaande componenten, parameters, tabellen, scopes en versioning uitdrukken? Welke engineprimitieven ontbreken?
2. Hoe beheert LiquidHR later veel cao-, fonds-, wettelijke, pensioen- en bedrijfseigen pakketten centraal en hoe krijgen klanten toegang tot gepubliceerde versies, zonder hun eigen inrichting of historisch payrollresultaat stilzwijgend te veranderen?

Dit is een benchmark en demonstratiepakket, geen officieel door LiquidHR gevalideerde cao-ondersteuning. Maak geen claim van volledige dekking.

## Officiële bronset (bij uitvoering opnieuw actualiseren)

- Cao Kinderopvang 2025–2026 en bijlagen: https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026
- Salaris bepalen en verwijzing naar functiematrix/salarisschalen: https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen
- Afzonderlijk gepubliceerde tussentijdse besluiten: https://www.kinderopvang-werkt.nl/alles-over-de-cao-kinderopvang/tussentijdse-cao-besluiten
- Karakter van de cao: https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/karakter-van-de-cao
- Maatwerk op ondernemingsniveau: https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/maatwerk-op-ondernemingsniveau
- **Aparte** Cao FCB 2025–2026 (sectorfonds): https://www.fcb.nl/cao-fcb

Bronrisico: tussentijdse besluiten kunnen al gelden terwijl ze nog niet in de gebundelde cao-tekst staan. Source registry moet basisdocument, bijlagen en latere besluiten apart registreren, met documentdatum, ingangsdatum, toepasselijkheid, hash en geraakte regels.

Controleer per bepaling of deze letterlijk zo geldt en of er een externe uitvoeringsregeling nodig is, voordat een berekeningsregel wordt gepubliceerd. Officiële wettelijke/fiscale bronnen blijven normatief voor fiscale classificatie en inhouding.

De cao heeft een **standaardkarakter**: niet elke bedrijfseigen 'gunstiger' afwijking is toegestaan. Voor afwijkingen gelden alleen de uitdrukkelijk toegestane bepalingen, voorwaarden en eventuele instemming van medezeggenschap. Modelleer daarom geen onbeperkte universele override-hiërarchie.

Publicatie- en hergebruikrechten van bron-PDF's, volledige cao-teksten en andere ingekochte inrichting moeten afzonderlijk worden beoordeeld vóór commerciële distributie. Link naar bronnen en bewaar de eigen functionele rule-mapping; kopieer geen concurrerende softwareconfiguratie of integraal bronmateriaal zonder geldige rechten.

## Productarchitectuur: vijf duidelijk gescheiden begrippen

1. **ComponentDefinition**: herbruikbare technische/semantische salariscomponent (SYSTEM / CUSTOMER_FORK / CUSTOMER_CUSTOM), typed IO, berekeningsmethode, dependencies, afronding en versie. NIET per cao klonen als een gedeelde definitie volstaat.
2. **RulePackage**: versioned nationale wettelijke/fiscale regels; runtimecode voor trusted statutory SYSTEM-rules blijft statisch, gereviewd en geïnjecteerd, niet door willekeurige databasecode.
3. **ArrangementPackage**: configuratiepakket met specifieke cao/sector/fonds/pensioen/bedrijfspolicy-identiteit en versies; bestaat uit geselecteerde componentversies, geldige parameters, tabellen, mappings, applicabiliteitsvoorwaarden en relevante bewijslocaties.
4. **PackageAssignment**: expliciete versiegebonden toewijzing aan juridische werkgever/administratie, dienstverband, en indien functioneel nodig inkomensverhouding of werknemersgroep; met geldigheidsdatums en gecontroleerde reden. Employment != IKV; geen Core/CONTROL02-schema verzinnen zolang dat contract openstaat.
5. **CalculationCompositionSnapshot**: immutable, resolved en gehashte samenstelling van daadwerkelijk toegepaste wettelijke, cao-, fonds-, pensioen- en toegestane company packages, gekoppeld aan run, source/input snapshots en trace.

Hetzelfde component kan in meerdere cao-pakketten worden gebruikt, terwijl percentagetabellen, maxima, franchises, van toepassing zijnde grondslag en geldigheidsdatum per pakket verschillen.

Een werkgever kan tegelijk verschillende toepasselijke afspraken hebben. De arbeidscao Kinderopvang en een eventueel toepasselijke fonds-cao FCB zijn **verschillende** pakketten; FCB-bijdragen worden niet vanzelf een inhouding op de loonstrook. Toepasselijkheid, grondslag, werkgevers-/werknemersdeel, rapportage en betalingsproces moeten expliciet uit de bijbehorende regeling worden bepaald.

Geen automatische 'laatste wint' of 'klant gaat altijd boven cao' voor botsende instellingen. Valideer per bepaling: wettelijke minimumnorm, cao-karakter, toegestane bedrijfsmarge, expliciete samenstelling en scope. Ambigue/conflicterende composities worden geblokkeerd met een uitlegbare validatie-uitkomst.

## Waar functionaliteit hoort

**LiquidHR Control / centrale inrichtingapp (bestaand intern appconcept):**
- beheer globale SYSTEM-componentmetadata en catalogus;
- auteur/importeer bronregistraties, cao/sector/andere arrangementpakketten en revisies;
- source-to-rule mapping met artikel/bijlage, peildatum, geldigheid;
- verschiloverzicht tussen releases en tussentijdse besluiten;
- staging, onafhankelijke rekenoracle, testverslagen, vierogenreview;
- onveranderlijk publiceren, versies uitfaseren en release notes;
- zien welke klanten/administraties potentieel geraakt zijn (gescopeerd en privacybewust);
- publiceren van een expliciete package-manifest/hash. Niet de generieke engine of willekeurige statutory executable code naar Control verplaatsen.

**LiquidHR HR Suite / Payroll (klantgericht):**
- gebruik één `Payroll Lab`-sidebar-ingang met een dashboard/overzicht van bestaande LiquidHR-tegels; geen afzonderlijke sidebar-menu's voor Salariscomponenten of toekomstige cao's;
- plaats toekomstige `Cao's en regelingen` als functionele tegel vanuit dat overzicht, met onderliggende routes en terugnavigatie;
- bladeren door beschikbare componenten en cao-/fondspakketten;
- zien of een pakket BENCHMARK/BETA, functioneel getest, intern gereviewd of extern gevalideerd is, zonder ongefundeerde keurmerkclaim;
- toepasbaarheid laten bevestigen door bevoegde klantfunctionaris;
- pakketrelease toewijzen aan de juiste juridische werkgever/administratie/dienstverband/periode;
- alleen waar de regeling het toestaat extra company policy/configuratie aanmaken; afwijkingen registreren met eventuele vereiste interne goedkeuring;
- nieuwe releases, ingangsdata en verschillen zien; simuleren vóór expliciete acceptatie;
- historische versie en run herleidbaar houden;
- klantforks detached houden; een fork wordt nooit automatisch onderhouden door LiquidHR.

**Payroll Engine + Payroll DB (runtime):**
- resolven van de voor deze employee/employment/IKV/periode geldige compositie;
- applicabiliteit, pakketcompatibiliteit en conflicts controleren;
- immutable snapshots/parameters/componentversies + source provenance vastleggen;
- deterministic calculations volgens bestaande Decimal/rounding/trace contracts.

Bij implementatie hergebruik bestaande services/repository/authorization; voorkom Control → browser of browser → Payroll DB als nieuwe bypass.

## Benchmarkinhoud — eerste zes onderzoekscases

Onderzoek en specificeer afzonderlijk:
1. functiematrix/salarisschaal en deeltijd; versiegrens vóór/op/na 1 september 2026; onderscheid gepubliceerde septembertabel van percentuele verhoging om dubbel verhogen te voorkomen;
2. eindejaarsuitkering en reservering met juiste cao-grondslag en betalingsmoment; check actuele 2026-regels;
3. vakantietoeslag en eventuele minimumregeling, inclusief precieze grondslag en wettelijke classificatie (apart);
4. werkurentoeslag met dag/tijdvensters, tariefplafond en rooster-/urenbron;
5. woon-werkvergoeding vóór/op/na 1 juli 2026; belastingvrij karakter nooit automatisch afleiden uit cao-vergoedingshoogte;
6. afzonderlijke toepasselijke FCB-fondsregeling als demonstratie dat twee pakketten tegelijk kunnen bestaan; fiscale, premie-, fonds- en betalingsprojecties gescheiden houden.

Alle verwachte uitkomsten onafhankelijk afleiden uit de toepasselijke officiële bronversie. Voor zover PAYLAB04/engine ontbrekende primitives heeft, maak een compacte gap-analyse, geen fictieve succesvolle berekening.

Niet-payroll onderdelen van de cao (bijv. verlof, functie-eisen) mogen in toekomstige modules als HR-policy-referentie worden aangemerkt; niet geforceerd als looncomponent modelleren.

Test 3 synthetische persona's: fulltime, parttime en avond-/weekenduren. Test tijdvakovergangen en minstens twee gelijktijdige toepasselijke pakketten voor één toegestane testinrichting. Meerdere cao's binnen één tenant moeten mogelijk zijn, maar de daadwerkelijke juridische toepasselijkheid per individuele arbeidsovereenkomst vereist expliciete classificatie en review.

## Versioning en onderhoud

Onderhoudscyclus: source signal → impactanalyse → concept release → onafhankelijke oracle/golden cases → onafhankelijke review → staging/simulatie → onveranderlijke publicatie → klantimpactweergave/toewijzing → gecontroleerde activering.

Een nieuwe cao-versie of tussentijds besluit overschrijft **nooit** gebruikte definities, bestaande klantassignments of historische runs in-place. Bewaar zowel publicatiedatum als juridische ingangsdatum; een toekomstige regel kan reeds gepubliceerd zijn en een retroactieve wijziging kan impact op afgesloten periodes hebben. Werk TWK/retro pas uit in zijn eigen slice, maar ontwerp het model er niet tegenin.

Toon compatibiliteit per packageversie: vereiste engine-/componentversies, gerelateerde pakketten, conflicten en niet-ondersteunde scenario's. Lifecycle-statussen moeten de bewezen kwaliteit beschrijven; een eigen interne test is geen juridische certificering.

## Uitvoeringsvolgorde

1. Rond lopende PAYLAB04 Component Library af; voeg geen compleet CAO-beheer toe aan de lopende run.
2. **CAO-BENCH01:** bouw de bron-naar-component mapping, onafhankelijke voorbeelden, versiegrens-tests en een onderbouwde gap-analyse. Gebruik bestaande componentdefinitions/rule packages; bouw geen nieuwe frameworklaag voordat de cases aantonen dat die nodig is.
3. Productiseer het centrale catalogus-/package/publicatiemodel in de bestaande Control/inrichtingapp als aparte scope na review van de benchmark.
4. Laat PAYLAB05 Component Designer voortbouwen op de bewezen ontbrekende primitives en het gepubliceerde packagecontract.

Acceptatie van CAO-BENCH01 betekent uitsluitend dat de gekozen onderzoekscases correct zijn gemodelleerd/geanalyseerd binnen de duidelijk beschreven dekking. Niet claimen: volledige Kinderopvang-cao, juridische validatie, live klantbeschikbaarheid of officiële pensioen-/fondsuitvoering.
