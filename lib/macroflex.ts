import { supabase } from './supabase'
import { buildCommitment, computeAllocationShortfalls, computeOrderShortfalls, excludePrepared, expandRecurringDates, orderPrepWindow, roundQuantity, servingsForBookingItem, servingsForOrder, type AllocationCommitment, type CommitmentRef } from './rules/allocation'
import { getScrapSuggestions as getPureScrapSuggestions, rankScrapSuggestions, type ScrapSuggestion as PureScrapSuggestion } from './rules/scrapSuggestions'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface IngredientShortfall { ingredientName: string; required: number; available: number; shortBy: number; unitOfMeasure: string; allocated?: number }
export interface SufficiencyCheckResult { sufficient: boolean; hasNoIngredients: boolean; shortfalls: IngredientShortfall[] }
export interface OverPurchasedIngredient { ingredientName: string; currentStock: number; maxCapacity: number; exceededBy: number; unitOfMeasure: string }
export interface ScrapSuggestion { menuItemId: number; itemName: string; category: string; price: number;   usesLeftover: Array<{ ingredientName: string; quantity: number; unitOfMeasure: string }>
  usesMissingIngredient?: string[]
}
export interface ScrapSuggestionResult { alternatives: ScrapSuggestion[] }

interface IngredientRow { IngredientID: number; QuantityRequiredPerServing: number; INGREDIENT?: Ingredient | Ingredient[] }
interface Ingredient { IngredientID: number; IngredientName: string; UnitOfMeasure: string; CurrentStock: number }
interface MenuRow { MenuItemID: number; PrepTimeDays: number }
interface OrderItem { MenuItemID: number; Quantity: number }
interface BookingRow { BookingID: number; EventDate: string; GuestCount: number; BOOKING_ITEM?: OrderItem[] }
interface MealPrepRow { MealPrepOrderID: number; NextFulfillmentDate: string; RecurrencePattern: 'weekly' | 'biweekly'; MealsPerCycle: number; MEAL_PREP_ITEM?: OrderItem[] }

async function getMenuIngredients(menuItemId: number, client = supabase) {
  return client.from('DISH_INGREDIENT').select('IngredientID, QuantityRequiredPerServing, INGREDIENT:INGREDIENT(IngredientID, IngredientName, UnitOfMeasure, CurrentStock)').eq('MenuItemID', menuItemId)
}

export async function checkSufficiency(menuItemId: number, quantity = 1): Promise<SufficiencyCheckResult> {
  const { data, error } = await getMenuIngredients(menuItemId)
  if (error) throw error
  const rows = (data ?? []) as unknown as IngredientRow[]
  if (!rows.length) return { sufficient: true, hasNoIngredients: true, shortfalls: [] }
  const shortfalls: IngredientShortfall[] = []
  for (const row of rows) {
    const ingredient = Array.isArray(row.INGREDIENT) ? row.INGREDIENT[0] : row.INGREDIENT
    if (!ingredient) continue
    const required = Number(row.QuantityRequiredPerServing ?? 0) * quantity
    const available = Number(ingredient.CurrentStock ?? 0)
    if (available < required) shortfalls.push({ ingredientName: ingredient.IngredientName, required, available, shortBy: required - available, unitOfMeasure: ingredient.UnitOfMeasure })
  }
  return { sufficient: shortfalls.length === 0, hasNoIngredients: false, shortfalls }
}

async function loadCommitments(
  client: typeof supabase,
  recipes: Map<number, { ingredientId: number; qtyPerServing: number }[]>,
  prepDays: Map<number, number>,
  candidateMenuItemIds: number[],
): Promise<AllocationCommitment[]> {
  const bookingsQuery = client.from('BOOKING').select('BookingID, EventDate, GuestCount, BOOKING_ITEM(MenuItemID, Quantity)').eq('Status', 'confirmed')
  const mealPrepQuery = client.from('MEAL_PREP_ORDER').select('MealPrepOrderID, NextFulfillmentDate, RecurrencePattern, MealsPerCycle, MEAL_PREP_ITEM(MenuItemID, Quantity)').in('Status', ['pending', 'confirmed', 'active']).not('NextFulfillmentDate', 'is', null)
  const preparationQuery = client.from('PREPARATION_LOG').select('BookingID, MealPrepOrderID, CycleDate')
  const [{ data: bookingData, error: bookingError }, { data: mealPrepData, error: mealPrepError }, { data: preparationData, error: preparationError }] = await Promise.all([bookingsQuery, mealPrepQuery, preparationQuery])
  if (bookingError) throw bookingError
  if (mealPrepError) throw mealPrepError
  if (preparationError) throw preparationError
  const preparedBookingIds = new Set((preparationData ?? []).filter((row) => row.BookingID != null).map((row) => Number(row.BookingID)))
  const preparedMealPrepCycles = new Set((preparationData ?? []).filter((row) => row.MealPrepOrderID != null && row.CycleDate).map((row) => `${Number(row.MealPrepOrderID)}:${String(row.CycleDate).slice(0, 10)}`))
  const bookings = (bookingData ?? []) as unknown as BookingRow[]
  const mealPrepOrders = (mealPrepData ?? []) as unknown as MealPrepRow[]
  const menuItemIds = [...new Set([
    ...candidateMenuItemIds,
    ...bookings.flatMap((booking) => (booking.BOOKING_ITEM ?? []).map((item) => Number(item.MenuItemID))),
    ...mealPrepOrders.flatMap((order) => (order.MEAL_PREP_ITEM ?? []).map((item) => Number(item.MenuItemID))),
  ])]
  const [{ data: menuData, error: menuError }, { data: recipeData, error: recipeError }] = await Promise.all([
    client.from('MENU_ITEM').select('MenuItemID, PrepTimeDays').in('MenuItemID', menuItemIds),
    client.from('DISH_INGREDIENT').select('MenuItemID, IngredientID, QuantityRequiredPerServing').in('MenuItemID', menuItemIds),
  ])
  if (menuError) throw menuError
  if (recipeError) throw recipeError
  for (const menu of (menuData ?? []) as unknown as MenuRow[]) {
    const menuItemId = Number(menu.MenuItemID)
    if (!prepDays.has(menuItemId)) prepDays.set(menuItemId, Number(menu.PrepTimeDays ?? 0))
  }
  for (const row of (recipeData ?? []) as unknown as Array<{ MenuItemID: number; IngredientID: number; QuantityRequiredPerServing: number }>) {
    const menuItemId = Number(row.MenuItemID)
    const list = recipes.get(menuItemId) ?? []
    if (!list.some((recipe) => recipe.ingredientId === Number(row.IngredientID))) {
      list.push({ ingredientId: Number(row.IngredientID), qtyPerServing: Number(row.QuantityRequiredPerServing ?? 0) })
    }
    recipes.set(menuItemId, list)
  }
  const commitments: AllocationCommitment[] = []
  for (const booking of bookings) commitments.push(buildCommitment({ type: 'booking', id: Number(booking.BookingID) }, String(booking.EventDate), (booking.BOOKING_ITEM ?? []).map((i) => ({ menuItemId: Number(i.MenuItemID), servings: servingsForBookingItem(i.Quantity, booking.GuestCount) })), recipes, prepDays))
  for (const order of mealPrepOrders) for (const date of expandRecurringDates(String(order.NextFulfillmentDate), order.RecurrencePattern)) commitments.push(buildCommitment({ type: 'meal_prep', id: Number(order.MealPrepOrderID) }, date, (order.MEAL_PREP_ITEM ?? []).map((i) => ({ menuItemId: Number(i.MenuItemID), servings: servingsForOrder('meal_prep', undefined, order.MealsPerCycle) })), recipes, prepDays))
  return excludePrepared(commitments, preparedBookingIds, preparedMealPrepCycles)
}

export async function checkSufficiencyWithAllocations(menuItemId: number, quantity: number, prepStartDate: string, fulfillmentDate: string, excludeRef?: CommitmentRef, client = supabase): Promise<SufficiencyCheckResult> {
  const { data, error } = await getMenuIngredients(menuItemId, client)
  if (error) throw error
  const rows = (data ?? []) as unknown as IngredientRow[]
  if (!rows.length) return { sufficient: true, hasNoIngredients: true, shortfalls: [] }
  const allItems = rows.length ? [{ MenuItemID: menuItemId, Quantity: quantity }] : []
  const { data: menuData, error: menuError } = await client.from('MENU_ITEM').select('MenuItemID, PrepTimeDays').in('MenuItemID', [menuItemId])
  if (menuError) throw menuError
  const prepDays = new Map<number, number>(((menuData ?? []) as unknown as MenuRow[]).map((m) => [Number(m.MenuItemID), Number(m.PrepTimeDays ?? 0)]))
  const { data: recipeData, error: recipeError } = await client.from('DISH_INGREDIENT').select('MenuItemID, IngredientID, QuantityRequiredPerServing').in('MenuItemID', [menuItemId])
  if (recipeError) throw recipeError
  const recipes = new Map<number, { ingredientId: number; qtyPerServing: number }[]>()
  for (const row of (recipeData ?? []) as unknown as Array<{ MenuItemID: number; IngredientID: number; QuantityRequiredPerServing: number }>) {
    const list = recipes.get(Number(row.MenuItemID)) ?? []
    list.push({ ingredientId: Number(row.IngredientID), qtyPerServing: Number(row.QuantityRequiredPerServing ?? 0) })
    recipes.set(Number(row.MenuItemID), list)
  }
  const commitments = await loadCommitments(client, recipes, prepDays, [menuItemId])
  const requirements = rows.flatMap((row) => {
    const ingredient = Array.isArray(row.INGREDIENT) ? row.INGREDIENT[0] : row.INGREDIENT
    return ingredient ? [{ ingredientId: Number(ingredient.IngredientID ?? row.IngredientID), name: ingredient.IngredientName, unit: ingredient.UnitOfMeasure, requiredPerServing: Number(row.QuantityRequiredPerServing ?? 0), currentStock: Number(ingredient.CurrentStock ?? 0) }] : []
  })
  const allocationResult = computeAllocationShortfalls(requirements, quantity, { prepStartDate, fulfillmentDate }, commitments, excludeRef)
  return { sufficient: allocationResult.sufficient, hasNoIngredients: false, shortfalls: allocationResult.shortfalls }
}

export interface OrderSufficiencyShortfall extends IngredientShortfall { contributingItems: Array<{ menuItemId: number; itemName: string }> }
export interface OrderSufficiencyResult { sufficient: boolean; hasNoIngredients: boolean; shortfalls: OrderSufficiencyShortfall[] }

export async function checkOrderSufficiencyWithAllocations(items: { menuItemId: number; servings?: number }[], servings: number, fulfillmentDate: string, excludeRef?: CommitmentRef, client = supabase): Promise<OrderSufficiencyResult> {
  const menuIds = [...new Set(items.map((item) => Number(item.menuItemId)))]
  const [{ data: menuData, error: menuError }, { data: recipeData, error: recipeError }] = await Promise.all([
    client.from('MENU_ITEM').select('MenuItemID, ItemName, PrepTimeDays').in('MenuItemID', menuIds),
    client.from('DISH_INGREDIENT').select('MenuItemID, IngredientID, QuantityRequiredPerServing, INGREDIENT:INGREDIENT(IngredientID, IngredientName, UnitOfMeasure, CurrentStock)').in('MenuItemID', menuIds),
  ])
  if (menuError) throw menuError
  if (recipeError) throw recipeError
  const menus = (menuData ?? []) as unknown as Array<MenuRow & { ItemName: string }>
  const prepDays = new Map(menus.map((menu) => [Number(menu.MenuItemID), Number(menu.PrepTimeDays ?? 0)]))
  const recipes = new Map<number, { ingredientId: number; qtyPerServing: number }[]>()
  const stockById = new Map<number, { name: string; unit: string; currentStock: number }>()
  for (const row of (recipeData ?? []) as unknown as IngredientRow[]) {
    const list = recipes.get(Number((row as IngredientRow & { MenuItemID: number }).MenuItemID)) ?? []
    const menuItemId = Number((row as IngredientRow & { MenuItemID: number }).MenuItemID)
    list.push({ ingredientId: Number(row.IngredientID), qtyPerServing: Number(row.QuantityRequiredPerServing ?? 0) })
    recipes.set(menuItemId, list)
    const ingredient = Array.isArray(row.INGREDIENT) ? row.INGREDIENT[0] : row.INGREDIENT
    if (ingredient) stockById.set(Number(ingredient.IngredientID), { name: ingredient.IngredientName, unit: ingredient.UnitOfMeasure, currentStock: Number(ingredient.CurrentStock ?? 0) })
  }
  const commitments = await loadCommitments(client, recipes, prepDays, menuIds)
  const window = orderPrepWindow(fulfillmentDate, items.map((item) => prepDays.get(Number(item.menuItemId)) ?? 0))
  const result = computeOrderShortfalls(items.map((item) => ({ menuItemId: Number(item.menuItemId), servings: item.servings ?? servings })), recipes, stockById, window, commitments, excludeRef)
  const itemNames = new Map(menus.map((menu) => [Number(menu.MenuItemID), menu.ItemName]))
  return { sufficient: result.sufficient, hasNoIngredients: items.every((item) => !(recipes.get(Number(item.menuItemId))?.length)), shortfalls: result.shortfalls.map((shortfall) => ({ ...shortfall, contributingItems: shortfall.contributingItems.map((menuItemId) => ({ menuItemId, itemName: itemNames.get(menuItemId) ?? '' })) })) }
}

export interface ReservedIngredient { ingredientId: number; reserved: number }

function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export async function getReservedIngredients(operatorId: number, client: SupabaseClient = supabase): Promise<Record<number, number>> {
  const today = manilaToday()
  const [{ data: ingredients, error: ingredientError }, { data: bookings, error: bookingError }, { data: orders, error: orderError }, { data: preparationData, error: preparationError }] = await Promise.all([
    client.from('INGREDIENT').select('IngredientID').eq('OperatorID', operatorId),
    client.from('BOOKING').select('BookingID, EventDate, GuestCount, BOOKING_ITEM(MenuItemID, Quantity)').eq('Status', 'confirmed').gte('EventDate', today),
    client.from('MEAL_PREP_ORDER').select('MealPrepOrderID, NextFulfillmentDate, RecurrencePattern, MealsPerCycle, MEAL_PREP_ITEM(MenuItemID, Quantity)').in('Status', ['active', 'confirmed']).gte('NextFulfillmentDate', today),
    client.from('PREPARATION_LOG').select('BookingID, MealPrepOrderID, CycleDate'),
  ])
  if (ingredientError) throw ingredientError
  if (bookingError) throw bookingError
  if (orderError) throw orderError
  if (preparationError) throw preparationError
  const preparedBookingIds = new Set((preparationData ?? []).filter((row) => row.BookingID != null).map((row) => Number(row.BookingID)))
  const preparedMealPrepCycles = new Set((preparationData ?? []).filter((row) => row.MealPrepOrderID != null && row.CycleDate).map((row) => `${Number(row.MealPrepOrderID)}:${String(row.CycleDate).slice(0, 10)}`))

  const ingredientIds = new Set((ingredients ?? []).map((row) => Number(row.IngredientID)))
  const bookingRows = (bookings ?? []) as unknown as BookingRow[]
  const orderRows = (orders ?? []) as unknown as MealPrepRow[]
  const menuItemIds = [...new Set([
    ...bookingRows.flatMap((row) => (row.BOOKING_ITEM ?? []).map((item) => Number(item.MenuItemID))),
    ...orderRows.flatMap((row) => (row.MEAL_PREP_ITEM ?? []).map((item) => Number(item.MenuItemID))),
  ])]
  if (!menuItemIds.length) return {}

  const [{ data: recipes, error: recipeError }, { data: menuItems, error: menuError }] = await Promise.all([
    client.from('DISH_INGREDIENT').select('MenuItemID, IngredientID, QuantityRequiredPerServing').in('MenuItemID', menuItemIds),
    client.from('MENU_ITEM').select('MenuItemID, PrepTimeDays').in('MenuItemID', menuItemIds),
  ])
  if (recipeError) throw recipeError
  if (menuError) throw menuError

  const recipeMap = new Map<number, { ingredientId: number; qtyPerServing: number }[]>()
  for (const row of (recipes ?? []) as Array<{ MenuItemID: number; IngredientID: number; QuantityRequiredPerServing: number }>) {
    if (!ingredientIds.has(Number(row.IngredientID))) continue
    const list = recipeMap.get(Number(row.MenuItemID)) ?? []
    list.push({ ingredientId: Number(row.IngredientID), qtyPerServing: Number(row.QuantityRequiredPerServing ?? 0) })
    recipeMap.set(Number(row.MenuItemID), list)
  }
  const prepDays = new Map((menuItems ?? []).map((row) => [Number(row.MenuItemID), Number(row.PrepTimeDays ?? 0)]))
  const commitments: AllocationCommitment[] = []
  for (const booking of bookingRows) commitments.push(buildCommitment({ type: 'booking', id: Number(booking.BookingID) }, booking.EventDate, (booking.BOOKING_ITEM ?? []).map((item) => ({ menuItemId: Number(item.MenuItemID), servings: servingsForBookingItem(item.Quantity, booking.GuestCount) })), recipeMap, prepDays))
  for (const order of orderRows) for (const date of expandRecurringDates(order.NextFulfillmentDate, order.RecurrencePattern)) commitments.push(buildCommitment({ type: 'meal_prep', id: Number(order.MealPrepOrderID) }, date, (order.MEAL_PREP_ITEM ?? []).map((item) => ({ menuItemId: Number(item.MenuItemID), servings: servingsForOrder('meal_prep', undefined, order.MealsPerCycle) })), recipeMap, prepDays))
  return excludePrepared(commitments, preparedBookingIds, preparedMealPrepCycles).reduce<Record<number, number>>((reserved, commitment) => {
  for (const [ingredientId, quantity] of Object.entries(commitment.ingredientQuantities)) reserved[Number(ingredientId)] = roundQuantity((reserved[Number(ingredientId)] ?? 0) + quantity)
  return reserved
  }, {})
}

export async function checkOverPurchase(operatorId?: number): Promise<{ overPurchased: OverPurchasedIngredient[] }> {
  let query = supabase.from('INGREDIENT').select('IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity')
  if (operatorId !== undefined) query = query.eq('OperatorID', operatorId)
  const { data, error } = await query
  if (error) throw error
  return { overPurchased: (data ?? []).filter((i) => Number(i.CurrentStock ?? 0) > Number(i.MaxStorageCapacity)).map((i) => ({ ingredientName: i.IngredientName, currentStock: Number(i.CurrentStock ?? 0), maxCapacity: Number(i.MaxStorageCapacity), exceededBy: Number(i.CurrentStock ?? 0) - Number(i.MaxStorageCapacity), unitOfMeasure: i.UnitOfMeasure })) }
}

export async function getScrapBasedSuggestions(failedMenuItemId: number, operatorId?: number, client: SupabaseClient = supabase): Promise<ScrapSuggestionResult> {
  const { data: menuData, error: menuError } = await client.from('MENU_ITEM').select('MenuItemID, ItemName, Category, Price, Availability, DISH_INGREDIENT(IngredientID, QuantityRequiredPerServing, INGREDIENT:INGREDIENT(IngredientID, IngredientName, UnitOfMeasure, CurrentStock, OperatorID))')
  if (menuError) throw menuError
  const rows = (menuData ?? []) as unknown as Array<{
    MenuItemID: number
    ItemName: string
    Category: string | null
    Price: number | null
    Availability: boolean | null
    DISH_INGREDIENT?: Array<{ IngredientID: number; QuantityRequiredPerServing: number; INGREDIENT?: Ingredient | Ingredient[] & { OperatorID?: number }}>
  }>
  const operator = operatorId ?? rows.flatMap((row) => row.DISH_INGREDIENT ?? []).map((row) => {
    const ingredient = Array.isArray(row.INGREDIENT) ? row.INGREDIENT[0] : row.INGREDIENT
    return (ingredient as (Ingredient & { OperatorID?: number }) | undefined)?.OperatorID
  }).find((id): id is number => id != null)
  const ingredients = [...new Map(rows.flatMap((row) => (row.DISH_INGREDIENT ?? []).map((entry) => {
    const ingredient = Array.isArray(entry.INGREDIENT) ? entry.INGREDIENT[0] : entry.INGREDIENT
    return ingredient ? [Number(ingredient.IngredientID), { id: String(ingredient.IngredientID), name: ingredient.IngredientName, currentStock: Number(ingredient.CurrentStock ?? 0), unit: ingredient.UnitOfMeasure }] as const : null
  }).filter((entry): entry is readonly [number, { id: string; name: string; currentStock: number; unit: string }] => entry !== null))).values()]
  const reserved = operator == null ? {} : await getReservedIngredients(operator, client)
  const suggestions = getPureScrapSuggestions(
    String(failedMenuItemId),
    rows.map((row) => ({
      id: String(row.MenuItemID),
      name: row.ItemName,
      availability: row.Availability ?? true,
      category: row.Category ?? undefined,
      price: Number(row.Price ?? 0),
      requiredIngredients: (row.DISH_INGREDIENT ?? []).map((entry) => {
        const ingredient = Array.isArray(entry.INGREDIENT) ? entry.INGREDIENT[0] : entry.INGREDIENT
        return { id: String(entry.IngredientID), name: ingredient?.IngredientName ?? '', qty: Number(entry.QuantityRequiredPerServing ?? 0), unit: ingredient?.UnitOfMeasure ?? '' }
      }),
    })),
    ingredients,
    Object.fromEntries(Object.entries(reserved).map(([id, quantity]) => [String(id), quantity])),
  )
  const menuItems = rows.map((row) => ({
    id: String(row.MenuItemID),
    name: row.ItemName,
    availability: row.Availability ?? true,
    category: row.Category ?? undefined,
    price: Number(row.Price ?? 0),
    requiredIngredients: (row.DISH_INGREDIENT ?? []).map((entry) => {
      const ingredient = Array.isArray(entry.INGREDIENT) ? entry.INGREDIENT[0] : entry.INGREDIENT
      return { id: String(entry.IngredientID), name: ingredient?.IngredientName ?? '', qty: Number(entry.QuantityRequiredPerServing ?? 0), unit: ingredient?.UnitOfMeasure ?? '' }
    }),
  }))
  const blockedDish = menuItems.find((dish) => dish.id === String(failedMenuItemId))
  const stockById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.currentStock - (reserved[Number(ingredient.id)] ?? 0)]))
  const shortfallIds = blockedDish?.requiredIngredients.filter((ingredient) => (stockById.get(ingredient.id) ?? 0) < ingredient.qty).map((ingredient) => ingredient.id) ?? []
  const rankedSuggestions = blockedDish ? rankScrapSuggestions(blockedDish, shortfallIds, suggestions) : suggestions
  return { alternatives: rankedSuggestions.map((suggestion: PureScrapSuggestion) => ({ menuItemId: Number(suggestion.dishId), itemName: suggestion.dishName, category: suggestion.category ?? '', price: suggestion.price ?? 0, usesMissingIngredient: suggestion.usesMissingIngredient, usesLeftover: suggestion.usesLeftover.map((item) => ({ ingredientName: item.ingredientName, quantity: item.quantity, unitOfMeasure: item.unit })) })) }
}
export async function getScrapSuggestions(failedMenuItemId: number, operatorId?: number, client?: SupabaseClient) { return getScrapBasedSuggestions(failedMenuItemId, operatorId, client) }

export type { AllocationCommitment, CommitmentRef }
