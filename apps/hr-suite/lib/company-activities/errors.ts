export function mapCompanyActivityDatabaseError(message: string): { code: string; status: number } {
  if (message.includes('company_activities_unique_date_name') || message.includes('duplicate key')) {
    return { code: 'COMPANY_ACTIVITY_DUPLICATE', status: 409 }
  }
  const code = message.match(/COMPANY_ACTIVITY_[A-Z_]+/)?.[0] ?? 'COMPANY_ACTIVITY_OPERATION_FAILED'
  return { code, status: code.includes('NOT_FOUND') ? 404 : code.includes('FORBIDDEN') ? 403 : 400 }
}
