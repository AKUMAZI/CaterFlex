export interface ScrapSuggestionIngredient {
  ingredientId: string
  ingredientName: string
  quantity: number
  unit: string
}

export interface ScrapSuggestion {
  dishId: string
  dishName: string
  usesLeftover: ScrapSuggestionIngredient[]
}

export interface ScrapSuggestionDish {
  id: string
  name: string
  availability?: boolean
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
