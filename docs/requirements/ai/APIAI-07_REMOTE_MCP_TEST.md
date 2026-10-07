# APIAI-07 — LiquidHR Workforce Remote MCP TEST

**Status: implementation in progress; TEST deployment and hosted acceptance remain gated.**

## Doel en begrenzing

APIAI-07 biedt Edwin's bestaande ChatGPT Plus-account een private, read-only Remote MCP-koppeling naar uitsluitend de synthetische LiquidHR TEST-omgeving. Edwin bevestigde dat zijn account-UI custom MCP-configuratie biedt en dat Supabase-projectref `wnpfloqpjvaacobppbpk` de synthetische TEST is, ondanks de dashboardlabel “main Production”. Het bestaande Vercel-project `liquidhr` gebruikt de Production-target als gezamenlijke TEST-omgeving.

Deze toestemming omvat de noodzakelijke TEST-only OAuth/consent- en MCP-configuratie, één additieve APIAI-07-migratie na groene lokale contracttests en remote readback, bounded TEST-limiterpolicy, clientregistratie na expliciete consent, en deployment/hosted acceptatie naar dezelfde bestaande Vercel-target. Er is geen toestemming voor productieactivatie buiten deze inrichting, publieke directorypublicatie, klantdata, nieuwe infrastructuur/kosten, algemene APIAI-01-routeactivatie of APIAI-06-writes.

De reeds toegepaste APIAI-01-migratie staat in de remote historie als versie `20261007114524`, naam `20261005051804_apiai01_rate_limit_and_read_audit`. Deze migratie wordt niet opnieuw uitgevoerd. De nieuwe migratie breidt alleen de bestaande allowlists uit voor `employee-self-service`, activeert één kleine TEST-policy en voegt een service-role-only RPC toe voor consent-time registratie van de vaste MCP-resource; geen nieuwe tabel.

## Externe tools

De Remote MCP-catalogus bevat uitsluitend bestaande read-only Employee self-service-tools:

- `employee.talent.development-plans.read` — eigen plannen, met de bestaande minimale APIAI-01-projectie;
- `employee.talent.development-gaps.read` — eigen gaps uit het actuele functieprofiel, zonder interne rationale of bronrecord-ID's;
- `employee.talent.skills.read` — eigen skills, zonder bewijsdocument-ID's of vrije tekst;
- `employee.talent.competencies.read` — eigen competenties, zonder bewijsdocument-ID's of vrije tekst.

Progress wordt in de plannen getoond. Check-in- en andere tools die een opaque goal-ID vereisen, Manager/HR-tools, alle schrijf-/controlled-action-tools en lokale-only MCP-tools worden niet extern geadverteerd.

## Authenticatie, toestemming en autorisatie

- Supabase OAuth 2.1/PKCE authenticeert de bestaande LiquidHR-gebruiker; de consentpagina toont clientnaam, exacte redirect-URI en gevraagde OIDC-scopes en biedt expliciet toestaan/weigeren.
- Alleen na goedgekeurde consent registreert een smalle server-side service-role RPC de door Supabase gevalideerde OAuth `client_id` voor de vaste `employee-self-service`-resource. Er is geen client-selecteerbare resource, tenant, HR-groep, administratie of medewerker.
- MCP-calls vereisen een geldige Supabase bearer met exacte issuer, `aud=authenticated`, role, subject, client ID en toekomstig expiry. Tokenclaims worden signature-geverifieerd en de user wordt live gevalideerd; de bearer wordt vervolgens aan dezelfde Supabase RLS-client gebonden.
- De bestaande `AuthContext`, self-permissions, actieve TALENT-module en RLS bepalen per request de toegang. OAuth/OIDC-scopes geven op zichzelf geen LiquidHR-rechten.
- Iedere geautoriseerde context-call consumeert de database-atomic limiter en schrijft een durable read-auditrecord. Auth, context, limiter, projectie of audit die niet betrouwbaar beschikbaar zijn, blokkeren de call.
- Er worden geen cookies naar MCP overgedragen en geen service-role HR-reads uitgevoerd.

## TEST-only route en uitschakeling

- Remote endpoint: `https://liquid-hr-hr-suite.vercel.app/mcp` op het bestaande `liquidhr` Vercel-project en uitsluitend de bestaande `production`-target die Edwin als gezamenlijke TEST heeft aangewezen.
- Externe route en OAuth-config staan standaard uit en worden alleen op die target aangezet na lokale gates, remote readback en identiteit/configuratiecontrole.
- De route controleert de exacte toegestane host, Vercel production-runtime, de bestaande Supabase TEST-project-URL en een afzonderlijke MCP-featureflag. Preview, localhost en andere projecten blijven dicht.
- Kill switch: zet uitsluitend `LIQUIDHR_REMOTE_MCP_ENABLED=false` op de Vercel Production-target (de gezamenlijke TEST), redeploy of activeer de bestaande runtime-configwijziging. ChatGPT kan daarna geen toolcalls meer uitvoeren. Een gebruiker kan daarnaast de connector/disconnect en Supabase OAuth-consent intrekken.
- Rollback: herstel de vooraf geverifieerde bestaande READY-deployment/alias op hetzelfde Vercel-project. Geen nieuwe project, domein of service.

## Vereiste acceptatie

1. Lokale migratiecontracttests controleren additiviteit, vaste resource, strikte service-role RPC-grants en actieve beperkte policy. Remote preflight bevestigt exact projectref, bestaande APIAI-01-contracten en afwezigheid van botsende bestaande data/policies.
2. Na migratie: readback van grants, functiedefinities, resourceallowlists en limiterpolicy; Supabase Security- en Performance-advisors; gegenereerde database-types.
3. OAuth discovery, PKCE-consent, weigeren/toestaan, geregistreerde callback, tokenclaims, refresh/revoke, en security-negatieven.
4. MCP `initialize`, `tools/list` en `tools/call`; de vier goedgekeurde tools geven uitsluitend self-data terug. Niet-authenticated, ongeldig/verlopen/verkeerd issuer/audience/role/client, niet-geregistreerde client, ontbrekende permission/module, forged context, te hoge rate en audit-/limiterfout blokkeren.
5. Durable audit en limiter readback na zowel toegestane als afgewezen contextcalls; kill-switch weigert nieuwe calls.
6. Lokale gerichte tests, volledige HR-regressies, strict TypeScript, lint/i18n indien toepasselijk, exacte production-build en hosted runtime-/browserfoutencontrole.
7. Edwin voltooit in zijn eigen ChatGPT UI de handmatige connector-authenticatie en eerste prompt. Zonder deze persoonlijke UI-uitvoering blijft ChatGPT-hostacceptatie open; een deployment of MCP protocoltest claimt die niet.

## ChatGPT handoff na groene hosted gates

- Pluginnaam: `LiquidHR Workforce`.
- MCP-URL: `https://liquid-hr-hr-suite.vercel.app/mcp`.
- Authenticatie: OAuth 2.1 met Supabase TEST-login, PKCE en expliciete consent.
- Eerste testprompt: `Welke ontwikkelplannen heb ik?`
- Daarna: eigen ontwikkelgaps, skills, competenties en andere later afzonderlijk goedgekeurde veilige self-service-reads.
- Geen autonome writes. APIAI-06 controlled writes blijven buiten toolset totdat een menselijk bevestigingsproces in ChatGPT aantoonbaar veilig is.

## Bronnen

- [Supabase OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server)
- [Supabase Getting Started with OAuth 2.1](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Supabase MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [OpenAI Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt)
