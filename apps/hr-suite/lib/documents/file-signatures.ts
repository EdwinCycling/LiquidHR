const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46])
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const LEGACY_OFFICE_SIGNATURE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

function startsWith(bytes: Uint8Array, signature: Uint8Array): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}

function startsWithAscii(bytes: Uint8Array, signature: string): boolean {
  if (bytes.length < signature.length) return false
  return Array.from(signature, (character) => character.charCodeAt(0)).every((byte, index) => bytes[index] === byte)
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function hasZipEntry(bytes: Uint8Array, entryName: string): boolean {
  for (let offset = 0; offset + 4 <= bytes.length; offset += 1) {
    const signature = readUint32LittleEndian(bytes, offset)
    const isLocalHeader = signature === 0x04034b50
    const isCentralHeader = signature === 0x02014b50
    if (!isLocalHeader && !isCentralHeader) continue

    const nameOffset = offset + (isLocalHeader ? 30 : 46)
    const nameLengthOffset = offset + (isLocalHeader ? 26 : 28)
    const nameLength = readUint16LittleEndian(bytes, nameLengthOffset)
    if (nameOffset + nameLength > bytes.length || nameLength !== entryName.length) continue
    if (Array.from(entryName, (character) => character.charCodeAt(0)).every((byte, index) => bytes[nameOffset + index] === byte)) return true
  }
  return false
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return startsWith(bytes, PDF_SIGNATURE)
}

export function hasDocxSignature(bytes: Uint8Array): boolean {
  return startsWith(bytes, new Uint8Array([0x50, 0x4b, 0x03, 0x04])) && hasZipEntry(bytes, 'word/document.xml')
}

export function hasXlsxSignature(bytes: Uint8Array): boolean {
  return startsWith(bytes, new Uint8Array([0x50, 0x4b, 0x03, 0x04])) && hasZipEntry(bytes, 'xl/workbook.xml')
}

export function hasLegacyOfficeSignature(bytes: Uint8Array): boolean {
  return startsWith(bytes, LEGACY_OFFICE_SIGNATURE)
}

export function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export function hasPngSignature(bytes: Uint8Array): boolean {
  return startsWith(bytes, PNG_SIGNATURE)
}

export function hasWebpSignature(bytes: Uint8Array): boolean {
  return startsWithAscii(bytes, 'RIFF') && bytes.length >= 12 && startsWithAscii(bytes.slice(8), 'WEBP')
}

export function hasBmpSignature(bytes: Uint8Array): boolean {
  return startsWithAscii(bytes, 'BM')
}

export function hasSafeTextContent(bytes: Uint8Array): boolean {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.includes('\u0000')) return false
    return !/<\s*(?:script|iframe|object|embed|svg|foreignobject|html|body)\b|(?:javascript|vbscript)\s*:/i.test(text)
  } catch {
    return false
  }
}
