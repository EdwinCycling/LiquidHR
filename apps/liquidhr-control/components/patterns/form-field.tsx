import type { ReactNode } from 'react'

export function FormField({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`block text-sm font-medium text-foreground ${className ?? ''}`.trim()}><span>{label}</span>{hint ? <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{hint}</span> : null}<span className="mt-2 block">{children}</span></label>
}
