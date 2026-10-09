import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireRole = vi.fn()
const createAdminClient = vi.fn()

vi.mock('@/app/actions/auth', () => ({ requireRole }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

function createQuery(result: { data?: unknown; error?: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
  }
  return query
}

describe('preparation actions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireRole.mockResolvedValue({ id: 7, role: 'owner' })
  })

  it('rejects non-owners before calling the rpc', async () => {
    requireRole.mockResolvedValue(null)
    const rpc = vi.fn()
    createAdminClient.mockReturnValue({ rpc })
    const { markBookingPrepared } = await import('./preparation-actions')

    await expect(markBookingPrepared(10)).resolves.toEqual({ ok: false, error: 'Owner access required.' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects an order belonging to another operator', async () => {
    const admin = { from: vi.fn(() => createQuery({ data: null, error: null })) }
    createAdminClient.mockReturnValue(admin)
    const { markBookingPrepared } = await import('./preparation-actions')

    await expect(markBookingPrepared(10)).resolves.toEqual({ ok: false, error: 'Order was not found or is not ready.' })
  })

  it('passes summed booking usage and operator id to mark_prepared', async () => {
    const booking = createQuery({ data: { BookingID: 10, OperatorID: 7, GuestCount: 4, Status: 'confirmed', EventDate: '2026-10-10' }, error: null })
    const items = createQuery({ data: [{ MenuItemID: 3, Quantity: 1 }], error: null })
    const recipes = createQuery({ data: [{ MenuItemID: 3, IngredientID: 9, QuantityRequiredPerServing: 2 }], error: null })
    const rpc = vi.fn(async () => ({ data: 1, error: null }))
    createAdminClient.mockReturnValue({ from: vi.fn((table: string) => table === 'BOOKING' ? booking : table === 'BOOKING_ITEM' ? items : recipes), rpc })
    const { markBookingPrepared } = await import('./preparation-actions')

    await expect(markBookingPrepared(10)).resolves.toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('mark_prepared', expect.objectContaining({ p_operator_id: 7, p_usage: [{ ingredientId: 9, quantity: 8 }] }))
  })

  it('returns already-prepared rpc errors cleanly', async () => {
    const order = createQuery({ data: { BookingID: 10, OperatorID: 7, GuestCount: 1, Status: 'confirmed', EventDate: '2026-10-10' }, error: null })
    const empty = createQuery({ data: [], error: null })
    createAdminClient.mockReturnValue({ from: vi.fn((table: string) => table === 'BOOKING' ? order : empty), rpc: vi.fn(async () => ({ error: { message: 'ERROR: This order or meal-prep cycle is already prepared' } })) })
    const { markBookingPrepared } = await import('./preparation-actions')

    await expect(markBookingPrepared(10)).resolves.toEqual({ ok: false, error: 'This order or meal-prep cycle is already prepared' })
  })

  it('returns short-stock errors with the ingredient name', async () => {
    const order = createQuery({ data: { BookingID: 10, OperatorID: 7, GuestCount: 1, Status: 'confirmed', EventDate: '2026-10-10' }, error: null })
    const empty = createQuery({ data: [], error: null })
    createAdminClient.mockReturnValue({ from: vi.fn((table: string) => table === 'BOOKING' ? order : empty), rpc: vi.fn(async () => ({ error: { message: 'ERROR: Insufficient stock for Rice' } })) })
    const { markBookingPrepared } = await import('./preparation-actions')

    await expect(markBookingPrepared(10)).resolves.toEqual({ ok: false, error: 'Insufficient stock for Rice' })
  })
})
