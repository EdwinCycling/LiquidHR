import { createRoot } from 'react-dom/client'
import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps'
import { ChatGptFocusWidget } from './chatgpt-widget'

const app = new App({ name: 'LiquidHR Focus', version: '1.0.0' })
const root = document.getElementById('root')

function applyHostContext(context: McpUiHostContext | undefined): void {
  if (context?.theme) applyDocumentTheme(context.theme)
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables)
  if (context?.locale) {
    document.documentElement.lang = context.locale.toLowerCase().startsWith('nl') ? 'nl' : 'en'
  }
}

app.addEventListener('hostcontextchanged', (context) => applyHostContext(context))

async function start(): Promise<void> {
  if (!root) return
  try {
    await app.connect(new PostMessageTransport(window, window.parent))
    applyHostContext(app.getHostContext())
    createRoot(root).render(<ChatGptFocusWidget app={app} />)
  } catch {
    root.textContent = navigator.language.toLowerCase().startsWith('nl')
      ? 'LiquidHR Focus kan geen verbinding maken met ChatGPT.'
      : 'LiquidHR Focus could not connect to ChatGPT.'
    root.setAttribute('role', 'alert')
  }
}

void start()
