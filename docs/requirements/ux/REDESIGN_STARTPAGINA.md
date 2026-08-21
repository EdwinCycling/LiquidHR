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
- Compact toont een korte header met een éénregelige begroeting, hetzelfde éénknops wisselpatroon en horizontale tegels voor beschikbare volgende verlof-, feestdag- en bedrijfsactiviteitsinformatie. De bestaande datavensters blijven onder deze header zichtbaar.
- Compact rendert de datavensters zonder drag-and-dropbediening, pijltjes of extra lege dashboardruimte.
- De keuze wordt opgeslagen via de bestaande `/api/preferences/start-page`-route en blijft per gebruiker behouden.

## Niet-functionele eisen

- NL/EN gebruikt bestaande `layoutLabel`, `full` en `compact`-sleutels; er zijn geen nieuwe zichtbare teksten toegevoegd.
- De wisselknop heeft een gelokaliseerde naam, titel en zichtbare focusstijl.
- Er zijn geen schema-, API-, autorisatie- of RLS-wijzigingen.
- Bestaande Liquid Flow-tokens en Tailwind-klassen blijven leidend.

## Acceptatiecriteria

- Compact toont de begroeting op één regel en tegels na elkaar wanneer er kalenderinformatie beschikbaar is.
- Compact toont de bestaande datavensters zonder vensterdragging, pijltjes of grote lege dashboardruimte.
- Uitgebreid toont de bestaande hogere header met drag-and-drop en vensteracties.
- Wisselen tussen beide modi werkt en gebruikt de bestaande opgeslagen gebruikersvoorkeur.
- De Journey-only fallback en bestaande data-/permissiegrenzen blijven intact.

## Verificatie en overdracht

- Uitgevoerd: gerichte code-inspectie en compact-herstel in de actieve worktree.
- Browsercontrole: authenticated runtimecontrole op een passende lokale server uitgevoerd; poort 3000 bleef een stale server uit een andere worktree tonen.
- Bekende bestaande waarschuwingen: repositorybrede ESLint 10/`eslint-plugin-react`-compatibiliteit kan buiten deze slice blijven bestaan.
- Openstaande punten: i18n-check, lint en desktop/390px-browsercontrole op poort 3000 met de juiste worktree.
- Status: GEIMPLEMENTEERD — compact datavensters hersteld
- Datum: 2026-08-21
