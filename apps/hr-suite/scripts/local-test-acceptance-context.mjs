export function compareContexts(actual, expected, strictNullFields = []) {
  const strictNulls = new Set(strictNullFields)
  const fields = Object.entries(expected)
  if (!actual) {
    return fields
      .filter(([key, value]) => value !== null && value !== undefined || strictNulls.has(key))
      .map(([key]) => key)
  }

  return fields
    .filter(([key, value]) => {
      if ((value === null || value === undefined) && !strictNulls.has(key)) return false
      return actual[key] !== value
    })
    .map(([key]) => key)
}

export function safeContextConfiguration(expected) {
  return {
    tenantConfigured: typeof expected?.tenantId === 'string',
    hrGroupConfigured: typeof expected?.hrGroupId === 'string',
  }
}

export function parseAccessibleAdministrationIds(value) {
  if (!Array.isArray(value)) return null
  if (value.some((administration) =>
    administration === null
    || typeof administration !== 'object'
    || Array.isArray(administration)
    || typeof administration.id !== 'string'
    || administration.id.length === 0
    || administration.id !== administration.id.trim())) {
    return null
  }
  return value.map((administration) => administration.id)
}

export function isActiveAdministrationContextConsistent(actual) {
  if (actual === null || typeof actual !== 'object' || !Array.isArray(actual.accessibleAdministrationIds)) return false
  if (actual.accessibleAdministrationIds.some((id) =>
    typeof id !== 'string' || id.length === 0 || id !== id.trim())) return false
  if (actual.administrationId === null) return actual.accessibleAdministrationIds.length === 0
  return typeof actual.administrationId === 'string'
    && actual.administrationId.length > 0
    && actual.administrationId === actual.administrationId.trim()
    && actual.accessibleAdministrationIds.includes(actual.administrationId)
}
