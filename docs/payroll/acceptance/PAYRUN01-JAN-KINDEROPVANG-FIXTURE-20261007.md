> **Historisch en vervangen:** de latere koerswijziging maakt Frits de canonieke Kinderopvang TEST-persona. Jan blijft de bestaande legacy TEST-persona en is niet gewijzigd. Pas deze Jan-fixture niet toe en voer de verlaten eenmalige supersession niet opnieuw in. De algemene Core-supersessionbehoefte is apart toekomstig werk.

# PAYRUN01 — Jan Kinderopvang TEST fixture — 2026-10-07

**Status: fixture defined; Jupiter's Kinderopvang set and the PAYRUN01 TEST salary structure are configured and linked. Jan's employment source rows and calculation runs remain unchanged.** This version supersedes the earlier 2026-10-05 draft for the PAYRUN01 Jan path. “Jan” is a bounded TEST-persona label, not a statement about the real employee's job, salary, contract, age, tax status, or pension entitlement.

## Core/DEV configuration readback — 2026-10-07

The active `Cao Kinderopvang 2025-2026` record was created by the user for Jupiter BV (record `a67b0731-6e0b-4c4f-8086-41a444528ccb`), effective 2025-01-01, active, with a 36-hour full-time norm. Codex did not alter that CAO record.

Using Jupiter BV in the normal settings UI, PAYRUN01 created salary structure `Cao Kinderopvang 2025-2026 — PAYRUN01 TEST` (`CAO_KO_2025_2026_PAYRUN01_TEST`, record `2116ec84-78ad-447d-80f7-8e49d240ab3f`) and published revision `64dec4a9-0df6-44fc-8375-41166ff46536`, effective 2026-09-01. The revision contains only the fixture row: scale 6, salary number 20, EUR 3,425.00 monthly at 36 hours. Its publication validation had no blocking errors or warnings. The scale/function mapping and dated amount are supported by the official CAO appendices; the choice of function and salary number for Jan remains a synthetic TEST choice.

The structure is enabled in Jupiter's salary-application settings and linked to the new Kinderopvang set. After a page reload, the settings UI still showed the PAYRUN01 structure as selected and “Gekoppeld”; the other enabled demo structures were preserved, and the existing `Bedrijfseigen regeling` link was unchanged. The salary-structure catalog filtering defect that hid newly published structures from the enablement UI is fixed in the PAYRUN01 worktree and covered by a focused regression test.

Jan's existing employment itself is not yet canonical for this fixture: it still references `Bedrijfseigen regeling` (40-hour full-time norm), has 32 contract hours/week, and is assigned `Monteur` in Directie. This turn did not change Jan's employment, salary, schedule, function, or income relationship. Do not calculate Jan against the Kinderopvang fixture until the supported employment-source path and effective-dated readback are complete.

### Read-only Core/DEV source verification — 2026-10-07

The existing primary Jupiter employment is number 1, effective 2026-09-01 through 2026-11-30, with a definite-term contract. Source readback through the employment UI showed:

- **Labor conditions / function:** `Bedrijfseigen regeling`; `Monteur` / `Directie` (not Kinderopvang).
- **Salary:** manual monthly values. 2026-09-01–2026-10-01: €4,000 full-time / €3,200 part-time. 2026-10-01–2026-11-30: €4,250 full-time / €3,400 part-time.
- **Schedule:** both 2026-09-01 and 2026-10-01 timeline rows show 32 hours/week, 40-hour full-time norm, 80% factor, `HOURS_PER_DAY`, 4 average days/week, not on-call. The employment UI shows no published repeating work pattern.
- **Income relationship:** opaque reference `686104a1-4f9f-4387-a22c-e0a784dcd4bc`, IKV 1, `EMPLOYMENT`, reporting state `DRAFT`, linked 2026-09-01–2026-11-30. The payroll-tax subnumber was present; its value was not read or recorded.
- **Employer payroll-tax metadata:** a narrowly scoped read-only query found 0 administration payroll-tax-number rows overlapping 2026-09-01–2026-10-31, and 0 primary rows. No number was selected or exposed. Keep `DECLARATION NOT READY`; do not invent a number. This does not block a calculation if the pipeline explicitly treats the declaration gap separately.
- **Employee tax profile:** no accepted tax profile is established by this source readback. Pin supported 2026 tax choices in PAYRUN01's versioned synthetic input; do not infer age/AOW status or tax credit from personal details.

### 2026-10-07 normal-UI CAO change attempt

After the user made the Jupiter Kinderopvang set active and available, the normal employment UI showed `Cao Kinderopvang 2025-2026` in Jan's `CAO aanpassen` selector. The wizard was set to the beginning of the existing contract, 2026-09-01, and submitted with an audit reason. It returned the generic `De wijziging kon niet worden opgeslagen.` message.

The narrowly timed DEV Postgres log readback for 2026-10-07 11:41:44 UTC showed SQLSTATE `P0001` in `apply_employment_timeline_mutation(...)`, `line 39 at RAISE`. The matching repository function's line-39 guard raises `TIMELINE_EFFECTIVE_DATE_CONFLICT` when a `LABOR_CONDITIONS` row already exists at the requested date; Jan already has that row effective 2026-09-01. The UI code maps its `CAO aanpassen` action to `LABOR_CONDITIONS` and sends only the selected set's name as `conditionGroup`; it does not update `employment_contracts.labor_condition_set_id`. A separate database trigger protects that employment-contract CAO reference as immutable.

The failed RPC transaction rolled back. Reloading the employment page still showed the original `Bedrijfseigen regeling`, 32 hours/week, `Monteur`, and primary employment. No Jan source row or employment-change record was written. Do not retry the same date through another timeline route or bypass the database guard. The existing-employment fixture is blocked until an authorized, supported supersession path is available or the user chooses an explicitly different test-employment model.

### 2026-10-07 route-1 supersession continuation

The user chose to preserve Jan's single employment and authorized a supported Jan-only replacement path. Local schema/API/UI code now carries the selected labor-condition set ID, checks tenant/HR-group/administration ownership, derives canonical condition metadata from that set, and defines an explicit replacement RPC pinned to Jan's employment and 2026-09-01 source slice. Its test-only tax profile has explicit provenance and contributes to source-snapshot and projected input hashes.

The Core/DEV migration apply was rejected by automatic review because the migration replaces the global labor-condition trigger. The rejection was not bypassed. The migration remains unapplied and there is no source-row change, post-replacement readback, or Jan calculation. The original one-employment readback remains the last confirmed state. Local verification after the continuation: 43 focused tests pass; strict TypeScript reports only the unrelated existing `TS2366` in `component-library-entry-detail.tsx:76`. PFZW monthly allocation/rounding stays independent of the generic calculation path. Approval or a safer reviewed migration design is still needed before Core/DEV source repair can proceed.

## A. OFFICIAL RULE DATA

| Rule | Supported fact | Source |
| --- | --- | --- |
| Function mapping | Pedagogisch professional maps to salary scale 6 in Appendix 1. | [CAO Kinderopvang 2025–2026, function matrix](https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf) |
| Salary table | Scale 6, salary number 20 is €3,425 full-time monthly from 2026-09-01. The rate is from the dated official table; the selected number is not prescribed as an entry point. | [CAO Appendix 2 salary tables](https://www.kinderopvang-werkt.nl/media/1702), [salary-setting rules](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen) |
| Full-time basis | 36 hours/week; 2026 year-hours are 1,879.2 where the annual-hours system is used. | [CAO Article 4.2](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/aantal-uren) |
| Hourly salary | Annual salary divided by full-time annual hours. For this scale/step, €3,425 × 12 ÷ 1,879.2 = €21.87100894…; the one-hour test amount is €21.87 after final cent rounding. | [CAO glossary](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/begrippenlijst), [CAO Article 4.2](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/aantal-uren) |
| Additional hours | If the annual-hours system is not used, the parties determine whether extra hours are compensated in cash or time. | [CAO Article 4.2](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/aantal-uren) |
| Holiday allowance | 8% of eligible salary earned during 1 June–31 May, paid in May. Full-time minimum from 2026-09-01 is €216.82/month; the selected scale/step's 8% exceeds the pro-rated minimum. | [CAO Article 6.1](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/vakantietoeslag) |
| Year-end allowance | 8% from 2026-01-01, paid in December and based on the year's monthly salaries. | [CAO Article 5.7](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering) |
| PFZW applicability | PFZW's compulsory-workforce definition includes qualifying employers that provide paid childcare or related services. Whether the real Core employer meets that definition is not inferred from an employee's job title. | [PFZW employer coverage](https://www.pfzw.nl/werkgevers/pensioen-bij-ons/klant-worden/moet-of-mag-ik-aansluiten.html) |
| PFZW 2026 rates | OP/NP total 25.9%, €17,283 franchise, €137,800 full-time salary cap; WIA-excess 3.4% above €79,409, uncapped. The 2026 Kinderopvang split is 12.9% employee / 13.0% employer for OP/NP and 0% / 3.4% for WIA-excess. | [PFZW 2026 rates](https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html), [OAK 2026 decision](https://www.kinderopvang-werkt.nl/nieuws/pensioenpremies-2026) |
| PFZW input rounding | DTF for the annual formula is rounded to four decimals (0.8889); the UPA part-time percentage is 88.89%. PFZW UPA hours for scheme include contract hours and extra hours uplifted by the applicable ADV/vacation-days percentage and are rounded to 2 decimals. | [PFZW annual formula and factor](https://www.pfzw.nl/werkgevers/premie-en-factuur/premie-berekenen/hoe-bereken-ik.html), [PFZW 2026 UPA manual](https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf), [PFZW hours FAQ](https://www.pfzw.nl/werkgevers/werkgeversdesk/faqs/verloonde-uren.html) |

**PFZW source gap:** the current 2026 material reviewed supports annual salary, annual formula, rates, participation reporting, and UPA hours. It does not authoritatively establish the exact October 2026 period allocation and cent-rounding sequence for this fixture. It also does not provide a worked new-joiner example that resolves whether the 2026 8% year-end allowance or the prior-31-December 2025 5.5% structural rate belongs in Jan's September 2026 initial annual basis. No monthly pension amount will be asserted until both questions have an authoritative answer. `PAY-RULE-002 = OPEN / SOURCE_GAP`.

## B. PAYRUN01 SYNTHETIC PERSONA CHOICE

| Input | Fixture value | Provenance and boundary |
| --- | --- | --- |
| Persona | Jan TEST, existing Jan employment reference | Reuse the one confirmed TEST employment. Use opaque source IDs only in audit evidence; do not copy BSN, IBAN, or unrelated employee data. |
| Employer/administration | Reuse the existing Jan TEST administration; classify the payroll-owned test presentation as a covered childcare operator for this scenario | TEST-only assumption, not a finding about the real employer. No employer payroll-tax number is created. |
| Effective dates | Employment, function, salary, schedule, and payroll-owned IKV input start 2026-09-01; end at the existing employment end date | Synthetic scenario date. Effective source rows must be read back before calculation. |
| Employment | Existing confirmed employment; definite, written, not on-call | Contract attributes are synthetic fixture inputs unless the normal source UI exposes an effective-dated Core value. Do not infer them from employee data. |
| Income relationship / IKV | Versioned PAYRUN01-owned calculation relationship effective 2026-09-01, linked to the existing opaque employment reference, with explicit provenance and `CONTROL02_CONTRACT_PENDING` / `NO_LINKED_INCOME_RELATIONSHIP` fallback reasons where needed | It is a bounded Payroll calculation reference, not the final shared Core/CONTROL02 or Loonaangifte contract. Existing DRAFT Core IKV is not promoted by assumption. |
| Function and grade | Pedagogisch professional; scale 6; salary number 20 | Function, grade assignment, and selected number are synthetic choices; the function-to-scale mapping and table amount are official. |
| Salary | €3,425.00 full-time monthly; 32/36 = 8/9; exact part-time formula €27,400/9 = €3,044.444…; source/display cents €3,044.44 using one explicit final HALF_UP step | Source salary configuration is CAO route, scale 6 / step 20, effective 2026-09-01 through the employment end. The exact ratio remains in calculation identity; the rounded display value is not reused as an unrounded intermediate. |
| Schedule | 32 hours/week, 36-hour norm, `HOURS_PER_DAY`, Monday–Thursday 8 hours/day, Friday–Sunday 0; no on-call; annual-hours system OFF | Synthetic schedule distribution chosen to fit the already-supported Core schedule type. With the annual-hours system off, the synthetic parties' cash treatment for the October extra hour is explicit. Do not use `FIXED`. |
| Tax | Tax year 2026; WHITE; regular monthly wage; NL resident; `UNDER_AOW`; `STD`; full period; payroll tax credit true; no special situation | Explicit PAYRUN01 choices pinned into the input identity. Age/AOW class is not inferred from date of birth. Limited to the already-supported NL-PAYROLL-2026 table scope. |
| Pension choice | Covered Kinderopvang TEST employment, PFZW participation selected for the synthetic employer; rates and annual inputs above | Synthetic participation choice only. The test does not certify real-world employer coverage or pension compliance. Monthly pension output stays excluded while the source gap remains. |
| Holiday allowance | 8% reserve on eligible salary for each calculated period | Synthetic monthly reserve treatment of the official annual/May payout rule. No actual allowance payment occurs. |
| Year-end allowance | 8% reserve on eligible salary from 2026-01-01 | Synthetic monthly reserve treatment of the official December payout rule. No December payment is created. |
| September | Calculate September 2026 with the same PAYRUN01 source → snapshot → inputs → run → engine → controls → persistence pipeline, starting with zero pre-employment cumulative amounts as of 2026-08-31 | This zero employment-start baseline is not reconstructed payroll history. The persisted September result is the sole October cumulative source. A September PDF is unnecessary. |
| October | Calculate October 2026 after September; one full monthly period | The period is part of source snapshot and input identity. |
| October work event | Create/read back one approved `ADDITIONAL` event for 1.00 hour on 2026-10-15 through the normal Actual Work UI/action; compensate in cash at €21.87/hour | Date, hours, and compensation are synthetic. Retain the actual opaque event ID and approval provenance. Normal contractual work stays represented by the fixed monthly salary and is not paid a second time. |
| Employer costs | Use the versioned TEST-only PAYRUN01 employer-rate profile (AWf high 7.74%, Aof low 6.27%, Wko 0.50%, Whk sector/rate 35 / 1.81%, Zvw 6.10%) | Explicit small-employer/sector/high-AWf assumptions; never represent them as the real employer's rates. PFZW employer amount remains separately excluded while open. |
| Declaration/payment | `DECLARATION NOT READY`; payment not assessed or run | No employer payroll-tax number is invented, and no payment or Loonaangifte action is performed. |

## Expected arithmetic checkpoints before engine comparison

- September monthly contractual salary: €3,425 × 8/9 = €3,044.444…; presentation cents €3,044.44.
- September holiday and year-end reserves, if each reserve rounds HALF_UP at the component boundary: €243.56 each.
- October contractual salary plus one separately classified cash hour: €3,044.44 + €21.87 = €3,066.31, subject to the engine's documented component boundary and independent-oracle confirmation.
- October reserves at the same stated boundary: €245.30 each on €3,066.31.
- These are fixture arithmetic checkpoints, not yet persisted or accepted payroll results. Wage-tax, net pay, employer costs, cumulative values, hashes, traces, controls, and artefacts must come from the pipeline and the independent oracle.

## Planned source mutation and readback ledger

No Jan employment source data or calculation run has been changed by this fixture document. The CAO and salary-structure configuration above is administration-level TEST setup. Before each Jan TEST-only employment change, record only the required source fields and opaque row IDs; then record the planned action, normal UI/action result, readback, invariant, and audit evidence. Preserve unrelated and historical records. Do not use direct SQL or service-role business-row writes.

| Source area | Required invariant after normal UI mutation/readback |
| --- | --- |
| Salary/function | Same employment, effective 2026-09-01, CAO route, function → scale 6, step 20, full-time €3,425, derived part-time €3,044.44. |
| Work pattern | Same employment, 32/36 hours, `HOURS_PER_DAY`, 4×8 hours, no overlapping effective schedule. |
| IKV | At most one applicable calculation relationship for the employment/period; source DRAFT status is not silently treated as final. |
| October work | Exactly one approved additional-hour source event for the fixture, `ADDITIONAL`, 1.00 hour, cash amount €21.87, with normal hours not duplicated. |
| Pension boundary | PFZW applies to the synthetic covered-childcare scenario; until official monthly cent allocation and new-joiner annual-basis treatment are proven, no pension amount is asserted and net/tax outputs are explicitly marked as a non-pension functional test projection. |
| Payroll-owned config | Versioned function/salary/tax/pension/reserve/work choices, explicit provenance, deterministic hash, effective dates, and period included in input identity. |
| Downstream state | Declaration not ready; payment not executed; no Loonaangifte submitted. |

## Acceptance boundary

The intended claim is one bounded Kinderopvang TEST composition through the same generic PAYRUN01 pipeline as Lisa. It does not certify general Dutch payroll, the full Kinderopvang CAO, PFZW monthly cent compliance, multi-IKV processing, payment, or Loonaangifte. If the non-pension calculation completes while the PFZW source gap stays open, report `CALCULATION FUNCTIONALLY GREEN / PFZW COMPLIANCE GATE OPEN`, keep the result's pension components clearly excluded, and keep the overall Jan verdict `PARTIAL`.
