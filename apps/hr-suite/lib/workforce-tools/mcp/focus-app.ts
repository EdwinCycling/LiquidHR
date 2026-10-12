import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { projectChatGptDevelopmentPlansResult } from './chatgpt-metadata'
import type { ChatGptMcpLocale } from './chatgpt-metadata'
import { CHATGPT_FOCUS_PLANS_OUTPUT_SCHEMA } from './focus-widget-contract'
import { REMOTE_MCP_RESOURCE_METADATA_URL } from './remote-config'
import { CHATGPT_FOCUS_WIDGET_HTML } from './focus-widget-resource'

export const CHATGPT_FOCUS_OPEN_TOOL_ID = 'liquidhr.focus.open'
export const CHATGPT_FOCUS_PLANS_TOOL_ID = 'liquidhr.focus.development-plans.read'
export const CHATGPT_FOCUS_RESOURCE_URI = 'ui://liquidhr-focus/development-plans'

type RemoteDispatch = (toolId: string, input: unknown) => Promise<unknown>

export function registerChatGptFocusApp(
  server: McpServer,
  dispatchTool: RemoteDispatch | undefined,
  remoteAuthenticationRequired: boolean,
  locale: ChatGptMcpLocale,
): void {
  const localized = locale === 'nl'
    ? { title: 'LiquidHR Focus', ready: 'LiquidHR Focus is geopend. Kies één eigen ontwikkelplan om de toegestane statuscontext te delen.' }
    : { title: 'LiquidHR Focus', ready: 'LiquidHR Focus is open. Choose one of your development plans to share its permitted status context.' }

  registerAppResource(server, localized.title, CHATGPT_FOCUS_RESOURCE_URI, {
    description: locale === 'nl' ? 'Interactieve, alleen-lezen kaart voor eigen ontwikkelplannen.' : 'Interactive read-only card for personal development plans.',
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

  registerAppTool(server, CHATGPT_FOCUS_OPEN_TOOL_ID, {
    title: localized.title,
    description: localized.ready,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: {
      ui: {
        resourceUri: CHATGPT_FOCUS_RESOURCE_URI,
      },
      'openai/ui': {
        entrypoints: [{ type: 'global' }, { type: 'thread' }],
      },
    },
  }, async () => ({
    content: [{ type: 'text', text: localized.ready }],
  }))

  registerAppTool(server, CHATGPT_FOCUS_PLANS_TOOL_ID, {
    title: locale === 'nl' ? 'Focus-kaartgegevens laden' : 'Load Focus card data',
    description: locale === 'nl' ? 'Laadt voor de Focus-kaart uitsluitend de toegestane statusvelden van eigen ontwikkelplannen.' : 'Loads only the permitted status fields of your own development plans for the Focus card.',
    inputSchema: z.object({}).strict(),
    outputSchema: CHATGPT_FOCUS_PLANS_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: {
      ui: {
        resourceUri: CHATGPT_FOCUS_RESOURCE_URI,
        visibility: ['app'],
      },
    },
  }, async () => {
    if (!dispatchTool) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Authentication is required to read LiquidHR workforce data.' }],
        _meta: remoteAuthenticationRequired ? {
          'mcp/www_authenticate': [
            `Bearer resource_metadata="${REMOTE_MCP_RESOURCE_METADATA_URL}", error="insufficient_scope", error_description="Sign in to LiquidHR to continue."`,
          ],
        } : undefined,
      }
    }

    const projected = projectChatGptDevelopmentPlansResult(
      await dispatchTool('employee.talent.development-plans.read', {}),
    )
    const output = CHATGPT_FOCUS_PLANS_OUTPUT_SCHEMA.parse(projected)
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output,
    }
  })
}
