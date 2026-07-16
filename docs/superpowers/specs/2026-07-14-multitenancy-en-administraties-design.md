# Multitenancy en multi-administratie — ontwerp

**Status:** GOEDGEKEURD VOOR REVIEW  
**Datum:** 2026-07-14  
**Scope:** tenantisolatie, administraties, stamtabellen, contextwisseling en deterministische demo-omgevingen.

## 1. Doel

Liquid HR ondersteunt meerdere klanten in één Supabase-project. Een klant is een `Tenant` en vormt de absolute beveiligingsgrens. Een tenant bevat één of meer juridische of loontechnische `Administrations`. Gebruikers mogen nooit data van een andere tenant lezen, wijzigen, afleiden of via relaties bereiken.

De eerste implementatie levert:

- één tenant met drie hiërarchische administraties en vijftig medewerkers;
- één volledig gescheiden tenant met tien medewerkers;
- expliciete gebruikersscope en een administratiekiezer voor de eerste tenant;
- database- en applicatiecontroles voor tenant- en administratiescope;
- een eenmalige, onomkeerbare overgang van gescheiden naar gecombineerd administratief gebruik.

Een toekomstige platform-adminmodule maakt nieuwe tenants en hun eerste hoofdgebruiker aan. Die module valt buiten deze slice; het schema ondersteunt haar zonder tijdelijke uitzonderingen.

## 2. Begrippen en grenzen

### Tenant

Een tenant is exact één klantcontract en de hoogste datagrens. Administraties van verschillende tenants kunnen nooit aan elkaar worden gekoppeld. Er bestaat geen cross-tenant zoek-, rapportage- of beheerscope voor gewone klantgebruikers.

### Administration

Een administratie is een juridische of loontechnische entiteit binnen een tenant. `administrations.parent_id` modelleert uitsluitend de juridische hiërarchie. De parent moet binnen dezelfde tenant vallen en cycli zijn verboden.

### Actieve context

De actieve tenant en administratie zijn navigatiecontext, geen bron van autorisatie. De server bewaart de keuze in een HTTP-only cookie. Iedere route behandelt cookiewaarden als onbetrouwbare input en valideert opnieuw of de gebruiker de tenant en administratie mag gebruiken. RLS blijft de definitieve rijbeveiliging.

## 3. Datamodel

### 3.1 Tenant

`tenants` krijgt:

- `slug`: unieke technische sleutel;
- `administration_mode`: `SEPARATE` of `COMBINED`;
- `sharing_mode`: `FULLY_ISOLATED` of `SHARED_COLLEAGUES`;
- `combined_at`: gevuld zodra administraties zijn gecombineerd;
- bestaande naam- en auditvelden.

Een databaseconstraint borgt dat `combined_at` alleen bij `COMBINED` gevuld is.

### 3.2 Administration

Nieuwe tabel `administrations`:

- `id`, `tenant_id`, `parent_id`;
- `code`, `name`, `coc_number`, `vat_number`;
- `is_active`, `created_at`, `updated_at`.

Uniciteit geldt voor `(tenant_id, code)`. Samengestelde foreign keys en een trigger borgen dat parent en child dezelfde tenant hebben. Een recursieve controle blokkeert directe en indirecte cycli.

### 3.3 UserAccess

Nieuwe tabel `user_access` koppelt `auth.users` expliciet aan klantcontext:

- `user_id`, `tenant_id`, `management_role_id`;
- `scope_type`: `TENANT` of `ADMINISTRATION`;
- `administration_id`: verplicht bij `ADMINISTRATION`, leeg bij `TENANT`;
- `is_active`, `created_at`, `updated_at`.

Een lege `administration_id` betekent nooit impliciet toegang tot alles. Alleen `scope_type = TENANT` verleent, na permissioncontrole, toegang tot alle administraties binnen exact die tenant.

### 3.4 Medewerkers en organisatie

- `employees` blijft de tenantbrede persoonsidentiteit en houdt `tenant_id`.
- Nieuwe effective-dated tabel `employee_administration_assignments` koppelt een medewerker aan een administratie zolang `employment_contracts` nog niet bestaat.
- `departments` krijgt een verplichte `administration_id`.
- `department_management` en `employee_organizations` krijgen een verplichte `administration_id` voor expliciete scope en efficiënte RLS.
- Alle samengestelde foreign keys borgen dat tenant, administratie, afdeling en medewerker bij elkaar horen.
- Zodra contracten worden ingevoerd, wordt de administratiekoppeling van een dienstverband leidend en wordt de tijdelijke assignment gecontroleerd gemigreerd.

## 4. Stamtabellen

Stamtabellen zijn standaard administratiegebonden. Tenantbreed delen gebeurt alleen wanneer de domeinspecificatie dat expliciet toestaat; een ontbrekende `administration_id` mag nooit stil als “gedeeld” worden geïnterpreteerd.

### Tenantbreed

- medewerker-persoonsidentiteit;
- globale, door migraties beheerde permissiondefinities;
- expliciet als tenantbreed ontworpen configuratie, zoals de privacy-/deelmodus.

### Administratiegebonden

- afdelingen en afdelingshiërarchie;
- kostenplaatsen en kostendragers;
- werklocaties;
- loonschalen en payroll-inrichting;
- contract-, rooster- en salarisgerelateerde stamgegevens;
- vrije-velddefinities wanneer deze voor een juridische entiteit gelden.

### Geen automatische overerving

Een child-administratie erft geen stamgegevens van de holding. Automatische overerving maakt herkomst, mutatierechten en RLS onnodig ambigu. Hergebruik kan later via een expliciete kopieeractie of een afzonderlijk, versioned templateconcept worden toegevoegd.

In `COMBINED` blijven juridische stamgegevens administratiegebonden. De hoofdinterface heeft dan geen actieve administratiekiezer, maar schermen voor stamgegevens, contracten, payroll en rapportages bieden een expliciet administratiefilter of verplichte entiteitselectie.

## 5. Gescheiden en gecombineerd gebruik

### SEPARATE

- een gebruiker met toegang tot meerdere administraties ziet de administratiekiezer;
- iedere administratiegebonden route vereist een actieve administratie;
- basisgegevens van medewerkers volgen `sharing_mode`;
- gevoelige tijdlijnen blijven altijd administratie- en permissiongebonden.

### COMBINED

- de algemene administratiekiezer verdwijnt;
- de tenant functioneert operationeel als één HR-omgeving;
- juridische entiteiten blijven bestaan en worden geselecteerd waar stam-, contract-, salaris-, payroll- of rapportagegegevens dit vereisen;
- de overgang zet `sharing_mode` op `SHARED_COLLEAGUES` omdat één operationele collegaomgeving anders intern tegenstrijdig is.

De overgang loopt uitsluitend via één `SECURITY DEFINER`-functie in `internal_security`, na route-side permissioncontrole. De functie:

1. vergrendelt de tenantregel;
2. valideert dat de huidige modus `SEPARATE` is;
3. zet `administration_mode = COMBINED`, `sharing_mode = SHARED_COLLEAGUES` en `combined_at`;
4. schrijft een auditrecord zodra de centrale auditmodule beschikbaar is.

Een trigger blokkeert iedere wijziging van `COMBINED` terug naar `SEPARATE` en het leegmaken van `combined_at`. Ontkoppelen kan alleen via een later ontworpen export/nieuwe-tenantmigratie, niet als gewone instelling.

## 6. Autorisatie en RLS

Iedere beveiligde aanvraag beantwoordt onafhankelijk:

1. Tot welke tenant behoort het record?
2. Heeft `auth.uid()` actieve `user_access` voor die tenant?
3. Heeft de gebruiker tenantbrede of exact passende administratietoegang?
4. Heeft een actieve rol de vereiste permission?
5. Valt het target binnen de toegestane organisatie- of selfservicescope?

Interne helpers in `internal_security` worden klein en composable:

- `has_tenant_access(requested_tenant_id)`;
- `has_administration_access(requested_tenant_id, requested_administration_id)`;
- bestaande permission- en managementscopehelpers gebruiken deze grenzen als voorwaarde.

De helpers zijn `SECURITY DEFINER`, hebben een vast `search_path` en krijgen geen executegrant voor `PUBLIC` of `anon`. RLS-policies vergelijken altijd tenant én administratie waar de tabel administratiegebonden is. Routes gebruiken de RLS-scoped Supabase-client voor reads. Een service-roleclient mag nooit een gebruikersfilter vervangen.

Een tenantbeheerder die alle administraties mag wisselen heeft expliciete `TENANT`-scope. Een administratiegebruiker krijgt één of meer expliciete `ADMINISTRATION`-regels. De contextkiezer toont alleen de doorsnede van actieve administraties en de verleende toegang.

## 7. API en UI

### Context-API

- `GET /api/context`: retourneert de actieve tenant, toegestane administraties en actieve administratie.
- `POST /api/context/administration`: valideert de gekozen UUID tegen `user_access` en schrijft daarna pas de HTTP-only cookie.
- Fouten zijn Nederlandstalige JSON-responses met 400, 401 of 403.

### Dashboard

De server-layout resolveert de context en geeft opties als props aan de sidebar. De sidebar doet geen eigen autorisatiequery.

- Bij `SEPARATE` en meer dan één toegestane administratie: dropdown zichtbaar.
- Bij één toegestane administratie: label, geen dropdown.
- Bij `COMBINED`: geen algemene dropdown; entiteitselectie verschijnt alleen op relevante stam-/payrollschermen.
- Een contextwissel navigeert server-side en ververst alle Server Components, zodat geen oude administratiedata in clientstate achterblijft.

## 8. Deterministische demo-omgevingen

### Tenant 1: Liquid HR Demo Holding

- `Liquid HR Demo Holding B.V.` als parent;
- `Liquid HR Services B.V.` als child;
- `Liquid HR Operations B.V.` als child;
- modus `SEPARATE`, zodat de switcher aantoonbaar werkt;
- vijftig medewerkers verdeeld over de drie administraties;
- realistische Nederlandse namen, adressen, contactgegevens, functies, afdelingen, leidinggevenden, rollen en effective-dated plaatsingen;
- de bestaande Edwin-authuser krijgt actieve tenantbrede beheertoegang tot deze tenant.

### Tenant 2: Noorderlicht Zorggroep

- volledig afzonderlijke tenant;
- één administratie en tien medewerkers;
- eigen afdelingen, adressen, functies, managers en organisatieplaatsingen;
- geen koppeling met de Edwin-authuser; gereed voor een later afzonderlijk loginaccount.

Het seedproces gebruikt vaste UUID's en upserts voor reproduceerbaarheid. Het verwijdert of vervangt alleen de twee demo-tenants op basis van vaste slugs. `auth.users` wordt nooit verwijderd. Globale permissionseeds blijven migratiegestuurd.

## 9. Teststrategie

### Unit- en routetests

- actieve context wordt alleen geaccepteerd bij geldige toegang;
- tenantbrede scope levert alleen administraties van dezelfde tenant;
- administratiegebonden scope kan geen sibling of andere tenant kiezen;
- gecombineerde modus verbergt de algemene switcher;
- ongeldige of gewijzigde cookie resulteert in een veilige default of 403, nooit extra toegang.

### Database-integratietests

- tenant 1 kan geen enkele rij van tenant 2 selecteren of muteren;
- tenant 2 kan geen identifiers uit tenant 1 als foreign key gebruiken;
- administratiegebruiker kan geen administratiegebonden rij uit een andere administratie lezen;
- tenantbeheerder kan alleen binnen de eigen tenant administraties benaderen;
- department- en administration-hiërarchiecycli falen;
- `COMBINED → SEPARATE` faalt;
- alle publieke tabellen hebben RLS en policies.

Negatieve isolatietests zijn verplicht en moeten aantonen dat bewust foutieve tenant- en administratie-ID's geen data opleveren.

### Volledige gate

- Supabase security- en performance-advisors;
- gegenereerde TypeScript-types;
- Vitest, ESLint, strict TypeScript en Next.js-productiebuild;
- browsercontrole van loginredirect, switcher en afdelingenfilter op poort 3000;
- serverlogs zonder nieuwe runtimefouten.

## 10. Bewuste beperkingen

- De platform-adminmodule en uitnodigingsflow worden later gebouwd.
- Contract-, salaris- en payrolltabellen worden niet vooruitlopend als lege schijnmodellen toegevoegd.
- Cross-tenant platformrapportage wordt niet in klantrollen ingebouwd.
- Automatische stamgegevensovererving wordt niet toegevoegd.
- Ontkoppelen van een gecombineerde tenant is geen instelling maar een toekomstige, gecontroleerde datamigratie naar nieuwe tenantgrenzen.
