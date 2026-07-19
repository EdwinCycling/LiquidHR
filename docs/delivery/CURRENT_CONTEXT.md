# Actuele overdracht Liquid HR

Vervolgslice 2026-07-19: HR-admininstellingen gebruiken standaard gesloten accordions met terugnavigatie naar de juiste sectie. `/master-data` bevat beheersbare interne uitdienstredenen, documentcategorieën en tenant-relatietypen, plus links naar functie- en salariscatalogi. Documentuploads selecteren uitsluitend actieve Cloud tags uit `star_performer_tags`; de oude upload-uitlegtekst is verwijderd. De org-chart canvas gebruikt meer laagruimte en duidelijk onderscheiden verbindingslijnen. Migratie `20260719170000_add_tenant_relation_type_catalog.sql` is live toegepast met RLS, seedrecords en database-smokecontrole. Applicatieversie volgt na de releasegate.

Vervolgslice 2026-07-19: de medewerkerslijst en het organogram in worktree `settings-rosters-calendar` zijn functioneel verdergetrokken. De medewerkerslijst filtert nu standaard op `ACTIVE_EMPLOYEE`, zodat de telling logischer aansluit op de kalender. De lijst toont daarnaast expliciet het personeelsnummer per rij, zodat twee verschillende personen met dezelfde naam niet meer ogen als een render-dubbeling. De bestaande analyse blijft: het eerdere verschil `11` versus `23` kwam vooral voort uit verschillende definities van "zichtbare medewerker" tussen kalender en medewerkerslijst, niet uit een eenvoudige dubbele-renderbug.

De migraties voor strengere dossieruploads, persoonlijke weeknummering en Star Performers zijn op 2026-07-19 live toegepast. De Star Performer- en Cloud tags-tegels zijn actief voor geautoriseerde beheerders; de drie databaseproeven, typesgeneratie en security-advisor zijn uitgevoerd. Applicatieversie: `1.20260719.1`.
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
- Applicatieversie: `1.20260718.5` in `apps/hr-suite/lib/app-version.ts`; dashboardervaring en HR-adminwidgetbeheer zijn doorgevoerd op branch `codex/settings-rosters-calendar`.

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
