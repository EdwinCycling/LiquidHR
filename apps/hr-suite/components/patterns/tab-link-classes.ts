export function tabLinkClasses({ active, className = '' }: { active: boolean; className?: string }): string {
  return `-mb-px inline-flex min-h-10 items-center whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active ? 'border-primary bg-accent/45 font-semibold text-primary' : 'border-transparent font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground'} ${className}`.trim()
}
