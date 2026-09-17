import { FocusHome } from '@/components/focus/focus-home'
import { loadFocusPage } from '@/components/focus/load-focus-page'

export default async function FocusPage() {
  return <FocusHome {...await loadFocusPage()} />
}
