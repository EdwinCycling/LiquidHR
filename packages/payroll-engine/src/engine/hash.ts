import { PayrollEngineError } from './decimal'

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/** Stable SHA-256 without Node, browser, or framework imports. */
export function sha256(value: string): string {
  const bytes = encodeUtf8(value)
  if (bytes.length > 64 * 1024 * 1024) {
    throw new PayrollEngineError('HASH_INPUT_TOO_LARGE', 'Hash input exceeds the supported size.')
  }
  const bitLength = BigInt(bytes.length) * BigInt(8)
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  for (let index = 0; index < 8; index += 1) {
    padded[paddedLength - 1 - index] = Number((bitLength >> BigInt(index * 8)) & BigInt(0xff))
  }

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const words = new Uint32Array(64)

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4
      words[index] = (
        (padded[start] ?? 0) << 24
        | (padded[start + 1] ?? 0) << 16
        | (padded[start + 2] ?? 0) << 8
        | (padded[start + 3] ?? 0)
      ) >>> 0
    }
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15] ?? 0
      const y = words[index - 2] ?? 0
      const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3)
      const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10)
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0
    }

    let a = state[0] ?? 0
    let b = state[1] ?? 0
    let c = state[2] ?? 0
    let d = state[3] ?? 0
    let e = state[4] ?? 0
    let f = state[5] ?? 0
    let g = state[6] ?? 0
    let h = state[7] ?? 0

    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 = (h + sigma1 + choice + SHA256_K[index]! + words[index]!) >>> 0
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sigma0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }

    state[0] = (state[0]! + a) >>> 0
    state[1] = (state[1]! + b) >>> 0
    state[2] = (state[2]! + c) >>> 0
    state[3] = (state[3]! + d) >>> 0
    state[4] = (state[4]! + e) >>> 0
    state[5] = (state[5]! + f) >>> 0
    state[6] = (state[6]! + g) >>> 0
    state[7] = (state[7]! + h) >>> 0
  }

  return Array.from(state, (word) => word.toString(16).padStart(8, '0')).join('')
}

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new PayrollEngineError('HASH_VALUE_INVALID', 'Non-finite values cannot be hashed.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new PayrollEngineError('HASH_VALUE_INVALID', 'Only plain records can be hashed.')
    }
    const record = value as Record<string, unknown>
    const entries = Object.keys(record).filter((key) => record[key] !== undefined).sort()
    return `{${entries.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
  }
  throw new PayrollEngineError('HASH_VALUE_INVALID', 'Unsupported value cannot be hashed.')
}

function rotateRight(value: number, count: number): number {
  return (value >>> count | value << (32 - count)) >>> 0
}

function encodeUtf8(value: string): Uint8Array {
  const output: number[] = []
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index)
    if (codePoint === undefined) continue
    if (codePoint > 0xffff) index += 1
    if (codePoint <= 0x7f) output.push(codePoint)
    else if (codePoint <= 0x7ff) {
      output.push(0xc0 | codePoint >>> 6, 0x80 | codePoint & 0x3f)
    } else if (codePoint <= 0xffff) {
      output.push(0xe0 | codePoint >>> 12, 0x80 | codePoint >>> 6 & 0x3f, 0x80 | codePoint & 0x3f)
    } else {
      output.push(
        0xf0 | codePoint >>> 18,
        0x80 | codePoint >>> 12 & 0x3f,
        0x80 | codePoint >>> 6 & 0x3f,
        0x80 | codePoint & 0x3f,
      )
    }
  }
  return new Uint8Array(output)
}
