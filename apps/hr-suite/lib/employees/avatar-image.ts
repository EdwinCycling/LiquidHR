import sharp from 'sharp'
import { EmployeeServiceError } from './errors'

export const EMPLOYEE_AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024
export const EMPLOYEE_AVATAR_MAX_OUTPUT_BYTES = 750 * 1024
export const EMPLOYEE_AVATAR_MAX_EDGE = 512

export async function compactEmployeeAvatar(file: File): Promise<Buffer> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > EMPLOYEE_AVATAR_MAX_INPUT_BYTES) {
    throw new EmployeeServiceError('EMPLOYEE_AVATAR_INPUT_INVALID', 400)
  }

  try {
    const input = Buffer.from(await file.arrayBuffer())
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
