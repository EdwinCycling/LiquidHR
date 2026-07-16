# Organogram — ontwerp

## Besluit

Liquid HR krijgt een afdeling-gedreven, read-only organogram voor de actieve administratie. Het ontwerp gebruikt de bestaande tijdsgebonden organisatiegegevens als enige bron van waarheid en voegt geen duplicerende charttabellen toe.

## Ervaring

De pagina opent met een compacte kop, administratiecontext en een uitnodigende verkenbalk. De zoekbalk is het visuele hoofdelement; afdeling en managementrol staan als snelle chips ernaast. Peildatum en vrije velden leven onder `Meer filters`. Actieve keuzes worden afzonderlijk verwijderbare chips en het matchaantal verandert direct.

Op desktop volgt daaronder een automatisch uitgelijnd pan-/zoomcanvas. De hoofdorganisatie vormt het anker, afdelingen vormen de ruggengraat en medewerkers hangen onder hun actuele afdeling. Op mobiel wordt dezelfde graph als verticale, inklapbare boom aangeboden om miniatuurkaarten en horizontale pagina-overflow te vermijden.

## Graph-projectie

Een pure TypeScript-projector ontvangt reeds geautoriseerde databasegegevens en levert een discriminated union van `administration`, `department` en `employee` nodes plus getypeerde edges. De projector:

1. selecteert actieve records op de peildatum;
2. bouwt de afdelingenboom deterministisch;
3. koppelt actieve plaatsingen;
4. berekent lokale of inherited `DIRECT_MANAGER`-weergave;
5. markeert ambiguïteit zonder een kandidaat te kiezen;
6. koppelt managementbadges;
7. voegt uitsluitend opt-in vrije-veldwaarden toe;
8. berekent de zichtbare paden voor zoek- en filtermatches.

## Datamodel

Eén schema-uitbreiding is nodig: vrije-velddefinities krijgen `show_in_organization_chart_filter boolean not null default false`. De migratie voegt de permission `organization-chart:read` standaard toe aan `TENANT_ADMIN`, `HR_ADVISOR` en `TEAM_LEAD`; verdere toekenning loopt via de bestaande rechtenmatrix. Bestaande RLS blijft leidend; de nieuwe kolom krijgt geen aparte tabel.

## Leesweg

- Server page leest URL-state en vraagt de graphservice op.
- De service controleert `organization-chart:read`, actieve administratie en aanvullende bronrechten.
- Supabasequeries selecteren alleen benodigde kolommen, zijn begrensd en draaien parallel waar veilig.
- De API-route ondersteunt dezelfde getypeerde projectie voor toekomstige clients.
- De clientcomponent beheert uitsluitend pan, zoom, lokale focus en het openen van het filterpaneel.

## Filtergedrag

Filtering verwijdert nodes niet uit de layout. Matches krijgen een accent; niet-matches worden gedimd. Ancestors en verbindingspaden van matches blijven voldoende zichtbaar voor context. Afdelingsfiltering focust de gekozen tak. Vrije-veldfilters verschijnen uitsluitend wanneer de definitie actief, toegestaan en voor de actor leesbaar is.

## Visuele richting

- Administration: compact donker merkanker via bestaande primary-tokens.
- Department: rustige verhoogde kaart met code, naam, telling en managerregel.
- Employee: kleinere persoonskaart met avatar, functie en maximaal twee primaire badges; overige badges worden als telling samengevat.
- Edgekleuren, achtergronden, focus en statussen gebruiken uitsluitend CSS-variabelen en bestaande Tailwind-tokens.
- Animatie is kort en functioneel; `prefers-reduced-motion` wordt gerespecteerd.

## Fout- en lege staten

- Geen administratie: bestaande contextkeuze tonen.
- Geen afdelingen: rustige lege staat met link naar afdelingenbeheer wanneer toegestaan.
- Geen matches: graph blijft gedimd zichtbaar en de verkenbalk biedt één resetactie.
- Ambigue manager: waarschuwing op afdelingskaart, geen fout voor de hele pagina.
- Onvolledige plaatsing: medewerker blijft zichtbaar met `Functie niet vastgelegd` indien de RLS-query de medewerker toestaat.

## Teststrategie

- Unit: peildatum, boomopbouw, parallelle plaatsingen, inherited manager, ambiguïteit, filtering en zichtbare paden.
- Schema/API: ongeldige URL/input, permissioncombinaties en responsecontract.
- Database: tenant-/administratie-isolatie, permission en vrije-veld opt-in.
- UI: filterchips, reset, toetsenbord, deep link, desktopcanvas en mobiele boom.
- Eindcontrole: lokaal op poort 3000 en publieke preview.

## Bewuste grenzen

Geen drag-and-drop, mutaties, scenariovergelijking, loonkosten-KPI's, manager-first toggle of automatische deputyactivatie in versie 1.
