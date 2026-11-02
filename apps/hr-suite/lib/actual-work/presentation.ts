const internalProvenancePattern = /\b(?:PAYRUN\d+|TEST|LAB|synthetic|synthetisch|fixture|demo|oefen|proef)\b/i

/** Keep internal test provenance in the immutable ledger, not in the employee-facing note column. */
export function presentActualWorkText(
  value: string | null | undefined,
  fallback: string,
  internalProvenanceLabel: string,
): string {
  const text = value?.trim()
  if (!text) return fallback
  return internalProvenancePattern.test(text) ? internalProvenanceLabel : text
}
