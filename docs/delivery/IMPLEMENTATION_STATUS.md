# Implementatiestatus Liquid HR

Laatste controle: 2026-07-18.

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

| Tijdhub en reminders | GEDEELTELIJK | Klokvoorkeuren, Tijdhub, persoonlijke en HR-reminders, RLS, API-routes en live browserflow zijn aanwezig. De afzonderlijke databaseproef en regressietest moeten nog worden herhaald; de klok voorkomt SSR-hydrationverschillen en de sidebar blijft op viewporthoogte staan. |
| Persoonlijke Liquid Dashboard | GEDEELTELIJK | Persoonlijke dashboards, opgeslagen widgetindeling, veilige CRUD/API, startpagina en vier beperkte widgets zijn gebouwd. De volledige vrije Liquid Display-query-engine, charts en generatieve widgets blijven een afzonderlijke volgende slice. Schema-/RLS-proef wacht op gekoppelde Supabase CLI. |
| HeRa AI-agent | GEÏMPLEMENTEERD | Data-first orchestratie, echte rol/permissioncontext, owner- en tenantgebonden memory/voorkeuren, beheer-UI, toon/detail/senioriteit, salaris-/medewerker-/dienstverband-/organisatietools en vijf bevestigbare schrijftools zijn gebouwd. RLS en serverautorisatie zijn live transactioneel negatief getest; lokale, preview- en Production-eindtests zijn geslaagd. |

## Core HR, organisatie en autorisatie

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Employee-persoonskaart | GEÏMPLEMENTEERD | Lijst met archiveerfilter, wizard, detail met hoofdtabbladen, mutaties, adresgeschiedenis, relaties, gemaskeerde bankrekening, foto-beheer en capabilities zijn aanwezig |
| Dubbele-medewerkercontrole | GEÏMPLEMENTEERD | Tenantgebonden BSN-HMAC of gewogen persoonsgegevens, expliciet besluit en auditlog; exact BSN-matchen vereist `BSN_HASH_KEY` |
| Afdelingenboom | GEÏMPLEMENTEERD | Beheer staat onder de HR-admin instellingen/stamgegevens; lezen, aanmaken, wijzigen/archiveren, RLS en database-cyclusbeveiliging werken |
| Managementrollen | GEÏMPLEMENTEERD | Tenantrollen zijn beheerbaar; globale systeemrollen zijn database-breed onveranderlijk |
| DepartmentManagement | GEÏMPLEMENTEERD | Effective-dated API/UI, overlapbeveiliging, RLS en audit aanwezig |
| EmployeeOrganization | GEÏMPLEMENTEERD | Tijdsgebonden plaatsingen zijn aan parallelle dienstverbanden te koppelen en beheerbaar |
| Permissionmatrix | GEÏMPLEMENTEERD | Zoekbare rollenwerkruimte, gegroepeerde functiepunten, dirty/herstel-flow, grafische dekkingsheatmap, tenantrollen, API, RLS en audit aanwezig |
| Vrije velden (Employee) | GEÏMPLEMENTEERD | Definities, opties, audience-toegang, atomaire nummering, waarden-API/UI en JSONB-spiegeling |
| BSN-beveiliging | GEÏMPLEMENTEERD | Afzonderlijke RLS-tabel; HR-admin en medewerker-self mogen lezen, managers niet; reveal wordt geaudit |
| Autorisatiehelper en managementscope | GEÏMPLEMENTEERD | Selfrechten, actieve rollen, afdelingsscope en RLS zijn getest |
| Managerresolver | GEÏMPLEMENTEERD | Override, deputy en parent-escalatie zijn getest |

## Multitenancy en administraties

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Absolute tenantgrens | GEÏMPLEMENTEERD | Expliciete toegang, samengestelde tenant-FK's, RLS en negatieve isolatietests zijn live |
| Hiërarchische administraties | GEÏMPLEMENTEERD | Parentconstraint, tenantgelijkheid, cyclusbeveiliging en drie demo-administraties zijn live |
| Administratiecontext en switcher | GEÏMPLEMENTEERD | Resolver, context-API, HTTP-only cookie en responsive switcher; PostgreSQL-UUID-notatie wordt correct geaccepteerd en gecontroleerd tegen de toegestane administratieopties |
| Stamtabellenscope | GEÏMPLEMENTEERD | Afdelingen, functies, functiegroepen, loonschalen/revisies, kostenplaatsen en uitdienstredenen zijn tenant-/administratiegebonden |
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
| Medewerker- en dienstverband-UI | GEDEELTELIJK | Medewerkerkaart heeft duidelijke tabs voor persoonsgegevens, dossier en dienstverbanden; employments worden als effectieve tijdlijn getoond. Eigen dienstverbanddetailroute met acht tabs, foto, compacte/uitgebreide modus, profielkoppelingen, AI-samenvattingsslot, follow-ups en logboek bestaat. Basis/IKV en organisatieplaatsing zijn nog alleen leesbaar op deze route; aanmaak van een volledig nieuwe persoonskaart na 'geen match' volgt. |
| Ketenadvies nieuwe contracten | GEÏMPLEMENTEERD | Datumgebonden 2020/2028-regels, bekende interne/externe historie, niet-blokkerende waarschuwing en verplichte motivering bij risico of onvolledige historie. |
| Volledige dienstverbandpublicatie | GEÏMPLEMENTEERD | Vijfstappenwizard publiceert Employment, IKV-koppeling, plaatsing, arbeidsvoorwaarden, rooster, optioneel salaris en exact 100% kostenverdeling in één transactie. |
| Functie- en salarisschaalbeheer | GEÏMPLEMENTEERD | Administratiegebonden functiegroepen, functies en effective-dated revisies; schalen hebben een vrij aantal treden en gepubliceerde revisies zijn onveranderlijk. |
| Tijdkaart medewerker | GEÏMPLEMENTEERD | De dienstverbandhistorie toont alle tijdvakken responsief op één tijdas, met veilige salarisprojectie. |
| HR-maandkalender | GEÏMPLEMENTEERD | Groot adaptief desktop/tabletraster met actieve medewerkers, foto's, rooster/niet-werkdagen, feestdagen, reminders, HR-wijzigingen, zoekfilters en 10/25/alle-max-100 paginering op `/hr-calendar`; dagkolommen zijn uitbreidbaar voor acties. |

## Documentdossiers

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Medewerkersdossier | GEÏMPLEMENTEERD | Private opslag, metadata, tags, signed downloads, soft-delete/herstel en auditbare toevoeger/verwijderaar. |
| Documentzichtbaarheid | GEÏMPLEMENTEERD | Permission én doelgroep; medewerker, rol en afdelingstak zijn combineerbaar en server-side/RLS afgedwongen. |
| Vervaldatum en reminders | GEÏMPLEMENTEERD | Persoon, rol en organogramdoelgroepen worden gecombineerd en naar gededupliceerde ontvangers gepubliceerd. |
| Globale documenten en AI-compliance | NIET GESTART | Bulk-loonstroken, globaal beleid, OCR/RAG en compliance-audits blijven een afzonderlijke slice. |

## Instellingen en tenantmodules

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Persoonlijke instellingen | GEÏMPLEMENTEERD | Afzonderlijke pagina voor taal, thema, Tijdhubklok, datumformaat (DMY/MDY/YMD) en tijdformaat (24H/12H) voor iedere ingelogde gebruiker; voorkeuren worden centraal toegepast op relevante datum- en tijdweergaven. Gedeelde knoppen gebruiken een iOS-geïnspireerde glasstijl; medewerker-tabs verbergen de native scrollbar met behoud van horizontale bediening. |
| HR-admininstellingenhub | GEÏMPLEMENTEERD | Eén permission-gestuurde hub; directe beheeritems zijn uit het hoofdmenu verwijderd. |
| Actieve extra modules | GEÏMPLEMENTEERD | HeRa, documenten en reminders tenantbreed schakelbaar; serverguards en restrictieve RLS bewaren data maar blokkeren gebruik. |
| Feestdagen | GEÏMPLEMENTEERD | Nager.Date-preview/import per administratie, jaar en land, lokale feestdagen, uitsluiten en snapshot-herimport. |

## Security en handmatige productieconfiguratie

## Vervolgslice medewerker, dienstverband en HeRa

- HeRa staat niet meer in de linker navigatie. De zwevende knop links onder opent een overlay; docken naar rechts en de breedte zijn gebruikersvoorkeuren die lokaal worden bewaard.
- De medewerkerkaart heeft een reminders-tab. Dienstverbanden openen als primaire knop, verwijderen is een bevestigde soft-delete en de teruglink bewaart de medewerker-brontab.
- Interne uitdienstredenen zijn beheerbaar onder `/master-data/end-reasons` met actief/inactief en een blokkade wanneer de reden al is gebruikt. Andere bestaande stamtabellen blijven afzonderlijke beheerschermen.

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

- Samengevoegde releasegate 2026-07-18: 79 Vitest-bestanden en 286 tests geslaagd; 18 gelijke NL/EN-namespaces, ESLint zonder waarschuwingen, strict TypeScript en de Next.js-productiebuild met 53 routes zijn groen.
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
