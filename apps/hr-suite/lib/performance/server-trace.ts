import 'server-only'

export interface ServerPerformanceTrace {
  measure<T>(label: string, operation: () => Promise<T>): Promise<T>
  finish(): void
}

class RequestPerformanceTrace implements ServerPerformanceTrace {
  private readonly timings = new Map<string, number>()
  private readonly startedAt = performance.now()
  private finished = false

  constructor(private readonly route: string, private readonly enabled: boolean) {}

  async measure<T>(label: string, operation: () => Promise<T>): Promise<T> {
    if (!this.enabled) return operation()
    const startedAt = performance.now()
    try {
      return await operation()
    } finally {
      this.timings.set(label, performance.now() - startedAt)
    }
  }

  finish(): void {
    if (!this.enabled || this.finished) return
    this.finished = true
    console.info(JSON.stringify({
      type: 'liquidhr.performance',
      route: this.route,
      totalMs: performance.now() - this.startedAt,
      timings: Object.fromEntries(this.timings),
    }))
  }
}

export function createServerPerformanceTrace(route: string, enabled: boolean): ServerPerformanceTrace {
  return new RequestPerformanceTrace(route, enabled)
}
