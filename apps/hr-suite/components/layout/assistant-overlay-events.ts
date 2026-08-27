export type AssistantOverlayKind = 'setup' | 'hera'

const ASSISTANT_OPEN_EVENT = 'liquidhr-assistant-open'

export function announceAssistantOpen(kind: AssistantOverlayKind): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AssistantOverlayKind>(ASSISTANT_OPEN_EVENT, { detail: kind }))
}

export function subscribeToAssistantOpen(listener: (kind: AssistantOverlayKind) => void): () => void {
  const handleEvent = (event: Event) => {
    const kind = (event as CustomEvent<AssistantOverlayKind>).detail
    if (kind === 'setup' || kind === 'hera') listener(kind)
  }
  window.addEventListener(ASSISTANT_OPEN_EVENT, handleEvent)
  return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, handleEvent)
}
