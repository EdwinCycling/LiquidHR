import sharp from 'sharp'
import { createHash } from 'node:crypto'

const MAX_INPUT_BYTES = 5 * 1024 * 1024
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
const MAX_EDGE = 4000
const MAX_PIXELS = 16_000_000

export type StructuralImageMime = 'image/png' | 'image/jpeg'

export interface NormalizedStructuralImage {
  readonly normalizedBytes: Uint8Array
  readonly normalizedMime: StructuralImageMime
  readonly originalFilename: string
  readonly byteSize: number
  readonly width: number
  readonly height: number
  readonly pixelCount: number
  readonly sha256: string
}

export class AssetPolicyError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'AssetPolicyError'
  }
}

function safeFilename(filename: string): string {
  const sanitized = filename.normalize('NFKC').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180)
  if (!sanitized) throw new AssetPolicyError('DOCUMENT_ASSET_FILENAME_INVALID')
  return sanitized
}

function detectMime(bytes: Uint8Array): StructuralImageMime | null {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

function extensionMime(filename: string): StructuralImageMime | null {
  const extension = filename.toLowerCase().split('.').pop()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  return null
}

export async function normalizeStructuralImage(
  input: Uint8Array,
  filename: string,
  claimedMime: string,
): Promise<NormalizedStructuralImage> {
  if (input.byteLength < 1 || input.byteLength > MAX_INPUT_BYTES) throw new AssetPolicyError('DOCUMENT_ASSET_INPUT_TOO_LARGE')
  const cleanFilename = safeFilename(filename)
  const mime = detectMime(input)
  const extension = extensionMime(cleanFilename)
  if (!mime || mime !== extension || mime !== claimedMime) throw new AssetPolicyError('DOCUMENT_ASSET_MIME_MISMATCH')

  const image = sharp(Buffer.from(input), {
    failOn: 'error',
    limitInputPixels: MAX_PIXELS,
    sequentialRead: true,
  }).rotate()
  const metadata = await image.metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const pixelCount = width * height
  if (!width || !height || width > MAX_EDGE || height > MAX_EDGE || pixelCount > MAX_PIXELS) {
    throw new AssetPolicyError('DOCUMENT_ASSET_DIMENSIONS_INVALID')
  }

  const output = mime === 'image/png'
    ? await image.png({ compressionLevel: 9, force: true }).toBuffer()
    : await image.jpeg({ quality: 90, force: true }).toBuffer()
  if (output.byteLength < 1 || output.byteLength > MAX_OUTPUT_BYTES) throw new AssetPolicyError('DOCUMENT_ASSET_OUTPUT_TOO_LARGE')

  return {
    normalizedBytes: new Uint8Array(output),
    normalizedMime: mime,
    originalFilename: cleanFilename,
    byteSize: output.byteLength,
    width,
    height,
    pixelCount,
    sha256: createHash('sha256').update(output).digest('hex'),
  }
}

export const structuralAssetLimits = {
  maxInputBytes: MAX_INPUT_BYTES,
  maxOutputBytes: MAX_OUTPUT_BYTES,
  maxEdge: MAX_EDGE,
  maxPixels: MAX_PIXELS,
} as const
