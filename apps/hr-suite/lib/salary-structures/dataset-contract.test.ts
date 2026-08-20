import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calculateBandMetrics } from './calculations'

interface CanonicalDataset {
  salary_structures: Array<{
    type: 'SCALE_WITH_STEPS' | 'SALARY_BAND'
    revisions: Array<{
      effective_from: string
      status: 'DRAFT' | 'PUBLISHED'
      scales?: Array<{ code: string; steps: Array<{ label: string; amount_monthly_eur: number }> }>
      bands?: Array<{
        sort_order: number
        minimum: number
        midpoint: number
        maximum: number | null
        expected_metrics: {
          range_spread_pct: number | null
          midpoint_progression_pct: number | null
          overlap_pct: number | null
          has_gap: boolean | null
        }
      }>
    }>
  }>
  caos: Array<{ linked_structure_keys: string[] }>
  legacy_employment_salary_regression_cases: Array<{ source_type: string }>
  expected_dataset_assertions: {
    salary_structure_count: number
    scale_with_steps_structure_count: number
    salary_band_structure_count: number
    cao_relation_count: number
    official_rijk_scale_count: number
    official_rijk_step_count: number
    custom_scale_regression_expected_amount: number
  }
}

function loadDataset(): CanonicalDataset {
  const path = resolve(process.cwd(), '../../docs/requirements/salary-structures/testdata/TEST-SALARY-STRUCTURES-DATASET.json')
  return JSON.parse(readFileSync(path, 'utf8')) as CanonicalDataset
}

describe('canonical salary structure dataset', () => {
  it('retains all canonical structures, Rijk scales and Rijk steps', () => {
    const dataset = loadDataset()
    const rijkRevision = dataset.salary_structures
      .find((structure) => structure.revisions.some((revision) => revision.scales?.length === 18))
      ?.revisions.find((revision) => revision.scales?.length === 18)

    expect(dataset.salary_structures).toHaveLength(dataset.expected_dataset_assertions.salary_structure_count)
    expect(rijkRevision?.scales).toHaveLength(dataset.expected_dataset_assertions.official_rijk_scale_count)
    expect(rijkRevision?.scales?.flatMap((scale) => scale.steps)).toHaveLength(dataset.expected_dataset_assertions.official_rijk_step_count)
  })

  it('proves the CUSTOM_SCALE regression amount for schaal 8 trede 5', () => {
    const dataset = loadDataset()
    const step = dataset.salary_structures
      .flatMap((structure) => structure.revisions)
      .flatMap((revision) => revision.scales ?? [])
      .find((scale) => scale.code === '8')
      ?.steps.find((candidate) => candidate.label === '5')

    expect(step?.amount_monthly_eur).toBe(dataset.expected_dataset_assertions.custom_scale_regression_expected_amount)
    expect(step?.amount_monthly_eur).toBe(3741.48)
  })

  it('contains open-top bands and CAOs with zero, one and multiple links', () => {
    const dataset = loadDataset()
    const linkCounts = dataset.caos.map((cao) => cao.linked_structure_keys.length)
    const hasOpenTop = dataset.salary_structures
      .flatMap((structure) => structure.revisions)
      .flatMap((revision) => revision.bands ?? [])
      .some((band) => band.maximum === null)

    expect(hasOpenTop).toBe(true)
    expect(linkCounts).toEqual(expect.arrayContaining([0, 1, 2]))
  })

  it('matches every canonical band metric without changing the fixture', () => {
    const dataset = loadDataset()
    const revisions = dataset.salary_structures.flatMap((structure) => structure.revisions)
    for (const revision of revisions) {
      const bands = [...(revision.bands ?? [])].sort((left, right) => left.sort_order - right.sort_order)
      bands.forEach((band, index) => {
        const previous = bands[index - 1]
        const metrics = calculateBandMetrics(
          { minimum: band.minimum.toFixed(2), midpoint: band.midpoint.toFixed(2), maximum: band.maximum?.toFixed(2) ?? null },
          previous
            ? { minimum: previous.minimum.toFixed(2), midpoint: previous.midpoint.toFixed(2), maximum: previous.maximum?.toFixed(2) ?? null }
            : undefined,
        )
        expect(metrics.rangeSpreadPercentage === null ? null : Number(metrics.rangeSpreadPercentage)).toBe(band.expected_metrics.range_spread_pct)
        expect(metrics.midpointProgressionPercentage === null ? null : Number(metrics.midpointProgressionPercentage)).toBe(band.expected_metrics.midpoint_progression_pct)
        expect(metrics.overlapPercentage === null ? null : Number(metrics.overlapPercentage)).toBe(band.expected_metrics.overlap_pct)
        expect(metrics.hasGap).toBe(band.expected_metrics.has_gap)
      })
    }
  })

  it('covers both structure types, all CAO relations and legacy salary modes', () => {
    const dataset = loadDataset()
    expect(dataset.salary_structures.filter((structure) => structure.type === 'SCALE_WITH_STEPS')).toHaveLength(dataset.expected_dataset_assertions.scale_with_steps_structure_count)
    expect(dataset.salary_structures.filter((structure) => structure.type === 'SALARY_BAND')).toHaveLength(dataset.expected_dataset_assertions.salary_band_structure_count)
    expect(dataset.caos.flatMap((cao) => cao.linked_structure_keys)).toHaveLength(dataset.expected_dataset_assertions.cao_relation_count)
    expect(dataset.legacy_employment_salary_regression_cases.map((item) => item.source_type).sort()).toEqual([
      'CUSTOM_SCALE', 'MANUAL', 'MINIMUM_WAGE', 'NO_PAYROLL',
    ])
  })
})
