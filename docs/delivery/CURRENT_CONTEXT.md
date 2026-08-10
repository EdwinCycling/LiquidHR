# Actuele overdracht Liquid HR

## Release 2026-08-10: productversie 1.20260810.3 — lokale samenvoeging

- `main` bevat de lokale commits `f907eb8` (bedrijfsactiviteiten, feestdagen en employment-overzicht) en `5077aa0` (Liquid Flow applicatiebrede UX). De bronwerkmap `codex/liquid-flow-appwide` is gecontroleerd vastgelegd als `4d2e262`; gegenereerde `next-env.d.ts`-wijzigingen zijn bewust niet meegenomen.
- De zichtbare appversie is verhoogd van `1.20260810.2` naar `1.20260810.3` in `apps/hr-suite/lib/app-version.ts`; de unit-test verwacht dezelfde waarde. De packageversie blijft technische metadata.
- De lokale releasegate is groen: 151 testbestanden/575 tests, strict TypeScript, 29 NL/EN-namespaces, volledige ESLint, diff-check en Webpack-productiebuild met 187 pagina's. De releasecode staat op `edf8de9`; `main` bevat daarna docs-only verificatiecommit `f185a58`. Vercel Production `dpl_FtSAqLQqavF5JBg4ax1E6vWVJFme` en de daaropvolgende docs-only deployment zijn `READY`, alias `liquid-hr-hr-suite.vercel.app` geeft `/login` HTTP 200 en de runtime-scan over het laatste uur meldt geen fouten.

## Feestdagen en bedrijfsactiviteiten 2026-08-10 — lokaal bijgewerkt

- `/settings/holidays` toont lokale feestdagen en bedrijfsactiviteiten nu als volle, onder elkaar gestapelde instellingenvensters. Beide typen staan samen in één datumlijst; bedrijfsactiviteiten hebben een afwijkende primaire kleurset en een wijzigingsmodal met naam, datum en actieve status.
- Activeren/deactiveren van feestdagen geeft een toast. Een dubbele bedrijfsactiviteit geeft voortaan een specifieke conflictmelding; de nieuwe PATCH-route ondersteunt gecontroleerd wijzigen en behoudt de bestaande tenant-/HR-groepautorisatie.
- De instellingen- en schermtitels zijn in NL/EN hernoemd naar Feestdagen en Bedrijfsactiviteiten / Holidays and Company Activities. De modal is hydration-safe gemaakt met een stabiele server/client-mountgrens.
- Lokaal bewijs: volledige hr-suite 151 testbestanden en 575 tests groen; strict TypeScript, i18n-pariteit, volledige ESLint en `git diff --check` groen. De browsercontrole bereikte zonder sessie alleen `/login`; daar was geen error-overlay zichtbaar. Geen remote wijziging, commit, push of deployment uitgevoerd.

## Dienstverbandoverzicht en contractweergave 2026-08-10

- Op `/employees/[employeeId]?tab=employments` toont een dienstverbandkaart geen contractvorm meer. De kaart toont nummer, periode/status, anciënniteitsdatum met duur eronder en administratie; actuele contractgegevens staan onder een dunne scheidingslijn.
- Contractgegevens tonen alleen wanneer er een vandaag geldig contract is. Zonder geldig contract verschijnt `Geen actief contract bij dit dienstverband`; toekomstige contracten worden niet als actueel gekozen.
- Op het dienstverbanddetail staan contractvorm, CAO, uren, afdeling, functie en medewerkertype in het contractblok. De losse wijzigingsacties verschijnen alleen bij een geldig contract. De AI-samenvatting-placeholder is verwijderd.
- Verificatie: employment-card-state/seniority 6/6 tests groen, strict TypeScript, volledige ESLint, `git diff --check`, browsercontrole op poort 3000 voor overzicht en detail groen; NL/EN `employment.json` 391/391 sleutels gelijk en de volledige i18n-check meldt 29 namespaces met gelijke sleutels. Geen schema-, API-, remote-, commit-, push- of deploymentwijziging.

## Release 2026-08-10: productversie 1.20260810.2

- De zichtbare productversie is verhoogd naar `1.20260810.2` volgens de centrale `X.datum.volgnummer`-conventie.
- `main` bevat de lokale consolidatie en employment-merge. Releasecommit `cce23987603bf25d2778672ce5a17a543e1f717a` staat op GitHub `main`; Vercel Production `dpl_A7nVUHc5JhCcAuQy2hiaNkRYno3L` is `READY` op exact deze commit met alias `liquid-hr-hr-suite.vercel.app`.
- De drie employment-migraties zijn remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`: `add_temporary_no_end_contract_type`, `employment_number_ikv_and_probation_rules` en `add_cao_probation_override`.
- De bestaande actieve dubbele IKV is binnen de migratie gerepareerd zonder verwijdering: gesloten historische IKV 9 bleef 9; de latere open conceptrelatie kreeg IKV 10. De remote controle geeft nul actieve dubbele IKV-groepen. Advisors en officiële typegeneratie zijn uitgevoerd.

## Feestdagen en bedrijfsactiviteiten 2026-08-10

- `/settings/holidays` heeft naast lokale feestdagen een HR-groepbrede invoer voor bedrijfsactiviteiten met naam en datum. De bestaande landelijke feestdagen kunnen per record expliciet worden geactiveerd of gedeactiveerd; gedeactiveerde dagen blijven buiten de kalender- en verlofselecties.
- Het land voor de feestdagenimport wordt nu gekozen via een zoekbare dropdown. De opties worden via `/api/settings/holidays/countries` uit de Nager.Date-feestdagenprovider opgehaald; bij tijdelijke provideruitval blijft de bestaande ISO-landfallback beschikbaar.
- De nieuwe `company_activities`-tabel heeft RLS, audit, een HR-adminschrijfpad en een leespad voor gekoppelde medewerkers van dezelfde HR-groep. Startpagina en medewerkerheader tonen de eerstvolgende actieve feestdag en bedrijfsactiviteit wanneer die bestaat.
- De HR-kalender laadt actieve bedrijfsactiviteiten binnen de maand en toont per dag een subtiel kalendericoon; de dagdetailweergave toont de activiteit(en) naast een eventuele feestdag.
- Lokaal gecontroleerd met strict TypeScript, i18n-pariteit en `git diff --check`. De migratie is nog niet remote toegepast; browsercontrole, Supabase-advisors, commit, push en deployment blijven open.

## Weerbericht verhuisd naar medewerkerheader 2026-08-10

- De startpagina toont geen bedrijfslogo meer in de startpagina-header en bevat daar geen weerinstrument of Compact-schakelaar meer. De volledige startpagina en de ordening van de vensters blijven behouden.
- De medewerkerheader toont voor iedere geautoriseerde kijker een klein weericoon. De server bepaalt het werkweer uit de actieve werkcontext met Eindhoven als fallback; de drawer toont temperatuur, maximum, luchtvochtigheid, wind en luchtdruk.
- De drawer sluit via het kruisje, Escape of een klik buiten het venster. Lokaal gecontroleerd op desktop en 390x844; geen schema-, API-, remote-, commit-, push- of deploymentwijziging.

## Medewerkerdashboard profielheader 2026-08-10

- De uitgebreide profielheader op `/employees/[employeeId]` volgt de nieuwe visuele opzet: compacte ronde avatar, duidelijke naam/status-hiërarchie, foto-acties in dezelfde naamkleur, weer- en compact/uitgebreid-iconen van 40x40 naast elkaar en de archiveeractie onderaan boven de contactstreep. De bestaande velden, autorisatie en compact/uitgebreid-URL-state zijn behouden.
- De header stapelt op 390 px zonder horizontale overflow. Gerichte ESLint, strict TypeScript, `git diff --check`, desktop-/390px-browsercontrole, compact/uitgebreid-navigatie en browserconsole zijn groen.
- Geen schema-, API- of remote-wijziging buiten de nieuwe lokale migraties uitgevoerd. De wijzigingen zijn nu lokaal opgenomen in `main`; push en deployment blijven apart open.
## Dienstverbandwizard: nummering, contractregels en aanmaakflow 2026-08-10

Deze verticale slice is lokaal samengevoegd in `main` vanuit worktree `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\employment-wizard-fixes`. De drie remote migraties zijn toegepast en de release staat op GitHub/Vercel; de gebruiker voert nu de functionele test uit.

### Gedaan

- Schema/API/UI volgen `schema -> API -> UI`: dienstverbandnummers zijn niet-negatieve numerieke volgnummers per medewerker; het IKV-nummer is alleen per medewerker uniek. De nieuwe contractduur `TEMPORARY_NO_END` is toegevoegd aan het lokale typecontract.
- Proeftijdregels zijn gedeeld tussen wizard, contractroute en servervalidatie. Er zijn kalendermaandknoppen en einddatumknoppen voor 1/3/6/12 maanden; oproepuren worden bij een lege keuze op 0 gezet. De roosterverplichte ster staat alleen bij de titel.
- De wizard gaat na **Overige** naar **Controleren** en bewaart pas via **Dienstverband aanmaken**. Annuleren en een viewport-veilige footer zijn toegevoegd. Administratiedetails tonen over de volle breedte administratiegegevens, actieve/gearchiveerde medewerkers en beschikbare CAO's.
- Getallen accepteren `,`, `.` en Nederlandse duizendscheiding in invoervelden. Gangbaar vervolgontwerp is een persoonlijke locale-/nummernotatievoorkeur; een nieuwe voorkeur is in deze slice nog niet toegevoegd.
- De gemelde POST-400 is gereproduceerd met de exacte browserpayload. De oorzaak was `z.string().uuid()` op geldige PostgreSQL-UUID-opmaak met niet-RFC-variant/version-nibbles; de employment-envelope en relevante nested IDs gebruiken nu een database-UUID-validator. De exacte full-on-call-payload heeft een regressietest.

### Verificatie

- Volledige hr-suite: 149 testbestanden en 569 tests groen; strict TypeScript, i18n-pariteit (29 namespaces), `git diff --check` en Webpack-productiebuild met 185 pagina's groen.
- Browser op `127.0.0.1:3000`: administratie-informatie, oplopend nummer/IKV, tijdelijk-zonder-einddatum, einddatumknoppen, proeftijdmeldingen, roosterster, oproep-0-uren, review-vóór-save en Annuleren gecontroleerd. De knop **Dienstverband aanmaken** is niet aangeklikt; er is geen persistent testdienstverband aangemaakt.
- Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit (`contextOrFilename.getFilename is not a function`); dit is geen inhoudelijke wizardfout.

### Open / geblokkeerd

- De drie Supabase-migraties zijn remote toegepast. Voor de unieke IKV-index is de bestaande dubbele groep deterministisch gerepareerd: de vroegste historische relatie behield IKV 9 en de latere open relatie kreeg de eerst vrije IKV 10. Er zijn geen rijen verwijderd; de duplicate-controle retourneert nul actieve groepen.
- Remote staan de per-medewerker unieke indexen, `TEMPORARY_NO_END`-enumwaarden, de numerieke dienstverbandtrigger, contract-/proeftijdguards en `probation_maximum_months` actief. De lokale code/API-fix voor de 400 en de wizard-UX blijven lokaal bewezen.

## Vorige productie-release-status 2026-08-09

- De mobiele Google-login hotfix is live op `main`. Mergecommit `54f5f235c2523612008f5425586f72fc19ab0687` staat op GitHub; Vercel Production `dpl_3g6rdX6aK6imhbcAGsgPNV3M15L4` staat `READY` met alias `liquid-hr-hr-suite.vercel.app`.
- De zichtbare productversie is `1.20260809.2`. `NEXT_PUBLIC_APP_URL` is remote niet gewijzigd omdat de beschikbare Vercel-sessie opnieuw login vroeg; de request-origin-fix maakt de stale waarde niet langer bepalend.

## Form Builder veldtypen 2026-08-09

- De studio-catalogus exposeert nu alle 16 volwassen contracttypen: invoer, keuzevelden en employee/department/job/employment/document-referenties.
- De builder ondersteunt per type een passende preview; keuzevelden hebben een echte NL/EN-optie-editor; labels, helptekst, technische key/binding en gepubliceerde read-only status zijn zichtbaar en bewaakt.
- De documentreferentie gebruikt de bestaande RLS-afgeschermde `employee_documents`-leesweg. Remote schema/policies zijn read-only gecontroleerd; er is geen migration nodig.
- HR-admin browserbewijs: alle 16 typen toegevoegd aan de synthetische P8-clone, na reload behouden, NL/EN en desktop/390px gecontroleerd. Manager/medewerker kregen `/geen-toegang`. 21/21 gerichte tests, typecheck, i18n, lint, diff-check en Webpack-build zijn groen.
- Open volgens blueprint: herhaalbare groepen zijn bewust nog uitgesteld tot na stabilisatie van de basis; presentatieblokken zijn een aparte toekomstige builderlaag.

## Form Builder bindings 2026-08-10

- De studio gebruikt een gesloten developerregistry met 22 keuzes: `PROCESS_ONLY`, 11 getypeerde `DOMAIN_READ`-projecties, de 3 bestaande P9-voorstelroutes en 7 serverformules onder `COMPUTED`.
- De builder toont per veld de categorie, registry key/formula en NL/EN uitleg. Onbekende bindings, typeconflicten, write access op `DOMAIN_READ`/`COMPUTED` en niet-schrijfbare `DOMAIN_PROPOSAL`-velden worden door de compiler geblokkeerd. Bij het kiezen van read/computed wordt bestaande write access veilig naar read omgezet.
- Lokaal bewijs: de gerichte form-field/compiler-suite is 21/21 groen; strict TypeScript, i18n, gerichte ESLint en `git diff --check` zijn groen.
- Browserbewijs: HR Admin ziet de getypeerde binding-editor op poort 3000 met 20 selectors in de P9-draft; manager wordt naar `/geen-toegang` geweigerd en medewerker naar `/geen-toegang` geweigerd. Een schone HR-admin-herhaling van de Forms-workspace had geen nieuwe console-error. De actieve en afgeronde work-itemroutes bereikten via de nieuwe wrapper respectievelijk de verwachte serverguards `FORM_REQUIRED` en `STEP_NOT_ACTIVE`; er is geen oude output-RPC aangeroepen. Tijdens de eerdere client-side testrolwisseling logde Next development-only een `ProcessAutomationSettingsPage`-negative-timestamp uit zijn eigen performance-instrumentatie; dit is geen Forms-fout.
- Remote compatibiliteit is toegepast in `20260810062127_process_automation_form_binding_runtime_compatibility.sql` en `20260810063300_process_automation_output_content_compatibility.sql`. De eerste migratie maakt aparte binding-aware projection/save-wrappers met dezelfde actor-, scope-, document- en concurrencychecks; de bestaande gedeelde form-RPC's zijn ongewijzigd gebleven. De tweede normaliseert de gedeelde P7-outputtrigger en `process_output_source` via `process_definition_content(...)`, zodat top-level en compiled `definition_json.content` werken. Remote functiehashes, wrapperbestaan, authenticated grants en het gegenereerde typecontract zijn gecontroleerd. Advisors zijn opnieuw uitgevoerd: 1 bestaande security-INFO, 37 projectbaseline-security-WARNs en 389 performance-INFO's; geen wrapper- of outputcompatibiliteitsbevinding.

## P9/P10 — actuele overdracht 2026-08-10

- P9-contextingangen zijn aangesloten volgens `schema -> API -> UI`: aparte `BLOCKED`-projectie op de startpagina, een echte Workflows-kaart en Processen-tab op medewerkerdetail, een employment-gefilterde Processen-tab, en server-geautoriseerde startlinks vanuit afdelingen en het organogram.
- De gedeelde outputbrug is compatibel gemaakt met compiled `definition_json.content.output`, niet-RFC-versiegebonden PostgreSQL UUID-vormen, ontbrekende `process-internal-transfer`-documentcategorieën en de benodigde PostgREST/grant/schema-cache-keten. De bestaande form-RPC's zijn niet aangepast.
- Live P10-bewijs op poort 3000: de HR-admin-worker claimde 1 job en rondde die af met `succeeded=1`, zonder retry/fout. Remote staan de job en output op `SUCCEEDED`/`AVAILABLE`; het `employee-documents`-object bestaat als 908-byte `application/pdf`, documenttag `PROCESS_OUTPUT`, categorie `process-internal-transfer`. De Work-detailpagina toont `Dossier interne overplaatsing`, `Beschikbaar` en `PDF downloaden`; de technische status staat op `PROCESS_DOCUMENT_OUTPUT / SUCCEEDED`.
- Browsermatrix op localhost:3000 is opnieuw gecontroleerd met de drie testrollen. HR Admin ziet 20 afdelingsstarts, 51 organogramstarts, employment-processen en de beschikbare PDF. Test Medewerker ziet de echte Workflows-kaart, medewerker-Processen-tab en employment-filter. Test Manager krijgt 0 afdelingsstarts; routeguards geven geen ongeautoriseerde content vrij.
- De startpagina-code projecteert blokkades afzonderlijk, maar de actuele remote testdataset bevat op het controlemoment geen `BLOCKED`-workitem; daardoor is de gevulde blockerkaart live nog niet met een niet-lege fixture bewezen. De code- en UI-route zijn wel door build/typecheck en browser-statecontrole geraakt.
- Open securitybesluit: het algemene medewerkerdossier toont de nieuwe PDF nog niet aan een HR-admin zonder medewerkerrecord, omdat de bestaande document-RLS alleen de onderwerp-audience ziet. Een voorgestelde audience-uitbreiding naar actieve `TENANT_ADMIN`-rollen is bewust niet remote toegepast; daarvoor is expliciete goedkeuring van de exacte doelgroep nodig. De subject-audience en de bestaande geautoriseerde Work/PDF-download blijven intact.
- Lokale eindchecks zijn groen: volledige suite 147 bestanden/559 tests, gerichte output/worker-suite 7/7, strict TypeScript, NL/EN-i18n, volledige ESLint, `git diff --check` en Webpack-productiebuild met 187 pagina's. Supabase security- en performance-advisors zijn opnieuw uitgevoerd; bestaande projectbaseline-meldingen blijven afzonderlijk staan.

## Mobiele Google-login hotfix 2026-08-09

- Oorzaak bewezen in de actuele productieflow: de OAuth-aanvraag bevatte `redirect_to=https://liquidhr.vercel.app/auth/callback?...`, afkomstig uit een verouderde `NEXT_PUBLIC_APP_URL`. Dit domein is geen actueel projectdomein en staat niet in de Supabase-redirectallowlist. Supabase verwerkte Google `/authorize` en `/callback` met 302, maar daarna volgde geen PKCE-tokenwisseling; de fallback naar de Site URL verklaart de terugkeer naar de startpagina zonder sessie.
- Fix staat uitsluitend op branch `codex/fix-mobile-google-auth` in worktree `.worktrees/fix-mobile-google-auth`: gevalideerde request-/forwarded-hostorigin vóór omgevingsfallback, dezelfde publieke origin in de callback, veilige `next`-retour bij succes en fout, een correcte callbackfoutmelding en een pending/disabled Google-knop tegen herhaalde submits.
- Verificatie groen: 7/7 gerichte auth-tests; volledige suite 145 testbestanden/546 tests; strict typecheck; NL/EN-pariteit voor 29 namespaces; Webpack-productiebuild met 181 pagina's. Een 390x844-browserproef tegen de gewijzigde productiebuild op poort 3100 koos ondanks de bewust verouderde env-waarde correct `http://localhost:3100/auth/callback` en liet geen horizontale overflow zien.
- Bestaande blokkade: gerichte ESLint start niet door ESLint 10 versus `eslint-plugin-react` (`contextOrFilename.getFilename is not a function`); deze niet-inhoudelijke repofout is niet opnieuw uitgevoerd of verbreed.
- Open: niets is samengevoegd, gepusht, gedeployed of remote gewijzigd. Productie blijft defect tot de expliciete feature-release. Corrigeer bij of vóór die release ook `NEXT_PUBLIC_APP_URL` naar `https://liquid-hr-hr-suite.vercel.app`; de codefix is daar niet langer afhankelijk van voor requestgebonden OAuth.

## Releaseversie 2026-08-09

- `apps/hr-suite/lib/app-version.ts` en de bijbehorende test zijn verhoogd naar `1.20260809.2` voor deze hotfix.

## Release 2026-08-09

- Productversie verhoogd naar `1.20260809.1`; releasecommit `4813082e9f4a16ace3621d39f3b6d9968b2e716e` staat op `main` en `origin/main`.
- Lokale releasecheck: 143 testbestanden/539 tests, strict typecheck, i18n-pariteit met 29 namespaces, lint en Webpack-productiebuild met 181 pagina's geslaagd. De standaard Turbopack-build blijft omgevingsmatig afhankelijk van de bekende worktree-junction.
- Vercel Production `dpl_GSqHEfvq7J3SCjPzxRwYDT6Bt4c5` staat op `READY`, aliases zijn `liquidhr-edwinitsolutions.vercel.app` en `liquid-hr-hr-suite.vercel.app`; `/login` gaf HTTP 200 en de runtime-errorscan over het laatste uur gaf nul fouten.
- Er is geen directe Vercel-mutatie uitgevoerd; de deployment kwam automatisch via de push naar `main`. De bestaande ongetrackte `.codex-worktrees/` is ongemoeid gelaten.

## P8-verificatie — proces- en formulierstudio 2026-08-09

P8 is uitgevoerd in `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\process-automation-p4-p5` en daarna lokaal samengevoegd naar `main` in mergecommit `2ff60c5`. De hoofdworkspace op `main` is nu de gecombineerde testbasis voor poort 3000. Er is niets naar GitHub gepusht of gedeployed. Er is alleen synthetische testdata gebruikt; er is geen down-scenario uitgevoerd.

Actuele lokale runtimecontrole: de `main`-devserver draait vanuit `apps/hr-suite` op poort 3000 (actueel PID 39284); `/login`, `/employees` en `/settings/process-automation` geven lokaal HTTP 200. De gemelde Next-runtime-overlay op een eerder geladen authenticated `/employees`-tab viel samen met Supabase API-logs met HTTP 504 op `user_access`, `user_hr_group_access` en `user_preferences`. Het Supabase-project staat momenteel `ACTIVE_HEALTHY`; er is daarom geen codewijziging voor deze melding doorgevoerd. Na herstart van de lokale server is de route opnieuw HTTP 200; bij de gebruiker is een reload nodig om de oude development-overlay te vervangen.

Aanvullende diagnose: read-only `pg_stat_activity` liet tijdelijk elf gelijktijdige `save_process_definition_draft`-requests zien, waarvan meerdere op dezelfde draft-lock wachtten. De lokale Next-processen zijn gecontroleerd gestopt en er draait nu opnieuw één schone `main`-devserver op poort 3000. Er is geen remote data verwijderd of teruggedraaid. De oorzaak van de oorspronkelijke pooluitputting is daarmee vastgesteld als een open/overlappende studio-save-testaanvraag; de bestaande UI-stopguard blijft een open authenticated browserbewijs en wordt niet als volledig bewezen geclaimd.

Incident na login: een afgebroken transactionele P8-save hield een tuple-lock op `process_definitions` vast; acht actieve save-sessies wachtten daarop en veroorzaakten `PGRST003` in het dashboard. Alleen deze vastgelopen authenticated test-sessies zijn beëindigd; er is geen rij verwijderd, geen migratie teruggedraaid en geen down-scenario uitgevoerd. Nacontrole is groen: nul wachtende definition-locks en nul afgebroken transacties. De gebruiker moet de bestaande tab reloaden en opnieuw inloggen; open geen tweede studio-tab totdat de revision-conflict/stop-retrybrowserproef opnieuw wordt uitgevoerd.

De noodzakelijke bouwvolgorde is aangehouden: schema -> API -> UI.

- Schema: `20260809100000_process_automation_p8_studio.sql`, `20260809100500_process_automation_p8_studio_security.sql` en `20260809101000_process_automation_p8_studio_security_grants.sql` voegen de studio-RPC’s, immutable publish/version/changelog-guards en interne security-definerkern toe. De database-types zijn opnieuw gegenereerd.
- API: catalogus/detail, draft autosave met expected revision, clone, publish, retire en trial zijn aangesloten. Compilerissues bevatten code, pad en boodschap. Trial gebruikt de bestaande assignment-resolver, rapporteert pad, deelnemers, rechten, SLA, output en blockers en schrijft geen runtime-data.
- UI: list-first Procesen/Formulieren, canvas plus toegankelijke staplijst, field library/secties/properties, participant-accessmatrix, compilerfeedback, preview voor participant/stap/taal/desktop/390, diff, publish-confirmatie/changelog, published read-only en clone/archive zijn aangesloten. NL/EN hebben gelijke nieuwe sleutels.

Remote en lokaal bewijs:

- Remote zijn alle zes P8-tabellen gecontroleerd met RLS aan en exact één policy. Publieke mutation-wrappers zijn `SECURITY INVOKER`, alleen authenticated uitvoerbaar; interne mutationfuncties zijn `SECURITY DEFINER`, met `anon` geweigerd en `authenticated` toegestaan. De drie P8-migraties staan geregistreerd.
- De synthetische catalogus bevat `internal-transfer-mslq73xj` als `PUBLISHED` met één published version en `internal-transfer-mslq73xj-copy-mslqd4ax` als `DRAFT` zonder published version. De stale-revision guard gaf remote `PROCESS_DEFINITION_DRAFT_CONFLICT`; de serverguard is daarmee bewezen.
- Supabase advisors zijn na de laatste grants opnieuw uitgevoerd: security totaal 22 met 0 P8-specifieke securitywaarschuwingen; performance totaal 383 met alleen INFO-meldingen over nog ongebruikte kleine-dataset-indexen.
- Lokaal: volledige hr-suite 143 bestanden/539 tests groen, gerichte compiler/resolvertests 19/19 groen, strict typecheck, gerichte ESLint met nul warnings, i18n-pariteit (29 namespaces) en `git diff --check` groen. De Webpack-productiebuild is groen (181 statische pagina’s). De standaard Turbopack-build blijft omgevingsmatig geblokkeerd door de externe `node_modules`-symlink/junction; dit is geen P8-codefailure.
- Na de lokale main-samenvoeging is opnieuw gecontroleerd vanuit `main`: 143/539 tests, `type-check`, `check:i18n`, volledige ESLint (`--max-warnings=0`) en Webpack-build met 181 pagina’s zijn groen. `http://127.0.0.1:3000/login` en `/settings/process-automation` geven lokaal HTTP 200; de Codex in-app authenticated target bleef bij deze laatste smokecheck hangen.

Authenticated browserbewijs op de lokale devserver:

- De HR-admin-flow bewees catalogus -> draft aanmaken -> autosave/revisie -> trial zonder runtime-writes (pad, SLA, output en blockers zichtbaar) -> publish versie 1/read-only -> clone. De browserconsole was in die run leeg. De trial liet bewust de niet-volledige resolver zien: initiator/source-manager/target-manager blockers en een HR-queue-uitkomst; dit is correcte blocker-weergave, geen succesvolle volledige businessfixture.
- De laatste gerichte wijziging voegde de stop/retry-guard voor stale autosave toe. Een nieuwe schone twee-tab authenticated browserrun die specifiek de zichtbare revision-conflictmelding en het stoppen van retries bewijst, kon in de Codex in-app browser niet worden afgerond doordat het lokale browser-target tijdens login/navigatie bleef hangen. Dit bewijs blijft open; de remote conflictrespons is wel bewezen. Een lokale loginrequest op poort 3000 gaf HTTP 200.

### P8-status vóór P9

Bewezen: schema/RLS/grants, API-contracten, compiler/resolvertests, lokale gates, remote publish/versioning, HR-admin studio lifecycle en no-runtime-write trial. Open: schone live UI-evidence voor revision conflict/stop-retry, volledige live field/preview/accessmatrix-herhaling en een volledige succesvolle resolverfixture. Geblokkeerd: standaard Turbopack door worktree-symlink en de laatste Codex-browserherhaling door het browser-target. P8 wordt daarom niet als 100%-gate gemarkeerd. P9 is niet uitgevoerd.

### Handmatig testplan na P9

1. Gebruik de bestaande drie interne fixtures (`hradmin.fixture@liquidhr.test`, `manager.fixture@liquidhr.test`, `employee.fixture@liquidhr.test`) en uitsluitend de behouden P8-clone. Open dezelfde draft in twee HR-admin-tabs; sla tab A op, submit daarna vanuit tab B met stale revision en verwacht de gelokaliseerde conflictmelding, geen retry-loop en een correcte reload.
2. Maak in de testfase één tijdelijk ongeldige draft-inhoud, controleer exacte compiler-code/pad/boodschap en herstel daarna. Controleer preview voor participant, stap, NL/EN, desktop en 390px; controleer de participant-accessmatrix en keyboard/focus.
3. Doorloop Procesproef met een synthetische employee/managerfixture die alle resolverpaden vult. Controleer success en blocker-modus afzonderlijk en bevestig vóór/na dat geen process instance, work item, event of output is geschreven.
4. Controleer publish-confirmatie/changelog, immutable published read-only, diff, clone, archive/retire en impactweergave. Herhaal manager/employee-deny op route en API. Voer daarna de P9-controles uit: volledige keyboard/axe, scheduler/restart en inhoudelijke HTML/PDF/cross-role-downloadcontrole.

## Historische P4/P5/P6/P7-verificatie vóór P8 2026-08-09

Dit blok is de gecontroleerde P4/P5/P6/P7-basis waarop P8 is voortgebouwd; de gecombineerde gate van die eerdere fasen is bewust niet als 100% gemarkeerd.

## Canonieke lokale voortzettingsbasis voor P9 2026-08-09

De gecombineerde lokale versie staat nu in `C:\Users\Edwin\Documents\Apps\LiquidHR`, branch `main`, mergecommit `2ff60c5`. Dit is de actieve basis voor de volgende testthread en handmatige P9-opvolging. De feature-worktree en checkpoint `c33e799` blijven behouden als herstelbare bron. Er is niets naar GitHub gepusht of gedeployed.

De noodzakelijke fixes zijn beperkt gehouden en in de volgorde schema -> API -> UI uitgevoerd. Remote staat de additive P5-scope-RPC-hardening geregistreerd. De form-projectie en autosave behouden de documentreferentie- en scopevalidatie; een actor zonder employee-context kan via de expliciete task-scope branch lezen en opslaan. De API-downloadroute gebruikt na de context-RPC het bestaande admin storage-signing pad voor exact het geautoriseerde process-document. De work- en work-item-projecties accepteren database-UUID's met geldige Postgres UUID-opmaak, ook wanneer de variantnibble niet RFC-4122 is.

Remote SQL-bewijs: `process_automation_p5_participant_access.sql` en `process_automation_p6_p7.sql` zijn na de hardening zonder fout geslaagd. Een expliciet geautoriseerde synthetische fixture `p4-p7-live-gate` leverde 4 P5-participant-items en een niet-lege P6-queuekandidaat. De live P7-proeven bewezen dubbele-runner-claim met één winnaar, crash/retry/backoff, expired-job naar dead-letter, operator-requeue, reminder-idempotency, output completion en job-success. De output werd `AVAILABLE` met HTML/PDF-metadata; de authenticated download gaf voor de geautoriseerde HR-admin/employee-context een lokale redirect naar het exact gesigneerde synthetische document.

Authenticated browser-bewijs op localhost:3000: HR-admin zag de vier P5-rollen met respectievelijk `Aanvrager`, `Manager`, `Voorwaardelijk HR` en `Observator`, inclusief formulier/submit en zonder load-, forbidden- of console-error. Manager claimde en actioneerde de P6-work-item; employee claimde de requester-item en autosave schreef een response revision. Twee gelijktijdige requester-claims hadden precies één winnaar. Keyboardbewijs toont focus op het formulierinput en autosave `Opgeslagen`. De queue bevatte tijdens de fixture zes zichtbare items voor HR-admin en manager. Een HR-admin zonder employee-context kreeg bij claim terecht HTTP 403; dit is tegelijk een open UI-contractpunt omdat de projectie daar nog een claim/action affordance toont.

Lokale verificatie na de laatste fix: 3 gerichte bestanden, 8/8 Vitest-tests groen (`workflow-job-service`, `process-output`, output-download route), strict typecheck groen en `git diff --check` zonder inhoudelijke fout. Repo-lint stopt vóór linting op de bestaande ESLint 10/`eslint-plugin-react`-compatibiliteit. Supabase advisors en types zijn opnieuw uitgevoerd.

De fixture is transactioneel en aantoonbaar opgeruimd: alle exacte form/process/instance/step/work-item/candidate/event/response/revision/job/output/document/audit-rows en het storage-object staan op 0. De bestaande drie fixtureaccounts zijn niet verwijderd; cleanup raakte alleen de synthetische fixturedata. Er is geen down-migratiescenario uitgevoerd.

### Open / handmatig na fase 9

- P5/P6: HR-admin scope-only claim/action moet productmatig worden beslist: affordance verbergen of een expliciete actor/reassign-flow toevoegen; de negatieve HTTP-403 is bewezen.
- P6: voer nog de expliciete kandidaat-zonder-claim negatieve action-check uit en leg de verwachte status vast.
- P6: volledige focus-ring/keyboardmatrix en axe-resultaat op `/work` en detail per rol zijn nog niet als eindbewijs vastgelegd.
- P7: persistente scheduler/cron-fallback en een echte live dubbele runner over procesrestart heen blijven handmatig te bewijzen; de SQL-kernelproeven zijn wel groen.
- P7: controleer na fase 9 nog het gedownloade bestand inhoudelijk (PDF-header/HTML-download) en cross-role downloaddeny voor een niet-geautoriseerde context.

### Handmatig testplan na fase 9

1. Log in als HR-admin, manager en employee en open `/work`; controleer lijst, zoek/filter/sortering, detail, vier P5-velden, NL/EN en geen cross-role data.
2. Gebruik twee sessies op één OPEN item: één claim moet winnen, de andere krijgt `ALREADY_CLAIMED`; controleer daarna release, toegestane action en stale expected-version.
3. Probeer vóór claim een action, een onjuiste HTTP-action en cross-tenant/output-download; verwacht respectievelijk de gedocumenteerde negatieve status, 403/404 en geen documentlek.
4. Doorloop alleen met toetsenbord: skip-links, combobox, tabs, formulier, submit, focus-ring en escape/terug; voer daarna axe uit op lijst en detail en noteer violations/incomplete apart.
5. Laat de scheduler minstens twee runners, crash/retry/backoff, expired/dead-letter, requeue en reminder opnieuw uitvoeren; controleer job-idempotency en persistence na restart.
6. Download HTML/PDF als geautoriseerde actor, controleer bestandstype/inhoud en herhaal als niet-geautoriseerde rol. Noteer elk resultaat naast dit document.

## Actuele P4/P5/P6/P7-gate 2026-08-08: Process Automation runtime, werk en automation

Deze overdracht gaat uitsluitend over P6 en P7 van `LIQUID_PROCESS_AUTOMATION_BLUEPRINT.md`, met de actuele P4/P5-handoff als gecontroleerde context. Het werk staat in featurebranch `codex/process-automation-p4-p5`; P8, product-AI, visual builder, commit, push, merge en deployment zijn bewust niet uitgevoerd. P4 is functioneel bewezen; P5 houdt participant-DOM/network-bewijs open. P6/P7 zijn opnieuw lokaal en remote gecontroleerd en hadden geen niet-lege remote fixtures.

Schema is remote toegepast via de P4/P5-runtime-, form-runtime-, schema-hardening-, hardening-, performance-, grants-, audit-, assignment-, form/action/start-alias-, label-text- en document-reference-compatibiliteitsmigraties. P4 bevat atomic start/action, locks, idempotency/correlation, conditions, assignment, terminal outcomes, parallel `ALL`, append-only events en gesaneerde audit. P5 bevat form versions, current/new revisions, expected-version autosave, server-side access/visibility/hidden projection, typed values, NL/EN labels, shared Zod payloads, accessible renderer en documentreferenties via `employee_documents` plus `document_audiences` en het bestaande documentleesrecht.

Remote security- en datatoegangcontrole voor P4/P5: RLS staat aan op alle zes runtime/form-tabellen en `audit_logs`; response-tabellen hebben geen directe authenticated tabelgrants. Public RPC-wrappers zijn invoker-only met authenticated execute; interne kernels zijn definer met authenticated execute en anon execute uit. Zes runtime-audittriggers zijn aanwezig; audit blijft beperkt tot canonieke CRUD-acties en slaat geen formwaarden op. `packages/db/types.ts` is opnieuw gegenereerd tegen het actuele remote schema.

Remote regressies zijn opnieuw geslaagd: P4/P5-contract, runtime/idempotency/stale concurrency, request changes/reject/cancel/rollback, parallel `ALL` en P5 vier-participant access projection/document domain. Iedere SQL-fixture gebruikte een transactie met rollback; remote tellingen zijn nul voor process instances, steps, workitems, events, form responses, revisions en P4/P5-auditrows. Supabase security advisor bleef projectbaseline (22 meldingen, 1 INFO/21 WARN) zonder P4/P5-target; performance had geen P4/P5-unindexed-FK-melding en alleen verwachte unused-index-INFO's op lege/tabellen.

De daaropvolgende P4/P5-statusregel is de historische handoff vóór de P6/P7-voortzetting; de actuele P6/P7-status staat in het blok eronder.

Lokale verificatie voor deze voortzetting: volledige Vitest 140 bestanden/527 tests, strict typecheck, i18n 29 namespaces, gerichte ESLint en Webpack-productiebuild met 179 pagina's zijn groen. Repo-brede ESLint blijft geblokkeerd door de bestaande ESLint 10/`eslint-plugin-react`-incompatibiliteit; de standaard Turbopack-build kan de externe `node_modules`-junction van deze feature-worktree niet verwerken, maar de Webpack-build slaagt.

Status: P4 is volledig bewezen. P5 is functioneel, remote en lokaal code-/testmatig uitgevoerd; participant-DOM/network-bewijs blijft open. De gecombineerde P4/P5-gate is niet 100%; stop vóór P6. Geen remote testdata, commit, push, merge of deployment achtergelaten.

### P6/P7-voortzetting en actuele deliverystatus

De vorige P4/P5-regels hierboven beschrijven de handoff vóór deze voortzetting. P6 is daarna gebouwd met lokale migraties `20260808170000_process_automation_p6_work_projection.sql`, `20260808170700_process_automation_p6_administration_filter.sql` en `20260808171100_process_automation_p6_role_permissions.sql`. De werkruimte `/work` gebruikt URL-state voor zoeken, tabs, filters en sortering en toont veilige projecties; het detail bevat subject/opdracht/formulier/current-new, voortgang, tijdlijn, actiebalk, assignmentuitleg en concurrentiefeedback. Sidebar, startpagina en medewerkerdetail-tab zijn aangesloten met gelijke NL/EN-sleutels.

P7 is gebouwd met de job-, kernel-, deadline-, output-, download- en hardeningmigraties `20260808170100` t/m `20260808171200` in de lokale worktree. Dit omvat locking, retry/backoff/dead-letter, deadlineprojectie naar bestaande reminders, in-app proceswerkprojectie, HTML/PDF-dossieroutput, actor-only outputrechten, operations/requeue en de wrapper-executionfix. Immediate drain en de authenticated schedulerfallback bestaan; een persistente schedulerconfiguratie is niet toegevoegd. Er is geen product-AI of externe mailprovider toegevoegd.

Remote bewijs is opnieuw gecontroleerd: de P6/P7-contracttest geeft `[]`; de drie nieuwe tabellen hebben RLS, elk één policy en geen directe `anon`/`authenticated`-tabelrechten. Er zijn 14 interne security-definerhelpers en 14 publieke invoker-wrappers met authenticated execute en anon geweigerd. Tenant-specifieke HR/TENANT-adminrollen hebben de Process Automation-permissions; `packages/db/types.ts` is opnieuw gegenereerd. P6/P7-specifieke securityadvisorwaarschuwingen ontbreken; resterende meldingen zijn inherited baseline of INFO's voor ongebruikte indexen op lege proces-tabellen.

Browserbewijs is groen voor HR-admin, manager en medewerker op `/work` in de lege-state; desktop 1280px en mobiel 390×844 hebben geen horizontale overflow. Een geautoriseerde niet-lege queue-kandidaat ontbreekt remote en er is geen seeddata achtergelaten. Open blijven P5 participant-DOM/network, queuekandidaat en niet-lege claim/action-rolflows, volledige keyboard/focus- en gerichte axe-controle, live P7 dubbele runner/crash-retry/dead-letter/verlopen-job/output/reminder/download, en persistente scheduler-operatie. De gecombineerde P4/P5/P6/P7-gate is daarom niet 100%; uitvoering stopt vóór P8.

## Historische P2/P3-gate 2026-08-08: Process Automation datamodel en work-item kernel

P1 is uitgebreid met P2 en P3. P2 staat remote als scopevast proces-/formulierdatamodel met drafts, immutable published versions, runtime instances/steps/workitems/events, typed employee/employment-subjectlinks, pinned process versions, RLS, canonical permissions, authenticated-SELECT-only grants en FK-indexen. P3 staat remote als assignment resolver/kernel: business date policies, `EXACTLY_ONE`/`ANY_ONE`/`ALL`, candidate eligibility, scope/self-assignment/deputyregels, evidence-materialisatie, claim/release/reassign/re-resolve, expected-version locking en audit-events. De API-adapters staan onder `apps/hr-suite/app/api/process-work-items/[workItemId]/`; P4 transition engine, studio/runtime-UI en product-AI zijn niet gestart.

Remote migraties: `20260808122825_process_automation_p2_foundation`, `20260808124007_process_automation_p3_workitem_kernel`, `20260808125031_process_automation_p2_grant_hardening`, `20260808125355_process_automation_p3_rpc_contract` en de additive FK-indexmigratie. De remote P2/P3-contracttest slaagt. De echte twee-sessie `ANY_ONE`-test slaagt: één claim wint op de instance-lock, de tweede krijgt `ALREADY_CLAIMED`; stale release, audit-events en directe tabelmutatie zijn eveneens gecontroleerd.

Verse lokale gate: 137 testbestanden/514 tests, gerichte Process Automation-tests 20/20, strict TypeScript, ESLint, i18n 28 namespaces, productiebuild 175 pagina's en `git diff --check` groen. De database-types zijn opnieuw gegenereerd en bevatten de nieuwe tabellen/enums/RPC's. Geen commit, push, merge of deployment.

De definitieve P2/P3-handoff is 100% afgerond. Na expliciete bevestiging zijn de twee tijdelijke concurrency-fixtures (`p3-concurrency-contract` en `p3-concurrency-contract-2`) in één gecontroleerde transactie verwijderd; de nul-rijencontrole omvatte definities, drafts, versions, instances, subjectlinks, steps, workitems, candidates en events. De drie tijdelijk uitgeschakelde immutable/append-only-triggers zijn in dezelfde transactie weer actief gezet. P4 en P5 zijn nog niet gestart. De lokale gates, remote contracttests, twee-sessie-concurrencytest, advisors, typegeneratie en migratielijst zijn gecontroleerd; er is geen commit, push, merge of deployment uitgevoerd.

## Historische P1-gate 2026-08-08: Process Automation definitiecompiler

De zin "P4 en P5 zijn nog niet gestart" in de historische P2/P3-handoff hierboven beschreef de status vóór deze branch. Lees voor de actuele status de P4/P5-sectie bovenaan.

Dit was de P1-startstatus; de actuele P2/P3-status en de resterende cleanup-blocker staan hierboven.

## Hotfix 2026-08-08: verplichte velden in dienstverbandwizard

## Hotfix 2026-08-08: administratie-409 en controlebalk

De terugkerende 409 bij de administratievoorwaardestap kwam door `employees_update_group`: een nieuwe medewerker heeft nog geen organisatieplaatsing en viel daardoor buiten `can_manage_employee`, ondanks een geldig HR-groepsrecht. Migration `20260808144955_allow_hr_group_employee_update_before_placement` is met expliciete toestemming remote toegepast op `wnpfloqpjvaacobppbpk`. De transactionele RLS-regressietest slaagde; tijdelijke testdata is teruggedraaid. De Controle-onderbalk staat nu absoluut vast binnen de wizardkaart met een scrollbaar middendeel.

Verificatie: leeftijds-/wizardtests 4/4, strict TypeScript, gerichte ESLint, i18n 28 namespaces, lokale browsercontrole van vaste onderbalk, remote policycontrole en Supabase security/performance advisors. Advisors tonen alleen bestaande projectbrede meldingen.

De dienstverbandwizard gebruikt nu één gedeelde validatie voor Administratie, Dienstverband, Contract, Rooster en uren, Salaris en Overige. Ook de voorafgaande medewerkergegevenscontrole valideert land, nationaliteit, geboortedatum en geslacht vóór de PATCH. Bij een ontbrekend verplicht veld wordt overal **Vul eerst alle verplichte velden in.** getoond; de technische 400- of algemene foutmelding wordt niet meer aan de gebruiker getoond. Een regressietest dekt de voorwaardestap en iedere wizardtab af.

Verificatie: gerichte Vitest (2 tests), strict TypeScript, gerichte ESLint en `git diff --check` zijn groen. De lokale authenticated browserflow bereikte de dienstverbandaanmaak maar bleef tijdens de bestaande medewerker-aanmaakrequest wachten; de uiteindelijke zichtbare dienstverbandtab is daardoor in deze run niet opnieuw bevestigd.

## Hotfix 2026-08-08: adres-409 bij herintreding vóór organisatieplaatsing

De resterende 409 kwam door een tweede RLS-scopefout. Een bestaand PRIMARY-adres van een medewerker zonder organisatieplaatsing was voor HR niet leesbaar, waardoor de herintredingsflow een dubbele adres-POST deed. Migration `20260808133244_allow_hr_preplacement_subresource_access` is met expliciete toestemming remote toegepast. De migration geeft HR binnen dezelfde HR-groep toegang tot medewerker-subresources en de activiteitenfeed vóór organisatieplaatsing, met behoud van tenant-, HR-groep- en permissionchecks.

Verificatie: remote `subresource_read_allowed=true` en één zichtbaar bestaand adres, remote migratielijst bevestigd, security/performance advisors uitgevoerd en lokale testsuite 137/514 groen. Advisors tonen alleen bestaande projectbrede meldingen.

## Update 2026-08-08: dienstverbandwizard voorkomt verouderde optiesnapshot

De dienstverbandopties worden bij het laden expliciet zonder browsercache opgehaald. Als de medewerker toch tussen laden en opslaan wijzigt, ververst de wizard de opties en probeert alleen opnieuw wanneer de relevante nationaliteit, geboortedatum en het geslacht niet door een andere wijziging zijn aangepast. Wanneer de actuele gegevens al overeenkomen met de invoer, gaat de wizard direct verder. Een echte wijziging van dezelfde persoonsgegevens blijft een controleerbare conflictmelding.

Verificatie: gerichte Vitest, strict TypeScript, gerichte ESLint en `git diff --check` zijn groen. Er is geen databasewijziging uitgevoerd.

## Update 2026-08-08: leeftijdsgrens en dubbele administratie-opslag

De nieuwe medewerkerwizard controleert een ingevulde geboortedatum op een leeftijd van minimaal 10 en maximaal 90 jaar, inclusief de grenswaarden. De controle geldt in de identiteitscontrole, de kerngegevens en de voorafgaande gegevensstap van het dienstverband; NL/EN-meldingen zijn toegevoegd.

De terugkerende 409 in Administratie is read-only bevestigd als een dubbele PATCH met dezelfde `updatedAt`-waarde: de eerste poging slaagt, de tweede poging wordt door de optimistic-concurrencycontrole geweigerd. De wizard blokkeert nu synchroon een tweede opslagactie totdat de eerste klaar is. Er is geen databasewijziging uitgevoerd.

Verificatie: leeftijds- en wizardvalidatietests (4 tests), strict TypeScript, i18n-pariteit, gerichte ESLint en `git diff --check` zijn groen.

## Update 2026-08-08: exacte BSN-match bepaalt wizardroute

Een exacte BSN-match kan niet meer via **Nieuwe medewerker aanmaken** verdergaan. Bij een bestaand actief dienstverband stopt de wizard en blijft alleen de route naar de bestaande medewerker beschikbaar. Bij een afgesloten dienstverband of een bestaande medewerker zonder dienstverband kan de gebruiker de bestaande persoonskaart laden, gegevens bijwerken en kiezen voor alleen bijwerken of bijwerken plus een nieuw dienstverband. Deze route gebruikt de bestaande Employee en gaat niet via `POST /api/employees`.

## Update 2026-08-08: wizardkop en aanmaakconflict

De overbodige subtitel boven de medewerkerwizard is verwijderd en de wizard start daardoor hoger. De stappennavigatie gebruikt op desktop geen sticky-top-offset meer en staat gelijk met de bovenkant van het invoerpaneel. De aanmaakactie behandelt elk `EMPLOYEE_NUMBER_CONFLICT`, ook zonder voorgesteld nummer, gericht op de kerngegevens; een dubbele BSN krijgt een eigen melding en verwijst terug naar de identiteitscontrole. TypeScript, ESLint, i18n, diff-check en authenticated browsercontrole zijn groen.

## Update 2026-08-08: lege controlesectie en dienstverbandconflict

Op de controlepagina wordt **Extra gegevens** alleen nog getoond wanneer minstens één aanvullend veld is ingevuld; een lege sectie verdwijnt volledig uit de samenvatting. In de eerste dienstverbandstap wordt na een geslaagde medewerker-PATCH de door de API teruggegeven `updatedAt` in de lokale optiesnapshot bijgewerkt. Daarmee blijft de optimistic-concurrencywaarde actueel voor vervolgacties. Een echte `EMPLOYEE_CONCURRENCY_CONFLICT` krijgt bovendien een gerichte NL/EN-melding. TypeScript, ESLint, i18n en een authenticated browsercontrole van de lege controlesectie zijn groen. Er is geen medewerker of dienstverband aangemaakt.

## Update 2026-08-08: medewerkerwizard controle en adreslayout

In Extra gegevens verschijnt het blok **Vrije velden** alleen wanneer de actieve HR-groep minstens één actieve medewerkerdefinitie heeft waarvoor de gebruiker schrijfrechten heeft. Zonder ingerichte medewerker-velden blijft het blok volledig weg. De adresinvoer gebruikt voor straat, huisnummer en toevoeging een vaste, nette veldverdeling. Bij binnenkomst op Controle wordt de scrollpositie naar boven gezet. De controle groepeert de volledige naamopbouw, naamgebruik, partnernaam en overige kerngegevens onder Identiteit; partnernaam staat niet meer los onder Extra gegevens. De controlefooter blijft op één regel met compactere knoptekst. Tijdens het aanmaken van een medewerker met dienstverband toont de wizard dezelfde blokkerende voortgangsweergave als bij de identiteitscontrole. TypeScript, lint, i18n en authenticated browsercontrole zijn groen.

## Update 2026-08-08: validatiemeldingen en Meer gegevens in medewerkerwizard

De medewerkerwizard toont bij ontbrekende verplichte kerngegevens nu **Vul de gemarkeerde verplichte velden in.** in plaats van de algemene foutmelding. Overige veldvalidatie gebruikt **Corrigeer de gemarkeerde velden**; adrescombinaties behouden hun specifieke adresmelding. Het grote blok **Meer gegevens** met toelichting en aanvullende kerngegevens is uit de kerngegevens-tab verwijderd. De wizard toont alleen een subtiele **Meer gegevens**-indicator tussen de navigatieknoppen wanneer er onder de huidige positie nog scrollinhoud staat. De extra-gegevens-tab behoudt haar eigen inklapbare blokken; identiteit en contact tonen hetzelfde signaal alleen wanneer er daar nog inhoud onder staat. TypeScript, lint, i18n en authenticated browsercontrole zijn groen.

## Update 2026-08-08: kerngegevens-tab medewerkerwizard

De kerngegevens-tab toont het personeelsnummer op een eigen rij, gevolgd door roepnaam en geboortenaam-tussenvoegsel. Het naamvoorbeeld toont alleen de volledige opgebouwde naam. Partnernaam heeft nu ook een afzonderlijk tussenvoegselveld; de naamopbouw gebruikt dit veld in alle partnernaam-volgordes. TypeScript, lint, i18n en authenticated browsercontrole zijn groen.

## Update 2026-08-08: bestaande medewerker gebruiken in medewerkerwizard

De medewerkerwizard biedt bij een gevonden persoon zonder dienstverband de expliciete actie **Deze medewerker gebruiken** en bij een persoon met alleen een afgesloten dienstverband **Herintreden met deze medewerker**. De bestaande Employee blijft behouden; de wizard laadt de persoons-, contact-, adres- en vrije-veldgegevens in de volgende tabs en maakt geen tweede Employee. Bij een medewerker zonder dienstverband kan de gebruiker op de controlepagina kiezen voor alleen **Medewerker bijwerken** of **Medewerker + dienstverband aanmaken**. Bij herintreding verschijnt bij de overgang naar het nieuwe dienstverband een tussenkeuze om bruikbare gegevens uit het laatst afgesloten dienstverband als voorstellen over te nemen of met nieuwe gegevens te beginnen. Contract-, rooster-, salaris-, organisatie- en kostenverdelingsvoorstellen worden server-side beperkt tot de gekozen administratie en actuele stamdata. Als de gebruiker de bestaande match niet kiest, blijft de route voor een nieuwe medewerker beschikbaar. Hiervoor was geen schemawijziging nodig.

Strict TypeScript, volledige ESLint, i18n-pariteit met 28 namespaces en `git diff --check` zijn groen. De authenticated lokale browsercontrole bevestigde de herintredingsactie voor Iris de Boer en het voorvullen van kern-, extra- en contactgegevens. De laatste opslagactie en publicatie van een nieuw testdienstverband zijn niet uitgevoerd om testdata niet te muteren.

## Update 2026-08-08: identiteitscontrole overslaan

De medewerker-aanmaakwizard heeft onderaan de identiteitsstap een actie om de controle over te slaan. Deze actie haalt wel het volgende personeelsnummer op en gaat door naar de kerngegevens, maar neemt geen ongeteste identiteitsvelden mee. NL/EN i18n-check en strict TypeScript zijn groen; een authenticated browsercontrole van deze nieuwe actie blijft open.

De navigatieknoppen van iedere wizardstap staan nu als onderbalk onderaan de vaste wizardhoogte en blijven tijdens scrollen zichtbaar. Boven de knoppen staat een subtiele dunne scheidingslijn. TypeScript, lint en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

Tijdens de identiteitscontrole wordt stap 1 tijdelijk geblokkeerd met een interactieve voortgangsweergave met drie fasen, voortgangsbalk en statusiconen. De controle gebruikt NL/EN i18n en verdwijnt automatisch zodra de matchrespons terugkomt. TypeScript, lint, i18n en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

De melding dat er meer inhoud onderaan staat is hoger boven de navigatiebalk geplaatst en gebruikt nu een subtiele groenige successtijl met duidelijke pijl. TypeScript, lint en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

De identiteitsstap toont geen apart `Identiteit`-label meer en de identiteits-progressiekaart toont geen extra toelichtingszin meer. Daarmee is verticale ruimte teruggewonnen; de voortgangstitel, fasen en balk blijven behouden.

De wizardonderbalk gebruikt nu minder verticale padding, waardoor meer ruimte beschikbaar blijft voor formulierinvoer. De scrollhint blijft erboven geplaatst. De herbruikbare UX-standaard staat in [`requirements/ux/WIZARD_UX_STANDARD.md`](../requirements/ux/WIZARD_UX_STANDARD.md) en is toegevoegd aan de documentatie-index.

De wizard heeft daarnaast een vaste hoogte per stap. De adresmelding blijft bij het straatveld uitgelijnd, geselecteerde adreszoekresultaten verdwijnen na keuze en de identiteitsacties staan op één regel met overslaan links en controleren rechts. TypeScript, lint, i18n en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

Na een afgeronde identiteitscontrole wisselt de onderbalk naar **Invoer nieuwe medewerker afbreken** links en **Doorgaan** rechts. De actie om de controle over te slaan en de controleknop verdwijnen dan. Bij een exacte match blijft de waarschuwing zichtbaar, maar kan de gebruiker zelf alsnog doorgaan met het invoeren van een nieuwe medewerker. TypeScript, lint, i18n en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

Na het voltooien van de kerngegevens toont de wizard onder de stappen **Nog niet opgeslagen** met een save-icoon. Handmatig opslaan maakt de medewerker met de beschikbare kerngegevens aan via de bestaande medewerker-API; daarna toont de wizard **Opgeslagen** en blijft de save-actie beschikbaar voor latere wijzigingen. Het afronden van de wizard werkt vervolgens de opgeslagen medewerker bij in plaats van een dubbele medewerker aan te maken. TypeScript, lint, i18n en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

De mobiele medewerkerwizard begrenst de breedte van de wizard, scrollcontainer, formulieren en veldlabels expliciet en verbergt horizontale overflow. Daarmee blijven tekstvelden op smalle schermen binnen het paneel. TypeScript, lint en `git diff --check` zijn groen; authenticated browsercontrole blijft open.

De kerngegevensstap gebruikt nu `Geboortenaam/Achternaam` en toont tijdens het typen een live naamvoorbeeld met roepnaam, achternaam, partnernaam en de gekozen naamvolgorde. De Extra gegevensstap bestaat uit twee standaard ingeklapte vensters: Optionele extra gegevens en Vrije velden; bestaande actieve HR-groepsvrije velden kunnen daar worden ingevuld en na het aanmaken opgeslagen. De wizard gebruikt een begrensd scrollbaar middenstuk, sticky onderknoppen en een verdwijnende pijlmelding wanneer er meer inhoud onderaan staat. Lokale controles: strict TypeScript, i18n-pariteit met 28 namespaces en `git diff --check` zijn groen. Authenticated browsercontrole van deze visuele flow blijft open.

## Update 2026-08-08: identiteitsmatch en medewerkerarchivering

De medewerker-aanmaakwizard toont bij gevonden medewerkers een uitklapbaar informatieblok met archiefstatus, medewerkertype, actief of laatst bevestigde dienstverband en administratie-nummer plus naam. De identiteitsmatch en de aanvullende dienstverbandread zijn beperkt tot de actieve HR-groep; daarmee worden cross-group kandidaten niet meer als bestaande medewerker aangeboden. De archiefmelding maakt een 404 door ontbrekende of niet-zichtbare HR-groepsscope expliciet. Lokale controles: strict TypeScript, ESLint, i18n-pariteit met 28 namespaces en `git diff --check` zijn groen. Authenticated browsercontrole van de nieuwe informatieweergave en de daadwerkelijke archive-mutatie blijft nog open.

De wizard berekent het voorgestelde personeelsnummer nu uit het hoogste werkelijk gebruikte numerieke nummer plus één. De reserverings-RPC wordt niet meer aangeroepen voor alleen het tonen van het voorstel; daarmee kunnen verlaten wizards het zichtbare nummer niet meer kunstmatig verhogen. De definitieve creatie blijft bij ontbrekende invoer via de bestaande reserveringsroute concurrencyveilig.

De wizard toont geen optionele-labels meer; verplichte velden tonen alleen een sterretje. Veldfouten worden bij blur opnieuw gecontroleerd en verdwijnen wanneer het veld geldig is; samengestelde fouten blijven staan tot alle betrokken velden samen geldig zijn. Dit UX-contract staat leidend in `docs/requirements/ux/FORMULIER_VALIDATIE_EN_LABELS.md`. Lokale controles na deze wijziging: strict TypeScript, ESLint, i18n-pariteit met 28 namespaces en `git diff --check` zijn groen.

De adresstap van de medewerkerwizard gebruikt nu dezelfde adreszoekopdracht en postcode/huisnummer-aanvulling als de persoonskaart. Suggesties vullen straat, huisnummer, toevoeging, postcode en plaats in; handmatige invoer blijft beschikbaar. Wanneer een straatnaam cijfers bevat, verschijnt in zowel de wizard als het bestaande woonadresformulier een niet-blokkerende controleopmerking dat dit onderdeel van de straatnaam kan zijn en dat het huisnummer apart moet worden gecontroleerd. Lokale controles na deze uitbreiding zijn groen; authenticated browsercontrole van de nieuwe wizard-adresflow blijft open.

## Release 2026-08-07: productversie 1.20260807.2

De zichtbare productversie is verhoogd naar `1.20260807.2` volgens de centrale releaseconventie. De versie-unit-test is bijgewerkt. Lokale releasegate: 132 testbestanden/490 tests, strict TypeScript, ESLint, i18n-pariteit met 28 namespaces en productiebuild met 175 pagina's zijn groen. Commit `98ac2ebc3c8c0b15dd73f373ea4f0889cf14d0a3` staat op `main` en is naar GitHub gepusht.

## Update 2026-08-07: medewerker-aanmaakwizard

De wizard is uitgebreid met een expliciete administratiekeuze als eerste dienstverbandstap bij meerdere administraties, uitklapbare administratiedetails en het medewerkertype op dienstverbandniveau: Medewerker, Stagiair, Uitzendkracht / Externe, ZZP / Freelancer, Vrijwilliger en Geen verloning (diverse). Na het dienstverband kiest de gebruiker of loon-/contractgegevens worden toegevoegd; bij ja worden contract, rooster, salaris, organisatie en kosten als extra wizardstappen aan de linkerzijde toegevoegd. De administratie-instelling ondersteunt nu één of beide betaalfrequenties (maand en 4 weken). De salarisstap ondersteunt salarisschaal + trede met bedrag, en de organisatiesectie functiegroep → functie → afdeling → leidinggevende plus gesplitste kostenallocatie.

De bestaande contractkolom `employment_contracts.worker_type` blijft alleen technische compatibiliteit; de UI vraagt het type niet meer op contractniveau en toont het type vanuit `employments.employment_type`. De migratie `20260807185745_expand_employment_types_and_wizard_flow` breidt de enum uit en maakt de complete employment-RPC geschikt voor zowel alleen dienstverband als dienstverband met looncontract. Samen met `20260807185718_allow_hr_address_creation_before_placement` en `20260807185727_allow_employee_administration_assignment_for_employment_creation` is deze remote toegepast. Security-advisor staat op 1 INFO / 21 WARN en performance op 344 INFO; dit is de bestaande projectbaseline. De officiële database-types zijn opnieuw gegenereerd. Vercel Production-deployment `dpl_66LXmSsJavEWFj34CFZqnjPfCKVy` (`liquidhr-9qqlv4578-edwinitsolutions.vercel.app`) staat op `READY` en is exact op deze commit gebouwd. De publieke alias `/login` geeft HTTP 200; de geauthentiseerde browsercontrole van de wizard blijft als handmatige vervolgstap open.

Lokale verificatie na deze uitbreiding: i18n 28 namespaces, 132 testbestanden/490 tests, strict TypeScript, ESLint, productiebuild met 175 pagina's en `git diff --check` zijn groen.

## Update 2026-08-07: dienstverband vervolgen in dezelfde wizard

De actie **Medewerker + dienstverband aanmaken** blijft nu in dezelfde wizard. De linker stappenlijst wordt uitgebreid met de zes dienstverbandstappen en gebruikt het bestaande dienstverbandformulier zonder medewerkergegevens opnieuw te vragen. Nationaliteit en land gebruiken een zoekbare landkeuze. De eerste dienstverbandstap bevat dienstverbandnummer, startdatum en ancienniteitsdatum; het medewerker-/personeelsnummer blijft op `employees`, terwijl het dienstverband een eigen `employment_number` heeft. Het medewerker-/personeelsnummer toont het hoogste gebruikte nummer, een lijst met gebruikte nummers en een debounced live uniekheidscontrole.

BSN is in de dienstverbandstap optioneel en toont uitleg wanneer het leeg blijft. De bestaande dienstverband-prerequisite-PATCH schrijft niet langer het medewerker-/personeelsnummer terug; daarmee wordt de gemelde 409 niet meer door een dubbele medewerker-update veroorzaakt. Voor een nieuwe medewerker wordt vóór het laden van de dienstverbandstappen een administratie-koppeling gelegd. De lokale migratie `20260807183000_allow_employee_administration_assignment_for_employment_creation.sql` bevat daarvoor de beperkte insert-policy voor gebruikers met `contract:write`.

Verificatie: strict TypeScript, volledige ESLint, 132 testbestanden/490 tests, i18n-pariteit met 28 namespaces, productiebuild met 175 gegenereerde pagina's en `git diff --check` zijn groen. De drie migraties zijn remote geregistreerd als `20260807185718`, `20260807185727` en `20260807185745`; de remote RLS/enum/RPC-controle en typegeneratie zijn groen. De geauthentiseerde browserflow volgt na de code-deployment. De read-only browsercontrole is niet opnieuw uitgevoerd omdat de lokale Playwright-daemon op deze sessie met `EPERM` startte.

De wizard heeft nu een afzonderlijk tabblad voor extra medewerkergegevens, toont partnernaam zodra een partnernaamvariant wordt gekozen, markeert verplichte en optionele velden en heeft op de controlepagina aparte acties voor alleen medewerker aanmaken en medewerker plus dienstverband aanmaken. Na opslaan navigeert de wizard naar de persoonskaart of direct naar het nieuwe dienstverband. De adresdatum wordt niet meer gevraagd; een nieuw adres krijgt onder water `1900-01-01` als `valid_from`.

De migratie `20260807185718_allow_hr_address_creation_before_placement` verruimt de bestaande helper voor HR-beheerders, zodat een adres van een zojuist aangemaakte medewerker ook vóór organisatieplaatsing of dienstverband kan worden opgeslagen. Dit adresseert de gemelde 403. De migratie is remote toegepast; de security-advisor blijft op de bestaande baseline en de officiële `packages/db/types.ts` is opnieuw gegenereerd.

Verificatie na de laatste codewijziging: 132 testbestanden/490 tests, strict TypeScript, volledige ESLint, i18n-pariteit met 28 namespaces, productiebuild met 173 pagina's en `git diff --check` zijn groen. De geauthentiseerde lokale browsercontrole bevestigde de nieuwe partnernaam-, extra-gegevens-, required/optional- en controleacties; daarbij is een stapindexfout gevonden en direct hersteld. Er is geen medewerker opgeslagen, geen commit, push, merge of deployment uitgevoerd.

## Testdatareset verlofopbouw 2026-08-07

Op Supabase-project `wnpfloqpjvaacobppbpk` is de verlof-/urenconfiguratie van tenant **De Sterren holding** gecontroleerd leeggemaakt voor de volgende testfase. Verlofaanvragen, allocations, append-only verloftransacties, saldo-buckets, opbouwregels, uitzonderingen, profielen, verloftypen, werkurentypen, overureninstellingen en gekoppelde testdata zijn verwijderd. Medewerkers, dienstverbanden, contracten, algemene verlofinstellingen en jaarcontroles zijn behouden. De append-only en immutable triggers zijn binnen de transactie tijdelijk uitgeschakeld voor deze expliciet toegestane testreset en daarna gecontroleerd weer ingeschakeld. Controle na afloop: alle tien relevante tenanttabellen staan op 0 rijen.

## Update 2026-08-07: CAO-/bedrijfsregelingentijdlijn

Het instellingenpad **Dienstverbanden en contracten → CAO / arbeidsvoorwaarden** beheert nu regelingen als opvolgende tijdlijnen. `labor_condition_sets` heeft `valid_from` en `predecessor_id`; bestaande vier regelingen zijn gevuld met startdatum en blijven roots zonder opvolger. De migratie `20260807145526_add_labor_condition_timeline` bevat de samengestelde predecessor-FK, index op tijdlijn, unieke opvolgerindex, trigger tegen ongeldige startdatums/cycli en de transactionele `create_labor_condition_successor`-RPC. De UI toont per regeling alle versies, geldigheid tot de dag vóór de volgende startdatum, huidige/historische status en toevoegen/wijzigen.

Verificatie: remote kolommen, trigger, authenticated RPC-execute en negatieve validatietest zijn gecontroleerd; 132 testbestanden/490 tests, i18n-pariteit (28 namespaces), strict TypeScript, volledige ESLint en productiebuild met 173 pagina's zijn groen. Geen commit, push, merge of deployment uitgevoerd.

## Update 2026-08-07: werkuren en overuren

Werkuren en overuren zijn gelijkgetrokken: bestaande namen en kleuren zijn bewerkbaar, naam is verplicht en hoofdletter-/spatieongevoelig uniek binnen de HR-groep, en het oude veld `Werkurentype` is vervangen door vier gedeelde beperkingen: onbeperkt, maximum uren per jaar, maximum uren per maand en maximum uren per week op basis van contracturen maal factor. Beide schermen tonen goedkeuring invoer, manager informeren, actief en selfservice als ja/nee-instellingen. Opslaan staat vóór archiveren; archiveren vraagt een ja/nee-bevestiging.

De instellingenpagina heet `Uren opbouw/schrijven` en de tab `Verlofopbouw`. Remote migratie `20260807151500_work_hour_configuration_controls` is toegepast op project `wnpfloqpjvaacobppbpk`; de nieuwe goedkeuringskolom, de unieke werkurentype-index en nul dubbele genormaliseerde werkurentypen zijn gecontroleerd. Lokale typecheck en i18n-check zijn na deze wijziging groen; lint, tests, build en browsercontrole volgen nog. Geen commit, push, merge of deployment uitgevoerd.

## Update 2026-08-07: fulltime-referentie voor verlof en dienstverband

De standaarduren van de gekozen CAO/bedrijfseigen regeling zijn de officiële fulltime-norm. De remote migrations `20260807141014_use_labor_condition_fulltime_reference` en `20260807162539_add_employment_contract_fulltime_reference` voegen op zowel `employment_contracts` als `employment_schedules` de verplichte snapshot `fulltime_hours_per_week` toe. Bestaande records zijn gevuld vanuit de gekoppelde regeling. De database-trigger houdt de contractsnapshot vast en laat nieuwe roosters de contractsnapshot gebruiken; de factor is `min(average_hours_per_week, fulltime_hours_per_week) / fulltime_hours_per_week`. De factor is begrensd op 1 en `work_scope` is nullable voor oproepkrachten.

De verlofservice, verlofaanvraaglimieten, verlofrapportage en pure leave-engine gebruiken deze begrensde factor. De nieuwe dienstverbandwizard en contract-/roostermutaties tonen de fulltime-norm en berekenen de factor automatisch; de dienstverbanddetailpagina toont de opgeslagen norm. Remote controle: 89 contracten en 88 roosters, geen ontbrekende fulltime-snapshot, geen formulemismatches en geen factoren boven 1. Lokale verificatie: 131 testbestanden/488 tests, strict TypeScript, i18n en productiebuild geslaagd. Supabase security- en performance-advisors tonen alleen de bestaande projectbaseline; er is geen nieuwe migratiespecifieke RLS-waarschuwing. Geen commit, push, merge of deployment uitgevoerd.

## Correctie 2026-08-07: uitzonderingen, samenvatting en verplichte naam

De uitzondering-editor verbergt de vervaltermijn zodra `Geen verlofopbouw` is geselecteerd en slaat dan expliciet `expirationMonths = null` op. De lijst en samenvatting tonen in dat geval geen vervaltermijn. Samenvattingen zijn uitgeschreven als leesbare zinnen; `Werkurentypen` wordt alleen genoemd bij opbouw op basis van werkuren. Een verloftypenaam is verplicht in de UI en wordt server-side en via een unieke, hoofdletterongevoelige HR-groep-index gecontroleerd. De remote migratie `20260807134827_leave_type_name_uniqueness` is toegepast en de controle vond geen dubbele namen.

## Update 2026-08-07: verlofopbouwinrichting

Afgerond in branch `feature/verlofopbouw-inrichting`: de catalogusrij voor een verloftype is volledig klikbaar met handcursor en Enter/spatiebediening; bestaande verloftypen zijn bewerkbaar. De beperking start nu met vijf keuzes: onbeperkt, verlofopbouw, uren per jaar, uren per jaar met deeltijdfactor en beperking door overuren. De oude `Soort verlof`- en profielvelden zijn verwijderd. De opbouweditor gebruikt `Contracturen` of `Werkuren`; de werkurentypen staan direct onder de keuze en specifieke periodes zijn 4-wekelijks, maandelijks of jaarlijks. Opbouwregelkaarten zijn volledig klikbaar en openen directe wijziging; `Opbouwregel toevoegen` neemt de laatste waarden over, heeft annuleren en toont de vervaltermijn als `6 Maanden`.

Remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`: lokale migrations `20260807100345_leave_accrual_enum_options`, `20260807100842_redesign_leave_accrual_configuration`, `20260807103107_apply_leave_fte_cap_to_requests`, `20260807104155_optimize_leave_type_overtime_indexes` en `20260807130219_update_leave_accrual_rule`; de laatste staat remote geregistreerd als `20260807130439_update_leave_accrual_rule`. De nieuwe overuren-koppeltabel heeft RLS/policies/grants/audit; de update-RPC valideert HR-groep, permission, referenties en typecombinaties transactioneel. Testdata is direct gerepareerd: oude weekfactorregels zijn deeltijdfactorregels geworden met `160` uren als testcap; actieve legacy-weekfactorregels zijn `0`. `packages/db/types.ts` is opnieuw gegenereerd.

Verificatie is groen voor i18n, strict typecheck, 130 testbestanden/482 tests, lint en productiebuild. De ingelogde Codex-browser met Test HR Admin bevestigde de klikbare wijzigingskaart, directe bestaande wijziging, kopie van de laatste waarden bij toevoegen, annuleren, zichtbare eenheid `Maanden` en 0 browserfouten of waarschuwingen. Geen commit, push of deployment uitgevoerd. Open blijft de volledige toekomstige opbouwprojectie en overuren-afgeleide engineberekening; die vallen buiten deze inrichting.

## Historische correctie 2026-08-05: productversie volgens documentatie

De zichtbare appversie wordt bepaald door `apps/hr-suite/lib/app-version.ts`, niet door de npm-versie in `package.json`. Volgens de vastgelegde conventie `X.datum.volgnummer` was de vorige productversie `1.20260805.1`. De technische packageversie blijft `0.1.2`; de versiecheck bewaakt de productversie.

## Release 2026-08-06: HR-groepconfiguratie en versie 1.20260806.2

De zichtbare productversie is verhoogd naar `1.20260806.2`. De remote migrations `20260806174202_hr_group_wide_configuration_scope`, `20260806174221_grant_hr_group_permissions_to_hr_admin` en `20260806174857_harden_hr_group_configuration_policies` zijn toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. Branding, feestdagen, eindredenen per land, vrije velden en bedrijfsdocumenten zijn daarmee HR-groepgescopeerd; `administration_id` blijft uitsluitend nullable historische provenance. Demo-namen zijn remote aanwezig via `20260806143509_rename_demo_scope_display_names`.

Remote bewijs: alle tien betrokken tabellen hebben geen lege `hr_group_id`, RLS is actief, de nieuwe holiday-RPC en custom-field securityfuncties bestaan en de groepsbrede unieke sleutels bevatten geen duplicaten. De officiële `packages/db/types.ts` is opnieuw gegenereerd. Advisors zijn security `1 INFO / 19 WARN` (projectbaseline) en performance `348 INFO / 0 WARN`.

Lokale releasegate: 130/130 testbestanden, 481/481 tests, strict TypeScript, lint, i18n-pariteit met 28 namespaces, productiebuild met 173 pagina's en `git diff --check` zijn groen. Geauthentiseerde browsercontrole: HR Admin ziet alleen HR-groep `Planeten`, de administratiekeuze ontbreekt in de sidebar, administratiegebonden contracten tonen `Jupiter BV` met wisselknop, de keuze-pagina toont Mars/Jupiter/Mercurius als kaarten en de accountweergave toont `Versie 1.20260806.2`; console 0 errors/0 warnings. GitHub bevat implementatiecommit `b6c5fc5f6ec9d9df79f465ba3f8cc2e2cfebbf8d`. Vercel Production-deployment `dpl_3LTk81cA8YdtGiRL27VQRWum1ADJ` (`liquidhr-p6m6ngtkm-edwinitsolutions.vercel.app`) staat op `READY` en is exact op die commit gebouwd. De runtimefoutscan en error/fatal-logscan zijn leeg; de publieke alias geeft zonder sessie de verwachte Vercel SSO-redirect.

## Performance-optimalisatie gepubliceerd naar main/Production 2026-08-07: startpagina en medewerkerslijst

Op `main` (commit `f600375b3c5bc24a7d01d852717531be2b8fa8dc`) is de request-keten van `/dashboard/start` en `/employees` geoptimaliseerd. Layout en pagina's hergebruiken één request-scoped autorisatiecontext, actieve context en Supabase-client. Onafhankelijke vertaal-, voorkeur-, directory- en databasereads lopen parallel. De startpagina gebruikt voor de medewerkerstelling twee smalle parallelle reads; de medewerkerslijst deelt de directe teamscope-query met de employee-overview-read. Dit verlaagt dubbele auth/client-setup en waterfall-latency zonder de autorisatiegrenzen te wijzigen.

Er is geen database-DDL toegevoegd: de relevante indexes zijn aanwezig en de live query/advisorcontrole gaf geen aanwijzing dat een nieuwe index voor deze routes de hoofdwinst oplevert. De lokale checks zijn groen: 130 testbestanden/481 tests, strict TypeScript, lint, 28 gelijke NL/EN-namespaces, productiebuild met 173 pagina's en `git diff --check`. De eerdere previews blijven als tussencontrole geregistreerd; de uiteindelijke GitHub-branch is `main`. Vercel Production `dpl_8pp1LgQBtgqJiMNeA1kwtS7VQ17M` is `READY` op `liquidhr-hfmd89rkp-edwinitsolutions.vercel.app`, exact op commit `f600375`.

Authenticated Chrome after-change meting op main/Production, drie runs per route: HR Admin startpagina `1312/1207/922` (mediaan 1207 ms), medewerkerdashboard `1037/994/985` (994 ms) en medewerkerslijst `908/868/762` (868 ms); Manager startpagina `3474/1128/1295` (1295 ms) en medewerkerslijst `995/752/1109` (995 ms); Employee eigen medewerkerdashboard `1068/1048/1067` (1068 ms) en medewerkerslijst `846/984/879` (879 ms). De Employee-rol rendert de startpagina niet als dezelfde route maar landt in de eigen medewerkercontext. Chrome-console: 0 errors/0 warnings; alle routes HTTP 200. Dit is een richtinggevende wall-clockvergelijking met normale cold/warm- en netwerkvariatie.

## Performance implementatie uitgevoerd 2026-08-07: meetlaag, startpagina en medewerkerdashboard

Commit `d7a3727f5acc4fc9d540e191c7d50db83cca47e0` voegt een opt-in server-trace toe via `?perf=1`. De startpagina start de teamscope-read samen met onafhankelijke reads, maakt de actieve-verzuimteller parallel en meet de afzonderlijke bronnen. Het medewerkerdashboard hergebruikt de request-scoped Supabase-client voor de detail/layoutvoorkeuren, leest alleen de drie nieuwste actieve dashboarddocumenten, paralleliseert overzichtsdata en slaat de notitiepermissiecontrole over op alle andere tabbladen. De medewerkerslijst is in deze slice niet functioneel gewijzigd.

Lokale gate: 130 testbestanden/481 tests, strict TypeScript, volledige lint, i18n-pariteit met 28 namespaces, productiebuild met 173 routes en `git diff --check` zijn groen. Supabase is read-only gecontroleerd op project `wnpfloqpjvaacobppbpk`: relevante indexes bestaan en de performance-advisor geeft 347 INFO/0 WARN; er is geen database-DDL, RLS- of typewijziging nodig. De code staat op `main`; de eerdere preview `dpl_7yQdNXbyww1gh2pkHhnVvJnmzqA6` blijft als tussencontrole geregistreerd.

Authenticated Chrome: de actuele main/Production-resultaten staan in de sectie hierboven. De server-traces op deployment `dpl_8pp1LgQBtgqJiMNeA1kwtS7VQ17M` tonen HTTP 200 voor `/dashboard/start` en `/employees/[employeeId]`, met parallelle reads na auth/context. De runtime-errorgroep die tijdens de controle zichtbaar was betreft een oude verlopen refresh-token op `/middleware` van een eerdere previewdeployment, niet deze main-deployment.

## Werkafspraak voor alle Luna-stappen vanaf 2026-08-05

Een Luna-stap is pas afgerond wanneer de volledige verticale slice is uitgevoerd: schema/Supabase (migratie, RLS, grants, audit en gecontroleerde testdata), API, UI, tests, documentatie en de relevante lokale, remote en geauthenticeerde browserverificatie. Open onderdelen of blokkades worden expliciet gemeld en blokkeren de status **afgerond**. Ga pas door naar de volgende stap nadat de huidige stap per alle eigen specs is beoordeeld.

## Demo-scope namen bijgewerkt 2026-08-06

De zichtbare namen van de synthetische `liquid-hr-demo-holding`-testdata zijn remote aangepast via migration `20260806143509_rename_demo_scope_display_names`. De klant heet **De Sterren holding**; HR-groep `DEFAULT` heet **Planeten** en bevat **Mars BV**, **Jupiter BV** en **Mercurius BV**. HR-groep `TEST-BOUNDARY` heet **TEST (leeg)** en bevat **Test BV** zonder medewerkers. De bestaande `TEST-MULTIGROUP`-groep bevat **DGA administratie** met één medewerker. Technische codes, ids, relaties, medewerkers en autorisaties zijn niet gewijzigd.

## Administratiekeuze voor HR-admininstellingen 2026-08-06

De administratie-dropdown is uit de HR-suite-sidebar verwijderd. De sidebar toont voor HR-admins nu alleen de HR-groepcontext; de administratie blijft wel server-side als actieve cookie/context beschikbaar voor schermen die die scope nodig hebben. De eerder bestaande administratie-switch API blijft de gecontroleerde cookie-wissel uitvoeren.

Voor administratiegebonden inrichting is `/settings/administration` toegevoegd. De route toont alle toegankelijke administraties binnen de actieve HR-groep als duidelijke kaartknoppen, markeert de laatst gekozen administratie en keert na keuze terug naar het oorspronkelijke scherm. Op het instellingen-scherm staat dezelfde vaste contextbalk met administratie, code/nummer, HR-groep en knop **Administratie wijzigen**. De route valideert de administratie tegen de servercontext en accepteert alleen interne instellingenbestemmingen als terugkeerpad.

De keuze-flow is aangesloten op: dienstverband-/contractcatalogi, medewerkerdirectory, eigen verzuimtaaktemplates, salarisstructuren en administratiegebonden stamdata (documentcategorieën). `/master-data` is gemengd en gebruikt daarom dezelfde keuze voor documentcategorieën; HR-groep-/tenantbrede schermen zoals bedrijf/locaties, afdelingen, functies, verlofcatalogus, algemene verzuiminstellingen, feestdagen, bedrijfsbranding, eindredenen, vrije velden, bedrijfsdocumenten, modules en jubileumregels krijgen geen administratiekeuze. De misleidende administratiekaart bij Afdelingen is verwijderd.

Verificatie: i18n-pariteit (28 namespaces), strict TypeScript, gerichte ESLint en nieuwe selectie-helpertests zijn groen. De volledige Vitest-run heeft 129 geslaagde testbestanden/480 geslaagde tests; één bestaande `lib/app-version.test.ts` faalt omdat de test `1.20260805.1` verwacht terwijl de bron al `1.20260806.1` bevat. Browsercontrole op poort 3000 bevestigde geen administratie-dropdown in de sidebar, keuze vóór `/settings/holidays`, zichtbare kaarten voor Jupiter/Mars/Mercurius, herinnering van Mars als laatst gekozen en wisselen naar Jupiter met zichtbare contextbalk. Geen schemawijziging, commit, push, merge of deployment voor deze UI-slice.

## Scopecorrectie groepsbrede HR-admininstellingen 2026-08-06

Bedrijfsinstellingen met kleuren/logo, feestdagen, eindredenen per land, vrije velden en bedrijfsdocumenten zijn gecorrigeerd naar HR-groep-eigendom. De lokale migration `20260806160000_hr_group_wide_configuration_scope.sql` backfillt `hr_group_id`, dedupliceert bestaande synthetische records binnen een groep, vervangt de administratiegebonden foreign keys/unieke sleutels en policies, en laat `administration_id` alleen als nullable historische provenance staan. `20260806161000_grant_hr_group_permissions_to_hr_admin.sql` vult de noodzakelijke HR-adminrechten aan.

De services, routes en dedicated UI-schermen gebruiken nu de actieve HR-groep en tonen daar geen administratiekeuze meer. De branding- en bedrijfsdocumentopslag gebruikt voor nieuwe bestanden een groepspad; bestaande paden blijven via het gekoppelde groepsrecord leesbaar. De gecombineerde Stamdata-overview blijft bewust administratiegekozen voor documentcategorieën; de aparte eindredenenpagina is groepsbreed.

Lokaal gecontroleerd: strict TypeScript, lint, i18n, tests en productiebuild zijn groen. De nieuwe migrations zijn remote toegepast, officiële DB-types zijn opnieuw gegenereerd, Supabase-advisors zijn uitgevoerd en de geauthentiseerde browsercontrole na de schemawijziging is geslaagd. De policy-hardening is aanvullend remote toegepast; security blijft op de bestaande projectbaseline en performance heeft geen waarschuwingen.

## Step-9-verificatie afgerond 2026-08-06

Step 9 is **afgerond**. De gecontroleerde fixturemigration `20260806101419_hr_group_step9_manager_multiple_employment_fixture.sql` staat één keer remote toegepast als `20260806130420_hr_group_step9_manager_multiple_employment_fixture`. De minimaal gescopeerde RLS-correctie staat lokaal in `20260806133314_hr_group_absence_employment_read_scope.sql` en `20260806133600_consolidate_employments_absence_read_policy.sql`; remote zijn deze geregistreerd als `20260806133414_hr_group_absence_employment_read_scope` en `20260806133633_consolidate_employments_absence_read_policy`.

De policy voegt geen brede `contract:read` toe. Zij laat een manager met `absence:write` uitsluitend bevestigde, niet-verwijderde employments lezen voor een medewerker die server-side binnen de managerrelatie valt. De dubbele permissieve policy-waarschuwing van de eerste correctie is met de tweede migratie geconsolideerd.

Remote bewijs: Omar (`DEMO-037`) heeft exact twee bevestigde actieve employments (`EMP-DEMO-037-A` en `RICH-TEST-0037`), exact twee actuele plaatsingen onder Yara (`DEMO-028`) en 0 absence-cases/0 absence-spells. De Step-8-contractproef is transactioneel groen; de finale remote policy-/invariantcontrole is groen. DB-types zijn opnieuw gegenereerd; advisors tonen de bestaande projectbrede baseline: security 1 INFO/19 WARN en performance 342 INFO/0 WARN.

De herhaalde lokale gate is groen: 129 testbestanden/478 tests, strict TypeScript, lint, i18n met 28 gelijke NL/EN-namespaces, productiebuild met 171 routes en `git diff --check`. Authenticated browserbewijs op poort 3000: HR Admin ziet Omar tweemaal; Test Manager ziet Omar in het eigen team, opent `/absence/new?employeeId=237affe2-7f4c-3c7f-b9bf-a37b2365eb6d`, ziet beide employmentopties, selecteert expliciet `RICH-TEST-0037` en slaat niets op. De finale browserconsole eindigt op 0 errors/0 warnings.

De Luna-controle bevestigt hiermee dat stap 1 t/m 9 volgens de werkafspraak zijn doorlopen. Alleen latere deactivatie-, verwijder-, merge- en splitfunctionaliteit blijft buiten deze slice. Geen commit, push, merge of deployment uitgevoerd.

## Domeinbaseline 2026-08-05: HR-groepen, verlof en parallel verzuim

De komende grote slice gebruikt [HR-groepen: scope, inrichting en domeingrenzen](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md) als actuele bron. De bijbehorende besluiten staan in [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md) en [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md); het uitvoeringsplan voor Luna staat in [LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md](LUNA_HR_GROEP_IMPLEMENTATIEPLAN.md).

Vastgelegd:

- HR-groep is de primaire switch en harde zichtbaarheidgrens binnen een holding/tenant.
- Een HR-admin switcht expliciet tussen HR-groepen; binnen de gekozen groep is administratiecontext optioneel.
- Edwin maakt HR-groepen aan via de Control Plane. Een HR-admin kan vanuit een geselecteerde HR-groep administraties aanmaken.
- Een bestaande administratie kan nooit naar een andere HR-groep worden verplaatst. Naam en nummer van een administratie zijn beheerbaar; het interne ID blijft stabiel.
- Bedrijf, locaties, afdelingen, functies, rollen, verlofregels en verzuiminstellingen zijn HR-groepbreed.
- Een persoon bestaat één keer binnen een HR-groep en kan nul of meerdere dienstverbanden hebben. Hetzelfde natuurlijke persoon kan in meerdere HR-groepen voorkomen met groepsspecifieke gegevens en eventueel zakelijke e-mailadressen.
- Salaris, payroll, CAO, verlofsaldo en verzuimcasus blijven dienstverband-/administratiegebonden.
- Een CAO is vast op een dienstverband. Overstappen betekent oud dienstverband afsluiten en nieuw dienstverband aanmaken.
- Verzuim is altijd per dienstverband. Overlap tussen verschillende dienstverbanden of HR-groepen is toegestaan; alleen overlap binnen hetzelfde dienstverband wordt geblokkeerd.
- Bij meerdere actieve dienstverbanden kiest de gebruiker eerst het dienstverband, tenzij de afdeling/functiecontext van de leidinggevende exact één geldig dienstverband bepaalt. Dit geldt voor verlof en verzuim.

Documentatie, schema, context/API/UI en de gecontroleerde remote testdata zijn in deze beurt aangepast; bestaande dirty wijzigingen van Edwin blijven onaangeroerd. De remote wijzigingen staan uitsluitend op het gekoppelde Supabase-testproject.

### Testdatabesluit

De huidige database bevat uitsluitend synthetische testdata. Voor de komende HR-groep-slice mag bestaande testdata worden aangepast, opnieuw gekoppeld, vervangen of opnieuw geseed. Zij mag geen belemmering vormen voor het nieuwe model. Er wordt geen fallback, dual-read, dual-write of compatibiliteitslaag voor het oude tenant-/administratiemodel gebouwd. Oude scopekolommen, filters, RPC-parameters en constraints mogen in een gecontroleerde, reproduceerbare testmigratie worden vervangen of verwijderd.

## Stap 3–5 uitgevoerd 2026-08-05: HR-groep-schema, context en bedrijf/locaties

De lokale migration `apps/hr-suite/supabase/migrations/20260805144951_hr_group_schema_and_test_data.sql` legt de eerste databasefundering vast: `hr_groups`, administratie- en domeinkoppelingen, groepsgebonden personen/catalogi/configuratie, employment-scoped verlof-, CAO- en verzuimrecords, composite foreign keys, immutable bestaande administratie-/groepskoppelingen, maximaal drie actieve CAO-sets per administratie, een vaste CAO per dienstverband, groepsgerichte toegang en restrictive HR-groep-policies bovenop de bestaande RLS-policies. De twee bestaande synthetische tenants krijgen ieder idempotent één `DEFAULT`-groep; er zijn geen extra productieachtige groepen of personen verzonnen.

De negatieve en structurele contractproef staat in `apps/hr-suite/supabase/tests/hr_group_schema.sql`. Die controleert onder meer RLS, volledige backfill, dezelfde groep voor administratie/dienstverband/verzuim, composite foreign keys, privileges, restrictive policies en de weigering van een cross-group verplaatsing van een bestaande administratie.

Verificatie: de remote migrations voor stap 3, 4 en 5 zijn toegepast, de officiële `packages/db/types.ts` is opnieuw gegenereerd, structurele en transactionele RLS-controles zijn geslaagd en de advisors zijn na de DDL opnieuw uitgevoerd. De lokale pgTAP-runner kan niet starten zolang Docker Desktop Linux Engine niet actief is; de equivalente remote contract- en transactietests zijn wel uitgevoerd. `TEST-BOUNDARY` is een idempotente grensfixture met één bedrijf, één administratie, één locatie en nul medewerkers.

## Stap 8 uitgevoerd 2026-08-06: verzuim per HR-groep en employment

De lokale migration `apps/hr-suite/supabase/migrations/20260806120000_hr_group_absence_per_employment.sql` is rechtstreeks op het gekoppelde Supabase-testproject toegepast onder de naam `hr_group_absence_per_employment`, omdat de lokale Supabase CLI op Windows door een EPERM/npm-cacheblokkade niet kon worden gestart. De migration maakt `absence_settings` uniek per `tenant_id, hr_group_id`, maakt casussen en ziekteperioden verplicht employmentgebonden, backfillt `absence_spells.employment_id`, legt composite casus/spell/capacity-FK's vast en blokkeert overlap alleen binnen dezelfde tenant, HR-groep en employment. De oude administratiegebonden settings policies en report/recovery-RPC's zijn vervangen door groepsgescopeerde varianten; `change_absence_capacity` is toegevoegd.

De report-, recovery- en capacity-services gebruiken de actieve HR-groep, server-side permissionchecks, veilige typed fouten en de gedeelde employment resolver. Exact één geldige employment wordt automatisch gekozen; exact één manager-match ook; nul of meerdere matches leveren een expliciete keuze op. `/absence/new`, het medewerkerdashboard en het verzuimdetail ondersteunen ziekmelding, gedeeltelijk herstel, volledig herstel en zoekbare employmentkeuze. De HR-groep-switcher ververst na een wissel de server-layout, zodat selector en inhoud dezelfde groep tonen. Nieuwe NL/EN-sleutels staan in de employees-namespace.

Remote controle: officiële `packages/db/types.ts` is opnieuw gegenereerd; advisors na de DDL tonen alleen de bestaande projectbrede/inherente baseline; de runner-onafhankelijke `apps/hr-suite/supabase/tests/hr_group_absence_step8_contract.sql` is transactioneel groen. De test controleert de vijf absence-tabellen met RLS/policies, groepssettings, employment-FK's, overlapconstraint, capacity-FK, grants/RPC-signatures, geen medische kolommen, parallelle employments/groepen, 50% capacity en herstelisolatie. De typed resolver-regressietest is 3/3 groen.

Lokale eindgate na deze slice: 129 testbestanden/478 tests, strict TypeScript, volledige lint, i18n-pariteit met 28 namespaces, productiebuild met 171 pagina's en `git diff --check` zijn groen. Op `http://localhost:3000` bevestigde de geauthentiseerde browser HR Admin groep A/B-inhoudswissel, twee zichtbare employments met expliciete keuze, volledig herstel op het synthetische Fin-dossier, partial capacity HTTP 200 op het synthetische Noah-dossier, manager één-match en medewerker-self-service op 390x844 met URL-state en 0 console-errors. De Step-9-fixture bevat nu een teamlid met meerdere geldige employments; die browservariant is in Stap 9 geauthentiseerd uitgevoerd. De twee herstelacties hebben uitsluitend bestaande synthetische testdossiers gebruikt.

**Status:** Stap 8 is functioneel uitgevoerd; de integrale Definition of Done en het toevoegen/herhalen van een browserfixture voor manager-meerdere-matches horen bij Stap 9. Geen commit, push, merge of deployment uitgevoerd.

## Stap 4 uitgevoerd 2026-08-05: context, autorisatie en Control Plane

De primaire HR-groepcontext staat lokaal in `apps/hr-suite/lib/context/administration-context.ts` en `apps/hr-suite/lib/context/server-context.ts`. De server leest toegestane groepsrelaties, valideert tenant → HR-groep → administratie en gebruikt de actieve groepsrelatie voor `AuthContext`, rollen en managementscope. De administratiecookie wordt bij een groepswissel gewist en een administratie uit een andere groep wordt niet geaccepteerd.

De HR-suite bevat lokaal de HR-groep-switcher, `/api/context/hr-group`, `/settings/hr-groups`, `/api/hr-groups` en de lijst-eerst groepsbeheer-UI. HR-admins kunnen binnen de actieve groep een administratie toevoegen en groepsnaam/omschrijving wijzigen. Bestaande administratie-groepkoppelingen zijn database-side immutable en HR-groepverwijdering is geblokkeerd. De aparte `apps/liquidhr-control` toont groepen per tenant en maakt groepen aan via de platformoperator-RPC.

Lokale verificatie: HR-suite 128 testbestanden/474 tests, strict typecheck, volledige lint, i18n-check en productiebuild geslaagd; Control Plane strict typecheck, volledige lint, i18n-check en productiebuild geslaagd. Remote verificatie bevestigde tenant → groep → administratie-scope, RLS, permissions, stabiele administratie-identiteit en de negatieve groep-A/B-controle. De geauthenticeerde browsercontrole bevestigde de primaire HR-groepswitch en de groepsbeheerflow.

Stap 4 is voor de eigen specs 100% vastgesteld. De volgende afgeronde slice is Stap 5 — bedrijf, administraties en locaties.

## Stap 5 uitgevoerd 2026-08-05: bedrijf, administraties en locaties

De tabellen `administration_company_data` en `administration_locations` zijn groepsbreed gemaakt met `hr_group_id`; de legacy administratie-eigenaarskolom is verwijderd. Bedrijven en locaties worden in de service/API/UI uitsluitend via de actieve HR-groep beheerd en de pagina `/settings/company-data` vraagt geen administratiekeuze. `employee_organizations` gebruikt een composite locatie-FK met tenant en HR-groep, en de locatie-RPC weigert een locatie uit een andere groep.

Administratienaam en `administration_number` zijn HR-admin-beheerbaar, auditbaar en wijzigen het stabiele interne ID niet. De remote `TEST-BOUNDARY`-fixture bevat één bedrijf, `TEST-BOUNDARY-ADMIN`, `Testgroep B locatie` en nul medewerkers. De gecontroleerde nummerwijziging en browserflow zijn na verificatie teruggezet naar `TEST-BOUNDARY-001`; het interne ID bleef `0ad929be-8dbf-4b8f-884e-46852f182512`.

Remote resultaat: standaardgroep 1 bedrijf/4 locaties zichtbaar, boundary-groep 0 bedrijf/0 locaties zichtbaar onder de tijdelijk beperkte fixturetoegang; anon heeft geen directe leesrechten. De cross-group locatie-RPC is transactioneel geweigerd. Lokale tests, i18n, strict typecheck, lint, productiebuild en Control-Plane-build zijn groen. Supabase-advisors tonen geen nieuwe security- of HR-groep-FK-waarschuwing; bestaande projectbrede baseline-meldingen zijn apart geregistreerd.

Stap 5 is voor alle eigen specs 100% vastgesteld. Stap 6 is daarna volledig uitgevoerd en per alle eigen specs gecontroleerd.

## Stap 6 uitgevoerd 2026-08-05: personen, dienstverbanden, organisatie en rollen

De Step-6-migrations `20260805200000_hr_group_people_organization_roles.sql`, `20260805203000_hr_group_people_rpc_alignment.sql`, `20260805203100_hr_group_complete_employment.sql` en `20260805203200_hr_group_step6_cross_admin_fixture.sql` maken personen, afdelingen, functies, roltoewijzingen en organisatieplaatsingen HR-groepgebonden. Employments blijven administratiegebonden maar dragen dezelfde `hr_group_id`; `DEMO-028` heeft twee actieve employments over `OPERATIONS` en `SERVICES`. Oude administratie-/tenantpolicies op deze domeintabellen zijn vervangen door groepspolicies met composite foreign keys, scopeguards, grants en audit.

De bijgewerkte services en UI gebruiken één groepscontext voor medewerkers, employmentoverzichten, organisatie, managementrollen, functies, organogram en startpagina. `list_employee_overviews` is group-aware. De employee-directorypagina weigert nu expliciet een medewerker zonder geldige administratiecontext met `/geen-toegang`, zodat een groep zonder eigen employment geen runtime-500 veroorzaakt; de geldige medewerkercontext blijft beschikbaar.

Remote gecontroleerd: `hr_group_people_organization_roles.sql`, `employee_overview.sql`, `employee_document_dossiers.sql`, `employment_complete_flow.sql` en `hr_group_step6_contract.sql` zijn geslaagd. De fixtures zijn `TEST-BOUNDARY` (0 personen), `TEST-MULTIGROUP` (1 groepspersoon), dezelfde managerlogin in twee groepen, `DEMO-028` met twee employments en minimaal twee managers over twee administraties in `RICH-02`. De officiële `packages/db/types.ts` is opnieuw gegenereerd.

Browserbewijs op localhost:3000: HR Admin zag `DEFAULT` met 58, `TEST-MULTIGROUP` met 1 en `TEST-BOUNDARY` met 0 medewerkers; organogram en roltoewijzingen wisselden mee met de groep. Manager zag 5 teammedewerkers in `DEFAULT` en geen medewerkers in `TEST-MULTIGROUP` zonder eigen teammatch. De employee-fixture is in een geldige administratiecontext gecontroleerd; zonder eigen administratiecontext volgt een normale server-side toegangweigering.

Lokale eindgate na Step 7: 128 testbestanden/475 tests, strict typecheck, volledige lint, i18n (28 namespaces), productiebuild (170 pagina's) en `git diff --check` zijn groen. Advisors na Step-7-DDL: security 1 INFO/19 WARN en performance 340 INFO/0 WARN; projectbrede/inherente meldingen zijn apart gehouden van Step-7-RLS. Remote is pgtap versioneerbaar geïnstalleerd; de drie relevante pgTAP-contracttests zijn rechtstreeks groen met 37/37, 23/23 en 35/35 assertions. De runner-onafhankelijke Step-6/7-contracttests en functionele remote tests zijn eveneens groen.

**Status:** Step 6 t/m Step 9 zijn voor alle eigen specs 100% vastgesteld. De integrale eindverificatie en handoff zijn afgerond. Geen commit, push, merge of deployment uitgevoerd.

## Step 7 uitgevoerd 2026-08-05: verlof per HR-groep en employment

De Step-7-migrations `20260805210000_hr_group_leave_scope.sql` t/m `20260805210800_hr_group_anon_privilege_hardening.sql` zijn lokaal aanwezig en remote toegepast. De groepscatalogi voor verloftypen, profielen, opbouwregels, bonusregels, voorrang, jaarsturing, employee sets en overwerk zijn HR-groepgebonden. Profielkeuzes, uitzonderingen, buckets, transacties, rollovers, allocaties en aanvragen blijven employmentgebonden; een persoonsbreed saldo bestaat niet.

De resolver volgt `employment exception -> employee set -> HR-group default`. API en service valideren tenant, groep, medewerker, employment, datums en dubbele keuzes server-side. De group-RPC's voor opbouwregel, bonusregel, opening balance, handmatige correctie, jaarafsluiting en aanvraag zijn permission-checked, atomair en waar nodig idempotent. Oude administration-RPC's zijn niet meer uitvoerbaar voor `authenticated`. `packages/db/types.ts` is officieel opnieuw gegenereerd.

De fixture bevat in `TEST-MULTIGROUP` `Stap 7 testverlof`, groepsstandaard 1.5 uur, employee-setprofiel 2.5 uur en één setlid. `TEST-BOUNDARY` heeft geen Step-7-catalogusrecords; `DEMO-028` heeft twee 2026-employment-buckets. Remote RLS gaf multigroup 1 verloftype/1 set, boundary 0, twee DEMO-028-balances en resolverbron `EMPLOYEE_SET`. De drie pgTAP-contracttests, Step-6-contracttests en relevante leave/overtime/employmenttests zijn groen.

Browserbewijs op localhost:3000: HR Admin zag de multigroup-catalogus, employee set, het setlid en beide profielversies; de uitzonderingsmodal toonde beide DEMO-028-employments en accepteerde een expliciete selectie zonder opslaan. Manager werd buiten HR-verlofbeheer naar de startpagina gestuurd; medewerker kreeg de verwachte `Nog geen toegang`. De cross-group grens is rechtstreeks met remote RLS en contracttests vastgesteld.

## Overdracht naar de volgende Luna-thread 2026-08-06

De volledige handoff staat in [LUNA_NEXT_THREAD_INSTRUCTIE_2026-08-06.md](LUNA_NEXT_THREAD_INSTRUCTIE_2026-08-06.md). Stap 6 en 7 zijn end-to-end uitgevoerd en per alle eigen specs 100% vastgesteld. Stap 8 is op 2026-08-06 functioneel uitgevoerd: verzuiminstellingen per HR-groep, verzuimcasus en ziekteperiode per employment, parallel verzuim over employments/groepen toegestaan en overlap alleen binnen hetzelfde employment blokkeren. De volgende thread gaat verder met Stap 9; de manager-multiple-match browserfixture blijft daar een expliciet open punt.

Lees vóór uitvoering de handoff, het Luna-plan, ADR-0009, FDR-0006, `VERZUIM_EN_HERSTEL.md` en `VERZUIM_INSTELLINGEN.md`. Houd de volledige verticale volgorde aan: schema/Supabase/RLS/grants/audit/testdata → API/service → UI/i18n → lokale en remote tests → geauthentiseerde browserflows → documentatie. Open punten, Docker-beperkingen, advisor-baseline en de dirty worktree staan in de handoff. Geen commit, push, merge of deployment zonder expliciete opdracht.

## Bugfix 2026-08-05: roltoewijzingen tonen alleen afdelingen uit actieve administratie

De afdelingskeuzes op `/role-assignments` waren tenantbreed, terwijl `department_management` per administratie wordt gelezen en opgeslagen. De service scoped de keuzelijst nu tot actieve afdelingen uit organisatieplaatsingen en bestaande roltoewijzingen binnen de actieve administratie. Daardoor verdwijnen afdelingen uit andere administraties uit de formulieren en blijft een bestaande historische/lege roltoewijzing zichtbaar in de juiste administratie.

Verificatie: 2 gerichte scope-tests plus de bestaande manager-resolvertests (7 tests), strict TypeScript en ESLint geslaagd. Een read-only query op de testtenant bevestigde dat de afdelingssets per administratie verschillen. Geen schemawijziging of remote datamutatie.

## Bugfix 2026-08-05: company-data PATCH payload

De bedrijfsgegevenspagina stuurde bij opslaan het volledige leesmodel mee, inclusief `id`. De strikte PATCH-validator accepteert alleen de wijzigbare bedrijfs- en adresvelden en gaf daardoor HTTP 400. De client maakt nu een expliciete updatepayload zonder `id`; een regressietest controleert dat deze payload door dezelfde schema-validator wordt geaccepteerd.

Verificatie: gerichte company-data-tests (4 tests), strict TypeScript, gerichte ESLint en `git diff --check` zijn geslaagd. Een directe schema-reproductie accepteert de nieuwe payload zonder `id`.

## Test Medewerker in Yara-team 2026-08-04

Remote toegepast via migration `20260804193021_move_test_employee_to_yara_team`. De bestaande fixture-account **Test Medewerker** is Noah Hendriks (`DEMO-035`). Zijn actuele organisatieplaatsing staat nu in `RICH-02` / **Test Operations**, met functie **Operations specialist** en Yara (`DEMO-028`) als directe leidinggevende. De medewerker valt daarmee binnen Yara's directe teamscope; Yara's team telt nu vijf medewerkers inclusief Noah.

## Testdata en statuslabels 2026-08-04: Yara-team voor rolcontrole

Remote toegepast via migration `20260804191903_manager_assignment_status_and_yara_team`. De eerdere brede synthetische directe-managerkoppelingen naar Yara (`DEMO-028`) zijn verwijderd. Yara staat nu in `RICH-02` / **Test Operations**, haar actieve `DIRECT_MANAGER`-toewijzing wijst naar dezelfde afdeling en haar actuele directe team bestaat uit `DEMO-032` Maya Bos, `DEMO-037` Omar Kaya, `DEMO-042` Sophie De Vries en `DEMO-047` Milan Visser.

De kolom **Controle nodig** is vervangen door **Type**. Voor een actuele afdelingstoewijzing van de systeemrol `DIRECT_MANAGER` toont de UI `LG-Afd` wanneer de leidinggevende zelf in dezelfde afdeling zit en `LG-Afd-Plus` wanneer de toegewezen afdeling afwijkt. Andere rollen of ontbrekende actuele plaatsingen tonen een liggend streepje. Daarmee hoort Yara nu `LG-Afd` te tonen.

## Bugfix 2026-08-04: roltoewijzingen volgen actieve administratie

De pagina Roltoewijzingen bood eerder alle tenant-medewerkers aan, ook wanneer zij geen actueel primair dienstverband in de actieve administratie hadden. Daardoor kon bijvoorbeeld Yara (`DEMO-028`, actief in Operations) vanuit de Holding worden geselecteerd en eindigde opslaan alleen met een generieke foutmelding. De lijst filtert medewerkers nu op een actueel bevestigd primair dienstverband in de actieve administratie; de server controleert dezelfde scope vóór insert. Gebruikers zonder `management-assignment:write` zien een duidelijke read-only melding en kunnen geen opslag starten.

Verificatie: strict TypeScript, i18n-pariteit en gerichte ESLint zijn geslaagd. Er is geen schemawijziging of remote datamutatie uitgevoerd.

## Nieuwe datafixture 2026-08-04: rijke synthetische medewerkerdataset

Remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk` via migration `20260804180940_seed_rich_employee_dataset`. De fixture is idempotent en gebruikt uitsluitend bestaande testrecords; auth-koppelingen en bestaande e-mailadressen zijn behouden. Er zijn geen echte personen, BSN's, IBAN's, foto's of storage-bytes gebruikt: bankvelden bevatten herkenbare fixture-ciphertext/laatste vier cijfers en avatars zijn ingebedde synthetische SVG-data.

De 72 medewerkers hebben nu telefoons, ingebedde avatars of bestaande avatars, primaire en secundaire adressen, primaire testbankrekening, partnerrelatie en waar van toepassing een kindrelatie. De 68 actieve medewerkers hebben allemaal een actueel bevestigd primair dienstverband, salaris, rooster en organisatieplaatsing met afdeling, functie, locatie en waar mogelijk een testmanager. Aanvullend zijn tenant-functiegroepen/functies, afdelingen, administratie-locaties, kostenplaatsen/kostendragers, 15 gesloten verzuimcasussen, 36 notities en 23 activiteiten toegevoegd. De bestaande testdata is niet opgeschoond of verwijderd.

Remote controle: alle genoemde actieve records missen geen dienstverband, salaris, rooster, organisatie, primair adres, primaire bankrekening of relatie. De transactionele dry-run vóór uitvoering was groen. Database-types zijn opnieuw opgevraagd; deze fixture wijzigde geen typecontract. Advisors na uitvoering: security 2 INFO en 15 WARN (bestaande authenticated SECURITY DEFINER/RLS-meldingen), performance 255 INFO en 0 WARN (bestaande index/FK-meldingen). Een echte productiebenchmark moet nog apart worden uitgevoerd; deze datafixture maakt de dataset daarvoor representatiever.

De migration herstelt ook de bestaande locatie-guardfunctie zodat een insert in `administration_locations` niet langer een kolom van een andere tabel probeert te lezen. Dit was nodig om de synthetische locaties veilig te vullen; er is geen gebruikersdata verwijderd.

## Nieuwe hardening 2026-08-04: Supabase security en performance

Remote toegepast: `consolidate_star_performer_select_policies` en `harden_security_definer_search_paths`. De drie dubbele permissieve SELECT-policy-waarschuwingen zijn verdwenen door de bestaande `FOR ALL`-writepolicies op `star_performer_assessment_tags`, `star_performer_assessments` en `star_performer_tags` op te splitsen in INSERT/UPDATE/DELETE; de bestaande read- en write-expressies zijn behouden. Voor de relevante `SECURITY DEFINER`-RPC's is `pg_temp` uit `search_path` verwijderd om tijdelijke-object-shadowing te voorkomen. Authenticated execute, tenantchecks, permissionchecks en RPC-signatures zijn niet aangepast.

Live advisors na de migraties: performance 258 INFO en 0 WARN; security 2 INFO en 15 WARN. De security-WARNs zijn de bewust via `authenticated` aangeroepen permission-checked RPC's. `absence_mutations` en `platform_support_sessions` blijven bewust RLS-only zonder directe policy. Leaked-password protection blijft een handmatige Supabase Auth-instelling. Gegenereerde database-types zijn opnieuw opgehaald; de wijzigingen veranderden geen tabel- of RPC-signature en daarom was er geen types-diff. Tests (480), strict typecheck, lint en productiebuild zijn geslaagd.

## Nieuwe slice 2026-08-04: fotoweergave medewerkerslijst

Aanvulling: naast de bestaande fotoformaten ondersteunt de lijst nu ook **Foto collage**: een strak vierkant raster met foto’s of initialen zonder namen.

De medewerkerslijst heeft naast Detail, Compact en Kaarten nu vier fotovarianten: **Foto's groot**, **Foto's standaard**, **Foto's klein** en **Alleen foto (vierkant)**. De eerste drie tonen alleen de foto of initialen en de voornaam; de vierkante variant toont alleen de foto/initialen met een dunne rand en zonder naam. Er verschijnen geen status, functie, afdeling, e-mail, personeelsnummer of actie-tekst. De responsive grid gebruikt per variant een passende minimumtegel; de standaardvariant kan op de gecontroleerde desktopbreedte acht kolommen vullen. Als een avatarroute voor de huidige rol niet toegankelijk is, valt de tegel veilig terug op initialen zonder de autorisatie te verruimen. De bestaande rolbewuste overlay blijft actief voor volledige profielroutes en collega-popups.

Er is geen Supabase-schemawijziging nodig: `photo` is toegevoegd aan de bestaande gevalideerde `employeesList`-voorkeur. Tests, strict typecheck, gerichte ESLint en i18n-controle volgen na de browsercontrole.

## Nieuwe slice 2026-08-04: kaartweergave medewerkerslijst

De medewerkerslijst ondersteunt nu **Detail**, **Compact** en **Kaarten**. De keuze staat in het bestaande filterpaneel en wordt via `/api/preferences/employees` opgeslagen in `user_preferences.ui_state.employeesList`; er is geen schemawijziging nodig. De kaartweergave is responsive met `auto-fit`, toont alleen velden die volgens de bestaande rol- en HR-directoryinstellingen zijn toegestaan en gebruikt voor medewerkerscollega's dezelfde popup als de lijstweergave. Daardoor verschijnen personeelsnummers niet in employee-directorykaarten, terwijl directe teamleden en bevoegde HR-weergaven hun bestaande profielroute behouden.

Verificatie: employee-list-state-tests (9/9), strict typecheck, gerichte ESLint, i18n-pariteit, Supabase SQL-controle (`saved_card_preferences = 1`) en authenticated browsercontrole op poort 3000. De browser toonde 20 medewerkerkaarten zonder personeelsnummer, met 19 veilige collega-popups en uitsluitend de eigen profiel-link; de Lina-popup bevatte functie, afdeling, zakelijk e-mailadres, telefoon, weekaanwezigheid zonder reden en rooster. De interne browser staat op de medewerkerkaartlijst klaar voor handoff.

## Nieuwe slice 2026-08-04: managerbeschikbaarheid op de startpagina

Managers zien op de startpagina als eerste brede venster **Beschikbaarheid team**. Het venster toont vandaag tot en met zes dagen vooruit, met teamleden verticaal en dagen horizontaal. De weergave kan wisselen tussen **Aanwezig** (beschikbaar, niet ingepland, verlof of verzuim) en **Uren aanwezig** (geplande uren; verlof en verzuim tonen nul). De data wordt server-side beperkt tot de directe managerstam en gebruikt bestaande werkpatronen met legacy-roosterfallback, goedgekeurde verlofaanvragen en actieve verzuimspells. Niet-managers krijgen geen teamdata. Er is geen schemawijziging of remote write uitgevoerd.

De widget staat als nieuw breed venster vooraan in de bestaande persoonlijke startpaginalayout; een opgeslagen layout krijgt dit nieuwe venster eenmalig vooraan en kan daarna in Full met de bestaande drag-and-drop/pijlen worden verplaatst. i18n-pariteit, strict typecheck, ESLint, de nieuwe layouttests en `git diff --check` zijn lokaal geslaagd. Authenticated browsercontrole op poort 3000 bevestigde de managerkop, de 7 dagen, de links naar teamleden, de aanwezigheidstekens, de urenweergave en de brede linkerkolom. Dezelfde controle bevestigde dat HR Admin geen teamwidget krijgt.

## Nieuwe controle 2026-08-04: medewerkersdirectory alleen actieve medewerkers

Voor `employee-directory:read` forceert de server `archive=active` en filtert de geladen overviewdataset na statusbepaling op `ACTIVE_EMPLOYEE`. De medewerkerpagina biedt alleen de arbeidsstatus **Actief** en archiefstatus **Niet-gearchiveerd**; URL- of opgeslagen voorkeuren voor toekomstige, uit-dienst-, externe of gearchiveerde records kunnen de directoryscope niet uitbreiden. Managers gebruiken de bestaande volledige status- en archiefopties.

Browsercontrole op poort 3000: `Test Medewerker` zag alleen de actieve directoryweergave en miste de filters Toekomstig, Uit dienst, Externe persoon, Gearchiveerd en Alle medewerkers. `Test Manager` op `scope=all` behield de filters Toekomstig, Uit dienst, Externe persoon, Gearchiveerd en Alle medewerkers. Remote SQL telde in de huidige tenant 0 toekomstige en 0 gearchiveerde records; daarom is de managerbehoudcontrole via filters en serverlogica bevestigd. Typecheck, gerichte ESLint en `git diff --check` zijn uitgevoerd. Geen Supabase-schemawijziging nodig.

## Nieuwe controle 2026-08-04: personeelsnummer niet zichtbaar in medewerker-directory

De medewerkerdirectory toont het personeelsnummer niet meer in de medewerkerslijst en gebruikt het ook niet voor zoeken. De veilige popup projecteert het nummer al niet; de remote SQL-controle bevestigde dat `get_employee_directory_detail` geen `employeeNumber` of `employee_number` teruggeeft. Dezelfde lijstbeperking geldt voor managerrecords buiten het directe team, die als medewerker-collega worden behandeld.

Interne browsercontrole op poort 3000 met `Test Medewerker`: 20 records zichtbaar, namen/functie/afdeling/e-mail aanwezig volgens de vrijgave-instellingen, geen `Personeelsnummer:` in de lijst; Lina Bakker-popup geopend zonder personeelsnummer. Typecheck en gerichte ESLint zijn geslaagd. Geen Supabase-schemawijziging nodig.

## Nieuwe slice 2026-08-04: directoryzichtbaarheid geldt ook voor de lijst

Naam is server-side verplicht zichtbaar en de HR-checkbox is aangevinkt maar disabled. De overige vijf HR-instellingen worden zowel in de collega-popup als in de medewerkerslijst toegepast; verborgen functie/afdeling en zakelijk e-mailadres worden bovendien niet opgenomen in de lijstzoektekst.

Remote migration `employee_directory_visibility` is toegepast. De visibility-RPC geeft `showName: true` terug en behoudt tenant-, administratie- en permissionchecks. In de interne Codex-browser op poort 3000 bevestigde HR de disabled Naam-checkbox. Met functie/afdeling en zakelijk e-mailadres tijdelijk uit zag `Test Medewerker` de namen nog wel, zonder die velden in de lijst of popup; telefoon, aanwezigheid en rooster bleven zichtbaar. Alle drie demo-administraties staan na de test terug op alle defaults `true`. Typecheck, gerichte ESLint, i18n-check, Supabase advisors en `git diff --check` zijn uitgevoerd; de projectbrede advisors blijven bestaande security/performance-meldingen tonen, inclusief de bewust authenticated SECURITY DEFINER visibility-RPC.

## Nieuwe slice 2026-08-04: manager buiten team krijgt collega-popup

De medewerkerslijst begrenst nu ook managers: directe teamleden blijven links naar de volledige detailpagina; records buiten het directe team worden knoppen die de bestaande beperkte collega-popup openen. `TENANT_ADMIN` behoudt zijn volledige administratie-scope. Dezelfde grens staat in de detailroute: een manager kan een niet-teamlid niet via een handmatige URL openen. De directory-detail-RPC accepteert naast `employee-directory:read` ook `employee:read`, maar blijft server-side beperkt tot de HR-vrijgegeven directoryvelden.

Browsercontrole met `Test Manager` op poort 3000: `scope=all` toonde 20 medewerkers, Bas de Jong buiten het team opende als popup met telefoon/aanwezigheid/rooster en zonder manager-tabs, Lina Bakker als teamlid opende de volledige detailpagina. Een directe URL naar Bas werd naar `/employees` teruggestuurd. Remote migration `manager_non_team_directory_privacy` is toegepast; advisors opnieuw uitgevoerd.

## Nieuwe slice 2026-08-04: medewerkersdirectory voor medewerkers

De medewerkerslijst is beschikbaar voor `EMPLOYEE` via `employee-directory:read`, met de nieuwe HR-inrichting **Medewerkers mogen de medewerkerslijst openen** (default `true`). Collega's openen voor medewerkers een veilige popup; de volledige collega-detailroute blijft server-side geblokkeerd. HR kan naam, functie/afdeling, zakelijk e-mailadres, zakelijk telefoonnummer, weekaanwezigheid zonder reden en rooster afzonderlijk vrijgeven; alle velden starten aan. De Supabase-RPC gebruikt alleen deze veilige projectie, controleert tenant/administratie/permission en exposeert geen absence-reden of HR-detaildata.

Remote toegepast: `employee_directory_settings_v5`, `employee_directory_access`, `employee_directory_schedule_fallback`, `employee_directory_schedule_fallback_v2`, `employee_directory_presence_date_v2` en `employee_directory_presence_date_v3`. DB-types zijn opnieuw gegenereerd. In de interne Codex-browser op poort 3000 zag de medewerker 20 collega-records, opende Lina Bakker in een popup met telefoon, aanwezigheid en rooster, en zag na het uitzetten van zakelijk e-mailadres dat veld niet meer. De instelling is daarna op de geteste administraties teruggezet naar alle defaults `true`. Typecheck, i18n, gerichte ESLint, Supabase security/performance advisors en `git diff --check` zijn uitgevoerd; advisors tonen bestaande projectbrede definer-/indexmeldingen, waaronder de twee nieuwe bewust server-side permission-checked RPC's.

## Nieuwe slice 2026-08-04: medewerkerslijst opent gesloten met Mijn team-preset

De medewerkerslijst opent altijd met het filterpaneel gesloten. De eerdere `filterPanelOpen`-waarde uit `user_preferences.ui_state.employeesList` wordt niet meer gelezen of opgeslagen; tijdens een volgende opslag wordt de oude sleutel uit die JSON-scope verwijderd. Status, archief, sortering en weergave blijven wel persoonlijke lijstvoorkeuren.

De herbruikbare `employeeListMyTeamHref()` forceert `status=active-future-external`, `archive=active` en `scope=team`. De preset omvat `ACTIVE_EMPLOYEE`, `FUTURE_EMPLOYEE` en `NEVER_EMPLOYED` (de UI-tekst **Actief + toekomstig + externe personen**) en sluit voormalige medewerkers uit. De startpagina gebruikt deze helper voor beide Mijn team-doorklikken.

Authenticated browsercontrole op poort 3000 bevestigde de manager-startpaginadoorklik met exact deze URL, 17 teamrecords met externe personen, een gesloten filterpaneel bij openen en een expliciete `status=ACTIVE_EMPLOYEE`-variant met 13 actieve teamrecords. HR Admin opent de lijst eveneens gesloten.

## Nieuwe slice 2026-08-04: rolgebonden startpagina- en medewerkerslijstscope

De startpagina gebruikt voor `DIRECT_MANAGER` de kop **Wat speelt er nu in mijn team** en voor `TENANT_ADMIN` **Wat speelt er nu in ons bedrijf**. Bij beide actieve rollen staat een teamscope/bedrijfsscope-switch. De managerlink achter de kop opent `/employees?status=active-future-external&scope=team`, zodat andere schermen deze scope en filterpreset geforceerd kunnen doorgeven.

De medewerkerslijst bepaalt zonder `scope` voor een manager standaard `team`; het filterpaneel toont daarna de actieve keuzes **Mijn team** en **Alle medewerkers**. `scope=team` wordt in de service alleen voor `DIRECT_MANAGER` geaccepteerd. De startpagina filtert teamgerichte medewerkers-, verzuim-, verlof- en gebeurtenisdata op dezelfde directe teamscope; een gecombineerde manager/HR-admin kan bewust naar bedrijfsscope schakelen.

De bestaande Werk-in-uitvoering-placeholder **Taken & Poortwachter** is alleen zichtbaar voor manager/HR Admin; medewerkers krijgen deze managementactie niet. Er is geen taakinstantiebron in de huidige Workforce-code, dus er wordt geen fictieve taakcount getoond.

Verificatie in deze beurt: i18n-pariteit, strict TypeScript, ESLint, gerichte employee-list-state-tests, `git diff --check` en authenticated browsercontrole op poort 3000 zijn geslaagd. Er is geen schemawijziging, remote write, commit, push of deployment uitgevoerd.

## Nieuwe slice 2026-08-04: volledig organogram voor medewerkers

De medewerker mag het volledige organogram van de actieve administratie lezen. De route gebruikt hiervoor de bestaande canonieke `organization-chart:read`-permission als zelfstandige leespermission; medewerkers krijgen geen managementrechten, HR-schrijfopties of star-performerbeoordelingen. De migration `20260804170000_employee_full_organization_chart_read.sql` is remote toegepast en de relevante RLS-policies, employee-role permission en veilige projectie zijn gecontroleerd. Security- en performance-advisors tonen alleen bestaande projectwaarschuwingen. Strict TypeScript, gerichte ESLint en DB-typegeneratie zijn geslaagd. Authenticated browsercontrole blijft open.

## Nieuwe slice 2026-08-04: Ontwikkeling voor medewerkers

De sidebarlabel `Workforce` heet nu `Ontwikkeling`. De route `/workforce` is voor medewerkers een self-service landingspagina: alleen `Doorlopende beoordeling` naar `/my-appraisal` en `Talentprofielen` naar `/my-talent` worden getoond wanneer de medewerker daarvoor de bestaande self-permissions heeft. Managers en HR Admins behouden hun bestaande Workforce-tegels en routes. Dezelfde persoonlijke filtering is doorgetrokken naar de Workforce-strip op de Startpagina. Lokaal zijn i18n, strict TypeScript en gerichte ESLint geslaagd; er is geen schemawijziging of remote write uitgevoerd.

## Nieuwe slice 2026-08-03: Full/Compact en persoonlijke startpagina-layout

De Startpagina-header heeft een persoonlijke Full/Compact-schakelaar. Full toont weer, komende dagen en de reorder-controls; Compact maakt de header korter en toont alleen de begroeting/naam. De brede vensters (documenten, beoordeling, afwezigheden, verzuimgevallen, gebeurtenissen en KPI's) en smalle vensters (reminders en werk in uitvoering) kunnen in Full per kolom met pijlen of drag-and-drop worden geordend. De directe PATCH-opslag hergebruikt `user_preferences.ui_state` onder `startPage`, met behoud van bestaande voorkeuren en zonder schemawijziging, remote write, commit, push of deployment.

Verificatie in deze run: i18n, strict TypeScript, ESLint en `git diff --check` zijn geslaagd. De geauthenticeerde browsercontrole bevestigde HR Admin Compact na herladen, Full met zichtbare weer/komende-dagen en controls, een opgeslagen herordening na herladen, en de managerstartpagina met eigen Full-voorkeur, Mijn gegevens, Mijn team, Nieuw ziektegeval en 13 actieve medewerkers in scope.

## Nieuwe slice 2026-08-03: Workforce-links op de startpagina

De zin **Je vrije dashboardwerkplek blijft beschikbaar via Dashboard.** is verwijderd. De onderste Snel naar-sectie bevat nu een uitbreidbare Workforce-strip met de bestaande functies 9-grid, Doorlopende beoordeling, Talentprofielen, Star Performers en Cloud tags. De Startpagina bouwt deze links vanuit de actieve permissions; managers en HR Admins krijgen daarmee alleen routes die zij al mogen openen. Geen schemawijziging, remote write, commit, push of deployment.

Verificatie in deze run: i18n, strict TypeScript en ESLint zijn geslaagd. De geauthenticeerde browsercontrole bevestigde voor manager en HR Admin de correcte rolgebonden Workforce-links en de bestaande `/workforce`-bestemming.

## Nieuwe slice 2026-08-03: bestaande gebeurtenissenbron op startpagina hersteld

De startpagina bevatte al het echte venster **Gebeurtenissen** met een link naar `/insights/upcoming-events`, maar toonde daarnaast nog een verouderde Werk-in-uitvoering-placeholder met dezelfde naam. Die dubbele placeholder is verwijderd. De service filtert gebeurtenissen voor `DIRECT_MANAGER` op actieve directe teamleden; HR Admin blijft binnen de actieve administratie-scope. De managerdoorklik naar het bestaande gebeurtenissenrapport gebruikt de remote toegepaste migratie `20260803200000_allow_manager_upcoming_events_report` en dezelfde teamscope. Geen commit, push of deployment.

Verificatie in deze run: i18n-pariteit, strict TypeScript, ESLint, `git diff --check` en 3 gerichte testbestanden/11 tests zijn geslaagd. De geauthenticeerde browsercontrole bevestigde de managerstartpagina (13 actieve teamleden, teamlinks en echte gebeurtenissenkaart), de HR Admin-startpagina (8 actieve medewerkers binnen de administratie) en het HR Admin-gebeurtenissenrapport. De managerdoorklik wacht nog op remote toepassen van de nieuwe rolpermission-migratie.

## Nieuwe slice 2026-08-03: persoonlijke medewerkerdashboard-samenvatting

De overview van een medewerker gebruikt nu de aparte component `EmployeeDashboardSummary`. Deze component bevat uitsluitend persoonlijke gegevens: naam, leeftijd/verjaardag, zakelijke en privécontactgegevens, woonadres, primaire bankrekening en noodcontacten. De component gebruikt dezelfde server-side geladen `EmployeeDetailViewModel`; er is geen nieuwe autorisatie- of database-entiteit toegevoegd.

Managementinformatie blijft op de Startpagina: de Startpagina bevat de tenant-/teamscope-KPI's en operationele managementblokken. De medewerkerlanding blijft door de rolrechten rechtstreeks naar de eigen medewerkerpagina sturen. Lokale controle van deze UI-slice: strict typecheck, gerichte ESLint, `git diff --check` en de bestaande dashboardlayouttest (2/2) zijn geslaagd. Geen commit, push of deployment.

## Nieuwe slice 2026-08-03: managerstartacties en teamscope

De startpagina voor managers en HR Admin heeft bovenaan een uitbreidbare rij snelacties: Mijn gegevens opent het eigen medewerkerdashboard, Mijn team opent de medewerkerslijst op de directe teamscope en Nieuw ziektegeval opent de bestaande ziekmeldingsflow. Op kleine schermen blijven de iconen zichtbaar. Alleen gebruikers met de `DIRECT_MANAGER`-rol krijgen de teamscope-optie in de medewerkerslijst.

De teamscope wordt server-side bepaald uit actieve `employee_organizations`-regels met `direct_manager_id`; de manager krijgt zichzelf niet terug als teamlid. De startpagina filtert teamgerichte aantallen, afwezigheden, verlof en gebeurtenissen op deze scope. HR Admin werkt binnen de actieve administratie-scope. Er is voor deze slice geen nieuwe migratie of remote write uitgevoerd.

Lokale verificatie: strict typecheck, ESLint, i18n-pariteit, gerichte tests (3 bestanden, 10 tests), productiebuild en `git diff --check` zijn geslaagd. De geauthenticeerde manager-browsercontrole op poort 3000 bevestigde de drie links, 13 actieve medewerkers binnen de 22 directe teamtoewijzingen, de startpaginacijfers op teamscope en de icon-only weergave op 390px. `/absence/new` opende met de geautoriseerde medewerkerkeuze.

## Nieuwe slice 2026-08-03: rolgebonden werkruimtes en medewerkerlanding

Afgerond in code en remote testtenant: de rolcatalogus heeft nu `employee-directory:read`, `start-page:read`, `dashboard:read` en `workforce:read`. De globale `EMPLOYEE`-default krijgt alleen het directoryrecht; `DIRECT_MANAGER` en `TENANT_ADMIN` krijgen de drie werkruimte-rechten. De bestaande tenantoverride `HR Admin` in `liquid-hr-demo-holding` is hiermee bijgewerkt. De medewerkerlijst gebruikt een authenticated-only, permission-checked directory-RPC en staat daarmee open voor medewerkers zonder algemene `employee:read`-beheertoegang.

De dashboardlayout en routes zijn server-side op deze rechten aangesloten. Medewerkers zien de medewerkerslijst, niet Dashboard, Start of Workforce; `/dashboard/start` stuurt een medewerker na login direct naar `/employees/{eigen employeeId}`. Manager en HR Admin behouden Start als landing; Dashboard en Workforce zijn voor deze rollen eveneens beschikbaar. Organisatiekaart is bovendien niet meer zichtbaar zonder `organization-chart:read`.

Remote migraties `20260803192309_role_based_workspace_permissions` en `20260803192414_restrict_employee_overview_rpc` zijn toegepast op project `wnpfloqpjvaacobppbpk`; anonieme uitvoering van de directory-RPC is ingetrokken. De security-advisor toont hiervoor alleen de bewuste bestaande waarschuwing dat deze geautoriseerde directory-RPC een SECURITY DEFINER is; de performance-advisor heeft geen nieuwe slice-specifieke fout opgeleverd. De drie fixtureaccounts zijn remote gecontroleerd op de effectieve workspace-rechten. Lokale verificatie: strict typecheck, gerichte lint en 2 bestanden/10 tests geslaagd; de authenticated drie-rollen-browsercheck kon in deze run niet worden uitgevoerd omdat de beschikbare browser-sessie geen gekoppelde klantomgeving had en fixturewachtwoorden niet lokaal beschikbaar waren. Geen commit, push of deployment.

## Nieuwe hotfix 2026-08-03: productieflag testrolwisselaar

Bevinding: `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED` stond correct in Vercel, maar `isTestRoleSwitchEnabled()` las zonder override alleen `NODE_ENV` en niet de runtimeflag. Daardoor bleef de sidebarwisselaar in Production verborgen. Dit is hersteld in versie `1.20260803.4`; de helper leest de servervariabele direct uit en normaliseert `true`/hoofdletters/spaties. Regressietest, volledige tests (125/459), strict typecheck, lint, i18n-pariteit en productiebuild (163 pagina's) zijn geslaagd. GitHub `e8a008c` en Vercel Production `dpl_Fu1T5z3F9P21JdnsMcynaEgfi556` staan op `READY`; een geauthenticeerde productie-browsercontrole blijft als handmatige laatste controle over.

## Nieuwe slice 2026-08-03: doorlopende beoordeling remote en testklaar

De doorlopende beoordeling is end-to-end op de remote Supabase-tenant toegepast. Naast de timeline-migratie zijn FK-indexen en tenant-private Storage voor screenshots/bijlagen toegevoegd. De tabel `continuous_appraisal_attachments` heeft RLS, authenticated-only grants, audit, MIME-/groottechecks en een private bucket; uploads gaan server-side via de admin client nadat de sessie door de gewone tenant-/managerrechten is gevalideerd. Historische timeline-items blijven immutable, inclusief bijlagen toevoegen aan items uit het verleden.

Remote verificatie: contracttest geslaagd; security-advisor toont geen Continuous Appraisal-bevinding en performance-advisor geen nieuwe unindexed-FK-bevinding. De resterende performance-INFO’s zijn ongebruikte indexen op de kleine dataset. Remote fixturedata is idempotent aanwezig voor de drie testrollen: 9 items, 3 reacties en 1 veilige voorbeeldbijlage (`screen-4.png`) voor Noah Hendriks. De manager ziet Noah via `/workforce/continuous-appraisal`; de medewerker ziet `/my-appraisal`; HR Admin heeft tenantbreed Workforce-overzicht.

Authenticated browsercontrole op poort 3002 bevestigde de medewerker-, manager- en HR-routes in de voorafgaande gate; de finale managercontrole bevestigde Noah met 8 items, de bijlagelink en uploadcontrol. De downloadroute leverde `image/png` via een kortlevende signed URL. Lokale verificatie: 125 testbestanden/458 tests, i18n-pariteit met 28 namespaces, strict typecheck en productiebuild met 163 pagina’s geslaagd. De slice is gepubliceerd in GitHub-commit `d91c554`; de actuele Vercel Production deployment `dpl_9ZrhSMrtEJZrJ7ZojL5VKXuRJCNq` staat op `READY` voor de eindcommit.

## Nieuwe slice 2026-08-03: testrolwissel voor fixtureaccounts

Afgerond: de ingelogde testaccounts kunnen via de sidebar boven de Tijdhub tussen Edwin en de drie vaste fixtureaccounts wisselen. De server valideert eerst de huidige sessie, accepteert uitsluitend de allowlist en maakt via Supabase Auth Admin een eenmalige magic-link-handoff aan; de service key blijft server-only en de handoff staat maximaal 60 seconden in een HttpOnly-cookie. Lokaal/test is de functie actief; productie blijft uit tenzij `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED=true` expliciet is ingesteld. De wisselaar blijft beschikbaar voor de vier allowlisted accounts, zodat terugschakelen naar Edwin en een volledige testcyclus mogelijk zijn.

Verificatie: helpertests 3/3, volledige hr-suite 125 testbestanden/458 tests, i18n-pariteit 28 namespaces, strict typecheck, ESLint en productiebuild met 163 pagina's geslaagd. In de lokale browser werkte HR Admin -> Manager -> Medewerker -> Edwin; iedere stap toonde de nieuwe naam en rolgebonden navigatie, met 0 console-errors. De functie is opgenomen in GitHub-commit `d91c554`; productie blijft bewust afhankelijk van de expliciete Vercel-variabele `LIQUIDHR_TEST_ROLE_SWITCH_ENABLED=true`.

## Nieuwe slice 2026-08-03: doorlopende beoordeling lokaal gebouwd

Afgerond: requirement/FDR, lokale schema/RLS/audit-migration, handmatig aangevulde lokale DB-types, strict Zod-schemas, serverservice, API-routes, medewerkerroute `/my-appraisal`, manager-/HR-route `/workforce/continuous-appraisal`, startpagina-samenvatting, Workforce-link en NL/EN i18n. De timeline ondersteunt notitie, actie, afspraak, managerfeedback, doel/ontwikkelpunt en gesprekssamenvatting; reacties zijn uitklapbaar en maximaal 100 tekens. Verleden is DB- en UI-vergrendeld; verwijderen is niet beschikbaar; managerwissel kan als systeemevent zichtbaar worden.

Open: migration `20260803133000_continuous_appraisal_timeline.sql` remote toepassen na expliciete toestemming, advisors/contracttest, representatieve echte testdata, authenticated browsergate en eventuele veilige tenant Storage-slice voor screenshots/bijlagen. De screenshotfunctionaliteit is bewust niet via onveilige publieke URLs gebouwd. Lokale verificatie: 124 testbestanden/455 tests, i18n-pariteit, strict typecheck, volledige ESLint, productiebuild met 163 pagina's en `git diff --check` zijn geslaagd; remote/browsercontrole en SQL-contracttest op de nieuwe remote tabellen blijven open. Geen remote write, commit, push of deployment uitgevoerd.

## Nieuwe slice 2026-08-03: Workforce 9-grid-vlootschouw

Afgerond: requirements/FDR, remote migraties `talent_review_9_grid`, `harden_talent_review_9_grid`, `move_talent_review_activation_security` en `talent_review_fk_indexes`, officieel gegenereerde `packages/db/types.ts`, pure reminder-/gridregels met tests, service/API-routes, i18n en role-aware `/workforce/9-grid` met HR-campagneoverzicht en manager-teamworkspace. HR start campagnes met begin/einddatum; start snapshot huidige directe teams en maakt reminders op zeven dagen vóór einddatum, of op de einddatum voor campagnes korter dan zeven dagen. Managers scoren alleen actieve campagnes, kunnen medewerkers slepen, opslaan/indienen en vorige scores bekijken. HR ziet managerstatus en kan herinneren.

Verificatie deze slice: 455 hr-suite-tests, i18n-pariteit met 27 namespaces, strict typecheck, volledige lint, productiebuild met 158 pagina's en `git diff --check` zijn groen. De remote SQL-contractproef slaagt voor vier RLS-tabellen, authenticated-only grants/RPC's, self-scope constraints en RLS-policytekst. De security-advisor toont geen nieuwe 9-grid-bevinding; de performance-advisor heeft geen nieuwe 9-grid unindexed-FK-bevinding. De anonieme routecheck van `/workforce/9-grid` gaf correct `307` naar login. De authenticated Talent-releasegate is met de drie fixtureaccounts geslaagd: 3 rollen, 6 toegestane routes, 0 axe-violations, keyboard-focus op alle toegestane routes, correcte route-/API-denies, cross-tenant-denies en self-bound employee-read. De medewerker wordt voor 9-grid naar `/geen-toegang` gestuurd, ziet geen 9-grid-heading of functionaliteit en krijgt `403` op review-campagnes en start; de manager krijgt `403` op HR-campagnebeheer en de HR-admin krijgt `404` op de gebruikte onbekende start-id. Axe rapporteert alleen 1 `incomplete` color-contrast-check op de select voor vorige campagne. De gate is bijgewerkt met de actuele `Talent Management`-tekst en `/workforce/9-grid`-checks.

De lokale Supabase CLI bleef geblokkeerd door de telemetrymap; de officiële types zijn daarom via de Supabase MCP gegenereerd. Er is geen seed, commit, push of deployment uitgevoerd.

## Uitgebreide Talent Management-testhandleiding 2026-08-03

De herhaalbare handleiding voor Talent Management staat in `docs/delivery/TALENT_MANAGEMENT_FUNCTIONAL_TEST_GUIDE_20260803.md`. Het document bevat de drie fixtureaccounts zonder wachtwoorden, rol- en routegrenzen, verwachte capability-/doel-/check-indata, HR-, manager- en medewerkerflows, negatieve autorisatietests, performancecontrole, veilige mutatietests en een bevindingentabel. Gebruik dit document als handmatige testbasis; ontbrekende seeddata moet als omgevingsbevinding worden gemeld en niet worden verzonnen. Geen databasewijziging, deployment of seedreset uitgevoerd.

## Security-hardening update 2026-08-03

Login gebruikt nu ook vóór het renderen `safeNextPath`, zodat een externe of protocol-relative `next`-waarde niet in het formulier wordt teruggekaatst. `apps/hr-suite/next.config.ts` levert HSTS, `nosniff`, frame-denial, een strikte referrer policy en een beperkte Permissions Policy; bewust is geen CSP toegevoegd omdat OAuth, Supabase en adresproviders eerst volledig moeten worden geïnventariseerd. Het Talent-recordpaneel laadt opties en records sequentieel om gelijktijdige RLS-belasting op `talent_capabilities` en `talent_levels` te beperken.

Verificatie na deze hardening: 448 hr-suite-tests en 7 control-tests groen, lint, beide strict typechecks, i18n-pariteit en beide productiebuilds groen (156 HR-pagina's, 12 control-pagina's). De lokale security-smokecheck bevestigde alle vijf headers, normalisatie van externe/protocol-relative/XSS-achtige login-`next`-waarden naar `/dashboard/start` en HTTP 401 op een onbevoegde employee-API. Er is geen remote Supabase-migratie toegepast en Vercel Production staat nog op commit `4f00eeca4f2a79172d72964eb4fe234843a958c1`; publicatie blijft wachten op herstel van write-authenticatie. De audit heeft nog drie high-meldingen die via de geneste, door Next `16.2.12` vastgepinde `postcss@8.4.31` en optionele `sharp@0.34.5` komen; een override die dit niet betrouwbaar in de lockfile oplost is bewust niet behouden.

## Performance- en Talent Management-update 2026-08-03

`/settings/talent` laadt bij de eerste paginaweergave alleen autorisatie, vertalingen en de Start-sectie. Talentfunctieprofielen, persoonlijke capabilityregistraties en het Talentfundament worden pas geladen wanneer de betreffende accordion-sectie wordt geopend en blijven daarna in de clientcache. De initiële losse Talent-knoppen zijn naar Start verplaatst; het fundament heeft geen beheerknoppen meer buiten de accordion. De naamgeving is verduidelijkt naar `Talent Management`, `Functieprofielen - gekoppeld aan het functiehuis` en `Bestaande functie`, zodat dit niet concurreert met `Functies en functiegroepen` in HR-inrichting.

De capability-recordquery gebruikt een allowlisted select en tenantfilters op de drie referentielezingen. Er is in deze wijziging geen remote databasewijziging of deployment uitgevoerd. Verificatie: 447 hr-suite-tests en 7 control-tests groen, volledige lint groen, i18n-pariteit groen en productiebuild met 156 pagina's groen. Een lokale productie-smokecheck gaf voor `/login` HTTP 200 en voor de representatieve beveiligde hoofd-routes HTTP 307 naar login binnen circa 5-28 ms; dit is guard-performance, geen geauthenticeerde UI-meting. De drie-rollen Talent-releasegate kon niet opnieuw draaien omdat de lokale fixturecredentials ontbreken. De losse `type-check` blijft geblokkeerd door de bestaande fout `apps/hr-suite/lib/weather/open-meteo.ts:102`.

## UI-update 2026-08-03: werkweer op landing-header

De landing-header toont server-side een compact barometerachtig werkweerinstrument via Open-Meteo. De actieve `employee_organizations`-werklocatie heeft voorrang; zonder bruikbare locatie valt werkweer terug op Amsterdam (52.3676, 4.9041). De kaart toont de actuele temperatuur met daaronder klein de maximale temperatuur van vandaag (`temperature_2m_max`), luchtdruk met kleurenschaal en stijg/daal/stabiel-indicator in het midden, luchtvochtigheid onder en windrichting als roterende pijl in een cirkel. De zichtbare windrichting gebruikt Nederlandse kompasrichtingen (`N`, `NO`, `O`, `ZO`, `Z`, `ZW`, `W`, `NW`); alleen de volledige stadnaam staat onderaan. In het midden van de bovenste rij schakelt een kantoor/thuiskeuze tussen kantoorweer (standaard) en het weer op de actuele primaire thuislocatie; de server leest voor thuisweer alleen stad en land uit `employee_addresses`. Zonder beschikbare thuislocatie blijft de thuiskeuze uitgeschakeld en wordt niet naar Amsterdam gefallbackt. De temperatuur, luchtvochtigheid en totale kaart/hero zijn opnieuw circa 25% compacter gemaakt; de begroeting volgt dezelfde kleinere typografische schaal. Onder de begroeting verschijnen alleen wanneer de brondata bestaat de resterende dagen tot persoonlijk goedgekeurd verlof en de eerstvolgende actieve feestdag. Bij een te kleine header wordt het weerinstrument volledig verborgen. Strict typecheck, gerichte ESLint en i18n-pariteit zijn geslaagd; browsercontrole bevestigde de maximale dagtemperatuur, kantoor als standaard, de uitgeschakelde thuiskeuze zonder gekoppelde thuislocatie en geen overflow.

## UI-update 2026-08-03: accountmenu typografie en versieregel

Het uitklapmenu van de ingelogde gebruiker in de sidebar gebruikt voor `Persoonlijke instellingen` en `Uitloggen` nu dezelfde expliciete 14px-standaardtypografie. De appversie wordt onder een scheidingslijn als niet-klikbare informatieregel getoond (`Versie 1.20260803.3`). Geen schema-, API- of autorisatiewijziging.

## UI-update 2026-08-03: ingeklapte sidebar-controls uitgelijnd

In de ingeklapte desktop-sidebar gebruiken de collapseknop, navigatie-items, productupdates, reminderknop, persoonlijke instellingen en uitloggen nu dezelfde 44px vierkante hit-area met gecentreerd icoon. Daardoor vallen de horizontale centra en hover-oppervlakken gelijk; de actieve navigatie behoudt zijn accent. Geen schema-, API- of autorisatiewijziging.

## Releaseupdate 2026-08-03: main en Vercel Production bijgewerkt

De volledige codewerkboom is gepubliceerd naar `main` in commit `d91c554` (`release: publish LiquidHR 1.20260803.3`); `.playwright-state/` is bewust lokaal gebleven en niet gecommit. De actuele deliverydocumentatie staat in commit `b946223` (`docs: align final release commit references`); `origin/main` en de lokale `main` wijzen nu naar `b946223`.

Lokale verificatie voor `d91c554`: 125 testbestanden/458 tests, strict typecheck, lint, i18n (28 namespaces), `git diff --check` en productiebuild met 163 pagina's zijn geslaagd. Vercel Production deployment `dpl_9ZrhSMrtEJZrJ7ZojL5VKXuRJCNq` is voor eindcommit `b946223` als `READY` gemarkeerd; de build compileerde, doorliep TypeScript en genereerde 163 pagina's. De productie-aliasen zijn `liquid-hr-hr-suite.vercel.app`, `liquidhr-edwinitsolutions.vercel.app` en `liquidhr-git-main-edwinitsolutions.vercel.app`. De runtime-errorcontrole voor de nieuwe deployment vond geen error- of fatal-logs.

Vercel meldt tijdens `npm install` nog 4 high-severity dependency-auditmeldingen. Die zijn in deze release niet automatisch aangepast omdat `npm audit fix --force` breaking changes kan veroorzaken; dit blijft een afzonderlijk security-opvolgpunt.

## Besluitupdate 2026-08-03

Snapshot/restore via providerbranch is bewust uitgesloten en is geen open releaseactie. LMS/P3.6 wordt niet gebouwd zonder nieuw productbesluit; P3.3 en P3.5 blijven `GEPARKEERD`; P4-P6 worden niet gestart. De gerichte Supabase-timeout in Talent is aangepakt met scope-indexen, RLS-short-circuiting en lazy rapportopties. `TALENT-NEXT-01` is als eerste read-only spiderwebslice gebouwd en met medewerker, manager en HR-admin op poort 3000 getest. Onderstaande oudere overdrachtsteksten zijn historische context; deze besluitupdate is leidend.

## Meest recente overdracht 2026-08-03: P3 functioneel gesloten in testfase

P3 is voor medewerker, manager en HR Admin functioneel afgerond. De drie-rollen releasegate is opnieuw uitgevoerd met 0 echte axe-violations, keyboard-focus op alle toegestane routes en geslaagde route-, mutatie-, cross-tenant- en self-bound-denies. HR Admin heeft periodefilter 2026-01-01 t/m 2026-03-31 en CSV-export in de Codex-browser op poort 3000 doorlopen; de exportresponse was `200`. De medewerkerlanding is aangepast naar `/dashboard/start`; directe onbevoegde toegang tot `/departments` eindigt op `/geen-toegang`.

Open voor formele productacceptatie: formele acceptatie van één thematische axe-`incomplete` contrastcheck, eventuele herhaling van manager-/medewerkerperiodefilter en CSV als releasebewijs, en P3.7 release-eigenaarsacceptatie. De eerdere brede Supabase-timeout is voor de gerichte Talentvergelijking en rapportopties aangepakt met indexen, RLS-short-circuiting en lazy opties. Provider snapshot/restore is op verzoek uitgesloten; LMS/P3.6 wordt niet gebouwd zonder nieuw productbesluit. P3.3 en P3.5 blijven `GEPARKEERD`. P4-P6 worden niet gestart. `TALENT-NEXT-01` is nu als eerste read-only spiderwebslice gebouwd; zie het handoffdocument en de requirementsanalyse. De releasepublicatie staat op `d91c554` en Vercel `READY`.

De complete testset, de drie-rollenstappen en de extra volgende-taakinstructie staan in `docs/delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md`.

## Meest recente overdracht 2026-08-03: P3 gebouwd in testfase

P3.0, P3.1, P3.2 en P3.4 zijn uitgevoerd. De nieuwe Talent-notificatielaag is tenantgescopeerd, deduplicerend en minimaal van inhoud; HR kan tenantbreed opvolgen, manager en medewerker zien alleen hun toegestane ontvangers. Check-ins gebruiken `talent_goal_check_ins` met RLS, audit en versioning: medewerkerreflectie, managerobservatie en follow-up blijven afzonderlijke entry types. De bestaande doel- en rapportservices zijn hergebruikt; rapportage heeft periode vanaf/tot en dezelfde filters voor scherm, API, export en exportaudit.

De testdatabase bevat voor Noah Hendriks historische/actuele/toekomstige capabilityrecords, historische/actuele/toekomstige doelen en check-ins. De medewerkerflow heeft aanvullend een geldige reflectie aangemaakt; daarmee is zowel seeddata als een echte self-write getest. De vijf fixturemeldingen zijn verdeeld over medewerker en manager en blijven open voor herhaaltesten. De drie fixtureaccounts zijn op poort 3000 opnieuw doorlopen; detailteststappen en verwachte uitkomsten staan in `docs/delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md`.

Open: P3.3 en P3.5 zijn `GEPARKEERD`; P3.6/LMS wordt niet gebouwd zonder nieuw productbesluit; P4-P6 zijn niet gestart. Provider snapshot/restore is bewust uitgesloten. De `/departments`-rechtenroute is voor de directe medewerkerroute opgelost; labelkwaliteit van bestaande manager-capabilityrecords blijft een datakwaliteitsopvolgpunt. Geen commit, push of deployment.

## UI-update 2026-08-03: app-brede controlbasis en gedeelde dropdownset

De gedeelde controlbasis van `apps/hr-suite` behandelt nu alle native selects consistent met vaste maatvoering, afgeronde randen, theme-based chevrons, hover/focus-states en een herkenbare multi-selectvariant. `.form-field` en het bestaande `.input`-patroon gebruiken dezelfde strakke veldstijl; primaire/secondaire knoppen breken hun labels niet meer af en primaire acties hebben duidelijker contrast. De filterbalk op `/workforce/talent` gebruikt daarnaast zichtbare micro-labels, korte waarden (`Alle`, `Concept`, enz.) en een responsive grid zonder horizontale overflow.

`apps/hr-suite/components/ui/dropdown-select.tsx` is toegevoegd als gedeelde single-select voor zoekbare, toetsenbordbedienbare keuzes met zichtbare selectie, portal-menu, disabled/error-states en native form-submission. CountryPicker, de administratiekeuze, Talentfilters/-modal, Insights-selects, employee-landen/talen, organisatie-rolkeuzes en de Insights custom menus gebruiken deze gedeelde controltaal. Niet-gemigreerde eenvoudige/native en multiple selects blijven functioneel via de globale fallbackstyling. Er zijn geen schema- of API-wijzigingen gedaan. Strict typecheck, gerichte ESLint, `git diff --check` en geauthenticeerde Talent-browsercontrole zijn na de uitbreiding geslaagd; volledige testsuite en productiebuild volgen als afsluitende controle. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.9 hardening grotendeels gesloten

De medewerkerlanding is hersteld. Een geauthenticeerde `/login` gaat nu naar `/dashboard/start`, zodat een medewerker niet meer onbedoeld op `/departments` belandt; directe toegang tot `/departments` eindigt netjes op `/geen-toegang` in plaats van een serverfout. De drie-rollen-gate is opnieuw uitgevoerd in de Codex-browser op poort 3000: HR Admin, manager en medewerker behouden hun eigen Talentroutes, manager-scope, cross-tenant-denies, negatieve mutatiedenies en medewerker-self-bound gedrag.

De veilige grote-dataset-baseline gebruikt tijdelijke tabellen met 20.000 synthetische rijen en een volledige transactionele rollback. Doelen, capabilityrecords en importregels gebruiken op schaal hun tenant-/scope-indexen; de zwaarste importselectie van 5.000 regels bleef op 7,545 ms. De volledige axe/keyboard-herhaling heeft 0 echte axe-violations en keyboard-focus op alle vier toegestane routes. Eén themed/shared color-contrastcheck blijft technisch `incomplete`, maar is handmatig gecontroleerd zonder vastgestelde contrastfout.

Applicatieve importrollback is bewezen: de batch en rij zijn `ROLLED_BACK`, het nieuw aangemaakte imported capabilityrecord is `ARCHIVED`, auditdata blijft staan en er is geen actief imported record achtergebleven. Een provider-database snapshot/restore is nog formeel open. Een tijdelijke Supabase-branch kost $0,01344 per uur en is zonder expliciete kosten-/hersteltoestemming niet aangemaakt. Detailbewijs staat in `docs/delivery/TALENT_M2_RELEASE_HARDENING_20260802.md`. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2 functioneel afgerond in testfase

M2.0 t/m M2.8 zijn lokaal en remote volgens `schema -> RLS/grants -> service/API -> UI` uitgevoerd. M2.7 levert tenantgescopeerde ontwikkeldoelen met statusmachine, versioning en audit. M2.8 levert read-only rapportage en CSV-export met vaste rolallowlists, scopefilters en `EXPORT`-audit. Er zijn geen automatische scores, adviezen, AI-besluiten of notificaties toegevoegd.

M2.6 is nu end-to-end bewezen: HR Admin doorloopt in `/settings/talent/import` `PREVIEW -> COMMITTED -> ROLLED_BACK`. De rollback archiveert het door de batch aangemaakte capabilityrecord en laat batch- en auditdata intact. De demo-tenant heeft hiervoor uitsluitend voor `TENANT_ADMIN` de bestaande canonieke rechten `talent-import:manage` en `talent-record:write` gekregen; manager en medewerker hebben geen importschrijfrechten. De preview valideert nu ook de database-compatibele waarden voor capabilitytypes, zodat een ongeldige evidence/certificate-combinatie vóór commit wordt afgewezen.

Drie-fixture-browserbewijs op `http://localhost:3000` is opnieuw uitgevoerd met lokale fixtures, zonder credentials te documenteren. HR Admin kan Talentbeheer/import gebruiken; manager opent `/workforce/talent/goals` maar krijgt `/geen-toegang` voor `/settings/talent/import`; medewerker opent `/my-talent/goals` maar krijgt eveneens `/geen-toegang` voor import. Het medewerkerlandingspad `/departments` geeft nog een bestaande algemene rechten-serverfout; de directe Talent-route werkt en dit valt buiten de M2-scope.

Verificatie: 119 testbestanden/442 tests, gerichte importtests 6/6, strict typecheck, ESLint zonder warnings, i18n-pariteit (26 namespaces), productiebuild (151 pagina's), `git diff --check`, remote comparison/import- en goals/reporting-contracten slagen. Naast de kleine fixture-EXPLAIN is nu een tijdelijke 20.000-rijen-baseline uitgevoerd; de zwaarste importselectie bleef op 7,545 ms en alle tijdelijke data is teruggedraaid. De formele M2.9-release-hardening blijft alleen open voor provider snapshot/restore. Supabase-advisors tonen projectbreed security 12 (10 WARN/2 INFO) en performance 237 (3 WARN/234 INFO), vooral bestaande `SECURITY DEFINER`, auth- en index/policy-meldingen. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.5/M2.6 drie-fixture-gate

De lokale fixturecredentials uit `.env.talent-auth.local` zijn gebruikt in de Codex-browser op poort 3000. HR Admin opent M2.5 en maakt M2.6 previews; manager opent de directe-scopevergelijking met 22 medewerkers en twee profielen en wordt uit HR-instellingen/import geweerd; employee ziet `/my-talent` en wordt uit vergelijking/import geweerd. De employee-landingsroute `/departments` geeft nog een bestaande onvoldoende-rechten-serverfout.

M2.6 preview is functioneel bewezen met ongeldige en geldige CSV-rijen. De commit wordt door de bestaande tenant-specifieke RLS geweigerd: de `TENANT_ADMIN`-override mist `talent-record:write`. Er is geen remote autorisatie-uitbreiding toegepast; echte commit/rollback blijft open tot die exacte securitykeuze expliciet is goedgekeurd. Importaudittriggers zijn gehard. `20260802232000_talent_capability_fk_indexes` is remote toegepast; Talent foreign-key-advisorregels zijn daarna weg.

Verificatie: tests 116/434 plus control 2/7, lint, i18n en `git diff --check` zijn groen. Typecheck en productiebuild stoppen op drie bestaande fouten buiten deze slice: `employee-service.ts:316` en `employment-detail-service.ts:362/369`. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.5 vergelijking en M2.6 import

M2.5 en M2.6 zijn lokaal en remote volgens `schema → RLS/grants → service/API → UI` toegevoegd. M2.5 gebruikt actieve, actuele functieprofielversies, tenant-/directe managerscope en uitsluitend actuele vrijgegeven capabilityrecords als bron voor individuele `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`-uitkomsten. Concepten, verlopen en niet-vrijgegeven records krijgen geen bronrecord-ID en er wordt geen totaalscore berekend. De routes zijn `/settings/talent/comparison` voor HR Admin en `/workforce/talent/comparison` voor managers.

M2.6 gebruikt `talent_import_batches` en `talent_import_rows` met immutable invoer, RLS, authenticated-only grants, statusguards, gesaneerde auditmetadata en HR-only idempotente commit-/rollback-RPC's. `/settings/talent/import` toont CSV-preview, rijvalidatie, expliciete commit en batchrollback. Rollback archiveert nieuwe geïmporteerde records of herstelt updates en laat auditdata staan; er is geen hard delete. De remote migrations `20260802220000_talent_comparison_and_import` en `20260802223000_talent_import_policy_indexes` zijn toegepast. Het remote contract `apps/hr-suite/supabase/tests/talent_comparison_and_import_contract.sql` slaagt; gerichte parser/querytests en strict typecheck slagen. Advisors hebben geen nieuwe securitylint voor deze slice; performance meldt alleen nog ongebruikte importindexen in de kleine demo-dataset.

Functioneel open: de volledige nieuwe drie-fixture-gate en een echte HR-preview → commit → rollback met de lokale fixtures. De huidige Codex-browser-sessie heeft geen gekoppelde klantomgeving; credentials worden niet in chat of repository opgeslagen. De eerdere geauthenticeerde drie-rollen-gate blijft referentiebewijs voor de bestaande route-, scope-, tenant- en self-bound-grenzen. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.3 assessments en M2.4 Team Talent uitgevoerd

M2.3 en M2.4 zijn volgens `schema → RLS/grants → service/API → UI` uitgevoerd. De remote migration `20260802210000_talent_assessments_and_team_matrix` voegt assessmentcycli, onderdelen, self-/managerresponses, antwoorden en afgeschermde managernotities toe. Statusovergangen, optimistic versioning, cyclusvensters, manager-scope, self-bound writes, HR-finalisatie/heropenen en auditmetadata worden server-side én in databaseguards bewaakt. Managernotities blijven buiten medewerkerselecties; evidence blijft metadata-only.

De nieuwe pagina's zijn `/settings/talent/assessments`, `/workforce/talent/assessments`, `/my-talent/assessments`, `/settings/talent/team` en `/workforce/talent/team`. Team Talent gebruikt batchqueries en toont alleen individuele capabilityregels; aggregaten zijn uitgeschakeld. Canonieke permissions zijn `talent-assessment:*`, `self:talent-assessment:*` en `talent-team:read`; alle vijf nieuwe tabellen hebben RLS, policies en uitsluitend authenticated Data API-grants. Het remote assessment/Team-Matrix-contract en de gerichte schema-tests slagen.

Verificatie: 114 testbestanden/428 tests, strict typecheck, lint, i18n (25 namespaces), productiebuild (136 pagina's), `git diff --check` en remote security/performance-advisors zijn uitgevoerd. Advisors melden bestaande projectbrede waarschuwingen en kleine-dataset `unused_index`-meldingen, geen nieuwe ontbrekende RLS-policy voor deze slice. De interne Codex-browser op `http://localhost:3000` staat open, maar de bestaande sessie heeft geen gekoppelde klantomgeving en eindigt daardoor op `Nog geen toegang`; de drie authenticated rolflows zijn in deze run niet opnieuw geclaimd. Geen commit, push of deployment.

## Update 2026-08-02: bedrijf en locatie per dienstverband lokaal toegevoegd

De dienstverbanddetailpagina heeft een zelfstandige tab **Bedrijf en locatie**. Bij een administratie zonder afzonderlijke locaties toont de tab de echte bedrijfsnaam en het bedrijfsadres als alleen-lezen kaart. Bij meerdere actieve locaties toont de tab per dienstverband een overzicht met huidige/historische perioden, een zoekbare locatiekeuze, wijzigen en een nieuwe opvolgende ingangsdatum; de einddatum wordt automatisch op de vorige dag gezet.

De slice gebruikt de bestaande `employee_organizations.location_id`-koppeling en bevat `apps/hr-suite/supabase/migrations/20260802210500_manage_employment_company_location.sql` met locatie-RLS, een validatietrigger, de RPC `manage_employment_company_location` en behoud van de locatie bij organisatie-opvolgers. API en i18n zijn toegevoegd; `packages/db/types.ts` bevat de nieuwe RPC-signature. De migration new-opdracht kon niet schrijven naar de sandbox-beperkte Supabase-telemetrymap, daarom is het lokaal aangemaakte migrationbestand via patch toegevoegd.

Verificatie: 113 testbestanden/424 tests, strict typecheck, lint, i18n (25 namespaces), productiebuild (128 pagina's) en `git diff --check` zijn groen. De nieuwe schema-unit-test is 3/3 groen. De lokale devserver viel tijdens de browsercontrole weg door bestaande auth/HMR-fouten (`Invalid Refresh Token`, ontbrekende bestaande Talent-bron en Webpack-modulefouten); authenticated UI- en remote RPC-bewijs zijn daarom niet geclaimd. De nieuwe migration is nog niet remote toegepast; er is geen remote write, commit, push of deployment uitgevoerd.

## Meest recente overdracht 2026-08-02: M2.2 HR-kwalificaties uitgevoerd

M2.2 is volgens schema → RLS/grants → service/API → UI bovenop `talent_employee_capability_records` uitgevoerd. HR kan bij certificaten issuing body, certificaatcode, geldigheid in maanden, permanentie, verlenging, evidence-status en verantwoordelijke vastleggen. De database bewaakt certificaatdatumlogica, evidence-status, tenant-/medewerker-/capability-gebonden duplicaten en HR-verantwoordelijkheid binnen dezelfde tenant. De API retourneert alleen een allowlisted verantwoordelijke-aanwezigheid; bewijsinhoud, signed URL's en ruwe gebruikers-ID's blijven buiten de response.

De HR-lijst/modal ondersteunt zoeken op uitgever/code, een filter voor bijna verlopen binnen 30 dagen en expliciet archiveren met impactinformatie. Historie blijft bewaard en wordt geaudit. De remote M2.1/M2.2-contractproeven slagen. Typecheck, lint, i18n (25 namespaces), 112 testbestanden/421 tests en productiebuild (128 statische pagina's) zijn groen. De interne Codex-browser op poort 3000 bevestigt voor alle drie Talent-routes de anonieme loginredirect; de bestaande geauthenticeerde drie-rollen-gate uit M2.1 blijft het referentiebewijs. Nieuwe interactieve M2.2-velden per rol zijn in deze run niet opnieuw geopend omdat fixture-logincredentials niet beschikbaar waren. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.1 persoonlijke capabilityregistraties uitgevoerd

De eerste uitvoerbare fase-2-slice is volgens het plan doorgetrokken van schema → RLS/grants → service/API → UI. De tenant-owned tabel `talent_employee_capability_records` is remote toegepast met typegebonden databaseguards, geldigheidsinterval, archivering, evidence-reference zonder inhoud, audittrigger, indexes en RLS. De tabel geeft `authenticated` alleen SELECT/INSERT/UPDATE; `anon` en `public` hebben geen grants. Nieuwe canonieke permissions zijn `talent-record:read`, `talent-record:write`, `self:talent-record:read` en `self:talent-record:write`, met veilige roltoewijzing voor HR Admin, manager-lezen en medewerker-self.

De service/API gebruikt allowlisted DTO's, server-side tenant/employee/manager-scope, self-bound medewerkerwrites, optimistic concurrency via `version` en geen `employeeId` uit de self-body. `/settings/talent` biedt HR lijst-eerst beheer, `/workforce/talent` toont manager alleen-lezen records binnen scope en `/my-talent` biedt de medewerker eigen conceptregistraties. Eigen invoer wordt altijd `DRAFT`; HR bepaalt release/archive; evidence-inhoud of downloadreferentie komt niet in deze response.

Verificatie: remote M2.1-contractproef geslaagd; typecheck, lint, i18n, 112 testbestanden/419 tests, productiebuild en `git diff --check` geslaagd. In de interne Codex-browser op `http://localhost:3000` is met de employee-fixture een echte BHV-registratie opgeslagen en opnieuw zichtbaar als `Concept`, bron `Zelf ingevoerd`, zonder evidence-inhoud. De bestaande drie-rollen-gate blijft geldig voor route-/mutatie-/cross-tenant-scope; HR- en managerpagina’s zijn in code en servergrenzen aangesloten. Supabase-advisors tonen voor M2.1 geen nieuwe securitywaarschuwing; de performance-advisor meldt de nieuwe indexes nog als ongebruikt in de kleine demo-dataset. Geen commit, push of deployment.

## Meest recente overdracht 2026-08-02: M2.0 security en rollencontrole uitgevoerd

M2.0 van het fase-2-plan is als contract- en gegevensbeschermingsslice uitgevoerd. De nieuwe artefacts zijn `docs/decisions/ADR-0007-talent-fase-2-eigendom-en-gegevensbescherming.md`, `docs/decisions/FDR-0003-talent-fase-2-assessment-en-evidencebeleid.md`, `docs/requirements/Talent/analysis/talent-phase2-m2.0-contracts-and-data-protection-20260802.md`, `docs/requirements/Talent/analysis/talent-phase2-m2.0-traceability-matrix-20260802.md` en `apps/hr-suite/supabase/tests/talent_phase2_m2_0_contract.sql`. Zij bevatten de rolmatrix, dataclassificatie, canonieke permissionvoorstellen, status-/datum-/provenance-/evidencecontracten, logisch schemaontwerp, RLS/API-grenzen en acceptatie-/traceabilityregels. Daarnaast is alleen de bestaande audit-Data-API-grens aangescherpt; er zijn geen fase-2-tabellen, API-routes, UI-flow, seed of generated types toegevoegd. Geen commit, push of deployment.

Remote op Supabase-project `wnpfloqpjvaacobppbpk`: de migration `20260802131815_harden_audit_log_data_api_grants` is toegepast. De live grants op `public.audit_logs` zijn nu alleen `authenticated: SELECT`; `anon` en `public` hebben geen tabelgrants, en het exacte M2.0-contract retourneert zonder failures. Traceability M20-T09 is daarmee PASS. M2.0 blijft inhoudelijk open voor ADR/FDR-review, audit-correlation/source-channel/denied-action en de exacte fase-2-permission-seed; de vier bestaande fase-1-permissions en het ontbreken van fase-2-tabellen blijven bevestigd.

In de interne Codex-browser op `http://localhost:3000` zijn drie geïsoleerde loginrollen gecontroleerd. HR Admin: `/settings/talent` en `/workforce/talent` toegestaan, `/my-talent` geweigerd. Manager: `/workforce/talent` toegestaan, `/settings/talent` geweigerd, `/my-talent` bleef als lege route renderen zonder Talentinhoud. Employee: `/my-talent` toegestaan, `/settings/talent` en `/workforce/talent` tonen `Nog geen toegang`. De directe employee-route werkt; na login wordt eerst `/departments` geladen en die bestaande pagina geeft onvoldoende-rechten als serverfout. Dit routing/UX-punt is niet in M2.0 geïmplementeerd.

## Meest recente overdracht 2026-08-02: fase 1 gecontroleerd, fase 2 voorbereid

De Talent-stappen 1 t/m 9 zijn functioneel uitgevoerd en de drie-rollen-authenticatie-/autorisatiegate is opnieuw groen: HR Admin, manager en medewerker zijn in geïsoleerde sessies getest op toegestane routes, denies, mutaties, cross-tenant-isolatie, manager-scope en medewerker-self-bound gedrag. De gate rapporteert 0 echte axe-violations. De drie technische `color-contrast`-checks zijn handmatig beoordeeld zonder vastgestelde Talent-contrastfout; twee targets komen uit de gedeelde product-updatebanner. Typecheck, i18n (25 namespaces), lint, 112 testbestanden/418 tests, productiebuild, remote Talent-contractproeven en `git diff --check` zijn geslaagd. De formele productie-release is nog niet vrijgegeven: performance op representatieve grote data en een restore/rollback-oefening moeten nog worden bewezen. Het fase-2-plan staat in `docs/requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md`; een nieuwe thread start met M2.0 contracten en gegevensbescherming, zonder direct schema/UI te wijzigen. Geen deploy, push of commit.

## Supabase advisor-status 2026-08-02

Security- en performance-advisors zijn opnieuw uitgevoerd. De output bevat projectbrede bestaande `WARN`/`INFO`-meldingen, waaronder bewust aangeroepen authenticated `SECURITY DEFINER`-RPC's, uitgeschakelde gelekte-wachtwoordbescherming en bestaande permissive-policy-/RLS-meldingen. De Talent-contracttest blokkeert `anon` correct; dit is geen volledig lege advisor-output en blijft onderdeel van de formele releasebeoordeling.

## Update 2026-08-02: Talent stap 9 en functie-inventaris

Stap 9 is de laatste milestone in het opgeslagen Talent-implementatieplan. De remote migratie `20260802150000_harden_talent_job_catalog_audit` is toegepast; daarmee hebben ook `jobs`, `job_groups`, `job_revisions` en `job_group_jobs` append-only Talent-functiehuisaudittriggers. De remote stap-9-contractproef bevestigt 13 RLS-tabellen, de self-RPC-grens voor `anon`, de nieuwe audittriggers en de relevante indexen. De Workforce-profielquery is met `EXPLAIN` gecontroleerd en de service gebruikt batchreads voor requirements/capabilities/levels.

Nieuwe lokale artefacts: `apps/hr-suite/scripts/talent-release-gate.mjs`, het script `audit:talent-release` en `docs/requirements/Talent/analysis/talent-phase1-function-inventory-and-m9-gate-20260802.md`. De functie-inventaris onderscheidt fase-1-kern, gedeeltelijke Blueprintdetails en latere uitbreidingen per HR Admin, Manager en Medewerker.

Voor de bestaande drie testfixtures is daarnaast `apps/hr-suite/scripts/set-talent-fixture-passwords.mjs` toegevoegd. Dit gebruikt uitsluitend de server-side Supabase Auth Admin API met lokale environment variables; er worden geen wachtwoorden in repositorybestanden of uitvoer opgeslagen. De helper is uitgevoerd voor HR Admin, manager en medewerker. De remote cross-tenant capability-fixture `CROSS_TENANT_NEGATIVE_TEST` is toegevoegd via `20260802160000_seed_talent_cross_tenant_release_fixture.sql`.

De volledige geauthenticeerde drie-rollen axe/keyboard-gate is uitgevoerd: 3 rollen, 4 toegestane routes, route-/mutatie-/tenant-denies geslaagd, manager-scope geslaagd, medewerker self-bound geslaagd en 0 axe-violations. Drie `color-contrast`-controles blijven `incomplete` voor handmatige beoordeling. Open release-gate: die contrastbeoordeling, representatieve grote-dataset-performancebaseline en restore/rollback-oefening. Geen deploy, push of commit.

## Update 2026-08-02: Talent stappen 7 en 8 geïmplementeerd

De Workforce Talent-readmodel en Mijn Talent zijn nu als read-only verticale slice aanwezig. `/workforce/talent` toont HR Admin tenantbreed actieve, actuele profielen; een direct manager krijgt uitsluitend functies uit de actuele directe scope. `/my-talent` resolveert server-side de eigen actuele primaire plaatsing en actieve profielversie met capabilityvereisten; ontbrekende medewerker- of profielcontext eindigt veilig in een lege toestand. Er zijn geen scores, matches, voortgang, ontwikkeltrajecten of mutatieknoppen toegevoegd.

Remote staat `20260802123000_complete_talent_read_models` op project `wnpfloqpjvaacobppbpk`. De demo-fixtures `DEMO-028`, `DEMO-032` en `DEMO-035` zijn gekoppeld aan `TEST-MANAGER`, `TEST-PLANNER` en `TEST-CUSTOMER`; de laatste twee vallen onder directe manager `DEMO-028`. De twee self-RPC's gebruiken `SECURITY DEFINER` met lege `search_path`, zijn niet uitvoerbaar voor `anon`, en `talent_job_profile_readmodel` gebruikt `security_invoker=true`. De nieuwe SQL-contractproef `apps/hr-suite/supabase/tests/talent_read_models_completion.sql` is remote uitgevoerd en geslaagd.

Verificatie: typecheck, lint, i18n, 112 testbestanden/418 tests, productiebuild en `git diff --check` zijn groen. In de lokale Codex-browser bevestigde de HR-adminsessie `/settings/talent`, tenantbrede Workforce-profielen, capabilityvereisten en exclusieve accordionwerking. De afzonderlijke manager- en medewerker-browserlogin en de volledige geauthenticeerde axe-run met credentials blijven open; de credentials zijn niet in de repository aanwezig en niet geraden. Geen deploy, push of commit.

## Update 2026-08-02: Talent release-gate, stappen 5 en 6 afgerond

De Talent-basis is nu klaar voor de volgende manager- en medewerkerfuncties in de testfase. De demo-administratie `liquid-hr-demo-holding` heeft drie authfixtures: `manager.fixture@liquidhr.test` (`DIRECT_MANAGER`, directe managerscope), `employee.fixture@liquidhr.test` (`EMPLOYEE`, gekoppelde medewerker) en `hradmin.fixture@liquidhr.test` (`TENANT_ADMIN`, tenant-scope). De manager werd browsermatig geweigerd op `/settings/talent`; de HR-admin opende daar het Talentfundament in de juiste demo-administratie.

Stappen 5 en 6 zijn end-to-end uitgevoerd. Remote migration `20260802110000_complete_talent_profiles_and_configuration.sql` bevat version metadata, activatie, requirement-types, één conceptversie per profiel, overlap-/typeguards en geautoriseerde copy-/activation-RPC's. API en UI bieden profieloverzicht, versiehistorie, concepteditor, capabilityvereisten en dashboardtellingen via `/settings/talent`. De demo bevat 6 functies, 34 capabilities, 6 actieve profielen, 1 conceptversie en 7 versies.

Accessibility/auth-verificatie: de axe-runner controleerde zes kernroutes op poort 3000; alle 6 routes waren bereikbaar, met 0 axe-violations en 3 handmatige `incomplete` kleurcontrastcontroles op overlappende/decoratieve elementen. De browser bevestigde ook de idempotente conceptversie-actie en de exclusieve Talentfundament-accordion. Checks: lint, i18n (25 namespaces), strict typecheck, 112 testbestanden/418 tests, productiebuild (126 pagina's) en `git diff --check` zijn groen. Geen deploy, push of commit.

Open voor de volgende slice: manager- en medewerkerfunctionaliteit bovenop deze lees- en beheerbasis (bijvoorbeeld managerfeedback, medewerkerweergave en workflows). Supabase-advisors blijven projectbreed waarschuwen voor bestaande policy/index-issues en voor de bewust aangeroepen SECURITY DEFINER-RPC's; de nieuwe Talent-RLS, overlaptrigger en RPC's zijn gecontroleerd.

## Update 2026-08-02: Job Architecture en release-gate

Talent stap 4 is nu lokaal en remote doorgetrokken volgens schema -> API -> UI: tenant-owned families/groepen/functies, optionele `job_family_id` en `seniority_id`, CRUD/status, impactguards, zoek/sort/familyfilters, explorerweergave en databaseguards voor unieke actieve naam + groep + senioriteit. Bestaande employee-organization-plaatsingen blijven intact. De typecheckfout in `apps/hr-suite/lib/employees/employee-service.ts:316` is opgelost door de RPC-typing voor nullable `requested_valid_until` te corrigeren.

Remote staan de Talent-foundation, demo-seed, hardening, `complete_job_architecture_contract` en `seed_job_architecture_matrix` in de migratiehistorie. `Liquid HR Demo Holding` bevat 6 families, 3 actieve groepen, 7 actieve functies, 1 groep zonder family, 6 functies met senioriteit, 1 functie zonder senioriteit en 68 functieplaatsingen. De Job Architecture-contractproef slaagt inclusief orphan/duplicate checks, duplicate-business-key negative test en cross-tenant foreign-key negative test.

De vorige release-gate-notitie hieronder beschrijft de tussenstand vóór de manager-/medewerkerfixtures en de axe-audit; zie de actuele update hierboven.

## Historische update 2026-08-02: Talentfundament naar HR-inrichting

Het Talentfundament is nu alleen bereikbaar voor HR Admin via de tegel `Instellingen -> HR-inrichting -> Talentfundament`. De losse Talentfundament-ingang in de zijbalk is verwijderd; de bestaande pagina en het bestaande formulier blijven op `/settings/talent` staan.

De configuratiesecties op de pagina gebruiken nu de gedeelde exclusieve `SettingsAccordion`: standaard staat Niveaumodellen open en bij openen van een andere sectie sluiten alle overige secties. De tegel en route gebruiken `talent:manage`; de server-side routegrens blijft daarmee intact.

Authenticated in-app-browsercontrole op 2026-08-02 bevestigde de tegel, de route en het exclusieve gedrag van Senioriteiten en Competentiewoordenboek. Lint en i18n zijn geslaagd. De volledige typecheck blijft geblokkeerd door de bestaande fout in `apps/hr-suite/lib/employees/employee-service.ts:316`. De remote Talent-testmigraties, demo-catalogus en `20260802063946_harden_talent_remote_contracts` zijn toegepast. De demo-set bleef behouden: 7 categorieën, 9 tags, 34 capabilities, 92 levelinhouden, 20 tagrelaties, 24 profieleisen, 6 actieve profielversies en 16 functieplaatsingen. De contractproef slaagt; nieuwe Talent-triggerfuncties zijn niet meer uitvoerbaar voor public/anon/authenticated.

## Update 2026-08-02: EdwinHelp en projectoverzicht

De bestaande project-overview-skill is nu opgenomen in de natuurlijke commandocatalogus van `scripts/edwin-help.ps1`. `EdwinHelp` toont read-only de Git-workflow, `Maak project overview` met `docs/skills/project-overview/SKILL.md` en `Meet Next geheugen`, inclusief bron, veiligheidsniveau en voorbeeld. Nieuwe commando's worden centraal aan deze catalogus toegevoegd.

## Historische tussenstand 2026-08-02: Talent stappen 1, 2 en 3 lokaal doorgetrokken

Deze tussenstand is ingehaald door de actuele update bovenaan: de beschreven migratie is inmiddels remote toegepast, de types zijn opnieuw gegenereerd en de CRUD-/RLS-/advisorcontrole is afgerond.

De lokale code voor de drie afgesproken Talentblokken is nu doorgetrokken volgens schema → API → UI. Ownership, `TALENT`-modulegate, routegrenzen en permissionchecks blijven tenant-owned; Workforce-profielen worden bovendien alleen uit actieve, datumgeldige directe managerscope gelezen. Het levelmodel heeft beheerbare levels, volgorde, status en een databaseguard die het model bij eerste levelinhoud/gebruik vergrendelt. Senioriteiten hebben list/create/update/status/delete met een gebruiksblokkerende impactguard.

De capabilitybibliotheek heeft typebewuste CRUD, genormaliseerde duplicaatpreventie, categorieën met typescope, status/usage guards, server-side zoekfilters en paginering, Language CEFR, Certificate-metadata, dynamische levelinhoud voor Competency/Skill/Knowledge en relaties naar de bestaande `star_performer_tags`-catalogus. De UI is lijst-eerst met filters en modals; er zijn geen demo-capabilities of tweede tagcatalogus toegevoegd.

Lokale bron: `apps/hr-suite/supabase/migrations/20260802052246_talent_management_foundation_completion.sql` en de contractproef `apps/hr-suite/supabase/tests/talent_management_foundation_completion.sql`. De migratie is bewust nog niet remote toegepast: daarvoor is expliciete scope nodig. Daarom gebruikt de readpagina tijdelijk een veilige lege fallback voor de nog niet aanwezige nieuwe tagrelatietabel; mutation-endpoints voor de nieuwe velden zijn pas volledig uitvoerbaar na migratie. `packages/db/types.ts` is lokaal bijgewerkt voor de nieuwe contracten, maar moet na remote toepassing officieel opnieuw worden gegenereerd.

Verificatie lokaal: 112 testbestanden/418 tests, strict typecheck, ESLint zonder fouten, i18n-pariteit (25 namespaces), `git diff --check` en de bestaande productiebuild. De authenticated Codex-browser opent `/settings/talent` en toont de dynamische levels, senioriteiten, categorie-/capabilityfilters, modals en levelinhoud; de CRUD-mutatiematrix en remote RLS/advisorcontrole blijven open tot de migratie is toegepast. Er is niet gedeployed, gepusht of gecommit.

## Update 2026-08-02: Codex Developer Toolkit

De repository bevat nu de lokale Developer Toolkit in `scripts/`: `backup.ps1`, `restore.ps1`, `new-feature.ps1` en `finish-feature.ps1`, met gedeelde Git-validatie in `_git-toolkit-common.ps1`. De vier natuurlijke commando's en de veiligheidsgrenzen staan in `AGENTS.md` en `docs/DEVELOPER_TOOLKIT.md`. Restore vraagt exact `HERSTEL`, weigert standaard dirty tracked wijzigingen en verwijdert standaard geen ongetrackte bestanden. De scripts pushen en mergen nooit automatisch.

De werkboom was bij implementatie al dirty met bestaande product- en documentatiewijzigingen. Er is daarom geen backup-commit, branchwissel, reset, push of merge uitgevoerd. Niet-destructieve PowerShell- en Git-scriptcontroles volgen; Edwin moet vóór de eerste feature zelf `.\scripts\backup.ps1` uitvoeren en de resulterende commit controleren.

## Update 2026-08-01: liquid metallic bannerstijl

De bovenbanner gebruikt nu een koper/oranje/goudgele liquid-glow met overlappende lichtvelden, metallic sweep en een subtiele hover-link. De stijl is toegevoegd met bestaande CSS-thema-variabelen. Lint en strict typecheck zijn geslaagd; de anonieme browsercontrole redirect naar login.

## Update 2026-08-01: verhuizing en verzuimdetail-navigatie

Het hoofdadres toevoegen heet in de medewerkerkaart nu `Verhuizen`. De lopende verzuimkaart op het medewerkerdashboard is een klikbare kaart met hand-icoon naar het bestaande verzuimgeval (`caseId`). Het verzuimgevaldetail heeft één dossierkop met datum; de ziekteperioden staan compact als exclusief uitklapbare details met een samenvattingsregel.

Verificatie: `npm.cmd test -w @liquid-hr/hr-suite -- --run` geeft 112 bestanden/415 tests; strict typecheck en i18n-pariteit (25 namespaces) zijn groen. De authenticated browsercontrole bevestigde de verhuisactie, de `caseId`-link en het uitklappen van een ziekteperiode. Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/React-pluginfout `contextOrFilename.getFilename`.

## Update 2026-08-01: eenmalige banner en login-popup

Banner- en login-popupberichten worden per gebruiker, bericht en kanaal eenmalig getoond via `product_update_surface_dismissals`. De banner wordt automatisch als gezien vastgelegd zodra hij wordt geladen; de popup heeft onderaan de knop `Gezien`. Remote migratie `20260801105005_product_update_surface_dismissals` is toegepast, RLS is gecontroleerd en de nieuwe types zijn gegenereerd. Lint, i18n, 112/415 tests, typecheck en build zijn geslaagd; de anonieme browserroute redirect correct naar login.

## Update 2026-08-01: eigenaar- en tenant-scope productupdates

Productupdates hebben nu twee scopes: globale eigenaarberichten zonder `tenant_id` voor alle klanten en tenantberichten met de eigen tenant. De eigenaar beheert globale berichten; HR Admin beheert alleen eigen tenantberichten en krijgt globale berichten alleen-lezen. De remote migratie `20260801143000_product_updates_global_owner_scope` is toegepast, optionele start/einddatums zijn actief en twee `[TEST OWNER]`-berichten zijn aangemaakt. Lint, 112/415 tests, i18n-pariteit, strict typecheck en productiebuild met 122 routes zijn geslaagd. De anonieme browserroute geeft 307 naar login; authenticated browsercontrole blijft open door ontbrekende login-cookie.

## Update 2026-08-01: hoofdadres en tweede tijdelijk adres

De medewerker-adrestab gebruikt nu twee exclusieve harmonica-vensters: Hoofdadres en Tweede tijdelijk adres. Bestaande adressen zijn in de testdatabase behouden en als `PRIMARY` gemarkeerd. Het hoofdadres blijft verplicht; de UI toont daarvoor geen einddatum. Een `SECONDARY`-adres heeft een verplichte omschrijving, een eigen start- en einddatum, mag naast het hoofdadres lopen en heeft geen opvolgerlogica.

De migratie `20260801130000_employee_address_types` is op Supabase-project `wnpfloqpjvaacobppbpk` toegepast. Zij voegt type/omschrijving toe, beperkt overlap per type, beschermt het laatste hoofdadres en breidt de bestaande geautoriseerde adres-RPC uit. `packages/db/types.ts` is bijgewerkt.

Verificatie: remote query toont 3 bestaande open `PRIMARY`-demo-adressen en geen secundaire records; `npm.cmd test -w @liquid-hr/hr-suite -- lib/employees/address-input.test.ts lib/employees/schemas.test.ts --run` slaagt (2 bestanden/12 tests); strict typecheck slaagt. Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/React-plugincompatibiliteit (`contextOrFilename.getFilename`). Browsercontrole en i18n-check volgen.

## Update 2026-08-01: productupdates en cadeauvenster

De testdatabase bevat tenant-eigen `product_updates` en `product_update_user_state`. Updates ondersteunen type Nieuwe functionaliteit/Verbetering, optionele einddatum, startdatum met standaard nu, kanaal-multiselect (`GIFT_WINDOW`, `LOGIN_POPUP`, `TOP_BANNER`) en doelgroep-multiselect (`TENANT_ADMIN`, `DIRECT_MANAGER`, `EMPLOYEE`). HR Admin beheert via `/settings/product-updates`; gebruikers lezen via `/product-updates`, de dashboard-banner en login-popup. De zijbalkbadge telt alleen ongeziene actieve cadeauvenster-updates; openen van `/product-updates` schrijft de laatste gezien-status per gebruiker.

Remote migratie: `20260801093124_product_updates`; lokale migratie: `apps/hr-suite/supabase/migrations/20260801093124_product_updates.sql`. Testdata: twee `[TEST]`-updates per actieve tenant, idempotent aangemaakt. `packages/db/types.ts` is opnieuw gegenereerd. Verificatie: remote RLS/policies gecontroleerd, Supabase security/performance advisors uitgevoerd, 112/413 tests, strict typecheck, lint, i18n en build groen. Anonieme routecontrole is groen; authenticated browsercontrole blijft open door ontbrekende login-cookie in de huidige Playwright-context.

## Update 2026-08-01: intelligente adresinvoer bedrijfsgegevens

De bedrijfsadres- en locatieformulieren gebruiken nu dezelfde intelligente adresinvoer als het woonadres van medewerkers: landgebonden suggesties, Nederlandse postcode/huisnummer-aanvulling en handmatige fallback. Voor niet-Nederlandse adressen zijn adresregel 1, de optionele adresregel 2, postcode, plaats en regio beschikbaar. Er is geen nieuwe migratie nodig; `address_line_2` en de bijbehorende validatie/API-koppeling bestonden al.

Verificatie: gerichte schematest (3/3), strict typecheck, productiebuild en i18n-pariteit (25 namespaces) zijn geslaagd; de ingelogde browsercontrole bevestigde Nederlandse suggesties, de internationale adresregel 2 en dezelfde invoer in een nieuwe locatie. Gerichte ESLint blijft geblokkeerd door de bestaande ESLint 10/React-plugincompatibiliteit.

## Update 2026-08-01: verzuimgeval-detail en lopend verzuim

De medewerkerweergave gebruikt nu de bestaande geautoriseerde verzuimprojectie voor een consistente lopend-verzuimervaring. Bij een actieve casus wordt `Ziek melden` niet getoond. Op het medewerkerdashboard opent `(Gedeeltelijk) beter melden` de bestaande verzuimtab met `caseId`; de datum staat niet meer naast die actie. De verzuimtab heeft geen herstelactie boven de lijst. Iedere bestaande casuskaart opent hetzelfde detailpad en toont de beschikbare casus-, ziekteperiode- en capaciteitsgegevens. De herstelactie met datum blijft uitsluitend op de casusdetailweergave beschikbaar.

Er zijn geen tabellen, migraties, RLS-policies of dependencies gewijzigd. `absence_cases`, `absence_spells` en `absence_capacity_changes` zijn alleen uitgebreid gelezen via de bestaande service; geen medische of andere niet-bestaande gegevens zijn toegevoegd.

Verificatie: `npm.cmd run lint --workspace @liquid-hr/hr-suite`, `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` en `npm.cmd test --workspace @liquid-hr/hr-suite` zijn geslaagd (112 testbestanden/413 tests; 25 NL/EN-namespaces). De actuele volledige typecheck wordt geblokkeerd door de bestaande, losstaande fout in `apps/hr-suite/app/(dashboard)/settings/company-data/page.tsx`: ontbrekende `CompanyDataLabels`-sleutels. De lokale server antwoordt op poort 3000 met HTTP 200. De ingelogde browsercontrole met demo-medewerker Noah bevestigde dashboard, verzuimoverzicht en casusdetail.

## Update 2026-08-01: bedrijf gegevens en locaties

Instellingen → Organisatie & toegang bevat nu de tegel Bedrijfsgegevens en de route `/settings/company-data`. De pagina gebruikt één exclusieve harmonica met Bedrijfsdata en Locaties. Het bedrijfsadres ondersteunt Nederlandse en internationale adressen; één locatie kan als bedrijfsadres worden vastgezet waardoor locatiebeheer wordt uitgeschakeld. Bij meerdere locaties is er lijst-eerst beheer met toevoegen, wijzigen, actief/inactief en verwijderen. Verwijderen wordt zowel in de UI als via de bestaande FK naar `employee_organizations.location_id` geblokkeerd zodra een locatie gebruikt is.

De migraties `20260801090305_add_company_data_and_locations`, `20260801091902_grant_company_data_to_tenant_admin` en `20260801092039_harden_company_data_policies_and_indexes` zijn remote toegepast op Supabase-project `wnpfloqpjvaacobppbpk`; lokale bronbestanden staan onder `apps/hr-suite/supabase/migrations/`. De rolnaam in de live database is `TENANT_ADMIN` met weergavenaam HR Admin. `packages/db/types.ts` is opnieuw gegenereerd. De startpagina-groet is kleiner gemaakt en het hand-emoji is verwijderd.

Verificatie: schema-invoerunit-tests (3/3), strict typecheck, gerichte ESLint, i18n-pariteit (24 namespaces), productiebuild en ingelogde in-app-browsercontrole van `/settings/company-data` en `/dashboard/start` geslaagd. Supabase security/performance advisors tonen alleen projectbrede bestaande meldingen; de nieuwe tabellen/policies zijn gecontroleerd. Er is niet gecommit, gepusht of gedeployed.

## Update 2026-08-01: enkele scrollbar medewerkerdetail

De gedeelde dashboard-shell is viewport-vast gemaakt (`fixed inset-0`). Daardoor blijft `main` de enige scrollcontainer voor lange medewerkerkaarten; de document-scroll loopt niet meer parallel mee. De medewerkerdetailpagina is op de bestaande ingelogde demo-route gecontroleerd: één zichtbare verticale scrollbar, geen browserwaarschuwingen of fouten.

## Update 2026-08-01: medewerkerprofiel- en reminderfeedback

De medewerkerdetailpagina gebruikt nu een doorzoekbare internationale voorkeurstaalkeuze, plaatst de actieve status naast het personeelsnummer en toont de adreslookup alleen wanneer postcode en huisnummer gevuld zijn en de plaats leeg is. `Geldig tot` blijft optioneel, kan worden ingevuld en expliciet gewist; nieuwe adressen starten zonder einddatum. De reminderdetailmodal zet **Verbergen** naast **Annuleren** in de onderste knopgroep, met dezelfde secundaire knopstijl.

Geslaagde wijzigingen in persoonsgegevens, adressen, bankrekeningen en relaties schrijven naast de bestaande database-audit een gelokaliseerde regel naar de bestaande `employee_activity_entries`-feed. Er is geen schemawijziging, migratie, dependency-installatie of nieuwe demo-data uitgevoerd.

Authenticated browsercontrole op poort 3000 met demo-medewerker Noah bevestigde: status naast personeelsnummer, taalzoekveld met internationale opties, verborgen/zichtbare adreslookup op basis van de invoer, wisbare optionele einddatum, reminderknoppen onderaan en de feedregel `Persoonsgegevens gewijzigd`. De lokale login gaf HTTP 200. Verificatie: 111 testbestanden/410 tests, strict typecheck, ESLint, i18n-pariteit (24 namespaces) en productiebuild (115 statische pagina's) geslaagd.

## Update 2026-07-31: tenant-owned functiehuis en Talent Foundation uitgevoerd

De testfase-regel is toegepast: de demo-database is behouden, maar de oude administrationele compatibilitykolommen en scopefilters voor `jobs`, `job_groups`, `job_revisions` en `job_group_jobs` zijn verwijderd. Bestaande IDs en plaatsingsrelaties zijn hergebruikt; de database dwingt nu één tenant-functiegroep per functie af. Er is één expliciete demo-afdeling `LEGAL-DEMO` op administratie-niveau toegevoegd naast de tenantafdelingen.

De remote migraties zijn geregistreerd als `20260731135658_remove_job_catalog_compatibility_and_seed_admin_department`, `20260731140701_add_talent_foundation`, `20260731141652_add_talent_self_profile_rpc`, `20260731142030_tighten_talent_rls_policies`, `20260731142342_enforce_talent_level_and_profile_invariants`, `20260731143627_seed_talent_profiles_from_existing_jobs`, `20260731144246_enforce_talent_manager_read_scope` en `20260731150748_add_tenant_fk_covering_indexes`. Talent bevat nu tenant-owned level models/levels, senioriteiten, optionele job families, categorieën, capabilities, profile versions, requirements, readmodel en audittriggers. Voor alle zes bestaande demo-functies is het logische profiel als Draft aangemaakt uit de bestaande job revisions; er is geen nieuwe functie of medewerker toegevoegd. De module `TALENT` is enabled voor beide demo-tenants. Self Talent leest via een gecontroleerde RPC; profile activation sluit vorige actieve versies atomair af en het levelmodel lockt bij eerste levelgebruik. Workforce Talent is managergescopeerd op actieve `employee_organizations`; algemene Talent-configuratie vereist `talent:manage`.

Nieuwe routes zijn `/settings/talent`, `/workforce/talent`, `/my-talent` en `/api/talent/*`. De bestaande modulecatalogus, sidebar, i18n, master-data en tests zijn daarop aangesloten. `packages/db/types.ts` is opnieuw gegenereerd vanaf remote. De administratie-afdeling is met SQL en een bestaande authenticated in-app-browser-sessie gecontroleerd: `LEGAL-DEMO` verschijnt in de afdelingskeuze. Dezelfde sessie kan `/workforce/talent` lezen; `/settings/talent` weigert terecht zonder `talent:manage`. Anonieme API's geven 401; `/login` geeft HTTP 200.

Laatste verificatie: 111 testbestanden/410 tests geslaagd, strict typecheck geslaagd, ESLint geslaagd, i18n-pariteit geslaagd (24 namespaces), productiebuild geslaagd (115 routes), en lokale poort-3000 checks voor login, jobs, departments en talent uitgevoerd. Supabase advisors tonen alleen bestaande projectbrede waarschuwingen plus de bewust beveiligde self-profile SECURITY DEFINER RPC.

## Hotfix 2026-07-31: Talent-navigatie en dashboardcontext (gecorrigeerd)

De eerste hotfix-samenvatting beschreef de permissiegrens onjuist. De definitieve regel is: Talentprofielen wordt via de Workforce-tegel aangeboden aan `talent:manager-read`; Talentfundament staat onder `/settings/talent` en vereist `talent:manage`. Er staat geen tweede Talentprofielen-item in de sidebar. De dashboard-layout hergebruikt binnen één render de bestaande Supabase-client en authcontext voor permissions, tenantmodules en reminders.

De authenticated in-app-browser bevestigde daarna dat `/workforce` één Talentprofielen-tegel toont, `/workforce/talent` alleen Workforce als actieve ouder markeert en `/settings/talent` alleen Talentfundament markeert. De tenant-specifieke TENANT_ADMIN-override van Edwin's actieve demo-tenant is hiervoor gericht aangevuld; de andere demo-tenant is niet gewijzigd. De warme metingen en actuele eindverificatie staan in de latere sectie `Update 2026-07-31: Talent-navigatie, tenantrechten en performance`.

## Release 2026-07-29: versie 1.20260729.7

De volledige release staat op `main` en `origin/main` als commit `3e324e7`. Vercel Production is `READY` op deployment `dpl_6Wwho9qoYsKBK8DZrxrAh6PC5aAU`, met aliases `liquid-hr-hr-suite.vercel.app`, `liquidhr-edwinitsolutions.vercel.app` en `liquidhr-git-main-edwinitsolutions.vercel.app`. De anonieme productiecontrole toont de loginpagina en Vercel meldt geen runtime errors in het afgelopen uur. Een ingelogde productiecontrole blijft handmatig.

## Update 2026-07-29: verlofopbouw, werkuren en overuren zichtbaar gemaakt

Versie `1.20260729.7` herstelt de volledige configuratiestroom onder HR-beheer → Verlofopbouw. De catalogus toont contextafhankelijke toevoegknoppen, Voorrangsregels alleen bij Afwezigheden en uitsluitend Kleuren en gebruik in het driepuntsmenu. Nieuwe verloftypen hebben Annuleren, Soort verlof en Opbouw; bij regelopbouw staat de effectieve opbouweditor inline met contracturen, één of meer werkurentypen, periode, moment, uren/minuten/seconden, pauzetypen, vervaltermijn, opvolgerketen en samenvatting. Uitzonderingen blijven voor iedere opbouwvorm beschikbaar. Werkuren en overuren tonen algemene instellingen op Basisinformatie en de vier beperkingstypen plus administratiegebonden uitzonderingen op Beperkingen; Geavanceerd blijft bewust leeg.

Supabase-project `wnpfloqpjvaacobppbpk` is gecontroleerd op rollen, administratie-RLS en migratiehistorie. De ontbrekende lokale no-op historie-entry `20260729101206_syntax_probe_ops.sql` is hersteld. In de demo-administratie zijn idempotente testtypen toegevoegd voor alle verlofvormen, gewerkte-urenopbouw en maand-, jaar- en contractfactorbeperkingen voor werkuren en overuren. Gerichte ESLint, i18n-pariteit en 405 tests slagen. De productiecompilatie slaagt, maar de afsluitende typecheck/build stopt op twee bestaande wijzigingen buiten deze slice (`createHeRaLabels` en `hasActiveEmployment`). De server is op poort 3000 bereikbaar; zonder nieuwe ingelogde browsersessie kon alleen de login/redirect en console worden gecontroleerd, niet de afgeschermde HR-route.

## Update 2026-07-29: Next.js dev-servergeheugenonderzoek

Het volledige onderzoek staat in [`docs/delivery/NEXT_DEV_MEMORY_INVESTIGATION.md`](NEXT_DEV_MEMORY_INVESTIGATION.md). Next `16.2.12` gebruikt standaard Turbopack; een routeverkenning van 60 minuten groeide van circa 1,30 naar 3,04 GB working set, terwijl een korte Webpack-vergelijking rond 1,20 GB bleef. De historische 11,12 GB is niet opnieuw bereikt en er is geen applicatie-side globale cache, timerlek of watcher gevonden. De standaard lokale `dev`-script gebruikt daarom Webpack; `npm run dev:turbopack` blijft beschikbaar voor diagnose. `turbopack.root` is stabiel aan `__dirname` gekoppeld. De meethelper staat in `scripts/measure-next-memory.ps1`. Cache-/devservers zijn lokaal gecontroleerd; er is niet gedeployed, gepusht of gemigreerd. De afsluitende typecheck heeft twee bestaande, losstaande fouten gemeld; zie het onderzoeksdocument.

## Update 2026-07-29: dashboardvensters medewerker

- Het dashboardvenster Persoonlijke informatie toont nu naam, leeftijd, dagen tot verjaardag, zakelijke/privé telefoons, e-mailadressen en huidig adres; geslacht, geboortedatum en geboorteplaats worden daar niet meer getoond.
- De foto-uitlegtekst is verwijderd. Foto uploaden/wijzigen/verwijderen blijft zichtbaar voor gebruikers met `employee:write`; de bestaande servervalidatie en opslag blijven leidend.
- De verzuimkaart onderscheidt **Nu ziek** en **Nu niet ziek** met een rood/groen statusvlak. Bij geen lopende ziekmelding blijft het laatste verzuimgeval zichtbaar. De ziekmeldingsvelden staan nu in een aparte viewport-modal; medische oorzaken of vrije medische tekst zijn niet toegevoegd.
- De dashboard-drag-toolbar staat niet meer absoluut over links heen. Bij meerdere actieve dienstverbanden toont Contract en salaris tabs per dienstverband; de salarisreveal haalt de gekozen `employmentId` server-side op.
- Verificatie: `check:i18n`, strict typecheck, ESLint en productiebuild geslaagd. Geen schemawijziging, Supabase-migratie, push of deployment uitgevoerd. Een nieuwe ingelogde browsercontrole kon niet worden afgerond omdat poort 3000 tijdens deze beurt niet bleef luisteren; de build compileerde de nieuwe route en componenten wel volledig.

## Update 2026-07-29: dienstverbandweergave op medewerkerdashboard

De persoonsheader toont geen functie, afdeling of manager meer. De dienstverbandheader toont rechts het medewerkertype van het actuele/laatste contract. Het dashboardvenster Dienstverbanden toont per dienstverband de periode, status, functie, afdeling, uren, arbeidsvoorwaarden en medewerkertype; iedere regel is volledig klikbaar naar het dienstverbanddetail. Wanneer geen actief dienstverband bestaat, wordt dit expliciet gemarkeerd en ziet een geautoriseerde gebruiker de knop naar de bestaande wizard. Statuslogica en de scenario's actief, toekomstig, beëindigd en geannuleerd zijn getest. Typecheck, ESLint, i18n-pariteit en productiebuild zijn geslaagd. Niet gedeployed of gepusht.

## Update 2026-07-29: API-landschap vastgelegd

De inventarisatie van de API's staat in [`docs/architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md`](../architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md). Liquid HR heeft 112 interne Next.js-BFF-routes onder `/api/*`, met Supabase-claims, server-side permissies, actieve tenant-/administratiecontext en RLS als datagrens. Er is nog geen publieke/partner-API, versionering, uniform pagineringscontract, OpenAPI-contract, generieke rate limiting of inkomende webhooklaag. Uitgaande diensten zijn Supabase, Google Gemini voor HeRa, PDOK, Geoapify en Nager.Date. Toekomstige externe ontsluiting start afzonderlijk onder `/api/v1/*`; bestaande interne routes worden niet geopend. Geen code-, database- of deploymentwijziging uitgevoerd.

## Release-status 2026-07-28

Branding is nu remote actief op Supabase-project `wnpfloqpjvaacobppbpk`: migratie `20260728110000_administration_branding.sql`, private storage-bucket, RLS/policies, `settings:write` voor `TENANT_ADMIN` en `user_preferences.use_company_theme` zijn live gecontroleerd. Applicatieversie: `1.20260728.5`. Commit `f650279` staat op `origin/main`; Vercel production deployment `dpl_FPXqx9mrjiY5aDo1dN2kSRJAXdZj` is `READY`.

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

## Update 2026-08-01: Talentfundament- en Tijdhub-UX

- Talentfundament gebruikt nu het bestaande instellingen-accordionpatroon met altijd precies één geopend onderdeel. De overbodige `TALENTFUNDAMENT`-eyebrow en toelichtende subtitel zijn verwijderd. De sidebarlink gebruikt dezelfde uitlijning als de overige hoofdnavigatie.
- De eerstvolgende reminder gebruikt de bestaande warning-surface als geel-notitiekaartje. Tijdhub-panelen positioneren zich naast de knop of erboven wanneer de onderzijde onvoldoende ruimte heeft en bevatten altijd een zichtbare sluitknop. De demo bevat tijdens deze controle geen verlopen reminderrecord; de gedeelde verlopen-codepad gebruikt dezelfde positionerings- en sluitlogica.
- Browsercontrole op de ingelogde lokale sessie: `/settings/talent` toont één actieve sidebarlink, geen eyebrow/subtitel en één open paneel; wisselen en opnieuw klikken op het geopende paneel laat één paneel open. Het komende-reminderpaneel had een sluitknop, overlapte de trigger niet en sloot daarna correct. De console bevatte geen errors.
- Verificatie: 111 testbestanden/410 tests geslaagd, strict typecheck, ESLint, i18n-pariteit (24 namespaces) en productiebuild (115 statische pagina's) geslaagd. Poort 3000 bleef luisteren en `/login` gaf HTTP 200.

## Hervatten

## Update 2026-08-02: stap 1 alleen-lezen supportmodus

- Vanuit een klantdetail in `apps/liquidhr-control` kunnen actieve `OWNER`/`OPERATOR`-beheerders nu een tijdelijke alleen-lezen supportsessie starten met reden en 15/30/60 minuten geldigheid. De sessie gebruikt een HttpOnly-cookie zonder token in de URL, eindigt expliciet of via vervaldatum en schrijft start/eind naar `platform_audit_logs`.
- De HR-app heeft daarvoor een aparte route `/support`, buiten de normale klantdashboard-layout. Deze toont uitsluitend een beveiligd read-model: klantmodel, administraties, aantallen actieve dienstverbanden en maximaal de eerste 100 medewerkers. Er zijn geen schrijf-, upload-, verwijder- of normale klantacties beschikbaar. Dit is bewust nog geen volledige navigatie door alle bestaande HR-schermen.
- Remote migraties `20260802234000_add_platform_support_sessions.sql` en `20260802242000_close_expired_platform_support_sessions.sql` zijn toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De supporttabel heeft RLS zonder directe table grants; publieke RPC's zijn `SECURITY INVOKER`-wrappers en interne functies zijn `SECURITY DEFINER` met operator-, tenant-, duur-, sessie- en vervaldatumcontrole. Remote controle: RLS aan, drie wrappers en drie interne definerfuncties aanwezig, nul supportsessies.
- Verificatie: control en HR strict typecheck, ESLint, i18n-pariteit, 7 controltests en beide productiebuilds geslaagd. De lokale servers antwoorden op `http://localhost:3000/login` en `http://localhost:3001/login`. De volledige browserflow is nog open: de huidige Codex-browsersessie is geldig maar geen actieve platformbeheerder en is daarom veilig op `/geen-toegang` gebleven; niet uitgelogd en geen Google-account gekozen.

## Update 2026-08-02: afzonderlijk LiquidHR Control Plane en Google-login

- Nieuwe app: `apps/liquidhr-control`, lokaal altijd via `npm.cmd run dev:control` op poort 3001. De devstarter leest alleen de publieke Supabase-waarden uit `apps/hr-suite/.env.local`; er worden geen secrets gekopieerd.
- Functies: gesloten login zonder registratie, rollen `OWNER/OPERATOR/AUDITOR`, dashboard, zoeken/filteren, klantdetail, onboarding met meerdere administraties, keuze `COMBINED/SEPARATE`, lifecycle, gebruikssnapshot en platformaudit.
- Schema: lokale migratiebestanden `20260802230000_add_liquidhr_control_plane.sql` en `20260802231000_harden_liquidhr_control_plane_rpcs.sql` plus pgTAP-contract. Remote geregistreerd als `20260802172255_add_liquidhr_control_plane` en `20260802172601_harden_liquidhr_control_plane_rpcs`; niets gedeployed.
- Verificatie: 7 domeintests, control-i18n (121 sleutels), ESLint, strict TypeScript en Next-productiebuild geslaagd. De control-app is op poort 3001 in de echte Codex-browser gecontroleerd: de eigenaar zag het dashboard met 2 klanten, 72 medewerkers en 91,7 KB opslag. De knoppen en klantenteller gebruiken nu een duidelijk licht/donker contrast. De dashboardcopy maakt expliciet dat klantdetails geen impersonatie zijn, de technische naam is de zoekterm en recente platformactiviteiten worden daar geregistreerd. De login bevat naast wachtwoord ook Google OAuth met een server-side callbackroute.
- Remote verificatie: vijf control-tabellen en vijf RLS-configuraties aanwezig; beide bestaande tenants bleven `ACTIVE`; anonieme RPC-execute is geblokkeerd; Edwin is actieve `OWNER`; een niet-geregistreerde Auth-identiteit krijgt geen platformtoegang; control-plane security-advisor heeft 0 bevindingen. Gedeelde DB-types zijn opnieuw gegenereerd.
- Handmatig resterend: voeg in Supabase Auth → URL Configuration de exacte redirect-URL `http://localhost:3001/auth/callback` toe. Google-provider en de bestaande operatorregistratie blijven gedeeld met de HR-app; een wachtwoordreset is niet nodig voor Google-login.

## Update 2026-07-31: Talent-navigatie, tenantrechten en performance

- De dubbele Talent-navigatie is verwijderd. `/settings/talent` is het Talentfundament en verschijnt uitsluitend met `talent:manage`; `/workforce/talent` is niet langer een zijbalkitem. Managers met `talent:manager-read` openen Talentprofielen via de tegel op `/workforce`. De actieve navigatiestatus gebruikt exacte matching voor `/settings` en houdt `/workforce` als enige actieve ouder op Talentprofielen.
- De tenant-specifieke TENANT_ADMIN-override van Edwin's actieve demo-tenant miste de drie Talentrechten. Het lokale migratiebestand `20260731193000_grant_talent_permissions_to_demo_tenant_admin.sql` is alleen op die demo-tenant toegepast voor `talent:manage`, `talent:manager-read` en `talent:read`; Supabase registreerde de uitvoering als `20260731172748_grant_talent_permissions_to_demo_tenant_admin` door de bestaande remote tijdlijn. De andere demo-tenant is niet aangepast.
- De dashboard-layout hergebruikt nu de bestaande Supabase-client en auth-/tenantcontext bij gebruikersvoorkeuren en branding. Daarmee vervallen dubbele auth-, administratie- en clientinitialisaties bij iedere dashboardroute.
- Ingelogde browsercontrole op poort 3000 bevestigde: `/workforce` heeft één actieve navigatielink en de Talentprofielen-tegel; `/workforce/talent` heeft alleen Workforce actief; `/settings/talent` heeft alleen Talentfundament actief. De routes laden met de bestaande demo-data.
- Performancebewijs: een eerste dev-compile kan door Next.js ongeveer 9--15 seconden duren; warme serverrequests voor de gecontroleerde routes lagen rond 0,8--1,3 seconden. Dit is een lokale dev-observatie, geen productiebenchmark. Een volgende performance-slice moet server-timing per gedeelde dashboardbron vastleggen voordat verdere optimalisatie wordt gekozen.
- Verificatie: 111 Vitest-bestanden/410 tests geslaagd, strict typecheck, ESLint, i18n-pariteit (24 namespaces) en productiebuild (115 statische pagina's) geslaagd. `curl.exe http://127.0.0.1:3000/login` gaf na iedere hoofdcontrole HTTP 200. Supabase-migratielijst bevat de Talentmigraties en security/performance-advisors zijn opnieuw uitgevoerd; de gemelde waarschuwingen zijn bestaande projectbrede functies/indexen/policies.

## Update 2026-07-29: instellingenbeheer afgerond

- Rollen en rechten heet nu correct; iedere grafische dekkingscel opent een modal met de onderliggende autorisaties. Ook globale systeemrollen zijn veilig bewerkbaar via een administratiegebonden override, zonder de globale rol te muteren.
- Roltoewijzingen bieden drie standaard ingeklapte werkwijzen naast elkaar: vanaf medewerker, vanaf afdeling en voor meerdere afdelingen zonder leidinggevende. Medewerkers met gelijke namen zijn herkenbaar aan personeelsnummer, functie en afdeling. De lijst zoekt, filtert en sorteert, en een klikrij opent details met verwijderactie.
- Afdelingen kunnen ook vanuit de organisatiestructuur worden toegevoegd; formulieren resetten en verversen na opslaan.
- Vrije velden starten met entiteitkeuze medewerker/document. Rijen zijn volledig klikbaar, toevoegen en annuleren legen/sluiten het formulier, vereiste sleutel en label worden gevalideerd en documentvelden worden als metadata bij upload en weergave in het dossier gebruikt.
- Functies en salarisschalen zijn volledig gescheiden. Het functiescherm heeft losse aanmaakacties, standaard ingeklapte filters, een grafisch groepsoverzicht en toont gekoppelde functies bij groepsbewerking.
- Stamtabellen tonen geen overig-paneel meer. Redenen uitdienst zijn per land beheerbaar met CRUD en actief/inactief. Nederland gebruikt codes 01, 02, 03, 04, 20, 21, 30, 32, 33, 34, 40, 41, 90 en 99; ontbrekende landspecifieke inrichting valt terug op `Einde contract`.
- Remote migraties `20260729061253_extend_custom_fields_to_documents`, `20260729064035_country_scoped_employment_end_reasons` en `20260729070552_normalize_nl_employment_end_reasons` zijn toegepast. Database-types zijn vernieuwd.
- Applicatieversie: `1.20260729.2`. Typecheck, lint, i18n, volledige testsuite, productiebuild, ingelogde desktop-/390px-browsercontrole en de definitieve herstart op poort 3000 zijn uitgevoerd.

## Hotfix 2026-07-29: behoud eigen autorisatiebeheer

- De demo-HR Admin-override miste `authorization:read`, waardoor de kaarten op Instellingen zichtbaar bleven maar `/authorization` na een verversing terecht met onvoldoende rechten stopte. Het recht is gericht hersteld.
- Bij het opslaan van rechten voorkomt de server nu dat een gebruiker lezen of beheren van Rollen en autorisaties uit de eigen actieve rol verwijdert. De UI toont hiervoor een concrete uitleg in plaats van een generieke fout.
- Verificatie: strict TypeScript, ESLint, i18n-pariteit en de remote controle van beide autorisatierechten zijn groen. Applicatieversie: `1.20260729.3`.

## Update 2026-07-29: dienstverband- en contractherstructurering

- Dienstverbanden dragen nu de primaire status, IKV 1–99, begin-/anciënniteitsdatum en contractland. Parallelle en sequentiële dienstverbanden blijven ondersteund; per medewerker kan maar één primair dienstverband tegelijk actief zijn.
- Ieder dienstverband heeft een rechtstreeks aansluitende reeks `employment_contracts` met medewerkerstype, flexfase, arbeidsvoorwaardenregeling, looptijd en proeftijd. DGA is niet meer beschikbaar.
- De nieuwe wizard controleert vooraf personeelsnummer, nationaliteit, geboortedatum, geslacht en bij Nederland het BSN. Daarna worden dienstverband, contract, rooster, salaris, organisatie en kosten in één transactie gepubliceerd.
- HR-instellingen bevatten Algemeen met het standaard contractland en beheerbare arbeidsvoorwaarden, flexfasen, salarisfrequenties en kostendragers. `Bedrijfseigen regeling`, maand, 4-weken en de gevraagde flexfasen zijn voorgevuld.
- Overzicht toont dienstverband-/IKV-gegevens en selecteerbare contractkaarten. Basis/IKV en Arbeidsvoorwaarden zijn geen losse tabs meer. Rooster, Salaris, Organisatie en Kostenverdeling gebruiken dezelfde selecteerbare tijdlijnopzet.
- Wettelijke minimumuurlonen voor Nederland zijn per leeftijd en ingangsdatum als administratiegebonden gegevens opgenomen. Applicatieversie: `1.20260729.4`.
- De schema-, API- en UI-slices zijn lokaal gebouwd en remote op het gekoppelde Supabase-testproject toegepast. De lokale en remote historische migratieversies verschillen al uit eerder werk; daarom is de bestaande historie niet gerepareerd en zijn deze migraties gecontroleerd op naam toegepast.
- Browsercontrole op poort 3000 is ingelogd uitgevoerd voor HR-inrichting, de verplichte basisgegevenscontrole, alle wizardstappen, contractkaarten en de rooster-, salaris-, organisatie- en kostentijdlijnen. Hiervoor is bij testmedewerker Lina de nationaliteit genormaliseerd naar `NL` en een synthetisch geldig test-BSN veilig opgeslagen; er is geen extra dienstverband gepubliceerd.
- Eindverificatie: strict TypeScript, ESLint zonder waarschuwingen, i18n-pariteit, 107 testbestanden/396 tests en de productiebuild zijn geslaagd. De Supabase security-advisor meldt geen nieuwe domeinbevindingen; de vijf nieuwe ontbrekende FK-indexen en dubbele permissieve cataloguspolicies zijn opgelost. Remote staan 60 contracten op 60 dienstverbanden en er zijn geen ongeldige contractopvolgingen.

## Update 2026-07-29: compact dienstverband- en landenoverzicht

- De dienstverbandkaarten op Persoonsgegevens tonen anciënniteit als jaren plus maanden, berekend vanaf `seniority_date`. Voor uitsluitend actieve dienstverbanden tonen ze ook afdeling, functie, uren per week, CAO/arbeidsvoorwaarden en medewerkerstype.
- Het minioverzicht op de dienstverbanddetailpagina toont dezelfde anciënniteitsduur plus de actuele CAO en het medewerkerstype.
- Geboorteland en nationaliteit zijn geen vrije ISO-tekstvelden meer: beide gebruiken een doorzoekbare landenkeuze. Lege waarden starten met het ingestelde standaardland van de actieve administratie.
- Verificatie: gerichte anciënniteitstest (3 assertions), strict TypeScript, ESLint en i18n-pariteit geslaagd. Een ingelogde browsercontrole van de nieuwe weergave blijft nog open.

## Update 2026-07-29: Operations B.V. tienjarige dienstverbandfixture

De expliciet gevraagde synthetische fixture `20260729101802_seed_operations_employment_history.sql` is toegepast op Supabase-project `wnpfloqpjvaacobppbpk`. De data is volledig herkenbaar met personeelsnummers `OPS-TEST-001` t/m `OPS-TEST-010`, vaste UUID's en `.invalid`-e-mailadressen; bestaande testdata buiten deze scope is niet geraakt.

De fixture bevat 10 medewerkers, 12 dienstverbanden en 18 contracten: historische en actuele dienstverbanden, een herindiensttreding, parallelle primaire/secundaire dienstverbanden, contractreeksen van bepaalde naar onbepaalde tijd, drie opeenvolgende bepaalde contracten, verschillende landen/IKV's, functies, afdelingen, salarissen, roosters, kostenplaatsen en kostendragers. Vier medewerkers zijn uit dienst met verschillende reden/initiator-combinaties (werkgever, werknemer, wederzijds en van rechtswege). Er zijn 17 salarisregels, 16 organisatieplaatsingen en 18 kostenregels.

Remote invariantcontrole: geen overlappende primaire dienstverbanden, geen gebroken contractopvolgingen, alle roosters sluiten exact aan op de contracturen en alle kostenverdelingen tellen op tot 100%. De statusverdeling is 6 actieve en 4 vertrokken medewerkers. De migratie staat als applied geregistreerd; wegens de bestaande lokale/remote migratiehistorie is zij rechtstreeks op naam toegepast en niet via een brede `db push`.

Ingelogde browsercontrole op poort 3000 is geslaagd in administratie `Liquid HR Operations B.V.`. Anna Vermeer (`OPS-TEST-001`) toont op Overzicht haar drie contracten door de tijd; de tabbladen Salaris, Organisatie en Kostenverdeling tonen respectievelijk drie salarisperioden, drie organisatieperioden en vijf kostenverdelingen. Applicatieversie blijft `1.20260729.4` omdat dit een datafixture is.

## Hotfix 2026-07-29: medewerkerfilters en administratiecontext

De medewerkerlijst slaat zoektekst niet langer mee op als blijvende gebruikersvoorkeur. Zoektekst blijft URL-state; alleen status, archiefstatus, sortering, weergave en de open/dicht-status van het filterpaneel worden naar `user_preferences` geschreven. Daarmee verdwijnt de 400 op `PATCH /api/preferences/employees` bij zoeken.

Na een geslaagde administratie-wissel wordt de gebruiker altijd naar `/dashboard/start` gestuurd. De startpagina laadt daarna opnieuw met de gegevens van de gekozen administratie; de actieve context blijft server-side gevalideerd.

Supabase security- en performance-advisors zijn opnieuw uitgevoerd. De meldingen zijn bestaande projectbrede adviezen buiten deze fixture (onder andere absence-RLS zonder policy, SECURITY DEFINER-rechten en bestaande index/permissive-policy adviezen); er is geen nieuwe fixture-specifieke bevinding vastgesteld. De bestaande schema-inconsistentie rond een echt `is_on_call`-rooster blijft als open productpunt bestaan; Daan is daarom veilig als parttime-contract met oproepscenario in custom data opgenomen zonder de databasecheck te omzeilen.

1. Lees `AGENTS.md`, `docs/README.md` en dit bestand.
2. Controleer werkboom, branch, poort 3000, Supabase en Vercel opnieuw.
3. Gebruik `docs/delivery/IMPLEMENTATION_STATUS.md` en de relevante requirements voor resterend werk.
4. Werk na iedere materiële slice dit bestand en de status bij.
## Hotfix 2026-07-29: medewerkerfoto wijzigen en compact opslaan

Op de medewerkerdetailpagina kan een gebruiker met `employee:write` de profielfoto wijzigen of verwijderen. De bediening is ook in de compacte detailweergave zichtbaar. Nieuwe uploads worden server-side geroteerd, naar maximaal 512x512 verkleind en als WebP van maximaal 750 KB opgeslagen. De nieuwe migratie `20260729130000_compact_employee_avatars.sql` verlaagt daarnaast de bucketlimiet naar 1 MB; deze moet nog naar Supabase worden uitgerold.

## Requirements-update 2026-07-31: tenant- en administratie-eigendom

De nieuwe leidende matrix staat in `docs/requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`; ADR-0006 legt de beslissing vast. Functies, functiegroepen, functiefamilies, niveaus, senioriteiten, capabilities, Talent-/Performance-templates, Cloud Tags en niet-juridische afdelingen zijn tenant-owned. Employees zijn tenantbrede personen; employments, contracten, payroll, salaris, verlof, verzuim, declaraties, roosters, feestdagen en kosten zijn administration-owned. Een employment/organisatieplaatsing koppelt beide werelden zonder een tweede functiecatalogus.

De ownershipslice is nu uitgevoerd. Remote zijn `20260731130502_align_tenant_owned_job_catalog_and_departments`, `20260731131136_align_star_performer_job_catalog_scope` en `20260731132359_align_tenant_department_consumers` toegepast. De bestaande job-, group-, revision-, junction- en department-ID's zijn behouden; de dubbele demo-ROOT is samengevoegd zodat 17 tenantafdelingen overblijven. Jobcatalogus, Star Performer job/group lookups, afdelingsbeheer en alle gevonden organization/document/reminder/calendar/insights consumers gebruiken tenantcontext; employments, employee placements, salary, payroll, leave, absence, expenses, assessments, reminders en documents houden hun administrationele context. `packages/db/types.ts` is opnieuw gegenereerd.

Verificatie voor deze slice: na iedere hoofdwijziging gaf `curl.exe http://127.0.0.1:3000/login` HTTP 200. Exacte eindresultaten: `npm.cmd test --workspace @liquid-hr/hr-suite` exit 0 (110 testbestanden, 405 tests, 0 failures); `npm.cmd run type-check --workspace @liquid-hr/hr-suite` exit 0; `npm.cmd run lint --workspace @liquid-hr/hr-suite` exit 0; `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` exit 0 (23 namespaces); `npm.cmd run build --workspace @liquid-hr/hr-suite` exit 0 (Next.js-build, 106 static pages); lokale/remote migration list is voor oudere historie al afwijkend, de drie nieuwe remote migrationnamen zijn gecontroleerd; Supabase security/performance advisors melden alleen bestaande projectbrede waarschuwingen/informatie. Een authenticated browserflow kon in deze run niet worden uitgevoerd omdat geen ingelogde testsessie beschikbaar was; anonieme beschermde API's geven 401 en routes redirecten naar login.

Historische overdrachtstekst; vervangen door de actuele Talent Foundation-update bovenaan dit document. De genoemde Foundation-onderdelen zijn uitgevoerd; resterend zijn alleen de afzonderlijke Blueprint-slices die in `docs/README.md` als toekomstig staan.
## Update 2026-08-04: medewerker-selfservice voor ziekmelden lokaal voorbereid

De lokale migration `20260804153000_employee_self_service_absence_reporting.sql` voegt per administratie `employee_self_report_enabled` toe, standaard `false`. De beveiligde verzuim-RPC accepteert bij ingeschakelde self-service alleen de eerste ziektedag voor de ingelogde medewerker; herstel, wijzigen en aanvullende verzuimgegevens blijven server-side geblokkeerd. De medewerkerpopup toont alleen deze datum en de afgesproken uitlegtekst. Na een self-service-melding worden direct gepubliceerde reminders aangemaakt voor de directe manager en actieve HR Admin/TENANT_ADMIN-accounts, met de eerste ziektedag in de omschrijving.

Lokaal gecontroleerd: strict TypeScript en i18n-pariteit geslaagd. Remote migration, Supabase-advisors, officiële DB-types en authenticated browsercontrole moeten nog worden uitgevoerd.

## UX-tooling update 2026-08-07: EdwinHelp screen redesign

- De herbruikbare skill [`docs/skills/edwinhelp-screen-redesign/SKILL.md`](../skills/edwinhelp-screen-redesign/SKILL.md) is toegevoegd en opgenomen in EdwinHelp, `AGENTS.md`, `docs/README.md` en `docs/DEVELOPER_TOOLKIT.md`.
- Het schermregister staat in [`docs/requirements/ux/SCHERM_REDESIGN_STATUS.md`](../requirements/ux/SCHERM_REDESIGN_STATUS.md). `/settings/company-data` is als eerste Liquid Flow-redesign geregistreerd; `/authorization` Rollen en autorisatie is de volgende pagina.
- De per-scherm requirements gebruiken [`docs/requirements/ux/SCREEN_REDESIGN_TEMPLATE.md`](../requirements/ux/SCREEN_REDESIGN_TEMPLATE.md). Na ieder afgerond scherm worden requirements, status en dit contextdocument bijgewerkt.
- De instructie bevat geen verplichte aparte featurebranch. De bestaande veiligheidsgrenzen blijven gelden: ongerelateerde wijzigingen niet aanraken en geen schema-, remote-, merge-, push- of deployactie zonder aparte opdracht.

## UX-redesignvoorstel 2026-08-07: Rollen en autorisatie

- Voor `/authorization` is het requirements- en ontwerpdocument [`REDESIGN_ROLLEN_EN_AUTORISATIE.md`](../requirements/ux/REDESIGN_ROLLEN_EN_AUTORISATIE.md) toegevoegd.
- Het voorstel beschrijft een rustigere, minder ronde beheerflow voor rolkeuze, rechtenmatrix, heatmap, statusmeldingen, opslaan, dialogen, mobiel 390px, toegankelijkheid en NL/EN i18n.
- De bestaande grens blijft leidend: `/authorization` beheert exacte rechten; `/role-assignments` beheert organisatiescope en rolhouders. Er zijn geen API-, database-, RLS-, remote- of autorisatiewijzigingen uitgevoerd.
- De implementatie staat nu in de basiswerkplek `feature/verlofopbouw-inrichting`, zodat poort 3000 beide redesigns toont.
- Typecheck, lint, i18n-check, `git diff --check` en browsercontrole op desktop/390px zijn geslaagd.

## UX-redesign implementatie 2026-08-07: Rollen en autorisatie

- Het voorgestelde visuele redesign van `/authorization` is vanuit de geïsoleerde werkplek overgezet naar de basiswerkplek `feature/verlofopbouw-inrichting`.
- De autorisatieflow en API-contracten zijn behouden. De wijziging beperkt zich tot de autorisatiemanager: minder ronde hoeken, rustigere statuskaarten, compactere fout/statusmelding, semantische tabs en een duidelijke link naar `/role-assignments`.
- Typecheck, lint, i18n-check en `git diff --check` zijn groen. Poort 3000 toont beide redesigns; desktop- en 390px-browsercontrole zijn geslaagd. Credentials zijn niet gekopieerd.
- Status: `GEVERIFIEERD`; Edwin bepaalt het volgende scherm.

## Hotfix 2026-08-07: hydration op bedrijfsgegevens

- De hydrationfout op `/settings/company-data` kwam door server/client-verschillen in `Intl.DisplayNames` voor landlabels; bijvoorbeeld `FK` kon tijdens SSR een andere tekst krijgen dan in de browser.
- `CountryPicker` en `AddressFields` gebruiken nu een deterministische SSR/eerste-client-render via `useSyncExternalStore`. Gelokaliseerde landnamen worden daarna client-side geactiveerd, zonder functionele wijziging aan het adresformulier.
- Strict TypeScript, lint en browsercontrole op poort 3000 zijn geslaagd: de pagina laadt, zonder runtimefout en zonder hydration- of mismatchmeldingen.
## UX-update 2026-08-07: Liquid Flow applicatiebrede stijl

- In geïsoleerde featurebranch `codex/liquid-flow-appwide` zijn de gedeelde radius-tokens, formulier-/dropdown-/knopstijlen, instellingenheaders en accordions aangescherpt. De bestaande `globals.css` blijft de centrale stijlbron; er is geen tweede stylesheet-thema nodig.
- `/settings/company-data` gebruikt nu een rustige tweestapsflow voor bedrijfsadres en locaties. Het grote informatievenster is op deze pagina verwijderd; adreszoeker, handmatige invoer, locatiebeheer en bestaande API-opslag zijn behouden.
- NL/EN-teksten zijn gelijkgetrokken en uitgebreid voor de nieuwe status- en zoekuitleg. Er zijn geen schema-, migratie- of remote wijzigingen uitgevoerd.
- Verificatie: strict typecheck, ESLint, i18n-pariteit (28 namespaces), diff-check, Next productiebuild via Webpack en ingelogde desktop-/390px-browsercontrole geslaagd. De browser gaf alleen de bestaande CountryPicker hydration-waarschuwing voor de landnaam `Falklandeilanden`; dit staat los van deze UX-slice.
- De feature is lokaal samengevoegd naar `main` als onderdeel van deze releasebasis; push en deployment volgen pas na de releasegate.
