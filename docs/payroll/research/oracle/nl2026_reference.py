"""Onafhankelijke audit-oracle; geen productie-imports of runtimegebruik.

Bron: Belastingdienst januari 2026 versie 2, par. 2.2.1-2.2.5;
parameterbijlage p.4 Nederland, wit, Std, jonger dan AOW.
Gebruik: python docs/payroll/research/oracle/nl2026_reference.py
"""
from decimal import Decimal as D, ROUND_FLOOR, ROUND_CEILING, ROUND_HALF_UP
import json

def floor(x): return x.quantize(D('1'), rounding=ROUND_FLOOR)
def ceil(x): return x.quantize(D('1'), rounding=ROUND_CEILING)
def q5(x): return x.quantize(D('.00001'), rounding=ROUND_HALF_UP)
def money(x): return format(x.quantize(D('.01'), rounding=ROUND_HALF_UP), '.2f')

def reference(tvl, lhk=True):
    tvl = D(tvl)
    if tvl < 0 or tvl * 12 > 133110:
        raise ValueError('Reference uitsluitend niet-negatief binnen Lmax')
    L = floor(tvl * 12 / 54) * 54
    a,b,c = ((D(0),D('.3575'),D(0)) if L <= 38883 else
             (D(38883),D('.3756'),D(13900)) if L <= 78426 else
             (D(78426),D('.495'),D(28752)))
    X1 = max(D(0), floor((L-a)*b+c))
    AHK = (D(3115) if L <= 29736 else
           max(D(0),ceil(D(3115)-(L-29736)*D('.06398'))) if L < 78426 else D(0))
    ark1 = min(D(996), q5(L*D('.08324')))
    ark2 = min(D(5300), ark1 + q5(max(D(0),L-11965)*D('.31009')))
    ark3 = min(D(5685), ark2 + q5(max(D(0),L-25845)*D('.01950')))
    ARK = (max(D(0),ceil(ark3-q5(max(D(0),L-45592)*D('.06510'))))
           if L < 132920 else D(0))
    if not lhk: AHK, ARK = D(0),D(0)
    # Bij te hoge theoretische kortingen: afbouwen ARK voor AHK (AOK/OUK n.v.t.).
    excess = max(D(0),AHK+ARK-X1)
    theoretical_ark = ARK
    ARK = max(D(0),ARK-excess)
    AHK = min(AHK,X1-ARK)
    X = max(D(0), X1-AHK-ARK)
    return dict(taxableMonthlyWage=money(tvl), payrollTaxCredit=lhk,
                annualizedWage=str(tvl*12), tableAnnualWage=str(L),
                annualTaxBeforeCredits=str(X1), annualGeneralCredit=str(AHK),
                annualTheoreticalLabourCredit=str(theoretical_ark), annualLabourCredit=str(ARK),
                annualTaxAfterCredits=str(X), wageTax=money(X/12),
                labourCredit=money(ARK/12), netPay=money(tvl-D(money(X/12))))

CASES = [
    ('LOW', '500.00', True), ('LOW_TAX_POSITIVE','1000.00',True),
    ('MID','3000.00',True), ('CC-NL-2026-001','4000.00',True),
    ('HIGH','9000.00',True),
    ('AHK_BOUNDARY_BELOW','2477.99',True), ('AHK_BOUNDARY_EQUAL','2478.00',True),
    ('AHK_BOUNDARY_ABOVE','2478.01',True),
    ('TABLE_STEP_BELOW','4000.49',True), ('TABLE_STEP_EQUAL','4000.50',True),
    ('TABLE_STEP_ABOVE','4000.51',True), ('NO_LHK','4000.00',False),
    ('SECOND_BRACKET_BOUNDARY_BELOW','6535.49',True),
    ('SECOND_BRACKET_BOUNDARY_EQUAL','6535.50',True),
    ('SECOND_BRACKET_BOUNDARY_ABOVE','6535.51',True),
    ('SECOND_BRACKET_STEP_BELOW','6538.49',True),
    ('SECOND_BRACKET_STEP_EQUAL','6538.50',True),
    ('SECOND_BRACKET_STEP_ABOVE','6538.51',True),
    ('AHK_STEP_BELOW','2479.49',True), ('AHK_STEP_EQUAL','2479.50',True),
    ('AHK_STEP_ABOVE','2479.51',True),
]

# Rechtstreeks gelezen gepubliceerde maandtabelkolommen; onafhankelijk van formules.
# Key: werkelijk tabelloon; values: zonder LHK, met LHK, verrekende ARK, PDFpagina.
TABLE_ANCHORS = {
    '499.50': ('178.50','0.00','0.00',3),
    '999.00': ('357.08','13.83','83.67',6),
    '2475.00': ('884.75','177.17','448.00',15),
    '2479.50': ('886.42','178.83','448.08',15),
    '2997.00': ('1071.42','386.83','458.17',18),
    '3996.00': ('1442.17','818.67','461.00',24),
    '4000.50': ('1443.83','820.92','460.67',25),
    '6534.00': ('2395.42','2099.58','295.75',40),
    '6538.50': ('2397.42','2101.92','295.50',40),
    '9000.00': ('3615.92','3480.67','135.25',55),
}

def verified_cases():
    rows = []
    for code,wage,lhk in CASES:
        result = reference(wage,lhk)
        table_wage = money(D(result['tableAnnualWage'])/12)
        no_lhk,with_lhk,ark,page = TABLE_ANCHORS[table_wage]
        assert result['wageTax'] == (with_lhk if lhk else no_lhk), code
        assert result['labourCredit'] == (ark if lhk else '0.00'), code
        rows.append(dict(id=code, **result, officialTableMonthlyWage=table_wage,
                         officialTablePage=page, oracle='Python Decimal + independently transcribed official table'))
    return rows

if __name__ == '__main__':
    print(json.dumps(verified_cases(), indent=2))
