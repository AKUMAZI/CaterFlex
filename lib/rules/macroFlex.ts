import type { Ingredient, MenuItem } from '../types';

export type DishAvailability = 'available' | 'limited' | 'insufficient';

export interface DishStockCheck {
  status: DishAvailability;
  shortfalls: Array<{ ingredientId: string; name: string; required: number; available: number; unit: string }>;
}

export interface ScrapSuggestion {
  dishId: string;
  dishName: string;
  usesLeftover: Array<{ ingredientId: string; ingredientName: string; quantity: number; unit: string }>;
  leftoverIngredientId?: string;
  leftoverIngredientName?: string;
  leftoverQty?: number;
  unit?: string;
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
    const barelyEnough = menuItem.requiredIngredients.some((req) => {
      const stock = getIngredientStock(ingredients, req.id);
      if (!stock) return false;
      return stock.currentStock < req.qty * 2;
    });
    return { status: barelyEnough ? 'limited' : 'available', shortfalls: [] };
  }

  const anyStock = shortfalls.some((s) => s.available > 0);
  return { status: anyStock ? 'limited' : 'insufficient', shortfalls };
}

export function isOverPurchased(ingredient: Ingredient): boolean {
  return ingredient.currentStock > ingredient.maxCapacity;
}

export function getOverPurchasedIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.filter(isOverPurchased);
}

/** FR-7.6: suggestions must be fully preparable from the failed dish's scraps alone. */
export function getScrapSuggestions(
  ingredients: Ingredient[],
  menuItems: MenuItem[],
  failedDish?: MenuItem
): ScrapSuggestion[] {
  const failed = failedDish ?? menuItems.find((dish) => dish.requiredIngredients.some((req) => {
    const stock = getIngredientStock(ingredients, req.id)?.currentStock ?? 0;
    return stock > 0 && stock < req.qty;
  }));
  if (!failed) return [];
  const leftovers = new Map(failed.requiredIngredients.flatMap((req) => {
    const stock = getIngredientStock(ingredients, req.id);
    return stock && stock.currentStock > 0 && stock.currentStock < req.qty
      ? [[req.id, { name: stock.name, quantity: stock.currentStock, unit: stock.unit }] as const]
      : [];
  }));
  return menuItems.filter((dish) => dish.id !== failed.id && dish.requiredIngredients.length > 0 && dish.requiredIngredients.every((req) => leftovers.has(req.id) && leftovers.get(req.id)!.quantity >= req.qty)).map((dish) => ({
    dishId: dish.id,
    dishName: dish.name,
    usesLeftover: dish.requiredIngredients.map((req) => ({ ingredientId: req.id, ingredientName: leftovers.get(req.id)!.name, quantity: req.qty, unit: leftovers.get(req.id)!.unit })),
  }));
}

export function getInsufficientDishes(
  menuItems: MenuItem[],
  ingredients: Ingredient[]
): Array<{ dish: MenuItem; check: DishStockCheck }> {
  return menuItems
    .map((dish) => ({ dish, check: checkDishStock(dish, ingredients) }))
    .filter(({ check }) => check.status === 'insufficient' || check.shortfalls.length > 0);
}
