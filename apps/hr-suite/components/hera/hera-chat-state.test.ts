import { describe, expect, it } from 'vitest'
import { getHeRaScreenState, getConversationLoadStateAfterFetch } from './hera-chat-state'

describe('getHeRaScreenState', () => {
  it('geeft laden en fouten voorrang op de inhoud', () => {
    expect(getHeRaScreenState({ isLoading: true, error: 'mislukt', conversationId: 'chat-1', messageCount: 2 })).toBe('loading')
    expect(getHeRaScreenState({ isLoading: false, error: 'mislukt', conversationId: 'chat-1', messageCount: 2 })).toBe('error')
  })

  it('onderscheidt een eerste gesprek van een gevuld gesprek', () => {
    expect(getHeRaScreenState({ isLoading: false, error: null, conversationId: null, messageCount: 0 })).toBe('empty')
    expect(getHeRaScreenState({ isLoading: false, error: null, conversationId: 'chat-1', messageCount: 0 })).toBe('empty')
    expect(getHeRaScreenState({ isLoading: false, error: null, conversationId: 'chat-1', messageCount: 1 })).toBe('conversation')
  })

  it('beëindigt laden ook wanneer er nog geen gesprekken zijn', () => {
    expect(getConversationLoadStateAfterFetch([])).toEqual({
      firstConversationId: null,
      isLoading: false,
    })
  })
})
