export const runtimePackageMarkers = [
  '/node_modules/@sparticuz/chromium/',
  '/node_modules/playwright-core/',
]

export function normalizeTraceRoute(route) {
  return route.replace(/\/\([^/]+\)(?=\/|$)/g, '').replace(/\/{2,}/g, '/')
}

export function pdfRendererKind(route) {
  const normalized = normalizeTraceRoute(route)
  if (/^\/api\/document-studio\/(?:generation\/[^/]+\/finalize|distributions)$/.test(normalized)) {
    return 'document-studio'
  }
  if (/^\/api\/payroll-lab\/validation-pack$/.test(normalized)) return 'validation-pack'
  if (/^\/payroll-lab\/salarisverwerking$/.test(normalized)
    || /^\/api\/payroll\/runs\/[^/]+\/payslip-preview$/.test(normalized)) {
    return 'payslip'
  }
  return null
}

export function isPdfRuntimeFile(file) {
  const normalized = file.replaceAll('\\', '/').toLowerCase()
  return runtimePackageMarkers.some((marker) => normalized.includes(marker))
}
