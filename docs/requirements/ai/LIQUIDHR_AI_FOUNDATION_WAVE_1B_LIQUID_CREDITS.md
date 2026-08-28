# LiquidHR AI Foundation Wave 1B — Liquid Credits

- **Status:** lokaal geïmplementeerd; TEST DB apply pending approval
- **Baseline:** Wave 1A `0fa6e62`
- **Scope:** accounting- en serverfundering achter de bestaande `CreditsPort`
- **Geen scope:** customer UI, billing/Stripe, echte provider-call, eerste AI-capability, HeRa/Gemini

## Contract

Liquid Credits zijn klantterminologie voor voorspelbare vaste charges. De
provider gebruikt intern technische usage-metadata; provider tokens, prijzen
en modeldetails zijn geen credit-eenheid en verschijnen niet in deze
customer-facing contractlaag.

De bestaande registry blijft de bron voor feature en charge reference. Voor de
eerste toekomstige capability `improve-existing-hr-text` is de interne
Wave 1B-charge catalogus:

| Profiel | Vaste charge |
| --- | ---: |
| `EFFICIENT` | 1 credit |
| `BALANCED` | 2 credits |
| `IN_DEPTH` | 3 credits |

De registry-feature blijft `PLANNED`; er is geen user-facing activatie.
De bedragen zijn de huidige interne Wave 1B-configuratie en geen billing- of
UI-belofte.

## Accounting model

De migration
`apps/hr-suite/supabase/migrations/20260828090000_ai_liquid_credits_foundation.sql`
voegt een klein allocation-ledger toe:

- `ai_credit_group_policies` — allowance per tenant/HR-groep en de vaste
  timezone-basis;
- `ai_credit_role_quotas` — globale role-based maandquota zonder individuele
  override;
- `ai_credit_charge_catalog` — feature/profile/reference naar integer credits;
- `ai_credit_allocations` — immutable batches voor
  `MONTHLY_ALLOWANCE`, `PURCHASED_EXTRA` en gecontroleerde `TEST_GRANT`;
- `ai_credit_reservations` — één reservation per invocation met actor,
  idempotency-key en lifecycle;
- `ai_credit_reservation_allocations` — de deterministische batchverdeling;
- `ai_credit_actor_usage` — reserved/settled/released usage per actor en maand.

Alle bedragen zijn integer units. Allocations bewaren tenant, HR-groep, type,
bedrag, maand, timezone, grant/created timestamps, expiry, source/reference en
accounting-counters. `available_credits` is generated accounting en kan niet
negatief worden. Historical allocations worden niet aangepast wanneer een
nieuw group policy actief wordt.

De actuele Wave 1B-seedconfiguratie gebruikt 100 monthly credits per groep en
de volgende quota-classificatie: `EMPLOYEE` 10, `DIRECT_MANAGER`/`TEAM_LEAD`
25, `HR_ADVISOR`/`PAYROLL_SPECIALIST` 50 en `HR_ADMIN`/`TENANT_ADMIN` 100.
Deze waarden zijn server-side catalogusconfiguratie; wijziging ervan verandert
geen historische allocation.

## Allowance, expiry en consumption

`ensureMonthlyAllowance(tenant, hrGroup, YYYY-MM)` maakt lazy en idempotent één
monthly allocation per groep en kalendermaand. De periode start op lokale
middernacht in de HR-groep-timezone en expireert op lokale middernacht van de
volgende maand. De timezone wordt op de policy vastgelegd; de huidige
productfallback blijft `Europe/Amsterdam` totdat een expliciete HR-group
timezonebron wordt aangesloten.

Purchased extra batches hebben een expliciete `BILLING:`-reference en verlopen
twaalf maanden na toekenning. Wave 1B levert geen purchase- of billingflow; de
database kent alleen de traceerbare accountingvorm. Synthetic credits hebben
alleen de `CONTROLLED_TEST:`-source.

Reservation consumeert eligible batches deterministisch:

1. vroegste expiry eerst;
2. daarna latere expiry;
3. bij gelijke expiry `granted_at`, vervolgens allocation-id.

Non-expiring batches zouden achteraan komen. Vrijgave vóór expiry maakt de
credits beschikbaar. Wordt een nog open reservation ná expiry vrijgegeven, dan
blijven die units expired en komen ze niet opnieuw in de beschikbare balance.

## Reservation lifecycle

De server reserveert vóór context/provider-executie:

`available → RESERVED → SETTLED`

of bij context-, provider- of validatiefailure:

`available → RESERVED → RELEASED`

Een succesvolle validatie settle't exact één keer. Een release veroorzaakt geen
success-charge. Duplicate settle/release is idempotent; settle na release en
release na settle worden geweigerd. Een gebruikersannulering ná settlement
verandert de charge niet. `Try Again` vereist een nieuwe invocation en key en
maakt dus een nieuwe reservation.

Idempotency is database-unique binnen tenant, HR-groep, actor en key, naast de
invocation-link. Group policy locking plus actor-usage locking en row locks op
de gekozen allocations voorkomen overspend, negatieve balance en quota-races.

## Role quota

De effectieve quota komt uit actieve HR-groep-rollen via user access en
actieve department-management assignments. Bij meerdere toepasselijke rollen
wint eerst de hoogste maandquota; bij gelijke quota wint de quality-rang
`IN_DEPTH > BALANCED > EFFICIENT`. Alle toepasselijke role codes blijven voor
traceability beschikbaar. Er bestaat geen individuele handmatige override.

Quota is een extra ceiling, geen extra balance. De HR-groep-balance blijft de
absolute cap voor alle actors samen.

## Security boundary

Alle zeven nieuwe public tables hebben RLS in dezelfde migration. Authenticated
reads zijn beperkt tot de bestaande HR-groep/permission- en actor-scope;
role-quota en charge-catalogus blijven server-only. Nieuwe accountingrecords
hebben geen directe authenticated write-grant. De publieke RPC-wrappers zijn
`security invoker`, maar uitsluitend `service_role` kan ze uitvoeren; de
interne ledgerfuncties zijn niet publiek uitvoerbaar. Composite foreign keys
houden tenant en HR-groep aan elkaar gekoppeld.

De enige synthetic test-seam is
`grant_ai_controlled_test_credits`. Die accepteert uitsluitend een
transaction-local `app.environment` van `test`/`development`, een expliciete
`app.ai_credits_test_mode=true` en een `CONTROLLED_TEST:`-reference. Ontbrekende
settings falen expliciet gesloten. Er is geen production fake-paid path en
geen "Koop credits"-UI.

## Wave 2 open

- gecontroleerde TEST DB apply, readback, advisors en echte gegenereerde
  `packages/db/types.ts`-sync;
- echte billing/purchase intake die `BILLING:`-allocations autoriseert;
- beheer van allowance-, quota- en timezone-policy via een passende server/UI
  route;
- definitieve HR-groep-timezonebron in plaats van de fallback;
- daadwerkelijke provider/capability-slice en de customer proposal-flow;
- verdere productie-observability en operationele expiry/retention policy.
