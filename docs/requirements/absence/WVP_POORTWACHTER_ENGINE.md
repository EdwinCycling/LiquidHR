# Wet verbetering poortwachter

Status: **LEIDEND — WVP01 lokaal geïmplementeerd; Core TEST-basismigratie toegepast, auditcorrectie en native acceptatie OPEN, 2026-10-26**
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

- HR Admin start vanaf een bevestigde actieve casus. Herhaalde of gelijktijdige start hergebruikt hetzelfde traject. Eerste inrichting gebruikt bestaande schrijf-/publicatierechten; geen nieuwe rollen of grants. De HR-permissionqueue gebruikt `process-definition:publish`, zodat andere teammanagers geen algemene kandidaten worden. De geclaimde PMUX-taak bepaalt de behandelaar.
- Managers zien uitsluitend eigen teams en mogen operationele werkafspraken vastleggen. HR-mijlpaalafronding is afzonderlijk afgeschermd. Werknemers zien alleen de eigen gegevens en kunnen een specifieke eigen afspraak voor kennisname bevestigen; dit is geen medische toestemming. Opvolging en open kennisnames verschijnen ook in `/work`.
- Servercontext én RPC controleren tenant, HR-groep, administratie, employee-/teamscope. Nieuwe tabellen hebben RLS en alleen SELECT voor clients. Mutaties gebruiken begrensde private functies met bestaande auth-helpers en invokerfacades, zonder service-roleclient.
- Volledig en gedeeltelijk herstel, uren/percentage en ziekteperioden blijven uitsluitend in de bestaande `absence_spells`/`absence_capacity_changes`. De nieuwe dossierweergave leest deze bron en linkt naar de bestaande mutatieflow. Werkafspraken zijn vaste operationele keuzes met gebeurtenis- en evaluatiedatum, waaronder geleidelijke opbouw.
- Heropening binnen de vierwekenketen hergebruikt casus en proces. Na normalisatie door de bestaande verzuimflow naar `CLOSED` kan HR afronden als alle tot de laatste hersteldatum verschuldigde taken zijn afgehandeld. Toekomstige taken vervallen; historie blijft staan. Een nieuwe casus buiten de keten krijgt een eigen traject. Geen automatische backfill bij migratie.

## 9. Verificatie

De lokale PostgreSQL-contractharness voert de volledige WVP-basismigratie uit, inclusief echte nieuwe tabel-RLS. Volgens Core TEST acceptance 03 is `20261026055349` eenmaal toegepast; security/advisor-readback en gegenereerde type-readback zijn daar gecontroleerd. De latere auditcorrectie `20261026172808` bleef volgens acceptance 06 geblokkeerd door `INVALID_REQUEST_STATE`. Deze bewijsstukken zijn gedateerd 26-10-2026; de remote toestand is in deze consolidatie niet opnieuw gelezen. De begrensde tests zijn geen volledige native-kernel- of live-personaacceptatie. Native rolketen, daadwerkelijke reminder/escalatie en volledige dossierresponsivecontrole blijven OPEN. Zie [lokale acceptatie en TEST-writevoorstel](../../quality/acceptance/runs/WVP01-20261026-LOCAL.md), [Core TEST-acceptatie 03](../../quality/acceptance/runs/WVP01-CORE-TEST-ACCEPTANCE-03-20261026.md), [audit-fix 06](../../quality/acceptance/runs/WVP01-AUDIT-FIX-AND-PROCESS-START-06-20261026.md) en [architectuurbesluit](../../architecture/ADR-WVP01-ABSENCE-PROCESS-BRIDGE.md).

## 10. WVP05 — bestaande documenten aan WVP-mijlpalen koppelen

De WVP-casuswerkplek kan bestaande, voor de actor toegankelijke `employee_documents` koppelen aan de bestaande casus en een bestaande WVP-systemmijlpaal. WVP05 hergebruikt `wvp_list`, de medewerkerdocumentenservice, bestaande document-readpermissies, PMUX/WVP-taken, casus-/administratie-/teamautorisatie en `audit_logs`. Er komt geen tweede bestandsopslag en er worden geen bytes, documentinhoud, beschrijvingen, vrije tekst of medische metadata in de WVP-koppeling opgeslagen.

`wvp_document_links` bevat alleen referentie-ID's, actor/tijdstempels en een gecontroleerde verwijdermarkering. Een serverguard controleert dezelfde tenant, HR-groep, administratie, medewerker, casus en geldige bestaande WVP-mijlpaal. Mutaties lopen via begrensde RPC-functies; directe client-DML is niet verleend. RLS laat alleen leesbare koppelingen zien wanneer zowel WVP-case- als documentrechten slagen. Toevoegen is idempotent; verwijderen ontkoppelt alleen en verwijdert het document niet. Gesloten casussen zijn niet wijzigbaar. Employee mag alleen eigen toegestane koppelingen lezen; Manager/HR muteren uitsluitend binnen bestaande WVP- en documentrechten.

Een ontbrekende koppeling is geen bewijs dat een document ontbreekt. Er wordt geen wettelijke RIV-compleetheid berekend en geen document aangemaakt. De migratie `20261106180416_wvp05_milestone_document_links` is in de WVP05-codekandidaat opgenomen en niet op Supabase TEST toegepast. Vitest-/PGlite-, type-, lint-, i18n- en personaacceptatie worden per kandidaat vastgelegd in [WVP05 acceptatie](../../quality/acceptance/runs/WVP05-MILESTONE-DOCUMENT-LINKS-20261106.md); migration-advisor/readback en live HR Admin/Manager/Employee-scopeacceptatie blijven afzonderlijke releasegates.
