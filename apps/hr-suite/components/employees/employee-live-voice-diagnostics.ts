type DiagnosticValue = string | number | boolean | null

export type EmployeeLiveVoiceDiagnostic = {
  event: string
  [key: string]: DiagnosticValue
}

const diagnosticsEnabled = process.env.NEXT_PUBLIC_AI_LIVE_DIAGNOSTICS === 'true'

export function recordEmployeeLiveVoiceDiagnostic(diagnostic: EmployeeLiveVoiceDiagnostic): void {
  if (!diagnosticsEnabled) return
  console.info(`[AI_LIVE_DIAGNOSTIC] ${JSON.stringify(diagnostic)}`)
}

export function safeVoiceErrorMetadata(error: unknown): { errorName: string; errorMessage?: string } {
  if (error instanceof DOMException) return { errorName: error.name, errorMessage: error.message.slice(0, 200) || undefined }
  if (error instanceof Error) return { errorName: error.name, errorMessage: error.message.slice(0, 200) || undefined }
  return { errorName: 'unknown' }
}
