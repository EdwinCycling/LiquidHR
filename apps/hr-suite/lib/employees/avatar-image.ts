import sharp from 'sharp'
import { EmployeeServiceError } from './errors'

export const EMPLOYEE_AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024
export const EMPLOYEE_AVATAR_MAX_OUTPUT_BYTES = 750 * 1024
export const EMPLOYEE_AVATAR_MAX_EDGE = 512

type EmployeeAvatarMime = 'image/jpeg' | 'image/png' | 'image/webp'

const SHARP_FORMATS: Readonly<Record<EmployeeAvatarMime, string>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
}

sharp.block({ operation: ['VipsForeignLoadHeif'] })

function detectEmployeeAvatarMime(bytes: Uint8Array): EmployeeAvatarMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

export async function compactEmployeeAvatar(file: File): Promise<Buffer> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > EMPLOYEE_AVATAR_MAX_INPUT_BYTES) {
    throw new EmployeeServiceError('EMPLOYEE_AVATAR_INPUT_INVALID', 400)
  }

  try {
    const input = Buffer.from(await file.arrayBuffer())
    const detectedMime = detectEmployeeAvatarMime(input)
    if (!detectedMime || detectedMime !== file.type) {
      throw new EmployeeServiceError('EMPLOYEE_AVATAR_INPUT_INVALID', 400)
    }

    const inputMetadata = await sharp(input, { failOn: 'error' }).metadata()
    if (inputMetadata.format !== SHARP_FORMATS[detectedMime]) {
      throw new EmployeeServiceError('EMPLOYEE_AVATAR_INPUT_INVALID', 400)
    }

    let quality = 82
    let output = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize(EMPLOYEE_AVATAR_MAX_EDGE, EMPLOYEE_AVATAR_MAX_EDGE, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer()

    while (output.length > EMPLOYEE_AVATAR_MAX_OUTPUT_BYTES && quality > 50) {
      quality -= 8
      output = await sharp(input, { failOn: 'error' })
        .rotate()
        .resize(EMPLOYEE_AVATAR_MAX_EDGE, EMPLOYEE_AVATAR_MAX_EDGE, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer()
    }

    if (output.length > EMPLOYEE_AVATAR_MAX_OUTPUT_BYTES) {
      throw new EmployeeServiceError('EMPLOYEE_AVATAR_COMPACTION_FAILED', 400)
    }

    return output
  } catch (error) {
    if (error instanceof EmployeeServiceError) throw error
    throw new EmployeeServiceError('EMPLOYEE_AVATAR_INPUT_INVALID', 400)
  }
}
