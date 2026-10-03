# APIAI-01 — voorstel voor limiter- en read-auditopslag

Status: **LOKAAL VOORSTEL — NIET GOEDGEKEURD EN NIET TOEGEPAST**
Datum: 2026-10-03

Dit document beschrijft de minimale databasevorm voor APIAI-01. Het is geen
migratie, ADR of securitygoedkeuring. Er is geen remote schema gewijzigd en er
zijn geen quota als productbesluit vastgelegd.

## Doel en harde grenzen

- De limiter moet atomisch zijn en mag geen process-memory fallback hebben.
- Het requestpad gebruikt geen `service_role`.
- Actor en scope worden server-side/RLS bepaald; clientinput kan geen tenant,
  HR-groep of actor verbreden.
- `public.audit_logs` blijft de canonieke auditbron.
- Een resource-level read heeft geen echte `entity_id`; er wordt geen tenant-id,
  request-id of willekeurige UUID als entity-id ingevuld.
- API-read auditmetadata bevat geen token, Authorization-header, raw IP,
  employee-id, plan-id, capability-id, resultaatcount of vrije tekst.

## Limiter — voorgestelde lokale migration shape

Gebruik een niet-blootgesteld schema zoals `internal_security` voor de
limiterdata. De tabellen krijgen geen Data API-grants. De uiteindelijke
migratie moet daarnaast ownership, grants en advisorresultaat expliciet
controleren.

```sql
create table internal_security.api_rate_limit_policies (
  resource_key text primary key,
  burst_capacity integer not null,
  refill_per_second numeric not null,
  is_active boolean not null default false,
  check (length(btrim(resource_key)) between 1 and 80),
  check (burst_capacity > 0),
  check (refill_per_second > 0)
);

create table internal_security.api_rate_limit_buckets (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  actor_user_id uuid not null,
  oauth_client_id text not null,
  resource_key text not null,
  tokens numeric not null,
  last_refill_at timestamptz not null,
  primary key (tenant_id, hr_group_id, actor_user_id, oauth_client_id, resource_key)
);
```

De consume-functie krijgt uitsluitend tenant, HR-groep, resource en de
geverifieerde client-id. Zij leidt de actor af uit `auth.uid()`, controleert de
actieve membership met de bestaande HR-groephelpers en vergelijkt de client-id
met de vertrouwde tokenclaim. De databaseklok is de enige tijdbron. De functie
doet policy lookup en token-refill/consume onder dezelfde rijlock of atomische
upsert en retourneert alleen:

```json
{"allowed": true, "remaining": 3}
```

of:

```json
{"allowed": false, "remaining": 0, "retryAfterSeconds": 12}
```

Ontbrekende policy, ontbrekende clientbinding, ongeldige membership en storage-
of databasefouten geven een veilige fout; de route voert daarna geen
resourcequery uit. `burst_capacity` en `refill_per_second` blijven disabled of
test-only tot product-, operations- en securitygoedkeuring.

## Canonieke read-audit — voorgestelde uitbreiding

De huidige auditrijen behouden hun bestaande entitycontract. Voeg voor de
API-readprojectie alleen nullable uitbreidingsvelden toe:

- `hr_group_id` met een tenant/HR-groep-FK;
- `api_resource_key` met een vaste allowlist;
- `api_client_id` met een lengte- en karaktergrens;
- `api_outcome` met `ALLOWED`, `DENIED` en `RATE_LIMITED`;
- eventueel een bounded HTTP-statusveld;
- bestaand `correlation_id` als herleidbare API-correlatie.

Maak `entity_id` alleen nullable wanneer tegelijk een constraint wordt
toegevoegd die het volgende afdwingt:

- alle bestaande niet-`READ`-acties houden een entity-id;
- een API-`READ` gebruikt `entity_name = 'api_resource'` en
  `entity_id is null`;
- een API-`READ` heeft een geldige `hr_group_id`, resource, client, outcome en
  correlation-id.

Breid de actieconstraint uit met `READ`. De insert-policy voor API-reads mag
alleen de bovengenoemde typed metadata accepteren en moet `actor_user_id` uit
`auth.uid()` afdwingen. De policy mag geen vrij JSONB-bericht, entity-id of
resultaatcount uit de caller aannemen. Update en delete blijven geweigerd.

De bestaande audit-select-policy moet voor rijen met een `hr_group_id` ook
`internal_security.has_hr_group_access(tenant_id, hr_group_id)` afdwingen.
Daarmee kan `audit:read` geen events uit een andere HR-groep openen.

## Routegedrag

- Limiter toegestaan: ga door naar de resourceadapter.
- Limiter geweigerd: `429`, stabiele `error.code`, bounded `Retry-After`,
  `Cache-Control: no-store`.
- Limiter/audit-opslag niet beschikbaar: `503`, zonder resourcepayload.
- Succesvolle HR-read wordt pas teruggegeven nadat het read-auditrecord veilig
  is opgeslagen.
- Ongeldige of niet-gekoppelde credentials krijgen geen auditrecord met een
  verzonnen actor of entity-id; alleen privacyveilige operationele telemetry
  kan daarvoor worden gebruikt.

## Vereiste vervolgstappen vóór een echte migration

1. Provider, tokenclaim voor clientbinding en bearer-gebonden Supabase/RLS-
   client formeel vaststellen.
2. Resourcequota en burstwaarden goedkeuren.
3. Nullable `audit_logs.entity_id`, `hr_group_id`-scope en auditretentie laten
   reviewen door security/data-eigenaar.
4. Migration schrijven met `supabase migration new`, lokale/TEST-contracttests
   toevoegen, advisors draaien en `packages/db/types.ts` genereren.
5. Remote toepassen uitsluitend na afzonderlijke expliciete toestemming.
