# PMUX-06A1-POSTRELEASE-CLOSEOUT-10 — lokale closeout

Datum: 25 oktober 2026
Verdict: **PARTIAL — testassertion hersteld; lokale routefix gereed; geauthenticeerde hosted read OPEN**

## Contractanalyse en lokale fixes

De enige suitefailure op release-SHA `5ec09687a8394955f0445f931a337be8e9984829` was een verouderde assertion in `ess_mss_workflow_unification_v1.contract.test.ts`. De test verwachtte dat de compiler `SLA_WORKDAY_CALENDAR_REQUIRED` zou gooien voor de bestaande Leave-recipe. De actuele PMUX-06A.1-regel laat een structureel geldige SLA met `DAYS` en `businessDays: true` door de compiler en resolveert de kalenderscope bij runtime. De runtime faalt gesloten als er geen passende kalender is. De actuele kalendercontracttests dekken ontbrekende, ongeldige en verlopen configuratie, scope en privilegegrenzen. Er is voor deze assertion geen productdefect gevonden; de test controleert nu dat beide bestaande Leave-stappen hun SLA van twee werkdagen behouden.

De write-vrije hosted smoke vond daarnaast een aparte auth-responsefout op `GET /api/process-automation/operations`: zonder sessie viel `requireAuthContext` door naar een generieke HTTP 500. De response lekte geen procesdata, maar voldeed niet aan het standaard unauthenticated-401-contract. De lokale route gebruikt nu `permissionErrorResponse`; een gerichte regressie controleert de HTTP 401 en responsebody.

Beide wijzigingen zijn uitsluitend lokaal vastgelegd in codecommit `7589fcee84e63f4505cd8e98c422f2348336a486` op lokale `main`. De routefix is productcode en zit niet in de bestaande release. Integratie naar GitHub en een eventuele latere Vercel-release vereisen een afzonderlijk besluit. Er is geen push of deployment uitgevoerd.

## Gerichte regressies

- **78 PASS**, vijf bestanden: de ESS/MSS-definitieassertion, compiler, P9-deadline-normalisatie, kalender-migratiecontract en runtime-service.
- **8 PASS**, twee bestanden: operations-API-route en operations-service, inclusief anonieme 401-regressie.
- De eerste teststart liep in de Windows-sandbox vast op een tijdelijke `EPERM`-rename in de standaardtempmap vóór testcollectie. Dezelfde gerichte tests zijn herhaald met een tijdelijke map onder `apps/hr-suite`; beide gerichte runs slaagden. Die tijdelijke map is verwijderd.
- Geen volledige suite, typecheck, migratie of databasewrite uitgevoerd.

## Release readback en hosted smoke

Read-only Vercel-readback bevestigde dat deployment `dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n` nog **READY** is en dat de canonieke alias `liquid-hr-hr-suite.vercel.app` en projectalias `liquidhr-edwinitsolutions.vercel.app` ernaar wijzen. De deploymentmetadata bevat geen Git-SHA; de eerder opgeslagen buildprovenance bevestigt source-SHA `5ec09687a8394955f0445f931a337be8e9984829`, tree-SHA `ea5a8f3bc16926304faac00959d031e828929fa1` en appversie `1.20261023.1`. `git ls-remote origin refs/heads/main` wees eveneens naar `5ec09687a8394955f0445f931a337be8e9984829`.

De rollbackdeployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` bleef **READY** op source-SHA `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf`. De alias is niet teruggezet.

Een bestaande browser-HR Admin-sessie was niet beschikbaar: de canonieke alias toonde login. De lokale Test Auth-identiteit is Vercel-gesloten en is niet gebruikt. Anonieme GET-resultaten:

| Request | Resultaat |
| --- | --- |
| `/settings/work-calendars` | 307 naar `/login` |
| `/settings/process-automation` | 307 naar `/login` |
| `/api/settings/work-calendars` | 401 |
| `/api/process-automation/recipes` | 401 |
| `/api/process-automation/studio` | 401 |
| `/api/process-instances/<bestaande-P9-instance>` | 401 |
| `/api/process-automation/operations` | 500, generieke body `PROCESS_OPERATIONS_READ_FAILED` |

De page/API-probes waren GET-only. De bestaande P9-case en kalendergegevens zijn niet zichtbaar zonder HR Admin-sessie; er is geen proces gestart, case gemaakt, mutatie gedaan of database aangeraakt. De deployed operations-route behoudt de 500 totdat de lokale productfix afzonderlijk wordt geïntegreerd en gereleased.

## Beschermde wijzigingen en resterende OPEN-punten

- Focus-widget SHA-256: `A8134B54351065DB6EFF5CBED717511A979AB85118810DA2941195DF8BAEEAEA` — behouden.
- `apps/hr-suite/next-env.d.ts` SHA-256: `B8B3A344484B959AF5E4E3FC1A1609DAC3CB9ECE0CDEB6C145BE29BC4C491000` — behouden.
- Core TEST-migratie-evidence (581 geregistreerde migraties en vereiste PMUX-migraties aanwezig) is hergebruikt uit de bestaande release-evidence; tijdens deze closeout zijn geen migraties opnieuw toegepast.
- Positieve geauthenticeerde hosted read voor kalender, procesinstellingen en P9 blijft **OPEN** wegens ontbrekende bestaande HR Admin-sessie.
- De lokale operations-authfix is niet opgenomen in GitHub of de READY-deployment; integratie-/releasemandaat blijft vereist.

Zie ook [PMUX-06A1 TEST-release evidence](PMUX-06A1-TEST-RELEASE-09-20261025.md) en [PMUX-06A1 Core TEST-acceptatie](PMUX-06A1-20261025-CORE-TEST.md).
