import { Sparkles } from 'lucide-react'
import type { ReactElement } from 'react'
import { Surface } from '@/components/ui/surface'

export function AiProgress({ label }: { readonly label: string }): ReactElement {
  return <Surface aria-busy="true" className="grid gap-3 p-4 text-sm" role="status">
    <div className="flex items-center gap-2">
      <Sparkles aria-hidden="true" className="size-4 animate-pulse text-primary" />
      <span>{label}<span aria-hidden="true" className="inline-flex w-5"><span className="motion-safe:animate-bounce">.</span><span className="motion-safe:animate-bounce [animation-delay:150ms]">.</span><span className="motion-safe:animate-bounce [animation-delay:300ms]">.</span></span></span>
    </div>
    <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-muted">
      <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-pulse" />
    </div>
  </Surface>
}
