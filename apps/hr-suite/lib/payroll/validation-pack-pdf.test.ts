import { describe, expect, it } from 'vitest'
import type { CaoBench02ValidationPack } from './validation-pack'
import { renderCaoBench02ValidationPackHtml, renderCaoBench02ValidationPackPdf } from './validation-pack-pdf'

const pack: CaoBench02ValidationPack = {
  schemaVersion: 'liquidhr.payroll-validation-pack.v1',
  notice: 'TEST — CONCEPTBEREKENING — NIET VOOR LOONBETALING',
  case: {
    caseKey: 'CAO-BENCH02-K1',
    period: { year: 2026, month: 8 },
    arrangementName: 'Cao Kinderopvang 2025-2026',
    arrangementVersion: '2026.07',
  },
  run: {
    runId: '44444444-4444-4444-8444-444444444444',
    status: 'SUCCEEDED',
    runType: 'GOLDEN_CASE',
    createdAt: '2026-10-03T09:00:00.000Z',
    startedAt: '2026-10-03T09:00:00.000Z',
    finishedAt: '2026-10-03T09:00:01.000Z',
  },
  limitations: {
    calculationScope: 'GROSS_ONLY_CONCEPT',
    payrollPayment: 'NOT_SUPPORTED',
    wageTax: 'NOT_CALCULATED',
    employeeDeductions: 'NOT_CALCULATED',
    netPay: 'NOT_CALCULATED',
    employerCosts: 'NOT_CALCULATED',
  },
  source: {
    sourceSnapshotId: '11111111-1111-4111-8111-111111111111',
    sourceHash: 'a'.repeat(64),
    sourceVersionVector: {
      'fixture:CAO-BENCH02-KINDEROPVANG': 'CAO-BENCH02-KINDEROPVANG:v1',
      'package:KINDEROPVANG_2025_2026': '2026.07:1111111111111111111111111111111111111111111111111111111111111111',
    },
    sourcePayload: { scenario: { caseKey: 'CAO-BENCH02-K1' } },
  },
  input: {
    inputSetId: '22222222-2222-4222-8222-222222222222',
    inputHash: 'b'.repeat(64),
    rulePackageCompositionId: 'KINDEROPVANG_2025_2026:2026.07',
    engineVersion: 'payroll-engine-test',
    values: { salaryScale: '6', salaryNumber: '12' },
  },
  provenance: {
    packageId: 'CAO-KINDEROPVANG-2025-2026',
    packageVersion: '2026.07',
    packageHash: 'd'.repeat(64),
    rulePackageCompositionId: 'KINDEROPVANG_2025_2026:2026.07',
    rules: [{ ruleKey: 'kinderopvang.gross', ruleVersion: '2026.01', implementationHash: 'e'.repeat(64), parameterSetHash: 'f'.repeat(64), packageId: 'CAO-KINDEROPVANG-2025-2026', packageVersion: '2026.01' }],
    sourceReferences: {
      salaryTableUrl: 'https://example.test/table.pdf',
      note: '<script>no execution</script>',
    },
    scopeNotice: 'Only Mode C/1 and I/15 are supported; gross excludes the 8% vacation allowance (vakantietoeslag).',
  },
  result: {
    resultHash: 'c'.repeat(64),
    components: [
      { key: 'base_salary', amount: '2777.00', payload: { key: 'base_salary', amount: '2777.00' } },
      { key: 'gross_salary', amount: '2777.00', payload: { key: 'gross_salary', amount: '2777.00' } },
    ],
    trace: { steps: ['</pre><script>trace</script>'] },
    controls: [{ key: 'gross_only', status: 'PASS', details: { passed: true } }],
  },
}

describe('CAO-BENCH02 validation-pack PDF document', () => {
  it('renders the concept slip, unsupported payroll amounts, and the complete JSON appendix', () => {
    const html = renderCaoBench02ValidationPackHtml(pack)

    expect(html).toContain('TEST — CONCEPTBEREKENING — NIET VOOR LOONBETALING')
    expect(html).toContain('Berekende bruto-componenten')
    expect(html).toMatch(/€.{0,2}2\.777,00/)
    expect(html).toContain('Nettoloon: NIET BEREKEND')
    expect(html).toContain('Werknemersinhoudingen: NIET BEREKEND')
    expect(html).toContain('Werkgeverskosten: NIET BEREKEND')
    expect(html).toContain('Begrenzing Retail-berekening')
    expect(html).toContain('gross excludes the 8% vacation allowance (vakantietoeslag)')
    expect(html).toContain('Volledig gestructureerd validatiepakket')
    expect(html).toContain('&quot;schemaVersion&quot;: &quot;liquidhr.payroll-validation-pack.v1&quot;')
    expect(html).toContain('&quot;runId&quot;: &quot;44444444-4444-4444-8444-444444444444&quot;')
    expect(html).toContain('https://example.test/table.pdf')
    expect(html).toContain('trace')
  })

  it('shows cent-rounded K2 lines and total while retaining exact decimals in the JSON appendix', () => {
    const k2Pack: CaoBench02ValidationPack = {
      ...pack,
      case: { ...pack.case, caseKey: 'CAO-BENCH02-K2', period: { year: 2026, month: 8 } },
      result: {
        ...pack.result,
        components: [
          { key: 'base_salary', amount: '1879.333333333333333333', payload: { key: 'base_salary', amount: '1879.333333333333333333' } },
          { key: 'work_hour_supplement', amount: '32.402298850574712643', payload: { key: 'work_hour_supplement', amount: '32.402298850574712643' } },
          { key: 'gross_salary', amount: '1911.735632183908045976', payload: { key: 'gross_salary', amount: '1911.735632183908045976' } },
        ],
      },
    }
    const html = renderCaoBench02ValidationPackHtml(k2Pack)

    expect(html).toMatch(/€.{0,2}1\.879,33/)
    expect(html).toMatch(/€.{0,2}32,40/)
    expect(html).toMatch(/€.{0,2}1\.911,74/)
    expect(html).toContain('afzonderlijk afgerond op eurocenten volgens HALF_UP')
    expect(html).toContain('1911.735632183908045976')
  })

  it('escapes source references and trace strings before embedding them in the document', () => {
    const html = renderCaoBench02ValidationPackHtml(pack)

    expect(html).toContain('&lt;script&gt;no execution&lt;/script&gt;')
    expect(html).toContain('&lt;/pre&gt;&lt;script&gt;trace&lt;/script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('renders valid PDF bytes with the shared Chromium runtime', async () => {
    const bytes = await renderCaoBench02ValidationPackPdf(pack)

    expect(Buffer.from(bytes).subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })
})
