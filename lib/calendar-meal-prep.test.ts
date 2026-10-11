import { describe, expect, it } from 'vitest'
import { expandMealPrepOrdersForMonth, type CalendarMealPrepOrder } from './calendar-meal-prep'

const order = (overrides: Partial<CalendarMealPrepOrder> = {}): CalendarMealPrepOrder => ({ id: 1, customerName: 'Alex', status: 'active', nextFulfillmentDate: '2026-01-29', recurrencePattern: 'weekly', mealsPerCycle: 6, ...overrides })

describe('expandMealPrepOrdersForMonth', () => {
  it('repeats weekly across months beyond 28 days', () => {
    expect(expandMealPrepOrdersForMonth([order()], 2026, 3).map((x) => x.fulfillmentDate)).toEqual(['2026-03-05', '2026-03-12', '2026-03-19', '2026-03-26'])
  })
  it('repeats biweekly', () => {
    expect(expandMealPrepOrdersForMonth([order({ recurrencePattern: 'biweekly', nextFulfillmentDate: '2026-03-01' })], 2026, 3).map((x) => x.fulfillmentDate)).toEqual(['2026-03-01', '2026-03-15', '2026-03-29'])
  })
  it('shows one-time orders once', () => {
    expect(expandMealPrepOrdersForMonth([order({ recurrencePattern: 'one-time', nextFulfillmentDate: '2026-03-10' })], 2026, 3).map((x) => x.fulfillmentDate)).toEqual(['2026-03-10'])
  })
  it('includes valid statuses and excludes cancelled, rejected, and archived orders', () => {
    const orders = ['pending', 'active', 'paused', 'cancelled', 'rejected', 'active'].map((status, index) => order({ id: index, status, isArchived: index === 5 }))
    expect(expandMealPrepOrdersForMonth(orders, 2026, 1).map((x) => x.status)).toEqual(['pending', 'active', 'paused'])
  })
  it('uses date-only arithmetic independent of timezone', () => {
    const dates = expandMealPrepOrdersForMonth([order({ nextFulfillmentDate: '2026-03-01' })], 2026, 3).map((x) => x.fulfillmentDate)
    expect(dates).toEqual(['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22', '2026-03-29'])
  })
})
