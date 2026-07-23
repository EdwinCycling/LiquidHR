# Liquid HR — instructies voor AI-agents

Motto: **It takes a genius to keep it simple.**

## Uitvoeringsvoorkeur van de gebruiker

- Voer implementatieplannen inline uit in de actieve chat.
- Gebruik geen subagents of parallelle agentdelegatie, tenzij de gebruiker dat expliciet vraagt.
- Optimaliseer voor lage kosten en zorgvuldigheid; voer geen onnodige brede analyse, planning of verificatie uit.

## Leesrouting

1. Lees vóór iedere wijziging deze `AGENTS.md` volledig.
2. Lees bij de start van een nieuwe taak of chat [`docs/README.md`](docs/README.md) en [`docs/delivery/CURRENT_CONTEXT.md`](docs/delivery/CURRENT_CONTEXT.md).
3. Lees vóór implementatie alleen de requirements en architectuurdocumenten die `docs/README.md` voor het gewijzigde domein aanwijst.
4. Lees alle vijf architectuurdocumenten alleen bij cross-cutting wijzigingen aan auth, security, tenancy, datatoegang, projectstructuur, UI-fundering of Liquid Display.
5. Onderzoek bij een kleine, afgebakende wijziging eerst de direct relevante bestanden; lees niet de hele repository zonder concrete aanleiding.

## Bronnen en voorrang

Bij tegenstrijdigheden geldt deze volgorde:

1. Expliciete actuele opdracht van de gebruiker.
2. Goedgekeurde ADR/FDR in `docs/decisions/`.
3. Leidend document in `docs/README.md`.
4. Overige conceptdocumenten.
5. Bestaande implementatie.

Een verschil tussen leidende documentatie en code wordt niet stil opgelost. Werk `docs/delivery/IMPLEMENTATION_STATUS.md` bij en corrigeer code of documentatie in dezelfde wijziging.

## Niet-onderhandelbare technische regels

- Bouw altijd in de volgorde `schema → API route → UI`.
- Gebruik strict TypeScript en nooit `any`.
- Gebruik Next.js Server Components, Server Actions en URL-state; geen React Query of SWR.
- Iedere tabel in een blootgesteld schema krijgt RLS en passende policies in dezelfde migratie.
- Autorisatie wordt server-side én met RLS afgedwongen; UI-verberging is alleen UX.
- Database-entiteiten en identifiers zijn Engels; comments, documentatie en UI-tekst zijn Nederlands en i18n-klaar.
- Gebruik Tailwind v4 en CSS-variabelen; geen hardcoded hexwaarden in componenten.
- Gebruik canonieke permissions: `resource:action` of `self:resource:action`.
- Draai na iedere schemawijziging Supabase advisors en genereer `packages/db/types.ts` opnieuw.
- Ontwikkel kritieke autorisatie- en salarislogica test-first.
- Alle zichtbare tekst en foutmeldingen komen uit een taalbestand. Nederlands (`nl`) is standaard en Nederlands/Engels hebben steeds dezelfde sleutels.
- Een nieuwe taal wordt als volledige namespace-set onder `apps/hr-suite/messages/<taalcode>/` toegevoegd; componenten bevatten geen eigen vertaalobjecten.

## Efficiënte verificatie

- Kies de kleinste relevante verificatie voor de gewijzigde bestanden en het gedrag.
- Voor styling, copy, layout of een geïsoleerde UI-wijziging: gerichte linting, typecheck of visuele controle.
- Voor logica: de dichtstbijzijnde unit-, component- of integratietest.
- Draai `check:i18n` wanneer zichtbare tekst of taalmodules wijzigen.
- Start of controleer de app op poort `3000` wanneer het aangepaste gedrag browsercontrole nodig heeft.
- Draai de volledige testsuite, productiebuild, lokale browsercontrole en publieke preview alleen wanneer:
  - de gebruiker dat vraagt;
  - een release, merge of pull request wordt voorbereid;
  - gedeelde infrastructuur, configuratie, authenticatie, routing, database-schema/RLS/grants of kritieke businesslogica wijzigt; of
  - een gerichte controle een bredere regressiekans aanwijst.
- Maak tests wanneer zij betekenisvolle bescherming bieden; niet mechanisch voor een triviale wijziging.
- Herhaal geen onveranderde falende opdracht; herstel alleen in-scope fouten en rapporteer bestaande, niet-gerelateerde failures afzonderlijk.

## Documentatie bijhouden

- Nieuwe requirements worden als Markdown onder `docs/requirements/<domein>/` opgeslagen.
- Architectuurbesluiten komen als ADR in `docs/decisions/`; functionele besluiten als FDR.
- Werk na een afgeronde verticale slice de status in `docs/README.md` en `docs/delivery/IMPLEMENTATION_STATUS.md` bij.
- Werk na iedere materiële wijziging `docs/delivery/CURRENT_CONTEXT.md` bij. Houd dit document compact, actueel en vrij van secrets.
- Markeer vervangen documenten expliciet; verwijder historische besluiten niet stil.

## Nieuwe en geforkte chats

- Behandel repositorydocumentatie als het blijvende geheugen; vertrouw niet op oude chatgeschiedenis.
- Start een nieuwe chat vanuit de repositoryroot. De gebruiker hoeft alleen te zeggen: `Lees AGENTS.md en ga verder vanaf CURRENT_CONTEXT.md`.
- Verifieer bij hervatten alleen de actuele filesystem-, proces-, database- en deploymentstatus die voor de taak relevant is; neem tijdelijke URL's of draaiende processen nooit blind over.
- Noteer vóór het afsluiten van een omvangrijke taak in `CURRENT_CONTEXT.md`: wat is afgerond, wat is nog open, welke verificatie is uitgevoerd en welke handmatige acties overblijven.
