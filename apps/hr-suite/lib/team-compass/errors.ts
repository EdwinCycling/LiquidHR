export function teamCompassDatabaseErrorStatus(error: { message: string; code?: string }): number {
  const conflict = error.code === '40001' || error.message.includes('VERSION_CONFLICT') || error.message.includes('LOCKED') || error.message.includes('ALREADY')
  const forbidden = error.code === '42501' || error.message.includes('FORBIDDEN')
  const invalid = error.code === '22023' || error.message.includes('INVALID') || error.message.includes('INCOMPLETE')
  return conflict ? 409 : forbidden ? 403 : invalid ? 400 : 500
}
