# Liquid HR — instructies voor AI-agents

Motto: **It takes a genius to keep it simple.**

## Uitvoeringsvoorkeur van de gebruiker

- Voer implementatieplannen inline uit in de actieve chat.
- Gebruik geen subagents of parallelle agentdelegatie, tenzij de gebruiker dat expliciet vraagt.
- Optimaliseer voor lage kosten en zorgvuldigheid; voer geen onnodige brede analyse, planning of verificatie uit.

## Leesrouting

1. Lees vóór iedere wijziging deze `AGENTS.md` volledig.
2. Lees bij de start van een nieuwe taak of chat [`docs/README.md`](docs/README.md) en [`docs/delivery/CURRENT_CONTEXT.md`](docs/delivery/CURRENT_CONTEXT.md).
3. Gebruik [`CODING_STANDARDS.md`](CODING_STANDARDS.md) als compacte dagelijkse codechecklist.
4. Lees vóór implementatie alleen de requirements en architectuurdocumenten die `docs/README.md` voor het gewijzigde domein aanwijst.
5. Lees alle vijf architectuurdocumenten alleen bij cross-cutting wijzigingen aan auth, security, tenancy, datatoegang, projectstructuur, UI-fundering of Liquid Display.
6. Onderzoek bij een kleine, afgebakende wijziging eerst de direct relevante bestanden; lees niet de hele repository zonder concrete aanleiding.

## Bronnen en voorrang

Bij tegenstrijdigheden geldt deze volgorde:

1. Expliciete actuele opdracht van de gebruiker.
2. Goedgekeurde ADR/FDR in `docs/decisions/`.
3. Leidend document in `docs/README.md`.
4. Overige conceptdocumenten.
5. Bestaande implementatie.

Een verschil tussen leidende documentatie en code wordt niet stil opgelost. Werk `docs/delivery/IMPLEMENTATION_STATUS.md` bij en corrigeer code of documentatie in dezelfde wijziging.

## Niet-onderhandelbare technische regels

- Bouw altijd in de volgorde `schema → API route → UI`.
- Gebruik strict TypeScript en nooit `any`.
- Gebruik Next.js Server Components, Server Actions en URL-state; geen React Query of SWR.
- Iedere tabel in een blootgesteld schema krijgt RLS en passende policies in dezelfde migratie.
- Autorisatie wordt server-side én met RLS afgedwongen; UI-verberging is alleen UX.
- Database-entiteiten en identifiers zijn Engels; comments, documentatie en UI-tekst zijn Nederlands en i18n-klaar.
- Gebruik Tailwind v4 en CSS-variabelen; geen hardcoded hexwaarden in componenten.
- Gebruik canonieke permissions: `resource:action` of `self:resource:action`.
- Draai na iedere schemawijziging Supabase advisors en genereer `packages/db/types.ts` opnieuw.
- Ontwikkel kritieke autorisatie- en salarislogica test-first.
- Alle zichtbare tekst en foutmeldingen komen uit een taalbestand. Nederlands (`nl`) is standaard en Nederlands/Engels hebben steeds dezelfde sleutels.
- Een nieuwe taal wordt als volledige namespace-set onder `apps/hr-suite/messages/<taalcode>/` toegevoegd; componenten bevatten geen eigen vertaalobjecten.

## Efficiënte verificatie

- Kies de kleinste relevante verificatie voor de gewijzigde bestanden en het gedrag.
- Voor styling, copy, layout of een geïsoleerde UI-wijziging: gerichte linting, typecheck of visuele controle.
- Voor logica: de dichtstbijzijnde unit-, component- of integratietest.
- Draai `check:i18n` wanneer zichtbare tekst of taalmodules wijzigen.
- Start of controleer de app op poort `3000` wanneer het aangepaste gedrag browsercontrole nodig heeft.
- Draai de volledige testsuite, productiebuild, lokale browsercontrole en publieke preview alleen wanneer:
  - de gebruiker dat vraagt;
  - een release, merge of pull request wordt voorbereid;
  - gedeelde infrastructuur, configuratie, authenticatie, routing, database-schema/RLS/grants of kritieke businesslogica wijzigt; of
  - een gerichte controle een bredere regressiekans aanwijst.
- Maak tests wanneer zij betekenisvolle bescherming bieden; niet mechanisch voor een triviale wijziging.
- Herhaal geen onveranderde falende opdracht; herstel alleen in-scope fouten en rapporteer bestaande, niet-gerelateerde failures afzonderlijk.

## Vaste beheerscherm-UX

- Kiesbare waarden gebruiken altijd een toegankelijke keuzecomponent met zoekfunctie en zichtbare selectie; voer ISO-codes, referenties of andere gesloten waardelijsten niet als vrij tekstveld in.
- Beheerbare stamdata volgt altijd **lijst eerst**: zoeken/filteren/sorteren, klikrij, en een modal voor toevoegen of wijzigen met bewaren en annuleren. Deactiveren/archiveren blijft een expliciete actie in die modal.

## LiquidHR UX Foundation

- `apps/hr-suite` gebruikt UX Foundation v1 als canonieke UI-basis. Lees bij UI-, layout- of redesignwerk ook [`docs/requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md`](docs/requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md).
- Centrale componentarchitectuur: `apps/hr-suite/components/ui` bevat generieke primitives, `components/patterns` herbruikbare composities/patronen en `components/layout` generieke paginalayoutcontracten. Domeinmappen zoals `components/employees` en `components/journeys` bevatten uitsluitend domeinspecifieke componenten en logica.
- Bestaat er een Foundation-component, hergebruik die. Bouw geen lokale alternatieven voor button, input, badge, card/surface, empty state, page header, section header, toolbar/filterbar, page shell of detail columns.
- Nieuwe generieke primitives horen in `components/ui`, nieuwe herbruikbare composities in `components/patterns` en nieuwe generieke layouts in `components/layout`; plaats ze niet stil in een featurefolder.
- Styling gebruikt Tailwind v4, Foundation CSS-variabelen/tokens, Lucide voor standaard UI-iconen, Foundation-maatvoering en toegankelijke `focus-visible`-states. Gebruik geen component-hardcoded hexwaarden, willekeurige radius/shadow/gradient of gewone hover-lift/translate.
- Surfaces zijn standaard vlak met een semantische 1px-border en Foundation-radius, zonder standaard shadow. Overlay-elevation is alleen voor echte layering. Vermijd nested card-on-card; voeg een extra Surface alleen toe bij functionele of hiërarchische betekenis.
- Een visueel redesign wijzigt standaard niet de route, API, database, RLS, permission, businesslogica of data-eigenaarschap.
- Componenten zijn theme-agnostic. Themes worden primair via semantic CSS variables/tokens opgelost; gewone componenten bevatten geen `if (theme === ...)` tenzij dit noodzakelijk en gedocumenteerd is. Een nieuw theme verandert bestaande themes niet.
- LinkedHR is een officieel LiquidHR-theme, gebruikt dezelfde Foundation en is geen aparte componentfamilie.
- `/employees` is de reference list/workbench en `/employees/[employeeId]` de reference profile/detail. Employee Detail gebruikt als reference ongeveer 2/3 hoofdinhoud en 1/3 aside via `DetailColumns`; nieuwe redesigns gebruiken deze structuur waar passend zonder domeinlogica te kopiëren.

### Foundation gaps en parallelle product-runs

- Bestaat een generieke Foundation-component, dan is hergebruik verplicht.
- Ontbreekt een generieke component met hergebruikbehoefte, bouw dan geen lokale kopie. Meld `FOUNDATION_GAP` met naam, concrete use cases, tekortkoming, minimale API/behavior, verwachte hergebruiklocaties en het voorstel **NU** of **LATER**.
- Is de behoefte aantoonbaar domeinspecifiek, dan hoort de component in de betreffende domeinmap.
- Parallelle product-runs mogen `components/ui` en generieke `components/patterns` niet zelfstandig uitbreiden tenzij hun opdracht dat expliciet toestaat. Meld de gap, voer de onafhankelijke scope verder uit en laat de centrale Foundation-/integratortask het gedeelde component oplossen.

## Remote database governance

- Een migration/schemawijziging als code maken mag wanneer die binnen de expliciete feature-scope valt. Een migration op een remote Supabase-project toepassen is een externe mutatie en gebeurt uitsluitend na expliciete toestemming van de gebruiker; hetzelfde geldt voor destructive-, reset- en seed-achtige remote acties. Expliciete toestemming in de actuele opdracht hoeft niet opnieuw te worden gevraagd.

## Documentatie bijhouden

- Nieuwe requirements worden als Markdown onder `docs/requirements/<domein>/` opgeslagen.
- Architectuurbesluiten komen als ADR in `docs/decisions/`; functionele besluiten als FDR.
- Werk na een afgeronde verticale slice de status in `docs/README.md` en `docs/delivery/IMPLEMENTATION_STATUS.md` bij.
- Werk na iedere materiële wijziging `docs/delivery/CURRENT_CONTEXT.md` bij. Houd dit document compact, actueel en vrij van secrets.
- Markeer vervangen documenten expliciet; verwijder historische besluiten niet stil.

## Nieuwe en geforkte chats

- Behandel repositorydocumentatie als het blijvende geheugen; vertrouw niet op oude chatgeschiedenis.
- Start een nieuwe chat vanuit de repositoryroot. De gebruiker hoeft alleen te zeggen: `Lees AGENTS.md en ga verder vanaf CURRENT_CONTEXT.md`.
- Verifieer bij hervatten alleen de actuele filesystem-, proces-, database- en deploymentstatus die voor de taak relevant is; neem tijdelijke URL's of draaiende processen nooit blind over.
- Noteer vóór het afsluiten van een omvangrijke taak in `CURRENT_CONTEXT.md`: wat is afgerond, wat is nog open, welke verificatie is uitgevoerd en welke handmatige acties overblijven.

## Codex Developer Toolkit en EdwinHelp

De repository bevat vaste natuurlijke commando's. Gebruik `EdwinHelp` voor het actuele overzicht; voer bij andere commando's het bijbehorende script of de aangewezen skill uit vanuit de repositoryroot. Gebruik geen alternatieve Git-workflow zonder dat expliciet met Edwin af te stemmen.

| Natuurlijk commando | Script en gedrag |
| --- | --- |
| **EdwinHelp** | `.\scripts\edwin-help.ps1`: read-only overzicht van alle afgesproken commando's, bronnen, risico's en voorbeelden. Ondersteunt `-Detailed` en `-Command`. |
| **Maak Git backup** | `.\scripts\backup.ps1`: legt alle huidige wijzigingen lokaal vast, maakt of verplaatst de tag `last-good` en de branch `backup/last-good`, en pusht niets. |
| **Zet Git backup terug** | `.\scripts\restore.ps1`: vraagt eerst om exact `HERSTEL`, weigert standaard een dirty werkboom en laat ongetrackte bestanden standaard staan. `-Force` en eventueel `-Clean` zijn alleen voor expliciet bevestigde noodsituaties. |
| **Nieuwe feature: `<naam>`** | `.\scripts\new-feature.ps1 -Name '<naam>'`: vereist een schone werkboom, normaliseert de naam en maakt lokaal `feature/<slug>` vanaf `last-good`. |
| **Feature afgerond** | `.\scripts\finish-feature.ps1`: draait de hr-suite-tests, commit alleen bij succes, werkt `last-good` bij en toont een mergevoorstel. Merge en push blijven altijd handmatig. |
| **Redesign LiquidHR scherm** | Gebruik [`docs/skills/edwinhelp-screen-redesign/SKILL.md`](docs/skills/edwinhelp-screen-redesign/SKILL.md); werk per scherm de UX-requirements, statuslijst en delivery-context bij. |
| **Maak project overview** | Gebruik [`docs/skills/project-overview/SKILL.md`](docs/skills/project-overview/SKILL.md): actuele code-, route-, database- en mandageninventaris; live records alleen als Supabase-MCP beschikbaar is. |
| **Meet Next geheugen** | `.\scripts\measure-next-memory.ps1`: periodieke geheugenmeting van een draaiende Next-server naar het opgegeven CSV-bestand. |

 Gebruik voor de volledige uitleg en voorbeelden [`docs/DEVELOPER_TOOLKIT.md`](docs/DEVELOPER_TOOLKIT.md). Deze toolkit commit, pusht of merge't niet automatisch buiten de expliciete lokale actie van het gekozen commando.

### Feature worktree workflow in Codex-chat

Werk tijdens een feature uitsluitend in de aparte worktree; wijzig de hoofdworkspace of `main` niet rechtstreeks. Stop bij een dirty worktree, mislukte merge, ontbrekende featurecommits in `main`, mislukte tests of mislukte deployment. Verwijder dan geen worktree of branch.

Normale lokale featurewerkzaamheden mogen zonder micro-confirmaties; bestaande testdata, testfixtures en testomgeving mogen voor verificatie worden gebruikt. Als de gebruiker voor de actuele feature expliciet featurebranch-push heeft toegestaan, mag Codex naar exact die featurebranch pushen. Nooit zelfstandig naar `main` pushen of mergen. Production deploy, release en version bump blijven expliciete acties. Stop alleen voor een echte blocker, destructive action, production/security/secrets-risico of scope-uitbreiding.

Gebruik nooit `git reset --hard`, `git clean -fd`, force-push of geforceerde branchverwijdering zonder expliciete toestemming. `Feature samenvoegen` is de expliciete toestemming voor de beschreven merge/push-workflow.
