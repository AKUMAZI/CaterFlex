import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/actions/auth', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/macroflex', () => ({ getReservedIngredients: vi.fn() }))

import { validateInventoryQuantity } from './inventory-actions'

describe('inventory quantity validation', () => {
  it('accepts zero and positive integers', () => {
    expect(validateInventoryQuantity(0)).toBeNull()
    expect(validateInventoryQuantity(12)).toBeNull()
  })

  it('rejects decimal stock and capacity values', () => {
    expect(validateInventoryQuantity(1.5)).toContain('whole numbers')
  })

  it('rejects negative stock and capacity values', () => {
    expect(validateInventoryQuantity(-1)).toContain('greater than or equal to 0')
  })
})
