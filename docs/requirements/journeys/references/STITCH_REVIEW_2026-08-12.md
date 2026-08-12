# Stitch-review LiquidHR Journeys

Status: **REFERENTIE — geen uitvoerbare frontendbron**  
Datum: **2026-08-12**

## Herkomst en volledigheid

Geanalyseerde ZIP: `stitch_spec_based_screen_development (1).zip`  
SHA-256: `2CF14B383C8E39E51F33ED9DF0E37C88C7C8393C99B5258736B53600160833FC`

De ZIP is voor analyse uitgepakt naar een tijdelijke lokale referentielocatie buiten de repository. Er zijn 14 paren `screen.png` + `code.html`, één designerbrief en één `DESIGN.md` gevonden. De designerbrief in de ZIP is bytegelijk aan `soli.md` (SHA-256 `4D80B4ACD50F124B92DA1D7D17A96CCC970419E2C205552668DC2CCC536A8370`). De ZIP bevat geen afzonderlijk scherm voor JY-014 en JY-015.

| Map/scherm | Resolutie | Ontwerp-ID | Beoordeling |
|---|---:|---|---|
| `hr_journeys_live_overzicht` | 1600×1280 | JY-001 | visuele intentie bruikbaar; shell en losse KPI-data aanpassen |
| `journey_detail_hr_sophie_de_vries` | 1600×1360 | JY-002 | tijdlijn/team bruikbaar; contractdetails verwijderen |
| `journey_starten_wizard` | 1600×1280 | JY-003 | rustige wizard bruikbaar; bestaande wizardstandaard gebruiken |
| `journey_team_samenstellen` | 1600×1280 | JY-004 | kernpatroon bruikbaar; bronnen uit LiquidHR, geen generiek HRIS-label |
| `activatiepreview_journey` | 1600×1280 | JY-005 | review-intentie bruikbaar; preview blijft write-free |
| `instellingen_journey_templates` | 1600×1280 | JY-006 | content bruikbaar; kaarten vervangen door lijst-eerst beheer |
| `template_designer_standaard_onboarding` | 1600×1280 | JY-007 | designer + propertiesdrawer bruikbaar; blocking toggle afwijzen |
| `template_designer_moment_toevoegen` | 1600×1280 | JY-008 | drawer bruikbaar; alle afgesproken topictypen en audiences vereist |
| `template_designer_rollen_configureren` | 1600×1360 | JY-009 | rolregel versus concrete persoon sterk; Workday/shared inbox afwijzen |
| `welkom_sophie_preboarding_home_mobile` | 681×1600 | JY-010 | menselijke context bruikbaar; eigen mobiele shell/chat afwijzen |
| `mijn_journey_tijdlijn_mobile` | 520×1600 | JY-011 | verticale tijdlijn bruikbaar; permissie- en contractcopy corrigeren |
| `dashboard_manager_journey_widget` | 1280×485 | JY-012 | widgetinhoud bruikbaar in bestaande startpagina |
| `manager_view_journey_sophie` | 1600×1280 | JY-013 | gefilterde tijdlijn bruikbaar; NL/EN-i18n en dataminimalisatie nodig |
| `uitzonderingsstates_lege_schermen` | 1600×1280 | JY-016 | lege/pause states bruikbaar; optionele buddy nooit als fout behandelen |
| geen afzonderlijk bestand | — | JY-014 | afleiden uit bestaand medewerkerdashboardwidgetcontract |
| geen afzonderlijk bestand | — | JY-015 | afleiden uit bestaande reminders/Tijdhub en deep-linkpatroon |

## Overneembare visuele principes

- de tijdlijn als primair visueel object;
- avatars, naam en rol samen wanneer menselijke betrokkenheid centraal staat;
- rustige witte surfaces op een lichte workspace, subtiele borders en weinig elevation;
- compacte HR-overzichten en rustiger self-/preboardingschermen;
- semantische statuskleuren: blauw huidig, groen afgerond, oranje aandacht, rood probleem;
- properties in een side panel en rijke configuratie op een volledige pagina;
- verticale timeline op mobiel;
- echte interaction states voor geselecteerd, completed, overdue, paused en ontbrekende verplichte participant.

De algemene token-/componentvertaling staat in [`../../../architecture/DESIGN_SYSTEM_EVOLUTION.md`](../../../architecture/DESIGN_SYSTEM_EVOLUTION.md).

## Niet overnemen

### Applicatieshell

De schermen tekenen een eigen vaste sidebar, topbar, zoekveld, accountbediening en soms mobiele bottom-navigation. LiquidHR heeft hiervoor al servergevoede sidebarprops, contextswitching, accountfooter, menuvolgorde en responsive gedrag. De Stitch-shell wordt niet nagebouwd.

### Technische frontendkeuzes

De HTML gebruikt gegenereerde Tailwindconfiguratie, Material Symbols en eigen kleur-/fontdefinities. LiquidHR gebruikt Tailwind v4, CSS-vars, persoonlijke thema's en Lucide. De HTML wordt niet gekopieerd; alleen compositie en interactie-intentie worden vertaald naar bestaande componenten.

### Data en autorisatie

- `Contract Details`, FTE en contractinhoud horen niet in Journey-detail.
- `Workday`, een generiek HRIS en `HR Support Team (Shared Inbox)` zijn geen bestaande LiquidHR-bronnen.
- chat-, message- en contactacties zijn geen V1-module en mogen geen bredere directorytoegang suggereren.
- participantweergaven mogen verborgen HR-topics niet downloaden en client-side verbergen; de serverprojectie selecteert ze niet.
- `Persoonsgegevens aanvullen` verschijnt alleen als de actor de exacte onderliggende selfpermission bezit.

### Productlogica

- Een “blocking moment” dat de Journey automatisch pauzeert maakt het model workflowachtig en valt buiten V1.
- Een kalenderdatum mag content beschikbaar maken; completion van een voorafgaand topic ontgrendelt geen downstream state-machinepad.
- Een optionele buddy is een informatieve ontbrekende keuze. Alleen een als verplicht gepubliceerde rol blokkeert activatie.
- KPI's, percentages en aandachtstatus worden alleen getoond wanneer zij uit echte, gedefinieerde projecties worden berekend.

## Screen-to-componentvertaling

| Stitchpatroon | LiquidHR-vertaling |
|---|---|
| eigen sidebar/topbar | bestaande `(dashboard)`-layout en `Sidebar` |
| Material icon | semantisch passend `lucide-react`-icoon |
| template cards | zoekbare/sorteerbare klikrij + editpagina/drawer |
| properties panel | algemene toegankelijke Drawer |
| avatar/name/role | algemene `PersonIdentity` op geautoriseerde DTO |
| timeline rail | nieuwe Journey timeline-componentfamilie op actorprojectie |
| topbar bell | bestaande reminder/Tijdhubpresentatie |
| mobile bottom tabs | bestaande responsive LiquidHR-navigatie |
| hardcoded status colors | algemene status tokens + badge/icoon/tekst |

## Conclusie

De ZIP is bruikbaar als consistente end-to-end visuele referentie, maar niet volledig en niet architectuurconform. De Journeys-requirements behouden de sterke tijdlijn-, participant-, preview- en drawerintentie, terwijl shell, data-access, autorisatie, moduleactivatie, i18n en algemene componenten uit LiquidHR leidend blijven.
