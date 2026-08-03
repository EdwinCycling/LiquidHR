import { readFile } from 'node:fs/promises'

const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => {
  const path = prefix ? `${prefix}.${key}` : key
  return child && typeof child === 'object' && !Array.isArray(child) ? flatten(child, path) : [path]
})

const [nl, en] = await Promise.all([
  readFile(new URL('../messages/nl/control.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../messages/en/control.json', import.meta.url), 'utf8').then(JSON.parse),
])
const nlKeys = flatten(nl).sort()
const enKeys = flatten(en).sort()
if (JSON.stringify(nlKeys) !== JSON.stringify(enKeys)) {
  throw new Error('Nederlandse en Engelse control-plane vertalingen verschillen.')
}
console.log(`i18n OK: ${nlKeys.length} sleutels`)
