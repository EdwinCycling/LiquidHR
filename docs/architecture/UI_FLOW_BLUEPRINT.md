# UI_FLOW_BLUEPRINT.md — UI/UX-blauwdruk

> Doel: de layout, navigatie, auth-schermen, RBAC-in-UI, design-tokens en formulier-conventies exact reproduceren in een nieuwe app.

---

## 1. Layout Architectuur — Master Layout

Vast drieluik:

```
┌─────────────┬─────────────────────────────┐
│             │  Topbar (context-switchers,  │
│  Sidebar    │  account, notificaties)      │
│  (donker,   ├─────────────────────────────┤
│  vast)      │                               │
│             │  Content Area (scrollable)    │
│             │                               │
└─────────────┴─────────────────────────────┘
```

- **Sidebar** is een eigen `'use client'`-component (`components/layout/sidebar.tsx`), krijgt **alles via props** vanuit de server layout (scopes, entitlements, huidige tenant/administratie/business-unit, context-labels) — geen eigen data-fetching in de sidebar zelf. Inklapbaar (`PanelLeftClose`/`PanelLeftOpen` uit lucide-react), state lokaal.
- Sidebar heeft een **eigen, donker kleurenpalet** los van de rest van de app (`--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, etc. als losse CSS-vars) — bewust contrast met de lichte content-area.
- **Switchers bovenaan de sidebar**: tenant-switcher, business-unit-switcher, administratie-switcher, context-switcher — alleen zichtbaar als de gebruiker meer dan één optie heeft. Dit is het patroon voor elke vorm van "werk binnen scope X" wanneer een gebruiker toegang heeft tot meerdere scopes.
- **Content area**: server-rendered per pagina, binnen een `(dashboard)`-route-group die de layout deelt.

**Responsive:** desktop-eerst voor de hoofdsuite (accountant/power-user werkplek); een aparte companion-app (mobile-first PWA) bedient de dagelijkse kernacties op telefoon in plaats van de hoofdsuite te forceren te reflowen. Praktisch: als je één app bouwt die zowel volwaardig desktop-werk als snelle mobiele acties moet doen, overweeg vroeg of dat twee aparte experiences verdient in plaats van één zwaar responsive omgebouwde layout.

---

## 2. Navigatie & Menu

- **Menu-items zijn data, geen JSX-hardcoding**: gedefinieerd in `components/layout/sidebar/nav-data.ts` als arrays/objecten (`mainNavItems`, `crmSubItems`, `salesSubItems`, …), losse export per module-sectie. De sidebar-component itereert hierover.
- **Rolgebaseerd tonen, niet los coderen per pagina**: welke sub-items zichtbaar zijn hangt af van `scopes`/`entitlements` die de sidebar als prop krijgt (afgeleid server-side uit de rechten van de gebruiker in de huidige tenant/administratie). Geen aparte "modus" — hetzelfde menu-component, andere data erin.
- **Active state**: via `usePathname()` (client-side), vergeleken tegen elk item se `href`; het matchende item krijgt een actieve stijl (achtergrond/accent-tekstkleur uit de sidebar-tokens).
- **Icon library**: uitsluitend `lucide-react` — geen andere icon-set mengen.
- **Instellingen als aparte sectie**: `settings-nav.ts` + `isBeheerPath()`-helper om te bepalen of de sidebar in "instellingen-modus" moet renderen (andere item-set, zelfde component-familie).
- **Renderhelpers gescheiden van data**: `nav-sections.tsx` bevat `TopNavLink`, `NavSection`, `renderAdminGroup`, `InstellingenSection` — generieke bouwstenen die de data uit `nav-data.ts` consumeren. Dit scheidt "wat staat er in het menu" van "hoe rendert een menu-item".

---

## 3. Authenticatie Flow (UI)

- **Geen wachtwoord-schermen** — magic link is de enige inlogmethode. Het login-scherm vraagt alleen een e-mailadres, toont daarna een "check je mail"-bevestiging.
- **Foutafhandeling**: inline foutmelding onder het formulierveld voor validatiefouten (bv. ongeldig e-mailadres); voor server-/netwerkfouten een toast/banner-patroon, geen blocking modal voor iets herstelbaars.
- **Registratie** verloopt via uitnodiging (`pending_invitations`) + magic link, niet via een zelfstandig registratieformulier met wachtwoordkeuze.
- **Geen password-reset-scherm nodig** — die hele categorie fouten ("verkeerd wachtwoord") bestaat niet in dit model.
- **Dev-only bypass**: een env-var-gestuurde auth-bypass voor lokale ontwikkeling/preview (nooit in productie actief, expliciet gated op `NODE_ENV`/env-var-check) zodat je zonder e-mail-round-trip kan doorontwikkelen.

---

## 4. Role-Based Access Control (RBAC) in de UI

Twee lagen, altijd allebei toepassen — nooit UI-only:

1. **Component-niveau (zichtbaarheid)**: de sidebar en pagina-content krijgen `scopes`/`entitlements` als props (server-side berekend uit de rol van de gebruiker in de actieve tenant/administratie); menu-items en actie-knoppen renderen conditioneel op basis daarvan. Voorbeeld-patroon: `scopes.includes('admin.users')` bepaalt of een instellingen-item verschijnt.
2. **Route/API-niveau (afdwinging)**: elke server-actie/API-route roept zelf `requirePermission(...)` aan — de UI-verberging is UX, niet security. Een verborgen knop is geen vervanging voor een server-side check.

**Geen tenant-"modi"** — er is geen if/else op een tenant-type-vlag die een compleet andere UI-tak rendert. Eén component-boom, data-gedreven zichtbaarheid op basis van rechten. Dit voorkomt duplicatie van layout-logica tussen "rol A" en "rol B".

**Context-switching**: als een gebruiker in meerdere scopes werkt (bv. eigen organisatie + een klant-organisatie), toont een switcher-component in de sidebar de huidige context en een dropdown om te wisselen; de rest van de UI reageert op de gekozen context zonder dat elke pagina zelf scope-logica hoeft te bevatten.

---

## 5. Design Systeem & Styling

**Kleuren** (voorbeeld uit `globals.css`, pas aan naar eigen merk):
- Achtergrond: lichtgrijs-blauw (`#f3f4f8`)
- Primary/actieknop: donkere navy (`#14264a`)
- Accent (betekenisdragend, NIET decoratief): blauw (`#2757d6` op lichte achtergrond `#f2f5fc`)
- Sidebar: apart donker palet (`#0a1b3d` + transparante witte varianten voor tekst/hover)
- Statuskleuren via chart-tokens: `chart-1..5` (blauw/cyaan/groen/amber/rood) — hergebruikt voor grafieken én statuslabels, niet los uitgevonden per component.

**Regel: accent = betekenis.** Geen volledig getinte kaart of gekleurde rand "ter decoratie" — een kleur op een kaart/rand betekent altijd iets (status, actie-vereist, fout).

**Icon library**: `lucide-react`, consistent geïmporteerd per icoon (`import { X } from 'lucide-react'`), geen sprite-sheets of andere icon-fonts.

**Radius-schaal**: afgeleid van één basis-`--radius` via `calc()` — `sm`/`md`/`lg`/`xl`/`2xl`/`3xl`/`4xl` zijn allemaal vermenigvuldigingen van dezelfde basiswaarde, zodat je nooit los een radius-getal kiest maar een stap op de schaal.

**Schaduwen/spacing**: Tailwind-default-schaal, geen custom shadow-tokens nodig tenzij er een specifiek "verdiept paneel"-effect nodig is. Compacte tabellen (specifiek domein) gebruiken een lage rij-hoogte en border-loze cel-inputs in plaats van de standaard padding-schaal.

**Typografie**: `Inter`-achtig sans-serif als hoofdfont voor de suite; een systeem-font + `tabular-nums` voor cijfer-zware, dichte tabelweergaven (financieel/rapportage-achtige schermen) — bewust géén monospace-font daar, dat oogt "code-achtig" in plaats van "spreadsheet-achtig".

---

## 6. Formulier Logica

- **Traditionele forms + Zod-validatie** als basis, geen aparte form-library-laag bovenop React state tenzij het formulier écht complex is (multi-step wizard).
- **Multi-step wizards** voor complexe onboarding-achtige flows (bv. een agent/SOP-configuratie in 6 stappen) — eigen wizard-component-familie, state per stap, niet één groot formulier met conditionele secties.
- **Inline editing** in tabel-achtige schermen (bv. boekingsregels): border-loze inputs direct in de cel, autosave-indicator zichtbaar zodra het veld bewerkbaar is, geen expliciete "Opslaan"-knop nodig — de laatste stap in de tab-volgorde commit automatisch.
- **Modals** voor korte, geïsoleerde acties (bv. een item toevoegen aan een lijst) — niet voor lange formulieren met veel velden; die krijgen een eigen pagina of een side-panel.
- **Keyboard-first waar het werk repetitief is**: Tab = volgend veld, Enter = nieuwe regel, Esc = annuleren, Ctrl+S = opslaan/bevestigen. Dit patroon is bewust toegepast op schermen waar een power-user honderden keren per dag dezelfde invoer doet.

---

## 7. Specifieke Features

**Help-integratie**: geen aparte losstaande "help chat"-widget bovenop alles; support/vragen lopen via dezelfde inbox/kanaal-architectuur als de rest van de klantcommunicatie (één centrale inbox per module/kanaal), niet een geïsoleerd chat-widgetje met eigen dataflow.

**Notificaties**: een centrale `notifications`-module/tabel + een notificatie-icoon in de topbar/sidebar-footer die een lijst/badge toont; belangrijke gebeurtenissen (nieuwe vraag, deadline, actie vereist) genereren een notificatie-record in plaats van losse ad-hoc toasts door de hele app. Toasts blijven gereserveerd voor directe feedback op een actie die de gebruiker zelf net uitvoerde (opgeslagen, fout opgetreden).

**Account/context-footer**: onderaan de sidebar een vaste footer met de ingelogde gebruiker (naam/e-mail) en een uitlog-actie — altijd zichtbaar, los van de scrollende menu-inhoud erboven.

---

## 8. Bestandsstructuur UI-componenten (atoms vs. molecules)

```
components/
  ui/                     ← ATOMS: button, input, card, badge, stat-card, page-state,
                             segmented-filter, brand-logo — shadcn-gegenereerd + eigen toevoegingen.
                             Generiek, geen kennis van een specifiek domein.
  layout/                 ← Layout-MOLECULES: sidebar.tsx, sidebar/nav-data.ts (data),
                             sidebar/nav-sections.tsx (renderlogica), switchers, account-footer.
  <module>/                ← Domein-MOLECULES/ORGANISMS: complete formulieren, kaarten, tabellen
                             specifiek voor één functioneel domein (bv. crm/, support/, sales/).
                             Mag ui/-atomen importeren, nooit andersom.
```

**Regel:** een canoniek atoom (bv. `stat-card.tsx`, `page-state.tsx`, `segmented-filter.tsx`) wordt **exact hergebruikt**, nooit gekopieerd naar een net-iets-andere variant in een module-map. Als een module iets net anders nodig heeft, wordt het atoom uitgebreid met een prop — niet geforkt.
