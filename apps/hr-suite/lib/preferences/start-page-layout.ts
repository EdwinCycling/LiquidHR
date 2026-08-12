import type { Json } from '@scope/db'

export const START_PAGE_WIDE_WINDOWS = ['teamAvailability', 'documents', 'continuousAppraisal', 'leave', 'absenceCases', 'events', 'kpis'] as const
export const START_PAGE_NARROW_WINDOWS = ['reminders', 'journeys', 'workInProgress'] as const
export type StartPageWideWindow = (typeof START_PAGE_WIDE_WINDOWS)[number]
export type StartPageNarrowWindow = (typeof START_PAGE_NARROW_WINDOWS)[number]
export interface StartPageWindowLayout {
  wide: StartPageWideWindow[]
  narrow: StartPageNarrowWindow[]
}

export const DEFAULT_START_PAGE_WINDOW_LAYOUT: StartPageWindowLayout = {
  wide: [...START_PAGE_WIDE_WINDOWS],
  narrow: [...START_PAGE_NARROW_WINDOWS],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ordered<T extends string>(value: unknown, known: readonly T[], prependWhenMissing: readonly T[] = []): T[] {
  const requested = Array.isArray(value)
    ? value.filter((item): item is T => typeof item === 'string' && known.includes(item as T))
    : []
  const missingPreferred = prependWhenMissing.filter((item) => !requested.includes(item))
  return [...new Set([...missingPreferred, ...requested, ...known])]
}

export function parseStartPageWindowLayout(value: unknown): StartPageWindowLayout {
  const source = isRecord(value) ? value : {}
  return {
    wide: ordered(source.wide, START_PAGE_WIDE_WINDOWS, ['teamAvailability']),
    narrow: ordered(source.narrow, START_PAGE_NARROW_WINDOWS),
  }
}

export function startPageWindowLayoutJson(layout: StartPageWindowLayout): Json {
  const parsed = parseStartPageWindowLayout(layout)
  return { wide: parsed.wide, narrow: parsed.narrow }
}
