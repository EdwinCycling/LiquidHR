# LiquidHR — Salarisstructuren & Salarisbanden
## UX Reference — Salarisstructuren

**Status:** UX FROZEN / gereed voor implementatieplanning
**Datum:** 14 augustus 2026
**Bron:** `LIQUIDHR_SALARY_STRUCTURES_PRODUCT_REQUIREMENTS.md` (`SSR-001` t/m `SSR-069`)
**Visuele referentie:** definitieve Stitch-set SS-001 t/m SS-011 van 14 augustus 2026

> Deze UX Reference beschrijft schermdoelen, informatiehiërarchie en interacties. De Product Requirements zijn leidend voor functioneel gedrag, security, berekeningen en scope. Stitch is visuele referentie en introduceert geen zelfstandige productlogica.

## 1. Ontwerpdoel

Ontwerp en implementeer binnen de bestaande LiquidHR HR Admin-app één professionele, eenvoudige configuratie-ervaring voor **meerdere benoemde salarisstructuren**.

Er zijn twee structuurtypen:

1. **Salarisbanden** — een salarisstructuur bevat per revisie meerdere banden met minimum, 100%-punt en maximum/open hoogste band.
2. **Schalen & tredes** — een salarisstructuur bevat per revisie meerdere schalen met concrete tredes en vaste gepubliceerde bedragen.

Een HR-groep kan meerdere structuren van beide typen naast elkaar hebben. “Geen salarisstructuur” is geen configuratiestructuur en krijgt geen derde tab.

De primaire mentale hiërarchie is:

`HR-groep → benoemde salarisstructuur → revisie → banden OF schalen/tredes`

Voorbeelden van structure identity:

- `VVT salarisschalen`
- `Kantoorschalen`
- `Engineering bands`
- `Managementbanden`

Jaarlijkse wijzigingen zijn revisies van deze structuren en geen nieuwe losstaande structuren.

De UX voelt als bestaand LiquidHR-stamdatabeheer, niet als een aparte compensation-app.

## 2. Designrichting

Gebruik het bestaande LiquidHR-designsystem en de definitieve Stitch-compositie:

- bestaande app-shell en navigatie;
- lichte hoofdcontent en bestaande sidebar;
- compacte, professionele SaaS-layout;
- bedragen en structuur dominant;
- metrics secundair;
- subtiele borders en beperkte kleur;
- maximaal één dominante primaire CTA per context;
- Nederlandse primaire labels;
- expliciete save/publish-acties;
- desktop-first voor complexe configuratie, maar responsive zonder kapotte mobiele layout;
- geen dashboard-overload en geen nieuwe losstaande visuele stijl.

Gebruik de laatste Stitch-set als compositie- en stylingreferentie. Product Requirements blijven boven Stitch staan wanneer voorbeelddata of voorbeeldberekeningen afwijken.

## 3. Navigatie en informatiearchitectuur

Voorkeursingang:

`Instellingen / Stamgegevens → Salarisstructuren`

De bestaande route `master-data/salary-scales` mag tijdens implementatie worden genormaliseerd naar de bredere productbetekenis.

Binnen `Salarisstructuren` zijn twee views/tabs:

- **Salarisbanden**
- **Schalen & tredes**

Onder iedere tab staat een catalogus van **benoemde salarisstructuren** van dat type.

Geen derde tab `Geen structuur`.

Een structuurdetail toont vervolgens de revisielifecycle van exact die structuur.

Een aparte CAO-beheercontext bevat de sectie `Salarisstructuren` voor de CAO ↔ structuurkoppeling; dit is geen derde ingang voor structuurbeheer.

## 4. Terminologie

Gebruik in primaire Nederlandse UI:

- `Salarisstructuren`
- `Salarisbanden`
- `Schalen & tredes`
- `Salarisstructuur`
- `Revisie`
- `Nieuwe salarisstructuur`
- `Nieuwe revisie voorbereiden`
- `Concept verder bewerken`
- `Ingangsdatum`
- `Minimum`
- `100%-punt`
- `Maximum`
- `Geen maximum`
- `Bandbreedte`
- `Midpoint-stijging`
- `Overlap met vorige band`
- `Tijd tot volgende trede`
- `Gepubliceerd`
- `Concept`
- `Toekomstig`
- `Historie`
- `Gekoppeld`

Gebruik **niet** `set` als primaire term wanneer een versie van een benoemde salarisstructuur wordt bedoeld.

Engelse vaktermen zoals `range spread`, `midpoint progression`, `compa-ratio` of `pay range` mogen alleen als tooltip/helpterm waar relevant.

## 5. Referentieschermen SS-001 t/m SS-011

### SS-001 — Salarisstructuren — overzicht

**Doel**
HR Admin ziet welke benoemde salarisstructuren binnen de HR-groep bestaan en welke revisie nu/toekomstig geldt.

**Header**
- `Salarisstructuren`
- toelichting dat definities HR-groepbreed gelden;
- tabs `Salarisbanden` en `Schalen & tredes`.

**Per salarisstructuur**
- naam;
- optionele code indien nuttig;
- huidige revisiestatus;
- huidige ingangsdatum;
- eventuele toekomstige concept/gepubliceerde revisie;
- aantal/indicatie CAO-koppelingen;
- actie `Bekijken`.

**Primaire CTA**
- `Nieuwe salarisstructuur`

Nieuwe structuur bevat minimaal naam; optioneel code en omschrijving. Type volgt uit de actieve tab.

**Niet tonen**
- medewerkers;
- compa-ratio;
- salarisronde;
- marktbenchmark;
- import/export als werkende functie in deze productfase.

**Traceability:** SSR-006, SSR-007, SSR-052–054, SSR-059, SSR-061–062.

---

### SS-002 — Salarisbandstructuur — detail & revisies

**Doel**
HR Admin beheert één benoemde salarisbandstructuur en begrijpt de revisiestatus.

Voorbeeld:

`Engineering bands`
`Salarisbanden`

**Header/metadata**
- structure identity;
- type;
- huidige gepubliceerde revisie + ingangsdatum;
- eventuele toekomstig gepubliceerde revisie;
- eventuele conceptrevisie;
- ingang naar historie.

**Primaire actie**
- `Nieuwe revisie voorbereiden`
- wanneer een concept bestaat: `Concept verder bewerken`

**Revisie-inhoud**
Compacte tabel/list met per band:
- volgorde;
- bandcode/naam;
- minimum;
- 100%-punt;
- maximum of `Geen maximum`;
- bandbreedte;
- midpoint-stijging t.o.v. vorige band;
- overlap t.o.v. vorige band;
- actie `Bewerken` in conceptmodus.

Bedragen zijn dominant; metrics subtiel.

**Traceability:** SSR-007–012, SSR-013–026, SSR-038–040, SSR-054–057.

---

### SS-003 — Salarisband bewerken — 100%-punt + bandbreedte

**Doel**
Standaard en eenvoudig invoerpad voor HR.

Gebruik een drawer/modal/panel binnen de revisie-editor.

**Velden**
- code/naam;
- optionele omschrijving;
- `100%-punt`;
- `Bandbreedte`;
- live berekend minimum;
- live berekend maximum;
- checkbox `Deze hoogste band heeft geen maximum` alleen als de band werkelijk hoogste is.

**Berekening**
Bij 100%-punt + bandbreedte gelden de Product Requirements:

`minimum = midpoint / (1 + spread / 2)`

`maximum = minimum × (1 + spread)`

Voorbeeld 100%-punt €5.000 en bandbreedte 40%:

`€4.166,67 MIN ├──────── ● €5.000 / 100% ────────┤ €5.833,33 MAX`

Geen vaste 80%- of 120%-labels afleiden.

**Secundaire actie**
- `Andere invoermethode`

**Traceability:** SSR-013–021, SSR-049–051, SSR-055–056.

---

### SS-004 — Salarisband bewerken — alternatieve invoermethoden

**Doel**
Power users kunnen alternatieve ankerinvoer gebruiken.

**Segment/control**
- `100%-punt + bandbreedte` — aanbevolen;
- `Minimum + maximum`;
- `Handmatig minimum / 100%-punt / maximum`.

Bij `Minimum + maximum` stelt LiquidHR het rekenkundige midpoint voor. Maak zichtbaar dat dit een **suggestie** is; gebruiker kan overschakelen naar handmatige ankerinvoer.

Toon live en secundair:
- bandbreedte;
- midpoint-stijging;
- overlap met vorige band;
- niet-blokkerende waarschuwingen.

Gebruik `Minimum | 100%-punt | Maximum`; toon nooit automatisch `Minimum (80%)` of `Maximum (120%)`.

**Traceability:** SSR-019–025, SSR-043, SSR-049–051, SSR-056.

---

### SS-005 — Publicatiecontrole salarisbandrevisie

**Doel**
HR Admin ziet exact wat op de gekozen ingangsdatum wordt gepubliceerd.

Gebruik een ruime reviewpagina/dialog.

**Toon**
- salarisstructuurnaam;
- nieuwe revisie-ingangsdatum;
- aantal banden;
- volledige compacte tabel met **alle** banden;
- minimum / 100%-punt / maximum;
- open topband indien van toepassing;
- bandbreedte/midpoint-stijging/overlap waar nuttig;
- blokkerende fouten;
- informatieve waarschuwingen afzonderlijk;
- uitleg dat de revisie na publicatie niet rechtstreeks wijzigbaar is.

**Copy**
Gebruik effective-dated taal:

> Deze revisie wordt geldig vanaf [datum]. De vorige revisie blijft als historie beschikbaar.

Gebruik niet dat de revisie de actieve structuur “overschrijft”.

**Publicatiegedrag**
- `Publiceren` alleen disabled bij harde blokkades.
- Hoge/lage overlap, bandbreedte, gap of midpoint-stijging zijn waarschuwingen en blokkeren niet.
- De voorbeeldberekeningen moeten exact dezelfde centrale formules gebruiken als SS-002/003/004.

**Salarisbasis**
Toon alleen bestaande betrouwbare salarisbasisinformatie, bijvoorbeeld `EUR · maandbasis`, wanneer die uit het bestaande domein komt. Geen impliciete tekst `incl. vakantiegeld`.

**Traceability:** SSR-011–012, SSR-015–025, SSR-040–043, SSR-049–051, SSR-057–059.

---

### SS-006 — Historie salarisstructuur

**Doel**
HR Admin ziet de volledige revisiehistorie van één benoemde salarisstructuur.

Voorbeeld:

`Engineering bands — historie`

Timeline/list per revisie:
- ingangsdatum;
- status `Toekomstig`, `Actief/Gepubliceerd`, `Historisch`;
- publicatiedatum;
- actor indien passend bij bestaand pattern;
- `Bekijken`.

Gepubliceerde revisies openen read-only.

De structuur zelf blijft dezelfde identity; historie wordt niet als reeks losse salarisstructuren gepresenteerd.

**Traceability:** SSR-007–012, SSR-040, SSR-044, SSR-054.

---

### SS-007 — Schaal+tredestructuur — detail & revisies

**Doel**
Het bestaande schaal/tredemodel krijgt dezelfde structure/revision-lifecycle als salarisbanden.

Voorbeeld:

`VVT salarisschalen`
`Schalen & tredes`

**Header**
- huidige revisie;
- ingangsdatum;
- toekomstige revisie/concept;
- historie.

**Per schaal**
- code/naam;
- aantal tredes;
- laagste tredebedrag;
- hoogste tredebedrag;
- optionele progressionindicatie;
- `Bewerken`.

**CTA**
- `Nieuwe revisie voorbereiden`
- of `Concept verder bewerken`.

Gebruik dezelfde revisielifecycle als bij salarisbanden.

Geen exportknop als werkende deze productfase-feature; import/export wordt later apart ontworpen.

**Traceability:** SSR-007–012, SSR-027–040, SSR-052–054, SSR-061.

---

### SS-008 — Schaal bewerken — tredes

**Doel**
HR Admin beheert binnen een conceptrevisie een schaal met een variabel aantal tredes.

**Boven**
- schaalcode/naam;
- optionele omschrijving;
- optionele standaard `Tijd tot volgende trede`.

**Tredetabel**
- drag/reorder handle;
- daarnaast toegankelijke up/down reorderacties;
- `Trede` als vrij label;
- salarisbedrag;
- optionele afwijkende tijd tot volgende trede;
- verwijderen/bewerken;
- `Trede toevoegen`.

Maak expliciet:
- het label bepaalt niet de volgorde;
- een schaal mag minder dan drie tredes hebben;
- er is geen automatische medewerkerprogressie in deze productfase.

**Traceability:** SSR-029–036, SSR-049–050, SSR-058–060.

---

### SS-009 — Publicatiecontrole schalen & tredes

**Doel**
HR Admin controleert de volledige schaal+trederevisie vóór publicatie.

Toon:
- salarisstructuurnaam;
- revisie-ingangsdatum;
- alle schalen;
- aantal tredes;
- laagste/hoogste bedragen;
- progressionmetadata waar relevant;
- harde fouten en afzonderlijke waarschuwingen.

**Harde validatievoorbeelden**
- dubbele schaalcode;
- dubbele tredecode binnen schaal;
- ontbrekend tredebedrag;
- ongeldige/dubbele tredevolgorde;
- ontbrekende/ongeldige ingangsdatum;
- conflicterende revisieperiode.

Gebruik label **`Geldige tredevolgorde`**, niet `Geldige volgorde bedragen`.

Niet als harde validatie:
- minimaal drie tredes;
- verplicht aaneensluitende bedragen.

**Traceability:** SSR-011–012, SSR-027–043, SSR-057–060.

---

### SS-010 — Migratie bestaande salarisstructuren

**Doel**
Beheerscherm voor menselijke keuze wanneer bestaande administratiegebonden schaaldata niet veilig automatisch naar HR-groepownership kan worden geconsolideerd.

Dit is geen dagelijkse HR-flow en staat niet prominent in navigatie.

**Toon per conflict**
- bronadministratie;
- bestaande schaalcode/naam;
- conflictreden;
- relevante inhoudelijke verschillen, bijvoorbeeld tredecodes, aantallen tredes of bedragen;
- veilige voorgestelde actie.

**Mogelijke acties**
- `Als afzonderlijke structuur behouden`;
- `Naam/code aanpassen`;
- `Als dezelfde structuur behandelen` alleen na expliciete HR-bevestiging en wanneer technisch veilig;
- `Later beoordelen`.

Geen automatische merge zonder expliciete zekerheid.

Gebruik geen AFAS/Nmbrs/Loket-, valuta- of externe importsynchronisatie als voorbeeld. Dit scherm gaat alleen over interne LiquidHR-consolidatie van administratie- naar HR-groepownership.

**Traceability:** SSR-028, SSR-045–048, SSR-060.

---

### SS-011 — CAO — geldige salarisstructuren

**Doel**
Binnen de bestaande HR Admin-configuratie van een CAO kiest HR welke logische salarisstructuren later voor die CAO beschikbaar/geldig zijn.

Dit is **geen nieuwe CAO-module**.

Voorbeeld:

`CAO VVT`

Sectie/tab:

`Salarisstructuren`

Intro:

> Selecteer welke salarisstructuren beschikbaar zijn voor medewerkers waarop deze CAO van toepassing is.

**Groepering**
1. `Schalen & tredes`
2. `Salarisbanden`

Per koppelbare structuur:
- checkbox/selectie;
- naam;
- type is impliciet door groep;
- huidige actieve/gepubliceerde revisie + ingangsdatum subtiel;
- waarschuwing `Geen actieve revisie` indien van toepassing;
- label `Gekoppeld` wanneer geselecteerd.

**Acties**
- `Opslaan`
- `Annuleren`

**Belangrijk**
- Geen revisiekeuze in dit scherm.
- Relatie is `CAO ↔ logische salarisstructuur`.
- Geen schaal, trede, band of salaris automatisch toekennen.
- Alleen structuren uit dezelfde HR-groep tonen.
- Geen CAO-import, CAO-regelmotor of automatische CAO-detectie ontwerpen.

**Toekomstige Productfase 2-context, niet bouwen in deze productfase**
- 1 geldige structuur → kan zonder extra keuzestap worden vooringevuld;
- meerdere → gefilterde keuze;
- 0 koppelingen → CAO werkt niet als structuurfilter;
- effectieve salarisregeldatum bepaalt geldende revisie.

**Traceability:** SSR-002, SSR-004, SSR-044, SSR-063–069.

## 6. Visuele representatie salarisband

De bandvisual blijft compact en ondersteunend.

Gesloten band:

`€4.166,67 MIN ├────────── ● €5.000 / 100% ──────────┤ €5.833,33 MAX`

Open hoogste band:

`€7.500 MIN ├────────── ● €9.000 / 100% ─────────────→ Geen maximum`

Gebruik naast kleur altijd tekst/icoon/positie.

De 100%-positie is een semantisch referentiepunt; minimum/maximum krijgen geen vaste 80%/120%-labels tenzij die percentages daadwerkelijk uit de concrete ankerbedragen zijn berekend en bewust als secundaire informatie worden getoond.

## 7. Structuurmetrics en rekenconsistentie

Toon in deze productfase uitsluitend structuurmetrics:

- **Bandbreedte** (`range spread` in tooltip/help);
- **Midpoint-stijging** (`midpoint progression` als vakterm);
- **Overlap met vorige band**;
- eventueel een informatieve **gap** wanneer opeenvolgende gesloten banden niet overlappen.

Gebruik exact de centrale Product Requirements-formules.

### Overlap

`overlap = (maximum_vorige_band - minimum_huidige_band) / (maximum_vorige_band - minimum_vorige_band) × 100%`

Als de huidige band begint op of boven het maximum van de vorige band:

`Overlap = 0%`

Overlap is nooit op zichzelf een blokkerende fout.

Niet tonen in deze productfase:
- compa-ratio;
- range penetration van medewerkers;
- peer/interne salarispositie;
- green/red-circle medewerkerstatus;
- medewerkerpopulaties;
- merit matrix.

## 8. Validatiegedrag

### Blokkerende fouten

Voorbeelden:
- minimum >= 100%-punt;
- 100%-punt >= maximum;
- ontbrekend verplicht bedrag;
- open maximum op een niet-hoogste band;
- dubbele band-/schaalcode binnen een revisie;
- dubbele tredecode binnen schaal;
- ongeldige/dubbele volgorde;
- ontbrekende/ongeldige ingangsdatum;
- conflicterende effectieve revisie.

Toon fout dicht bij het veld én in de publicatiesamenvatting.

### Niet-blokkerende signalen

Voorbeelden:
- opvallend brede/smalle bandbreedte;
- opvallend hoge/lage midpoint-stijging;
- zeer hoge/lage overlap;
- gap tussen opeenvolgende banden.

Formuleer neutraal, bijvoorbeeld:

`Controleer deze waarde`

en niet `Fout` wanneer de Product Requirements geen blokkade voorschrijven.

## 9. Draft/publication UX

- Geen onzichtbare autosave.
- `Opslaan` bewaart conceptwijzigingen.
- `Opslaan en sluiten` bewaart en keert terug.
- `Annuleren` verwerpt niet-opgeslagen wijzigingen na bevestiging indien nodig.
- Navigeren met dirty state geeft waarschuwing.
- `Publiceren` is alleen disabled wanneer harde blokkades bestaan.
- Na publicatie wordt de revisie read-only.
- Wijzigen van gepubliceerde data gebeurt via `Nieuwe revisie voorbereiden`.
- De vorige revisie wordt historisch behouden; gebruik niet het woord `overschrijven`.

## 10. Responsive gedrag

Desktop is primair. Bij kleinere breedte:

- behoud minimum/100%/maximum als compacte bandvisual;
- secundaire metric-kolommen mogen naar detail/drawer verschuiven;
- bedragen, structuuridentiteit, status en ingangsdatum blijven zichtbaar;
- editors worden single-column;
- tabellen worden waar nodig cards/lijsten in plaats van horizontaal onbruikbare megatabellen;
- CAO-structuurkeuzes blijven per item duidelijk selecteerbaar.

## 11. Accessibility

- Alle inputs hebben labels en foutassociatie.
- Reorder van tredes werkt zonder drag-and-drop.
- Dialogs/drawers hebben correcte focus trap en focus return.
- Status en validatie worden niet alleen via kleur aangegeven.
- Geld- en percentagevelden hebben begrijpelijke invoer/formatting.
- Gepubliceerde read-only state is semantisch duidelijk.
- Checkbox/selectie in SS-011 heeft toegankelijke structuur- en statuslabels.

## 12. Wat niet in de definitieve schermset voor deze productfase hoort

Niet ontwerpen/presenteren als werkende functionaliteit in deze productfase:

- medewerkerselectie of medewerkerkoppeling;
- looncontractwizard;
- CAO-automatisering buiten de structuurkoppeling;
- automatische tredeverhoging;
- compa-ratio dashboards;
- range penetration/peer ratio/green-red circle op medewerkers;
- salarisinzichten;
- salarisronde/campagne;
- managerflows;
- vlootschouw/9-grid;
- merit matrix;
- AI-salarisadvies;
- marktbenchmarking;
- payrollverwerking;
- multi-currencyconversie;
- Excel/CSV/ODS import/export;
- PDF/AI CAO-import;
- externe CAO-datafeed.

## 13. Requirement → scherm traceability

| Requirements | Primair schermbewijs |
|---|---|
| SSR-001–005 | SS-001, SS-010, SS-011 |
| SSR-006–012 | SS-001, SS-002, SS-006, SS-007 |
| SSR-013–026 | SS-002, SS-003, SS-004, SS-005 |
| SSR-027–037 | SS-007, SS-008, SS-009 |
| SSR-038–044 | SS-002, SS-005, SS-006, SS-007, SS-009, SS-011 |
| SSR-045–048 | SS-010 |
| SSR-049–051 | SS-002, SS-003, SS-004, SS-005, SS-008, SS-009 |
| SSR-052–060 | SS-001 t/m SS-011, afhankelijk van requirement |
| SSR-061–062 | SS-001, SS-002, SS-007 |
| SSR-063–069 | SS-011 |

## 14. UX freeze

SS-001 t/m SS-011 vormen samen de definitieve referentieschermset voor deze productfase.

Implementatie mag bestaande LiquidHR-componenten en responsive patronen gebruiken en hoeft Stitch niet pixel-perfect te kopiëren. De functionele flow, informatiehiërarchie, productterminologie, revisiemodel, rekenregels, validatieclassificatie en autorisatiegrenzen mogen echter niet vanuit Stitch of tijdens implementatie opnieuw worden ontworpen zonder expliciet productbesluit.

De Product Requirements zijn de normatieve productbron. Deze UX Reference is de normatieve scherm-/flowreferentie. De definitieve Stitch-set is de visuele compositiereferentie.
