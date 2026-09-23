# Focus-modus als mobiele canvas op desktop

## Doel

Focus is een mobile-first medewerkerservaring. Op een brede desktop moet de
ervaring daarom niet uitrekken tot een volledige HR-werkruimte, maar als een
gecentreerde mobiele/tabletcanvas worden getoond met maximaal de breedte van
een verticale iPad.

## Ontwerpbesluit

- De volledige Focus-shell — header, pagina-inhoud en onderste navigatie —
  gebruikt één gecentreerde container met `max-w-3xl` (48 rem / 768 px).
- Op smalle schermen blijft de container `w-full`, zodat de bestaande mobiele
  layout en safe-area-ruimte intact blijven.
- De buitenruimte op desktop blijft de bestaande workspace-achtergrond; alleen
  de Focus-canvas wordt begrensd.
- De onderste Focus-navigatie volgt dezelfde maximale breedte als de inhoud en
  loopt niet meer als een volledige balk over een brede desktop.

## Gedrag en toegankelijkheid

De bestaande routes, navigatie-items, URL-state, sticky header, keyboard-focus,
safe-area-instelling en permissie-/act-asgedrag blijven ongewijzigd. Er is geen
nieuwe desktopvariant van de mobiele UX geïntroduceerd.

## Acceptatie

- `/focus` en alle `/focus/*`-routes tonen op brede schermen een gecentreerde
  canvas van maximaal 768 px.
- Header, inhoud en bottom navigation hebben dezelfde horizontale begrenzing.
- Op mobiele breedtes blijft de Focus-shell volledig vloeibaar zonder
  horizontale overflow.
- Er zijn geen API-, database-, RLS-, permission- of remote wijzigingen nodig
  voor dit layoutbesluit.
