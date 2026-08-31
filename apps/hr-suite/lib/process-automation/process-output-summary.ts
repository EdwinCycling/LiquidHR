const MAX_PROCESS_OUTPUT_SUMMARY_CHARACTERS = 10_000

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

export function processOutputSummaryText(summary: string): string {
  const text = summary
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:article|section|div|h[1-6]|p|dl|dt|dd|ul|ol|li|table|thead|tbody|tr|th|td)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')

  return decodeHtmlEntities(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_PROCESS_OUTPUT_SUMMARY_CHARACTERS)
}
