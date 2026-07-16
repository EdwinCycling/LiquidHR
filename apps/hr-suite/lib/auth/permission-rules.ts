export function toSelfPermission(permissionCode: string): string {
  return permissionCode.startsWith('self:') ? permissionCode : `self:${permissionCode}`
}

