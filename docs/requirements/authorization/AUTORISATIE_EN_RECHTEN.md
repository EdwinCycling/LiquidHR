# Datamodel & beveiliging: autorisatie en rechtenmatrix

## 1. Status en doel

**Status:** LEIDEND.

Dit document beschrijft de autorisatiearchitectuur voor Liquid HR. Het systeem combineert granulaire functiepunten met dynamische scope op basis van tenant, afdelingshiërarchie, directe leidinggevende en effective dating.

Autorisatie beantwoordt altijd twee afzonderlijke vragen:

1. **Recht:** welke actie mag de actor uitvoeren?
2. **Scope:** op welke medewerker of organisatie-eenheid mag de actor die actie uitvoeren?

Een recht zonder geldige scope verleent geen toegang.

## 2. Vastgestelde besluiten

- Permissioncodes gebruiken uitsluitend `resource:action` of `self:resource:action`.
- `self:read`, `self_address:write`, `self_salary:read` en vergelijkbare alternatieve notaties zijn niet toegestaan.
- De vaste systeemrol `EMPLOYEE` bevat uitsluitend expliciete selfservicepermissions.
- `self:employee:read` is geen wildcard. Het verleent nooit automatisch `self:salary:read`, `self:address:write` of een ander selfrecht.
- Iedere managementrol, inclusief een plaatsvervangende rol, heeft een eigen rechtenmatrix.
- Scope wordt uiteindelijk door RLS afgedwongen. `requirePermission()` is de centrale applicatielaag en vervangt RLS niet.
- Een directe leidinggevende krijgt alleen rechten die aan de systeemrol `DIRECT_MANAGER` zijn gekoppeld.
- Een expliciet gekoppelde deputy krijgt pas actieve bevoegdheid nadat een leidende afwezigheids-/verlofbron heeft vastgesteld dat vervanging van toepassing is.
- Meerdere gelijktijdige houders van dezelfde rol op dezelfde afdeling zijn toegestaan. Een workflow die exact één behandelaar vereist, moet dit expliciet oplossen of een typed ambiguity error geven.

## 3. Canonieke permissioncodes

### Persoonlijke medewerkergegevens

- `employee:read`
- `employee:write`
- `employee:delete`
- `self:employee:read`
- `self:address:write`
- `self:relation:write`

### Salaris en payroll

- `salary:read`
- `salary:write`
- `self:salary:read`

### Contract en dienstverband

- `contract:read`
- `contract:write`
- `self:contract:read`

### Organisatie en inrichting

- `department:read`
- `department:write`
- `custom-fields:write`

Nieuwe permissions worden alleen via een migratie en seed toegevoegd. Verwijderen of hernoemen vereist een datamigratie van `role_permissions` en een repositorybrede codecontrole.

## 4. Entiteiten

### 4.1 Permission

| Kolom | Type | Regels |
|---|---|---|
| `id` | UUID | Primary key |
| `code` | text | Uniek, verplicht, canonieke notatie |
| `name` | text | Nederlandse weergavenaam |
| `category` | text | Verplichte UI-groepering |
| `description` | text | Optioneel |
| `created_at` | timestamptz | Verplicht |

Permissions zijn voor gewone gebruikers read-only en worden door ontwikkelaars via migraties beheerd.

### 4.2 RolePermission

| Kolom | Type | Regels |
|---|---|---|
| `management_role_id` | UUID | FK naar `management_roles.id`, onderdeel composite PK |
| `permission_id` | UUID | FK naar `permissions.id`, onderdeel composite PK |
| `created_at` | timestamptz | Verplicht |

De HR-admin beheert deze koppelingen later via een matrix. De route en RLS controleren afzonderlijk of de beheerder `authorization:write` of een later goedgekeurde equivalente permission heeft.

## 5. Autorisatiealgoritme

### 5.1 Actor bepalen

1. Lees de ingelogde Supabase-user uit geverifieerde claims.
2. Zoek de actieve, niet-verwijderde `employees`-koppeling voor de huidige tenant.
3. Verzamel de actieve `department_management`-toewijzingen op de peildatum.
4. Retourneer in `AuthContext` afzonderlijk:
   - `tenantId`
   - `userId`
   - `employeeId`
   - `activeRoles` met rolcodes
   - `permissions` met permissioncodes

### 5.2 Selfservice

Als actor en target dezelfde medewerker zijn:

1. Vertaal de gevraagde permission exact naar de selfvariant, bijvoorbeeld `employee:read` naar `self:employee:read`.
2. Controleer uitsluitend die exacte permission op systeemrol `EMPLOYEE`.
3. Sta toe bij een exacte match; anders `403 Forbidden`.

Er bestaat geen algemeen selfrecht dat andere selfpermissions kan vervangen.

### 5.3 Managementscope

Als actor en target verschillende medewerkers zijn:

1. Controleer of minstens één actieve rol van de actor de gevraagde permission heeft.
2. Bepaal de actieve `employee_organizations`-regel van de target op de peildatum.
3. Sta scope toe wanneer één van de volgende regels geldt:
   - de actor is `direct_manager_id` van de target en `DIRECT_MANAGER` heeft de gevraagde permission;
   - de actor heeft een actieve managementrol op de afdeling van de target;
   - de actor heeft een actieve managementrol op een bovenliggende afdeling van de target.
4. Een deputy telt alleen mee wanneer een betrouwbare afwezigheidsbeslissing de vervanging activeert.
5. RLS voert dezelfde scopebeslissing uit voor iedere databasequery.

### 5.4 Afdelingsscope

Een roltoewijzing op afdeling A bestrijkt A en alle onderliggende afdelingen. Technisch mag dit worden berekend als:

- van de actorafdeling recursief omlaag; of
- van de targetafdeling recursief omhoog en controleren of een actorrol op een ancestor staat.

De tweede vorm is geschikt voor een compacte RLS-helper.

## 6. Plaatsvervanging

Er zijn twee vormen:

1. `management_roles.deputy_role_id`: koppelt een primaire rol aan een zelfstandige plaatsvervangende rol met eigen permissions.
2. `employee_organizations.direct_manager_deputy_id`: expliciete deputy voor een medewerker-specifieke directe manager.

De datamodellen mogen nu worden aangelegd. Automatisch omschakelen wordt pas geïmplementeerd zodra de verlof-/afwezigheidsmodule een eenduidige functie levert zoals `isEmployeeUnavailable(employeeId, date)`.

## 7. Verdediging in diepte

- Iedere API-route start met `requirePermission()`.
- Iedere dataquery gebruikt de ingelogde Supabase-client en respecteert RLS.
- Een service-roleclient wordt pas na expliciete autorisatie gebruikt en nooit client-side geïmporteerd.
- Interne `SECURITY DEFINER`-functies staan buiten het blootgestelde `public`-schema, hebben een vast `search_path` en minimale executegrants.
- Iedere mutatie wordt later via de centrale auditfunctie vastgelegd.
- Kritieke autorisatieregels hebben unit- en database-integratietests.

## 8. Open vervolgwerk

- Rechtenmatrix API en UI: **geïmplementeerd 2026-07-15**.
- `authorization:read` en `authorization:write`: **geformaliseerd en aan `TENANT_ADMIN` toegekend**.
- Tenantadmins kunnen tenantrollen maken, archiveren en functiepunten koppelen. Globale systeemrollen en hun matrix blijven uitsluitend via migraties wijzigbaar.
- Organisatieplaatsingen en managementtoewijzingen gebruiken afzonderlijke read/write-functiepunten en effective-dated overlapconstraints.
- Afwezigheidsbron en regels voor begin/einde, tijdzone en gedeeltelijke afwezigheid.
- Workflowresolver voor situaties met meerdere geldige rolhouders.

## 9. Beheerinterface

Het autorisatiebeheer bestaat vanaf versie `1.20260718.2` uit drie gescheiden werkruimtes:

1. **Rechten beheren:** zoekbare rollen, functiepunten per categorie, groepsselectie en expliciete opslag/herstel van conceptwijzigingen;
2. **Grafisch overzicht:** een toegankelijke heatmap met per rol en categorie het aantal toegekende functiepunten ten opzichte van het totaal;
3. **Toewijzingen:** afzonderlijke formulieren voor organisatieplaatsingen en managementrolhouders.

De grafiek is uitsluitend een projectie van `role_permissions`. Hij verleent geen toegang en visualiseert geen impliciete wildcard. Werkelijke toegang blijft de doorsnede van exact functiepunt, actieve rol, tenant-/administratiecontext, effective dating en organisatiescope. Systeemrollen zijn zichtbaar ter referentie en blijven via de beheerinterface onveranderlijk.
