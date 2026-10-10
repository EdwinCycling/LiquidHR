# LiquidHR AI — Master Roadmap

**Status:** PRODUCTKOERS 2026-10-10 / LIVING DOCUMENT  
**Bijgewerkt:** 10 oktober 2026  
**Owner:** LiquidHR Product  
**Functie:** centraal AI-roadmapdocument; AA-ROAD blijft de brede productroadmap, AA-NEXT bepaalt de eerstvolgende concrete Codex-runs.

> **Besluit 10 oktober:** eerst ONE VERSION en APIAI-08 ESS afronden, vervolgens MSS (APIAI-09) zoveel mogelijk in één grote bouwslag, dan LiquidHR Focus als ChatGPT Plugin Extension (APIAI-10), daarna echte acties met trusted confirmation (APIAI-11). Brede HR Admin-/publieke API-/always-on agentuitbreiding voorlopig parkeren. Een vroege technische Extension-spike kan al eerder, zolang deze de lopende release niet verstoort.

## 1. Visie en productprincipes

**Eén LiquidHR, meerdere AI-interfaces.** HeRa binnen LiquidHR, ChatGPT via OAuth/MCP, de Focus Extension, WebMCP en GPT-Live spreken met dezelfde gecontroleerde domeinservices. Er komt geen tweede HR-app, tweede authmodel of aparte businesslogica in een AI-agent.

De gebruikerswaarde staat centraal:

- **Employee / ESS:** begrijp mijn ontwikkelplannen, skills, competenties, verlof en persoonlijke taken; vraag hulp en bereid veilige acties voor.
- **Manager / MSS:** bekijk mijn directe team, werkvoorraad, relevante verlofplanning en talentontwikkeling; analyseer en handel gecontroleerd.
- **LiquidHR Focus:** bestaande mobiele, rolgestuurde ESS/MSS-interface is het UI-fundament, ook voor de ChatGPT Extension. Geen volledig nieuw HR-dashboard bouwen.
- **HeRa en ChatGPT:** verschillende kanalen op dezelfde capability-catalogus, niet twee concurrerende intelligentielagen.
- **Acties:** Prepare → Preview → Confirm → Execute → Readback, met echte server-gevalideerde gebruikersbevestiging vóór elke write.
- **AI governance:** autorisatie, tenant/HR-groep/administratie, RLS, Liquid Credits, kosten/safety, idempotentie, auditing en privacy horen in de gedeelde serverlaag.

## 2. Waar staat de code echt?

Dit document gebruikt vier bewijsniveaus:

- **BEDOELD:** productwens of geaccepteerd ontwerp.
- **GEBOUWD:** concrete code op een identificeerbare branch/SHA.
- **GETEST:** de genoemde positieve/negatieve scenario's zijn daadwerkelijk uitgevoerd.
- **RELEASED OP TEST:** de exact geteste SHA is op de gedeelde Vercel TEST-omgeving gedeployed en met hosted smoke geaccepteerd.

Het Vercel-label Production is bij LiquidHR de deployment-targetnaam voor de **synthetische gezamenlijke TEST**, geen claim over echte klantproductie.

**Momentopname op 2026-10-10, opnieuw verifiëren na lopende ONE VERSION-merge:**

- GitHub main: **783999044de83c902e63fefb3587fdbbf99d4de3**.
- Vercel alias https://liquid-hr-hr-suite.vercel.app: deployment **dpl_A9iNj25sybqbsS5zwghbYBSzYhUR**, READY op dezelfde SHA.
- Supabase Core TEST: **wnpfloqpjvaacobppbpk**. Payroll Lab is een apart project en mag niet onbedoeld worden gewijzigd.
- APIAI-08: bestaande branch **work/apiai-08-ess-assistant-20261009**, Draft [PR #11](https://github.com/EdwinCycling/LiquidHR/pull/11); product-code SHA **d267f52729a8a1d4d348c4af4b0f13de3f162a0f**; documentatie-HEAD **21e03291181f5f0f2f0dc1cfefdfbfb26f6e6abc**. Niet gemerged, niet hosted gedeployed.
- **APIAI-08 SQL is wel al op TEST toegepast:** oorspronkelijke bestandsnaam 20261009142000_apiai08_employee_ess_controlled_actions.sql, remote migratieregistratie **20261010064331_apiai08_employee_ess_controlled_actions**. De twee CHECK-constraints, drie legacy-RLS-policies en audittrigger zijn teruggelezen; anon/authenticated kunnen de trigger niet direct uitvoeren. **Niet nogmaals toepassen.** Reconcileer bestandsnaam, contracttests en remote history via ondersteunde workflow; geen ad-hoc geschiedenisaanpassingen.
- Algemene Supabase security/performance-advisors zijn uitgevoerd. Bestaande projectbrede meldingen vormen geen automatisch bewijs van een nieuwe APIAI-08-regressie; wijzig ze alleen in een afzonderlijk goedgekeurde scope.

### Statusmatrix van bestaande AI-bouwblokken

| Spoor | Aantoonbaar bestaande basis | Nog open / niet claimen |
| --- | --- | --- |
| AI Foundation en governance | Typed providerneutrale runtime, governance, creditsreservering/settlement, audit, limiter en safety-contracten | Klantgerichte prijs-/tierkeuzes, complete live security/persona-acceptatie |
| AI Everywhere | Proposal-only ontwerpen/implementatie voor Employee Summary, Conversation Preparation, SMART Development Goals en Vacancy Draft | Geen automatische HR-writes, publicatie of volledig geaccepteerde hosted flow claimen |
| HeRa / Conversational AI | Chat/orchestration en typed tools, gedeelde Controlled Actions-contracten | Provider- en volledige hosted action-acceptatie |
| GPT-Live / Team AI / Mijn logboek | WebRTC- en conversation/notes-implementatiecandidates en lokale/Preview-tests | Menselijke microfoon/audio E2E, toepasselijke remote migrations, privacy en usage-acceptatie |
| APIAI-01 | Veilige externe API foundation en OAuth/RLS/limiter/audit-principes | Algemene publieke partner-API blijft uit |
| APIAI-02 | Gedeelde, getypeerde Workforce-toolcatalogus/dispatcher | Elke uitbreiding heeft eigen audience-/privacy-/hostacceptatie |
| APIAI-03 | Lokale MCP-transportlaag/Inspector | Niet hetzelfde als brede publieke MCP-activatie |
| APIAI-04 | ChatGPT MCP-profiel en metadata | Alleen specifieke vrijgegeven tools |
| APIAI-05 | WebMCP progressive enhancement in bestaande HR-webapp | Platform-/browserafhankelijke acceptatie gescheiden houden |
| APIAI-06 | Intern Controlled Actions-framework met Talent-acties, autorisatie, previewhash, idempotentie en audit | ChatGPT Execute blijft UIT zonder betrouwbare menselijke confirm |
| APIAI-07 | OAuth Remote MCP TEST; 4 echte Talent-reads via ChatGPT met audit/limiter; in huidige main | Aanvullende revoke/persona-negatives waar open |
| APIAI-08 | 4 ESS-reads en HeRa verlof/reminderacties gebouwd; 2.554 lokale tests op exacte product-SHA | Hosted ESS, saldo-fixture, scope-/browsernegatieven, PR-merge |

## 3. Prioriteit en iteratieraming

Eén iteratie betekent een substantiële Codex-opdracht inclusief onderzoek, code, tests, herstel en evidence, niet één prompt of commit.

| Volgorde | Wave | Beoogd resultaat | Grote Codex-iteraties |
| --- | --- | --- | ---: |
| 0 | **AI-CONVERGENCE** | Eén main/ONE VERSION na payroll- en importintegratie | 1–2 indien nodig |
| 1 | **APIAI-08 CLOSE** | ESS Remote MCP hosted GREEN, saldo correct, HeRa-drafts veilig | 1–2 |
| 2 | **APIAI-09 MSS** | Manager-team/werkvoorraad/talent via Workforce + MCP | **1 grote bouwslag**, evt. 1 fixronde |
| 3 | **APIAI-10 FOCUS EXTENSIONS** | LiquidHR Focus zijpaneel naast ChatGPT + geselecteerde context | **3–5 totaal**, start met 1 spike |
| 4 | **APIAI-11 TRUSTED ACTIONS** | Verlof/reminders/goedgekeurde manageracties met echte bevestiging | **2–4** |
| Later | **PARKED** | Brede HR Admin, algemene API-partners en agents | Nog niet plannen |

**Totaal APIAI-08 t/m -11:** circa **7–13 iteraties**; inclusief extra convergence circa **8–15**. Geen tijdsgarantie: hostrollout, autorisatietoestemming, databaseconsistentie en browseracceptatie kunnen meer tijd kosten.

### 3.1 AI-CONVERGENCE — ONE VERSION eerst

- Laat de lopende payroll- en importconvergentie afronden vóór een nieuwe AI-merge.
- Bevestig daarna de nieuwe main-SHA, Vercel READY/alias/provenance en minstens één rollbackdeployment.
- Draai finale relevante HR, payroll-boundary, auth, import en MCP regressie op de exacte code.
- Vergelijk Supabase-migratiegeschiedenis (Core TEST versus Payroll Lab apart); herken de reeds toegepaste APIAI-08-migratie met afwijkend tijdstempel.
- Actualiseer na groen releasebesluit [AA-CURRENT](../../AA/AA-CURRENT.md), [AA-ACCEPT](../../AA/AA-ACCEPT.md) en [AA-NEXT](../../AA/AA-NEXT.md). Deze roadmap is geen vervanging voor technische acceptatie.
- **Releasegate:** één aantoonbare canonieke ONE VERSION, geen onopgeloste kritieke migratie- of autorisatieconflicten.

### 3.2 APIAI-08 CLOSE — Employee Self Service

**Remote READ:** behoud 4 bestaande Talent-reads en accepteer 4 ESS-tools:

1. employee.leave.balance.read — canoniek eigen saldo.
2. employee.leave.next.read — eerstvolgende toekomstige goedgekeurde vakantie.
3. employee.leave.requests.read — eigen aanvragen/status.
4. employee.reminders.read — persoonlijke reminders.

**HeRa Controlled Actions:** employee.leave.request.create en employee.reminder.create via bestaande canonical services; externe ChatGPT Execute standaard uit.

**Bekende saldogate:** TEST-bucket MCP_DEMO_WETTELIJK_2026 geeft snapshot 120 uur opgebouwd minus 24 uur opgenomen = 96 uur, maar er zijn 0 gekoppelde leave_accrual_transactions; canonical leave report meldde 0 uur. Actief 40/40-contract en actuele 160-uurs upfront-regel onderbouwen het snapshot niet. De 16 uur toekomstig goedgekeurd wettelijk verlof verklaart de 24 uur opname ook niet. Onderzoek accrual, historie, allocations en workflow; herstel alleen veilig, audited en idempotent via bestaande canonical services. **Geen kunstmatige 96-uursfix en geen eigen formule.**

**Definition of Done:** remote migratieregistratie reconciled zonder SQL-herhaling; acht geauthenticeerde ChatGPT MCP reads met echte TEST-data; Employee auth/RLS/logout/revoke/forged scope-negatieven; audit, limiter en runtime/browser-smoke; saldo consistent of expliciet geclassificeerde acceptatiegrens; finale tests/TypeScript/lint/i18n/build/payrollscan; PR #11 pas Ready/merge bij alle verplichte groene gates; post-merge smoke op identieke main-/Vercel-SHA.

### 3.3 APIAI-09 — Manager Self Service in één bouwslag

**Businessdoel:** manager vraagt in ChatGPT of HeRa naar het eigen team, werkvoorraad en ontwikkeling. Bestaande Focus MSS en Workforce Manager-services blijven de bron.

**Gecombineerde read-scope** (alleen waar de canonieke service en rechten dit ondersteunen):
- mijn directe team, beknopte medewerkerprojecties en teamoverzicht;
- eigen open proces-/verlofgoedkeuringen en werkvoorraad;
- teamkalender en geautoriseerde verlofplanning;
- teamvaardigheden, competenties, ontwikkelplannen, ontwikkelgaps en capabilitymatrix;
- eigen manager-reminders of follow-ups voor zover al toegestaan.

**Buiten MSS V1:** tenantbrede doorzoekbaarheid, willekeurige employee/manager selectors, salaris, bank/BSN, medische/verzuimdetails, privérelaties, beschermde dossiers, ruwe gespreksnotities en gevoelige vrije tekst. Geen gevoelige velden automatisch meesturen naar ChatGPT.

**Architectuur:** hergebruik Focus managerhome, focus-teamservice, Process Work en bestaande gedeelde Workforce-dispatcher. Eén batch met toolcatalogus, typed schema's, geautoriseerde projecties, lokale en hosted positieve/negatieve scope-matrix, audit/limiter en ESS-regressie.

**Definition of Done:** manager-geauthenticeerde hosted MCP-calls, directe-teamgrens bewezen; Employee kan manager-tools niet gebruiken; Manager ziet nooit niet-eigen team; actuele context-/rollen-/tenantwissel beveiligd; tests/build/rollout/rollback groen. Eén grote implementatierun met eventueel één gerichte herstelronde.

### 3.4 APIAI-10 — LiquidHR Focus Plugin Extension for ChatGPT

**Productdoel:** ESS/MSS Focus naast het ChatGPT-gesprek, met echte selectie en contextoverdracht. Geen tweede HR-webapp.

**Bestaand UI-hergebruik**, na hergebruikscan:
- apps/hr-suite/components/focus/focus-shell.tsx;
- focus-home.tsx, focus-manager-home.tsx, focus-section-views.tsx;
- apps/hr-suite/lib/focus/service.ts, section-service.ts, team-service.ts;
- bestaande /focus-routes, werkvoorraad, verlof en teamkalender.

**Verticale demo:**
1. Start vanuit bestaande LiquidHR Workforce TEST OAuth/MCP-koppeling.
2. Open ChatGPT Conversation Panel met officiële thread-entrypoint.
3. Toon een smalle, herkenbare Focus ESS-view (later Manager MSS) via geautoriseerde read-projections.
4. Selecteer één ontwikkelplan of enkele direct-teammedewerkers.
5. Voeg uitsluitend expliciet geselecteerde en toegestane, getypeerde gegevens toe aan de ChatGPT-conversatie/modelcontext.
6. Laat ChatGPT uitleg/vergelijking genereren; verwijder selectie/context bij logout, tokenrevocation, rol-/teamwissel.
7. Val veilig terug op de normale Focus-webapp als de host feature ontbreekt.

**Technische spike — eerst hostsupport bewijzen:** OpenAI [Plugin Extensions](https://developers.openai.com/plugins/build/extensions) en actuele MCP Apps SDK; echte thread panel-open, context/send-message bridge, OAuth/scope, CSP/origin en browser/clientcompatibiliteit. Composer mentions zijn desktop-specifiek; andere Extensions kunnen eveneens per host/account/rollout verschillen. Claim daarom nooit een werkende hostfeature op grond van SDK-types alleen.

**UI-architectuur:** scheid Focus-presentatiecomponenten en pure projecties van de bestaande Next-cookie-auth routes. Een rechtstreeks iframe van /focus met impliciet vertrouwde cookies is niet het ontwerp. Gedeelde design tokens, NL/EN, accessibility, responsive compact states; loading/empty/error/revoke. Gebruik modelcontext alleen als minimale gegevensoverdracht, niet als autorisatiebewijs. Nooit automatisch bank, salaris, medische of andere gevoelige data sturen.

**Definition of Done:** echte geteste ChatGPT-host, zichtbaar ESS/MSS paneel, selectieve contextoverdracht, positief/negatief scopebewijs, fallback, browser/netwerk/security/privacytests, backend audit en veilig deploy/rollback. Raming 3–5 grote runs; beperkte proof of concept bij direct werkende host 1–2.

### 3.5 APIAI-11 — Trusted Actions (eerst echte waarde)

**Startacties:**
- Employee: verlofaanvraag indienen en persoonlijke reminder maken.
- Manager: eigen verlof- of procesgoedkeuring uitvoeren via bestaande workflowservices (alleen als de specifieke authorisatie en statusovergang passen).
- Talent: ontwikkeldoel/check-in met bestaande Controlled Actions waar toegestaan.

**Verplichte writeketen:** Prepare → Preview → Confirm → Execute → Readback.

Servercontrole: geverifieerde actor, juiste tenant/HR-groep/administratie en onderwerp, feature/permission, objectstatus, immutable payload/previewhash, verwachte versie, expiry, idempotency, audit en opnieuw autoriseren bij execute. Een modelantwoord of model-supplied confirmed:true is geen betrouwbare toestemming.

**Twee bevestigingspaden:**
1. **Binnen Focus Extension:** alleen als de server bewijs kan verifiëren dat de echte gebruiker exact die immutable preview bevestigd heeft.
2. **Veilige fallback:** diep linkje naar gewone LiquidHR Focus in de eigen geauthenticeerde sessie; gebruiker keurt daar de preview goed; ChatGPT leest alleen de uitkomst terug.

**Definition of Done:** één volledige echte synthetic TEST write met canonical readback en audit per geselecteerde actie; negatieve tests op replay, forged scope, stale preview, expired draft, doubleclick, ontbrekende confirmation, geannuleerde acties en geweigerde rights. Specifieke remote action pas expliciet activeren na hosted securityacceptatie. Bij ontbrekend bewijs remote Execute OFF houden.

## 4. Parallelle AI-productsporen (niet automatisch onderdeel van APIAI-09/10/11)

| Onderwerp | Richting | Huidig beleid |
| --- | --- | --- |
| HeRa & Conversational AI | Eén providerneutrale conversational core, beperkt geheugen, typed tools | Separate provider-/hostacceptatie; geen tweede authorisatielaag |
| AI Everywhere | Medewerkersamenvatting, gespreksvoorbereiding, SMART doel, vacaturetekst | Proposal-only en menselijke review; geen autonome persist |
| Liquid Credits & Governance | Efficient/Balanced/In-depth, HR-groep allowance, quota, extra credits, usage | Foundation aanwezig; customer pricing/tier/productbesluit afzonderlijk |
| GPT-Live en Team AI | Voice als transport van dezelfde capabilities; teamlogboek alleen na review schrijven | Human mic/audio E2E en remote migraties bewijzen; niet als released claimen |
| Persoonlijk memory/logboek | Opt-in geheugen voor voorkeuren, geen HR-feitenduplikaat | Dataretentie en tenantisolatie leidend |
| Security/Observability | OAuth/revoke, RLS, featurekill-switches, audit, limiter en provider safety | Elk release opnieuw doelgericht controleren |

**Geparkeerd totdat expliciet herbesloten:** brede HR Admin-tenantinzichten via ChatGPT, generieke publieke partner-API, algemene marketplace, andere messagingkanalen (Teams/Slack/WhatsApp), autonoom doorlopende HR-agents, breed documentgebruik en andere niet-goedgekeurde gevoelige HR-data.

## 5. Gedeelde architectuur en harde grenzen

Dataflow:

1. ChatGPT Focus Extension / ChatGPT MCP / HeRa / WebMCP / GPT-Live.
2. Eén typed Workforce Catalog + MCP/BFF adapters, server-owned invocation.
3. Gevalideerde AuthContext/OAuth, tenant, HR-groep, administratie, rol, employee en directe-teamscope.
4. Canonieke permissions/module gates + RLS + minimalisatie + audit + limiter.
5. Canonieke LiquidHR-domeinservices: Talent, Focus ESS/MSS, Leave, Reminders en Workflow.
6. Supabase bronadministratie.
7. Controlled Actions gebruikt dezelfde auth/domeinservices en de separate menselijke bevestigingsgrens.

**Niet onderhandelen over:** geen service-role op algemene HR READ-queries; geen user-provided scope als autoriteit; geen raw SQL-tools voor een model; geen secrets naar browser/log; geen gevoelige tool-output naar modelcontext zonder expliciet contract; geen automatische writes; geen migratie dubbel uitvoeren; geen directe ledger-DML voor fixturecorrecties; geen Docker; bestaande beschermde envconfig niet lezen of overschrijven.

## 6. Acceptance contract voor iedere nieuwe wave

- **Vooraf:** latest main/SHA, juiste branch, dependencycheck, bestaande code/AA-regels en reproduceerbare synthetische TEST-data.
- **Beveiliging:** Employee/Manager/HR Admin positieve en negatieve rollenmatrix, login/logout, stale role/context, forged selectors, revoke/token lifetime, cross-team/tenant, RLS en module flags.
- **Business:** geautoriseerde canonical services, bounded data, nul verzonnen HR-uitkomsten, correcte as-of en paginering, audited/idempotent writes.
- **Kwaliteit:** relevante gerichte tests, volledige finale HR-regressiesuite na productwijzigingen, strict TS, lint zonder fouten, NL/EN, production build, Payroll client-boundary scan, desktop/small-screen UI-tests waar relevant.
- **Host:** werkelijke OAuth/MCP/tools-call, audit/limiter readback, Vercel runtime/browserconsole, expected SHA, READY alias en rollback.
- **Release:** bij GREEN reguliere PR-merge naar main, nieuwe deployment van exacte merge SHA, na-merge smoke. Anders Draft/HOLD; geen fictieve releaseclaims.
- **Docs:** AA-CURRENT, AA-ACCEPT, AA-NEXT en relevante domein-/acceptatierapporten actualiseren zodra formele releasebeslissing is genomen.

## 7. Open risico's / besluiten

1. APIAI-08 lokale SQL-timestamp versus reeds geappliceerde remote TEST-timestamp reconciliëren zonder dubbele uitvoering.
2. Verlofledger versus bucket- en upfront-rule-afwijking veilig oplossen, zonder saldo te forceren.
3. MSS manager-scope en privacyfilter expliciet bewijzen voordat tools extern beschikbaar zijn.
4. Real-host OpenAI Extensions-compatibiliteit controleren; SDK-ondersteuning ≠ ChatGPT-clientbeschikbaarheid.
5. Echt server-verifieerbaar Action Confirm-contract vaststellen; desnoods Focus-webapp als secure fallback.
6. HeRa provider, GPT-Live menselijke audio/voice en Team AI aparte acceptatiepunten laten blijven.

## 8. Bronnen en relatie met de AA-documentatie

**Canonieke platform-/releaseregels:**
[AA-README](../../AA/AA-README.md), [AA-REQ](../../AA/AA-REQ.md), [AA-OP](../../AA/AA-OP.md), [AA-TEST](../../AA/AA-TEST.md), [AA-REL](../../AA/AA-REL.md), [AA-ROAD](../../AA/AA-ROAD.md), [AA-NEXT](../../AA/AA-NEXT.md), [AA-CURRENT](../../AA/AA-CURRENT.md), [AA-ACCEPT](../../AA/AA-ACCEPT.md).

**AI-basisbesluiten:**
[ADR-0010 AI runtime](../../decisions/ADR-0010-ai-runtime-governance.md), [FDR-0008 Liquid Credits](../../decisions/FDR-0008-ai-capability-en-liquid-credits.md), [AI Foundation Wave 0](LIQUIDHR_AI_FOUNDATION_WAVE_0.md), [AI Foundation Wave 1B](LIQUIDHR_AI_FOUNDATION_WAVE_1B_LIQUID_CREDITS.md), [AI Everywhere](LIQUIDHR_AI_EVERYWHERE_V1.md), [HeRa](../chatbot/HERA_AI_AGENT.md).

**API/MCP + ESS:**
[APIAI-02 Workforce](APIAI-02_WORKFORCE_TOOLS.md), [APIAI-03 Local MCP](APIAI-03_LOCAL_MCP_TRANSPORT.md), [APIAI-04 ChatGPT](APIAI-04_CHATGPT_MCP_PLUGIN.md), [APIAI-05 WebMCP](APIAI-05_WEBMCP_PROGRESSIVE_ENHANCEMENT.md), [APIAI-06 Actions](APIAI-06_CONTROLLED_ACTIONS.md), [APIAI-07 Remote MCP](APIAI-07_REMOTE_MCP_TEST.md), [APIAI-08 requirements op PR #11](https://github.com/EdwinCycling/LiquidHR/blob/work/apiai-08-ess-assistant-20261009/docs/requirements/ai/APIAI-08_ESS_ASSISTANT.md). Gedetailleerde acceptatie onder docs/quality/acceptance/runs/.

**Voice/conversation:**
[GPT-Live roadmap](LIQUIDHR_AI_ROADMAP_2.0_GPT_LIVE.md), [Conversational Team AI/logboek](LIQUIDHR_CONVERSATIONAL_AI_V2_TEAM_AI_LOGBOOK.md).

**Extern technisch contract:** [OpenAI Plugin Extensions](https://developers.openai.com/plugins/build/extensions).

**Onderhoudsregel:** dit bestand is de centrale AI-productvolgorde. AA-ROAD linkt hiernaartoe. AA-NEXT neemt ná de lopende ONE VERSION release de werkelijk eerstvolgende wave op. Technische status blijft onder AA-CURRENT/AA-ACCEPT/gedateerde acceptance reports; historische claims niet met nieuwe plannen verwarren.
