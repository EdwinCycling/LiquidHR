# Authenticatie en uitnodigingen

Status: goedgekeurd ontwerp, gereed voor implementatieplanning  
Datum: 15 juli 2026

## 1. Doel

Liquid HR gebruikt een gesloten, tenantveilige onboarding met Google OAuth en e-mail/wachtwoord. Magic-link-authenticatie verdwijnt uit de gebruikersinterface. Alleen door Liquid HR of een bevoegde klantbeheerder uitgenodigde gebruikers krijgen toegang.

De authenticatiesessie bewijst uitsluitend wie de gebruiker is. Autorisatie blijft altijd afhankelijk van actieve `user_access`-records binnen de expliciet geselecteerde tenant en, waar van toepassing, administratie.

## 2. Vastgelegde productregels

- Liquid HR maakt de eerste `TENANT_ADMIN` voor een nieuwe klant aan.
- Een tenantbeheerder of HR-beheerder kan daarna andere gebruikers uitnodigen.
- Voor een toekomstige medewerker maakt HR eerst een gedeeltelijke Employee-persoonskaart aan. De uitnodiging mag naar het privé-e-mailadres gaan.
- Voor een gewone interne gebruiker zonder preboarding geldt uitsluitend het zakelijke e-mailadres.
- Een privé-loginadres kan later worden vervangen door een geverifieerd zakelijk loginadres op hetzelfde Supabase `auth.users.id`.
- Employee, rollen, historie en voorkeuren blijven bij een e-mailwijziging aan hetzelfde `auth_user_id` gekoppeld.
- Er is geen openbare registratie en er wordt geen toegang afgeleid uit alleen een e-maildomein.
- Een geldig Supabase-account zonder actieve `user_access` krijgt geen tenantdata te zien.

## 3. Authenticatie-ervaring

De loginpagina biedt:

1. aanmelden met Google;
2. aanmelden met e-mailadres en wachtwoord;
3. wachtwoord vergeten;
4. uitnodiging accepteren en, indien nodig, een wachtwoord instellen.

De applicatie toont registratie uitsluitend na validatie van een uitnodiging. Wanneer iemand buiten die flow rechtstreeks een Supabase-account weet aan te maken, levert dat account zonder `user_access` geen applicatietoegang op.

Na authenticatie bepaalt de server de toegankelijke tenants en administraties uit `user_access`. Bij nul toegangen verschijnt een neutrale pagina “Geen toegang tot Liquid HR”. Bij één context wordt deze direct gekozen. Bij meerdere contexten gebruikt de bestaande contextselector een expliciete tenant en administratie.

Er komt geen username-alias naast het e-mailadres. Het e-mailadres is de aanmeldnaam.

## 4. Uitnodigingsmodel

Er komt een RLS-beveiligde tabel `user_invitations` met minimaal:

- `id`, `tenant_id` en optioneel `administration_id`;
- optioneel `employee_id` voor preboarding;
- `management_role_id` en `scope_type` voor de eerste toegang;
- genormaliseerd doel-e-mailadres;
- `email_kind`: `PRIVATE` of `BUSINESS`;
- `purpose`: `PREBOARDING_EMPLOYEE` of `BUSINESS_USER`;
- alleen een cryptografische hash van het eenmalige acceptatietoken;
- status `PENDING`, `ACCEPTED`, `REVOKED` of `EXPIRED`;
- vervaldatum, uitnodiger, acceptatietijd en auditvelden.

Een uitnodiging is altijd aan precies één tenant gebonden. De database controleert dat administratie, Employee en managementrol binnen dezelfde tenant vallen. Een uitnodiging kan na acceptatie of intrekking nooit opnieuw worden gebruikt.

## 5. Atomaire acceptatie

Een beveiligde databasefunctie accepteert een uitnodiging in één transactie. Zij controleert:

- een bestaande geauthenticeerde gebruiker via `auth.uid()`;
- een constant-time vergelijking met de tokenhash;
- status en vervaldatum;
- overeenkomst tussen het geverifieerde Supabase-e-mailadres en het uitnodigingsadres;
- alle tenant- en administratiegrenzen;
- dat een gekoppelde Employee nog niet aan een andere `auth_user_id` is gekoppeld.

Daarna koppelt zij optioneel `employees.auth_user_id`, maakt zij het juiste `user_access`-record en markeert zij de uitnodiging als geaccepteerd. Bij iedere fout rolt de volledige transactie terug.

De huidige automatische koppeling op basis van alleen een overeenkomstig werk- of privé-e-mailadres wordt verwijderd. E-mailgelijkheid zonder geldige uitnodiging is onvoldoende bewijs voor een identiteitskoppeling.

## 6. E-mailtransitie

De overgang van privé- naar zakelijk loginadres gebruikt de beveiligde e-mailwijzigingsprocedure van Supabase Auth. Het nieuwe adres moet worden geverifieerd voordat het actief wordt. Omdat het `auth_user_id` gelijk blijft, hoeven Employee en `user_access` niet opnieuw te worden aangemaakt.

De applicatie registreert wie de wijziging startte, het type wijziging en de voltooiingsdatum. Het privé-e-mailadres blijft alleen als persoonlijk contactveld op Employee staan. Het wordt niet als alternatieve login gebruikt nadat de zakelijke overgang voltooid is.

Een Google-identiteit wordt alleen aan een bestaand account gekoppeld vanuit een reeds geauthenticeerde, gecontroleerde flow. Liquid HR voegt nooit twee Supabase-accounts automatisch samen op basis van alleen hetzelfde e-mailadres.

## 7. Autorisatie en RLS

- Alle nieuwe tabellen hebben RLS en policies in dezelfde migratie.
- Uitnodigingen zijn alleen leesbaar en beheerbaar met expliciete rechten, waaronder `user:read` en `user:invite`.
- Acceptatie verloopt uitsluitend via de beperkte databasefunctie; geen generieke client-write-policy.
- Iedere policy controleert tenanttoegang via bestaande `internal_security`-helpers.
- Een administration-scoped beheerder kan alleen uitnodigen binnen zijn administratie.
- Een tenant-scoped beheerder kan tenant- of administratiegebonden toegang uitgeven binnen dezelfde tenant.
- Service-role-gebruik blijft beperkt tot server-only code en wordt nooit naar de browser gebundeld.

## 8. Foutafhandeling

De UI toont geen informatie waarmee het bestaan van andere gebruikers of tenants kan worden afgeleid. Er komen getypeerde fouten voor verlopen, al gebruikte, ingetrokken, e-mailafwijkende en onbevoegd aangemaakte uitnodigingen.

Beveiligingsrelevante gebeurtenissen worden geaudit zonder tokens, wachtwoorden of volledige gevoelige persoonsgegevens te loggen.

## 9. Handmatige Supabase-configuratie

Voor de uiteindelijke omgeving moet de projecteigenaar:

1. Email/Password als provider actief houden en de gewenste e-mailverificatie instellen.
2. Google als provider activeren.
3. In Google Cloud een OAuth-client maken met de Supabase callback-URL.
4. Google Client ID en secret in Supabase Auth invoeren.
5. Site URL en toegestane redirect-URL’s voor lokaal, preview en productie toevoegen.
6. Voor productie een eigen SMTP-provider configureren.
7. Wachtwoordbeleid, gelekte-wachtwoordcontrole, rate limits en optioneel CAPTCHA instellen.

Secrets komen uitsluitend in lokale of deployment-environmentvariabelen en nooit in Git.

## 10. Testcriteria

- Unit-tests voor uitnodigingsstatussen, scopevalidatie en getypeerde fouten.
- Databasetests die aantonen dat cross-tenant lezen, schrijven en accepteren onmogelijk is.
- Integratietests voor Google callback, wachtwoordlogin, uitnodigingsacceptatie en privé-naar-zakelijke e-mailtransitie.
- Browsertests voor mobiel en desktop, inclusief verlopen en reeds gebruikte links.
- Een gebruiker zonder `user_access` krijgt via UI, API en directe Supabase-client geen tenantdata.

## 11. Buiten scope van deze slice

- Een publieke self-signup.
- Een aparte Liquid HR-platformbeheermodule voor het aanmaken van klanten.
- Provisioning via externe enterprise identityproviders of SCIM.
