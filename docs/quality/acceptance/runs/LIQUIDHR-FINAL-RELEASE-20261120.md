# LiquidHR final convergence en TEST-release — 20-11-2026

**Opdrachtgever:** Edwin
**Verdict:** LIMITED TEST / PARTIAL
**Project:** bestaand Vercel-project liquidhr, project-ID prj_h3voMtzXGfqG6QTodR5d1VTcC1zP
**Canonical TEST-URL:** https://liquid-hr-hr-suite.vercel.app
**Applicatieversie:** 1.20261120.1

## Bron en deployment

De lokale hoofdmap staat op branch main. Na de release-readback waren lokale HEAD, GitHub main, Vercel platformSourceSha en runtime sourceSha exact gelijk. De deployment was READY op het Production-target van het bestaande Vercel-project; dat target is de synthetische TEST-omgeving. Runtime-provenance bevestigde Core TEST-project wnpfloqpjvaacobppbpk. Het bestaande TEST-domein is aan de release gekoppeld. De productcodekandidaat voor deze documentatie-closeout was ca8ea172500b632c009122e22e035cbb0e02e2a4; de uiteindelijke main-commit bevat deze documentatie en dezelfde productcode.

De versie is eenmaal verhoogd. De Vercel Git-deployblokkade bleef actief; er is geen tweede project, Control Plane-deployment, workflow of hook geïntroduceerd.

## Hosted acceptance

| Onderdeel | Resultaat | Resterend bewijs |
| --- | --- | --- |
| Build en provenance | READY / PASS | Exacte source-pariteit en bestaande TEST-runtime bevestigd. |
| HR/Core | PARTIAL | Loginpagina en provenance gaven 200; anonieme gevoelige API-calls gaven 401. SEC-101 post-CONTRACT-bewijs: 44 PASS / 0 FAIL / 1 NOT TESTED. Andere-tenantmatrix ontbreekt. |
| WVP | PARTIAL | Routesmoke slaagde; week-42-code en PMUX-contract zitten in de kandidaat. Persona-lifecycle, documentacties, audit en negatieve scope/API/RLS zijn niet volledig bewezen. |
| Talent | PARTIAL | Routesmoke slaagde; TAL-INS01/02 zijn lokaal geïntegreerd. Geauthenticeerde matrix en positieve plan-/bewijsrecords ontbreken. |
| Payroll ESS | PARTIAL | Bestaande post-CONTRACT evidence blijft geldig. De volledige kandidaat-ESS-matrix is niet voltooid. |
| Payroll HR Admin | PARTIAL | Bestaande post-CONTRACT 3/3 is historisch bewijs. Op de kandidaat kwam geen HR Admin-personasessie tot stand. |
| Anonieme scope | PASS | Context-, WVP-, Talent- en pro-forma-API-proeven weigerden anonieme toegang met HTTP 401. |

De bestaande payroll-persona-configuratie leverde geen geauthenticeerde kandidaat-sessies op. Dit blijft OPEN als ontbrekend acceptatiebewijs; er is geen bewezen productdefect vastgesteld. Geen accounts, grants, rollen of tenants aangepast, geen auth-bypass gebruikt en geen businessdatawrites uitgevoerd.

## Lokale technische gates

De productcodekandidaat ca8ea172 behaalde HR Suite 4.277 PASS / 8 SKIP, Control 11/11, Payroll-regels 65/65, payroll-kalendercontract 2/2, TypeScript, ESLint, NL/EN, production build, Payroll-bundlescanner en function-tracegate PASS. Bronevidence: [WVP-integratie](WVP-PMUX-WEEK42-INTEGRATION-20261119.md), [Talent-afronding](TALENT-FUNCTIONAL-COMPLETION-20261119.md) en [finale pre-convergentiegate](LIQUIDHR-FINAL-ACCEPTANCE-20261119.md). Ongewijzigde bewezen suites zijn niet herhaald voor de documentatie-closeout.

Gitleaks v8.30.1 is uit de officiële Windows-release gehaald en de checksum is gecontroleerd. De volledige Git-geschiedenisscan vond vier brede generic-api-key-signalen; de scan van de getrackte snapshot vond 53 signalen van dezelfde generieke regel. De locaties zijn op pad en broncontext beoordeeld als documentatievoorbeelden, testfixtures en fiscale/Payroll-rekenconstanten. De getrackte BSN_HASH_KEY-regel in .env.example is leeg. Er zijn geen provider-specifieke credentialmatches gerapporteerd. Scanwaarden zijn afgeschermd; beschermde .env.local-configuratie is niet gelezen.

## Database en rollback

Geen nieuwe migratie of remote databasewrite is uitgevoerd. Core TEST wnpfloqpjvaacobppbpk registreert 603 migraties; Payroll TEST jhgeriucbkfarxiudzfy registreert 19. De Control Plane is niet gedeployed. Bestaande Core-migraties 20261119160230 en 20261119161917 zijn niet herhaald.

Payroll-migratie 20261113073051 is al geregistreerd, maar de exacte historische SQL-bron ontbreekt. De niet-centraal-vrijgegeven kandidaat is niet als die bron gebruikt. Er is geen nieuwe databasecompatibiliteitsblokkade voor deze release vastgesteld.

De vorige READY-post-CONTRACT-deployment dpl_799S2oXST6MgNzW96iBqUnhUQ1RK op SHA 69d29bbe80a5791cf31c1d4966347f756cd10130 is behouden als inactieve rollbackmogelijkheid. Rollback is niet uitgevoerd; compatibiliteit is read-only beoordeeld en geen terugschakeling is bewezen.

## Open acceptance en recovery

- GitHub #101 blijft OPEN voor onafhankelijke andere-tenantacceptatie vóór productiegebruik.
- Bestaande Manager-, Employee-, HR Admin- en Tenant Admin-personas zijn niet volledig geauthenticeerd op de kandidaat.
- Talent-positive records ontbreken; gebruik alleen normale productflows. Een noodzakelijke gedeelde fixture vereist een afzonderlijk bundelmandaat.
- De post-CONTRACT rollbackprocedure is niet uitgevoerd.
- De ontbrekende Payroll-bron voor geregistreerde migratie 20261113073051 blijft een afzonderlijk herstelpunt. Remote migratiehistorie is ongemoeid.

Dit is een beperkte synthetische TEST-release, geen ACCEPTANCE GREEN, commerciële Payroll-vrijgave of Production-klantrelease. Zie [AA-CURRENT](../../AA/AA-CURRENT.md), [AA-OPEN](../../AA/AA-OPEN.md), [AA-ACCEPT](../../AA/AA-ACCEPT.md) en [AA-NEXT](../../AA/AA-NEXT.md) voor de levende status.
