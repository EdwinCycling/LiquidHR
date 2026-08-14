# LiquidHR — Salarisstructuren & Salarisbanden
## Product Requirements — Salarisstructuren

**Status:** Definitief / gereed voor implementatieplanning
**Datum:** 14 augustus 2026
**Product:** LiquidHR
**Scope:** Productfase Salarisstructuren — HR Admin-configuratie, domeinmodel, security, revisies en migratiefundering

> Dit document is de normatieve productbron voor deze productfase. Bij conflict geldt: Product Requirements > UX Reference > bestaande shell/componenten/design tokens/accessibility/i18n > Stitch-referentieschermen. Dit is nog geen Codex-uitvoeringsplan.

## 1. Doel en positionering

LiquidHR ondersteunt salarisstructuren als **HR-groepbrede, benoemde definities** die over de tijd via revisies wijzigen en later effectief gedateerd aan een looncontract/salarisregel kunnen worden gekoppeld.

Binnen één HR-groep mogen meerdere salarisstructuren naast elkaar bestaan. Een medewerker kan later, afhankelijk van de salarisregel van het dienstverband, werken met:

1. geen salarisstructuur;
2. een salarisband;
3. een schaal met trede.

De twee configureerbare structuurtypen zijn bewust verschillende beloningsmodellen:

- **Schaal met tredes:** schaal + concrete trede bepaalt het gepubliceerde salarisbedrag.
- **Salarisband:** de band levert minimum, 100%-punt en maximum; het daadwerkelijke medewerkersalaris blijft een vrij salarisbedrag en bepaalt later de positie binnen die band.

Een salarisstructuur is een **blijvend logisch object met een naam**. Jaarlijkse of toekomstige wijzigingen worden geen nieuwe losse structuren, maar nieuwe **revisies** van dezelfde structuur.

Voorbeeld:

`VVT salarisschalen`
- revisie geldig vanaf 01-01-2026;
- revisie geldig vanaf 01-01-2027;
- conceptrevisie geldig vanaf 01-01-2028.

Deze productfase realiseert uitsluitend de HR Admin-configuratie en architectuur/fundering. Effectief gedateerde koppeling aan looncontracten volgt in Productfase 2. Salaris Insights volgt in Productfase 3. De Salarisronde volgt in Productfase 4.

## 2. Bestaande situatie die moet worden gerespecteerd

De huidige LiquidHR-implementatie kent `salary_scales` met gepubliceerde revisies en een variabel aantal tredes. Gepubliceerde revisies zijn immutable. Salaristoekenning vindt plaats via effectief gedateerde `employment_salaries`; `CUSTOM_SCALE` verwijst naar een concrete `salary_scale_step_id`.

Bestaande salarisvormen die gerespecteerd moeten worden:

- `MANUAL` — vrij salarisbedrag zonder schaal/trede;
- `MINIMUM_WAGE` — wettelijk minimumloon;
- `CUSTOM_SCALE` — huidige schaal + verplichte trede;
- `NO_PAYROLL` — geen payroll/salariscontext;
- `CAO_SCALE` bestaat technisch, maar is nog geen uitgewerkt zichtbaar productconcept.

De huidige schaaldefinities zijn administratiegebonden. Deze productfase migreert het **eigendom van salarisstructuurdefinities naar HR-groepniveau**. Salarissen en latere structuurtoekenningen blijven onderdeel van het looncontract/dienstverbanddomein en worden niet naar de medewerkerstam verplaatst.

## 3. Scope

### In scope

- HR-groepbrede catalogus van meerdere benoemde salarisstructuren.
- Twee structuurtypen: salarisbanden en schalen met tredes.
- Bestaande schaal+tredestructuur geschikt maken voor HR-groepniveau.
- Nieuw type salarisband.
- Structure identity die over revisies behouden blijft.
- Effectief gedateerde concept-, toekomstige, actieve en historische revisies.
- Eén gezamenlijke ingangsdatum per revisie voor alle onderliggende banden of schalen/tredes.
- Draft/publication lifecycle en immutable gepubliceerde historie.
- Bandberekeningen: minimum, midpoint/100%-punt, maximum, range spread, midpoint progression en overlap.
- Optionele open maximumgrens uitsluitend voor de hoogste salarisband.
- Rijker schaal+tredemodel: vrije tredecode/label, expliciete volgorde, bedrag en optionele progressionmetadata.
- Veilige migratie van bestaande administratiegebonden schaaldata.
- Koppeling vanuit een bestaande CAO naar nul, één of meerdere **logische salarisstructuren** die voor die CAO geldig/beschikbaar zijn.
- HR Admin UX voor catalogus, structuurdetail, revisie, editors, publicatiecontrole, historie, migratieconflicten en CAO-koppeling.

### Expliciet niet in scope

- Medewerker/looncontract koppelen of muteren; dit volgt in Productfase 2.
- Automatische selectie/mutatie van een salarisstructuur op een medewerker in deze productfase.
- Automatisch verhogen van een medewerker naar een volgende trede.
- CAO-regelmotor, CAO-inhoud importeren of CAO-data automatisch onderhouden.
- Excel/CSV/ODS import/export van salarisstructuren; dit wordt als afzonderlijke latere uitbreiding op de revisiepipeline ontworpen.
- PDF/AI-extractie van CAO-salaristabellen.
- Compensation Insights/populatiemetrics; dit volgt in Productfase 3.
- Salarisronde, manageradvies, merit matrix of vlootschouwkoppeling; dit volgt in Productfase 4.
- Marktbenchmarks.
- Payrollverwerking.
- Multi-currencyconversie of impliciete conversie tussen maand-, jaar- en uurbedragen.

## 4. Rollen, ownership en security

### SSR-001 — HR-groep ownership
Iedere salarisstructuur behoort tot exact één HR-groep. De definitie is niet langer eigendom van een afzonderlijke administratie.

### SSR-002 — HR Admin beheer
Alleen een bevoegde HR Admin/Tenant Admin binnen de HR-groep mag salarisstructuren aanmaken, wijzigen, publiceren of aan een CAO koppelen, conform het bestaande LiquidHR-permissionmodel.

### SSR-003 — Salarisgevoelige rechten
De bestaande scheiding tussen `salary-structure:write` en `salary:write` wordt tijdens implementatie expliciet herbeoordeeld en minimaal behouden. Migratie of nieuwe HR-groepownership mag geen ruimere toegang tot salarisbedragen veroorzaken.

### SSR-004 — Tenant/HR-groep isolatie
Geen gebruiker mag salarisstructuren, revisies, tredebedragen, bandbedragen of CAO-structuurkoppelingen uit een andere tenant/HR-groep lezen of muteren.

### SSR-005 — Geen administratie-eigendom
Administraties binnen dezelfde HR-groep mogen dezelfde salarisstructuurdefinitie later gebruiken zonder duplicatie van die definitie. Administratie blijft geen eigenaar van de structuur.

## 5. Domeinmodel en revisies

### SSR-006 — Twee structuurtypen
LiquidHR ondersteunt binnen dit configuratiedomein minimaal:

- `SCALE_WITH_STEPS` — schaal met tredes;
- `SALARY_BAND` — salarisband.

“Geen salarisstructuur” is géén structuurrecord; dit is later de afwezigheid van een structuurkoppeling op de salarisregel.

### SSR-007 — Benoemde logische salarisstructuur
Een salarisstructuur is een logisch, blijvend object met minimaal:

- verplicht `name`;
- optionele `code`;
- optionele `description`;
- vast `structure_type`;
- HR-groepownership;
- lifecycle/status passend bij bestaande LiquidHR-patronen.

Jaar- of revisiedata worden niet onderdeel van de structure identity. Een structuur als `VVT salarisschalen` blijft dezelfde structuur over opvolgende jaren.

### SSR-008 — Revisie en gezamenlijke ingangsdatum
Een salarisstructuur heeft nul of meerdere revisies. Iedere revisie heeft één gezamenlijke ingangsdatum voor de volledige inhoud van die revisie. Individuele banden, schalen of tredes krijgen binnen dezelfde revisie geen afwijkende ingangsdatum.

### SSR-009 — Geldige revisiehistorie
Opeenvolgende gepubliceerde revisies van dezelfde salarisstructuur mogen niet effectief overlappen. De ingangsdatum bepaalt welke revisie voor een datum geldt. De applicatie voorkomt onbedoeld overlappende geldigheid en bewaart eerdere revisies als historie.

### SSR-010 — Conceptrevisie
Een toekomstige revisie mag als concept worden voorbereid voordat de ingangsdatum is bereikt. Een concept mag worden gewijzigd totdat het wordt gepubliceerd.

### SSR-011 — Publiceren
Publiceren valideert de **volledige revisie atomair**. Een gedeeltelijk geldige revisie mag niet worden gepubliceerd.

### SSR-012 — Immutable historie
Na publicatie is een revisie niet rechtstreeks wijzigbaar. Historische, actieve en toekomstig gepubliceerde revisies blijven raadpleegbaar. Een correctie of nieuwe periode gebeurt via een nieuwe gecontroleerde revisie.

## 6. Salarisbanden

### SSR-013 — Basiselementen
Iedere normale salarisband binnen een revisie bevat:

- code/naam;
- expliciete sorteervolgorde;
- minimum;
- midpoint/reference point;
- maximum;
- optionele omschrijving.

### SSR-014 — Midpoint = 100%-punt
Het midpoint is het 100%-referentiepunt voor toekomstige compa-ratio-berekeningen. Minimum en maximum hebben geen universeel vast percentage ten opzichte van het midpoint.

### SSR-015 — Valuta en salarisbasis
Alle bedragen binnen één revisie gebruiken dezelfde valuta en dezelfde salarisbasis/frequentie volgens de bestaande LiquidHR-salarisconventies. Deze productfase introduceert geen impliciete conversie tussen maand-, jaar- of uurbedragen en doet geen aanname over bijvoorbeeld vakantiegeld wanneer dit niet uit de bestaande salarisbasis volgt.

### SSR-016 — Geldige ankerverhouding
Voor een normale gesloten band geldt:

`minimum < midpoint < maximum`

### SSR-017 — Open hoogste band
Uitsluitend de hoogste band binnen een revisie mag zonder maximum worden geconfigureerd.

### SSR-018 — Gevolgen open hoogste band
Bij een open hoogste band blijven minimum en midpoint verplicht. Range spread, toekomstige range penetration en toekomstige red-circle-status zijn voor die band niet berekenbaar; compa-ratio blijft later wel berekenbaar.

### SSR-019 — Drie invoermethoden
De UX ondersteunt drie manieren om een band te definiëren:

1. midpoint/100%-punt + range spread — standaard/aanbevolen;
2. minimum + maximum;
3. minimum + midpoint/100%-punt + maximum handmatig.

De gepubliceerde waarheid bestaat altijd uit de expliciete ankerwaarden minimum/midpoint/maximum, waarbij maximum alleen voor de hoogste open band nullable mag zijn.

### SSR-020 — Range spread
Voor een gesloten band:

`range_spread = (maximum - minimum) / minimum × 100%`

Range spread is afgeleid en wordt door LiquidHR berekend en getoond.

### SSR-021 — Midpoint + spread berekening
Bij invoer via midpoint + spread gebruikt LiquidHR:

`minimum = midpoint / (1 + spread / 2)`

`maximum = minimum × (1 + spread)`

Voorbeeld bij midpoint €5.000 en spread 40%:

- minimum ≈ €4.166,67;
- midpoint = €5.000;
- maximum ≈ €5.833,33.

De gebruiker ziet de berekende bedragen vóór opslaan/publiceren.

### SSR-022 — Minimum + maximum berekening
Bij invoer via minimum + maximum stelt LiquidHR het midpoint voor als:

`midpoint = (minimum + maximum) / 2`

Dit is een berekende suggestie. De gebruiker kan vóór publicatie overschakelen naar handmatige min/mid/max-invoer wanneer de organisatie een ander midpointbeleid hanteert.

### SSR-023 — Midpoint progression
Tussen twee opeenvolgende banden wordt midpoint progression berekend als:

`(midpoint_huidig - midpoint_vorig) / midpoint_vorig × 100%`

Dit is een afgeleide structuurmetric, geen verplicht invoerveld.

### SSR-024 — Overlap met vorige band
Voor twee opeenvolgende **gesloten** banden berekent LiquidHR overlap vanuit de breedte van de vorige band:

`overlap = (maximum_vorige_band - minimum_huidige_band) / (maximum_vorige_band - minimum_vorige_band) × 100%`

Regels:

- wanneer `minimum_huidige_band >= maximum_vorige_band`, toont LiquidHR `0% overlap`;
- een negatieve uitkomst wordt niet als negatieve overlap getoond;
- een eventuele gap mag apart als informatief signaal worden berekend;
- overlap is een informatieve structuurmetric en nooit op zichzelf een publicatieblokkade.

### SSR-025 — Geen harde marktdefaults
LiquidHR mag bruikbare invoerpresets voor range spread aanbieden, maar presenteert percentages niet als universele norm voor een functieniveau, sector of markt.

### SSR-026 — Bandidentiteit over revisies
Een logische band, bijvoorbeeld `Band 7`, moet over opvolgende revisies herkenbaar blijven zodat latere effectief gedateerde toekenningen en historie naar de juiste logische band kunnen verwijzen. Implementatie mag hiervoor stabiele identifiers gebruiken; de UX hoeft deze technische identiteit niet te tonen.

## 7. Schalen met tredes

### SSR-027 — Bestaand model behouden
Het bestaande concept van schaal + concrete trede + gepubliceerd salarisbedrag blijft leidend.

### SSR-028 — HR-groepmigratie
Bestaande schaaldefinities en revisies worden van administratie-eigendom naar HR-groep-eigendom gemigreerd zonder verlies van bestaande salaris-/employmenthistorie.

### SSR-029 — Variabel aantal tredes
Iedere schaal mag een eigen aantal tredes hebben. Er geldt geen productregel dat een schaal minimaal drie tredes moet bevatten.

### SSR-030 — Vrije tredecode
Een trede heeft een vrije, unieke code/label binnen de schaal, bijvoorbeeld `0`, `1`, `A1`, `A2` of `Aanloop`.

### SSR-031 — Expliciete tredevolgorde
De functionele volgorde van tredes wordt expliciet opgeslagen en is niet afhankelijk van numerieke of alfabetische interpretatie van het label.

### SSR-032 — Exact tredebedrag
Iedere gepubliceerde trede bevat een exact salarisbedrag. Informatieve formules mogen bestaan, maar vervangen nooit het gepubliceerde bedrag. Er geldt geen algemene eis dat tredebedragen “aaneensluitend” moeten zijn.

### SSR-033 — Progressionmetadata
Een schaal mag optionele standaardmetadata bevatten voor `Tijd tot volgende trede`. Een individuele trede mag die standaardwaarde overrulen.

### SSR-034 — Geen automatische progression in deze productfase
Progressionmetadata is in deze productfase uitsluitend configuratie/informatie. LiquidHR muteert hierdoor nog geen medewerker, trede of salarisregel automatisch.

### SSR-035 — Progressiontype voorbereid
Het model mag voorbereid zijn op minimaal handmatig, tijd-in-trede en vaste periodiekdatum, maar alleen gedrag dat expliciet in deze productfase is uitgewerkt mag actief worden gemaakt.

### SSR-036 — Eindtrede
Een trede kan functioneel eindtrede zijn doordat er geen volgende trede bestaat. Progressionmetadata mag dan geen automatische opvolger suggereren.

### SSR-037 — Bestaande `CAO_SCALE`
De bestaande `CAO_SCALE`-enum wordt niet opportunistisch hergebruikt voor salarisbanden en krijgt in deze productfase geen nieuwe betekenis zonder afzonderlijk productbesluit.

## 8. Revisielifecycle, publicatie en audit

### SSR-038 — Nieuwe revisie baseren op vorige
HR Admin kan een toekomstige revisie starten vanuit de laatst gepubliceerde revisie van dezelfde salarisstructuur zodat bestaande banden, schalen en tredes als uitgangspunt beschikbaar zijn.

### SSR-039 — Concept wijzigen
Conceptrevisies mogen worden aangepast zolang zij niet gepubliceerd zijn.

### SSR-040 — Gepubliceerd = immutable
Na publicatie zijn bedragen, structuurinhoud en ingangsdatum niet rechtstreeks wijzigbaar. Correcties of opvolgende bedragen gebeuren via een nieuwe revisie.

### SSR-041 — Publicatievalidaties salarisbandrevisie
Publicatie blokkeert minimaal bij:

- ontbrekende of ongeldige ingangsdatum;
- dubbele bandcode binnen de revisie;
- dubbele/ongeldige sorteervolgorde;
- min/mid/max die niet voldoen aan de regels;
- open maximum op een niet-hoogste band;
- ontbrekende verplichte bedragen;
- conflicterende effectieve revisieperiode van dezelfde salarisstructuur.

### SSR-042 — Publicatievalidaties schaal+trederevisie
Publicatie blokkeert minimaal bij:

- ontbrekende of ongeldige ingangsdatum;
- dubbele schaalcode binnen de revisie;
- dubbele tredecode binnen dezelfde schaal;
- ontbrekend tredebedrag;
- dubbele/ongeldige tredevolgorde;
- conflicterende effectieve revisieperiode van dezelfde salarisstructuur.

Niet blokkerend uitsluitend op basis van productregels zijn onder andere:

- een schaal met minder dan drie tredes;
- niet-aaneensluitende tredebedragen.

### SSR-043 — Waarschuwingen versus blokkades
Hoge/lage range spread, veel/weinig overlap, een gap tussen banden of opvallende midpoint progression zijn informatieve signalen. Zij blokkeren publicatie niet zolang de harde validatieregels geldig zijn.

### SSR-044 — Audit
Aanmaken/wijzigen van salarisstructuren, aanmaken/wijzigen/publiceren van revisies, CAO-structuurkoppelingen worden geaudit met actor, tijdstip, entiteit en relevante before/after-context volgens het bestaande LiquidHR-auditpatroon.

## 9. Migratie bestaande schalen

### SSR-045 — Geen verlies
Migratie van administratiegebonden schaaldefinities naar HR-groepniveau mag geen bestaande `employment_salaries`-koppeling, trede-ID-relatie of historische salariswaarde verbreken.

### SSR-046 — Duplicaten tussen administraties
Wanneer dezelfde HR-groep gelijknamige of inhoudelijk vergelijkbare schalen in meerdere administraties heeft, mag de migratie deze niet stilzwijgend samenvoegen. Er moet een deterministische en controleerbare migratiestrategie zijn.

### SSR-047 — Conflicten zichtbaar
Code-/naamconflicten of inhoudelijke verschillen die bij HR-groepconsolidatie ontstaan worden expliciet zichtbaar gemaakt voor veilige afhandeling. Mogelijke afhandeling kan zijn afzonderlijk behouden, veilig hernoemen of expliciet als dezelfde structuur behandelen. Bestaande data wordt nooit stilzwijgend overschreven.

### SSR-048 — Migratieverificatie en rollback
De implementatiefase bevat aantoonbare verificatie van minimaal:

- row counts;
- referential integrity;
- tenant/HR-groepisolatie;
- bestaande employment salary references;
- behoud van historische gepubliceerde revisies;
- rollback/herstelstrategie bij mislukte migratie.

Externe imports, valutaconversie of synchronisatie met AFAS/Nmbrs/Loket horen niet bij dit migratiescherm.

## 10. Berekeningen, precision en afgeleide waarheid

### SSR-049 — Decimal precision
Geldbedragen en percentages gebruiken expliciete decimal precision. Berekeningen gebruiken geen binary floating-point als bron van waarheid.

### SSR-050 — Centrale afronding
UI-weergave mag afronden voor leesbaarheid, maar opgeslagen ankerbedragen en validaties gebruiken consistente centrale afrondingsregels. De rekenservice is de bron voor dezelfde berekening in editor, publicatiecontrole en latere domeinconsumenten.

### SSR-051 — Geen verborgen afgeleide waarheid
Range spread, midpoint progression en overlap zijn afgeleide waarden. Minimum/midpoint/maximum en tredebedragen zijn de gepubliceerde salarisankerdata. Afgeleide metrics worden niet als onafhankelijke handmatig te onderhouden waarheid opgeslagen zonder expliciete technische reden.

## 11. UX requirements

### SSR-052 — Eén HR Admin-ingang
HR Admin beheert salarisstructuren vanuit één duidelijke stamdata/configuratie-ingang. Salarisbanden worden geen losstaande compensation-app.

### SSR-053 — Twee typen onmiddellijk herkenbaar
De UI maakt onmiddellijk zichtbaar of een salarisstructuur `Salarisbanden` of `Schalen & tredes` bevat.

### SSR-054 — Structure-first, revision-first UX
De UX-hiërarchie is:

`HR-groep → benoemde salarisstructuur → revisie → banden OF schalen/tredes`

HR Admin werkt niet primair met losse effectief gedateerde band- of trederijen.

### SSR-055 — Visuele salarisband
Een salarisband wordt visueel weergegeven met minimum, midpoint/100%-punt en maximum/open einde.

### SSR-056 — Structuurmetrics subtiel
Range spread, midpoint progression en overlap zijn zichtbaar maar secundair aan salarisbedragen, structuuridentiteit, revisiestatus en ingangsdatum.

### SSR-057 — Volledige preview vóór publicatie
HR Admin ziet vóór publicatie de volledige revisie, alle relevante banden of schalen/tredes, berekende waarden, harde validaties en waarschuwingen.

### SSR-058 — Geen onzichtbare autosave
Configuratie gebruikt expliciete acties zoals `Opslaan`, `Opslaan en sluiten`, `Annuleren` en `Publiceren`. Navigeren met niet-opgeslagen wijzigingen geeft een waarschuwing.

### SSR-059 — Nederlandse producttaal
De Nederlandse UI gebruikt begrijpelijke primaire labels. Vakterm mag subtiel als toelichting worden gebruikt, bijvoorbeeld `Bandbreedte (range spread)`. Gebruik in de primaire UX `revisie`, niet `set`, wanneer een versie van een benoemde salarisstructuur wordt bedoeld.

### SSR-060 — Accessibility en responsive
Status, fouten en waarschuwingen worden niet alleen via kleur gecommuniceerd. Editors, tabellen, dialogs en controls zijn keyboard-bedienbaar en correct gelabeld. Reorder van tredes is ook zonder drag-and-drop mogelijk. Complexe configuratie is desktop-first maar blijft bruikbaar op tablet en breekt niet op mobiel.

## 12. Meerdere salarisstructuren en CAO-relatie

### SSR-061 — Meerdere structuren per HR-groep
Een HR-groep mag nul, één of meerdere benoemde salarisstructuren van beide structuurtypen hebben. Meerdere salarisbandstructuren en meerdere schaal+tredestructuren mogen naast elkaar bestaan.

### SSR-062 — Structure type blijft stabiel
Een salarisstructuur heeft één structure type. Een bestaande structuur wordt niet van `SCALE_WITH_STEPS` naar `SALARY_BAND` of andersom geconverteerd als gewone revisiewijziging. Een andere beloningslogica wordt als andere salarisstructuur gemodelleerd.

### SSR-063 — CAO ↔ salarisstructuur is many-to-many
Een bestaande CAO binnen dezelfde HR-groep kan nul, één of meerdere salarisstructuren als geldig/beschikbaar markeren. Een salarisstructuur kan aan nul, één of meerdere CAO’s gekoppeld zijn.

### SSR-064 — CAO koppelt aan logische structuur, niet aan revisie
De CAO-relatie verwijst naar de blijvende salarisstructuur. HR kiest in CAO-beheer nooit een specifieke jaarlijkse revisie. De effectieve datum bepaalt later welke gepubliceerde revisie van de gekoppelde structuur geldt.

### SSR-065 — CAO-koppeling is beschikbaarheidsfilter, geen salaristoekenning
De CAO-relatie betekent uitsluitend dat de salarisstructuur later beschikbaar is binnen een looncontract waarop die CAO van toepassing is. De koppeling kent geen schaal, trede, band of salarisbedrag automatisch toe.

### SSR-066 — Alleen eigen HR-groep koppelbaar
CAO-beheer toont en accepteert alleen salarisstructuren uit dezelfde HR-groep. Autorisatie en HR-groepisolatie worden server-side afgedwongen.

### SSR-067 — Revisiestatus zichtbaar in CAO-beheer
Bij een koppelbare salarisstructuur mag de UI subtiel de huidige actieve/gepubliceerde revisie en ingangsdatum tonen. Wanneer geen actieve gepubliceerde revisie bestaat, wordt dit als waarschuwing getoond; dit verandert de relatie niet automatisch.

### SSR-068 — Toekomstig contractgedrag als domeincontract voor Productfase 2
Deze productfase bouwt de looncontractflow nog niet, maar bewaart de volgende productintentie voor Productfase 2:

- bij één voor de gekozen CAO geldige salarisstructuur kan LiquidHR die zonder extra keuzestap voorselecteren;
- bij meerdere geldige structuren wordt de keuze gefilterd tot die structuren;
- bij nul CAO-koppelingen geldt de CAO niet als structuurfilter en blijft de normale HR-groepcatalogus/geen-structuurroute beschikbaar;
- de effectieve datum van de salarisregel bepaalt de geldende gepubliceerde revisie.

Dit gedrag is context voor Productfase 2 en geen browser-acceptancecriterium voor deze productfase.

### SSR-069 — Geen CAO-module uitbreiden buiten de koppeling
Deze productfase gebruikt het bestaande CAO-beheer als host voor de sectie `Salarisstructuren`. Het introduceert geen nieuwe CAO-database, CAO-regelmotor, automatische CAO-detectie of externe CAO-import.

## 13. Acceptance criteria op productniveau

Deze productfase is functioneel compleet wanneer:

1. HR Admin binnen één HR-groep meerdere benoemde salarisstructuren van beide typen kan beheren.
2. Iedere structuur een eigen concept-, actieve/toekomstige en historische revisielifecycle heeft zonder verlies van structure identity.
3. HR Admin een volledige salarisbandrevisie met één ingangsdatum kan configureren, valideren en publiceren.
4. Gesloten banden en een optionele open hoogste band correct worden ondersteund.
5. Range spread, midpoint progression en overlap deterministisch volgens deze requirements worden berekend.
6. Schaal+tredestructuren vrije tredelabels, expliciete volgorde, exacte bedragen en optionele progressionmetadata ondersteunen.
7. Gepubliceerde revisies immutable en historisch raadpleegbaar zijn.
8. Bestaande administratiegebonden schaalhistorie veilig naar HR-groepownership kan worden gemigreerd zonder employment salary references te verbreken.
9. Een bestaande CAO nul, één of meerdere logische salarisstructuren uit dezelfde HR-groep kan koppelen, zonder een revisie of salaris automatisch toe te kennen.
10. Tenant/HR-groepisolatie, salary permissions en audit aantoonbaar intact of aangescherpt zijn.
11. De UI de definitieve schermset SS-001 t/m SS-011 volgt zonder Productfase 2-, 3- of 4-functionaliteit te activeren.
12. Import/export, PDF/AI-import en externe CAO-datafeeds niet stilzwijgend als werkende functionaliteit in deze productfase worden gepresenteerd.

## 14. Traceability-overzicht requirements

- SSR-001–005: ownership, rollen en security
- SSR-006–012: logical structure, revisies en historie
- SSR-013–026: salarisbanden en bandberekeningen
- SSR-027–037: schaal + tredes
- SSR-038–044: revisielifecycle, publicatie en audit
- SSR-045–048: migratie
- SSR-049–051: precision en afgeleide waarheid
- SSR-052–060: UX
- SSR-061–069: meerdere benoemde structuren en CAO-relatie

## 15. Vervolgfasen — alleen context, niet bouwen in deze productfase

**Productfase 2 — Looncontract & medewerkerflows**
Effectief gedateerde koppeling van geen structuur, salarisband of schaal+trede aan salarisregels; CAO-filtering; voorselectie bij één geldige structuur; wizard- en mutatieflows.

**Productfase 3 — Salaris Insights**
Compa-ratio, range penetration, interne salarispositie/peer ratio, onder/boven band (green/red-circle context), populatie- en salarisanalyses met filters. Metrics worden subtiel maar zichtbaar gemaakt.

**Productfase 4 — Salarisronde**
HR-campagne, HR-initieel advies, manageradvies, HR-eindbesluit, budgetimpact, optionele afgesloten vlootschouw/performancecontext, merit-richtlijnen, resultatenoverzicht en export. Medewerkers met schaal+trede vallen buiten Salarisronde V1.

**Latere uitbreiding — Structuurimport/export**
Export van bestaande schaal+trederevisie naar een bewerkbaar bestand en import als nieuwe conceptrevisie met mapping, diff/preview, validatie en expliciete publicatie. Eventuele PDF/AI-extractie of externe CAO-data-API’s mogen later dezelfde genormaliseerde conceptrevisiepipeline voeden.
