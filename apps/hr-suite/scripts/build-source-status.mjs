function matchesVercelIgnorePath(filePath, pattern) {
  const normalizedPath = filePath.replaceAll('\\', '/').replace(/^\.\//, '')
  const normalizedPattern = pattern.trim().replaceAll('\\', '/').replace(/^\.\//, '')

  if (!normalizedPattern || normalizedPattern.startsWith('#') || normalizedPattern.startsWith('!')) return false

  const directoryPattern = normalizedPattern.endsWith('/')
  const rule = directoryPattern ? normalizedPattern.slice(0, -1) : normalizedPattern

  if (rule.startsWith('**/')) {
    const nestedRule = rule.slice(3)
    if (nestedRule.includes('*') || nestedRule.includes('?')) return false

    const segments = normalizedPath.split('/')
    return segments.some((segment, index) => segment === nestedRule && (!directoryPattern || index < segments.length - 1))
  }

  if (rule.includes('*') || rule.includes('?')) return false
  return normalizedPath === rule || (directoryPattern && normalizedPath.startsWith(`${rule}/`))
}

function isExcludedByVercel(filePath, patterns) {
  let excluded = false

  for (const rawPattern of patterns) {
    const pattern = rawPattern.trim()
    if (!pattern || pattern.startsWith('#')) continue

    if (pattern.startsWith('!')) {
      if (matchesVercelIgnorePath(filePath, pattern.slice(1))) excluded = false
      continue
    }

    if (matchesVercelIgnorePath(filePath, pattern)) excluded = true
  }

  return excluded
}

export function unexpectedBuildSourceChanges(statusOutput, vercelIgnorePatterns) {
  return statusOutput
    .split('\0')
    .filter(Boolean)
    .filter((entry) => {
      const status = entry.slice(0, 2)
      const filePath = entry.slice(3)
      return status !== ' D' || !isExcludedByVercel(filePath, vercelIgnorePatterns)
    })
}
