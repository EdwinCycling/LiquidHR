import { describe, expect, it } from 'vitest'
import { completeDashboardWidget, createDashboardProgressState, resetDashboardProgress } from './dashboard-progress-model'

describe('dashboard progress model', () => {
  it('telt ieder resultaat één keer en reset per generatie', () => {
    let state = createDashboardProgressState(3, 'initial')
    state = completeDashboardWidget(state, 'a', 'ready')
    state = completeDashboardWidget(state, 'b', 'empty')
    state = completeDashboardWidget(state, 'b', 'empty')
    state = completeDashboardWidget(state, 'c', 'error')

    expect(state.completed).toBe(3)
    expect(state.errorCount).toBe(1)
    expect(state.isComplete).toBe(true)
    expect(resetDashboardProgress(state, 'refresh-1').completed).toBe(0)
  })
})
