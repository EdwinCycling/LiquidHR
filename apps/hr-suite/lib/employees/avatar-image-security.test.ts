import { describe, expect, it, vi } from 'vitest'

const { block, sharpFactory } = vi.hoisted(() => ({
  block: vi.fn(),
  sharpFactory: vi.fn(),
}))

vi.mock('sharp', () => ({
  default: Object.assign(sharpFactory, { block }),
}))

describe('avatar decoder security boundary', () => {
  it('blocks HEIF loading and rejects AVIF bytes before constructing a Sharp decoder', async () => {
    const { compactEmployeeAvatar } = await import('./avatar-image')
    const avif = Uint8Array.from([
      0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70,
      0x61, 0x76, 0x69, 0x66, 0, 0, 0, 0,
    ])

    await expect(compactEmployeeAvatar(new File([avif], 'avatar.jpg', { type: 'image/jpeg' }))).rejects.toMatchObject({
      code: 'EMPLOYEE_AVATAR_INPUT_INVALID',
      status: 400,
    })
    expect(block).toHaveBeenCalledWith({ operation: ['VipsForeignLoadHeif'] })
    expect(sharpFactory).not.toHaveBeenCalled()
  })
})
