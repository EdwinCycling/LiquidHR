# LiquidHR design-systemevolutie

Status: **CONCEPT — gecontroleerde adoptie, geen app-brede restyling**  
Datum: **2026-08-12**  
Eerste beoogde gebruiker: **LiquidHR Journeys**

> **Leidende suitebrede richting vanaf 2026-08-20:** de algemene UX- en stylingrichting wordt overgenomen door [`requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md`](../requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md). Waar dit historische concept met die Foundation v1 conflicteert, is Foundation v1 leidend. De oorspronkelijke Inter-verwijzing hieronder blijft als historische ontwerpcontext bewaard; Work Sans is de actuele primaire HR Suite-font.

## Doel en grens

Dit document beoordeelt welke principes uit Stitch `DESIGN.md` verantwoord tot algemene LiquidHR-tokens of componenten kunnen worden verheven. Het is geen opdracht om bestaande schermen in één keer te restylen.

Journeys mag de hieronder voorgestelde algemene contracten als eerste gebruiken wanneer:

- zij in `apps/hr-suite/app/globals.css` of `components/ui/` algemeen en themabewust worden gedefinieerd;
- bestaande componenten niet stil van maat, font, kleur of gedrag veranderen;
- NL/EN, dark theme, bedrijfsbranding, focus, contrast en 390px afzonderlijk zijn gecontroleerd;
- adoptie buiten Journeys later per scherm via de bestaande redesignwerkwijze gebeurt.

De bestaande LiquidHR-shell blijft leidend: sidebar, contextswitching, accountfooter, topbar, Lucide-iconen, Tailwind v4, CSS-vars, Server Components en persoonlijke thema's worden niet vervangen door de Stitch-shell, Material Symbols of een tweede Tailwindconfiguratie.

## Huidige basis

De app heeft al semantische tokens voor `background`, `surface`, `muted`, `primary`, `accent`, `border`, `focus`, `success`, `warning`, `destructive`, sidebar en charts. Ook bestaan een radius-schaal, algemene form-/buttonklassen, responsive pagina-rasters, employee-avatarcomponenten en enkele domeinspecifieke drawers/modals.

De huidige implementatie wijkt op enkele punten af van het gewenste rustige basisritme:

- de globale fontstack is `Segoe UI Variable`/`Aptos`, niet Inter;
- pagina's gebruiken meerdere losse combinaties van `max-w-*`, horizontale padding en verticale spacing;
- kaarten variëren van compact `rounded-lg` tot `rounded-[1.5rem]`/`rounded-3xl` met uiteenlopende schaduwen;
- statuskleuren bestaan semantisch, maar `info/current` is nog geen zelfstandig helder contract;
- drawers zijn nog geen volledig gedeelde, toegankelijke componentfamilie.

## Maximaal 10 voorgestelde aanpassingen

Er worden **acht** algemene aanpassingen voorgesteld.

| Nr. | Token/component | Voorgesteld contract | Veilige adoptie |
|---:|---|---|---|
| 1 | Typografie | Eén `--font-sans` met Inter als primaire suitefont; `--text-heading-lg` 24/32/700, `--text-heading-md` 20/28/600, `--text-heading-sm` 16/24/600 en `--text-body` 14/20/400. Cijferweergaven gebruiken `tabular-nums`. | Eerst als opt-in `type-*` utilities/componentvarianten. Fontbestanden lokaal/pinned via `next/font`; geen externe runtimefontcall. Pas globaal na visuele regressiecontrole van kernroutes. |
| 2 | Surface-model | Semantische `--workspace`, `--surface`, `--surface-subtle`, `--border-subtle` en `--surface-overlay`. Licht thema: workspace ongeveer `#F9FAFB`, witte kaarten, grens ongeveer `#E5E7EB`; andere thema's behouden eigen toegankelijke waarden. | Geen losse hex in componenten. Journeys gebruikt de nieuwe aliassen; bestaande thematokens worden eerst compatibel gemapt zodat dark/branding niet breekt. |
| 3 | Statuscontract | `status-current/info` = blauw, `status-success/completed` = groen, `status-warning/attention` = oranje, `status-danger/problem` = rood, elk met foreground/surface/border. Eén algemene `StatusBadge`/`StatusMarker` met icoon en tekst. | Kleur is nooit het enige signaal. Domeinen mogen labels kiezen, geen nieuwe decoratieve statuspaletten. Bestaande `success/warning/destructive` worden hergebruikt; `current/info` wordt expliciet gemaakt. |
| 4 | Page shell en spacing | `PageShell` met responsive horizontale padding 16px mobiel, circa 24px tablet en 32px desktop; `--content-gutter: 24px`; verticale stackstappen 8px en 16px, met 24/32px alleen voor secties. | Journeys gebruikt dit vanaf de eerste pagina. Bestaande routes adopteren alleen bij een gerichte schermwijziging, zodat layoutverschuivingen niet app-breed tegelijk optreden. |
| 5 | Compacte card | `Card`-variant `compact`: 16px padding, circa 8px radius, 1px subtiele border en geen of vrijwel onzichtbare schaduw. Overlay/elevated blijft een aparte variant voor modal/drawer. | Geen globale wijziging van bestaande `rounded-2xl`-kaarten. Journeys HR-lijsten en tijdlijntopics gebruiken compact; marketingachtige en zware schaduwen worden vermeden. |
| 6 | PersonIdentity | Algemene compositie voor avatar + naam + rol/context, met 32px lijstavatar en 56–64px profielavatar, initialen/silhouetfallback en optionele veilige statusindicator. | Hergebruikt bestaande employee-avatarlogica en naamformattering. De component ontvangt uitsluitend al geautoriseerde projectiedata en doet geen eigen Employee-fetch. |
| 7 | Drawer/side panel | Eén toegankelijke `Drawer`-familie voor properties en korte configuratie: rechts op desktop, passend full-height paneel op mobiel, focus trap, Escape, click-outsidebeleid, focus return, scrolllock, titel/omschrijving en vaste actiefooter. | Journeys gebruikt drawers voor moment-/roleigenschappen. Lange of rijke configuratie blijft een pagina; destructieve bevestiging en complexe wizards worden geen drawer. |
| 8 | Content width | `PageShell`-varianten `reading`, `standard` en `wide`; `wide` maximaal circa 1440px voor tabellen, `standard` smaller voor formulieren en tekst. Geen onbegrensde regels op ultrawide schermen. | De tabel zelf mag horizontaal scrollen binnen de begrensde pagina. Journeys-overzicht gebruikt `wide`, designer en detail kiezen een expliciete variant. |

## Algemene componentregels

- Een nieuwe algemene component heeft een kleine interface en verbergt focus-, responsive-, theme- en a11ycomplexiteit in de implementatie.
- Een algemene component leest geen domeindata en neemt geen permissionbesluit; callers leveren een geautoriseerde projectie.
- Uitbreiden van een bestaand component heeft voorkeur boven een bijna-identieke Journey-fork.
- Modals blijven voor korte geïsoleerde bevestigingen. Drawers zijn voor properties/quick edit; volledige pagina's voor rijke designer- en wizardflows.
- Animaties zijn kort, subtiel en respecteren `prefers-reduced-motion`.
- Status, selectie en voortgang blijven begrijpelijk zonder kleur.

## Niet overnemen uit Stitch

- geen eigen 260px sidebar, topbar, accountmenu, zoekbalk of mobiele bottom-navigation;
- geen Material Symbols, icon font of tweede iconbibliotheek;
- geen eigen Tailwindconfig of hardcoded kleurpalet in Journey-componenten;
- geen app-brede omzetting van alle cards, headings, paddings of shadows tijdens Journeys;
- geen thema-afhankelijke waarden vervangen door één vaste lichte palette;
- geen drawer wanneer de actie een lange wizard, review-before-save of uitgebreide beheerpagina vereist.

## Adoptievolgorde

1. Leg per voorgesteld contract de bestaande visuele baseline en a11y-eisen vast.
2. Implementeer uitsluitend de algemene token/componenten die Journeys daadwerkelijk nodig heeft, met regressietests voor thema's en bestaande callers.
3. Gebruik ze in Journeys en controleer desktop, 390px, keyboard, focus, contrast en reduced motion.
4. Registreer andere schermen later afzonderlijk in `docs/requirements/ux/SCHERM_REDESIGN_STATUS.md`; geen bulkvervanging.

Dit document geeft dus richting, geen implementatiegoedkeuring. De daadwerkelijke algemene tokenwijzigingen horen bij de expliciet goedgekeurde Journeys-stap of een afzonderlijke app-brede UX-opdracht.
