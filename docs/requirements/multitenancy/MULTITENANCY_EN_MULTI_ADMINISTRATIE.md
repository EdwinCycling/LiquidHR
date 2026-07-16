# Datamodel & beveiliging: multitenancy en multi-administratie

## 1. Status en doel

**Status:** LEIDEND.

Liquid HR ondersteunt meerdere klanten in één applicatie en één Supabase-project. Iedere klant is een `Tenant` en vormt een absolute gegevensgrens. Een tenant bevat één of meer juridische of loontechnische `Administrations`.

Geen klantgebruiker mag gegevens van een andere tenant lezen, wijzigen, afleiden of via een foreign key bereiken. Deze regel wordt tegelijk afgedwongen door samengestelde databaseconstraints, expliciete serverfilters, permissions en Row Level Security.

## 2. Vastgestelde besluiten

- Eén tenant vertegenwoordigt precies één klant.
- Administraties zijn juridische of loontechnische entiteiten binnen een tenant.
- Administraties kunnen via `parent_id` een holdingstructuur vormen, maar nooit tenantgrenzen kruisen.
- Een lege `administration_id` verleent nooit impliciet toegang tot alle administraties.
- Gebruikerstoegang heeft expliciet scope `TENANT` of `ADMINISTRATION`.
- Stamtabellen zijn standaard administratiegebonden.
- Medewerker-persoonsidentiteit is tenantbreed; dienstverband-, salaris-, rooster- en payrollgegevens zijn administratiegebonden.
- `SEPARATE → COMBINED` is een gecontroleerde eenmalige actie.
- `COMBINED → SEPARATE` wordt door de database geblokkeerd.
- De actieve context is UX en filtering, geen autorisatiebron. Iedere aanvraag valideert de context opnieuw.
- Een toekomstige platform-adminmodule maakt een tenant en de eerste hoofdgebruiker aan; de hoofdgebruiker richt daarna de eigen klantomgeving verder in.

## 3. Tenant

| Kolom | Type | Regels |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | text | Verplicht |
| `slug` | text | Globaal uniek, verplicht |
| `administration_mode` | enum | `SEPARATE` of `COMBINED` |
| `sharing_mode` | enum | `FULLY_ISOLATED` of `SHARED_COLLEAGUES` |
| `combined_at` | timestamptz | Alleen gevuld bij `COMBINED` |
| `is_active` | boolean | Default `true` |
| `created_at` | timestamptz | Verplicht |
| `updated_at` | timestamptz | Verplicht |

## 4. Administration

| Kolom | Type | Regels |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK naar dezelfde tenantcontext |
| `parent_id` | UUID | Optionele parent binnen dezelfde tenant |
| `code` | text | Uniek binnen tenant |
| `name` | text | Verplicht |
| `coc_number` | text | Optioneel KvK-nummer |
| `vat_number` | text | Optioneel btw-nummer |
| `is_active` | boolean | Default `true` |
| `created_at` | timestamptz | Verplicht |
| `updated_at` | timestamptz | Verplicht |

Self-parenting, indirecte cycli en cross-tenant parents zijn verboden.

## 5. UserAccess

| Kolom | Type | Regels |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK naar `auth.users.id` |
| `tenant_id` | UUID | Verplichte tenantgrens |
| `management_role_id` | UUID | Rol met permissions voor deze toegang |
| `scope_type` | enum | `TENANT` of `ADMINISTRATION` |
| `administration_id` | UUID | Verplicht bij `ADMINISTRATION`, leeg bij `TENANT` |
| `is_active` | boolean | Default `true` |
| `created_at` | timestamptz | Verplicht |
| `updated_at` | timestamptz | Verplicht |

`TENANT`-scope geeft, binnen de toegewezen permissions, toegang tot administraties van exact dezelfde tenant. `ADMINISTRATION`-scope geeft alleen toegang tot de expliciet gekoppelde administratie. Meerdere administratie-scopes worden als meerdere regels opgeslagen.

## 6. Medewerkersdeling

### FULLY_ISOLATED

- Een gebruiker ziet een medewerker alleen wanneer die medewerker op de peildatum een actieve administratiekoppeling heeft binnen een administratie waartoe de gebruiker toegang heeft.
- Organisatie-, contract-, salaris-, rooster- en payrolltijdlijnen blijven binnen die administratie.

### SHARED_COLLEAGUES

- Bevoegde gebruikers mogen de basispersoonskaart van collega's binnen dezelfde tenant zien voor smoelenboek en organisatiestructuur.
- Gevoelige tijdlijnen blijven altijd beperkt tot de administratie van het dienstverband en de exacte permission.
- `self:employee:read` verleent geen salaris-, contract- of adresrecht.

## 7. Stamtabellen

Administratiegebonden stamtabellen omvatten minimaal afdelingen, kostenplaatsen, kostendragers, werklocaties, loonschalen, payroll-inrichting en administratiegebonden vrije-velddefinities.

Tenantbreed zijn uitsluitend gegevens die expliciet zo zijn ontworpen, waaronder medewerker-persoonsidentiteit, tenantconfiguratie en globale permissiondefinities. Een nullable `administration_id` wordt niet als generiek deelmechanisme gebruikt.

Een child-administratie erft geen stamgegevens van een parent. Hergebruik vereist later een expliciete kopieeractie of versioned template; dit voorkomt onduidelijke eigendom-, mutatie- en RLS-regels.

## 8. Gescheiden en gecombineerd

### SEPARATE

- Bij meerdere toegestane administraties toont de sidebar een administratiekiezer.
- De gekozen administratie wordt in een HTTP-only cookie opgeslagen.
- Iedere administratiegebonden route valideert de keuze opnieuw en filtert op tenant én administratie.

### COMBINED

- De algemene administratiekiezer wordt niet getoond.
- De tenant werkt operationeel als één HR-omgeving.
- Juridische entiteiten blijven bestaan voor stamgegevens, contracten, payroll en rapportagefilters.
- Combineren zet `sharing_mode` op `SHARED_COLLEAGUES`.

De overgang naar `COMBINED` verloopt via één interne databasefunctie en wordt later door de centrale auditmodule gelogd. Terugdraaien is geen instelling. Een eventuele toekomstige splitsing is een afzonderlijk export- en datamigratieproject naar nieuwe tenantgrenzen.

## 9. Beveiligingsregels

- Iedere publieke tabel heeft RLS.
- Iedere API-route controleert de permission en actieve context.
- Interne autorisatiefuncties staan in `internal_security`, hebben een leeg of vast `search_path` en minimale executegrants.
- Foreign keys voor administratiegebonden records borgen tenant én administratie.
- Service-roletoegang wordt nooit gebruikt om gebruikersautorisatie of contextfilters over te slaan.
- Negatieve tests moeten bewust verkeerde tenant- en administratie-ID's proberen.
- Contextcookies worden nooit vertrouwd zonder databasevalidatie.

## 10. Eerste demo-inrichting

- `Liquid HR Demo Holding`: drie hiërarchische administraties en vijftig medewerkers; de bestaande Edwin-authuser krijgt expliciete tenantbrede hoofdtoegang.
- `Noorderlicht Zorggroep`: afzonderlijke tenant met één administratie en tien medewerkers; nog niet gekoppeld aan een loginaccount.
- Alle demo-inrichting is deterministisch en herhaalbaar. `auth.users` wordt niet door seeds verwijderd.

