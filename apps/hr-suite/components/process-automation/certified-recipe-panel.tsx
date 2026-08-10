'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CertifiedRecipe } from '@/lib/process-automation/recipe-service'

export interface CertifiedRecipePanelLabels {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly activate: string
  readonly activated: string
  readonly activationFailed: string
}

export function CertifiedRecipePanel({ recipes, canWrite, labels }: { readonly recipes: readonly CertifiedRecipe[]; readonly canWrite: boolean; readonly labels: CertifiedRecipePanelLabels }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function activate(recipeId: string): Promise<void> {
    setBusy(recipeId)
    setFeedback(null)
    try {
      const response = await fetch('/api/process-automation/recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipeId }),
      })
      if (!response.ok) {
        setFeedback(labels.activationFailed)
        return
      }
      setFeedback(labels.activated)
      router.refresh()
    } catch {
      setFeedback(labels.activationFailed)
    } finally {
      setBusy(null)
    }
  }

  return <section aria-labelledby="certified-recipe-title" className="mb-6 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
    <p className="eyebrow text-primary">{labels.eyebrow}</p>
    <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight" id="certified-recipe-title">{labels.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.description}</p>
      </div>
      {feedback ? <p aria-live="polite" className="text-sm font-medium text-muted-foreground" role="status">{feedback}</p> : null}
    </div>
    <div className="mt-6 grid gap-3">
      {recipes.map((recipe) => <article className="flex flex-col gap-4 rounded-2xl border border-border bg-panel-soft p-4 sm:flex-row sm:items-center sm:justify-between" key={recipe.id}>
        <div className="min-w-0"><h3 className="font-semibold">{recipe.title.nl}</h3><p className="mt-1 text-sm text-muted-foreground">v{recipe.recipeVersion} · {recipe.adapterKey}</p><p className="mt-2 text-sm text-muted-foreground">{recipe.description.nl}</p></div>
        {canWrite ? <button className="button-secondary shrink-0" disabled={busy !== null} onClick={() => { void activate(recipe.id) }} type="button">{busy === recipe.id ? `${labels.activate}…` : labels.activate}</button> : null}
      </article>)}
      {recipes.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : null}
    </div>
  </section>
}
