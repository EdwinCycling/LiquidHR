import { isLocalPersonaRuntime } from '@/lib/auth/test-role-switch'
export function localFiscalRequestOrigin(host: string | null, requestUrl: string, origin: string | null): string | null {
  if (!host || !isLocalPersonaRuntime(host) || !origin) return null
  try {
    const request=new URL(requestUrl)
    const supplied=new URL(origin)
    if(request.protocol!=='http:'||supplied.protocol!=='http:'||supplied.username||supplied.password
      ||supplied.pathname!=='/'||supplied.search||supplied.hash
      ||!isLocalPersonaRuntime(request.host)||!isLocalPersonaRuntime(supplied.host)
      ||supplied.host.toLowerCase()!==host.trim().toLowerCase())return null
    return supplied.origin
  }catch{return null}
}
