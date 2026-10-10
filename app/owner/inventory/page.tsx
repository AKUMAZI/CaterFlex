'use client';

import { DashboardLayout } from '@/app/dashboard-layout';
import { formatQuantity } from '@/lib/rules/quantity-format';
import {
  createIngredient,
  updateIngredient,
  updateIngredientStock,
  createDish,
  updateDish,
  updateDishAvailability,
  getOwnerReservedIngredients,
} from '@/app/actions/inventory-actions';
import { Card } from '@/components/ui/card';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Lightbulb,
  PackageCheck,
  UtensilsCrossed,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { roundQuantity } from '@/lib/rules/allocation';

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
  category?: string | null;
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
  Availability?: boolean;
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
    category:
      (ingredient.category as Exclude<IngredientCategory, 'all' | 'low'>) ||
      getIngredientCategory(ingredient.IngredientName),
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
  const [reservedIngredients, setReservedIngredients] = useState<Record<number, number>>({});
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [savingId, setSavingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formId, setFormId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formCategory, setFormCategory] = useState<Exclude<IngredientCategory, 'all' | 'low'>>('produce');
  const [formSaving, setFormSaving] = useState(false);
  const measurementOptions = ['kg', 'g', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'pcs'];

  const normalizeMeasurementUnit = (unit: string) => {
    const legacyUnits: Record<string, string> = {
      units: 'pcs',
      grams: 'g',
      kilograms: 'kg',
      milliliters: 'ml',
      liters: 'l',
      teaspoons: 'tsp',
      tablespoons: 'tbsp',
      cups: 'cup',
      ounces: 'oz',
      pounds: 'lb',
    };

    return legacyUnits[unit.toLowerCase()] ?? (measurementOptions.includes(unit) ? unit : 'pcs');
  };
  const [dishFormOpen, setDishFormOpen] = useState(false);
  const [dishFormMode, setDishFormMode] = useState<'add' | 'edit'>('add');
  const [dishFormId, setDishFormId] = useState<string | null>(null);
  const [dishFormName, setDishFormName] = useState('');
  const [dishFormCategory, setDishFormCategory] = useState<'mains' | 'appetizers' | 'sides' | 'desserts' | 'beverages'>('mains');
  const [dishFormDescription, setDishFormDescription] = useState('');
  const [dishFormPrice, setDishFormPrice] = useState('0');
  const [dishFormPrepTime, setDishFormPrepTime] = useState('1');
  const [unavailableDishIds, setUnavailableDishIds] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<
    'dishes' | 'ingredients'
  >('ingredients');

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
            'IngredientID, OperatorID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity, category'
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
            'MenuItemID, ItemName, Category, Price, PrepTimeDays, Description, Availability'
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
        const reservedResult = await getOwnerReservedIngredients();
        if (reservedResult.ok) setReservedIngredients(reservedResult.reserved);
        setMenuItems(mappedMenuItems);
        setUnavailableDishIds(new Set((menuItemRows ?? []).filter((item) => item.Availability === false).map((item) => String(item.MenuItemID))));
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

  const openAddDish = () => {
    setDishFormMode('add'); setDishFormId(null); setDishFormName(''); setDishFormCategory('mains'); setDishFormDescription(''); setDishFormPrice('0'); setDishFormPrepTime('1'); setDishFormOpen(true);
  };

  const openEditDish = (dish: MenuItem) => {
    setDishFormMode('edit'); setDishFormId(dish.id); setDishFormName(dish.name); setDishFormCategory(dish.category); setDishFormDescription(dish.description); setDishFormPrice(String(dish.price)); setDishFormPrepTime(String(dish.prepTimeDays)); setDishFormOpen(true);
  };

  const handleDishSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormSaving(true);
    const result = dishFormMode === 'add'
      ? await createDish({ name: dishFormName, category: dishFormCategory, price: Number(dishFormPrice), prepTimeDays: Number(dishFormPrepTime), description: dishFormDescription })
      : await updateDish(Number(dishFormId), { name: dishFormName, category: dishFormCategory, description: dishFormDescription });
    if (!result.ok) { alert(`Failed to ${dishFormMode === 'add' ? 'add' : 'update'} dish: ${result.error}`); setFormSaving(false); return; }
    const row = result.menuItem as DatabaseMenuItem;
    const mapped = mapMenuItem(row, [], ingredients);
    setMenuItems((current) => dishFormMode === 'add' ? [...current, mapped] : current.map((dish) => dish.id === mapped.id ? { ...dish, ...mapped } : dish));
    setDishFormOpen(false); setFormSaving(false);
  };

  const toggleDishAvailability = async (dishId: string) => {
    const nextAvailability = unavailableDishIds.has(dishId);
    const result = await updateDishAvailability(Number(dishId), nextAvailability);
    if (!result.ok) { alert(`Failed to update dish availability: ${result.error}`); return; }
    setUnavailableDishIds((current) => { const next = new Set(current); nextAvailability ? next.delete(dishId) : next.add(dishId); return next; });
  };

  const openAddIngredient = () => {
    setFormMode('add');
    setFormId(null);
    setFormName('');
  setFormQuantity('');
  setFormUnit('pcs');
  setFormCategory('produce');
  setFormOpen(true);
  };

  const openEditIngredient = (ingredient: Ingredient) => {
    setFormMode('edit');
    setFormId(ingredient.id);
    setFormName(ingredient.name);
  setFormQuantity(String(ingredient.currentStock));
  setFormUnit(normalizeMeasurementUnit(ingredient.unit));
  setFormCategory(ingredient.category === 'other' ? 'pantry' : ingredient.category);
  setFormOpen(true);
  };

  const handleIngredientSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(formQuantity);
  if (!formName.trim() || !formUnit.trim() || !Number.isInteger(quantity) || quantity < 0) {
  alert('Enter a whole-number quantity greater than or equal to 0, plus a name and measurement.');
      return;
    }

    setFormSaving(true);
    const result = formMode === 'add'
  ? await createIngredient({ name: formName, quantity, category: formCategory, unit: formUnit })
  : await updateIngredient(Number(formId), { name: formName, quantity, category: formCategory, unit: formUnit });

    if (!result.ok) {
      alert(`Failed to ${formMode === 'add' ? 'add' : 'update'} ingredient: ${result.error}`);
      setFormSaving(false);
      return;
    }

    const mapped = mapIngredient(result.ingredient as DatabaseIngredient);
    setIngredients((current) => formMode === 'add'
      ? [...current, mapped].sort((a, b) => Number(a.id) - Number(b.id))
      : current.map((ingredient) => ingredient.id === mapped.id ? mapped : ingredient));
    setFormOpen(false);
    setFormSaving(false);
  };

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
  
    if (!Number.isInteger(newStock) || newStock < 0) {
      alert('Please enter a whole-number stock amount greater than or equal to 0.');
      return;
    }
  
    setSavingId(id);
  
    try {
      const ingredientId = Number(id);
  
      const result = await updateIngredientStock(
        ingredientId,
        newStock
      );
  
      if (!result.ok) {
        console.error(
          'Ingredient stock update error:',
          result.error
        );
  
        alert(
          `Failed to update stock: ${result.error}`
        );
  
        return;
      }
  
      // Only update the UI after the database update succeeds.
      setIngredients((current) =>
        current.map((ingredient) =>
          ingredient.id === id
            ? {
                ...ingredient,
                currentStock: result.currentStock,
              }
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
              Ingredient inventory
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
              Ingredient inventory
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
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-surface-foreground">
              Ingredient inventory
            </h1>

            <p className="text-surface-muted-foreground mt-2">
              Track dish availability, ingredient stock,
              and low inventory in one place.
            </p>
          </div>

          {activeTab === 'ingredients' && (
            <button
              type="button"
              onClick={openAddIngredient}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Add ingredient
            </button>
          )}
        </div>

        {/* TAB SELECTOR */}
        <div className="border-b border-border">
          <div className="flex gap-8">

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
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">

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
  [
  'beverages',
  'Beverages',
  dishChecks.filter(
  ({ dish }) =>
  dish.category === 'beverages'
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
                  className={`min-w-0 rounded-2xl border-2 p-5 text-left transition-all ${
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
              [
                'produce',
                'Produce',
                ingredients.filter(
                  (i) =>
                    i.category === 'produce'
                ).length,
              ],
              [
                'pantry',
                'Pantry',
                ingredients.filter(
                  (i) =>
                    i.category === 'pantry'
                ).length,
              ],
              [
                'herbs_spices',
                'Herbs & spices',
                ingredients.filter(
                  (i) =>
                    i.category === 'herbs_spices'
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
                        key={suggestion.dishId}
                      >
                        Can still make <strong>{suggestion.dishName}</strong> using leftover: {suggestion.usesLeftover.map((leftover) => `${leftover.ingredientName} (${leftover.quantity}${leftover.unit})`).join(', ')}
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

                      <div className="flex items-center gap-3">
                        <span className={`font-medium ${unavailableDishIds.has(dish.id) ? 'text-muted-foreground line-through' : 'text-card-foreground'}`}>{dish.name}</span>
                        {unavailableDishIds.has(dish.id) && <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">Unavailable</span>}
                      </div>

                      <div className="flex items-center gap-3">

  <span
  className={`text-xs font-medium px-2 py-1 rounded-full ${
  unavailableDishIds.has(dish.id)
  ? 'bg-red-100 text-red-800'
  : check.status === 'available'
  ? 'bg-green-100 text-green-800'
  : check.status === 'limited'
  ? 'bg-yellow-100 text-yellow-800'
  : 'bg-red-100 text-red-800'
  }`}
  >
  {unavailableDishIds.has(dish.id) ? 'unavailable' : check.status}
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

                        <button type="button" onClick={() => openEditDish(dish)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">Edit</button>
                        <button type="button" onClick={() => toggleDishAvailability(dish.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">{unavailableDishIds.has(dish.id) ? 'Make available' : 'Make unavailable'}</button>
                      </div>

                    </div>
                  )
                )}

              </div>

            </Card>
          </>
        )}

        {dishFormOpen && (
          <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-slate-950/75 p-4 backdrop-blur-[2px]">
            <form onSubmit={handleDishSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-xl font-bold">{dishFormMode === 'add' ? 'Add dish' : 'Edit dish'}</h2>
              <div className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">Name<input value={dishFormName} onChange={(event) => setDishFormName(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" required /></label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">Category<select value={dishFormCategory} onChange={(event) => setDishFormCategory(event.target.value as typeof dishFormCategory)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="mains">Main</option><option value="appetizers">Appetizers</option><option value="sides">Sides</option><option value="desserts">Dessert</option><option value="beverages">Beverages</option></select></label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">Description<textarea value={dishFormDescription} onChange={(event) => setDishFormDescription(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" rows={3} /></label>
                {dishFormMode === 'add' && <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1 text-sm font-medium text-slate-700">Price<input type="number" min="0" step="0.01" value={dishFormPrice} onChange={(event) => setDishFormPrice(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" required /></label><label className="flex flex-col gap-1 text-sm font-medium text-slate-700">Prep days<input type="number" min="0" step="1" value={dishFormPrepTime} onChange={(event) => setDishFormPrepTime(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" required /></label></div>}
              </div>
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDishFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button><button type="submit" disabled={formSaving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{formSaving ? 'Saving...' : 'Save changes'}</button></div>
            </form>
          </div>
        )}

        {formOpen && (
<div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-slate-950/75 p-4 backdrop-blur-[2px]">
  <form onSubmit={handleIngredientSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
  <h2 className="text-xl font-bold text-slate-900">
                {formMode === 'add' ? 'Add ingredient' : 'Edit ingredient'}
              </h2>
              <div className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Name
                  <input value={formName} onChange={(event) => setFormName(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#b85c38] focus:ring-2 focus:ring-[#b85c38]/20" required />
                </label>
  <div className="grid grid-cols-2 gap-4">
  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
  Quantity
  <input type="number" min="0" step="1" value={formQuantity} onChange={(event) => setFormQuantity(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#b85c38] focus:ring-2 focus:ring-[#b85c38]/20" required />
  </label>
  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
  Measurement unit
  <select value={formUnit} onChange={(event) => setFormUnit(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#b85c38] focus:ring-2 focus:ring-[#b85c38]/20">
  {measurementOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
  </select>
  </label>
  </div>
  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
  Category
  <select value={formCategory} onChange={(event) => setFormCategory(event.target.value as typeof formCategory)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#b85c38] focus:ring-2 focus:ring-[#b85c38]/20">
  <option value="meats">Meats</option>
  <option value="dairy">Dairy</option>
  <option value="baking">Baking</option>
  <option value="produce">Produce</option>
  <option value="pantry">Pantry</option>
  <option value="herbs_spices">Herbs & spices</option>
  </select>
  </label>

  </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100" disabled={formSaving}>Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={formSaving}>
                  {formSaving ? 'Saving...' : formMode === 'add' ? 'Add ingredient' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
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
                      Reserved
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">All upcoming confirmed orders</span>
                    </th>

                    <th className="text-left p-6 font-semibold text-card-foreground">
                      Available
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
                    <th className="p-6" aria-label="Actions" />

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

                      const reserved = reservedIngredients[Number(ingredient.id)] ?? 0;
                      const available = ingredient.currentStock - reserved;
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
                                    step="1"
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

                          {/* RESERVED */}
                          <td className="p-6 text-muted-foreground">
                            {formatQuantity(reserved, ingredient.unit)}
                          </td>

                          {/* AVAILABLE */}
                          <td className={`p-6 font-medium ${available < 0 ? 'text-red-600' : 'text-card-foreground'}`}>
                            {formatQuantity(available, ingredient.unit)}
                            {available < 0 && <span className="mt-1 block text-xs">Short by {formatQuantity(Math.abs(available), ingredient.unit)}</span>}
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
                          <td className="p-6 text-right">
                            <button
                              type="button"
                              onClick={() => openEditIngredient(ingredient)}
                              className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-muted"
                            >
                              Edit ingredient
                            </button>
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
