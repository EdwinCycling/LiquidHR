# Wizard UX-standaard

## Doel

Iedere meerstapsflow in LiquidHR gebruikt dezelfde rustige, voorspelbare en mobiele wizardopzet. De gebruiker kan zich op de huidige stap concentreren, terwijl navigatie en voortgang bereikbaar blijven.

## Leidende structuur

1. Gebruik een vaste wizardhoogte per stap binnen de beschikbare viewport. De stapinhoud mag daardoor niet de volledige paginahoogte laten meegroeien.
2. Houd het middenstuk scrollbaar wanneer de inhoud hoger is dan de beschikbare ruimte. De navigatiebalk blijft buiten de inhoud visueel herkenbaar en bereikbaar.
3. Gebruik een compacte sticky onderbalk met een subtiele dunne scheidingslijn erboven. Beperk de verticale padding; de knoppen behouden hun toegankelijke minimale klikhoogte.
4. Plaats de vorige/annuleeractie links en de primaire vervolgactie rechts. Gebruik op de eerste stap dezelfde lijn voor alle acties, bijvoorbeeld overslaan links en controleren rechts.
5. Toon de scrollhint **Meer onderaan** alleen wanneer de huidige stap daadwerkelijk verder kan scrollen. Plaats de hint boven de onderbalk, zodat deze niet buiten beeld valt en de knoppen niet bedekt. Laat de hint verdwijnen zodra de gebruiker onderaan is.
6. Gebruik naast tekst een herkenbaar scrollicoon of pijl; kleur is nooit de enige informatiedrager. De hint gebruikt een rustige accent- of succesvariant die voldoende contrasteert met de onderbalk.

## Stappen en voortgang

- Toon de stappen buiten of naast het scrollende middenstuk; de actieve stap is visueel duidelijk en de stapvolgorde blijft begrijpelijk.
- Houd stapkoppen compact. Herhaal geen overbodige contexttekst wanneer die geen invoerbeslissing ondersteunt.
- Bij een tijdelijke controle, zoekactie of opslag blokkeert de wizard de huidige stap met een toegankelijke overlay. Toon een korte titel, voortgangsfase en bewegende status; herstel de normale bediening automatisch na de respons.
- Een stap mag alleen vooruit wanneer de bestaande client- en servervalidatie dat toestaat. Een expliciete optionele actie, zoals overslaan, blijft duidelijk onderscheiden van doorgaan na controle.
- Bij een afgeronde identiteits- of validatiecontrole wisselt de onderbalk naar annuleren links en doorgaan rechts. De acties voor overslaan en opnieuw controleren verdwijnen uit die toestand; een exacte dubbele match toont een duidelijke waarschuwing, maar de gebruiker bepaalt zelf of doorgaan passend is.
- Een nieuwe medewerker wordt standaard pas bij de laatste stap opgeslagen. Vanaf het moment dat de kerngegevens succesvol zijn afgerond, toont de wizard onder de stappen subtiel **Not yet saved** met een save-icoon. De gebruiker kan de medewerker dan tussentijds opslaan; daarna verandert de status naar **Saved**. De save-actie blijft beschikbaar om latere wijzigingen opnieuw handmatig vast te leggen.

## Formulieren en mobiel

- Geef het formulier, de grid-items en invoervelden `min-width: 0` binnen de wizard. Horizontale overflow mag nooit tekstvelden buiten het scherm duwen.
- Gebruik op mobiel één kolom tenzij twee velden aantoonbaar naast elkaar passen. Meldingen horen bij het betrokken veld en mogen de uitlijning van naastgelegen velden niet verstoren.
- Gebruik inklapbare secties voor optionele of zelden gebruikte velden; deze staan standaard dicht.
- Alle zichtbare tekst, statusmeldingen en scrollhintteksten zijn i18n-klaar met gelijke NL/EN-sleutels.

## Acceptatiecriteria

- De wizard heeft op alle stappen dezelfde shellhoogte en een scrollbaar middenstuk bij overflow.
- De onderbalk staat onderaan, blijft zichtbaar tijdens scrollen en heeft een dunne scheidingslijn.
- De scrollhint verschijnt alleen bij resterende scrollruimte, staat boven de onderbalk en verdwijnt onderaan.
- De eerste stap lijnt secundaire actie links en primaire actie rechts uit.
- Geen enkel veld of foutbericht veroorzaakt horizontale overflow op een smalle viewport.
- Tijdens asynchrone controles is de stap niet bedienbaar en is de voortgang begrijpelijk zonder kleur alleen.
