# Wet verbetering poortwachter

Status: **LEIDEND — WVP01 geïmplementeerd; WVP02 casus-/taakwerkplek verbeterd in lokale code (2026-11-06). Core TEST-migraties, audittriggers, guidance en procesinstantie zijn op 2026-11-04 door de gebruiker bevestigd; native rol-/browseracceptatie blijft OPEN.**
Afhankelijkheid: `VERZUIM_EN_HERSTEL.md`.

## 1. Doel

De WvP-engine plant operationele taken rond een verzuimcasus, met de ziekteperioden als bron van waarheid en met een effectieve casusklok die herstelgaten niet als ziektedagen telt.

## 2. Wettelijke basis

Bronnen gecontroleerd op **2026-10-26**. De systeemset bevat probleemanalyse rond week 6, plan van aanpak rond week 8, zestien voortgangsevaluaties tot week 104, 42e-weeksmelding, eerstejaars- en eindevaluatie en WIA-opvolging. Bronnen: [UWV stappenplan](https://www.uwv.nl/en/employers/sickness/a-step-by-step-guide-to-employee-sickness), [UWV Plan van aanpak](https://www.uwv.nl/nl/ziek/loondoorbetaling/plan-van-aanpak), [UWV quick start](https://www.uwv.nl/imagesdxa/quick-start-werkwijzer-poortwachter_tcm94-458697.pdf) en [Arboportaal bedrijfsarts](https://www.arboportaal.nl/onderwerpen/ondersteuning-bij-arbowet/bedrijfsarts/rol-van-de-bedrijfsarts-bij-ziekte-en-re-integratie).

| Moment | Productregel en verantwoordelijkheid |
| --- | --- |
| Week 6 | De bedrijfsarts/arbodienst maakt de probleemanalyse. HR bevestigt uitsluitend ontvangst van toegestane terugkoppeling. |
| Plan | Werkgever en werknemer maken dit uiterlijk twee weken na de probleemanalyse, in de standaardsituatie uiterlijk week 8. Een vroege analyse vervroegt het plansignaal; een late bevestiging verschuift de oorspronkelijke grens niet. |
| Evaluaties | Minstens eens per zes weken voortgang bespreken. De systeemprojectie plant vanaf de plangrens; een werkafspraak heeft daarnaast een volgende evaluatie binnen 42 kalenderdagen. |
| Week 42 | Uiterlijk eerste werkdag na de 42e ziekteweek melden. WVP01 signaleert conservatief op de weekgrens: **geen berekening van de uiterste meldwerkdag**, geen UWV-verzending. |
| Week 52 | Eerstejaarsevaluatie samen met werknemer; voor nieuwe/open projecties 52 × 7 = 364 dagen, niet de oude kandidaat van 365 dagen. Afgeronde historie blijft staan. |
| Week 91/93 | Eindevaluatie en opvolging van de WIA-aanvraag. De aanvraag is van de werknemer; de specifieke UWV-brief blijft leidend. Het aanvraagsignaal is geen automatische aanvraag of juridische beoordeling. |

Deze regels zijn geen vrij instelbare werkdagen-SLA. Niet-geautomatiseerde uitzonderingen zoals geen benutbare mogelijkheden, verlenging en individueel vastgestelde UWV-termijnen vereisen beoordeling. Voor medische privacy zijn [AP verzuimsysteem](https://autoriteitpersoonsgegevens.nl/themas/werk-en-uitkering/zieke-werknemers/registratie-in-een-verzuimsysteem) en [AP regels werkgevers](https://autoriteitpersoonsgegevens.nl/themas/werk-en-uitkering/zieke-werknemers/regels-voor-werkgevers-bij-zieke-werknemers) leidend: ook vrijwillig vertelde diagnoses of oorzaken worden niet geregistreerd.

## 3. Klok

- De spells vormen de bron van waarheid.
- De engine berekent opgebouwde ziekteduur exclusief herstelgaten.
- `effective_clock_start_on` is een door de engine bewaakte projectie.
- Een te laat afgeronde taak verschuift de volgende wettelijke deadline niet.
- Een hervatting binnen de keten herberekent alleen toekomstige deadlines die door de klok veranderen.

De datumconventie blijft die van de bestaande verzuimfoundation: `effective_clock_start_on + week × 7` markeert de verstreken kalenderweekgrens. Er wordt met datums gerekend, niet met milliseconden of werkdagen. De PMUX-deadline is het einde van de geprojecteerde datum in de HR-groeptijdzone. De al geactiveerde PMUX-stap behoudt zijn immutable activatiesnapshot; na een herstelgat kan die conservatief eerder signaleren. Volgende activaties lezen de actuele domeindatum. De PMUX-06A.1-immutabilityguard blijft intact.

## 4. Taken

`absence_tasks` blijft de domeinbron voor mijlpalen. Process Automation is de orkestratie- en taaklaag; `absence_guidance` koppelt één bestaande casus aan precies één procesinstantie. De gepubliceerde definitie heeft 22 mijlpaalstappen in de standaardvolgorde, elk met eigen PMUX-werkitem, plus een afsluitstap. De bestaande reminderjobs, werkbak en escalatie naar de HR-queue worden hergebruikt. Geen tweede evaluator of procesengine.

Bij ontbreken van een casemanager of directe manager wordt niet willekeurig één HR-gebruiker gekozen. De taak blijft zichtbaar in een geautoriseerde werkvoorraad totdat een bevoegde gebruiker toewijst.

## 5. Evidence

Een WVP01-taak kan alleen transactioneel worden voltooid met expliciete ontvangst-/uitvoeringsbevestiging en gebeurtenisdatum. Medische adviezen en medische dossiers horen niet in het werkgeversdossier; deze release vraagt geen bewijsupload of medische documentcategorie.

WVP01 gebruikt een expliciete bevestiging en gebeurtenisdatum. Nieuwe invoer bestaat uitsluitend uit vaste keuzes, datums en referenties; geen vrije notities of documentuploads. De API weigert onbekende velden. Databaseguards blokkeren medische tekstvelden bij publicatie, generieke PMUX-werkitemnotities en legacy completion-notes voor WVP01. Mijlpaalevidence, domeinwijziging en PMUX-claim/act zijn één transactie; een kernelfout rolt alles terug. Gebeurtenissen zijn append-only en geaudit, voltooide taken immutable. Een legacy-voltooide taak kan expliciet worden herbevestigd voor de nieuwe procesvolgorde zonder de oude completiondatum te herschrijven.

## 6. Eigen bedrijfstaken

HR Admin kan administratiegebonden, niet-wettelijke taken toevoegen. Een systeemcode, bron, versie en wettelijke deadline zijn niet wijzigbaar door een tenant. Eigen taken worden gedeactiveerd, niet hard verwijderd wanneer historische cases ernaar verwijzen.

## 7. Buiten scope

De 13-wekenberekening voor oproepkrachten, UWV-/arbodienstkoppelingen, loonbetaling en automatische notificaties volgen pas na een aparte bronkwaliteits-, payroll- en privacybeslissing.

WVP01 sluit wel aan op de bestaande interne PMUX-reminder-/escalatievoorzieningen; externe aflevering wordt in deze run niet uitgevoerd. Custom taaktemplates blijven beschikbaar in de bestaande instellingen; hun aansluiting op de nieuwe PMUX-volgorde, RIV-documentreadiness en afwijkende individuele routes blijven roadmapwerk. Er is geen nieuwe documentcategorie of bewaartermijn ingevoerd.

## 8. Gebruikersreis, autorisatie en werkhervatting

`/work` → `/absence/guidance` → `/absence/guidance/[caseId]`. Het bestaande medewerkerverzuimdetail krijgt een directe dossierlink; het PMUX-werkdetail routeert naar de gekoppelde casus. Het overzicht toont maximaal 250 recente dossiers met een melding bij die grens.

- HR Admin start vanaf een bevestigde actieve casus. Herhaalde of gelijktijdige start hergebruikt hetzelfde traject. Eerste inrichting en processtart vereisen de bestaande schrijf-/publicatierechten; geen nieuwe rollen of grants. De PMUX-werkqueue en taakbevestiging gebruiken `process-task:act`; publicatierecht is geen voorwaarde voor gewone taakuitvoering. De bestaande resolver en PMUX-claim-/act-RPC blijven de actuele kandidaat, actor, tenant, HR-groep, administratie, team en casusscope afdwingen.
- Managers zien uitsluitend eigen teams en mogen operationele werkafspraken vastleggen. Een WVP-PMUX-taak kan alleen worden geclaimd of uitgevoerd door een actuele toegestane kandidaat met de gewone PMUX-taakrechten; er is geen publicatierecht nodig. Werknemers zien alleen de eigen gegevens en kunnen een specifieke eigen afspraak voor kennisname bevestigen; dit is geen medische toestemming. Opvolging en open kennisnames verschijnen ook in `/work`.
- Servercontext én RPC controleren tenant, HR-groep, administratie, employee-/teamscope. Nieuwe tabellen hebben RLS en alleen SELECT voor clients. Mutaties gebruiken begrensde private functies met bestaande auth-helpers en invokerfacades, zonder service-roleclient. `/work` toont voor geautoriseerde actieve casussen de actuele mijlpaal, deadline en urgentie; de medewerkerweergave beperkt zich tot eigen open kennisnames.
- Volledig en gedeeltelijk herstel, uren/percentage en ziekteperioden blijven uitsluitend in de bestaande `absence_spells`/`absence_capacity_changes`. De nieuwe dossierweergave leest deze bron en linkt naar de bestaande mutatieflow. Werkafspraken zijn vaste operationele keuzes met gebeurtenis- en evaluatiedatum, waaronder geleidelijke opbouw.
- Heropening binnen de vierwekenketen hergebruikt casus en proces. Na normalisatie door de bestaande verzuimflow naar `CLOSED` kan HR afronden als alle tot de laatste hersteldatum verschuldigde taken zijn afgehandeld. Toekomstige taken vervallen; historie blijft staan. Een nieuwe casus buiten de keten krijgt een eigen traject. Geen automatische backfill bij migratie.

## 9. WVP02 — PMUX-casuswerkplek en START-autorisatie (2026-11-06)

De casuswerkplek en `/work` hergebruiken de bestaande WVP-casusquery, PMUX-instantie, taken, audit-events en urgencyregels. De actuele open `currentMilestone` heeft voorrang bij de presentatie; als die ontbreekt of niet open is, toont de UI de vroegste resterende open taak. Taakuitvoering blijft gekoppeld aan `process-task:act`; alleen starten van een procesdefinitie vereist `process-definition:write` plus `process-definition:publish`, naast de bestaande `process-instance:start`-controle in de kernel. De directe `internal_security.wvp_command`-RPC en applicatieservice controleren beide definitierechten vóór een idempotente terugkeer of mutatie, binnen bestaande tenant-, HR-groep- en administratiescope. Dit wijzigt geen rechten, gepubliceerde definitie of procesinstantie.

## 10. WVP03 — operationele dossierstatusindex (2026-11-06)

De casuswerkplek toont per bestaande mijlpaal de taakstatus, deadline, modelrol uit `projectWvpMilestones` en een gebeurtenis gekoppeld via dezelfde `task_id`. Open taken en voltooide taken zonder gekoppelde mijlpaalgebeurtenis zijn herkenbare werk- of registratiepunten. Werkafspraken en evaluatiedatums blijven in de bestaande geautoriseerde gebeurtenistijdlijn. De casus en checklistgegevens komen via `wvp_list` met tenant-, HR-groep-, administratie-, team- en eigen-casusscope.

Deze index is **geen wettelijke RIV-compleetheidsbeoordeling**. Een ontbrekende gebeurtenis bewijst niet dat een wettelijk dossierstuk ontbreekt. De getoonde rol is de modelrol, geen bewijs van een toegewezen persoon. Medische documenten en medische details blijven buiten onbevoegde WVP-weergaven; er worden geen wettelijke documenten gegenereerd.

## 11. WVP04 — read-only documentkoppelingsstatus (2026-11-06)

WVP04 stelde vast dat de bestaande `employee_documents`- en WVP-projecties geen betrouwbare relatie tussen document, casus en mijlpaal boden. De tussentijdse read-only status “geen koppeling” betekende niet dat een document ontbrak. WVP05 vervangt deze tussenstap door expliciete, geautoriseerde relaties; er is geen tweede documentopslag.

## 12. WVP05 — bestaande documenten aan WVP-casus en mijlpaal koppelen (2026-11-06)

HR Admin en Managers met bestaande case-, team-, HR-groep-, administratie- en documentrechten kunnen vanuit een bestaande WVP-casus een bestaand toegankelijk medewerkerdocument aan een bestaande WVP-mijlpaaltaak koppelen en de relatie na bevestiging verwijderen. Employee ziet uitsluitend eigen toegestane koppelingen. De bronlink en bestaande medewerkerdocumentenservice blijven leidend; verwijderen ontkoppelt alleen en verwijdert het brondocument nooit.

De forward-only migratie maakt `wvp_document_links` met alleen referentie-ID's, actor/tijdstempels en een verwijdermarkering. Tenant, HR-groep, administratie, medewerker, casus, documenttoegang en geldige bestaande mijlpaal worden server-side gecontroleerd. RLS beschermt reads; mutaties gebruiken begrensde RPC's en audit. Client-DML is niet verleend. Toevoegen is idempotent. Er worden geen documentbytes, medische metadata, vrije tekst of automatisch gemaakte wettelijke stukken opgeslagen. Geen wettelijke RIV-compleetheid wordt afgeleid uit een ontbrekende koppeling.

Migratievolgorde: WVP02 SEC01 `20261106150000_wvp02_sec01_start_permission_guard.sql`, daarna WVP05 `20261106180416_wvp05_milestone_document_links.sql`. Beide staan als code; geen TEST-toepassing/readback is in deze integratie uitgevoerd.

## 13. Verificatie

WVP02–WVP05 contract- en UI-regressies staan in de gecombineerde codekandidaat. Statische autorisatiereview, i18n en diff-check zijn PASS; Vitest/PGlite, UI-tests, TypeScript, lint en browser/personaacceptatie zijn NOT RUN. Read-only Core TEST-migratiehistorie toont alleen de bestaande WVP01-basis en auditcorrectie; WVP02 SEC01 en WVP05 staan uitsluitend als forward-only code en zijn niet toegepast. De actuele Git-, security-, database- en acceptatiestatus staat in [WVP-INT01 acceptance](../../quality/acceptance/runs/WVP-INT01-CONSOLIDATION-20261106.md). Geen lokale codecontrole vervangt live rol-/RLS-/auditacceptatie of migratiereadback.
