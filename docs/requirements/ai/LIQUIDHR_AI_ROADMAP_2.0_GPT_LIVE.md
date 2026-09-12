# LiquidHR AI Roadmap 2.0 en GPT-Live V1

Status: LOCAL IMPLEMENTATION CANDIDATE — remote database en live OpenAI-validatie nog open

## Roadmap

LiquidHR bouwt voort op één gecontroleerde capability-laag:

1. **AI Foundation** — provider/model-mapping, server-side autorisatie, governance, Liquid Credits, usage, audit en idempotente invocations.
2. **AI Everywhere** — proposal-only capabilities in bestaande HR-workflows: `EMPLOYEE_SUMMARY`, `CONVERSATION_PREPARATION`, `DEVELOPMENT_GOAL_SMART` en `VACANCY_DRAFT`.
3. **Conversational AI** — één orchestration-laag die dezelfde goedgekeurde capabilities kan aanroepen vanuit tekst of voice.
4. **Voice** — GPT-Live is alleen een realtime interface; businessregels en tool-uitvoering blijven bij LiquidHR.
5. **Agentic HR** — later gecontroleerde multi-step workflows, altijd met expliciete menselijke bevestiging voor gevoelige writes.

## GPT-Live V1

De eerste slice start vanuit een medewerkerprofiel voor een manager, HR-adviseur, HR Admin of tenant-admin. De browser maakt een WebRTC-offer en stuurt dat naar de serverroute. De server valideert de medewerkercontext en `ai:use`, voegt een beperkte realtime toolconfiguratie toe en gebruikt de permanente OpenAI-key uitsluitend server-side voor `POST /v1/realtime/calls`. De browser ontvangt alleen het SDP-answer.

De drie voice-tools hebben geen employee-ID-argument:

- `employee_summary`
- `conversation_preparation`
- `development_goal_smart` met uitsluitend `sourceText`

De URL-context van LiquidHR bepaalt de medewerker. Iedere tool-call gaat opnieuw door server-side autorisatie en routeert naar de bestaande AI Everywhere-capability. SMART blijft een voorstel; voice kan geen HR-data opslaan, publiceren of wijzigen.

## Governance, credits en privacy

Voice vereist bestaande AI-governance (`ai:use`) plus de expliciete serverfeatureflag `AI_REALTIME_VOICE_ENABLED` in productie. Direct managers krijgen `ai:use` via de forward migration voor deze slice. De drie aangeroepen capabilities gebruiken hun bestaande Liquid Credits-reservering, settlement, audit en technical-usage lifecycle. De realtime transportlaag zelf wordt in V1 gemeten via `ai_voice_sessions` (sessiestatus, duur en tool-call count); commerciële minutenprijzen blijven een latere productbeslissing.

Er wordt geen audio, transcript, volledige prompt of volledige toolinhoud opgeslagen. De metadata-opslag bevat alleen scope, actor, doelmedewerker, model, status, duur en aantallen. De voice-sessie deelt geen permanente OpenAI-key met de browser. Tool-output blijft proposal-only en wordt pas door bestaande UI-flows opgeslagen na expliciete gebruikersactie.

## Luna → Astra experiment

Luna blijft eigenaar van discovery, architectuur, security, integratie, tests, validatie en acceptatie. Astra kreeg één verse, minimale opdracht voor uitsluitend `components/employees/employee-live-voice.tsx`, met de HTTP-contracten en de stopconditie. Effectief: GPT-6 Astra, reasoning `low`. Luna heeft de diff zelf geïnspecteerd en de JSON-string parsing van Realtime function-call arguments als integratiefix aangebracht; daarna zijn gerichte tests, strict TypeScript en i18n uitgevoerd.

## Gates

- **IMPLEMENTED:** lokale serverroutes, WebRTC session-config, drie tool-routes, metadata-migration, i18n en employee-profile control.
- **TESTED:** realtime contracttests, bestaande employee-AI tests, strict TypeScript, i18n parity en diff-check.
- **NOT TESTED:** live WebRTC, microphone permission, OpenAI Realtime call, authenticated persona flows en remote migration/advisors.
- **BLOCKED:** remote migration/apply en live OpenAI-validatie vereisen expliciete remote scope, een geldige server-side `OPENAI_API_KEY` en een geautoriseerde DEV/TEST database-run.

## Vervolg

- V1: remote DEV/TEST migration, authenticated Manager/HR negative checks en live WebRTC lifecycle.
- V2: gedeelde conversational core voor HeRa/text en voice, met een typed adapter in plaats van voice-specifieke businesslogica.
- V3: meer read/proposal-tools met dezelfde authorization- en creditgrenzen.
- V4: gecontroleerde agentic HR-workflows met expliciete review/publish boundaries.
