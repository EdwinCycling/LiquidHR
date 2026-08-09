# Formulieren: labels en validatie

## Doel

Nieuwe LiquidHR-schermen gebruiken een rustige, consequente formulier-UX. De gebruiker ziet alleen informatie die nodig is om een veld goed in te vullen.

## Leidende regels

1. Een verplicht veld toont uitsluitend een `*` naast het label. Het woord **Verplicht** wordt niet naast ieder veld herhaald.
2. Een optioneel veld krijgt geen labeltekst zoals **Optioneel** of **Niet verplicht**. Alleen inhoudelijke toelichting die de keuze of het risico verduidelijkt mag onder het veld staan.
3. Een foutmelding staat zo dicht mogelijk bij het betrokken veld, is Nederlandstalig en i18n-klaar, en gebruikt geen algemene foutmelding wanneer de oorzaak al concreet bij een veld staat.
4. Na een validatiefout controleert het veld zijn eigen waarde opnieuw bij `blur` (of het equivalente focusverlies van een toegankelijke keuzecomponent). Zodra de veldwaarde geldig is, verdwijnt de specifieke foutmelding direct.
5. Een foutmelding die afhankelijk is van meerdere velden blijft staan zolang de volledige combinatie niet geldig is. Zij verdwijnt pas wanneer alle betrokken velden samen geldig zijn.
6. Bij wijzigingen die een afhankelijk veld ongeldig maken, blijft de foutmelding zichtbaar of wordt die opnieuw getoond; alleen een succesvolle controle mag een fout wissen.
7. Servervalidatie blijft verplicht. Blur-validatie is directe gebruikersfeedback en geen autorisatie- of databeveiligingsgrens.

## Acceptatiecriteria

- Een scherm met verplichte en optionele velden toont alleen sterretjes bij verplichte velden.
- Een gebruiker die een fout veld corrigeert en het verlaat, ziet de opgeloste veldfout niet meer.
- Een gecombineerde validatie, zoals een adres of een set onderling afhankelijke velden, blijft zichtbaar tot de combinatie compleet en geldig is.
- Dezelfde regels gelden voor tekstvelden, datums, native selects en zoekbare keuzecomponenten.
