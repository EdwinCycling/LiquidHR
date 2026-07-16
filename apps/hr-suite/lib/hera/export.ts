export interface HeRaExportMessage {
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  content: string
  createdAt: string
  modelId?: string | null
  systemPrompt?: string
  rawToolPayload?: unknown
}

interface HeRaExportInput {
  conversation: { id: string; title: string; createdAt: string }
  messages: HeRaExportMessage[]
}

export function toHeRaExport(input: HeRaExportInput) {
  const messages = input.messages.map(({ role, content, createdAt, modelId }) => ({ role, content, createdAt, modelId: modelId ?? null }))
  const markdown = [
    `# ${input.conversation.title}`,
    '',
    `Gestart: ${input.conversation.createdAt}`,
    '',
    ...messages.flatMap((message) => [`## ${message.role}`, message.content, `_${message.createdAt}_`, '']),
  ].join('\n')

  return {
    markdown,
    json: {
      conversation: input.conversation,
      messages,
    },
  }
}
