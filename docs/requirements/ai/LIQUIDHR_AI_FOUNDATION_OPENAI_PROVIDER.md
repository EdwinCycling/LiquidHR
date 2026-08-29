# LiquidHR AI Foundation — OpenAI Provider adapter

## Status en scope

Deze slice bouwt de production `OpenAIProvider` achter de bestaande
server-only `ProviderPort`. De eerste capability
`improve-existing-hr-text` blijft `PLANNED`; deze slice activeert geen
customer UI, geen eerste AI-feature en geen HeRa/Gemini-pad.

De keten blijft:

`feature → runtime → governance/Credits-gates → authorized context → ProviderPort → OpenAI Responses API → bestaande LiquidHR-validator → proposal-result`

Er is geen nieuwe database-entiteit, migration, permission, route of UI
toegevoegd.

## Providercontract

- De adapter gebruikt de officiële OpenAI TypeScript SDK en de Responses API.
- Het model wordt uitsluitend intern uit de bestaande provider mapping bepaald.
  De customer-profielen blijven `Efficient`, `Balanced` en `In-depth`; zij
  krijgen geen provider- of model-ID terug.
- De huidige geplande mapping is `Efficient → gpt-5.6-luna` met reasoning
  `low`. Niet vastgelegde mappings, waaronder `Balanced` en `In-depth`, falen
  gesloten totdat zij expliciet worden besloten.
- Instructies, authorized context, feature-, configuratie- en promptversies
  worden server-side samengesteld. De contextgrenzen worden vóór de provider
  call gecontroleerd.
- De Responses-aanvraag vraagt een strict JSON-schema met
  `liquid_hr_proposal`; de bestaande LiquidHR-validator blijft autoritatief
  voor de uiteindelijke semantische validatie.
- `store: false` voorkomt provider-side response persistence vanuit deze
  adapter. SDK retries staan expliciet op `0`; eventuele retrysemantiek blijft
  bij de bestaande runtime en een retry is een nieuwe invocation.

## Secret-, resolver- en runtimegrens

`OPENAI_API_KEY` is een server-only secret en staat uitsluitend als lege
placeholder in `apps/hr-suite/.env.example`. Er is geen `NEXT_PUBLIC_`-alias.
Ontbrekende productieconfiguratie geeft een typed configuration failure; de
productieresolver valt nooit stil terug op `TestProvider`.

Test en development gebruiken standaard de deterministische `TestProvider`.
Een expliciete OpenAI-modus kan voor een gecontroleerde omgeving worden
gekozen. De runtime blijft eigenaar van auth-, permission-, governance-,
credits-, context- en validator-gates; deze adapter omzeilt die gates niet.

## Timeout, abort en foutmapping

De adapter geeft de runtime-cancellation door, voegt een eigen timeout toe en
verwijdert listeners/timers na afloop. Providerfouten worden intern getypeerd
als `TIMEOUT`, `ABORTED`, `AUTHENTICATION`, `CONFIGURATION`, `RATE_LIMIT`,
`UNAVAILABLE`, `INVALID_REQUEST`, `INVALID_RESPONSE` of `UNKNOWN`. Naar de
bestaande runtime gaan uitsluitend de bevroren stabiele failure-codes
`PROVIDER_UNAVAILABLE` of `PROVIDER_FAILED`; SDK-foutteksten, prompts en raw
responses worden niet doorgegeven.

## Usage, metadata en privacy

Technische metadata mag provider-code, intern model-ID, reasoning-profiel,
response-ID en numerieke usage bevatten. Business-audit bevat geen raw prompt,
raw response, tokens, kosten of secrets. De customer-facing proposal bevat
geen provider metadata; output wordt pas na de bestaande validator als
proposal-result gebruikt.

## Live smoke

Een gecontroleerde live smoke is eenmaal uitgevoerd met expliciete approval en
uitsluitend synthetische/no-PII context. De Responses-call gebruikte
`gpt-5.6-luna`, reasoning `low`, `store: false` en `maxRetries: 0`; de
provider-call count was exact `1`. Invocation
`3c011465-d7eb-4125-b7cd-ebbb7c457506` eindigde `SUCCEEDED` met structured
result `VALIDATED`, `208` inputtokens, `85` outputtokens en `3362 ms` latency.
Er is geen eerste product capability/UI geactiveerd en HeRa/Gemini is niet
gewijzigd.
