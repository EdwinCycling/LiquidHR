export const LEAVE_COLOR_OPTIONS = [
  { value: 'var(--chart-1)', labelKey: 'blue' },
  { value: 'var(--chart-2)', labelKey: 'teal' },
  { value: 'var(--chart-3)', labelKey: 'green' },
  { value: 'var(--chart-4)', labelKey: 'orange' },
  { value: 'var(--chart-5)', labelKey: 'red' },
  { value: 'var(--color-primary)', labelKey: 'primary' },
  { value: 'var(--color-success)', labelKey: 'success' },
  { value: 'var(--color-warning)', labelKey: 'warning' },
] as const

export type LeaveColorToken = (typeof LEAVE_COLOR_OPTIONS)[number]['value']

const COLOR_BY_VALUE = new Map<string, string>([
  ...LEAVE_COLOR_OPTIONS.map((option) => [option.value, option.value] as const),
  ['blue', 'var(--chart-1)'],
  ['teal', 'var(--chart-2)'],
  ['green', 'var(--chart-3)'],
  ['orange', 'var(--chart-4)'],
  ['red', 'var(--chart-5)'],
  ['primary', 'var(--color-primary)'],
  ['success', 'var(--color-success)'],
  ['warning', 'var(--color-warning)'],
])

export function colorCodeToCssValue(colorCode: string | null | undefined): string {
  if (!colorCode) return 'var(--color-primary)'
  return COLOR_BY_VALUE.get(colorCode) ?? colorCode
}

export function defaultColorForWorkHourCategory(category: 'REGULAR_WORK' | 'OVERTIME' | 'INFORMATIONAL'): LeaveColorToken {
  if (category === 'OVERTIME') return 'var(--chart-4)'
  if (category === 'INFORMATIONAL') return 'var(--chart-2)'
  return 'var(--chart-1)'
}
