# LiquidHR Conversational AI V2, Team AI en Mijn logboek

Status: LOCAL IMPLEMENTATION CANDIDATE — MIGRATION NOT REMOTE APPLIED

## Doel en grens

Deze slice bouwt de tweede Conversational AI-laag bovenop de bestaande AI
Foundation en AI Everywhere-capabilities. Team AI is een gecontroleerde
GPT-Live-interface op de Start-pagina voor een vaste, server-bepaalde scope.
Mijn logboek is een persoonlijke werkruimte voor handmatige notities en door
AI voorgestelde team-samenvattingen.

De slice maakt geen autonome HR-beslissingen en schrijft nooit automatisch naar
Employee Notes, doelen, beoordelingen, dossiers of publiceerbare HR-data. Een
AI-team-samenvatting wordt alleen na review en expliciete gebruikersactie als
eigen logboeknotitie opgeslagen.

## Scope en autorisatie

- Een `DIRECT_MANAGER` krijgt uitsluitend de actuele directe teamleden via de
  bestaande server-side team-scope-resolver.
- `TENANT_ADMIN` en `HR_ADMIN` kiezen een actieve afdeling binnen de actieve
  tenant/HR-group. `HR_ADVISOR` ziet en gebruikt alleen toegewezen afdelingen.
- De gekozen afdelings- of teamscope wordt bij het starten van de sessie
  server-side opnieuw opgelost en als vaste sessie-membership opgeslagen.
- Iedere tool-call controleert opnieuw actor, tenant, HR-group, sessie en
  medewerkerbinding. Browser-aangeleverde employee- of department-ID's worden
  niet vertrouwd.
- `logbook:*`-permissions zijn eigenaar-gebaseerd. RLS beperkt lezen, wijzigen
  en verwijderen tot de huidige `owner_user_id` in de actieve HR-group.

## GPT-Live transport

De browser maakt een WebRTC SDP-offer. De server maakt met de permanente key
een Live-sessie aan via `POST https://api.openai.com/v1/live/sessions` met
`session.model = gpt-live-1`, `transport.type = webrtc` en het ongewijzigde
SDP-offer. Het legacy `session.type`-veld en de Realtime-callvorm worden niet
gebruikt. De browser krijgt alleen het SDP-answer en wacht op
`session.started`; de API-key blijft server-side.

Team AI exposeert alleen deze server-delegated tools:

- `team_overview`
- `team_employee_summary` met een exacte zichtbare naam
- `team_conversation_preparation` met een exacte zichtbare naam
- `team_summary_proposal` met door de gebruiker beoordeelde samenvattingstekst

Er worden geen audio, ruwe transcripties, volledige prompts of volledige
toolpayloads opgeslagen. Onderbreken pauzeert de lokale audio-weergave; de
full-duplex barge-in loopt via de Live-mediatransportlaag en gebruikt geen
legacy Realtime-events. De sessiemetadata bevat alleen scope-, actor-, model-,
status-, duur- en aantalsgegevens.

## Mijn logboek

`personal_logbook_entries` bevat alleen de uiteindelijke titel en tekst die de
eigenaar expliciet opslaat. AI-entries verwijzen naar een beëindigde Team
AI-sessie voor provenance. De audit-trigger schrijft uitsluitend bron-,
context-, sessie- en changed-flags en kopieert geen titel of beschrijving.

## Liquid Credits en proposal-boundary

`TEAM_SUMMARY` gebruikt de bestaande AI Foundation-runtime, governance,
provider safety, Liquid Credits, idempotency, audit en usage-lifecycle.
`EFFICIENT`, `BALANCED` en `IN_DEPTH` kosten respectievelijk 1, 2 en 3 units.
Team Summary, Employee Summary, Conversation Preparation en SMART blijven
voorstellen; expliciet bewaren blijft de persistence boundary.

## Implementatie-oppervlak

- Schema/RLS: `ai_team_sessions`, `ai_team_session_members` en
  `personal_logbook_entries` in de forward migration
  `20260914100000_conversational_ai_v2_team_logbook.sql`.
- Server-scope en tools: `lib/ai/team-scope.ts` en `lib/ai/team-ai.ts`.
- Voice-routes: `/api/team-ai/voice/session`, `/tool` en `/usage`.
- UI: Team AI op `/dashboard/start`; Mijn logboek op `/logbook`.
- Contracten: Team AI realtime event/tool parsing, logbook Zod-inputs en
  migration contracttests.

## Gates

Lokaal zijn strict TypeScript, ESLint, i18n-pariteit, gerichte contracttests
en de nieuwe UI-contracten groen. De volledige suite heeft twee bekende,
ongewijzigde failures buiten deze slice: de bestaande DM-1
asset-storage-key CASE-contracttest en de bestaande PDF-renderer-timeout.

De forward migration is nog niet op DEV/TEST Supabase toegepast. Daardoor zijn
remote RLS/advisors, authenticated Team AI tool-calls, persisted logbook
readback en echte GPT-Live Team AI microphone-acceptance nog open. Geen
Production/main/leave-branch wijziging is onderdeel van deze slice.
