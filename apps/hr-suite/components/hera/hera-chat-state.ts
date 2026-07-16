export type HeRaScreenState = 'loading' | 'error' | 'empty' | 'conversation'

export function getConversationLoadStateAfterFetch<T extends { id: string }>(
  conversations: readonly T[],
): { firstConversationId: string | null; isLoading: false } {
  return {
    firstConversationId: conversations[0]?.id ?? null,
    isLoading: false,
  }
}

export function getHeRaScreenState(input: {
  isLoading: boolean
  error: string | null
  conversationId: string | null
  messageCount: number
}): HeRaScreenState {
  if (input.isLoading) return 'loading'
  if (input.error) return 'error'
  if (!input.conversationId || input.messageCount === 0) return 'empty'
  return 'conversation'
}
