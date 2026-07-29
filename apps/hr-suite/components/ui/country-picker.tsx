'use client'

import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')

export function CountryPicker({ value, onChange, locale = 'nl', searchLabel, emptyLabel }: { value: string; onChange: (value: string) => void; locale?: string; searchLabel: string; emptyLabel: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const countries = useMemo(() => {
    const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
    return COUNTRY_CODES.map((code) => ({ code, label: displayNames.of(code) ?? code })).sort((left, right) => left.code === 'NL' ? -1 : right.code === 'NL' ? 1 : left.label.localeCompare(right.label))
  }, [locale])
  const matches = countries.filter((country) => `${country.label} ${country.code}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)))
  const selectedLabel = countries.find((country) => country.code === value)?.label ?? value
  return <div className="relative"><button aria-expanded={open} aria-haspopup="listbox" className="form-field flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen((current) => !current)} type="button"><span className="truncate">{selectedLabel}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></button>{open && <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border bg-background p-2 shadow-xl"><input aria-label={searchLabel} autoFocus className="form-field" onChange={(event) => setQuery(event.target.value)} placeholder={searchLabel} value={query} />{matches.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p> : <ul className="mt-2 max-h-56 overflow-y-auto" role="listbox">{matches.map((country) => <li key={country.code}><button aria-selected={value === country.code} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${value === country.code ? 'bg-primary/10 font-semibold text-primary' : ''}`} onClick={() => { onChange(country.code); setOpen(false); setQuery('') }} role="option" type="button"><span>{country.label}</span><span className="text-xs text-muted-foreground">{country.code}</span></button></li>)}</ul>}</div>}</div>
}
