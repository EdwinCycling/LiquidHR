# LiquidHR UX Foundation v1.2
## Interaction & Collection Patterns

Status: **DESIGN APPROVED — IMPLEMENTATION NOT STARTED**

Dit document is een uitbreiding van de leidende [LiquidHR UX Foundation v1](LIQUIDHR_UX_FOUNDATION_V1.md). Het definieert suitebrede interaction- en collectionpatronen voor nieuwe en gecontroleerd gemigreerde CRUD-slices. Het is uitsluitend een design- en documentatiespecificatie.

Er wordt in deze slice geen React-componentcode, CSS, Tailwind, route, API, database, migration, Supabase/RLS-, permission-, productflow-, deployment- of bestaande schermwijziging uitgevoerd.

## 1. Interaction model

Voor iedere Create- en Edit-flow wordt één van de volgende containers gekozen. Create en Edit van hetzelfde object gebruiken standaard hetzelfde interaction pattern.

### 1.1 Inline

Inline editing is uitsluitend bedoeld voor zeer kleine wijzigingen met laag risico:

- circa één tot drie simpele velden;
- directe context naast of in de collectie;
- geen complexe afhankelijkheden;
- geen uitgebreid validatieproces.

Geschikte voorbeelden zijn een eenvoudige status, categorie of korte waarde.

Inline is geen standaardcontainer voor normale CRUD. Zodra meerdere samenhangende velden, afhankelijkheden of complexe validatie ontstaan, wordt FormDrawer gebruikt.

### 1.2 FormDrawer — default CRUD

`FormDrawer` is de standaard voor normale Create/Edit CRUD, zoals een reminder, note, profile link, relatie, eenvoudige documentmetadata of een normaal instellingenobject.

- Desktop en tablet: drawer aan de rechterzijde.
- Mobiel: full-screen sheet/drawer.
- Create en Edit van hetzelfde object: hetzelfde patroon, dezelfde action-opbouw en dezelfde dirty-form-bescherming.

Een drawer sluit alleen na een succesvolle save. Tijdens saving wordt dubbel indienen voorkomen.

### 1.3 Full page

Een full page is uitsluitend voor complexe formulieren en flows met veel velden, meerdere secties, afhankelijkheden, complexe validatie of een wizard-/processcontext.

Voorbeelden zijn medewerker, dienstverband, uitgebreide configuratie en multi-step workflows.

Een full page wordt niet gekozen omdat een normaal CRUD-formulier toevallig veel ruimte inneemt. De complexiteit van de taak bepaalt de container.

### 1.4 Dialog

Een centered modal/dialog is uitsluitend voor een korte beslissing:

- bevestiging;
- waarschuwing;
- destructive confirmation;
- korte keuze of beslissing.

Een dialog is geen standaardcontainer voor lange Create/Edit-forms. Delete en Archive lopen via `ActionMenu` naar `ConfirmDialog`.

## 2. Form actions

`Save` en `Cancel` zijn altijd bereikbaar.

### 2.1 Drawer contract

Een FormDrawer heeft:

- een vaste header;
- een body die zelfstandig verticaal scrollt;
- een vaste footer;
- altijd zichtbare `Annuleren`- en `Bewaren`-actions;
- een visueel gescheiden destructive action wanneer zo'n action bestaat.

De action hierarchy is:

- links: optionele destructive of secondary action;
- rechts: `Annuleren`, daarna `Bewaren` als primary action.

### 2.2 Full-page contract

Korte forms mogen hun actions in de normale documentflow tonen. Lange forms gebruiken sticky `FormActions` onderin de viewport. De gebruiker hoeft nooit naar het einde van een lange pagina te scrollen om `Bewaren` te vinden.

### 2.3 Saving en fouten

Tijdens saving is de primary button loading en disabled. Double-submit is niet toegestaan.

- Veldfouten staan bij het betreffende `FormField`.
- Een algemene serverfout is zichtbaar binnen het formulier en de actioncontext.
- De drawer sluit alleen na een succesvolle save.

De statevolgorde is:

```text
idle → dirty → saving → saved/error
```

Foundation-componenten verzorgen presentatie en interactie van deze states, maar geen businessvalidatie en geen domeindatafetch.

## 3. Dirty-form protection

Een dirty form wordt beschermd bij:

- sluiten via `X`;
- `Escape`;
- sluiten via de backdrop;
- `Annuleren`;
- navigatie naar een andere route waar dit technisch passend is.

De bescherming gebruikt `ConfirmDialog` met twee duidelijke keuzes:

- wijzigingen negeren;
- terug naar het formulier.

Er wordt geen confirmation getoond wanneer niets is gewijzigd. Dezelfde bescherming geldt voor Create en Edit, ongeacht of de form in een drawer of full page staat.

## 4. Collection/CRUD standard

LiquidHR gebruikt één suitebrede collection philosophy. Een normale beheercollectie bestaat conceptueel uit:

```text
PageHeader
↓
CollectionToolbar
↓
actieve filters/context
↓
Collection
↓
result count + pagination indien nodig
```

Search, filter, sort, page en view-state worden waar zinvol in de URL bewaard. Daardoor blijven back/forward-navigation, deelbare context en terugkeer naar een collectie voorspelbaar.

Na Create of Edit blijft de bestaande filtercontext behouden. Ook de pagina en relevante positie/context blijven behouden waar dat technisch mogelijk is. Een save mag de gebruiker niet zonder reden naar een andere collectiecontext of de eerste pagina sturen.

## 5. Collection archetypes

Elke collectie kiest één primair archetype.

### 5.1 DataTable

Voor administratieve of configuratiedata met vergelijkbare kolommen.

Voorbeelden:

- afdelingen;
- competenties;
- instellingen;
- looncomponentconfiguratie.

### 5.2 EntityList

Voor personen of objecten waarbij identiteit en metadata belangrijker zijn dan kolomvergelijking.

Voorbeelden:

- medewerkers;
- reminders;
- journeys waar passend.

### 5.3 CardGrid

Alleen wanneer visuele herkenning werkelijk functionele waarde heeft, bijvoorbeeld medewerkers met foto’s of mogelijk kandidaten. CardGrid is geen generieke CRUD-presentatie en wordt niet gebruikt voor louter visuele afwisseling.

### 5.4 MasterDetail

Voor workbench-scenario’s waarin gebruikers records snel achter elkaar beoordelen of behandelen.

Voorbeelden zijn toekomstige payroll exceptions en taken/exceptions.

## 6. One best view rule

Iedere collectie krijgt standaard één voorgeschreven beste weergave. Er komt geen generieke `Table | List | Cards`-switch op ieder scherm.

View switching is alleen gerechtvaardigd wanneer meerdere views aantoonbaar verschillende functionele use cases ondersteunen. `/employees` is een expliciete reference exception, omdat identiteit en foto’s daar functionele waarde hebben.

## 7. Row interaction standard

Navigatie is tekst. Acties zijn controls.

Een rij bevat als basis:

- primaire identiteit als duidelijke naam-/titellink;
- ondersteunende metadata;
- status via `Badge`.

Row actions volgen deze regels:

- maximaal één frequente zichtbare actie wanneer dat nuttig is;
- overige acties via één centraal `…` `ActionMenu`;
- destructive actions zijn niet prominent in iedere rij;
- meerdere onduidelijke icon-only actions worden vermeden.

Icon-only is alleen toegestaan wanneer de betekenis universeel duidelijk is, een accessible label aanwezig is en compactheid daadwerkelijk nodig is.

Entire-row click is toegestaan voor duidelijke navigatie, maar niet wanneer dit conflicteert met interactieve controls in de rij.

## 8. Inline edit standard

Inline editing blijft bewust beperkt.

Geschikt zijn status, prioriteit, eenvoudige categorie en een korte eenvoudige waarde. Niet geschikt zijn persoonsgegevens, bedragen met afhankelijkheden, meerdere samenhangende velden, complexe datums en complexe validatie.

De normale state blijft read-only. Na een expliciete editactie mag tijdelijk de volgende compacte state ontstaan:

```text
waarde | input | save | cancel
```

Save toont loading/disabled en een lokale fout waar nodig. Er is geen onnodige page refresh. Alles wat complexer is dan deze compacte wijziging gebruikt `FormDrawer`.

## 9. Scroll contract

Voor normale CRUD-lijsten geldt **page scroll**. De standaard is dus niet:

```text
page → card → intern scrollbaar div → table/list → tweede scrollbar
```

Toolbar, collectie en pagination staan in de normale documentflow. Een sticky kolomheader is toegestaan bij lange DataTables.

Interne verticale scrolling is alleen toegestaan wanneer die functioneel noodzakelijk is, bijvoorbeeld in een drawer body, embedded dashboardpanel of bounded MasterDetail-paneel.

Een FormDrawer heeft altijd:

```text
fixed header
+
scrollable body
+
fixed footer
```

## 10. Pagination

Pagination wordt niet toegevoegd voor louter visuele consistentie.

Tot ongeveer 100 resultaten is geen pagination nodig wanneer de dataset praktisch en performant blijft. Structureel grotere datasets gebruiken pagination, standaard circa 50 resultaten per pagina. Infinite scroll wordt niet gebruikt voor normale beheer- en CRUD-schermen.

Deze keuze houdt positie, totaal, back-navigation en editcontext herkenbaar en voorspelbaar.

Waar mogelijk toont pagination:

```text
1–50 van 347
50 per pagina
Previous / pages / Next
```

De exacte server- en clientimplementatie blijft domeinafhankelijk.

## 11. Responsive collections

Op desktop tonen collecties echte DataTable- of EntityList-rows waar dat passend is.

Rond 390px geldt:

- primaire identiteit blijft bovenaan;
- secundaire kolommen mogen onder elkaar als metadata verschijnen;
- row actions blijven bereikbaar;
- filters mogen compact inklappen;
- pagination blijft bruikbaar;
- verplichte horizontale pagina-scroll wordt vermeden.

Iedere relevante UX-slice wordt op desktop en rond 390px beoordeeld. Responsive gedrag is onderdeel van het collection contract en geen latere stylingcorrectie.

## 12. Foundation v1.2 gap en componentarchitectuur

Deze lijst beschrijft de beoogde Foundation-gaps. Implementatie is in deze design task niet gestart.

### 12.1 Nieuwe primitives in `components/ui`

- `Dialog`;
- `Drawer`;
- `ActionMenu`;
- `Pagination`.

### 12.2 Nieuwe patterns in `components/patterns`

- `FormDrawer`;
- `FormActions`;
- `ConfirmDialog`;
- `CollectionToolbar`;
- `RowActions`;
- `CollectionPagination`;
- `DataTableShell`;
- `EntityList`.

### 12.3 Ownership

`components/ui` bevat generieke primitives. `components/patterns` bevat herbruikbare LiquidHR-composities. `components/layout` bevat generieke layoutcontracten. Domeincomponenten bevatten business- en domeingedrag.

`DataTableShell` is nadrukkelijk geen generic table engine. Er wordt geen alles-in-één-framework gebouwd in de vorm van:

```tsx
<DataTable columns={...} data={...} />
```

`DataTableShell` standaardiseert uitsluitend surface, borders, spacing, headers, row states, het sticky-headercontract, responsive behavior en empty/loading/error composition. Domeincomponenten bepalen zelf kolommen, data, businesslogica, permissions en endpoints.

`EntityList` biedt alleen generieke compositie voor primary label, secondary metadata, optionele avatar/icon, badges, actions en responsive stacking.

Geen generiek Foundation-component bevat datafetch, permissions, businessvalidatie of API-kennis. Er is geen permission decision in een generic Foundation-component.

## 13. Accessibility contract

Er wordt geen externe UI-library toegevoegd. De toekomstige primitives en patterns implementeren minimaal de volgende contracts.

### 13.1 Dialog en Drawer

`Dialog` en `Drawer` specificeren:

- portal-rendering;
- focus trap;
- `Escape`-gedrag;
- een gelabelde title;
- optionele description;
- focus restore naar de trigger;
- correcte modal semantics;
- backdrop interaction;
- keyboard navigation.

Een drawer blijft voor keyboard- en screenreadergebruik een modal interaction context; de layoutpositie verandert de semantiek niet.

### 13.2 ActionMenu

`ActionMenu` heeft:

- keyboard navigation;
- `Escape`;
- focus management;
- disabled items;
- destructive semantic styling;
- een accessible label op de trigger.

### 13.3 Pagination

Pagination heeft:

- nav semantics;
- een herkenbare current page;
- gelabelde Previous/Next-controls;
- zichtbare keyboard/focus-states.

## 14. State en architectuurgrenzen

Create/Edit-interacties volgen deze state machine:

```text
idle → dirty → saving → saved/error
```

Foundation verzorgt presentatie en interactie van de state. Foundation verzorgt geen businessvalidatie, domeindatafetch, permissionbeslissingen of API-kennis.

De grenzen blijven:

```text
components/ui       = generic primitives
components/patterns = herbruikbare LiquidHR-composities
components/layout   = generic layout contracts
domain components   = business/domain behavior
```

Deze uitbreiding introduceert geen tweede of concurrerend design system en verandert de bestaande v1-foundation niet buiten de beschreven interaction- en collectioncontracts.

## 15. Migratiestrategie

Er is geen big-bang migratie.

### Phase A — Foundation

Bouw en test de v1.2-primitives en -patterns.

### Phase B — Reference implementation

Kies één representatieve echte CRUD-flow met collection, create, edit, delete/confirm, drawer en row actions. De reference implementation moet de volledige interaction- en collectionketen aantonen.

### Phase C — Nieuwe roadmap-slices

Nieuwe roadmap-slices gebruiken v1.2 als standaard voor hun collectie-, form- en actionkeuzes.

### Phase D — Gecontroleerde afwijkingen

Bestaande afwijkingen worden geregistreerd en per slice gecontroleerd gemigreerd.

### Phase E — Final Product UX Sweep

De sweep verwijdert resterende:

- lokale modalvarianten;
- verborgen Save-knoppen;
- afwijkende row actions;
- onnodige interne scroll;
- inconsistente pagination;
- afwijkende Create/Edit-containers.

## 16. Governance en decision matrix

Deze matrix is verplicht bij iedere nieuwe CRUD-slice.

| Vraag | Verplichte keuze of richtlijn |
|---|---|
| 1. Wat voor collectie is dit? | Kies `DataTable`, `EntityList`, `CardGrid` of `MasterDetail`. |
| 2. Heeft deze collectie echt meerdere views nodig? | Standaard nee; alleen bij aantoonbaar verschillende functionele use cases. |
| 3. Hoe wordt Create uitgevoerd? | Kies inline, drawer of page op basis van complexiteit. Normaal CRUD gebruikt drawer. |
| 4. Hoe wordt Edit uitgevoerd? | Bij normaal CRUD gelijk aan Create. |
| 5. Waar staat Delete/Archive? | `ActionMenu` → `ConfirmDialog`. |
| 6. Is inline edit gerechtvaardigd? | Alleen voor simpele, lage-risico waarden. |
| 7. Is pagination nodig? | Niet automatisch; richtgrens ongeveer 100 resultaten. |
| 8. Welk scrollmodel? | Normale CRUD gebruikt page scroll. Interne scroll alleen functioneel noodzakelijk. |
| 9. Zijn Save/Cancel altijd bereikbaar? | Verplicht ja. |
| 10. Is desktop + circa 390px acceptance uitgevoerd? | Verplicht ja voor iedere relevante UX-slice. |

De beslissing en eventuele afwijking worden vastgelegd bij de betreffende slice. Een afwijking is geen reden om een generieke view-switch of lokale componentvariant toe te voegen.

## 17. Buiten scope van deze design task

Deze slice bevat geen:

- React-componentcode;
- CSS of Tailwind-wijzigingen;
- nieuwe npm-packages;
- routewijzigingen;
- API-wijzigingen;
- database of migrations;
- Supabase- of RLS-wijzigingen;
- permissionwijzigingen;
- productflow changes;
- migratie van bestaande CRUD-schermen;
- Vercel deployment;
- wijziging van `main`.

## 18. Spec self-review

De specification is GREEN wanneer alle volgende punten expliciet zijn:

- geen open placeholders of onbesliste onderdelen;
- geen tegenstrijdigheid tussen modal, drawer en page;
- create/edit-consistency is expliciet;
- pagination- en scrollregels zijn expliciet;
- `DataTableShell` is expliciet geen table engine;
- accessibility is beschreven voor Dialog, Drawer, ActionMenu en Pagination;
- responsive gedrag is beschreven;
- migration strategy is beschreven;
- component ownership tussen `ui`, `patterns`, `layout` en domain is duidelijk.

Voor deze design task is de self-review **GREEN**. De implementatiestatus blijft **NOT STARTED**.
