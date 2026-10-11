export interface ScrapSuggestionIngredient {
  ingredientId: string
  ingredientName: string
  quantity: number
  unit: string
}

export interface ScrapSuggestion {
  dishId: string
  dishName: string
  category?: string
  price?: number
  usesLeftover: ScrapSuggestionIngredient[]
}

export interface ScrapSuggestionDish {
  id: string
  name: string
  availability?: boolean
  category?: string
  price?: number
  requiredIngredients: Array<{
    id: string
    name: string
    qty: number
    unit: string
  }>
}

export interface ScrapSuggestionStock {
  id: string
  name: string
  currentStock: number
  unit: string
}

export function isDishBlocked(
  dish: ScrapSuggestionDish,
  ingredients: ScrapSuggestionStock[],
  reserved: Record<string, number> = {},
): boolean {
  const stockById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  return dish.requiredIngredients.some((requirement) => (
    Math.max(0, stockById.get(requirement.id)?.currentStock ?? 0) - (reserved[requirement.id] ?? 0) < requirement.qty
  ))
}

export function getScrapSuggestionsForBlockedDishes(
  dishes: ScrapSuggestionDish[],
  ingredients: ScrapSuggestionStock[],
  reserved: Record<string, number> = {},
): ScrapSuggestion[] {
  const suggestions = dishes
    .filter((dish) => isDishBlocked(dish, ingredients, reserved))
    .flatMap((dish) => getScrapSuggestions(dish.id, dishes, ingredients, reserved))
  return Array.from(new Map(suggestions.map((suggestion) => [suggestion.dishId, suggestion])).values())
}

export function getScrapSuggestions(
  blockedDishId: string,
  menuItems: ScrapSuggestionDish[],
  ingredients: ScrapSuggestionStock[],
  reserved: Record<string, number> = {},
): ScrapSuggestion[] {
  const stockById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const pool = new Map(
    ingredients.map((ingredient) => [
      ingredient.id,
      Math.max(0, ingredient.currentStock - (reserved[ingredient.id] ?? 0)),
    ]),
  )

  return menuItems
    .filter((dish) => dish.id !== blockedDishId && dish.availability !== false && dish.requiredIngredients.length > 0)
    .filter((dish) => dish.requiredIngredients.every((requirement) => (
      (pool.get(requirement.id) ?? 0) >= requirement.qty
    )))
    .map((dish) => ({
      dishId: dish.id,
      dishName: dish.name,
      category: dish.category,
      price: dish.price,
      usesLeftover: dish.requiredIngredients.map((requirement) => {
        const stock = stockById.get(requirement.id)
        return {
          ingredientId: requirement.id,
          ingredientName: stock?.name ?? requirement.name,
          quantity: requirement.qty,
          unit: stock?.unit ?? requirement.unit,
        }
      }),
    }))
}
