# PAY-W03-INTEGRATION-READY-07 — technische PR-handoff

Datum: 2026-10-25. Alleen integratievoorbereiding; geen nieuwe performanceproef of productwijziging.

## Gecontroleerde basis

- Repository `EdwinCycling/LiquidHR`; branch `work/pay-w01-w03-defect-close-04-20261024`.
- Ingangs-HEAD `548bd3ad55f81768a43a79464bd4a0a9acb5e4a6`, schone werkboom.
- Actuele remote `main`, via `git ls-remote`: `630df89c84bc2be4774072d387ecb5dc7df10f91`; lokale `origin/main` gelijk. Oudere AA-koppen noemen `1c4eb3d`; die gelden niet als de huidige Git-baseline. Hosted provenance is niet opnieuw gecontroleerd.
- Laatste productcode `b4a2cbc2ce18e319fbcd36b64ebab023d8a2f500`; `git diff b4a2cbc2 HEAD -- apps packages scripts` is leeg.
- W02 [Draft PR #48](https://github.com/EdwinCycling/LiquidHR/pull/48): OPEN/Draft, head `5e0697fb5bc74d40e16aaec5e8fb309233218772`, base `630df89c84bc2be4774072d387ecb5dc7df10f91`, 19 bestanden. Connectorreadback en Git-objecten gecontroleerd; de lokale gh-auth gaf 401, waarna de bestaande connector werkte.
- Actuele lokale W04 `work/pay-w04-source-readiness-01-20261024`, HEAD `2e4b78a8ee58f580f2c03c09813c66f14324af10`, schoon bij inspectie. Geen remote W04-head in de remote heads-lijst. Alleen gelezen; geen wijziging aan W02/W04.

## Volledige W01/W03-diff en technische controle

De vergelijking met main omvat 27 bestanden: 19 source/test/build-toolbestanden en 8 AA/evidencebestanden, 4.324 toevoegingen en 189 verwijderingen vóór deze docs-handoff. Geen schema, dependency, configuratie, auth-policy, PDF-template of R2-rekenregel gewijzigd. De complete bestandsinventaris staat onderaan. Historische rapporten `474e6754` en `f784c257` blijven behouden; actuele OPT-06-evidence vult ze aan en overschrijft ze niet.

- Cycle-service behoudt 39 canonieke snapshots en individuele foutdiagnostiek; optionele batchprovider, volledigheidscontrole op resultaatlengte en fallback naar bestaande individuele reader met concurrency 12.
- Timeline: maximaal vier expliciete employee/employment-paren, drie groepen tegelijk, vier queries per groep. Autorisatie per doel vóór reads, dezelfde tenant/HR-groep/administratie en periode, authenticated SSR-client/RLS, UUID-filtervalidatie, exacte paarpartitionering. Limieten en gelijke sorteerdatums veroorzaken fallback; bestaande effectieve projectie blijft leidend.
- Tax: groepen van vier medewerkers, drie groepen tegelijk, vier queryfactories; alle effectieve dienstverbanden en IKV-links blijven nodig. Scope, effectieve datums, per-medewerker partitionering en truncatiebewaking blijven behouden.
- Actual Work: groepen van vier, concurrency 12, begrensde paginering en exacte paarpartitionering. Vooraf geautoriseerde scopes worden op volgorde, medewerker en gedeelde scope gecontroleerd; interne caller is de provider na zijn bestaande autorisatie. Geen publieke bypass of service-role-client toegevoegd.
- Catalog-/werkgever-/pensioenhergebruik is React request-scoped en gesleuteld op toepasselijke scope/IDs; geen procesbrede persoonsgegevenscache. Income-links worden alleen bij complete equivalente bronsets hergebruikt; anders individuele read.
- Provider valideert employee/employment, CONFIRMED/deleted/periode en scope ook bij expliciete employmentselectie. Bronhashes, version vectors, provenance en SOURCE_GAP-projectie blijven behouden. Leestekorten worden niet omgezet in succesvolle salarisuitkomsten.
- Twee buildhulpen volgen uitsluitend bestaande allowlisted Next-outputmappen; gewone `.next` blijft default. Client-boundary scanner en provenance blijven verplicht; geen buildguardversoepeling.

Geen nieuw bewezen blokkerend productdefect gevonden in deze bounded diffcontrole. Tekstueel automatisch mergen bewijst geen gecombineerde functionele correctheid.

## Overlap en conflictbewijs

`git merge-tree --write-tree --name-only` is gebruikt zonder checkout, indexwijziging of mergecommit; alleen tijdelijke Git-treeobjecten zijn geschreven.

| Vergelijking op bovenstaande SHA's | Overlap | Resultaat |
| --- | --- | --- |
| W01/W03 + W02 | provider `.ts`, provider `.test.ts`, `AA-CURRENT.md`, `AA-OPEN.md` | Geen tekstconflict, synthetische tree `0a95481e0328f0a2aef9c565fd3d868bfd6050fa` |
| W01/W03 + W04 | provider `.ts` en `.test.ts` | Echt contentconflict in provider, conflict-tree `4276106fbde7b9ca59200afff71b95a7310271a3`; testbestand auto-merge |
| W02 + W04 | bredere Payroll-bron/fixture/readiness-overlap | Geen tekstconflict, tree `7ffbaa532525a627c5d0ab73a2167250a7298524` |

W04-conflict: W03 verplaatst directoryselectie naar de route zonder expliciet employment en hergebruikt reeds gevalideerde timeline; W04 raakt diezelfde scope-/employmentsectie en voegt Retail-business-scopecontrole toe. Integrator moet beide garanties behouden: W03 begrensde reads en expliciete employmentvalidatie, W04 tenant/administratiecontrole van retailBusinessScope, geldige kalenderdatums en interval-SOURCE_GAP. Geen whole-file ours/theirs-keuze. De drie branches samen zijn niet geïntegreerd of getest.

`AA-CURRENT` en `AA-OPEN` auto-mergen tekstueel met W02 maar vereisen semantische consolidatie: W02-synthetische oracle is geen W01/W03-acceptatie en geen fiscale bronvalidatie. W03 LOCAL blijft PARTIAL, HOSTED/issue #39 OPEN. W01/W03 wijzigt `AA-PAYROLL.md` niet; W02 en W04 wel. Hun pairwise merge is tekstueel schoon, maar behoud beide statusclaims en W04-brongaps. Niet de hele AA-file overschrijven; historische evidence-links bewaren. De W02-PR-body zegt nog dat er geen W01/W03-codeoverlap is: dat is inmiddels verouderd door de huidige providerwijzigingen en moet bij integratie worden gecorrigeerd.

## Bestaand bewijs op finale code

Op `b4a2cbc2ce18e319fbcd36b64ebab023d8a2f500`: finale 193/193 regressies in 28 bestanden, HR Suite TypeScript, gerichte ESLint PASS. Logbestanden en buildprovenance lokaal opnieuw gelezen. Full root `npm run build` exit 0, Node 24.22.1, bestaande W02-context `.next/payrun01-acceptance-20261009`: HR Suite 339/339, Control 12/12, Payroll client-boundary inclusief negatieve controle en PDF/function-trace/runtime-assets PASS. Build-ID `v9CqrYT_xzwDtFMNSFPHf`; provenance noemt exact b4a2cbc2. Dit is geen bewijs voor een nog te maken gecombineerde W02/W04-code-SHA. Geen ongewijzigde tests/build opnieuw gedraaid.

De volledige diff-check vond één oude trailing space in de toegevoegde W00-AA-regel; uitsluitend die documentatiewhitespace is in deze handoff verwijderd. Finale diff-check opnieuw uitgevoerd. Geen i18n/productwijziging.

## Bestaande performance en volledigheid

Timeline/tax REST-requests 355 → 152: primaire timelines 273 → 70, overige timeline/catalog 32, tax/IKV 50. Dit is niet het oude hele-route-aantal 790. 39 snapshots blijven 39. Tweede variant met 92 requests is teruggedraaid; geen nieuwe optimalisatie.

| Bestaande OPT-06-trial | Zichtbare lijst ms | Volledige werkplek ms | Timeline ms | Tax ms |
| --- | ---: | ---: | ---: | ---: |
| Desktop 1 | 3197 | 13477 | 3573 | 2856 |
| Desktop 2 | 4147 | 16098 | 6095 | 1613 |
| Desktop 3 | 3419 | 14500 | 4815 | 2020 |
| 390px 1 | 5233 | 25124 | 6387 | 8974 |
| 390px 2 | 2756 | 22992 | 12797 | 3376 |
| 390px 3 | 14427 | 36412 | 12529 | 3276 |

OPT-05 volledige werkplek desktop 11835/12990/17767 ms en mobiel 13093/12642/29781 ms: geen consistente latencywinst bewezen. Geen p95-claim, geen geïsoleerde database-/netwerktijd, geen overeengekomen performancebudget. Alle zes OPT-06-trials: 14 runs en 39/39 unieke medewerker/employmentregels; bronhashes, version vectors en gaps gelijk. Snapshotdigest `0964b63039cc7228cc5b7ea4f0b483e87ee4061ecc2530e31af304435b9a85be`. Lisa FINALIZED-PDF ongewijzigd, SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`. Zie [volledig OPT-06-bewijs](PAY-W03-TIMELINE-OPT-06-20261025.md) en de metricsbijlage.

## Resterende acceptatie en besluiten

- Jaap: conceptdetail 200, preview 404 `PAYROLL_CONCEPT_PAYSLIP_UNAVAILABLE`. Past bij ontbrekende GENERIC_INPUT_REFERENCE; precieze opgeslagen referentiestatus niet apart publiek bewezen. OPEN; geen bewezen rendererfix, geen kunstmatig artifact of finalisatie.
- Historisch rooster 209 versus 196: periode/selector/recordmanifest ontbreken, 13 items niet identificeerbaar. OPEN historische meetvraag; huidige gelijke 39/39-dataset is geen verklaring of bewezen reparatie daarvan.
- Lisa HR Admin/Employee-PDF en Manager team/scopeprobe zijn historische lokale PASS; OPT-06 heeft alleen HR Admin-PDF opnieuw gelezen. Geen nieuwe live Employee/Manager/foreign-tenantacceptatie in deze handoff.
- Hosted autorisatie en issue #39 OPEN: normale geautoriseerde HR Admin/Employee-sessie, actor/tenant/groep/administratie/self-scope readback, minimaal drie hosted zichtbare-lijst/volledige-werkplekmetingen met dataset/source-attributie en budget/expliciete uitzondering ontbreken. Eerst exacte hosted buildprovenance bewijzen. Eventuele release en account-/rechtenactie vereist afzonderlijk mandaat; geen login- of beveiligingsbypass.

| Beslissing | Advies | Grens |
| --- | --- | --- |
| Afzonderlijke Draft PR publiceren | **GO voor voorbereiding; uitvoering HOLD op mandaat** | Handoff en conceptbody gereed. Geen push/PR-publicatie in deze opdracht; vóór latere push Vercel-triggerbeleid controleren. |
| Gezamenlijke code-integratie | **HOLD** | W04-providerconflict oplossen in afzonderlijk geautoriseerde integratie; AA-status samenvoegen; gecombineerde finale relevante Payroll/securitysuite, TypeScript/lint en rootbuild op exacte kandidaat. W02 pairwise tekstueel schoon is geen gezamenlijk GO. |
| Release | **HOLD** | Geen releaseautoriteit; W01 LOCAL PARTIAL, W03 LOCAL PARTIAL, HOSTED OPEN, issue #39 open en echte bronacceptatie afzonderlijk. |

## Concept afzonderlijke Draft PR

Titel: `Payroll W01/W03: begrensde bronreads en lokale acceptatie-evidence`

De Payroll-werkplek leest voor 39 medewerkerregels veel dezelfde en afzonderlijke brongegevens. Deze wijziging behoudt de 39 canonieke snapshots, autorisatie en SOURCE_GAP, maar bundelt begrensde timeline-, tax/IKV- en Actual Work-reads en hergebruikt identieke catalog-/werkgeverreads binnen dezelfde requestcontext. De timeline/taxfase daalt van 355 naar 152 REST-requests; gegevens, bronhashes/version vectors en bestaande FINALIZED-PDF blijven gelijk.

De finale code b4a2cbc2 is geverifieerd met 193 regressies, TypeScript, ESLint en volledige rootproductiebuild. Desktop volledige werkplek: 13.477/16.098/14.500 ms; 390px: 25.124/22.992/36.412 ms. Minder reads is bewezen; consistente end-to-end latencywinst niet. W03 LOCAL blijft PARTIAL. W01 LOCAL blijft PARTIAL wegens Jaaps preview/inputgap; de historische 209/196-roostertelling blijft onverklaard. Hosted autorisatie en performance blijven OPEN, gerelateerd aan #39; deze PR sluit #39 niet.

W02 Draft #48 en W04 blijven afzonderlijke werkstromen. De huidige W02-head mergeproef is tekstueel schoon; de actuele W04-head heeft een providerconflict dat vóór gezamenlijke integratie met behoud van scope-/bronchecks moet worden opgelost en opnieuw getest. Geen schema/dependency/configwijziging, gedeelde datawrite, salarisrun/finalisatie of release inbegrepen. Zie dit handoffrapport voor exacte SHA's, volledige bestandslijst en beslisgates.

## Bestandsinventaris bij ingang

- `apps/hr-suite/lib/actual-work/actual-work-service.test.ts`
- `apps/hr-suite/lib/actual-work/actual-work-service.ts`
- `apps/hr-suite/lib/employment/employment-detail-service.ts`
- `apps/hr-suite/lib/employment/employment-payroll-tax-profile-service.ts`
- `apps/hr-suite/lib/employment/employment-payroll-tax-profile-source-batch.test.ts`
- `apps/hr-suite/lib/employment/employment-payroll-timeline-batch.test.ts`
- `apps/hr-suite/lib/employment/payroll-source-income-relationship-projection.test.ts`
- `apps/hr-suite/lib/employment/payroll-source-income-relationship-projection.ts`
- `apps/hr-suite/lib/employment/payroll-source-pension-version-tier-reader.test.ts`
- `apps/hr-suite/lib/employment/payroll-source-pension-version-tier-reader.ts`
- `apps/hr-suite/lib/employment/payroll-source-read-cache.test.ts`
- `apps/hr-suite/lib/employment/payroll-source-read-cache.ts`
- `apps/hr-suite/lib/employment/payroll-timeline-batch-reader.ts`
- `apps/hr-suite/lib/payroll/payroll-cycle-service.test.ts`
- `apps/hr-suite/lib/payroll/payroll-cycle-service.ts`
- `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.test.ts`
- `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.ts`
- `apps/hr-suite/lib/payroll/verify-client-bundle.mjs`
- `apps/hr-suite/scripts/write-build-provenance.mjs`
- `docs/AA/AA-CURRENT.md`
- `docs/AA/AA-OPEN.md`
- `docs/quality/acceptance/runs/PAY-W00-AUTH-UNBLOCK-01-20261024.md`
- `docs/quality/acceptance/runs/PAY-W00-SHARED-BUILD-01-20261024.md`
- `docs/quality/acceptance/runs/PAY-W01-W03-DEFECT-CLOSE-04-20261024.md`
- `docs/quality/acceptance/runs/PAY-W01-W03-FORCE-LOCAL-03-20261024.md`
- `docs/quality/acceptance/runs/PAY-W03-TIMELINE-OPT-06-20261025.md`
- `docs/quality/acceptance/runs/PAY-W03-TIMELINE-OPT-06-20261025.metrics.json`
