import { notFound } from 'next/navigation'
import { FocusHome } from '@/components/focus/focus-home'
import { loadFocusPreviewPage } from '@/components/focus/load-focus-preview-page'
import { FocusPreviewSection } from '@/components/focus/focus-preview-section'
import { focusActionByPreviewSection } from '@/components/focus/focus-preview'
import { visibleFocusActions } from '@/components/focus/focus-view'

export default async function FocusPreviewPage({ params, searchParams }: { params: Promise<{ employeeId: string }>; searchParams?: Promise<{ section?: string | string[] }> }) {
  const { employeeId } = await params
  const props = await loadFocusPreviewPage(employeeId)
  const rawSection = (await searchParams)?.section
  const section = typeof rawSection === 'string' ? rawSection : undefined
  if (!section) return <FocusHome {...props} />

  const activeKey = Object.hasOwn(focusActionByPreviewSection, section) ? focusActionByPreviewSection[section] : undefined
  if (!activeKey || !visibleFocusActions(props.data).some((action) => action.key === activeKey)) notFound()
  return <FocusPreviewSection {...props} activeKey={activeKey} />
}
