---
name: edwinhelp-screen-redesign
description: Redesign en verbeter LiquidHR-schermen wanneer de gebruiker vraagt om een modernere, vriendelijkere, snellere of gestroomlijnde UX, een pagina opnieuw te ontwerpen, of een volgende pagina volgens Liquid Flow aan te pakken. Gebruik deze skill ook wanneer de gebruiker alleen een route noemt en om een schermverbetering vraagt.
---

# EdwinHelp screen redesign

Gebruik deze skill voor één LiquidHR-scherm tegelijk. Het doel is een consistente Liquid Flow-ervaring: helder, rustig, vriendelijk, modern en efficiënt, zonder bestaande HR-functionaliteit stil te breken.

## Startpunt

Lees vóór onderzoek of wijziging:

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/delivery/CURRENT_CONTEXT.md`
4. `docs/requirements/ux/SCHERM_REDESIGN_STATUS.md`
5. `docs/requirements/ux/SCREEN_REDESIGN_TEMPLATE.md`
6. De relevante domeinrequirements, architectuurdocumenten en bestaande routecode

Bepaal daarna de route, rollen, permissies, bestaande componenten, API-routes, data-afhankelijkheden en actuele Git-status. Raak ongerelateerde bestaande wijzigingen niet aan. Stop en meld het wanneer de gevraagde pagina dezelfde bestanden gebruikt als onbegrepen wijzigingen buiten deze opdracht.

## Werkwijze

### 1. Begrijp het scherm

Onderzoek read-only:

- wat de gebruiker op dit scherm probeert te bereiken;
- welke informatie en acties essentieel zijn;
- welke states bestaan: laden, leeg, fout, opgeslagen, disabled, modal en mobiel;
- welke server-side autorisatie en RLS-grenzen al bestaan;
- welke UX-problemen de gebruiker benoemt of die zichtbaar zijn in de bestaande flow;
- welke bestaande gedeelde componenten en design tokens herbruikbaar zijn.

Gebruik bij beheerpagina's standaard list-first: zoeken, filteren, sorteren, duidelijke selectie en modalacties. Gebruik voor gesloten keuzelijsten altijd de bestaande toegankelijke zoekbare keuzecomponent.

### 2. Leg het ontwerp vast

Maak of werk bij:

- `docs/requirements/ux/REDESIGN_[slug].md` voor het scherm;
- `docs/requirements/ux/SCHERM_REDESIGN_STATUS.md` met status, datum, route en volgende stap;
- `docs/delivery/CURRENT_CONTEXT.md` met wat klaar is, wat openstaat en welke verificatie is uitgevoerd.

Werk `docs/README.md` alleen bij wanneer het requirementsdocument een nieuwe leidende scope of documentverwijzing toevoegt.

Beschrijf in het schermdocument minstens doel, huidige problemen, nieuw ontwerp, states, responsive gedrag, toegankelijkheid, i18n, functionele grenzen, acceptatiecriteria en buiten-scope.

### 3. Ontwerp en implementeer

Gebruik de bestaande Liquid Flow-basis:

- centrale tokens en gedeelde stijlen in `apps/hr-suite/app/globals.css`;
- bestaande form-, button-, dropdown-, modal-, list- en addresscomponenten;
- CSS-variabelen en Tailwind v4, geen hardcoded hexwaarden in componenten;
- minder ronde hoeken, maar niet volledig vierkant;
- duidelijke primaire actie, rustige spacing en zo weinig mogelijk dubbele uitleg;
- informatiepanelen alleen wanneer zij op dat scherm echt helpen;
- alle zichtbare tekst via NL/EN-vertalingen met gelijke sleutels.

Behoud standaard route, API-contracten, database, permissies, RLS, data-eigenaarschap en bestaande gebruikersflows. Voer geen schema- of remote wijziging uit voor een visuele redesignopdracht tenzij de gebruiker dat afzonderlijk en expliciet vraagt.

Als de gebruiker alleen om een voorstel vraagt, stop na analyse, requirements en ontwerpvoorstel. Als de gebruiker akkoord geeft of expliciet vraagt om het door te voeren, implementeer dan de afgesproken scope.

### 4. Controleer het resultaat

Voer voor een geïmplementeerd scherm minimaal uit:

- gerichte typecheck en lint;
- `check:i18n` wanneer zichtbare tekst of taalbestanden wijzigen;
- relevante test of buildcontrole;
- browsercontrole op desktop en 390px mobiel wanneer layout of interactie is gewijzigd;
- controle van toetsenbordfocus, lege toestand, foutmelding, loading en success state.

Rapporteer onderscheidend wat lokaal gecontroleerd is, wat inherited is en wat nog openstaat. Merge, push of deploy is geen onderdeel van deze skill tenzij de gebruiker daar apart opdracht voor geeft.

## Afgeronde schermen

Lees altijd `docs/requirements/ux/SCHERM_REDESIGN_STATUS.md` voordat je een nieuw scherm kiest. Voeg na afronding een nieuwe rij toe en wijs het volgende scherm aan.

De eerste afgeronde redesign is:

- `/settings/company-data` — zie `docs/requirements/ux/BEDRIJFSGEGEVENS_REDESIGN.md`.

De eerstvolgende pagina is:

- `/authorization` — Rollen en autorisatie.

## EdwinHelp-ingang

Gebruik bijvoorbeeld:

`Gebruik EdwinHelp. Redesign de pagina Rollen en autorisatie op /authorization. Lees eerst de bestaande autorisatie-requirements en het UX-statusdocument. Maak eerst het requirementsdocument en een ontwerpvoorstel.`

Voor direct implementeren:

`Gebruik EdwinHelp. Voer het redesign van Rollen en autorisatie op /authorization door volgens de screen-redesign-skill en werk alle UX-documentatie en status bij.`
