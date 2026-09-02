import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = new Map();
for (let index = 0; index < process.argv.length; index += 1) {
  if (process.argv[index] === '--deps') args.set('deps', path.resolve(process.argv[++index]));
  if (process.argv[index] === '--out') args.set('out', path.resolve(process.argv[++index]));
}
const depsRoot = args.get('deps');
const outputPath = args.get('out');
if (!depsRoot || !outputPath) throw new Error('Usage: node asset-runtime.mjs --deps <temp-deps> --out <evidence-json>');

const sharp = require(require.resolve('sharp', { paths: [depsRoot] }));
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 4000;
const MAX_PIXELS = 16_000_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function signatureFor(buffer) {
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpeg';
  return null;
}

async function decodeBounded({ name, mime, buffer }) {
  if (!['image/png', 'image/jpeg'].includes(mime)) return { name, accepted: false, reason: 'only PNG and JPEG are allowed; SVG is excluded' };
  if (buffer.length > MAX_INPUT_BYTES) return { name, accepted: false, reason: 'encoded bytes exceed 5 MiB' };
  const signature = signatureFor(buffer);
  if (!signature) return { name, accepted: false, reason: 'PNG/JPEG signature missing or corrupt' };
  if ((mime === 'image/png' && signature !== 'png') || (mime === 'image/jpeg' && signature !== 'jpeg')) {
    return { name, accepted: false, reason: 'declared MIME does not match file signature' };
  }
  try {
    const metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS }).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!['png', 'jpeg'].includes(metadata.format)) return { name, accepted: false, reason: 'decoded format is outside the allowlist' };
    if (width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
      return { name, accepted: false, reason: `dimensions exceed ${MAX_EDGE}px edge or ${MAX_PIXELS} pixels` };
    }
    const normalized = await sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    if (normalized.length > MAX_OUTPUT_BYTES) return { name, accepted: false, reason: 'normalized output exceeds 2 MiB' };
    return { name, accepted: true, format: metadata.format, width, height, inputBytes: buffer.length, normalizedBytes: normalized.length };
  } catch (error) {
    return { name, accepted: false, reason: `decoder rejected input: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const validPng = await sharp({ create: { width: 640, height: 240, channels: 3, background: { r: 31, g: 111, b: 139 } } }).png().toBuffer();
const validJpeg = await sharp({ create: { width: 320, height: 180, channels: 3, background: { r: 105, g: 167, b: 173 } } }).jpeg({ quality: 82 }).toBuffer();
const oversizedDimensions = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: { r: 21, g: 34, b: 56 } } }).png().toBuffer();

const cases = [
  decodeBounded({ name: 'valid-png', mime: 'image/png', buffer: validPng }),
  decodeBounded({ name: 'valid-jpeg', mime: 'image/jpeg', buffer: validJpeg }),
  decodeBounded({ name: 'svg-excluded', mime: 'image/svg+xml', buffer: Buffer.from('<svg><script>bad</script></svg>') }),
  decodeBounded({ name: 'mime-mismatch', mime: 'image/jpeg', buffer: validPng }),
  decodeBounded({ name: 'oversized-dimensions', mime: 'image/png', buffer: oversizedDimensions }),
  decodeBounded({ name: 'corrupt-png', mime: 'image/png', buffer: Buffer.concat([PNG_SIGNATURE, Buffer.from('corrupt')]) }),
  decodeBounded({ name: 'oversized-input', mime: 'image/png', buffer: Buffer.alloc(MAX_INPUT_BYTES + 1) })
];
const results = await Promise.all(cases);
assert(results.filter((result) => result.accepted).length === 2, 'valid PNG/JPEG acceptance count is wrong');
assert(results.every((result) => result.name === 'svg-excluded' ? !result.accepted : true), 'SVG was accepted');
assert(results.every((result) => result.name === 'mime-mismatch' ? !result.accepted : true), 'MIME mismatch was accepted');
assert(results.every((result) => result.name === 'oversized-dimensions' ? !result.accepted : true), 'oversized dimensions were accepted');
assert(results.every((result) => result.name === 'corrupt-png' ? !result.accepted : true), 'corrupt PNG was accepted');
assert(results.every((result) => result.name === 'oversized-input' ? !result.accepted : true), 'oversized input was accepted');

const result = {
  runtime: 'sharp bounded decode/normalize probe',
  package: JSON.parse(await fs.readFile(path.join(depsRoot, 'node_modules', 'sharp', 'package.json'), 'utf8')).version,
  policy: {
    acceptedMime: ['image/png', 'image/jpeg'],
    svg: 'excluded',
    remoteUrls: 'excluded before decode; only server-resolved asset references enter this seam',
    maxInputBytes: MAX_INPUT_BYTES,
    maxEdge: MAX_EDGE,
    maxPixels: MAX_PIXELS,
    maxNormalizedOutputBytes: MAX_OUTPUT_BYTES,
    decodeOptions: ['failOn:error', 'limitInputPixels:16000000', 'rotate', 'resize:inside/withoutEnlargement']
  },
  results,
  status: 'GREEN',
  evidenceLimit: 'The probe covers decoder and resource policy; production object-storage URL resolution and authorization remain outside this local synthetic run.'
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
