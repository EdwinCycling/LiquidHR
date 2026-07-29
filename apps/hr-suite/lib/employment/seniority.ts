function asUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function addMonths(value: Date, months: number): Date {
  const year = value.getUTCFullYear()
  const month = value.getUTCMonth() + months
  const targetYear = year + Math.floor(month / 12)
  const targetMonth = ((month % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(value.getUTCDate(), lastDay)))
}

export function seniorityDurationInMonths(seniorityDate: string, asOf: string): number | null {
  if (seniorityDate > asOf) return null
  const start = asUtcDate(seniorityDate)
  const end = asUtcDate(asOf)
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  if (addMonths(start, months).getTime() > end.getTime()) months -= 1
  return months
}

export function seniorityDuration(seniorityDate: string, asOf: string): { years: number; months: number } | null {
  const totalMonths = seniorityDurationInMonths(seniorityDate, asOf)
  return totalMonths === null ? null : { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
}
