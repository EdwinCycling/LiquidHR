export type DropdownMenuPositionInput = {
  trigger: { top: number; bottom: number; left: number; width: number }
  menuHeight: number
  viewportWidth: number
  viewportHeight: number
}

export type DropdownMenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  side: 'above' | 'below'
}

const VIEWPORT_PADDING = 8
const MENU_GAP = 8
const MIN_MENU_WIDTH = 240

export function calculateDropdownMenuPosition({ trigger, menuHeight, viewportWidth, viewportHeight }: DropdownMenuPositionInput): DropdownMenuPosition {
  const width = Math.min(Math.max(trigger.width, MIN_MENU_WIDTH), Math.max(1, viewportWidth - VIEWPORT_PADDING * 2))
  const left = Math.min(Math.max(trigger.left, VIEWPORT_PADDING), viewportWidth - VIEWPORT_PADDING - width)
  const spaceAbove = Math.max(0, trigger.top - MENU_GAP - VIEWPORT_PADDING)
  const spaceBelow = Math.max(0, viewportHeight - trigger.bottom - MENU_GAP - VIEWPORT_PADDING)
  const openAbove = menuHeight > spaceBelow && spaceAbove > spaceBelow
  const side = openAbove ? 'above' : 'below'
  const availableSpace = openAbove ? spaceAbove : spaceBelow
  const maxHeight = Math.max(1, Math.min(menuHeight, availableSpace))
  const top = openAbove
    ? trigger.top - MENU_GAP - maxHeight
    : Math.min(trigger.bottom + MENU_GAP, viewportHeight - VIEWPORT_PADDING - maxHeight)

  return { top, left, width, maxHeight, side }
}
