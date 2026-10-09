import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import { checkOrderSufficiencyWithAllocations, checkSufficiencyWithAllocations } from './macroflex'

type Row = Record<string, unknown>

const menus: Row[] = [
  { MenuItemID: 20, ItemName: 'Dish 20', PrepTimeDays: 0 },
  { MenuItemID: 21, ItemName: 'Dish 21', PrepTimeDays: 0 },
]
const recipes: Row[] = [
  { MenuItemID: 20, IngredientID: 39, QuantityRequiredPerServing: 1, INGREDIENT: { IngredientID: 39, IngredientName: 'Rice', UnitOfMeasure: 'kg', CurrentStock: 10 } },
  { MenuItemID: 21, IngredientID: 39, QuantityRequiredPerServing: 2, INGREDIENT: { IngredientID: 39, IngredientName: 'Rice', UnitOfMeasure: 'kg', CurrentStock: 10 } },
]

function fakeClient(extraMealPrep: Row[] = [], includeBooking = true) {
  const tables: Record<string, Row[]> = {
    MENU_ITEM: menus,
    DISH_INGREDIENT: recipes,
    BOOKING: includeBooking ? [{ BookingID: 38, EventDate: '2026-10-24', GuestCount: 4, Status: 'confirmed', BOOKING_ITEM: [{ MenuItemID: 21, Quantity: 4 }] }] : [],
    MEAL_PREP_ORDER: extraMealPrep,
  }
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query },
        not: () => query,
        lte: (key: string, value: unknown) => { rows = rows.filter((row) => String(row[key]) <= String(value)); return query },
        in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return query },
        then: (resolve: (result: { data: Row[]; error: null }) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
      }
      return query
    },
  } as never
}

describe('macroflex allocation regressions', () => {
  it('loads recipes for dishes in other confirmed bookings', async () => {
    const result = await checkSufficiencyWithAllocations(20, 5, '2026-10-24', '2026-10-24', undefined, fakeClient())
    expect(result.sufficient).toBe(false)
    expect(result.shortfalls[0]).toMatchObject({ ingredientName: 'Rice', allocated: 8, available: 2, shortBy: 3 })
  })

  it('applies the same commitment allocation to order checks and exclusions', async () => {
    const client = fakeClient()
    const result = await checkOrderSufficiencyWithAllocations([{ menuItemId: 20 }], 5, '2026-10-24', undefined, client)
    expect(result.shortfalls[0]).toMatchObject({ allocated: 8, available: 2, shortBy: 3 })
    await expect(checkSufficiencyWithAllocations(20, 5, '2026-10-24', '2026-10-24', { type: 'booking', id: 38 }, fakeClient())).resolves.toMatchObject({ sufficient: true })
    await expect(checkSufficiencyWithAllocations(20, 5, '2026-10-31', '2026-10-31', undefined, fakeClient())).resolves.toMatchObject({ sufficient: true })
  })

  it('counts active weekly meal prep orders on recurring dates', async () => {
    const client = fakeClient([{ MealPrepOrderID: 38, NextFulfillmentDate: '2026-10-24', RecurrencePattern: 'weekly', MealsPerCycle: 3, Status: 'active', MEAL_PREP_ITEM: [{ MenuItemID: 21, Quantity: 1 }] }], false)
    const result = await checkSufficiencyWithAllocations(20, 5, '2026-10-24', '2026-10-24', undefined, client)
    expect(result.shortfalls[0]).toMatchObject({ allocated: 6, available: 4, shortBy: 1 })
  })
})
