# Productupdates

## Status

GEÃMPLEMENTEERD: globale eigenaar- en tenantproductupdates, doelgroep- en kanaalkeuze, optionele start/einddatum, gebruikersstatus en beheer-UI.

## Functionele scope

- De Liquid HR-eigenaar kan globale nieuwe functionaliteiten en verbeteringen voor alle klanten publiceren.
- HR Admin kan binnen de eigen tenant nieuwe functionaliteiten en verbeteringen publiceren en beheren.
- HR Admin kan globale eigenaarberichten bekijken, maar niet wijzigen of verwijderen.
- Iedere update heeft een titel, korte omschrijving, toelichting, type, optionele start/eindweergave, één of meer weergavekanalen en één of meer doelgroepen.
- Weergavekanalen zijn cadeauvenster, popup bij inloggen en banner bovenaan.
- Doelgroepen zijn HR Admin, Manager en Medewerker.
- De zijbalk toont een rode teller voor ongeziene actieve updates die het kanaal cadeauvenster hebben.
- De laatste gezien-status wordt per gebruiker en tenant bijgehouden.
- Een bericht met kanaal banner of login-popup wordt per gebruiker en per kanaal maximaal één keer getoond.
- De login-popup bevat een knop `Gezien`; pas daarna wordt het popupbericht voor die gebruiker als gezien opgeslagen.

## Autorisatie

Een bericht zonder `tenant_id` is een eigenaarbericht voor alle klanten; een bericht met `tenant_id` is tenantgebonden. Gebruikers lezen uitsluitend actieve, tijdgeldige updates waarvoor hun rol is geselecteerd. `product-updates:global-write` is alleen aan de globale systeemrol `TENANT_ADMIN` gekoppeld; tenant HR Admin-overrides krijgen alleen `product-updates:write`. Database-RLS blijft de tweede autorisatielaag naast de servercontrole.
