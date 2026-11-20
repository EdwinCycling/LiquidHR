# AA-CURRENT — Current LiquidHR State

> 20-11-2026 — De gezamenlijke LiquidHR TEST-release is actief op de canonieke URL. De uitkomst is LIMITED TEST / PARTIAL: lokale code- en buildgates slaagden; hosted persona-acceptatie is niet volledig aangetoond. Deze samenvatting vervangt oudere actuele statuskoppen in historische documentatie.

## Canonieke release

- Lokale hoofdmap: C:\Users\Edwin\Documents\Apps\LiquidHR, branch main.
- Vercel-project: liquidhr; het technische target production is hier de synthetische TEST-runtime.
- TEST-URL: https://liquid-hr-hr-suite.vercel.app
- Appversie: 1.20261120.1; deze releaseversie is eenmaal verhoogd.
- Lokale main, GitHub main, Vercel platformSourceSha en runtime sourceSha waren na deployment-readback exact gelijk. De geïntegreerde productcodekandidaat vóór de documentatie-closeout was ca8ea172500b632c009122e22e035cbb0e02e2a4.
- Cloudbuildstatus READY; runtime-provenance en aliasreadback bevestigden de bedoelde project- en database-identiteit. Automatische Git-deploys bleven uitgeschakeld.

## Releasebesluit en acceptatie

De expliciete opdracht RELEASE LIQUIDHR TEST autoriseerde de gezamenlijke synthetische TEST-release. Dit is geen globale ACCEPTANCE GREEN en geen commerciële Payroll-vrijgave.

| Domein | Status | Bewijsgrens |
| --- | --- | --- |
| HR/Core | LIMITED TEST / PARTIAL | Runtime-provenance PASS; beschermde anonieme API-calls geven 401. Bestaande SEC-101 post-CONTRACT-matrix: 44 PASS / 0 FAIL / 1 NOT TESTED. Andere-tenantfixture OPEN. |
| WVP | Code/build PASS; hosted PARTIAL | Week-42/PMUX-contract en route-smoke aanwezig. Geauthenticeerde casuslifecycle, documentacties en volledige rol-/negatieve scopeacceptatie OPEN. |
| Talent | Code/build PASS; hosted PARTIAL | TAL-INS01/02 en capabilitymatching geïntegreerd. Positieve plan-/bewijsrecords en persona/API/RLS-matrix OPEN. |
| Payroll ESS | Code/build PASS; hosted PARTIAL | Bestaande post-CONTRACT evidence blijft gelden; de volledige kandidaatmatrix is niet opnieuw voltooid. |
| Payroll HR Admin | Code/build PASS; hosted PARTIAL | Bestaande post-CONTRACT 3/3 is historische evidence. Nieuwe kandidaatpersona-login is niet voltooid; anonieme mutatieproeven zijn geweigerd. |
| SEC-101 | PARTIAL / OPEN voor productie | Bestaande rij-/kolombeveiliging intact; issue #101 blijft OPEN voor andere-tenantacceptatie. |

Loginpagina en relevante anonieme routes antwoordden HTTP 200. Runtime-provenance antwoordde HTTP 200 en bevestigde de releasebron. Anonieme context-, WVP-, Talent- en pro-forma-API-proeven werden geweigerd met 401. De bestaande payroll-testpersona-config leverde geen geauthenticeerde kandidaat-sessies op; dit is ontbrekend acceptatiebewijs, geen bewezen productdefect. Geen rollen, tenants, accounts of rechten aangepast; geen businessdatawrites.

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

Geen nieuwe functionaliteit in deze closeout. Sluit eerst de acceptatie- en herstelpunten. Manager-MSS en BONUS blijven PARKED; CONTROL02 en de officiële Loonaangifte-XML-import blijven geannuleerd. Roadmap: AA-NEXT en AA-ROAD; open bewijs: AA-OPEN; gedateerde bronrapporten: docs/quality/acceptance/runs.

Status: ACTUEEL / LIVING
Bijgewerkt: 2026-11-20