export const API_RATE_LIMIT_RESOURCE_KEYS = [
  'workforce-summary',
  'team-skills',
  'development-plans',
] as const

export type ApiRateLimitResource = (typeof API_RATE_LIMIT_RESOURCE_KEYS)[number]
