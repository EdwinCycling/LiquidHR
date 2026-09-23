import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  compactEmployeeAvatar,
  EMPLOYEE_AVATAR_MAX_EDGE,
  EMPLOYEE_AVATAR_MAX_INPUT_BYTES,
  EMPLOYEE_AVATAR_MAX_OUTPUT_BYTES,
} from './avatar-image'

function filePart(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function makeImage(format: 'jpeg' | 'png' | 'webp', width = 32, height = 24): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 40, g: 80, b: 120 } } })
  if (format === 'jpeg') return image.jpeg().toBuffer()
  if (format === 'png') return image.png().toBuffer()
  return image.webp().toBuffer()
}

function makeFtypImage(brand: 'avif' | 'heic'): Uint8Array {
  return Uint8Array.from(Buffer.concat([
    Buffer.from([0, 0, 0, 20]),
    Buffer.from('ftyp'),
    Buffer.from(brand),
    Buffer.from([0, 0, 0, 0]),
  ]))
}

describe('medewerkerfoto comprimeren', () => {
  it.each([
    ['JPEG', 'jpeg', 'image/jpeg'],
    ['PNG', 'png', 'image/png'],
    ['WebP', 'webp', 'image/webp'],
  ] as const)('verwerkt een geldige %s-avatar naar compacte WebP', async (_label, format, mime) => {
    const input = await makeImage(format)
    const result = await compactEmployeeAvatar(new File([filePart(input)], `avatar.${format}`, { type: mime }))
    const metadata = await sharp(result).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBeLessThanOrEqual(EMPLOYEE_AVATAR_MAX_EDGE)
    expect(metadata.height).toBeLessThanOrEqual(EMPLOYEE_AVATAR_MAX_EDGE)
    expect(result.byteLength).toBeLessThanOrEqual(EMPLOYEE_AVATAR_MAX_OUTPUT_BYTES)
  })

  it('past een zeer grote afbeelding terug naar de bestaande maximale afmeting', async () => {
    const input = await makeImage('jpeg', EMPLOYEE_AVATAR_MAX_EDGE + 100, EMPLOYEE_AVATAR_MAX_EDGE + 50)
    const result = await compactEmployeeAvatar(new File([filePart(input)], 'avatar.jpg', { type: 'image/jpeg' }))
    const metadata = await sharp(result).metadata()

    expect(metadata.width).toBeLessThanOrEqual(EMPLOYEE_AVATAR_MAX_EDGE)
    expect(metadata.height).toBeLessThanOrEqual(EMPLOYEE_AVATAR_MAX_EDGE)
  })

  it.each([
    ['AVIF', makeFtypImage('avif')],
    ['HEIF', makeFtypImage('heic')],
  ])('weigert %s-inhoud ook als de upload een toegestaan MIME-type claimt', async (_label, bytes) => {
    await expect(compactEmployeeAvatar(new File([filePart(bytes)], 'avatar.jpg', { type: 'image/jpeg' }))).rejects.toMatchObject({
      code: 'EMPLOYEE_AVATAR_INPUT_INVALID',
      status: 400,
    })
  })

  it('weigert een ongeldige bestandshandtekening veilig', async () => {
    await expect(compactEmployeeAvatar(new File(['not an image'], 'avatar.jpg', { type: 'image/jpeg' }))).rejects.toMatchObject({
      code: 'EMPLOYEE_AVATAR_INPUT_INVALID',
      status: 400,
    })
  })

  it('weigert een upload boven de bestaande invoergrootte', async () => {
    const oversized = new Uint8Array(EMPLOYEE_AVATAR_MAX_INPUT_BYTES + 1)
    await expect(compactEmployeeAvatar(new File([oversized], 'avatar.jpg', { type: 'image/jpeg' }))).rejects.toMatchObject({
      code: 'EMPLOYEE_AVATAR_INPUT_INVALID',
      status: 400,
    })
  })
})
