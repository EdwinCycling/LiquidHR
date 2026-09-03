import { describe, expect, it } from 'vitest'
import { canAddComposition, compositionItemsFromRows, compositionRowsForSave } from './composition'

describe('Document Studio composition contract', () => {
  const cover = { kind: 'COVER' as const, versionId: '123e4567-e89b-12d3-a456-426614174000' }
  const appendix = { kind: 'APPENDIX' as const, versionId: '123e4567-e89b-12d3-a456-426614174001' }

  it('preserves an unchanged ordered composition when serializing a save', () => {
    const rows = [{ component_kind: 'COVER' as const, component_template_version_id: cover.versionId, sort_order: 0 }, { component_kind: 'APPENDIX' as const, component_template_version_id: appendix.versionId, sort_order: 1 }]
    expect(compositionRowsForSave(compositionItemsFromRows(rows))).toEqual([
      { kind: 'COVER', versionId: cover.versionId, sortOrder: 0 },
      { kind: 'APPENDIX', versionId: appendix.versionId, sortOrder: 1 },
    ])
  })

  it('rejects a second cover and duplicate component while allowing an appendix', () => {
    expect(canAddComposition([cover], { kind: 'COVER', versionId: appendix.versionId })).toBe(false)
    expect(canAddComposition([appendix], appendix)).toBe(false)
    expect(canAddComposition([cover], appendix)).toBe(true)
  })
})
