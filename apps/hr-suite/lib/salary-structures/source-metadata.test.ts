import { describe, expect, it } from 'vitest'
import { sourceMetadataForDraft } from './source-metadata'

const metadata = {
  title: 'Retail Non-Food salary tables from 1 July 2026',
  version: '2026.07',
  effectiveFrom: '2026-07-01',
  effectiveTo: '2026-12-31',
  url: 'https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf',
  sha256: 'ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc',
  fileName: 'retail-non-food-2026-07.pdf',
  rowCount: 577,
  sourceValidationStatus: 'REFERENCE_ONLY',
  stepRules: [{
    code: 'RETAIL_NONFOOD_REVIEWED_STEP_2_PERCENT',
    percentage: '2.00',
    description: 'Beoordelingsafhankelijke verhoging',
    condition: 'Na een positieve beoordeling kan de trede met 2% stijgen.',
    sourceReference: 'Cao Retail Non-Food 2026, hoofdstuk loonontwikkeling',
    automaticallyApplied: false,
  }],
  stepAdjustments: [{
    scaleCode: 'MODE_I',
    stepCode: 'EXP_01',
    basedOnStepCode: 'EXP_00',
    sourceCell: '2%',
    percentage: '2.00',
    calculatedAmount: '15.30',
    calculationMethod: 'PREVIOUS_RATE_PERCENT_ROUNDED_HALF_UP_TO_CENT',
    sourceRuleCode: 'RETAIL_NONFOOD_REVIEWED_STEP_2_PERCENT',
  }],
}

describe('source metadata for salary revision drafts', () => {
  it('preserves percentage rules and their affected steps when reopening a revision', () => {
    expect(sourceMetadataForDraft(metadata)).toEqual({
      title: metadata.title,
      version: metadata.version,
      effectiveFrom: metadata.effectiveFrom,
      effectiveTo: metadata.effectiveTo,
      url: metadata.url,
      sha256: metadata.sha256,
      fileName: metadata.fileName,
      rowCount: metadata.rowCount,
      stepRules: metadata.stepRules,
      stepAdjustments: metadata.stepAdjustments,
    })
  })

  it('rejects incomplete rule metadata instead of silently dropping it', () => {
    expect(sourceMetadataForDraft({ ...metadata, stepAdjustments: [{ scaleCode: 'MODE_I', stepCode: 'EXP_01' }] })).toBeNull()
  })

  it('preserves published amounts associated with a percentage source rule', () => {
    const publishedAmount = {
      ...metadata,
      stepAdjustments: [{
        scaleCode: 'MODE_F',
        stepCode: 'EXP_10',
        basedOnStepCode: 'EXP_09',
        sourceCell: '2.00%',
        percentage: '2.00',
        calculatedAmount: '20.51',
        calculationMethod: 'SOURCE_TABLE_PUBLISHED_AMOUNT' as const,
        sourceRuleCode: 'RETAIL_NONFOOD_REVIEWED_STEP_2_PERCENT',
      }],
    }

    expect(sourceMetadataForDraft(publishedAmount)?.stepAdjustments).toEqual(publishedAmount.stepAdjustments)
  })
})
