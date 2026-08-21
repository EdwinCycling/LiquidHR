import type { ReactNode } from 'react'
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu'

export type RowActionsProps = {
  primaryAction?: ReactNode
  menuItems?: readonly ActionMenuItem[]
  menuLabel: string
  className?: string
}

export function RowActions({ className, menuItems = [], menuLabel, primaryAction }: RowActionsProps) {
  if (!primaryAction && menuItems.length === 0) return null

  return (
    <div className={`flex shrink-0 flex-wrap items-center justify-end gap-2 ${className ?? ''}`.trim()}>
      {primaryAction}
      {menuItems.length > 0 ? <ActionMenu items={menuItems} label={menuLabel} /> : null}
    </div>
  )
}
