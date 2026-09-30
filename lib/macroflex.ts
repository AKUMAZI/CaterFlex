import { supabase } from './supabase'

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

export interface OverPurchaseCheckResult {
  overPurchased: OverPurchasedIngredient[]
}

export interface ScrapSuggestion {
  menuItemId: number
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
export async function checkSufficiency(
  menuItemId: number,
  quantity: number = 1
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
      const available = ingredient.CurrentStock ?? 0
      const required = (row.QuantityRequiredPerServing ?? 0) * quantity

      if (available < required) {
        allSufficient = false
        shortfalls.push({
          ingredientName: ingredient.IngredientName,
          required,
          available,
          shortBy: required - available,
          unitOfMeasure: ingredient.UnitOfMeasure,
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
