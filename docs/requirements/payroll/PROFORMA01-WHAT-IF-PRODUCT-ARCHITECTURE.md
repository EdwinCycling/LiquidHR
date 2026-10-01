# PROFORMA01 — Pro-formaberekeningen, What-if en netto-naar-bruto

Status: **productconcept en architectuurvoorstel, nog niet geïmplementeerd of geaccepteerd**  
Datum: 2026-10-01  
Relatie: PAYLAB02/03 engine, PAYLAB04 Component Library, CAO-BENCH01 arrangement packages, later PAYLAB05 Designer en live Core adapter.

## Productvisie

Pro Forma wordt geen tweede rekenengine en geen wijzigingsformulier op de definitieve salarisadministratie. Het is een **afgescheiden Scenario / What-if bounded context** die een bestaande of synthetische canonieke inputset kopieert, een set expliciete tijdelijke wijzigingen toevoegt, dezelfde versioned Payroll Component Graph Engine uitvoert en resultaten vergelijkt.

Pro Forma heeft drie duidelijk gescheiden concepten:
1. **Actual/Current Estimate**: actuele payrollprojectie gebaseerd op bestaande brondata, later via continuous payroll; niet hetzelfde als een eigen simulatie.
2. **Forecast**: verwachte toekomstige uitkomst inclusief expliciet gedocumenteerde aannames en reeds bekende toekomstige versies.
3. **What-if/Pro Forma**: handmatig door bevoegde actor samengesteld hypothetisch scenario; verandert nooit actuele of definitieve payroll, Core-contracten, mutaties, aangiften, betaling, jaaropgave of officiële YTD-balances.

De eerdere 570-paginastudie beschrijft Current Estimate, Forecast en immutable Final als verschillende resultaten en vereist consistente snapshots. What-if is hier een **extra geïsoleerde scenario-overlay**, geen vierde productiepayrollstatus.

## Doelgroepen en autorisatie

### HR Admin / bevoegde Payroll-gebruiker

- nieuwe volledig fictieve testmedewerker met synthetische demografie en expliciet gekozen salaris/cao/contractvoorwaarden;
- optioneel starten vanaf een bestaande medewerker, uitsluitend voor medewerkers binnen server-side toegestane tenant/HR-groep/administratie/subject-scope;
- pro-formaberekening van bruto, inhoudingen, netto en alleen bewezen beschikbare werkgeverskosten;
- nieuwe contractvariant: periodiek loon, arbeidsomvang/FTE, urenrooster, ingangsdatum, functie/schaal/trede, toeslagen, werkgeversregelingen;
- scenario's A/B/actueel vergelijken;
- offerte-/arbeidsvoorwaardensamenvatting/pro-formastrook als PDF later wanneer exportcontract veilig is;
- eventueel gescopeerde interne deelflow met expliciete toestemming, beperkte bewaartermijn en afgeschermde geldigheidsduur; niet automatisch zichtbaar voor Managers.

### Medewerker — Mijn Salaris-simulator

- alleen **eigen** salaris- en arbeidsvoorwaardengegevens waarvoor bestaande ESS-permissions toegang toestaan;
- simulatie van overuren, extra diensten, variabele uren, mogelijke loon- of urenwijzigingen en aankomende maanden;
- onderscheid tussen goedgekeurde werkelijk geregistreerde uren, ingediende maar niet-goedgekeurde uren en zelf ingevoerde hypothetische uren;
- onbetaald verlof en ziekte-effect alleen als toepasselijke wettelijk/cao/bedrijfspolicyregels en gegevens beschikbaar en gevalideerd zijn;
- netto-naar-bruto voor gewenst netto bij expliciet gedefinieerde grondslag/periode/voorwaarden;
- standaard alleen eigen scenario's en eigen resultaten; geen werkgeverskosten of informatie uit andere medewerkers tenzij bestaande productpermissions die expliciet toestaan;
- scenario's standaard privé, geen automatische sharing met werkgever/manager.

Medewerkerervaring liefst vanuit bestaande Mijn salaris/ESS-pagina of later dezelfde Payroll Lab-overzichtstegel volgens autorisatie; **geen extra Payroll-sidebar submenu**. HR Admin gebruikt de centrale tegel `Pro Forma` op de enkele Payroll Lab-overzichtspagina.

## Scenario's om productmatig te ondersteunen

| Scenario | Eerst benodigde capability |
| --- | --- |
| Nieuwe fictieve medewerker / voorstel | synthetic canonical snapshot, gekozen periode en bewezen rule composition |
| Kopie bestaande medewerker en wijzig | live Core-sourceadapter + gedifferentieerde salary-PII permissions |
| Huidig vs hoger bruto | ondersteunde fiscale/netto componenten en policy versions |
| 32 → 36 uur / andere ingangsdatum | uren/proratering/contract segmenten en juiste maandbasis |
| Overwerk 5/10/20 uur | quantity × rate × toeslagcomponent, tijdvak- en tabeltoepassing |
| Ingevoerde/geregistreerde uren volgende maand | tijdsbron met expliciete status, plus forecastassumpties |
| Onbetaald verlof | toepasselijke contract/cao- en fiscale grondslagregels |
| Ziekte / gedeeltelijke werkhervatting | exacte, geverifieerde loondoorbetalingsregeling/segmenten; anders UNSUPPORTED |
| Nieuwe cao/schaal/trede | CAO-BENCH01 arrangement assignment + effectieve component-/parameter-/tabelversies |
| Vakantiegeld/13e maand/bonus | reserveringen, bijzondere beloning en fiscaal correcte toepasselijke methoden |
| Woon-werkvergoeding of thuiswerkvergoeding | afzonderlijke declaratie-/vergoedingscomponenten, fiscale classificatie |
| Nieuwe pensioenregeling/auto van de zaak | pas wanneer echte componenten/rules beschikbaar en getest zijn |
| Wat kost deze uren-/loonsverhoging werkgever? | gevalideerde werkgeverspremies/pensioen en volledige cost composition |
| Huidig netto → gewenst netto (netto-naar-bruto) | versiegebonden inverse solver over de volledige beschikbare forward engine |
| Jaarvergelijking en startdatumscenario | jaar-/periodehorizon, toekomstige ruleversies en expliciete aannames |
| Kostenbudget: wat past binnen X totale werkgeverskosten? | inverse cost solver, pas na volledige employer-cost compliance |

Geen generieke claim dat al deze scenario's vanaf PAYLAB03 berekend kunnen worden. PAYLAB03 ondersteunt alleen de afgebakende 2026-stadsituatie (WHITE/NL/STD, reguliere volledige maand, onder AOW, één synthetische IKV, geen pensioen/werkgeverspremies). Overige scenario's worden pas functioneel vrijgegeven wanneer hun componenten en onafhankelijke cases bewezen zijn.

## Nettodoel → bruto: inverse calculation

**Geen eigen benaderende belastingformule.** Gebruik de bestaande forward Payroll Component Graph Engine als enige bron van berekende nettoresultaten.

Input:
- doelnetto (inclusief duidelijke definitie: uitbetaald vs netto loon, per maand vs per jaar);
- doelgroep/perioden en geldigheidsdatum;
- bronmedewerker of synthetic subject + toepasselijke arbeidsvoorwaarden;
- **welke variable mag worden veranderd?** Begin uitsluitend met periodiek bruto basissalaris; laat alle overige vaste voorwaarden expliciet bevroren;
- ondersteund fiscaal regime, relevante vergoedingen en eventuele flexibele componenten duidelijk gemodelleerd;
- een gespecificeerde brutosalarisband / grenzen en rekeneenheid (bijv. € 0,01 of bedrijfssalaristrede).

Algoritme:
- bereken de complete netto-output van een kandidaatbruto via dezelfde forward engine;
- niet aannemen dat de inverse functie overal continu of strikt monotoon is: officiële loontabelstappen, inhoudingen, maxima en afrondingen kunnen sprongen/plateaus veroorzaken;
- bisection alleen binnen aantoonbaar geschikte monotone intervallen; anders bounded interval/scans en lokale verfijning volgens aantoonbaar juiste aanpak;
- deterministische zoekvolgorde, tijd-/evaluatielimiet, expliciete solverstatus, gebruikte kandidaten/brutoband, effectieve package hash en trace;
- rapporteer de **minimale bruto-input die het doelnetto bereikt** binnen de gekozen toegestane salarisresolutie en zoekruimte, of de dichtstbijzijnde uitkomst plus afwijking wanneer doel niet exact haalbaar is; meldt meerdere kandidaatoplossingen indien relevant;
- een onbekend/onvolledig payrollcomponent dat netto beïnvloedt mag niet stilzwijgend genegeerd worden;
- geen garanties van netto exact gelijk aan het doel wanneer tabellen/afronding/discontinuïteiten dat onmogelijk maken.

Test oracle onafhankelijk van de productie-forward engine op bevroren officiële cases; inverse acceptance controleert voor iedere voorgestelde kandidaat de forward output, inclusief grenzen en gevonden minimum in het onderzochte zoekgebied.

## Data- en rekencontract

Toekomstige typen, aansluitend op bestaande naamgeving:
- `ProFormaScenario`: id, type `SYNTHETIC | COPY_EXISTING | FORECAST_VARIANT`, owner/scope, zichtbaarheid, perioden, status `DRAFT | CALCULATED | STALE | EXPIRED`, createdBy, expiry;
- `ProFormaBaselineRef`: source snapshot identity/hash of immutable synthetic baseline + bronpeildatum;
- `ScenarioChangeSet`: typed deltas voor salary, hours, allowances, leave, policy assignment etc. met effective dates en validation;
- `ScenarioAssumptionSet`: bronnen en onderscheid `ACTUAL_APPROVED | ACTUAL_PENDING | FORECAST | USER_HYPOTHETICAL`;
- `ResolvedScenarioInputSet`: immutable baseline + overlay + exact rule-package composition incl. cao, bedrijfspolicy en effectieve datum, met input hash;
- `ProFormaRun`: engineversion, composition hash, outputs, controls, trace, result hash, unsupported reasons;
- `ScenarioComparison`: delta van relevante financiële outputs tussen identiek gescopeerde, vergelijkbare scenario's.

**Geen brondata in place muteren**; baseline en overlay vormen een geheel nieuwe immutable inputset per berekening. Scenarioresultaten zijn strikt gescheiden van payrollruns voor betaling/aangifte/boekhouding en van officiële cumulative balances. Hergebruik pure engine runtime onder een `SIMULATION` context zonder productie-side effects.

Trace bevat: gebruikte bronversies, aannames, scenario-deltas, component- en roundingversions, exact berekende effecten, gap/completeness-lijst. Duidelijke label `Pro Forma / simulatie, niet uitbetaald` zonder overbodige grote waarschuwingbanner.

Bewaren: korte instelbare retention voor persoonlijke proefscenario's, optioneel handmatig 'Bewaar scenario'. Fictieve data mag langer voor regressie. Scenario's nooit onbedoeld in analytische tenant-overzichten of employee dossiers belanden. Clean deletion/retention voor persoonlijke scenario's moet verenigbaar zijn met eventuele auditvereisten.

Bij gelijktijdige echte bronwijzigingen: bewaard scenario blijft reproduceerbaar op vastgezette baseline, maar UI kan het als `STALE` markeren en expliciete rebase voorstellen; nooit ongemerkt wijzigen.

## Package- en cao-integratie

De CAO-BENCH01 architectuur levert `ArrangementPackage`, `PackageAssignment` en `CalculationCompositionSnapshot` als toekomstig contract. Scenario's kunnen alleen toegestane alternatieve pakketassignments voor een fictieve of expliciet geautoriseerde proefcontext testen. Pakketversies, tijdvak en toepasselijkheid worden bevroren in de scenarioinput.

Verschil tussen nieuwe cao-release en huidige cao via A/B is een belangrijke zakelijke usecase: leg vast welke regels en bedragen het verschil veroorzaken. Geen 'cao wisselen' als generieke knop zonder juridische applicability-checks.

## UX-productconcept

**Payroll Lab-overzicht** — één sidebar-ingang; kaart `Pro Forma` naast `Berekeningen` en `Salariscomponenten` zodra module functioneel is.

HR Admin wizard:
1. `Nieuwe fictieve medewerker` of `Kopie bestaande medewerker` (laatste pas na live Core-access acceptance);
2. selecteer peildatum/periode, cao/voorwaarden en eventuele bronsnapshot;
3. pas 1 of meer toegestane wijzigingen toe met begrijpelijke invoer;
4. bekijk baseline vs scenario, bruto/tax/netto/werkgeverskosten uitsluitend binnen bewezen scope;
5. open verschilverklaring + relevante componenttrace, pas aan, maak alternatief B, sla op of verwijder.

ESS:
`Mijn salaris → Wat als...` met directe opties `Extra uren`, `Andere werkweek`, `Salarisverhoging`, `Verlof`, `Gewenst netto`. Alleen features tonen die voor het huidige persoonlijke contract en de actieve rules daadwerkelijk ondersteund zijn. Elke wijziging kan debounce-preview gebruiken; in een productiecontinuous-payrollwereld is dit een isolated scenario-run, geen mutatie-event voor de echte payroll.

Niet-payroll gegevens zoals gezondheid/diagnose hoeven voor de loonsimulatie niet gekopieerd of opgeslagen te worden: ziekteverloop modelleren via toegestane afwezigheidscategorie, datum en loondoorbetalingspercentage uit de relevante regeling.

## Extra productkansen (pas na stabiel fundament)

- financieel verschil per scenario ook op jaarbasis;
- 'wat betekent mijn loonsverhoging voor mijn werkgever?' uitsluitend in bevoegde HR-weergave;
- HR-aanbodscenario met toekomstige ingangsdatum en conceptvoorstel;
- verschil tussen bonus en vaste loonstijging zodra bijzonder belonen wordt ondersteund;
- scenario als concept HR-mutatie aanbieden, nooit automatisch toepassen zonder aparte expliciete bevoegde actie/goedkeuring;
- tijdlijn/vergelijking van drie scenario's en delen/exporteren met expliciete privacycontrole;
- pro forma voor een nieuwe vacature/budget per schaal/trede;
- later optionele AI-uitleg of NL-taalinvoer als gecontroleerde parser die enkel schema-gevalideerde change sets kan voorstellen; geen onbeperkte tekst → code/rule-uitvoering;
- medewerker kan later een door hem gemaakt scenario als niet-bindend voorstel indienen via een aparte opt-in workflow, niet standaard zichtbaar voor werkgever.

## Iteratieplan

**PROFORMA00 (design/contract na PAYLAB04 en parallel aan CAO-BENCH01 analyse)**  
Werk echte source/engine/API/securitycontracten uit en toets UX; geen nieuwe engine.

**PROFORMA01-MVP (eerste code)**  
Fictieve werknemer in reeds bewezen PAYLAB03-2026 volledige-maandscope; periodiek bruto wijzigen en baseline/scenario vergelijken; periodiek nettodoel → bruto voor dezelfde ondersteunde scope, forward-oracle en bounded solver; bewaar herbruikbaar testscenario; 2 herhaalde runs met identieke hashes; 390px browser. Geen werkgeverskosten claimen.

**PROFORMA02 (na live source/CONTROL02 + bredere rules)**  
Geautoriseerde kopie bestaande medewerker, employee-only ESS, reële uren/arbeidsomvang en toekomstige maand, premies/pensioen, geldige Cao/bedrijfspolicyassignments. Negative permission/security matrix verplicht.

**PROFORMA03 (verdere domeindekking)**  
Verlof/ziekte, bijzondere beloning, vakantiegeld/jaarforecast, werkgever-cost inverse, concept HR proposal integration uitsluitend waar onderliggende fiscale/HR-regels echt zijn geaccepteerd.

Deze fasen zijn productvoorstellen, geen automatische uitvoeringsopdracht; zij mogen de lopende PAYLAB04-run niet uitbreiden.

## Acceptance minimum

- hergebruik bestaande engine, geen afzonderlijke fiscale rekenimplementatie;
- twee onafhankelijke berekeningen op dezelfde immutable inputsets leveren identieke output/hash;
- bronmedewerker/contract/eerdere run onveranderd na scenario-run;
- beide scenario's dezelfde bron-, pakket- en fiscal peildatum wanneer direct vergeleken;
- supported/unsupported expliciet en per component controleerbaar;
- netto-naar-bruto forward-reconciliation en deterministische bounded termination;
- tenant/HR-groep/administratie/subject-scope negatives en employee-only grenzen bij latere live self-service;
- typecheck, gerichte tests, geauthenticeerde browseracceptatie, secretscan, i18n/mobile volgens AA;
- save/reload/delete scenario binnen policy; geen mutatie aan echte payroll of boekhouding.
