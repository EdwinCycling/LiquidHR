# Startpagina compact en uitgebreid

## Scherm en scope

- Schermnaam: Startpagina
- Route: `/dashboard/start`
- Rollen en permissies: bestaande `start-page:read`-grens en Journey-only fallback blijven ongewijzigd.
- Gebruikersdoel: snel kunnen kiezen tussen een rustige begroeting en de volledige werkdagweergave.
- Scope van deze redesign: de bestaande persoonlijke `viewMode` koppelen aan de UI, compact vereenvoudigen en uitgebreid behouden.
- Buiten scope: data-laders, API-contracten, database, RLS, permissies en vensterindeling.

## Bestaande situatie

- De voorkeur en PATCH-route voor `viewMode` bestonden al, maar de startpagina gebruikte alleen de volledige weergave.
- De volledige pagina toont vensters met drag-and-drop en pijltjes voor volgorde.
- De medewerkerkaart gebruikt een compact éénknops-icoon voor wisselen tussen compact en uitgebreid.

## Nieuw ontwerp

- Uitgebreid behoudt de hogere header, de bestaande informatie en alle venster-/drag-and-dropfuncties.
- Compact toont een korte header met een éénregelige begroeting, hetzelfde éénknops wisselpatroon en horizontale tegels voor beschikbare volgende verlof-, feestdag- en bedrijfsactiviteitsinformatie.
- Compact rendert geen dashboardvensters en dus ook geen drag-and-dropbediening of extra witruimte.
- De keuze wordt opgeslagen via de bestaande `/api/preferences/start-page`-route en blijft per gebruiker behouden.

## Niet-functionele eisen

- NL/EN gebruikt bestaande `layoutLabel`, `full` en `compact`-sleutels; er zijn geen nieuwe zichtbare teksten toegevoegd.
- De wisselknop heeft een gelokaliseerde naam, titel en zichtbare focusstijl.
- Er zijn geen schema-, API-, autorisatie- of RLS-wijzigingen.
- Bestaande Liquid Flow-tokens en Tailwind-klassen blijven leidend.

## Acceptatiecriteria

- Compact toont de begroeting op één regel en tegels na elkaar wanneer er kalenderinformatie beschikbaar is.
- Compact toont geen vensterdragging, pijltjes of grote lege dashboardruimte.
- Uitgebreid toont de bestaande hogere header met drag-and-drop en vensteracties.
- Wisselen tussen beide modi werkt en gebruikt de bestaande opgeslagen gebruikersvoorkeur.
- De Journey-only fallback en bestaande data-/permissiegrenzen blijven intact.

## Verificatie en overdracht

- Uitgevoerd: gerichte code-inspectie en implementatie in een aparte worktree.
- Browsercontrole: nog uit te voeren in een runtime met de benodigde authenticated sessie.
- Bekende bestaande waarschuwingen: repositorybrede ESLint 10/`eslint-plugin-react`-compatibiliteit kan buiten deze slice blijven bestaan.
- Openstaande punten: gerichte typecheck, i18n-check, lint en desktop/390px-browsercontrole.
- Status: GEIMPLEMENTEERD
- Datum: 2026-08-16
