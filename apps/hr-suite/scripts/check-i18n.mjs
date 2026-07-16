import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('messages')

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key
    return typeof child === 'string' ? [next] : flatten(child, next)
  })
}

const nlFiles = (await readdir(path.join(root, 'nl'))).filter((file) => file.endsWith('.json')).sort()
const enFiles = (await readdir(path.join(root, 'en'))).filter((file) => file.endsWith('.json')).sort()

if (JSON.stringify(nlFiles) !== JSON.stringify(enFiles)) {
  throw new Error('I18N_NAMESPACE_MISMATCH')
}

for (const file of nlFiles) {
  const [nl, en] = await Promise.all([
    readFile(path.join(root, 'nl', file), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'en', file), 'utf8').then(JSON.parse),
  ])
  const nlKeys = flatten(nl).sort()
  const enKeys = flatten(en).sort()
  if (JSON.stringify(nlKeys) !== JSON.stringify(enKeys)) {
    throw new Error(`I18N_KEY_MISMATCH:${file}`)
  }
}

console.log(`i18n in orde: ${nlFiles.length} namespaces met gelijke NL/EN-sleutels.`)
