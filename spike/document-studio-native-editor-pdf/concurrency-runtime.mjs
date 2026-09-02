import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const args = new Map();
for (let index = 0; index < process.argv.length; index += 1) {
  if (process.argv[index] === '--deps') args.set('deps', path.resolve(process.argv[++index]));
  if (process.argv[index] === '--url') args.set('url', process.argv[++index]);
  if (process.argv[index] === '--out') args.set('out', path.resolve(process.argv[++index]));
}
const depsRoot = args.get('deps');
const baseUrl = args.get('url');
const outputPath = args.get('out');
if (!depsRoot || !baseUrl || !outputPath) throw new Error('Usage: node concurrency-runtime.mjs --deps <temp-deps> --url <closure-url> --out <evidence-json>');

const { chromium } = require(require.resolve('playwright', { paths: [depsRoot] }));
const outputDir = path.dirname(outputPath);

async function renderOne(run, index) {
  const started = performance.now();
  const browser = await chromium.launch({ headless: true });
  let result;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}&render=${run}-${index}`, { waitUntil: 'networkidle' });
    const pageCount = await page.locator('[data-page-count]').first().textContent();
    const pageSize = await page.locator('.pdf-page').first().evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    const output = path.join(outputDir, `concurrency-r${run}-${index}.pdf`);
    await page.pdf({ path: output, format: 'A4', preferCSSPageSize: true, printBackground: true, margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' } });
    const stat = await fs.stat(output);
    await page.close();
    result = { run, index, ok: stat.size > 0, bytes: stat.size, pageCount, pageSize, durationMs: Number((performance.now() - started).toFixed(1)) };
  } finally {
    await browser.close();
  }
  result.browserDisconnectedAfterClose = !browser.isConnected();
  return result;
}

const before = process.memoryUsage().rss;
const results = [];
for (const run of [1, 2, 4]) {
  const batch = await Promise.all(Array.from({ length: run }, (_, index) => renderOne(run, index + 1)));
  results.push(...batch);
}
const after = process.memoryUsage().rss;
if (results.length !== 7 || results.some((result) => !result.ok)) throw new Error('one or more concurrency renders failed');
const result = {
  runtime: 'Playwright Chromium page.pdf against the closure-table HTML',
  browser: 'Chromium headless',
  printOptions: { format: 'A4', preferCSSPageSize: true, printBackground: true, zeroMargins: true },
  requestedConcurrency: [1, 2, 4],
  renders: results,
  totalRenders: results.length,
  maxDurationMs: Math.max(...results.map((item) => item.durationMs)),
  rssBeforeBytes: before,
  rssAfterBytes: after,
  rssDeltaBytes: after - before,
  browserCleanup: 'Every owned browser is closed in finally; no persistent browser session is retained.',
  status: 'GREEN',
  evidenceLimit: 'This is a local Chromium concurrency smoke; Vercel production cold-start, plan quota and deployment provenance remain DM-1 gates.'
};
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
