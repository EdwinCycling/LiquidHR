# Implementatiestatus Liquid HR

Laatste controle: 2026-07-16.

## Fundering

| Onderdeel | Status | Bewijs / resterend werk |
|---|---|---|
| npm-workspace en Next.js-app | GEÏMPLEMENTEERD | `apps/hr-suite` draait verplicht op poort 3000 |
| Supabase SSR-clients | GEÏMPLEMENTEERD | Browser-, server- en strikt server-only adminclient aanwezig |
| Wachtwoordauthenticatie | GEÏMPLEMENTEERD | E-mail/wachtwoord, Google OAuth-start, herstelactie, callback en sign-out aanwezig; app blijft invitation-only |
| Uitnodigingsmodel | GEDEELTELIJK | Tenant-/administratiescope, privé-/businessmail en acceptatie zijn gebouwd; echte mailverzending vereist nog `SUPABASE_SECRET_KEY` en eigen SMTP |
| i18n | GEÏMPLEMENTEERD | Nederlands is standaard, Engels heeft verplichte pariteit; iedere namespace heeft een afzonderlijk JSON-bestand per taal |
| Persoonlijke thema's | GEÏMPLEMENTEERD | Zes thema's, instellingenmodal, DB-first voorkeuren en cookie/default-fallback |
| Gedeelde databasetypes | GEÏMPLEMENTEERD | `packages/db/types.ts`; opnieuw genereren na iedere migratie |
| Documentatierouting | GEÏMPLEMENTEERD | Root `AGENTS.md`, architectuurindex, deze status en verplichte `CURRENT_CONTEXT.md`-overdracht voor nieuwe/fork-chats |

| Tijdhub en reminders | GEDEELTELIJK | Klokvoorkeuren, Tijdhub, persoonlijke en HR-reminders, RLS, API-routes en live browserflow zijn aanwezig. De afzonderlijke databaseproef en regressietest moeten nog worden herhaald; de klok voorkomt SSR-hydrationverschillen en de sidebar blijft op viewporthoogte staan. |
| Persoonlijke Liquid Dashboard | GEDEELTELIJK | Persoonlijke dashboards, opgeslagen widgetindeling, veilige CRUD/API, startpagina en vier beperkte widgets zijn gebouwd. De volledige vrije Liquid Display-query-engine, charts en generatieve widgets blijven een afzonderlijke volgende slice. Schema-/RLS-proef wacht op gekoppelde Supabase CLI. |
| HeRa AI-agent | GEDEELTELIJK | Leidend requirementdocument, persoonlijke conversation-/memory-/draftschema's met RLS, Gemini-adapter, veilige leestools, reminderconceptbevestiging, export, API en navigatie zijn aanwezig. De lege-starttransitie en een echte lokale Gemini-vraag zijn browser-gevalideerd; productieprivacyconfiguratie en publieke eindtest blijven open. |

## Core HR, organisatie en autorisatie

| Onderdeel | Status | Resterend werk |
|---|---|---|
| Employee-persoonskaart | GEÏMPLEMENTEERD | Lijst, wizard, detail, mutaties, adresgeschiedenis, relaties, gemaskeerde bankrekening en capabilities zijn aanwezig |
| Dubbele-medewerkercontrole | GEÏMPLEMENTEERD | Tenantgebonden BSN-HMAC of gewogen persoonsgegevens, expliciet besluit en auditlog; exact BSN-matchen vereist `BSN_HASH_KEY` |
| Afdelingenboom | GEÏMPLEMENTEERD | Lezen, aanmaken, wijzigen/archiveren, RLS en database-cyclusbeveiliging werken |
| Managementrollen | GEÏMPLEMENTEERD | Tenantrollen zijn beheerbaar; globale systeemrollen zijn database-breed onveranderlijk |
| DepartmentManagement | GEÏMPLEMENTEERD | Effective-dated API/UI, overlapbeveiliging, RLS en audit aanwezig |
| EmployeeOrganization | GEÏMPLEMENTEERD | Tijdsgebonden plaatsingen zijn aan parallelle dienstverbanden te koppelen en beheerbaar |
| Permissionmatrix | GEÏMPLEMENTEERD | Functiepuntenmatrix, tenantrollen, API/UI, RLS en audit aanwezig |
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
| Stamtabellenscope | GEDEELTELIJK | Afdelingen, loonschalen, kostenplaatsen en uitdienstredenen zijn tenant-/administratiegebonden; nieuwe stamtabellen moeten hetzelfde patroon volgen |
| Onomkeerbaar combineren | GEÏMPLEMENTEERD | Alleen `SEPARATE → COMBINED`; database blokkeert terugkeer |
| Demo-omgevingen | GEÏMPLEMENTEERD | Hoofdtenant: 3 administraties/50 medewerkers; tweede tenant: 1 administratie/10 medewerkers |

## Dienstverband, IKV en tijdlijnen

| Onderdeel | Status | Resterend werk |
|---|---|---|
| 0..n dienstverbanden per medewerker | GEÏMPLEMENTEERD | Geen dienstverband, toekomstig, actief, voormalig, herintreding en parallel zijn gemodelleerd |
| Parallel binnen één administratie | GEÏMPLEMENTEERD | Meerdere gelijktijdige dienstverbanden zijn toegestaan en als demo aanwezig |
| IKV los van dienstverband | GEÏMPLEMENTEERD | `income_relationships` plus tijdsgebonden koppeltabel; één IKV kan gecontroleerd aan dienstverbanden worden gekoppeld |
| Arbeidsvoorwaarden, rooster, salaris en kostenverdeling | GEDEELTELIJK | Atomaire apply/rollback-RPC's, TWK-splitsing, 100%-kostenverdeling, audit, bevestigingspopup en mutatieformulieren zijn aanwezig. Eén multi-domein-RPC voor direct gecombineerde wijzigingen volgt nog. |
| Uitdienstmelding | GEÏMPLEMENTEERD | Workflow met wettelijke reden, datum en bevestiging; beëindiging wordt pas definitief via de confirm-RPC |
| Herintreding | GEÏMPLEMENTEERD | Bestaande Employee wordt hergebruikt en krijgt een nieuw Employment; identity-match voorkomt stil dupliceren |
| Medewerker- en dienstverband-UI | GEDEELTELIJK | Eigen dienstverbanddetailroute met acht tabs, foto, compacte/uitgebreide modus, profielkoppelingen, AI-samenvattingsslot, follow-ups en logboek bestaat. Basis/IKV en organisatieplaatsing zijn nog alleen leesbaar op deze route; aanmaak van een volledig nieuwe persoonskaart na 'geen match' volgt. |
| Ketenadvies nieuwe contracten | GEÏMPLEMENTEERD | Datumgebonden 2020/2028-regels, bekende interne/externe historie, niet-blokkerende waarschuwing en verplichte motivering bij risico of onvolledige historie. |

## Security en handmatige productieconfiguratie

- Tijdhub/reminders: de drie migraties `20260716081000_add_time_hub_reminders.sql`, `20260716090000_fix_reminder_recipient_rls_recursion.sql` en `20260716092000_fix_reminder_publish_auth_lookup.sql` zijn live toegepast. Een RLS-recursie in de recipient-selectie en een niet-toegestane `auth.users`-lookup in publicatie zijn daarmee hersteld.
- Alle nieuwe publieke tabellen hebben RLS en policies in dezelfde migratie. Tenant- en administratiescope wordt zowel in de servicelaag als database-side afgedwongen.
- RLS-policyhelpers voor medewerkerssubresources en vrije veldwaarden hebben expliciete `EXECUTE`-rechten voor `authenticated`; dit is live hersteld in migratie `20260715173629_restore_employee_subresource_grants.sql` en met een regressiecontrole afgedekt.
- Supabase security advisor meldt alleen dat leaked-password protection nog uitstaat. Dit moet handmatig worden ingeschakeld onder **Authentication → Providers/Password → Leaked password protection**.
- `npm audit --omit=dev` meldt 2 moderate PostCSS-meldingen via `next@16.2.10`. De aangeboden `--force`-route installeert Next 9 en wordt daarom niet toegepast; opnieuw beoordelen zodra Next.js een compatibele gepatchte dependency levert.
- Voor echte uitnodigingsmails: stel `SUPABASE_SECRET_KEY` server-only in en configureer eigen SMTP in Supabase. Publiceer deze sleutel nooit als `NEXT_PUBLIC_*`.
- Voor exacte BSN-deduplicatie: `BSN_HASH_KEY` en `EMPLOYEE_PII_ENCRYPTION_KEY` zijn lokaal server-only gegenereerd. Stel in iedere publieke omgeving eigen stabiele waarden in en roteer alleen via een gecontroleerde datamigratie.
- Voor Google-login: activeer Google in Supabase en voeg de callback `https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1/callback` toe bij Google. Voeg daarna localhost en iedere publieke app-URL aan Supabase' redirect-allowlist toe.
- Edwin kan pas met wachtwoord inloggen nadat voor `edwin@editsolutions.nl` een wachtwoord is gezet via een uitnodiging of de herstelactie. Een sessie is per browser/profiel; een andere browser moet afzonderlijk inloggen.

## Verificatiebewijs

- Tijdhub/reminders zijn lokaal op poort 3000 in een ingelogde browsersessie geverifieerd: persoonlijke reminder aanmaken/afronden, HR-reminder voor iedereen publiceren, sidebar-badge en countdown, en annuleren. De weergave is ook op 390px gecontroleerd zonder horizontale overflow.
- De eerder gemelde `POST /api/context/administration 400` is lokaal gereproduceerd en opgelost; de wissel naar de Operations-administratie gaf daarna `200` en de UI selecteerde de nieuwe context.
- De detailpagina van Edwin Testbeheerder is na de RLS-herstelmigratie lokaal op poort 3000 succesvol geladen; adres-, relatie- en vrije-veldqueries geven geen 403 meer.
- Vitest: 46 testbestanden, 182 tests geslaagd.
- HeRa is lokaal browsermatig getest met een lege gesprekslijst, een nieuw gesprek en de vraag `Welke reminders heb ik?`; de API gaf `200`, HeRa antwoordde en het testgesprek is verwijderd.
- ESLint zonder waarschuwingen, strict TypeScript, 11 NL/EN-namespaces en Next.js-productiebuild (26 pagina's) geslaagd.
- Lokale productiebuild luistert op `http://localhost:3000` en blijft actief; login is desktop en op 390px zonder consolefouten gecontroleerd.
- Login, herstel, uitnodiging en beschermde redirects zijn op desktop en 390px mobiel zonder consolefouten gecontroleerd.
- Alle 13 database-integratie- en isolatietests voor tenant, administratie, voorkeuren, identity matching, beveiligde BSN-opslag, vrije velden, autorisatie, dienstverbanden, tijdlijnen, uitdienstmelding en demodata zijn live tegen Supabase geslaagd.
- Supabase bevat exact 50 demo-medewerkers in de hoofdtenant en 10 in de tweede tenant, inclusief representatieve dienstverbandscenario's.
- Tijdelijke publieke preview tijdens ontwikkeling: `https://unmerited-diuretically-angeline.ngrok-free.dev`. De actuele loginpagina is na **Visit Site** bereikbaar. Deze URL verandert wanneer de tunnel opnieuw wordt gestart; voor OAuth/herstel moet hij expliciet in Supabase worden toegestaan.
- Demo-inrichting: 12 vrije-velddefinities, 183 administration-scoped waarden, 6 tenantrollen en 4 HR-rolhouders verdeeld over beide testtenants.
- Definitieve Vercel/OpenAI-hosting wacht op de afgesproken Git-publicatiestap en op de twee server-only secrets hierboven. `vercel.json` is voorbereid.
