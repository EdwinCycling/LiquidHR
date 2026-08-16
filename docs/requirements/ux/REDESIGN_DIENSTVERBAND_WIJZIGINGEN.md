# Redesign dienstverbandwijzigingen

Datum: 2026-08-16  
Route: `/employees/[employeeId]/employments/[employmentId]?tab=overview&view=expanded`  
Status: geïmplementeerd en lokaal/browsermatig geverifieerd

## Aanleiding

De annotaties op de wijzigingswizard wezen op ontbrekende labels, `undefined`-waarden, een onduidelijke tijdlijnstap en een onvoldoende herkenbare uren-/roosterindeling. De opmerkingen gelden deels voor alle wijzigingsflows en deels specifiek voor uren en rooster.

## UX-besluiten

- Contractkaarten tonen altijd een zichtbaar veldlabel en een leesbare fallback. De contractvorm, het medewerkertype, de periode en de fulltime-referentie staan in een vaste responsive grid.
- De stap `Startdatum` toont één compacte samenvattingsregel van het gekozen contract. De uitgebreide keuze en de tijdlijnbeslissing blijven in de vorige stap; er wordt geen dubbele tijdlijnkaart meer getoond.
- De uren-/roosterstap volgt de herkenbare indeling `Urenafspraak` en `Rooster`. De urenafspraak bevat dienstverbandsoort, uren per week, deeltijdfactor en gemiddelde dagen. Het rooster bevat per week gelabelde dagvelden, een expliciete eenheid en een samenhangstatus.
- Urenvelden, dagvelden en tijd-voor-tijdopbouw gebruiken hele uren (`step=1`, numerieke invoer). Percentages blijven zichtbaar als berekende informatie en zijn niet de primaire invoer voor de urenwijziging.
- De actieve flows `Uren / Rooster`, `Uren / Rooster / Salaris`, `Functie / afdeling / kostenplaats` en `Salaris` gebruiken dezelfde labels, samenvatting en controles. Ontbrekende backendwaarden vallen terug op een i18n-label in plaats van `undefined`.
- Niet-ondersteunde acties (`CAO aanpassen`, `Type contract / Startdatum` en `Contract verwijderen`) blijven expliciet als niet beschikbaar gemarkeerd.
- De wizard blijft responsive: op smalle schermen wordt de inhoud scrollbaar en blijven de navigatieknoppen in een vaste onderbalk bereikbaar.

## Technische randvoorwaarden

- NL en EN bevatten dezelfde nieuwe sleutels voor urenafspraak, rooster, eenheden en laadfouten.
- De bestaande serverautorisatie en RLS blijven leidend. Het roosterendpoint vereist de bestaande `work-schedule`-rechten en accepteert een medewerker binnen de actieve tenant/HR-groep, ook wanneer de actieve administratie niet gelijk is aan de administratie van het dienstverband.
- Een nieuw werkpatroon krijgt bij een wijziging vóór een toekomstig urenblok automatisch dat volgende blok als `valid_until`; daardoor blijven de onafhankelijke tijdlijnen zonder overlap consistent.
- Er is geen schema- of migratiewijziging voor deze UX-slice gedaan.

## Verificatie

- Browser: HR Admin, testmedewerker Lina Bakker (`EMP-DEMO-026-A`), desktop en 390×844.
- Vier actieve wijzigingsflows zijn doorlopen tot de gegevensstap; er zijn geen `undefined`-waarden meer aangetroffen.
- Testwijziging uitgevoerd met 40 uur → 38 uur per week, maandag t/m donderdag 8 uur en vrijdag 6 uur. De testdatabase bevat daarna consistente uren- en werkpatroontijdlijnen: 40 uur vanaf 2024-01-06, 38 uur van 2026-08-01 t/m 2026-09-01 en 39 uur vanaf 2026-09-01.
- Definitieve browserreload: geen console-errors of warnings. De werkpatroonkaart toont beide testpatronen en de mobiele wizard blijft bedienbaar.
- `check:i18n`: 33 gelijke NL/EN-namespaces.
- `type-check`: geslaagd.
- Gerichte ESLint op de gewijzigde employment- en work-patternbestanden: geslaagd.
- Gerichte Vitest: 2 bestanden, 9 tests geslaagd.
- `git diff --check`: geslaagd; alleen bestaande CRLF-waarschuwingen.

Een volledige productiebuild, volledige testsuite en releasegate zijn voor deze geïsoleerde UX-slice niet uitgevoerd.
