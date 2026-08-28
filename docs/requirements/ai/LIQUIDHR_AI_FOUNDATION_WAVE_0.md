# LiquidHR AI Foundation — Wave 0 contract freeze

**Status:** LEIDEND — WAVE 0 FROZEN  
**Datum:** 2026-08-28  
**Scope:** Wave 0 architectuur/spec + Wave 1A AI Runtime & Governance  
**Baseline:** `main = origin/main = 1fce3e28accd6385abd0a5e54742b0b6e4060098`  
**Zichtbare productversie:** `1.20260828.1`

Dit document is het bindende contract voor de eerste LiquidHR AI Foundation-slice. Het maakt AI tot een gewone, server-geautoriseerde LiquidHR-capability. AI is geen aparte applicatie, geen tweede identity-systeem en geen vrije database-agent.

## 1. Besloten scope

Wave 0 bevriest de taal, grenzen, interfaces en levenscyclus. Wave 1A automatiseert vervolgens alleen de generieke runtime- en governance-seam.

### Wel in Wave 1A

- een typed static feature registry;
- server-side authenticatie-, tenant-, HR-groep-, permission-, enablement-, edition-, quota- en credit-gates;
- een invocation-domein met idempotency, fingerprint en correlatie-id;
- een expliciete state machine en typed failures;
- een server-only execution orchestrator;
- een authorized-context-loader-interface die alleen minimale, al geautoriseerde projecties mag leveren;
- een `CreditsPort` met reservation/settle/release en `ensureMonthlyAllowance`;
- een provider-port en deterministische `TestProvider`;
- outputvalidatie vóór settlement;
- gescheiden technische usage-telemetrie en business audit;
- persistence-tabellen met tenant/HR-groep-scope, RLS, policies en minimale grants;
- contract- en unit-tests voor gates, scope, concurrency, idempotency, provider failures, invalid output, versions en credits.

### Niet in Wave 1A

- geen eerste user-facing AI-feature;
- geen Proposal Drawer, editor, feedback-UI of `/settings/ai`;
- geen Insights-dashboard of klantgerichte usage-pagina;
- geen autonome writes, salarisbeslissingen, recruitmentbeslissingen of absencebeslissingen;
- geen provider-SDK of echte betaalde provider-call;
- geen wijziging aan de bestaande HeRa/Gemini-implementatie;
- geen production credits, wallet, ledger, betaalde bundels of fake productiecredits;
- geen remote Supabase migration apply, production-mutatie, version bump, merge, push of deploy.

De eerste toekomstige capability is alleen als registry-contract bevroren: **Improve existing HR text**. Die capability is low-risk, levert uitsluitend een voorstel en vereist menselijke beoordeling. Zij is niet afhankelijk van Recruitment en wordt in deze slice niet uitvoerbaar gemaakt.

## 2. Producttaal en modelgrenzen

De klant ziet de productnaam **Liquid Credits**. Providernaam, modelnaam, reasoning-profiel, tokenaantallen en providerkosten zijn interne technische metadata en komen nooit in reguliere UI-copy, business-audit of capability-resultaten terecht.

LiquidHR blijft verantwoordelijk voor:

- authenticatie en de bestaande `AuthContext`;
- tenant- en HR-groep-scope;
- business permissions en capability-governance;
- toegestane context en dataminimalisatie;
- quota en Liquid Credits;
- validatie, audit en menselijke goedkeuring.

Een provider krijgt alleen een al opgebouwde `AuthorizedAiContext`. De provider kan niet zelf queryen, permissies bepalen, scope uitbreiden, writes doen of een andere context laden.

## 3. Bevroren end-to-end pipeline

De server-runtime volgt exact deze volgorde:

```text
authenticate
  → resolve tenant / HR group / administration / actor
  → require ai:use
  → require feature business permission
  → check AI overall enabled
  → check feature enabled
  → check edition entitlement
  → resolve effective quality profile
  → check user quota
  → ensure monthly HR-group allowance
  → reserve Liquid Credits atomically
  → load authorized context
  → build versioned provider request
  → provider execution
  → validate typed result
  → settle on success OR release on provider/validation failure
  → record technical usage
  → record business audit
  → return validated proposal/result
```

De generieke runtime exposeert geen open endpoint waarmee een caller willekeurige feature- of contextcodes kan uitvoeren. Een toekomstige feature-adapter kiest een statisch geregistreerde capability, laadt de domeincontext via de bestaande geautoriseerde service en roept de runtime aan. De server herhaalt alle relevante checks; UI-verberging is geen autorisatie.

## 4. Typed contract

De volgende namen en betekenissen zijn frozen. De concrete TypeScript-definities in `apps/hr-suite/lib/ai` implementeren dit contract zonder `any`.

### 4.1 Scope en invocation

```ts
type AiQualityProfile = 'EFFICIENT' | 'BALANCED' | 'IN_DEPTH'
type AiProductStatus = 'PLANNED' | 'INTERNAL_TEST' | 'AVAILABLE' | 'RETIRED'
type AiAllowedResultType = 'PROPOSAL'
type AiExecutionStatus =
  | 'RECEIVED'
  | 'AUTHORIZED'
  | 'RESERVING'
  | 'CONTEXT_LOADING'
  | 'EXECUTING'
  | 'VALIDATING'
  | 'SETTLING'
  | 'RELEASING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
type AiResultStatus = 'PENDING' | 'VALIDATED' | 'NOT_AVAILABLE' | 'INVALID' | 'FAILED'

interface AiScope {
  tenantId: string
  hrGroupId: string
  administrationId: string | null
}

interface AiBusinessObjectRef {
  type: string
  id: string
}

interface AiInvocationInput {
  authContext: AuthContext
  featureCode: string
  businessObject: AiBusinessObjectRef
  idempotencyKey: string
  businessPermissionCode: string | null
  qualityProfile?: AiQualityProfile
  writingStyle?: string | null
  correlationId?: string
}
```

`AuthContext` is the existing verified server context. `hrGroupId` is required at the runtime boundary; a missing active HR group fails closed. Cookie-selected context is never trusted without the existing server-side revalidation.

### 4.2 Static feature registry

Each registry entry contains exactly these governance concerns:

| Veld | Contract |
|---|---|
| `featureCode` | stable kebab-case identifier |
| `capabilityGroup` | bounded capability family |
| `productStatus` | lifecycle status; `PLANNED` is not executable |
| `minimumEdition` | minimum LiquidHR edition |
| `permittedQualityProfiles` | closed set of allowed profiles |
| `defaultQualityProfile` | deterministic default |
| `chargeStrategy` | `FIXED_PER_FEATURE_AND_PROFILE` |
| `chargeReferenceByProfile` | internal Liquid Credits references, never provider tokens |
| `providerMappingByProfile` | internal mapping to model/reasoning/budget configuration |
| `technicalLimits` | input/context/output/timeout limits |
| `supportsWritingStyle` | explicit style support flag |
| `allowedResultType` | currently only `PROPOSAL` |
| `promptTemplateVersion` | immutable prompt-template version |
| `configVersion` | immutable governance/config version |

The first frozen entry is:

```text
featureCode: improve-existing-hr-text
capabilityGroup: HR_TEXT_ASSISTANCE
productStatus: PLANNED
minimumEdition: FOUNDATION
permittedQualityProfiles: EFFICIENT, BALANCED, IN_DEPTH
defaultQualityProfile: BALANCED
chargeStrategy: FIXED_PER_FEATURE_AND_PROFILE
allowedResultType: PROPOSAL
```

The internal provider mapping uses model family `LUNA` with reasoning profile `MAX`; these values are not customer-facing. The exact charge references and technical limits are static registry data, not a production wallet or a promise of available credits.

### 4.3 Ports

The runtime depends on these ports and does not depend on a provider SDK or direct domain queries:

```ts
interface AiFeatureRegistry {
  get(featureCode: string): AiFeatureDefinition | null
}

interface AiGovernancePort {
  resolve(input: {
    scope: AiScope
    actorUserId: string
    feature: AiFeatureDefinition
    requestedQualityProfile?: AiQualityProfile
  }): Promise<AiGateSnapshot>
}

interface CreditsPort {
  ensureMonthlyAllowance(scope: AiScope, month: string): Promise<void>
  reserve(input: AiCreditReservationRequest): Promise<AiCreditReservation>
  settle(input: AiCreditSettlementRequest): Promise<void>
  release(input: AiCreditReleaseRequest): Promise<void>
}

interface AuthorizedContextLoader {
  load(input: {
    authContext: AuthContext
    scope: AiScope
    feature: AiFeatureDefinition
    businessObject: AiBusinessObjectRef
  }): Promise<AuthorizedAiContext>
}

interface ProviderPort {
  execute(request: AiProviderRequest): Promise<AiProviderResponse>
}

interface AiResultValidator<T> {
  validate(output: unknown): T
}

interface InvocationRepository {
  createOrGet(input: NewAiInvocation): Promise<{ invocation: AiInvocation; created: boolean }>
  transition(input: AiStateTransition): Promise<AiInvocation>
}

interface TechnicalUsageSink {
  record(event: TechnicalUsageEvent): Promise<void>
}

interface BusinessAuditSink {
  record(event: BusinessAuditEvent): Promise<void>
}
```

`AuthorizedContextLoader` is the only place where a future feature may translate a business object to domain data. It returns a minimized, typed projection; it never returns a raw Supabase client, query builder, full prompt history, secrets or unrestricted rows.

`CreditsPort` is a hard boundary. Wave 1A supplies only a deterministic fake for tests and a fail-closed production seam. There is no production credit implementation in this wave.

### 4.4 Request and result metadata

Every provider request includes `invocationId`, feature code, effective quality profile, writing style where allowed, `configVersion`, `promptTemplateVersion`, technical limits and the authorized context. Provider responses may include internal provider/model/request/usage metadata. This metadata is written only to technical telemetry and is not returned as customer product language.

No raw prompt, raw response, secret, full authorized context or provider token/cost is stored in the invocation, business-audit or customer-facing result tables.

## 5. State machine

### Allowed transitions

```text
RECEIVED        → AUTHORIZED | REJECTED
AUTHORIZED      → RESERVING | REJECTED
RESERVING       → CONTEXT_LOADING | FAILED | REJECTED
CONTEXT_LOADING → EXECUTING | FAILED
EXECUTING       → VALIDATING | FAILED
VALIDATING      → SETTLING | RELEASING | FAILED
SETTLING        → SUCCEEDED | FAILED
RELEASING       → FAILED
```

`SUCCEEDED`, `FAILED` and `REJECTED` are terminal. A duplicate terminal invocation is a read-only idempotent result and never enters the provider or credit port again. An invocation that is still non-terminal produces `DUPLICATE_IN_FLIGHT` for a concurrent retry.

The state transition repository uses an expected current state. A stale transition is rejected; it cannot overwrite a newer state. `executionStatus` and `resultStatus` are stored independently so a rejected gate, an invalid result and a provider failure remain distinguishable.

## 6. Typed failures

The stable failure union contains at least:

```text
UNAUTHORIZED
FEATURE_UNAVAILABLE
FEATURE_NOT_ENTITLED
AI_DISABLED
QUOTA_REACHED
CREDITS_EXHAUSTED
CREDITS_UNAVAILABLE
DUPLICATE_IN_FLIGHT
DUPLICATE_COMPLETED
IDEMPOTENCY_KEY_REUSED
PROVIDER_UNAVAILABLE
PROVIDER_FAILED
INVALID_RESULT
INTERNAL_CONFIGURATION_ERROR
```

Failures never expose raw database, provider, prompt or credential details to a caller. Every gate failure occurs before provider execution; the acceptance invariant is `provider calls = 0` for unauthorized, disabled, unavailable, not-entitled, quota and credit-reservation failures.

## 7. Authorization and enablement

The runtime requires both:

1. the canonical AI permission `ai:use`; and
2. the feature adapter's separate business permission, checked against the same verified `AuthContext` and target scope.

Governance/reporting permissions are separate:

| Permission | Meaning | Default future audience |
|---|---|---|
| `ai:use` | execute an entitled AI capability | role/configuration dependent |
| `ai:manage` | manage AI enablement and feature governance | Tenant Admin, HR Admin |
| `ai:usage-read` | read aggregated/technical usage reporting | Tenant Admin, HR Admin |
| `ai:audit-read` | read business audit | Tenant Admin, HR Admin / explicit audit role |
| `ai:credits-manage` | manage AI credit governance/ledger | Tenant Admin, HR Admin / AI governance |

There is no line-manager monitoring permission by implication. A future usage report must independently check report permission, HR-group scope and any underlying business-data permission.

AI overall enablement, feature enablement, edition entitlement, quality profile and quota are returned by `AiGovernancePort`. If that port cannot make a decision, the runtime fails closed with `INTERNAL_CONFIGURATION_ERROR` or `CREDITS_UNAVAILABLE`; it does not silently execute.

## 8. Quality, quota and Liquid Credits

The customer quality profiles are `Efficient`, `Balanced` and `In-depth`. Internal code uses uppercase enum values only. A multi-role actor receives the highest applicable role profile for quota selection. Role precedence is deterministic:

```text
IN_DEPTH > BALANCED > EFFICIENT
```

V1 has no individual quota override. The effective user quota is checked first, followed by the HR-group balance hard cap. A group-wide balance can never be exceeded by a user quota or by concurrent requests.

The monthly allowance contract is:

```text
ensureMonthlyAllowance(tenant + HR group, YYYY-MM)
```

The month is a calendar month in the HR group's canonical timezone. Wave 1A has one exported resolver with the current canonical fallback `Europe/Amsterdam`, matching the existing server-side LiquidHR date/time convention. It is deliberately one resolver, not a second persisted timezone source. The future timezone source may replace that resolver in one place only.

Credit lifecycle:

| Situation | Reservation | Settlement |
|---|---:|---:|
| successful validated execution | reserve once | settle once |
| provider failure/unavailable after reserve | reserve once | release once |
| invalid output | reserve once | release once |
| canceled proposal | already charged | remains charged |
| Try Again | new invocation/key | new charge |
| duplicate retry | no new reserve | no new settlement |
| credit service unavailable | no provider call | fail closed |

The runtime uses only registry charge references. Actual production Liquid Credits allocation/ledger behavior is Wave 1B.

## 9. Audit and privacy

Business audit is a customer-governance record, separate from technical provider telemetry. It contains:

- timestamp;
- actor user/function;
- tenant and HR-group scope;
- business object reference;
- feature and action;
- quality profile and writing style;
- reserved/charged Liquid Credits;
- terminal status and stable failure code where relevant;
- correlation-id;
- config and prompt-template versions.

It does not contain full prompts, full responses, raw HR context, secrets, provider tokens or raw provider costs. Technical telemetry may contain minimal provider response metadata, usage counters and latency for internal operations, but no raw HR context dump.

## 10. First capability contract

`improve-existing-hr-text` is frozen as a proposal-only capability:

- input: caller-selected existing HR text through a future domain-owned authorized projection;
- output: a validated proposed text result;
- human review: mandatory;
- writes: none by the AI runtime;
- risk class: low;
- business permission: supplied by the owning feature adapter, never invented by the generic runtime;
- Recruitment dependency: none;
- UI: deferred to a later wave.

The runtime may test this result shape through an internal test adapter, but the static production registry remains `PLANNED` until a later feature slice supplies a real context loader, route/action and review surface.

## 11. Acceptance contract

Wave 1A is complete only when targeted tests prove:

- tenant and HR-group isolation;
- missing AI or business permission rejects before provider call;
- disabled, unavailable and not-entitled features reject before provider call;
- quota and credit exhaustion reject before provider call;
- two concurrent identical keys execute at most once and charge at most once;
- different payloads cannot reuse an idempotency key;
- provider failure releases exactly once and settles zero;
- invalid output releases and settles zero;
- success validates, reaches `SUCCEEDED`, settles once and emits usage plus business audit;
- config/prompt versions travel through the provider request and audit;
- technical usage and business audit never share raw prompts/responses;
- RLS/policies/grants keep data tenant + HR-group scoped.

The known unrelated Journey baseline failure around `Binnenkort beschikbaar` is not changed and is not an AI blocker.

## 12. Wave gates and handoff

Wave 0 gate: this document, ADR-0010 and FDR-0008 contain no blocking unresolved design choice; interfaces, states, permissions, privacy boundary, timezone rule and first capability are coherent and frozen.

Wave 1A gate: targeted AI tests, strict TypeScript, relevant auth/RLS contract checks, ESLint, diff-check and the smallest relevant build/test checks are green. A full suite run is reported separately when shared auth/database infrastructure makes it relevant.

If the migration is retained, the final handoff phrase is:

```text
AI FOUNDATION WAVE 0 + 1A LOCAL GREEN — TEST DB APPLY PENDING EXPLICIT APPROVAL
```

No Wave 1B work starts as part of this task.
