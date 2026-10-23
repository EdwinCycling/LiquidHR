# PAYRUN-ROUTE-01 — lokale acceptatie — 2026-10-21

**Verdict: PARTIAL — lokale codefix vastgelegd; geauthenticeerde browseracceptatie en een groene finale CONTROLLED-suite ontbreken.**

## Root cause

Read-only runtimeonderzoek op de bestaande hosted baseline reproduceerde de vertraging met HR Admin/Jupiter en 38 geautoriseerde medewerkers. `getPayrollProfessionalRunWorkspace()` wachtte op `getPayrollCycleWorklist()`, dat `getPayrollSourceSnapshot()` per medewerker in begrensde batches van 3 ophaalde: 13 opeenvolgende batches en circa 12,3 seconden in de gemeten routeaanvraag. De pagina wachtte op de volledige `Promise.all`; er was geen route-eigen `loading.tsx` of foutstate. De pagina kwam uiteindelijk wel op, dus dit was een trage extra workspace-keten en geen ontbrekende rundata. Bronprovider-gaps bleven expliciete gaps.

## Fix

- Verhoogde de begrensde snapshot-concurrency van 3 naar 6 en maakte de regressieassertie exact.
- Voegde een toegankelijke route-loadingstate toe en scheidde foutafhandeling voor autorisatieweigering en algemene laadfouten, met een GET-herlaadactie.
- Bestaande Payroll-services, administratiegrenzen, opgeslagen runs, bereken-, review- en finalisatieacties zijn niet gewijzigd.

## QA

- Gerichte Payroll/service-/autorisatietests: 3 bestanden, 19/19 geslaagd. Gewijzigde-bestanden-ESLint, i18n-pariteit (43 namespaces) en TypeScript-check slaagden.
- `npm run build` eindigde met exitcode 0: Next.js compile, TypeScript, 337 statische pagina’s en Payroll client-boundary scan slaagden. De build schreef provenance voor de toenmalige HEAD `14803473`; de tree was dirty en de codecommit kwam daarna. Dit is lokale build-evidence, geen exacte artifactbinding voor de commit.
- De volledige suite is eenmaal gedraaid: 710 testbestanden (694 geslaagd, 12 gefaald, 4 overgeslagen); 3.473 tests (3.450 geslaagd, 15 gefaald, 8 overgeslagen). Twaalf tests liepen tegen de bestaande 5-seconden-timeout; drie assertions faalden buiten deze PAYRUN-wijziging (twee verwachte 403-responses waren 200 en één producttaalassertie). De suite is niet herhaald.
- De kandidaat kreeg geen geauthenticeerde lokale browserreadback. De standaardrunner stopte vóór browserstart met `RUNTIME_START_OR_REUSE_FAILED`; de runner geeft `-TestRunner` door, maar `start-test-worktree.ps1` accepteert die parameter niet. De lokale anonieme route leidde naar `/login`. Manager-/Employee-/cross-administratie-readbacks blijven daardoor open.

## Data-integriteit en Git

Geen remote database- of schemamutaties, runs, lifecycletransities, PDF-artifacts of financiële resultaten aangemaakt of gewijzigd. De code staat in lokale commit `f268566347c79c8403878ea95a1820c1a4dc3e91`. Lokale `main` bevat ook twee voorafgaande process-automationcommits; die en resterende wijzigingen zijn buiten deze commit gehouden. `origin/main` was bij de laatste read-only controle `14803473c1157285b52cc234fbb6ac70860e9eb1`. Geen push, PR, merge of deployment. De hosted route blijft op de oude productiecode totdat een aparte releasebeslissing wordt genomen.
