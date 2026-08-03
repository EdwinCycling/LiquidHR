const REQUIRED_PUBLIC_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const

export function controlEnvironmentIsConfigured(): boolean {
  return REQUIRED_PUBLIC_ENV.every((name) => Boolean(process.env[name]))
}

export function getControlEnvironment() {
  if (!controlEnvironmentIsConfigured()) {
    throw new Error('CONTROL_ENVIRONMENT_NOT_CONFIGURED')
  }
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
  }
}
