'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProductUpdateCard, type ProductUpdateSurfaceLabels } from './product-update-surfaces'
import type { ProductUpdate } from '@/lib/product-updates/service'

export function ProductUpdatesPage({ initial, labels, locale }: { initial: ProductUpdate[]; labels: ProductUpdateSurfaceLabels; locale: string }) {
  const [updates] = useState(initial)
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale)
    return updates.filter((update) => !normalized || `${update.title} ${update.summary} ${update.content}`.toLocaleLowerCase(locale).includes(normalized))
  }, [locale, query, updates])

  useEffect(() => {
    if (!updates.some((update) => update.displayChannels.includes('GIFT_WINDOW'))) return
    void fetch('/api/product-updates/seen', { method: 'POST' }).then(() => window.dispatchEvent(new CustomEvent('liquidhr-product-updates-seen')))
  }, [updates])

  return <div className="mt-8 grid gap-5"><div className="flex flex-wrap items-center justify-between gap-3"><label className="sr-only" htmlFor="product-update-search">{labels.title}</label><input className="form-field max-w-md" id="product-update-search" onChange={(event) => setQuery(event.target.value)} placeholder={`${labels.title}...`} value={query} /></div>{visible.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-sm text-muted-foreground">—</div> : visible.map((update) => <ProductUpdateCard key={update.id} labels={labels} locale={locale} update={update} />)}</div>
}
