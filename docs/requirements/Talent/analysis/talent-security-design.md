# Talent securitydesign

## Beveiligingsdoelen

Talentdata mag uitsluitend binnen de huidige tenant worden gelezen of gewijzigd; manager-, employee- en administrationele access-scope beperken de projectie verder. Het tenant-owned functiehuis wordt niet per administratie gedupliceerd. HR-beheer, managerinzage en selfservice hebben verschillende scopes. UI-verberging is nooit een beveiligingsgrens.

## Permissionmodel

| Permission | Betekenis | Standaardrol via bestaande `role_permissions` |
|---|---|---|
| `talent:read` | Expliciete tenantbrede Talent-catalogus lezen | TENANT_ADMIN |
| `talent:manage` | Talentconfiguratie, drafts en activatie beheren | TENANT_ADMIN |
| `talent:manager-read` | Workforce-profielen lezen binnen actieve directe managerscope | DIRECT_MANAGER en TENANT_ADMIN |
| `talent-audit:read` | Gesaneerde Talent-audit lezen | TENANT_ADMIN |
| `self:talent:read` | Uitsluitend het eigen actieve profiel lezen | EMPLOYEE en beheerrollen die ook employee-identiteit hebben |

`job-catalog:read/write` blijft vereist voor wijzigen van bestaande functies en groepen. `star-performer:write` blijft vereist voor beheer van de Cloud Tags-catalogus. Talent geeft alleen aanvullende leesrechten op tags die via Talent worden gebruikt; dit voorkomt privilege-uitbreiding naar tagbeheer.

De migratie koppelt permissions aan de actuele globale rollen uit `20260724103939_simplify_roles_and_insights_events.sql`. HR Admin is de weergavenaam van `TENANT_ADMIN`; er wordt geen nieuwe `HR_ADMIN`-rol gemaakt. Applicatiecode vergelijkt alleen permissioncodes.

## Server-side afdwinging

Elke Talent-route voert in deze volgorde uit:

1. authenticatie via `getClaims()` en `requireAuthContext()`;
2. modulecontrole via dezelfde `tenant_modules`-bron als Settings;
3. permissioncontrole via `requirePermission()`;
4. afleiding van tenant, actor en self-employee uit `AuthContext`; administratie alleen voor employee-/employment- en plaatsingsimpact;
5. Zod-validatie van uitsluitend functionele input;
6. query/RPC via de cookiegebonden serverclient zodat RLS actief blijft.

Requestvelden `tenantId`, `administrationId`, `actorUserId` en self-`employeeId` worden niet geaccepteerd. Een opgegeven resource-ID wordt altijd opnieuw binnen de contextscope opgezocht.

## RLS-ontwerp

Alle nieuwe tabellen in `public` krijgen RLS in dezelfde migratie. Policies zijn per opdracht gesplitst in SELECT, INSERT, UPDATE en DELETE; `FOR ALL` wordt vermeden waar delete- of immutabilityregels afwijken.

### Tenantbrede configuratie

Levelmodel, levels, senioriteit, categorieën en capabilities:

- SELECT: `current_user_has_permission(tenant_id, null, 'talent:read')` of `talent:manage`; managers krijgen geen brede cataloguslezing;
- INSERT/UPDATE: `talent:manage` en actieve TALENT-module;
- DELETE: `talent:manage`, module actief en databaseguard bevestigt ongebruikt;
- EMPLOYEE krijgt geen directe tabelgrant voor brede capabilitycatalogus; Mijn Talent leest via een beperkte security-definerfunctie die self-identiteit intern vaststelt.

### Functiehuis en profielen

Families, profielen, versies en requirements dragen tenant; concrete employee-/employmentprojecties voegen administratiecontext toe:

- HR SELECT/WRITE: `current_user_has_permission(tenant_id, null, 'talent:read/manage')` voor de tenant-owned catalogus;
- manager SELECT: tenant-owned profiel via readmodel, maar alleen bij een actieve `employee_organizations`-plaatsing met `direct_manager_id = current_employee_id()`; geen algemene directe profielcatalogusgrant;
- self SELECT: alleen via `public.get_my_talent_profile(as_of date)`, die `current_employee_id()` gebruikt;
- actieve/historische versies zijn door triggers immutable, ook als een gebruiker writepermission bezit.

### Tags

`talent_tag_relations` controleert tenantgelijkheid voor zowel tag als doel. `star_performer_tags` krijgt een aanvullende SELECT-policy voor Talent-permissions; INSERT/UPDATE/DELETE-policies blijven ongewijzigd.

## Grants en Data API

RLS en Data API-rechten zijn afzonderlijk. Iedere migratie:

- trekt standaard alle rechten in van `anon` en `public`;
- geeft `authenticated` alleen de beoogde tabelkolommen en RPC-execute;
- verleent self/manager geen directe brede tabelrechten wanneer een beperkte RPC nodig is;
- trekt execute op mutatie-RPC's in van `public` en `anon`;
- zet voor functies een lege `search_path` en kwalificeert objectnamen volledig.

Dit volgt ook de actuele Supabase-wijziging waarbij nieuwe tabellen niet meer automatisch aan Data API-rollen worden toegekend: [Supabase Changelog — tables not exposed automatically](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Manager- en selfscope

Managerinzage begint bij een bestaande actieve `employee_organizations`-plaatsing met `direct_manager_id = internal_security.current_employee_id()`. De nieuwe manager-RLS-policy en `listTalentProfilesForWorkforce()` beperken jobs, groepen, revisions en profielen tot die directe scope. Een manager kan geen capabilitycatalogus, concept of historie buiten die projectie browsen.

Mijn Talent gebruikt geen employee-ID in URL of body. `get_my_talent_profile()` resolveert `auth.uid()` via `current_employee_id()`, controleert `self:talent:read` en retourneert alleen de eigen actuele plaatsing en actieve profielversie. Pogingen om een andere medewerker te benaderen gaan via geen enkel self-endpoint.

## Immutability en concurrency

- Alle conceptwijzigingen gebruiken `updated_at` als optimistic concurrency token; een afwijkend token levert 409.
- Activatie vergrendelt het profiel en versies met `FOR UPDATE`.
- Exclusion constraints blokkeren overlappende perioden, ook bij gelijktijdige requests.
- De levelmodelguard controleert gebruik in requirements binnen dezelfde transactie.
- Een ACTIVE/HISTORICAL-versie kan niet via normale UPDATE/DELETE worden gewijzigd.

## Audit

Het bestaande `audit_logs` blijft de enige auditbron. De tien Talent-tabellen gebruiken de bestaande `internal_security.audit_hr_change()`-trigger en behouden actor-, tenant-, entity-, actie- en timestampregistratie volgens het bestaande auditcontract. Deze Foundation-slice voegt geen tweede auditmodel, correlation/source-channel-kolommen of afzonderlijke denied-audit-RPC toe.

## Bedreigingen en mitigaties

| Bedreiging | Mitigatie | Verificatie |
|---|---|---|
| Cross-tenant-ID in request | Contextafleiding, samengestelde FKs, RLS | SQL-isolatietest en API-test met vreemd ID |
| HR-route zonder permission | `requirePermission` plus RLS | route-unit en echte-sessiebrowsertest |
| Manager leest buiten team | actieve `employee_organizations.direct_manager_id` plus manager-RLS | manager A/B SQL-matrix |
| Employee manipuleert employee-ID | selfendpoint accepteert geen ID | AT-MY-002 API-test |
| Actieve versie gewijzigd | immutable trigger | UPDATE/DELETE SQL-test |
| Overlappende activaties | row lock + exclusion constraint | concurrencytest |
| Niveau gewijzigd na gebruik | databaseguard | SQL-test direct en via API |
| Tag uit andere tenant gekoppeld | geen nieuwe Talent-tagrelatie; bestaande Star Performer-scope blijft leidend | bestaande tag-RLS-tests |
| Alleen menu verborgen | routecheck en RLS blijven actief | directe URL/API-test |
| Service role omzeilt RLS | normale flow gebruikt serverclient; adminclient verboden in Talent-services | statische review en importcheck |

## Security releasegate

Voor de huidige Foundation zijn remote migration parity, nieuwe RLS-policies, grants, advisors, gegenereerde DB-types, permissionmatrix, manager/self-isolatie en immutability gecontroleerd. De geauthenticeerde browsermatrix ontbreekt nog door het ontbreken van testcredentials; denied-audit en correlation/source-channel zijn geen onderdeel van de uitgevoerde Foundation en mogen niet als geïmplementeerd worden geclaimd. Een werkende pagina of verborgen menu-item is daarvoor geen bewijs.
