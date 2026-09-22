import { supabase } from '@/lib/supabase'

export type MacroFlexMenuItem = {
  MenuItemID: number
  ItemName: string
  Category: string
  Price: number
  PrepTimeDays: number
  Description: string | null
}

export type MacroFlexIngredient = {
  IngredientID: number
  IngredientName: string
  UnitOfMeasure: string
  CurrentStock: number
  MaxStorageCapacity: number
}

export type MacroFlexDishIngredient = {
  DishIngredientID: number
  MenuItemID: number
  IngredientID: number
  QuantityRequiredPerServing: number
}

export type Shortfall = {
  ingredientName: string
  required: number
  available: number
  shortBy: number
  unit: string
}

export type SufficiencyResult = {
  sufficient: boolean
  shortfalls: Shortfall[]
}

export type OverstockResult = {
  ingredient: MacroFlexIngredient
  exceedsBy: number
}

export function checkSufficiency(
  menuItemId: number,
  servingQuantity: number,
  ingredients: MacroFlexIngredient[],
  dishIngredients: MacroFlexDishIngredient[],
): SufficiencyResult {
  // Core rule: compare every per-serving requirement against stock multiplied by servings.
  // We intentionally collect all shortages so callers can explain the complete failure.
  const requirements = dishIngredients.filter((row) => row.MenuItemID === menuItemId)
  const shortfalls = requirements.flatMap((requirement) => {
    const ingredient = ingredients.find((row) => row.IngredientID === requirement.IngredientID)
    const required = Number(requirement.QuantityRequiredPerServing) * servingQuantity
    const available = Number(ingredient?.CurrentStock ?? 0)
    return available >= required
      ? []
      : [{
          ingredientName: ingredient?.IngredientName ?? `Ingredient ${requirement.IngredientID}`,
          required,
          available,
          shortBy: required - available,
          unit: ingredient?.UnitOfMeasure ?? '',
        }]
  })

  return { sufficient: shortfalls.length === 0, shortfalls }
}

export function findOverstock(ingredients: MacroFlexIngredient[]): OverstockResult[] {
  // Core rule: over-purchase is independent of dishes; scan the complete ingredient inventory.
  return ingredients
    .filter((ingredient) => Number(ingredient.CurrentStock) > Number(ingredient.MaxStorageCapacity))
    .map((ingredient) => ({
      ingredient,
      exceedsBy: Number(ingredient.CurrentStock) - Number(ingredient.MaxStorageCapacity),
    }))
}

export function findScrapSuggestions(
  failedMenuItemId: number,
  menuItems: MacroFlexMenuItem[],
  ingredients: MacroFlexIngredient[],
  dishIngredients: MacroFlexDishIngredient[],
): MacroFlexMenuItem[] {
  // Core rule: current stock is the leftover-scrap pool. An alternate is valid only when
  // every one of its full per-serving requirements fits that same pool.
  return menuItems.filter((candidate) => {
    if (candidate.MenuItemID === failedMenuItemId) return false
    return checkSufficiency(candidate.MenuItemID, 1, ingredients, dishIngredients).sufficient
  })
}

export async function loadMacroFlexData() {
  const [{ data: menuItems, error: menuError }, { data: ingredients, error: ingredientError }, { data: dishIngredients, error: dishError }] = await Promise.all([
    supabase.from('MENU_ITEM').select('MenuItemID, ItemName, Category, Price, PrepTimeDays, Description').order('MenuItemID'),
    supabase.from('INGREDIENT').select('IngredientID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity').order('IngredientID'),
    supabase.from('DISH_INGREDIENT').select('DishIngredientID, MenuItemID, IngredientID, QuantityRequiredPerServing').order('DishIngredientID'),
  ])

  const error = menuError ?? ingredientError ?? dishError
  if (error) throw new Error(error.message)

  return {
    menuItems: (menuItems ?? []) as MacroFlexMenuItem[],
    ingredients: (ingredients ?? []) as MacroFlexIngredient[],
    dishIngredients: (dishIngredients ?? []) as MacroFlexDishIngredient[],
  }
}

export async function getMenuItemCheck(menuItemId: number, servingQuantity = 1) {
  const data = await loadMacroFlexData()
  return { ...checkSufficiency(menuItemId, servingQuantity, data.ingredients, data.dishIngredients), data }
}

export async function getSuggestions(menuItemId: number) {
  const data = await loadMacroFlexData()
  return { suggestions: findScrapSuggestions(menuItemId, data.menuItems, data.ingredients, data.dishIngredients), data }
}

export async function getOverstock() {
  const data = await loadMacroFlexData()
  return { overstock: findOverstock(data.ingredients), data }
}

export function getDisplayCheck(menuItemId: number, data: Awaited<ReturnType<typeof loadMacroFlexData>>) {
  return checkSufficiency(menuItemId, 1, data.ingredients, data.dishIngredients)
}

export function getDisplaySuggestions(menuItemId: number, data: Awaited<ReturnType<typeof loadMacroFlexData>>) {
  return findScrapSuggestions(menuItemId, data.menuItems, data.ingredients, data.dishIngredients)
}

export const demoMacroFlexData = {
  menuItems: [
    { MenuItemID: 1, ItemName: 'Herb Chicken Platter', Category: 'Mains', Price: 18, PrepTimeDays: 2, Description: null },
    { MenuItemID: 2, ItemName: 'Creamy Garlic Pasta', Category: 'Mains', Price: 14, PrepTimeDays: 1, Description: null },
    { MenuItemID: 3, ItemName: 'Garden Couscous', Category: 'Sides', Price: 10, PrepTimeDays: 1, Description: null },
  ] as MacroFlexMenuItem[],
  ingredients: [
    { IngredientID: 1, IngredientName: 'Chicken breast', UnitOfMeasure: 'kg', CurrentStock: 1.2, MaxStorageCapacity: 6 },
    { IngredientID: 2, IngredientName: 'Garlic', UnitOfMeasure: 'kg', CurrentStock: 2.4, MaxStorageCapacity: 2 },
    { IngredientID: 3, IngredientName: 'Couscous', UnitOfMeasure: 'kg', CurrentStock: 3, MaxStorageCapacity: 8 },
    { IngredientID: 4, IngredientName: 'Fresh herbs', UnitOfMeasure: 'bunches', CurrentStock: 0.2, MaxStorageCapacity: 4 },
  ] as MacroFlexIngredient[],
  dishIngredients: [
    { DishIngredientID: 1, MenuItemID: 1, IngredientID: 1, QuantityRequiredPerServing: 2 },
    { DishIngredientID: 2, MenuItemID: 1, IngredientID: 4, QuantityRequiredPerServing: 1 },
    { DishIngredientID: 3, MenuItemID: 2, IngredientID: 2, QuantityRequiredPerServing: 0.2 },
    { DishIngredientID: 4, MenuItemID: 2, IngredientID: 3, QuantityRequiredPerServing: 0.4 },
    { DishIngredientID: 5, MenuItemID: 3, IngredientID: 3, QuantityRequiredPerServing: 0.5 },
  ] as MacroFlexDishIngredient[],
}

export function getDemoData() { return demoMacroFlexData }

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}
