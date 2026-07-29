import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { compactEmployeeAvatar, EMPLOYEE_AVATAR_MAX_EDGE, EMPLOYEE_AVATAR_MAX_OUTPUT_BYTES } from './avatar-image'

const ONE_PIXEL_PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
))

describe('medewerkerfoto comprimeren', () => {
  it('maakt van een toegestane foto een compacte WebP binnen de afmetingen', async () => {
    const result = await compactEmployeeAvatar(new File([ONE_PIXEL_PNG], 'avatar.png', { type: 'image/png' }))
    const metadata = await sharp(result).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBeLessThanOrEqual(EMPLOYEE_AVATAR_MAX_EDGE)
    expect(metadata.height).toBeLessThanOrEqual(EMPLOYEE_AVATAR_MAX_EDGE)
    expect(result.byteLength).toBeLessThanOrEqual(EMPLOYEE_AVATAR_MAX_OUTPUT_BYTES)
  })

  it('weigert niet-afbeeldingen af', async () => {
    await expect(compactEmployeeAvatar(new File(['not an image'], 'avatar.txt', { type: 'text/plain' }))).rejects.toMatchObject({
      code: 'EMPLOYEE_AVATAR_INPUT_INVALID',
      status: 400,
    })
  })
})
