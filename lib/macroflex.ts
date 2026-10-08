import { supabase } from './supabase'

export interface IngredientShortfall {
  ingredientName: string
  required: number
  available: number
  shortBy: number
  unitOfMeasure: string
  allocated?: number
}

export interface SufficiencyCheckResult {
  sufficient: boolean
  hasNoIngredients: boolean
  shortfalls: IngredientShortfall[]
}

export interface OverPurchasedIngredient {
  ingredientName: string
  currentStock: number
  maxCapacity: number
  exceededBy: number
  unitOfMeasure: string
}

export interface ScrapSuggestion {
  menuItemId: number
  itemName: string
  category: string
  price: number
  usesLeftover: Array<{ ingredientName: string; quantity: number; unitOfMeasure: string }>
}

export interface ScrapSuggestionResult { alternatives: ScrapSuggestion[] }

export interface AllocationCommitment {
  ref: number
  prepStartDate: string
  fulfillmentDate: string
  quantities: Record<number, number>
}

/** FR-8.3 / thesis sections 3.2.3–3.2.4: only overlapping commitments consume stock. */
export function calculateAllocatedQuantity(
  ingredientId: number,
  window: { prepStartDate: string; fulfillmentDate: string },
  commitments: AllocationCommitment[],
  excludeRef?: number,
): number {
  return commitments
    .filter((commitment) => commitment.ref !== excludeRef)
    .filter((commitment) => commitment.prepStartDate <= window.fulfillmentDate && commitment.fulfillmentDate >= window.prepStartDate)
    .reduce((total, commitment) => total + (commitment.quantities[ingredientId] ?? 0), 0)
}

async function getMenuIngredients(menuItemId: number) {
  return supabase.from('DISH_INGREDIENT').select('IngredientID, QuantityRequiredPerServing, INGREDIENT:INGREDIENT(IngredientID, IngredientName, UnitOfMeasure, CurrentStock)').eq('MenuItemID', menuItemId)
}

export async function checkSufficiency(menuItemId: number, quantity = 1): Promise<SufficiencyCheckResult> {
  const { data, error } = await getMenuIngredients(menuItemId)
  if (error) throw error
  if (!data?.length) return { sufficient: true, hasNoIngredients: true, shortfalls: [] }
  const shortfalls: IngredientShortfall[] = []
  for (const row of data) {
    const ingredient = Array.isArray(row.INGREDIENT) ? row.INGREDIENT[0] : row.INGREDIENT
    if (!ingredient) continue
    const required = Number(row.QuantityRequiredPerServing ?? 0) * quantity
    const available = Number(ingredient.CurrentStock ?? 0)
    if (available < required) shortfalls.push({ ingredientName: ingredient.IngredientName, required, available, shortBy: required - available, unitOfMeasure: ingredient.UnitOfMeasure })
  }
  return { sufficient: shortfalls.length === 0, hasNoIngredients: false, shortfalls }
}

export async function checkSufficiencyWithAllocations(
  menuItemId: number,
  quantity: number,
  prepStartDate: string,
  fulfillmentDate: string,
  excludeRef?: number,
): Promise<SufficiencyCheckResult> {
  const { data, error } = await getMenuIngredients(menuItemId)
  if (error) throw error
  if (!data?.length) return { sufficient: true, hasNoIngredients: true, shortfalls: [] }

  const [{ data: bookings }, { data: mealPrepOrders }] = await Promise.all([
    supabase.from('BOOKING').select('BookingID, EventDate, GuestCount, BOOKING_ITEM(MenuItemID, Quantity)').eq('Status', 'confirmed'),
    supabase.from('MEAL_PREP_ORDER').select('MealPrepOrderID, NextFulfillmentDate, RecurrencePattern, MealsPerCycle, MEAL_PREP_ITEM(MenuItemID, Quantity)').eq('Status', 'active').not('NextFulfillmentDate', 'is', null),
  ])
  const commitments: AllocationCommitment[] = []
  const addCommitment = (ref: number, date: string, prepDays: number, items: any[], fallback: number) => {
    const start = new Date(`${date}T00:00:00`)
    start.setDate(start.getDate() - Math.max(0, prepDays))
    const quantities: Record<number, number> = {}
    for (const item of items ?? []) quantities[Number(item.MenuItemID)] = Number(item.Quantity ?? fallback)
    commitments.push({ ref, prepStartDate: start.toISOString().slice(0, 10), fulfillmentDate: date, quantities })
  }
  const menuIds = [...new Set([menuItemId, ...(bookings ?? []).flatMap((b: any) => (b.BOOKING_ITEM ?? []).map((i: any) => Number(i.MenuItemID))), ...(mealPrepOrders ?? []).flatMap((o: any) => (o.MEAL_PREP_ITEM ?? []).map((i: any) => Number(i.MenuItemID)))])]
  const { data: menus } = await supabase.from('MENU_ITEM').select('MenuItemID, PrepTimeDays').in('MenuItemID', menuIds)
  const prepDays = new Map((menus ?? []).map((m: any) => [Number(m.MenuItemID), Number(m.PrepTimeDays ?? 0)]))
  for (const booking of bookings ?? []) addCommitment(Number(booking.BookingID), String(booking.EventDate).slice(0, 10), Math.max(...(booking.BOOKING_ITEM ?? []).map((i: any) => prepDays.get(Number(i.MenuItemID)) ?? 0), 0), booking.BOOKING_ITEM, Number(booking.GuestCount ?? 1))
  for (const order of mealPrepOrders ?? []) addCommitment(Number(order.MealPrepOrderID), String(order.NextFulfillmentDate).slice(0, 10), Math.max(...(order.MEAL_PREP_ITEM ?? []).map((i: any) => prepDays.get(Number(i.MenuItemID)) ?? 0), 0), order.MEAL_PREP_ITEM, Number(order.MealsPerCycle ?? 1))

  const shortfalls: IngredientShortfall[] = []
  for (const row of data) {
    const ingredient = Array.isArray(row.INGREDIENT) ? row.INGREDIENT[0] : row.INGREDIENT
    if (!ingredient) continue
    const required = Number(row.QuantityRequiredPerServing ?? 0) * quantity
    const allocated = calculateAllocatedQuantity(Number(ingredient.IngredientID ?? row.IngredientID), { prepStartDate, fulfillmentDate }, commitments, excludeRef)
    const available = Math.max(0, Number(ingredient.CurrentStock ?? 0) - allocated)
    if (available < required) shortfalls.push({ ingredientName: ingredient.IngredientName, required, available, shortBy: required - available, unitOfMeasure: ingredient.UnitOfMeasure, allocated })
  }
  return { sufficient: shortfalls.length === 0, hasNoIngredients: false, shortfalls }
}

export async function checkOverPurchase(operatorId?: number): Promise<{ overPurchased: OverPurchasedIngredient[] }> {
  let query = supabase.from('INGREDIENT').select('IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity')
  if (operatorId !== undefined) query = query.eq('OperatorID', operatorId)
  const { data, error } = await query
  if (error) throw error
  return { overPurchased: (data ?? []).filter((i: any) => Number(i.CurrentStock ?? 0) > Number(i.MaxStorageCapacity)).map((i: any) => ({ ingredientName: i.IngredientName, currentStock: Number(i.CurrentStock ?? 0), maxCapacity: Number(i.MaxStorageCapacity), exceededBy: Number(i.CurrentStock ?? 0) - Number(i.MaxStorageCapacity), unitOfMeasure: i.UnitOfMeasure })) }
}

/** FR-7.6: scraps come only from ingredients that are positive but insufficient for the failed dish. */
export async function getScrapBasedSuggestions(failedMenuItemId: number): Promise<ScrapSuggestionResult> {
  const { data: failed, error: failedError } = await getMenuIngredients(failedMenuItemId)
  if (failedError) throw failedError
  const leftovers = new Map<number, { name: string; quantity: number; unit: string }>()
  for (const row of failed ?? []) {
    const ingredient = Array.isArray(row.INGREDIENT) ? row.INGREDIENT[0] : row.INGREDIENT
    const required = Number(row.QuantityRequiredPerServing ?? 0)
    const stock = Number(ingredient?.CurrentStock ?? 0)
    if (ingredient && stock > 0 && stock < required) leftovers.set(Number(ingredient.IngredientID ?? row.IngredientID), { name: ingredient.IngredientName, quantity: stock, unit: ingredient.UnitOfMeasure })
  }
  if (!leftovers.size) return { alternatives: [] }
  const { data: items, error } = await supabase.from('MENU_ITEM').select('MenuItemID, ItemName, Category, Price, DISH_INGREDIENT(IngredientID, QuantityRequiredPerServing, INGREDIENT:INGREDIENT(IngredientID, IngredientName, UnitOfMeasure))').neq('MenuItemID', failedMenuItemId)
  if (error) throw error
  const alternatives = (items ?? []).filter((item: any) => {
    const requirements = item.DISH_INGREDIENT ?? []
    return requirements.length > 0 && requirements.every((r: any) => leftovers.has(Number(r.IngredientID)) && leftovers.get(Number(r.IngredientID))!.quantity >= Number(r.QuantityRequiredPerServing ?? 0))
  }).map((item: any) => ({ menuItemId: Number(item.MenuItemID), itemName: item.ItemName, category: item.Category, price: Number(item.Price), usesLeftover: (item.DISH_INGREDIENT ?? []).map((r: any) => ({ ingredientName: leftovers.get(Number(r.IngredientID))!.name, quantity: Number(r.QuantityRequiredPerServing ?? 0), unitOfMeasure: leftovers.get(Number(r.IngredientID))!.unit })) }))
  return { alternatives }
}

export async function getScrapSuggestions(failedMenuItemId: number) { return getScrapBasedSuggestions(failedMenuItemId) }
