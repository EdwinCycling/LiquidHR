type AttachmentStorageKeyBinding = {
  storage_key: string
  tenant_id: string
  item_id: string
  id: string
}

export function isContinuousAppraisalAttachmentStorageKey(binding: AttachmentStorageKeyBinding): boolean {
  const parts = binding.storage_key.split('/')
  return parts.length === 4
    && parts[0] === binding.tenant_id
    && parts[1] === binding.item_id
    && parts[2] === binding.id
    && parts[3] !== ''
}
