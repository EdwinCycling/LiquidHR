import { FocusHome } from '@/components/focus/focus-home'
import { loadFocusPage } from '@/components/focus/load-focus-page'

export default async function FocusPage({ searchParams }: { searchParams: Promise<{ actAs?: string }> }) {
  const query = await searchParams
  return <FocusHome {...await loadFocusPage(query.actAs)} />
}
