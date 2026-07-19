export type HeRaDockState = 'overlay' | 'docked'

export function clampHeRaWidth(value: number): number {
  return Math.min(760, Math.max(320, Math.round(value)))
}

export function parseHeRaDockState(value: string | null): HeRaDockState {
  return value === 'docked' ? 'docked' : 'overlay'
}
