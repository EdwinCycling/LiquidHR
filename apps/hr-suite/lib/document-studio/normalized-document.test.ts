import { describe, expect, it } from 'vitest'
import { emptyCanonicalDocument } from './canonical-document'
import { createNormalizedDocumentV1 } from './normalized-document'

describe('NormalizedDocumentV1 handoff', () => {
  it('contains deterministic placeholder locations and opaque asset references', () => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const document = {
      ...base,
      regions: {
        ...base.regions,
        body: {
          type: 'region' as const,
          content: [{ type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [
            { type: 'knownPlaceholder' as const, attrs: { field: 'employee.first_name' } },
            { type: 'knownPlaceholder' as const, attrs: { field: 'employee.first_name' } },
            { type: 'temporalPlaceholder' as const, attrs: { field: 'employment.start_date', temporal: 'is' as const } },
          ] }],
        },
      },
    }
    const result = createNormalizedDocumentV1({
      templateId: 'template-id', templateVersionId: 'version-id', templateVersion: 2, document,
      composition: [{ kind: 'COVER', templateId: 'cover-template', versionId: 'cover-version', version: 1, sortOrder: 0 }],
      assets: [{ assetRef: 'asset-id', normalizedMime: 'image/png', width: 100, height: 50, storageRef: 'opaque-asset-id' }],
    })
    expect(result.schemaId).toBe('liquid-hr.document-studio.native.v1')
    expect(result.schemaVersion).toBe(1)
    expect(result.placeholderManifest).toEqual([
      { type: 'KNOWN', key: 'employee.first_name', locations: ['/regions/body/content/0/content/0', '/regions/body/content/0/content/1'] },
      { type: 'TEMPORAL', key: 'employment.start_date[is]', locations: ['/regions/body/content/0/content/2'] },
    ])
    expect(result.assets[0]).toMatchObject({ assetRef: 'asset-id', storageRef: 'opaque-asset-id' })
    expect(JSON.stringify(result)).not.toContain('tenant_id')
    expect(JSON.stringify(result)).not.toContain('storage_key')
  })
})
