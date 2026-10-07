# PAYRUN01 Lisa baseline — 2026-10-07

## Baseline

Lisa scenario v3 is the proven PAYRUN01 generic calculation path in Payroll Lab TEST. Run `b6a83047-f8ed-4547-b893-1c8e249cec2b` succeeded with 19/19 controls, 15 persisted components, and a 15-entry trace. The failed v2 run remains preserved; v3 has distinct source and input identities.

The lifecycle persisted as `CONCEPT → REVIEWED → FINALIZED` and survived reload. `TECHNICAL_JSON` and `PAYSLIP_PDF` were generated and downloaded separately from the same run. Their downloaded hashes matched their stored artifact hashes.

## Exact run values

| Component | Amount |
| --- | ---: |
| Gross salary | €5,500.00 |
| Taxable wage | €5,500.00 |
| Wage tax | €1,577.17 |
| Net salary | €3,922.83 |
| Employee pension | €0.00 |
| Employer pension | €0.00 |
| Employer insurance | €1,233.10 |
| Holiday reserve | €440.00 |
| Year-end reserve | €0.00 |
| Cumulative gross | €55,000.00 |
| Cumulative holiday reserve | €4,400.00 |
| Total employer cost | €7,173.10 |

## Persisted identities

- Source hash: `b453fca263533f5d875894213f9bff2e2da799f83e461e292257a9fd7efc8e4e`
- Input hash: `7c06b678d88792c109dfc933e3328761897241db89a7156357a942d9adaef55a`
- Result hash: `279bc3d71728e96969d48f4a7dbbe012ea9dccb98d93fa3ea2789d405e66d1b2`
- JSON artifact hash: `98b11c9b2f72a89de20f1bc6b08ad9c5c4e4e834e434e0bbbe827c1c8f921c1d`
- PDF artifact hash: `156f7fdf141fd7878aec54ff94ec22043ef42f89a2606429999c2cef44e24194`

## Failure fixed

The original guarded input-reference insert failed with SQLSTATE `42702` because the trigger function used an unqualified `source_employment_id` that collided with a PL/pgSQL variable. The forward migration qualifies the relevant table columns. A later TEST-only version guard rejected the explicit v3 successor; the separate supersession migration permits that consecutive successor when no successful overlapping run exists, preserving v2 history. The application then persisted v3 and the run.

## Verification and limits

The focused PAYRUN01 migration/source-identity/artifact tests passed 18/18 across three files. The earlier targeted payroll set passed 81 tests across seven files. The full HR-suite run had 2,301 tests pass and 3 skipped; one untouched PDF-renderer test timed out at its 5-second limit. Changed-source ESLint and NL/EN parity passed. Strict TypeScript remains blocked by the unrelated `TS2366` at `components/payroll/component-library-entry-detail.tsx:76:57`.

Desktop 1440×900 and iPhone 16 393×852 showed no horizontal overflow. At mobile width the global Setup rail overlaps the edge of lifecycle timestamps. Release remains NO-GO; no general Dutch payroll, payment, declaration, or release readiness is claimed.

This recovery point records Lisa's proven run and the shared PAYRUN01 implementation used by it. Separate Jan investigation and any Jan TEST-data changes are not part of this Lisa baseline document.
