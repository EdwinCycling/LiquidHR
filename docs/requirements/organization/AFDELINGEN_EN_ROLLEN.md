# Datamodel: organisatie, rollen en hiërarchie

> **Actuele scope vanaf 2026-08-05:** afdelingen, functies, locaties en leidinggevende-toewijzingen worden binnen een HR-groep beheerd. Een leidinggevende kan meerdere afdelingen over meerdere administraties binnen dezelfde HR-groep bedienen. Dezelfde persoon kan in meerdere HR-groepen leidinggevende zijn, maar met afzonderlijke groepsautorisatie en context. Zie [HR-groepen: scope, inrichting en domeingrenzen](../multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md).

## 1. Status en doel

**Status:** LEIDEND.

Dit document beschrijft de tijdsgebonden afdelingenboom, managementrollen en toewijzingen van medewerkers aan organisatie-eenheden. Het model ondersteunt tenants, effective dating, directe leidinggevenden, zelfstandige deputyrollen en escalatie via de afdelingshiërarchie.

## 2. Vastgestelde besluiten

- Database-identifiers zijn Engels en gebruiken `snake_case`.
- Iedere operationele organisatie-entiteit is HR-groep-scoped, behalve globale systeemrollen en globale permissiondefinities.
- `DIRECT_MANAGER` en `EMPLOYEE` zijn vaste systeemrollen.
- Een managementrol kan via `deputy_role_id` verwijzen naar een zelfstandige deputyrol met eigen permissions.
- `DepartmentManagement` is effective-dated.
- Meerdere gelijktijdige houders van dezelfde rol op dezelfde afdeling zijn toegestaan.
- Een resolver die precies één manager nodig heeft, geeft bij meerdere kandidaten een typed ambiguity error; hij kiest nooit stil de eerste rij.
- Een directe deputy wordt alleen gebruikt wanneer een externe afwezigheidsbeslissing dit activeert.
- Afdelings- en deputyrelaties mogen geen cycli vormen.

### Implementatiestatus HR-groep-scope — 2026-08-05

Stap 6 is end-to-end doorgevoerd. Afdelingen, functies, organisatieplaatsingen en `DepartmentManagement` gebruiken `hr_group_id`; een employment koppelt de gekozen afdeling en functie alleen binnen dezelfde tenant en HR-groep. De roltoewijzingslijsten, organogramfilters, managerteamscope en de functiescatalogus gebruiken dezelfde actieve groepscontext. De testfixture bevat twee actieve leidinggevenden op `RICH-02` over twee administraties en een afzonderlijke `DIRECT_MANAGER`-autorisatie voor dezelfde login in `TEST-MULTIGROUP`.

De remote groeps-RLS-/contracttests en de geauthentiseerde browsercontrole voor `DEFAULT`, `TEST-MULTIGROUP` en `TEST-BOUNDARY` zijn geslaagd. Cross-group afdelingen en roltoewijzingen verschijnen niet in de actieve groep.

## 3. ManagementRole

| Kolom | Type | Regels |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Optioneel; leeg voor globale systeemrollen |
| `deputy_role_id` | UUID | Optionele self-reference |
| `code` | text | Uniek binnen globale of tenantscope |
| `name` | text | Verplicht |
| `description` | text | Optioneel |
| `is_system` | boolean | Default `false`; systeemrollen niet hernoemen of verwijderen |
| `created_at` | timestamptz | Verplicht |
| `updated_at` | timestamptz | Verplicht |

De initiële migratie seedt minimaal:

- `EMPLOYEE`
- `DIRECT_MANAGER`

## 4. Department

| Kolom | Type | Regels |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Verplicht |
| `parent_id` | UUID | Optionele self-reference binnen dezelfde tenant |
| `code` | text | Uniek binnen tenant |
| `name` | text | Verplicht |
| `description` | text | Optioneel |
| `is_active` | boolean | Default `true` |
| `created_at` | timestamptz | Verplicht |
| `updated_at` | timestamptz | Verplicht |

Een afdeling kan onbeperkt diep worden genest. De database of enige toegestane schrijfservice blokkeert self-parenting en indirecte cycli.

## 5. DepartmentManagement

| Kolom | Type | Regels |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Verplicht |
| `department_id` | UUID | FK naar `departments.id` |
| `management_role_id` | UUID | FK naar `management_roles.id` |
| `employee_id` | UUID | FK naar `employees.id` |
| `effective_from` | date | Verplicht |
| `effective_to` | date | Optioneel; inclusief einddatum |
| `created_at` | timestamptz | Verplicht |
| `updated_at` | timestamptz | Verplicht |

Actief op datum D betekent:

```text
effective_from <= D AND (effective_to IS NULL OR effective_to >= D)
```

## 6. EmployeeOrganization

Dit is de tijdlijn van de organisatorische plaatsing van een medewerker.

| Kolom | Type | Regels |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Verplicht |
| `employee_id` | UUID | FK naar `employees.id`; tijdelijke directe koppeling zolang contractmodule ontbreekt |
| `employment_contract_id` | UUID | Wordt toegevoegd wanneer `employment_contracts` bestaat |
| `department_id` | UUID | FK naar `departments.id` |
| `job_title` | text | Optioneel tijdens bootstrap, later verplicht bij contractflow |
| `direct_manager_id` | UUID | Optionele directe override naar `employees.id` |
| `direct_manager_deputy_id` | UUID | Optionele deputy naar `employees.id` |
| `cost_bearer` | text | Optioneel; verfijning volgt met cost-centerrequirements |
| `effective_from` | date | Verplicht |
| `effective_to` | date | Optioneel; inclusief einddatum |
| `created_at` | timestamptz | Verplicht |
| `updated_at` | timestamptz | Verplicht |

Zodra `employment_contracts` is geïmplementeerd, wordt bepaald of `employee_id` als gecontroleerde denormalisatie blijft bestaan of via het contract wordt afgeleid. Tot die migratie wordt geen losse UUID zonder foreign key toegevoegd.

## 7. Managerresolutie

`getManagerForEmployee(employeeId, roleCode, asOfDate)` volgt deze volgorde:

1. Zoek exact één actieve `EmployeeOrganization` voor de medewerker en peildatum.
2. Voor `DIRECT_MANAGER`:
   - retourneer `direct_manager_id` wanneer aanwezig;
   - gebruik `direct_manager_deputy_id` alleen wanneer de caller een betrouwbare afwezigheidsbeslissing aanlevert;
   - ontbreekt de override, ga verder via afdelingsresolutie.
3. Zoek actieve `DepartmentManagement`-toewijzingen voor de rol op de huidige afdeling.
4. Indien geen kandidaat bestaat, klim via `parent_id` omhoog en herhaal.
5. Bij één kandidaat: retourneer de medewerker.
6. Bij meerdere kandidaten: geef een typed ambiguity error.
7. Voor een primaire managementrol mag naar `deputy_role_id` worden overgeschakeld wanneer afwezigheid expliciet is vastgesteld.

## 8. Integriteitsregels

- Alle foreign keys binnen een record horen bij dezelfde tenant.
- Een medewerker kan niet zijn eigen directe manager of directe deputy zijn.
- `direct_manager_id` en `direct_manager_deputy_id` mogen niet gelijk zijn.
- `effective_to` is leeg of gelijk aan/na `effective_from`.
- Afdelingscycli en deputyrolcycli worden geblokkeerd.
- Iedere tabel heeft RLS en passende indexes voor tenant, effective dates en foreign keys.

## 9. Nog niet activeerbaar

Automatische deputyselectie op basis van verlof of afwezigheid blijft uitgeschakeld totdat een leidend afwezigheidsmodel bestaat. De kolommen en resolverinterfaces mogen dit nu al ondersteunen; toegang wordt niet op vermoedelijke afwezigheid verleend.
