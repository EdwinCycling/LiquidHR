# Actuele overdracht Liquid HR

Laatste update: 2026-07-16. Dit document is het compacte startpunt voor iedere nieuwe of geforkte AI-chat. Lees daarna de relevante bronnen via `docs/README.md`. Neem geen secrets op in dit bestand.

## Doel en vaste keuzes

Liquid HR is een Nederlandstalig, i18n-klaar HR- en payrollplatform op Next.js, Supabase en strict TypeScript. De vaste bouwvolgorde is `schema → API → UI`. Tenantgrenzen zijn absoluut; een tenant kan meerdere hiërarchische administraties bevatten. Autorisatie wordt server-side én met RLS afgedwongen. Nederlands is standaard, Engels heeft sleutelpariteit.

## Huidige stand

- Monorepo, Supabase SSR, wachtwoordauthenticatie, thema's en NL/EN-i18n werken.
- Medewerkers, beveiligde BSN-opslag, adressen, banken, relaties en vrije velden zijn geïmplementeerd.
- Afdelingen, rollen, permissions, rolhouders en tijdsgebonden plaatsingen zijn geïmplementeerd.
- Multitenancy, administratiecontext/switcher en negatieve isolatietests werken.
- Dienstverbanddetail heeft een eigen moderne route met acht tabs, foto, compact/uitgebreid, profielkoppelingen, AI-slot, toekomstige modules, follow-ups en auditlog.
- Arbeidsvoorwaarden, rooster, salaris en kostenverdeling hebben veilige tijdlijnmutaties met TWK-popup, behoud van toekomstige blokken, 100%-controle en laatste-blokrollback.
- Nieuwe contracten krijgen datumgebonden, niet-blokkerend ketenadvies voor het huidige en vanaf 2028 aangekondigde regime.
- Demo-inrichting bevat 50 medewerkers in de hoofdtenant en 10 in een tweede tenant.
- GitHub is lokaal geïnitialiseerd en de huidige werkstand staat op `https://github.com/EdwinCycling/LiquidHR.git`, branch `main`, commit `81bde2c`.
- Tijdhub/reminders is als eerste slice live in Supabase: klokvoorkeuren, persoonlijke en HR-reminders, RLS, API-routes, Tijdhub, instellingen en NL/EN zijn gebouwd. De drie reminder-migraties zijn live toegepast; een RLS-recursie en een ongeldige `auth.users`-lookup in publicatie zijn hersteld.
- Handmatige externe acties staan centraal in `docs/delivery/HANDMATIGE_ACTIES.md`. Het centrale applicatieversienummer staat in `apps/hr-suite/lib/app-version.ts` en is nu `1.20260716.2`.
- Organogram is gebouwd als beveiligde, read-only verkenner zonder drag-and-drop. HeRa heeft een leidende requirement, RLS-migratie, Gemini-adapter, veilige persoonlijke reminderconcepten, API-laag en navigatie; de UI-slice en live databaseverificatie lopen nog.
- Tijdhub: iedere zichtbare sidebar-reminder opent een toegankelijke Liquid-detailkaart met type, tijd, acties en een link naar Reminderbeheer. De OrgChart-link staat voorlopig plat en altijd zichtbaar in de linkerbalk; de route houdt zijn server-side autorisatie.
- Persoonlijke Liquid Dashboard is gebouwd als startpagina: meerdere eigen dashboards, naam/dupliceren/verwijderen/wisselen, expliciet opslaan van toegankelijke widgetvolgorde en vier gesloten widgets. Vrije Liquid Display-query's en generatieve widgets zijn bewust nog niet aanwezig.

De gedetailleerde waarheid en resterende onderdelen staan in `docs/delivery/IMPLEMENTATION_STATUS.md`.

## Laatst geverifieerd

- Herstelmigratie `20260715173629_restore_employee_subresource_grants.sql` is live: Data API-rechten en benodigde `EXECUTE`-rechten voor RLS-helpers van adressen, relaties en vrije veldwaarden zijn hersteld. De medewerkersdetailpagina van Edwin Testbeheerder laadt weer volledig op localhost:3000.
- Vitest: 26 bestanden en 121 tests geslaagd.
- ESLint, strict TypeScript, i18n-pariteit en productiebuild geslaagd.
- Dertien live Supabase database-/isolatietests geslaagd.
- De nieuwe transactionele databaseproef voor TWK, rollback en kostenverdeling is aanvullend geslaagd.
- Tijdhub/reminders: persoonlijke reminder aanmaken/afronden, HR-publicatie voor iedereen, sidebar-badge/countdown en annuleren zijn in een ingelogde browser op localhost:3000 geslaagd. De 390px-weergave heeft geen horizontale overflow.
- Productiebuild draait lokaal op `http://localhost:3000`; de loginpagina laadt desktop en op 390px zonder consolefouten. De publieke ngrok-preview is na de eenmalige waarschuwing bereikbaar. De beschermde detailroute kon zonder geldige browsersessie niet visueel end-to-end worden geopend.
- De laatst gebruikte ngrok-URL was `https://unmerited-diuretically-angeline.ngrok-free.dev`; dit is tijdelijk en moet bij hervatten opnieuw worden gecontroleerd.
- Supabase-plugin is verbonden met project `wnpfloqpjvaacobppbpk` (`LiquidHR`, `ACTIVE_HEALTHY`). De app-runtime en pluginverbinding werken; een lokale CLI-login is hiervoor niet vereist.
- Vercel-plugin is verbonden met project `liquid-hr-hr-suite`. De eerste productiebuild compileerde volledig maar faalde door een dubbel outputpad; `vercel.json` gebruikt nu `.next` passend bij Vercels Root Directory `apps/hr-suite`.

Gebruik vanuit de repositoryroot de scripts uit `package.json`. Start lokale validatie altijd geforceerd op poort 3000 en test relevante flows ook in een echte browser op mobiel formaat.

## Eerstvolgend open werk

0. Herhaal voor reminders de transactionele databaseproef; advisors en typegeneratie zijn via de Supabase-plugin beschikbaar.

0a. Voer `supabase/tests/hera_ai_agent.sql` uit. De HeRa-, gecombineerde dienstverband-, OrgChart- en dashboardmigraties zijn via de Supabase-plugin live toegepast. Configureer `GEMINI_KEY` en `GEMINI_MODEL` server-only in iedere deployomgeving; de vrije Gemini-tier is uitsluitend voor testdata.

1. Maak `direct meenemen` werkelijk één multi-domein, atomair wijzigingspakket; `later opvolgen` wordt al opgeslagen.
2. Voeg mutatieformulieren op de detailroute toe voor basis/IKV en organisatieplaatsing; deze tabs lezen nu wel alle tijdblokken.
3. Voeg vastlegging en beheer van externe ketenhistorie/cao-uitzonderingen toe; de engine en adviesstap zijn aanwezig.
4. Nieuwe persoonskaart kunnen aanmaken vanuit de dienstverbandflow wanneer identity matching geen bestaande medewerker vindt.
5. Echte uitnodigingsmail, permanente publieke deployment en daarna documenten/compliance, Liquid Display en de AI-agent.

## Actuele externe blokkades

- Supabase: geen verbindingsblokkade. Alleen leaked-password protection blijft een handmatige dashboardinstelling.
- Vercel: repository en plugin zijn gekoppeld. De gecorrigeerde `vercel.json` moet naar de production branch worden gepusht; daarna volgt automatisch een nieuwe deployment.

## Handmatige productieacties

- Activeer Supabase leaked-password protection.
- Configureer SMTP en de vereiste server-only secrets; publiceer die nooit als `NEXT_PUBLIC_*`.
- Configureer Google OAuth en voeg actuele publieke callback-/redirect-URL's toe.
- Gebruik per omgeving stabiele, geheime waarden voor BSN-hashing en PII-encryptie.

## Hervatprotocol

1. Lees `AGENTS.md`, `docs/README.md` en dit document.
2. Controleer `docs/delivery/IMPLEMENTATION_STATUS.md` en de relevante requirements.
3. Inspecteer de actuele wijzigingen; deze map had bij de laatste overdracht nog geen Git-repository.
4. Controleer of poort 3000 en een publieke preview werkelijk bereikbaar zijn.
5. Werk na uitvoering dit bestand en de implementatiestatus bij.
