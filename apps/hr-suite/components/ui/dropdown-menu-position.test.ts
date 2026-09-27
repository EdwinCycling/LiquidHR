import { describe, expect, it } from 'vitest'
import { calculateDropdownMenuPosition } from './dropdown-menu-position'

describe('calculateDropdownMenuPosition', () => {
  it('opens above a low trigger when the menu would otherwise extend past the viewport', () => {
    expect(calculateDropdownMenuPosition({
      trigger: { top: 767, bottom: 807, left: 421, width: 886 },
      menuHeight: 266,
      viewportWidth: 1440,
      viewportHeight: 900,
    })).toEqual({ top: 493, left: 421, width: 886, maxHeight: 266, side: 'above' })
  })

  it('keeps the menu below a mobile trigger when it fits', () => {
    expect(calculateDropdownMenuPosition({
      trigger: { top: 402, bottom: 442, left: 41, width: 308 },
      menuHeight: 266,
      viewportWidth: 390,
      viewportHeight: 844,
    })).toEqual({ top: 450, left: 41, width: 308, maxHeight: 266, side: 'below' })
  })

  it('limits width and height when neither side can fit the full menu', () => {
    const position = calculateDropdownMenuPosition({
      trigger: { top: 180, bottom: 220, left: 290, width: 400 },
      menuHeight: 600,
      viewportWidth: 320,
      viewportHeight: 400,
    })

    expect(position).toEqual({ top: 228, left: 8, width: 304, maxHeight: 164, side: 'below' })
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(392)
  })
})
