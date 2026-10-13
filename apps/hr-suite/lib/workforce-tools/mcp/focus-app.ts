import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/server'
import type { ChatGptMcpLocale } from './chatgpt-metadata'
import { CHATGPT_FOCUS_WIDGET_HTML } from './focus-widget-resource'

export const CHATGPT_FOCUS_RESOURCE_URI = 'ui://liquidhr-focus/development-plans'
export const CHATGPT_FOCUS_TOOL_ID = 'employee.talent.development-plans.read'

/** Reuse the existing self read tool; no MCP tool IDs are added for the widget. */
export const CHATGPT_FOCUS_TOOL_METADATA = {
  ui: {
    resourceUri: CHATGPT_FOCUS_RESOURCE_URI,
    visibility: ['app'],
  },
  'openai/ui': {
    entrypoints: [{ type: 'global' }, { type: 'thread' }],
  },
} as const

export function registerChatGptFocusAppResource(server: McpServer, locale: ChatGptMcpLocale): void {
  const title = 'LiquidHR Focus'
  const description = locale === 'nl'
    ? 'Interactieve, alleen-lezen kaart voor eigen ontwikkelplannen.'
    : 'Interactive read-only card for personal development plans.'

  registerAppResource(server, title, CHATGPT_FOCUS_RESOURCE_URI, {
    description,
    _meta: {
      ui: {
        csp: {
          connectDomains: [],
          resourceDomains: [],
          frameDomains: [],
          baseUriDomains: [],
        },
        prefersBorder: true,
      },
    },
  }, async () => ({
    contents: [{
      uri: CHATGPT_FOCUS_RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: CHATGPT_FOCUS_WIDGET_HTML,
      _meta: {
        ui: {
          csp: {
            connectDomains: [],
            resourceDomains: [],
            frameDomains: [],
            baseUriDomains: [],
          },
          prefersBorder: true,
        },
      },
    }],
  }))
}
