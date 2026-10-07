import type { Ingredient, MenuItem } from '../types';

export type DishAvailability = 'available' | 'insufficient';

export interface DishStockCheck {
  status: DishAvailability;
  shortfalls: Array<{ ingredientId: string; name: string; required: number; available: number; unit: string }>;
}

export interface ScrapSuggestion {
  dishId: string;
  dishName: string;
  leftoverIngredientId: string;
  leftoverIngredientName: string;
  leftoverQty: number;
  unit: string;
}

export function getIngredientStock(
  ingredients: Ingredient[],
  ingredientId: string
): Ingredient | undefined {
  return ingredients.find((i) => i.id === ingredientId);
}

export function checkDishStock(menuItem: MenuItem, ingredients: Ingredient[]): DishStockCheck {
  if (menuItem.requiredIngredients.length === 0) {
    return { status: 'available', shortfalls: [] };
  }

  const shortfalls = menuItem.requiredIngredients
    .map((req) => {
      const stock = getIngredientStock(ingredients, req.id);
      const available = stock?.currentStock ?? 0;
      if (available >= req.qty) return null;
      return {
        ingredientId: req.id,
        name: req.name,
        required: req.qty,
        available,
        unit: req.unit,
      };
    })
    .filter(Boolean) as DishStockCheck['shortfalls'];

  if (shortfalls.length === 0) {
    return { status: 'available', shortfalls: [] };
  }

  return { status: 'insufficient', shortfalls };
}

export function isOverPurchased(ingredient: Ingredient): boolean {
  return ingredient.currentStock > ingredient.maxCapacity;
}

export function getOverPurchasedIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.filter(isOverPurchased);
}

export function getScrapSuggestions(
  ingredients: Ingredient[],
  menuItems: MenuItem[]
): ScrapSuggestion[] {
  const suggestions: ScrapSuggestion[] = [];
  const seen = new Set<string>();

  for (const ingredient of ingredients) {
    const leftover = ingredient.currentStock;
    if (leftover <= 0) continue;

    const blockedDishes = menuItems.filter((dish) => {
      const req = dish.requiredIngredients.find((r) => r.id === ingredient.id);
      return req && leftover < req.qty;
    });

    if (blockedDishes.length === 0) continue;

    for (const dish of menuItems) {
      const req = dish.requiredIngredients.find((r) => r.id === ingredient.id);
      if (!req || leftover < req.qty) continue;

      const check = checkDishStock(dish, ingredients);
      if (check.status !== 'available') continue;

      const key = `${dish.id}-${ingredient.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      suggestions.push({
        dishId: dish.id,
        dishName: dish.name,
        leftoverIngredientId: ingredient.id,
        leftoverIngredientName: ingredient.name,
        leftoverQty: leftover,
        unit: ingredient.unit,
      });
    }
  }

  return suggestions;
}

export function getInsufficientDishes(
  menuItems: MenuItem[],
  ingredients: Ingredient[]
): Array<{ dish: MenuItem; check: DishStockCheck }> {
  return menuItems
    .map((dish) => ({ dish, check: checkDishStock(dish, ingredients) }))
    .filter(({ check }) => check.status === 'insufficient' || check.shortfalls.length > 0);
}
