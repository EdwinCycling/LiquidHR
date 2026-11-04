# PAYD1-INTEGRATION-READINESS-01 — D1 handoff — 2026-10-22

**Advies: GO WITH CONDITIONS voor gecontroleerde integratie; geen merge-, push- of releaseautorisatie.** De D1-branch bouwt direct op de vastgelegde Payroll-featurebranch-HEAD. De codepaden raken de PMUX-delta niet; drie levende AA-documenten overlappen. De branchcheckouts zelf konden vanuit deze sandbox niet worden gelezen, dus hun huidige werkboomstatus moet vóór integratie opnieuw worden vastgesteld.

## Git-basis en commitlijst

- D1-worktree: `work/PAYD1-K2-20261022`, HEAD `0c16aab218f2490d26e297cd11d365c2f7ad84be`; schoon bij aanvang. Dit is tevens de gevraagde HEAD.
- Payroll-featurebranch: `work/BRANCH-SPLIT-PAYROLL-20261021`, ref `86386eed7dc41a8e11c8469614bb4d5706719fd9`. Dit is exact de ouder van de eerste D1-commit.
- PMUX: `work/BRANCH-SPLIT-PMUX-20261021`, ref `19656935a2f2d329f18157a9d2cd0c0fc88257d5`; gemeenschappelijke merge-base met D1: `14803473c1157285b52cc234fbb6ac70860e9eb1`.
- `git worktree list` bevestigt de geregistreerde paden en heads. `git -C ... status` op de Payroll- en PMUX-checkouts werd door de sandbox geweigerd (`Permission denied`); hun schoon/dirty-status is hier dus niet bewezen. Geen bestanden buiten de D1-worktree zijn gewijzigd.

Exacte D1-commits sinds `86386eed7dc41a8e11c8469614bb4d5706719fd9`, in ouder-volgorde:

1. `57a214f8d7e11898ae35cbcea64fe88f2d00ce94` — blocked K2-01 bewijs/documentatie.
2. `6d8563ec360b1cafaaf6f23ac659b70189619ebf` — synthetische K2-case en generieke PAYRUN01-compositie.
3. `f39461d811684e8a35d4911e3effd55da943a38e` — onafhankelijke oracle en versiegebonden source-contract/provider.
4. `5f6c88e5252b49e31805f122414965ecad345802` — Core-source-readiness via bestaande HR Admin-pagina.
5. `b32f43d39729e683ca22b3512191840554617471` — Frits-bronreconciliatie, geen bronmutatie.
6. `0c16aab218f2490d26e297cd11d365c2f7ad84be` — complete geïsoleerde synthetische K2-06-case en CONCEPT-renderproef.

## Gewijzigde oppervlakken

| Oppervlak | D1-delta |
| --- | --- |
| Bronprovider/readiness | `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.ts` + `.test.ts`; `source/source-readiness.ts` + `.test.ts`; `lib/employment/pension-arrangement-service.test.ts`. Leest effectieve, gescopeerde bronnen en bindt rij-ID, versie en datum. |
| Rekenen | `packages/payroll-rules-nl-2026/src/payrun01-composition.ts`; `apps/hr-suite/lib/payroll/payrun01-k2-fixture.test.ts`; `payrun01-k2-independent-oracle.ts`; `payd1-k2-06-source-case.test.ts`. Generieke bruto-aanvulling en opt-in PAWW/VCR-compositie; geen Kinderopvang- of persoonsnaamformule. |
| HR Admin-UI | `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx`, `components/employment/payroll-source-readiness-panel.tsx` en `messages/{en,nl}/employment.json`; readiness en bestaande invoerschermlinks. |
| Renderer | `apps/hr-suite/lib/payroll/payrun01-payslip-pdf.ts` en `.test.ts`; optionele lifecycle en expliciete lokale CONCEPT-waarschuwing. |
| Documentatie | AA-CURRENT/NEXT/OPEN/PAYROLL/roadmap en zes K2-rapporten; dit readinessrapport is de enige wijziging in deze slice. |
| Schema/security | Geen nieuwe migratie, grant, policy of `packages/db/types.ts`-wijziging. |

## Branchvergelijking en risico

- D1 is een rechtstreekse afstammeling van de Payroll-HEAD. Er zijn geen concurrerende commits tussen die ref en de D1-basis; D1 kan daarom als één geordende featureketen op Payroll worden beoordeeld.
- Tegen de PMUX-bestandsdelta vanaf de gemeenschappelijke basis overlappen precies `docs/AA/AA-CURRENT.md`, `docs/AA/AA-NEXT.md` en `docs/AA/AA-OPEN.md`. Geen D1-provider-, reken-, test-, renderer-, HR Admin- of berichtbestand overlapt PMUX. Het risico is tekstuele documentconsolidatie, geen aangetoond codeconflict.
- De D1-code bevat geen migrationlineage die een database-integratiestap vereist. D1 introduceert ook geen grants die de PMUX- of Payroll-autorisatie zouden verruimen.
- Een exacte merge-preview en dirty-statecontrole van de twee geregistreerde featurecheckouts ontbreken door sandboxtoegang. Herhaal die controles op de uiteindelijke integratiecheckout vóór een Git-mutatie.

## Backward compatibility en K2-trace

- De bruto-aanvulling en alle-levy/PAWW-compositie zijn opt-in. Zonder de opties bevat de default-package de nieuwe componenten niet; de test bewijst dat expliciet `false` dezelfde composition-ID en package-hash oplevert als weglaten.
- K2-03 oefent de drie `included`-vlaggen op `true` uit: de bronbasis bevat de aanvulling al, dus de compositie telt haar niet dubbel. K2-06 oefent alle drie op `false` uit: de engine telt de aanvulling één keer bij de loonheffing-, werknemersverzekerings- en Zvw-basis. De fixtures lopen via respectievelijk `CLASSIFIED-GROSS-SUPPLEMENT-2026.2` en opt-in `ALL-LEVY-DEDUCTION-2026.1`; een volledige achtcombinatiematrix van gemengde vlaggen is niet aangetoond.
- PAWW/VCR is geïsoleerd achter `supportAllLevyDeduction`; de K2-oracle en cap-/eligibility-tests controleren opening, perioden, maximum en bijdrage. De vastgelegde correctie van openingsbijdrage €5,02 naar €5,03 voor cumulatief loon €5.027,56 voorkomt een centafwijking. De K2-03-referentie blijft gelijk.
- K2-06 brontrace is in-memory: 17 `BOUND`-referenties over 16 bronsoorten, `sourceGaps=[]` binnen uitsluitend de synthetische provider, bron-/input-/resultaat-hashes en componenttrace. Uitkomst: bruto €2.513,78; werknemers-/werkgeverspensioen €201,74/€203,30; PAWW €2,51; fiscaal loon €2.309,53; loonheffing €120,92; netto €2.188,61; werkgeverskosten €3.520,32. Dit is geen Frits-readback of wettelijke productieacceptatie. Zie [K2-06](PAYD1-K2-06-20261022.md).
- De renderer toont bij expliciet `CONCEPT` een niet-definitief-label en meldt dat de lokale proef niet is opgeslagen. Zonder lifecycle behoudt de definitieve template de bestaande tekst; het artifact-service-regressietestpad geeft al opgeslagen definitieve bytes terug zonder opnieuw renderen of invoegen.

## Herhaalde regressies

Alle tests zijn lokaal en gericht uitgevoerd op D1-HEAD; geen remote reads/writes, payrollrun, PDF-opslag of lifecycleactie.

| Suite | Resultaat |
| --- | ---: |
| PAYRUN01/K2, onafhankelijke oracle, VCR-cumulatieven, package, renderer, artifactservice, repositories, provider/readiness en pensioenarrangement | 12 bestanden, 144 tests PASS |
| PFZW 2026, Kinderopvang-regels en bijzondere beloning | 3 bestanden, 37 tests PASS |
| Mars/FINALIZED-payslip routes, service, viewer en artifactacties | 7 bestanden, 25 tests PASS |
| Payroll-scope en source-snapshot identity/hashbinding | 2 bestanden, 8 tests PASS |
| **Totaal** | **24 bestanden, 214 tests PASS** |

Exacte testbestanden, uitgevoerd met `npm test -w @liquid-hr/hr-suite -- --reporter=dot <paden>` en `npm test -w @liquid-hr/payroll-rules-nl-2026 -- --reporter=dot <paden>`:

- PAYRUN01/K2: `lib/payroll/payrun01-k2-fixture.test.ts`, `payd1-k2-06-source-case.test.ts`, `payrun01-independent-oracle.test.ts`, `payrun01-cumulative.test.ts`, `payrun01-calculation-package.test.ts`, `payrun01-payslip-pdf.test.ts`, `payrun01-service-artifact.test.ts`, `payrun01-repository.test.ts`, `calculation-repository.test.ts`, `source/liquid-hr-source-provider.test.ts`, `source/source-readiness.test.ts`, `lib/employment/pension-arrangement-service.test.ts`.
- NL-regels: `src/pfzw-2026.test.ts`, `src/pfzw-2026-kinderopvang-jan.test.ts`, `src/payfull02-special-remuneration.test.ts`.
- Payslip/Mars: `lib/documents/payslip-service.test.ts`, `components/documents/employee-payslips.test.tsx`, `components/payroll/payroll-stored-payslip-viewer.test.tsx`, `components/payroll/payroll-payslip-pdf-artifact-action.test.tsx`, `app/api/payroll/runs/[runId]/artifact/[artifactType]/route.test.ts`, `app/api/my-salary/payslips/[period]/route.test.ts`, `app/api/payroll/runs/[runId]/payslip-preview/route.test.ts`.
- Scope/hash identity: `lib/payroll/scope.test.ts`, `lib/payroll/payrun01-source-snapshot-identity.test.ts`.

De viewer-suite logde een `happy-dom` `NotSupportedError` voor een `blob:`-iframe; de tests bleven 25/25 groen. De D1- en K2-tests valideren hashvorm/consistentie en snapshotbinding, maar bevatten geen vaste historische Mars-PAYRUN01-resultaat-hash om te vergelijken.

Voor de bestaande Mars `payroll-demo-002` FINALIZED-payslip documenteert PAYDOC-D0 513.406 bytes en SHA-256 `51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977`, met toenmalige HR Admin/Employee-bytepariteit. De lokale service-/viewer-/route-regressies zijn nu herhaald, inclusief immutable-byte- en hashresponsegedrag. Het historische opgeslagen object is in deze D1-slice niet opnieuw live opgehaald; de vermelde hash is dus bestaand D0-bewijs, geen nieuwe live readback.

## Open bewijs en verantwoordelijke rol

| Bewijs | Status na deze slice | Eigenaar/volgende bewijsstap |
| --- | --- | --- |
| Live RLS en echte bronprovider-scope | Niet opnieuw live gevalideerd; lokale provider-, scope- en repositorytests PASS | Payroll QA / TEST-harness: geautoriseerde live positieve en negatieve persona-/administratiescope aantonen zonder grants te wijzigen. |
| D0 Manager/Lisa/foreign-tenant-persona's | OPEN; unit-denials zijn geen live impersonatie | Test Auth / Payroll QA: bestaande ondersteunde identitywissel en directe live probes; geen nieuwe identity of grant. |
| Payroll-werkplekperformance | PARTIAL: PAYRUN-PERF-02 mat runlijst 1,89–2,81 s, volledige workspace 7,54–13,34 s | Payroll performance/QA; AA benoemt geen individuele eigenaar. Volledige `/payroll/runs`-werkplek blijft boven het voorlopige 5s-doel. |
| Full-suite/CONTROLLED-eindgate | Niet opnieuw uitgevoerd. Historisch D0: 3.443 PASS, 8 SKIP, 21 time-outs; latere PERF-02 finale run: 3.455 PASS, 8 SKIP, 6 failures. Geen van beide is GREEN. | Payroll QA en Windows test-runtime-eigenaar (geen individu benoemd): één finale relevante suite op de uiteindelijke integratiecode, met time-outs en de bekende 403→200-authgevallen opgelost of afzonderlijk geaccepteerd. |
| Frits echte novemberbronset | OPEN; K2 is synthetisch | HR/werkgever bevestigt contract, uren, inschaling en ingangsdatum; HR/PFZW deelname/loonbasis; werkgeverpremies/Whk; HR IKV; Payroll-bronhouder cumulatieven; daarna gescopeerde readback. Zie [K2-05](PAYD1-K2-05-20261022.md). |
| Exacte live historische Mars-PDF/hash | Niet opnieuw live opgehaald | Payroll QA: alleen via bestaande geautoriseerde read-route; opgeslagen bytes/hash vergelijken zonder herberekening of mutatie. |
| Status Payroll-/PMUX-checkouts | Niet verifieerbaar vanuit deze sandbox (`Permission denied`) | Integratie-operator controleert vóór actie dat heads nog `86386eed…`/`19656935…` zijn en beide werkbomen schoon zijn. |

## Voorgestelde integratievolgorde

1. Verifieer in de bevoegde integratiecheckout de actuele refs en schone status van Payroll en PMUX; behoud alle lokale wijzigingen.
2. Neem de zes D1-commits in bovenstaande volgorde op de Payroll-featurebranch op, waarvan de huidige ref exact de ouder van D1 is. Behoud de commitprovenance.
3. Convergeer daarna met PMUX; consolideer uitsluitend de drie gedeelde AA-documenten en controleer dat beide statussen behouden blijven.
4. Voer na de definitieve codecombinatie de gerichte Payroll/Mars/PAYRUN01-regressies opnieuw uit. Voor CONTROLLED-convergence blijven de relevante live scope-/persona-gates en finale suite/build volgens AA-TEST/AA-REL vereist.
5. Houd productiegeschiktheid, Frits-bronacceptatie, een eventuele CONCEPT-run en release als aparte beslissingen. Deze slice autoriseert geen van die handelingen.

Geen commit, cherry-pick, merge, push, deployment, grant, databasewrite, nieuwe run of finale artifact is in deze slice uitgevoerd.
