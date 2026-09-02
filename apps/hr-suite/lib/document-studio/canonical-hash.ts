import { createHash } from 'node:crypto'

export function sha256CanonicalJson(canonicalJson: string): string {
  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex')
}
