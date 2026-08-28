'use client'

import { useEffect, useMemo, useState } from 'react'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { ProductUpdateCard, type ProductUpdateSurfaceLabels } from './product-update-surfaces'
import type { ProductUpdate } from '@/lib/product-updates/service'

type ProductUpdatesPageLabels = ProductUpdateSurfaceLabels & { search: string }

export function ProductUpdatesPage({ initial, labels, locale }: { initial: ProductUpdate[]; labels: ProductUpdatesPageLabels; locale: string }) {
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

  return <div className="mt-8 grid gap-5"><CollectionToolbar search={<TextInput aria-label={labels.search} id="product-update-search" onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} type="search" value={query} />} />{visible.length === 0 ? <Surface className="p-8 text-center text-sm text-muted-foreground" variant="subtle"><p>{labels.empty}</p></Surface> : visible.map((update) => <ProductUpdateCard key={update.id} labels={labels} locale={locale} update={update} />)}</div>
}
