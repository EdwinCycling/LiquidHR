# Implementatiestatus Liquid HR

## Documentatiebaseline 2026-08-05: HR-groepen en parallel verzuim

De leidende scope voor de volgende implementatieslice staat in [HR_GROEP_SCOPE_EN_INRICHTING.md](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md), [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md), [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md) en het [Luna-uitvoeringsplan](LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md).

Status: **documentatie bijgewerkt; implementatie nog niet gestart**.

De nieuwe scope maakt HR-groep de primaire context en zichtbaarheidgrens. Bedrijf, locaties, afdelingen, functies, rollen, verlofregels en verzuiminstellingen zijn HR-groepgebonden. Administratiegegevens, salaris, payroll en CAO blijven administratiegebonden. Verlofsaldo en verzuimcasus blijven dienstverbandgebonden.

De verzuimregel is expliciet gecorrigeerd: overlap tussen verschillende dienstverbanden of HR-groepen is toegestaan. Alleen overlap binnen hetzelfde dienstverband wordt geweigerd. Dit ondersteunt bijvoorbeeld een medewerker die voor het dienstverband als portier hersteld is gemeld en voor het dienstverband als badmeester gelijktijdig ziek is.

In deze documentatieslice zijn geen code-, schema-, remote database-, testdata-, commit- of deploymentwijzigingen uitgevoerd.

De huidige database bevat uitsluitend synthetische testdata. De eerstvolgende implementatie mag bestaande records zonder productie-compatibiliteitsdoel opnieuw koppelen, aanpassen, vervangen of opnieuw seeden. Luna mag geen fallback, dual-read, dual-write of verborgen legacy-ondersteuning voor het oude tenant-/administratiemodel bouwen. De nieuwe HR-groepimplementatie wordt het enige uitvoermodel.

## Actuele update 2026-08-05: afdelingsdropdown roltoewijzingen administratiegebonden

De pagina `/role-assignments` toonde eerder alle actieve tenantafdelingen, terwijl roltoewijzingen per administratie worden opgeslagen. De service filtert de afdelingen nu op actuele organisatieplaatsingen en bestaande roltoewijzingen binnen de actieve administratie. Een afdeling zonder actuele plaatsing blijft daardoor alleen zichtbaar wanneer er in die administratie al een roltoewijzing voor bestaat; afdelingen uit andere administraties vervuilen de dropdowns en de lijst **Afdelingen zonder leidinggevende** niet meer.

Lokaal geslaagd: de scope-regressietests, bestaande manager-resolvertests, strict TypeScript en ESLint. Remote read-only geslaagd: de testtenant levert verschillende afdelingssets per administratie op. Geen migration, remote write, commit of deployment.

## Actuele update 2026-08-05: company-data PATCH 400 opgelost

De bedrijfsgegevensmanager stuurde het read-only veld `id` mee naar `PATCH /api/settings/company-data`. Omdat de updatevalidator strict is, werd elke opslag met HTTP 400 afgewezen. De client gebruikt nu een expliciete payload met uitsluitend wijzigbare velden en heeft een regressietest die de payload tegen de echte schema-validator controleert.

Verificatie: gerichte company-data-tests (4 tests), strict TypeScript, gerichte ESLint en `git diff --check` zijn geslaagd. Een directe schema-reproductie accepteert de nieuwe payload zonder `id`.

## Actuele update 2026-08-04: Test Medewerker toegevoegd aan Yara-team

Migration `20260804193021_move_test_employee_to_yara_team.sql` is remote toegepast. De gekoppelde fixture-account **Test Medewerker** is Noah Hendriks (`DEMO-035`). Hij staat nu in **Test Operations** (`RICH-02`) met functie **Operations specialist** en rapporteert direct aan Yara (`DEMO-028`). Yara's actuele directe team bevat hierdoor vijf medewerkers.

## Actuele update 2026-08-04: Yara-testteam en herkenbare leidinggevende-status

Migration `20260804191903_manager_assignment_status_and_yara_team.sql` is remote toegepast op het gekoppelde Supabase-testproject. De bestaande brede synthetische directe-managerrelaties naar Yara (`DEMO-028`) zijn leeggemaakt. Yara staat nu in **Test Operations** (`RICH-02`) met vier expliciete directe teamleden: Maya Bos (`DEMO-032`), Omar Kaya (`DEMO-037`), Sophie De Vries (`DEMO-042`) en Milan Visser (`DEMO-047`). Haar `DIRECT_MANAGER`-roltoewijzing gebruikt dezelfde afdeling.

De roltoewijzingenlijst gebruikt niet langer **Controle nodig**. De statuskolom heet **Type** en toont `LG-Afd` bij dezelfde afdeling en `LG-Afd-Plus` bij een andere toegewezen afdeling. Yara hoort hierdoor `LG-Afd` te zien; haar managerteamscope hoort vier medewerkers te tonen.

## Actuele update 2026-08-04: administratiegebonden roltoewijzingen

Roltoewijzingen tonen en accepteren alleen medewerkers met een actueel bevestigd primair dienstverband in de actieve administratie. De server voert dezelfde controle uit vóór een nieuwe `department_management`-regel. De pagina toont bovendien wanneer de gebruiker alleen leesrechten heeft en schakelt de schrijfknoppen dan uit. Hiermee voorkomt de UI dat een medewerker uit een andere administratie, zoals Yara/`DEMO-028` uit Operations vanuit de Holding, als geldige rolhouder wordt aangeboden.

Strict TypeScript, i18n-pariteit en gerichte ESLint zijn geslaagd. Geen migration of remote datamutatie nodig.

## Actuele update 2026-08-04: rijke synthetische medewerkerdataset

Migration `20260804180940_seed_rich_employee_dataset.sql` is remote toegepast op het gekoppelde Supabase-testproject. De idempotente fixture verrijkt 72 bestaande testmedewerkers met telefoons, avatars, adressen, testbankgegevens, relaties, actuele dienstverbanden, salarissen, roosters, organisatieplaatsingen, afdelingen, functies, locaties, kostenstructuur en beperkte dossier-/verzuimactiviteit. Er zijn geen auth-users of echte persoonsgegevens aangemaakt; avatars zijn ingebedde synthetische SVG-data en IBAN-velden gebruiken alleen fixture-ciphertext.

Eindcontrole: 68 actieve medewerkers hebben allemaal een actueel bevestigd primair dienstverband, salaris, rooster, organisatie, primair adres, primaire bankrekening en relatie. De transactionele dry-run en remote uitvoering zijn geslaagd. Database-types zijn opnieuw opgehaald; er was geen typecontractwijziging. Advisors zijn opnieuw uitgevoerd: security 2 INFO/15 WARN en performance 255 INFO/0 WARN; dit zijn projectbrede bestaande meldingen en geen fixture-specifieke fout.

De migration herstelt daarnaast de bestaande locatie-guardfunctie die bij een locatie-insert naar een niet-bestaande `single_location`-kolom verwees. Deze gerichte functiecorrectie was nodig voor de locatie-fixture; er is geen bestaande gebruikersdata verwijderd.

## Actuele update 2026-08-04: Supabase security- en performance-hardening

De Star Performer-RLS policies zijn performance-neutraal geconsolideerd: `read` blijft de enige SELECT-policy en de bestaande `write`-policy is per tabel vervangen door afzonderlijke INSERT-, UPDATE- en DELETE-policies met dezelfde permissionchecks. Daarnaast bevatten de relevante `SECURITY DEFINER`-RPC's geen `pg_temp` meer in hun search path. Beide migrations zijn remote toegepast en de officiële types zijn opnieuw opgevraagd; er wijzigde geen databasecontract.

Advisorresultaat: performance 0 WARN en 258 INFO; security 15 bestaande authenticated SECURITY DEFINER-WARNs en 2 bewuste RLS-zonder-policy INFO's. De Auth-melding voor gelekte wachtwoorden blijft afhankelijk van Supabase Auth-inrichting. Tests, strict typecheck, ESLint en productiebuild zijn groen.

## Actuele update 2026-08-04: compactere fotoweergave medewerkerslijst

Aanvulling: **Foto collage** is toegevoegd als extra view-keuze met vierkante foto’s of initialen, zonder namen, in een strak responsive raster.

De medewerkerslijst ondersteunt nu zeven view-keuzes: Detail, Compact, Kaarten, Foto's groot, Foto's standaard, Foto's klein en Alleen foto (vierkant). De drie benoemde fotoweergaven renderen uitsluitend foto/initialen en voornaam; de vierkante variant rendert alleen foto/initialen met een dunne rand. Voor medewerkercollega's en managerrecords buiten het directe team blijft de veilige popupkliklaag actief; directe teamleden, eigen records en HR-bevoegde records behouden hun normale detailroute. Geen personeelsnummer of andere verborgen directoryvelden worden in de fototegel toegevoegd.

`photo` is opgenomen in de voorkeur-parser, PATCH-validatie, URL-state en i18n. Er is geen schemawijziging of migration nodig.

## Actuele update 2026-08-04: kaartweergave medewerkerslijst

De lijstweergave is uitgebreid met **Kaarten** naast Detail en Compact. Het filter gebruikt de bestaande voorkeursschrijfroute; de parser, URL-helper en `user_preferences.ui_state.employeesList` accepteren de nieuwe waarde `card`. De kaart gebruikt een responsive `auto-fit`-grid, avatar/initialen, status, functie, afdeling en zakelijk e-mailadres wanneer die velden voor de kijker zichtbaar zijn. De kliklaag blijft rolbewust: medewerkercollega's en managerrecords buiten het directe team openen de beperkte directory-popup; eigen/directe bevoegde records openen de bestaande detailroute. Personeelsnummers worden niet in de beperkte kaarten gerenderd.

Lokaal geslaagd: 9/9 voorkeurentests, strict typecheck, gerichte ESLint, i18n-pariteit en `git diff --check`. Remote geslaagd: één opgeslagen `card`-voorkeur in de Supabase `user_preferences`-JSON-scope. Browsercontrole op poort 3000 geslaagd voor manager- en medewerkerrol, inclusief herladen, 3-kaarten-per-rij op desktop, 20 medewerkerskaarten, 19 collega-popupknoppen, één eigen profiel-link en een popup met de vrijgegeven directoryvelden. Geen migratie, commit, push of deployment uitgevoerd.

## Actuele update 2026-08-04: managerbeschikbaarheid op de startpagina

De startpagina heeft voor managers een breed venster **Beschikbaarheid team** met een horizon van zeven dagen inclusief vandaag. Teamleden staan verticaal; de dagen staan horizontaal. De manager kan wisselen tussen **Aanwezig** en **Uren aanwezig**. Beschikbaarheid is server-side opgebouwd uit het bestaande werkpatroon/legacy-rooster, goedgekeurd verlof en actieve verzuimspells, met alleen de directe managerstam als bron. HR Admins zonder managerrol en medewerkers krijgen dit venster niet. De widget staat standaard links in de brede kolom en blijft onderdeel van de persoonlijke vensterordening. Geen schemawijziging of remote write.

Lokale verificatie: i18n-pariteit, strict TypeScript, ESLint, de layouttests en `git diff --check` zijn geslaagd. De authenticated browsercontrole op poort 3000 bevestigde beide weergaves, de 7 dagkolommen en dat de HR Admin-startpagina de managerwidget niet toont.

## Actuele update 2026-08-04: medewerkerdirectory beperkt tot actieve niet-gearchiveerde records

De directoryservice forceert voor medewerkers `activeDirectoryOnly`: alleen `ACTIVE_EMPLOYEE` en niet-gearchiveerde records gaan naar de lijstweergave. De filter-UI toont voor medewerkers alleen Actief en Niet-gearchiveerd; managers behouden hun bestaande status- en archiefkeuzes. De huidige tenant heeft geen toekomstige of gearchiveerde testrecords, maar de servergrens en rolafhankelijke filters zijn browsermatig gecontroleerd. Geen migration nodig.

## Actuele update 2026-08-04: personeelsnummer uitgesloten van medewerker-collegaweergave

Het personeelsnummer wordt niet gerenderd en niet doorzocht wanneer een medewerker de directory bekijkt. Voor een manager buiten het directe team geldt dezelfde beperking. De directory-popup bevat het nummer server-side al niet; de remote SQL-check op `get_employee_directory_detail` bevestigde beide mogelijke sleutelvormen als afwezig. Typecheck en gerichte ESLint zijn geslaagd; er is geen nieuwe migration nodig.

## Actuele update 2026-08-04: directoryvelden worden ook uit de medewerkerslijst verwijderd

Naam is niet uit te schakelen: de HR-instelling blijft aangevinkt en disabled, en de server forceert `showName: true` bij lezen en schrijven. De andere vijf velden zijn afzonderlijk instelbaar. De zichtbaarheid geldt nu voor popup én lijst; functie/afdeling en zakelijk e-mailadres worden bij uitschakelen niet gerenderd en niet meegenomen in de lijstzoektekst.

Migration `20260804190000_employee_directory_visibility.sql` is remote toegepast. De browsercontrole bevestigde de disabled Naam-checkbox en een medewerkerslijst zonder functie/afdeling of e-maillinks bij tijdelijk uitgeschakelde instellingen; de testpopup had dezelfde beperking. De testadministraties zijn teruggezet naar alle defaults `true`. Typecheck, i18n, gerichte ESLint en Supabase advisors zijn uitgevoerd. Advisors zijn projectbreed 17 security- en 261 performance-meldingen; de extra securitymelding betreft de nieuwe authenticated SECURITY DEFINER visibility-RPC met interne permissioncheck.

## Actuele update 2026-08-04: manager-buiten-team als collega-popup

Managers krijgen in `scope=all` alleen voor directe teamleden de volledige medewerkerdetailroute. Niet-teamleden worden via dezelfde beperkte directory-popup behandeld als medewerkers. Dit wordt zowel in de lijst als in de server-side detailroute afgedwongen; handmatige detail-URL's voor niet-teamleden redirecten terug naar `/employees`. `TENANT_ADMIN` blijft volledig bevoegd. De directory-RPC accepteert voor deze veilige lezing ook `employee:read`, zonder uitbreiding van de detailprojectie.

De remote migration `manager_non_team_directory_privacy` is toegepast en de functie is met een remote SQL-check gecontroleerd op beide permissionpaden. De interne browsercontrole bevestigde popup voor Bas de Jong buiten het team, volledige detailpagina voor teamlid Lina Bakker en redirect bij directe URL. Typecheck, gerichte ESLint en Supabase advisors zijn uitgevoerd. Advisors blijven projectbreed op 16 security- en 261 performance-meldingen staan; de directory SECURITY DEFINER-waarschuwing is bestaand patroon en de functie voert interne permissionchecks uit.

## Actuele update 2026-08-04: medewerkersdirectory voor medewerkers

De medewerker krijgt `employee-directory:read` en kan daardoor de medewerkerslijst van de actieve administratie openen zolang de HR-instelling **Medewerkers mogen de medewerkerslijst openen** aan staat. Nieuwe administratievelden voor directorytoegang en zes afzonderlijke popupvelden hebben default `true`. Collega's zijn voor medewerkers geen links naar manager-/HR-detailpagina's maar knoppen met een veilige popup. De server-RPC geeft alleen vrijgegeven naam, functie/afdeling, zakelijk e-mailadres, zakelijk telefoonnummer, weekstatus (`WORKING`/`OFF`/`ABSENT`) en rooster terug; absence-redenen en overige HR-data worden niet geprojecteerd.

De migrations `20260804180000_employee_directory_settings.sql` en `20260804180500_employee_directory_access.sql` zijn remote toegepast, inclusief RLS/permissionchecks, schedule-fallback en datumserialisatie. TypeScript-types zijn opnieuw gegenereerd. De browsercontrole met de medewerkerfixture bevestigde 20 records en de popup. Een HR-toggletest op zakelijk e-mailadres bevestigde dat dit veld verdwijnt terwijl telefoon, aanwezigheid en rooster zichtbaar blijven; de defaults zijn na de test hersteld. `type-check`, `check:i18n`, gerichte ESLint en `git diff --check` zijn uitgevoerd. Supabase-advisors bevatten 16 security- en 261 performance-meldingen, projectbreed; de enige nieuwe securitymeldingen zijn de twee SECURITY DEFINER directory-RPC's, die server-side permissionchecks uitvoeren en via de bestaande authenticated-RPC-patroon worden aangeroepen.

## Actuele update 2026-08-04: gesloten medewerkerslijst en expliciete teamscopefilters

De medewerkerslijst start altijd gesloten; de open/dicht-state wordt niet meer via `/api/preferences/employees` naar `user_preferences` opgeslagen. Oude `filterPanelOpen`-waarden worden genegeerd en bij een volgende opslag opgeschoond. De bestaande persoonlijke voorkeuren voor status, archief, sortering en weergave blijven behouden.

Een geforceerde Mijn team-link gebruikt nu de expliciete preset **Actief + toekomstig + externe personen**, `archive=active` en `scope=team`. De service filtert deze preset als actieve, toekomstige en externe personen en sluit voormalige medewerkers uit. De Startpagina gebruikt de herbruikbare URL-helper.

Authenticated browsercontrole op poort 3000 bevestigde dat de managerlink exact `status=active-future-external&scope=team` gebruikt, 17 teamrecords toont, het filterpaneel gesloten opent en na expliciete actieve filtering 13 actieve teamrecords toont. HR Admin opent de medewerkerslijst eveneens gesloten.

## Actuele update 2026-08-04: rolgebonden startpagina- en medewerkerslijstscope

Lokaal geïmplementeerd: de startpagina toont voor managers **Wat speelt er nu in mijn team** en voor HR Admins **Wat speelt er nu in ons bedrijf**. De combinatie `DIRECT_MANAGER` + `TENANT_ADMIN` krijgt een server-gedreven switch tussen beide scopes. De knop achter de teamkop opent de medewerkerslijst geforceerd met `scope=team`.

De medewerkerslijst gebruikt voor managers standaard de teamscope en biedt in het filterpaneel **Mijn team** en **Alle medewerkers**. De scope wordt door de route en `listEmployeesOverview` server-side bepaald; alleen een manager kan `scope=team` aanvragen. Teamgerichte startpaginacijfers en operationele lijsten gebruiken dezelfde directe teamscope. De Startpagina geeft voor de geforceerde teamlijst ook `status=active-future-external` mee.

De bestaande placeholder **Taken & Poortwachter** blijft een managementplaceholder en wordt niet aan medewerkers getoond. De huidige codebase bevat wel taaktemplates voor verzuiminstellingen, maar geen taakinstantiebron voor een betrouwbare startpaginacount; er is daarom niets verzonnen.

Checks: `check:i18n`, strict `type-check`, `lint`, de gerichte `employee-list-state`-tests, `git diff --check` en authenticated browsercontrole op poort 3000 zijn geslaagd. Geen schemawijziging, remote write, commit, push of deployment.

## Actuele update 2026-08-04: volledig organogram voor medewerkers

De medewerker krijgt volledige organogramleesrechten binnen de actieve administratie via `organization-chart:read`; managementrechten blijven ongewijzigd. De service slaat star-performerbeoordelingen over voor medewerkers. De migration `20260804170000_employee_full_organization_chart_read.sql` herziet de RLS-policies voor de organogrambrondata en is remote toegepast. Advisors en DB-typegeneratie zijn uitgevoerd; bestaande security/performance-waarschuwingen zijn niet slice-specifiek opgelost. Authenticated browsercontrole volgt.

## Actuele update 2026-08-04: Ontwikkeling voor medewerkers

De navigatie toont `Ontwikkeling` in plaats van `Workforce`. Medewerkers openen dezelfde route met een beperkte self-serviceweergave: alleen bestaande, toegestane routes voor Doorlopende beoordeling (`/my-appraisal`) en Talentprofielen (`/my-talent`) verschijnen. Managementrollen behouden de bestaande 9-grid-, doorlopende-beoordeling-, talentprofiel-, Star Performer- en Cloud-tags-tegels. De Startpagina gebruikt dezelfde rolgebonden filtering. Geen schemawijziging of remote write; i18n, strict TypeScript en gerichte ESLint zijn geslaagd.

## Actuele update 2026-08-03: Full/Compact en persoonlijke startpagina-layout

Lokaal geïmplementeerd: de startpagina-header ondersteunt Full en Compact. Compact verbergt weer, komende dagen en reorder-controls; Full behoudt de bestaande header en maakt de brede/smalle vensters ordelijk verplaatsbaar met drag-and-drop en pijlen. De voorkeuren worden direct per user bewaard in `user_preferences.ui_state.startPage` via `/api/preferences/start-page`, analoog aan het medewerkerdashboard. Geen schemawijziging of remote write. i18n, strict typecheck, ESLint, gerichte browsercontrole en `git diff --check` zijn geslaagd.

## Actuele update 2026-08-03: Workforce-links op de startpagina

De verouderde Dashboard-werkplekzin is vervangen door een permission-gestuurde Workforce-strip. De Startpagina linkt naar de bestaande 9-grid-, continuous-appraisal-, talentprofielen-, Star Performers- en Cloud-tags-routes wanneer de gebruiker daarvoor de bijbehorende permission heeft. Geen schemawijziging of remote write.

## Actuele update 2026-08-03: gebeurtenissen op de startpagina

Het bestaande live venster **Gebeurtenissen** op `/dashboard/start` blijft gekoppeld aan de bestaande gebeurtenisservice en `/insights/upcoming-events`. De verouderde dubbele placeholder **Gebeurtenissen — Bron wordt later aangesloten** is verwijderd. `DIRECT_MANAGER` krijgt alleen gebeurtenissen van actieve directe teamleden; HR Admin krijgt de actieve administratie-scope. De lokale migratie `20260803200000_allow_manager_upcoming_events_report` geeft managers toegang tot de bestaande rapportdoorklik; remote toepassen is nog open. Geen schemawijziging of remote write.

## Actuele update 2026-08-03: persoonlijke medewerkerdashboard-samenvatting

De medewerker-overview gebruikt de nieuwe `EmployeeDashboardSummary` als zelfstandige persoonlijke samenvatting. De kaart toont alleen persoonsgegevens en persoonlijke contactcontext: naam, leeftijd/verjaardag, werk- en privécontact, adres, primaire bankrekening en noodcontacten. Het algemene dashboard behoudt de overige eigen-medewerkermodules; management-KPI's en teamscope-informatie blijven uitsluitend in de Startpagina.

Er is geen schema-, API- of RLS-wijziging nodig geweest. De bestaande server-side detailservice en route blijven de gegevensgrenzen bepalen. Strict typecheck, gerichte ESLint, `git diff --check` en de bestaande dashboardlayouttest (2/2) zijn geslaagd; geen commit, push of deployment.

## Actuele update 2026-08-03: managerstartacties en teamscope

Lokaal geïmplementeerd: de manager-/HR-startpagina toont een uitbreidbare quick-action-rij voor Mijn gegevens, Mijn team en Nieuw ziektegeval; op kleine schermen worden alleen iconen getoond. De managerteamscope is beschikbaar via `scope=team`, wordt uitsluitend voor `DIRECT_MANAGER` aangeboden en gebruikt actieve directe rapportagelijnen. De startpaginafilters voor teamcijfers, afwezigheden, verlof en gebeurtenissen en de medewerkerslijst gebruiken dezelfde server-side scope. De ziekmeldingsroute hergebruikt `AbsenceQuickForm` en autoriseert de medewerkerkeuze via de bestaande service.

Geen nieuwe schemawijziging of remote write voor deze slice. Lokaal geslaagd: strict typecheck, ESLint, i18n-pariteit, gerichte tests (3 bestanden, 10 tests), productiebuild en `git diff --check`. De geauthenticeerde manager-browsercontrole bevestigde de drie snelacties, de teamscope (13 actieve medewerkers binnen 22 directe teamtoewijzingen), de teamgerichte startpagina en de mobiele icon-only weergave op 390px.

## Actuele update 2026-08-03: rolgebonden werkruimtes en medewerkerlanding

De autorisatie-defaults zijn dynamisch aan canonieke rechten gekoppeld. `EMPLOYEE` krijgt `employee-directory:read` en geen `start-page:read`, `dashboard:read` of `workforce:read`; `DIRECT_MANAGER` en `TENANT_ADMIN` krijgen deze drie werkruimterechten. De bestaande HR Admin-override in de demo-tenant is bijgewerkt. De medewerkerlijst accepteert nu ook het directoryrecht via een authenticated-only, permission-checked RPC. De dashboardlayout, Start-, Dashboard- en Workforce-routes volgen dezelfde server-side rechten; medewerkers landen vanuit `/dashboard/start` op hun eigen medewerkerpagina, managers en HR Admin op Start.

Remote bewijs: migraties `20260803192309_role_based_workspace_permissions` en `20260803192414_restrict_employee_overview_rpc` zijn toegepast op `wnpfloqpjvaacobppbpk`; de effectieve rechten van de drie demo-fixtureaccounts zijn gecontroleerd. Lokale verificatie: strict typecheck, gerichte ESLint en 10/10 gerichte tests geslaagd. De security-advisorwaarschuwing voor de directory-SECURITY-DEFINER is bewust en wordt door de functie zelf tenant- en permission-checked. Authenticated browserbewijs voor deze nieuwe landing/menucombinatie blijft open door het ontbreken van beschikbare fixturecredentials in deze runtime.

## Actuele update 2026-08-03: productiehotfix testrolwisselaar

De Vercel-flag `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED` werd niet uit `process.env` gelezen door de dashboardlayout; daardoor bleef de testrolwisselaar in Production verborgen ondanks een correcte Vercel-variabele en redeploy. De helper leest de runtimeflag nu server-side uit en normaliseert de waarde. Versie `1.20260803.4` bevat een regressietest voor de runtimeflag en voor hoofdletters/spaties. Lokaal geslaagd: 125 testbestanden/459 tests, strict typecheck, ESLint, i18n-pariteit en productiebuild met 163 pagina's. GitHub `e8a008c` en Vercel Production `dpl_Fu1T5z3F9P21JdnsMcynaEgfi556` staan op `READY`.

## Actuele update 2026-08-03: doorlopende beoordeling remote en testklaar

De Continuous Appraisal-slice is remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`: tenant-owned timeline, RLS/permissions, audit, FK-indexen en private screenshot-/bijlagenopslag. De services/API ondersteunen upload, metadata-RLS en signed downloads; de UI toont bijlagen op de timeline en biedt upload voor toekomstige items. De routes zijn `/my-appraisal`, `/workforce/continuous-appraisal` en de startpagina-samenvatting/link.

Remote contracttest slaagt. Security-advisor meldt geen nieuwe Continuous Appraisal-securitybevinding; performance-advisor meldt geen nieuwe unindexed-FK-bevinding. De kleine remote testdataset bevat 9 items, 3 reacties en 1 attachment. Authenticated browsercontrole heeft de drie fixtureaccounts doorlopen; de finale managercontrole toonde Noahs 8 items, `screen-4.png` en de download als `image/png`. Lokale verificatie: 125 testbestanden/458 tests, i18n-pariteit met 28 namespaces, strict typecheck en productiebuild met 163 pagina’s geslaagd. De slice is gepubliceerd in GitHub-commit `d91c554`; Vercel Production staat op `READY`.

## Actuele update 2026-08-03: testrolwissel voor fixtureaccounts

De lokale/testomgeving heeft in de ingelogde sidebar een allowlisted testrolwisselaar voor Edwin, de test-HR-admin, testmanager en testmedewerker. De server voert volledige logout/login uit via een eenmalige Supabase Auth magic-link-handoff zonder wachtwoord in de browser. De functie staat lokaal/test aan en productie uit tenzij `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED=true` expliciet wordt gezet. De vier vaste accounts kunnen onderling wisselen zodat een volledige testcyclus kan worden herhaald.

Verificatie: 125 hr-suite-testbestanden/458 tests, strict typecheck, ESLint, i18n-pariteit met 28 namespaces, productiebuild met 163 pagina's en een lokale browsercyclus HR Admin -> Manager -> Medewerker -> Edwin zijn geslaagd. Geen schemawijziging of remote write in deze testrolwisselslice; de code is gepubliceerd in GitHub-commit `d91c554` en Vercel Production staat op `READY`.

## Actuele update 2026-08-03: doorlopende beoordeling lokaal toegevoegd

De lokale verticale slice voor doorlopende beoordeling bevat de tenant-owned timeline, permissions/RLS, audit, managerwissel-systeemevent, services/API, `/my-appraisal`, `/workforce/continuous-appraisal`, startpagina-samenvatting en NL/EN i18n. De database voorkomt verwijderen, vergrendelt historische inhoud en begrenst reacties op 100 tekens. De nieuwe migration `20260803133000_continuous_appraisal_timeline.sql` is nog niet remote toegepast; daardoor zijn remote contractcontrole, advisors, echte testdata en authenticated browsergate nog open. Geen remote write, commit, push of deployment uitgevoerd.

## Actuele update 2026-08-03: Workforce 9-grid-vlootschouw remote toegepast

De nieuwe requirements en het besluit staan in `docs/requirements/Talent/09-LiquidHR-Vlootschouw-9-grid-Requirements.md` en `docs/decisions/FDR-0004-talent-vlootschouw-9-grid-campagnes-en-reminders.md`. De tenant-owned campagnetabellen met RLS/policies/audit, de `talent-review:*` permissions, campaign-start met teamsnapshot, 7-dagen-/korte-campagnereminders, managerstatus, HR-reminderactie, manager-drag-and-drop, scorehistorie en de role-aware route `/workforce/9-grid` zijn gebouwd en remote toegepast. De slice gebruikt bestaande employee-scope- en reminderpatronen; er is geen fake seeddata toegevoegd.

De self-scope is extra afgedwongen. Een medewerker zonder review-permission kan geen route, campagne of scorefunctionaliteit starten. Ook een Manager kan zichzelf nooit als reviewsubject zien of scoren, ook niet bij een zelfverwijzende `direct_manager_id`; de grens zit in de campaign-start-query, databaseconstraints, RLS, service en UI.

Remote contractproef geslaagd voor vier RLS-tabellen, authenticated-only table/RPC-grants, lifecycle-RPC's, self-scope constraints en RLS-policytekst. Security-advisor: geen nieuwe 9-grid-bevinding. Performance-advisor: geen nieuwe 9-grid unindexed-FK-bevinding; ongebruikte nieuwe indexen blijven als verwachte INFO zichtbaar zolang er nog geen campagnegegevens zijn. De officiële DB-types zijn via Supabase MCP opnieuw gegenereerd. De authenticated browsergate is met de drie fixtureaccounts geslaagd: HR-admin en manager openen `/workforce/9-grid`, medewerker wordt naar `/geen-toegang` gestuurd en krijgt geen 9-grid-heading of functionaliteit, review-API's geven voor manager/medewerker `403`, en de volledige Talent-gate rapporteert 0 axe-violations. Er blijft 1 axe-`incomplete` color-contrast-check op de select voor vorige campagne. De slice is opgenomen in GitHub-commit `d91c554`; Vercel Production staat op `READY`.

## Uitgebreide Talent Management-testhandleiding 2026-08-03

Een afzonderlijk Markdown-testdocument is toegevoegd: `docs/delivery/TALENT_MANAGEMENT_FUNCTIONAL_TEST_GUIDE_20260803.md`. Dit document is de praktische testbasis voor de drie fixtureaccounts en beschrijft wat HR Admin, manager en medewerker mogen openen, zien, instellen en niet mogen zien, inclusief de verwachte demo-seeddata, dashboards, periodefilters, check-ins, Role Explorer, negatieve autorisatiechecks en performancecontrole. Wachtwoorden en tokens zijn bewust uitgesloten. Geen databasewijziging, deployment of seedreset uitgevoerd.

## Performance- en Talent Management-update 2026-08-03

De HR-adminpagina `/settings/talent` is start-first gemaakt: de eerste load haalt geen Talent-fundament, functieprofielen of persoonlijke capabilityregistraties meer op. Elke sectie wordt exclusief geopend via één accordion, laadt op dat moment via de bestaande geautoriseerde API's en hergebruikt geladen data bij opnieuw openen. De losse Talent-navigatie staat nu binnen Start. De naamgeving onderscheidt `Talent Management`, `Functieprofielen - gekoppeld aan het functiehuis` en `Bestaande functie` van het bestaande beheer van `Functies en functiegroepen`; beheeracties in het fundament staan binnen de accordion.

De capability-record read gebruikt alleen benodigde kolommen en tenantfilters voor referentiequeries. Geen schemawijziging, remote write, commit of deployment. Checks: 447 hr-suite-tests + 7 control-tests, lint, i18n en productiebuild (156 pagina's) geslaagd. Productie-smoke: `/login` 200; beveiligde representatieve hoofd-routes 307 naar login met circa 5-28 ms guardtijd. Geauthenticeerde accordion-/rolcontrole blijft open wegens ontbrekende lokale fixturecredentials. Losse `type-check` blijft falen op bestaande `apps/hr-suite/lib/weather/open-meteo.ts:102`; de productiebuild heeft de nieuwe code wel succesvol gecompileerd en door TypeScript verwerkt.

## UI-update 2026-08-03: werkweer op landing-header

De startpagina koppelt de actuele werkcontext aan een server-side Open-Meteo-forecast. Een toegewezen actieve bedrijfslocatie gaat voor het bedrijfsadres; zonder vindbare werklocatie gebruikt de kaart Amsterdam als vaste fallback. De kaart toont de actuele temperatuur met daaronder klein de maximale temperatuur van vandaag (`temperature_2m_max`), circa 25% kleinere luchtvochtigheidscijfers, luchtdrukbalk en trendpijl, plus een windrichtingcirkel met Nederlandse kompasrichtingen; onderaan staat uitsluitend de volledige stadnaam. De kantoorlocatie is standaard geselecteerd. Via de compacte kantoor/thuis-iconen kan een medewerker wisselen naar het weer van de actuele primaire thuislocatie; alleen stad en land worden server-side uit `employee_addresses` gebruikt. Zonder gekoppelde thuislocatie blijft die keuze uitgeschakeld. De begroeting is eveneens verkleind. Onder de begroeting verschijnen server-side conditioneel de dagen tot het volgende goedgekeurde persoonlijke verlof en de eerstvolgende actieve feestdag; ontbrekende verlofdata wordt niet getoond. Onder de headerdrempel wordt de kaart verborgen in plaats van onder de begroeting te stapelen. Geen commit, push of deployment.

## UI-update 2026-08-03: accountmenu typografie en versieregel

Het ingelogde accountmenu in de sidebar heeft gelijke standaardtypografie voor persoonlijke instellingen en uitloggen. De actieve appversie staat daaronder als gewone, niet-klikbare informatieregel. Gerichte browsercontrole bevestigt `Versie 1.20260803.3`; geen schema/API-wijziging.

## UI-update 2026-08-03: ingeklapte sidebar-controls uitgelijnd

De ingeklapte desktop-sidebar gebruikt voor alle icon-controls dezelfde 44px hit-area en centrering: collapse, navigatie, productupdates, reminders, persoonlijke instellingen en uitloggen. Browsercontrole op 80px sidebarbreedte bevestigt dezelfde x-positie, breedte en hoogte voor de controls. Geen schema/API-wijziging.

## Besluitupdate 2026-08-03

Provider snapshot/restore is op verzoek uitgesloten en is geen actief releasepunt. LMS/P3.6 wordt niet gebouwd zonder nieuw productbesluit; P3.3 en P3.5 blijven `GEPARKEERD`; P4-P6 zijn niet uitgevoerd. De gerichte Supabase-timeout is aangepakt met nieuwe Talent-scope-indexen, RLS-short-circuiting en lazy rapportopties. `TALENT-NEXT-01` is gebouwd met drie rolroutes, spiderweb plus toegankelijke tabel en browserbewijs voor medewerker, manager en HR-admin op poort 3000. Oudere historische regels hieronder kunnen nog eerdere openpunten noemen; deze update is leidend.

## UI-update 2026-08-03: app-brede controlbasis en gedeelde dropdownset

De gedeelde controlbasis in `apps/hr-suite/app/globals.css` behandelt native selects, multi-selects, `.form-field`/`.input`-velden en gedeelde primaire/secundaire knoppen consistent. Selects hebben theme-based chevrons, vaste maatvoering en focus/hover-states; primaire knoplabels blijven op één regel en hebben duidelijker contrast. De Talent-capabilityfilters gebruiken aanvullend zichtbare micro-labels en korte waarden. De nieuwe `components/ui/dropdown-select.tsx` levert daarnaast één zoekbare, toegankelijke single-select voor CountryPicker, administratie, Talent, Insights, employee-landen/talen en organisatie-rolkeuzes; bestaande complexe multi-selects gebruiken dezelfde gedeelde trigger/menu/optie-styling.

Verificatie na de uitbreiding: strict typecheck, gerichte ESLint, `git diff --check` en geauthenticeerde Talent-browsercontrole met openen, kiezen, sluiten en Escape zijn geslaagd. De volledige testsuite en productiebuild worden nog als afsluitende controle uitgevoerd. Geen schema/API-wijziging, commit, push of deployment.

## Actuele update 2026-08-03: P3 functioneel gesloten en rolgetest

P3.0, P3.1, P3.2 en P3.4 zijn uitgevoerd in de lokale/testfase. Er zijn twee nieuwe tenant-owned tabellen toegevoegd met RLS, policies, audittriggers en authenticated-only RPC-grant: `talent_notifications` voor minimale opvolgmeldingen en `talent_goal_check_ins` voor gescheiden medewerkerreflecties, managerobservaties en vervolgacties. De service- en API-laag ondersteunt lijst/lezen, statusupdates, check-in CRUD, versioning en veilige scopecontrole. De Talent-doelpagina's tonen check-ins voor self, manager en HR; de rapportage heeft periodefilters die ook in CSV-export/audit worden meegenomen.

Remote seeddata bevat voor `employee.fixture` drie capabilityregistraties (historisch, actueel en toekomstig), drie ontwikkeldoelen (historisch, actueel en toekomstig), een employee-reflection, manager-observation en follow-up, plus vijf deduplicerende notificaties verdeeld over medewerker en manager. In de Codex-browser op poort 3000 zijn de drie rollen opnieuw gecontroleerd: employee ziet eigen Talent, meldingen en reflecties en ontvangt `/geen-toegang` op Workforce/HR; manager ziet directe teamscope, drie eigen meldingen en doelen/check-ins; HR Admin ziet tenantbrede meldingen, doelen/check-ins en rapportage.

Verificatie deze slice: 120 testbestanden/446 tests, strict typecheck, ESLint zonder warnings, i18n-pariteit (26 namespaces), productiebuild (152 pagina's), remote contractproef voor tabellen/RLS/indexen/RPC, security/performance advisors na DDL en browserrolgate. De interactieve HR-periodefilter en CSV-export zijn in de Codex-browser bevestigd; de medewerkerlanding gebruikt `/dashboard/start` en directe `/departments` gaat naar `/geen-toegang`. De gerichte Talent-timeout is aangepakt met nieuwe scope-indexen, RLS-short-circuiting en lazy rapportopties. `TALENT-NEXT-01` is als spiderwebslice gebouwd en met medewerker, manager en HR-admin in de Codex-browser op poort 3000 gecontroleerd. De bestaande projectbrede advisor-meldingen blijven los van deze slice. P3.3 evidence/documentkoppeling en P3.5 delegatie zijn `GEPARKEERD`; LMS/P3.6 wordt niet gebouwd zonder nieuw besluit. P4-P6 zijn niet uitgevoerd. Provider snapshot/restore is op verzoek uitgesloten; de thematische axe-`incomplete`, eventuele manager-/medewerker filter/CSV-herhaling en formele release-eigenaarsacceptatie blijven als releasebesluiten zichtbaar. Geen deploy, commit of push uitgevoerd.

## Actuele update 2026-08-02: stap 1 alleen-lezen supportmodus

Stap 1 van de supportfunctie is uitgevoerd. Een actieve `OWNER`/`OPERATOR` kan vanuit klantdetails een tijdelijke supportsessie starten met verplichte reden en 15, 30 of 60 minuten duur. De route opent `/support` in de HR-app op poort 3000, toont een blijvende alleen-lezenbanner en maakt het operatoraccount zichtbaar. De read-only projectie bevat klantmodel, administraties, tellingen van medewerkers/actieve dienstverbanden en maximaal 100 medewerkerprofielen; alle mutaties en klantacties zijn buiten scope.

De Supabase-migraties `20260802234000_add_platform_support_sessions.sql` en `20260802242000_close_expired_platform_support_sessions.sql` zijn remote toegepast. De sessie wordt via HttpOnly-cookie doorgegeven, nooit als URL-token; de database controleert actieve platformrol, actieve tenant, duur, eigenaar van de sessie en vervaldatum. Verlopen sessies worden automatisch beëindigd bij een nieuwe start en ook die beëindiging wordt geaudit. De directe sessietabel heeft RLS zonder authenticated/anon table-read; alleen de beperkte RPC-wrappers zijn uitvoerbaar.

Verificatie: control/HR strict typecheck, ESLint, i18n-pariteit, 7 controltests en beide productiebuilds geslaagd. De remote contractcontrole voor tabel, RLS, wrappers en grants is geslaagd. De browserflow is geblokkeerd op de bestaande niet-platformbeheerder-sessie in de Codex-browser; hiervoor moet handmatig met de geregistreerde OWNER/OPERATOR worden ingelogd. Geen deploy, commit of push uitgevoerd.

## Actuele status 2026-08-02: M2 functioneel afgerond in testfase

M2.0 t/m M2.8 zijn geïmplementeerd en getest. M2.7 bevat tenant-owned ontwikkeldoelen met self-/manager-/HR-scope, statusmachine, versioning en audit. M2.8 bevat read-only rapportage en CSV-export met rolallowlist, scopefilters en `EXPORT`-audit. M2.6 is end-to-end bewezen met `PREVIEW -> COMMITTED -> ROLLED_BACK`; rollback archiveert het aangemaakte record en behoudt auditdata. De importpreview weigert nu ook database-incompatibele evidence/certificate-metadata vóór commit.

Rolbewijs: HR Admin tenantbreed; manager directe medewerkersscope; medewerker self-bound. HR Admin kan importeren en terugdraaien; manager en medewerker worden server-side naar `Nog geen toegang` gestuurd voor `/settings/talent/import`. De demo-tenantseed beperkt de extra importrechten tot `TENANT_ADMIN`; er is geen manager- of medewerker-writepad geopend.

Checks: 119 testbestanden/442 tests, gerichte importtests 6/6, strict typecheck, ESLint zonder warnings, i18n-pariteit (26 namespaces), productiebuild (151 pagina's), `git diff --check`, remote comparison/import- en goals/reporting-contracten slagen. De veilige grote-datasetproef gebruikte tijdelijke tabellen met 20.000 synthetische rijen en draaide volledig terug; de zwaarste importselectie bleef op 7,545 ms. De drie-rollen axe/keyboard-herhaling slaagde met 0 violations. De medewerkerlanding is hersteld: `/login` gaat naar `/dashboard/start` en directe `/departments` gaat naar `/geen-toegang`. Alleen provider snapshot/restore blijft formeel open; detailbewijs staat in `docs/delivery/TALENT_M2_RELEASE_HARDENING_20260802.md`. Geen commit, push of deployment.

## Actuele hardeningcontrole 2026-08-02

De drie fixtures zijn opnieuw gebruikt in de lokale Codex-browser op poort 3000. HR Admin, manager en medewerker behouden hun eigen Talentroutes en server-side denies; manager-scope, cross-tenant-denies, self-bound gedrag en negatieve mutaties zijn geslaagd. Keyboard-focus is op alle vier toegestane routes vastgesteld en axe rapporteert 0 echte violations. Eén kleurcontrole blijft technisch `incomplete` door het themed/gedeelde oppervlak, maar is handmatig gecontroleerd zonder vastgestelde contrastfout. De performance-baseline en applicatieve importrollback zijn gesloten. Een echte provider-database snapshot/restore is bewust niet uitgevoerd zonder expliciete toestemming voor een tijdelijke Supabase-branch van $0,01344 per uur.

## Actuele update 2026-08-02: LiquidHR Control-login

De afzonderlijke control-app op poort 3001 ondersteunt nu naast wachtwoordlogin ook Google OAuth via `/auth/callback`. De bestaande actieve `OWNER`-registratie van Edwin blijft de autorisatiegrens; een geldige Google-login alleen geeft geen platformbeheerrechten. De knop op `/geen-toegang` gebruikt nu leesbaar contrast.

Verificatie: control strict typecheck, ESLint, 7 tests, i18n-pariteit (121 sleutels) en productiebuild geslaagd. De ingelogde Codex-browser toonde het control-dashboard met 2 klanten, 72 medewerkers en 91,7 KB opslag. De knop en klantenteller hebben nu duidelijk contrast; dashboardcopy legt uit dat klantdetails geen impersonatie zijn, dat de technische naam de zoekterm is en wat onder recente platformactiviteiten verschijnt. Handmatig resterend: registreer `http://localhost:3001/auth/callback` onder Supabase Auth → URL Configuration → Redirect URLs.

## Actuele update 2026-08-02: M2.5/M2.6 drie-fixture-gate

De lokale `.env.talent-auth.local`-fixtures zijn gebruikt in de Codex-browser. HR Admin: vergelijking en ongeldige/geldige importpreview geslaagd. Manager: `/workforce/talent/comparison` toegankelijk met scope 22 en twee functieprofielen; HR-instellingen/import geweigerd. Employee: `/my-talent` en eigen capabilitylijst zichtbaar; vergelijking/import geweigerd. De employee-landingsroute `/departments` heeft nog een bestaande onvoldoende-rechten-serverfout.

De importcommit blijft door bestaande tenant-specifieke RLS geblokkeerd omdat `TENANT_ADMIN` daar `talent-record:write` mist. De noodzakelijke autorisatie-uitbreiding is niet toegepast. Importaudittriggers zijn gehard en `20260802232000_talent_capability_fk_indexes` is remote toegepast. Geen nieuwe M2.5/M2.6-securitylint; Talent foreign-key-advisorregels zijn opgelost.

Verificatie: 116 hr-suite-testbestanden/434 tests, control 2/7 tests, lint, i18n en `git diff --check` slagen. Typecheck en productiebuild stoppen op drie bestaande fouten buiten deze slice in `apps/hr-suite/lib/employees/employee-service.ts:316` en `apps/hr-suite/lib/employment/employment-detail-service.ts:362/369`.

## Laatste verificatie 2026-08-02: M2.5 vergelijking en M2.6 import

M2.5 en M2.6 zijn in de testfase end-to-end aangesloten volgens schema → RLS/grants → service/API → UI. M2.5 biedt HR Admin en managers een gescopeerde vergelijking van actieve functieprofielversies met individuele uitkomsten `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`, zonder totaalscore en zonder bronrecord-ID voor niet-vrijgegeven gegevens. M2.6 biedt HR Admin een immutable CSV-preview, expliciete idempotente commit en batchspecifieke rollback; nieuwe geïmporteerde capabilityrecords blijven `DRAFT`.

Remote toegepast: `20260802220000_talent_comparison_and_import` en `20260802223000_talent_import_policy_indexes`. Het remote contract `apps/hr-suite/supabase/tests/talent_comparison_and_import_contract.sql` slaagt. Gerichte schema-tests en strict typecheck slagen. Security-advisors tonen geen nieuwe lint voor deze slice; performance toont nog uitsluitend kleine-dataset `unused_index`-meldingen voor importindexen. De nieuwe drie-fixture-browserherhaling en echte HR-rollbacktest zijn open door ontbrekende lokale fixturecredentials; de eerdere drie-rollen-gate blijft referentiebewijs. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: M2.3 assessments en M2.4 Team Talent

M2.3 self-/manager-assessments en M2.4 Team Talent/Skills Matrix zijn end-to-end toegevoegd. De migration `20260802210000_talent_assessments_and_team_matrix` bevat tenant-owned cycli, onderdelen, responses, antwoorden en managernotities met composite tenant-FK's, status-/datum-/versieguards, auditmetadata, per-actie-RLS en authenticated-only Data API-grants. HR beheert cycli en finale status; medewerkers schrijven alleen eigen self-assessments; managers schrijven alleen de actuele directe scope; managernotities zijn niet zichtbaar voor medewerkers. De medewerker ziet manageruitkomsten pas na `FINALIZED`.

De API/service gebruikt allowlisted DTO's en batchqueries. De nieuwe assessmentpagina's ondersteunen cyclusbeheer, antwoorden, concept opslaan/submitten, HR lock/finalize/reopen en afgeschermde notities. Team Talent toont HR tenantbreed en managers hun directe team; de matrix toont individuele capabilitystatus/bron/geldigheid/evidence-status zonder scores of aggregaten. De nieuwe contractproef en gerichte schema-tests slagen.

Verificatie: 114 testbestanden/428 tests, strict typecheck, lint, i18n (25 namespaces), productiebuild (136 pagina's) en `git diff --check` slagen. Remote RLS/grants/policycontrole is groen; advisors tonen alleen bestaande projectbrede meldingen en kleine-dataset ongebruikte-indexmeldingen. De browser op poort 3000 is actief, maar de huidige sessie heeft geen gekoppelde klantomgeving; authenticated drie-rollenbewijs voor deze nieuwe pagina's blijft daarom open totdat de bestaande fixturesessie opnieuw in de juiste tenant is ingelogd. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: M2.2 HR-kwalificaties

M2.2 is end-to-end toegevoegd bovenop de tenant-owned `talent_employee_capability_records`. HR kan certificaten beheren met uitgever, code, geldigheidsduur, permanentie, verlengingsplicht, evidence-status en een server-side vastgelegde verantwoordelijke. De migratie bevat datum-, evidence- en HR/tenant-guards, actieve duplicaatpreventie op certificaatcode, een verantwoordelijke-index en behoud van de bestaande RLS/grants/auditgrens. De service/API gebruikt allowlisted DTO's en geeft alleen `qualificationResponsibleAssigned` terug; bewijsinhoud en ruwe verantwoordelijke-ID's worden niet blootgesteld.

De HR UI bevat zoeken op uitgever/code, bijna-verlopen binnen 30 dagen, evidence-status en archiveren met impactinformatie zonder stille historische verwijdering. De remote M2.2-contractproef slaagt. Typecheck, lint, i18n, 112 testbestanden/421 tests, productiebuild en `git diff --check` zijn geslaagd. De browsercontrole op poort 3000 bevestigde de anonieme redirect van `/settings/talent`, `/workforce/talent` en `/my-talent`; de eerder geslaagde drie-rollen-gate blijft referentiebewijs voor de toegangsgrenzen. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: M2.1 capabilityregistraties

M2.1 is als eerste uitvoerbare fase-2-slice end-to-end geïmplementeerd volgens schema → RLS/grants → API/service → UI. `talent_employee_capability_records` is tenant-owned en bevat typegebonden waarden, herkomst, geldigheid, status, evidence-reference, versie/concurrency en audit. Databaseconstraints blokkeren verkeerde capabilitywaarden, ongeldige datums en foreign-tenant/document-scope. RLS beperkt HR tenantbreed, managers tot bestaande medewerkersscope en medewerkers tot eigen `SELF_ENTERED` `DRAFT`-records. De Data API-grants zijn beperkt tot authenticated SELECT/INSERT/UPDATE; anon/public zijn uitgesloten.

De vier nieuwe permissions zijn seeded en server-side gebruikt. `/settings/talent` biedt HR-beheer; `/workforce/talent` een manager read-only lijst; `/my-talent` een self-bound lijst met modal voor eigen conceptregistraties. Responses zijn allowlisted en bevatten geen evidence-inhoud of signed URL. Zod accepteert voor deze nieuwe recordinputs de volledige PostgreSQL UUID-stringvorm, zodat bestaande fixture-ID’s niet onterecht door RFC-variantcontrole worden afgewezen.

Verificatie: remote contractproef geslaagd; 112 testbestanden/419 tests, strict typecheck, lint, i18n, productiebuild en `git diff --check` geslaagd. Browser: employee maakte een BHV-record aan; dit verscheen als Concept, Zelf ingevoerd en zonder bewijsinhoud. De bestaande HR-/manager-/employee-routegate blijft het referentiebewijs voor de drie rollen; formele release blijft open voor representatieve performance, rollback/snapshot en de bestaande projectbrede advisorwaarschuwingen. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: M2.0 security en drie rollen

De eerste M2.0-uitvoering is afgerond binnen de afgesproken grens: contractdocumenten, traceability en de SQL-contractproef zijn toegevoegd; er zijn geen fase-2-tabellen, API-routes, UI-flow, seed of generated DB types gebouwd. De beperkte securitycorrectie `apps/hr-suite/supabase/migrations/20260802173000_harden_audit_log_data_api_grants.sql` is remote toegepast als `20260802131815_harden_audit_log_data_api_grants`. Live controle bevestigt voor `public.audit_logs` alleen `authenticated: SELECT`; `anon` en `public` hebben geen tabelgrants. De remote M2.0-contractproef slaagt volledig. Omdat uitsluitend grants/RLS-beleid is gewijzigd, was regeneratie van `packages/db/types.ts` niet nodig.

De interne Codex-browser op `http://localhost:3000` controleerde drie rollen. HR Admin opent `/settings/talent` en `/workforce/talent`; manager opent alleen `/workforce/talent`; employee opent alleen `/my-talent`. Verboden settings/workforce-routes tonen `Nog geen toegang`. De employee-landingsroute `/departments` geeft na login een bestaande onvoldoende-rechten-serverfout, terwijl directe `/my-talent` werkt; dit blijft een open routing/UX-punt buiten M2.0. Advisorcontrole blijft niet leeg: projectbrede bestaande meldingen over `SECURITY DEFINER`, gelekte-wachtwoordbescherming en RLS/permissies moeten later afzonderlijk worden beoordeeld. Geen commit, push of deployment.

## Laatste verificatie 2026-08-02: Talent rol-gate en fase 2

De volledige Talent-gate is opnieuw uitgevoerd met HR Admin, manager en medewerker: 3 rollen, 4 toegestane routes, correcte route-/mutatie-/cross-tenant-denies, manager-scopecontrole, medewerker-self-bound controle en 0 echte axe-violations. De technische `color-contrast`-checks zijn handmatig beoordeeld zonder vastgestelde Talent-contrastfout; gedeelde product-updatebanner-doelen blijven als axe `incomplete` traceerbaar. Strict typecheck, i18n, lint, 112 testbestanden/418 tests, productiebuild, de vier remote Talent-contractproeven en `git diff --check` zijn geslaagd. Formele productie-release blijft beperkt open voor representatieve grote-dataset-performance en restore/rollback. Het zelfstandige uitvoeringsplan voor fase 2 staat in `docs/requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md`.

## M2.0 gestart 2026-08-02: contracten en gegevensbescherming

M2.0 is gestart als ontwerp- en baselinecontrole vóór M2.1. ADR-0007, FDR-0003, de M2.0-contractspecificatie en de traceabilitymatrix leggen rolmatrix, dataclassificatie, status/provenance/evidence, audit, permissions en het logische schema vast. De SQL-baselineproef staat in `apps/hr-suite/supabase/tests/talent_phase2_m2_0_contract.sql` en bewaakt dat fase-2-tabellen en permissions niet vóór review ontstaan. De read-only remote controle toont dat de vier bestaande fase-1-Talentpermissions aanwezig zijn en dat fase-2-permissions/-tabellen nog ontbreken. De proef is geblokkeerd door bestaande brede `anon`-tabelgrants op `public.audit_logs`; er is geen remote wijziging uitgevoerd. M2.1, UI, API, migration, seed en typesgeneratie blijven geblokkeerd tot M2.0 is reviewed.

## Update 2026-08-02: Talent stap 9 — hardening en functiecontrole

Stap 9 is de laatste milestone van het opgeslagen Talent-implementatieplan. De remote hardeningmigratie `20260802150000_harden_talent_job_catalog_audit` voegt audittriggers toe aan de tenant-owned functiehuistabellen `jobs`, `job_groups`, `job_revisions` en `job_group_jobs`. De nieuwe release-contractproef `apps/hr-suite/supabase/tests/talent_m9_release_contract.sql` slaagt: 13 relevante tabellen hebben RLS, de self-RPC's zijn niet beschikbaar voor `anon`, en de verwachte Talent-indexen en audittriggers bestaan. De remote profielquery is met `EXPLAIN` gecontroleerd; de service leest requirements, capabilities en levels in batches.

De reproduceerbare geauthenticeerde gate staat in `apps/hr-suite/scripts/talent-release-gate.mjs` en is beschikbaar als `audit:talent-release`. De drie lokale Auth Admin-fixtures zijn met de server-side helper van wachtwoorden voorzien. De gate is daarna succesvol uitgevoerd met drie geïsoleerde sessies: 3 rollen, 4 toegestane routes, correcte denies voor HR Admin/manager/medewerker, 403/404 cross-tenant-denies, manager-scopecontrole, self-bound medewerkercontrole en 0 axe-violations. Drie `color-contrast`-controles blijven `incomplete` voor handmatige beoordeling. De cross-tenant capability-fixture is als niet-productieve remote testdata toegevoegd via `20260802160000_seed_talent_cross_tenant_release_fixture.sql`. Open voor formele release blijven de contrastbeoordeling, representatieve grote-dataset-baseline en rollback/snapshot-oefening. De functie-inventaris en volledige rol-/uitbreidingslijst staan in `docs/requirements/Talent/analysis/talent-phase1-function-inventory-and-m9-gate-20260802.md`.

## Supabase advisor-status 2026-08-02

Security- en performance-advisors zijn opnieuw uitgevoerd. Ze geven projectbrede bestaande `WARN`/`INFO`-meldingen terug, waaronder bewust aangeroepen authenticated `SECURITY DEFINER`-RPC's, uitgeschakelde gelekte-wachtwoordbescherming en bestaande permissive-policy-/RLS-meldingen. De Talent-contractproef bevestigt dat `anon` de self-RPC's niet kan uitvoeren; advisor-output is dus niet volledig leeg en blijft onderdeel van de formele releasebeoordeling.

## Update 2026-08-02: Talent stappen 7 en 8, read-only Workforce en Mijn Talent

Stap 7 en 8 zijn volgens schema -> API -> UI geïmplementeerd. `/workforce/talent` is lijst-eerst en doorzoekbaar: HR Admin ziet actieve tenantprofielen; een direct manager krijgt alleen actuele profielen uit de eigen directe medewerkersscope. `/my-talent` is self-bound en read-only: de actuele primaire functie, organisatiecontext, senioriteit, profielinhoud en capabilityvereisten komen uit beveiligde serverqueries/RPC's. Ontbrekende context levert een neutrale lege toestand op. Er is bewust geen score-, match-, voortgangs-, ontwikkel- of mutatiefunctionaliteit toegevoegd.

Remote is `20260802123000_complete_talent_read_models` toegepast. De migratie koppelt de drie demo-fixtures aan `TEST-MANAGER`, `TEST-PLANNER` en `TEST-CUSTOMER`, verscherpt actuele datumvensters in Talent- en job-readpolicies en voegt de self-requirements-RPC toe. Beide self-RPC's zijn `SECURITY DEFINER` met `search_path=''`, alleen `authenticated` kan ze uitvoeren, en de readmodel-view is `security_invoker=true`. De nieuwe contractproef `apps/hr-suite/supabase/tests/talent_read_models_completion.sql` is remote geslaagd.

Checks: `type-check`, `lint`, `check:i18n`, `test` (112/418), `build` en `git diff --check` zijn groen. De HR-adminsessie is lokaal op poort 3000 gecontroleerd voor instellingen, tenantbrede Workforce-profielen, vier capabilityvereisten en exclusieve accordionstatus. Open release-gatepunt: aparte manager-/medewerker-browserlogins en een volledige geauthenticeerde axe-run voor alle rolroutes; de repository bevat geen fixturewachtwoorden en er is niets geraden. De Supabase-advisors tonen alleen projectbrede bestaande meldingen plus de bewust geauthenticeerde SECURITY DEFINER-self-RPC-waarschuwingen. Geen deploy, push of commit.

## Update 2026-08-02: Talent stappen 5 en 6, authfixtures en axe-gate

De release-gate voor de Talentbasis is aangevuld. In de testadministratie `liquid-hr-demo-holding` zijn drie niet-productieve authfixtures aanwezig: `manager.fixture@liquidhr.test` als `DIRECT_MANAGER` met directe managerscope, `employee.fixture@liquidhr.test` als `EMPLOYEE` met gekoppelde medewerker en `hradmin.fixture@liquidhr.test` als `TENANT_ADMIN` met tenant-scope. De manager kreeg terecht geen toegang tot `/settings/talent`; de HR-admin kon in de geselecteerde demo-administratie het Talentfundament openen.

Stap 5 en 6 zijn uitgevoerd volgens schema -> API -> UI. De remote migratie `apps/hr-suite/supabase/migrations/20260802110000_complete_talent_profiles_and_configuration.sql` voegt version metadata en activatie-informatie toe, normaliseert requirement types, bewaakt één conceptversie en niet-overlappende geldigheidsperioden, valideert type/levelcombinaties en biedt geautoriseerde copy- en activation-RPC's. De API ondersteunt profieloverzicht/detail, versiebeheer en CRUD voor capabilityvereisten. `/settings/talent` toont nu lijst-eerst profielbeheer, versiehistorie, inhoud, requirementbeheer en dashboardtelling; de bestaande HR-admin foundation-accordions blijven exclusief.

De nieuwe geauthenticeerde axe-runner `apps/hr-suite/scripts/axe-audit.mjs` controleerde op poort 3000 zes routes (`/dashboard/start`, `/workforce`, `/employees`, `/settings`, `/settings/talent`, `/workforce/talent`): 6/6 bereikbaar, 0 violations. Drie `incomplete` kleurcontrastcontroles op overlappende of puur decoratieve elementen blijven als handmatige beoordeling geregistreerd; target-size en aria-prohibited findings zijn opgelost. De browsercontrole bevestigde de Talent-editor, de idempotente conceptversie-actie (HTTP 201) en de exclusieve accordion.

Geslaagd: 112 testbestanden/418 tests, ESLint zonder warnings, i18n-pariteit (25 namespaces), strict typecheck, productiebuild (126 pagina's) en `git diff --check`. Supabase RLS staat aan op de drie talent-profieltables; de overlaptrigger en vier talent-RPC/validatiefuncties zijn remote gecontroleerd. Security/performance advisors tonen daarnaast projectbrede bestaande meldingen, waaronder de bewust geautoriseerde SECURITY DEFINER-RPC's, ongebruikte indexen en bestaande permissive-policy-meldingen. Geen deploy, push of commit uitgevoerd.

## Update 2026-08-02: Job Architecture stap 4 en release-gate

Stap 4 is toegevoegd volgens schema -> API -> UI: tenant-owned families/groepen/functies, optionele families en senioriteiten, CRUD/status, impactguards, filters, explorerweergave en een databaseguard voor unieke actieve functie + groep + senioriteit. De bestaande employee-organization-plaatsingen zijn behouden. De nullability-fout in `apps/hr-suite/lib/employees/employee-service.ts:316` is opgelost.

De remote migratiehistorie bevat de Talent-foundation, testcatalogus, hardening, `complete_job_architecture_contract` en `seed_job_architecture_matrix`. `Liquid HR Demo Holding` bevat 6 families, 3 actieve groepen, 7 actieve functies, 1 groep zonder family, 6 functies met senioriteit, 1 functie zonder senioriteit en 68 functieplaatsingen. De contractproef slaagt inclusief orphan/duplicate checks en negatieve duplicate/cross-tenant tests.

De vorige release-gate-notitie hieronder beschrijft de tussenstand vóór de fixtures en axe-audit; de actuele gate-status staat in de update hierboven.

## Historische update 2026-08-02: Talentfundament onder HR-inrichting

Talentfundament staat nu als HR-admin-tegel onder `Instellingen -> HR-inrichting`; de losse zijbalkingang is verwijderd. De bestaande pagina `/settings/talent` en het formulier zijn behouden. De vijf configuratieblokken gebruiken de gedeelde exclusieve `SettingsAccordion`, waarbij maximaal één blok tegelijk openstaat.

De tegel en route zijn begrensd met `talent:manage`. De remote Talent-contractmigratie, de testcatalogus, de hardeningmigratie `20260802063946_harden_talent_remote_contracts` en de remote contractproef zijn uitgevoerd op de testdatabase; de eerdere status hieronder dat remote toepassing nog openstond is daarmee achterhaald. De demo-set bleef behouden: 7 categorieën, 9 tags, 34 capabilities, 92 levelinhouden, 20 tagrelaties, 24 profieleisen, 6 actieve profielversies en 16 functieplaatsingen.

Verificatie voor deze wijziging: authenticated in-app-browsercontrole van `Instellingen -> HR-inrichting -> Talentfundament` en `/settings/talent`, inclusief exclusief sluiten/openen van de harmonica; ESLint en i18n-pariteit geslaagd. Typecheck blijft geblokkeerd door de bestaande nullability-fout in `apps/hr-suite/lib/employees/employee-service.ts:316`. Geen deploy, push of commit uitgevoerd.

## Update 2026-08-02: Talent stappen 1, 2 en 3 lokaal doorgetrokken

De drie afgesproken Talentstappen zijn in de checkout uitgebreid. Ownership/modulegate/permissions/routes zijn aangescherpt; manager-read toont alleen actieve, datumgeldige profielen uit de directe managerscope. Levelmodel en senioriteiten hebben nu beheer-API's, dynamische levelconfiguratie, volgorde/status en usage/lockguards. De capabilitybibliotheek ondersteunt alle vijf capabilitytypen, typebewuste velden, categorieën met typescope, Cloud Tag-relaties via de bestaande `star_performer_tags`, CRUD/status, zoekfilters/paginering, usage counts en dynamische levelinhoud.

De nieuwe lokale migratie is `20260802052246_talent_management_foundation_completion.sql`; de read-only SQL-contractproef staat in `apps/hr-suite/supabase/tests/talent_management_foundation_completion.sql`. Remote toepassing is nog niet uitgevoerd wegens ontbrekende expliciete toestemming voor een remote schemawijziging. Tot die toepassing blijft de nieuwe tagrelatie op de readpagina leeg terugvallen; nieuwe mutation-contracten zijn lokaal typechecked maar nog niet remote uitvoerbaar. De gegenereerde DB-types moeten na toepassing officieel opnieuw worden gegenereerd.

Geslaagd: 112 testbestanden/418 tests, strict typecheck, ESLint zonder fouten, i18n-pariteit (25 namespaces), `git diff --check` en de bestaande productiebuild. In de authenticated Codex-browser is `/settings/talent` gecontroleerd met levels, senioriteiten, categorieën, capabilityfilters, modal en levelinhoud; remote SQL/RLS/advisors en een authenticated mutationmatrix blijven het eerstvolgende handoff-punt. Geen deploy, push of commit uitgevoerd.

## Update 2026-08-01: liquid metallic bannerstijl

De bovenbanner voor productupdates heeft een warme koper/oranje/goudgele liquid-glow gekregen met overlappende radialen, metallic sweep, subtiele diepte en een leesbare hover-link. De kleuren gebruiken bestaande thema-variabelen; lint en strict typecheck zijn geslaagd. De anonieme browserroute redirect correct naar login.

## Update 2026-08-01: verhuizing en verzuimdetail-navigatie

De adresactie voor een nieuw hoofdadres heet nu `Verhuizen`. De lopende verzuimkaart op het medewerkerdashboard opent als klikbare kaart met hand-icoon het bestaande casusdetail met `caseId`. Het casusdetail gebruikt één dossierkop met datum en toont ziekteperioden als compacte, toegankelijke uitklapregels met alle detailvelden in de open toestand.

Verificatie: 112 Vitest-bestanden/415 tests, strict typecheck en i18n-pariteit (25 namespaces) geslaagd. De lokale browsercontrole bevestigde de verhuisactie, casuslink, opgeschoonde kop en periodedetails. Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/React-plugincompatibiliteit.

## Update 2026-08-01: eenmalige banner en login-popup

De dashboardbanner en login-popup worden nu per gebruiker, productupdate en kanaal geregistreerd in `product_update_surface_dismissals`. De banner wordt bij tonen automatisch geregistreerd; de popup heeft een expliciete knop `Gezien` onder de berichten. De nieuwe tabel heeft RLS, self-policies en een remote migratie `20260801105005_product_update_surface_dismissals`.

## Update 2026-08-01: eigenaar- en tenant-scope productupdates

De productupdates-slice ondersteunt nu globale eigenaarberichten (`tenant_id is null`) en tenantberichten. De globale systeemrol `TENANT_ADMIN` krijgt `product-updates:global-write`; tenant HR Admin-overrides krijgen alleen `product-updates:write`. HR Admins kunnen globale berichten lezen maar niet wijzigen of verwijderen. Remote migratie `20260801143000_product_updates_global_owner_scope` is toegepast en twee `[TEST OWNER]`-berichten zijn aangemaakt. Lint, 112/415 tests, i18n-pariteit, strict typecheck en productiebuild met 122 routes zijn geslaagd. Een authenticated browsercontrole blijft open door ontbrekende login-cookie.

## Update 2026-08-01: hoofdadres en tweede tijdelijk adres

De bestaande `employee_addresses`-entiteit is uitgebreid met `address_type` (`PRIMARY`/`SECONDARY`) en een verplichte omschrijving voor tijdelijke adressen. Het laatste hoofdadres blijft server-side verplicht; een nieuw hoofdadres sluit het vorige automatisch af. Tijdelijke adressen hebben een eigen `valid_from`/`valid_until`, mogen naast het hoofdadres lopen en kunnen zonder opvolger worden verwijderd. De UI gebruikt één open harmonica tegelijk en verbergt de einddatum bij het hoofdadres.

Remote migratie: `20260801130000_employee_address_types`; demo-adressen zijn hergebruikt en als hoofdadres gebackfilled. API/service, RLS/audit en gegenereerde DB-types zijn bijgewerkt.

Verificatie: adres- en schema-tests 12/12, strict typecheck groen. ESLint is niet uitvoerbaar door de bestaande ESLint 10/React-plugincompatibiliteit; i18n en geauthenticeerde browsercontrole zijn nog uit te voeren.

## Update 2026-08-01: productupdates en cadeauvenster

Productupdates zijn tenant-eigen toegevoegd met de remote migratie `20260801093124_product_updates` (lokale bron: `apps/hr-suite/supabase/migrations/20260801093124_product_updates.sql`). De tabellen `product_updates` en `product_update_user_state` hebben RLS, gerichte policies, grants, datum-/kanaal-/doelgroepchecks en de beheerpermission `product-updates:write` voor `TENANT_ADMIN`. Database-types zijn opnieuw gegenereerd.

De route `/product-updates` toont actieve updates; de zijbalk heeft een cadeau-icoon met rode teller voor alleen ongeziene `GIFT_WINDOW`-updates. `LOGIN_POPUP` en `TOP_BANNER` worden vanuit de dashboardlayout getoond. `/settings/product-updates` biedt lijst-eerst beheer met zoeken, toevoegen, wijzigen, doelgroep-/kanaal-multiselect en verwijderen. Er zijn vier herhaalbare `[TEST]`-updates in de twee actieve testtenants aangemaakt.

Verificatie: 112 Vitest-bestanden/413 tests, volledige ESLint, strict typecheck, i18n-pariteit (25 namespaces) en productiebuild (122 routes) geslaagd. Remote controle bevestigt beide tabellen met RLS en samen zeven policies. Anonieme browsercontrole van `/product-updates` redirect naar login geslaagd; authenticated browsercontrole blijft open door ontbrekende login-cookie in deze browsercontext.

## Update 2026-08-01: verzuimgeval-detail en lopend verzuim

De verzuimacties volgen nu de casusstatus: een actieve casus toont geen nieuwe ziekmelding, en `(Gedeeltelijk) beter melden` op het dashboard verwijst naar het detail van die lopende casus. De verzuimlijst heeft geen dubbele herstelactie meer; bestaande casuskaarten zijn klikbaar en openen een detailweergave met de aanwezige casus-, periode- en capaciteitsvelden. Alleen in dat detail blijft de bestaande herstelactie met datum beschikbaar. De implementatie hergebruikt de bestaande `listEmployeeAbsence`-service, API's, permissies, RLS en demo-records.

Verificatie: 112 Vitest-bestanden/413 tests, ESLint en i18n-pariteit (25 namespaces) geslaagd. De actuele volledige typecheck wordt geblokkeerd door de bestaande, losstaande fout in `apps/hr-suite/app/(dashboard)/settings/company-data/page.tsx` (ontbrekende `CompanyDataLabels`-sleutels). Poort 3000 antwoordt HTTP 200; de geauthenticeerde browsercontrole bevestigde de actieve demo-casus en het detailpad. Geen database- of dependencywijziging uitgevoerd.

## Update 2026-08-01: enkele scrollbar medewerkerdetail

De `(dashboard)`-shell gebruikt nu een vaste viewportlaag met `overflow-hidden`; de contentkolom behoudt de bestaande interne `overflow-y-auto`. Hiermee is de dubbele scrollbar op medewerkerkaarten opgelost zonder wijzigingen aan medewerkerdata, API's of database. Browsercontrole op poort 3000 toont één scrollbar en de console meldt geen waarschuwingen of fouten. ESLint en strict typecheck zijn geslaagd.

## Update 2026-08-01: medewerkerprofiel-, adres- en reminderfeedback

De medewerkerkaart heeft een doorzoekbare taalkeuze met internationale taal/regio-opties; de actieve status staat direct naast het personeelsnummer. De Nederlandse adreslookup verschijnt uitsluitend bij een ingevulde postcode en huisnummer en een lege plaats. Een adres kan een optionele `Geldig tot`-datum invullen of wissen; nieuwe adressen blijven open-ended. In de reminderdetailmodal staan **Verbergen** en **Annuleren** onderaan naast elkaar met de bestaande secundaire knopstijl.

De bestaande activiteitenfeed is hergebruikt. De services schrijven regels voor algemene persoonsgegevens, adres toevoegen/wijzigen/archiveren, bankrekening toevoegen/wijzigen/archiveren en relatie toevoegen/wijzigen/archiveren. De vertalingen staan in de bestaande NL/EN-employee-namespace. Er zijn geen database- of dependencywijzigingen uitgevoerd.

Verificatie: 111 Vitest-bestanden/410 tests, strict typecheck, ESLint, i18n-pariteit (24 namespaces), Next.js-productiebuild (115 statische pagina's) en poort-3000-logincontrole (HTTP 200) geslaagd. Authenticated browsercontrole bevestigde de genoemde interacties en de nieuwe feedregel zonder consolefouten.

## Update 2026-07-31: ownership cleanup en Talent Foundation

De ownershipbeslissing is nu doorgevoerd in de testdatabase. De oude `administration_id`-compatibilitykolommen zijn uit het tenant-owned functiehuis verwijderd; de bestaande functie-, groep-, revisie- en plaatsings-ID's zijn behouden. De unieke tenant-job-groupregel is database- en service-side afgedwongen. Er is één administrationele demo-afdeling (`LEGAL-DEMO`) aanwezig om de expliciete `scope_type`-variant te testen.

De Talent Foundation is geïmplementeerd met remote migraties `20260731140701`, `20260731141652`, `20260731142030`, `20260731142342`, `20260731143627`, `20260731144246` en `20260731150748`: level model/levels, seniorities, optionele job families, capability library, profile/profile versions, requirements, tenant readmodel, audittriggers, RLS-per-action, modulegate, self-profile RPC, manager-scope en tenant-FK-covering-indexes. Voor de zes bestaande demo-functies zijn Draft-profielen uit bestaande job revisions aangemaakt; er is geen tweede functiebron gemaakt. Settings, Workforce, My Talent, API-routes, sidebar, i18n en bestaande `jobs`/placements zijn aangesloten.

De Talent-navigatie is daarna aangescherpt: `Talentprofielen` is alleen zichtbaar met `talent:manager-read` en `Talentfundament` alleen met `talent:read`, zodat managers geen onbruikbare instellingenlink zien. De dashboard-layout hergebruikt per render de bestaande authcontext en Supabase-client voor menu-permissions, modules en reminders; hiermee zijn onnodige dubbele contextqueries verwijderd.

Verificatie: 111 testbestanden en 410 tests slagen; strict typecheck, lint, check:i18n (24 namespaces) en productiebuild (115 routes) slagen. `curl.exe` gaf op poort 3000 HTTP 200 voor `/login` en 401 voor de beschermde jobs-, departments- en talent-API's. De authenticated in-app-browser toonde `LEGAL-DEMO` in `/departments`, gaf Workforce Talent toegang tot niveaus/senioriteiten en weigerde `/settings/talent` zonder `talent:manage`. Advisoruitvoer bevat geen nieuwe ownership-RLS-waarschuwing; bestaande projectbrede adviezen en de intentionele beveiligde self-profile/activatie SECURITY DEFINER-RPC's zijn vastgelegd.

## Requirements-update 2026-07-31: tenant- en administratie-eigendom

De leidende ownershipmatrix staat in `docs/requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`; ADR-0006 vult ADR-0001 aan. Functiehuis, Talent-/Performancecatalogi, Cloud Tags en niet-juridische organisatiecatalogi zijn tenant-owned. Employment, contract, payroll, salaris, verlof, verzuim, declaraties, rooster, feestdagen en kosten blijven administration-owned. `employees` is de tenantbrede persoon; meerdere employments mogen naar dezelfde tenantfunctie verwijzen.

Deze ownershipslice is uitgevoerd zonder parallelle domeinobjecten: de remote migraties `20260731130502_align_tenant_owned_job_catalog_and_departments`, `20260731131136_align_star_performer_job_catalog_scope`, `20260731132359_align_tenant_department_consumers` en `20260731135658_remove_job_catalog_compatibility_and_seed_admin_department` zijn toegepast. `jobs`, `job_groups`, `job_revisions`, `job_group_jobs` en departments gebruiken tenant-FK's, tenant-RLS en tenantservices; de oude compatibilitykolommen zijn verwijderd. Employments, placements, assessments, documents, reminders, payroll, salaris, verlof en verzuim blijven administrationeel. De aangepaste consumers en de dataresultaten staan in `docs/requirements/Talent/analysis/`.

De volledige Talentfoundation (levels, competenties, profielen, Workforce-readmodel en Talent-audit) is uitgevoerd volgens schema → API → UI, met bestaande `jobs`, employees, tags en audit als bronnen. De volgende taak is een geauthenticeerde browser-smoketest met de bestaande demo-accounts en daarna pas uitbreiding van capability-inhoud wanneer die productmatig is goedgekeurd.

## Release 2026-07-29: versie 1.20260729.7

De volledige release staat op `main` en `origin/main` als commit `3e324e7`. De releasechecks zijn groen: 110 testbestanden/405 tests, ESLint, i18n-pariteit, strict TypeScript en productiebuild. Vercel Production is `READY` op deployment `dpl_6Wwho9qoYsKBK8DZrxrAh6PC5aAU`, gekoppeld aan dezelfde commit. De productiehost antwoordt anoniem met de loginpagina; runtime errors zijn in het afgelopen uur niet gevonden.

## Update 2026-07-29: verlofconfiguratie gecorrigeerd

De beheer-UX voor verloftypen, opbouwregels, werkuren en overuren is compleet aangesloten op de bestaande administratiegebonden services. Nieuwe en bestaande opbouwregels zijn vanuit de tab Beperkingen zichtbaar, opvolgers worden als keten gekozen, leeftijd en anciënniteit blijven afzonderlijke bonustypen, en uitzonderingen ondersteunen één of meerdere medewerkers met paginering per tien. Werkuren en overuren gebruiken dezelfde vier beperkingsvormen en hebben hun algemene instellingen op Basisinformatie. Versie: `1.20260729.6`.

Remote Supabase is gecontroleerd: HR Admin heeft `leave:read` en `leave:write`, de relevante tabellen hebben per actie RLS-policies en de demo-administratie bevat testvoorbeelden van alle vormen. 405 tests, gerichte ESLint en i18n-pariteit slagen. Buildcompilatie slaagt; de totale typecheck blijft geblokkeerd door twee reeds aanwezige fouten buiten verlof.

## Update 2026-07-29: Next.js dev-servergeheugenonderzoek

Het geheugenonderzoek staat in [`docs/delivery/NEXT_DEV_MEMORY_INVESTIGATION.md`](NEXT_DEV_MEMORY_INVESTIGATION.md). De standaard lokale dev-run gebruikt Webpack na een gecontroleerde vergelijking met Turbopack: Webpack bleef rond 1,20 GB na vijf minuten, terwijl Turbopack onder actieve routeverkenning naar 3,04 GB working set na 60 minuten groeide. De historische 11,12 GB is niet opnieuw gereproduceerd; de diagnose wijst op Turbopack compilergraph-/dev-stategroei, niet op een server-side applicatiecache. `npm run dev:turbopack` blijft beschikbaar. De afsluitende typecheck heeft bestaande fouten gemeld rond `createHeRaLabels` en `hasActiveEmployment`; die staan los van deze slice.

## Update 2026-07-29: medewerkerdashboardvensters

De dashboardkaarten zijn aangescherpt op basis van de visuele controlefeedback. Persoonlijke informatie toont naam, leeftijd/verjaardag, telefoons, e-mailadressen en adres; geslacht, geboortedatum en geboorteplaats zijn uit deze kaart verwijderd. De avatar toont geen technische opslaguitleg meer en behoudt de geautoriseerde upload-/wijzig-/verwijderacties. Verzuim toont expliciet de actuele status en laatste geschiedenis; nieuwe ziekmeldingen openen in een aparte modal met de bestaande operationele velden. De drag-toolbar staat niet meer over kaartlinks. Bij meerdere actieve dienstverbanden kan Contract en salaris per dienstverband worden gewisseld en wordt de salarisreveal per `employmentId` geladen. `check:i18n`, strict typecheck, ESLint en productiebuild zijn geslaagd. Niet gedeployed of gepusht.

## Update 2026-07-29: dienstverbandweergave op medewerkerdashboard

Het medewerkerdashboard toont nu per dienstverband actuele projectiedata en een duidelijke status. Regels zijn volledig klikbaar naar het dienstverbanddetail en behouden een terugpad naar het dashboard; bij geen actieve dienstverbanden verschijnt een afsluitingsmelding en voor geautoriseerde gebruikers een link naar de bestaande aanmaakwizard. De persoonsheader toont geen functie, afdeling of manager; de dienstverbandheader toont het medewerkertype naast het statusblok. Statuslogica voor actief, toekomstig, beëindigd en geannuleerd heeft drie gerichte tests. Typecheck, ESLint, i18n-pariteit en productiebuild zijn geslaagd. Niet gedeployed of gepusht.

## Release-status 2026-07-28

Branding-migratie `20260728110000_administration_branding.sql` is remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; tabel, bucket, RLS, roltoewijzing en `use_company_theme` zijn live gecontroleerd. Applicatieversie: `1.20260728.5`. Commit `f650279` staat op `origin/main`; Vercel production deployment `dpl_FPXqx9mrjiY5aDo1dN2kSRJAXdZj` is `READY`.

## Update 2026-07-28: dienstverbandprojectie en bedrijfsstijl

De medewerkerdetailtab Dienstverbanden gebruikt nu dezelfde tenant-brede, geautoriseerde dienstverbandprojectie als de medewerkerslijst; Lina Bakker met twee dienstverbanden wordt daardoor volledig getoond. Dienstverbandkaarten zijn volledige detailkoppelingen met een duidelijke detailactie, en klikbare lijst-/kaartinteractie gebruikt consequent de handcursor.

Onder Admin instellingen → Platform en uitbreidingen is lokaal een bedrijfsinstellingenpagina toegevoegd. De eerste harmonica bevat bedrijfskleuren en een privé logo-upload; de bedrijfsstijl wordt als standaardthema toegepast en kan in persoonlijke instellingen worden overschreven. De lokale migratie `20260728110000_administration_branding.sql` en gegenereerde type-uitbreiding staan klaar. Remote toepassen, advisors en officiële typegeneratie blijven open totdat daarvoor expliciet toestemming is gegeven. Typecheck, ESLint, i18n-pariteit en productiebuild zijn lokaal geslaagd; deployment, push en commit blijven uitgesteld.

## Update 2026-07-28: werkurentypen bij verlofregels

Werkurentypen hebben nu drie algemene instellingen, gedeelde beperkingstypen met overuren en uitzonderingen voor één of meerdere administratie-medewerkers met selfservice-keuze. De geavanceerde tab blijft leeg voor toekomstige instellingen. Migratie `20260728072505_work_hour_type_settings_and_restrictions.sql` is remote toegepast en de officiële types zijn opnieuw gegenereerd. Typecheck, i18n en de gerichte schema-tests zijn geslaagd. Versie `1.20260728.4`; deployment, push en commit blijven uitgesteld.

Afronding: ESLint, volledige testset (384 tests) en productiebuild zijn geslaagd. De anonieme instellingenroute is op poort 3000 gecontroleerd met 0 console-errors; alleen een bestaande preload-warning blijft open.

## Update 2026-07-28: aparte bonusregels voor leeftijd en anciënniteit

De gewone opbouweditor accepteert nu uitsluitend `CONTRACT_HOURS` en `WORKED_HOURS`. Leeftijd en anciënniteit zijn als afzonderlijke bonusregeltegels uitgewerkt. Elke tegel toont de gekoppelde profielkeuze, trigger, timing, pro-rata-instelling en één of meer unieke traptreden. De catalogus/API levert de traptreden mee; de schema-constraint voorkomt dat de legacy-enumwaarde `AGE_SENIORITY` nog voor een gewone regel wordt gebruikt. De pure engine bevat selectie van de hoogste blijvende trede, triggerdatum, FTE-relatieve toekenning en pro-rata in het eerste triggerjaar.

Migratie `20260728065641_separate_bonus_accrual_basis.sql` is remote toegepast op de gekoppelde Supabase-testdatabase en als `applied` geregistreerd. Live controle bevestigde de constraint, `AGE`/`SENIORITY`-enums, RLS op beide bonustabellen en de rollback-contracttest. Advisors geven alleen bestaande waarschuwingen buiten deze wijziging. Typecheck, i18n en 20 gerichte tests zijn geslaagd. Applicatieversie `1.20260728.3`; lint, volledige tests, productiebuild en ingelogde browsercontrole moeten nog worden uitgevoerd. Deployment, push en commit blijven bewust uitgesteld.

## Update 2026-07-28: verloftype-instellingen en opvolgende opbouwregels

De verloftype-editor bevat nu de uitgebreide algemene instellingen zonder afwezigheid-specifieke opties. De kleurkeuze gebruikt dezelfde uitgebreide tokens als overuren en toont bestaand gebruik. De tab Beperkingen toont de opbouwketen met ingangsdata, voorgangerselectie, basis (contracturen, werkuren of voorbereid leeftijd/anciënniteit), periode, moment, hoeveelheden, één of meer werkurentypen, pauzes, vervaltermijn en een samenvatting. Bestaande versies blijven alleen-lezen; een opvolger sluit de voorganger op de nieuwe startdatum. De geavanceerde tab is als latere uitbreidingsplek gemarkeerd.

Uitzonderingen zijn administratiegebonden, ondersteunen één of meerdere medewerkers, selfservice, geen opbouw of een aangepaste hoeveelheid, tonen een samenvatting en worden na bewaren/annuleren opnieuw geladen met paginering van tien regels.

De migraties `20260728062208_leave_accrual_rule_basis_and_leave_type_settings.sql` en `20260728063339_leave_accrual_rule_age_seniority_rpc.sql` zijn uitgevoerd op de gekoppelde Supabase-testdatabase en als `applied` geregistreerd. Live controle bevestigde `AGE_SENIORITY`, vijf nieuwe verloftype-instellingen, de hoeveelheidconstraint, successor-RPC en bestaande RLS op verloftypen en opbouwregels. Advisors tonen alleen eerder bekende waarschuwingen buiten deze slice. `packages/db/types.ts` is opnieuw gegenereerd. Typecheck, ESLint, i18n-pariteit en 382 tests zijn geslaagd; productiebuild en ingelogde browsercontrole blijven nog open. Applicatieversie `1.20260728.2`; deployment, push en commit blijven bewust uitgesteld.

## Update 2026-07-28: verlofopbouw en overwerkbeheer lokaal uitgebreid

De verlofopbouwcatalogus gebruikt nu duidelijk gemarkeerde actieve tabs, een werkende driepuntmenukaart met kleurgebruik-overzicht en een uitgebreidere kleurkeuze. Bestaande verloftypen, werkurentypen en opbouwregelversies zijn in de UI alleen-lezen; archiveren en een successor voor opbouwregels blijven de expliciete mutatiepaden. De migratie `20260728052250_configure_overtime_restrictions_and_immutable_catalog.sql` voegt immutable database-triggers toe en introduceert administratiegebonden overwerkconfiguratie met een globale limiet (`UNLIMITED`, maanduren, jaaruren of contracturen × factor), managernotificatie, selfservice en medewerkeruitzonderingen inclusief `mag geen overuren schrijven`. De uitzonderingendialoog ondersteunt één of meerdere medewerkers; de lijst wordt na toevoegen vernieuwd en toont medewerkernaam en beperkingstype.

Lokaal geslaagd: strict typecheck, ESLint, i18n-pariteit, 380 tests en productiebuild. De migratie is toegepast op de gekoppelde testdatabase; tabellen, enum, RLS/policies, audittriggers en immutable triggers zijn live gecontroleerd. De nieuwe migratie staat als `applied` in de remote historie. Advisors tonen alleen bestaande waarschuwingen buiten deze slice. `packages/db/types.ts` is officieel opnieuw gegenereerd; alleen ingelogde browsercontrole blijft open. Applicatieversie `1.20260728.1`; deployment blijft bewust uitgesteld.

## Update 2026-07-27: interactieve reminders

De Tijdhub heeft naast de klok een compacte reminderknop met teller, popover en directe link naar Reminderbeheer. `/reminders` ondersteunt zoeken, statusfiltering inclusief oudere reminders, sortering, kleurcodering op urgentie, multi-selectie met bulk afronden, detailmodal en links naar medewerkerdossiers. De weergave blijft gebaseerd op echte, server-side geautoriseerde en administratiegebonden reminders; er is geen fake data toegevoegd. Lokale tests, i18n, strict typecheck, lint, build en een ingelogde browsercontrole zijn geslaagd.

## Update 2026-07-26: éénknopswissel employment-header

De employmentdetailheader heeft nu één wisselknop voor de compacte en uitgebreide weergave, gelijk aan de medewerkerdetailheader. De knop toont steeds alleen de beschikbare tegenactie: **Compact** of **Uitgebreid**. Versie `1.20260726.5`; typecheck, lint, versiecheck en lokale runtimecontrole zijn geslaagd. Deployment blijft bewust uitgesteld.

## Update 2026-07-26: custom fields en functiecatalogusbeheer

De HR Admin-instellingen bevatten nu een lijst-eerst-beheer voor custom fields en functies. Custom fields zijn bewerkbaar op label, landcode, toegang en overige niet-technische instellingen; de technische sleutel en het veldtype blijven onveranderlijk. Nieuwe velden openen in een collapsed venster met een live preview onderaan. Activeren/deactiveren blijft databasebehoudend en inactive velden worden uit medewerkerformulieren gefilterd. Verwijderen vereist bevestiging en wordt server-side geblokkeerd zodra waarden het veld gebruiken. Functies hebben via `job_group_jobs` een many-to-many-relatie met functiegroepen, zonder start-/einddatum in de UI. Beide catalogi ondersteunen active/inactive, CRUD en gebruikscontroles bij verwijderen. De drie nieuwe migraties zijn remote toegepast op de testdatabase; de RLS-policies zijn gescheiden per actie en de nieuwe koppeltabel heeft scope-indexen. Versie `1.20260726.4`; deployment blijft bewust uitgesteld.

## Update 2026-07-26: employmentlijst, dienstverbandvenster en dashboard-refresh

Deze slice is lokaal geïmplementeerd. Dienstverbandkaarten hebben nu duidelijke wijzigingsactie, responsive tweekolomsweergave en datum/primary-sortering; de overbodige teller en verwijderactie zijn weg. De dienstverbandkop en medewerkerkop ondersteunen uitgebreid/compact, met e-mail en telefoon in de uitgebreide variant en expliciete dienstverbandcontext. De overview toont **Werk in uitvoering**; follow-ups en het venster More about this employee zijn volledig uit de actieve codeflow verwijderd. Het dashboard laadt de widgets één keer server-side in plaats van via de foutgevoelige streaminglaag, zodat de refreshlus stopt. Versie `1.20260726.3`; deployment blijft bewust uitgesteld. Typecheck, lint, i18n, 353 tests en productiebuild zijn geslaagd. De lokale server draait op poort 3000 en de open interne browser-tab bleef vijf seconden zonder waarschuwingen of fouten.

## Update 2026-07-26: medewerkerdetail, notities en reminders

De medewerkerdetailwijzigingen zijn volledig lokaal geïmplementeerd. Notes staat na Dossier en is server-side beperkt tot HR Admin en Manager; beide rollen kunnen lezen en bewerken, alleen HR Admin kan verwijderen. Profile/external links zijn naar het medewerkerdashboard verplaatst, Additional Information staat als eigen tab na Relations en de kop toont functie, afdeling, manager en groene actieve status. Reminders tonen eerst de lijst en hebben beschrijving, standaard datum/tijd, verschuifknoppen, wijzigen en verwijderen. De twee employee-notes-migraties zijn remote toegepast op de testdatabase en de RLS/grants zijn gecontroleerd. Versie `1.20260726.2`; deployment blijft bewust uitgesteld. Volledige tests, lint, strict typecheck, i18n, build en browsercontrole zijn geslaagd.

## Update 2026-07-26: Personal Details beheer en adresreminders

De Personal Details-formulieren zijn gegroepeerd en uitgelijnd; Adressen, Bankaccounts en Relaties tonen nu eerst de bestaande gegevens en daarna de actie om toe te voegen. Bestaande records kunnen via dezelfde tab worden gewijzigd en verwijderd, met bescherming tegen het verwijderen van het enige actieve adres. Adresaanmaak kan transactioneel directe reminders publiceren naar de geselecteerde HR Admin-, Manager- en Medewerker-ontvangers. De remote databasefunctie is expliciet geautoriseerd, de trigger en privileges zijn gecontroleerd en de bestaande bankrekeningfunctie blijft standaard alleen beschikbaar voor HR Admin via `bank-account:write`. Versie `1.20260726.1` is verhoogd. De volledige lokale testset (97 bestanden/354 tests), ESLint, strict typecheck, i18n, SQL-contractproef en productiebuild zijn geslaagd; deployment is bewust uitgesteld.

## Update 2026-07-25: adresinvoer

De nieuwe Nederlandse/internationale adresinvoer is lokaal gebouwd met landkeuze, debounce-suggesties, PDOK-postcodeaanvulling, server-only provideradapters, handmatige fallback, herkomstmetadata en internationale adresregels. De zoek-UX focust standaard het adreszoekveld, gebruikt zoek-/locatie-iconen, houdt land en resultaten netjes uitgelijnd en verduidelijkt de postcode+huisnummer-actie als het automatisch invullen van straat en plaats. Migratie `20260725132351_address_input_internationalization.sql` is op 2026-07-25 toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De live schema-controle bevestigde de nieuwe kolommen, vijf constraints, index en één gemigreerd adresrecord; types zijn opnieuw uit de gekoppelde database gegenereerd. Lint, strict typecheck en i18n-controle zijn geslaagd. De browsercontrole kon niet afronden omdat de lokale devserver op poort 3000 geen HTTP-response teruggaf.

## Update 2026-07-24: medewerkerdashboard tweede UI-slice

Het medewerkerdashboard bevat nu foto-/genderfallbacks, lazy salaris-reveal via een apart geautoriseerd endpoint, echte reminders onder contract/salaris, vaste brede/smalle kolommen met persoonlijke drag-and-drop-volgorde en een handmatige activiteitenfeed. Activiteitnotities worden tenant-/medewerkergebonden opgeslagen via migratie `20260724160000_add_employee_activity_entries.sql` met `employee-activity:read/write` en RLS. De migratie en hardeningmigratie `20260724172716_harden_employee_activity_entries.sql` zijn remote toegepast; grants, RLS, policies, FK-indexen en advisorbevindingen zijn gecontroleerd en `packages/db/types.ts` is opnieuw gegenereerd.

Gerichte tests, ESLint, strict TypeScript, i18n-pariteit en productiebuild zijn geslaagd. De ingelogde Chrome-controle bevestigde salaris-hover/verbergen, persistente en herstelde widgetvolgorde, echte lege reminderdata en de beschikbare man/vrouw-avatarfallbacks zonder consolefouten. De anonieme salarisroute weigert met `401`. Een beperkte-rol-browserdeny en `OTHER`/`PREFER_NOT_TO_SAY`-fixture blijven open omdat remote alleen één actieve `TENANT_ADMIN` en geen passende genderfixtures bevat.

## Update 2026-07-24: medewerkerdashboard en navigatiekoppelingen

De eerste UI-slice van `docs/requirements/core-hr/MEDEWERKER_DASHBOARD.md` staat op `/employees/[employeeId]`: het dashboard gebruikt bestaande geautoriseerde medewerkerprojecties, heeft een duidelijke knop naar de detailtabs en toont niet-bestaande modules als lege vensters zonder fake data. Medewerkerlijst, organogram, kalender en Insights (inclusief aankomende gebeurtenissen) openen nu dezelfde dashboardroute; de dashboardpagina biedt expliciet terugnavigatie naar medewerkerdetails. Server-side permission/RLS-verificatie en een ingelogde browsercontrole moeten nog per rol worden uitgevoerd.

## Update 2026-07-24: Inzichten-permissions, CSV en persoonlijke rapportvoorkeuren

`/insights` is nu ingedeeld in Medewerkers, Verlof, Verzuim en Overige rapportages. Iedere rapportage heeft een afzonderlijk permission in de rechtenmatrix; de lokale migratie `20260724095433_insights_report_permissions.sql` kent alle rapportrechten standaard toe aan `TENANT_ADMIN` en `HR_ADMIN`. De teller en navigatie volgen uitsluitend de werkelijk toegekende rapportrechten.

De vier live medewerkersrapporten gebruiken uitsluitend RLS-gebonden databasegegevens en hebben per geopend harmonica-item een CSV-export met de actieve filters. De pagina heeft kleurrijke KPI's/diagrammen, geen overbodige weergaveteksten of beschikbaarheidsbadge, een inklapbare actieve-selectiekaart en een persoonlijke optie om filters per rapport te bewaren. TypeScript en i18n-pariteit zijn geslaagd. De migratie staat remote; een ingelogde browsercontrole met een beperkte rol voor de nieuwe rechtenmatrix blijft open.

## Update 2026-07-23: tabgerichte medewerker- en dienstverbandperformance

De medewerkerdetailroute en dienstverbanddetailroute laden alleen de actieve tabprojectie. Persoonsgegevens, dienstverbandoverzicht, salaris, historie en HR-events worden niet meer standaard op iedere tabwissel gelezen. Onafhankelijke autorisatie-/databasereads lopen parallel; dubbele employee-employment-permissionread is verwijderd. Beide detailroutes hebben een route-skeleton en dynamische medewerker-/dienstverband-/tablinks prefetchen niet meer collectief.

Architectuurbesluit ADR-0004 (`docs/decisions/ADR-0004-performancebudgetten-en-tabprojecties.md`) beschrijft de p75-budgetten, meetmethode, lazy tabdata, loading states en prefetchgrens voor toekomstige schermen.

Verificatie: 90 Vitest-bestanden/336 tests, ESLint, strict TypeScript, i18n-check en productiebuild geslaagd. Commits `a433a46` en `6405d0f` staan op `main`; Vercel `dpl_Gg9oC6KQdksDBkwoD8DxRiaTcAze` is `READY`. Runtime-errorscan: geen fouten. Chrome had voor de laatste prefetchmeting een niet-bestuurbare ingelogde tab; de gemeten individuele eindlatencies na die fix zijn daarom nog open.

## Update 2026-07-23: performance-slice Medewerkerslijst, Organogram en Kalender

De Medewerkerslijst gebruikt nu de security-invoker RPC `list_employee_overviews` om scope, medewerker, dienstverbandhistorie en actuele organisatieplaatsing in één leesronde op te halen. De bestaande dienstverbandstatus- en archieffilters blijven server-side correct; de RPC heeft een remote structuurproef op unieke rijen en geldige JSON-historie. Voor Medewerkers, Organogram en Kalender zijn route-specifieke laadstaten toegevoegd. Dashboard en Instellingen zijn bewust niet gewijzigd.

Verificatie: remote Supabase-migratie `optimize_employee_overview`, Supabase performance/security-advisors, 90 Vitest-bestanden/336 tests, ESLint, strict TypeScript, i18n-pariteit en productiebuild geslaagd. De productieklikmeting volgt na de nieuwe deployment.

Actuele verlofstatus (2026-07-22): de verlofconfiguratie, priority/FIFO-aanvraagflow vanuit `/hr-calendar` en centrale ledger-RPC's/API zijn geïmplementeerd en remote gecontroleerd. De settingspagina bevat ook de jaarsturing. De huidige demo is met Lina Bakker geboekt en in de kalender geverifieerd; feestdagen worden in booking en preview overgeslagen. Resterend zijn vooral de volledige ledger/auditformulieren, toekomstige opbouwprojectie voor maandelijkse regels en later ESS, managerworkflow en notificaties.

 Laatste controle: 2026-07-22. Verlofkleuren voor verlof-/werkuren-/overurentypen, kalenderprojectie en lokale poort-3000-smoke zijn gevalideerd; de bestaande migraties voor dossieruploadregels, weeknummering en Star Performers blijven live en transactioneel getest.

## Fundering

| Onderdeel | Status | Bewijs / resterend werk |
|---|---|---|
| npm-workspace en Next.js-app | GEÏMPLEMENTEERD | `apps/hr-suite` draait verplicht op poort 3000 |
| Supabase SSR-clients | GEÏMPLEMENTEERD | Browser-, server- en strikt server-only adminclient aanwezig |
| Wachtwoordauthenticatie | GEÏMPLEMENTEERD | E-mail/wachtwoord, Google OAuth-start, herstelactie, callback en sign-out aanwezig; app blijft invitation-only |
| Uitnodigingsmodel | GEDEELTELIJK | Tenant-/administratiescope, privé-/businessmail en acceptatie zijn gebouwd; echte mailverzending vereist nog `SUPABASE_SECRET_KEY` en eigen SMTP |
| i18n | GEÏMPLEMENTEERD | Nederlands is standaard, Engels heeft verplichte pariteit; iedere namespace heeft een afzonderlijk JSON-bestand per taal |
| Persoonlijke thema's | GEÏMPLEMENTEERD | Zes thema's op een afzonderlijke persoonlijke instellingenpagina, DB-first voorkeuren en cookie/default-fallback |
| Gedeelde databasetypes | GEÏMPLEMENTEERD | `packages/db/types.ts`; opnieuw genereren na iedere migratie |
| Documentatierouting | GEÏMPLEMENTEERD | Root `AGENTS.md`, architectuurindex, deze status en verplichte `CURRENT_CONTEXT.md`-overdracht voor nieuwe/fork-chats |

### Hotfix 2026-07-29: medewerkerlijst en administratiecontext

De medewerkerlijst schrijft zoektekst niet meer naar `user_preferences`; zoeken blijft URL-state en veroorzaakt daardoor geen 400 meer op `PATCH /api/preferences/employees`. Na een succesvolle administratie-wissel navigeert de UI altijd naar `/dashboard/start`, zodat de geselecteerde administratie direct als nieuwe startcontext wordt geladen.

| Tijdhub en reminders | GEDEELTELIJK | Klokvoorkeuren, Tijdhub, persoonlijke en HR-reminders, RLS, API-routes en live browserflow zijn aanwezig. De afzonderlijke databaseproef en regressietest moeten nog worden herhaald; de klok voorkomt SSR-hydrationverschillen en de sidebar blijft op viewporthoogte staan. |
| Persoonlijke Liquid Dashboard | GEDEELTELIJK | Persoonlijke dashboards, opgeslagen widgetindeling, veilige CRUD/API, startpagina en vier beperkte widgets zijn gebouwd. De volledige vrije Liquid Display-query-engine, charts en generatieve widgets blijven een afzonderlijke volgende slice. Schema-/RLS-proef wacht op gekoppelde Supabase CLI. |
| HeRa AI-agent | GEÏMPLEMENTEERD | Data-first orchestratie, echte rol/permissioncontext, owner- en tenantgebonden memory/voorkeuren, beheer-UI, toon/detail/senioriteit, salaris-/medewerker-/dienstverband-/organisatietools en vijf bevestigbare schrijftools zijn gebouwd. RLS en serverautorisatie zijn live transactioneel negatief getest; lokale, preview- en Production-eindtests zijn geslaagd. |

## Core HR, organisatie en autorisatie

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Employee-persoonskaart | GEÏMPLEMENTEERD | Lijst met opgeslagen detail/compact-, sorteer-, arbeidsstatus- en archiefvoorkeuren (zoekterm niet opgeslagen), volledige klikrij, wizard, detail met hoofdtabbladen inclusief Dashboard vóór Persoonsgegevens, effectieve dienstverbandssamenvatting, verborgen salaris-hover, mutaties, adresgeschiedenis, relaties, gemaskeerde bankrekening, foto-beheer en capabilities zijn aanwezig |
| Medewerkerdashboard | GEDEELTELIJK | Kleurrijke dashboardprojectie, avatarfallbacks, lazy salarisreveal, reminders, activity-feed met handmatige notitie, persoonlijke drag-and-drop-widgetvolgorde, detail-CTA, geautoriseerde bestaande velden, documentpreview, lege vensters zonder fake data en links vanuit lijst/organogram/kalender/Insights zijn aanwezig. Remote migraties, hardening, advisors en typesnapshot zijn afgerond; de HR-adminbrowserflow is gecontroleerd. Beperkte-rol-deny en `OTHER`/`PREFER_NOT_TO_SAY`-fixture blijven open. |
| Dubbele-medewerkercontrole | GEÏMPLEMENTEERD | Tenantgebonden BSN-HMAC of gewogen persoonsgegevens, expliciet besluit en auditlog; exact BSN-matchen vereist `BSN_HASH_KEY` |
| Afdelingenboom | GEÏMPLEMENTEERD | Beheer staat onder de HR-admin instellingen/stamgegevens; lezen, aanmaken, wijzigen/archiveren, RLS en database-cyclusbeveiliging werken |
| Managementrollen | GEÏMPLEMENTEERD | Tenantrollen zijn beheerbaar; globale systeemrollen zijn database-breed onveranderlijk |
| DepartmentManagement | GEÏMPLEMENTEERD | Effective-dated API/UI, overlapbeveiliging, RLS en audit aanwezig |
| EmployeeOrganization | GEÏMPLEMENTEERD | Tijdsgebonden plaatsingen zijn aan parallelle dienstverbanden te koppelen en beheerbaar |
| Organogram | GEDEELTELIJK | Afdelingsview, managerrelatie-view en functiegroep → functie → star performer → medewerker zijn technisch gebouwd, inclusief view-keuze, URL-state en opgeslagen filtervoorkeur. Een ingelogde visuele datasetcontrole voor de nieuwe views blijft open. |
| Permissionmatrix | GEÏMPLEMENTEERD | Zoekbare rollenwerkruimte, gegroepeerde functiepunten, dirty/herstel-flow, grafische dekkingsheatmap, tenantrollen, API, RLS en audit aanwezig |
| Vrije velden (Employee) | GEÏMPLEMENTEERD | Definities, opties, beheer-CRUD, landcode, preview, actieve status, audience-toegang, atomaire nummering, waarden-API/UI en JSONB-spiegeling |
| BSN-beveiliging | GEÏMPLEMENTEERD | Afzonderlijke RLS-tabel; HR-admin en medewerker-self mogen lezen, managers niet; reveal wordt geaudit |
| Autorisatiehelper en managementscope | GEÏMPLEMENTEERD | Selfrechten, actieve rollen, afdelingsscope en RLS zijn getest |
| Managerresolver | GEÏMPLEMENTEERD | Override, deputy en parent-escalatie zijn getest |

## Multitenancy en administraties

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Absolute tenantgrens | GEÏMPLEMENTEERD | Expliciete toegang, samengestelde tenant-FK's, RLS en negatieve isolatietests zijn live |
| Hiërarchische administraties | GEÏMPLEMENTEERD | Parentconstraint, tenantgelijkheid, cyclusbeveiliging en drie demo-administraties zijn live |
| Administratiecontext en switcher | GEÏMPLEMENTEERD | Resolver, context-API, HTTP-only cookie en responsive switcher; PostgreSQL-UUID-notatie wordt correct geaccepteerd en gecontroleerd tegen de toegestane administratieopties |
| Stamtabellenscope | GEÏMPLEMENTEERD | Afdelingen, functies, functiegroepen, loonschalen/revisies, kostenplaatsen en uitdienstredenen zijn tenant-/administratiegebonden. Redenen uitdienst zijn bovendien per land ingericht, met `Einde contract` als fallback wanneer een land geen eigen redenen heeft. |
| Onomkeerbaar combineren | GEÏMPLEMENTEERD | Alleen `SEPARATE → COMBINED`; database blokkeert terugkeer |
| Demo-omgevingen | GEÏMPLEMENTEERD | Hoofdtenant: 3 administraties/50 medewerkers; tweede tenant: 1 administratie/10 medewerkers |

## Dienstverband, IKV en tijdlijnen

| Onderdeel | Status | Resterend werk |
|---|---|---|
| 0..n dienstverbanden per medewerker | GEÏMPLEMENTEERD | Geen dienstverband, toekomstig, actief, voormalig, herintreding en parallel zijn gemodelleerd |
| Parallel binnen één administratie | GEÏMPLEMENTEERD | Meerdere gelijktijdige dienstverbanden zijn toegestaan en als demo aanwezig |
| IKV los van dienstverband | GEÏMPLEMENTEERD | `income_relationships` plus tijdsgebonden koppeltabel; één IKV kan gecontroleerd aan dienstverbanden worden gekoppeld |
| Arbeidsvoorwaarden, urenafspraak, werkpatroon, salaris en kostenverdeling | GEDEELTELIJK | Atomaire apply/rollback-RPC's, afzonderlijke 1–4-weeks werkpatroontijdlijn met exacte urencontrole, TWK-splitsing, 100%-kostenverdeling, audit en mutatieformulieren zijn aanwezig. Eén multi-domein-RPC voor direct gecombineerde wijzigingen volgt nog. |
| Uitdienstmelding | GEÏMPLEMENTEERD | Workflow met wettelijke reden, datum en bevestiging; beëindiging wordt pas definitief via de confirm-RPC |
| Herintreding | GEÏMPLEMENTEERD | Bestaande Employee wordt hergebruikt en krijgt een nieuw Employment; identity-match voorkomt stil dupliceren |
| Medewerker- en dienstverband-UI | GEÏMPLEMENTEERD | Medewerkerkaart toont effective-dated dienstverbanden met anciënniteit vanaf de afwijkende datum en actuele samenvatting (afdeling, functie, uren, CAO en medewerkerstype). De dienstverbanddetailroute bundelt basis/IKV en de selecteerbare contractreeks op Overzicht; rooster, salaris, organisatie en kostenverdeling gebruiken uniforme, wijzigbare tijdlijnen. Persoonsgegevens gebruiken doorzoekbare landkeuzes voor geboorteland en nationaliteit, met het administratie-standaardland als beginwaarde. De verplichte basisgegevenscontrole en volledige dienstverband-/contractwizard zijn aanwezig. Aanmaak van een volledig nieuwe persoonskaart na 'geen match' blijft een afzonderlijke toekomstige flow. |
| Ketenadvies nieuwe contracten | GEÏMPLEMENTEERD | Datumgebonden 2020/2028-regels, bekende interne/externe historie, niet-blokkerende waarschuwing en verplichte motivering bij risico of onvolledige historie. |
| Volledige dienstverbandpublicatie | GEÏMPLEMENTEERD | De wizard controleert eerst verplichte medewerkergegevens en publiceert daarna Employment, IKV-koppeling, eerste contract, arbeidsvoorwaarden, rooster, salaris, plaatsing en exact 100% kostenverdeling in één transactie. |
| Functie- en salarisschaalbeheer | GEÏMPLEMENTEERD | Functies en salarisschalen hebben volledig gescheiden routes en schermen. Functies tonen een standaard ingeklapt zoek-/filterblok, losse aanmaakacties en een grafisch groepsoverzicht; groepsbewerking toont de gekoppelde functies. Schalen hebben een vrij aantal treden en gepubliceerde revisies zijn onveranderlijk. |
| Tijdkaart medewerker | GEÏMPLEMENTEERD | De dienstverbandhistorie toont alle tijdvakken responsief op één tijdas, met veilige salarisprojectie. |
| HR-maandkalender | GEÏMPLEMENTEERD | Groot adaptief desktop/tabletraster met actieve medewerkers, foto's, rooster/niet-werkdagen, feestdagen, reminders, HR-wijzigingen, opgenomen verlof, goedgekeurde werkuren/overuren, ingestelde kleuren, typepatronen, gecombineerde dagdetails, zoekfilters en 10/25/alle-max-100 paginering op `/hr-calendar`; dagkolommen zijn uitbreidbaar voor acties. |

## Documentdossiers

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Medewerkersdossier | GEÏMPLEMENTEERD | Private opslag, metadata, actieve Cloud tags uit `star_performer_tags`, signed downloads, soft-delete/herstel en auditbare toevoeger/verwijderaar. |
| Documentzichtbaarheid | GEÏMPLEMENTEERD | Permission én doelgroep; medewerker, rol en afdelingstak zijn combineerbaar en server-side/RLS afgedwongen. |
| Vervaldatum en reminders | GEÏMPLEMENTEERD | Persoon, rol en organogramdoelgroepen worden gecombineerd en naar gededupliceerde ontvangers gepubliceerd. |
| Globale documenten en AI-compliance | NIET GESTART | Bulk-loonstroken, globaal beleid, OCR/RAG en compliance-audits blijven een afzonderlijke slice. |

| Bedrijfsdocumenten | GEIMPLEMENTEERD | Platte tenantbrede lijst, private opslag, HR-admin upload/delete, signed downloads, viewer en dashboardwidget. |
| Loonstroken | GEDEELTELIJK | Eigen medewerkerkaart-tab, employment-koppeling, bronvelden, private opslag en permission/RLS-readpad zijn aanwezig; Nmbrs/Loket- en bulkimport volgen later. |
| Globale documenten en AI-compliance | GEDEELTELIJK | Bedrijfsdocumenten zijn gerealiseerd; OCR/RAG en compliance-audits blijven een afzonderlijke slice. |

## Instellingen en tenantmodules

De functiecatalogus is verder aangescherpt naar een lijst-eerst scherm met zoeken, sortering, functiegroepfilter en modal-CRUD. De async formulierreset is veilig gemaakt door `currentTarget` vóór de request te bewaren; desktop en 390px zijn lokaal gecontroleerd.

| Bedrijf gegevens en locaties | GEÏMPLEMENTEERD | `/settings/company-data` is toegevoegd aan de HR-beheerhub. Bedrijfsadres en locatiebeheer gebruiken `administration_company_data` en `administration_locations` met serverautorisatie, RLS, actieve status, gebruiksblokkade op verwijderen en toekomstige `employee_organizations.location_id`-koppeling. Beide adresformulieren hebben dezelfde intelligente NL/internationale invoer als medewerker-woonadressen, inclusief optionele internationale adresregel 2. Alleen de HR-adminrol `TENANT_ADMIN` krijgt `company-data:read` en `company-data:write`. |
| Bedrijf en locatie per dienstverband | GEDEELTELIJK | De lokale slice voegt de tab `/employees/[employeeId]/employments/[employmentId]?tab=company-location` toe. Eén bedrijfsadres wordt als alleen-lezen bedrijfskaart getoond; bij meerdere actieve locaties is er per dienstverband een zoekbare locatiekeuze met overzicht, wijzigen en opvolgende ingangsdatum. De lokale migratie `20260802210500_manage_employment_company_location.sql` bevat RLS-uitbreiding, locatievalidatie en beide mutatie-RPC's. Remote toepassing en authenticated browserbewijs staan open. |

## Rapportages en Inzichten

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Rapportagecatalogus | GEDEELTELIJK | `/insights` staat onder Kalender in de navigatie met rapport-specifieke filteropzet, sortering en URL-selectie. Medewerkerprojecties, Aankomende gebeurtenissen, het Verzuimrapport en de Bradford-factor gebruiken geautoriseerde productiedata; verlof, voorziening en WvP blijven open. |
| Medewerkerbestandrapporten | GEDEELTELIJK | Personeel per afdeling, geslacht, leeftijd en reden uit dienst lezen via `employee:read` en bestaande RLS-scoped medewerkers-, dienstverband-, organisatie- en terminationdata. Visualisaties en detailtabellen zijn live; `insights:read`, privacydrempel en exports volgen. |
| Verzuim, voorziening en WvP | GEDEELTELIJK | De kernverzuimslice is remote toegepast. `/settings/absence` beheert nu drempel, geldige standaardcasemanager en administratiegebonden eigen WvP-taaktemplates via `absence_task_templates` met RLS/audit, activatie/deactivatie en servervalidatie. Startpagina en `/insights?report=absence` tonen actieve dossiers, roostergewogen maand/jaar-rapportage, afdelingsfilter en Excel-export; `/insights?report=absence-bradford` voegt Bradford-factoranalyse toe voor laatste 52 weken, dit jaar en vorig jaar met team/afdelingsfilter, risicobanden, uitlegmodal en Excel-export. Wettelijke milestones/casustaken/dossier, voorziening, bewaarmatrix, payroll/13-wekenmodel en externe integraties blijven open. |
| Rapportexport | GEDEELTELIJK | Medewerkerprojecties en Aankomende gebeurtenissen leveren Excel-compatibele CSV op. Excel/PDF en immutable exportaudit volgen later. |

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Verlofopbouw-engine | GEDEELTELIJK | Schema/RLS, pure engine/report, catalogus/opvolgers/voorrangsregels, kleuren, HR-admin-aanvragen, FIFO-booking, feestdaguitsluiting en de centrale ledger-operaties staan in de migraties `20260722142551_add_leave_engine_foundation.sql`, `20260722151920_add_leave_configuration_mutation_functions.sql`, `20260722173000_add_work_hour_type_colors.sql`, `20260722190000_add_leave_request_booking_engine.sql`, `20260722192000_add_leave_ledger_operations.sql`, `20260722192100_seed_leave_demo_year_controls.sql` en `20260722192500_skip_holidays_in_leave_requests.sql`, met routes onder `/api/leave` en UI onder `/settings/leave-accrual` en `/hr-calendar`. Toekomstige opbouwprojectie en volledige saldo-auditformulieren blijven open. |
| Persoonlijke instellingen | GEÏMPLEMENTEERD | Afzonderlijke pagina voor taal, thema, Tijdhubklok, datumformaat (DMY/MDY/YMD) en tijdformaat (24H/12H) voor iedere ingelogde gebruiker; voorkeuren worden centraal toegepast op relevante datum- en tijdweergaven. Gedeelde knoppen gebruiken een iOS-geïnspireerde glasstijl; medewerker-tabs verbergen de native scrollbar met behoud van horizontale bediening. |
| HR-admininstellingenhub | GEÏMPLEMENTEERD | Eén permission-gestuurde hub met standaard gesloten onderdelen. `/master-data` beheert Redenen uitdienst per land, documentcategorieën en tenant-relatietypen; functies en salarisschalen staan uitsluitend in hun eigen instellingenschermen. |
| Actieve extra modules | GEÏMPLEMENTEERD | HeRa, documenten en reminders tenantbreed schakelbaar; serverguards en restrictieve RLS bewaren data maar blokkeren gebruik. |
| Feestdagen | GEÏMPLEMENTEERD | Nager.Date-preview/import per administratie, jaar en land, lokale feestdagen, uitsluiten en snapshot-herimport. |

## Dashboard startpagina

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Gebruiker Startpagina | GEDEELTELIJK | `/dashboard/start` gebruikt echte medewerkers-, organisatie-, verzuim-, gebeurtenissen-, bedrijfsdocumenten- en reminderbronnen binnen de actieve administratie en rol/RLS-scope. Lopende verzuimgevallen bevatten nu medewerker, startdatum, duur en een link naar het verzuimdossier. Declaraties, contractsignering, assets en taken/Poortwachter volgen later. Een volledige rolmatrix blijft open. |

## Security en handmatige productieconfiguratie

## Vervolgslice medewerker, dienstverband en HeRa

- HeRa staat niet meer in de linker navigatie. De zwevende knop links onder opent een overlay; docken naar rechts en de breedte zijn gebruikersvoorkeuren die lokaal worden bewaard.
- De medewerkerkaart heeft een reminders-tab. Dienstverbanden openen als primaire knop, verwijderen is een bevestigde soft-delete en de teruglink bewaart de medewerker-brontab.
- Redenen uitdienst zijn onder `/master-data/end-reasons` per land beheerbaar met toevoegen, wijzigen, activeren/deactiveren en een blokkade wanneer een reden al is gebruikt. Nederland gebruikt de officiële codes 01, 02, 03, 04, 20, 21, 30, 32, 33, 34, 40, 41, 90 en 99; zonder landspecifieke inrichting geldt `Einde contract`.

## Dashboard widgetbibliotheek

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Typed widgetcatalogus | GEÏMPLEMENTEERD | Catalogus bevat kern HR, dienstverband, documenten, beloning en organisatie/tijd; toekomstige verlof- en verzuimcategorieën blijven bewust leeg totdat brondata beschikbaar is. |
| Tenantconfiguratie en roltoegang | GEÏMPLEMENTEERD | HR-admin kan widgets tenantbreed activeren en per managementrol beschikbaar maken; wijzigingen zijn RLS-beveiligd en auditbaar. |
| Dashboardselectie | GEÏMPLEMENTEERD | Uitgeschakelde of niet-geautoriseerde widgets verdwijnen server-side uit bestaande dashboards; nieuwe widgets zijn uitbreidbaar via de registry. |
| Grafische basis | GEDEELTELIJK | Dashboard toont direct stabiele widgetcontouren, laadt aangesloten bronnen parallel met individuele Suspense-grenzen, toont globale voortgang en ondersteunt read-only refresh. De gecategoriseerde picker en vertaalde widgetmetadata zijn klaar; specifieke loaders en rijke datavisualisaties voor overige cataloguswidgets worden per datadomein verder gevuld. |
| Dashboardervaring | GEÏMPLEMENTEERD | Serverbootstrap voorkomt de dubbele eerste fetch; WELCOME, reminders, organisatie en medewerkers gebruiken bestaande betrouwbare bronnen. Niet-aangesloten bronnen tonen een vertaalde lege staat. Nieuwe dashboards starten leeg; de automatisch aangemaakte persoonlijke startdashboard behoudt de standaardindeling. |
| Medewerkerinstellingen-tegel | GEÏMPLEMENTEERD | De tegel op `/settings` opent een tijdelijke pop-up; de navigatielink `/employees` blijft ongewijzigd. |

- HeRa-migraties voor veilige memory-FK's, gebruikersvoorkeuren, berichtmetadata en indexen zijn live toegepast. Een transactionele rollbackproef bevestigde cross-user-isolatie, veilige gespreksverwijdering en owner-only voorkeurtoegang.
- HeRa gebruikt nooit service-role voor chattools. Tenant, gebruiker, administratie en permissions komen uitsluitend uit de server-side sessie; hostile scopevelden in modelargumenten worden geweigerd.

- Tijdhub/reminders: de drie migraties `20260716081000_add_time_hub_reminders.sql`, `20260716090000_fix_reminder_recipient_rls_recursion.sql` en `20260716092000_fix_reminder_publish_auth_lookup.sql` zijn live toegepast. Een RLS-recursie in de recipient-selectie en een niet-toegestane `auth.users`-lookup in publicatie zijn daarmee hersteld.
- Alle nieuwe publieke tabellen hebben RLS en policies in dezelfde migratie. Tenant- en administratiescope wordt zowel in de servicelaag als database-side afgedwongen.
- RLS-policyhelpers voor medewerkerssubresources en vrije veldwaarden hebben expliciete `EXECUTE`-rechten voor `authenticated`; dit is live hersteld in migratie `20260715173629_restore_employee_subresource_grants.sql` en met een regressiecontrole afgedekt.
- Supabase security advisor meldt alleen dat leaked-password protection uitstaat. Supabase biedt dit vanaf Pro; binnen het huidige abonnement is dit niet inschakelbaar en daarom als geaccepteerde abonnementsbeperking vastgelegd.
- `npm audit --omit=dev` meldt 2 moderate PostCSS-meldingen via `next@16.2.10`. De aangeboden `--force`-route installeert Next 9 en wordt daarom niet toegepast; opnieuw beoordelen zodra Next.js een compatibele gepatchte dependency levert.
- Voor echte uitnodigingsmails: stel `SUPABASE_SECRET_KEY` server-only in en configureer eigen SMTP in Supabase. Publiceer deze sleutel nooit als `NEXT_PUBLIC_*`.

## LiquidHR Control Plane — lokale basis 2026-08-02

`apps/liquidhr-control` is als zelfstandige Next.js-app toegevoegd en gebruikt lokaal altijd poort 3001. Gesloten wachtwoordlogin, platformrollen, dashboard, tenantlijst/detail, onboarding, gecombineerd/gescheiden administratiemodel, lifecyclecommando's, live omvang, gebruikssnapshots en append-only audit zijn gebouwd. De databasebasis en RPC-hardening zijn remote toegepast als `20260802172255_add_liquidhr_control_plane` en `20260802172601_harden_liquidhr_control_plane_rpcs`; vijf control-tabellen hebben RLS, publieke RPC's zijn `SECURITY INVOKER`-wrappers en privileged implementaties staan in `internal_security`. Edwin is als actieve `OWNER` gebootstrapt en database-types zijn opnieuw gegenereerd. Er is niet gedeployed.
- Voor exacte BSN-deduplicatie: `BSN_HASH_KEY` en `EMPLOYEE_PII_ENCRYPTION_KEY` zijn lokaal server-only gegenereerd. Stel in iedere publieke omgeving eigen stabiele waarden in en roteer alleen via een gecontroleerde datamigratie.
- Voor Google-login: activeer Google in Supabase en voeg de callback `https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1/callback` toe bij Google. Voeg daarna localhost en iedere publieke app-URL aan Supabase' redirect-allowlist toe.
- Edwin kan pas met wachtwoord inloggen nadat voor `edwin@editsolutions.nl` een wachtwoord is gezet via een uitnodiging of de herstelactie. Een sessie is per browser/profiel; een andere browser moet afzonderlijk inloggen.

## Verificatiebewijs

### HR-admin/stamtabellen en Cloud tags (2026-07-19)

- `/settings` gebruikt standaard gesloten accordions; teruglinks kunnen `?section=...` meegeven zodat de juiste sectie opent en naar beeld scrollt.
- `/master-data` beheert interne uitdienstredenen, documentcategorieën en tenant-relatietypen. Relatietypen zijn tenant-scoped met RLS en standaardseedrecords.
- Documentuploads bieden actieve `star_performer_tags` als Cloud-tagselectie; de verouderde uploadintroductie is verwijderd.
- Org-chart-lagen hebben extra verticale scheiding; organisatieroutes zijn zwaarder en medewerkerrelaties visueel onderscheiden.
- Live smokecheck voor de nieuwe tabel: RLS actief, vier policies, unieke tenant/code-index en 14 seedrecords. De repository-pgTAP-test staat klaar; de MCP SQL-runner heeft geen pgTAP-functies.

- Samengevoegde releasegate 2026-07-18: 79 Vitest-bestanden en 286 tests geslaagd; 18 gelijke NL/EN-namespaces, ESLint zonder waarschuwingen, strict TypeScript en de Next.js-productiebuild met 53 routes zijn groen.
- Verificatie 2026-07-19: gerichte ESLint `--fix` met cache op de in deze beurt gewijzigde organogrambestanden is geslaagd. Strict TypeScript, `check:i18n` en gerichte Vitest voor `app/api/organization-chart/route.test.ts`, `lib/organization-chart/schemas.test.ts` en `lib/organization-chart/projector.test.ts` zijn geslaagd. Runtimecontrole met `curl.exe -I --max-time 2` bevestigt een actieve devserver op `http://127.0.0.1:3000/`; `/employees` en `/organization-chart` redirecten zonder serverfouten naar login. Poort `3001` reageert niet en wordt niet door deze worktree gebruikt.
- Browsercontrole lokaal op poort 3000 met ingelogde Chrome-sessie: medewerkerinstellingenschermpje opent zonder navigatie; dashboard toont streamende widgets, voortgang eindigt op "Dashboard is bijgewerkt", refresh behoudt vijf widgetkaarten, editor/picker toont geen technische widgetcodes, widgetbeheer toont 41 vertaalde kaarten met actief/niet-actief en rollen. Desktop en 390px hebben geen horizontale overflow; console bevat geen errors.
- Supabase migration `20260718172051_grant_dashboard_widget_admin_permissions.sql` is toegepast; security advisor meldt alleen de bestaande waarschuwing dat gelekte-wachtwoordbeveiliging uitstaat. Performance advisor meldt bestaande INFO-meldingen over ontbrekende/indexen die nog niet gebruikt zijn.
- Release `1.20260718.3`: preview en productie zijn `READY`. De veilige anonieme instellingenredirect, de ingelogde HR-adminhub, tenantmodules, Nager.Date-preview, afzonderlijke persoonlijke instellingen en het gelokaliseerde maandraster met medewerkers, uren, filters en paginering zijn browsermatig gecontroleerd.
- Vercel Production van mergecommit `d9ff660` is `READY` op `https://liquid-hr-hr-suite.vercel.app`. Een frisse 390px-browsersessie bevestigde de veilige autorisatieredirect zonder overflow. De beschermde productie-UI is aansluitend ingelogd gevalideerd: versie `1.20260718.2`, alle drie tabbladen, 6 rollen, 12 functiegebieden, 103 functiepunttoekenningen en de doorklik van matrixcel naar rol en rechtencategorie werken zonder gegevens te wijzigen. Een aanvankelijke `PGRST303`-JWT-tijdfout hoorde bij de voorgaande deployment en herstelde bij een nieuwe poging; op deployment `dpl_3zkhTF3Y3M9ccHk4E5s6bvZGTpxz` zijn tijdens de eindcontrole geen error- of fatal-logs gevonden.
- HeRa-incidentherstel: de provincievraag kon na een geautoriseerde leestool leiden tot een lege tweede modelreactie. De daaropvolgende insert in `ai_messages` schond de verplichte contentconstraint (`23514`) en resulteerde in een 500. De orchestrator bewaakt nu zowel afgewezen toolselecties als lege vervolgreplies met een veilige, geautoriseerde fallback. De exacte browservraag is lokaal zonder 500 geverifieerd.
- Volledige Vitest-suite: 59 testbestanden en 234 tests geslaagd. ESLint, strict TypeScript, 15 gelijke NL/EN-namespaces en de Next.js-productiebuild met 36 pagina's zijn geslaagd.
- Tijdhub/reminders zijn lokaal op poort 3000 in een ingelogde browsersessie geverifieerd: persoonlijke reminder aanmaken/afronden, HR-reminder voor iedereen publiceren, sidebar-badge en countdown, en annuleren. De weergave is ook op 390px gecontroleerd zonder horizontale overflow.
- De eerder gemelde `POST /api/context/administration 400` is lokaal gereproduceerd en opgelost; de wissel naar de Operations-administratie gaf daarna `200` en de UI selecteerde de nieuwe context.
- De detailpagina van Edwin Testbeheerder is na de RLS-herstelmigratie lokaal op poort 3000 succesvol geladen; adres-, relatie- en vrije-veldqueries geven geen 403 meer.
- HeRa is browsermatig geverifieerd met geautoriseerde salarisgronding, geheugen create/update/delete, antwoordvoorkeuren, tijdzonebewuste remindercontrole en veilige conceptannulering. De lege vervolgreactie die eerder constraint `23514` en een 500 veroorzaakte, heeft een geteste fallback.
- Gemini 3-function calling bewaart de versleutelde `thoughtSignature` tussen toolrondes.
- Vijf aanvullende live databaseproeven voor volledige dienstverbandpublicatie, stamtabellen/salarisrevisies, documentdossiers, HR-wijzigingsprojectie en kalenderautorisatie zijn geslaagd.
- Publieke Vercel-preview: `https://liquidhr-git-codex-hera-data-agent-edwinitsolutions.vercel.app`; login en 390px-weergave zijn gecontroleerd. Beschermde flows vereisen een afzonderlijke geldige previewsessie.
- Lokale productiebuild luistert op `http://localhost:3000` en blijft actief; login is desktop en op 390px zonder consolefouten gecontroleerd.
- Login, herstel, uitnodiging en beschermde redirects zijn op desktop en 390px mobiel zonder consolefouten gecontroleerd.
- Alle 13 database-integratie- en isolatietests voor tenant, administratie, voorkeuren, identity matching, beveiligde BSN-opslag, vrije velden, autorisatie, dienstverbanden, tijdlijnen, uitdienstmelding en demodata zijn live tegen Supabase geslaagd.
- Supabase bevat exact 50 demo-medewerkers in de hoofdtenant en 10 in de tweede tenant, inclusief representatieve dienstverbandscenario's.
- Tijdelijke publieke preview tijdens ontwikkeling: `https://unmerited-diuretically-angeline.ngrok-free.dev`. De actuele loginpagina is na **Visit Site** bereikbaar. Deze URL verandert wanneer de tunnel opnieuw wordt gestart; voor OAuth/herstel moet hij expliciet in Supabase worden toegestaan.
- Demo-inrichting: 12 vrije-velddefinities, 183 administration-scoped waarden, 6 tenantrollen en 4 HR-rolhouders verdeeld over beide testtenants.
- Definitieve Vercel/OpenAI-hosting wacht op de afgesproken Git-publicatiestap en op de twee server-only secrets hierboven. `vercel.json` is voorbereid.
# Release update 2026-07-19

- HR-stamtabellen: tenant-relatietypen kunnen worden toegevoegd via `/master-data`; codes zijn vrije tenantcataloguswaarden met validatie, unieke tenant-scope en RLS.
- Feestdagen: handmatige records zijn visueel onderscheiden van geïmporteerde records.
- Organogram: de weergavekeuze staat zichtbaar in het filterblok; manager-only en functiegroep/functie/medewerker zijn beschikbaar, inclusief afdeling op medewerkerkaarten.
- Branch/deploy: `main` is de enige blijvende test/live-branch; previews zijn uitsluitend voor controle.
### Hotfix 2026-07-29: medewerkerfoto's

Foto wijzigen/verwijderen is zichtbaar op de medewerkerdetailpagina voor gebruikers met `employee:write`, ook in compacte weergave. Uploads worden server-side naar maximaal 512x512 WebP en maximaal 750 KB gecompacteerd. De migratie voor de bucketlimiet staat klaar maar is nog niet live toegepast.

### Update 2026-07-31: Talent-navigatie en performance

- Talentfundament staat op `/settings/talent` en is permission-gestuurd via `talent:manage`. Talentprofielen staat niet meer als tweede zijbalkitem, maar als Workforce-tegel op `/workforce` voor `talent:manager-read`.
- Voor de actieve demo-tenant van Edwin is de tenant-specifieke TENANT_ADMIN-override aangevuld met `talent:manage`, `talent:manager-read` en `talent:read` via lokaal migratiebestand `20260731193000_grant_talent_permissions_to_demo_tenant_admin.sql`; Supabase registreerde de uitvoering als `20260731172748_grant_talent_permissions_to_demo_tenant_admin` door de bestaande remote tijdlijn. Bestaande tenant-owned functies, groepen en profielen zijn hergebruikt.
- De gedeelde dashboard-layout geeft bestaande Supabase- en authcontext door aan voorkeuren en branding; dubbele initialisaties zijn verwijderd. Lokale warme routecontroles liggen rond 0,8--1,3 seconden. Next.js dev-cold-compilatie blijft afzonderlijk herkenbaar als circa 9--15 seconden en is geen productiebenchmark.
- Verificatie: 111 testbestanden/410 tests, typecheck, lint, i18n (24 namespaces), build (115 statische pagina's) en poort-3000-logincontrole geslaagd. Ingelogde browserflow bevestigde de enkele actieve menu-highlight en de twee juiste Talenttoegangen. Geen dependency-installatie, database-schemawijziging, deploy of commit uitgevoerd in deze slice.

### Update 2026-08-01: Talentfundament- en Tijdhub-UX

- Talentfundament volgt nu de bestaande `SettingsAccordion` met `alwaysOpen`: precies één paneel blijft open. De extra eyebrow en subtitel zijn verwijderd; de sidebarlink is niet langer ingesprongen als nested menu-item.
- Tijdhub-reminders gebruiken voor het eerstvolgende item een bestaande warning-surface in notitiekaartstijl. Reminderpanelen berekenen een positie naast of boven de trigger en hebben een expliciete sluitknop. Er is geen demo-record voor verlopen reminders aangemaakt of gewijzigd.
- Browsercontrole op poort 3000 bevestigde de Talentfundament-header, sidebaruitlijning, één-open-regel, geel kaartje, niet-overlappende popover en sluiten; browserconsole: geen errors.
- Verificatie: typecheck, lint, i18n-pariteit (24 namespaces), 111 testbestanden/410 tests en productiebuild (115 statische pagina's) geslaagd. Geen dependency-installatie, schemawijziging, deploy of commit.
