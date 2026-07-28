# Actuele overdracht Liquid HR

## Release-status 2026-07-28

Branding is nu remote actief op Supabase-project `wnpfloqpjvaacobppbpk`: migratie `20260728110000_administration_branding.sql`, private storage-bucket, RLS/policies, `settings:write` voor `TENANT_ADMIN` en `user_preferences.use_company_theme` zijn live gecontroleerd. Applicatieversie: `1.20260728.5`. GitHub push en Vercel-verificatie volgen in deze releaseflow.

## Update 2026-07-28: consistente dienstverbandprojectie en bedrijfsstijl

De medewerkerslijst en medewerkerdetailpagina gebruiken voor dienstverbanden dezelfde RLS-geautoriseerde tenantprojectie. De detailroute blokkeert niet langer ten onrechte een zichtbaar dienstverband uit een andere administratie; de tenant- en permissiongrenzen blijven server-side en via RLS gelden. Lina Bakker met twee dienstverbanden wordt hierdoor in beide schermen consistent weergegeven. Klikbare medewerker- en dienstverbandkaarten gebruiken expliciet `cursor-pointer` en behouden `prefetch={false}` op dynamische detailroutes.

Onder Instellingen → Platform & uitbreidingen is lokaal een tegel **Bedrijfsinstellingen** toegevoegd. De pagina heeft een harmonica-onderdeel voor bedrijfskleuren en logo. De nieuwe administratiegebonden tabel/storage-bucket/RLS staan in migratie `20260728110000_administration_branding.sql`; de API ondersteunt kleuren, privé-logo-upload en verwijderen. De bedrijfsstijl wordt server-side als standaardthema geladen en kan in persoonlijke instellingen door een gebruiker worden overschreven; logo's verschijnen in de sidebar-header en de startbanner. i18n, strict typecheck en lint zijn geslaagd. Remote migratie toepassen, Supabase-advisors en officiële typegeneratie blijven open omdat remote writes niet zonder expliciete toestemming zijn uitgevoerd; de gekoppelde Supabase-MCP-readverbinding werkt wel. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-28: dienstverbandkaarten en aanmaakwizard

De medewerkerdetailpagina toont dienstverbanden administratiegebonden, zodat een zichtbare kaart niet meer naar een andere administratie kan verwijzen en daardoor 404 geeft. De kaarten zijn samenvattingen zonder beëindig- of verwijderactie, vullen de beschikbare breedte en staan vanaf twee dienstverbanden in twee kolommen. Iedere kaart is als geheel klikbaar en bevat een duidelijke detailactie met pointer-cursor. **Nieuw dienstverband** staat rechts onder de lijst en opent een modal met de bestaande wizard; annuleren sluit de modal en bewaren gaat door naar het nieuwe dienstverbanddetail. Primaire knoppen gebruiken nu overal de handcursor; employment-kaarten doen dat expliciet als klikbare lijstitems. Check:i18n, strict typecheck en lint zijn geslaagd. De lokale runtimecontrole kon niet worden uitgevoerd omdat poort 3000 niet luistert na een bestaande startconflictmelding; er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-28: verzuimvisualisatie in kalender

De kalender gebruikt nu de administratiegebonden actieve verzuimcasusprojectie. Zieke dagen krijgen rode cellen; dagen na vandaag tot en met `expected_recovery_on` krijgen rood gearceerde cellen. Naast medewerkers met een actieve casus staat in de eerste kolom een klikbaar ziekte-icoon naar `/employees/[employeeId]?tab=absence`. `RECOVERY_WINDOW` wordt niet als ziek weergegeven. Zonder `absence:read` worden verzuimdetails niet geladen. De databasecontrole bevestigde de gebruikte kolommen en twee actieve casussen op testproject `wnpfloqpjvaacobppbpk`. De datumhelpertest (11 tests), check:i18n, strict typecheck en lint zijn geslaagd.

## Update 2026-07-28: Star Performers naar Workforce verplaatst

Star Performers en Cloud tags zijn uit `Instellingen` verwijderd en verhuisd naar `/workforce` met de routes `/workforce/star-performers` en `/workforce/star-performer-tags`. Oude `/settings/...`-routes blijven als redirects bestaan; de bestaande permission `star-performer:read` blijft server-side gelden. De Workforce-pagina toont deze twee beschikbare vensters naast de eerdere work-in-progress-vensters. Check:i18n, strict typecheck en lint zijn geslaagd; anonieme routechecks redirecten correct naar login.

## Update 2026-07-28: Workforce-navigatie en WIP-pagina

De hoofdnavigatie bevat nu `Workforce` direct boven `Instellingen`, inclusief opname in Menu sorting en migratie van bestaande opgeslagen menuvolgordes. `/workforce` toont een responsive tweekoloms-pagina met de work-in-progress-vensters `9-grid` en `Functioneringsgesprekken`. Beide NL/EN-vertalingen zijn toegevoegd. Check:i18n, strict typecheck en lint zijn geslaagd; de anonieme runtimecontrole bevestigde de verwachte redirect naar `/login?next=%2Fworkforce`.

## Update 2026-07-28: reminder-dialog boven dashboardlaag

De reminder-detaildialog vanuit de Tijdhub wordt via een portal naar `document.body` gerenderd. Daarmee blijft de dialog niet langer gevangen in de getransformeerde, `overflow-hidden` sidebar en opent hij viewport-gecentreerd boven het hoofdscherm. De hydration-guard gebruikt `useSyncExternalStore`. Gerichte ESLint en strict TypeScript zijn geslaagd; ingelogde browsercontrole van de reminderklik blijft open omdat de lokale browser geen sessie had.

## Update 2026-07-28: werkurentypen bij verlofregels

Werkurentypen ondersteunen drie algemene instellingen (actief, selfservice en vastpinnen in de kalender), dezelfde vier beperkingstypen als overuren en administratiegebonden uitzonderingen voor één of meerdere medewerkers. De geavanceerde tab blijft leeg als toekomstige uitbreidingsplek.

Migraties `20260728072505_work_hour_type_settings_and_restrictions.sql` en `20260728074000_harden_work_hour_restriction_grants.sql` zijn toegepast op gekoppeld Supabase-testproject `wnpfloqpjvaacobppbpk`; officiële DB-types zijn opnieuw gegenereerd. Werkuren delen bewust de bestaande overwerkbeperkingstabellen en administratie-/RLS-scoping. De SQL-configuratiecheck, 385 tests, lint, TypeScript, i18n en productiebuild zijn geslaagd. Applicatieversie is `1.20260728.4`. Er is nog niet gedeployed naar GitHub.

Afronding van deze slice: ESLint, volledige testset (384 tests), productiebuild en anonieme browsercontrole zijn inmiddels ook geslaagd. De instellingenroute stuurt zonder sessie veilig naar login met 0 console-errors; alleen een bestaande preload-warning blijft zichtbaar.

## Update 2026-07-28: bonusverlof leeftijd en anciënniteit

Leeftijd en anciënniteit zijn nu een afzonderlijk verlofopbouwtype naast contracturen en werkuren. De officiële aanvulling staat in [`docs/requirements/leave/Verlof_Bonus_Regelingen_Addendum.md`](../requirements/leave/Verlof_Bonus_Regelingen_Addendum.md). De bestaande bonusentiteiten, enums, RPC, RLS en audittriggers zijn aangevuld met een constraint die `AGE_SENIORITY` uit gewone opbouwregels houdt. De catalogus-API levert nu ook traptreden; het verloftype toont aparte tegels voor `AGE` en `SENIORITY`, met meerdere treden, timing, pro-rata eerste jaar, FTE-basis en samenvatting. De pure engine berekent de hoogste blijvende trede, triggerdatum, FTE en pro-rata.

Migratie `20260728065641_separate_bonus_accrual_basis.sql` is toegepast op gekoppeld Supabase-testproject `wnpfloqpjvaacobppbpk`; live verificatie bevestigde de nieuwe constraint zonder `AGE_SENIORITY`, beide bonus-enums, RLS op `leave_bonus_rules`/`leave_bonus_tiers` en de migratiestatus `applied`. De read-only SQL-contracttest is geslaagd. Advisors tonen alleen eerder bekende waarschuwingen buiten deze slice. `packages/db/types.ts` is opnieuw gegenereerd. Typecheck, i18n en de relevante 20 tests zijn geslaagd; lint, volledige tests, build en ingelogde browsercontrole blijven open. Applicatieversie is `1.20260728.3`. Er is niet gedeployed, gepusht of gecommit; ongerelateerde `.qoder/repowiki`-wijzigingen zijn behouden.

## Update 2026-07-28: verloftype-instellingen en opvolgende opbouwregels

De verlofopbouwbeheerflow is uitgebreid met algemene verloftype-instellingen, uitgebreide kleurkeuze/kleurgebruik, effectieve opbouwregelketens en uitzonderingen. Bestaande verloftypen en regelversies blijven alleen-lezen; wijzigingen lopen via archiveren of een opvolger. De regel-editor ondersteunt contracturen, werkuren met één of meer gewone/overwerktypen, de voorbereidende basis leeftijd/anciënniteit, periode, opbouwmoment, uren/minuten(/seconden), pauzes, vervaltermijn en een onderste samenvatting. Uitzonderingen ondersteunen één of meerdere medewerkers, selfservice, geen opbouw/aangepaste hoeveelheid, samenvatting en paginering per tien.

Supabase-migraties `20260728062208` en `20260728063339` zijn uitgevoerd op de gekoppelde testdatabase en als `applied` geregistreerd. Live schema-controle bevestigde de enumwaarde `AGE_SENIORITY`, vijf verloftypekolommen, de regelconstraint, successor-RPC en RLS op `leave_types`/`leave_accrual_rules`. Advisors tonen alleen bestaande waarschuwingen buiten deze slice. `packages/db/types.ts` is opnieuw gegenereerd. Typecheck, lint, i18n en 382 tests zijn geslaagd; productiebuild en ingelogde browsercontrole blijven open. Applicatieversie is `1.20260728.2`. Er is niet gedeployed, gepusht of gecommit; ongerelateerde `.qoder/repowiki`-wijzigingen zijn behouden.

## Update 2026-07-28: verlofopbouw en overwerkbeheer lokaal uitgebreid

De lokale slice voor `/settings/leave-accrual` is uitgebreid. Actieve catalogustabbladen zijn visueel duidelijker, de driepuntmenukaart opent acties en een overzicht van bestaand kleurgebruik. De kleurkeuze bevat nu twaalf CSS-tokens. Bestaande verloftypen, werkurentypen en opbouwregels kunnen niet meer vanuit de UI worden bewerkt; opbouwregels worden via successor-versies gewijzigd en catalogusitems kunnen alleen worden gearchiveerd. De migratie `apps/hr-suite/supabase/migrations/20260728052250_configure_overtime_restrictions_and_immutable_catalog.sql` voegt immutable triggers toe.

Overuren hebben nu een aparte, administratiegebonden configuratielaag: globale beperking onbeperkt/maanduren/jaaruren/contracturen × factor, manager inlichten bij invoer, selfservice en medewerkeruitzonderingen. De uitzonderingendialoog ondersteunt één persoon of meerdere medewerkers en de optie **Mag geen overuren schrijven**. `/api/leave/overtime` verwerkt instellingen en uitzonderingen server-side met `leave:write`; na succes ververst de UI de lijst en toont zij een toast.

Verificatie: strict typecheck, lint, i18n, 380 tests en productiebuild zijn geslaagd. De migratie is op de gekoppelde testdatabase uitgevoerd en de nieuwe tabellen, enum, RLS/policies en triggers zijn live gecontroleerd. De migratiehistorie toont `20260728052250` als applied. Supabase advisors geven alleen bestaande waarschuwingen buiten deze slice. `packages/db/types.ts` is officieel opnieuw gegenereerd vanaf de testdatabase; ingelogde browsercontrole blijft open. Applicatieversie is `1.20260728.1`. Er is niet gedeployed, gepusht of gecommit. De bestaande ongerelateerde `.qoder/repowiki`-wijzigingen zijn behouden.

## Update 2026-07-27: release naar GitHub en Vercel

Applicatieversie `1.20260727.6` en de volledige geautoriseerde werkboom zijn vastgelegd in commits `c1a7fbe` en `eaf850a` op `main` en naar `origin/main` gepusht. GitHub bevestigt remote commit `eaf850ae513a04e942944a3cce078a3b3cd939c6`. De gekoppelde Vercel-deployment is voltooid (`success`) via [deployment 4GZVgjp5SY5wHfmnXdGGBej2Hjnt](https://vercel.com/edwinitsolutions/liquidhr/4GZVgjp5SY5wHfmnXdGGBej2Hjnt). De productiehost `https://liquid-hr-hr-suite.vercel.app` is bereikbaar en stuurt anonieme dashboardbezoeken correct naar `/login`; een ingelogde productiecontrole blijft een handmatige vervolgstap.

## Update 2026-07-26: éénknopswissel employment-header

De header op de employmentdetailpagina gebruikt nu dezelfde bediening als de medewerkerheader: er is altijd precies één knop zichtbaar. In uitgebreide modus toont de knop **Compact**; in compacte modus toont de knop **Uitgebreid**. De bestaande tab- en view-queryparameters blijven behouden. Applicatieversie is `1.20260726.5`. Typecheck, lint, de versiecheck en lokale runtimecontrole zijn geslaagd; de server luistert op poort 3000 en de interne browser gaf geen errors of warnings. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-26: start uitvoering Verzuim

De Verzuim- en WvP-brondocumenten uit `C:\Users\Edwin\Downloads` zijn vertaald naar leidende requirements, ADR-0005 en FDR-0002. Het model gebruikt `absence_case` per `employment_id` met één of meer `absence_spells`; medische oorzaken, diagnoses en vrij medische tekst zijn uitgesloten. De gebruiker heeft volledige uitvoering met databasewijzigingen, versienummerverhoging en browsercontrole op poort 3000 gevraagd. Supabase-project: `wnpfloqpjvaacobppbpk`.

## Update 2026-07-26: verzuim verticale slice lokaal uitgevoerd

De pure verzuimengine en Zod-contracten zijn geïmplementeerd met 9 geslaagde tests. De lokale migratie `20260726150000_add_absence_core.sql` bevat `absence_settings`, `absence_cases`, `absence_spells`, `absence_capacity_changes`, RLS/policies, audittriggers en de beveiligde RPC's `report_absence` en `recover_absence`. De API-routes `/api/absence/report`, `/api/absence/recovery` en `/api/absence/employees/[employeeId]` zijn toegevoegd. Het medewerkerdashboard heeft een echt verzuimvenster, de medewerkerdetailpagina een tab Verzuim en de kalender linkt vanuit de medewerkeractie naar ziek melden. Applicatieversie is `1.20260726.7`.

Typecheck, lint, i18n-pariteit, productiebuild en lokale login/browsercontrole op poort 3000 zijn geslaagd. Remote toepassing van de migratie en officiële typesgeneratie konden in deze beurt niet worden uitgevoerd omdat de Supabase-MCP-bewerking niet beschikbaar was en de CLI geen databasewachtwoord heeft; voer dit uit vóór live gebruik en controleer daarna advisors, RLS-isolatie en `packages/db/types.ts` opnieuw.

## Handoff voor volgende chat

Start vanuit `C:\Users\Edwin\Documents\Apps\LiquidHR`, lees eerst `AGENTS.md` en ga verder vanaf dit bestand. Alle bestaande wijzigingen horen bij één nog niet gedeployde release. Behoud versie `1.20260728.3` tenzij de volgende wijziging opnieuw een versieophoging vereist. Controleer bij hervatten opnieuw de lokale server, git-status en Supabase-migratiehistorie; neem de huidige poort-3000-processen en browser-tabs niet blind over.

## Update 2026-07-26: custom fields en functiecatalogusbeheer

Custom fields kunnen in HR Admin worden beheerd met een lijst-eerst-scherm, bewerken van niet-technische eigenschappen, actieve/inactieve status, sortering op label of status, landcode en een live preview onderaan het ingeklapte formulier voor nieuwe velden. De technische sleutel en het veldtype blijven bewust onveranderlijk. Verwijderen vraagt bevestiging en wordt geblokkeerd wanneer waarden het veld gebruiken. Inactieve velden blijven in de database maar worden niet meer aan medewerkers getoond. Functies kunnen aan meerdere functiegroepen worden gekoppeld; de HR Admin-catalogus begint met functiegroepen en toont daarna de gerelateerde functies. Functies en groepen hebben CRUD en een actieve status; verwijderen is geblokkeerd wanneer relaties bestaan. Migraties `20260726093311_custom_fields_and_job_catalog_management.sql`, `20260726094618_split_job_group_jobs_policies.sql` en `20260726094654_index_job_group_jobs_group_scope.sql` zijn toegepast op test-Supabase-project `wnpfloqpjvaacobppbpk`. De SQL-regressieproeven voor countrycode, meerdere functiegroepen en inactieve functiegroepen zijn geslaagd. 97 testbestanden/355 tests, typecheck, lint, i18n, productiebuild en de lokale browsercontrole zijn geslaagd. Applicatieversie is `1.20260726.4`. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-26: employmentlijst, dienstverbandvenster en dashboard-refresh

De employmentlijst toont geen overbodig aantal meer, verwijdert de onduidelijke verwijderactie, gebruikt **Dienstverband wijzigen**, toont meerdere kaarten in twee kolommen en sorteert op startdatum aflopend met primaire dienstverbanden eerst bij gelijke datum. De dienstverbanddetailkop gebruikt dezelfde compacte/uitgebreide opzet als de medewerkerkop, toont e-mail en telefoon onderaan en markeert expliciet dat het om een dienstverband gaat. Compact toont alleen een kleine foto en naam; dit geldt voor medewerkerdetail en dienstverbanddetail. Het employment-overview toont **Werk in uitvoering** als AI-samenvatting; Follow-up actions en More about this employee zijn uit de applicatiecode verwijderd. De dashboardwidgets worden niet meer via de instabiele server-Suspense-stream geladen, waardoor de automatische refreshlus is gestopt; handmatig vernieuwen blijft beschikbaar. Applicatieversie is `1.20260726.3`. Typecheck, lint, i18n, 353 tests en productiebuild zijn geslaagd. De lokale server draait op poort 3000 en de open interne browser-tab bleef vijf seconden zonder waarschuwingen of fouten. Er is geen databasewijziging nodig en er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-26: medewerkerdetail, notities en reminders

De medewerkerdetailpagina heeft nu Notes na Dossier met server-side toegang voor HR Admin en Manager, automatische auteur/tijdregistratie, aflopende sortering en rolafhankelijke verwijderrechten. Profile/external links staan op het medewerkerdashboard; Additional Information is een eigen tab na Relations. Reminders tonen eerst de bestaande lijst, ondersteunen beschrijving, wijzigen/verwijderen en datumverschuivingen; nieuwe reminders starten op de huidige lokale datum/tijd. De medewerkerkop toont actieve status, huidige functie, afdeling en manager. Migraties `20260726061219_employee_notes_and_detail_access.sql` en `20260726062600_harden_employee_notes_grants.sql` zijn toegepast op test-Supabase-project `wnpfloqpjvaacobppbpk` en gecontroleerd met RLS/grants. Applicatieversie is `1.20260726.2`. Typecheck, lint, i18n, 354 tests, build en een ingelogde lokale browsercontrole zijn geslaagd. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-07-26: Personal Details beheer en adresreminders

De tabs Persoonsgegevens, Adressen, Bankrekeningen en Relaties zijn opnieuw ingericht met gegroepeerde formulieren, lijst-eerst-weergave, wijzigen en verwijderen. Het enige actieve adres kan niet worden verwijderd; de database-trigger `prevent_last_employee_address_archive` bewaakt dit ook buiten de UI. Een nieuw adres kan optioneel direct reminders publiceren voor HR Admin, Manager en/of Medewerker. De HR Admin-reminder bevat aanvullend `Controleer reiskosten etc.`. Migratie `20260726054248_personal_details_management.sql` is toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; de bestaande bank-account-permission blijft standaard HR-admin-only en is via de bestaande autorisatiematrix instelbaar. Applicatieversie is `1.20260726.1`. Tests, lint, strict TypeScript, i18n, SQL-contractproef en productiebuild zijn geslaagd. Er is niet gedeployed; de lokale ingelogde Personal Details-browsercontrole blijft open omdat de lokale browser geen gebruikerssessie had.

## Update 2026-07-25: adresinvoer gebouwd en remote schema toegepast

De adresinvoerflow is lokaal gebouwd volgens de requirements in `docs/requirements/core-hr/ADRESINVOER.md`. `employee_addresses` ondersteunt nu vrije internationale adresregels, herkomstmetadata (`manual`, `pdok`, `geoapify`), genormaliseerde postcodes en landafhankelijke verplichtingen in migratie `20260725132351_address_input_internationalization.sql`. De serverroutes `/api/address-suggestions` en `/api/address-lookup` houden providercalls server-only; zonder `GEOAPIFY_API_KEY` blijft buitenlandse handmatige invoer beschikbaar. De medewerkerkaart ondersteunt landkeuze, debounce-suggesties, PDOK-postcodeaanvulling en handmatige invoer. De zoek-UX focust standaard het adreszoekveld, toont een zoek-/locatie-icoon, houdt land en resultaten bovenaan uitgelijnd en verduidelijkt dat postcode + huisnummer straat en plaats automatisch invullen. De applicatieversie is `1.20260725.2`. Lokaal zijn 97 testbestanden/353 tests, lint, strict TypeScript, i18n-pariteit en productiebuild geslaagd. De migratie is op 2026-07-25 toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; live controle bevestigde de nieuwe kolommen, vijf constraints, index en één gemigreerd adresrecord. De lokale browsercontrole kon in deze beurt niet afronden omdat de devserver op poort 3000 geen HTTP-response teruggaf.

## Update 2026-07-24: release naar main en lokale runtime

De release is volgens de vaste workflow fast-forward naar `main` gebracht en naar `https://github.com/EdwinCycling/LiquidHR.git` gepusht als commit `24b278b`. Daarmee kan Vercel Production de versie vanaf GitHub `main` bouwen. De eerdere featurebranchtekst hieronder is historische releasevoorbereiding; de actuele bron van waarheid is `main`.

Lokale runtime: de Next-devserver draait als losgekoppeld Windows-proces op poort `3000`; een controle op `http://localhost:3000/` geeft de verwachte `307`-redirect naar login.

## Update 2026-07-24: medewerkerdashboard tweede UI-slice

Applicatieversie verhoogd naar `1.20260724.2`.

Releasevoorbereiding: de feature-release staat op branch `agent/employee-dashboard-release` als commit `22af0f3` (`feat: release employee dashboard and reporting updates`). Remote schemahardening, officiële DB-types en verificatiedocumentatie staan in commit `4e7dc10` (`chore: verify employee dashboard release`). Beide commits zijn naar `https://github.com/EdwinCycling/LiquidHR.git` gepusht. De gekoppelde Vercel-preview `dpl_FdgnfHrhT4tPi6W7gtLQZY4R9jKD` is `READY` op `https://liquidhr-git-agent-employee-dashboard-release-edwinitsolutions.vercel.app` en verwijst exact naar commit `4e7dc10083655b31ff04e5092542caf896e049f8`. Productie volgt nog steeds `main`; deze featurebranch is niet naar productie gepromoveerd.

Het dashboard heeft nu genderafhankelijke avatarfallbacks: foto, anders een man-/vrouw-silhouet en voor `OTHER`/`PREFER_NOT_TO_SAY` initialen. Reminders worden als echte, geautoriseerde kaart onder contract/salaris geladen. Salaris wordt bij openen van het dashboard niet meer opgehaald; na `salary:read` en hover/toetsenbordfocus haalt `/api/employees/[employeeId]/salary` de waarde op en verbergt de kaart haar weer bij verlaten.

De brede en smalle widgets hebben vaste kolomgrenzen en een persoonlijke, via drag-and-drop of toetsenbord te wijzigen volgorde in `user_preferences.ui_state.employeeDashboard`. De nieuwe activity-feed ondersteunt een echte handmatige notitie via `employee_activity_entries`, met server- en RLS-permissions `employee-activity:read/write`; er wordt geen demo-inhoud ingezaaid. Migratie `20260724160000_add_employee_activity_entries.sql` is remote toegepast. De aanvullende migratie `20260724172716_harden_employee_activity_entries.sql` voegt de ontbrekende FK-indexen toe, initialiseert `auth.uid()` eenmaal per statement en trekt onbedoelde default grants voor `anon` in. Remote controle bevestigt RLS, twee policies, alleen `SELECT`/`INSERT` voor `authenticated` en geen toegang voor `anon`. De advisors tonen voor deze tabel geen open security- of FK-indexbevindingen; de resterende advisorbevindingen zijn bestaand. `packages/db/types.ts` is opnieuw uit de gekoppelde database gegenereerd.

Verificatie: na de officiële typesgeneratie en schemahardening is de volledige releasegate opnieuw groen: 95 Vitest-bestanden/347 tests, ESLint, strict TypeScript, 21 paritaire i18n-namespaces en productiebuild met 85 pagina's. Een ingelogde Chrome-controle op de actuele branch bevestigde: salaris blijft gemaskeerd tot hover en wordt daarna weer verborgen; widgetvolgorde wijzigt, blijft na herladen staan en is na de proef hersteld; de geautoriseerde reminderkaart en Tijdhub tonen de echte lege toestand; de beschikbare mannelijke en vrouwelijke profielfixtures gebruiken de bedoelde silhouetfallback; de console bleef zonder errors. Een anonieme salarisaanvraag krijgt `401`. Een ingelogde beperkte-rol-deny en de initialenfallback voor `OTHER`/`PREFER_NOT_TO_SAY` konden niet live worden beproefd, omdat de gekoppelde database slechts één actieve `TENANT_ADMIN`-toewijzing en geen zulke genderfixtures bevat; productie-rollen en persoonsgegevens zijn daarvoor bewust niet tijdelijk gewijzigd.

## Update 2026-07-24: medewerkerdashboard eerste UI-slice

De leidende requirements staan in `docs/requirements/core-hr/MEDEWERKER_DASHBOARD.md`. De standaardroute `/employees/[employeeId]` toont nu een kleurrijk medewerkerdashboard met een vaste knop naar **Medewerkerdetails** en de bestaande detailtabs er direct achter. Persoons-, contact-, organisatie-, dienstverband-, salaris-, vrije-veld- en documentinformatie wordt alleen uit bestaande geautoriseerde projecties getoond. Niet-bestaande modules (onder meer verzuim, activa, wagenpark en performance) zijn herkenbare lege vensters zonder voorbeeldrecords, cijfers of andere fake data.

Medewerkerlijst, organogram, kalender en Insights verwijzen naar dezelfde dashboardroute; medewerkersnamen in Insights en aankomende gebeurtenissen zijn klikbare links. Vanuit het dashboard blijven dienstverbanden en de knop **Medewerkerdetails openen** expliciete terugpaden naar detailtabs. De requirements leggen per rol en per widget self-, manager-, HR/admin- en custom-scope vast, inclusief server-side permissionchecks en RLS.

Verificatie: strict TypeScript, gerichte ESLint, i18n-pariteit en productiebuild zijn geslaagd. De lokale browserroute is alleen anoniem gecontroleerd en redirect naar login; een ingelogde visuele controle van dashboard en deny-cases blijft open. De volgende stap is een geauthenticeerde matrixcontrole en releasegate met de nieuwe links.

## Update 2026-07-24: rapportexports en periodeweergave

Insights-exports bevatten nu standaard `Administratienr` en `Medewerkernr` als eerste twee kolommen, vóór de medewerkernaam; dit geldt voor medewerker- en aankomende-gebeurtenissenexports. Rapportperioden ondersteunen maand, volledig jaar en meerjarige vensters van 3 of 5 jaar. Trendgrafieken tonen een numerieke y-as; datumreeksen in de rapportweergave gebruiken een pijl als scheidingsteken.
Bij langere trendperioden worden x-aslabels automatisch uitgedund zodat de volledige trend leesbaar blijft; alle datapunten en tooltips blijven aanwezig.

## Update 2026-07-24: Inzichten-permissions en persoonlijke rapportvoorkeuren

De Insights-catalogus is gegroepeerd in Medewerkers, Verlof, Verzuim en Overige rapportages. Elke rapportage heeft een eigen functiepunt in de lokale migratie `20260724095433_insights_report_permissions.sql`; `TENANT_ADMIN` en `HR_ADMIN` krijgen alle rapportrechten standaard. De navigatie en rapportteller gebruiken uitsluitend deze rapportrechten. De live medewerkersrapporten gebruiken RLS-gebonden databasegegevens en bieden per geopend harmonica-item CSV-export met precies de actieve filters. De actieve-selectiekaart is inklapbaar en, samen met de optionele per-rapport filteropslag, persoonlijk bewaard in `user_preferences.ui_state.insights`.

Verificatie: strict TypeScript en i18n-pariteit zijn geslaagd. De migratie staat in de remote migratie-inventaris. Open: rechtenmatrix/browser met een beperkte rol controleren, privacydrempel voor kleine groepen en exportaudit.

## Update 2026-07-24: Inzichten-catalogus en rapportagefundering

De nieuwe route `/insights` staat in de linker navigatie onder Kalender en boven Instellingen. De pagina heeft een gesloten harmonica-catalogus voor **Verlof in beeld**, **Medewerkerbestand**, **Verzuim**, **Balansvoorziening verlof** en **WvP-voortgang**. Verlof en medewerkerbestand hebben een rapport-specifieke filteropzet met groepering, periode, afdelingsfacet, aanvullende domeinfilters, sortering en weergavekeuze; de geselecteerde rapportkaart staat deelbaar in `?report=`. De UI toont bewust geen gefingeerde cijfers: alleen de rapportvisualisatie en actieve selectie staan klaar totdat veilige data-projecties bestaan. Verzuim, voorziening en WvP zijn eerlijk gemarkeerd als later werk.

Het leidende document is `docs/requirements/reports/RAPPORTAGES_EN_INZICHTEN.md`. De medewerkercatalogus is nu gesplitst in **Personeel per afdeling**, **Personeel per geslacht**, **Personeel per leeftijd** en **Reden uit dienst**. De route gebruikt de bestaande `employee:read`-autorisatie en RLS-scoped medewerker-, dienstverband-, organisatie- en terminationdata via `lib/insights/employee-report-service.ts`; filteropties komen uit dezelfde administratie, en foutpaden tonen geen demo-data. Team, segment, reden en medewerkerstatus zijn afzonderlijke filters; de periode heeft maand-/jaargrid, Vandaag en Volledig jaar tonen. Vóór verdere publicatie moet de zelfstandige canonieke permission `insights:read` worden toegevoegd, gevolgd door kleine-groepenbescherming en exportaudit. Verificatie van deze slice: i18n-pariteit en strict TypeScript zijn geslaagd.

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

## Update 2026-07-24: inzichten, roltoewijzingen en platforminstellingen

De Insights-werkruimte heeft nu een blijvende smalle instellingenrail die na inklappen opnieuw geopend kan worden, een semikolon-CSV met UTF-8-BOM voor Excel, en toastmeldingen voor exportresultaten. De trendweergave gebruikt één lijn-grafiek op basis van dezelfde geselecteerde, geautoriseerde rapportdata.

Organisatietoewijzingen zijn uit Rollen en autorisaties gehaald. De nieuwe pagina `/role-assignments` beheert expliciete leidinggevende en tenantbrede aanvullende rollen met zoeken, rolfilter, matrixlijst, verwijderen, export en controlewaarschuwing wanneer de actuele afdelingsplaatsing van een medewerker niet meer overeenkomt met de rolscope. Een functiewijziging binnen dezelfde afdeling laat de rol bestaan; een afdelingswijziging vraagt HR om de toewijzing bewust te beëindigen of te verplaatsen. De medewerkerkaart toont de actieve roltoewijzingen en afdelingsscope.

Migratie `20260724112407_add_role_assignment_scope.sql` is live toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. `TENANT_ADMIN` en `EMPLOYEE` zijn tenantbreed; `DIRECT_MANAGER` en zelfgemaakte organisatiegebonden rollen vereisen een afdeling. Organogramprojectie gebruikt alleen organisatiegebonden toewijzingen met afdeling. Module-opslag ververst nu de layout direct. Platforminstellingen bevatten een menuvolgorde-paneel; de volgorde wordt per browser opgeslagen en op de linker navigatie toegepast.

Verificatie 2026-07-24: Supabase SQL-controle voor de drie systeemrollen, security advisor zonder nieuwe waarschuwing, volledige Vitest (92 bestanden/340 tests), strict TypeScript, ESLint, NL/EN i18n-check en productiebuild geslaagd. Een ingelogde visuele browsercontrole en de laatste release/public-preview handelingen blijven nog open.

Aanvulling 2026-07-24: `/insights/upcoming-events` gebruikt de bestaande live tabel `tenant_anniversary_rules` en toont echte verjaardagen, werkjubilea (`employments.seniority_date`) en nieuwe indiensttredingen. De periode is 7 dagen, 4 weken of 12 weken; filters ondersteunen één of meer afdelingen en de drie gebeurtenistypen. Export is Excel-compatibele CSV. `/settings/anniversary-rules` beheert per tenant de jubileumjaren; de bestaande regels zijn 1, 5 en 25 jaar. Dit staat los van verlofbonus-treden: die horen functioneel bij Verlofopbouw (`leave_bonus_rules`) en zijn nog niet als afzonderlijk formulier in de settings-UI ontsloten.

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

Documentenslice 2026-07-26: de leidende blueprint staat in `docs/requirements/documents/Documenten_en_Dossier_Systeem_Master.md`. Het medewerkersdossier heeft een viewer en expliciete categorie-verwijderguardrail; bedrijfsdocumenten hebben private tenantbrede opslag, HR-beheer en dashboardwidget; loonstroken hebben een eigen tab, employment-koppeling en strict permission/RLS-readpad. De vier nieuwe Supabase-migraties zijn op de testdatabase toegepast en met lege documenttabellen gecontroleerd. Bulkimport, Nmbrs/Loket-koppelingen en AI/OCR/RAG zijn bewust later.

Functiecatalogus-UI 2026-07-26: de job- en functiegroepbeheerpagina is nu lijst-eerst met zoeken, sortering, groepsfilter, duidelijke add-knoppen en modal-formulieren voor toevoegen/wijzigen/verwijderen. De `event.currentTarget.reset()`-crash is opgelost door het form-element vóór de async request vast te leggen. Typecheck, lint, i18n, build en lokale desktop/390px-browsercontrole zijn geslaagd.

## Update 2026-07-27: Supabase-connectie en lokale runtime

De Supabase REST- en Auth-endpoints zijn read-only gecontroleerd voor project `wnpfloqpjvaacobppbpk`: REST-query `tenants` gaf HTTP 200 en Auth settings gaf HTTP 200. De officiële MCP-endpoint is bereikbaar maar geeft zonder OAuth-sessie HTTP 401. De projectconfiguratie staat nu in `.mcp.json`; authenticatie en de remote migratie-uitrol moeten nog vanuit een MCP-sessie worden afgerond. De lokale Next-server is op poort 3000 gereset; het oude listenerproces is gestopt, een nieuw proces luistert op 3000 en `/login` geeft HTTP 200. Browsercontrole van `/login` is uitgevoerd.

## Update 2026-07-27: verzuim remote uitgerold en releasegate

De migratie `20260726150000_add_absence_core.sql` is rechtstreeks op het gekoppelde Supabase-project toegepast nadat de FK-unieke constraint voor tenant/casus was gecorrigeerd. De aanvullende migraties `20260727155229_harden_absence_security.sql`, `20260727181000_revoke_absence_anon_grants.sql` en `20260727182000_harden_absence_recovery_idempotency.sql` verplaatsen de interne SECURITY DEFINER-logica naar `internal_security`, trekken anonieme tabelrechten in, laten alleen authenticated de publieke invoker-wrappers aanroepen, splitsen de instellingenpolicies en maken herstel idempotent. Alle vier migraties zijn als applied geregistreerd. De historische remote migratiegeschiedenis bevat oudere versies die niet in deze checkout staan; daarom is `db push` niet als migratiebron gebruikt en zijn bestaande versies niet gerepareerd.

Remote bewijs: `absence_cases`, `absence_spells`, `absence_capacity_changes`, `absence_mutations` en `absence_settings` hebben RLS; de privacycontractproef bevestigt geen medische oorzaakvelden, een verzuimselectpolicy en geen leesrecht op mutatiesleutels. De PostgREST-query op `absence_cases` geeft voor de publieke sleutel HTTP 200 met een lege dataset. De Supabase security-advisor toont geen nieuwe verzuimbevindingen; alleen bestaande waarschuwingen voor oudere leave-RPC's, enkele bestaande dubbele policies en uitgeschakelde leaked-password protection blijven staan. `packages/db/types.ts` is opnieuw gegenereerd met de officiële gekoppelde database-types.

Releasegate 2026-07-27: applicatieversie `1.20260727.2`; 101 testbestanden/369 tests, strict typecheck, ESLint, i18n-pariteit en productiebuild zijn geslaagd. De devserver is opnieuw gestart en luistert op poort 3000; `/login` geeft HTTP 200. De in-app browser had geen bestaande ingelogde tab, dus alleen de publieke loginstaat is gecontroleerd. Een ingelogde end-to-end verzuimactie blijft handmatig open totdat een gebruiker in de browser is aangemeld. De kernverzuimslice en HR-admininstellingen zijn af; wettelijke WvP-milestones/casustaken/dossier, voorziening/bewaarduur, payroll/13-wekenmodel, rapportages en externe integraties zijn niet onderdeel van deze afgeronde slice.

## Update 2026-07-27: Gebruiker Startpagina

De nieuwe server-rendered Startpagina staat op `/dashboard/start` en is als ingesprongen item **Startpagina** onder **Dashboard** toegevoegd aan het hoofdmenu. `/` verwijst nu naar deze startpagina; `/dashboard` blijft de bestaande vrije dashboardwerkplek voor later besluitvorming. De UI gebruikt alleen bestaande RLS-scoped bronnen: medewerkers, afdelingen, verzuim, bedrijfsdocumenten en gepubliceerde persoonlijke reminders. Declaraties, contractondertekening, activumaanvragen, taken/Poortwachter en gebeurtenissen tonen bewust **Werk in uitvoering** zonder voorbeelddata. NL/EN heeft een volledige `startpage`-namespace.

Verificatie: `check:i18n`, strict TypeScript, ESLint, 99 Vitest-bestanden/364 tests en productiebuild geslaagd. Poort 3000 geeft `/login` HTTP 200 en `/dashboard/start` zonder sessie een veilige 307 naar `/login?next=%2Fdashboard%2Fstart`; de verse browser had geen ingelogde sessie, dus de beschermde Startpagina-dataset en 390px-UI blijven handmatig open.

## Update 2026-07-27: Startpagina login- en autorisatiescope

De veilige fallback van de login- en auth-callbackflow is gewijzigd naar `/dashboard/start`; een expliciete veilige `next`-bestemming blijft leidend. De startpagina, reminderwidgets, bedrijfsdocumentenservice en bestaande dashboardwidgets filteren nu expliciet op de actieve administratie wanneer die context van toepassing is. Medewerkerstellingen gebruiken actuele `employee_administration_assignments` en blijven daarna onder de bestaande permission- en RLS-scope vallen. In gecombineerde tenants blijft de tenantbrede context intact.

De read-only live-audit van Supabase bevestigde RLS op medewerkers, administratie-toewijzingen, afdelingen, verzuim, bedrijfsdocumenten en reminders. Er was één echte omissie: `company_documents` en private `company-documents` storage-objecten waren alleen tenant-scoped. Migratie `20260727161805_harden_company_document_administration_scope` is live toegepast en beide read-policies gebruiken nu `has_administration_access`. De security advisor meldt daarnaast alleen bestaande, niet aan deze wijziging gerelateerde bevindingen. De anonieme routecontrole blijft geslaagd; een echte ingelogde rolmatrix voor desktop/390px vraagt nog een beschikbare browsersessie met testgebruikers.

De Startpagina is daarna als volwaardig hoofdmenu-item naast Dashboard gezet. `/dashboard/start` staat ook in de beheerpagina Menuvolgorde; ontbrekende nieuwe items vallen bij bestaande lokale menuvoorkeuren terug op hun standaardpositie.

## Update 2026-07-27: HR-admin verzuimbeheer en eigen WvP-taaktemplates

`/settings/absence` is uitgebreid van een statisch formulier naar een administratiegebonden HR-adminscherm. De pagina laadt de echte frequentieverzuimdrempel en alleen actieve medewerkers met een Liquid HR-gebruikersaccount als standaardcasemanager. De API valideert bereik, administratie en casemanagerkeuze server-side en toont duidelijke foutstatussen in de UI.

De nieuwe migraties `20260727164511_absence_task_templates.sql` en `20260727165641_absence_task_template_immutability.sql` zijn remote toegepast en als applied geregistreerd. `absence_task_templates` heeft tenant-/administratiescope, RLS, audittrigger, geen anon-grants, soft-deactivatie en immutable tenant-, administratie-, code- en systeemvelden. De nieuwe API `/api/settings/absence/tasks` en het lijst-eerst scherm ondersteunen eigen niet-wettelijke taaktemplates met code, deadline na casusstart, bewijsvereiste en activatie/deactivatie. Er zijn bewust geen wettelijke taken geseed zolang de inhoudelijke validatie ontbreekt; de remote beginstand is leeg.

Verificatie: remote RLS/grants zijn groen (`rls_enabled=true`, anon select=false, authenticated select=true); Supabase SQL-lint toont alleen bestaande bevindingen buiten verzuim. De nieuwe schema-, settings- en tasktests zijn geslaagd, i18n-pariteit, strict typecheck, ESLint en productiebuild zijn geslaagd. De in-app browser heeft nog geen beschikbare ingelogde tab; `/settings/absence` redirecteert zonder sessie veilig naar `/login?next=%2Fsettings%2Fabsence`.

## Update 2026-07-27: ingelogde browsercontrole verzuim

De bestaande Codex-in-app-browser-tab op `http://localhost:3000/dashboard/start` is succesvol geclaimd; de sessie is ingelogd als `edwin@editsolutions.nl` in administratie `Liquid HR Demo Holding B.V.`. De startpagina toont echte tellingen (6 actieve medewerkers, 0 actieve verzuimgevallen) en versie `1.20260727.2`. `/settings/absence` rendert de echte frequentiedrempel (3), casemanagerkeuze en het lijst-eerst scherm voor eigen WvP-taaktemplates. De medewerkerkaart van Lina Bakker rendert het tabblad **Verzuim** met eerste ziektedag, arbeidsongeschiktheidspercentage, verwacht herstel en opslaanknop. In `/hr-calendar` is na selectie van Lina's dagcel de actie **Ziek melden** zichtbaar met de datumparameter; de kalender toont daarnaast de personeelskaartactie. Geen demo-ziekmelding of taaktemplate is opgeslagen tijdens deze read-only controle.

## Update 2026-07-27: rijke verzuimtestfixture Fin en Noah

De expliciet geautoriseerde testfixture `20260727171300_seed_rich_absence_demo_employees.sql` is rechtstreeks toegepast op Supabase-project `wnpfloqpjvaacobppbpk` en als applied geregistreerd. De migratie gebruikt vaste UUID's, is idempotent uitgevoerd (tweede run gaf dezelfde aantallen) en raakt uitsluitend de demo-tenant `Liquid HR Demo Holding`.

Toegevoegd voor **Fin de Groot** (`TEST-VERZ-047`) en **Noah Hendriks** (`TEST-VERZ-048`): actieve medewerkerprofielen, administratie-toewijzing, organisatieplaatsing met afdeling/functie/manager, primair dienstverband en contract, loonrelatie/IKV, arbeidsvoorwaarden, rooster, salaris, kostenallocatie, adres, gemaskeerde bankrekening, twee relaties, vier gepubliceerde HR-reminders, twee verzuimcasussen per medewerker (één actief en één gesloten met herstelhistorie), ziekteperiodes/capaciteitswijzigingen en drie eigen niet-wettelijke testtaaktemplates. Er zijn geen BSN's, medische oorzaken of echte contactgegevens gebruikt; e-mailadressen eindigen op `.invalid`.

Remote verificatie: 2 medewerkers, 2 toewijzingen, 2 organisatiekaarten, 2 dienstverbanden, 2 loonrelaties, 2 arbeidsvoorwaarden, 2 roosters, 2 salarissen, 2 kostenallocaties, 2 adressen, 2 bankrekeningen, 4 relaties, 4 reminder-ontvangers, 4 verzuimcasussen, 4 ziekteperiodes, 4 capaciteitsregels en 3 testtemplates. De actieve casussen zijn Fin 70% vanaf 2026-07-18 en Noah 50% vanaf 2026-07-08; de historische casussen zijn gesloten.

Applicatieversie verhoogd naar `1.20260727.3`; de versie-unit-test en de zichtbare versietekst op `/dashboard/start` zijn geslaagd.

Ingelogde browsercontrole geslaagd: `/employees` toont beide medewerkers, hun detailkaarten tonen organisatie-, adres-, relatie-, bank- en dienstverbandgegevens, het tabblad **Verzuim** toont actieve en gesloten historie, `/hr-calendar` toont beide namen en `/dashboard/start` toont 2 lopende verzuimgevallen. Het geopende tabblad staat op de startpagina. Supabase `db lint` gaf alleen reeds bestaande waarschuwingen buiten deze fixture (`create_job_with_revision`, `upsert_star_performer_assessment` en de bestaande leave-RPC `create_leave_opening_balance`).

## Update 2026-07-27: Startpagina en verzuimrapportage

De Startpagina toont naast de verzuim-KPI nu een compacte lijst met lopende verzuimgevallen. Iedere rij bevat medewerker, startdatum, duur, status en een directe link naar het tabblad **Verzuim** in het medewerkerdossier; de lijst blijft administratie-, permission- en RLS-gebonden.

`/insights?report=absence` is beschikbaar als standaard Verzuimrapport. Het rapport ondersteunt maand of volledig kalenderjaar, afdeling, KPI's, maandtrend, dossierlinks en een Excel-compatibele `.xls`-export via `/api/insights/absence`. Het percentage gebruikt geplande verzuimuren gedeeld door beschikbare geplande uren × 100, met rooster-, deeltijd- en gedeeltelijke-verzuimweging. De startpagina- en rapportlabels hebben volledige NL/EN-pariteit.

Applicatieversie verhoogd naar `1.20260727.4`. Verificatie: strict TypeScript, `check:i18n`, lint, vier gerichte verzuimquery/exporttests, productiebuild en ingelogde browsercontrole op poort 3000 zijn geslaagd.

## Update 2026-07-27: Bradford-factorrapport

Het verzuimrapport heeft een tweede rapport gekregen via `/insights?report=absence-bradford`. De Bradford-factor gebruikt `S² × D`, waarbij `S` afzonderlijke ziekteperioden telt en `D` roostergewogen verzuimdagen. De filters zijn laatste 52 weken, dit jaar, vorig jaar, team als afdeling, risiconiveau en medewerkerzoekopdracht; segment en kalendertype zijn bewust niet opgenomen. De uitlegmodal beschrijft formule, risicobanden en de menselijke beoordelingsgrens. De bestaande Excel-route exporteert ook Bradford-resultaten met actieve periode- en afdelingsfilter.

De datalaag blijft RLS-gebonden aan de bestaande `absence_cases`, `absence_spells`, capaciteit, dienstverbanden, roosters en afdelingen; er was voor deze rapportageslice geen nieuw schema nodig. Applicatieversie verhoogd naar `1.20260727.6`. Verificatie: typecheck, lint, i18n-pariteit, volledige testsuite (106 bestanden/379 tests), productiebuild en ingelogde browsercontrole op poort 3000 zijn geslaagd. De browsercontrole bevestigde de drie periodekeuzes, team/afdelingsfilter, risicofilter, uitlegmodal, dossierlinks en Excel-download.

## Update 2026-07-27: Reminderbeheer en Tijdhub

De Tijdhub in de linkerzijbalk toont nu een compacte reminderknop naast de klok. De knop opent maximaal drie actuele reminders, meldt extra reminders expliciet en bevat een werkende link naar Reminderbeheer. Een reminder opent vanuit de Tijdhub in het bestaande standaardvenster met details en acties.

`/reminders` is uitgebreid naar een interactief persoonlijk overzicht met zoeken, filteren op openstaand/alles/afgerond/verborgen, sorteren op eerstvolgende/laatste/titel, kleurcodering voor verlopen en naderende reminders, bulkselectie en bulk afronden. Kaarten tonen waar beschikbaar de medewerker en linken naar het medewerkerdossier; de detailmodal bevat dezelfde context en acties. De lijst gebruikt uitsluitend echte reminders uit de bestaande administratie- en autorisatiescope.

Verificatie: i18n-pariteit, gerichte reminder-tests, volledige lokale tests, strict typecheck, productiebuild en ESLint zijn uitgevoerd. De ingelogde browsercontrole bevestigde de Tijdhubknop, `+1 meer reminder`, de detailmodal en de filter voor oudere reminders. Er is geen schemawijziging of deployment nodig voor deze UI-slice.

## Hervatten

1. Lees `AGENTS.md`, `docs/README.md` en dit bestand.
2. Controleer werkboom, branch, poort 3000, Supabase en Vercel opnieuw.
3. Gebruik `docs/delivery/IMPLEMENTATION_STATUS.md` en de relevante requirements voor resterend werk.
4. Werk na iedere materiële slice dit bestand en de status bij.
