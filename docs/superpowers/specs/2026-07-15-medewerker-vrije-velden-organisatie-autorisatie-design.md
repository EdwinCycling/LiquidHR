# Medewerkerbeheer, vrije velden en organisatie/autorisatie — ontwerp

**Status:** goedgekeurd op 2026-07-15  
**Scope:** drie opeenvolgende verticale slices: medewerker-CRUD, vrije velden, organisatie- en autorisatiebeheer.

## 1. Doel en uitgangspunten

Liquid HR krijgt een volledig beheerbare HR-kern waarin een bevoegde HR-admin medewerkers, organisatie-inrichting, rollen en functiepunten kan beheren. Iedere mutatie volgt `schema → server/API → UI`, iedere publieke tabel heeft RLS en tenant- en administratiegrenzen worden zowel database-side als in de applicatielaag gecontroleerd.

Een Employee blijft de permanente tenantbrede persoonsidentiteit en kan nul of meerdere dienstverbanden hebben. Selfservice gebruikt voorlopig dezelfde portal, maar services, schemas en permissions blijven UI-onafhankelijk. Een latere mobile-first Employee Self Service gebruikt daardoor dezelfde beveiligde interfaces.

## 2. Medewerker-CRUD

### 2.1 Personeelsnummer

- Iedere tenant heeft een eigen atomaire nummerreeks.
- De applicatie reserveert bij aanmaak het eerstvolgende nummer en vult dit voor.
- De HR-admin mag een afwijkend nummer invoeren.
- Uniciteit geldt tenantbreed en wordt door een databaseconstraint afgedwongen.
- Bij een conflict retourneert de API HTTP 409 plus een nieuw voorstel.
- Gelijktijdige aanmaak kan nooit twee gelijke nummers opleveren.

### 2.2 Persoonskaart en onderliggende gegevens

De bestaande `employees`-tabel blijft de basis. Nieuwe tabellen modelleren:

- `employee_addresses`: effective-dated adressen;
- `employee_bank_accounts`: meerdere rekeningen, maximaal één actieve primaire rekening;
- `employee_relations`: relaties en noodcontacten;
- `audit_logs`: centrale, append-only activiteitenhistorie.

Alle tabellen dragen `tenant_id`, samengestelde foreign keys en soft-delete- of effective-datevelden waar relevant. Hard verwijderen van historisch gebruikte HR-data is niet beschikbaar in de gewone UI; verwijderen betekent archiveren of beëindigen.

### 2.3 BSN

- Leesbaar BSN wordt nooit in `employees.bsn` of logs opgeslagen.
- Ciphertext wordt versleuteld met een server-only `EMPLOYEE_PII_ENCRYPTION_KEY`; tenantgebonden HMAC-fingerprint gebruikt `BSN_HASH_KEY` voor deduplicatie.
- Algemene lijst- en detailqueries selecteren geen ciphertext of fingerprint.
- Volledig BSN is alleen beschikbaar via een expliciete reveal-actie.
- Functiepunten: `employee-bsn:read`, `employee-bsn:write`, `self:employee-bsn:read`.
- HR-admin krijgt read/write, manager geen van beide en medewerker uitsluitend self-read.
- Reveal, vastleggen en vervangen worden geaudit; auditpayloads bevatten nooit het BSN.

### 2.4 Selfservice in deze fase

Een medewerker mag via exacte selfpermissions eigen privécontactgegevens, adressen en relaties/noodcontacten wijzigen. BSN en dienstverbanden zijn alleen leesbaar met het betreffende selfrecht. Bankrekeningen en formele persoonsgegevens worden in deze fase door HR beheerd. De toekomstige mobile-first ESS is een afzonderlijke presentatie-laag.

### 2.5 UX

De medewerkerslijst krijgt zoeken, statusfiltering, administratiecontext en een aanmaakactie. De aanmaakwizard bevat identity match, persoonsgegevens, contact/adres, optionele organisatieplaatsing en controle. Een dienstverband is niet verplicht.

De detailpagina krijgt secties voor persoonsgegevens, adressen, bankrekeningen, relaties, dienstverbanden, organisatieplaatsingen, vrije velden en audit. Acties worden server-side door permissions bepaald; verborgen knoppen zijn nooit de beveiligingsgrens.

## 3. Vrije velden

### 3.1 Model en scope

- Definities zijn administratiegebonden, conform de multitenancy-architectuur.
- Waarden blijven in `employees.custom_fields` JSONB.
- Iedere definitie heeft een onveranderlijke technische `key`; labels in NL en EN mogen wijzigen zonder dat waarden verloren gaan.
- In de actieve administratie worden alleen definities van exact die tenant en administratie gebruikt.
- In combined mode kiest de beheerder bij definitiebeheer expliciet de juridische administratie.

### 3.2 Veldtypen en validatie

Ondersteund: `TEXT`, `TEXT_AREA`, `SELECT`, `DATE`, `INTEGER`, `DECIMAL`, `CURRENCY`, `EMAIL`, `HYPERLINK` en `AUTO_INCREMENT`. Servervalidatie is leidend en controleert type, required, lengte, selectopties en relevante notatie. Onbekende of inactieve keys worden niet stil geaccepteerd.

`AUTO_INCREMENT` gebruikt een databasecounter per definitie en geen `MAX(JSONB)+1`, zodat gelijktijdige inserts veilig zijn.

### 3.3 Functiepunten en doelgroepen

Algemene functiepunten bepalen of een rol vrije waarden kan lezen of schrijven:

- `custom-field-values:read`
- `custom-field-values:write`
- `self:custom-field-values:read`
- `self:custom-field-values:write`
- bestaand `custom-fields:write` voor definitiebeheer

Daarnaast heeft iedere definitie voor `HR`, `MANAGER` en `EMPLOYEE_SELF` afzonderlijk `HIDDEN`, `READ` of `WRITE`. Toegang vereist zowel het algemene functiepunt als toestemming op de definitie. Dit voorkomt een explosie van veldspecifieke permissions.

### 3.4 Beheer-UI

Per administratie kan een beheerder definities aanmaken, wijzigen, sorteren en deactiveren. Een definitie met waarden wordt nooit hard verwijderd. SELECT-opties zijn stabiele values met vertaalbare labels. Medewerkerformulieren worden dynamisch uit dezelfde definities opgebouwd.

## 4. Organisatie- en autorisatiebeheer

### 4.1 Functiepunten, rollen en scope

- `permissions` zijn door ontwikkelaars beheerde functiepunten en voor klanten read-only.
- `management_roles` bundelen functiepunten.
- Systeemrollen `EMPLOYEE`, `DIRECT_MANAGER` en `TENANT_ADMIN` zijn beschermd.
- Tenant-admins kunnen tenantrollen aanmaken, wijzigen en deactiveren.
- De rol bepaalt **wat** iemand mag; de toewijzing bepaalt **waar**: tenant, administratie of afdeling plus descendants.
- Nieuwe permission `authorization:write` beschermt rollen, matrix en roltoewijzingen.

### 4.2 Afdelingen

De bestaande boom krijgt create, update, verplaatsen en deactiveren. Self-parenting, indirecte cycli, cross-administration parents en verplaatsing met ongeldige dependencies worden database-side geblokkeerd. Historisch gebruikte afdelingen worden gedeactiveerd, niet verwijderd.

### 4.3 Organisatieplaatsingen

Beheer omvat medewerker, employment (optioneel waar toegestaan), afdeling, functienaam, directe manager, deputy, ingangsdatum en einddatum. Perioden blijven effective-dated; ongeldige overlap of cross-tenant/cross-administration koppelingen worden geweigerd.

### 4.4 Managementtoewijzingen

Een medewerker kan een rol op een afdeling krijgen met effective dates. Meerdere gelijktijdige rolhouders blijven toegestaan. Een workflow die één manager vereist, gebruikt de bestaande ambiguity error.

### 4.5 Rollenmatrix

De UI groepeert functiepunten per categorie, toont beschermde systeemrollen read-only waar nodig en laat tenantrollen beheren. Een rol met actieve toewijzingen kan alleen worden gedeactiveerd na een expliciete afhankelijkheidscontrole.

## 5. API- en servicelaag

Routes beginnen met `requirePermission()`, valideren Zod-input en gebruiken de ingelogde Supabase-client. Service-role wordt alleen gebruikt voor cryptografische of invitation-only handelingen nadat autorisatie en tenantcontext expliciet zijn vastgesteld.

Nieuwe resources krijgen gerichte routes voor employees, employee subresources, BSN reveal, custom-field definitions/values, departments, roles, permission matrix, organization placements en management assignments. Lijstqueries zijn begrensd en URL-gebaseerd gefilterd.

Typed fouten worden vertaald naar 400 validatie, 401 niet ingelogd, 403 onvoldoende recht/scope, 404 buiten scope of afwezig, 409 conflict/overlap en 500 zonder gevoelige details.

## 6. Audit en concurrency

Iedere mutatie schrijft via één auditservice actor, tenant, administratie, entiteit, actie en een gesaneerde wijzigingsset. Sensitive values, secrets, BSN en volledige bankrekeningnummers komen niet in auditpayloads.

Mutaties gebruiken `updated_at` als optimistic concurrency token. Een verouderde wijziging geeft HTTP 409. Nummering, primaire bankrekening en auto-increment vrije velden gebruiken databaseconstraints of transactiefuncties tegen races.

## 7. Test- en acceptatiegrenzen

- Unit-tests voor schemas, nummering, veldvalidatie, audiencebeslissingen, permissioncompositie en foutmapping.
- Database-integratietests voor RLS, tenant/administratie-isolatie, samengestelde foreign keys, perioden, cycli, concurrency en beschermde rollen.
- API-tests voor permissions, 409-conflicten en afwezigheid van gevoelige velden.
- Browsertests voor de drie volledige beheerstromen op desktop en mobiel.
- Na iedere migratie: types regenereren en Supabase security/performance advisors controleren.
- Eindcontrole: tests, i18n-pariteit, strict TypeScript, ESLint, productiebuild, poort 3000 en publieke HTTPS-preview.

## 8. Buiten scope

- De definitieve aparte mobile-first ESS-interface.
- Goedkeuringsworkflow voor bankrekeningwijzigingen.
- Verlofgestuurde deputyactivatie.
- Hard delete van HR-historie.
- Dynamisch door klanten aanmaken van nieuwe functiepunten; klanten beheren alleen rollen en toewijzingen.
