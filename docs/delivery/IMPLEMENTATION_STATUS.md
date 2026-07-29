# Implementatiestatus Liquid HR

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
| Gebruiker Startpagina | GEDEELTELIJK | `/dashboard/start` gebruikt echte medewerkers-, organisatie-, verzuim-, bedrijfsdocumenten- en reminderbronnen binnen de actieve administratie en rol/RLS-scope. Lopende verzuimgevallen bevatten nu medewerker, startdatum, duur en een link naar het verzuimdossier. Declaraties, contractsignering, assets, taken/Poortwachter en gebeurtenissen volgen later. Een ingelogde desktop/390px-browsercontrole en echte rolmatrix blijven open. |

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
