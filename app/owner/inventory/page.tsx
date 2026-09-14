'use client';

import { DashboardLayout } from '@/app/dashboard-layout';
import { Card } from '@/components/ui/card';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Lightbulb,
  PackageCheck,
  UtensilsCrossed,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

import {
  checkDishStock,
  getOverPurchasedIngredients,
  getScrapSuggestions,
} from '@/lib/rules/macroFlex';

import type { Ingredient, MenuItem } from '@/lib/types';

type IngredientCategory =
  | 'all'
  | 'low'
  | 'meats'
  | 'dairy'
  | 'baking'
  | 'produce'
  | 'pantry'
  | 'herbs_spices';

type DatabaseIngredient = {
  IngredientID: number;
  OperatorID: number;
  IngredientName: string;
  UnitOfMeasure: string;
  CurrentStock: number;
  MaxStorageCapacity: number;
};

type DatabaseDishIngredient = {
  DishIngredientID: number;
  MenuItemID: number;
  IngredientID: number;
  QuantityRequiredPerServing: number;
};

type DatabaseMenuItem = {
  MenuItemID: number;
  ItemName: string;
  Category: string;
  Price: number;
  PrepTimeDays: number;
  Description: string;
};

function getIngredientCategory(name: string): Exclude<IngredientCategory, 'all' | 'low'> {
  const value = name.toLowerCase();

  if (
    value.includes('chicken') ||
    value.includes('beef') ||
    value.includes('salmon') ||
    value.includes('shrimp')
  ) {
    return 'meats';
  }

  if (
    value.includes('butter') ||
    value.includes('cheese') ||
    value.includes('feta') ||
    value.includes('milk') ||
    value.includes('cream')
  ) {
    return 'dairy';
  }

  if (
    value.includes('cocoa') ||
    value.includes('flour') ||
    value.includes('sugar') ||
    value.includes('baking')
  ) {
    return 'baking';
  }

  if (
    value.includes('rice') ||
    value.includes('peanut')
  ) {
    return 'pantry';
  }

  if (
    value.includes('salt') ||
    value.includes('pepper') ||
    value.includes('spice') ||
    value.includes('herb')
  ) {
    return 'herbs_spices';
  }

  return 'produce';
}

function mapIngredient(
  ingredient: DatabaseIngredient
): Ingredient {
  return {
    id: String(ingredient.IngredientID),
    name: ingredient.IngredientName,
    unit: ingredient.UnitOfMeasure,
    currentStock: Number(ingredient.CurrentStock),
    maxCapacity: Number(ingredient.MaxStorageCapacity),
    category: getIngredientCategory(ingredient.IngredientName),
  };
}

function mapMenuItem(
  menuItem: DatabaseMenuItem,
  dishIngredients: DatabaseDishIngredient[],
  ingredients: Ingredient[]
): MenuItem {
  const requiredIngredients = dishIngredients
    .filter(
      (dishIngredient) =>
        dishIngredient.MenuItemID === menuItem.MenuItemID
    )
    .map((dishIngredient) => {
      const ingredient = ingredients.find(
        (item) =>
          item.id === String(dishIngredient.IngredientID)
      );

      return {
        id: String(dishIngredient.IngredientID),
        name:
          ingredient?.name ??
          `Ingredient ${dishIngredient.IngredientID}`,
        qty: Number(
          dishIngredient.QuantityRequiredPerServing
        ),
        unit: ingredient?.unit ?? '',
      };
    });

    return {
      id: String(menuItem.MenuItemID),
      name: menuItem.ItemName,
      category: menuItem.Category.toLowerCase() as MenuItem['category'],
      price: Number(menuItem.Price),
      prepTimeDays: Number(menuItem.PrepTimeDays),
      description: menuItem.Description ?? '',
    
      // Macro Profile was removed from Supabase,
      // so keep the required frontend shape with neutral values.
      macros: {
        carbs: 0,
        protein: 0,
        fat: 0,
      },
    
      allergyTags: [] as MenuItem['allergyTags'],
    
      requiredIngredients,
    
      // This will be recalculated from INGREDIENT stock
      // using the existing stock rule.
      inventoryStatus: 'available',
    };
  }

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [savingId, setSavingId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'dishes' | 'ingredients'
  >('dishes');

  const [dishCategory, setDishCategory] = useState<
    'all' | 'mains' | 'appetizers' | 'sides' | 'desserts'
  >('all');

  const [ingredientCategory, setIngredientCategory] =
    useState<IngredientCategory>('all');

  /*
   * Load ingredients, menu items, and dish-ingredient
   * relationships from Supabase.
   */
  useEffect(() => {
    const loadInventory = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        /*
         * Load INGREDIENT
         */
        const {
          data: ingredientRows,
          error: ingredientError,
        } = await supabase
          .from('INGREDIENT')
          .select(
            'IngredientID, OperatorID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity'
          )
          .order('IngredientID');

        if (ingredientError) {
          console.error(
            'INGREDIENT loading error:',
            ingredientError
          );

          throw new Error(
            `Failed to load ingredients: ${ingredientError.message}`
          );
        }

        /*
         * Load MENU_ITEM
         */
        const {
          data: menuItemRows,
          error: menuItemError,
        } = await supabase
          .from('MENU_ITEM')
          .select(
            'MenuItemID, ItemName, Category, Price, PrepTimeDays, Description'
          )
          .order('MenuItemID');

        if (menuItemError) {
          console.error(
            'MENU_ITEM loading error:',
            menuItemError
          );

          throw new Error(
            `Failed to load menu items: ${menuItemError.message}`
          );
        }

        /*
         * Load DISH_INGREDIENT
         */
        const {
          data: dishIngredientRows,
          error: dishIngredientError,
        } = await supabase
          .from('DISH_INGREDIENT')
          .select(
            'DishIngredientID, MenuItemID, IngredientID, QuantityRequiredPerServing'
          )
          .order('DishIngredientID');

        if (dishIngredientError) {
          console.error(
            'DISH_INGREDIENT loading error:',
            dishIngredientError
          );

          throw new Error(
            `Failed to load dish ingredients: ${dishIngredientError.message}`
          );
        }

        const mappedIngredients = (
          (ingredientRows ?? []) as DatabaseIngredient[]
        ).map(mapIngredient);

        const mappedMenuItems = (
          (menuItemRows ?? []) as DatabaseMenuItem[]
        ).map((menuItem) =>
          mapMenuItem(
            menuItem,
            (dishIngredientRows ??
              []) as DatabaseDishIngredient[],
            mappedIngredients
          )
        );

        setIngredients(mappedIngredients);
        setMenuItems(mappedMenuItems);
      } catch (error) {
        console.error(
          'Inventory loading error:',
          error
        );

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to load inventory data.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, []);

  /*
   * Detect ingredients whose stock exceeds
   * their maximum storage capacity.
   */
  const overPurchased = useMemo(
    () => getOverPurchasedIngredients(ingredients),
    [ingredients]
  );

  /*
   * Generate tira-tira suggestions using the
   * existing MacroFlex rule.
   */
  const scrapSuggestions = useMemo(
    () =>
      getScrapSuggestions(
        ingredients,
        menuItems
      ),
    [ingredients, menuItems]
  );

  /*
   * Check every dish against current ingredient stock.
   */
  const dishChecks = useMemo(
    () =>
      menuItems.map((dish) => ({
        dish,
        check: checkDishStock(
          dish,
          ingredients
        ),
      })),
    [menuItems, ingredients]
  );

  /*
   * Ingredients below 25% of their capacity.
   */
  const lowIngredients = useMemo(
    () =>
      ingredients.filter((ingredient) => {
        if (ingredient.maxCapacity <= 0) {
          return false;
        }

        return (
          ingredient.currentStock /
            ingredient.maxCapacity <
          0.25
        );
      }),
    [ingredients]
  );

  /*
   * Filter ingredients.
   */
  const filteredIngredients = useMemo(() => {
    if (ingredientCategory === 'low') {
      return lowIngredients;
    }

    if (ingredientCategory === 'all') {
      return ingredients;
    }

    return ingredients.filter(
      (ingredient) =>
        ingredient.category === ingredientCategory
    );
  }, [
    ingredients,
    lowIngredients,
    ingredientCategory,
  ]);

  /*
   * Filter dishes.
   */
  const filteredDishes = useMemo(() => {
    if (dishCategory === 'all') {
      return dishChecks;
    }

    return dishChecks.filter(
      ({ dish }) =>
        dish.category === dishCategory
    );
  }, [dishChecks, dishCategory]);

  /*
   * Begin editing ingredient stock.
   */
  const handleEdit = (
    id: string,
    current: number
  ) => {
    setEditingId(id);
    setEditValue(current.toString());
  };

  /*
   * Save updated stock directly to Supabase.
   */
  const handleSave = async (id: string) => {
    const newStock = Number(editValue);

    if (!Number.isFinite(newStock) || newStock < 0) {
      alert(
        'Please enter a valid stock amount.'
      );
      return;
    }

    setSavingId(id);

    try {
      const ingredientId = Number(id);

      const {
        data,
        error,
      } = await supabase
        .from('INGREDIENT')
        .update({
          CurrentStock: newStock,
        })
        .eq('IngredientID', ingredientId)
        .select(
          'IngredientID, OperatorID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity'
        )
        .single();

      if (error) {
        console.error(
          'Ingredient stock update error:',
          error
        );

        alert(
          `Failed to update stock: ${error.message}`
        );

        return;
      }

      /*
       * Update the local page state using
       * the value returned by Supabase.
       */
      const updatedIngredient = mapIngredient(
        data as DatabaseIngredient
      );

      setIngredients((current) =>
        current.map((ingredient) =>
          ingredient.id === id
            ? updatedIngredient
            : ingredient
        )
      );

      setEditingId(null);
      setEditValue('');
    } catch (error) {
      console.error(
        'Unexpected stock update error:',
        error
      );

      alert(
        'An unexpected error occurred while updating stock.'
      );
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-surface-foreground">
              Inventory & dish availability
            </h1>

            <p className="text-surface-muted-foreground mt-2">
              Track dish availability, ingredient stock,
              and low inventory in one place.
            </p>
          </div>

          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              Loading inventory...
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-surface-foreground">
              Inventory & dish availability
            </h1>

            <p className="text-surface-muted-foreground mt-2">
              Track dish availability, ingredient stock,
              and low inventory in one place.
            </p>
          </div>

          <Card className="p-6 border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />

              <div>
                <h2 className="font-semibold text-red-900">
                  Unable to load inventory
                </h2>

                <p className="text-sm text-red-700 mt-1">
                  {loadError}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* PAGE HEADER */}
        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            Inventory & dish availability
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            Track dish availability, ingredient stock,
            and low inventory in one place.
          </p>
        </div>

        {/* TAB SELECTOR */}
        <div className="border-b border-border">
          <div className="flex gap-8">

            <button
              type="button"
              onClick={() =>
                setActiveTab('dishes')
              }
              className={`py-4 text-sm font-medium transition-colors ${
                activeTab === 'dishes'
                  ? 'border-b-2 border-primary text-card-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dishes
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab('ingredients')
              }
              className={`py-4 text-sm font-medium transition-colors ${
                activeTab === 'ingredients'
                  ? 'border-b-2 border-primary text-card-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Ingredients
            </button>

          </div>
        </div>

        {/* DISH CATEGORIES */}
        {activeTab === 'dishes' && (
          <div className="mt-6 flex flex-wrap gap-4">

            {[
              [
                'all',
                'All Dishes',
                dishChecks.length,
              ],
              [
                'mains',
                'Mains',
                dishChecks.filter(
                  ({ dish }) =>
                    dish.category === 'mains'
                ).length,
              ],
              [
                'appetizers',
                'Appetizers',
                dishChecks.filter(
                  ({ dish }) =>
                    dish.category === 'appetizers'
                ).length,
              ],
              [
                'sides',
                'Sides',
                dishChecks.filter(
                  ({ dish }) =>
                    dish.category === 'sides'
                ).length,
              ],
              [
                'desserts',
                'Desserts',
                dishChecks.filter(
                  ({ dish }) =>
                    dish.category === 'desserts'
                ).length,
              ],
            ].map(
              ([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setDishCategory(
                      value as typeof dishCategory
                    )
                  }
                  className={`flex-1 min-w-48 rounded-2xl border-2 p-5 text-left transition-all ${
                    dishCategory === value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-card-foreground">
                      {label}
                    </span>

                    <UtensilsCrossed className="size-5 text-primary" />
                  </div>

                  <span className="mt-3 block text-4xl font-bold text-card-foreground">
                    {count}
                  </span>
                </button>
              )
            )}

          </div>
        )}

        {/* INGREDIENT CATEGORIES */}
        {activeTab === 'ingredients' && (
          <div className="mt-6 flex flex-wrap gap-4">

            {[
              [
                'all',
                'All Stock',
                ingredients.length,
              ],
              [
                'low',
                "What's Low",
                lowIngredients.length,
              ],
              [
                'meats',
                'Meats',
                ingredients.filter(
                  (i) =>
                    i.category === 'meats'
                ).length,
              ],
              [
                'dairy',
                'Dairy',
                ingredients.filter(
                  (i) =>
                    i.category === 'dairy'
                ).length,
              ],
              [
                'baking',
                'Baking',
                ingredients.filter(
                  (i) =>
                    i.category === 'baking'
                ).length,
              ],
            ].map(
              ([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setIngredientCategory(
                      value as IngredientCategory
                    )
                  }
                  className={`flex-1 min-w-48 rounded-2xl border-2 p-5 text-left transition-all ${
                    ingredientCategory === value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between">

                    <span className="text-sm font-medium text-card-foreground">
                      {label}
                    </span>

                    {value === 'low' ? (
                      <AlertCircle className="size-5 text-destructive" />
                    ) : (
                      <PackageCheck className="size-5 text-primary" />
                    )}

                  </div>

                  <span className="mt-3 block text-4xl font-bold text-card-foreground">
                    {count}
                  </span>
                </button>
              )
            )}

          </div>
        )}

        {/* DISHES TAB */}
        {activeTab === 'dishes' && (
          <>
            {/* OVER PURCHASED */}
            {overPurchased.length > 0 && (
              <Card className="p-6 border-yellow-300 bg-yellow-50/80">

                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-yellow-700" />

                  <h2 className="font-heading font-bold text-yellow-900">
                    Over-purchased
                  </h2>
                </div>

                <ul className="text-sm text-yellow-900 space-y-1">

                  {overPurchased.map(
                    (ingredient) => (
                      <li
                        key={ingredient.id}
                      >
                        {ingredient.name}:{' '}
                        {ingredient.currentStock}
                        {ingredient.unit} exceeds
                        max storage of{' '}
                        {ingredient.maxCapacity}
                        {ingredient.unit}
                      </li>
                    )
                  )}

                </ul>

              </Card>
            )}

            {/* TIRA-TIRA */}
            {scrapSuggestions.length > 0 && (
              <Card className="p-6 border-blue-200 bg-blue-50/80">

                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-blue-700" />

                  <h2 className="font-heading font-bold text-blue-900">
                    Tira-tira suggestions
                  </h2>
                </div>

                <ul className="text-sm text-blue-900 space-y-2">

                  {scrapSuggestions.map(
                    (suggestion) => (
                      <li
                        key={`${suggestion.dishId}-${suggestion.leftoverIngredientId}`}
                      >
                        Leftover{' '}
                        {
                          suggestion.leftoverIngredientName
                        }{' '}
                        (
                        {
                          suggestion.leftoverQty
                        }
                        {suggestion.unit}
                        ) — can still make{' '}
                        <strong>
                          {suggestion.dishName}
                        </strong>
                      </li>
                    )
                  )}

                </ul>

              </Card>
            )}

            {/* DISH AVAILABILITY */}
            <Card className="p-6">

              <h2 className="font-heading text-lg font-bold text-card-foreground mb-4">
                Dish availability (per serving)
              </h2>

              <div className="space-y-3">

                {filteredDishes.map(
                  ({ dish, check }) => (
                    <div
                      key={dish.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-muted/50 rounded-lg"
                    >

                      <span className="font-medium text-card-foreground">
                        {dish.name}
                      </span>

                      <div className="flex items-center gap-3">

                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            check.status ===
                            'available'
                              ? 'bg-green-100 text-green-800'
                              : check.status ===
                                'limited'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {check.status}
                        </span>

                        {check.shortfalls.length >
                          0 && (
                          <span className="text-xs text-red-700">
                            Short:{' '}
                            {check.shortfalls
                              .map(
                                (shortfall) =>
                                  `${shortfall.name} (need ${shortfall.required}${shortfall.unit}, have ${shortfall.available}${shortfall.unit})`
                              )
                              .join('; ')}
                          </span>
                        )}

                      </div>

                    </div>
                  )
                )}

              </div>

            </Card>
          </>
        )}

        {/* INGREDIENTS TAB */}
        {activeTab === 'ingredients' && (
          <Card className="overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b border-border">

                    <th className="text-left p-6 font-semibold text-card-foreground">
                      Ingredient
                    </th>

                    <th className="text-left p-6 font-semibold text-card-foreground">
                      Current Stock
                    </th>

                    <th className="text-left p-6 font-semibold text-card-foreground">
                      Capacity
                    </th>

                    <th className="text-left p-6 font-semibold text-card-foreground">
                      Usage
                    </th>

                    <th className="text-left p-6 font-semibold text-card-foreground">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredIngredients.map(
                    (ingredient) => {

                      const percentage =
                        ingredient.maxCapacity > 0
                          ? (
                              ingredient.currentStock /
                              ingredient.maxCapacity
                            ) *
                            100
                          : 0;

                      const isOver =
                        ingredient.currentStock >
                        ingredient.maxCapacity;

                      const statusColor =
                        isOver
                          ? 'bg-orange-100 text-orange-800'
                          : percentage < 25
                            ? 'bg-red-100 text-red-800'
                            : percentage < 50
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800';

                      const statusLabel =
                        isOver
                          ? 'Over-bought'
                          : percentage < 25
                            ? 'Low'
                            : percentage < 50
                              ? 'Medium'
                              : 'Good';

                      const isSaving =
                        savingId ===
                        ingredient.id;

                      return (
                        <tr
                          key={ingredient.id}
                          className="border-b border-border hover:bg-muted/50"
                        >

                          {/* INGREDIENT NAME */}
                          <td className="p-6 font-medium text-card-foreground">
                            {ingredient.name}
                          </td>

                          {/* CURRENT STOCK */}
                            <td className="p-6 text-card-foreground">
                              {editingId === ingredient.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-28 px-2 py-1 border border-border rounded"
                                    disabled={isSaving}
                                  />

                                  <button
                                    type="button"
                                    onClick={() => handleSave(ingredient.id)}
                                    disabled={isSaving}
                                    className="px-3 py-1 bg-primary text-white rounded text-sm disabled:opacity-50"
                                  >
                                    {isSaving ? 'Saving...' : 'Save'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditValue('');
                                    }}
                                    disabled={isSaving}
                                    className="px-3 py-1 border border-border rounded text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span>
                                    {ingredient.currentStock}
                                    {ingredient.unit}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEdit(
                                        ingredient.id,
                                        ingredient.currentStock
                                      )
                                    }
                                    className="px-3 py-1 border border-border rounded text-sm hover:bg-muted"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </td>

                          {/* CAPACITY */}
                          <td className="p-6 text-muted-foreground">
                            {
                              ingredient.maxCapacity
                            }
                            {ingredient.unit}
                          </td>

                          {/* USAGE */}
                          <td className="p-6">

                            <div className="flex items-center gap-3">

                              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">

                                <div
                                  className={`h-full transition-all ${
                                    isOver
                                      ? 'bg-orange-500'
                                      : 'bg-primary'
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      percentage,
                                      100
                                    )}%`,
                                  }}
                                />

                              </div>

                              <span className="text-sm text-muted-foreground w-12">
                                {Math.round(
                                  percentage
                                )}
                                %
                              </span>

                            </div>

                          </td>

                          {/* STATUS */}
                          <td className="p-6">

                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}
                            >
                              {statusLabel}
                            </span>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}