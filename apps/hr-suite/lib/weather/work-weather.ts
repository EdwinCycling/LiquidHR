import 'server-only'

import type { AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { FALLBACK_WEATHER_LOCATION, getWorkWeather, type WorkWeather } from './open-meteo'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function getWorkWeatherForContext(auth: AuthContext, supabase: SupabaseServerClient): Promise<WorkWeather | null> {
  const fallbackWeather = () => getWorkWeather(FALLBACK_WEATHER_LOCATION)
  const hrGroupId = auth.hrGroupId
  if (!hrGroupId) return fallbackWeather()
  const today = new Date().toISOString().slice(0, 10)
  const [companyResult, assignmentResult] = await Promise.all([
    supabase.from('administration_company_data').select('city, country_code').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).maybeSingle(),
    auth.employeeId
      ? supabase.from('employee_organizations').select('location_id').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('employee_id', auth.employeeId).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(25)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (companyResult.error || assignmentResult.error) return fallbackWeather()

  const currentAssignment = assignmentResult.data?.[0]
  const locationId = currentAssignment?.location_id ?? null
  const locationResult = locationId
    ? await supabase.from('administration_locations').select('id, name, city, country_code').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', locationId).eq('is_active', true).maybeSingle()
    : { data: null, error: null }
  if (locationResult.error) return fallbackWeather()

  const location = locationResult.data
  const city = location?.city ?? companyResult.data?.city ?? null
  const countryCode = location?.country_code ?? companyResult.data?.country_code ?? 'NL'
  if (!city) return fallbackWeather()
  return getWorkWeather({
    name: location?.name ?? city,
    city,
    countryCode,
    latitude: 0,
    longitude: 0,
  })
}

export async function getPrivateWeatherForEmployee(auth: AuthContext, employeeId: string, supabase: SupabaseServerClient): Promise<WorkWeather | null> {
  if (!auth.employeeId || auth.employeeId !== employeeId) return null
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase.from('employee_addresses')
    .select('city, country_code')
    .eq('tenant_id', auth.tenantId)
    .eq('employee_id', employeeId)
    .eq('address_type', 'PRIMARY')
    .lte('valid_from', today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .is('deleted_at', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data?.city) return null
  return getWorkWeather({ name: data.city, city: data.city, countryCode: data.country_code, latitude: 0, longitude: 0 })
}
