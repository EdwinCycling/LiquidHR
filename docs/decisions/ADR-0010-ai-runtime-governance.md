# ADR-0010 — LiquidHR AI runtime en governance

- **Status:** Goedgekeurd — Wave 0 freeze
- **Datum:** 2026-08-28
- **Besluitnemer:** LiquidHR product- en architectuurgate
- **Scope:** AI Foundation Wave 0 en Wave 1A

## Context

LiquidHR heeft bestaande HeRa-AI-functionaliteit met eigen Gemini-contracten. Een nieuwe AI-capability heeft een herbruikbare runtime nodig die tenant- en HR-groep-scope, bestaande authenticatie, business permissions, enablement, entitlement, quota, Liquid Credits, outputvalidatie en audit afdwingt. Een vrije provider-agent of tweede autorisatiemodel zou de bestaande architectuur- en privacygrenzen doorbreken.

## Besluit

1. AI is een server-side LiquidHR-capability. De bestaande geverifieerde `AuthContext` blijft de enige identity- en scopebron.
2. Wave 1A bouwt een provider-agnostische runtime rond typed `InvocationRepository`, `AiGovernancePort`, `CreditsPort`, `AuthorizedContextLoader`, `ProviderPort`, validator, technical-usage-sink en business-audit-sink.
3. De runtime voert de frozen pipeline en state machine uit, gebruikt idempotency plus database-uniqueness, en faalt gesloten wanneer governance of credits niet kan beslissen.
4. Providers zijn server-only en ontvangen uitsluitend een minimale, al geautoriseerde context. Zij krijgen geen database-, Supabase-, permission- of scope-capability.
5. Invocations, technische usage en business audit zijn afzonderlijke records. Geen van deze records bewaart een volledige prompt, response, raw HR-context, secret of provider-token.
6. Wave 1A bevat geen echte provider-SDK, betaalde call, production credits-implementatie of user-facing capability. HeRa/Gemini blijft ongewijzigd.
7. De static registry bevriest `improve-existing-hr-text` als `PLANNED`, proposal-only en human-review verplicht. De registry gebruikt intern model family `LUNA` en reasoning profile `MAX`; die metadata is niet klanttaal.
8. De maandgrens gebruikt één geëxporteerde HR-groep-timezone-resolver met de huidige canonieke fallback `Europe/Amsterdam`. Er wordt geen tweede timezonebron geïntroduceerd.

## Gevolgen

### Positief

- Nieuwe capabilities kunnen dezelfde security-, credit-, audit- en providergrenzen hergebruiken.
- Een providerwissel verandert geen domein- of autorisatiecontract.
- De TestProvider maakt deterministische red/green-tests mogelijk zonder betaalde AI-call.
- Business audit blijft geschikt voor governance zonder technische providerdata aan klanten bloot te stellen.
- Het expliciet uitgestelde eerste feature-oppervlak voorkomt dat de foundation onbedoeld een autonome HR-functie wordt.

### Kosten en beperkingen

- Wave 1A heeft nog geen productie-creditservice; productie-uitvoering faalt gesloten totdat Wave 1B die port invult.
- De huidige timezone-fallback is geen klantconfigureerbare HR-groep-timezone. Een latere wijziging moet de ene resolver vervangen en de maandcontracten opnieuw testen.
- Een terminale duplicate retry kan in Wave 1A alleen de invocation-status teruggeven, omdat volledige AI-output niet wordt opgeslagen.
- De bestaande HeRa-runtime heeft geen automatische migratie naar deze contracten; integratie is een aparte, expliciete slice.

## Afwijzingen

- **Directe provider-aanroep vanuit route/UI:** afgewezen wegens omzeiling van gates en contextcontrole.
- **Provider met Supabase/service-role toegang:** afgewezen wegens scope- en auditrisico.
- **Eén gecombineerde usage/audit-tabel:** afgewezen wegens vermenging van klantgovernance en technische telemetry.
- **Fake productiecredits:** afgewezen; alleen een test-double is toegestaan.
- **Nieuwe generieke task/AI-app of nieuwe authlaag:** afgewezen; AI blijft onderdeel van LiquidHR.
