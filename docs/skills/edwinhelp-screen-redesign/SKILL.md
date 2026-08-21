---
name: edwinhelp-screen-redesign
description: Redesign en verbeter LiquidHR-schermen wanneer de gebruiker vraagt om een modernere, vriendelijkere, snellere of gestroomlijnde UX, een pagina opnieuw te ontwerpen, of een volgende pagina volgens Liquid Flow aan te pakken. Gebruik deze skill ook wanneer de gebruiker alleen een route noemt en om een schermverbetering vraagt.
---

# EdwinHelp screen redesign

Gebruik deze skill voor één LiquidHR-scherm tegelijk. Het doel is een consistente Liquid Flow-ervaring: helder, rustig, vriendelijk, modern en efficiënt, zonder bestaande HR-functionaliteit stil te breken.

## Startpunt

Lees vóór onderzoek of wijziging:

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/delivery/CURRENT_CONTEXT.md`
4. `docs/requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md`
5. `docs/requirements/ux/SCHERM_REDESIGN_STATUS.md`
6. Het relevante schermrequirement
7. De relevante route- en componentcode

Bepaal daarna de route, rollen, permissies, bestaande componenten, API-routes, data-afhankelijkheden en actuele Git-status. Raak ongerelateerde bestaande wijzigingen niet aan. Stop en meld het wanneer de gevraagde pagina dezelfde bestanden gebruikt als onbegrepen wijzigingen buiten deze opdracht.

De Foundation is de eerste designbasis. De CSS-foundation staat in:

- `apps/hr-suite/app/styles/tokens.css`
- `apps/hr-suite/app/styles/themes.css`
- `apps/hr-suite/app/styles/base.css`
- `apps/hr-suite/app/styles/components.css`

De componentarchitectuur staat in:

- `apps/hr-suite/components/ui` — generieke primitives;
- `apps/hr-suite/components/patterns` — herbruikbare composities;
- `apps/hr-suite/components/layout` — generieke paginalayoutcontracten.

`globals.css` is niet de centrale designbasis; gebruik de Foundation-tokens, semantic CSS variables en gedeelde componenten.

## Werkwijze

### 1. Begrijp het scherm

Onderzoek read-only:

- wat de gebruiker op dit scherm probeert te bereiken;
- welke informatie en acties essentieel zijn;
- welke states bestaan: laden, leeg, fout, opgeslagen, disabled, modal en mobiel;
- welke server-side autorisatie en RLS-grenzen al bestaan;
- welke UX-problemen de gebruiker benoemt of die zichtbaar zijn in de bestaande flow;
- welke bestaande gedeelde componenten en design tokens herbruikbaar zijn.

Gebruik bij beheerpagina's standaard list-first: zoeken, filteren, sorteren, duidelijke selectie en modalacties. Gebruik voor gesloten keuzelijsten altijd de bestaande toegankelijke zoekbare keuzecomponent.

### 2. Leg het ontwerp vast

Maak of werk bij:

- `docs/requirements/ux/REDESIGN_[slug].md` voor het scherm;
- `docs/requirements/ux/SCHERM_REDESIGN_STATUS.md` met status, datum, route en volgende stap;
- `docs/delivery/CURRENT_CONTEXT.md` met wat klaar is, wat openstaat en welke verificatie is uitgevoerd.

Werk `docs/README.md` alleen bij wanneer het requirementsdocument een nieuwe leidende scope of documentverwijzing toevoegt.

Beschrijf in het schermdocument minstens doel, huidige problemen, nieuw ontwerp, states, responsive gedrag, toegankelijkheid, i18n, functionele grenzen, acceptatiecriteria en buiten-scope.

### 3. Beslisboom voor ieder UI-element

1. Bestaat er een Foundation primitive? Gebruik die.
2. Is het een combinatie van bestaande primitives die op meerdere schermen bruikbaar is? Plaats het als pattern.
3. Is het uitsluitend domeinspecifiek? Plaats het in de domeincomponenten.
4. Is het alleen een lokale stylingvariant van een bestaand Foundation-component? Bouw geen nieuw component; gebruik de Foundation-API en tokens.
5. Is een Foundation primitive werkelijk onvoldoende? Breid die eerst klein en backwards-compatible uit; bouw niet meteen een parallel component.

6. Bestaat de generieke behoefte wel maar ontbreekt de Foundation-component? Meld `FOUNDATION_GAP` met concrete use cases, tekortkoming, minimale API/behavior, verwachte hergebruiklocaties en **NU/LATER**-voorstel. Bouw geen lokale variant.

Parallelle product-runs mogen `components/ui` en generieke `components/patterns` niet zelfstandig uitbreiden tenzij hun opdracht dit expliciet toestaat. De onafhankelijke slice gaat verder met de gapmelding; de centrale Foundation-/integratortask lost de gedeelde behoefte op.

### 4. Ontwerp en implementeer

Gebruik de bestaande Liquid Flow-basis:

- Foundation-tokens en gedeelde stijlen in `apps/hr-suite/app/styles/`;
- bestaande form-, button-, dropdown-, modal-, list- en addresscomponenten;
- CSS-variabelen en Tailwind v4, geen hardcoded hexwaarden in componenten;
- duidelijke primaire actie, rustige spacing en zo weinig mogelijk dubbele uitleg;
- informatiepanelen alleen wanneer zij op dat scherm echt helpen;
- alle zichtbare tekst via NL/EN-vertalingen met gelijke sleutels.

De visuele richting is **Structured Enterprise / Liquid Flow**: zakelijk, menselijk, rustig en compact, met sterke informatiehiërarchie, beperkte decoratie, lichte semantic surfaces en een heldere primary action. Gebruik geen standaard gradients, hover-lift of overmatig veel cards. LinkedIn/Stitch-inspiratie mag profile hierarchy, de mens als visueel anker, rustige cards, vlakke tabs, duidelijke actiehiërarchie, compacte metadata en een moderne professional-software-uitstraling geven. Neem geen social feed, followers/connections, LinkedIn-branding, standaard grote coverfoto of logo/kleur/pixelkopie over.

Reference patterns:

- **List/workbench** — `/employees`: `PageShell`, `PageHeader`, `PageToolbar`/`FilterBar`, `Surface`, `TextInput`, `Button`/`IconButton`, `Badge`, `EmptyState`.
- **Detail/profile** — `/employees/[employeeId]`: `PageShell`, profile `Surface`, `SectionHeader`, `Badge`, `Button`/`IconButton`, tabs en `DetailColumns`.
- **DetailColumns** — desktop ongeveer 2/3 hoofdinhoud en 1/3 aside; mobiel main gevolgd door aside. Gebruik `DetailColumns` en vind niet per scherm opnieuw een 8/4-grid uit.

### 5. Themesafe ontwerpen

Een redesign gebruikt semantic tokens en is niet uitsluitend ontworpen voor één achtergrondkleur. Statuskleuren behouden hun betekenis. Company branding mag de Foundation niet breken. LinkedHR hoeft niet apart gecodeerd te worden. Nieuwe componenten moeten in de bestaande themes functioneren. Voor belangrijke reference- en redesignschermen is visuele controle in het standaardtheme en LinkedHR zinvol wanneer browsercontrole beschikbaar is; test niet standaard alle themes volledig matrixgewijs.

Behoud standaard route, API-contracten, database, permissies, RLS, data-eigenaarschap en bestaande gebruikersflows. Voer geen schema- of remote wijziging uit voor een visuele redesignopdracht tenzij de gebruiker dat afzonderlijk en expliciet vraagt.

Acceptance-normen voor iedere grotere UX-slice:

- belangrijke action labels worden niet afgekapt; grids passen hun kolomaantal aan en tekst mag natuurlijk wrappen;
- de detail/profile header blijft voor identiteit, status en compacte globale contextacties; edit/create hoort bij de relevante sectie en wordt niet dubbel aangeboden;
- opvolgende content krijgt lokale compositionele ruimte onder `SectionHeader`/acties;
- acceptance-GREEN vereist browser- of testdeployment-rendering van representatieve routes op desktop en circa 390px, naast compile/tests;
- nieuwe i18n-references worden inhoudelijk in NL en EN gecontroleerd en runtime getest; key-parity alleen volstaat niet.

Als de gebruiker alleen om een voorstel vraagt, stop na analyse, requirements en ontwerpvoorstel. Als de gebruiker akkoord geeft of expliciet vraagt om het door te voeren, implementeer dan de afgesproken scope.

### 6. Controleer het resultaat

Voer voor een geïmplementeerd scherm minimaal uit:

- gerichte typecheck en lint;
- `check:i18n` wanneer zichtbare tekst of taalbestanden wijzigen;
- relevante test of buildcontrole;
- browsercontrole op desktop en 390px mobiel wanneer layout of interactie is gewijzigd;
- controleer action wrapping, header-action hierarchy en scheiding tussen section header en opvolgende content;
- controle van toetsenbordfocus, lege toestand, foutmelding, loading en success state.

Rapporteer onderscheidend wat lokaal gecontroleerd is, wat inherited is en wat nog openstaat. Merge, push of deploy is geen onderdeel van deze skill tenzij de gebruiker daar apart opdracht voor geeft.

## Afgeronde schermen

Lees altijd `docs/requirements/ux/SCHERM_REDESIGN_STATUS.md` voordat je een nieuw scherm kiest. Voeg na afronding een nieuwe rij toe en wijs het volgende scherm aan.

De eerste afgeronde redesign is:

- `/settings/company-data` — zie `docs/requirements/ux/BEDRIJFSGEGEVENS_REDESIGN.md`.

De eerstvolgende pagina is:

- `/authorization` — Rollen en autorisatie.

## EdwinHelp-ingang

Gebruik bijvoorbeeld:

`Gebruik EdwinHelp. Redesign de pagina Rollen en autorisatie op /authorization. Lees eerst de bestaande autorisatie-requirements en het UX-statusdocument. Maak eerst het requirementsdocument en een ontwerpvoorstel.`

Voor direct implementeren:

`Gebruik EdwinHelp. Voer het redesign van Rollen en autorisatie op /authorization door volgens de screen-redesign-skill en werk alle UX-documentatie en status bij.`
