import { supabase } from './supabase'
import { createAdminClient } from './supabase-admin'
import { prepStartDate } from './rules/mealPrep'

/**
 * MacroFlex: Core logic for menu sufficiency, over-purchase detection, and scrap-based suggestions.
 * 
 * KEY ASSUMPTIONS:
 * - NULL CurrentStock is treated as 0 (no stock recorded).
 * - NULL OperatorID in INGREDIENT rows represents shared/global ingredients.
 * - MENU_ITEM has no OperatorID; all items are globally accessible.
 * 
 * All table and column names are PascalCase and double-quoted in queries
 * since Postgres treats unquoted identifiers as lowercase.
 */

export interface IngredientShortfall {
  ingredientName: string
  required: number
  available: number
  shortBy: number
  unitOfMeasure: string
  allocated: number
}

export interface SufficiencyCheckResult {
  sufficient: boolean
  hasNoIngredients: boolean
  shortfalls: IngredientShortfall[]
}

export interface SufficiencyContext {
  allocatedByIngredient?: Record<number, number>
}

export interface OverPurchasedIngredient {
  ingredientName: string
  currentStock: number
  maxCapacity: number
  exceededBy: number
  unitOfMeasure: string
}

export interface OverPurchaseCheckResult {
  overPurchased: OverPurchasedIngredient[]
}

export interface ScrapSuggestion {
  menuItemId: number
  blockedMenuItemId: number
  itemName: string
  category: string
  price: number
}

export interface ScrapSuggestionResult {
  alternatives: ScrapSuggestion[]
}

/**
 * Check if a menu item can be fully prepared given current ingredient stock.
 * 
 * For each ingredient in DISH_INGREDIENT linked to this menu item:
 * - Compare CurrentStock (treated as 0 if NULL) vs QuantityRequiredPerServing × quantity.
 * - Return sufficient=true if all ingredients meet requirements.
 * - Return sufficient=false with a detailed list of every shortfall.
 * 
 * @param menuItemId The MenuItemID to check.
 * @param quantity Number of servings to prepare (default 1).
 * @returns SufficiencyCheckResult with status and shortfalls.
 */
export async function getAllocatedIngredients(
  operatorId: number,
  windowStart: Date,
  windowEnd: Date,
  excludeCommitment?: string,
): Promise<Map<number, number>> {
  const admin = createAdminClient()
  const start = windowStart.getTime()
  const end = windowEnd.getTime()
  const allocations = new Map<number, number>()

  const [{ data: bookings, error: bookingError }, { data: orders, error: orderError }] = await Promise.all([
    admin.from('BOOKING').select('BookingID, EventDate').eq('OperatorID', operatorId).eq('Status', 'confirmed'),
    admin.from('MEAL_PREP_ORDER').select('MealPrepOrderID, NextFulfillmentDate').eq('OperatorID', operatorId).eq('Status', 'active').not('NextFulfillmentDate', 'is', null),
  ])
  if (bookingError) throw bookingError
  if (orderError) throw orderError

  const bookingIds = (bookings ?? []).map((booking) => Number(booking.BookingID))
  const orderIds = (orders ?? []).map((order) => Number(order.MealPrepOrderID))
  const [{ data: bookingItems, error: bookingItemsError }, { data: mealPrepItems, error: mealPrepItemsError }] = await Promise.all([
    bookingIds.length ? admin.from('BOOKING_ITEM').select('BookingID, MenuItemID, Quantity').in('BookingID', bookingIds) : { data: [], error: null },
    orderIds.length ? admin.from('MEAL_PREP_ITEM').select('MealPrepOrderID, MenuItemID, Quantity').in('MealPrepOrderID', orderIds) : { data: [], error: null },
  ])
  if (bookingItemsError) throw bookingItemsError
  if (mealPrepItemsError) throw mealPrepItemsError

  const menuIds = [...new Set([...(bookingItems ?? []), ...(mealPrepItems ?? [])].map((item) => Number(item.MenuItemID)))]
  const [{ data: dishIngredients, error: dishError }, { data: menuItems, error: menuError }] = await Promise.all([
    menuIds.length ? admin.from('DISH_INGREDIENT').select('MenuItemID, IngredientID, QuantityRequiredPerServing').in('MenuItemID', menuIds) : { data: [], error: null },
    menuIds.length ? admin.from('MENU_ITEM').select('MenuItemID, PrepTimeDays').in('MenuItemID', menuIds) : { data: [], error: null },
  ])
  if (dishError) throw dishError
  if (menuError) throw menuError
  const prepDaysByMenu = new Map((menuItems ?? []).map((item) => [Number(item.MenuItemID), Number(item.PrepTimeDays ?? 0)]))

  const ingredientsByMenu = new Map<number, typeof dishIngredients>()
  for (const row of dishIngredients ?? []) {
    const rows = ingredientsByMenu.get(Number(row.MenuItemID)) ?? []
    rows.push(row)
    ingredientsByMenu.set(Number(row.MenuItemID), rows)
  }
  const addItems = (items: Array<{ MenuItemID: number; Quantity: number }>, commitment: string, fulfillment: string) => {
    if (excludeCommitment === commitment) return
    const fulfillmentDate = new Date(`${fulfillment.slice(0, 10)}T12:00:00`)
    const menuDates = items.map((item) => prepStartDate(fulfillment, prepDaysByMenu.get(Number(item.MenuItemID)) ?? 0))
    const prepStart = menuDates.length ? new Date(Math.min(...menuDates.map((date) => date.getTime()))) : fulfillmentDate
    if (prepStart.getTime() > end || fulfillmentDate.getTime() < start) return
    for (const item of items) {
      for (const ingredient of ingredientsByMenu.get(Number(item.MenuItemID)) ?? []) {
        const id = Number(ingredient.IngredientID)
        allocations.set(id, (allocations.get(id) ?? 0) + Number(ingredient.QuantityRequiredPerServing ?? 0) * Number(item.Quantity ?? 0))
      }
    }
  }
  for (const booking of bookings ?? []) addItems((bookingItems ?? []).filter((item) => Number(item.BookingID) === Number(booking.BookingID)), `booking:${booking.BookingID}`, String(booking.EventDate))
  for (const order of orders ?? []) addItems((mealPrepItems ?? []).filter((item) => Number(item.MealPrepOrderID) === Number(order.MealPrepOrderID)), `mealPrep:${order.MealPrepOrderID}`, String(order.NextFulfillmentDate))
  return allocations
}

export async function checkSufficiency(
  menuItemId: number,
  quantity: number = 1,
  context: SufficiencyContext = {}
): Promise<SufficiencyCheckResult> {
  try {
    // Query DISH_INGREDIENT joined with INGREDIENT to get current stock and requirements.
    const { data, error } = await supabase
      .from('DISH_INGREDIENT')
      .select(
        `
        "IngredientID",
        "QuantityRequiredPerServing",
        INGREDIENT:INGREDIENT(
          "IngredientName",
          "UnitOfMeasure",
          "CurrentStock"
        )
        `
      )
      .eq('MenuItemID', menuItemId)

    if (error) {
      throw error
    }

    // If no ingredients linked, return explicitly so calling code knows this is a data issue.
    if (!data || data.length === 0) {
      return {
        sufficient: true,
        hasNoIngredients: true,
        shortfalls: [],
      }
    }

    const shortfalls: IngredientShortfall[] = []
    let allSufficient = true

    for (const row of data) {
      const ingredient = Array.isArray(row.INGREDIENT)
        ? row.INGREDIENT[0]
        : row.INGREDIENT

      if (!ingredient) {
        continue
      }

      // Treat NULL CurrentStock as 0.
      const available = Math.max(0, (ingredient.CurrentStock ?? 0) - (context.allocatedByIngredient?.[Number(row.IngredientID)] ?? 0))
      const required = (row.QuantityRequiredPerServing ?? 0) * quantity

      if (available < required) {
        allSufficient = false
        shortfalls.push({
          ingredientName: ingredient.IngredientName,
          required,
          available,
          shortBy: required - available,
          unitOfMeasure: ingredient.UnitOfMeasure,
          allocated: context.allocatedByIngredient?.[Number(row.IngredientID)] ?? 0,
        })
      }
    }

    return {
      sufficient: allSufficient,
      hasNoIngredients: false,
      shortfalls,
    }
  } catch (error) {
    console.error('[MacroFlex] Sufficiency check failed:', error)
    throw error
  }
}

/**
 * Check for over-purchased ingredients (CurrentStock > MaxStorageCapacity).
 * 
 * Treats NULL CurrentStock as 0 (which will never exceed capacity, correct behavior).
 * 
 * @param operatorId Optional: filter to a specific operator's ingredients.
 *                    If provided, includes only ingredients where OperatorID = operatorId.
 *                    If not provided, includes all ingredients.
 * @returns OverPurchaseCheckResult with list of over-purchased items.
 */
export async function checkOverPurchase(
  operatorId?: number
): Promise<OverPurchaseCheckResult> {
  try {
    let query = supabase
      .from('INGREDIENT')
      .select(
        `
        "IngredientID",
        "IngredientName",
        "UnitOfMeasure",
        "CurrentStock",
        "MaxStorageCapacity"
        `
      )

    // If operatorId provided, filter to that operator's ingredients (exclude NULL OperatorID).
    if (operatorId !== undefined) {
      query = query.eq('OperatorID', operatorId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const overPurchased: OverPurchasedIngredient[] = []

    if (data) {
      for (const ingredient of data) {
        // Treat NULL CurrentStock as 0.
        const currentStock = ingredient.CurrentStock ?? 0

        if (currentStock > ingredient.MaxStorageCapacity) {
          overPurchased.push({
            ingredientName: ingredient.IngredientName,
            currentStock,
            maxCapacity: ingredient.MaxStorageCapacity,
            exceededBy: currentStock - ingredient.MaxStorageCapacity,
            unitOfMeasure: ingredient.UnitOfMeasure,
          })
        }
      }
    }

    return {
      overPurchased,
    }
  } catch (error) {
    console.error('[MacroFlex] Over-purchase check failed:', error)
    throw error
  }
}

/**
 * Suggest alternative menu items that can be fully prepared with current ingredient stock.
 * 
 * When a menu item fails the sufficiency check, this function re-runs the sufficiency check
 * against every OTHER menu item using the same live stock levels. Returns items that can be
 * fully prepared right now.
 * 
 * @param failedMenuItemId The MenuItemID that failed sufficiency.
 * @returns ScrapSuggestionResult with list of executable alternatives.
 */
export async function getScrapBasedSuggestions(
  failedMenuItemId: number
): Promise<ScrapSuggestionResult> {
  try {
    // Fetch all menu items except the failed one.
    const { data: menuItems, error: menuError } = await supabase
      .from('MENU_ITEM')
      .select(`"MenuItemID", "ItemName", "Category", "Price"`)
      .neq('MenuItemID', failedMenuItemId)

    if (menuError) {
      throw menuError
    }

    const alternatives: ScrapSuggestion[] = []

    // For each alternative menu item, run sufficiency check.
    if (menuItems) {
      for (const item of menuItems) {
        const check = await checkSufficiency(item.MenuItemID, 1)
        // If sufficient, add to alternatives.
        if (check.sufficient && !check.hasNoIngredients) {
          alternatives.push({
            menuItemId: item.MenuItemID,
            blockedMenuItemId: failedMenuItemId,
            itemName: item.ItemName,
            category: item.Category,
            price: item.Price,
          })
        }
      }
    }

    return {
      alternatives,
    }
  } catch (error) {
    console.error('[MacroFlex] Scrap-based suggestions failed:', error)
    throw error
  }
}
