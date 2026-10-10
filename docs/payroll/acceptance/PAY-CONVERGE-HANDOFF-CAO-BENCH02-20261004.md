# PAY-CONVERGE overdracht — CAO-BENCH02

**Stand 2026-10-04: technisch voltooid; acceptatie PARTIAL; releaseadvies HOLD.** Deze overdracht sluit de Payroll-feature af. Er start hier geen nieuwe feature- of identity-provisioningronde.

## Exacte kandidaat en bewezen resultaat

- Productcode staat op `07cb05eabf9cfeadbc1a94eb210f066c116a44f7`; de documentatiecommit `27ce37499ac35cbc8f95f564f193b2c216004a71` heeft die productcommit als ouder. Tussen beide commits wijzigde geen `apps/`-code.
- De zeven persistente benchmarks zijn K1 `81160d5e` (€2.777,00), K2 `4f5e6cc0` (exact €1.911,735632183908045976), R1 `a4a742c2` (€4.767,20), R2 `c1b92c72` (€1.621,23), B1 `8f00badc` (€3.600,13), B2 `db194fd2` (€2.912,00) en C1 `e2fc3d8f` (€12.000,00). Runreadbacks, hashes en invoer-/regelprovenance staan in het [fase-2-acceptatierapport](CAO-BENCH02-PHASE2-20261003.md).
- H1 is applicability-only. K1/K2-conceptstroken en echte PDF/JSON-downloads zijn inhoudelijk vergeleken met dezelfde persistente runs en de juiste arrangement-/regelversies. De desktop- en 393×852 mobiele controles zijn uitgevoerd.
- Bestaande Manager-/Employee- en HR-groepscopeprobes weigerden toegang server-side. De bestaande Test HR Admin had positieve toegang tot Jupiter.
- K2 blijft exact opgeslagen als `1911.735632183908045976`; scherm en PDF tonen €1.911,74 volgens display-only afronding. Dit bewijst geen wettelijke afrondingsregel; er is niets herberekend.
- Op deze exacte productcode, met alleen documentatiecommit `27ce...` erboven, slaagden de finale lokale gates: 523 testbestanden / 2.195 tests geslaagd / 3 overgeslagen; strict type-check; ESLint zonder fouten (6 warnings); i18n (41 namespaces); productiebuild met 309/309 pagina's; client-boundaryscan met 152 assets. Een eerste parallelle testrun had drie timeouts; de volledige rerun met `--no-file-parallelism` slaagde. `git diff --check` slaagde. De buildprovenance noemde HEAD `27ce...`.

## Verplicht OPEN beveiligingspunt

De enige resterende functionele acceptatieassertion is een Mars-only admin naar Jupiter-isolatieproef. Met één actor die via bestaande goedgekeurde TEST-provisioning is aangemaakt moet eerst Mars-toegang worden bewezen en daarna een rechtstreekse serveraanvraag naar de bestaande Jupiter K1-run `81160d5e-6eac-4975-bfdb-a540911b8680` worden geweigerd (`403`/`404`) zonder informatie over die run prijs te geven. Dit is **niet uitgevoerd**; het is geen bewezen pass en ook geen vastgesteld productdefect. De eerdere read-only analyse vond geen bestaande goedgekeurde voorziening om de vereiste testidentiteit veilig aan te maken. Maak binnen deze Payroll-featurebranch geen identiteit of provisioner aan. Houd deze assertion afzonderlijk **OPEN** in de convergence-acceptatiematrix.

## PAY-CONVERGE-basis en parallelle harness

- Lokale refs bij deze overdracht: featurebranch `work/cao-bench02-20261003` HEAD `27ce...`; gecachte `origin/main` `6349d02538351cd01fc51f298c6e6fa0ba88006c`; lokale `main` `cb73260ff0cd83d19fa29e44c9f0b93749fb10af` (17 commits achter die gecachte ref).
- `Integration-Payroll-20261002` staat op `238a285`; die branch is divergent: hij mist de `6349...`-merge en bevat twee eigen documentatiecommits (`a05387e`, `238a285`). De featurebranch en deze integratietak zijn dus geen fast-forwardpaar. De read-only `git ls-remote origin refs/heads/main` faalde met `SEC_E_NO_CREDENTIALS`; de huidige remote SHA is niet vers geverifieerd. Begin latere convergence vanaf een opnieuw geverifieerde actuele baseline en beoordeel die twee documentatiecommits afzonderlijk; merge deze takken niet blind.
- De kandidaat bevat vijf Payroll-lokale forward-migrations ten opzichte van de gecachte `origin/main`. Controleer vóór een eventuele remote migratie de ledger tegen de exacte convergence-SHA en pas alleen nog niet toegepaste migraties eenmaal toe. Deze closeout voerde geen remote write uit.
- TEST-HARNESS01 is niet overgenomen. De parallelle worktree staat op `6349...` met oncommitted auth-, launcher- en harnesswijzigingen. Het eigen runrapport zegt `BLOCKED`: bestaande Test HR Admin kreeg `403 TEST_LOGIN_FORBIDDEN`; de volledige suite, overige persona's en browsermatrix zijn niet geaccepteerd.

## AA-REL releaseadvies aan Edwin

AA-REL §8 staat een expliciet beperkte synthetische TEST-release met een zichtbare OPEN-matrix toe als de geverifieerde auth/anonieme API/tenant-basissmoke slaagt, geen kritieke kwetsbaarheid is vastgesteld, alle passende gates op de exacte geïntegreerde code groen zijn, SHA/provenance en schone releasecheckout kloppen, en hosted READY/safety smoke is bewezen. De open Mars→Jupiter-proef moet zichtbaar OPEN blijven; de uitzondering vervangt geen server-side autorisatie of latere gerichte proef.

**Advies nu: HOLD — geen integratie- of TEST-releasebesluit op dit bewijs.** De integratietak is divergent, de remote SHA kon niet actueel worden gelezen en er is geen hosted READY/safety-smoke op een exacte geïntegreerde kandidaat aangetoond. Na die convergence-gates kan Edwin afzonderlijk besluiten of het resterende securityrisico aanvaardbaar is voor uitsluitend synthetische TEST met OPEN acceptatie. Geen merge, push, deployment, version bump, identity- of databasewijziging is in deze closeout uitgevoerd.
