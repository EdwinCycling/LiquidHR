import { FocusHome } from '@/components/focus/focus-home'
import { loadFocusPreviewPage } from '@/components/focus/load-focus-preview-page'

export default async function FocusPreviewPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params
  return <FocusHome {...await loadFocusPreviewPage(employeeId)} />
}
