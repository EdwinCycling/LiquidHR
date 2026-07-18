import type { ReactNode } from 'react'

export function EmailLink({ email, children, className }: { email: string; children?: ReactNode; className?: string }) {
  return <a className={className ?? 'transition-colors hover:text-primary hover:underline'} href={`mailto:${email}`}>{children ?? email}</a>
}
