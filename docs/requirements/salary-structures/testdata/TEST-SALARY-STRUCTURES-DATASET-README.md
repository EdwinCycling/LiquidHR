# LiquidHR Salary Structures — Test Dataset

**Fixture:** `TEST-SALARY-STRUCTURES-DATASET.json`
**Doel:** één canonieke seed-/validatieset voor de herbouw van Salarisstructuren.

## Wat zit erin

- Volledige publieke CAO Rijk salaristabel per **1 juli 2026**: 18 schalen × 11 tredes = **198 salarisbedragen**.
- Een tweede, synthetische toekomstige Rijk-revisie (+3%) om revision identity/diff/publish te testen.
- Compact schaal/tredesysteem met slechts **2 tredes** in één schaal, plus vrije labels `Aanloop`, `A1`, `A2`, `0`, `1`, `Eind`.
- Drie verschillende salarisbandstructuren:
  - Engineering: midpoint+spread en open hoogste band.
  - Management: handmatige min/100%/max-ankers.
  - Support: min+max invoer en berekend midpoint.
- Per band vooraf berekende verwachte `range_spread`, `midpoint_progression`, `overlap` en gap-indicator.
- CAO-koppelingen met 0, 1 en meerdere toegestane salarisstructuren.
- Legacy regressiegevallen voor `CUSTOM_SCALE`, `MANUAL`, `MINIMUM_WAGE`, `NO_PAYROLL`.
- Een migratieconflict met dezelfde legacy schaalcode in twee administraties.

## Belangrijk

De CAO Rijk 2026-07-01 bedragen zijn publieke referentiedata. Alle overige band-, future-revision-, persoon- en migratiegegevens zijn **synthetische testdata**.

Deze fixture mag uitsluitend in LiquidHR dev/test worden gebruikt.

## Seed-regel voor Codex

Codex mag de JSON vertalen naar SQL/test factories/fixtures volgens bestaande LiquidHR testpatterns, maar:
1. de JSON blijft de canonieke testdataset;
2. bedragen/expected metrics mogen niet stilzwijgend worden aangepast om tests groen te krijgen;
3. een mismatch tussen berekende waarden en `expected_metrics` is een test failure en moet inhoudelijk worden onderzocht;
4. `TEST-SALARY-STRUCTURES-*` data mag tijdens securitytests worden opgeruimd/herbouwd;
5. geen production seed.
