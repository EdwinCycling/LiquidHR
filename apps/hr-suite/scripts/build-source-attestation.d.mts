export interface BuildSourceAttestationInput {
  sourceCommit: unknown
  platformCommit: string | null
  attestedCommit: unknown
}

export declare function matchesBuildSourceAttestation(input: BuildSourceAttestationInput): boolean

export declare function unexpectedTrackedBuildSourceChanges(
  statusOutput: string,
  vercelIgnorePatterns?: string[],
): string[]
