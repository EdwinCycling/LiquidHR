# Onderzoeks-UX

## Ontwerpintentie

De onderzoekservaring moet rustig en betrouwbaar aanvoelen: medewerkers moeten zonder HR-jargon weten wat openstaat, of het anoniem is en hoeveel tijd zij nog hebben. Voor HR-admins is dezelfde visuele taal informatie-dichter, met campagne-status, responsratio en één duidelijke volgende actie.

## Visuele richting

- Gebruik de bestaande LiquidHR-typografie, semantische CSS-variabelen en ruime afgeronde panelen.
- Gebruik een zachte primaire introductieband als herkenbaar anker, geen nieuw kleurensysteem.
- Plaats privacy-informatie dicht bij de primaire actie.
- Gebruik statusbadges met tekst én kleur; kleur alleen is nooit betekenisdragend.
- Laat mobiel alle kaarten en formulierbesturingen in één kolom lopen.

## Kernschermen

### Onderzoekshub

- Bovenaan: titel, korte uitleg en telling openstaande uitnodigingen.
- Eerst openstaande uitnodigingen, daarna afgeronde en gesloten items.
- Iedere kaart toont type, periode, anonimiteit, status en één primaire actie.
- HR-admin ziet compacte snelkoppelingen naar instellingen en monitor.

### Invullen

- Eén duidelijke formulierkolom met voortgang op vraagniveau.
- Verplichte vragen zijn tekstueel herkenbaar.
- Schalen tonen alle waarden als grote toegankelijke keuzeknoppen.
- Na indienen volgt een afzonderlijke bevestigingsstaat; opnieuw indienen is niet mogelijk.

### Instellingen en bouwers

- Lijst eerst: bestaande campagnes zijn zoekbaar en sorteerbaar; aanmaken gebeurt vanuit een duidelijke actie.
- De builder bestaat uit campagne, doelgroep en vragen, in die volgorde.
- Gesloten waardelijsten gebruiken een selecteerbare keuzecomponent; geen vrije invoer van codes.
- De verplichte eNPS-vraag staat vast bovenaan en kan niet worden verwijderd.
- De eNPS-vragenbank volgt lijst-eerst met zoeken/filteren en modals voor eigen categorieën en vragen; in de builder kunnen eigen vragen direct worden toegevoegd, aan/uitgezet en met toetsenbordvriendelijke acties worden geordend.

### Monitor

- Lijst eerst met type, status, periode, responsratio en voortgangsbalk.
- Klikken opent detail met campagnestatus, deelnemers en – indien toegestaan – resultaten.
- Onder vijf eNPS-responsen verschijnt uitsluitend de privacydrempelmelding.
- Openstaande deelnemers hebben een gerichte herinneractie. Surveykeuzes gebruiken taart- én staafweergave; matrices gebruiken gestapelde staven en eNPS-vragen uitklapbare verdelingen.

## Toegankelijkheid

- Alle formuliercontrols hebben zichtbare labels en fieldsets met legends.
- Fouten worden in tekst bij het formulier getoond en acties hebben een loading-state.
- Focusvolgorde volgt de visuele volgorde; knoppen en links behouden zichtbare focusstijlen.
