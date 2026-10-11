# LiquidHR Payroll — P2 Readiness

> **Historische momentopname — 2026-09-10.** Behouden als onderzoek- en ontwerpgeschiedenis, niet als actuele Payroll-requirement, releaseacceptatie of uitvoeringsmandaat. Goedgekeurde actuele requirements en later vastgelegde code zijn leidend. De genoemde `8 employees` / `8 NEW`-baseline, OAuth-scopes, providercontractdetails en P1-readiness zijn niet voor deze release herbevestigd. Herbeoordeel ze in een afzonderlijk geautoriseerde P2-taak. Dit document autoriseert geen live providerread, employeesynchronisatie, migratie, database- of payrollwrite, deployment of P2-implementatie.

**Datum:** 2026-09-10
**Scope:** alleen onderzoek, contractvastlegging en architectuur-readiness.
**Geen:** P2-code, migration, Supabase-write, deployment, Nmbrs employee-call, employee/employment-read of -write in de huidige run.

## Eindstatus

**PAYROLL P2 READINESS: READY WITH LIVE VALIDATION**

Het ontwerp is klaar om direct na P1 GREEN te implementeren. De resterende punten zijn verwachte runtime-validatiepunten, geen design- of architectuurblokkades: de actuele Demo BV-count/typeverdeling, de feitelijke scope-toekenning in het extdev-profiel, statussemantiek, rate-limitheaders en de concrete veldwaarden/nullability. Deze worden pas tijdens de geautoriseerde P2-read live bevestigd.

De vaste blueprint-baseline blijft:

```text
Nmbrs Demo BV:       8 employees
LiquidHR Test BV:    0 employees
P2 PREVIEW resultaat: 8 NEW
Core HR writes:       0
Provider writes:      0
```

De blueprint, de huidige P1-evidence en de bestaande domeinservices zijn als ontwerpbron gebruikt:

- `docs/requirements/payroll/LIQUIDHR_PAYROLL_INTEGRATION_BLUEPRINT_V0.3.md`
- `docs/delivery/PAYROLL_P0_P1_EVIDENCE.md`
- `apps/hr-suite/lib/payroll/providers/payroll-provider.ts`
- `apps/hr-suite/lib/payroll/domain/types.ts`
- `apps/hr-suite/lib/employees/employee-service.ts`
- `apps/hr-suite/lib/employees/employee-mappers.ts`
- `apps/hr-suite/lib/employment/employment-service.ts`
- `apps/hr-suite/lib/employment/schemas.ts`

## 1. Actueel officieel Nmbrs employee-read-contract

De actuele publieke Nmbrs REST-specificatie noemt de volgende production API-servers. De Stoplight-pagina's zijn JavaScript-gerenderd; de onderliggende officiële operationele specificatie is gecontroleerd op endpoint, parameters, security-scope, response envelope en schema. Er is geen endpoint aangeroepen.

### Primaire endpoints

| Doel | Endpoint | Response / bewezen velden | Officiële read-scope |
|---|---|---|---|
| Company employee list, current period | `GET https://api.nmbrsapp.com/api/companies/{companyId}/employees` | `pagination` + `data[]`; `employeeId`, `employeeBasicInfo.employeeNumber`, `firstName`, `firstNameInFull`, `prefix`, `initials`, `lastName`, `employeeType` | `employee.info.read` |
| Employee detail | `GET https://api.nmbrsapp.com/api/employees/{employeeId}` | `pagination` + `data[]`; `personalInfo`, birth/contact/partner/emergency data, manager, department, function, address | `employee.info.read` |
| Company personal-info history | `GET https://api.nmbrsapp.com/api/companies/{companyId}/employees/personalinfo` | `employeeId` + `info[]` met persoonlijke-perioden en `createdAt` | `employee.info.read` |
| Company employment history | `GET https://api.nmbrsapp.com/api/companies/{companyId}/employees/employments` | `employeeId` + `employments[]`; `employmentId`, `creationDate`, `startDate`, `endDate`, `seniorityDate`, `endContractReason`, `changedDate` | `employee.employment.read` |
| Company contract history | `GET https://api.nmbrsapp.com/api/companies/{companyId}/employees/contracts` | `employeeId` + `contracts[]`; `contractId`, `startDate`, `trialPeriod`, `endDate`, `indefinite`, `writtenContract`, `hoursPerWeek`, `createdAt` | `employee.employment.read` |

Officiële referenties: [Get employee list](https://nmbrs.stoplight.io/docs/nmbrs-restapi/a31578b069764-get-employee-list), [Get an employee](https://nmbrs.stoplight.io/docs/nmbrs-restapi/eea078fe0d752-get-an-employee), [Get employees history](https://nmbrs.stoplight.io/docs/nmbrs-restapi/3ab454020a1ff-get-employees-history), [Get employments history](https://nmbrs.stoplight.io/docs/nmbrs-restapi/e85d45e5901d0-get-employments-history) en [Get contracts history](https://nmbrs.stoplight.io/docs/nmbrs-restapi/d639580800a61-get-contracts-history).

Voor P2 is de company-scoped list het startpunt. Daardoor wordt alleen de geselecteerde, gebonden Demo BV gelezen; een employee-ID uit een andere company wordt niet als company-brede input aangenomen.

### Overige beschikbare employee-/employment-gerelateerde reads

De API-reference bevat daarnaast onder meer:

- departments: `GET /api/companies/{companyId}/employees/departments` met `departmentId`, code, description, `createdAt`, period;
- functions: `GET /api/companies/{companyId}/employees/functions` met `functionId`, code, description, `createdAt`, period;
- managers: `GET /api/companies/{companyId}/employees/managers` met `managerId`, first/last name, email, `createdAt`, period;
- schedules: `GET /api/companies/{companyId}/employees/schedules` met `scheduleId`, `startDate`, part-time percentage, hours/days per week en week-1/week-2-daguren;
- salaries: `GET /api/companies/{companyId}/employees/salaries` met salary ID, start date, type, value en salary-table/scale/step-informatie;
- labour-agreement settings, wage-tax settings, extra fields, user accounts, absences, documents, leave en payment/payroll-run gegevens.

Deze aanvullingen zijn geen onderdeel van de eerste P2-read. Vooral salaris, wage tax, absence, leave, documenten, bank/contact/private data en user accounts zijn niet nodig om de eerste compare te bewijzen. De relevante officiële voorbeelden zijn [departments](https://nmbrs.stoplight.io/docs/nmbrs-restapi/3f3746267a75f-get-employees-departments-history), [functions](https://nmbrs.stoplight.io/docs/nmbrs-restapi/9054b3e80cfd7-get-employees-functions-history), [schedules](https://nmbrs.stoplight.io/docs/nmbrs-restapi/5fc98754a2fcf-get-schedules-history) en [salaries](https://nmbrs.stoplight.io/docs/nmbrs-restapi/4a0a5684cb6b7-get-salaries-history).

## 2. OAuth-scopes voor P2 employee read

### Minimale scope per capability

| Scope | Nodig voor | Besluit |
|---|---|---|
| `employee.info.read` | employee list, personal-info history, employee detail, departments, functions, managers | Nodig voor employee-identiteit en eventuele beperkte match-enrichment |
| `employee.employment.read` | employment history en contract history; de officiële catalogus beschrijft ook salary/schedule onder deze read-capability | Nodig voor employment-status en datumssamenvatting; geen write-variant |
| `offline_access` | refresh token | Nmbrs noemt dit verplicht wanneer een refresh token nodig is |
| `company.info.read` | P1 company discovery en behoud van de bestaande connection-capability | Niet nodig door de employee-endpoints zelf, wel behouden bij een gecombineerde P1/P2 connection-token |

De officiële operationele security-definities noemen voor employee-info endpoints `employee.info` of `employee.info.read`, en voor employment/contract endpoints `employee.employment` of `employee.employment.read`. P2 vraagt uitsluitend de read-variant. De actuele [scope-catalogus](https://developer.payroll.nmbrs.com/docs/auth/scopes) noemt `offline_access` als mandatory en beschrijft `employee.info.read`, `employee.employment.read` en `company.info.read` als optionele scopes.

Voor een nieuwe gecombineerde P1/P2-authorize-request is het voorgestelde, least-privilege scope-value:

```text
offline_access employee.info.read employee.employment.read company.info.read
```

De scopes staan in één `scope`-parameter met spaties als separator. Er worden geen employee-write-, payment-, salary-write-, absence-, document- of andere P2-onnodige scopes toegevoegd.

### `nmbrs_api`-afwijking

De officiële [How To](https://developer.payroll.nmbrs.com/how-to) bevat nog `Scope: nmbrs_api`, terwijl de actuele scope-catalogus die naam niet toont. De actuele OIDC-discovery wordt door Nmbrs gepubliceerd via [`.well-known/openid-configuration`](https://identityservice.nmbrs.com/.well-known/openid-configuration) en is evenmin een voldoende bewijs dat `nmbrs_api` in de geregistreerde extdev-client bruikbaar is. De P1-evidence heeft bovendien vastgelegd dat de twee historische combinaties met `nmbrs`/`nmbrs_api` live als `Invalid scope` werden geweigerd.

Daarom is `nmbrs_api` geen onderdeel van het P2-ontwerp. De gecombineerde set hierboven moet na P1 GREEN één keer live tegen dezelfde registered extdev-app worden bevestigd; dat is een externe OAuth-gate, geen reden om de Payroll-architectuur te verbreden.

## 3. Pagination model

De employee, employment, contract en history endpoints gebruiken hetzelfde vormpatroon:

```json
{
  "pagination": {
    "pageNumber": 1,
    "pageSize": 20,
    "firstPage": "...",
    "lastPage": "...",
    "totalPages": 1,
    "totalRecords": 8,
    "nextPage": null,
    "previousPage": null
  },
  "data": []
}
```

Officieel vastgelegd in de schemas:

- `pageNumber`: integer, minimum `1`, default `1`;
- `pageSize`: integer, minimum `1`, default `20`, maximum `100`;
- response bevat `totalPages`, `totalRecords`, `nextPage` en `previousPage`;
- company employee list heeft optioneel `employeeType`, `employeeId` en `createdFrom`;
- employment history heeft optioneel `employeeId`, `createdFrom` en `changedFrom`;
- andere history endpoints hebben overeenkomstige `employeeId`/`createdFrom`-filters.

De adapter moet `nextPage` volgen tot `null`, met een harde run/page-limiet, duplicate-next-URL-detectie en een fout wanneer de pagina-sequentie niet vooruitgaat. `totalPages`/`totalRecords` zijn controle-evidence; een korte laatste pagina is niet op zichzelf voldoende om de run af te breken. Voor een complete P4-snapshot blijft een volledige company scan nodig: een incremental filter kan ontbrekende records niet detecteren.

## 4. Rate limits en retrygedrag

De officiële employee-list-specificatie documenteert HTTP `429 Too Many Requests` met:

- `42908 Too_Many_Calls`: de hoeveelheid calls ligt boven de threshold van het subscription plan;
- `42909 Quota_Exceeded`: de call-volume-quota is verbruikt.

De publieke specificatie die nu beschikbaar is noemt geen numerieke quota, geen betrouwbaar burst-budget en geen verplicht `Retry-After`-contract. De 429 response-schema's bevatten geen vast Retry-After-responseveld. Dat is een live contract-gap; er wordt geen Nmbrs-quota verzonnen.

Voorgesteld, bounded clientgedrag voor P2/P4:

1. pagina's sequentieel ophalen; geen parallelle request-per-employee-loop;
2. timeout, HTTP 429 en tijdelijke 5xx één bounded retry-policy laten volgen;
3. `Retry-After` honoreren wanneer de live response-header aanwezig en parsebaar is; anders exponential backoff met full jitter;
4. maximaal drie transportpogingen per read-run/page, daarna een typed retryable issue en een failed/incomplete run;
5. 400/401/403/404/422 niet blind retrien; bij 401 eerst één server-side token-refresh/replay volgens de bestaande P1-connection policy;
6. een gedeeltelijke preview nooit als complete snapshot publiceren;
7. de provider-errorcode en pagina-cursor intern vastleggen zonder access token, refresh token, subscription key of raw payload te loggen.

Dit is een LiquidHR resilience-proposal, geen door Nmbrs gegarandeerde SLA. Het eerste geautoriseerde P2-read moet status, headers en foutbody gesaneerd vastleggen.

## 5. Beschikbare employee fields

### Basic list

De company employee list levert:

- `employeeId` — UUID, employee unique identifier;
- `employeeBasicInfo.employeeNumber` — integer, door de gebruiker gedefinieerd en expliciet **niet uniek**;
- `firstName`;
- `firstNameInFull`;
- `prefix` — NL-only surname prefix;
- `initials`;
- `lastName`;
- `employeeType` — `applicant`, `newHire`, `payroll`, `formerPayroll`, `external`, `formerExternal` of `rejectedApplicant`.

De list-response beschrijft current-period data. De lijst bevat geen business email, birth date, private email, BSN, bankgegevens of adresgegevens; daarvoor bestaan bredere detail/history endpoints.

### Detail/personal-info

De officiële detail/history schemas maken daarnaast beschikbaar:

- identity/basic: employee number, first name/full first name, prefix, initials, last name, employee type;
- birth: birth date, birth country code/description, nationality code/description, deceased date, gender;
- contact: private email, business email, business phone/mobile, private phone/mobile, other phone;
- partner/marital: partner prefix/name/ascription/marital status;
- emergency: contact, phone, relationship;
- period and `createdAt`;
- manager: ID, number, name, gender, department/function, phone/cell/fax/email;
- department/function objects;
- address: ID, default flag, type, street, house number/addition, postal code, city, province/state, country, period and `createdAt`.

Deze fields zijn beschikbaar, maar beschikbaarheid is niet hetzelfde als P2-noodzaak. De eerste preview bewaart geen raw detail-object.

## 6. Beschikbare employment/service fields

### Employment

`GET /api/companies/{companyId}/employees/employments` levert per `employeeId` nul, één of meerdere employment-history-items:

- `employmentId`;
- `creationDate`;
- `startDate`;
- `endDate`;
- `seniorityDate`;
- `endContractReason.code` en `endContractReason.reason`;
- `changedDate`.

Dit endpoint bevat volgens de huidige schema geen Nmbrs employment number. `employmentId` is de technische externe employment-identiteit; de LiquidHR employment number is een ander domeinveld.

### Contract

`GET /api/companies/{companyId}/employees/contracts` levert contractgeschiedenis met:

- `contractId`;
- `startDate`, `endDate`;
- `trialPeriod`;
- `indefinite`;
- `writtenContract` (NL-only);
- `hoursPerWeek` (NL-only);
- `createdAt`.

### Related service/period data

De API-reference maakt ook periodieke department-, function-, manager-, schedule-, salary-, labour-agreement-, wage-tax-, hours-, absence-, leave-, document- en payroll-rungegevens beschikbaar. Voor P2 is alleen employmentstatus/datum-context gerechtvaardigd. Salary value, salary table, wage tax, hour components, absence/medical context, leave, documents, bank, private contact, user accounts en payroll output horen niet in de eerste compare.

## 7. Fields die voor de eerste LiquidHR compare werkelijk nodig zijn

### Baseline `8 NEW`

Omdat `LiquidHR Test BV` leeg is, zijn voor de exacte eerste acceptance alleen nodig:

1. gebonden `providerCompanyId` / Demo BV-context;
2. `externalEmployeeId`;
3. `externalEmployeeNumber` als display- en later optioneel review-signaal, nooit als unieke sleutel;
4. voornaam/full first name, prefix, initials en achternaam;
5. de bronclassificatie `employeeType`;
6. optioneel een minimale employment summary met externe employment-ID en start/einddatum voor statusweergave.

Er is in dit scenario geen local candidate die business email, birth date of andere enrichment rechtvaardigt. De eerste P2-run moet dus geen employee-detail/personal-info endpoint aanroepen alleen om acht `NEW`-regels te tonen.

### Algemene compare/P4

Wanneer er wél bestaande LiquidHR-candidates zijn, kan een tweede, expliciet gemotiveerde enrichmentstap business email, birth date en eventueel initials ophalen. De server parseert en bewaart uitsluitend de allowlist; het brede Nmbrs detailantwoord wordt niet als raw providerpayload opgeslagen. Private email, private phone, address, bank, partner, emergency, BSN, salary en medical/absence data blijven buiten de eerste matching-input.

## 8. Voorgesteld `CanonicalPayrollEmployee`

Dit is een voorstel-schets, geen geïmplementeerd type en geen verplicht nieuw schema:

```ts
type CanonicalPayrollEmployee = {
  providerCode: string
  providerCompanyId: string
  externalEmployeeId: string
  externalEmployeeNumber: string | null
  name: {
    firstName: string | null
    firstNameInFull: string | null
    prefix: string | null
    initials: string | null
    lastName: string
  }
  sourceClassification:
    | 'APPLICANT'
    | 'NEW_HIRE'
    | 'PAYROLL'
    | 'FORMER_PAYROLL'
    | 'EXTERNAL'
    | 'FORMER_EXTERNAL'
    | 'REJECTED_APPLICANT'
  lifecycleStatus: 'ACTIVE' | 'INACTIVE' | 'FUTURE' | 'UNKNOWN'
  matchSignals?: {
    businessEmail: string | null
    birthDate: string | null
    initials: string | null
  }
  employments: readonly CanonicalPayrollEmploymentSummary[]
  source: {
    retrievedAt: string
    currentPeriod: { year: number; period: number } | null
    sourceCreatedAt: string | null
    sourceChangedAt: string | null
  }
  fingerprint: string
}
```

Rules:

- no `bsn`, BSN fingerprint, private email, private phone, address, bank, salary, absence or raw provider object;
- external IDs are scoped by provider and company, not globally assumed unique;
- `externalEmployeeNumber` is retained as non-unique provider metadata because Nmbrs explicitly says it is user-defined and not unique;
- optional `matchSignals` is absent unless the matcher has a documented reason to request enrichment;
- `fingerprint` is over the canonical allowlist, never over credentials or raw response JSON.

## 9. Voorgesteld `CanonicalPayrollEmploymentSummary`

```ts
type CanonicalPayrollEmploymentSummary = {
  providerCompanyId: string
  externalEmployeeId: string
  externalEmploymentId: string
  startsOn: string | null
  endsOn: string | null
  seniorityOn: string | null
  lifecycleStatus: 'CURRENT' | 'FUTURE' | 'ENDED' | 'UNKNOWN'
  sourceCreatedAt: string | null
  sourceChangedAt: string | null
  contract?: {
    externalContractId: string
    startsOn: string | null
    endsOn: string | null
    indefinite: boolean | null
  } | null
}
```

`hoursPerWeek`, schedule, salary, wage-tax, labour-agreement and end-reason descriptions are available but not part of the first summary. They may be added as separately justified optional projections later; P4 does not need a redesign of the identity/snapshot key because the canonical serialization is versioned.

## 10. Dataminimization assessment

The first P2 purpose is employee existence, explainable identity review and current employment context. That purpose does not require:

- BSN or any government identifier;
- private email/phone, address, partner, emergency or family data;
- bank account, wage tax, salary value/table/step or payroll result;
- absence, medical, leave, document or user-account data;
- raw provider response retention.

The first read is therefore list-first, company-scoped and allowlist-mapped. Personal detail is conditional enrichment only when a local candidate exists and the HR Admin is entitled to review a match. Values used transiently for a server-side comparison are not returned to the browser unless the UI contract explicitly needs the minimized value. No credential or token may appear in a sync item, difference, error, audit reference or log.

## 11. Explicitly niet ophalen in eerste P2

The first P2 implementation must not call or persist:

- employee private information/address history;
- bank account or payment data;
- BSN/social security number;
- partner, family, emergency-contact or private contact data;
- absence/medical, leave, documents or payslips;
- wage tax settings, wage components, hour components or payroll journals;
- salary values, salary tables/scales/steps;
- user accounts;
- department/function/manager history unless a later reviewed UI requirement proves it necessary;
- schedule/day/hour details and cost centers;
- any Nmbrs write endpoint.

The first P2 provider capability is read-only employee/company comparison. It does not imply employee write, employment write or outbound synchronization.

## 12. BSN: geen automatische match-key

BSN is not requested from Nmbrs, not placed in `CanonicalPayrollEmployee`, not hashed for Payroll matching and not sent to a provider matcher. The existing LiquidHR `findIdentityCandidates` flow supports a separate HR rehire workflow with an exact BSN fingerprint or limited fuzzy signals. P2 must not silently call that workflow or reinterpret its BSN capability as Payroll authorization.

If an HR Admin later confirms a Payroll link, the link is based on the provider/company/external-ID relationship and the explicit human decision. BSN remains a separate protected employee-domain field.

## 13. Matching inputs and outcomes

The matching result and the snapshot change state are separate concepts. A record can be `MATCHED` and still be `CHANGED`, or `NEW` and have snapshot state `NEW`.

| Outcome | Inputs | Rule | P2 action |
|---|---|---|---|
| `NEW` | provider/company ID, external employee ID, basic name, source classification, optional employment dates | no existing confirmed provider link and no single candidate meeting the review threshold; also the safe default when evidence is insufficient | show preview row; never auto-create or link |
| `MATCHED` | existing human-confirmed link for exact `(provider, company, externalEmployeeId)` plus valid tenant/HR-group/company-binding scope | deterministic link only; name or employee number alone never upgrades a record to MATCHED | show linked local employee and evidence; no apply in P2 |
| `PROBABLE_MATCH` | exactly one candidate; normalized business email plus compatible name, or justified birth-date/name/start-date combination | score reaches threshold, no conflicting candidate, but human confirmation remains mandatory | show candidate, score and reasons; no silent link/apply |
| `CONFLICT` | all candidate evidence, duplicate strong keys, contradictory names/dates/emails, or a link belonging to another scope | any ambiguity overrides the numeric score | block automatic action and require explicit resolution |
| `EXCLUDED` | explicit HR exclusion, out-of-bound company, invalid required provider identity, or an approved source-classification exclusion policy | exclusion is a recorded decision, not an inferred deletion | retain audit/history; do not import or match |

Inputs are deliberately limited. `externalEmployeeNumber` is display/review evidence only because the official Nmbrs schema says it is not unique. A cross-system employee-number match may only be considered after an explicit tenant configuration proves that both numbers share a meaning; it is not an automatic key in the first P2.

## 14. Explainable confidence rules

The following is a proposed deterministic score for review, not an autonomous HR decision:

| Evidence | Score | Interpretation |
|---|---:|---|
| existing confirmed provider/company/external-ID link | 100 | `MATCHED`, subject to scope and link integrity |
| exact normalized business email + compatible first name + exact normalized last name | 85 | `PROBABLE_MATCH` unless a conflict exists |
| exact birth date + exact normalized name | 75 | `PROBABLE_MATCH`, only when birth date enrichment was justified |
| exact normalized name + same employment start date | 65 | below probable threshold without another signal |
| name only | 30 | never enough for a match |
| no candidate or unusable identity | 0 | `NEW` |

Proposed thresholds:

- `100` is the only automatic `MATCHED` evidence, and it comes from a prior explicit link rather than a guessed identity;
- `75–99` is `PROBABLE_MATCH`, always human-reviewable and never auto-applied;
- `<75` is `NEW`, unless a conflicting candidate makes the result `CONFLICT`;
- any two viable candidates, contradictory strong signals or cross-scope link makes `CONFLICT` regardless of score.

Each score must carry a reason list such as `EXACT_CONFIRMED_LINK`, `BUSINESS_EMAIL_AND_NAME`, `BIRTH_DATE_AND_NAME` or `AMBIGUOUS_CANDIDATES`. No score may mention or derive from BSN.

## 15. Snapshot/fingerprint strategy for P4

### Identity and serialization

The stable snapshot key is:

```text
(providerCode, providerCompanyId, externalEmployeeId)
```

The canonical serializer must:

1. use an explicit version, for example `canonical-payroll-employee-v1`;
2. include only allowlisted canonical fields;
3. sort object keys and employment summaries deterministically by external ID and dates;
4. normalize whitespace/case only for comparison projections, preserve display casing separately;
5. normalize empty text to `null`, dates to ISO date/time forms and numbers to one deterministic representation;
6. compute SHA-256 over the canonical serialized value;
7. never hash raw credentials, BSN, raw response bodies or unapproved fields.

Store the fingerprint and bounded source metadata in the Payroll sync item/snapshot projection. Do not store raw Nmbrs JSON merely to make a later diff possible; calculate the diff from the previous minimized canonical projection.

### Change classification

| P4 state | Detection |
|---|---|
| `NEW` | stable key has no prior successful snapshot/link |
| `CHANGED` | same stable key exists and canonical fingerprint differs; field-level diff is generated from allowlisted projections |
| `UNCHANGED` | same stable key and same fingerprint |
| `MISSING` | a prior active stable key is absent from a complete, successfully paginated company snapshot |
| `INACTIVE` | provider classification or employment end/status indicates inactive; exact Nmbrs semantics must be confirmed live |

`MISSING` and `INACTIVE` never delete or archive a LiquidHR employee automatically. They produce an explicit sync issue/status and preserve history. A failed or partial run cannot mark records missing. The full list endpoint has `createdFrom` but no documented generic employee `changedFrom`; therefore full scans remain the safe P4 missing-record detector. Employment `changedFrom` can optimize employment history reads only after its semantics and ordering are confirmed.

## 16. Proposed `SyncRun PREVIEW` contract

The existing P1 schema already has `payroll_sync_runs` with `tenant_id`, `hr_group_id`, `connection_id`, optional `company_binding_id`, `mode`, `status`, timestamps, actor and JSON `summary`. The proposal fits that contract; it does not require writing a migration in this readiness task.

```ts
type PayrollSyncRunPreview = {
  id: string
  mode: 'PREVIEW'
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  connectionId: string
  companyBindingId: string
  providerCompanyId: string
  entityType: 'EMPLOYEE'
  requestedAt: string
  startedAt: string | null
  completedAt: string | null
  source: {
    providerCode: string
    pageCount: number
    totalRecords: number
    snapshotFingerprint: string
    retrievedAt: string
  }
  summary: {
    total: number
    new: number
    matched: number
    probableMatch: number
    conflict: number
    excluded: number
    changed: number
    unchanged: number
    missing: number
    inactive: number
  }
  invariants: {
    coreEmployeeWrites: 0
    coreEmploymentWrites: 0
    providerWrites: 0
    rawProviderPayloadStored: false
    applyAllowed: false
  }
}
```

In the current database, the extra fields belong inside the bounded JSON `summary` projection unless a later, separately approved schema decision requires columns. `mode=PREVIEW` and `applyAllowed=false` are server invariants, not client-provided claims.

## 17. Proposed `SyncItem` payload shape

The existing `payroll_sync_items` contract has `entity_type`, `external_entity_id`, optional `local_entity_id`, `match_status`, `decision_status`, `normalized_payload` and `difference_summary`. The proposal maps directly onto those fields:

```ts
type PayrollSyncItemPreview = {
  id: string
  syncRunId: string
  entityType: 'EMPLOYEE'
  externalEntityId: string
  localEntityId: string | null
  matchStatus: 'NEW' | 'MATCHED' | 'PROBABLE_MATCH' | 'CONFLICT' | 'EXCLUDED'
  decisionStatus: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED' | 'EXCLUDED'
  changeState: 'NEW' | 'CHANGED' | 'UNCHANGED' | 'MISSING' | 'INACTIVE'
  normalizedPayload: {
    providerCompanyId: string
    externalEmployeeNumber: string | null
    name: {
      firstName: string | null
      prefix: string | null
      lastName: string
    }
    sourceClassification: string
    lifecycleStatus: string
    employmentSummaries: readonly CanonicalPayrollEmploymentSummary[]
    fingerprint: string
  }
  differenceSummary: readonly {
    field: string
    kind: 'ADDED' | 'CHANGED' | 'REMOVED' | 'MISSING'
    providerValue: string | number | boolean | null
    localValue: string | number | boolean | null
    reason: string
  }[]
  evidence: {
    confidence: number
    reasons: readonly string[]
    candidateCount: number
  }
}
```

The exact persisted `decision_status` literals must be aligned with the existing database check before P2 implementation; the proposal uses human-readable names, not a claim that those literals are already present. Payloads must remain JSON objects, bounded and free of secrets, BSN and raw provider fields.

## 18. UI: Payroll → Medewerkers

HR Admin sees a server-rendered, permission-gated preview list with URL-state filters. Proposed columns:

1. status/match category (`NEW`, `MATCHED`, `PROBABLE_MATCH`, `CONFLICT`, `EXCLUDED`);
2. employee name;
3. Nmbrs employee number/reference, visually secondary and labelled non-unique;
4. provider lifecycle/current employment status;
5. current employment start/end summary, when available;
6. LiquidHR candidate or `Geen kandidaat`;
7. confidence and one-line explainable reason;
8. change state and difference count;
9. last-seen/snapshot timestamp.

The first acceptance shows exactly eight `NEW` rows, no candidate and no apply action. It does not display BSN, salary, bank, address, private contacts, medical data or raw external JSON.

## 19. UI: Payroll → Verschillen

This view is an exception/review workbench, not a second employee directory. It should support:

- filters for match category, change state, provider company, active/inactive and run;
- row-level reason/evidence: for example `Geen bestaande LiquidHR-match`, `Exacte bevestigde link`, `Meerdere kandidaten`, `Providerrecord ontbreekt in complete snapshot`;
- candidate count and confidence without exposing unnecessary personal data;
- field-level differences only for the allowlisted canonical projection;
- run timestamp, page completeness and retryable issue status;
- later review actions (`Bekijken`, `Koppeling bevestigen`, `Uitsluiten`) only after P2 preview and explicit permissions are established.

P2 has no `Importeren`, `Verschil toepassen` or automatic link persistence action. Those belong to controlled P3 and must remain visibly unavailable in PREVIEW mode.

## 20. Exact P2 acceptance test

### Preconditions

- P1 is GREEN and the existing authorized connection is `CONNECTED`.
- `Nmbrs Demo BV` is actively bound to `LiquidHR Test BV`.
- The test fixture is `LiquidHR Test BV = 0 employees` and `0 employments` before the run.
- The provider read scope and company profile are live-confirmed for the exact registered extdev app.
- No employee/employment provider endpoint has been called before this acceptance run.

### Procedure and assertions

1. Authenticate as canonical HR Admin and open Payroll → Medewerkers.
2. Start one `PREVIEW` for the active Demo BV binding.
3. Follow every employee-list page and assert a complete pagination chain.
4. Assert `Nmbrs Demo BV = 8` employee records.
5. Assert one `payroll_sync_runs` row with `mode=PREVIEW`, `status=COMPLETED` and one item per provider employee.
6. Assert exactly:

   ```text
   total = 8
   NEW = 8
   MATCHED = 0
   PROBABLE_MATCH = 0
   CONFLICT = 0
   EXCLUDED = 0
   ```

7. Assert `LiquidHR Test BV` remains `0 employees` and `0 employments` after the run.
8. Assert no `employees`, `employments`, assignments, contracts, salary or provider rows were inserted/updated by P2.
9. Assert no Nmbrs write endpoint was called and no browser response contains raw provider payload or credentials.
10. Reload Medewerkers and Verschillen; assert the same completed run/items and counts persist.
11. Assert the audit event records a preview/read result without sensitive values.

If the list returns a different count or contains non-payroll types, the run is not silently adapted to make the test green. Record the exact live response shape/count and resolve the `employeeType` policy as an external contract question.

## 21. P2 implementation sequence after P1 GREEN

The implementation remains within the existing provider-neutral Payroll architecture:

1. **Freeze live contract:** one authorized read-only probe against Demo BV; record sanitized endpoint, scopes, pagination, status and error evidence. No fixture employee values in Git.
2. **Provider seam:** add an employee-read capability to the existing `PayrollProvider` contract only when the live contract is confirmed; keep Nmbrs-specific HTTP/parsing inside `providers/nmbrs`.
3. **Strict adapter parsing:** implement list pagination, optional employment summary, allowlisted mapping and bounded retry/error mapping. No employee write methods.
4. **Pure compare engine:** implement normalization, candidate selection, explainable confidence, conflict precedence and snapshot fingerprinting test-first. Keep BSN out of its input type.
5. **Server sync orchestration:** require Payroll permission, active HR-group context, connection and active company binding; create a PREVIEW run/items/issues only. Reject partial snapshots as complete.
6. **Persistence check:** reuse existing sync-run/item/issue/audit contracts where sufficient. Any schema gap requires a later explicitly scoped migration; it is not solved by putting data in core HR tables.
7. **API route:** expose only the typed preview/read projection, with server authorization and no direct browser RPC/provider access.
8. **UI:** build Medewerkers and Verschillen from the server/API projection, with NL/EN i18n, URL-state filters and no P2 apply controls.
9. **Verification:** targeted provider/parser/matcher/snapshot/security tests, types, advisors if schema changes, i18n, lint, typecheck, build and authenticated HR Admin preview. Do not call the real employee endpoint before this contract and permission gate are ready.
10. **P2 closure:** prove `8 NEW`, zero core writes, persistence after reload, complete pagination and sanitized audit/read evidence. Only then design the separate human-reviewed P3 apply gate.

## 22. P3 apply through existing domain services, never direct core writes

The current architecture supports the required boundary:

- `apps/hr-suite/lib/employees/employee-service.ts` exposes `createEmployee` and `updateEmployee`. They require the existing employee permissions, resolve tenant/HR-group context and apply the canonical employee mapper/validation path. `updateEmployee` uses `updatedAt` concurrency protection.
- `apps/hr-suite/lib/employment/employment-service.ts` exposes `publishCompleteEmployment`, which validates administration assignment, contract/probation and required timeline inputs and delegates atomic publication to the existing `publish_complete_employment` or salary-aware RPC. `ensureEmployeeAdministrationAssignment` enforces the administration relationship.
- Existing API boundaries are `POST /api/employees/[employeeId]/employments`, `PATCH /api/employees/[employeeId]` and the corresponding protected detail/action routes. The Payroll service may orchestrate these server-side domain seams; it must not call Supabase `.from('employees')` or `.from('employments')` for apply.
- The domain model is `Employee` as one person within one HR-group with zero or more `Employment` records; `Employment` is administration-owned. P3 must preserve multiple employments and must not collapse them into one provider employee row.
- P3 must revalidate the current item fingerprint, binding, tenant/HR-group and permissions immediately before apply. A `PROBABLE_MATCH`, `CONFLICT` or `EXCLUDED` item cannot be auto-applied.
- A new employee often lacks required LiquidHR fields such as `nameUsage`, `gender`, preferred language and the complete employment setup. P3 must collect missing values through an explicit HR Admin review form; it must not invent them from incomplete provider data and must not request BSN as a hidden matching step.
- A new or changed employment requires explicit choices for administration, employment type, dates, contract, organization, schedule, income relationship and cost allocation according to the existing schemas. Provider summary data is not permission to bypass these business rules.
- After explicit successful apply, create a generic provider/entity link in the Payroll integration boundary. Do not add `nmbrs_id` columns to `employees` or `employments`; keep source identity and mappings outside core HR.

This preserves the existing `schema → API/service → UI` build order and keeps Payroll as a persistence adapter/orchestrator rather than a second employee/employment domain.

## Open questions that truly require a live Nmbrs response

These are the only material readiness gaps found:

1. Does the exact registered extdev profile grant `employee.info.read` and `employee.employment.read` together with the existing P1 scopes, and what exact `scope` claim is returned?
2. Does the Demo BV company employee list, without an unproven type filter, return exactly the expected eight employees? What is the `employeeType` distribution?
3. Does the selected profile expose the company-scoped employment endpoint for all eight records, and can one employee have multiple current employments in this fixture?
4. What are the live nullability/value semantics for current-period employee type, employment dates, `changedDate`, and any returned contract history? The schema gives shapes, not the fixture's semantics.
5. Are `nextPage` links stable and complete under the extdev data set, and do `totalPages`/`totalRecords` agree with the final page?
6. What numeric subscription threshold/quota and `Retry-After` behavior apply to the registered app? The public error schema exposes 429 codes but not those operational values.
7. Is a full employee-list read required for reliable P4 missing detection, or does Nmbrs provide a documented changed/deleted feed not present in the current public employee-list schema?
8. Can the first P2 run remain list-only for the empty Test BV fixture, with personal-info enrichment deferred until an actual local candidate exists?

No current code, migration, deployment, Supabase object, Nmbrs employee endpoint or employee/employment record was changed or read for this readiness task.
