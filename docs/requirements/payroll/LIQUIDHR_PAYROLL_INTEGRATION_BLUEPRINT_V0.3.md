# LiquidHR Payroll Integration Blueprint
## v0.3 — Provider-neutral Payroll + Nmbrs

**Status:** Product/architecture baseline — ready for Phase 0/1 implementation planning  
**Version:** 0.3  
**Datum:** 7 september 2026  
**Product:** LiquidHR  
**Eerste payrollprovider:** Nmbrs  
**Doel:** Eén actuele master voor de externe payrollintegratie van LiquidHR, samengesteld uit de eerdere Payroll Provider Contract v0.1, Payroll Integration Blueprint v0.2, impact-/architectuurscans, de Nmbrs-onboarding, de huidige testopzet en alle relevante productbesluiten uit de chats tot en met 7 september 2026.

> **Kernregel:** LiquidHR owns people and work; the payroll provider owns payroll.

> **Architectuurregel:** bouw geen “Nmbrs rechtstreeks in LiquidHR”. Bouw een provider-neutrale Payroll-laag waarvan Nmbrs de eerste adapter is.

---

# 0. Scope en relatie met andere Payroll-documenten

Dit document gaat primair over de **integratie tussen LiquidHR en externe payrollproviders**, beginnend met Nmbrs.

Het beschrijft:

- providercontract;
- connection- en credentialmodel;
- company/administration binding;
- HR Admin UX;
- security en permissions;
- sync preview/apply;
- employee/employment linking;
- audit en observability;
- disconnect/reconnect;
- fasering P0–P6;
- vaste Nmbrs-testfixture;
- impact op de lokale LiquidHR Control-app.

Dit document vervangt **niet** de aparte **LiquidHR Payroll NL Requirements v1.4** voor een eventuele native Nederlandse payrollengine. Die requirements beschrijven onder andere Continuous Payroll, Payroll by Exception, Payroll Health, fiscale rule sets, pensioen, loonaangifte, payment/output en shadow payroll.

De twee sporen moeten wel compatibel blijven:

1. **Nu:** LiquidHR koppelt veilig met externe payrollproviders.
2. **Later:** LiquidHR kan eventueel zelf meer payroll-capabilities leveren.
3. De integratielaag mag de toekomstige native Payroll NL-architectuur niet blokkeren.

---

# 1. Versiehistorie

## v0.1 — Payroll Provider Contract

De eerste baseline legde vast:

- generiek providercontract;
- Nmbrs alleen als adapter;
- maximaal één actieve payrollproviderverbinding per HR-groep, met historie;
- payrolldeelname per employment;
- capabilities, support en configuratie expliciet scheiden;
- generieke entity links;
- provider mappings los van core HR-data;
- source-of-truth per datadomein;
- preview vóór apply;
- auditbare sync runs/items;
- geen silent deletes;
- REST-only richting voor nieuwe Nmbrs-integratie;
- thin-slice implementatie;
- geen generieke ETL-designer;
- multi-company-ready;
- provider #2 moet later zonder fundamentele herbouw toegevoegd kunnen worden.

## v0.2 — Payroll Integration Blueprint

Toegevoegd:

- Payroll Control Center voor HR Admin vanaf Phase 0;
- vier vaste werkgebieden:
  - Overzicht
  - Medewerkers
  - Verschillen
  - Instellingen
- projection-based dashboard/read-model;
- expliciete health- en sync-operaties;
- technische diagnostics alleen waar passend, primair dev/staging/support;
- functionele taal voor eindgebruikers;
- readiness server-side bepaald;
- Verschillen gebaseerd op sync-runs/items;
- implementatie als verticale frontend/backend slices.

## v0.3 — huidige versie

Deze versie verwerkt daarnaast:

- de daadwerkelijke Nmbrs Developer Portal-setup;
- permanente `extdev` testomgeving;
- geregistreerde LiquidHR OAuth-app;
- productie callback- en legal URLs;
- Vercel server-side environmentvariabelen;
- de vaste testbinding `Test BV ↔ Demo BV`;
- de lege HR-groep als gecontroleerde syncfixture;
- één OAuth-verbinding met meerdere Nmbrs-administraties;
- expliciet onderscheid tussen:
  - provider verbinden;
  - administraties ophalen;
  - administratie koppelen;
  - administratie ontkoppelen;
  - volledige providerverbinding verbreken;
- Fase 1 zonder employee-read;
- Fase 2 baseline `8 × NEW`;
- reconnect die bestaande bindings waar mogelijk behoudt;
- Control-app als apart local-only platformbeheer;
- eerste-HR-Admin provisioning als later Control-app-gat;
- tenant-level provider health later wel zichtbaar in Control, maar nooit secrets of payroll employee data.

---

# 2. Productdoel

LiquidHR moet payrollsoftware kunnen koppelen zonder dat payrollproviders het core HR-datamodel vervuilen.

De integratie moet voor een HR Admin voelen als een normale LiquidHR-capability:

```text
LiquidHR HR-data
      ↓
Payroll Integration Layer
      ↓
Provider Adapter
      ↓
Nmbrs
```

De gebruiker hoeft geen technische OAuth-, API- of tokenconcepten te begrijpen.

De productflow moet uiteindelijk zijn:

```text
Verbinden
→ administraties kiezen
→ koppelen
→ gegevens controleren
→ verschillen begrijpen
→ gecontroleerd toepassen
→ daarna alleen uitzonderingen beheren
```

---

# 3. North stars

## 3.1 LiquidHR owns people and work

LiquidHR is leidend voor:

- medewerker/persoon;
- employment/dienstverband;
- organisatorische context;
- afdeling/functie;
- managerstructuur;
- HR-processen;
- HR-documenten;
- verlof/verzuim waar LiquidHR daarvoor de bron is;
- wijzigingen die ontstaan uit LiquidHR HR-workflows.

## 3.2 Payroll provider owns payroll

De externe payrollprovider is leidend voor provider-specifieke payrolluitvoering, waaronder afhankelijk van de provider:

- payrollberekening;
- payroll-specifieke identifiers;
- provider-specifieke componentcodes;
- payrollrun;
- loonstroken/resultaten;
- fiscale/provider-specifieke processing;
- provider-specifieke status/resultaatdata.

## 3.3 Geen providerlekkage in core HR

Geen verspreide velden zoals:

```text
employees.nmbrs_id
employments.nmbrs_code
administrations.nmbrs_company_number
```

Gebruik generieke integration links en mappings.

## 3.4 Human-controlled first

Inbound data wordt eerst:

```text
READ
→ NORMALIZE
→ COMPARE
→ PREVIEW
```

en pas daarna:

```text
APPLY
```

Geen automatische mutaties in de eerste fasen.

## 3.5 Payroll by Exception als eindrichting

De uiteindelijke gebruikerservaring is niet:

> “Doe telkens een synchronisatie.”

maar:

> “De payrollkoppeling is gezond; alleen deze uitzonderingen vragen aandacht.”

---

# 4. Organisatiemodel en scope

LiquidHR kent:

```text
Tenant
└── HR Group
    ├── Administration A
    ├── Administration B
    └── Administration C
```

Payrollintegraties worden in eerste instantie beheerd op **HR-group context**, omdat binnen één HR-groep meerdere administraties kunnen bestaan en gedeelde HR-inrichting geldt.

Regels:

- maximaal één actieve payrollproviderverbinding per HR-groep in de eerste productversie;
- historische/inactieve connections blijven auditbaar;
- één provider connection kan meerdere provider companies bevatten;
- iedere provider company wordt afzonderlijk aan een LiquidHR administration gebonden;
- een administration kan in de eerste versie maximaal één actieve payroll company binding hebben;
- een provider company kan in dezelfde connection maximaal één actieve LiquidHR administration binding hebben.

Voorbeeld:

```text
HR Group
└── Nmbrs Connection
    ├── Nmbrs Company A → LiquidHR Administration A
    ├── Nmbrs Company B → LiquidHR Administration B
    └── Nmbrs Company C → nog niet gekoppeld
```

---

# 5. Rollen en permissions

## 5.1 Phase 0–3

Alleen HR Admin beheert Payroll.

Nieuwe permissions:

```text
payroll:read
payroll:manage
```

### payroll:read

Geeft toegang tot:

- Payroll Overzicht;
- connection status;
- gekoppelde administraties;
- sync-resultaten;
- medewerkersoverzicht;
- verschillen;
- audit/readiness voor zover functioneel bedoeld.

### payroll:manage

Geeft aanvullend toegang tot:

- provider verbinden;
- provider opnieuw verbinden;
- providerverbinding controleren;
- administraties ophalen;
- company binding maken;
- binding ontkoppelen;
- volledige verbinding verbreken;
- preview starten;
- later apply-acties uitvoeren.

## 5.2 Managers en medewerkers

Phase 0–3:

- geen Payroll-beheer;
- geen providerconfiguratie;
- geen employee sync-beheer.

Latere self-service payrolloutput, zoals loonstroken, valt buiten dit integratie-MVP.

## 5.3 Autorisatie

Elke server-side operatie valideert minimaal:

- authenticated user;
- tenant;
- HR group;
- permission;
- relevante administration scope;
- actieve connection/binding.

Frontend visibility is nooit de security boundary.

---

# 6. Payroll Control Center — vaste informatiearchitectuur

Payroll krijgt vanaf Phase 0 een eigen HR Admin-workspace.

```text
Payroll
├── Overzicht
├── Medewerkers
├── Verschillen
└── Instellingen
```

Deze structuur blijft bewust stabiel over de fasen.

---

# 7. Payroll → Overzicht

## Phase 0

Toont:

- moduleintroductie;
- status “Nog geen salarisprovider verbonden”;
- CTA `Payroll instellen`.

## Phase 1

Toont projection-based:

- provider;
- connection status;
- aantal gekoppelde administraties;
- laatste connection check;
- eventuele actie vereist.

Belangrijk:

- dashboardrender doet niet bij iedere page load een live Nmbrs-call;
- health is een opgeslagen/projected status;
- expliciete `Verbinding controleren`-operatie mag wel live controleren.

---

# 8. Payroll → Medewerkers

## Phase 0–1

Placeholder/lege state.

Geen medewerkers worden in Phase 1 opgehaald.

## Phase 2

Wordt de primaire preview-workspace:

- medewerkers gevonden bij provider;
- huidige matchstatus;
- relevante LiquidHR kandidaat;
- verschillen;
- actie/status.

---

# 9. Payroll → Verschillen

## Phase 0–1

Placeholder.

## Phase 2+

Wordt gevoed door `payroll_sync_runs`, `payroll_sync_items` en `payroll_sync_issues`.

Functionele categorieën:

```text
NEW
MATCHED
PROBABLE_MATCH
CONFLICT
EXCLUDED
```

Technische states kunnen later bestaan, maar de HR Admin ziet primair begrijpelijke functionele taal.

---

# 10. Payroll → Instellingen

Dit is in Phase 0/1 de actieve beheerworkspace.

```text
Payroll → Instellingen
└── Salarisproviders
    └── Nmbrs
```

Voor Nmbrs:

- providerstatus;
- `Verbinden met Nmbrs`;
- `Verbinding controleren`;
- `Administraties ophalen`;
- overzicht beschikbare provider companies;
- overzicht gekoppelde administraties;
- binding detail;
- `Administratie ontkoppelen`;
- `Opnieuw verbinden`;
- `Nmbrs-verbinding verbreken`.

---

# 11. Provider-neutral contract

LiquidHR featurecode praat niet rechtstreeks met Nmbrs.

Conceptueel:

```ts
interface PayrollProvider {
  getCapabilities(): PayrollProviderCapabilities
  createAuthorizationRequest?(context): Promise<AuthorizationRequest>
  exchangeAuthorizationCode?(input): Promise<ProviderCredentials>
  refreshCredentials?(credentials): Promise<ProviderCredentials>
  disconnect?(context): Promise<void>
  getConnectionHealth(context): Promise<ConnectionHealth>
  listCompanies(context): Promise<ProviderCompany[]>
  listEmployees?(context, company): Promise<CanonicalPayrollEmployee[]>

  // Later
  createEmployee?(...)
  updateEmployee?(...)
  listPayrollRuns?(...)
}
```

Niet iedere provider hoeft iedere capability te ondersteunen.

Voorbeeld-capabilities:

```text
AUTH_OAUTH
COMPANY_DISCOVERY
EMPLOYEE_READ
EMPLOYEE_WRITE
EMPLOYMENT_READ
EMPLOYMENT_WRITE
PAYROLL_RESULT_READ
```

---

# 12. Nmbrs adapter

Nmbrs is de eerste implementatie van het providercontract.

Provider code blijft geïsoleerd, conceptueel:

```text
lib/payroll/
├── domain/
├── services/
├── repositories/
├── providers/
│   └── nmbrs/
│       ├── client
│       ├── oauth
│       ├── mapper
│       └── provider
└── ...
```

De precieze repo-indeling volgt de bestaande LiquidHR-architectuur en wordt pas na impactscan definitief gekozen.

---

# 13. Backend/API-boundary

Interne frontendroutes zijn generiek.

Niet:

```text
/api/nmbrs/companies
/api/nmbrs/employees
```

Wel bijvoorbeeld:

```text
/api/payroll/providers
/api/payroll/connections
/api/payroll/connections/{connectionId}
/api/payroll/connections/{connectionId}/health
/api/payroll/connections/{connectionId}/companies
/api/payroll/company-bindings
/api/payroll/sync-runs
```

Provider callback is de logische uitzondering:

```text
/api/payroll/providers/nmbrs/callback
```

Die route is extern geregistreerd en mag daarom provider-specifiek zijn.

---

# 14. Datamodel — Phase 0 foundation

## 14.1 `payroll_providers`

Catalogus van providers.

```text
id
code
name
is_active
capabilities
created_at
updated_at
```

Voorbeeld:

```text
NMBRS
```

## 14.2 `payroll_connections`

Representeert de providerverbinding van een HR-groep.

```text
id
tenant_id
hr_group_id
provider_id
status
connected_at
connected_by_user_id
last_checked_at
last_error_code
last_error_at
disconnected_at
created_at
updated_at
```

Connection status:

```text
NOT_CONNECTED
CONNECTING
CONNECTED
ACTION_REQUIRED
ERROR
DISCONNECTED
```

## 14.3 `payroll_connection_credentials`

Credentials staan los van functionele connectionmetadata.

```text
connection_id
credential_version
encrypted_access_token
encrypted_refresh_token
expires_at
provider_metadata
created_at
updated_at
```

Regels:

- server-only;
- nooit in browser-response;
- nooit in client component;
- nooit in auditpayload;
- nooit in application logs;
- versleuteld opslaan;
- secret-management/key strategy vóór productie expliciet vastleggen.

## 14.4 `payroll_company_bindings`

```text
LiquidHR Administration
↕
Provider Company
```

Minimaal:

```text
id
tenant_id
hr_group_id
connection_id
administration_id
external_company_id
external_company_display_name
status
bound_at
bound_by_user_id
last_seen_at
unbound_at
created_at
updated_at
```

Technical provider ID is de integratiesleutel.

Bedrijfsnaam is alleen displaymetadata.

## 14.5 `payroll_sync_runs`

```text
id
tenant_id
hr_group_id
connection_id
company_binding_id
mode
status
started_at
completed_at
started_by_user_id
summary
error_code
```

Modes later minimaal:

```text
PREVIEW
APPLY
```

## 14.6 `payroll_sync_items`

```text
id
sync_run_id
entity_type
external_entity_id
local_entity_id
match_status
decision_status
normalized_payload
difference_summary
created_at
updated_at
```

Gevoelige providerpayloads worden niet onbeperkt als raw JSON opgeslagen.

## 14.7 `payroll_sync_issues`

```text
id
sync_run_id
sync_item_id
code
severity
message
technical_reference
created_at
```

---

# 15. Phase 3 datamodel

## 15.1 `payroll_entity_links`

```text
provider
connection
entity_type
external_entity_id
local_entity_id
status
linked_at
```

Entity types later bijvoorbeeld:

```text
EMPLOYEE
EMPLOYMENT
COMPANY
PAYROLL_COMPONENT
```

Geen Nmbrs-ID op core employee tabel.

## 15.2 `employment_payroll_settings`

Payroll participation hoort bij employment, niet alleen bij employee.

```text
employment_id
participates_in_payroll
company_binding_id
effective_from
effective_to
status
```

Dit ondersteunt één persoon met meerdere/parallelle dienstverbanden.

---

# 16. Source-of-truth matrix

| Datadomein | Primair systeem | Opmerking |
|---|---|---|
| Persoon/core medewerker | LiquidHR | bestaande HR-bron |
| Employment | LiquidHR | inclusief wijzigingen |
| Afdeling/functie/manager | LiquidHR | work context |
| LiquidHR HR-processen | LiquidHR | nooit door provider overschrijven |
| Provider company ID | Provider | opgeslagen als external link |
| Provider employee ID | Provider | opgeslagen als external link |
| Payroll-specifieke processing | Payrollprovider | provider ownership |
| Payrollresultaat | Payrollprovider | zolang externe provider de payroll uitvoert |
| Connection/binding/sync state | LiquidHR | integration control plane |

Bij eerste onboarding/import kan providerdata LiquidHR-data helpen creëren, maar daarna moet ownership expliciet blijven.

Geen “last write wins” zonder datadomeinbeleid.

---

# 17. Phase 0 — Payroll Foundation

## Doel

De volledige LiquidHR payrollintegratie-foundation neerzetten zonder externe Nmbrs-call.

## Scope

1. module `PAYROLL`;
2. permissions `payroll:read` en `payroll:manage`;
3. alleen HR Admin in P0–P3;
4. hoofdnav Payroll;
5. vier vaste views;
6. provider-neutral domain/service contract;
7. Nmbrs adapter skeleton;
8. persistence voor provider/connection/credentials/company binding;
9. sync-run foundation voor latere fases;
10. audit events;
11. status-/readinessmodel;
12. server-side boundaries.

## UX

### Overzicht

```text
Nog geen salarisprovider verbonden
[Payroll instellen]
```

### Medewerkers

```text
Beschikbaar nadat een salarisadministratie is gekoppeld.
```

### Verschillen

```text
Nog geen controles uitgevoerd.
```

### Instellingen

```text
Nmbrs
Niet verbonden

Verbind LiquidHR met Nmbrs om salarisadministraties te koppelen.

[Verbinden]
```

In P0 mag de knop nog geen echte externe flow uitvoeren.

## Geen Phase 0 scope

- OAuth;
- Nmbrs API-call;
- company discovery;
- employee read;
- employee write;
- employment write;
- matching;
- import;
- scheduled sync;
- payrollresultaten;
- native payrollengine.

## Phase 0 exit criteria

- permissions werken server-side;
- Payroll module zichtbaar voor juiste rol;
- niet-HR Admin heeft geen beheer;
- provider-neutral contract bestaat;
- Nmbrs adapter skeleton bestaat;
- connection/binding persistence bestaat;
- audit foundation bestaat;
- geen secrets naar browser;
- geen externe Nmbrs-call nodig om P0 groen te maken.

---

# 18. Phase 1 — Connect & Administration Binding

## Doel

Een HR Admin kan een echte Nmbrs-verbinding maken, de beschikbare Nmbrs-administraties ophalen en één of meer daarvan aan LiquidHR-administraties koppelen.

**Geen employee sync in Phase 1.**

## 18.1 Stap 1 — Verbinden met Nmbrs

```text
HR Admin
→ Payroll
→ Instellingen
→ Nmbrs
→ Verbinden met Nmbrs
→ Nmbrs login/consent
→ LiquidHR callback
→ server-side token exchange
→ connection opslaan
→ health-check
→ terug naar instellingen
```

OAuth:

- Authorization Code Flow;
- client secret alleen server-side;
- refresh capability nodig;
- minimale scopes/least privilege;
- actuele Nmbrs OIDC/API-documentatie is leidend bij implementatie.

Callback:

```text
https://liquid-hr-hr-suite.vercel.app/api/payroll/providers/nmbrs/callback
```

## 18.2 Stap 2 — Verbinding controleren

Na OAuth:

```text
Nmbrs
Verbonden

Verbonden op: ...
Verbonden door: ...
Status: Gezond
Laatste controle: ...

[Verbinding opnieuw controleren]
```

Health is opgeslagen als projectie.

Een expliciete controle kan live providercommunicatie uitvoeren.

## 18.3 Stap 3 — Administraties ophalen

CTA:

```text
[Administraties ophalen]
```

LiquidHR haalt alleen provider company/administration metadata op.

**Geen medewerkers.**

Resultaat:

| Nmbrs-administratie | Providerstatus | LiquidHR-koppeling |
|---|---|---|
| Demo BV | Beschikbaar | Niet gekoppeld |
| Company B | Beschikbaar | Administration B |
| Company C | Niet beschikbaar | — |

Opgeslagen metadata minimaal:

```text
external_company_id
display_name
availability/status
last_seen_at
```

## 18.4 Stap 4 — Administration binding

Per provider company:

```text
[Koppelen aan LiquidHR]
```

HR Admin kiest een administration binnen de huidige HR-groep.

```text
Nmbrs: Demo BV
LiquidHR: Test BV

[Koppelen]
```

Validaties:

- current tenant;
- current HR group;
- `payroll:manage`;
- administration hoort bij HR group;
- provider connection is actief;
- provider company is beschikbaar;
- provider company niet reeds actief gekoppeld;
- LiquidHR administration niet reeds aan andere actieve payroll company gekoppeld.

## 18.5 Stap 5 — Verslag

Na discovery:

```text
Nmbrs gecontroleerd

3 administraties gevonden
1 gekoppeld
2 niet gekoppeld
0 fouten
```

Na binding:

```text
Koppeling voltooid

Demo BV is gekoppeld aan Test BV.

Status: Gereed voor gegevenscontrole
```

## 18.6 Overzicht gekoppelde administraties

Onder Payroll → Instellingen → Nmbrs:

| LiquidHR | Nmbrs | Status | Laatste controle |
|---|---|---|---|
| Test BV | Demo BV | Gezond | Zojuist |

Detail bevat:

- LiquidHR administration;
- provider;
- provider company display name;
- provider technical company ID;
- status;
- binding date;
- bound by;
- last seen;
- connection health;
- relevante capabilities;
- laatste functionele fout indien aanwezig.

Geen employee/payroll data.

## 18.7 Administratie ontkoppelen

Betekenis:

- alleen company binding wordt gedeactiveerd;
- OAuth connection blijft bestaan;
- andere company bindings blijven actief;
- LiquidHR employee data wordt niet verwijderd;
- provider data wordt niet verwijderd;
- historische links/audit blijven traceerbaar.

## 18.8 Volledige Nmbrs-verbinding verbreken

Betekenis:

- hele provider connection wordt gedeactiveerd;
- actieve company bindings onder die connection worden inactief;
- credentials worden ongeldig gemaakt/verwijderd volgens securitybeleid;
- provider revoke wordt uitgevoerd indien Nmbrs dit betrouwbaar ondersteunt;
- geen LiquidHR HR-data verwijderen;
- audit event schrijven.

## 18.9 Reconnect

Gebruik bij:

- consent verlopen;
- refresh token ongeldig;
- accountrechten gewijzigd;
- connection in `ACTION_REQUIRED`.

```text
Opnieuw verbinden
→ nieuwe authorization
→ nieuwe credentials
→ companies opnieuw valideren
→ bestaande bindings op technical external IDs hergebruiken indien nog geldig
```

Reconnect mag niet standaard alle bindings weggooien.

## 18.10 Foutscenario's

### Provider tijdelijk niet bereikbaar

> LiquidHR kon Nmbrs niet bereiken. Probeer later opnieuw.

### Geen administraties beschikbaar

> De verbonden Nmbrs-gebruiker heeft geen beschikbare salarisadministraties.

### Rechten gewijzigd

> Deze Nmbrs-administratie is niet langer beschikbaar voor de huidige verbinding.

### Toestemming verlopen

> De Nmbrs-verbinding moet opnieuw worden geautoriseerd.

Geen technische `401`, `invalid_grant` of stacktrace als primaire gebruikersmelding.

## 18.11 Phase 1 expliciet niet

- medewerkers ophalen;
- BSN ophalen voor matching;
- employee compare;
- employee import;
- employment import;
- data muteren in LiquidHR;
- data muteren in Nmbrs;
- scheduled sync.

Na Phase 1 blijft de gekozen LiquidHR-testgroep leeg.

---

# 19. Vaste Nmbrs testfixture

## LiquidHR

```text
Tenant: De Sterren holding
HR Group: TEST (leeg)
HR Group code: TEST-BOUNDARY
Administration: Test BV
```

Huidige fixture bij selectie:

```text
Administrations: 1
Employees: 0
Employments: 0
Departments: 0
Jobs: 0
Employee administration assignments: 0
Employment salaries: 0
Leave requests: 0
Absence cases: 0
Company documents: 0
```

Bestaande test-user-access blijft staan voor role/authorization tests.

**Niet legen. Niet hernoemen voor de eerste integration baseline.**

## Nmbrs

```text
Environment: extdev developer/test account
Company: Demo BV
Employees: 8 demo employees
```

## Phase 1 acceptance binding

```text
LiquidHR Test BV
        ↕
Nmbrs Demo BV
```

Naamgelijkheid is bewust geen vereiste.

Binding gebeurt op technische provider-ID.

---

# 20. Phase 2 — Read & Compare

## Doel

Provideremployees lezen en vergelijken zonder LiquidHR-data te muteren.

```text
Nmbrs
→ READ
→ adapter mapping
→ CanonicalPayrollEmployee
→ compare
→ SyncRun PREVIEW
→ SyncItems
→ Medewerkers/Verschillen
```

## Eerste vaste acceptance test

Omdat `TEST (leeg)` nul medewerkers heeft:

```text
Nmbrs Demo BV: 8 medewerkers
LiquidHR Test BV: 0 medewerkers
```

Verwacht:

```text
8 × NEW
```

## Matchingcategorieën

```text
NEW
MATCHED
PROBABLE_MATCH
CONFLICT
EXCLUDED
```

## Gecontroleerde vervolgfixture

Na de `8 × NEW` baseline creëren we bewust:

- één zekere match;
- één probable match;
- één conflict;
- resterende medewerkers new.

## Privacy/matching

- BSN is geen automatische match-key;
- dataminimalisatie is leidend;
- alleen velden ophalen die voor compare daadwerkelijk nodig zijn;
- matchingalgoritme en confidence moeten uitlegbaar zijn;
- twijfel wordt nooit stil als match toegepast.

## Phase 2 geen writes

Geen:

- employee insert;
- employment insert;
- provider write;
- silent updates.

---

# 21. Canonical employee model — Phase 2

Providerpayload wordt eerst vertaald naar een beperkte provider-neutrale representatie.

Conceptueel:

```text
CanonicalPayrollEmployee
- externalEmployeeId
- employeeNumber?
- name fields required for display/compare
- relevant email fields?
- birthDate? only if justified
- employment summary needed for compare
- providerCompanyId
- source metadata
```

De precieze minimale set wordt vóór Phase 2 geïmplementeerd op basis van:

1. huidige LiquidHR employee/employment model;
2. beschikbare Nmbrs REST fields;
3. matching requirements;
4. privacy/dataminimalisatie.

Raw providerpayload is niet het canonical model.

---

# 22. Phase 3 — Controlled Apply

HR Admin kan preview-resultaten gecontroleerd verwerken.

Per item mogelijke acties:

```text
Importeren als nieuwe medewerker
Koppelen aan bestaande medewerker
Verschil toepassen
Negeren
Uitsluiten
```

Belangrijk:

Payrollintegration code schrijft niet rechtstreeks in `employees`/`employments`.

Apply loopt door bestaande LiquidHR domain services en dezelfde:

- validation;
- permission checks;
- tenant/HR-group scope;
- audit;
- business rules.

Na succesvolle apply ontstaan generieke `payroll_entity_links`.

Geen provider-ID in core employee tabel.

---

# 23. Phase 4 — Repeat Sync

Doel:

- bestaande links gebruiken;
- alleen relevante wijzigingen vergelijken;
- nieuwe provideremployees ontdekken;
- gewijzigde providerrecords signaleren;
- conflicts opnieuw aanbieden;
- sync history tonen;
- errors herstartbaar maken.

Principes:

- idempotency;
- retry;
- geen duplicate imports;
- geen silent deletes;
- deleted/inactive providerentity wordt een expliciete status/issue;
- incremental waar mogelijk.

---

# 24. Phase 5 — Controlled Outbound

Pas nadat inbound betrouwbaar is.

Mogelijke LiquidHR → provider-events later:

- nieuwe medewerker;
- nieuwe employment;
- relevante persoonsgegevens;
- employment wijziging;
- uren/variabele mutaties;
- andere expliciet ondersteunde data.

Regels:

- write capability per provider expliciet;
- aparte OAuth/write scopes;
- idempotent mutaties;
- audit;
- retry;
- preview/validation waar relevant;
- duidelijke source-of-truth;
- geen brede bidirectionele sync zonder domeinregels.

---

# 25. Phase 6 — Payroll by Exception

Productmatige eindrichting:

```text
Nmbrs — Gezond

3 administraties gekoppeld
Laatste sync: 09:42

0 nieuwe medewerkers
2 verschillen
1 blokkade
```

De gebruiker werkt dan primair vanuit:

- readiness;
- exceptions;
- conflicts;
- deadlines;
- health.

Dit sluit aan op de bredere LiquidHR Payroll NL productbelofte:

> Payroll by Exception + Explainable + Shadow-ready.

---

# 26. Security

## Server-side environmentvariables

```text
NMBRS_SUBSCRIPTION_KEY
NMBRS_SUBSCRIPTION_KEY_SECONDARY
NMBRS_CLIENT_ID
NMBRS_CLIENT_SECRET
```

Primary subscription key wordt actief gebruikt.

Secondary key is reserve/rotatie.

Geen waarden in:

- Git;
- client bundles;
- browserresponses;
- logs;
- screenshots/documentatie;
- auditpayloads.

## OAuth tokens

Access- en refresh tokens:

- per connection;
- encrypted at rest;
- server-only;
- automatisch refreshbaar;
- rotation-safe;
- nooit naar frontend.

## Logging

Wel:

```text
provider=NMBRS
operation=listCompanies
status=failed
httpStatus=401
```

Niet:

```text
access_token
refresh_token
client_secret
subscription_key
complete sensitive provider payload
```

## RLS / server authorization

Payrolldata volgt:

- tenant isolation;
- HR-group scope;
- administration validation;
- permission-based server actions/APIs;
- bestaande LiquidHR securitypatterns.

---

# 27. Audit

Vanaf Phase 0 minimaal:

```text
PAYROLL_CONNECTION_CREATED
PAYROLL_CONNECTION_CHECKED
PAYROLL_CONNECTION_RECONNECTED
PAYROLL_CONNECTION_DISCONNECTED
PAYROLL_COMPANIES_DISCOVERED
PAYROLL_COMPANY_BOUND
PAYROLL_COMPANY_UNBOUND
PAYROLL_SYNC_PREVIEW_STARTED
PAYROLL_SYNC_PREVIEW_COMPLETED
PAYROLL_SYNC_APPLY_STARTED
PAYROLL_SYNC_APPLY_COMPLETED
```

Audit bevat actor, tenant, HR group, provider, administration indien relevant, references, datum/tijd en functioneel resultaat.

Nooit credentials.

---

# 28. Observability & diagnostics

Minimaal later meten:

- connection health;
- laatste succesvolle providercall;
- laatste fout;
- company discovery latency;
- sync duration;
- item counts;
- failed/retried operations;
- provider rate-limit errors;
- token refresh failures.

Eindgebruiker ziet functionele status.

Technische details zijn voor dev/staging/support/observability.

---

# 29. Nmbrs huidige setupstatus

Reeds gerealiseerd:

- Nmbrs Developer Portal-account;
- Development/Starter API subscription;
- Primary en Secondary subscription key opgeslagen;
- LiquidHR als Web integration geregistreerd;
- Client ID beschikbaar;
- Client Secret veilig opgeslagen;
- callback URL geregistreerd;
- icon URL beschikbaar;
- privacy URL beschikbaar;
- terms URL beschikbaar;
- permanente extdev testomgeving aangemaakt met affiliate code `demo`;
- Nmbrs testomgeving bevat `Demo BV` met bruikbare demodata.

Publieke URLs:

```text
Redirect:
https://liquid-hr-hr-suite.vercel.app/api/payroll/providers/nmbrs/callback

Icon:
https://liquid-hr-hr-suite.vercel.app/icon.svg

Privacy:
https://liquid-hr-hr-suite.vercel.app/privacy

Terms:
https://liquid-hr-hr-suite.vercel.app/terms
```

De callback heeft vóór Phase 1 nog geen functionele OAuth-afhandeling.

---

# 30. Nmbrs implementation guardrails

Bij implementatie bepaalt de **actuele Nmbrs-documentatie** opnieuw de concrete wire-details.

Niet blind overnemen uit oudere interne notities:

- oude SOAP-route;
- oude generic scope strings;
- onbevestigde endpointnamen;
- onbevestigde subscription-headernaam;
- oude identity URL-voorbeelden.

Actuele richting:

- nieuwe integraties REST;
- OAuth 2 Authorization Code Flow;
- `offline_access` nodig als refresh token vereist is;
- least-privilege read scopes voor P1/P2;
- write scopes pas bij outbound fase;
- technische Nmbrs IDs gebruiken in bindings.

Authorize/token endpoints, scope strings en subscription-key header worden tijdens Phase 1 tegen de actuele officiële API-reference vastgezet en getest.

---

# 31. Disconnect-semantiek

## Company binding ontkoppelen

```text
Demo BV ↔ Test BV
```

wordt inactief.

Blijft bestaan:

- provider OAuth connection;
- andere bindings;
- historische audit;
- bestaande LiquidHR HR-data;
- historische entity links.

## Provider connection verbreken

De hele Nmbrs-connection wordt inactief.

Gevolg:

- alle actieve bindings onder connection inactief;
- credentials gedeactiveerd/verwijderd conform beleid;
- provider revoke indien ondersteund;
- historical state blijft auditbaar;
- geen HR-data delete.

---

# 32. Delete- en deactivation-regels

> Geen silent deletes.

Voorbeelden:

- provider company verdwijnt → issue/status;
- provider employee verdwijnt → issue/inactive candidate;
- binding ontkoppeld → links/history behouden;
- connection verbroken → data niet cascade verwijderen alsof ze nooit bestond.

Hard delete alleen als expliciete retention/delete-usecase dat vereist.

---

# 33. Control-app — apart spoor

LiquidHR Control draait voorlopig local-only.

Huidige scope:

- tenant aanmaken;
- administraties;
- HR-groepen;
- lifecycle;
- usage/storage;
- audit;
- tijdelijke read-only support.

Belangrijk huidig gat:

```text
Primary contact e-mail opslaan: JA
Echte Auth-user aanmaken/inviten: NEE
HR Admin role/membership provisionen: NEE
```

Voor echte klantonboarding later:

1. eerste HR Admin invite;
2. profile/user provisioning;
3. tenant membership;
4. `TENANT_ADMIN`/HR Admin;
5. HR-group access;
6. administration access;
7. modules/licentie.

## Payroll in Control later

Wel tonen:

```text
Provider: Nmbrs
Connection: Connected
Bindings: 2
Health: Healthy
Last sync: ...
Module: Active
```

Niet tonen:

- OAuth tokens;
- client secrets;
- subscription keys;
- BSN;
- salarissen;
- provider employee payload;
- payrolldetails.

OAuth koppelen blijft een HR Admin-actie in de normale HR Suite.

---

# 34. Phase 0 acceptance criteria

| Test | Verwacht |
|---|---|
| HR Admin ziet Payroll | PASS |
| Niet-bevoegde rol kan Payroll niet beheren | PASS |
| Vier Payroll-views bestaan | PASS |
| Nmbrs providerkaart bestaat | PASS |
| Providercontract is generiek | PASS |
| Connection/binding persistence bestaat | PASS |
| Secrets zijn server-only | PASS |
| Auditfoundation bestaat | PASS |
| Geen externe Nmbrs-call nodig | PASS |
| Geen employee-mutatie | PASS |

---

# 35. Phase 1 acceptance criteria

Vaste end-to-end flow:

```text
HR Admin
→ Payroll
→ Instellingen
→ Nmbrs
→ Verbinden
→ OAuth consent
→ callback
→ Connected
→ Administraties ophalen
→ Demo BV zichtbaar
→ Demo BV selecteren
→ Test BV kiezen
→ koppelen
→ verslag
→ binding zichtbaar
→ connection health Gezond
```

Checklist:

| Test | Verwacht |
|---|---|
| HR Admin kan Nmbrs verbinden | PASS |
| Niet-HR Admin kan niet verbinden | PASS |
| OAuth state/callback beveiligd | PASS |
| Token exchange server-side | PASS |
| Refresh token server-side | PASS |
| Company discovery werkt | PASS |
| Demo BV zichtbaar | PASS |
| Demo BV ↔ Test BV bindbaar | PASS |
| Binding blijft na refresh | PASS |
| Meerdere companies kunnen onder één connection | PASS |
| Binding afzonderlijk ontkoppelen | PASS |
| Hele connection verbreken | PASS |
| Reconnect behoudt geldige bindings | PASS |
| Audit wordt geschreven | PASS |
| Geen employees opgehaald | PASS |
| Test BV blijft 0 employees | PASS |

---

# 36. Phase 2 acceptance criteria

Baseline:

```text
LiquidHR Test BV: 0 employees
Nmbrs Demo BV: 8 employees
```

Verwacht:

```text
8 NEW
0 MATCHED
0 PROBABLE_MATCH
0 CONFLICT
```

Daarna gecontroleerde scenariofixture voor alle matchcategorieën.

Geen apply in deze testfase.

---

# 37. Besluitenregister

## D-001
Payrollintegratie wordt provider-neutraal ontworpen.

## D-002
Nmbrs is provideradapter #1 en niet het core datamodel.

## D-003
Eerste versie ondersteunt maximaal één actieve payrollprovider per HR-groep.

## D-004
Een connection kan meerdere provider companies bevatten.

## D-005
Company binding gebeurt per LiquidHR administration.

## D-006
Payrolldeelname wordt per employment gemodelleerd.

## D-007
Provider capabilities zijn expliciet.

## D-008
Provider entity IDs worden via generieke links opgeslagen.

## D-009
Mappings zijn los van core HR-records.

## D-010
Source-of-truth wordt per datadomein vastgelegd.

## D-011
Inbound gebruikt preview vóór apply.

## D-012
Syncs zijn auditable via runs/items/issues.

## D-013
Geen silent deletes.

## D-014
Nieuwe Nmbrs-integratie is REST-georiënteerd.

## D-015
MVP is een thin slice en geen generieke integratie-/ETL-builder.

## D-016
Architectuur is multi-company-ready.

## D-017
Provider #2 moet zonder core rebuild mogelijk zijn.

## D-018
Apply gebruikt bestaande LiquidHR domain services.

## D-019
Credentials zijn gescheiden van connectionmetadata.

## D-020
Technische provider IDs zijn leidend, niet namen/nummers die kunnen wijzigen.

## D-021
Payroll krijgt vanaf Phase 0 een eigen HR Admin Control Center.

## D-022
Vaste views: Overzicht, Medewerkers, Verschillen, Instellingen.

## D-023
Dashboard gebruikt projections en niet automatisch live providercalls.

## D-024
Health/sync zijn expliciete operaties.

## D-025
Technische diagnostics zijn niet de primaire HR Admin UX.

## D-026
Functionele taal staat voorop bij fouten en verschillen.

## D-027
Readiness wordt server-side bepaald.

## D-028
Verschillen zijn afgeleid van SyncRuns/SyncItems.

## D-029
Implementatie gebeurt in verticale frontend/backend slices.

## D-030
P0 maakt geen externe providercalls.

## D-031
P1 splitst provider connect en administration binding expliciet.

## D-032
P1 haalt alleen company/admin metadata op, geen employees.

## D-033
Eén OAuth connection ondersteunt meerdere company bindings.

## D-034
Company unbind en provider disconnect zijn twee aparte acties.

## D-035
Reconnect probeert bindings via technical IDs te behouden.

## D-036
Vaste P1 testbinding is `Test BV ↔ Demo BV`.

## D-037
De LiquidHR testgroep `TEST (leeg)` wordt vóór de eerste sync niet verder opgeschoond.

## D-038
P2 baseline is `8 × NEW`.

## D-039
BSN is geen automatische employee match-key.

## D-040
P1/P2 zijn read-only richting employee/employment data.

## D-041
Outbound writes komen pas nadat inbound preview/apply betrouwbaar is.

## D-042
Control-app toont later alleen tenant-level payroll health, nooit secrets of payroll employee data.

---

# 38. Open technische beslissingen vóór/gedurende Phase 1

Bewust nog geen ingevulde aannames:

1. definitieve actuele Nmbrs authorize endpoint;
2. definitieve actuele Nmbrs token endpoint;
3. exacte P1 OAuth scopes;
4. exacte P2 employee-read scopes;
5. actuele subscription-key headernaam;
6. exacte Nmbrs company discovery endpoints/pagination;
7. token-encryption/key-management implementatie in LiquidHR;
8. provider revoke-semantiek bij disconnect;
9. refresh token rotationsemantiek;
10. rate-limit headers en retry/backoff;
11. exacte health-check call;
12. welke provider company metadata functioneel nuttig is;
13. minimale canonical employee fieldset voor Phase 2;
14. match confidence rules;
15. retentiontermijn voor normalized sync previewpayloads.

Deze worden tijdens implementatie tegen officiële docs en echte extdev responses vastgesteld.

---

# 39. Buildvolgorde

## Nu

```text
Phase 0
Foundation
↓
Phase 1
OAuth + company discovery + binding
↓
Release gate
Test BV ↔ Demo BV
```

## Daarna

```text
Phase 2
8 × NEW preview
↓
match/conflict fixture
↓
Phase 3
controlled apply
↓
Phase 4
repeat sync
↓
Phase 5
controlled outbound
↓
Phase 6
payroll by exception
```

Niet meerdere fasen tegelijk implementeren.

---

# 40. Definition of Ready — Phase 0/1 implementation

Voor start bouw:

- deze v0.3 baseline geaccepteerd;
- repo impactscan op actuele main;
- huidige Next.js lokale instructies/AGENTS gelezen;
- bestaande permission/RLS/domain-service patterns hergebruiken;
- secrets beschikbaar in server environment, niet in code;
- callback route geregistreerd;
- extdev account werkt;
- `Demo BV` beschikbaar;
- `TEST (leeg) / Test BV` beschikbaar;
- geen wijzigingen aan de local-only Control-app voor P0/P1;
- exacte Nmbrs wire-contractdetails tijdens implementatie officieel geverifieerd.

---

# 41. Definition of Done — Phase 1

Phase 1 is pas klaar als aantoonbaar:

1. HR Admin kan verbinden;
2. OAuth veilig round-tript;
3. credentials server-side blijven;
4. health-check werkt;
5. Nmbrs-administraties worden gevonden;
6. Demo BV wordt gevonden;
7. Demo BV kan aan Test BV worden gebonden;
8. binding is persistent;
9. overview/detail tonen correcte projectiestatus;
10. unbind werkt zonder dataverlies;
11. disconnect werkt zonder HR-dataverlies;
12. reconnect valideert bestaande bindings;
13. audit is compleet;
14. niet-HR Admin wordt server-side geweigerd;
15. er zijn nog steeds **0 medewerkers** in `TEST (leeg)`.

---

# 42. Samenvatting

De eerste LiquidHR Payroll-release bouwt nog geen salarisengine en nog geen bidirectionele synchronisatie.

We bouwen eerst de betrouwbare control plane:

```text
Provider-neutral Payroll
        ↓
Nmbrs OAuth Connection
        ↓
Company Discovery
        ↓
Company Binding
        ↓
Test BV ↔ Demo BV
```

Daarna bewijzen we veilig de datalaag:

```text
8 Nmbrs employees
        ↓
Preview
        ↓
8 NEW
```

Pas daarna krijgen gebruikers gecontroleerde apply-acties.

De ontwerpkeuze die in alle volgende fasen leidend blijft:

> **LiquidHR owns people and work; the payroll provider owns payroll.**

En de productrichting:

> **Van synchroniseren naar Payroll by Exception: LiquidHR laat vooral zien wat aandacht nodig heeft.**
