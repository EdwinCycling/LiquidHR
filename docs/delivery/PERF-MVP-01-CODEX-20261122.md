# PERF-MVP-01 — Eén Codex-uitvoerrun voor LiquidHR Gesprekscycli

**Datum:** 2026-11-22  
**Status:** KLAAR ALS UITVOERINSTRUCTIE — nog niet uitgevoerd  
**Productspecificatie:** [Gesprekscycli MVP](../requirements/Talent/20-LiquidHR-Performance-Reviews-MVP.md)  
**Doel:** één volledig werkende, lokaal gebouwde en risicogestuurd geteste MVP, geen verzameling losse prototypes.

## EXECUTION HOTFIX — 22 november 2026: niet stoppen vóór het bouwen

**Aanleiding:** vorige Codex-run heeft de twee documenten hersteld, maar stopte na HARNESS_FRICTION / RUNTIME_START_OR_REUSE_FAILED met nul featurecode. Dit is een browser-/testharnessprobleem, geen valide reden om niet te implementeren.

**Deze wijziging gaat vóór de operationele preflightvolgorde hieronder. Harde security- en mandaatgrenzen uit AGENTS.md blijven leidend.**

1. **BOUW EERST.** Verifieer bron/documents en veilige schrijfplek, start geen browser-, TEST-runtime- of persona-preflight vóór featurecode. Een browserprobleem verhindert lokaal schrijven/testen van migration-SQL als code, RPC/services, React-UI, Vitest of PGlite.
2. **BESCHERM dirty main.** Verifieer git status/worktree list/branch/origin-main, geen reset/pull/clean/stash. Als main dirty en achterloopt, gebruik een bestaande veilige featurecheckout of maak precies één nieuwe geïsoleerde worktree+branch vanaf actuele origin/main. Maak een nog niet bestaande locatie zelf aan met git worktree add; veronderstel niet dat een tweede workspace al bestaat. Pas geen wijziging toe op dirty main, next-env.d.ts of protected .env.local, en kopieer de protected .env.local nergens heen. De twee design-docs zijn aanwezig op origin/main.
3. **CODE MILESTONE.** Voordat je een definitief rapport opstelt: (a) ten minste één nieuwe forward-only featuremigration als code onder apps/hr-suite/supabase/migrations/, (b) een feature-domainservice of veilige RPC-wrapper, en (c) gerichte unit-/securitycontracttests daadwerkelijk schrijven. Dit is alleen de eerste stap: bouw vervolgens alle MUST-functionaliteit in dezelfde run.
4. **PREFLIGHT IS GEEN BOUWBLOKKADE.** Pas na code en lokale tests doe je browser-/real-persona-test. Bij runtimefrictie markeer uitsluitend de daadwerkelijk getroffen E2E-criteria BLOCKED_BY_ENVIRONMENT. Niet gebouwd = NOT_IMPLEMENTED, niet getest = NOT_RUN; zet niet alle criteria op BLOCKED.
5. **REMOTE TEST IS APART.** Nieuwe remote Supabase schema-/datawrites zijn niet automatisch geautoriseerd. Schrijf de migratie lokaal, test met bestaande lokale infrastructuur en PGlite. Wanneer echte E2E remote schema nodig heeft: beperk de BLOCKED_BY_MANDATE-status tot de concrete onbewezen E2E-criteria, en rapporteer precieze scope voor aanvullende toestemming. Geen auth-/RLS-bypass.
6. **FIX EN GA DOOR.** Reproduceer bugs, herstel, hertest met maximaal twee gerichte herstelcycli per blocker. Ga onafhankelijk door met de rest van de MUST-scope. Een eindbericht met 0 featurecode/0 tests/0 commits is FAILED EXECUTION, geen MVP-oplevering.
7. **FINALE GATE NA CODE.** Echte personatests, geauthenticeerde UI, de relevante CONTROLLED-suite, TS/lint/i18n/build volgen na implementatie. Geen Vercel-release zonder letterlijk RELEASE LIQUIDHR TEST.

**Direct te sturen Codex-herstelopdracht:**

> HERSTART PERF-MVP-01. Documenten zijn beschikbaar. Vorige HARNESS_FRICTION geldt alleen voor browser-E2E. Bescherm dirty main, maak zo nodig één schone featureworktree vanaf actuele origin/main, bouw alle MUST onderdelen lokaal inclusief migration-RLS, PMUX, service, UI, documenten, private notes, Continuous Appraisal, dashboards, dossier; test wat lokaal kan en fix. Lever featurecode, tests, commits, bewijs. Geen remote databasewrites of Vercel-release zonder aparte toestemming. Geen preflight-stop vóór code.

## 0. Kopieer deze /doel naar Codex

**/doel PERF-MVP-01 — Bouw LiquidHR Gesprekscycli V1 volledig, van veilig datamodel/migrations en serverautorisatie tot PMUX-taken, documenten, interne notities, Continuous Appraisal-koppelingen, alle drie rolgerichte UI's, dashboards en medewerkerkaart. Gebruik de leidende productspecificatie docs/requirements/Talent/20-LiquidHR-Performance-Reviews-MVP.md en dit runbook. Werk autonoom in één bounded implementatiecyclus: begrijp → bouw alle MUST-functionaliteit → test met bestaande HR Admin/Manager/Employee-persona's → reproduceer en fix defecten → hertest → lever de complete CODE COMPLETE-kandidaat met evidence en commit. Geen subagents, geen nieuwe parallelle productarchitectuur, geen onbevoegde SQL-/TEST-data-/accountwrites of release. Als remote migratie/TEST-fixturetoestemming vereist is: bouw en test wat veilig kan, stop uitsluitend de geblokkeerde E2E-stap, rapporteer het exacte afzonderlijke mandaat; claim geen valse PASS. Geen Vercel-deployment zonder letterlijk RELEASE LIQUIDHR TEST.**

Voer het geheel uit, niet slechts inventarisatie/ontwerp. Alleen concrete harde blokkades stoppen verplichte stappen; reproduceerbare bugs zelf herstellen.

## 1. Startcontract / prioriteit

1. Lees AGENTS.md eerst; controleer actuele origin/main SHA, veilige lokale checkout en alleen relevante delen van docs/AA/AA-CURRENT.md, AA-README.md, AA-NEXT.md, AA-OPEN.md, AA-OP.md, AA-TEST.md, AA-REL.md, AA-REQ.md, AA-ACCEPT.md en PRODUCT_ENVIRONMENT_PARITY.md.
2. Lees de productspecificatie volledig: docs/requirements/Talent/20-LiquidHR-Performance-Reviews-MVP.md. Behandel deze als functioneel LEIDEND; oudere chatversies v0.1–v0.4 zijn concepten.
3. Lees gerichte bestaande component-/servicepatronen: apps/hr-suite/app/(dashboard)/dashboard/start/page.tsx; components/startpage/start-page.tsx; components/layout/sidebar.tsx en sidebar-navigation.ts; app/(dashboard)/work/page.tsx; lib/process-automation/runtime-service.ts en work-service.ts; app/(dashboard)/employees/[employeeId]/page.tsx; components/employees/employee-dashboard.tsx; app/(dashboard)/workforce/page.tsx; lib/continuous-appraisal/service.ts, routes /my-appraisal en /workforce/continuous-appraisal; lib/documents/document-service.ts en file-rules.ts; lib/auth/permissions.ts; huidige migrations/RLS/permission-catalogus/role mapping.
4. Inspecteer bestaand schemaspoor voor PMUX procesdefinities, formulieren/acties, reminderplanning, document-Storage en bijlagehandelingen. Bepaal per functie wat wordt hergebruikt. Bouw geen concurrente engine, losse inbox, nieuwe generieke Storage-beveiliging of aparte employee-master.
5. Check actual Node/npm, PowerShell, Git working tree en protected files, bestaande Vercel/Git deploytriggerstatus vóór eventueel push. Gebruik één uitvoerende Codex-agent, standaardmodel volgens AGENTS (Luna-Max indien beschikbaar). Geen subagents of parallelle worktrees.
6. Behartig volledige V1, niet de V2-vragenlijsten, peerfeedback, AI, 360, kalibratie, PDF-export, formeel bezwaar of Payroll-herstelsporen. Geen unrelated cleanup.

**Belangrijke baseline:** bij ontwerpdatum GitHub main 35cef731 en actieve Vercel TEST-app productcode-SHA 3b76be2c / versie 1.20261120.1, LIMITED TEST / PARTIAL. Deze SHAs zijn **historische context**, verifieer actuele heads voordat je aan de slag gaat; neem niet aan dat documentatiecommits een deployment zijn. De open P0 SEC-101, andere-tenant, rollback en Payroll SQL-recovery blijven onaangeroerd.

## 2. Mandaat en verboden acties

**Wel binnen dit één-run featuremandaat:**
- read-only inspectie van project, passende lokale Windows-ontwikkeling, nieuwe featurecode en **forward-only migratiebestand in repo**, toegespitste tests, mocks/PGlite, veilige bestaande lokale TEST-accounts, eigen geselecteerde codecommits en documentatiebewijs;
- nieuwe feature-UI en beperkte navigatie-/dashboardintegratie binnen huidige UX Foundation;
- geschikt schema/API/service/permission/RLS ontwerpen, testen en typeren **zonder automatisch remote apply**;
- echte reproduceerbare featuredefecten herstellen tot gerichte en relevante regressiegates slagen.

**Niet automatisch geautoriseerd:**
- remote Supabase Core of Payroll Lab schema-/SQL-/RLS-/grant-/Storage-bucketwrites (ook niet 'omdat het TEST is');
- nieuwe medewerkers/managerrelaties/Auth-users/rollen/tenantrechten, bulk businessdatawrites, deletions of reassignments in centrale TEST;
- gegevens in andere tenant of klant/productiedata;
- secret-/credentialwaarden lezen/loggen/commiten of wijzigen;
- bestaande werkboom/stashes/worktrees/branches vernietigen of ongerelateerde user-wijzigingen opruimen;
- modificatie van apps/hr-suite/next-env.d.ts of beschermde .env.local en hardlink;
- automatische GitHub main-merge zonder afzonderlijk gecontroleerd integratiemandaat; expliciete featurebranch-commit is toegestaan; push/PR alleen als Git-policy en mandaat dat toelaten;
- Vercel deployment, preview, release, Git-triggerreactivatie of productiedata-acties. Alleen een nieuw verzoek 'RELEASE LIQUIDHR TEST' autoriseert deployment.

**Waarom deze grens:** deze MVP introduceert privacygevoelige schema- en RLS-constructies. CODE COMPLETE kan één-run; volledig geauthenticeerde live TEST-E2E vereist dat de nieuwe schemawijzigingen door een afzonderlijke expliciete DB-writeautorisatie op TEST zijn toegepast. Zonder die autorisatie: geen schijnacceptatie, wel maximaal lokaal bewijs. Maak geen tijdelijke security-bypass om een groen resultaat te forceren.

## 3. Implementatiestrategie binnen één run

Werk in deze volgorde maar rond alle lagen in dezelfde opdracht af:

**A. Contract en design-diff** — maak korte tabel met bestaand hergebruik en precies welke ontbrekende schema-/service-/UI-onderdelen nieuw zijn. Geen nieuwe grote analysefase, daarna direct bouwen.

**B. Schema / security (CONTROLLED)**
1. Voorstel/implementatie logisch model: review rounds, participant dossier, self/manager submissions, ratings snapshot, acknowledgements, separate private notes + version history, attachment metadata, appraisal link refs. Kies minimale fysieke tables en benut bestaande PMUX/audit.
2. Tenant/HR-group/admin/employee/manager-relatie vastleggen; unieke index round+employee; FKs/checks, status enums/constraints, versie en created_by, timestamps.
3. Materialiseer gedrag via veilige transactionele RPC's/domain services voor ronde starten, medewerker toevoegen, fase indienen, beoordeling, managerbijlagen, medewerkerbevestiging, ronde sluiten, herassign reviewer, private notes. Data store kent geen API waarmee client zichzelf als andere actor kan aanwijzen.
4. **RLS/grants/policies tegelijk met CREATE**; contracten voor HR Admin/MANAGER/EMPLOYEE, eigen concepten, afzonderlijke private-note-rechten, Storage download, cross-tenant/group/team. Geen direct client-DML voor beveiligde overgang.
5. Canonieke resources zoals performance-review:manage/read, performance-review:team-read/submit, self:performance-review:read/submit, performance-review:private-read/write; pas naamgeving aan bestaande permission-catalogus aan. Regels server-side EN RLS. De bestaande hr-admin persona is TENANT_ADMIN in TEST; regel expliciet hoe de HR Admin-functionele bevoegdheid wordt vastgesteld zonder globale Tenant Admin wildcard op private HR-informatie.
6. Forward-only migratie; wijzig of herhaal geen geregistreerde historische migratie. Verifieer policies en types in PGlite/gerichte migratietests; als remote apply niet geautoriseerd is, laat SQL alleen als file en bewijs lokale contracten.

**C. Proces/PMUX en notificaties**
1. Hergebruik process definitions, workflow runtime en /work: per dossier sequentieel employee self → manager response → employee acknowledgement.
2. Bouw echte taaktransities en work-item association; geen gesimuleerde taken alleen in React. Sluiten/annuleren werkt atomair door in open PMUX work items, reminderjobs en statusprojecties. Een gesloten onvoltooid dossier behoudt onderliggende fase.
3. Bestaande scheduler/cron voor geplande ronde en reminders hergebruiken. Geen impliciete betrouwbaarheidclaim als scheduler max vijf jobs per run verwerkt; idempotentie/race cases.
4. Notificatie naar manager bij start, naar huidige actor bij stapovergang; actor en doelgroep geautoriseerd, geen privénotitie in payload.

**D. Formele documenten**
1. Bied manager vóór definitieve submit upload/preview/vervangen/verwijderen van meerdere PDF/DOC/DOCX, bestaand 25-MiB/signature-beleid tenzij bestaand veilig contract afwijkt.
2. Beveilig storage key, private bucket/permissions, anti path traversal, SHA/checksum, private auth download/preview; pas bestaande documentservice-helpers aan wanneer hergebruik veilig is.
3. Pas na managerindiening gedeelde employee-read toe; employee mutations moeten falen; direct forged storage URL/bucket toegang negatief testen.
4. In gewone employee Documenten geen automatische duplicatie of verruimde ACL. Scanbeleid eerlijk rapporteren: scanner niet aanwezig betekent geen onbewezen scan-PASS.

**E. Privé-informatie**
1. Scheid private note van gedeelde dossierresponse op SQL-/service-/API-niveau. Geen serialization na role-filter alleen in client; de server selecteert of fetch't niet voor Employee.
2. Manager schrijft eigen geautoriseerd dossier, HR Admin eigen context, versie-/edit-audit. Publieke manager-submit vergrendelt níet automatisch private note zolang ronde ACTIEF is; sluiten maakt alles read-only.
3. Schrijf **negatieve testen** op JSON, gewone dossierroute, employee dashboard, employee documenttab, timeline, notificaties, exports, search en AI-tools. Controleer bestaande HeRa/Focus/MCP/AI data providers of zij generieke employee reads gebruiken; sluit private data expliciet uit of stel fail-closed contract vast.
4. Geen verspreiding van private notes naar Continuous Appraisal.

**F. Gesprek / status / compatibiliteit**
1. HR wizard in 3 stappen met doelgroepfilters, schaalkeuze en preview; ronde detail met voortgang, toevoegen, sluitconfirm + verplichte reden; statusovergangen op server.
2. Employee selfreflection save/submit; Manager response save/submit, optionele datum, optionele score+verplichte toelichting, bijlagen/private note; employee akkoord of verplicht niet-akkoord.
3. Implementatie fasebeveiliging: concept alleen auteur, publieke velden zichtbaar na submit, historie immutable. Formulier READ ONLY voor gesloten ronde of final dossier; 409 bij stale update, geen verborgen auto-save.
4. Onderscheid eigen rol als medewerker en rol als manager; eigen selfservice niet in teamtaken begraven.

**G. Navigatie en startdashboard**
1. Voeg nieuwe Gesprekken-route toe onder bestaande Workforce; niet alle medewerkers automatisch HR-beheer tonen. Werk sidebar-navigation.ts en labels/testregels gecontroleerd bij, ook voorkeurs-menuordening.
2. HR Admin dashboardwidget met ronde-KPI's en beheeractie; Manager widget met eigen teamtaken; Employee widget met eigen gesprek + volgende actie. Integreer in bestaande startpagina-data/projectie, met aggregaties die teamscope en confidentiality afgedwongen hebben.
3. In /work verschijnen dezelfde echte PMUX-fasetaken, met juiste deeplink en zakelijke categorie/filters. Maak geen tweede /my-tasks.
4. Medewerkerkaart aparte tab Gesprekken (niet achter Talent Passport). /employees/[employeeId]?tab=conversations, scope en lijst; detailgemeenschappelijke /conversations/[conversationId] met rolgefilterde secties.
5. Gebruik bestaande Foundation, NL/EN, keyboard/a11y, desktop en 390px. Geen hardcoded HEX/componentduplicaten. Complete loading, 403, 404, empty, conflict, invalid-file, upload-progress en closed-readonly UI.

**H. Continuous Appraisal**
1. Lees en link alleen bestaande gedeelde items waarvoor bronservice geautoriseerde read bevestigt; persist bron-ID relation.
2. Vanuit formeel dossier terug naar /my-appraisal of /workforce/continuous-appraisal met relevante medewerker/recordcontext, niet met by-pass queryparameters.
3. Een optionele neutrale referentie in tijdlijn mag geen private notitie, score, documenten of conceptdata bevatten. Pas de bestaande transparent/handover-regels toe.
4. **Geen creatie van nieuwe development goals vanuit formele cyclus** — V2.

## 4. Exacte TEST-persona's en omgeving

**Primair voor Performance V1:** bestaande lokale persona keys 'hr-admin', 'manager', 'employee'. Verifieer bestaande identity, active roles, echte teamtoewijzingen en relevante employee-relaties via normale read routes; **niet aannemen** dat manager en employee vanzelf een geautoriseerde pair vormen.

**Canoniek TEST-bedrijf:** De Sterren holding → HR-groep Planeten → Jupiter BV. Bestaande hr-admin heeft TENANT_ADMIN binnen De Sterren holding, 3 HR-groepen en 5 administraties; géén rechten naar andere tenants. Deze grens nooit verbreden.

**Bestaande optionele persona's:** payroll-lisa, payroll-jaap, payroll-frits volgens docs/quality/acceptance/PAYROLL-TEST-PERSONAS.json. Lisa heeft vooraf bestaande DIRECT_MANAGER-rechten en is dus **geen zuivere Employee-negatieve test**. Jaap en Frits kunnen als extra employee-only kandidaten gebruikt worden wanneer bestaande context/auth-mapping valide is; hun Payroll-inhoud is niet onderdeel van deze feature. Geen wachtwoorden of sessies uit docs kopiëren.

**Credentialbron** blijft uitsluitend op de beveiligde lokale Windows runtime: %LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env en de beschermde apps/hr-suite/.env.local hardlink. Toon of lees waarden niet in output. Geen credentials in code/chat/screenshots. Windows lokaal: C:\Users\Edwin\Documents\Apps\LiquidHR (verifieer werkelijke pad), Node/npm en PowerShell; geen Docker/WSL/Linux workaround.

**Testtools:** scripts/test-local-acceptance.ps1 ondersteunt -WorktreePath, -Route, -EmployeeRoute, -Personas @('hr-admin','manager','employee'), -Viewports @('desktop','mobile') en -PreflightOnly. Lees de precieze help/bron en gebruik veilige preflight vóór uitvoering. scripts/check-test-personas.ps1 is primair de Payroll Lisa/Jaap/Frits-checker en **niet** op zichzelf een acceptatiebewijs voor de nieuwe Performance-rolmatrix.

**Loopback Test Auth/role-switch is uitsluitend lokaal.** Niet verplaatsen naar Vercel, niet openen via hosted URL en nooit laten werken met uitgebreide testallowlist. Hosted testing vereist aparte bestaande supported auth sessions, niet de lokale browser-switch.

## 5. Één-run TEST-matrix (volledig MUST)

### Happy path / echte rollen
- HR Admin (normale lokale sessie) maakt zonder beoordeling een ronde voor één geautoriseerde medewerker, controleert managerscope, zachte datum en eerste taak. Manager krijgt info maar nog geen actie.
- Employee logt in met eigen bestaande identiteit, ziet dashboard en /work taak, schrijft concept (manager en HR mogen concept niet lezen), verstuurt en controleert readonly.
- Bevoegde Manager ziet /work taak en employee-reflectie, uploadt PDF en DOCX, schrijft reactie, vult desgewenst gespreksdatum in en verzendt.
- Employee leest gedeelde definitieve inhoud en managerbestanden, kan geen document muteren, bevestigt AKKOORD; HR dashboard en employee dossierhistorie kloppen; geen extra taak.
- Maak afzonderlijk een ronde **met** score (4 en/of 5; 10 via parameterized unit/contract), scorelabel + verplichte manageronderbouwing, eindigt met VOOR GEZIEN — NIET AKKOORD plus verplichte motivatie.
- Controleer de interne informatie vanuit HR Admin/Manager én afwezigheid in alle employee-responses, ook nadat medewerker akkoord heeft getekend.
- HR voegt tijdens actieve ronde deelnemer toe; andere medewerker blijft ongewijzigd; duplicate blocked. HR sluit ronde voortijdig terwijl dossiers in verschillende fasen zitten; status blijft bewaard en werkitems zijn niet langer uitvoerbaar.
- Link shared Continuous Appraisal-doel/actie aan gesprek; manager/employee zien de originele bron onder bestaande autorisatie, geen private data in timeline.
- Controleer alle drie startdashboardwidgets, Workforce, /work, /my-conversations en aparte medewerkerkaarttab.

### Negatieve securitymatrix — verplicht op echte auth-context waar ondersteund
- Anoniem: protected routes 401/redirect en geen JSON/private data.
- Employee: kan andere employee-dossier-ID, manager/HR endpoints, private note, conceptbijlagen, file deletion en andere managerteksten vóór indienen niet lezen/schrijven.
- Manager: kan niet rondes aanmaken/sluiten/deelnemers buiten eigen scope beoordelen; geen cross-team of cross-admin docs/notes/ratings; geen historische onbevoegde reads na managerwissel.
- HR Admin: kan niet zonder expliciete grants buiten eigen tenant en HR-context lezen; generieke tenant-admin zonder performance-scope geen privédossier.
- Forged tenant/hr-group/admin/employee IDs, URL path, file ID, appraisal ref ID, form clientpayload, scorewaarde en serialized editfields worden geweigerd.
- Direct signed URL/bucket/object op andere medewerker, unpublished doc en expired link faalt.
- RLS test op Core waar permitted en waar veilig zonder remote writes; PGlite/mocks nooit als vervanger voor werkelijk remote/hosted acceptatie presenteren.
- Concurrency: dubbele submit/add/upload, managerwissel, ronde close tijdens submit, optimistic stale state, scheduled start en reminders retries.
- Privétekst mag niet verschijnen in response bodies, doc exports, algemene Documenten, notification, /my-appraisal, AI/MCP/HeRa/Focus-projection, logs en dashboard-aggregates.

### UI en regressie
- NL/EN i18n keys gelijk, labels accuraat ('Voor gezien — niet akkoord'), formvalidatie met screenreader/keyboard.
- Desktop + 390px mobiel per HR, Manager, Employee; dropdowns/filters, preview, file uploader, 409-conflict, lege en readonly states.
- Negatieve inspectie van andere HR/Talent/PMUX/Documenten/Payroll UI, bestaande workflows en SEC-101 reads. Geen noodzakelijke regressies open laten zonder bewijs.

## 6. Testcommando's en testvolgorde

Voer alleen commando's uit die op de feitelijke bestaande npm-scriptnamen en checkout aansluiten:
1. Git status/origin-main en veilige ontwikkelcheckout controleren. Bij dirty main één nieuwe schone featureworktree vanaf actuele origin/main volgens EXECUTION HOTFIX. Alleen dependencychecks voor lokale tooling; **geen browser-, persona- of TEST-runtime-preflight als gate vóór de eerste featurecode**. Laat dirty, protected files en stashes met rust.
2. Gerichte Vitest-tests voor nieuwe performance-service, schema/PGlite/RLS contract, process-automation transitions, document signature/privacy en UI components. Gebruik bijvoorbeeld npm.cmd exec --workspace @liquid-hr/hr-suite -- vitest run <gekozen-bestanden>. Lees npm-CLI syntax en package.json vóór uitvoering; geen blind glob.
3. Typecheck: npm.cmd run type-check --workspace @liquid-hr/hr-suite.
4. Lint: npm.cmd run lint --workspace @liquid-hr/hr-suite (of passende scope; volledige workspace bij finale CONTROLLED gate).
5. i18n: npm.cmd run check:i18n --workspace @liquid-hr/hr-suite.
6. Security-/RLS-/scopecontracttests inclusief bestaande SEC-101 regressies. Voor nieuwe migrations PGlite plus bestaande supabase migration/constraint-testinfrastructuur, geen Docker.
7. Lokale echte browserpersona-/role-scopetest met bestaande launcher, test-local-acceptance.ps1 preflight en vervolgens concrete Performance routes en 390px. Als testharness andere route verwacht: voeg klein gerichte testflow toe die bestaand auth-contract respecteert.
8. Eén volledige relevante HR Suite-suite en een production build **op de uiteindelijke codekandidaat** conform CONTROLLED risico; root npm ci alleen indien werkelijk nodig. Voer bestaande Payroll-client-bundle-/FunctionTrace-gates uit zoals buildscript vereist, zonder Payroll-bronwijziging.
9. Bij elke fout: reproduceer → gerichte oorzaakfix → targeted rerun; maximaal twee gerichte herstelcycli per blocker. Na inhoudelijke codewijziging na finale full gate moet de toepasselijke final gate opnieuw op nieuwe SHA.
10. Geen onderscheid tussen 'groen' van mocks en echte sessies vervagen. Maak evidence met exacte commando's, testresultaat, SHA, lokale/remote modus en explicit OPEN/BLOCKED.

### Bestaande Windows-beperkingen
- Next dev gebruikt Webpack; Node 22.14 is mogelijk te oud voor huidige chromiumpackage, ondersteunde Node 24 gebruiken zonder env/secrets-chirurgie.
- Codex Chromium kan in eigen sandbox Windows Crashpad named-pipe TargetClosedError geven; gerichte bestaande CLI browser buiten sandbox volgens goedgekeurde methode, nooit willekeurige Chrome security flags.
- Sla geen Docker- of WSL-alternatieven voor.

## 7. E2E- en datagating

**Code bouwen/testen** kan binnen het featuremandaat; **remote SQL-schemaapply** en nieuwe centrale synthetische testcase-records vergen afzonderlijke expliciete toestemming, ook op Core TEST. Breng volledige migratie, risico (tabellen/RLS/grants/Storage), niet-destructieve readback/rollbackplan en precieze TEST-ID in kaart, vraag dan alleen dat mandaat. Laat gebruiker geen bestaande eerdere vraag opnieuw beantwoorden.

Bij ontbreken van autorisatie:
- lokale UI/service/mocks/PGlite/contracttests zo volledig mogelijk afmaken;
- geen tijdelijke in-memory productie-fallback, geen gesimuleerde groene real-user-E2E;
- geen permission allowlist/reviewer bypass, geen directe service-role datawrites om flow te omzeilen;
- status: 'CODE COMPLETE / REAL TEST E2E BLOCKED: NEW CORE SCHEMA NOT APPLIED', plus exact gevraagde vervolgstap; laat featurewerk niet onnodig verspreid in onafgemaakte delen achter.

Na afzonderlijk verleende TEST-migratieautorisatie: pas alleen geauditeerde bedoelde forward-only migration toe, verify readback/RLS/grants/advisors/types, voer vervolgens **normale productflows** met bestaande rolpersona's uit, geen direct schema-write als bewijs van normale klantworkflow. Eventueel nieuwe synthetische demo-gespreksdossiers via de gewone HR-schermen uitsluitend binnen afzonderlijk aangewezen TEST-datamandaat.

## 8. Commit, documentatie, releasegrens en oplevering

- Nieuwe code/SQL/tests onder relevante productmappen. Werk de relevant index en docs/AA/AA-NEXT.md alleen bij als de realiteit van de build/acceptatiestatus verandert. **Niet** overschrijven van historische acceptance evidence. Bewaar runrapport docs/quality/acceptance/runs/PERF-MVP-01-<datum>.md met gescheiden CODE/LOCAL/TEST-HOSTED-statussen.
- Werk local-first; stage expliciete in-scope paden, nooit git add -A op gemengde werkboom. Behoud stashes, next-env.d.ts, Payroll worktree en beschermd env.
- Maak één of enkele logisch gescopeerde featurecommits indien gates groen of gedocumenteerd extern BLOCKED. GitHub branch push/PR alleen indien het uitvoermandaat dat uitdrukkelijk omvat; **geen automatische main-merge** vanuit deze instructie. Voor een PR: exact diff, tests, resterende gates, clear feature label.
- Geen Vercel release of aliaswijziging zonder afzonderlijk letterlijk verzoek 'RELEASE LIQUIDHR TEST'.
- Geen bewering dat P0 SEC-101, Payroll-recovery of hosted rolacceptatie ineens is afgerond door de nieuwe feature.

**Opleverformat:**
1. **Resultaat** — welke MUST functionaliteit aantoonbaar werkt, welke niet; links naar relevante screens/routes en componenten.
2. **Schema & security** — migrations, wel/niet remote toegepast, RLS/grants/private notes/doc Storage/manager scope.
3. **Testmatrix** — PERF-A01..A34 PASS/FAIL/BLOCKED/SKIP + evidence per actor, echte tests vs mock, desktop/390px, NL/EN, SHA.
4. **Herstelde defects** — root cause, commit en rerun.
5. **Git** — branch, exacte commit SHA, geselecteerde files, PR (indien toegestaan), clean/dirty status en protected files intact.
6. **Release** — 'NIET GEDEPLOYD'; Vercel TEST baseline ongewijzigd, tenzij later apart geautoriseerd.
7. **Open blokkades** — exact ontbrekend DB/data/auth/release-mandaat of externe afhankelijkheid; geen nieuwe brede planning.

**Definition of Done (feature):** PERF-A01..A34 zijn aantoonbaar afgedekt met bewijs op de finale codekandidaat; waar echte TEST/hosted bewijzen door afzonderlijk autorisatiemandaat ontbreken, expliciet PARTIAL/BLOCKED en **niet** 'alles PASS'.

**Slotinstructie Codex:** lever maximaal mogelijke werkende V1 in deze run, herstel normale bugs zelf, stop alleen op daadwerkelijke beschermde handelingen. Geen feature-scope-uitbreiding, geen fictief testbewijs, geen automatische deployment.