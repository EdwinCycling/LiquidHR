# PAYRUN01 independent oracle vectors — 2026-10-05

These source-backed vectors are synthetic checks. The oracle code imports no
payroll engine or production rule package. They do not establish a result for a
real employee or close PAYRUN01 readiness gates.

## Lisa — October 2026

The test input is €5,500.00 regular monthly gross, 40 hours/week, a full
October period, no pension deduction or other wage adjustment, and taxable
wage equal to gross. For the tax-table illustration, use Netherlands / Std /
white table and age below AOW. “White table” does not specify whether the
loonheffingskorting applies, so both published alternatives are retained.

The Belastingdienst 2026 instructions use a €54 annual table-wage step for a
monthly time period. `€5,500.00 × 12 = €66,000.00`; flooring to a multiple of
€54 gives annual table wage €65,988.00, or monthly table wage €5,499.00. The
white monthly table's printed page 33 row `5.499,00` gives:

| Loonheffingskorting | Monthly withholding | Published labour-credit column | Wage less withholding |
|---|---:|---:|---:|
| Applied | €1,577.17 | €363.17 | €3,922.83 |
| Not applied | €2,006.67 | Not applied | €3,493.33 |

The last column is only wage less the stated withholding; it does not include
any other employee deductions. Source: [Belastingdienst 2026 calculation
instructions](https://download.belastingdienst.nl/belastingdienst/docs/rekenvoorschriften_voor_geautomatiseerde_loonadministratie_lh991z62fd.pdf)
and [Witte maandtabel 2026, Nederland Std](https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf),
printed p. 33.

## Jan — synthetic CAO vector and limits

This vector follows the active PAYRUN01 TEST choice. The persona's selected
matrix function is “Pedagogisch professional”; the official CAO function
matrix maps that function to scale 6. Salary number 20 is a **synthetic choice**
for this test, not a CAO-prescribed starting number and not a finding about a
real employee. Under CAO Article 5.2, the employer sets the salary number,
subject to a limited minimum based on recent work in the same function for an
employer covered by this CAO.

The official table effective 1 September 2026 lists scale 6, salary number 20
at €3,425 per month for a full-time 36-hour week. Given the synthetic 32/36
contract-hours choice, the exact proration is
`€3,425 × 32 / 36 = €27,400 / 9 = €3,044.444…` per month. PFZW's published
guidance rounds a part-time factor to four decimals, so `32 / 36` becomes
`0.8889` for that PFZW input. The scenario's €3,044.44 is a display-only cent
value; it is not treated here as an authoritative payroll amount.

The official facts are the function-to-scale mapping and the dated salary
table entry, conditional on those selected inputs. Function, salary number,
32-hour contract, and 1 September effective date are synthetic persona
choices; the date coincides with the official table's effective date. The
scale-6 number-14 row (€2,959) is also an official table entry, but it is a
different synthetic salary-number choice and is not the active PAYRUN01
vector.

No October tax withholding, net pay, or PFZW contribution amount is emitted.
The accepted scenario does not settle the cent-level payroll amount and tax
profile (including the tax-credit choice and taxable-wage basis). PFZW's
published guidance supplies annual salary-basis and annual-premium rules, but
the sources used here do not establish the October contribution's period
allocation and amount-rounding rule. Participation and accepted pensionable
salary inputs also remain prerequisites. No amount is inferred from the
scenario's display rounding.

Sources: [CAO Kinderopvang 2025–2026 Appendix 1 — function matrix](https://www.kinderopvang-werkt.nl/media/1706),
printed p. 55; [Appendix 2 — salary tables](https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-04/Bijlage-2-Salarisschalen-Cao-Kinderopvang-2025-2026.pdf),
printed p. 9; [CAO Article 5.2 — salary number on joining](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-bepalen-van-het-salaris-bij-indiensttreding-van-de-medewerker);
[PFZW UPA manual, January 2026 v5](https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf),
pp. 9–10; [PFZW premium calculation guidance](https://www.pfzw.nl/werkgevers/premie-en-factuur/premie-berekenen/hoe-bereken-ik.html).
