'use client'

import { Dialog, type DialogProps } from './dialog'

export type DrawerProps = DialogProps

export function Drawer({ className, contentClassName, panelClassName, ...props }: DrawerProps) {
  return (
    <Dialog
      {...props}
      className={`!p-0 items-stretch justify-end ${className ?? ''}`.trim()}
      contentClassName={`overflow-y-auto px-5 py-5 ${contentClassName ?? ''}`.trim()}
      panelClassName={`h-dvh max-h-none w-full max-w-none rounded-none border-y-0 shadow-lg sm:h-full sm:max-w-[min(640px,100vw)] sm:rounded-l-[var(--radius-overlay)] sm:border-y ${panelClassName ?? ''}`.trim()}
    />
  )
}
