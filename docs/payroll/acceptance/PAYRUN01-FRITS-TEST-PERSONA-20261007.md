# PAYRUN01 — Frits synthetic Kinderopvang TEST checkpoint — 2026-10-07

**Status:** The finalized September and October runs below are historical evidence. The October historical input used 1 approved additional hour. The corrected 8-hour source event is read back, but the successor v42 CalculationInputSet/run is blocked by the Payroll Lab TEST version guard. No 8-hour run, PDF, or desktop/iPhone 16 acceptance is claimed.

## Persona and source boundary

**SYNTHETIC TEST PERSONA DATA — RANDOMLY GENERATED**

The supplied identity and contact fields, the secured BSN record, and primary bank-account record belong only to the synthetic Frits TEST fixture. They were handled through existing secured Core/DEV domain paths. The corrected contact readback was completed in the preceding continuation. This report deliberately records none of the underlying values. No payment was initiated. The app's source projection and October JSON were checked for sensitive field names; none were present. The October PDF has not yet been generated, so it has no artifact-level privacy review. This checkpoint did not repeat Core readback: the Supabase project inventory showed no explicitly DEV-labeled branch, so no Core query was issued without a provable Production boundary. The secured-field presence/primary flags therefore remain prior UI readback evidence, not a fresh database verification.

Jan remains one existing legacy TEST persona. No Jan employment or source row was changed. The rejected Jan-specific same-date supersession proposal is abandoned and is not present in the active migration files. Do not re-submit or apply it. A generic Core supersession capability is separate future work; the global guard remains unchanged.

Frits has one primary employment in the existing Jupiter TEST administration, effective 2026-09-01. The persisted Payroll source snapshot carries the Jupiter Kinderopvang labor-condition set, pedagogisch professional function, scale 6 / step 20, full-time amount €3,425.00 at the official 36-hour norm, and a 32-hour contract. Function-to-scale and dated salary amount come from the official CAO; step 20 and the Frits persona values are synthetic choices. The versioned TEST tax profile is `PAYRUN01_KINDEROPVANG_TEST_TAX_PROFILE` v1, effective 2026-09-01, year 2026, WHITE / NL / UNDER_AOW / STD / monthly, with payroll tax credit enabled. It contributes to the source and calculation input identity. No employer payroll-tax number was created.

Official sources:

- Function-to-scale mapping and dated salary table: [Cao Kinderopvang 2025–2026 (integral PDF)](https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf)
- Full-time basis of 36 hours/week and 1,879.2 annual hours in 2026: [CAO hours](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/aantal-uren)
- Salary-setting rules and dated increases: [Het salaris bepalen](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen)

## Persisted calculations

| Period | Run | Source hash | Input hash | Result hash | Controls | Lifecycle |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09 | `131a5fcb-c92a-416f-8fdf-bc87e2d3ae47` | `1fd490265fe592fcb7194743d27277f484ac94f702a0fb937ec178449bbbd9b0` | `d533ab41593274e4c284538098882069881e5b6e93374e9bc074c073d68dceb0` | `4d954f18efaed2f1611d70774037cd7bf249f6a4548fbc2e8659e9b48403e418` | 18 PASS / 1 WARN / 0 FAIL | CONCEPT → REVIEWED → FINALIZED |
| 2026-10 | `2d8057f1-92a9-4e0b-bfc6-09806c81ced5` | `6e5af7a60ad608b7f99b9380edde630bfb9346054010b811391fda9b620e780e` | `4f83a058632f9a3780c97adb559ab7113e05483eedba170548b1445145513606` | `a3a9d500e1b5450dd3232aa52b5fbf559c1fdaa1dada6c795711a139b6e3afbb` | 18 PASS / 1 WARN / 0 FAIL | CONCEPT → REVIEWED → FINALIZED |

Both finalized runs have 15 component rows and one trace. September uses calculation-config version 40; historical October uses version 41, effective 2026-10-01 and included in October's input identity. The October historical CalculationInputSet `686f12ae-9678-5b6f-8ddb-27861cc11a55` contains 1.0000 approved additional hour dated 2026-10-06; contractual monthly salary is not paid twice.

| Component | September | October |
| --- | ---: | ---: |
| `additional_cash_amount` | €0.00 | €21.87 |
| `contractual_salary` | €3,044.44 | €3,044.44 |
| `cumulative_gross` | €3,044.44 | €6,110.75 |
| `cumulative_holiday_reserve` | €243.56 | €488.86 |
| `cumulative_year_end_reserve` | €243.56 | €488.86 |
| `employee_pension` | €0.00 (excluded) | €0.00 (excluded) |
| `employer_insurance` | €682.56 | €687.46 |
| `employer_pension` | €0.00 (excluded) | €0.00 (excluded) |
| `gross_salary` | €3,044.44 | €3,066.31 |
| `holiday_allowance_reserve` | €243.56 | €245.30 |
| `net_salary` | €2,639.44 | €2,652.39 |
| `taxable_wage` | €3,044.44 | €3,066.31 |
| `total_employer_cost` | €4,214.12 | €4,244.37 |
| `wage_tax` | €405.00 | €413.92 |
| `year_end_reserve` | €243.56 | €245.30 |

Amounts are the stored engine results for the explicit synthetic TEST profile. Historical v41 contains numeric zero pension result rows from the earlier package; these are retained only as immutable history. The corrected package omits employee/employer PFZW calculation components and labels employer cost before PFZW. PFZW remains `SOURCE_GAP`, not a calculated zero.

## October 8-hour source verification

The approved October scenario is one additional-work entry with **8.0000 approved hours**, dated **2026-10-06**, entry `b66111f1-e683-430c-bd20-7760c8a9247d`. The existing Actual Work domain API recorded the correction revision from 1 to 8 hours. Readback returns one approved entry; no second employment or duplicate work event was created.

The formula implemented for the successor package is:

`€3,425.00 × 12 × 8 ÷ (36 × 52.2) = €174.9680715… → €174.97`

The unrounded ordinary hourly rate is €21.8710089… . The period total is rounded once to cents, so the calculation does not first round the hourly rate and multiply that rounded figure.

The engine-only regression fixture, using the approved Frits profile and September opening balances, produces these **expected but not persisted** October results:

| Component | 8-hour package result |
| --- | ---: |
| Additional-hours amount | €174.97 |
| Gross | €3,219.41 |
| Wage tax | €475.50 |
| Net before PFZW | €2,743.91 |
| Employer insurance | €721.79 |
| Holiday reserve | €257.55 |
| Year-end reserve | €257.55 |
| October cumulative gross | €6,263.85 |
| Cumulative holiday reserve | €501.11 |
| Cumulative year-end reserve | €501.11 |
| Total employer cost before PFZW | €4,456.30 |

The v42 config identity pins the 8-hour expectation and formula and supersedes v41; its rule package derives the cash amount from approved hours instead of storing a flat €21.87 amount. Four targeted suites pass (36/36), including the exact 8-hour fixture, formula result, reserve/tax/cost outputs, and absence of numeric PFZW rows. These are code-level results only; the new persisted CalculationInputSet and CalculationRun do not yet exist.

The Payroll Lab database currently rejects an overlapping successor after a successful run. A narrowly TEST-only migration candidate requires sequential versions, explicit `supersedesVersion`, matching scenario identity, and leaves old records immutable. Applying it to `LiquidHR-Payroll-Lab` was rejected by automatic approval review because it persistently changes a shared version guard for matching employments. It was not applied. Therefore the finalized v41 records and their input set remain unchanged, and v42 recalculation is held for explicit authorization of that guard change.

## Artifacts and duplicate audit record

Read-only Payroll Lab TEST readback confirms the following artifact metadata; artifact contents were not printed:

| Period | Artifact | SHA-256 | Bytes | Readback |
| --- | --- | --- | ---: | --- |
| September | `TECHNICAL_JSON` | `63f5004b37123dc6a58bd991127264683cb88faca3188f64e501af0ebac3ab74` | 210,285 | Stored |
| September | `PAYSLIP_PDF` | `4f39811c0029bbdb66660a9d967950b908e833b053ee99d13fc2ddfe62753924` | 34,049 | Stored |
| October | `TECHNICAL_JSON` | `610f39dc41a1d5ae55726f7e7eb8d44f4411cd2fdbb3c0e5e0f191773297fd3c` | 210,525 | Stored; JSON action previously returned the file |
| October | `PAYSLIP_PDF` | — | — | Not generated |

An extra October run `026aaeda-3f7c-4cbe-849f-ecc93f0ee30c` remains as an immutable `CONCEPT` audit record. It has the same source/input/result hashes and 15 components, but no review/finalize lifecycle and no artifacts. It is not the finalized October run above and was not deleted.

## Open boundaries

- The Core IncomeRelationship/IKV is still projected as `UNSUPPORTED` with `CONTROL02_CONTRACT_PENDING`; the calculation used the bounded Payroll-owned fallback. A passing PAYRUN01 ambiguity control does not prove a valid Core IKV 1. The source contract remains open.
- `PAYRUN01-CTRL-009-PENSION-RULE-READY` warns. PFZW monthly allocation and cent-rounding remain `PAY-RULE-002 = OPEN / SOURCE_GAP`; no PFZW amount is asserted.
- The missing employer payroll-tax number is `DECLARATION NOT READY`, not a calculation blocker. It was not invented.
- Personal/bank readiness is separate from the payroll calculation hash. The Core employment detail model exposes a presence-only BSN flag and bank-account metadata; the PAYRUN01 source snapshot deliberately omits those values. Frits' current presence and primary-account flags were not freshly re-read under an explicitly verified DEV target in this checkpoint, so that readiness evidence remains prior UI readback rather than a new confirmation.
- No v42 October PDF or separate JSON/PDF download acceptance is proven. September artifacts are present in storage; this checkpoint did not repeat the browser download flow.
- Desktop 1440×900 and iPhone 16 393×852 acceptance remain open for the corrected 8-hour Frits run.
- Current local runtime blocker: `.next` is confirmed ignored/generated. The lock contents report PID 42032, but that PID is not visible as a running process; regular file access reports that another process is using the lock. The process inventory in the sandbox cannot identify its owner. No cache deletion or process termination was performed. Retry only after the existing approved launcher can establish safe ownership or the lock releases. Port 3000 and unrelated Chrome processes remain untouched.
- The unrelated `TS2366` at `components/payroll/component-library-entry-detail.tsx:76:57` and untouched `lib/document-generation/pdf.test.ts` 5-second timeout remain separately reported and unchanged.

No push, merge, deployment, version bump, payment, or Loonaangifte submission occurred.
