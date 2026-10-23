# PMUX-07A — Procesinzichten en doorlooptijden

## Doel en status

Deze slice voegt een geautoriseerd, geaggregeerd rapport toe voor procesvolumes, kalenderdoorlooptijd, wachttijd tot eerste claim, SLA-prestaties en herhaalde stapknelpunten. Het is gericht op procesverbetering; individuele medewerkers worden niet gemeten of gerangschikt.

**Status:** lokale applicatie- en SQL-contractimplementatie. Remote migratie/readback en browser-/390px-acceptatie blijven OPEN.

## Capabilitymatrix

| Onderdeel | Bestaand | Toegevoegd in PMUX-07A |
| --- | --- | --- |
| Proceshistorie | `process_instances`, append-only `process_events`, gepinde `process_version_id` | Aggregatie van start- en terminalevents binnen periode |
| Stapuitvoering | `process_step_instances.activated_at/completed_at`, `process_work_items`, claim-events | Wachttijd tot eerste claim en actieve niet-geclaimde stappen |
| SLA | Bij activering gematerialiseerd `deadline_at` van PMUX-06A | Binnen/buiten SLA op afgeronde stappen met deadline |
| Operationele bewaking | PMUX-06C scoped inbox voor herstelbare operationele gevallen | Geen wijziging; rapportage is een aparte Insights-weergave |
| Rapportcatalogus | Bestaande Insights-catalogus, rapportrechten en workspace | Een catalogusrapport met bestaande `process-operations:read`-permission |
| Tenant-/procesrechten | Bestaande proces-scopefunctie en actieve HR-groep | Server-side scopefiltering vóór aggregatie en paginering |

## Toegang en gegevensgrenzen

De route gebruikt `process-operations:read` en vereist een actieve HR-groep. De rapportprojectie controleert identiteit en procesrechten server-side. De periode wordt begrensd tot maximaal 366 kalenderdagen. Geen gegevens van buiten de geautoriseerde HR-groep of tenant beïnvloeden totalen, filters of paginering.

De projectie bevat geen formulierantwoorden, medewerkeridentiteiten, deelnemers of ruwe eventpayloads. Interne proces-ID's worden niet als rapporttekst getoond. Bestaande geautoriseerde werkitemdetails kunnen via een bestaande detailroute worden geopend wanneer een relevante werkitemlink beschikbaar is.

## Definities

- **Verslagperiode:** inclusieve lokale datums `from` en `to`; de database vertaalt de start naar lokale middernacht en de bovengrens naar lokale middernacht van de volgende dag in de tijdzone van de actieve HR-groep. De interval is `[from, day-after(to))` en is DST-correct.
- **Gestart:** `PROCESS_STARTED`-event valt binnen de verslagperiode.
- **Afgerond / afgewezen / geannuleerd:** `PROCESS_TERMINAL`-event met respectievelijk `COMPLETED`, `REJECTED` of `CANCELLED` valt binnen de periode. Afgewezen en geannuleerd tellen niet als geslaagde voltooiing.
- **Lopend:** huidige status `RUNNING`, `WAITING` of `BLOCKED`, beperkt tot instanties waarvan het startevent in de gekozen periode viel. Dit is geen historische as-of reconstructie.
- **Kalenderdoorlooptijd:** verstreken tijd tussen `started_at` en `completed_at` voor succesvolle instanties waarvan het voltooiingsevent binnen de periode valt. Nachten en weekenden tellen mee. Afgewezen, geannuleerde, mislukte en lopende instanties hebben geen geslaagde sample.
- **Wachttijd stap:** verstreken tijd tussen `activated_at` en het eerste `WORK_ITEM_CLAIMED`-event voor een stap met werkitem(s). Niet-geclaimde actieve stappen krijgen geen verzonnen wachttijdsample en worden apart getoond. Dit is wachttijd tot claim, geen actieve behandeltijd.
- **SLA-percentage:** teller is afgeronde stapinstanties met `completed_at <= deadline_at`; noemer is alle afgeronde stapinstanties met een gematerialiseerde deadline, waarvan afronding in de periode viel. Geen deadline, niet-afgerond en afgewezen/geannuleerd tellen niet mee.
- **Herhaald buiten SLA:** dezelfde stap binnen dezelfde gepinde procesversie heeft minstens twee afgeronde SLA-overschrijdingen binnen de verslagperiode. Dit is een procesknelpunt, geen individuele prestatiemaat.
- **Procesversies:** elke instantie blijft geaggregeerd onder haar immutable `process_version_id`; historische staplabels en versieomschrijving komen uit de gepinde definitie. Versies worden niet samengevoegd alsof hun configuratie gelijk was.
- **Paginering en totalen:** de SQL-projectie filtert eerst op tenant-/HR-groep-/procesrechten, periode en optionele procesfilter; daarna worden exacte gefilterde totalen en pagina's berekend. De client voert geen ongefilterde data-aggregatie uit.

## UX en architectuur

Het rapport staat in het bestaande Insights-overzicht en gebruikt de bestaande rapportcatalogus, workspace-layout, Foundation-knoppen, semantische tokens en lokale NL/EN-berichten. De route bevat periode- en procesfilters, KPI's, vergelijking per procesversie, knelpunten en paginering. Loading, empty, invalid-filter, error en permission-denied zijn benoemd. Op small screens worden procesrijen als gestapelde inhoud getoond.

De server haalt één scoped JSON-projectie op; er is geen tweede analytics-engine, procesmonitor, runtimepad, remindersysteem of mutatie. De lokale migratie bevat alleen forward-only indexen en de scoped projectie-wrapper; remote toepassen is niet onderdeel van deze slice.

## Acceptatie

- [x] PGlite-contract: periodegrenzen, Amsterdam DST-terugschakeling, statussen, doorlooptijd/wachttijd, SLA-noemer en exacte deadlinegrens, versiepinning, filter/paginering, scopeweigering en tenant-/HR-groepisolatie.
- [x] Vitest: queryvalidatie, filterinstellingen, toegankelijke labels, geen zichtbare technische identifiers, detailroute en empty/error-presentatie.
- [x] PMUX-06C blijft buiten de implementatie; gerichte regressie uitgevoerd vóór oplevering.
- [ ] Echte TEST-migratie en readback met afzonderlijk mandaat.
- [ ] Geautoriseerde browsercontrole op desktop en 390px, inclusief actieve HR Admin-sessie.
- [ ] Live JWT-/tenant-/HR-groep-negatieven en hosted/releaseacceptatie.
