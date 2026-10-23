import { describe, expect, it } from 'vitest'
import { getProcessWorkItemHref, parseProcessWorkReturnContext, processWorkReturnHref, withProcessWorkReturnContext } from './work-routing'

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

  it('adds only the known Focus return context to generic process details', () => {
    expect(withProcessWorkReturnContext(`/work/${workItemId}?view=REQUESTS`, 'focus-requests'))
      .toBe(`/work/${workItemId}?view=REQUESTS&returnTo=focus-requests`)
    expect(withProcessWorkReturnContext(`/leave/requests/${workItemId}`, 'focus-requests'))
      .toBe(`/leave/requests/${workItemId}`)
    expect(parseProcessWorkReturnContext('/focus/aanvragen')).toBeUndefined()
    expect(processWorkReturnHref(parseProcessWorkReturnContext('focus-work'))).toBe('/focus/werk')
    expect(processWorkReturnHref(parseProcessWorkReturnContext('https://example.invalid'))).toBeUndefined()
  })
})
