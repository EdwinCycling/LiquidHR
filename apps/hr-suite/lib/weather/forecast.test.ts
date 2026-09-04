import { describe, expect, it } from 'vitest'
import { getNextWorkingForecastDay, isWeekendDate } from './forecast'

const day = (date: string) => ({ date, weatherCode: 1, temperatureMax: 20, temperatureMin: 10, precipitationProbability: null })

describe('weather forecast day selection', () => {
  it('skips Saturday and Sunday when the next working day is Monday', () => {
    expect(isWeekendDate('2026-09-05')).toBe(true)
    expect(isWeekendDate('2026-09-06')).toBe(true)
    expect(getNextWorkingForecastDay(['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'].map(day))).toMatchObject({ date: '2026-09-07' })
  })

  it('selects the next weekday when tomorrow is a weekday', () => {
    expect(getNextWorkingForecastDay(['2026-09-07', '2026-09-08'].map(day))).toMatchObject({ date: '2026-09-08' })
  })
})
