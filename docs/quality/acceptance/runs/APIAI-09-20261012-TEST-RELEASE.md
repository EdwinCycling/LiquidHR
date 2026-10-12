# APIAI-09 — beperkte synthetische TEST-release — 2026-10-12

## Verdict

**TEST RELEASED — LIMITED.** PR #18 is gemerged en automatisch gedeployed naar de bestaande synthetische TEST-omgeving. **APIAI-08 ACCEPTANCE OPEN; APIAI-09 ACCEPTANCE OPEN.** Dit rapport claimt geen volledige ACCEPTANCE GREEN. De eerdere APIAI-08- en APIAI-09-runs blijven ongewijzigd.

## Commit-, review- en qualityprovenance

- Code/test-SHA: `27d534fd06fee7868b3bf0534bc3fdb9a3736cd1`. De PR-head bij merge was `c5906d7469ef47fd5b9edf36c412772e9ac98a30`; het delta tussen code/test-SHA en PR-head was documentatie.
- PR #18 merge/main-SHA: `a5d1b3ff61e8c1d1af05a0c89b08a4fe73472495`. De actuele origin-main-advertentie is read-only opnieuw bevestigd met git ls-remote; de lokale checkout bleef op de PR-branch en is niet als deploymentcheckout gebruikt.
- PR #18-omschrijving is vóór merge bijgewerkt en na release gecorrigeerd. PR staat gemerged, niet meer Draft.
- Vóór merge: TypeScript (alle workspaces), gerichte ESLint, i18n (43 namespaces), `git diff --check`, 19 gerichte bestanden/180 tests en full suite (616 bestanden; 2.930 tests geslaagd, 8 overgeslagen; 4 bestanden overgeslagen) waren groen. Preview `dpl_4wdGu1WWCbjqbLqRV5qbhZfKCCkz` was READY op exact de code/test-SHA.
- Onafhankelijke lokale spec- en standaardenreviews vonden na de correcties geen blocker in de beoordeelde codepaden. Dit waren geen formele GitHub reviews. PR #18 had nul formele review-submissions; de geconfigureerde repositoryregels vereisten geen approvals of extra check gate. De Vercel PR-check was succesvol.
- Geen kritieke kwetsbaarheid werd gevonden in de gecontroleerde codepaden. Preview-backendisolatie is niet bewezen en staat OPEN.

## Security- en consentgrens

De Manager-consentgate blijft server-side fail-closed en gebonden aan de OAuth-client. Een bestaande OAuth-grant alleen ontsluit geen Manager-tools; Manager-calls vereisen geverifieerde delegated OAuth-context plus afzonderlijke geldige opt-in. Manager-context en rol worden server-side bepaald. Employee-scope is niet verruimd. Cookie/WebMCP-dispatch voert geen Manager-tool uit. Remote Execute bleef UIT. Er is geen Auth-, schema-, migration-, TEST-businessdata- of Production-write uitgevoerd.

## Beperkte release en hosted safety smoke

- Automatische Vercel-deployment: `dpl_7HBAyX61sjs1YNtmMZJU55NpNii6`, status **READY**, source Git, exact main-SHA `a5d1b3ff61e8c1d1af05a0c89b08a4fe73472495`.
- Canonieke alias: `liquid-hr-hr-suite.vercel.app`. Vercel target `production` is uitsluitend het kanaallabel van deze synthetische TEST-omgeving.
- Anoniem: `/login` 200; `/dashboard/start` 307 naar login; `/api/context` 401; `/api/employees` 401.
- Geauthenticeerde login/sessiesmoke en een hosted regressierun voor bestaande functies zijn na deployment niet uitgevoerd; de post-release smoke hierboven bewijst alleen de anonieme security-/routegrens. Dit blijft OPEN.
- MCP anoniem: `initialize` 200 (protocol 2025-03-26, stateless); `tools/list` 200 met 14 gepubliceerde tools (8 Employee, 6 Manager). Een anonieme Manager-`tools/call` kreeg een JSON-RPC-weigering met `isError=true` en “Authentication is required”, zonder `structuredContent`. Dit bewijst de anonieme deny, niet de geauthenticeerde rollen of data-scope.
- Rollbackreferentie: vorige READY-deployment `dpl_841Lz4YpcDrPUQ6aTzNA9KLjS7Ka` op main-SHA `db23b12446b4d04c823710ae48780dd0b47cc5b8`. Geen rollback uitgevoerd.

## Echte ChatGPT-connectorcontrole na release

Na de exacte deployment is de ondersteunde `Tools vernieuwen`-actie eenmaal uitgevoerd. De app gaf opnieuw “De app kan niet worden bijgewerkt. Probeer het opnieuw.” De vier al zichtbare Talent-tools zijn elk eenmaal read-only aangeroepen; alle vier gaven MCP `-32603: Internal error`. Dit zijn geen APIAI-08 Employee- of APIAI-09 Manager-acceptatietests.

De browserconsole gaf geen foutmelding. Deployment-scoped runtime-logzoekopdrachten leverden geen gecorreleerde MCP-diagnostiek op; nul gevonden regels bewijzen niet dat er geen request was. De precieze root cause is dus **onbekend**, niet een bewezen LiquidHR-routefout of bewezen ChatGPT/OAuth-defect. Er is geen onafhankelijke geauthenticeerde MCP-client gestart omdat daarvoor een bestaande authorized identity/flow nodig was; tokens, cookies en OAuth-credentials zijn niet geïnspecteerd. Er is geen account ontkoppeld, sessie gereset of grant vervangen.

## Open acceptance- en releasepunten

| ID | Status | Resterend bewijs |
| --- | --- | --- |
| APIAI-08 | **ACCEPTANCE OPEN — 0/8 Employee reads** | Herstel de ondersteunde connector- en geautoriseerde Employee-flow. Lees de actuele verlofstand uitsluitend via de canonieke service en reconcileer de bekende 96/0-uurafwijking zonder ledger-DML. Scope, revoke, audit en limiter blijven open. |
| APIAI-09 | **ACCEPTANCE OPEN — 0/6 Manager reads** | Edwin voltooit waar gevraagd de persoonlijke OAuth-/Manager-opt-in. Voer daarna de zes readtests uit met bestaande geautoriseerde synthetische identities; bewijs old-grant denial, consent/revoke/reconnect, rol-, tenant- en teamscope, actuele RLS, audit en limiter. Omzeil geen opt-in. |
| Hosted baseline | **OPEN** | Authenticated login/session and existing-feature hosted regression smoke were not run; only anonymous safety routes were checked. |
| Preview | **OPEN** | Preview-isolatie en Preview-config zijn niet bewezen; geen geauthenticeerde Preview-request is uitgevoerd. |
| Release metadata | **OPEN** | `APP_VERSION` bleef `1.20261011.2`. AA-REL §3 schrijft één bump per release voor. Dit is niet na merge gewijzigd; een nieuwe versie-only PR/merge/deployment vereist een afzonderlijk mandaat. |

## Huidige afsluiting

De code is in de synthetische TEST-omgeving gedeployed en anonieme safety smoke is groen. De resterende connector-, persona-, scope-, balance-, audit- en limiterbewijzen staan expliciet OPEN. Beperkte release en acceptance zijn afzonderlijke verdicts; er wordt geen volledige acceptance geclaimd.

