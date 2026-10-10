import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/actions/auth', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient: vi.fn() }))

import { validatePerServingQuantity } from './menu-actions'

describe('per-serving quantity validation', () => {
  it('accepts positive integers', () => {
    expect(validatePerServingQuantity(1)).toBeNull()
    expect(validatePerServingQuantity(24)).toBeNull()
  })

  it('rejects decimals and non-positive values', () => {
    expect(validatePerServingQuantity(1.5)).toContain('whole number')
    expect(validatePerServingQuantity(0)).toContain('greater than or equal to 1')
  })
})
