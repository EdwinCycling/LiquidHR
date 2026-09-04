# LiquidHR mobile sidebar follow-up

**Status:** LOCAL GREEN — 2026-09-04

## Doel

Maak de bestaande sidebar op mobiel compacter, rustiger en bruikbaar op circa 390×844, zonder wijziging aan routes, navigatievolgorde, permissions, API's of data-eigenaarschap.

## Huidige problemen

- De Gift-trigger en testrolwissel namen ruimte in het onderste deel van de sidebar in.
- Testrolwissel werd als een permanente kaart getoond.
- Het profielgedeelte had geen gelijk gedrag tussen uitgebreide en ingeklapte sidebar.
- De reminder/klokzone kon visueel domineren door de permanente volgende-reminderkaart.

## Nieuw ontwerp

- De header bevat een compacte icon-based utility row met Gift, testrolwissel en het panel-/sluiticoon.
- De testrolwissel opent een popover met de bestaande POST-flow, `name="target"` en `#test-role-switch-target`; de stabiele `data-testid`-selectors blijven beschikbaar.
- Sectielabels zijn kleine eyebrow/separator-labels met minder verticale ruimte. Menu-items behouden hun bestaande routes en actieve state.
- De footer bestaat uit een compacte reminder/klokstrip en één account-row met avatar, naam en chevron. De account-row opent een menu met persoonlijke instellingen, uitloggen, divider en kleine versie-info.
- In de ingeklapte desktop-sidebar blijven de utilities en het account toegankelijk als icon-only controls; overlays blijven binnen de viewport.

## Responsive en toegankelijkheid

- De mobiele sidebar blijft een focusbare overlay met bestaande open/sluit-flow.
- Popovers hebben toegankelijke namen, `aria-expanded`, stabiele controls, Escape-sluiting en focusherstel.
- Icon-only controls gebruiken de bestaande `IconButton`-primitive en labels uit de bestaande NL/EN-namespace.
- De mobiele layout is gecontroleerd op 390×844 zonder horizontale overflow; desktop is gecontroleerd op 1440×900.

## Functionele grenzen

- Geen schema-, API-, RLS-, permission-, auth- of businesslogica-aanpassing.
- De testrolkeuze blijft een expliciete accountwissel via de bestaande serverroute; de browsercontrole voert geen rolwissel uit.
- De bestaande Gift Drawer, HR-groepkeuze, navigatielinks, reminderacties en uitlogform blijven leidend.

## Acceptatie

- [x] Compacte top utilities zichtbaar en bruikbaar.
- [x] Testrolkaart verwijderd; popover en `#test-role-switch-target` werken.
- [x] Sectielabels en menu-flow zijn compacter.
- [x] Account-row en account-popover tonen alle gevraagde acties en versie.
- [x] Reminder/klokzone is een compacte strip.
- [x] Mobiel 390×844 en desktop 1440×900 zonder horizontale overflow.
- [x] Verse browsercontrole zonder console-errors of warnings.

## Verificatie

- Gerichte Vitest: 3 bestanden, 6 tests geslaagd.
- Gerichte ESLint op sidebar, testrol, product-update en TimeHub geslaagd.
- Strict TypeScript is uitgevoerd maar blijft geblokkeerd door bestaande dirty wijziging buiten deze slice: `app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx:452` bevat een dubbele objectproperty.
- `git diff --check` geslaagd; alleen bestaande line-endingwaarschuwingen.
- Codex in-app browser: authenticated `main` op `/dashboard/start`; mobile 390×844, desktop 1440×900, accountpopover, testrolpopover, Gift Drawer, navigatie en collapsed sidebar gecontroleerd. Verse main-tab: 0 console-errors en 0 warnings.
