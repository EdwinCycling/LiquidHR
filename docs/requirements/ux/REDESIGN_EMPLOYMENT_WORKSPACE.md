# Employment Workspace UX-redesign

Datum: 2026-08-20
Route: `/employees/[employeeId]/employments/[employmentId]`
Status: **GEIMPLEMENTEERD — lokale gates uitgevoerd; browsergate open**

## Doel en goedgekeurde scope

Employment Detail is een compacte werkplek voor één dienstverband. De medewerker blijft herkenbaar, zonder tweede volledige Employee Profile-card of gradient hero. De volledige presentatie-slice omvat:

- de Employee → Employment-overviewingang en kaartpresentatie;
- de **Compact Work Context Header**;
- alle acht bestaande workspace-tabs: Overview, Schedule, Salary, Organization, Company Location, Costs, Processes en History;
- presentatiecomponenten en dialogs die rechtstreeks door deze workspace worden gebruikt: timelines, managers, contract-/mutationpresentatie, SalaryBandPositionCard, bevestigingsdialogen en de zichtbare delen van EmploymentContractChangeDialog.

## Compact Work Context Header

De header toont in één vlakke Foundation-surface:

- avatar en volledige naam;
- functie, afdeling en administratie;
- dienstverbandnummer;
- Actief, Toekomstig of Beëindigd;
- Primair alleen wanneer relevant;
- startdatum en einddatum, met Doorlopend zonder einddatum;
- de bestaande actie rechts;
- direct daaronder de acht vlakke workspace-tabs met actieve onderstreping.

Er is geen tweede volledige Employee Profile-card, gradient hero, decoratieve hero-illustratie of nieuwe functionele actie toegevoegd.

## Foundation-migratie

De presentatie gebruikt UX Foundation v1: semantic surfaces, Foundation Button/buttonClasses, Badge, EmptyState, SectionHeader, InfoList, vlakke separators en Foundation-tokens. De migratie behoudt bestaande data, links, URL-state, autorisatie, permissions, fetches, payloads, berekeningen, effective dating, validatie en mutatiegedrag.

- Overview gebruikt compacte sectiehiërarchie, metadata en separators.
- Schedule gebruikt de bestaande WorkPatternPanel, EmploymentTimeMap, SelectableTimelineList en mutationpresentatie met rustige tijdlijn/list-structuur.
- Salary behoudt bedragen, permissions, salary-bandpositie, compa/range penetration en effective dating; restricted states en acties zijn Foundation-presentatie.
- Organization en Company Location gebruiken dezelfde current/future/history-hiërarchie in managers en SelectableTimelineList.
- Costs behoudt alle allocations, totalen, 100%-validatie en mutationcontrols, inclusief desktop- en 390px-layout.
- Processes gebruikt Badge, Button, EmptyState en Surface zonder engine-, route- of permissionwijziging.
- History gebruikt een rustige auditlijst/tijdlijn zonder zware event-cards.
- Contract- en mutationpresentatie gebruikt dezelfde dialogs, acties, formulieren en statusgedrag; alleen zichtbare styling en hiërarchie zijn aangepast.

## Functionele grenzen

Geen schema, migration, API-contract, RLS-policy, permission, route, edit-capability, businesslogica, salary-engine, berekening of Supabase-write is gewijzigd. De bestaande organisatiecontext-read voor de stabiele header blijft beperkt tot de eerder goedgekeurde headercontext; er is geen bredere data-fetchuitbreiding toegevoegd.

## Responsive en toegankelijkheid

- De header en tabs blijven bruikbaar op desktop en 390px; de tabstrip kan horizontaal scrollen.
- Bestaande focus states, `aria-current`, dialog semantics, labels en keyboard flows blijven behouden.
- Current, future en history blijven visueel onderscheiden zonder uitsluitend op kleur te vertrouwen.
- Native date/number/textarea/select-controls in mutation- en dialogflows behouden hun bestaande gedrag; waar Foundation-controls al bestaan worden die hergebruikt.

## Acceptatiecriteria

- Compact Work Context Header toont alle goedgekeurde contextvelden en de bestaande acties.
- Alle acht tabs zijn bereikbaar, presenteren de bestaande data en gebruiken de Foundation-hiërarchie.
- Employee employment-overviewingang en kaartpresentatie sluiten visueel op de workspace aan.
- Direct gebruikte contract-, timeline-, manager-, mutation- en dialogpresentatie is gemigreerd zonder functionele uitbreiding.
- Geen tweede profielkaart, gradient hero, nieuwe tab, nieuwe write of nieuwe capability.
- NL/EN namespaces blijven gelijk.
- Gerichte tests, volledige hr-suite-tests, strict typecheck, i18n-check, productiebuild en diff-check zijn uitgevoerd; lint wordt alleen als bekende infrastructuurblocker gerapporteerd.
- Authenticated browsercontrole op desktop en 390px wordt alleen gerapporteerd wanneer een veilige sessie/env beschikbaar is.

## Legacy-scan

De scan is beperkt tot de Employment Workspace en direct gebruikte presentatie. Legacy `status-chip`, `button-primary`, `button-secondary`, `rounded-xl/2xl`, ad-hoc shadows, hover-lift en gradients zijn verwijderd of vervangen door Foundation-patronen. Resterende `rounded-[var(--radius-overlay)]` en `shadow-lg` zijn echte dialogs/overlays; native `form-field`-controls blijven uitsluitend waar hun bestaande native form-gedrag direct aan mutation- of dialogpayloads is gekoppeld.

## Buiten scope

Geen nieuwe Employment-functionaliteit, schema- of Supabase-write, remote migration, release/version bump, deployment, main-merge of main-push.
