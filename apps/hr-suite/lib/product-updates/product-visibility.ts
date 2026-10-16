/** Explicit acceptance messages remain in management history, not user surfaces. */
export function isProductAudienceUpdate(title: string): boolean {
  return !/^\s*\[(?:TEST|TEST OWNER|DEMO|FIXTURE|BENCHMARK)\](?:\s|$)/i.test(title)
}
