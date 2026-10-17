# PAYINTEGRATE-01 — Payroll-integratie en oktober 2026

Datum: 2026-10-17. Branch: `work/PAYINTEGRATE-01-20261017`. Basis: `02ee9f1d99623fc802c419c9521b678ab6dfc5bd` (PAYDATA-02/PAYPENS-02/PAYFULL-02-lijn).

## Integratie

- `22e1051c11c5ac7a8eac8af0f524bbf48dd538f9`: gecontroleerde merge van PAYRUN-03; de originele `54fee1f3a8a2ac8c1d41d5b114c542dbb94c5774` en PAYCASE-03A `7acf8c6a12797c2bb1880c8c187002a01561b826` blijven in de geschiedenis.
- `4922eb9b097b4655245707911b94abaa4e3d5312`: de exacte PRODUCT-PRINCIPLE-01-inhoud, broncommit `719fb1b8d79e4b5f8094ce15b9fd6818bbad554b`.
- `d1e8d5a2a6370dfece7c7f5a47ee863687122ce4`: uitsluitend de vooraf geïsoleerde PAYFULL-03/04-code, broncommit `eb4d7a9c4458adc8809b38086c0210cc9d2bb779`.
- PAYDATA/PAYPENS-bronlijn is bereikbaar in de integratiebasis: fiscale/IKV-services en migrations, pensioen-arrangement/versioning/workflow en de bestaande Payroll source projection. Er is geen tweede Payroll-engine toegevoegd.

## Acceptance-overzicht

| Medewerker | Readiness | Bruto | Pensioen | Loonheffing | Netto | Runstatus | PDF |
|---|---|---:|---:|---:|---:|---|---|
| Emma | lokale PAYFULL-03-oracle PASS; live Core-readback geblokkeerd | €2.110,20 lokaal | live onbekend | €752,83 lokaal | €1.357,37 lokaal | geen live run | niet bewezen |
| Noah | lokale PAYFULL-04-oracle PASS; live Core-readback geblokkeerd | €1.758,50 lokaal | live onbekend | €630,04 lokaal | €1.128,46 lokaal | geen live run | niet bewezen |
| DEMO-001 | historische TEST-regressie behouden; niet opnieuw uitgevoerd | €3.517,00 | €191,93 | €1.188,58 | €2.181,49 | FINALIZED, historisch | 513.704 bytes; `6d1499151d79ea1ea470dfe5bac1a73b0cecbd34a3ae41ded48acefefe108a2b` |
| DEMO-002 | historische TEST-regressie behouden; niet opnieuw uitgevoerd | €3.534,00 | €251,72 | €1.173,42 | €2.141,36 | FINALIZED, historisch | 513.406 bytes; `51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977` |
| DEMO-003 | PAYCASE-03A historische TEST-regressie behouden; niet opnieuw uitgevoerd | €3.517,00 | €191,93 | €518,42 | €2.851,65 | FINALIZED, historisch | 513.667 bytes; `2996b1447ff304c5583ebe7e7a34b3040f5f1bcb3b131f070a8e9aacd2e380cd` |

De Emma- en Noah-bedragen zijn onafhankelijke lokale PAYFULL-oracle-uitkomsten, geen actuele Core- of loonrun-readback. De DEMO-resultaten en hashes zijn bestaand TEST-bewijs; geen definitieve historische run is gewijzigd.

## Gates

- Payroll-rules: 4 files / 29 tests PASS.
- Geïntegreerde HR/payroll-regressies: 22 files / 203 tests PASS.
- PAYDATA/PAYPENS fiscale-, pensioen- en migration-contracten: 17 files / 90 tests PASS.
- Beide package-typechecks, volledige HR-typecheck, i18n (43 namespaces) en `git diff --check` PASS. ESLint: 0 errors, 6 bestaande warnings in `lib/payroll-import/service.test.ts`.
- Productiebuild buiten de beperkte sandbox: Turbopack compile PASS, TypeScript PASS, 332/332 statische pagina's PASS, client-boundary scanner PASS (167 browser assets), build provenance op `d1e8d5a2a6370dfece7c7f5a47ee863687122ce4`. Bestaande tracing-warning rond dynamische logo-pad-resolutie blijft open.

## Blockers en verdict

- Live Core TEST-readback voor Emma en Noah is **UNVERIFIED**: de centrale preflight stopte vóór serverstart met `De centrale lokale TEST-configuratie ontbreekt`. Daarom zijn fiscale profielversies, IKV/Mars-binding, pensioenkoppelingen, salarisreadback en BSN-aanwezigheid niet uitgelezen of gemuteerd. Dit is een runtime/configuratieblocker, niet geclassificeerd als ontbrekende bron.
- Browseracceptatie (desktop/390px), calculate/recalculate, review/finalize en nieuwe PDF/SHA-readback zijn niet uitgevoerd omdat dezelfde centrale TEST-runtime ontbreekt. Geen fallback, credential, Auth-identiteit, remote DB-write, merge of deployment gebruikt.
- Verdict volledige oktober-maandverwerking: **HOLD**. Lokale geïntegreerde code en regressies zijn GREEN; externe Core-/browser-readiness moet eerst aantoonbaar beschikbaar zijn.
