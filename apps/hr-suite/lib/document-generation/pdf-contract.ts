import { createHash } from 'node:crypto'

export const DG1_RENDERER_VERSION = 'dg1-html-css-chromium-a4-work-sans-1'

export function pdfHash(pdf: Uint8Array): string {
  return createHash('sha256').update(pdf).digest('hex')
}
