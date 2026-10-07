export const API_RATE_LIMIT_RESOURCE_KEYS = [
  'workforce-summary',
  'team-skills',
  'development-plans',
  'employee-self-service',
] as const

export type ApiRateLimitResource = (typeof API_RATE_LIMIT_RESOURCE_KEYS)[number]
