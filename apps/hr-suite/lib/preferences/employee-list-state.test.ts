import { describe, expect, it } from 'vitest'
import {
  ACTIVE_FUTURE_EXTERNAL_STATUS,
  DEFAULT_EMPLOYEE_LIST_PREFERENCES,
  employeeListHref,
  employeeListMyTeamHref,
  matchesEmployeeStatus,
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
      view: 'card',
    })).toEqual({
      status: 'all',
      archive: 'archived',
      sort: 'first-name',
      view: 'card',
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

	it('accepteert de fotoweergave als persoonlijke voorkeur', () => {
		expect(parseEmployeeListPreferences({ view: 'photo' })).toEqual({
			...DEFAULT_EMPLOYEE_LIST_PREFERENCES,
			view: 'photo',
		})
	})

	it('accepteert de vierkante fotoweergave als persoonlijke voorkeur', () => {
		expect(parseEmployeeListPreferences({ view: 'photo-only' })).toEqual({
			...DEFAULT_EMPLOYEE_LIST_PREFERENCES,
			view: 'photo-only',
		})
	})

	it('accepteert de fotocollage als persoonlijke voorkeur', () => {
		expect(parseEmployeeListPreferences({ view: 'photo-collage' })).toEqual({
			...DEFAULT_EMPLOYEE_LIST_PREFERENCES,
			view: 'photo-collage',
		})
	})

  it('neemt de kaartweergave mee in de URL-state', () => {
    expect(employeeListHref({
      search: '',
      status: 'ACTIVE_EMPLOYEE',
      archive: 'active',
      sort: 'last-name',
      view: 'card',
    })).toBe('/employees?view=card')
  })

	it('neemt de fotoweergave mee in de URL-state', () => {
		expect(employeeListHref({
      search: '',
      status: 'ACTIVE_EMPLOYEE',
      archive: 'active',
      sort: 'last-name',
      view: 'photo',
		})).toBe('/employees?view=photo')
	})

	it('neemt de vierkante fotoweergave mee in de URL-state', () => {
		expect(employeeListHref({
			search: '',
			status: 'ACTIVE_EMPLOYEE',
			archive: 'active',
			sort: 'last-name',
			view: 'photo-only',
		})).toBe('/employees?view=photo-only')
	})

	it('neemt de fotocollage mee in de URL-state', () => {
		expect(employeeListHref({
			search: '',
			status: 'ACTIVE_EMPLOYEE',
			archive: 'active',
			sort: 'last-name',
			view: 'photo-collage',
		})).toBe('/employees?view=photo-collage')
	})

  it('behoudt de teamscope in de medewerkerslijst', () => {
    expect(employeeListHref({
      search: '',
      status: 'all',
      archive: 'active',
      sort: 'last-name',
      view: 'detail',
      scope: 'team',
    })).toBe('/employees?status=all&scope=team')
  })

  it('maakt een expliciete actieve status mogelijk binnen Mijn team', () => {
    expect(employeeListHref({
      search: '',
      status: 'ACTIVE_EMPLOYEE',
      archive: 'active',
      sort: 'last-name',
      view: 'detail',
      scope: 'team',
    })).toBe('/employees?status=ACTIVE_EMPLOYEE&scope=team')
  })

  it('kan de volledige administratie expliciet terugbrengen', () => {
    expect(employeeListHref({
      search: '',
      status: 'ACTIVE_EMPLOYEE',
      archive: 'active',
      sort: 'last-name',
      view: 'detail',
      scope: 'all',
    })).toBe('/employees?scope=all')
  })

  it('maakt een geforceerde Mijn team-link met actief, toekomstig, extern en niet-gearchiveerd', () => {
    expect(employeeListMyTeamHref()).toBe('/employees?status=active-future-external&scope=team')
  })
})

describe('parseEmployeeListPreferencesPatch', () => {
  it('accepteert lijstinstellingen maar nooit de zoekterm', () => {
    expect(parseEmployeeListPreferencesPatch({ status: 'all', view: 'card' })).toEqual({ status: 'all', view: 'card' })
			expect(parseEmployeeListPreferencesPatch({ view: 'photo' })).toEqual({ view: 'photo' })
		expect(parseEmployeeListPreferencesPatch({ view: 'photo-only' })).toEqual({ view: 'photo-only' })
		expect(parseEmployeeListPreferencesPatch({ view: 'photo-collage' })).toEqual({ view: 'photo-collage' })
    expect(parseEmployeeListPreferencesPatch({ filterPanelOpen: false })).toBeNull()
    expect(parseEmployeeListPreferencesPatch({ search: 'Edwin' })).toBeNull()
  })
})

describe('matchesEmployeeStatus', () => {
  it('neemt in de Mijn team-preset actief, toekomstig en extern mee', () => {
    expect(matchesEmployeeStatus('ACTIVE_EMPLOYEE', ACTIVE_FUTURE_EXTERNAL_STATUS)).toBe(true)
    expect(matchesEmployeeStatus('FUTURE_EMPLOYEE', ACTIVE_FUTURE_EXTERNAL_STATUS)).toBe(true)
    expect(matchesEmployeeStatus('NEVER_EMPLOYED', ACTIVE_FUTURE_EXTERNAL_STATUS)).toBe(true)
    expect(matchesEmployeeStatus('FORMER_EMPLOYEE', ACTIVE_FUTURE_EXTERNAL_STATUS)).toBe(false)
  })
})
