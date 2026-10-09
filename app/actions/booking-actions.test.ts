import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireRole = vi.fn()
const createAdminClient = vi.fn()
vi.mock('@/app/actions/auth', () => ({ requireRole }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/rules/bookingValidation', () => ({ validateBooking: vi.fn(() => ({ valid: true, errors: [] })) }))
vi.mock('@/lib/rules/allocation', () => ({
  computeBookingTotal: vi.fn(() => 0),
  servingsForBookingItem: vi.fn((value: number | null, guests: number) => value ?? guests),
}))

function query(result: { data?: unknown; error?: { message: string } | null }) {
  const q = {
    select: vi.fn(() => q), eq: vi.fn(() => q), in: vi.fn(() => q),
    maybeSingle: vi.fn(async () => result),
    upsert: vi.fn(async () => ({ error: null })),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
  }
  return q
}

async function loadAction() {
  vi.resetModules()
  return import('./booking-actions')
}

describe('updateBookingItemServings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRole.mockResolvedValue({ id: 7, role: 'owner' })
  })

  it('rejects a non-owner without writing', async () => {
    requireRole.mockResolvedValue(null)
    const upsert = vi.fn()
    createAdminClient.mockReturnValue({ from: vi.fn(() => ({ upsert })) })
    const { updateBookingItemServings } = await loadAction()
    await expect(updateBookingItemServings(10, [{ bookingItemId: 1, servings: 2 }])).resolves.toMatchObject({ ok: false })
    expect(upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['another operator booking', { BookingID: 10, OperatorID: 9, Status: 'pending' }, [{ bookingItemId: 1, servings: 2 }]],
    ['non-pending booking', { BookingID: 10, OperatorID: 7, Status: 'confirmed' }, [{ bookingItemId: 1, servings: 2 }]],
    ['zero servings', { BookingID: 10, OperatorID: 7, Status: 'pending' }, [{ bookingItemId: 1, servings: 0 }]],
    ['fractional servings', { BookingID: 10, OperatorID: 7, Status: 'pending' }, [{ bookingItemId: 1, servings: 2.5 }]],
    ['item from another booking', { BookingID: 10, OperatorID: 7, Status: 'pending' }, [{ bookingItemId: 99, servings: 2 }]],
  ])('rejects %s and makes no write', async (_name, booking, items) => {
    const upsert = vi.fn()
    const admin = { from: vi.fn((table: string) => table === 'BOOKING'
      ? query({ data: booking, error: null })
      : Object.assign(query({ data: [{ BookingItemID: 1, MenuItemID: 4 }], error: null }), { upsert })) }
    createAdminClient.mockReturnValue(admin)
    const { updateBookingItemServings } = await loadAction()
    await expect(updateBookingItemServings(10, items)).resolves.toMatchObject({ ok: false })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('upserts every valid item with its booking and menu item', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    const admin = { from: vi.fn((table: string) => table === 'BOOKING'
      ? query({ data: { BookingID: 10, OperatorID: 7, Status: 'pending' }, error: null })
      : Object.assign(query({ data: [{ BookingItemID: 1, MenuItemID: 4 }, { BookingItemID: 2, MenuItemID: 5 }], error: null }), { upsert })) }
    createAdminClient.mockReturnValue(admin)
    const { updateBookingItemServings } = await loadAction()
    await expect(updateBookingItemServings(10, [{ bookingItemId: 1, servings: 3 }, { bookingItemId: 2, servings: 6 }])).resolves.toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledWith([
      { BookingItemID: 1, BookingID: 10, MenuItemID: 4, Quantity: 3 },
      { BookingItemID: 2, BookingID: 10, MenuItemID: 5, Quantity: 6 },
    ], { onConflict: 'BookingItemID' })
  })
})
