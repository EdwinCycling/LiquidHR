import 'server-only'
import type { WeatherDay } from './forecast'

export type { WeatherDay } from './forecast'

export interface WeatherLocation {
  name: string
  city: string | null
  countryCode: string
  latitude: number
  longitude: number
}

export const FALLBACK_WEATHER_LOCATION: WeatherLocation = {
  name: 'Amsterdam',
  city: 'Amsterdam',
  countryCode: 'NL',
  latitude: 52.3676,
  longitude: 4.9041,
}

export interface WeatherCurrent {
  temperature: number
  temperatureMax: number
  humidity: number
  pressure: number
  pressureTrend: 'up' | 'down' | 'steady'
  windDirection: number
  windSpeed: number
  weatherCode: number
}

export interface WorkWeather {
  location: WeatherLocation
  current: WeatherCurrent
  forecast: WeatherDay[]
}

interface GeocodingResult {
  latitude?: unknown
  longitude?: unknown
  name?: unknown
  country_code?: unknown
}

interface ForecastPayload {
  current?: {
    time?: unknown
    temperature_2m?: unknown
    relative_humidity_2m?: unknown
    pressure_msl?: unknown
    wind_direction_10m?: unknown
    wind_speed_10m?: unknown
    weather_code?: unknown
  }
  hourly?: {
    time?: unknown
    pressure_msl?: unknown
  }
  daily?: {
    time?: unknown
    weather_code?: unknown
    temperature_2m_max?: unknown
    temperature_2m_min?: unknown
    precipitation_probability_max?: unknown
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(4_000),
    next: { revalidate: 900 },
  })
  if (!response.ok) throw new Error(`Open-Meteo status ${response.status}`)
  return response.json()
}

async function geocode(location: WeatherLocation): Promise<WeatherLocation | null> {
  const query = location.city ?? location.name
  if (!query) return null
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', query)
  url.searchParams.set('count', '5')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  if (location.countryCode) url.searchParams.set('countryCode', location.countryCode)
  const payload = await fetchJson(url) as { results?: unknown }
  const results = Array.isArray(payload.results) ? payload.results : []
  const result = results.find((item): item is GeocodingResult => {
    if (!item || typeof item !== 'object') return false
    const record = item as GeocodingResult
    return finiteNumber(record.latitude) !== null && finiteNumber(record.longitude) !== null
  })
  if (!result) return null
  return {
    ...location,
    latitude: finiteNumber(result.latitude) ?? 0,
    longitude: finiteNumber(result.longitude) ?? 0,
    city: stringValue(result.name) ?? location.city,
  }
}

function arrayNumber(values: unknown, index: number): number | null {
  return Array.isArray(values) ? finiteNumber(values[index]) : null
}

function pressureTrend(currentPressure: number, hourly: ForecastPayload['hourly'], currentTime: string): WeatherCurrent['pressureTrend'] {
  const times = Array.isArray(hourly?.time) ? hourly.time.filter((value): value is string => typeof value === 'string') : []
  const pressures = Array.isArray(hourly?.pressure_msl) ? hourly.pressure_msl : []
  const currentIndex = times.indexOf(currentTime)
  const currentTimestamp = Date.parse(currentTime)
  const nearestIndex = currentIndex >= 0 || !Number.isFinite(currentTimestamp)
    ? currentIndex
    : times.reduce((bestIndex, time, index) => Math.abs(Date.parse(time) - currentTimestamp) < Math.abs(Date.parse(times[bestIndex]) - currentTimestamp) ? index : bestIndex, 0)
  const index = nearestIndex >= 0 ? nearestIndex : times.length - 1
  const previousPressure = arrayNumber(pressures, Math.max(0, index - 3))
  if (previousPressure === null) return 'steady'
  if (currentPressure - previousPressure >= 0.7) return 'up'
  if (previousPressure - currentPressure >= 0.7) return 'down'
  return 'steady'
}

export async function getWorkWeather(location: WeatherLocation): Promise<WorkWeather | null> {
  try {
    const resolved = location.latitude !== 0 || location.longitude !== 0 ? location : await geocode(location)
    const weatherLocation = resolved ?? FALLBACK_WEATHER_LOCATION
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(weatherLocation.latitude))
    url.searchParams.set('longitude', String(weatherLocation.longitude))
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,pressure_msl,wind_direction_10m,wind_speed_10m,weather_code')
    url.searchParams.set('hourly', 'pressure_msl')
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
    url.searchParams.set('forecast_days', '7')
    url.searchParams.set('past_hours', '6')
    url.searchParams.set('forecast_hours', '1')
    url.searchParams.set('wind_speed_unit', 'kmh')
    url.searchParams.set('timezone', 'auto')
    const payload = await fetchJson(url) as ForecastPayload
    const current = payload.current
    const currentTime = stringValue(current?.time)
    const temperature = finiteNumber(current?.temperature_2m)
    const dailyTimes: unknown[] = Array.isArray(payload.daily?.time) ? payload.daily.time : []
    const forecast = dailyTimes.flatMap((value: unknown, index): WeatherDay[] => {
      const date = stringValue(value)
      const weatherCode = arrayNumber(payload.daily?.weather_code, index)
      const temperatureMax = arrayNumber(payload.daily?.temperature_2m_max, index)
      const temperatureMin = arrayNumber(payload.daily?.temperature_2m_min, index)
      if (!date || weatherCode === null || temperatureMax === null || temperatureMin === null) return []
      return [{
        date,
        weatherCode,
        temperatureMax,
        temperatureMin,
        precipitationProbability: arrayNumber(payload.daily?.precipitation_probability_max, index),
      }]
    })
    const temperatureMax = Math.max(temperature ?? Number.NEGATIVE_INFINITY, forecast[0]?.temperatureMax ?? Number.NEGATIVE_INFINITY)
    const humidity = finiteNumber(current?.relative_humidity_2m)
    const pressure = finiteNumber(current?.pressure_msl)
    const windDirection = finiteNumber(current?.wind_direction_10m)
    const windSpeed = finiteNumber(current?.wind_speed_10m)
    const weatherCode = finiteNumber(current?.weather_code)
    if (!currentTime || temperature === null || !Number.isFinite(temperatureMax) || humidity === null || pressure === null || windDirection === null || windSpeed === null || weatherCode === null) return null
    return {
      location: weatherLocation,
      current: {
        temperature,
        temperatureMax,
        humidity,
        pressure,
        pressureTrend: pressureTrend(pressure, payload.hourly, currentTime),
        windDirection: ((windDirection % 360) + 360) % 360,
        windSpeed,
        weatherCode,
      },
      forecast,
    }
  } catch {
    return null
  }
}
