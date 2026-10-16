export type EmployeePayslipDocument = {
  readonly id: string
  readonly periodYear: number
  readonly periodMonth: number | null
  readonly source: 'IMPORTED' | 'PAYROLL'
  readonly contentType: string
  readonly viewHref: string
  readonly downloadHref: string
}

export type EmployeePayslipMonthGroup = {
  readonly year: number
  readonly month: number | null
  readonly label: string
  readonly documents: readonly EmployeePayslipDocument[]
}

const MONTH_ALIASES: Readonly<Record<string, number>> = Object.freeze({
  january: 1, jan: 1, januari: 1,
  february: 2, feb: 2, februari: 2,
  march: 3, mar: 3, maart: 3,
  april: 4, apr: 4,
  may: 5, mei: 5,
  june: 6, jun: 6, juni: 6,
  july: 7, jul: 7, juli: 7,
  august: 8, aug: 8, augustus: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, oktober: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
})

export function parseImportedPayslipMonth(periodLabel: string, calendarYear: number): number | null {
  if (!Number.isInteger(calendarYear)) return null
  const normalized = periodLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  const tokens: string[] = normalized.match(/[a-z]+|\d+/g) ?? []
  const compact = normalized.replace(/\s+/g, '')
  const year = String(calendarYear)

  const yearMonth = /^(\d{4})[-/.](\d{1,2})$/.exec(compact)
  if (yearMonth && Number(yearMonth[1]) === calendarYear) {
    const month = Number(yearMonth[2])
    return month >= 1 && month <= 12 ? month : null
  }

  const monthYear = /^(\d{1,2})[-/.](\d{4})$/.exec(compact)
  if (monthYear && Number(monthYear[2]) === calendarYear) {
    const month = Number(monthYear[1])
    return month >= 1 && month <= 12 ? month : null
  }

  for (const token of tokens) {
    const month = MONTH_ALIASES[token]
    if (month !== undefined && tokens.includes(year)) return month
  }
  return null
}

export function groupEmployeePayslips(
  documents: readonly EmployeePayslipDocument[],
  locale: string,
  unspecifiedPeriod: string,
): readonly EmployeePayslipMonthGroup[] {
  const grouped = new Map<string, EmployeePayslipDocument[]>()
  for (const document of documents) {
    if (!Number.isInteger(document.periodYear) || document.periodYear < 1900 || document.periodYear > 9999) continue
    if (document.periodMonth !== null && (!Number.isInteger(document.periodMonth) || document.periodMonth < 1 || document.periodMonth > 12)) continue
    const key = `${document.periodYear}-${document.periodMonth ?? 'unknown'}`
    const entries = grouped.get(key) ?? []
    entries.push(document)
    grouped.set(key, entries)
  }

  return [...grouped.entries()]
    .map(([key, entries]) => {
      const [yearText, monthText] = key.split('-')
      const year = Number(yearText)
      const month = monthText === 'unknown' ? null : Number(monthText)
      const label = month === null
        ? unspecifiedPeriod
        : new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
          .format(new Date(Date.UTC(2020, month - 1, 1)))
      return {
        year,
        month,
        label,
        documents: [...entries].sort((left, right) => left.source.localeCompare(right.source)),
      }
    })
    .sort((left, right) => right.year - left.year || (right.month ?? -1) - (left.month ?? -1))
}
