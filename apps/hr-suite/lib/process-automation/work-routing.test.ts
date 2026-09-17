import { describe, expect, it } from 'vitest'
import { getProcessWorkItemHref } from './work-routing'

describe('getProcessWorkItemHref', () => {
  const workItemId = '00000000-0000-4000-8000-000000000001'

  it.each([
    ['P_MUTATION', `/work/${workItemId}`],
    ['LEAVE', `/leave/requests/${workItemId}`],
    ['ACTUAL_WORK', `/actual-work/workflows/${workItemId}`],
  ])('verwijst %s naar de domeinroute met het werkitem-ID', (domain, expectedHref) => {
    expect(getProcessWorkItemHref(domain, workItemId)).toBe(expectedHref)
  })

  it.each(['OTHER', 'UNKNOWN_DOMAIN', '', null, undefined])(
    'valt voor domein %s terug op de generieke werkroute',
    (domain) => {
      expect(getProcessWorkItemHref(domain, workItemId)).toBe(`/work/${workItemId}`)
    },
  )
})
