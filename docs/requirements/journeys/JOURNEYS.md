# LiquidHR Journeys

Status: **LEIDEND VOOR ANALYSE EN IMPLEMENTATIE**  
Implementatie: **BOUWSTAP 3 VOLLEDIG AFGEROND**
Datum: **2026-08-12**

## Bronnen en voorrang

Dit document verwerkt de volgende aangeleverde bronnen:

1. `LIQUIDHR_JOURNEYS_PRODUCT_DESIGN.docx` / tekstextract `soli_req.md`;
2. de definitieve schermen uit `stitch_spec_based_screen_development (1).zip`;
3. `LIQUIDHR_JOURNEYS_AI_DESIGNER_BRIEF.docx` / tekstextract `soli.md`;
4. Stitch `DESIGN.md` en de bijbehorende `code.html`-bestanden;
5. de aanvullende opdracht **LiquidHR Journeys — analyse en implementatievoorbereiding**.

Bij strijdigheid geldt: veiligheid en bestaande LiquidHR-architectuur → productontwerp → definitief Stitch-scherm → designerbrief → Stitch `DESIGN.md` → Stitch HTML. De Stitch HTML is uitsluitend visuele en interactionele referentie en wordt niet als applicatiearchitectuur overgenomen. De volledige bronreview staat in [`references/STITCH_REVIEW_2026-08-12.md`](references/STITCH_REVIEW_2026-08-12.md).

### UX-interpretatie van Stitch

Stitch-schermen zijn richtinggevend, niet letterlijk bindend. Zij bepalen de gewenste visuele richting, informatiehiërarchie, interactie-intentie, componentcompositie, density, tone of voice en responsive intent. Een scherm wordt alleen letterlijk overgenomen wanneer dit logisch past binnen de bestaande LiquidHR-shell, reusable components, permissions/security, beschikbare data, routing, accessibility, i18n en onderhoudbare technische structuur.

Daarom blijven de bestaande LiquidHR-shell, navigatie, design tokens, Lucide-iconen, forms, tables, cards, drawers, URL-state en layoutvoorkeuren leidend. Een functioneel gelijkwaardig LiquidHR-component wordt hergebruikt met behoud van de Stitch-intentie; er worden geen parallelle shells, tokens of kunstmatige 1-op-1 patronen toegevoegd. Het resultaat moet herkenbaar zijn als Stitch-design én natuurlijk aanvoelen als LiquidHR.

De afzonderlijke aangeleverde `screen.png`/`code.html`-assets konden in de actuele repository- en attachmentmount niet opnieuw worden gevonden. De schermrichting is daarom lokaal getoetst aan de aanwezige Stitch-review in `references/STITCH_REVIEW_2026-08-12.md`; exacte asset-hercontrole blijft open wanneer de bronbestanden opnieuw beschikbaar zijn.

## Productdoel en harde grenzen

Journeys is een zelfstandige, optionele LiquidHR-module voor tijdgebonden begeleiding rond één persoon. De eerste toepassing is preboarding en onboarding; hetzelfde model moet later bruikbaar zijn voor reboarding, interne overstap, promotie, terugkeer, offboarding en organisatie-eigen trajecten.

Een Journey is:

- een tijdlijn met fases, momenten, topics, rollen, concrete deelnemers en voortgang;
- mensgericht en relatief gepland rond een ankerdatum;
- historisch stabiel na activatie;
- toegankelijk via expliciete Journey-permissions, audiences en RLS.

Een Journey is nadrukkelijk niet:

- een Workflow-, BPMN-, approval- of state-machine-implementatie;
- een sollicitatie- of kandidatenmodule;
- een contract-, salaris-, BSN-, verzuim-, medisch of HR-dossiermodel;
- een chatplatform, LMS of AI-copilot;
- een kopie van Employee-, Employment-, organisatie-, reminder- of documentdata.

Een Journey-moment mag later via een expliciete integratie een workflow starten. Die integratie verandert Journeys niet in de Process Automation-engine en valt buiten V1.

## A. Hoe Journeys in LiquidHR past

1. **Zelfstandig diep domein.** `lib/journeys/` wordt één diepe module met een kleine interface voor templatepublicatie, activatiepreview, activatie, participantwissel, completion en geautoriseerde projecties. Routes en UI bevatten geen gekopieerde domeinregels.
2. **HR-groep als eigenaar.** Templates, versies, Journey-instances en deelnemers zijn `tenant_id + hr_group_id`-gebonden. Zij worden niet per administratie gedupliceerd. Een optionele `employment_id` is context bij de persoon en nooit de eigenaar van de Journey.
3. **Blijvende Employee-identiteit.** De target is altijd een bestaande `employees.id` binnen dezelfde HR-groep. Preboarder, actieve medewerker en herintreder krijgen geen tweede persoonsrecord. Een herintreding gebruikt de bestaande Employee en een nieuw Employment volgens ADR-0003.
4. **Expliciete employment-context.** Een Journey kan employee-only zijn of een concreet toekomstig/actief Employment als context hebben. Een startdatumanker dat uit Employment komt vereist een eenduidig gekozen `employment_id`; bij meerdere geldige Employments kiest HR expliciet.
5. **Immutable publicatie.** Een gepubliceerd template wordt niet in-place gewijzigd. Een nieuwe publicatie maakt een nieuwe immutable versie; een Journey pint exact de geactiveerde versie en bewaart gegenereerde planning en deelnemers als historie.
6. **Template bepaalt regels, activatie concrete personen.** Rolregels leveren voorstellen. HR bevestigt of vervangt ze vóór activatie. De geactiveerde participant bewaart concrete `employee_id`, bron, resolutiebewijs en vervangingshistorie.
7. **Bestaande managerresolver als adapter.** Automatische manager-/afdelingsrolresolutie gebruikt de actuele `employee_organizations`, `department_management` en `resolveManagerForEmployee`-patronen. Ambiguïteit wordt zichtbaar en typed afgehandeld; nooit stil de eerste kandidaat kiezen.
8. **Eigen autorisatiecontract.** Journey-rechten staan los van Core HR. Buddy of participant zijn verleent geen `employee:read`. De Journey-shell vereist HR-recht, target/self-scope of concrete actieve/assigned runtime-participatie; topic- en outcome-data blijven daarnaast topic-audience-gebonden. Niet-zichtbare content bereikt browser of RSC-payload niet.
9. **Preboarding als beperkte access-state.** Dezelfde Employee en accountkoppeling worden gebruikt. Toegang ontstaat alleen via een actieve/planned Journey, expliciete selfpermissions en een geldige groepscontext. Journeys verleent nooit impliciet adres-, bank-, contract-, salaris- of dossierwrite.
10. **Operationeel versus configuratie.** HR werkt op `/journeys`; configuratie staat uitsluitend onder `/settings/journeys`. De bestaande LiquidHR-sidebar, settingshub, contextswitching en accountfooter blijven intact.
11. **Persoonlijke ingang via de bestaande startpagina.** Medewerker, preboarder, manager en buddy zien alleen hun geprojecteerde Journey-widget op `/dashboard/start` en openen dezelfde detailroute met een actor-specifieke projectie. Er komt geen aparte mobiele shell.
12. **Medewerkerdashboard blijft één dashboard.** `/employees/[employeeId]` krijgt later een Journey-widget via het bestaande getypeerde widget-/layoutcontract. Er ontstaat geen parallel medewerkerdashboard of Journey-profielpagina.
13. **Reminders en documenten blijven bronmodules.** Journeys maakt gerichte records via de bestaande reminderinterface en verwijst naar bestaande geautoriseerde documenten. Het kopieert geen reminder-, notificatie-, opslag- of documentmodel en kan documentrechten niet verbreden.
14. **Servergedreven projecties.** Server Components laden een kleine actor-specifieke projectie; filters/sortering staan in URL-state; mutaties lopen via Zod-gevalideerde interne BFF-routes en één transactionele schrijfweg. Geen React Query/SWR of generieke JSON-engine.
15. **Design-evolutie gecontroleerd.** Journeys mag de voorgestelde algemene tokens en componenten uit [`../../architecture/DESIGN_SYSTEM_EVOLUTION.md`](../../architecture/DESIGN_SYSTEM_EVOLUTION.md) als eerste gebruiken, maar voert geen app-brede restyling uit en behoudt alle bestaande LiquidHR-shellcomponenten.

## Architectuurcontract: interface en seams

De externe interface van de Journeys-module blijft klein. Functienamen zijn richtinggevend; het uiteindelijke TypeScript-contract wordt in stap 1 test-first vastgelegd.

| Interface-operatie | Gedrag achter de interface |
|---|---|
| `publishJourneyTemplate(draftId, expectedVersion)` | valideert template, rollen, fases, topics en audiences; publiceert atomair een immutable versie; audit |
| `previewJourneyActivation(input)` | valideert target/context, genereert datums en resolveert participantvoorstellen zonder writes |
| `activateJourney(input, idempotencyKey)` | herhaalt alle serverchecks, pint versie, materialiseert tijdlijn/deelnemers, maakt audit en reminder-opdrachten atomair |
| `replaceJourneyParticipant(input, expectedVersion)` | bewaart historie, herschrijft uitsluitend toekomstige assignments/audiences volgens expliciete regels en audit |
| `recordJourneyTopicOutcome(input, expectedVersion)` | completion/skip/check-in door bevoegde actor; idempotent en audience-bound |
| `getJourneyProjection(journeyId, actor)` | retourneert HR-, self- of participantprojectie; verborgen velden worden niet geselecteerd |
| `listJourneyProjection(query, actor)` | begrensde operationele of persoonlijke lijst met URL-filters en stabiele paginering |

Seams naar bestaande modules:

- **Employee/Employment-adapter:** valideert blijvende persoon, gekozen Employment, startdatum en HR-groep;
- **Organization-adapter:** resolveert manager/rolkandidaten en levert expliciete ambiguity/missing-resultaten;
- **Reminder-adapter:** maakt concrete ontvangerreminders en deep links naar Journey-momenten; een reminder is nooit autorisatiebron;
- **Document-adapter:** controleert documentpermission én documentaudience naast Journey-audience;
- **Dashboard-adapters:** leveren alleen getypeerde Journey-projecties aan startpagina en medewerkerdashboard;
- **Audit-adapter:** schrijft canonieke, gesaneerde events zonder topicinhoud of gevoelige persoonsgegevens in generieke auditpayloads.

Er worden geen hypothetische providerports toegevoegd. Een seam wordt pas als aparte port gemodelleerd wanneer productie- en testadapter dit daadwerkelijk rechtvaardigen.

## Ownership en minimale gegevensclassificatie

| Gegeven | Scope/eigendom | Classificatie en regel |
|---|---|---|
| Template en templateversie | HR-groep | interne HR-configuratie; alleen templatepermissions |
| Journey-instance | HR-groep + target Employee | vertrouwelijke HR-operationele metadata; optioneel één context-Employment |
| Participant en rol | Journey + concrete Employee | minimale naam/rolprojectie; geen algemeen Employee-readrecht |
| Topicinhoud | templateversie / instance | audience-bound; geen contract-, salaris-, BSN-, medische of dossierinhoud |
| Completion/check-in | Journey-topic + actor | alleen noodzakelijke status/antwoorddata; per type getypeerd, geen generieke vrije JSON-container |
| Documentreferentie | bestaande documentbron | dubbele controle: Journey-audience én bronpermission/audience |
| Reminder | bestaande reminderbron | concrete ontvanger; deep link, status en datum; geen Journey-contentkopie |
| Audit | bestaande auditbron | publicatie, activatie, pause/resume, participantwissel en outcome; gesaneerd |

## Conceptueel datamodel

Exacte kolommen, foreign keys en indexen worden in stap 1 schema-eerst uitgewerkt. Het minimale genormaliseerde model is:

| Entiteit | Verantwoordelijkheid en kerninvarianten |
|---|---|
| `journey_templates` | stabiele HR-groepidentiteit, naam/type, lifecycle; geen runtimepersoon |
| `journey_template_versions` | immutable gepubliceerde inhoud, oplopende versie, ankerregel, publicatiegegevens |
| `journey_template_phases` | geordende fases binnen exact één versie |
| `journey_template_roles` | rolcode, verplicht/optioneel, cardinaliteit en getypeerde resolverregel |
| `journey_template_moments` | relatief moment, fase, volgorde en availability-offset; geen workflowdependency |
| `journey_template_topics` | getypeerd topic, eigenaarrol, verplicht/optioneel en inhoudelijke velden |
| `journey_template_topic_audiences` | many-to-many rol-audience; expliciet, geen vrije JSON-lijst |
| `journeys` | target Employee, gepinde versie, ankerdatum, optionele context-Employment, status en optimistic version |
| `journey_participants` | concrete Employee per Journey-rol, bron, resolutiebewijs, status, vervanging en historie |
| `journey_moments` | gematerialiseerde datum/availability voor de geactiveerde Journey; historische templateweergave blijft stabiel |
| `journey_topics` | gematerialiseerde topicmetadata en statusgrondslag; referenties naar bestaande content/documenten |
| `journey_topic_assignments` | concrete eigenaar/deelnemer en visibility per topic; meerdere deelnemers toegestaan |
| `journey_topic_outcomes` | append-only completion/skip/check-in met actor/tijdstip en typed payload per ondersteund type |

De bestaande `audit_logs`, `reminders`, documenttabellen, `employees`, `employments`, `employee_organizations` en organisatiecatalogi blijven de bron. Zij worden niet als Journey-tabellen gedupliceerd.

### Lifecycle en afleiding

- Template: `DRAFT`, `PUBLISHED`, `RETIRED`.
- Journey: `PLANNED`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`.
- Participant: `ASSIGNED`, `ACTIVE`, `REPLACED`, `REMOVED`.
- Topicpresentatie: `UPCOMING`, `AVAILABLE`, `COMPLETED`, `SKIPPED`, `OVERDUE`.

`UPCOMING`, `AVAILABLE` en `OVERDUE` worden waar mogelijk uit datum, verplichting en outcome afgeleid. V1 kent geen upstream/downstream-dependencies. Een onvoltooid topic pauzeert de Journey niet automatisch. `PAUSED` is uitsluitend een expliciete HR-lifecycleactie; reminders worden dan op gecontroleerde wijze opgeschort of herpland.

## Autorisatie en permissions

Voorgestelde canonieke permissions, definitief te seeden via migratie:

| Permission | Doel |
|---|---|
| `journey-template:read` | templates en versies raadplegen |
| `journey-template:write` | drafts en configuratie beheren |
| `journey-template:publish` | immutable versie publiceren/retiren |
| `journey:read` | operationele HR-projectie binnen geldige groeps-/organisatiescope |
| `journey:write` | starten, pause/resume/cancel en team wijzigen |
| `self:journey:read` | eigen target-Journey en eigen audience lezen |
| `self:journey:write` | eigen toegestane topicoutcomes vastleggen |
| `journey-participation:read` | Journeys lezen waarin actor concreet participant is, beperkt tot audience |
| `journey-participation:write` | eigen toegewezen acties/outcomes uitvoeren, beperkt tot topicassignment |

RLS toetst altijd `tenant_id`, `hr_group_id`, actieve account-/Employee-koppeling en de exacte Journey-scope. De shell-check accepteert HR-recht, target/self-scope of concrete actieve/assigned runtime-participatie; topic-lezen en outcomes vereisen aanvullend een zichtbare assignment en passende status/datum. `journey:read` zonder geldige scope is onvoldoende. Een participantprojectie bevat alleen minimale subjectcontext die het Journey-contract toestaat; voor aanvullende Employee-velden blijft de afzonderlijke bronpermission vereist.

## Preboarding access-state

V1 gebruikt de bestaande uitnodiging/accountkoppeling en dezelfde Employee. Stap 1 moet eerst bewijzen of de bestaande user-access- en systeemrolstructuur de volgende toestand kan uitdrukken zonder nieuwe tabel:

- account gekoppeld aan Employee en actieve HR-groep;
- `self:journey:read` en eventueel `self:journey:write`;
- alleen afzonderlijk toegekende selfpermissions voor onderliggende gegevens;
- toegang begrensd door Journey-status, participant/targetrelatie en relevante datums;
- reguliere sidebaritems en routes blijven permissiongestuurd verborgen én server-side geweigerd.

Alleen wanneer deze toestand niet veilig uit bestaande account-/rolgegevens plus Journey-deelname kan worden afgeleid, wordt een minimale effective-dated `PREBOARDING`-accessgrant toegevoegd. Er komt geen tweede persoon, tweede authmodel of brede preboarderrol met impliciete HR-rechten.

## Applicatiekaart

| Onderdeel | Route | Toegang | Bestaand hergebruik | Nieuwe module/projectie |
|---|---|---|---|---|
| HR live overzicht | `/journeys` | `journey:read`, actieve module en scope | dashboardlayout, URL-state, lijst-/filterpatronen | `listJourneyProjection` |
| Journey starten | `/journeys/new` | `journey:write` | wizard UX-standaard, Employee-selector, Employment-context | preview + activate interface |
| Journey detail | `/journeys/[journeyId]` | HR, self of participant volgens projectie | profiel/avatar, date formatting, cards | actor-specifieke timeline/projectie |
| Templates | `/settings/journeys` | `journey-template:read` | settingshub, lijst-eerst beheer | templatecatalogus |
| Template Designer | `/settings/journeys/templates/[templateId]` | template read/write/publish | page header, formulieren, drawer | versie-/fase-/rol-/topicdesigner |
| Persoonlijke widget | `/dashboard/start` | self/participantprojectie | bestaande startpagina-/layoutvoorkeuren | Journey-widgetloader |
| Medewerkerwidget | `/employees/[employeeId]` | per viewer `journey:read`, self of participant + targetscope | bestaande employee-dashboardlayout | smalle Journey-projector/widget |
| Reminderactie | `/reminders` en deep link naar `/journeys/[journeyId]#moment-…` | concrete recipient | reminder/Tijdhub | Journey-reminderadapter |

Alleen HR-operationele gebruikers krijgen een hoofdmenu-item **Journeys**. Medewerkers, buddies en overige participants gebruiken de startpagina en deep links; deelname alleen voegt geen HR-hoofdmenu toe. Instellingen toont **Journeys** uitsluitend met templatepermission. De modulecode `JOURNEYS` wordt in stap 1 via het bestaande modulecatalogus- en serverguardpatroon toegevoegd.

## B. Verschillen of conflicten en aanbevolen keuze

| Punt | Conflict | Aanbevolen LiquidHR-keuze |
|---|---|---|
| Stitch-shell | eigen 260px sidebar, eigen topbar, zoekveld, account en mobiel bottom-nav | bestaande sidebar/topbar/context/accountfooter behouden; alleen inhoudscompositie adopteren |
| Iconen en styling | Material Symbols, eigen Tailwindconfig en veel losse hexwaarden | uitsluitend Lucide en bestaande CSS-vars/Tailwind v4; nieuwe tokens eerst algemeen definiëren |
| Contractdetails | HR-detail toont `Contract Details`, FTE en contracttaal | verwijderen; alleen geautoriseerde minimale functie/afdeling/startcontext, nooit contractinhoud |
| Workday/HRIS/shared inbox | rolconfiguratie verwijst naar niet-bestaande externe bronnen | huidige LiquidHR manager-/organisatiegegevens en concrete Employees gebruiken |
| Blocking moment | Stitch laat een moment de Journey pauzeren tot voltooiing | niet in V1; datumgestuurde beschikbaarheid en aandachtstatus, geen workflowdependency |
| Chat/messages | mobiel ontwerp introduceert chatknop, Messages-tab en contacticonen | geen chatplatform; contact alleen via bestaande geautoriseerde werkcontactactie wanneer beschikbaar |
| Notificatiebel | designerbrief veronderstelt topbar-notificaties | V1 gebruikt bestaande reminders/Tijdhub met deep link; geen nieuwe generieke notificatie-infra |
| Templatekaarten | Stitch-instellingen toont losse marketingachtige kaarten | vaste beheer-UX is lijst-eerst met zoeken/filteren/sorteren, klikrij en gerichte editflow |
| Drag-and-drop | alleen visuele sleepinteractie in designer | toegankelijk alternatief met verplaatsknoppen/keyboard; slepen is optionele versnelling |
| Persoonsgegevens aanvullen | ontwerp noemt generieke actie en zelfs “contract” in begeleidende tekst | alleen tonen per exacte bestaande selfpermission en route; Journey verleent geen datamutatie |
| Optionele buddy | uitzonderingsscherm presenteert buddy soms als harde fout | optioneel blijft niet-blokkerend; alleen een als verplicht geconfigureerde rol blokkeert activatie |
| 16 versus 14 schermen | ZIP mist aparte JY-014 en JY-015 | beide ontwerpen vanuit bestaande employee-dashboard- en remindercomponenten afleiden, geen Stitch-shell verzinnen |

## C. Definitieve schermkaart

| Design | Route | Gebruiker | Bestaand/nieuw | Belangrijkste data/interface |
|---|---|---|---|---|
| JY-001 Live overzicht | `/journeys` | HR | bestaande lijst-/filter-/KPI-atomen + nieuwe Journey-lijst | operationele lijstprojectie; alleen echte KPI-bronnen |
| JY-002 HR-detail | `/journeys/[id]` | HR | bestaande profielheader + nieuwe tijdlijn/teamdrawer | HR-projectie, audit, outcomes; geen contractdetails |
| JY-003 Starten | `/journeys/new` | HR | bestaande wizardfamilie + nieuwe 4-stapsflow | Employee/Employment-selector, activation preview/command |
| JY-004 Team | `/journeys/new` stap 3 | HR | bestaande zoekbare keuzes + nieuwe rolregels | Organization-adapter, concrete participantvoorstellen |
| JY-005 Preview | `/journeys/new` stap 4 | HR | review-before-save | write-free preview; daarna idempotente activatie |
| JY-006 Templates | `/settings/journeys` | HR-configuratie | bestaande lijst-eerst beheer-UX | templatecatalogus en immutable versies |
| JY-007 Designer | `/settings/journeys/templates/[id]` | HR-configuratie | volledige pagina + algemene drawer | draft/version, fases, momenten, rollen |
| JY-008 Topic toevoegen | dezelfde route, drawer | HR-configuratie | algemene drawer + keuzekaarten | getypeerd topic en audience |
| JY-009 Rollen | dezelfde route, tab/sectie | HR-configuratie | zoekbare choices + rolregels | manager/afdeling/specifieke medewerker/handmatig |
| JY-010 Preboarding home | `/dashboard/start` | preboarder | bestaande responsive startpagina | selfprojectie, countdown, eigen momenten/team |
| JY-011 Mijn Journey | `/journeys/[id]` | preboarder/medewerker | nieuwe verticale tijdlijn in bestaande shell | selfprojectie, eigen outcomes en toegestane links |
| JY-012 Betrokken widget | `/dashboard/start` | manager/buddy/participant | bestaande startpaginawidget | participantprojectie en eigen volgende acties |
| JY-013 Participantdetail | `/journeys/[id]` | manager/buddy | dezelfde detailroute, gefilterde projectie | alleen audience + eigen assignments; geen HR-only data |
| JY-014 Medewerkerwidget | `/employees/[employeeId]` | bevoegd HR/manager/self | bestaand dashboardwidgetcontract + nieuwe widget | actieve Journey, fase, volgende moment, beperkte mensencontext |
| JY-015 Reminderactie | `/reminders` → Journey deep link | concrete ontvanger | bestaande reminder/Tijdhub | recipient reminder + momentanker |
| JY-016 Leeg/uitzondering | diverse | HR | algemene empty/warning states | geen templates/instances, required missing, paused, replaced |

## Teststrategie en acceptatie

Minimaal bewijs vóór afronding van de module:

- unit-tests op relatieve datumberekening, templatevalidatie, statusafleiding en participantresolutie inclusief missing/ambiguous;
- interfacetests op preview zonder writes, idempotente activatie, pinned versie, participantvervanging en outcomes;
- SQL/RLS-matrix voor HR Admin, medewerker, preboarder, directe manager, buddy/participant, onbevoegde gebruiker, andere HR-groep en andere tenant;
- bewijs dat buddy/participant zonder `employee:read` uitsluitend minimale Journey-context ziet;
- bewijs dat HR-only en niet-geaudienceerde topics niet in response/RSC-payload voorkomen;
- documenttests met zowel Journey-audience als bronpermission/documentaudience;
- remindertests voor concrete ontvanger, deduplicatie, pause/resume en deep link;
- regressies op Employee-hergebruik, herintreding, meerdere Employments en managerambiguïteit;
- i18n-pariteit NL/EN, keyboard/focus, screenreaderlabels, kleur-niet-alleen en 390px zonder overflow;
- authenticated browsermatrix voor alle zes rollen met echte synthetische fixture en cleanup;
- routeperformance volgens ADR-0004 en volledige schema/advisor/typegate bij iedere schemastap.

## D. Bouwplan — maximaal 3 stappen

### Stap 1 — Fundament + HR-configuratie

Lever één bruikbare verticale slice voor HR-configuratie: definitief schema/ownership, permissions/RLS/grants/audit, de diepe Journey-module-interface, moduleactivatie, templatecatalogus, Template Designer, rollen/fases/momenten/topics en immutable publicatie. Bouw test-first voor autorisatie, versionering, datumlogica en resolverambiguïteit. Verifieer migratiecontract, Supabase advisors, gegenereerde types, gerichte tests, strict TypeScript, lint, i18n en een authenticated HR-configuratieflow.

### Stap 2 — Activeren + HR live

Lever target-/Employmentselectie, write-free activatiepreview, concrete participantresolutie en bevestiging, idempotente activatie, operationeel lijst-eerst overzicht, HR-detail, expliciete pause/resume/cancel, participantvervanging, audit en de bestaande reminderadapter. Test template→instance-materialisatie, pinned historie, dubbel activeren, missing/ambiguous rollen, HR-groepisolatie en reminderontvangers. Verifieer de volledige HR-flow in browser zonder contract-/salaris-/dossierdata.

### Stap 3 — Medewerker + preboarding + participants

Lever de beperkte preboarding access-state, startpaginawidgets, self-/participantdetail, eigen topicoutcomes, medewerkerdashboardwidget en responsive/mobile hardening. Sluit af met de volledige zes-rollen RLS-/browsermatrix, negatieve payloadcontroles, Employee/Employment-/herintredingsregressies, i18n/a11y/performance en de relevante releasegate. Journeys gebruikt eventuele nieuwe algemene designtokens als eerste, maar wijzigt buiten deze module alleen de vooraf goedgekeurde generieke token/componentimplementatie. De slice bevat actor-filtered projection-RPC-contracten, outcomes, startpagina-/medewerkerwidgets, participantdetail, reminderdeep-link en de beperkte Journey-only preboarding-startpagina. De participant/manager-scope is zonder globale `DIRECT_MANAGER`-grant gesloten: concrete actieve/assigned runtime-participatie opent de Journey-shell, terwijl topics/outcomes assignment-gebonden blijven. De employeeprojectie gebruikt dezelfde actor-veilige RPC voor target- en participantweergave; remote schema, FK-indexes, advisors en typegeneratie zijn uitgevoerd.

## Uitvoeringsstatus

Bouwstap 1 en 2 zijn na expliciete goedkeuring afgerond op `feature/journeys`, de enige featurebranch voor alle drie bouwstappen. Bouwstap 3 is in dezelfde worktree volledig afgerond met additive projection/outcome-migraties, actor-veilige RPC’s, NL/EN-widgets op de bestaande startpagina en medewerkerdashboard, participantdetail, reminderdeep-link en een beperkte Journey-only preboarding-startpagina. Remote schema/FK-indexes zijn toegepast, officiële typen zijn gegenereerd, remote pgTAP/RLS is groen en de advisors zijn opnieuw gecontroleerd. De oorzaak van de DIRECT_MANAGER-blocker was een te strenge Journey-shellkoppeling aan zichtbare topicassignments; die is vervangen door de bestaande Journey-specifieke runtime-participantcheck. Er is geen globale `DIRECT_MANAGER`-grant toegevoegd. Manager-, buddy/participant- en preboarding-browserflows zijn desktop en 390x844 met network-/consolecontrole doorlopen. Alle 16 Journey-tabellen uit stap 1–3 hebben remote RLS; de eerdere telling van 7 betrof uitsluitend de configuratiesubset. Push, merge en deployment blijven verboden.
