export interface WeatherDay {
  date: string
  weatherCode: number
  temperatureMax: number
  temperatureMin: number
  precipitationProbability: number | null
}

function dateValue(date: string): number | null {
  const timestamp = Date.parse(`${date}T12:00:00Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function isWeekendDate(date: string): boolean {
  const timestamp = dateValue(date)
  if (timestamp === null) return false
  const day = new Date(timestamp).getUTCDay()
  return day === 0 || day === 6
}

export function getNextWorkingForecastDay(days: readonly WeatherDay[]): WeatherDay | null {
  const today = days[0]?.date
  if (!today) return null
  const todayTimestamp = dateValue(today)
  if (todayTimestamp === null) return null
  return days.find((day) => {
    const timestamp = dateValue(day.date)
    return timestamp !== null && timestamp > todayTimestamp && !isWeekendDate(day.date)
  }) ?? null
}
