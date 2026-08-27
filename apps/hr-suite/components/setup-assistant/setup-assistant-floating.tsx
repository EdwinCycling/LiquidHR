'use client'

import Link from 'next/link'
import { Check, ChevronDown, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Drawer } from '@/components/ui/drawer'
import { announceAssistantOpen, subscribeToAssistantOpen } from '@/components/layout/assistant-overlay-events'
import { SETUP_ASSISTANT_GUIDE, type SetupAssistantCategoryKey, type SetupAssistantStep } from '@/lib/setup-assistant/guide'
import type { SetupAssistantLabels } from '@/lib/setup-assistant/labels'
import type { SetupAssistantState } from '@/lib/setup-assistant/types'

function formatMessage(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, key: string) => {
    const value = values[key]
    return value === undefined ? placeholder : String(value)
  })
}

function categoryId(categoryKey: SetupAssistantCategoryKey): string {
  return `setup-assistant-category-${categoryKey}`
}

export function SetupAssistantFloating({
  labels,
  state,
}: {
  labels: SetupAssistantLabels
  state: SetupAssistantState
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [activeCategorySelection, setActiveCategorySelection] = useState<SetupAssistantCategoryKey | 'auto' | null>('auto')
  const [pendingCompletions, setPendingCompletions] = useState<Record<string, boolean>>({})
  const [dismissedSuggestionKeys, setDismissedSuggestionKeys] = useState(() => new Set<string>())
  const [savingStepKey, setSavingStepKey] = useState<string | null>(null)
  const visibleCategories = useMemo(() => SETUP_ASSISTANT_GUIDE
    .map((category) => ({
      ...category,
      steps: category.steps.filter((step) => state.visibleStepKeys.includes(step.stepKey)),
    }))
    .filter((category) => category.steps.length > 0), [state.visibleStepKeys])
  const visibleSteps = useMemo(() => visibleCategories.flatMap((category) => category.steps), [visibleCategories])
  const completedStepKeys = useMemo(() => {
    const completed = new Set(state.completedStepKeys)
    for (const [stepKey, isCompleted] of Object.entries(pendingCompletions)) {
      if (isCompleted) completed.add(stepKey)
      else completed.delete(stepKey)
    }
    return completed
  }, [pendingCompletions, state.completedStepKeys])

  useEffect(() => subscribeToAssistantOpen((kind) => {
    if (kind === 'hera') setOpen(false)
  }), [])

  const firstIncompleteCategory = visibleCategories.find((category) => category.steps.some((step) => !completedStepKeys.has(step.stepKey)))
  const fallbackCategory = firstIncompleteCategory?.categoryKey ?? visibleCategories[0]?.categoryKey ?? null
  const activeCategory = activeCategorySelection === 'auto'
    || (activeCategorySelection && !visibleCategories.some((category) => category.categoryKey === activeCategorySelection))
    ? fallbackCategory
    : activeCategorySelection

  function openAssistant() {
    announceAssistantOpen('setup')
    setOpen(true)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) announceAssistantOpen('setup')
  }

  async function updateCompletion(step: SetupAssistantStep, nextCompleted: boolean) {
    if (!state.canWrite || savingStepKey) return
    setPendingCompletions((current) => ({ ...current, [step.stepKey]: nextCompleted }))
    setSavingStepKey(step.stepKey)
    try {
      const response = await fetch('/api/setup-assistant/completion', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stepKey: step.stepKey, isCompleted: nextCompleted }),
      })
      if (!response.ok) throw new Error('SETUP_ASSISTANT_COMPLETION_SAVE_FAILED')
      router.refresh()
    } catch {
      setPendingCompletions((current) => {
        const next = { ...current }
        delete next[step.stepKey]
        return next
      })
    } finally {
      setSavingStepKey(null)
    }
  }

  const completedCount = visibleSteps.filter((step) => completedStepKeys.has(step.stepKey)).length
  const totalCount = visibleSteps.length
  const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)
  const activeCategoryDefinition = visibleCategories.find((category) => category.categoryKey === activeCategory)

  return (
    <>
      {!open ? (
        <button
          aria-label={labels.edgeOpen}
          className="fixed right-0 top-[67%] z-40 rounded-l-lg border border-r-0 border-border bg-primary px-2 py-4 text-xs font-semibold tracking-[0.18em] text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 [writing-mode:vertical-rl]"
          onClick={openAssistant}
          type="button"
        >
          {labels.edgeLabel}
        </button>
      ) : null}
      <Drawer
        closeLabel={labels.close}
        contentClassName="px-5 py-4 sm:px-6"
        footer={(
          <div>
            <p className="text-sm font-semibold text-foreground">{labels.helpTitle}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.helpDescription}</p>
          </div>
        )}
        onOpenChange={handleOpenChange}
        open={open}
        panelClassName="sm:!max-w-[420px]"
        title={labels.title}
        description={labels.subtitle}
      >
        <div className="space-y-5">
          <div aria-label={formatMessage(labels.progress, { completed: completedCount, total: totalCount })}>
            <div className="flex items-baseline justify-between gap-3 text-xs font-medium text-muted-foreground">
              <span>{formatMessage(labels.progress, { completed: completedCount, total: totalCount })}</span>
              <span>{formatMessage(labels.progressPercent, { percent: percentage })}</span>
            </div>
            <div
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={percentage}
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
            >
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
            </div>
          </div>

          {visibleCategories.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{labels.empty}</p> : null}

          <div className="space-y-2">
            {visibleCategories.map((category) => {
              const isOpen = activeCategory === category.categoryKey
              const categoryCompleted = category.steps.filter((step) => completedStepKeys.has(step.stepKey)).length
              const categoryLabels = labels.categories[category.categoryKey]
              return (
                <section className="overflow-hidden rounded-lg border border-border-subtle" key={category.categoryKey}>
                  <button
                    aria-controls={categoryId(category.categoryKey)}
                    aria-expanded={isOpen}
                    aria-label={formatMessage(isOpen ? labels.categoryClose : labels.categoryOpen, { category: categoryLabels.title })}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                    onClick={() => setActiveCategorySelection(isOpen ? null : category.categoryKey)}
                    type="button"
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${categoryCompleted === category.steps.length ? 'bg-primary text-primary-foreground' : 'bg-accent text-primary'}`}>
                      {categoryCompleted === category.steps.length ? <Check aria-hidden="true" size={14} /> : category.steps.findIndex((step) => !completedStepKeys.has(step.stepKey)) + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{categoryLabels.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{categoryCompleted}/{category.steps.length}</span>
                    </span>
                    <ChevronDown aria-hidden="true" className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} size={17} />
                  </button>
                  {isOpen ? (
                    <div className="border-t border-border-subtle px-3 pb-2" id={categoryId(category.categoryKey)}>
                      <p className="px-10 py-3 text-xs leading-5 text-muted-foreground">{categoryLabels.description}</p>
                      <div className="space-y-1">
                        {category.steps.map((step) => {
                          const stepLabels = labels.steps[step.stepKey]
                          const isCompleted = completedStepKeys.has(step.stepKey)
                          const isSaving = savingStepKey === step.stepKey
                          return (
                            <div className="flex items-start gap-3 rounded-md px-1 py-2.5 hover:bg-muted/40" key={step.stepKey}>
                              <Checkbox
                                aria-label={isCompleted ? labels.markIncomplete : labels.markComplete}
                                checked={isCompleted}
                                disabled={!state.canWrite || isSaving}
                                onChange={(event) => void updateCompletion(step, event.target.checked)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <span className={`text-sm font-medium ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{stepLabels.title}</span>
                                  <Link
                                    aria-label={formatMessage(labels.openStep, { title: stepLabels.title })}
                                    className="shrink-0 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                    href={step.primaryRoute.href}
                                    onClick={() => setOpen(false)}
                                  >
                                    <ExternalLink aria-hidden="true" size={15} />
                                  </Link>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{stepLabels.description}</p>
                                {(() => {
                                  const suggestion = state.suggestions.find((candidate) => candidate.stepKey === step.stepKey)
                                  if (!suggestion || isCompleted || dismissedSuggestionKeys.has(step.stepKey)) return null
                                  return (
                                    <div className="mt-3 rounded-md border border-accent bg-accent/40 p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{labels.suggestionLabel}</p>
                                      <p className="mt-1 text-xs leading-5 text-foreground">{formatMessage(labels.suggestions[suggestion.suggestionKey], { count: suggestion.count })}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <Button
                                          disabled={!state.canWrite || isSaving}
                                          onClick={() => void updateCompletion(step, true)}
                                          size="sm"
                                          type="button"
                                          variant="secondary"
                                        >
                                          {labels.markReady}
                                        </Button>
                                        <Button
                                          onClick={() => setDismissedSuggestionKeys((current) => new Set(current).add(step.stepKey))}
                                          size="sm"
                                          type="button"
                                          variant="ghost"
                                        >
                                          {labels.notYet}
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })()}
                                {step.relatedRoute && state.availableRelatedRouteKeys.includes(step.stepKey) ? (
                                  <Link
                                    aria-label={formatMessage(labels.openRelatedStep, { title: labels.steps[step.stepKey].title })}
                                    className="mt-1 inline-flex items-center text-xs font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                    href={step.relatedRoute.href}
                                    onClick={() => setOpen(false)}
                                  >
                                    {formatMessage(labels.openRelatedStep, { title: labels.steps[step.stepKey].title })}
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>

          {activeCategoryDefinition && completedCount === totalCount && totalCount > 0 ? (
            <p className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-primary">{labels.complete}</p>
          ) : null}
        </div>
      </Drawer>
    </>
  )
}
