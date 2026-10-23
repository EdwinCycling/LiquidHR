# PAYRUN-ROUTE-01B — Payroll acceptatie en closeout — 2026-10-21

**Verdict: PARTIAL — kandidaatcode en build zijn lokaal bewezen; persona-scope, browser-negatives en de volledige suite blokkeren closeout.**

## Candidate en scope

- Exacte worktree: C:\Users\Edwin\.codex\worktrees\branch-split-payroll-20261021\LiquidHR.
- Branch/head: work/BRANCH-SPLIT-PAYROLL-20261021 / 82558de1dd1f0439c99866de261b35cbf01b85b6. Read-only origin/main was 14803473c1157285b52cc234fbb6ac70860e9eb1.
- De codepatch is patch-equivalent aan f268566347c79c8403878ea95a1820c1a4dc3e91 (stable patch-id 69e0c1ade6d795a1ba7299093c6e9cfc54020fa1); geen branch-herschrijving.
- Geen database-, schema-, payrollrun-, lifecycle-, PDF-, auth- of scopewijziging. Geen push, PR, merge of deployment. De hosted runtime bleef op de bestaande productie-SHA.

## Overgenomen diagnose en codefix

De eerdere read-only diagnose mat circa 12,3 seconden voor HR Admin/Jupiter met 38 medewerkers: de payroll-worklist haalde bronmomentopnamen in 13 opeenvolgende batches met concurrency 3. De route wachtte op de volledige workspace en had geen eigen loading- of foutstate. De kandidaat verhoogt de begrensde concurrency naar 6 en voegt route-loading, toegankelijke fout-/toegangsstates en een GET-herlaadactie toe. Bestaande opgeslagen runs en bereken-, review- en finalisatiecontracten zijn niet aangepast.

## Lokale browserobservatie en scopeblokker

De ondersteunde launcher-preflight accepteerde de centrale TEST-configuratie zonder waarden te tonen. Een bestaande lokale HR Admin-login via /local/sign-in werkte via de normale authenticatieroute; er is geen identiteit aangemaakt of auth-bypass gebruikt.

Bij de read-only contextcontrole bleek die vaste identiteit actief op **Jupiter BV**, terwijl de repositorypersona-afspraak de lokale Test HR Admin als **Mars** zonder Jupiter-toegang vastlegt. Na ontdekking zijn verdere Payroll-reads, contextwissels en cross-administratieprobes gestopt. De eerdere route-read is daarom alleen een waarneming onder de conflicterende scope, geen geldige Mars-persona-acceptatie.

Onder die sessie antwoordde /payroll/runs met HTTP 200 en een niet-lege UI (6 periodeopties, 38 medewerkerselecties en 14 opgeslagen runs); ook /payroll antwoordde met HTTP 200. Een browserrun mat circa 25,0 seconden voor de route. Dit is niet vergelijkbaar met de eerdere gehoste meting van 12,3 seconden door verschil in runtime en scope; er wordt geen snelheidswinst geclaimd. De overzichtspagina toont geen bruto-/nettobedragen voor bedragpariteit.

Manager-, Employee- en cross-administratie-negatives zijn niet bewezen. De cross-administratieprobe is bewust overgeslagen toen de actieve administratie al de onverwachte Jupiter-doeladministratie bleek. De hosted productie-baseline is met deze lokale kandidaat niet gewijzigd.

## Test- en buildbewijs

- Gerichte Payroll-tests op de kandidaat: payroll-cycle-service.test.ts, payroll-professional-run-service.test.ts en payroll-professional-run-workbench.test.tsx: **3 bestanden, 11 tests geslaagd**.
- De ene volledige-suite-run stopte vóór testuitvoering: Vitest rapporteerde **707/707 bestanden gefaald, geen tests**, telkens door EPERM bij het hernoemen van Vite SSR-tempbestanden in de sandbox-tempmap. Dit is geen producttestuitslag. De gerichte run slaagde met TEMP/TMP naar de toegestane Codex-scratchmap; de volledige suite is niet herhaald.
- De eerdere PAYRUN-ROUTE-01-rapportage vermeldt 710 bestanden (694 geslaagd, 12 gefaald, 4 overgeslagen) en 3.473 tests (3.450 geslaagd, 15 gefaald, 8 overgeslagen). Zij classificeert 12 failures als timeouts op de bestaande 5-secondenlimiet, twee verwachte 403’s als 200 en één producttaalassertie buiten deze PAYRUN-wijziging. De namen van die 15 tests/asserties zijn in die rapportage niet bewaard. Daardoor kan ik ze niet eerlijk per test-ID koppelen of als onveranderd op de basis bevestigen; de mislukte huidige suite leverde geen testresultaten en de basis is niet opnieuw getest.
- De repositorylauncher bouwde exact SHA 82558de1dd1f0439c99866de261b35cbf01b85b6 met centrale TEST-configuratie. Next compile, TypeScript, 337 statische pagina’s, Payroll client-boundary scan (173 browserassets), PDF-runtime-traces en buildprovenance slaagden. De provenance is voor exact deze kandidaat geschreven.

## Harness en resterende gates

De PowerShell-runner scripts/test-local-acceptance.ps1 geeft -TestRunner, -StopTestRunner en -RuntimePid door aan start-test-worktree.ps1, dat die parameters niet accepteert. De lagere MJS-harness verwacht daarnaast de verouderde /login en /api/auth/test-login en faalde na lokale login met ROLE_UI_IDENTITY_MISMATCH omdat de huidige UI geen generieke persona-marker aanbiedt. De tijdelijke lokale harnesswijziging is teruggedraaid; de bestaande productcode is niet aangepast om dit bewijs te fabriceren.

Closeout blijft open totdat de vaste TEST HR Admin aantoonbaar de bedoelde Mars-context heeft, de juiste persona-positives en rol-/cross-scope-negatives met geldige scope zijn bewezen en de volledige suite op een schrijfbare runner daadwerkelijk tests uitvoert. De ontbrekende namen van de eerdere 15 failures moeten uit het oorspronkelijke runnerlog worden teruggehaald voordat regressie/baselineclassificatie per test kan worden geclaimd. Geen releaseactie zonder afzonderlijke GO.