# Liquid HR — instructies voor AI-agents

Motto: **It takes a genius to keep it simple.**

## Uitvoeringsvoorkeur van de gebruiker

- Voer implementatieplannen altijd inline uit in de actieve chat.
- Gebruik geen subagents of parallelle agentdelegatie, tenzij de gebruiker dit later expliciet wijzigt.
- Optimaliseer voor laag creditverbruik en zorgvuldigheid; snelheid heeft geen prioriteit.

## Verplichte leesvolgorde

1. Lees vóór iedere wijziging deze `AGENTS.md` volledig.
2. Lees vervolgens altijd [`docs/README.md`](docs/README.md). Dit is de architectuurindex en documentrouter.
3. Lees altijd [`docs/delivery/CURRENT_CONTEXT.md`](docs/delivery/CURRENT_CONTEXT.md). Dit is de compacte overdracht voor iedere nieuwe of geforkte chat.
4. Lees vóór implementatie de relevante requirementdocumenten voor het domein dat wordt gewijzigd.
5. Lees alleen de volledige architectuurdocumenten die `docs/README.md` voor die wijziging aanwijst.
6. Lees alle vijf architectuurdocumenten bij cross-cutting wijzigingen aan auth, security, tenancy, datatoegang, projectstructuur, UI-fundering of Liquid Display.

De volledige `LIQUID_DISPLAY_DOCUMENTATIE.md` is omvangrijk en wordt niet voor iedere kleine wijziging geladen. De architectuurindex is altijd verplicht; het volledige document alleen bij Liquid Display, generatieve UI, AI-querying, widget rendering of contextmanagement.

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
- Kritieke autorisatie- en salarislogica wordt test-first ontwikkeld.
- De lokale app draait en wordt gevalideerd op poort `3000`.
- Alle zichtbare tekst en foutmeldingen komen uit een taalbestand. Nederlands (`nl`) is standaard en Nederlands/Engels moeten altijd dezelfde sleutels hebben; draai `npm run check:i18n -w @liquid-hr/hr-suite`.
- Een nieuwe taal wordt als volledige namespace-set onder `apps/hr-suite/messages/<taalcode>/` toegevoegd; componenten bevatten geen eigen vertaalobjecten.
- Iedere testbare ontwikkelmijlpaal wordt lokaal op poort `3000` én via een publieke preview gecontroleerd, zodat testen op iPhone of een externe laptop mogelijk is.

## Documentatie bijhouden

- Nieuwe requirements worden als Markdown onder `docs/requirements/<domein>/` opgeslagen.
- Architectuurbesluiten komen als ADR in `docs/decisions/`; functionele besluiten als FDR.
- Werk bij iedere afgeronde verticale slice de status in `docs/README.md` en `docs/delivery/IMPLEMENTATION_STATUS.md` bij.
- Werk na iedere materiële wijziging ook `docs/delivery/CURRENT_CONTEXT.md` bij. Houd dit document compact, actueel en vrij van secrets, zodat een nieuwe of geforkte chat zonder conversatiegeschiedenis direct kan doorgaan.
- Markeer vervangen documenten expliciet; verwijder historische besluiten niet stil.

## Nieuwe en geforkte chats

- Behandel repositorydocumentatie als het blijvende geheugen; vertrouw niet op oude chatgeschiedenis.
- Start een nieuwe chat vanuit de repositoryroot. De gebruiker hoeft alleen te zeggen: `Lees AGENTS.md en ga verder vanaf CURRENT_CONTEXT.md`.
- Verifieer bij hervatten eerst de actuele filesystem-, proces-, database- en deploymentstatus; neem tijdelijke URL's of draaiende processen nooit blind over.
- Noteer vóór het afsluiten van een omvangrijke taak in `CURRENT_CONTEXT.md`: wat is afgerond, wat is nog open, welke verificatie is uitgevoerd en welke handmatige acties overblijven.
