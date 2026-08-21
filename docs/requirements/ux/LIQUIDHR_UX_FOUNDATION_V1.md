# LiquidHR UX Foundation v1

Status: **LEIDEND — Blok 4 afgerond op 2026-08-20**
Scope: **Blok 1 t/m Blok 4; Employees en Employee Detail zijn reference implementations**

## 0.1 Blok 3 afgerond

`/employees` en `/employees/[employeeId]` gebruiken de Blok-2-foundation voor shell, headers, surfaces, badges, empty states en de 2/3 + 1/3 detailkolommen. Alle bestaande routes, URL-state, permissions, view modes, tabs, widgets, dashboardvoorkeuren en API-/businesslogica zijn behouden. Geen schema-, API-, RLS-, security-, release- of deploymentwijziging.

Dit document is vanaf 2026-08-20 de leidende algemene UX- en stylingfoundation voor de LiquidHR HR Suite. Het vervangt conflicterende suitebrede richting uit oudere conceptdocumenten. Historische ontwerpdocumenten blijven bewaard als context; bestaande schermen adopteren nieuwe patronen later, per gecontroleerde slice.

## 0.2 Blok 4 afgerond — governance

| Blok | Status |
|---|---|
| Blok 1 — CSS-, token- en theme-foundation | Afgerond |
| Blok 2 — centrale componentarchitectuur | Afgerond |
| Blok 3 — Employees en Employee Detail reference implementations | Afgerond |
| Blok 4 — governance, redesignskill en deliverydocumentatie | Afgerond |

De componentinventaris en architectuur zijn `components/ui` voor generieke primitives, `components/patterns` voor herbruikbare composities en `components/layout` voor generieke layoutcontracten. `/employees` is de reference list/workbench; `/employees/[employeeId]` is de reference profile/detail met ongeveer 2/3 hoofdinhoud en 1/3 aside via `DetailColumns`. LinkedHR is een officieel theme dat dezelfde Foundation gebruikt. De governance staat in `AGENTS.md` en de screen-redesignskill. Foundation v1 is gereed voor bredere, gecontroleerde schermmigratie.

### Acceptance- en compositienormen

- Belangrijke action labels worden nooit afgekapt: action grids passen het kolomaantal aan de beschikbare ruimte aan en tekst mag natuurlijk over meerdere regels wrappen. Elke relevante slice wordt op desktop en circa 390px beoordeeld.
- De detail/profile header bevat identiteit, status en compacte globale contextacties. Inhoudelijke edit/create-acties horen bij de relevante sectie; dezelfde actie wordt niet zowel in header als inhoud aangeboden.
- `SectionHeader` en acties mogen opvolgende content niet visueel raken. Los spacing lokaal en compositioneel op; wijzig `SectionHeader` niet globaal voor één schermprobleem.
- Grotere UX-slices zijn pas acceptance-GREEN nadat representatieve routes werkelijk in browser of testdeployment zijn gerenderd. Compile, tests en typecheck alleen zijn onvoldoende.
- Bij iedere nieuwe `t('key')`-reference wordt gecontroleerd dat de key in de betreffende NL- én EN-namespace bestaat en runtime resolveert; key-parity alleen is onvoldoende.

## 0. Blok 2 uitgevoerd

Blok 2 levert de centrale herbruikbare componentlaag op `feature/ux-foundation-v1`. De werkelijk beschikbare componenten zijn:

- `components/ui`: `Button`, `IconButton`, `TextInput`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `DropdownSelect`, `CountryPicker`, `Surface`, `Badge`, `EmptyState`.
- `components/patterns`: `PageHeader`, `SectionHeader`, `PageToolbar`, `FilterBar`, `InfoList`.
- `components/layout`: `PageShell`, `DetailColumns`.

De componentarchitectuur blijft daarmee `ui` voor primitives, `patterns` voor composities en `layout` voor shell-/layoutcontracten. Blok 3, inclusief Employees-list en Employee Detail-migratie, is afgerond.

## 0.3 Foundation Controls v1.1 — actuele compacte inventory

Deze controls zijn de centrale contracten voor volgende HR Suite-slices. Ze bevatten geen domeindata, businessvalidatie of permissionbesluit.

### Primitives — `components/ui`

- `Button`: `primary`, `secondary`, `danger`, `ghost`; `sm`/`md`; `loading`; directe Lucide-iconen krijgen vaste maat, gap en shrink behavior.
- `IconButton`: verplicht voor icon-only acties; vereist een toegankelijke `label`.
- `TextInput`: native inputtypes plus optionele `leadingIcon` en `trailingIcon`; decoratieve iconen zijn niet-interactief en `aria-hidden`.
- `Textarea`: native textarea-props met hetzelfde control-, focus-, invalid- en disabled-contract als `TextInput`.
- `Checkbox`: native checkboxsemantics voor selectie/toestemming/onderdeel van een set.
- `RadioGroup`: native radios met `name`, controlled/uncontrolled waarde, disabled options en optionele description.
- `Switch`: native checkboxsemantics met `role="switch"` voor directe aan/uit-instellingen; niet gebruiken als selectie uit een set.
- `DropdownSelect`: regular en searchable via hetzelfde contract (`<DropdownSelect searchable />`); native multiple blijft een eenvoudige native select, geen nieuwe multiselect-ervaring.
- `CountryPicker`, `Badge`, `Surface`, `EmptyState`.

### Patterns — `components/patterns`

- `FormField`: label, required indicator, description/help, control, error en correcte `aria-describedby`/`aria-invalid`-koppeling; bevat geen businessvalidatie.
- Canonical tabs: `ScrollableTabs`, `TabLink` voor echte route-links en `TabButton` voor client-state; actieve tab is een duidelijke 3px underline, met keyboardpijlen voor button tabs en overflowcontrols alleen bij echte overflow.
- `PageHeader`, `SectionHeader`, `PageToolbar`, `FilterBar`, `InfoList`.

### Layout — `components/layout`

- `PageShell`
- `DetailColumns`

`DropdownSelect` gebruikt `--radius-control` voor trigger/search, `--radius-overlay` voor de overlay en semantic surface/border/focus/elevation-tokens. Alle controls werken zonder theme-branching in zowel het standaardtheme als LinkedHR.

### FOUNDATION_GAP-kandidaten uit het vooronderzoek

- **Multiselect — LATER.** Concrete native multiple-selects bestaan in custom fields, reminders en documenten. De huidige Foundation kan deze native contracten behouden, maar biedt geen zoekbare selectie, chips, bulkacties of duidelijke keyboard-UX. Minimale latere API: opties, geselecteerde waarden, zoeken, selecteer/wis alles, `onChange` en native form-submissie.
- **Datepicker — LATER.** Er zijn concrete native `date`-inputs in employee-, organization- en calendarflows. `TextInput type="date"` is nu voldoende; een kalenderoverlay zou extra focus-, locale- en keyboardcontracten vereisen.
- **Dialog — LATER.** Er zijn meerdere bestaande domeinmodalen/-dialogen voor bevestiging, instellingen, reminders en documentpreview. Een generiek contract moet portal, focus trap, Escape, labelled title/description en restore-focus correct afhandelen; daarom niet speculatief in v1.1.
- **Tooltip — LATER/geen huidige gap.** Bestaande icon-acties hebben toegankelijke labels en waar nodig `title`; er is nu geen herhaald inhoudelijk tooltipcontract dat een nieuwe primitive rechtvaardigt.

## 1. Designrichting

De algemene suite gebruikt de richting **Structured Enterprise / Liquid Flow**:

- zakelijk, rustig en overzichtelijk;
- compact waar dit efficiënt is voor professionele HR- en payroll-power users;
- duidelijke informatiehiërarchie;
- geen decoratieve UI zonder betekenis;
- kleur draagt betekenis en is nooit het enige informatiedragende signaal.

De bestaande applicatieshell, sidebar, navigatie, contextswitching, persoonlijke thema's, company branding, URL-state, autorisatie en responsive grenzen blijven behouden. Foundation v1 is geen app-brede schermredesign.

## 2. Typografie

Work Sans is de primaire font voor de HR Suite. De font wordt via `next/font/google` geladen met een robuuste systeemfallback. Inter wordt niet ingevoerd en er wordt geen tweede applicatiefont toegevoegd.

De semantische niveaus voor toekomstige patronen zijn:

| Niveau | Gebruik |
|---|---|
| Page title | primaire titel van een pagina |
| Section title | titel van een inhoudelijke sectie |
| Card title | titel van een compact werkpaneel |
| Body | normale inhoudstekst |
| Secondary body | ondersteunende tekst en context |
| Label | veld-, filter- en controlabel |
| Caption | aanvullende metadata |
| Metric | cijferintensieve kernwaarde |

Cijferintensieve informatie gebruikt waar zinvol `tabular-nums`. Bestaande callers worden niet massaal aangepast in Blok 1.

## 3. Surfaces, radius en spacing

Normale werkpanelen zijn vlak, met een subtiele semantische 1px-rand en standaard zonder shadow of hover-lift. Elevated styling blijft gereserveerd voor semantisch verhoogde surfaces zoals overlays en dialogs. Decoratieve gradients zijn geen algemene surface-regel; bestaande auth- en product-update-visuals blijven als expliciete globale componentstijlen bestaan.

De foundation-contracten voor later gebruik zijn:

| Contract | Waarde |
|---|---:|
| `--radius-control` | 8px |
| `--radius-surface` | 8px |
| `--radius-overlay` | 12px |
| `--control-height` | 40px |
| `--space-4` | 4px |
| `--space-8` | 8px |
| `--space-12` | 12px |
| `--space-16` | 16px |
| `--space-24` | 24px |
| `--space-32` | 32px |

De bestaande globale `--radius` en bestaande Tailwind-radiusschaal worden niet gewijzigd. Pillvormen blijven beperkt tot semantisch logische gevallen.

## 4. Semantic tokens

De themewaarden blijven de bron voor alle tokens. De additive aliases zijn beschikbaar in `apps/hr-suite/app/styles/tokens.css`:

- surfaces: `workspace`, `surface`, `surface-subtle`, `surface-raised`, `surface-overlay`;
- borders: `border`, `border-subtle`;
- status: bestaande `success`, `warning` en `destructive`, plus een expliciet aliascontract voor `info`/`current` via de bestaande accentwaarden;
- spacing, controlhoogte en radius volgens de tabel hierboven.

React-componenten voegen geen nieuwe hardcoded hexkleuren toe. Persoonlijke thema's en company branding blijven CSS-variable overrides. Alle bestaande themes blijven beschikbaar: `liquid-navy`, `noordzee`, `bos`, `warm-zand`, `aubergine` en `nacht`.

LinkedHR is naast `liquid-navy`, `noordzee`, `bos`, `warm-zand`, `aubergine` en `nacht` een officieel LiquidHR-theme en gebruikt dezelfde Foundation.

## 5. Controls en iconen

De standaard interactieve controlhoogte is 40px. Controls behouden consistente focus-visible-, disabled- en selected states en consistente icon spacing. De iconbibliotheek blijft uitsluitend `lucide-react`:

- 16px voor compacte controls;
- 20px als standaardmaat;
- 24px voor grotere anchors.

Blok 1 verandert bestaande controlclasses niet inhoudelijk; de bestaande globale classes zijn alleen structureel verplaatst naar `components.css`.

## 6. Layoutpatronen

De volgende layout- en compositiepatronen zijn in Blok 2 beschikbaar voor gecontroleerd gebruik in latere slices:

- `PageShell`
- `PageHeader`
- `SectionHeader`
- `PageToolbar`
- `Surface`
- `FilterBar`
- `DetailColumns`

Het standaard detailpatroon is conceptueel 2/3 + 1/3 op desktop, met responsieve stacking op smallere schermen.

## 7. Componentarchitectuur

De foundation blijft in `apps/hr-suite`.

```text
apps/hr-suite/components/
  ui/          generieke primitives
  patterns/    herbruikbare LiquidHR UX-composities
  layout/      shell- en layoutcomponenten
  <domain>/    domeinspecifieke componenten
```

Blok 2 maakt bewust geen `packages/ui` en geen nieuwe component library. De afhankelijkheidsregel voor volgende blokken is:

- `ui` importeert geen domeincomponenten;
- `patterns` mag `ui` gebruiken;
- domeincomponenten mogen `ui`, `patterns` en `layout` gebruiken;
- generieke componenten doen geen eigen domeindatafetch en nemen geen permissionbesluit.

## 8. Blok 1 implementatiegrens

Blok 1 bevat uitsluitend:

1. dit leidende requirementsdocument;
2. minimale verwijzingen en conflictmarkering in de algemene documentatie;
3. structurele extractie van `globals.css` naar `styles/tokens.css`, `styles/themes.css`, `styles/base.css` en `styles/components.css`;
4. veilige additive tokens en behoud van alle bestaande themewaarden;
5. Work Sans als root-font via de bestaande Next fontmechaniek.

De berekende bestaande CSS blijft inhoudelijk gelijk, met uitzondering van de expliciet vastgelegde primaire Work Sans-font. Bestaande componentclasses, selectors, theme support, auth-visuals, kalenderstijlen, product-update-styling en focusregels blijven behouden.

## 9. Governancegrenzen en buiten scope

- Bredere schermmigratie na Foundation v1 gebeurt per gecontroleerde slice;
- Control-app, sidebar, navigatie of shell-redesign;
- app-brede schermmigratie;
- database, migrations, API-contracten, permissions of RLS;
- businesslogica, nieuwe workflows of npm UI-libraries;
- shadcn, MUI, Chakra, Ant, Radix of een ander nieuw UI-framework;
- release, deployment, version bump, merge naar `main` of remote databasewijzigingen.

Blok 4 zelf bevatte geen code-, design-, component-API-, database-, migration- of Supabase-wijziging. De eerder goedgekeurde LinkedHR-migratie en remote toepassing blijven ongewijzigd.
