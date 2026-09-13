export type ApprovalLabels = {
  yes: string
  no: string
  notConfigured: string
}

export function presentManagerApproval(
  requiresManagerApproval: boolean | null | undefined,
  labels: ApprovalLabels,
): string {
  if (requiresManagerApproval === true) return labels.yes
  if (requiresManagerApproval === false) return labels.no
  return labels.notConfigured
}
