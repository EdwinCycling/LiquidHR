export function GET(): Response {
  return Response.json({ error: 'PAYROLL_EXTERNAL_INTEGRATION_DISABLED' }, { status: 410 })
}
