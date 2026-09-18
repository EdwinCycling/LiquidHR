export function getProcessWorkItemHref(domain: string | null | undefined, workItemId: string): string {
  switch (domain) {
    case 'LEAVE':
      return `/leave/requests/${workItemId}`
    case 'ACTUAL_WORK':
      return `/actual-work/workflows/${workItemId}`
    case 'P_MUTATION':
    case 'OTHER':
    default:
      return `/work/${workItemId}`
  }
}
