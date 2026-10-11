import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireRole = vi.fn()
const createAdminClient = vi.fn()
const createNotification = vi.fn()
const validateBooking = vi.fn((): { valid: boolean; errors: string[]; failures: { message: string }[] } => ({ valid: true, errors: [], failures: [] }))
vi.mock('@/app/actions/auth', () => ({ requireRole }))
vi.mock('@/lib/supabase-admin', () => ({ createAdminClient }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ createNotification }))
vi.mock('@/lib/rules/bookingValidation', () => ({ validateBooking }))
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

describe('createMealPrepOrder capacity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRole.mockResolvedValue({ id: 42, role: 'customer' })
  })

  it('blocks a third active order at the daily limit and notifies the owner', async () => {
    const activeStatusFilter = vi.fn()
    const prepQuery = (result: { data?: unknown; error?: { message: string } | null }) => {
      const q = {
        select: vi.fn(() => q), eq: vi.fn(() => q), in: activeStatusFilter,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
      }
      return q
    }
    activeStatusFilter.mockReturnValue(prepQuery({ data: [
      { MealPrepOrderID: 1, CustomerID: 10, NextFulfillmentDate: '2099-01-01', MealsPerCycle: 1, Status: 'active' },
      { MealPrepOrderID: 2, CustomerID: 11, NextFulfillmentDate: '2099-01-01', MealsPerCycle: 1, Status: 'active' },
    ], error: null }))
    createAdminClient.mockReturnValue({ from: vi.fn((table: string) => {
      if (table === 'CUSTOMER_ALLERGY' || table === 'MENU_ITEM_ALLERGY' || table === 'ALLERGY_TAG') return prepQuery({ data: [], error: null })
      if (table === 'OPERATOR_SETTINGS') return prepQuery({ data: [{ DayOfWeek: 4, OperatingStartTime: '09:00', OperatingEndTime: '17:00', MaxCateringEventsPerDay: 10, MaxMealPrepOrdersPerDay: 2, MaxGuestCountPerEvent: 100 }], error: null })
      return prepQuery({ data: [], error: null })
    }) })
    validateBooking.mockReturnValue({ valid: false, errors: [], failures: [{ message: 'Maximum meal-prep orders reached for this day.' }] })
    const { createMealPrepOrder } = await loadAction()
    await expect(createMealPrepOrder({ eventDate: '2099-01-01', guestCount: 1 }, [{ MenuItemID: 5 }])).resolves.toMatchObject({ ok: false })
    expect(activeStatusFilter).toHaveBeenCalledWith('Status', ['pending', 'active'])
    expect(createNotification).toHaveBeenCalledWith(2, 'capacity_conflict', expect.stringContaining('Maximum meal-prep orders reached'))
  })
})

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

