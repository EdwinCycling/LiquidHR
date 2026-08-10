'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { DropdownSelect } from '@/components/ui/dropdown-select'

const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const emptySubscribe = () => () => undefined
const getClientHydration = () => true
const getServerHydration = () => false
export type CountryPickerOption = { code: string; name: string }

export function CountryPicker({ value, onChange, locale = 'nl', options, searchLabel, emptyLabel }: { value: string; onChange: (value: string) => void; locale?: string; options?: CountryPickerOption[]; searchLabel: string; emptyLabel: string }) {
  const hydrated = useSyncExternalStore(emptySubscribe, getClientHydration, getServerHydration)
  const countries = useMemo(() => {
    const displayNames = hydrated ? new Intl.DisplayNames([locale], { type: 'region' }) : null
    const source = options?.length ? options : COUNTRY_CODES.map((code) => ({ code, name: code }))
    return source.map((country) => ({ code: country.code, label: displayNames?.of(country.code) ?? country.name })).sort((left, right) => left.code === 'NL' ? -1 : right.code === 'NL' ? 1 : left.label.localeCompare(right.label))
  }, [hydrated, locale, options])
  return <DropdownSelect aria-label={searchLabel} emptyLabel={emptyLabel} onChange={(event) => onChange(event.target.value)} searchable searchPlaceholder={searchLabel} suppressHydrationWarning value={value}>{countries.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}</DropdownSelect>
}
