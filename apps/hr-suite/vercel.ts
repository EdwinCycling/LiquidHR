export const config = {
  framework: 'nextjs',
  git: {
    deploymentEnabled: false,
  },
  regions: ['cdg1'],
  // The strict source check runs from the Project Settings install hook before
  // Vercel compiles this config. This second install step must stay npm ci only.
  installCommand: 'npm ci',
  buildCommand: 'npm run build --workspace @liquid-hr/hr-suite',
  ignoreCommand: 'node ../../scripts/vercel-ignore-build.mjs',
  outputDirectory: '.next',
  crons: [
    { path: '/api/cron/recruitment-retention', schedule: '0 3 * * *' },
    { path: '/api/cron/process-automation-reminders', schedule: '0 6 * * *' },
  ],
} as const
