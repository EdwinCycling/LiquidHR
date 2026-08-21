'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'

import { IconButton } from '@/components/ui/icon-button'
import { tabLinkClasses } from './tab-link-classes'

export { tabLinkClasses } from './tab-link-classes'

interface ScrollableTabsProps {
  ariaLabel: string
  children: ReactNode
  contentClassName?: string
  contentProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>
  leftLabel: string
  rightLabel: string
  className?: string
}

export type TabLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  active?: boolean
}

export function TabLink({ active = false, 'aria-current': ariaCurrent, className, ...props }: TabLinkProps) {
  return <a {...props} aria-current={ariaCurrent ?? (active ? 'page' : undefined)} className={tabLinkClasses({ active, className })} />
}

function focusAdjacentTab(current: HTMLButtonElement, direction: -1 | 1): void {
  const tabList = current.closest('[role="tablist"]')
  if (!tabList) return
  const tabs = Array.from(tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'))
  const index = tabs.indexOf(current)
  if (index < 0 || tabs.length < 2) return
  tabs[(index + direction + tabs.length) % tabs.length]?.focus()
}

export type TabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
}

export function TabButton({ active = false, className, onKeyDown, tabIndex, ...props }: TabButtonProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusAdjacentTab(event.currentTarget, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusAdjacentTab(event.currentTarget, -1)
    }
  }

  return <button {...props} aria-selected={active} className={tabLinkClasses({ active, className })} onKeyDown={handleKeyDown} role="tab" tabIndex={tabIndex ?? (active ? 0 : -1)} type="button" />
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
      {overflow.left ? <IconButton className="absolute left-1 top-1/2 z-10 -translate-y-1/2 !border-primary/30 !bg-accent !text-primary hover:!bg-accent/80 hover:!text-primary" label={leftLabel} onClick={() => scrollByPage(-1)} size="sm" variant="ghost"><ChevronLeft aria-hidden="true" /></IconButton> : null}
      <div ref={scrollRef} className={`tabs-scroll overflow-x-auto overflow-y-hidden border-b border-border ${overflow.left ? 'pl-10' : 'pl-1'} ${overflow.right ? 'pr-10' : 'pr-1'}`}>
        <div {...contentProps} aria-label={contentProps?.['aria-label'] ?? (contentProps?.role === 'tablist' ? ariaLabel : undefined)} className={`flex min-w-max gap-1 ${contentClassName}`.trim()}>{children}</div>
      </div>
      {overflow.right ? <IconButton className="absolute right-1 top-1/2 z-10 -translate-y-1/2 !border-primary/30 !bg-accent !text-primary hover:!bg-accent/80 hover:!text-primary" label={rightLabel} onClick={() => scrollByPage(1)} size="sm" variant="ghost"><ChevronRight aria-hidden="true" /></IconButton> : null}
    </div>
  )
}
