# LiquidHR hoofdnavigatie/sidebar v2

## Productbesluit

De hoofdnavigatie blijft één niveau diep en gebruikt vaste functionele secties. Alleen zichtbare items worden getoond; lege secties en sectiekoppen verdwijnen.

- **Dagelijks:** Startpagina, Werk, Kalender
- **Mensen & organisatie:** Medewerkers, Organogram, Ontwikkeling
- **HR-processen:** Sollicitaties, Journeys, Onderzoeken
- **Sturen:** Inzichten
- **Beheer:** Instellingen

De legacy globale Dashboard-route `/dashboard` redirect naar `/insights/analysis` en staat niet in de sidebar. Binnen Insights is Analyse als `dashboard:read`-gated bestemming beschikbaar. Startpagina (`/dashboard/start`) blijft de primaire home.

## Product Updates

Wat is nieuw is geen gewone navigatierij meer. De sidebar toont een compacte Lucide Gift-trigger met de bestaande `productUpdateUnreadCount`. Bij ongelezen updates verschijnt een compacte rode count-badge; openen toont de bestaande productupdates in de canonical Drawer. De bestaande banner, login-popup en legacy route `/product-updates` blijven voor backwards compatibility bestaan.

## Voorkeuren en context

De bestaande `liquidhr.sidebar-menu-order`-voorkeur wordt veilig genormaliseerd. Oude Dashboard/product-update/stale waarden worden genegeerd; opgeslagen volgorde beïnvloedt alleen items binnen dezelfde vaste sectie. De HR-groep-switcher gebruikt uitsluitend `getHrGroupSwitcherMode`: verborgen bij maximaal één groep en een select bij meer dan één groep.
