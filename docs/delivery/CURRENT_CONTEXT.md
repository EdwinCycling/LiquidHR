# Actuele overdracht Liquid HR

## Update 2026-07-23: medewerkerdetail en dienstverbandtabs tabgericht geladen

De keten Medewerkerslijst → medewerkerdetail → Persoonsgegevens/Dienstverbanden → dienstverbanddetail → dienstverbandtabs is geoptimaliseerd. `getEmployeeEmploymentDetail` en `getEmploymentDetail` lezen nu alleen de projectie voor de actieve tab; historie en HR-events worden niet meer op iedere dienstverbandtab opgehaald. Onafhankelijke rechten- en datalezingen starten parallel, de dubbele employments-permissionread in de medewerkerprojectie is verwijderd en detailroutes hebben compacte `loading.tsx`-skeletons. Dynamische medewerker-, dienstverband- en tablinks hebben `prefetch={false}` zodat verborgen tabs geen collectieve serverrequests veroorzaken.

Architectuur is vastgelegd in `docs/decisions/ADR-0004-performancebudgetten-en-tabprojecties.md` en aangevuld in `docs/architecture/BLUEPRINT.md`, `docs/architecture/UI_FLOW_BLUEPRINT.md` en `docs/README.md`. Nieuwe detailroutes krijgen voortaan een gerichte p75-meting (standaard ≤1.500 ms eerste detailnavigatie, ≤1.000 ms warme tabwissel), tabprojecties en loading state.

Verificatie: 90 Vitest-bestanden/336 tests, ESLint, strict TypeScript, i18n-pariteit en productiebuild zijn groen. Commit `a433a46` bracht de tabprojecties; commit `6405d0f` zette brede prefetch uit en staat op GitHub `main`. Vercel Production deployment `dpl_Gg9oC6KQdksDBkwoD8DxRiaTcAze` is `READY` op `https://liquid-hr-hr-suite.vercel.app`; applicatieversie blijft `1.20260723.2`.

Voor/na-bewijs: de bestaande geauthenticeerde baseline was lijst→detail 1.127 ms, Persoonsgegevens 1.354 ms, Dienstverbanden 1.072 ms en warme dienstverbandtabs 811–1.079 ms. Op de eerste nieuwe deployment waren routes door koude productie/cache 1.867–2.370 ms; de meting liet bovendien brede tabrequests zien. Na `6405d0f` registreerde Vercel voor de einddeployment slechts 14 `/employees`, 4 medewerkerdetail- en 7 dienstverbanddetailrequests in de controleperiode, zonder runtime-errors; de vastgelopen Chrome-tab kon de laatste individuele latencymeting niet betrouwbaar afronden. Niet bevestigd: een nieuwe p75-latency na de prefetchfix. Handmatige vervolgstap is één nieuwe Chrome-meting zodra de ingelogde tab weer bestuurbaar is.

## Update 2026-07-23: Medewerkerslijst geoptimaliseerd voor nieuwe release

De prioriteitsslice voor performance richt zich op Medewerkers; Dashboard en Instellingen zijn bewust buiten scope gelaten. `listEmployeesOverview` gebruikt nu de security-invoker RPC `list_employee_overviews` uit migratie `20260723131241_optimize_employee_overview`, die de administratie-scope, medewerkerprojectie, dienstverbandhistorie en actuele organisatieplaatsing in één databaseleesronde teruggeeft. De RPC filtert ook de archiefstatus en blijft alleen uitvoerbaar voor `authenticated`; RLS blijft op de onderliggende tabellen actief. `packages/db/types.ts` is bijgewerkt met de nieuwe functie. Route-specifieke laadstaten zijn toegevoegd voor `/employees`, `/organization-chart` en `/hr-calendar`.

Remote verificatie: de RPC-structuurproef voor de actieve demo-administratie is geslaagd; de performance-advisor toont geen nieuwe waarschuwing en de security-advisor alleen eerder geaccepteerde meldingen. Lokale releasegate: 90 Vitest-bestanden/336 tests, ESLint, strict TypeScript, i18n-check en productiebuild geslaagd. Applicatieversie voor deze release: `1.20260723.2`. Productie staat op deployment `dpl_AbybcQKa7Z232jFG66dM9qamjfev` (`READY`) met alias `https://liquid-hr-hr-suite.vercel.app`; de runtime-errorscan over de laatste 30 minuten vond geen fouten.

Geauthenticeerde Chrome-meting na deployment: dashboard → Medewerkers 1.651 ms (koude eerste overgang), daarna Organogram 1.046 ms, Medewerkers 813 ms, Kalender 1.045 ms en Medewerkers 798 ms. De herhaalde Medewerkers-overgangen hebben daarmee een mediaan van 813 ms, tegenover circa 926 ms in de vorige gerichte meting en circa 4.560 ms in de oudere warme baseline. De eerste overgang blijft netwerk-/cachegevoelig; Dashboard en Instellingen zijn in deze slice niet aangepast.

## Update 2026-07-23: performance-slice en volledige release gedeployed

De trage overgang tussen dashboardroutes heeft drie maatregelen gekregen. `vercel.json` stuurt Vercel Functions naar `cdg1` (Parijs-regio), zodat de server dichter bij Supabase `eu-west-3` draait. De dashboardroutegroep heeft een algemene skeleton-loading UI. Hoge-cardinaliteitslinks naar medewerkerkaarten en kalender-events prefetchen niet meer automatisch. In `lib/auth/permissions.ts` delen permission-checks binnen één Server Component-request dezelfde Supabase-client en opgeloste auth/context/rollen/permissions; selfservice-permissions worden binnen die request eveneens gedeeld.

De volledige werkboom is vastgelegd in commit `77dc4d8` met applicatieversie `1.20260723.1` en naar GitHub `main` gepusht. Vercel Production deployment `dpl_E4tT9cTmashfnhv95vy4ENNTYryT` is `READY` op `https://liquid-hr-hr-suite.vercel.app` met regio `cdg1`.

Verificatie 2026-07-23: volledige ESLint, strict typecheck, i18n-pariteit met 20 NL/EN-namespaces, alle 89 Vitest-bestanden/334 tests en lokale productiebuild geslaagd. Productie-smoke gaf beschermde redirects/200-responses en de runtime-errorscan vond geen fouten in de laatste 30 minuten. Een nieuwe geauthenticeerde klik-tijdmeting wacht op een bestuurbare Chrome-sessie; de eerdere baseline blijft circa 4,3–5,0 seconden warm en circa 6,1 seconden koud.

## Update 2026-07-22: verlof aanvraag, ledger en Lina-demo gecontroleerd

De HR-admin-verlofflow is nu als verticale slice aanwezig. Vanuit `/hr-calendar` staan de acties **Verlof aanvragen via voorrangsregels** en **Verlof aanvragen zonder voorrangsregels** direct open in het dagpaneel. De aanvraag is altijd per `Employment`, wordt server-side beschermd met `leave:request`, boekt direct goedgekeurd en gebruikt FIFO over de actieve verloftypen van de gekozen voorrangsregel. De route toont saldo nu, saldo einde jaar/onbeperkt en detail per verloftype. De kalender toont daarna de opgenomen kleur/type-indicator.

De centrale ledger-operaties staan in `20260722192000_add_leave_ledger_operations.sql`: immutable migratie-startsaldo, HR-handmatige plus/min-correcties met reden, jaarafsluiting met carry-forward en behoud van oorspronkelijke vervaldatum, lock van afgesloten jaren en idempotente vervalboekingen. De API staat onder `/api/leave/ledger`; `/settings/leave-accrual` bevat jaarstatus en afsluitactie. De seed `20260722192100_seed_leave_demo_year_controls.sql` geeft het demojaar 2026 en toekomstjaar 2027 de status ACTIVE.

De bestaande medewerker is **Lina Bakker** (niet Linda) met employment `8bc9fd97-bb8d-c2aa-2694-4db65c654dbe`, geldig vanaf 01-01-2026, bevestigd salarisrecord en rooster. Het verloftype **Wettelijk verlof** is geldig vanaf 01-01-2026 met jaaropbouw van 160 uur. De gecontroleerde HR-adminboeking op 22-07-2026 is één volledige roosterdag van 8 uur; de remote database toont status `APPROVED`, één `TAKEN`-boeking en resterend saldo 152 uur.

Gate op 2026-07-22: strict typecheck, ESLint, i18n-pariteit, 334 tests en productiebuild geslaagd; remote Supabase-migraties en structuur/advisor-controles uitgevoerd. De security-advisor-waarschuwing voor de callable security-definer RPC's is bewust: de RPC's controleren zelf tenant, employment en permissions. De bestaande waarschuwing voor leaked-password protection blijft een abonnementsbeperking.

Bewust resterend: de report-service projecteert toekomstige periodieke opbouw nog niet volledig in `projectedEndBalance`/maandmomenten; volledige UI voor startsaldo/handmatige correctie en een detailaudit ontbreekt nog. Feestdagen worden nu in de remote booking-RPC én de preview overgeslagen. ESS/selfservice, medewerkerkalenderaanvraag, managerworkflow-UI, functiegroepnotificaties en mail zijn niet onderdeel van deze slice.

## Update 2026-07-22: kleuren en kalenderprojectie voor verlofengine

De verlofcatalogus ondersteunt nu een beheerbare kleur per verloftype en per werkurentype (waaronder overuren en informatieve planning). De migraties `20260722173000_add_work_hour_type_colors.sql` en `20260722173100_normalize_catalog_color_defaults.sql` zijn lokaal vastgelegd en live toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; work-hour catalogus-API en editor sturen `colorCode` mee. De kalender leest voor de gekozen administratie alleen `TAKEN`-transacties en `APPROVED` werkurenentries, behoudt het `employmentId`, toont een legenda, type-icoon/patroon en meerdere items per dag met detailpaneel. Strict typecheck, i18n-check, lint, productiebuild en 334 tests zijn geslaagd; de anonieme poort-3000-smoke bevestigt de beschermde redirects/401. Een inhoudelijke kalendercontrole met tenantdata wacht nog op een ingelogde browsersessie.

## Werkafspraak 2026-07-22: Supabase- en GitHub-MCP beschikbaar

Edwin heeft bevestigd dat deze omgeving werkende MCP-integraties voor Supabase en GitHub heeft. Gebruik in volgende chats de Supabase-MCP voor projectinspectie, SQL/migraties, advisors en typesgeneratie; gebruik de GitHub-MCP voor repository-, commit-, PR- en CI-taken wanneer die binnen de opdracht vallen. Een eerdere poging om dit ook in de externe Codex-memorymap te schrijven werd door filesystemrechten geweigerd; deze repository-overdracht is daarom de duurzame bron.

## Update 2026-07-22: HR-admin-verlofaanvraag als stap 8 vastgelegd

De nieuwe requirements staan in `docs/requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md`. De scope is uitsluitend verlof aanvragen door een geautoriseerde HR-admin of geautoriseerde manager vanuit een aangeklikte medewerkerdag in `/hr-calendar`; ESS/selfservice en chatbot blijven buiten scope. Het harmonica-menu krijgt onder **Medewerker**, boven **Acties**, de acties voor aanvragen via voorrangsregels en zonder voorrangsregels.

De flow is altijd per `Employment`: bij één geldig actief dienstverband automatisch, bij parallelle dienstverbanden expliciet kiezen en nooit aggregeren. De nieuwe canonieke permission wordt `leave:request`, standaard gekoppeld aan `TENANT_ADMIN`/HR-admin en tenantbreed aanvullend selecteerbaar via de bestaande rechtenmatrix. Een geautoriseerde manager boekt direct goedgekeurd binnen de bestaande scope; medewerkers krijgen dit recht nooit. De requirements leggen de keuze bij nul/één/meerdere priority-bundels, directe keuze zonder bundel, volledige dag/voor-/namiddag/specifieke uren, een per administratie configureerbare halve-dagduur (standaard vier uur), meerdaagse volledige dagen, roosterberekening, saldo nu versus saldo einde kalenderjaar, saldo-/limietcontrole, detail per verloftype, FIFO, atomische boeking, idempotentie en audit vast.

De functionele keuzes voor deze stap zijn nu compleet: feestdagen worden in meerdaagse reeksen overgeslagen; zonder priority-bundel toont de route alle actieve verloftypen met saldo nu, saldo einde kalenderjaar of onbeperkt. Functiegroepnotificatie is bewust doorgeschoven naar de latere mail/notificatiestap. Er is in deze beurt geen database-, API- of UI-code gewijzigd.

## Update 2026-07-22: stap 3 t/m 5 en priority-sub-slice van stap 6 uitgevoerd

De configuratie-mutaties gebruiken nu de RLS-gebonden API en voor samengestelde wijzigingen de remote functies uit `20260722151920_add_leave_configuration_mutation_functions`: opvolgerregels worden in één transactie aangesloten, bonusregels worden met treden aangemaakt, en profieltoewijzing, uitzonderingen, priority-regels en catalogus archiveren/bewerken zijn beschikbaar. De functies zijn op Supabase gecontroleerd met execute-rechten voor `authenticated`; types zijn lokaal bijgewerkt.

Stap 4 staat in `/settings/leave-accrual`: de permission-gestuurde instellingstegel, klantcatalogus met tabs voor verlof/overuren/werkuren en formulieren voor aanmaken, bewerken en archiveren. Stap 5 bevat de profielgebonden opvolgerketen en opbouwregel-editor voor frequentie, moment, hoeveelheid/ratio, gekoppelde uren, pauzetypen en vervaltermijn. De priority-sub-slice van stap 6 staat in `/settings/leave-accrual/priority-rules`: een jaargeselecteerde lijst en editor voor profiel, geldigheid, actieve status, unieke aaneengesloten afboekvolgorde, eerste/laatste afboeken en FIFO-uitleg. Jaarafsluiting, carry-forward en saldo-audit uit stap 6 zijn nog niet gebouwd. Screenshots zijn alleen als layoutreferentie gebruikt; fictieve testdata is niet ingezaaid. De lokale controle is uitgevoerd met lint, strict typecheck, 333 tests, i18n-check, productiebuild en beschermde routesmoke op poort 3000.

Bewust nog open: startsaldo-mutaties, centrale bucket/grootboekopbouw, jaarafsluiting/carry-forward, saldo-audit en verlofaanvragen. Directe writes naar buckets/transacties blijven geblokkeerd totdat die centrale engine inclusief jaar-lock en idempotentie als aparte veilige slice is gebouwd. Lokale Supabase-validatie blijft afhankelijk van Docker; remote structuur/advisors zijn gecontroleerd.

## Update 2026-07-22: stap 1 t/m 3 verlofopbouw-engine uitgevoerd

De Supabase-MCP heeft de databasefundering toegepast als `20260722142551_add_leave_engine_foundation`, aangevuld met FK-indexen in `20260722144232_add_leave_engine_fk_indexes` en `20260722144344_add_leave_transaction_bucket_fk_index`. De SQL-structuurtest `apps/hr-suite/supabase/tests/leave_engine_foundation.sql` is tegen de gekoppelde database uitgevoerd. `packages/db/types.ts` is opnieuw gegenereerd. De security-advisor toont alleen de al bestaande waarschuwing dat gelekte-wachtwoordbescherming uitstaat; de nieuwe verlof-FK-waarschuwingen zijn met de aanvullende indexmigraties opgelost.

Stap 2 staat in `apps/hr-suite/lib/leave/leave-engine.ts` en `report.ts`, met test-first dekking voor contracturen, goedgekeurde gewone/overwerkuren, informatieve uren, ratio/pauze, upfront/arrears, expliciete payroll-frequentiefout, verval, bonus-/triggerdatum, schrikkeldagbeleid en FIFO. Stap 3 staat in `apps/hr-suite/lib/leave/leave-service.ts` en de routes `/api/leave/balance-report` en `/api/leave/catalog`: server-auth/RLS-scope, één automatisch geselecteerd actief dienstverband, selectiegegevens bij meerdere parallelle dienstverbanden, catalogus-GET en geautoriseerde basiscreatie van verloftypen, werkurentypen en profielen.

Lokale Supabase/Postgres-validatie blijft afhankelijk van een gestarte Docker-container; de gekoppelde MCP-database, advisors, types en remote SQL-structuurtest zijn wel gecontroleerd. Nog open: HR-admin UI, volledige opvolger-/bonus-/priority-/jaarafsluit-/startsaldoflows, centrale schrijfengine voor buckets/grootboek, publieke preview en verlofaanvragen.

## Update 2026-07-21: verlofopbouw-engine als nieuwe modulebasis

De leidende requirements voor de nieuwe verlofmodule staan in `docs/requirements/leave/VERLOF_OPBOUW_ENGINE.md`. De eerste slice is uitsluitend de HR-adminpagina `/settings/leave-accrual` plus de dienstverbandgebonden opbouw-, saldo-, verval- en configuratie-engine. Een Employee kan parallelle Employments hebben; ieder Employment krijgt daarom eigen profieltoewijzingen, buckets, grootboek en saldo. Verlofaanvragen, selfservice, accordering en daadwerkelijke TAKEN-boekingen volgen pas later, al zijn de priority/FIFO-regels en cross-year-voorwaarden nu vastgelegd.

De opbouwregels zijn aangescherpt: geen opbouw buiten een geldig dienstverband; nuluren- en overwerkopbouw komt uitsluitend uit goedgekeurde, dienstverbandgebonden werkurenentries van gekoppelde typen; informatieve werkurentypen (zoals thuiswerken, opleiding en beurs) tellen nooit mee. De ratio verlofuren per gewerkt uur is per opbouwregel configureerbaar, zonder vaste standaard. Ieder verloftype is opbouwend, onbeperkt, vast-gelimiteerd per kalenderjaar of begrensd als gemiddelde weekuren maal factor. Een opbouwregel kan gericht pauzeren tijdens één of meer geselecteerde opgenomen verloftypen; vermindering is pro rata per getroffen uren. Toekenning kan aan het begin of einde van de gekozen frequentie gebeuren. Opbouwregels vormen per profiel/verloftype een aansluitende voorganger-/opvolgerketen; HR selecteert iedere versie in het overzicht, maar wijziging maakt altijd een opvolger. Jaarafsluiting maakt een immutable carry-forward-snapshot van positieve buckets met hun originele vervaldatum voor het volgende jaar, zonder saldo te dupliceren, en bevriest alle regelversies die in het afgesloten jaar golden. De verplichte `getLeaveBalanceReport`-projectie levert per dienstverband en verloftype voor medewerker en geautoriseerde manager het beginsaldo inclusief carry-forwards, saldo nu, prognose einde kalenderjaar/dienstverband, maandelijkse opbouwmomenten, verval, handmatige HR-mutaties en later opnames. Migratiesaldi worden als datumgebonden, immutable startbucket geboekt. Leeftijdsbonus volgt de verjaardag, anciënniteitsbonus `employments.seniority_date` of voor beide 1 januari; verval wordt op de ingestelde datum afgetrokken, na de geconfigureerde maanden vanaf einde opbouwjaar.

Vóór de engine- en API-bouw resten alleen de fallback voor een geldige `PAYROLL_PERIOD` zonder salarisfrequentie en de niet-schrikkeljaar-datum voor 29 februari. Het stap-1-schema staat klaar; route, UI en engine ontbreken nog.

## Update 2026-07-19: medewerkerlijst- en persoonskaart UX

De medewerkerslijst bewaart nu per ingelogde gebruiker de filterpaneelstatus, weergave (detail/compact), sortering, arbeidsstatusfilter en archiefstatus in `user_preferences.ui_state.employeesList`; de zoekterm wordt bewust niet opgeslagen. Filterwijzigingen worden via `/api/preferences/employees` gevalideerd opgeslagen. Enter voert de zoekopdracht uit en de wisactie in het zoekveld verwijdert alleen de zoekterm. In detail- en compactweergave is de volledige medewerkersrij klikbaar.

De medewerkerdetailpagina opent nu op de hoofdtab `Overzicht`, vóór `Persoonsgegevens`. Het overzicht bevat contact/adres/bank/noodcontact en een peildatum-samenvatting van het huidige dienstverband met arbeidsvoorwaardengroep, uren per week, salaris, afdeling en functie. Salarisdata wordt alleen opgehaald met `salary:read` en visueel vervaagd achter een lock-icoon; hover/focus toont de waarde. De aanvullende gegevenskaart blijft uitsluitend onder `Persoonsgegevens` zichtbaar. De subtab `Overzicht` is uit de persoonskaart verwijderd.

Verificatie 2026-07-19: 84 Vitest-bestanden/313 tests, ESLint, strict TypeScript, i18n-check en productiebuild met 64 static pages/routes geslaagd. Poort 3000 draait; anonieme `/employees`-controle redirecteert naar `/login?next=%2Femployees`. Een ingelogde medewerkerdataset-browsercontrole is in deze beurt niet beschikbaar in de verse Playwright-sessie.

## Update 2026-07-19: main als enige live/testbranch

De afgesproken workflow is voortaan eenvoudig: `main` is de enige blijvende branch voor test en live; featurebranches/worktrees zijn tijdelijk en worden na geslaagde controles naar `main` gemerged en verwijderd. Vercel Production volgt GitHub `main`; preview-deployments zijn test-only. Controleer na push altijd de Vercel deployment-commit en de GitHub `main`-commit.

De HR-admin-stamtabellen bevatten nu ook aanpasbare tenant-relatietypen. De nieuwe relatie-typecatalogus is live toegepast, inclusief tekstcodes, tenant-FK, index en RLS uit de eerdere migratie. Feestdagen die handmatig zijn toegevoegd zijn in de instellingenlijst accentkleurig gemarkeerd. Het organogram heeft altijd zichtbare weergavekeuze: afdelingen, managerrelaties zonder afdelingsvensters en functiegroep → functie → medewerker met afdeling op de medewerkerkaart.

Vervolgslice 2026-07-19: HR-admininstellingen gebruiken standaard gesloten accordions met terugnavigatie naar de juiste sectie. `/master-data` bevat beheersbare interne uitdienstredenen, documentcategorieën en tenant-relatietypen, plus links naar functie- en salariscatalogi. Documentuploads selecteren uitsluitend actieve Cloud tags uit `star_performer_tags`; de oude upload-uitlegtekst is verwijderd. De org-chart canvas gebruikt meer laagruimte en duidelijk onderscheiden verbindingslijnen. Migratie `20260719170000_add_tenant_relation_type_catalog.sql` is live toegepast met RLS, seedrecords en database-smokecontrole. Applicatieversie volgt na de releasegate.

Vervolgslice 2026-07-19: de medewerkerslijst en het organogram in worktree `settings-rosters-calendar` zijn functioneel verdergetrokken. De medewerkerslijst filtert nu standaard op `ACTIVE_EMPLOYEE`, zodat de telling logischer aansluit op de kalender. De lijst toont daarnaast expliciet het personeelsnummer per rij, zodat twee verschillende personen met dezelfde naam niet meer ogen als een render-dubbeling. De bestaande analyse blijft: het eerdere verschil `11` versus `23` kwam vooral voort uit verschillende definities van "zichtbare medewerker" tussen kalender en medewerkerslijst, niet uit een eenvoudige dubbele-renderbug.

De migraties voor strengere dossieruploads, persoonlijke weeknummering en Star Performers zijn op 2026-07-19 live toegepast. De Star Performer- en Cloud tags-tegels zijn actief voor geautoriseerde beheerders; de drie databaseproeven, typesgeneratie en security-advisor zijn uitgevoerd. Applicatieversie: `1.20260719.5`.
Het organogram ondersteunt nu drie views via de filterbalk: `Afdelingen`, `Managerrelaties` en `Functiegroepen en star performers`. De managerweergave tekent direct op medewerker-managerrelaties zonder afdelingsvensters; de functieweergave groepeert op functiegroep → functie → star performer-niveau → medewerker en ondersteunt daardoor meerdere startpunten en losse medewerkers. De gekozen organogramview wordt nu ook correct in `user_preferences.ui_state.organizationChart` bewaard.

Laatste update: 2026-07-19. Dit is het compacte startpunt voor iedere nieuwe of geforkte chat. Lees daarna `docs/README.md`; neem geen secrets in documentatie op.

## Vaste architectuur

Liquid HR is een Nederlandstalig, i18n-klaar HR/payrollplatform op Next.js, Supabase en strict TypeScript. Bouwvolgorde is `schema → API → UI`. Tenantgrenzen zijn absoluut, autorisatie wordt server-side én met RLS afgedwongen en zichtbare tekst komt uit paritaire NL/EN-taalbestanden.

## Actuele stand

- HeRa is een data-first HR-agent met echte sessierollen/permissions, geautoriseerde lees- en voorsteltools, ownergebonden geheugen en voorkeuren. Lege toolvervolgreacties krijgen een veilige fallback in plaats van een databaseconstraint/500.
- De vijfstappenwizard publiceert atomair Employment, IKV-koppeling, plaatsing, arbeidsvoorwaarden, rooster, optioneel salaris en een kostenverdeling van exact 100%.
- Functiegroepen, functies en effective-dated functie- en salarisschaalrevisies zijn per administratie beheerbaar. Gepubliceerde revisies zijn onveranderlijk.
- Iedere medewerker heeft een veilig documentdossier met private opslag, metadata, tags, gecombineerde zichtbaarheid, signed downloads, soft-delete/herstel en vervalreminders.
- De dienstverbanddetailpagina bevat een responsieve tijdkaart en een afzonderlijke roosterpagina met 1–4-weeks werkpatronen, begin/einddatum en exacte controle tegen de contracturen.
- `/hr-calendar` toont alle medewerkers in een groot gelokaliseerd maandraster met roosters, niet-werkdagen, feestdagen, reminders en HR-wijzigingen. Zoeken, medewerker-/afdelingsfilters, 10/25/alle-max-100 paginering, doorklik en een uitbreidbaar dagdetail zijn aanwezig.
- HR-beheer staat achter één permission-gestuurde instellingenhub. Extra modules gelden tenantbreed; feestdagen kunnen per jaar en land vanuit Nager.Date worden geïmporteerd en lokaal worden aangevuld. Persoonlijke taal-, thema- en klokvoorkeuren blijven op een afzonderlijke pagina voor iedere ingelogde gebruiker.
- Autorisatiebeheer heeft drie werkruimtes: zoekbaar rechtenbeheer met groepsacties/dirty-state, een toegankelijke dekkingsheatmap en afzonderlijke organisatietoewijzingen. De visualisatie verleent nooit toegang; exacte permissions, scope en RLS blijven beslissend.
- Medewerkers kunnen nu als reversible archiefvlag worden beheerd. De lijst ondersteunt niet-gearchiveerd/gearchiveerd/alles, organogram en kalender sluiten gearchiveerden standaard uit, en de persoonskaart heeft duidelijke tabs voor persoonsgegevens, dossier en dienstverbanden. Foto's zijn private uploadbaar/verwijderbaar en zichtbaar in lijst en kalender; het organogramfilter onthoudt de laatste selectie per gebruiker.
- De medewerkerslijst gebruikt nu `ACTIVE_EMPLOYEE` als impliciete statusdefault en neemt in de zoekindex ook tussenvoegsel, afdeling en functie mee. Daardoor sluit de standaardtelling beter aan op de kalender. Personeelsnummers zijn zichtbaar in de lijst, zodat naamgelijkheden niet meer ogen als onbedoelde duplicaten.
- Het organogram ondersteunt nu naast de afdelingsboom ook een managerrelatie-weergave en een functieweergave met star performer-groepering. De mobile tree, canvasnodes, schema's, services en URL-state zijn daarop aangepast; de view-keuze wordt per gebruiker opgeslagen.
- Applicatieversie: `1.20260719.5` in `apps/hr-suite/lib/app-version.ts`; dashboardervaring, HR-adminaccordions, stamtabellen en Cloud-tagdocumentuploads staan op `main`.

## Live database en verificatie

- Supabase-project `wnpfloqpjvaacobppbpk` is gezond. De HeRa-migraties en migraties `20260718090000` t/m `20260718132000` zijn live toegepast.
- Live SQL-proeven voor HeRa-isolatie, volledige dienstverbandpublicatie, functie/salarisrevisies, documentdossiers, HR-change-projectie en kalenderautorisatie zijn geslaagd.
- De samengevoegde releasegate is geslaagd: 72 Vitest-bestanden met 271 tests, 18 gelijke NL/EN-namespaces, strict TypeScript, ESLint en een productiebuild met 51 routes.
- Supabase security advisor meldt alleen uitgeschakelde leaked-password protection. Deze functie is vanaf Pro beschikbaar en binnen het huidige abonnement niet inschakelbaar; dit is een geaccepteerde abonnementsbeperking.
- Preview `https://liquidhr-pbftcw6t7-edwinitsolutions.vercel.app` is `READY`; een anonieme aanvraag voor `/settings` gaat veilig naar `/login?next=%2Fsettings`.
- Release `1.20260718.3` staat op `https://liquid-hr-hr-suite.vercel.app`. De instellingenhub, tenantmodules, Nager.Date-preview, persoonlijke instellingen en de volledige maandkalender zijn met een bestaande ingelogde HR-adminsessie gecontroleerd. De kalenderformattering volgt nu de actieve NL/EN-taal.
- Release `1.20260718.4` is lokaal gebouwd en branch `codex/settings-rosters-calendar` is naar GitHub gepusht. Een Vercel CLI-deploy kon in deze sessie niet starten omdat de lokale Vercel-credentials ontbreken; de gekoppelde Git-deployment kan de branch als preview oppakken.
- Runtime-hotfix: `employees.is_archived` had in Supabase wel de kolom maar geen expliciete `SELECT`/`UPDATE`-grant voor `authenticated`. De grants zijn live toegevoegd en de PostgREST-schema-cache is herladen; dit herstelt de medewerkerlijst en kalender.
- Verificatie 2026-07-19 (medewerkerslijst + organogramviews): gerichte ESLint `--fix` met cache op de in deze beurt gewijzigde organogrambestanden is geslaagd. Strict TypeScript, `check:i18n` en gerichte Vitest voor `app/api/organization-chart/route.test.ts`, `lib/organization-chart/schemas.test.ts` en `lib/organization-chart/projector.test.ts` zijn geslaagd. Runtimecontrole met timeouts bevestigt opnieuw een actieve Next-devserver op poort `3000`; `/`, `/employees` en `/organization-chart` reageren zonder serverfouten en redirecten beschermd naar login. Poort `3001` reageert niet en wordt in deze worktree niet gebruikt.

## Bewust resterend werk

1. Basis/IKV en organisatieplaatsing op de bestaande dienstverbanddetailtabs mutabel maken.
2. Nieuwe persoonskaart vanuit de dienstverbandflow bij geen identity-match.
3. Externe ketenhistorie en cao-uitzonderingen beheren.
4. Globale documenten, bulk-loonstrookimport en AI-compliance/OCR/RAG.
5. Vrije Liquid Display-query's en verdere HeRa-transactietools.
6. Dashboardwidgets hebben nu tenantconfiguratie, roltoegang, registry, vertaalde metadata, categorie-picker, serverbootstrap, parallelle streaming, skeletons, globale laadvoortgang en refresh. WELCOME, reminders, organisatie en medewerkers laden echte bestaande bronnen; overige cataloguswidgets tonen eerlijk dat hun bron nog wordt aangesloten, zonder fictieve HR-cijfers.
7. De nieuwe organogramviews zijn technisch gevalideerd, maar vragen nog een ingelogde visuele browsersessie om de echte dataset, meerdere startpunten en star performer-groepering UX-matig te controleren.

## Handmatige productieacties

- Heroverweeg leaked-password protection alleen bij een toekomstige Supabase-upgrade naar Pro of hoger.
- Configureer SMTP, Google OAuth/redirects en stabiele server-only secrets per omgeving.

Zie `docs/delivery/HANDMATIGE_ACTIES.md` voor de externe actielijst. Gebruikerswijzigingen in dat bestand en `package-lock.json` worden niet overschreven.

## Hervatten

1. Lees `AGENTS.md`, `docs/README.md` en dit bestand.
2. Controleer werkboom, branch, poort 3000, Supabase en Vercel opnieuw.
3. Gebruik `docs/delivery/IMPLEMENTATION_STATUS.md` en de relevante requirements voor resterend werk.
4. Werk na iedere materiële slice dit bestand en de status bij.
