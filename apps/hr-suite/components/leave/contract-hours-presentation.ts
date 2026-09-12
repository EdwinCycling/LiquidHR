export type ContractHoursFrequency = 'FOUR_WEEKLY' | 'MONTHLY' | 'YEARLY'

export function calculateContractHoursPeriodAmount(annualEntitlement: number, frequency: ContractHoursFrequency): number {
  const divisor = frequency === 'FOUR_WEEKLY' ? 13 : frequency === 'MONTHLY' ? 12 : 1
  return Math.max(0, annualEntitlement) / divisor
}

export function formatContractHours(value: number | null | undefined, decimalSeparator: string, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const normalized = Math.max(0, value).toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  return decimalSeparator === ',' ? normalized.replace('.', ',') : normalized
}
