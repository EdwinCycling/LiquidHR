# PAY-W02-INTEGRATION-READY-01 — W02a/W02b integratiecheckpoint

- **Datum:** 24-10-2026
- **Repository:** `EdwinCycling/LiquidHR`
- **Featurebranch:** `work/pay-postmerge-r2-factor-01-20261024`
- **Codekandidaat:** `1ddbeab68034403c1d85589d851998dda2c94a67`
- **Gecontroleerde basis:** `origin/main` `630df89c84bc2be4774072d387ecb5dc7df10f91`
- **Remotecontrole:** `git ls-remote origin refs/heads/main` retourneerde dezelfde SHA; `origin/main` is apart opgehaald.
- **Conclusie:** codekandidaat gereed voor PR-publicatie; merge wacht op samenvoeging van de twee gedeelde AA-statusbestanden met de actieve W01/W03-tak en normale PR-review.

## Branch, commits en scope

De werkboom was bij start schoon. De branch staat vijf commits voor de opgehaalde `origin/main`; er zijn geen merge- of onbekende commits:

| Commit | Inhoud |
| --- | --- |
| `cee92fa5efaa801e8ce94f42d2c2e78a2c276857` | W02a: Retail-deeltijdsalaris afleiden uit exacte roosteruren |
| `c8c066b2e1e9cecccb5b6870b528798b9ea132f5` | W02a-acceptatiebewijs |
| `0dd06ea04ca06909ba35246af06b9bd246c6501f` | W00-baselinebuildbevinding vastleggen |
| `aba671217a348525145f187932450db670d0b496` | W02a-buildafsluiting vastleggen |
| `1ddbeab68034403c1d85589d851998dda2c94a67` | W02b: onafhankelijke synthetische R2 bruto-netto-oracle |

De kandidaatsdiff bevat achttien bestanden: Payroll-calculatieservice, decimale deeltijdreconciliatie, bronprovider/readiness, R1/R2-tests, twee W02-acceptatierapporten en vier Payroll-status-/roadmapdocumenten. Dit checkpoint voegt alleen dit eigen acceptance- en PR-voorbereidingsrapport toe. Er zijn geen dependencies, lockfiles, migraties, Next-configuratie, secrets, gegenereerde bestanden of W01/W03/PMUX-code gewijzigd.

## Integratiereview

De review is handmatig uitgevoerd tegen de expliciete W02-opdracht, root- en `apps/hr-suite/AGENTS.md`, `AA-PAYROLL.md`, `AA-OP.md`, `AA-TEST.md` en `AA-REL.md`. De repositoryregels schrijven één uitvoerende agent voor; daarom is geen subagentreview gestart.

### Standards

Geen blokkerende bevindingen. De wijziging hergebruikt de bestaande Payroll-service en `FixedDecimal`, houdt bron-/resultaathashes en tenant/employee-scope intact, en past geen rekenuitkomst toe wanneer verplichte bronnen onvolledig of ongeldig zijn. De oracle heeft geen productiecalculator-import. Er zijn geen migraties, dependencies, secrets of beschermde gegenereerde bestanden in de diff.

### Spec

Geen blokkerende afwijkingen gevonden. W02a behoudt de bestaande overlappremie en verifieert de deeltijdfactor tegen exacte roosteruren. W02b levert een complete maar uitsluitend synthetische R2-bronset aan de normale service, vergelijkt componenten met een onafhankelijke BigInt-cent-oracle en houdt de standaard onvolledige R2-bron op `SOURCE_GAP`.

### W01/W03 en PMUX-overlap

- Actieve W01/W03-tak `work/pay-w01-w03-defect-close-04-20261024` stond schoon op `f784c257ea65f375732b35570331d99f5c12902a`; zijn `origin/main` is dezelfde baseline. De branch wijzigt alleen `docs/AA/AA-CURRENT.md`, `docs/AA/AA-OPEN.md` en eigen acceptance reports. W02 wijzigt ook de twee AA-statusbestanden, maar geen van de W01/W03-codebestanden. Er is dus statusdocumentoverlap, geen Payroll-codeoverlap. De W01/W03-acceptatie blijft zelfstandig; deze PR claimt geen hosted acceptatie en neemt geen W01/W03-resultaten over.
- De beschermde `work/BRANCH-SPLIT-PMUX-20261021`-tip `8776c202ba6dbb7d9f16f4b778dd3999964d8bfa` is ancestor van `origin/main`; de diff met `origin/main` is leeg. W02 bevat geen PMUX-codepad.
- De aparte gecombineerde checkout meldde een bestaande wijziging aan `apps/hr-suite/lib/workforce-tools/mcp/focus-widget-resource.ts`. Die checkout en wijziging zijn niet aangepast.

De W02-status in `AA-CURRENT.md`, `AA-OPEN.md`, `AA-PAYROLL.md` en de D2-roadmap komt overeen met het W02b-acceptatierapport. De W02a-vermelding is historische status en blijft behouden. Omdat W01/W03 de twee gedeelde AA-statusbestanden ook wijzigt, zijn die tijdens dit checkpoint niet opnieuw herschreven; voeg hun definitieve status samen zodra de W01/W03-tak zijn eigen gate sluit.

## Bewijs en gates

Het bestaande acceptatiebewijs is opnieuw gebruikt omdat kandidaat-SHA, dependency-lockfile en opgehaalde `origin/main` ongewijzigd zijn. De volledige build en regressies waren al op exact `1ddbeab68034403c1d85589d851998dda2c94a67` uitgevoerd; er was geen reden om dezelfde zware gates opnieuw uit te voeren.

| Gate | Uitkomst en bewijs |
| --- | --- |
| `origin/main` actueel | **PASS** — remote ref en lokale remote-tracking ref zijn beide `630df89c84bc2be4774072d387ecb5dc7df10f91`. |
| Commitgeschiedenis | **PASS** — vijf verklaarde commits vanaf de baseline; geen mergecommit of onbekende commit. |
| W02a/W02b Payroll-regressies | **PASS** — 10 testbestanden, 147/147 tests op de kandidaatscope. |
| NL-2026 fiscale regels | **PASS** — 27/27 tests. |
| R1-regressie | **PASS** — bruto €4.767,20; werknemerspensioen €198,65; loonheffing €1.107,17; netto €3.461,38; werkgeverskosten €6.545,86. |
| R2 onafhankelijke synthetische oracle | **PASS** — bruto €1.621,23; werknemerspensioen €39,48; fiscaal loon €1.581,75; loonheffing €41,42; netto €1.540,33; werkgeverskosten €2.146,81. |
| TypeScript en ESLint | **PASS** — root `npm run type-check`; ESLint op gewijzigde bestanden met nul errors en één bestaande ongebruikte-import-waarschuwing op een ongewijzigde providerregel. |
| Volledige rootbuild | **PASS** — `npm run build`, Node 24.22.1/npm 10.9.2, op de kandidaats-SHA; HR Suite, Control, prerendering en Payroll post-buildscans slagen. |
| `git diff --check` | **PASS** — herhaald met tijdelijke `core.whitespace=cr-at-eol` instelling voor de bestaande CRLF-documenten. Geen persistente Git-configuratie gewijzigd. |
| SOURCE_GAP/scope/history | **PASS** — negatieve gevallen voor ontbrekende fiscale/pensioen/werkgevers/cumulatieve bronnen, tegenstrijdige cumulatieven, ongeldige datum/versie/deeltijdbasis en vreemde tenant/werknemer. Geen run wordt aangemaakt bij de geteste weigeringen. Historische FINALIZED-runs/PDF's blijven onaangeraakt. |

De aparte W00-baseline-rootcausegate blijft **OPEN**: de eerdere `/_global-error`/`OuterLayoutRouter`-bevinding is niet door dit integratiecheckpoint opnieuw op een schone baselinebuild onderzocht. Dit verandert het bewezen volledige buildresultaat op de W02-kandidaat niet; er is geen Next-, React- of buildconfiguratiepatch toegevoegd.

## Integratiebesluit

| Gate | Resultaat |
| --- | --- |
| Code-review | **PASS** — handmatige Standards- en Spec-review; geen blokkerende bevinding. |
| Tests/build op exacte SHA | **PASS** — bestaand kandidaatsbewijs hergebruikt. |
| Security en SOURCE_GAP | **PASS** — synthetische negatieve service- en scopecontroles. |
| Documentatie | **PASS / PARTIAL** — W02-rapporten en roadmap zijn consistent; twee gedeelde AA-statusbestanden blijven ongewijzigd tot de parallelle W01/W03-update klaar is. |
| Gereed voor PR-publicatie | **GO** — geen technische W02-blocker; push en PR-publicatie zijn niet uitgevoerd. |
| Gereed voor merge | **HOLD** — wacht op samenvoeging van de gedeelde AA-statusbestanden met de definitieve W01/W03-status en de gebruikelijke PR-review. Geen Payroll-codeconflict aangetroffen. |

## Voorgestelde PR

**Titel:** `Payroll: add independent synthetic Retail R2 net oracle`

De volgende tekst is voorbereid voor de PR-beschrijving:

```markdown
## Scope

This PR completes the bounded W02a/W02b Retail R2 calculation work on top of `630df89c84bc2be4774072d387ecb5dc7df10f91`.

- W02a validates the stored part-time factor against exact weekly schedule hours and derives the monthly salary from the exact hours ratio using fixed-decimal arithmetic. The overlap-safe Retail premium remains applied once.
- W02b connects a fully specified synthetic R2 source set to the existing Payroll calculation service and compares the complete result to an independent BigInt-cent oracle.
- The ordinary incomplete R2 source set continues to fail closed with `SOURCE_GAP`.

## Results

| R2 synthetic component | Amount |
| --- | ---: |
| Gross | €1,621.23 |
| Employee pension | €39.48 |
| Taxable wage | €1,581.75 |
| Wage tax | €41.42 |
| Net | €1,540.33 |
| Employer cost | €2,146.81 |

R1 remains unchanged: gross €4,767.20, employee pension €198.65, wage tax €1,107.17, net €3,461.38 and employer cost €6,545.86.

## Verification

- Payroll regressions: 147/147 passed.
- NL-2026 rule tests: 27/27 passed.
- Root TypeScript check: passed.
- ESLint on changed files: zero errors; one existing warning on an unchanged line.
- Full root production build on Node 24.22.1/npm 10.9.2: passed on the candidate SHA.
- SOURCE_GAP, source-version/date, cumulative-input and foreign tenant/employee negative cases remain fail-closed.
- No dependency, migration, Next.js configuration or tax/pension rule package was changed.

## Integration context and limitations

W01/W03 remains a separate workstream. No W01/W03 code file overlaps this change; `AA-CURRENT.md` and `AA-OPEN.md` are touched by both branches and their final status should be consolidated during integration. PMUX is already in the checked main ancestry and no PMUX code is changed here.

All R2 oracle values and employer decisions are synthetic test inputs. This demonstrates technical arithmetic and deterministic service/oracle agreement only. It does not establish a real employee's source applicability or legal compliance. Real employee/IKV, CAO, fiscal declarations, pension participation, employer/WHK decisions and prior cumulative balances remain open for W04. The known independent main-baseline `/_global-error` build investigation also remains open.

No real payroll run, hosted acceptance, review/finalization, saved PDF, database write, deployment or release is included.
```

## Vervolggrenzen

Om de kandidaat te publiceren is daarna, na afzonderlijk akkoord, een gewone fast-forward push van `work/pay-postmerge-r2-factor-01-20261024` nodig en een PR naar `main` met bovenstaande titel/beschrijving. Controleer vóór push dat een eventuele remote branch-tip fast-forwardbaar is. Merge pas nadat de W01/W03-statusdocumenten zijn samengevoegd en de standaard PR-review is afgerond. W04 moet bevoegde echte brongegevens en cumulatieven afzonderlijk bevestigen; de synthetische oracle opent geen echte salarisverwerking. Geen push, PR, merge, deployment, databasewrite of W04-implementatie is hier uitgevoerd.
