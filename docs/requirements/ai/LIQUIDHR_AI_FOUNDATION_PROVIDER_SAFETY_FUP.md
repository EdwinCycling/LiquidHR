# LiquidHR AI Foundation — Provider Safety Guardrails & FUP

## Status

Geïntegreerd in `work/ai-foundation-central-integration` vanaf authoritative
`origin/main`/`b9228380f74a4cacfd951e695ff694e2cf1f699c`. De corrective TEST
migration `20260829134822_ai_provider_safety_internal_service_role_grants`
is toegepast; alleen `service_role` kreeg EXECUTE op de twee interne
provider-safetyfuncties. Authenticated en anon blijven geweigerd. Er is geen
production DB-write of brede schemawijziging uitgevoerd.

## Doel en grens

Deze slice beschermt iedere externe provider-call onafhankelijk van Liquid
Credits. De vaste volgorde is:

`AI runtime → governance → credit reservation → provider safety gate → ProviderPort → provider`

Er wordt geen user-facing AI-feature geactiveerd. `improve-existing-hr-text`
blijft `PLANNED`; er zijn geen UI-, HeRa-, Gemini-, dashboard-, billing- of
database-mutaties uitgevoerd.

## Guardrails

- `AI_PROVIDER_ENABLED` is server-only. OPENAI productieconfiguratie faalt
  gesloten zonder expliciete boolean en complete, positieve limiterconfig.
  `false` geeft een typed `AI_PROVIDER_DISABLED`; er is geen stille fallback.
- De safety-config is environment-scoped (`test`, `development`, `production`)
  en gebruikt UTC voor uur- en kalenderdaggrenzen.
- TEST-defaults zijn `5` calls/uur, `20` calls/dag, `2` gelijktijdig,
  `4096` globale outputtokens, `16000` inputkarakters en een lease van
  `120` seconden. Server environment variables kunnen deze waarden expliciet
  overschrijven.
- Input wordt vóór de provider-call conservatief als serialized requestgrootte
  gecontroleerd tegen zowel de globale als featurecap. Er wordt niet afgekapt.
  Output wordt tegen de globale token-cap gecontroleerd; `4096` is de
  production-like default.
- Elke toegestane reservation telt direct, ook wanneer de provider later faalt.
  Een lease heeft een invocation-id, environment, reserveringstijd,
  vervaltijd en completion-status. Stale actieve leases blokkeren niet eeuwig;
  ze blijven wel meetellen voor de volumecaps van hun UTC-venster.
- Dezelfde invocation kan maximaal één lease krijgen. Een nieuwe invocation
  blijft onder de globale uur-, dag- en concurrencycaps. De runtime doet exact
  één `ProviderPort.execute` per toegestane invocation.
- De OpenAI SDK blijft `maxRetries: 0`; safety reserve, provider execution en
  lease completion zijn afzonderlijke typed stappen. RPC-, counter-, config-
  en responseproblemen falen gesloten als `AI_PROVIDER_SAFETY_UNAVAILABLE`.

## Persistente grens

`ai_provider_safety_environments` en `ai_provider_execution_leases` bevatten
uitsluitend technische governancegegevens. RLS staat aan, public/anon/
authenticated hebben geen tabel- of RPC-rechten en alleen `service_role` kan
via de public wrappers reserveren/completeren. De reservefunctie lockt de
environment-row en voert invocation-scope, input/output, duplicate, UTC
hour/day en actieve lease-controles atomair uit. Er worden geen prompts,
responses, HR-context, PII of raw provider payloads opgeslagen.

De runtime gebruikt de in-memory seam uitsluitend voor expliciete TEST-mode.
De OPENAI-mode gebruikt `SupabaseProviderSafety` en kan niet stil terugvallen
op memory. TEST apply en remote schema-readback zijn geen onderdeel van deze
slice.

## Fouttaxonomie

De safety gate gebruikt uitsluitend typed codes:

`AI_PROVIDER_DISABLED`, `AI_PROVIDER_HOURLY_LIMIT`,
`AI_PROVIDER_DAILY_LIMIT`, `AI_PROVIDER_CONCURRENCY_LIMIT`,
`AI_PROVIDER_INVOCATION_LIMIT`, `AI_PROVIDER_INPUT_TOO_LARGE`,
`AI_PROVIDER_OUTPUT_TOO_LARGE` en `AI_PROVIDER_SAFETY_UNAVAILABLE`.

Safety blocks maken geen technische usage-row aan omdat er geen provider-call
was. De bestaande business-audit en credit-release-flow blijven de
invocation-uitkomst vastleggen zonder prompt/response-inhoud.

## Usage, privacy en kosten

Na een echte provider-call mogen de bestaande technische usage-seams model,
provider request-id, input/output units en latency intern registreren. De
customer-facing output en business audit krijgen geen raw prompt, response,
tokenpayload of providersecret. Er is geen nieuwe cost logic; een toekomstige
provider/project-cost cap moet een aparte, expliciete seam krijgen.

## OpenAI project hard-limit runbook (handmatig, buiten deze slice)

Voor een gecontroleerde productieconfiguratie moet een bevoegde operator in
het OpenAI-project afzonderlijk controleren: projectmodeltoegang, spend/budget
hard limit, rate limits, key-rotatie/owner, alerting en een rollback/kill-switch
procedure. Deze slice verandert geen OpenAI-projectinstellingen en neemt geen
kostenbesluit namens de operator.

## Verificatiegrens

TestProvider en deterministische clocks dekken de implementatie en
adversarial cases: disabled, corrupt config, 4/5 en 5/5 uurcap, 20/20 dagcap,
2/2 concurrency, stale lease, duplicate invocation, nieuwe invocation onder
global cap, oversized input/output, provider failure en RPC failure. De
gecontroleerde live E2E activeerde de bestaande seam eenmaal in TEST: exact
één synthetische/no-PII OpenAI-call, FUP lease `COMPLETED`, credits reserve/settle
`1/1`, structured result `VALIDATED`, usage `208/85` tokens en `3362 ms`. De
privilege-readback bevestigde service-role allow en authenticated/anon deny; de
eerste product capability blijft deferred.
