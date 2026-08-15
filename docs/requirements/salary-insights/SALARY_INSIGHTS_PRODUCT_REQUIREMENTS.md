# LiquidHR — Salaris Insights
## Product Requirements — Fase 3 — v2

**Status:** Definitief functioneel ontwerp voor implementatie
**Datum:** 14 augustus 2026
**Product:** LiquidHR
**Scope:** Inzichten → nieuwe categorie `Salaris`, salary analytics, rapportages, peildatum, filters, drilldown en privacy/scope

> Dit document is de normatieve productbron voor Fase 3 Salaris Insights. Het bouwt voort op de bestaande Salary Structures- en Salary Application-functionaliteit. Geen salarisbedragen, bandposities of schaal/trededata mogen in deze fase met een parallel berekeningsmodel worden afgeleid.

# 1. Doel

LiquidHR moet HR Admin en managers een uitgebreide, betrouwbare analyseomgeving geven voor salarissen.

De kracht van deze fase is:
- uitgebreide salarisrapportage;
- analyse op peildatum;
- sterke filtering;
- duidelijke visualisaties;
- doorklik naar medewerker;
- onderscheid tussen vrij salaris, minimumloon, schaal + trede en salarisband;
- privacyveilige interne salarispositie;
- geen mutaties of salarisronde vanuit Insights.

Salaris Insights is een analysetool, geen payroll-engine en geen salary-review workflow.

# 2. Plaats in LiquidHR

## SI-001 — Bestaande `Inzichten` gebruiken
Gebruik de bestaande hoofdmodule `Inzichten`. Maak geen nieuwe top-level navigatiemodule `Salaris`.

## SI-002 — Nieuwe categorie `Salaris`
Voeg in de bestaande rapportcatalogus een nieuwe categorie toe: `Salaris`.

## SI-003 — Hybride rapportopzet
De categorie bevat één breed overzicht en meerdere gespecialiseerde rapporten.

V1-rapporten:
1. Salarisoverzicht
2. Salarisbandpositie
3. Onder en boven salarisband
4. Schaal & trede
5. Salarisstructuur-uitzonderingen
6. Interne salarispositie

## SI-004 — Geen dashboardproduct naast rapportcatalogus
Maak geen aparte Salary Insights-app met eigen navigatiestructuur. De bestaande Insights-rapportcatalogus blijft het startpunt.

# 3. Rollen en securityscope

## SI-005 — HR Admin
HR Admin mag binnen de bestaande tenant/HR-groep- en administratiescope alle Salaris Insights-rapporten gebruiken.

## SI-006 — Manager
Een manager mag uitsluitend salarisinzichten zien voor medewerkers binnen zijn bestaande managerscope.

## SI-007 — Geen uitbreiding van managerscope
Filters, totalen, grafieken, exports, API-responses en drilldowns mogen de bestaande managerscope nooit verbreden.

## SI-008 — Interne salarispositie alleen HR Admin
Het rapport `Interne salarispositie` is uitsluitend beschikbaar voor HR Admin. Managers krijgen geen peer salary comparison, ook niet alleen voor hun eigen team.

## SI-009 — Server-side security
Alle scope- en autorisatieregels worden server-side afgedwongen. UI hiding is geen securityboundary.

# 4. Gemeenschappelijke salarisroutes

## SI-010 — Alle vier salarisroutes herkennen
Insights gebruikt:
- Vrij salaris;
- Wettelijk minimumloon;
- Schaal + trede;
- Salarisband.

## SI-011 — Routeafhankelijke analyses
Niet iedere metric geldt voor iedere salarisroute. LiquidHR toont uitsluitend betekenisvolle metrics.

## SI-012 — Vrij salaris
Vrij salaris doet mee aan algemene salarisanalyses zoals salarisbedrag, fulltime-equivalent, FTE, salarisverdeling en salarissom. Geen bandmetrics.

## SI-013 — Minimumloon
Minimumloonmedewerkers kunnen als categorie en populatie worden geteld/gefilterd. LiquidHR verzint geen salarisbedrag wanneer Salary Application geen bedrag onderhoudt. Geen bandmetrics.

## SI-014 — Schaal + trede
Analyseer salarisstructuur, schaal, trede, revision op peildatum, resolveerbaar salarisbedrag en uitzonderingen. Geen compa-ratio of range penetration.

## SI-015 — Salarisband
Ondersteun minimum, midpoint/100%-punt, maximum/open maximum, compa-ratio, range penetration waar berekenbaar, onder/in/boven band en geldigheid op peildatum.

# 5. Peildatum

## SI-016 — Eén peildatum in V1
Iedere analyse gebruikt één expliciete peildatum, standaard vandaag.

## SI-017 — Peildatum handmatig kiezen
De gebruiker kan een historische of actuele datum kiezen.

## SI-018 — Geen periodevergelijking in V1
Geen periode A versus B, trendgrafieken, delta-dashboard of automatische jaar-op-jaarvergelijking.

## SI-019 — Historisch deterministisch
Gebruik voor de peildatum exact de toen geldige employment salary rule, salarisroute, uren/FTE, schaal/trede, salary structure revision, band revision, CAO/bedrijfseigen regeling en organisatie-/employmentcontext voor zover het bestaande historische model dit ondersteunt.

## SI-020 — Salary Application resolver hergebruiken
Gebruik dezelfde centrale historische salary/revision resolution als Salary Application.

# 6. Gemeenschappelijke filters

## SI-021 — Herbruikbare salarisfilterlaag
Ondersteun minimaal:
- Administratie
- Afdeling
- Team
- Manager
- Functie
- Functiegroep
- Locatie
- CAO / bedrijfseigen regeling
- Salarisstructuur
- Salarisband
- Schaal
- Trede
- FTE
- Employment type / medewerkerstype

## SI-022 — Filters zijn scope-aware
Filteropties tonen uitsluitend waarden binnen de geautoriseerde populatie.

## SI-023 — Afhankelijke filters
Waar logisch verfijnen filters elkaar, bijvoorbeeld structuur → band/schaal en schaal → trede.

## SI-024 — Filters behouden peildatumcontext
Filteropties en resultaten worden geïnterpreteerd op de gekozen peildatum.

## SI-025 — Geen verborgen scopelek via aantallen
Filtercounts, grafiektotalen en lege/non-lege opties mogen geen informatie over ongeautoriseerde medewerkers onthullen.

# 7. Rapport 1 — Salarisoverzicht

## SI-026 — Breed salarisrapport
`Salarisoverzicht` is de natuurlijke startpagina van de categorie Salaris.

## SI-027 — KPI's
Toon minimaal:
- aantal medewerkers in selectie;
- totale salarissom voor populatie met werkelijk salary amount;
- gemiddeld fulltime-equivalent salaris;
- mediaan fulltime-equivalent salaris;
- gemiddelde FTE;
- gemiddelde compa-ratio voor geldige salarisbandmedewerkers;
- aantal onder bandminimum;
- aantal boven bandmaximum;
- aantal salarisstructuur-uitzonderingen.

## SI-028 — Mixed population veilig berekenen
KPI's die niet voor alle routes gelden gebruiken alleen de geldige subpopulatie en tonen waar relevant denominator/populatiecontext.

## SI-029 — Minimumloon niet als nul salaris behandelen
Minimumloon zonder door LiquidHR bepaald salarisbedrag telt niet als €0 in gemiddelde of salarissom.

## SI-030 — Salarisverdeling
Toon een salarisverdeling op fulltime-equivalent voor medewerkers waarvoor dit bedrag beschikbaar is.

## SI-031 — Routeverdeling
Toon verdeling over Vrij salaris, Minimumloon, Schaal + trede en Salarisband.

## SI-032 — Detailtabel
Toon minimaal medewerker, administratie, afdeling/team, functie, salarisroute, FTE, FTE-salaris indien beschikbaar, actuele structure/band/schaalpositie en relevante status.

# 8. Rapport 2 — Salarisbandpositie

## SI-033 — Alleen salarisbandpopulatie
Analyseer primair medewerkers met route `SALARY_BAND` en een geldige band op peildatum.

## SI-034 — Compa-ratio
`compa_ratio = fulltime-equivalent salaris / midpoint × 100`

## SI-035 — Range penetration
`range_penetration = (fulltime-equivalent salaris - minimum) / (maximum - minimum) × 100`

## SI-036 — Open maximum
Bij open hoogste band: compa-ratio beschikbaar, range penetration niet.

## SI-037 — Compa-distributie
Toon analytische buckets:
- <80%
- 80%–<90%
- 90%–<100%
- 100%–<110%
- ≥110%

Deze buckets zijn analysegroepen, geen salarisbeleid.

## SI-038 — Bandvisualisatie
Maak minimum, midpoint/100%-punt, maximum/open max en medewerkerpositie visueel begrijpelijk.

## SI-039 — Bandgroepering
HR kan salarisposities per salarisstructuur en band bekijken.

## SI-040 — Detailtabel
Toon medewerker, bandstructuur, band, FTE salary, minimum, midpoint, maximum, compa-ratio, range penetration en status.

# 9. Rapport 3 — Onder en boven salarisband

## SI-041 — Controlerapport
Dit rapport richt zich op medewerkers die aandacht vragen ten opzichte van hun salarisband.

## SI-042 — Statusgroepen
Minimaal:
- Onder bandminimum
- Binnen salarisband
- Boven bandmaximum
- Geen geldige salarisband

## SI-043 — Default aandacht
De eerste view mag aandacht prioritair tonen, maar `Binnen salarisband` blijft filterbaar.

## SI-044 — Salaris blijft feit
Onder/boven band is geen fout en veroorzaakt geen automatische mutatie.

## SI-045 — Detailtabel
Toon medewerker, administratie, functie, salarisstructuur, band, FTE salary, minimum, midpoint, maximum, percentage van 100%-punt, relevante afwijking en status.

# 10. Rapport 4 — Schaal & trede

## SI-046 — Eigen analysetype
Schaal + trede wordt niet geforceerd in salary-bandmetrics.

## SI-047 — Kerninformatie
Toon salarisstructuur, geldige revision op peildatum, schaal, trede, resolveerbaar fulltime salarisbedrag en aantal medewerkers.

## SI-048 — Verdeling
HR kan de medewerkerverdeling bekijken per structuur, schaal en trede.

## SI-049 — Detailtabel
Toon medewerker, administratie, functie, structuur, schaal, trede, revision effective date, resolveerbaar salary amount en geldigheidsstatus.

## SI-050 — Geen automatisch carrière-oordeel
Tredepositie wordt niet geïnterpreteerd als performance, senioriteit of promotieadvies.

# 11. Rapport 5 — Salarisstructuur-uitzonderingen

## SI-051 — Permanente HR-controlerapportage
Dit rapport maakt uitzonderingen uit Salary Structures en Salary Application blijvend zichtbaar.

## SI-052 — Minimum uitzonderingstypen
V1 bevat minimaal:
1. Geen geldige salarisband
2. Actie vereist: schaal/trede niet meer geldig
3. Administratief uitgefaseerde salarisstructuur die nog actief wordt gebruikt
4. Salary rule waarvoor op peildatum geen geldige published revision kan worden opgelost

## SI-053 — Ernst
Gebruik minimaal `Aandacht` en `Actie vereist`.

## SI-054 — Geen automatische correctie
Insights corrigeert niets automatisch.

## SI-055 — Detailtabel
Toon medewerker, administratie, dienstverband/looncontract, salarisroute, salarisstructuur, band of schaal/trede, uitzondering vanaf, status en ernst.

## SI-056 — Drilldown
Vanuit de uitzondering kan HR naar medewerker en Salaris-tab. Geen bulk-edit in V1.

# 12. Rapport 6 — Interne salarispositie

## SI-057 — Alleen HR Admin
Dit rapport is nooit beschikbaar voor managers.

## SI-058 — Doel
Interne salarispositie helpt HR beschrijvend analyseren hoe een medewerker zich qua salaris verhoudt tot vergelijkbare medewerkers.

## SI-059 — Primaire vergelijkingsgroep
Vergelijk primair met `zelfde functie + zelfde niveau/senioriteit`, voor zover betrouwbaar aanwezig in het functiemodel.

## SI-060 — Fallback vergelijkingsgroep
Bij onvoldoende primaire groep mag worden teruggevallen op `zelfde salarisband`, mits inhoudelijk coherent.

## SI-061 — Minimale groepsgrootte
Bereken een interne peervergelijking alleen bij minimaal `5 medewerkers`.

## SI-062 — Onvoldoende vergelijkingsgroep
Bij minder dan 5: toon `Onvoldoende vergelijkingsgroep`. Geen gemiddelde, mediaan, percentiel of individuele peerdata.

## SI-063 — Eigen medewerker telt mee
In V1 telt de geanalyseerde medewerker mee in de groepsstatistiek.

## SI-064 — Te tonen metrics
Bij voldoende groep minimaal:
- eigen FTE salary;
- peer mediaan;
- peer gemiddelde;
- verschil t.o.v. mediaan in bedrag;
- verschil t.o.v. mediaan in percentage;
- relatieve positie/percentiel;
- groepsgrootte;
- toegepaste vergelijkingsgroep.

## SI-065 — Geen namen van peers
De peeranalyse toont geen lijst met namen en individuele salarissen van de vergelijkingsgroep.

## SI-066 — Geen causaliteit
LiquidHR presenteert interne salarispositie niet als bewijs van onrechtvaardigheid, performanceverschil of gewenst salarisniveau.

# 13. Drilldown

## SI-067 — Medewerker is V1-eindpunt
Vanuit elk rapport kan de gebruiker binnen bestaande rechten naar de medewerker doorklikken.

## SI-068 — Salaris-tab als detailbron
De individuele `Salaris`-tab uit Salary Application blijft de primaire detailpagina voor één medewerker.

## SI-069 — Geen mutatie vanuit Insights
Geen inline salary edit, massamutatie of routewijziging vanuit Insights V1.

# 14. Export en rapportsterkte

## SI-070 — Export per rapport
Ieder rapport met detailtabel ondersteunt export van de geautoriseerde, gefilterde dataset.

## SI-071 — Excel als primaire export
Ondersteun `.xlsx` als primaire rijke export indien het bestaande Insights/exportframework dit al ondersteunt of veilig kan worden uitgebreid.

## SI-072 — CSV
Ondersteun CSV voor tabeldata indien passend in bestaand exportframework.

## SI-073 — Export respecteert filters
Export bevat gekozen peildatum, actieve filters, geautoriseerde populatie en relevante rapportkolommen.

## SI-074 — Geen export buiten manager scope
Managerexport mag nooit records buiten managerscope bevatten.

## SI-075 — Geen verborgen peerdata
Interne peerstatistiek exporteert geen onderliggende individuele peerrecords als specifieke peeranalyse-output.

# 15. Visualisaties

## SI-076 — Visualisaties ondersteunen analyse
Grafieken ondersteunen het rapportdoel; de filterbare detailtabel blijft een volwaardig werkobject.

## SI-077 — Geen decoratieve dashboards
Vermijd grafieken zonder concrete HR-vraag.

## SI-078 — Toegankelijkheid
Iedere grafiek heeft een tekstuele/tabelmatige equivalent of voldoende toegankelijke samenvatting.

## SI-079 — Responsive
Rapporten zijn bruikbaar op desktop en 390×844 volgens bestaande LiquidHR UX-regels.

# 16. KPI-definities

## SI-080 — Headcount
Aantal medewerkers in geautoriseerde, gefilterde populatie die op peildatum binnen de rapportdefinitie vallen.

## SI-081 — Salarissom
Som van feitelijk beschikbare salary amounts. Minimumloon zonder amount wordt uitgesloten, niet als nul geteld.

## SI-082 — Gemiddeld FTE salary
Gemiddelde van fulltime-equivalent salaries waarvoor een geldig bedrag beschikbaar is.

## SI-083 — Mediaan FTE salary
Mediaan van fulltime-equivalent salaries waarvoor een geldig bedrag beschikbaar is.

## SI-084 — Gemiddelde compa-ratio
Gemiddelde uitsluitend over geldige bandmedewerkers met midpoint.

## SI-085 — Uitzonderingentelling
Aantal unieke medewerkers/looncontracten met minimaal één actieve salary-structure exception op peildatum.

# 17. Data- en berekeningsarchitectuur

## SI-086 — Eén centrale reporting projection
Bouw een centrale, geautoriseerde salary-insights projection/querylaag die de rapporten voedt.

## SI-087 — Reuse Salary Application calculations
Hergebruik centrale peildatumresolution, FTE normalization, compa-ratio, range penetration, bandstatus en scale/step revision resolution.

## SI-088 — Decimal safe
Alle salary- en percentberekeningen gebruiken dezelfde decimal-safe conventies als Salary Structures/Salary Application.

## SI-089 — Geen snapshot als het afleidbaar is
Maak geen permanente snapshots van afleidbare compa-ratio/range penetration.

## SI-090 — Performance
Voorkom N+1 revision queries; gebruik een coherente databaseprojection/querystrategie.

# 18. Privacy

## SI-091 — Salary is sensitive data
Behandel alle salary analytics als gevoelige HR-data.

## SI-092 — Scope eerst, aggregatie daarna
Autoriseer de bronpopulatie vóór aggregatie.

## SI-093 — Minimum group rule peeranalytics
De minimum groepsgrootte 5 is server-side onderdeel van de response.

## SI-094 — Geen inference leak
Bij onvoldoende groep mogen totalen, hidden fields, errors of alternatieve filters geen peerwaarden prijsgeven.

# 19. UX/copy

## SI-095 — Bestaande Insights look & feel
Gebruik bestaande Insights-catalogus, report cards, filtercontrols, tables en shell waar geschikt.

## SI-096 — Nieuwe categorie visueel consistent
`Salaris` past in de bestaande categoriehiërarchie en voelt niet als externe mini-app.

## SI-097 — Businesscopy
Geen ruwe enums/database-termen. Gebruik begrijpelijke HR-copy.

## SI-098 — NL/EN
Alle nieuwe UI-copy via bestaand i18n-model met NL/EN-pariteit.

# 20. Buiten scope Fase 3

## SI-099 — Geen Salary Review
Geen salarisronde, budgetverdeling, HR-advies, manageradvies of definitief salary proposal.

## SI-100 — Geen merit matrix
Geen performance × compa-ratio verhogingsadvies.

## SI-101 — Geen marktbenchmark
Geen externe benchmarkdata.

## SI-102 — Geen gender/pay-gap module
Geen automatische gender pay gap, equal pay audit of wettelijke wage-gap conclusies.

## SI-103 — Geen AI salary advice
Geen AI die gewenst salaris of salarisverhoging adviseert.

## SI-104 — Geen trendanalyse
Geen periodevergelijking of tijdlijnanalytics.

## SI-105 — Geen write actions
Insights schrijft geen salary mutations.

# 21. Acceptatiematrix

Minimaal verifiëren:
1. HR Admin ziet categorie Salaris.
2. Manager ziet alleen toegestaan salary Insights-aanbod binnen eigen scope.
3. Manager ziet nooit Interne salarispositie.
4. Salarisoverzicht mixed population.
5. Minimumloon zonder bedrag verstoort gemiddelden niet.
6. Vrij salaris zonder bandmetrics.
7. Salarisband compa/range metrics.
8. Open maximum.
9. Onder bandminimum.
10. Boven bandmaximum.
11. Geen geldige band.
12. Schaal+trede met juiste revision op peildatum.
13. Vervallen schaal/trede.
14. Historische peildatum.
15. Alle gedeelde filters.
16. Interne peer groep ≥5.
17. Interne peer groep <5.
18. Geen peer-identiteiten in peeranalyse.
19. Drilldown naar medewerker.
20. Export respecteert filters/scope.
21. Desktop.
22. 390×844.
23. NL/EN.
24. keyboard/accessibility.
25. unauthorized API/JSON leakage.
26. decimal precision.
27. performance zonder evidente N+1-patterns.

# 22. Product acceptance criteria

Fase 3 is functioneel compleet wanneer:
1. `Inzichten` een categorie `Salaris` bevat.
2. De zes V1-rapporten bestaan.
3. Alle rapporten dezelfde geautoriseerde filter-/peildatumlaag gebruiken.
4. HR Admin volledige geautoriseerde salary analytics heeft.
5. Managers nooit buiten eigen scope komen.
6. Managers geen peer salary comparison krijgen.
7. Salarisbandmetrics correct uit historische bandrevision worden berekend.
8. Schaal+trede correct uit historische revision wordt resolved.
9. Minimumloon zonder lokaal salary amount niet als €0 wordt geanalyseerd.
10. Interne salarispositie pas vanaf 5 medewerkers wordt berekend.
11. Reports naar medewerker kunnen drilldownen.
12. Reports exporteerbaar zijn binnen scope.
13. Insights geen salary mutation schrijft.
14. Security, RLS, i18n, accessibility en responsive verificatie groen zijn.

# 23. Traceability

- SI-001–004: plaats en rapportcatalogus
- SI-005–009: rollen/security
- SI-010–015: salarisroutes
- SI-016–020: peildatum
- SI-021–025: filters
- SI-026–032: Salarisoverzicht
- SI-033–040: Salarisbandpositie
- SI-041–045: Onder/boven band
- SI-046–050: Schaal & trede
- SI-051–056: Uitzonderingen
- SI-057–066: Interne salarispositie
- SI-067–069: drilldown
- SI-070–075: export
- SI-076–079: visualisaties
- SI-080–085: KPI-definities
- SI-086–090: dataarchitectuur
- SI-091–094: privacy
- SI-095–098: UX/i18n
- SI-099–105: buiten scope

---

# 24. Normatieve UX-uitbreiding v2

De volgende eisen zijn aanvullend op SI-001 t/m SI-105 en maken de bestaande `Personeel per leeftijd` Insights-implementatie expliciet tot primaire UX- en componentreferentie.

## SI-106 — Primaire UX- en componentreferentie
Gebruik `Inzichten → Medewerkers → Personeel per leeftijd` als primaire referentie voor:
- collapsible report shell;
- titel/subtitel/header;
- filterkaart;
- single-select;
- searchable multi-select;
- `Selecteer alles`;
- KPI-kaarten;
- label `Geautoriseerde data`;
- visualization card;
- rechterpaneel `Actieve selectie`;
- exportactie;
- detailtabel;
- responsive gedrag.

Hergebruik bestaande componenten waar mogelijk.

## SI-107 — Referentie is interaction/layout, niet domeinlogica
Neem uit het leeftijdsrapport niet over:
- leeftijdslogica;
- leeftijdsbuckets;
- maand/periode-range;
- `Volledig jaar tonen`;
- 3 jaar / 5 jaar;
- trendberekening.

## SI-108 — Geen Trend in Salary Insights V1
Fase 3 ondersteunt één peildatum en geen trend-/tijdreeksweergave.
Toon geen werkende of disabled `Trend`-functie die een toekomstige mogelijkheid suggereert.

## SI-109 — Single-date peildatumkiezer
De bestaande periodepicker mag alleen als visuele/interactie-referentie worden gebruikt.
Salary Insights gebruikt `Peildatum` als één datum.

De picker ondersteunt minimaal:
- dagselectie;
- maandnavigatie;
- jaarnavigatie;
- shortcut `Vandaag`.

Optioneel:
- `Einde vorige maand`;
- `Einde vorig jaar`.

Geen range, volledig jaar of 3/5-jaar controls.

## SI-110 — Searchable multi-select gedrag
Filters met meerdere waarden volgen het bestaande Team-filterpatroon:
- search input;
- `Selecteer alles`;
- checkboxlijst;
- scrollbare lijst;
- meerdere waarden selecteerbaar;
- popover blijft bruikbaar tijdens meerdere keuzes;
- compacte closed-state samenvatting;
- keyboardbediening.

## SI-111 — Closed-state multi-select copy
Default:
`Alle teams`, `Alle administraties`, enzovoort.

Eén selectie:
toon de gekozen naam.

Meerdere:
toon bijvoorbeeld `3 teams geselecteerd`.

## SI-112 — Single-select gedrag
`Groeperen per` en `Sorteren op` volgen het bestaande single-selectpatroon:
- één actieve keuze;
- checkmark op actieve optie;
- keyboardbediening;
- clean popover.

## SI-113 — Filterdichtheid
Toon niet alle mogelijke salarisfilters permanent in één rij.

Per rapport:
- 5–6 primaire filters direct zichtbaar;
- secundaire filters via bestaand `Meer filters`-patroon of het dichtstbijzijnde bestaande Insights-patroon.

De server-side filterlaag blijft volledig gedeeld.

## SI-114 — `Actieve selectie`
Gebruik het bestaande rechterpaneel.

Toon:
- Peildatum;
- Groeperen per;
- niet-default filters;
- afwijkende sortering indien relevant.

Default/lege filters worden niet herhaald.

## SI-115 — `Actieve selectie` responsive
Desktop: rechts naast het primaire resultaatgebied waar het bestaande patroon dit doet.
390×844: inklapbaar of onder de resultaten.

## SI-116 — `Geautoriseerde data`
Toon in ieder salaryreport het bestaande trust-label `Geautoriseerde data`.
Dit label correspondeert met daadwerkelijk server-side geautoriseerde data.

## SI-117 — KPI-cardfamilie
Gebruik dezelfde bestaande KPI-cardfamilie als het leeftijdsrapport:
- korte labelregel;
- grote hoofdwaarde;
- optionele contextregel.

Geen nieuwe losstaande dashboardstijl.

## SI-118 — Subpopulatiecontext in KPI
Als een metric slechts voor een deel van de populatie geldt, toon de denominator/context.

Voorbeeld:
`Gem. compa-ratio 94,3% — 42 medewerkers met geldige salarisband`.

## SI-119 — Visualisatiekaart
Gebruik dezelfde visuele hiërarchie als het bestaande report:
- kaart;
- kleine sectielabel/titel;
- toelichting;
- visualisatie.

Iedere visualisatie heeft een tekstuele/tabelmatige equivalent.

## SI-120 — Geen nutteloze view-toggle
Wanneer een salaryreport in V1 één visualisatiemodus heeft, toon geen `Verdeling/Trend`-toggle.
Alleen relevante controls.

## SI-121 — Exportactie
Gebruik bij voorkeur één actie `Exporteren`, met:
- Excel `.xlsx`;
- CSV;
voor zover het bestaande exportframework dit ondersteunt.

## SI-122 — Detailtabel als volwaardig werkobject
Ieder rapport bevat onder de visualisatie een detailtabel in dezelfde Insights-tablefamilie.
Medewerkernaam is de primaire drilldown.

## SI-123 — Drilldownbestemming
Klik op medewerker gaat naar de bestaande medewerkercontext met de `Salaris`-tab als individuele salary-detailbron.

Geen inline salary edit in Insights.

## SI-124 — Salarisoverzicht primaire filters
Direct zichtbaar:
- Groeperen per
- Peildatum
- Administratie
- Team
- Afdeling
- Salarisroute

Secundair:
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/regeling
- Employment type

## SI-125 — Salarisoverzicht groeperingen
Minimaal:
- Salarisroute
- Administratie
- Afdeling
- Functiegroep

## SI-126 — Salarisbandpositie primaire filters
Direct zichtbaar:
- Groeperen per
- Peildatum
- Salarisstructuur
- Salarisband
- Team
- Administratie

Secundair:
- Afdeling
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/regeling
- FTE

## SI-127 — Salarisbandpositie groeperingen
Minimaal:
- Salarisband
- Salarisstructuur
- Administratie
- Afdeling
- Team
- Functiegroep
- Status

## SI-128 — Onder/boven band primaire filters
Direct zichtbaar:
- Groeperen per
- Peildatum
- Status
- Salarisstructuur
- Salarisband
- Team

Secundair:
- Administratie
- Afdeling
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/regeling

## SI-129 — Onder/boven band groeperingen
Minimaal:
- Status
- Salarisband
- Administratie
- Team

## SI-130 — Schaal & trede primaire filters
Direct zichtbaar:
- Groeperen per
- Peildatum
- Salarisstructuur
- Schaal
- Trede
- Team

Secundair:
- Administratie
- Afdeling
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/regeling
- Employment type

## SI-131 — Schaal & trede groeperingen
Minimaal:
- Salarisstructuur
- Schaal
- Trede
- Administratie
- Team
- Functiegroep
- Geldigheidsstatus

## SI-132 — Uitzonderingen primaire filters
Direct zichtbaar:
- Groeperen per
- Peildatum
- Ernst
- Uitzonderingstype
- Salarisstructuur
- Administratie

Secundair:
- Afdeling
- Team
- Manager
- Salarisroute
- Band
- Schaal
- Trede

## SI-133 — Uitzonderingen groeperingen
Minimaal:
- Ernst
- Uitzonderingstype
- Administratie
- Salarisstructuur

## SI-134 — Interne salarispositie primaire filters
HR Admin-only.

Direct zichtbaar:
- Groeperen per
- Peildatum
- Functie
- Functiegroep
- Salarisband
- Administratie

Secundair:
- Afdeling
- Team
- Locatie
- CAO/regeling
- Salarisstructuur
- FTE

## SI-135 — Interne salarispositie groeperingen
Houd beperkt:
- Functie
- Functiegroep
- Salarisband
- Administratie

## SI-136 — Rapport-specifieke sortering
Ondersteun logische sorteringen per report, bijvoorbeeld:

Salarisoverzicht:
- Naam
- Salaris hoog-laag
- Salaris laag-hoog
- FTE
- Status

Salarisbandpositie:
- Compa hoog-laag
- Compa laag-hoog
- Band
- Naam

Onder/boven:
- Status
- Grootste afwijking
- Naam

Schaal & trede:
- Structuur
- Schaal
- Trede
- Naam

Uitzonderingen:
- Ernst
- Vanaf datum
- Type
- Naam

Interne salarispositie:
- Verschil mediaan
- Relatieve positie
- Naam

## SI-137 — Empty state algemeen
Gebruik:
`Geen medewerkers gevonden voor deze selectie.`

## SI-138 — Empty state salarisband
Gebruik waar passend:
`Geen medewerkers met een geldige salarisband op deze peildatum.`

## SI-139 — Empty state uitzonderingen
Gebruik:
`Geen salarisstructuur-uitzonderingen voor deze selectie.`

## SI-140 — Peer empty/privacy state
Bij een vergelijkingsgroep <5:
`Onvoldoende vergelijkingsgroep`

Toon geen afgeleide peerstatistieken.

## SI-141 — Desktop layout
Desktop volgt het bestaande Insights-patroon:
- filters bovenaan;
- KPI cards;
- primary visualization;
- active selection side panel;
- table eronder.

## SI-142 — Mobile layout
Op 390×844:
- filters stapelen;
- KPI cards 1–2 per rij;
- visualisatie boven tabel;
- active selection inklapbaar/onder resultaten;
- geen clipped popovers/actions;
- multi-select voldoende groot.

## SI-143 — Geen nieuw Salary visual system
Gebruik bestaande LiquidHR/Exact tokens, componenten, chartpalette en interaction conventions.
Status wordt nooit alleen door kleur gecommuniceerd.

---

# 25. V2-acceptatie-uitbreiding

Naast de bestaande acceptatiematrix moet browserbewijs aantonen:

1. `Personeel per leeftijd` component-/interactionpatterns zijn hergebruikt waar technisch passend.
2. Salary Peildatum is een single-date picker.
3. Geen Trendfunctionaliteit aanwezig.
4. Searchable multi-select ondersteunt search + `Selecteer alles` + meerdere keuzes.
5. `Groeperen per` volgt het bestaande single-selectpatroon.
6. `Actieve selectie` toont alleen relevante actieve keuzes.
7. `Geautoriseerde data` wordt consistent getoond.
8. Elk report gebruikt de hierboven vastgelegde primaire/secundaire filters.
9. Elk report gebruikt de hierboven vastgelegde groeperingen.
10. Desktop en 390×844 voldoen aan de UX Reference.
