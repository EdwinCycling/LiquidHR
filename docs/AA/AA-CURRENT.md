# AA-CURRENT — Current LiquidHR State

## PERF-V2-01 Core TEST en GitHub-integratie — 27-11-2026

- PR [#105](https://github.com/EdwinCycling/LiquidHR/pull/105) is samengevoegd op `987d1f4f475d8de316b97aeee0b87102ee1375e0`. De geteste code-SHA is `4f78b5e146d1cfb47cd89bdd8bae6f08f5ddd550`.
- Core TEST `wnpfloqpjvaacobppbpk` registreert de migraties `20261127102848` en `20261127103840`. Bestaande reviewdata en V1-rondes bleven intact; geen Payroll-schemawijziging.
- Lokale/Core-engineeringevidence: A01–A22 en A24 PASS; A23 NOT_RUN voor browsermatige responsive-/a11y-acceptatie. Hosted persona/browserstatus A01–A24: NOT_RUN. A24 is als totaal nog niet volledig geaccepteerd. Geen volledige ACCEPTANCE GREEN.
- V1 A13, A26 en A27 blijven OPEN voor latere handmatige securityacceptatie. Geen bestaande HR Admin-, Manager- en Employee-sessies beschikbaar; geen accounts of tenants aangemaakt.
- Vercel TEST is niet uitgerold. De bestaande READY-deployment blijft op source-SHA `3b76be2c614d4e1abbac5f7289925ef8d75eddbd`; Git-deployments blijven uitgeschakeld. Een aparte `RELEASE LIQUIDHR TEST`-vrijgave is vereist.
- Bewijs: [PERF-V2-01 Core TEST-acceptatiematrix en releasechecklist](../quality/acceptance/runs/PERF-V2-01-CORE-TEST-20261127.md).

## PERF-MVP-01 GitHub-integratie — 26-11-2026

- De geteste MVP-codekandidaat `a965c18ee131a43938d8886abac38a4720ca349b` is via een gewone fast-forwardpush geïntegreerd in GitHub `main`. De integratiecommit was `68493eb20e2b6ab9109edcf4f922cf34b686280a`; de exacte huidige `main`-SHA staat in het [integratierapport](../quality/acceptance/runs/PERF-MVP-01-GITHUB-INTEGRATION-20261126.md).
- Vercel-project `liquidhr` gebruikt Root Directory `apps/hr-suite`. De featurebranchconfiguratie `apps/hr-suite/vercel.json` is gelijk aan `main` en bevat `git.deploymentEnabled: false`; daardoor is de file-based Git-deploymentbeveiliging op de effectieve project-root van toepassing. Na de push bleven de bestaande READY-deployment en drie aliassen ongewijzigd; geen Vercel-release gestart.
- Acceptatiematrix: **31 PASS, 1 NOT_RUN, 2 BLOCKED, 0 FAIL**. A30 PASS; A13, A26 en A27 blijven OPEN voor latere handmatige/securityacceptatie. Geen volledige securityacceptatie of productiegeschiktheidsclaim.
- De bestaande relevante Vitest-suite (4.302 PASS plus 2 aparte kalendercontracttests), TypeScript, i18n en geïsoleerde production-build waren groen op de kandidaat vóór integratie; deze tests zijn zonder codewijziging niet herhaald. ESLint: 0 fouten en 9 bestaande waarschuwingen.
- Geen remote SQL/datawrite, nieuwe fixtures of Vercel-release. Bestaande dirty bestanden in lokale worktrees zijn niet meegenomen.
- Bewijs: [GitHub-integratierapport](../quality/acceptance/runs/PERF-MVP-01-GITHUB-INTEGRATION-20261126.md) en [technische acceptatiecloseout](../quality/acceptance/runs/PERF-MVP-01-TECH-CLOSEOUT-20261126-a965c18.md).

> 21-11-2026 — De geconsolideerde operationele TEST-baseline is door Edwin geaccepteerd en de consolidatie is COMPLETE. De release blijft LIMITED TEST; gehoste functionele personaacceptatie blijft PARTIAL. De app draait op het vaste TEST-domein met versie 1.20261120.1. Deze status vervangt oudere actuele koppen in historische documentatie.

## Canonieke release

- Centrale hoofdmap: C:\Users\Edwin\Documents\Apps\LiquidHR, branch main.
- Vercel-project: liquidhr; het technische target production is hier de synthetische TEST-runtime.
- TEST-URL: https://liquid-hr-hr-suite.vercel.app
- Appversie: 1.20261120.1; deze releaseversie is eenmaal verhoogd.
- Bij de release-readback op 20-11-2026 waren lokale main, GitHub main, Vercel platformSourceSha en runtime sourceSha exact gelijk aan `3b76be2c614d4e1abbac5f7289925ef8d75eddbd`. Op 26-11 is de MVP-code in GitHub main geïntegreerd; de actieve Vercel-applicatiebron bleef `3b76be2c614d4e1abbac5f7289925ef8d75eddbd` omdat geen deployment is uitgevoerd.
- Cloudbuildstatus READY; runtime-provenance en aliasreadback bevestigden de bedoelde project- en database-identiteit. Automatische Git-deploys bleven uitgeschakeld.

## Releasebesluit en acceptatie

De expliciete opdracht RELEASE LIQUIDHR TEST autoriseerde de gezamenlijke synthetische TEST-release. Edwin accepteerde de geconsolideerde operationele baseline als COMPLETE; de hosted functionele acceptatie blijft PARTIAL. Dit is geen globale ACCEPTANCE GREEN en geen commerciële Payroll-vrijgave.

| Domein | Status | Bewijsgrens |
| --- | --- | --- |
| HR/Core | LIMITED TEST / PARTIAL | Runtime-provenance PASS; beschermde anonieme API-calls geven 401. Bestaande SEC-101 post-CONTRACT-matrix: 44 PASS / 0 FAIL / 1 NOT TESTED. Andere-tenantfixture OPEN. |
| WVP | Code/build PASS; hosted PARTIAL | Week-42/PMUX-contract en route-smoke aanwezig. Geauthenticeerde casuslifecycle, documentacties en volledige rol-/negatieve scopeacceptatie OPEN. |
| Talent | Code/build PASS; hosted PARTIAL | TAL-INS01/02 en capabilitymatching geïntegreerd. Positieve plan-/bewijsrecords en persona/API/RLS-matrix OPEN. |
| Payroll ESS | Code/build PASS; hosted PARTIAL | Bestaande post-CONTRACT evidence blijft gelden; de volledige kandidaatmatrix is niet opnieuw voltooid. |
| Payroll HR Admin | Code/build PASS; hosted PARTIAL | Bestaande post-CONTRACT 3/3 is historische evidence. Nieuwe kandidaatpersona-login is niet voltooid; anonieme mutatieproeven zijn geweigerd. |
| SEC-101 | PARTIAL / OPEN voor productie | Bestaande rij-/kolombeveiliging intact; issue #101 blijft OPEN voor andere-tenantacceptatie. |

Loginpagina en relevante anonieme routes antwoordden HTTP 200. Runtime-provenance antwoordde HTTP 200 en bevestigde de releasebron. Anonieme context-, WVP-, Talent- en pro-forma-API-proeven werden geweigerd met 401. Op 21-11 draaide de bestaande lokale persona-runner tegen de huidige kandidaat; Lisa, Jaap en Frits eindigden BLOCKED. De lokale Test Auth/role-switchvoorziening is loopback-only; er was geen ondersteunde geauthenticeerde sessie voor de hosted kandidaat. Dit is ontbrekend acceptatiebewijs, geen vastgesteld productdefect. Geen rollen, tenants, accounts of rechten aangepast; geen businessdatawrites.

## Database en rollback

- Core TEST wnpfloqpjvaacobppbpk registreert 603 migraties; Payroll TEST jhgeriucbkfarxiudzfy registreert 19.
- Geen database- of Control Plane-migratie is in deze release uitgevoerd. Bestaande Core-migraties 20261119160230 en 20261119161917 zijn niet herhaald.
- Payroll-migratie 20261113073051 blijft geregistreerd, maar de exacte historische SQL-bron ontbreekt. De bekende kandidaat is niet als die bron aangemerkt. Dit is een apart herstelpunt; deze applicatierelease vereist geen nieuwe migratie.
- De vorige post-CONTRACT-deployment dpl_799S2oXST6MgNzW96iBqUnhUQ1RK op SHA 69d29bbe80a5791cf31c1d4966347f756cd10130 blijft behouden als rollbackpunt. Rollback is niet uitgevoerd; de release voerde geen databasewrite of nieuwe migratie uit.

## Technische verificatie

De geïntegreerde codekandidaat ca8ea172 behaalde HR Suite 4.277 PASS / 8 SKIP, Control 11/11, Payroll-regels 65/65, kalendercontract 2/2, TypeScript, ESLint, NL/EN, production build, Payroll-bundlescanner en function-tracegate PASS. Geldig ongewijzigd bewijs is hergebruikt; suites zijn niet opnieuw gedraaid voor een documentatie-closeout.

Gitleaks v8.30.1 is uit de officiële Windows-release gehaald na checksumcontrole. De volledige Git-geschiedenisscan gaf vier brede generic-api-key-hits; de getrackte snapshot gaf 53 hits van dezelfde generieke regel in documentatie, testfixtures en Payroll-reken-/broncode. Triage koppelde ze aan voorbeelden, testwaarden en numerieke Payroll-regelcode; de getrackte BSN_HASH_KEY-regel in .env.example is leeg. Geen provider-specifieke credentialvorm gevonden en geen matchwaarde gelogd. Beschermde .env.local is niet gelezen of meegenomen.

## Open na release

1. Voltooi de bestaande Manager-, Employee-, HR Admin- en Tenant Admin-personamatrix zodra ondersteunde bestaande sessies beschikbaar zijn; verbreed geen caller-allowlist of rechten.
2. Sluit GitHub #101 met een toegestane andere-tenantfixture vóór productiegebruik.
3. Vraag alleen een afzonderlijk gebundeld TEST-datamandaat als positieve Talent-records noodzakelijk blijken.
4. Bewijs de rollbackprocedure veilig en databasecompatibel; deploymentreadback is geen rollbackproef.
5. Herstel de ontbrekende bron van geregistreerde Payroll-migratie 20261113073051 uit een gezaghebbende bron; wijzig de remote historie niet.

## Richting

Deze consolidatieopdracht is afgerond; reguliere productontwikkeling gaat verder vanuit main. Manager-MSS en BONUS blijven PARKED; CONTROL02 en de officiële Loonaangifte-XML-import blijven geannuleerd. Bewijs- en recovery-openpunten staan in AA-OPEN; roadmap: AA-NEXT en AA-ROAD; gedateerde bronrapporten: docs/quality/acceptance/runs.

## Closeout 21-11-2026

De dependencyboom in de hoofdwerkmap is hersteld met `npm ci`; `npm ls --workspaces --depth=0` en de persona-configuratiepreflight slagen. De Windows-`TargetClosedError` zat in de Codex-processandbox rond Chrome Crashpad-pipes: de bestaande Playwright CLI startte normaal na de beoordeelde out-of-sandbox uitvoering. Geen Chrome-flags of applicatiecode aangepast.

De gerichte lokale persona-run is niet hosted acceptatie: Lisa stopte op de actieve Jupiter-scopecontrole, Jaap op contextsubmit/navigatie en Frits op de PFZW/pro-forma-verwachting. De hosted matrix blijft PARTIAL; geen deployment uitgevoerd.

Inventaris en behoudsredenen van resterende branches, worktrees en stashes staan in het [release- en closeoutrapport](../quality/acceptance/runs/LIQUIDHR-FINAL-RELEASE-20261120.md). Er zijn geen overige objecten aantoonbaar overbodig bevonden. De bestaande `.next`-output van de lokale run is verwijderd. De automatisch gewijzigde beschermde `apps/hr-suite/next-env.d.ts` bleef behouden nadat auto-review herstel naar HEAD afwees.

Status: ACTUEEL / LIVING
Bijgewerkt: 2026-11-21

## Laatste cleanup en codebaselines — 21-11-2026

**Consolidatie COMPLETE; hosted functionele acceptatie PARTIAL.** Centrale map `C:\Users\Edwin\Documents\Apps\LiquidHR`, lokale/GitHub main op `e2edd2a1` vóór deze documentatie-update. Vercel draait READY versie `1.20261120.1`, source-SHA `3b76be2c`. Het verschil is documentatie-only; geen nieuwe release.

Verwijderd: `payfast-01-20261106`, `payfast-render-baseline`, `liquidhr-final-integration-20261116` als Git-worktrees, plus de laatste residuele render- en integratiemappen. Voor die laatste bevestigde Windows PowerShell `Test-Path=False`. De twee Jaap-TEST-wachtwoordreset-hulpscripts uit de integratiemap zijn verwijderd na beoordeling. Oude unieke render-AA-/Focus-wijzigingen zijn op expliciete gebruikersinstructie zonder archief weggegooid; het WVP-follow-uprapport was eerder met SHA-256 in de centrale hoofdmap veiliggesteld. Geen productcode is hierdoor in main geïntegreerd.

Bewust behouden: `payfast-lisa-readonly-20261106` (oude Payroll-workbench/source-provider-diffs/tests/helper, niet veilig te mergen), drie Git-stashes en de canonieke `.env.local`-hardlinks. Beschermde `next-env.d.ts`-status in de hoofdmap niet door deze opschoning als hersteld beschouwen. De 44 PASS/0 FAIL/1 NOT TESTED post-CONTRACT securitymatrix geldt als bestaand bewijs; hosted persona-/WVP-/Talent-/Payrollmatrix, SEC-101 andere tenant, Payroll SQL-bron 20261113073051 en rollbackproef blijven OPEN/PARTIAL.
