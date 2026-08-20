# Employment Workspace UX-redesign

Datum: 2026-08-20
Route: `/employees/[employeeId]/employments/[employmentId]`
Status: **GEIMPLEMENTEERD — lokale verificatie volgt**

## Doel

De Employment Detail-route wordt een rustige, compacte werkplek voor één dienstverband. De medewerker blijft herkenbaar, maar het scherm krijgt geen tweede volledige Employee Profile-card. De gebruiker ziet direct de dienstverbandcontext en kan daarna zonder visuele ruis tussen de acht bestaande workspace-tabs wisselen.

## Nieuwe ontwerpbeslissing

De bovenkant gebruikt een **Compact Work Context Header**:

- avatar en volledige naam als menselijk anker;
- functie, afdeling en administratie als compacte contextregel;
- dienstverbandnummer en personeelsnummer als identificerende metadata;
- status Actief, Toekomstig of Beëindigd;
- Primair alleen wanneer `is_primary` waar is;
- startdatum en einddatum, met Doorlopend wanneer geen einddatum is vastgelegd;
- de bestaande compact/uitgebreid-actie rechts;
- direct daaronder de bestaande tabs, vlak weergegeven met een actieve onderstreping.

De header gebruikt een vlakke semantic surface met Foundation-rand, radius en tokens. Een gradient hero, decoratieve cirkel, zware shadow en pillachtige tabkaart zijn verwijderd.

## Functionele grenzen

Route, query-state (`tab`, `view`, `date`, `fromTab`), acht tabs, serverautorisatie, RLS, API-contracten, bestaande timeline-mutaties, wijzigingswizard, salariszichtbaarheid en bestaande lege/foutstates blijven behouden. De organisatiecontext wordt op iedere workspace-tab gelezen zodat functie en afdeling in de header stabiel blijven; er zijn geen nieuwe databronnen, writes, permissions of workflows toegevoegd.

## Responsive en toegankelijkheid

- De header stapelt de context en acties op smallere schermen zonder horizontale overflow.
- De tabstrip blijft horizontaal scrollbaar en gebruikt tekstlabels, niet alleen kleur, voor de actieve staat.
- Links behouden zichtbare focus states en `aria-current` voor de actieve workspace-tab.
- Avatar-alttekst en semantische `dl`-metadata blijven beschikbaar voor screenreaders.
- Alle nieuwe zichtbare tekst (`Doorlopend` / `Ongoing`) staat gelijkwaardig in NL en EN.

## Acceptatiecriteria

- Geen gradient hero of tweede volledige Employee Profile-card.
- Compact Work Context Header toont avatar, naam, functie, afdeling, administratie, dienstverbandnummer, status, primaire markering indien relevant en start/einddatum.
- Bestaande actie staat rechts op desktop en blijft bereikbaar op mobiel.
- De acht bestaande workspace-tabs sluiten direct onder de header aan en zijn vlak vormgegeven.
- Geen wijziging aan functionele acties, route, API, schema, RLS, permissions of data-eigenaarschap.
- NL/EN namespaces blijven gelijk.
- Gerichte typecheck, lint, i18n-check, relevante tests en diff-check zijn groen; browsercontrole op desktop en 390px volgt wanneer de lokale authenticated omgeving beschikbaar is.

## Buiten scope

Geen schema- of Supabase-write, nieuwe Employment-functionaliteit, nieuwe workspace-tab, routewijziging, release/version bump, deployment of merge naar `main`.
