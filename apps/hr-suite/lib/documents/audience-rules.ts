export function canAccessDocument(input: { hasPermission: boolean; audienceMatches: boolean }): boolean {
  return input.hasPermission && input.audienceMatches
}
