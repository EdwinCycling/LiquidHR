import { execFileSync } from 'node:child_process'

const shaPattern = /^[0-9a-f]{40}$/i
const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA || ''
const currentSha = process.env.VERCEL_GIT_COMMIT_SHA || ''

function continueBuild(reason) {
  console.log('Vercel build continues: ' + reason)
  process.exit(1)
}

function skipBuild() {
  console.log('Vercel build skipped: verified docs-only change.')
  process.exit(0)
}

if (!shaPattern.test(previousSha) || !shaPattern.test(currentSha)) {
  continueBuild('Git comparison SHAs are missing or invalid.')
}

try {
  const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
  const changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', '-z', '--no-renames', previousSha, currentSha],
    { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).split('\0').filter(Boolean)

  const docsOnly = changedFiles.length > 0 && changedFiles.every((file) => (
    file === 'AGENTS.md'
    || (/^docs\/(?!_local-incoming(?:\/|$)).+\.mdx?$/i.test(file))
  ))
  if (docsOnly) skipBuild()
  continueBuild('The change set is empty or contains application/build files.')
} catch {
  continueBuild('Git comparison failed; building is the safe default.')
}
