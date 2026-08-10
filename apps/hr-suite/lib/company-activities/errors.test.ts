import { describe, expect, it } from 'vitest'
import { mapCompanyActivityDatabaseError } from './errors'

describe('company activity database errors', () => {
  it('maps the unique activity constraint to a conflict instead of a generic bad request', () => {
    expect(mapCompanyActivityDatabaseError('duplicate key value violates unique constraint "company_activities_unique_date_name"')).toEqual({
      code: 'COMPANY_ACTIVITY_DUPLICATE',
      status: 409,
    })
  })
})
