# Verlofopbouwinrichting

Status: leidend voor de inrichting van het HR-beheerscherm, 2026-08-07.

## Doel

Een HR-beheerder kiest eerst hoe een verloftype wordt begrensd. Alleen de velden die bij die keuze horen worden daarna getoond. De inrichting is administratiegebonden, server-side gevalideerd en geschikt voor opvolgende versies.

## 1. Eerste keuze: type verloopbouw

De beperking van een verloftype kent precies deze opties:

| Keuze | Gedrag |
|---|---|
| Onbeperkt | Geen jaarlijkse limiet en geen opbouwregelvelden. |
| Verlofopbouw | Toont de opbouwregel met type, frequentie, moment, uren/minuten, vervaltermijn en pauzetypen. |
| Beperkt in uren per jaar | Toont uitsluitend het jaarlijkse aantal uren. |
| Beperkt in uren per jaar (deeltijdfactor) | Toont uitsluitend het voltijdse jaarlijkse aantal uren; de berekening schaalt met de parttimefactor van het dienstverband. |
| Beperkt door overuren | Toont een multi-selectie van één of meer actieve overurentypen. |

De oude keuze voor `Soort verlof` hoort niet bij deze inrichting en wordt niet getoond.

## 2. Opbouwregel

Bij `Verlofopbouw` kiest de gebruiker bij `Type` uit:

- `Contracturen`: bereken op basis van contracturen en pro rata voor parttime medewerkers.
- `Werkuren`: bereken op basis van ingediende werkuren en toon direct daaronder een multi-selectie van actieve, niet-informatieve werkurentypen.

De frequentie is eerst `Verloningsperiode` of `Specifieke periode`. Bij een specifieke periode kiest de gebruiker `4-wekelijks`, `Maandelijks` of `Jaarlijks`. De opbouwhoeveelheid wordt uitgelijnd als uren, minuten en waar relevant seconden per gekozen periode of per gewerkt uur. De vervaltermijn wordt weergegeven als maanden, bijvoorbeeld `6 Maanden`.

De lijst met opbouwregels heeft één actie: `Opbouwregel toevoegen`. Deze maakt een nieuwe regel met de waarden van de laatste bestaande regel als voorstel; de effectieve-datumsluiting blijft intern behouden. Een bestaande regel is volledig klikbaar en opent direct `Opbouwregel wijzigen`, zonder opvolgeractie of opvolgertekst. Zowel toevoegen als wijzigen heeft `Annuleren`.

## 3. Gegevenscontract

- `leave_types.entitlement_mode` bevat de vijf actieve keuzes: `ACCRUAL`, `UNLIMITED`, `ANNUAL_HOURS_CAP`, `ANNUAL_HOURS_FTE_CAP` en `OVERTIME_HOURS`.
- `ANNUAL_HOURS_CAP` gebruikt alleen `annual_hours_cap`.
- `ANNUAL_HOURS_FTE_CAP` gebruikt alleen `annual_hours_fte_cap` en vereist voor berekeningen een geldige parttimefactor.
- `OVERTIME_HOURS` gebruikt de koppeltabel `leave_type_overtime_work_hours` en vereist ten minste één overurentype.
- De koppeltabel is tenant- en HR-groepgebonden, heeft RLS, passende policies, grants, audit en een samengestelde unieke sleutel.
- Legacy-testregels met de oude weekfactor zijn naar de deeltijdfactor-keuze gerepareerd. De oude enumwaarde kan als PostgreSQL-compatibiliteitsresidu bestaan, maar mag niet meer in actieve data of nieuwe mutaties voorkomen.

## 4. Acceptatiecriteria

- Een volledige catalogusrij is klikbaar, heeft een handcursor en opent het wijzigingsscherm; Enter en spatie werken ook.
- Een volledige opbouwregelkaart is klikbaar, heeft een handcursor en opent het wijzigingsscherm; Enter en spatie werken ook.
- `Opbouwregel toevoegen` neemt de waarden van de laatste regel over; `Annuleren` verlaat de editor zonder opslag. De vervaltermijn toont altijd de eenheid `Maanden`.
- Bestaande verloftypen zijn niet read-only. Naam, kleur, algemene instellingen en beperking kunnen worden gewijzigd en opgeslagen.
- Een naamveld blijft een strakke tekstinvoer van één regel.
- De profielkeuze en de oude lijst met gekoppelde werkurentypen onderaan de beperking zijn vervangen door de nieuwe `Type`-keuze en conditionele selectie.
- In elk beperkingstype zijn geen irrelevante velden zichtbaar.
- Bij een uitzondering zonder verlofopbouw is geen vervaltermijn zichtbaar, wordt geen vervalwaarde opgeslagen en ontbreekt deze ook in de lijst en samenvatting.
- Samenvattingen zijn leesbare zinnen. Het aantal werkurentypen wordt alleen getoond als de opbouw op ingediende werkuren is gebaseerd.
- Naam is verplicht en mag binnen dezelfde HR-groep niet dubbel voorkomen, onafhankelijk van hoofdletters of extra spaties.
- Server en database weigeren ontbrekende limieten, ontbrekende overurentypen, verboden combinaties en een FTE-berekening zonder parttimefactor.

## 5. Afbakening

Deze slice levert de inrichting en de servercontracten voor de vijf keuzes. De volledige toekomstige opbouwprojectie en de daadwerkelijke berekening van verlof uit overuren zijn geen onderdeel van deze inrichting en blijven afzonderlijke engine-scope.

## 6. Werkuren en overuren

Werkuren en overuren gebruiken dezelfde beperking-keuze: `Onbeperkt`, `Max. uren per jaar`, `Max. uren per maand` of `Max. uren per week (contract x factor)`. Het oude veld `Werkurentype` wordt niet meer als beheerkeuze getoond.

Beide typen hebben op Basisinformatie de ja/nee-instellingen `Goedkeuring invoer`, `Manager inlichten over invoer`, `Dit type is actief` en `Beheerbaar via selfservice`. De naam is verplicht en binnen dezelfde HR-groep uniek, waarbij hoofdletters en extra spaties geen verschil maken. Een bestaand type kan worden gewijzigd; archiveren vraagt eerst een bevestiging met `Ja` of `Nee`.

De instellingenpagina gebruikt de titel `Uren opbouw/schrijven` en de tabnaam `Verlofopbouw`.
