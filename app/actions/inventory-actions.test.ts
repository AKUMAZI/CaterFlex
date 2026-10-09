import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireRole = vi.fn()
const createAdminClient = vi.fn()
const getReservedIngredients = vi.fn()

vi.mock('@/app/actions/auth', () => ({ requireRole }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient }))
vi.mock('@/lib/macroflex', () => ({ getReservedIngredients }))

describe('owner reserved inventory action', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects non-owners without loading reserved inventory', async () => {
    requireRole.mockResolvedValue(null)
    const { getOwnerReservedIngredients } = await import('./inventory-actions')

    await expect(getOwnerReservedIngredients()).resolves.toEqual({ ok: false, error: 'Owner access required.' })
    expect(getReservedIngredients).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
