# LiquidHR UX Foundation v1

Status: **LEIDEND — Blok 3 uitgevoerd op 2026-08-20**
Scope: **Blok 1 t/m Blok 3; Employees en Employee Detail zijn reference implementations**

## 0.1 Blok 3 uitgevoerd

`/employees` en `/employees/[employeeId]` gebruiken de Blok-2-foundation voor shell, headers, surfaces, badges, empty states en de 2/3 + 1/3 detailkolommen. Alle bestaande routes, URL-state, permissions, view modes, tabs, widgets, dashboardvoorkeuren en API-/businesslogica zijn behouden. Geen schema-, API-, RLS-, security-, release- of deploymentwijziging.

Dit document is vanaf 2026-08-20 de leidende algemene UX- en stylingfoundation voor de LiquidHR HR Suite. Het vervangt conflicterende suitebrede richting uit oudere conceptdocumenten. Historische ontwerpdocumenten blijven bewaard als context; bestaande schermen adopteren nieuwe patronen later, per gecontroleerde slice.

## 0. Blok 2 uitgevoerd

Blok 2 levert de centrale herbruikbare componentlaag op `feature/ux-foundation-v1`. De werkelijk beschikbare componenten zijn:

- `components/ui`: `Button`, `IconButton`, `TextInput`, `Surface`, `Badge`, `EmptyState`; bestaande `DropdownSelect` en `CountryPicker` zijn behouden.
- `components/patterns`: `PageHeader`, `SectionHeader`, `PageToolbar`, `FilterBar`, `InfoList`.
- `components/layout`: `PageShell`, `DetailColumns`.

De componentarchitectuur blijft daarmee `ui` voor primitives, `patterns` voor composities en `layout` voor shell-/layoutcontracten. Blok 3, inclusief Employees-list en Employee Detail-migratie, is niet uitgevoerd.

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

## 9. Buiten scope

- Blok 3 of app-brede schermmigratie;
- Control-app, sidebar, navigatie of shell-redesign;
- app-brede schermmigratie;
- database, migrations, API-contracten, permissions of RLS;
- businesslogica, nieuwe workflows of npm UI-libraries;
- shadcn, MUI, Chakra, Ant, Radix of een ander nieuw UI-framework;
- release, deployment, version bump, merge naar `main` of remote databasewijzigingen.
