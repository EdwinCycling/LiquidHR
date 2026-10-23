# PMUX-04 — TEST-acceptance — 2026-10-21

## Verdict

**PARTIAL / HOLD.** De geautoriseerde TEST-run is veilig bij de eerste catalogus/securitygate gestopt. De catalogusmigratie is toegepast; de migratie voor historie, de Opleidingsaanvraag-configuratie/publicatie en de browserflow zijn niet uitgevoerd. Er is geen procesdefinitie, procesinstantie of screenshot aangemaakt. De producteigenaar moet de UX-evidence nog beoordelen; definitieve visuele acceptatie blijft OPEN.

| Gate | Uitkomst | Bewijsgrens |
| --- | --- | --- |
| Branch/baseline | PASS | PMUX-worktree en branch bevestigd; zie hieronder. |
| Migratie 1 | APPLIED | Alleen de catalogus-RPC, in het geautoriseerde Supabase-project. |
| Catalogus SECURITY/RPC | HOLD | DDL/grants gelezen en Employee-catalogus via UI bekeken; vereiste echte positieve en negatieve RPC-/scopeproeven zijn niet volledig uitgevoerd. |
| Migratie 2 | NOT RUN | Niet doorgegaan omdat gate 1 geen GO opleverde. |
| Browser end-to-end | NOT RUN | Geen Opleidingsaanvraag gepubliceerd of gestart; geen Manager/HR-verwerker beschikbaar in de bestaande switcher. |
| Desktop/mobiel UX | OPEN | Geen screenshots of 1440×900/390×844 acceptatiecapturen. |
| Definitieve productacceptatie | OPEN | Geen eigenaarbeoordeling van screenshots mogelijk. |

## Baseline en wijzigingsgrenzen

- Werkmap: C:\Users\Edwin\.codex\worktrees\branch-split-pmux-20261021\LiquidHR.
- Branch: work/BRANCH-SPLIT-PMUX-20261021.
- Start-HEAD was de verwachte 34b0d4d46ec9ea65f47ee0fe24d9160284ab1bcf. Tijdens de run is de lokale codefix vastgelegd als c7d6681eb05e9a06571dfcb68d7c3cb5e7fcc1cd (fix(pmux): restore process catalog browser routes). De evidence wordt separaat vastgelegd.
- De standaard git status blijft in deze worktree falen met fatal: this operation must be run in a work tree, hoewel rev-parse --is-inside-work-tree true meldt en de worktree aan Git is gekoppeld. De nul gewijzigde, verwijderde, ongevolgde en staged bestanden zijn vóór deze evidencewijziging gecontroleerd met Git-index/diff-opdrachten; next-env.d.ts was schoon. Herhaalcontrole volgt na de documentatiecommit.
- De hoofdcheckout, Payroll-runtime op 3010 en Focus-widget zijn niet gewijzigd. Centrale configuratie/secrets zijn niet gelezen, gekopieerd of gewijzigd. De lokale PMUX-runtime is via start-test-worktree.ps1 op loopback-poort 3011 gestart en daarna gestopt. De door Next gegenereerde wijziging aan apps/hr-suite/next-env.d.ts is na stoppen exact naar HEAD hersteld.
- Geen push, merge of deployment.

## Supabase TEST — uitvoering en readback

Projectidentiteit is vlak voor toepassing gelezen: project-ID/ref wnpfloqpjvaacobppbpk, actief/healthy, regio eu-west-3; de tool gaf de naam LiquidHR terug. De ref komt overeen met het expliciet geautoriseerde LiquidHR TEST-project. Vooraf bevatte de remote migratiehistorie 569 records; beide PMUX-migraties ontbraken.

De twee lokale SQL-bestanden zijn op DDL/grants gecontroleerd. Ze bevatten functie-DDL, privilege-instructies en comments; geen businessdata-DML, tabel-DDL, destructieve statements of tabel-SELECT-grants. De lokale bestands-hashes op deze branch zijn:

| Volgorde | Bestand | Git blob hash | Uitkomst |
| --- | --- | --- | --- |
| 1 | apps/hr-suite/supabase/migrations/20261021143000_pmux03a_ess_process_start_catalog.sql | 7ee29af6dcf8158550c411d5e8216cb581ac7127 | Toegepast via de ondersteunde apply_migration-tool. |
| 2 | apps/hr-suite/supabase/migrations/20261021160000_pmux03b_process_work_experience.sql | a5cdf8118222f863b49ba5e7478be55c6b609b2a | Niet toegepast; niet verder gegaan na HOLD van gate 1. |

Remote readback bevestigde dat migratie 1 in de historie staat onder versie 20261021182957, naam pmux03a_ess_process_start_catalog. Deze versie wijkt af van de lokale prefix 20261021143000. De tool registreerde een eigen remote versie; er is geen migratiehistorie handmatig aangepast. Dit is een expliciet integratie-/reconciliatiepunt vóór een volgende migratierun. Migratie 2 ontbreekt remote. Er is geen rollback uitgevoerd.

### Functie- en grants-readback na migratie 1

- public.get_process_startable_catalog(uuid, uuid): eigenaar postgres, SECURITY DEFINER, lege search_path; authenticated EXECUTE toegestaan, anon niet. service_role heeft eveneens EXECUTE volgens de gelezen ACL/defaults; een directe service-role-call is niet geprobeerd. De wrapper bindt de actor server-side via auth.uid().
- internal_security.get_process_startable_catalog_internal(uuid, uuid): eigenaar postgres, SECURITY INVOKER, lege search_path; EXECUTE uitsluitend voor postgres. PUBLIC, anon, authenticated en service_role hebben geen EXECUTE. Het interne schema geeft authenticated USAGE, maar dat verleent geen uitvoering van de helper.
- De publieke wrapper is dus de enige geauthenticeerde clientingang volgens de ACL-readback. De directe helpercall is niet via echte sessies uitgevoerd; de ACL-weigering is metadata-readback, geen RPC-denial-test.
- Process-tabellen die zijn nagekeken hebben RLS ingeschakeld. anon heeft geen SELECT op de nagekeken tabellen. Enkele bestaande tabellen geven authenticated SELECT op tabelniveau; effectieve afscherming hangt mede af van RLS. Deze run heeft niet iedere tabelpolicy of iedere scopecombinatie met actor-JWT geprobed.
- De global security-advisor gaf de verwachte waarschuwing voor een aan authenticated verleende SECURITY DEFINER publieke wrapper; de interne helper verscheen niet als direct uitvoerbaar. Er waren daarnaast reeds bestaande, niet-PMUX advisorwaarschuwingen. De advisoruitkomst is geen vervanging voor RPC-/JWT-scopeproeven.

### Waarom de securitygate HOLD is

De medewerkerroute is via de bestaande app geopend en toonde één kaart “Interne overplaatsing”. Dit is beperkt positief browserbewijs dat de geauthenticeerde catalogusroute antwoordt. Het bewijst niet afzonderlijk de nieuwste immutable versie, startbaarheid, tenant-/HR-groepsfilters of afwijzing van ongepubliceerde/vervalste IDs. De UI toonde bovendien zowel de kaart als een aparte headeroptie “Interne overplaatsing starten”; dit is een mogelijke dubbele startoptie die vóór acceptatie moet worden verklaard.

Er zijn in deze run geen echte sessieproeven gedaan voor concept/ingetrokken proces, cross-tenant of HR-groep, geforged proces-ID, directe publieke RPC, interne helper, anonieme RPC of startservice-autorisatie. Er zijn geen API-directe aanroepen gedaan. Er is daarom geen aangetoonde data-exfiltratie, maar de vereiste securityacceptatie is onvolledig en kan niet als GO worden gerapporteerd.

## Personas en browserpreflight

De ondersteunde lokale startscript-preflight voor poort 3011 slaagde; de runtime draaide alleen op 127.0.0.1:3011. /local/personas toonde de huidige beheercontext met rolcode TENANT_ADMIN en de bestaande Payroll-testwissels plus DEMO-002 (Mars). Er was geen Manager- of HR-verwerkerwissel beschikbaar. Alleen de bestaande DEMO-002 (Mars)-wissel is gebruikt en daarna is teruggekeerd naar de startaccount/context. Er is geen rol of rechten aangepast.

Een exacte live HR Admin-rol-/tenant-/groep-/administratiescope-readback is niet uitgevoerd. Ook is niet bewezen dat de startaccount een HR-procestaak mag afhandelen. De bekende lokale HR_ADMIN-contracttests uit PMUX-04-SEC zijn geen TEST-persona- of live-RPC-bewijs.

## Feitelijke schermcontrole en lokale codefix

- /settings/process-automation gaf bij eerste opening een ontbrekende vertaling (studio.blankStart) en een clientbundlefout doordat een clientcomponent een server-only module importeerde. Beide zijn lokaal hersteld in codecommit c7d6681e: de pure teksthelper is naar de clientcomponent verplaatst en de NL/EN-sleutel is toegevoegd. Dit wijzigt geen engine, rechten, schema of remote data.
- Na de fix laadde de bestaande studio en toonde bestaande processen. Er is geen Opleidingsaanvraag-definitie in de database teruggelezen. Er zijn geen concept-, recept-, save-, publish- of compiler-herstelacties uitgevoerd.
- /work?view=REQUESTS laadde na de fix in de bestaande Employee-context en toonde nul bestaande werkitems en één generieke cataloguskaart voor Interne overplaatsing. De extra headerstarter is hierboven als UX-discrepantie genoteerd. Er is niet op de starter geklikt.
- De directe Employee-navigatie naar /settings/process-automation eindigde op /geen-toegang, zonder studio-inhoud. De melding was generiek en zei dat het account niet aan een tenant was gekoppeld; de reden was niet specifiek genoeg om de rolgrens als volledig bewezen te beschouwen.
- De Manager-taaklijst, HR-queue, procesdetails, historie, dashboardprojectie en mobiele weergaven zijn niet doorlopen. Geen Leave-, Actual Work-, Interne overplaatsings- of Documentkennisname-mutatie is gestart.

Gerichte lokale verificatie van de codefix:

- npm test -- components/process-automation/process-start-catalog.test.tsx lib/process-automation/start-catalog-service.test.ts — 2 bestanden, 3 tests geslaagd.
- npx eslint components/process-automation/process-start-catalog.tsx lib/process-automation/start-catalog-service.ts — geslaagd.
- npm run type-check — geslaagd.
- npm run check:i18n — geslaagd, NL/EN namespacegelijkheid.
- git diff --cached --check — geslaagd voor de codecommit.

Dit is lokale codeverificatie, geen remote database-, API- of browseracceptatie.

## Opleidingsaanvraag — niet uitgevoerd

Er is geen procesdefinitie aangemaakt of gepubliceerd en er is geen procesinstantie gestart. Daardoor ontbreken definitie-ID, immutable versie, publicatieaudit, instantie-ID en lifecycle-audit. De vijf opleidingsvelden zijn niet uit een gepubliceerde formulierdefinitie gerenderd en niet opgeslagen. Er is geen Manager-wijzigingsverzoek, ESS-correctie, herindiening, goedkeuring, HR-afhandeling of historie-readback uitgevoerd.

Geen synthetische businessdata is geschreven. De enige remote write in deze run was de toepassing van migratie 1 en de bijbehorende Supabase-migratiehistorie.

## UX-beoordeling volgens de zes vaste criteria

| Scherm/persona | Wat werkelijk kon worden beoordeeld | Bevinding |
| --- | --- | --- |
| Processtudio, beheercontext | Pagina laadde na lokale fix; bestaande proceslijst zichtbaar. | Volgende stap/configuratiemogelijkheden konden niet end-to-end worden beoordeeld; geen publicatie of screenshot. Rechten van de echte HR Admin-persona niet bevestigd. |
| Aanvragen, bestaande Employee-wissel | Bestaande /work?view=REQUESTS-pagina en generieke starter zichtbaar. | Twee zichtbare startopties voor dezelfde Interne overplaatsing roepen verwarring op. Geen mobiel bewijs of taakafronding. |
| Employee → instellingen | Studio-inhoud bleef verborgen na /geen-toegang. | Toegang leek geblokkeerd, maar de generieke tenantmelding is verwarrend en bewijst niet zelfstandig waarom de toegang is geweigerd. |
| MSS/HR/history/dashboard | Niet bezocht in een uitvoerbare geautoriseerde persona. | Alle zes criteria blijven OPEN. |

Geen van de zes criteria krijgt voor de volledige P-mutatiesflow een GO. Beoordeel de echte screenshots gezamenlijk zodra de beveiligings- en persona-blokkades zijn opgelost.

## Screenshot-evidence

De vereiste 35 bewijsmomenten zijn afzonderlijk opgenomen in de [review-index](PMUX-04-20261021-TEST-ACCEPTANCE/REVIEW-INDEX.md). **Geen van de screenshots is vastgelegd**: er bestaan geen PMUX04-01-D.png/PMUX04-01-M.png t/m PMUX04-35-bestanden. Capturen van procespublicatie, aanvraag, besluiten, historie en mobiele route zou de onvoltooide schema-/securitygate omzeilen. De index markeert elk moment expliciet NOT CAPTURED, met persona, route en beoogde actie; er wordt geen screenshotbewijs gesuggereerd.

## Concrete blokkades en kleinste vervolg

1. **Echte catalogusautorisatie ontbreekt.** Eerst de bestaande sessie-/role-switcher-setup aanvullen met al bestaande, geautoriseerde Employee-, Manager-, HR Admin- en HR-verwerkeridentiteiten of de bestaande switcher door de eigenaar laten corrigeren. Geen persona/rechten toevoegen. Voer daarna de toegestane publieke en geweigerde interne RPC-, directe API-, ongepubliceerde-, forged-ID-, tenant- en HR-groepproeven uit.
2. **Manager en HR-verwerker ontbreken in de switcher.** Zonder bestaande geautoriseerde persona's kan dezelfde aanvraag niet volgens de gevraagde route worden afgehandeld. De huidige beheercontext is niet als HR-queueactor bewezen.
3. **Catalogus toont een dubbele bestaande starter.** Verklaar of herstel de dubbele optie lokaal en verifieer dat de servercatalogus geen niet-startbare/onjuiste procesvariant toont vóór een Opleidingsaanvraag-publicatie.
4. **Migratieversie wijkt af.** De remote versie 20261021182957 moet worden vergeleken met het repository-migratiecontract; niet handmatig herschrijven en migratie 1 niet opnieuw toepassen.
5. **Migratie 2 blijft unapplied.** Voer haar pas uit na een groene hercontrole van projectidentiteit, migratiehistorie, versievolgorde en beveiligingsreadback.
6. **Visueel bewijs ontbreekt.** Na GO: herhaal het ene geautoriseerde synthetische scenario, maak de 35 gecatalogiseerde captures op 1440×900 en 390×844, controleer de review-index en laat de producteigenaar screenshots beoordelen.

Er is geen automatische rollback gedaan. Een eventuele herstel-/reconciliatiemigratie valt buiten deze run en is niet uitgevoerd.

## Eindoordeel

**SCHEMA+SECURITY: HOLD. BROWSER FUNCTIONEEL: HOLD. VISUELE UX: OPEN. PMUX-04 volledige acceptatie: NIET GESLAAGD / NIET VOLLEDIG UITGEVOERD.**

Wel bewezen: juiste TEST-projectref bevestigd; alleen migratie 1 toegepast; interne helper heeft volgens ACL-readback geen client EXECUTE; huidige Employee-view kan de bestaande catalogus laden; lokale browserroute/i18n-codefouten zijn gericht hersteld en lokaal getest.

Niet bewezen: volledige JWT/RLS-/scope-isolatie via echte RPC-tests, migratie 2, publicatie/readback van Opleidingsaanvraag, enige aanvraaglifecycle, Manager/HR-actorgrenzen, duplicate/stale API-acties, dashboard/historiepariteit of desktop/mobiele UX. Definitieve screenshot- en producteigenaaracceptatie blijven OPEN.

## PMUX-04R — herstelrun (21-10-2026, additief)

Deze addendum vult de eerste TEST-run aan en vervangt de oorspronkelijke bevindingen niet. Branch `work/BRANCH-SPLIT-PMUX-20261021`; begin-HEAD `38aaf8f4f22968fc6192b710bec9b74f10bc33ae`. Lokale codefix: `3c1f8c97561060754f2218faff8fc89c359fe927` (`fix(pmux): deduplicate native process starters`). Er is in PMUX-04R geen remote migratie, migratiehistorie, procesdefinitie, procesinstantie, rol of businessdata gewijzigd.

### Catalogusmigratie-reconciliatie

- Read-only migratiehistorie van project `wnpfloqpjvaacobppbpk` bevat `20261021182957 / pmux03a_ess_process_start_catalog`. De lokale bron blijft `20261021143000_pmux03a_ess_process_start_catalog.sql`; PMUX-03B `20261021160000_pmux03b_process_work_experience.sql` ontbreekt remote.
- `pg_get_functiondef`-readback van beide remote catalogusfuncties komt inhoudelijk overeen met de lokale definitieve SQL: de helper bindt de actor via `auth.uid()` en `current_employee_id`, leest alleen de nieuwste versie van een `PUBLISHED` definitie, en controleert startrecht en actieve administratie-/dienstverbandsscope. De publieke wrapper weigert een ontbrekende `auth.uid()`.
- Remote eigenschappen/grants: helper `SECURITY INVOKER`, lege `search_path`, schema `internal_security` geeft `authenticated` wel `USAGE` maar de helper zelf geen `EXECUTE`; `has_function_privilege` is `false` voor `authenticated` en `anon`; expliciete helper-EXECUTE is alleen voor `postgres`. De publieke wrapper is `SECURITY DEFINER`, lege `search_path`, `EXECUTE` voor `authenticated`, niet voor `anon`. De helper kan dus niet rechtstreeks vanuit een normale authenticated/anon RPC worden uitgevoerd volgens huidige grants.
- De Employee-context heeft in de eerste run via de echte app een bestaande gepubliceerde cataloguskaart ontvangen. Dit bewijst de positieve wrapperroute voor die ene bestaande kaart; het bewijst niet de volledige scope-/startmatrix. Directe helper-, anon-, vervalste scope-, verkeerde tenant-/HR-groep-, unpublished- en directe startservice-proeven met echte JWT-sessies zijn in PMUX-04R niet uitgevoerd. PGlite en grant-readback zijn geen vervanging voor die proeven. **Catalogus-security blijft HOLD.**
- De timestamp is het migratie-ID, geen inhoudelijke checksum. De migratietool ziet `20261021143000` en remote `20261021182957` als verschillende versies; een toekomstige migratielijst zal een lokale/remote afwijking tonen en een gewone `db push` kan het lokale bestand als nog niet toegepast aanbieden. Niet opnieuw toepassen en niet vertrouwen op `CREATE OR REPLACE` als reconciliatie.
- Minimale voorgestelde reconciliatie, nog NIET uitgevoerd: na nieuwe expliciete toestemming en verse project-/functie-readback de Supabase CLI gebruiken in deze volgorde: `supabase migration repair 20261021182957 --status reverted` verwijdert de oude remote trackingrij; `supabase migration repair 20261021143000 --status applied` voegt de versie van het lokale bronbestand toe. Dit voert geen migratie-SQL uit, maar wijzigt wel remote migratiehistorie en vereist daarom afzonderlijke toestemming. Daarna read-only `supabase migration list` en functie-/grant-readback doen. Geen handmatige directe SQL voor `supabase_migrations.schema_migrations`.
- Supabase beschrijft dat migratievolgorde met versies wordt bijgehouden en dat `db push` lokale niet-geregistreerde migraties toepast; `migration repair` wijzigt de trackingstatus zonder SQL uit te voeren: [migration list](https://supabase.com/docs/reference/cli/supabase-migration-list), [database migrations](https://supabase.com/docs/guides/deployment/database-migrations).

### Role switcher en actorgrenzen

- De route `/local/personas` gebruikt de server-side geverifieerde owner-identiteit en filtert targets op `getLocalPersonaOperatorTargetKeys`; `/api/auth/test-role-switch` herhaalt die controle. De standaardtargets `hr-admin`, `manager` en `employee` zijn in code aanwezig. Alleen de geverifieerde Edwin-owner krijgt deze standaardtargets; HR Admin krijgt uitdrukkelijk alleen de beperkte Payroll-targets. Een omgewisselde Employee-context krijgt uitsluitend de actie om naar het startaccount terug te keren. Dit is een bedoelde server-allowlist, geen te repareren clientfilter.
- De actuele Codex-browser toont op `/local/personas` uitsluitend “Terug naar het startaccount” voor de huidige Employee-context. Ik heb dit niet aangeklikt: de browser deelt de hostcookie tussen poort 3011 en de beschermde Payroll-runtime op 3010. De switch terug naar owner zou de gedeelde sessie wijzigen. De rolkeuzelijst van de owner is daarom niet opnieuw getoond.
- Eerdere read-only TEST-identiteitsreadback bevestigde bestaande Employee-, Manager- en HR Admin-identiteiten met actieve employee-links; er is geen aparte HR-verwerkerpersona in de switcher. HR Admin en Manager hebben bestaande `process-task:act`-roltoekenning, maar toegang tot de uiteindelijke HR-werktaak is zonder instantie/taak niet bewezen. Geen rechten of persona's aangepast.
- De lokale switcher- en pagina-tests bevestigen de owner-filter, loopback/development/projectbegrenzing en server-side targetcontrole. De testomgeving startte op poort 3011; daarmee is alleen bevestigd dat de launcher de huidige ontwikkel-/projectconfig accepteert, niet dat de owner-persona in de browser actief is.

### Dubbele starter en browsercontrole

- Oorzaak: een bestaande gepubliceerde definitie met een `internal-transfer-*`-sleutel werd niet gematcht door de exacte native sleuteluitsluiting. De Employee-RLS-filteropties bevatten de definitie-ID niet, zodat alleen de titel van de cataloguskaart als native fallback kon dienen.
- Commit `3c1f8c97561060754f2218faff8fc89c359fe927` filtert native transfer-, documentkennisname- en verlofdefinities uit de generieke aanvraagcatalogus via beschikbare definitiekeys en, wanneer die door RLS ontbreken, exacte gelokaliseerde native titels. De bestaande typed start-URLs en servergestuurde zichtbaarheid blijven ongewijzigd. Als in de toekomst een zelfstandig proces exact dezelfde native titel moet gebruiken, vraagt dat een onderscheidende servercatalogusidentificatie; de titel-fallback kan zo'n gelijknamig generiek proces verbergen.
- Echte browser op `127.0.0.1:3011`, `/work?view=REQUESTS&tab=ALL`: 0 werkitems; `Verlof aanvragen` en `Interne overplaatsing starten` staan elk één keer; geen dubbele generieke kaart; de melding zegt dat er geen extra processen zijn. Documentkennisname was voor deze Employee-context niet zichtbaar. Er is nergens op gestart.
- Bij de eerste gerichte browserverificatie na de codefix is een desktopcapture getoond; een aparte 390×844-capture van dezelfde aanvraagpagina is in deze herstelrun via de Codex-browser bekeken. De persona-route is ook als desktopcapture getoond. Deze diagnostische captures bestaan alleen inline in de Codex-conversatie/tooloutput en zijn niet naar bestanden geëxporteerd; er is dus geen lokale screenshot-bestandslocatie. Geen van de 35 acceptatiescreenshots is hiermee afgevinkt.
- De bestaande test bevestigt dat de drie native links elk één keer blijven staan wanneer hun bestaande autorisatieflags waar zijn. In de echte Employee-browser waren alleen de twee voor die actor toegestane starters zichtbaar; live beschikbaarheid van Documentkennisname is daarmee niet bewezen. De HR Admin Processtudio is niet opnieuw geopend in de huidige Employee-context.

### Gates na herstel

- Gerichte tests: 4 bestanden, 27 tests geslaagd, waaronder de catalogusmigratie-contract/PGlite-test en switcher-/pagina-/cataloguscomponenttests.
- TypeScript (`npm run type-check`), gewijzigde-bestanden-ESLint, i18n (`43 namespaces`, NL/EN gelijk) en `git diff --check`: geslaagd.
- Browserconsole op de aanvraagpagina: geen errors. Desktop- en mobiele weergave zijn alleen diagnostisch gecontroleerd; de 35 geplande acceptancebeelden blijven `NOT CAPTURED`.
- De tijdelijke runtime op 3011 is gestopt; automatisch gewijzigde `apps/hr-suite/next-env.d.ts` is teruggezet. Poort 3010 bleef luisteren op PID 32332; niet aangeraakt.

**Eindoordeel PMUX-04R: lokaal herstel en native-catalogus-UX GO; catalogus-security HOLD; role-switch/browser-persona gate HOLD; volledige PMUX-04-herstart NIET GEREED.** Voor hervatting is eerst expliciete toestemming nodig voor de twee migratiehistorie-metadatawijzigingen hierboven, daarna een geverifieerde owner-session in een browsercontext die Payroll 3010 niet deelt, gevolgd door echte authenticated/anon/helper/scope-proeven. Pas bij groene securitygate kan de eerder geautoriseerde acceptatieflow worden hervat. Migratie 2, studio-configuratie, publiceren, aanvraagstart, E2E, en de 35 screenshots blijven onuitgevoerd.
