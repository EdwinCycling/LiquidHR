import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EMPLOYEE_LIST_PREFERENCES,
  employeeListHref,
  parseEmployeeListPreferencesPatch,
  parseEmployeeListPreferences,
} from './employee-list-state'

describe('parseEmployeeListPreferences', () => {
  it('leest opgeslagen lijstinstellingen en valt per ongeldig veld terug op de standaard', () => {
    expect(parseEmployeeListPreferences({
      filterPanelOpen: false,
      status: 'all',
      archive: 'archived',
      sort: 'first-name',
      view: 'compact',
    })).toEqual({
      filterPanelOpen: false,
      status: 'all',
      archive: 'archived',
      sort: 'first-name',
      view: 'compact',
    })

    expect(parseEmployeeListPreferences({ status: 'invalid', archive: 'invalid', sort: 'invalid', view: 'invalid' })).toEqual(
      DEFAULT_EMPLOYEE_LIST_PREFERENCES,
    )
  })
})

describe('employeeListHref', () => {
  it('behoudt alle actieve lijstfilters wanneer alleen de zoekterm wordt gewist', () => {
    expect(employeeListHref({
      search: '',
      status: 'all',
      archive: 'archived',
      sort: 'first-name',
      view: 'compact',
    })).toBe('/employees?status=all&archive=archived&sort=first-name&view=compact')
  })

  it('laat een zoekterm weg uit de opgeslagen voorkeuren en URL wanneer die leeg is', () => {
    expect(employeeListHref({
      search: '  ',
      status: 'ACTIVE_EMPLOYEE',
      archive: 'active',
      sort: 'last-name',
      view: 'detail',
    })).toBe('/employees')
  })
})

describe('parseEmployeeListPreferencesPatch', () => {
  it('accepteert lijstinstellingen maar nooit de zoekterm', () => {
    expect(parseEmployeeListPreferencesPatch({ status: 'all', view: 'compact' })).toEqual({ status: 'all', view: 'compact' })
    expect(parseEmployeeListPreferencesPatch({ search: 'Edwin' })).toBeNull()
  })
})
