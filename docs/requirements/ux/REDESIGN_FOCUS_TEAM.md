# Focus teamoverzicht — leesbare kalender

## Doel

De medewerker- en managerweergave van `/focus/team` moet per collega en per
dag direct leesbaar zijn. Dezelfde component wordt ook ingesloten op
`/focus/verlof` en behoudt daar de bestaande privacy- en statusgrenzen.

## Huidig probleem

De desktopkalender gebruikte een vaste tabelbreedte die op smallere desktop-
viewports over alle dagen werd verdeeld. Daardoor werden dagkoppen afgebroken
en liepen de statuslabels `Aanwezig` en `Afwezig` over aangrenzende cellen.

## Ontwerp en functionele grenzen

- De collega-kolom blijft sticky en krijgt een vaste breedte.
- Elke dagkolom krijgt een vaste minimale breedte die ook de langste status
  (`Niet ingepland`) bevat; de tabel mag horizontaal scrollen in plaats van de
  cellen samen te drukken.
- Dagkoppen en statuslabels blijven op één regel zodat tekst nooit over een
  buurcel heen loopt.
- De maandtitel gebruikt een leesbare gelokaliseerde maandnaam, bijvoorbeeld
  `september 2026`.
- De bestaande mobiele dagweergave, navigatie, acties, privacyprojectie en
  `Aanwezig`/`Afwezig`-semantiek blijven ongewijzigd.

## Responsive en toegankelijkheid

- Desktop/tablet: horizontaal scrollbare kalender met vaste eerste kolom.
- Mobiel: bestaande geselecteerde-dag-kaarten blijven leidend; geen brede
  tabel wordt geforceerd.
- De tabel behoudt headercellen, sticky contextkolom en bestaande `aria-label`
  per statuscel.
- Er zijn geen nieuwe zichtbare vertalingssleutels nodig.

## Acceptatiecriteria

- Op de gecontroleerde smallere desktopbreedte zijn dagkoppen volledig
  leesbaar.
- `Aanwezig`, `Afwezig`, `Verlof` en manageruren overlappen geen andere cel.
- De horizontale scrollbar blijft beschikbaar voor alle dagen van de maand.
- De maandtitel is begrijpelijk in NL en EN.
- Bestaande Focus-teamtests, typecheck en lokale browsercontrole blijven
  groen.

## Buiten scope

Geen wijzigingen aan route, API, database, RLS, permissions, teamdata,
statusberekening of de mobiele informatiearchitectuur.
