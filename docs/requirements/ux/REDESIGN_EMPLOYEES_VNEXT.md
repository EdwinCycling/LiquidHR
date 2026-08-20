# Employees UX vNext — gecontroleerde UI-pilot

Status: **GEVERIFIEERD — lokale testfase**
Route: `/employees`
Datum: `2026-08-16`

## Doel en scope

De medewerkerslijst krijgt een rustigere, zakelijkere en iets compactere presentatie volgens de richting **Structured Enterprise**. De pilot is bewust schermgericht: eerst wordt de echte Employees-route visueel beoordeeld voordat gedeelde patronen breder worden toegepast.

De scope bestaat uit:

- Work Sans als primaire applicatiefont voor de eerste visuele pilot;
- een strakker Employees-paginaritme;
- een vlak filterwerkblad met subtiele randen, compacte chips en controlehoogte van ongeveer 40px;
- een compactere detail-/lijstweergave met naam als primaire hiërarchie;
- rustigere medewerkerkaarten zonder standaard schaduw, lift of grote gradientkop;
- dezelfde rustige rand- en radiusbehandeling voor lege toestand en fotoweergaven.

## Functionele grenzen

De route, links, autorisatie, tenant-/HR-groepsscope, employee-query, URL-state, filterpersisting, zoekgedrag, sortering, team-/alles-scope, archiefgedrag en alle bestaande view modes blijven behouden. De huidige geconsolideerde Employee-presentatie blijft leidend: medewerkerstype en archiefstatus blijven de zichtbare labels; de telling blijft onder de lijst; directory- en beperkte managerweergaven blijven actorveilig.

Er zijn geen wijzigingen aan schema, migrations, API-contracten, RLS, permissions, navigatie of domeinlogica.

## Ontwerp

- Canvas en oppervlakken blijven op de bestaande LiquidHR-tokens gebaseerd.
- Gewone panelen gebruiken een subtiele 1px-rand, ongeveer 8px radius en geen standaard schaduw.
- De filterheader houdt de filteractie, wissen en de bestaande actie **Nieuwe medewerker** op dezelfde plek en behoudt de bestaande URL-/voorkeursflow.
- De zoekbox en selecties staan in een vlakke, niet-geneste filtersectie; actieve chips blijven duidelijk maar minder pill-achtig.
- Detailrijen worden iets dichter, met een avatar van 40px, rustige personeelsnummermetadata en een subtiele hover zonder verplaatsing.
- Namen blijven visueel dominant; afdeling, functie, administratie en e-mail zijn secundair.
- Kaarten behouden hun link-, directory-, e-mail- en focusgedrag, maar gebruiken een lage tint in plaats van een decoratieve gradient en geen hover-lift.
- Fotomodes blijven beschikbaar; alleen radius, schaduw en hover worden gelijkgetrokken.

## Responsive en toegankelijkheid

De bestaande stacking op smalle schermen, volledige klikrijen, directorytrigger, e-maillinks en focus-visible-ringen blijven behouden. De pilot mag op 390px geen horizontale overflow veroorzaken. Kleur is niet de enige informatiedrager; tekstlabels en bestaande semantische signalen blijven aanwezig. Alle bestaande zichtbare tekst en vertalingen blijven ongewijzigd.

## Acceptatiecriteria

- Work Sans is via `next/font/google` aan de root gekoppeld met een robuuste fallback.
- Employees gebruikt een rustige, vlakke filter- en lijstpresentatie zonder wijziging van gedrag.
- Detail-, compact-, card- en fotoweergaven blijven selecteerbaar en navigeren naar dezelfde employee-bestemmingen.
- Directorybeperkingen, e-mailgedrag, archiefstatus en de bestaande medewerkerstypepresentatie blijven veilig en zichtbaar.
- NL/EN-sleutels blijven gelijk.
- Typecheck, lint, tests, i18n-check en productiebuild zijn groen.
- De route is op desktop en 390px gecontroleerd; filter openen/sluiten, zoeken, wissen, filters, sortering, scope, view modes, links en focus zijn gecontroleerd.

## Buiten scope

Geen redesign van sidebar, navigatie, andere modules, gedeelde componentbibliotheek, globale button-/form-stijlen, datafetching, query- of filterlogica, database, API, permissions, schema, versie, release of deployment.

## Verificatie en overdracht

- `git diff --check`: groen.
- `npm.cmd run type-check --workspace @liquid-hr/hr-suite`: groen.
- `npm.cmd test --workspace @liquid-hr/hr-suite`: **199 testbestanden / 760 tests groen**.
- `npm.cmd run lint --workspace @liquid-hr/hr-suite`: groen.
- `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite`: groen, 33 gelijke NL/EN-namespaces.
- `npm.cmd run build --workspace @liquid-hr/hr-suite`: groen, 225 routes/pages gegenereerd.
- Authenticated browsercontrole met Test HR Admin op `http://localhost:3000/employees`: desktop- en 390×844-layout gecontroleerd; Work Sans actief; 0 console-errors; alleen de verwachte Next dev/HMR/preload-waarschuwingen.
- Browsergedrag: filter openen, zoeken met URL-state, filters wissen inclusief leeg zoekveld, detail- en kaartweergave, bestaande medewerkerlinks en 390px-overflowcontrole (`scrollWidth = 390`) gecontroleerd. De zoek-/selectcontrols vallen op 390px volledig binnen het filtervlak.
- Geen schema-, API-, remote-, versie-, push- of deploymentwijziging.
- Openstaand: Edwin's visuele beoordeling; zonder akkoord geen volgende redesign-pagina.
