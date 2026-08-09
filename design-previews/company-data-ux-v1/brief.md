# LiquidHR bedrijfsgegevens — UX concept v1

## Doel

Een vriendelijker, rustiger en vlotter alternatief voor `/settings/company-data` dat bestaande adreszoek-, handmatige invoer-, locatie- en opslaglogica visueel beter ordent. Dit is een klikbaar ontwerpconcept naast de bestaande pagina; het verandert nog geen productiecode.

## Doelgroep

HR-beheerders die groepsbrede bedrijfsgegevens en locaties beheren. Zij willen zonder uitleg weten wat eerst moet, welke informatie verplicht is en wanneer een wijziging is opgeslagen.

## UX-richting

- Navigable form: een compacte stapnavigatie voor `Bedrijfsadres` en `Locaties` op dezelfde pagina.
- Progressive disclosure: adres zoeken is de primaire snelle route; handmatige invoer blijft zichtbaar en begrijpelijk als fallback.
- Single-column reading flow: labels, helpertekst en feedback staan dicht bij het veld; brede velden blijven op kleine schermen één kolom.
- Inline feedback: gekozen adres, zoekstatus, foutstatus en opslagstatus verschijnen op de plek waar de gebruiker ze verwacht.
- Vriendelijke, lichte Liquid-stijl: diep inktblauw voor vertrouwen, aqua voor helderheid en een kleine warme gloed voor positieve accenten.
- Mobiel: sticky actiezone, 48px touch targets, stapnavigatie horizontaal scrollbaar.

## Inhoud

1. Header met teruglink, contextlabel, titel, korte uitleg en een rustige statusbadge.
2. Stapnavigatie met `Bedrijfsadres` actief en `Locaties` als tweede route.
3. Adreskaart met één duidelijke zoekactie, landkeuze, handmatige fallback en inline hulp.
4. Keuzekaart voor `één locatie` met duidelijke consequentie.
5. Sticky opslagactie met expliciete status.
6. Locatiekaart met lege toestand en uitnodiging om een locatie toe te voegen.

## Typografie

Systeemfont met rustige, compacte koppen en extra leesbare labels. Geen externe fontafhankelijkheid.

## Thema

`theme.css` bevat een geïsoleerde `liquid-flow` design-tokenlaag voor het concept. De tokens zijn bewust benoemd zodat ze later eenvoudig naar de bestaande `globals.css` kunnen worden vertaald zonder componentkleuren te hardcoden.

## Afbeeldingen

Geen afbeeldingen nodig. De kaart-/pinvisualisatie is CSS-only en decoratief.

## Output

- `index.html`: standalone klikbaar concept.
- `theme.css`: geïsoleerde stylesheet en responsive states.
- `interactions.js`: lokale demonstratie-interacties zonder backend.

## Iteratie na feedback

- Card-, field- en button-hoeken zijn aangescherpt naar een kleinere radius: nog steeds vriendelijk, maar minder rond.
- Het grote uitleg-/informatiepanel wordt op deze bedrijfspagina niet getoond. De `guide-card`-stijl blijft beschikbaar als herbruikbare informatiecomponent voor andere pagina's waar contextuele uitleg nodig is.
