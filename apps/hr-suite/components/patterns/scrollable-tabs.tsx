'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'

interface ScrollableTabsProps {
  ariaLabel: string
  children: ReactNode
  contentClassName?: string
  contentProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>
  leftLabel: string
  rightLabel: string
  className?: string
}

export function tabLinkClasses({ active, className = '' }: { active: boolean; className?: string }): string {
  return `-mb-px inline-flex min-h-10 items-center whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm font-semibold leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'} ${className}`.trim()
}

export function ScrollableTabs({ ariaLabel, children, className = '', contentClassName = '', contentProps, leftLabel, rightLabel }: ScrollableTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ left: false, right: false })

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const updateOverflow = () => {
      setOverflow({
        left: element.scrollLeft > 1,
        right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      })
    }

    element.addEventListener('scroll', updateOverflow, { passive: true })
    updateOverflow()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflow)
    observer?.observe(element)
    if (element.firstElementChild) observer?.observe(element.firstElementChild)

    return () => {
      element.removeEventListener('scroll', updateOverflow)
      observer?.disconnect()
    }
  }, [children])

  function scrollByPage(direction: -1 | 1): void {
    const element = scrollRef.current
    if (!element) return
    element.scrollBy({ behavior: 'smooth', left: direction * Math.max(element.clientWidth * 0.65, 160) })
  }

  return (
    <div aria-label={ariaLabel} className={`relative min-w-0 ${className}`.trim()}>
      {overflow.left ? <button aria-label={leftLabel} className="absolute left-1 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-[var(--radius-control)] border border-border bg-surface text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus hover:bg-muted hover:text-foreground" onClick={() => scrollByPage(-1)} type="button"><ChevronLeft aria-hidden="true" size={16} /></button> : null}
      <div ref={scrollRef} className={`tabs-scroll overflow-x-auto overflow-y-hidden border-b border-border ${overflow.left ? 'pl-10' : 'pl-1'} ${overflow.right ? 'pr-10' : 'pr-1'}`}>
        <div {...contentProps} className={`flex min-w-max gap-1 ${contentClassName}`.trim()}>{children}</div>
      </div>
      {overflow.right ? <button aria-label={rightLabel} className="absolute right-1 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-[var(--radius-control)] border border-border bg-surface text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus hover:bg-muted hover:text-foreground" onClick={() => scrollByPage(1)} type="button"><ChevronRight aria-hidden="true" size={16} /></button> : null}
    </div>
  )
}
