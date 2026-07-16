# Personal Liquid Dashboard — ontwerp

## Doel

Liquid Dashboard wordt de persoonlijke, persistente startpagina voor iedere ingelogde gebruiker. Een gebruiker kan meerdere eigen dashboards maken, benoemen, wijzigen, dupliceren, verwijderen en wisselen. De actieve keuze en widgetindeling blijven per tenant en gebruiker bewaard.

## Scope voor de grote test

Deze slice levert een echte dashboardfundering met beperkte, betrouwbare widgets. Zij implementeert nadrukkelijk nog niet de complete vrije tekst-naar-dashboard-engine uit de Liquid Display-documentatie.

### Inbegrepen

- Route `/dashboard` als eerste bestemming na login; `/` verwijst daarheen.
- Dashboard in de linkerbalk als eerste platte functie, naast HeRa, medewerkers, afdelingen en OrgChart.
- Persoonlijke dashboards met naam, standaarddashboard en actieve selectie.
- Handelingen: nieuw, hernoemen, dupliceren, verwijderen en wisselen.
- Bewerkmodus: widgets toevoegen/verwijderen en hun vaste, duidelijke volgorde wijzigen; wijzigingen worden bewust opgeslagen.
- Eerste widgetcatalogus:
  - persoonlijke reminders;
  - organisatie-overzicht;
  - medewerkers-overzicht;
  - persoonlijke welkomst- en contextkaart.
- Responsieve Liquid HR-weergave, volledige NL/EN-vertalingen, RLS, server-side contextcontrole en tests.

### Uitgesloten

- Vrije natuurlijke-taalquery's, charts, word clouds en generatieve widgets.
- HeRa die zelf dashboardconfiguraties schrijft.
- Gedeelde dashboards, rollen/templates voor andere gebruikers en drag-and-drop.
- Externe kanalen of data buiten bestaande Liquid HR-modules.

## Persoonlijk eigenaarschap en security

Een dashboard behoort exact aan één `tenant_id` en één geverifieerde `owner_user_id`. Tabellen krijgen RLS-policies voor de eigenaar en samengestelde tenant-FK's waar een referentie tenantgebonden is. De server leidt gebruiker, tenant en administratie af uit de sessie; geen route accepteert deze waarden als vertrouwde invoer.

Dashboardconfiguratie bevat uitsluitend een getypeerde widgetcode, positie en beperkte widgetinstellingen. Een JSON-configuratie wordt altijd server-side met Zod gevalideerd. De renderer kent uitsluitend vooraf gebouwde componenten; er is geen opgeslagen JSX, HTML of uitvoerbare code.

## Datamodel

`personal_dashboards`:

- `id`, `tenant_id`, `owner_user_id`, `name`, `is_default`, `created_at`, `updated_at`.
- Unieke default per gebruiker en tenant, bewaakt door partiële unieke index.

`personal_dashboard_widgets`:

- `id`, `tenant_id`, `dashboard_id`, `widget_type`, `position`, `settings`, `created_at`, `updated_at`.
- Unieke positie per dashboard; widgetconfiguratie is beperkt tot de bekende catalogus.

Bij verwijderen van een dashboard verdwijnen de widgets transactioneel. Een gebruiker heeft altijd een dashboard: bij het openen wordt, indien nodig, één standaarddashboard met de basiswidgets aangemaakt.

## Interactie

De pagina heeft bovenaan een compact dashboardmenu met naam, wisselaar en acties. In normale modus tonen widgets alleen informatie en hun eigen veilige deeplinks. Bewerkmodus toont een duidelijke werkbalk: widget toevoegen, widget verwijderen, hoger/lager plaatsen, naam wijzigen, dupliceren en verwijderen. Een expliciete knop **Opslaan** bewaart de nieuwe configuratie; **Annuleren** verwerpt alleen de nog niet opgeslagen lokale wijzigingen.

De widgetvolgorde is toegankelijk en voorspelbaar via knoppen; drag-and-drop komt pas terug wanneer de brede Liquid Display-engine aan de beurt is.

## Widgets in v1

| Widget | Bron | Veilig gedrag |
|---|---|---|
| Welkom & context | geverifieerde gebruiker en actieve administratie | toont geen extra HR-data |
| Mijn reminders | bestaande persoonlijke reminder-service | alleen reminders die de gebruiker reeds mag zien |
| Organisatie-overzicht | bestaande afdelings- en OrgChart-readmodellen | toont alleen geautoriseerde aantallen/deeplink |
| Medewerkers-overzicht | bestaande employee-readmodel | toont alleen geautoriseerde aantallen/deeplink |

Wanneer een gebruiker geen recht heeft op een widgetbron, toont de renderer een neutrale, i18n-klare lege toestand; het dashboard lekt geen aantallen of namen.

## Integratie met HeRa en Liquid Display

HeRa blijft een afzonderlijke, persoonlijke chat. Een volgende Liquid Display-slice kan via dezelfde typed widgetregistry veilig een door de gebruiker goedgekeurde widget toevoegen. Dit ontwerp voorkomt dat de dashboardfundering moet worden herschreven, zonder de onveilige of onvolledige vrije query-engine al te simuleren.

## Acceptatiecriteria

- Iedere gebruiker ziet na login zijn of haar persoonlijke standaarddashboard.
- Een tweede dashboard kan worden aangemaakt, een naam krijgen, worden geactiveerd en blijft na refresh actief.
- Een wijziging aan widgets wordt alleen na **Opslaan** persistent.
- Verwijderen van een dashboard verwijdert uitsluitend eigen widgets en nooit een ander dashboard.
- Een widget toont geen data zonder bestaande server- én RLS-autorisatie.
- NL/EN-sleutels zijn gelijk; mobiel heeft geen horizontale overflow.
- HeRa, reminders en de platte linkerbalk blijven bereikbaar.

## Open vervolg

Na de grote test volgt de volledige Liquid Display-engine: veilige query-parser, typed queryprocessor, charts/tables en door HeRa voorgestelde dashboardwidgets. Dat vervolg vereist eerst de beschikbare Supabase-omgeving voor schema-, RLS- en isolatieverificatie.
