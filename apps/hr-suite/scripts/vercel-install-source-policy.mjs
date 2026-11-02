export function determineInstallGate({ isVercel, platformCommit, attestationExists }) {
  if (!isVercel && !platformCommit) return 'skip'
  if (!platformCommit || !/^[a-f0-9]{40}$/i.test(platformCommit)) return 'fail'
  return attestationExists ? 'prebuild' : 'strict'
}