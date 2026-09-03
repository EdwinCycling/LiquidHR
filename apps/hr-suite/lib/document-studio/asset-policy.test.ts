import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { normalizeStructuralImage } from './asset-policy'

describe('Document Studio structural asset policy', () => {
  it('decodes, rotates, normalizes and hashes PNG/JPEG output', async () => {
    const input = await sharp({ create: { width: 12, height: 8, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } }).png().withMetadata({ orientation: 1 }).toBuffer()
    const result = await normalizeStructuralImage(new Uint8Array(input), 'logo.png', 'image/png')
    expect(result.normalizedMime).toBe('image/png')
    expect(result.width).toBe(12)
    expect(result.height).toBe(8)
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.normalizedBytes.byteLength).toBe(result.byteSize)
  })

  it('records dimensions after EXIF orientation is normalized', async () => {
    const input = await sharp({ create: { width: 8, height: 12, channels: 3, background: 'white' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const result = await normalizeStructuralImage(new Uint8Array(input), 'portrait.jpg', 'image/jpeg')
    expect(result.width).toBe(12)
    expect(result.height).toBe(8)
    expect(result.pixelCount).toBe(96)
  })

  it('rejects signature, extension and claimed MIME mismatches', async () => {
    const input = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).jpeg().toBuffer()
    await expect(normalizeStructuralImage(new Uint8Array(input), 'logo.png', 'image/jpeg')).rejects.toMatchObject({ code: 'DOCUMENT_ASSET_MIME_MISMATCH' })
    await expect(normalizeStructuralImage(new Uint8Array(input), 'logo.jpg', 'image/png')).rejects.toMatchObject({ code: 'DOCUMENT_ASSET_MIME_MISMATCH' })
    await expect(normalizeStructuralImage(new Uint8Array([1, 2, 3]), 'x.jpg', 'image/jpeg')).rejects.toMatchObject({ code: 'DOCUMENT_ASSET_MIME_MISMATCH' })
  })
})
