'use client'

import { Download, Edit3, LoaderCircle, Menu, MessageCircleHeart, Plus, Send, Settings2, Sparkles, Trash2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { getConversationLoadStateAfterFetch, getHeRaScreenState } from './hera-chat-state'
import { HeRaControlCard, type HeRaDraftView, type HeRaMemoryProposalView } from './hera-control-card'
import { requestJson } from './hera-request'
import { evidenceFromMessageMetadata } from './hera-response-model'
import { HeRaScopeLine } from './hera-scope-line'
import { HeRaSettings, type HeRaSettingsLabels } from './hera-settings'

export interface HeRaLabels extends HeRaSettingsLabels {
  title: string
  subtitle: string
  newConversation: string
  emptyTitle: string
  emptyDescription: string
  composerPlaceholder: string
  send: string
  sending: string
  deleteConversation: string
  exportConversation: string
  renameConversation: string
  memoryConsent: string
  saveMemory: string
  cancel: string
  confirmDraft: string
  draftExpires: string
  error: string
  noConversations: string
  sourceLiquidHr: string
  visibleRecords: string
  asOfDate: string
  filters: string
  uncertainties: string
  confirmAction: string
  cancelAction: string
  draftExpiresAt: string
  rememberProposal: string
  remember: string
  updateMemoryProposal: string
  updateMemory: string
  deleteMemoryProposal: string
  deleteMemory: string
  currentValue: string
  newValue: string
}

interface Conversation { id: string; title: string; summary: string | null; created_at: string; updated_at: string }
interface Message { id: string; role: 'USER' | 'ASSISTANT' | 'TOOL'; content: string; visible_tool_name?: string | null; metadata?: unknown; created_at: string }
interface ConversationDetail { conversation: Conversation; messages: Message[] }

function messageClass(role: Message['role']): string {
  return role === 'USER'
    ? 'ml-auto bg-primary text-primary-foreground'
    : 'mr-auto border bg-surface text-foreground'
}

export function HeRaChat({ labels }: { labels: HeRaLabels }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<HeRaDraftView | null>(null)
  const [memoryProposal, setMemoryProposal] = useState<HeRaMemoryProposalView | null>(null)
  const [railOpen, setRailOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const screenState = getHeRaScreenState({
    isLoading,
    error,
    conversationId: detail?.conversation.id ?? null,
    messageCount: detail?.messages.length ?? 0,
  })

  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    return requestJson<T>(url, init)
  }

  async function loadConversation(conversationId: string) {
    setIsLoading(true)
    setError(null)
    try {
      const result = await request<{ data: ConversationDetail }>(`/api/hera/conversations/${conversationId}`)
      setDetail(result.data)
    } catch {
      setError(labels.error)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadConversations() {
    setIsLoading(true)
    setError(null)
    try {
      const result = await request<{ data: Conversation[] }>('/api/hera/conversations')
      setConversations(result.data)
      const loadState = getConversationLoadStateAfterFetch(result.data)
      if (loadState.firstConversationId) await loadConversation(loadState.firstConversationId)
      else setDetail(null)
      setIsLoading(loadState.isLoading)
    } catch {
      setError(labels.error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const startup = window.setTimeout(() => { void loadConversations() }, 0)
    return () => window.clearTimeout(startup)
  // De eerste lijst wordt bewust één keer na de client-mount geladen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createConversation() {
    setIsLoading(true)
    setError(null)
    try {
      const result = await request<{ data: Conversation }>('/api/hera/conversations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      setConversations((current) => [result.data, ...current])
      setDetail({ conversation: result.data, messages: [] })
      setDraft(null)
      setMemoryProposal(null)
    } catch {
      setError(labels.error)
    } finally {
      setIsLoading(false)
      setRailOpen(false)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const content = String(formData.get('message') ?? '').trim()
    if (!content || !detail || isSending) return
    setIsSending(true)
    setError(null)
    try {
      const result = await request<{ data: { message: Message; draft: HeRaDraftView | null; memoryProposal: HeRaMemoryProposalView | null } }>(`/api/hera/conversations/${detail.conversation.id}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }),
      })
      const userMessage: Message = { id: `local-${Date.now()}`, role: 'USER', content, created_at: new Date().toISOString() }
      setDetail((current) => current ? { ...current, messages: [...current.messages, userMessage, result.data.message] } : current)
      setDraft(result.data.draft)
      setMemoryProposal(result.data.memoryProposal)
      form.reset()
    } catch {
      setError(labels.error)
    } finally {
      setIsSending(false)
    }
  }

  async function renameConversation() {
    if (!detail) return
    const title = window.prompt(labels.renameConversation, detail.conversation.title)?.trim()
    if (!title) return
    try {
      const result = await request<{ data: Pick<Conversation, 'id' | 'title' | 'updated_at'> }>(`/api/hera/conversations/${detail.conversation.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }),
      })
      setConversations((current) => current.map((conversation) => conversation.id === result.data.id ? { ...conversation, ...result.data } : conversation))
      setDetail((current) => current ? { ...current, conversation: { ...current.conversation, ...result.data } } : current)
    } catch { setError(labels.error) }
  }

  async function deleteConversation() {
    if (!detail) return
    try {
      await request<{ data: { id: string } }>(`/api/hera/conversations/${detail.conversation.id}`, { method: 'DELETE' })
      const remaining = conversations.filter((conversation) => conversation.id !== detail.conversation.id)
      setConversations(remaining)
      setDetail(null)
      setDraft(null)
      setMemoryProposal(null)
      if (remaining[0]) await loadConversation(remaining[0].id)
    } catch { setError(labels.error) }
  }

  async function confirmDraft() {
    if (!draft) return
    try {
      await request<{ data: unknown }>(`/api/hera/drafts/${draft.id}/confirm`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: draft.version }),
      })
      setDraft(null)
    } catch { setError(labels.error) }
  }

  async function cancelDraft() {
    if (!draft) return
    try {
      await request<{ data: { id: string; status: 'CANCELLED' } }>(`/api/hera/drafts/${draft.id}`, {
        method: 'DELETE',
      })
      setDraft(null)
    } catch { setError(labels.error) }
  }

  async function saveMemory() {
    if (!memoryProposal || !detail) return
    try {
      if (memoryProposal.operation === 'CREATE') {
        await request<{ data: unknown }>('/api/hera/memory', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: memoryProposal.content, category: memoryProposal.category, sourceConversationId: detail.conversation.id, explicitConsent: true }),
        })
      } else if (memoryProposal.operation === 'UPDATE' && memoryProposal.id) {
        await request<{ data: unknown }>('/api/hera/memory', {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: memoryProposal.id, content: memoryProposal.content, category: memoryProposal.category, explicitConsent: true }),
        })
      } else if (memoryProposal.operation === 'DELETE' && memoryProposal.id) {
        await request<{ data: unknown }>(`/api/hera/memory?id=${encodeURIComponent(memoryProposal.id)}`, { method: 'DELETE' })
      } else {
        throw new Error('HERA_MEMORY_PROPOSAL_INVALID')
      }
      setMemoryProposal(null)
    } catch { setError(labels.error) }
  }

  const rail = (
    <aside className="flex min-h-0 flex-col border-b bg-surface-raised p-3 md:border-b-0 md:border-r" aria-label={labels.title}>
      <button className="button-primary w-full justify-center gap-2 rounded-xl px-3 py-2.5" onClick={() => void createConversation()} type="button"><Plus aria-hidden="true" size={16} />{labels.newConversation}</button>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {conversations.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">{labels.noConversations}</p> : <ul className="space-y-1">{conversations.map((conversation) => (
          <li key={conversation.id}><button className={`w-full rounded-xl px-3 py-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${detail?.conversation.id === conversation.id ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted'}`} onClick={() => { void loadConversation(conversation.id); setRailOpen(false) }} type="button"><span className="block truncate">{conversation.title}</span><span className="mt-1 block text-xs font-normal opacity-70">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(conversation.updated_at))}</span></button></li>
        ))}</ul>}
      </div>
    </aside>
  )

  return (
    <section className="relative mx-auto flex h-[calc(100dvh-5rem)] min-h-[38rem] w-full max-w-[100rem] overflow-hidden rounded-3xl border bg-surface shadow-[0_24px_70px_-46px_var(--primary)]">
      <div className="hidden w-72 shrink-0 md:block">{rail}</div>
      {railOpen ? <div className="absolute inset-0 z-30 grid grid-cols-[minmax(0,18rem)_1fr] bg-foreground/20 md:hidden"><div className="min-w-0 bg-surface shadow-xl">{rail}</div><button aria-label={labels.cancel} onClick={() => setRailOpen(false)} type="button" /></div> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b bg-surface/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><button aria-label={labels.noConversations} className="grid size-10 place-items-center rounded-xl border bg-surface-raised text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus md:hidden" onClick={() => setRailOpen(true)} type="button"><Menu aria-hidden="true" size={18} /></button><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Sparkles aria-hidden="true" size={17} /></span><div className="min-w-0"><h1 className="truncate text-sm font-semibold text-foreground">{detail?.conversation.title ?? labels.title}</h1><p className="truncate text-xs text-muted-foreground">{labels.subtitle}</p></div></div>
          <div className="flex items-center gap-1"><button aria-label={labels.settings} className="grid size-9 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus" onClick={() => setSettingsOpen(true)} type="button"><Settings2 aria-hidden="true" size={16} /></button>{detail ? <><button aria-label={labels.renameConversation} className="grid size-9 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus" onClick={() => void renameConversation()} type="button"><Edit3 aria-hidden="true" size={16} /></button><a aria-label={labels.exportConversation} className="grid size-9 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus" href={`/api/hera/conversations/${detail.conversation.id}/export?format=markdown`}><Download aria-hidden="true" size={16} /></a><button aria-label={labels.deleteConversation} className="grid size-9 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-destructive-surface hover:text-destructive focus-visible:ring-2 focus-visible:ring-focus" onClick={() => void deleteConversation()} type="button"><Trash2 aria-hidden="true" size={16} /></button></> : null}</div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {screenState === 'loading' ? <div className="grid h-full place-items-center text-center"><LoaderCircle aria-hidden="true" className="animate-spin text-accent-foreground" size={25} /><p className="mt-3 text-sm text-muted-foreground">{labels.sending}</p></div> : null}
          {screenState === 'error' ? <div className="mx-auto max-w-xl rounded-2xl border border-destructive/25 bg-destructive-surface p-5 text-center"><p className="text-sm font-medium text-destructive">{labels.error}</p><button className="button-secondary mt-4" onClick={() => void loadConversations()} type="button">{labels.send}</button></div> : null}
          {screenState === 'empty' ? <div className="mx-auto grid h-full max-w-lg place-items-center text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl border bg-accent text-accent-foreground"><MessageCircleHeart aria-hidden="true" size={25} /></span><h2 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{labels.emptyTitle}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.emptyDescription}</p>{!detail ? <button className="button-primary mt-6 gap-2" onClick={() => void createConversation()} type="button"><Plus aria-hidden="true" size={16} />{labels.newConversation}</button> : null}</div></div> : null}
          {screenState === 'conversation' && detail ? <ol className="mx-auto flex max-w-3xl flex-col gap-4">{detail.messages.map((message) => { const evidence = evidenceFromMessageMetadata(message.metadata); return <li className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${messageClass(message.role)}`} key={message.id}>{message.content.split('\n').map((line, index) => <p key={`${message.id}-${index}`}>{line || '\u00a0'}</p>)}{evidence ? <HeRaScopeLine evidence={evidence} labels={labels} /> : null}</li> })}</ol> : null}
          <HeRaControlCard draft={draft} labels={labels} onCancel={() => void cancelDraft()} onConfirm={() => void confirmDraft()} />
          <HeRaControlCard labels={labels} memoryProposal={memoryProposal} onCancel={() => setMemoryProposal(null)} onConfirm={() => void saveMemory()} />
        </main>

        <footer className="border-t bg-surface p-3 sm:p-4"><form className="mx-auto flex max-w-3xl items-end gap-2" onSubmit={sendMessage}><label className="sr-only" htmlFor="hera-message">{labels.composerPlaceholder}</label><textarea className="min-h-12 max-h-36 flex-1 resize-y rounded-2xl border bg-surface-raised px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-focus focus:ring-2 focus:ring-focus" disabled={!detail || isSending} id="hera-message" name="message" placeholder={labels.composerPlaceholder} rows={1} /><button aria-label={isSending ? labels.sending : labels.send} className="button-primary grid size-12 shrink-0 place-items-center rounded-2xl p-0 disabled:cursor-not-allowed disabled:opacity-60" disabled={!detail || isSending} type="submit">{isSending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <Send aria-hidden="true" size={18} />}</button></form></footer>
      </div>
      <HeRaSettings labels={labels} onClose={() => setSettingsOpen(false)} open={settingsOpen} />
    </section>
  )
}
