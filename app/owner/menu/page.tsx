'use client';

import { useEffect, useMemo, useState } from 'react';

import { DashboardLayout } from '@/app/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { AllergenType, MenuItem } from '@/lib/types';

import { MenuItemForm } from '@/components/owner/MenuItemForm';

const CATEGORIES: MenuItem['category'][] = [
  'appetizers',
  'mains',
  'sides',
  'desserts',
  'beverages',
];

interface DbMenuItem {
  MenuItemID: number;
  ItemName: string;
  Category: string;
  Price: number;
  PrepTimeDays: number;
  Description: string | null;
}

interface DbIngredient {
  IngredientID: number;
  IngredientName: string;
  UnitOfMeasure: string;
  CurrentStock: number;
  MaxStorageCapacity: number;
}

interface DbDishIngredient {
  DishIngredientID: number;
  MenuItemID: number;
  IngredientID: number;
  QuantityRequiredPerServing: number;
}

interface DbMenuItemAllergy {
  MenuItemID: number;
  AllergyTagID: number;
}

interface DbAllergyTag {
  AllergyTagID: number;
  AllergenName: string;
}

interface RequiredIngredient {
  id: string;
  name: string;
  qty: number;
  unit: string;
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState<MenuItem | null>(null);

  /*
   * Load all menu-related database information.
   */
  const loadMenuItems = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      /*
       * MENU_ITEM
       */
      const {
        data: menuRows,
        error: menuError,
      } = await supabase
        .from('MENU_ITEM')
        .select(
          'MenuItemID, ItemName, Category, Price, PrepTimeDays, Description'
        )
        .order('MenuItemID');

      if (menuError) {
        console.error(
          'MENU_ITEM loading error:',
          menuError
        );

        throw new Error(
          `Failed to load menu items: ${menuError.message}`
        );
      }

      /*
       * INGREDIENT
       */
      const {
        data: ingredientRows,
        error: ingredientError,
      } = await supabase
        .from('INGREDIENT')
        .select(
          'IngredientID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity'
        )
        .order('IngredientName');

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
       * DISH_INGREDIENT
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

      /*
       * MENU_ITEM_ALLERGY
       */
      const {
        data: allergyRelationRows,
        error: allergyRelationError,
      } = await supabase
        .from('MENU_ITEM_ALLERGY')
        .select(
          'MenuItemID, AllergyTagID'
        );

      if (allergyRelationError) {
        console.error(
          'MENU_ITEM_ALLERGY loading error:',
          allergyRelationError
        );

        throw new Error(
          `Failed to load menu allergens: ${allergyRelationError.message}`
        );
      }

      /*
       * ALLERGY_TAG
       */
      const {
        data: allergyTagRows,
        error: allergyTagError,
      } = await supabase
        .from('ALLERGY_TAG')
        .select(
          'AllergyTagID, AllergenName'
        )
        .order('AllergenName');

      if (allergyTagError) {
        console.error(
          'ALLERGY_TAG loading error:',
          allergyTagError
        );

        throw new Error(
          `Failed to load allergen information: ${allergyTagError.message}`
        );
      }

      const menus =
        (menuRows ?? []) as DbMenuItem[];

      const ingredients =
        (ingredientRows ?? []) as DbIngredient[];

      const dishIngredients =
        (dishIngredientRows ?? []) as DbDishIngredient[];

      const allergyRelations =
        (allergyRelationRows ?? []) as DbMenuItemAllergy[];

      const allergyTags =
        (allergyTagRows ?? []) as DbAllergyTag[];

      /*
       * Convert database records into the
       * MenuItem structure used by the form.
       */
      const formattedItems: MenuItem[] =
        menus.map((menu) => {
          /*
           * Find ingredients belonging to this dish.
           */
          const requiredIngredients: RequiredIngredient[] =
            dishIngredients
              .filter(
                (relation) =>
                  relation.MenuItemID ===
                  menu.MenuItemID
              )
              .map((relation) => {
                const ingredient =
                  ingredients.find(
                    (ing) =>
                      ing.IngredientID ===
                      relation.IngredientID
                  );

                if (!ingredient) {
                  return null;
                }

                return {
                  id: String(
                    ingredient.IngredientID
                  ),
                  name:
                    ingredient.IngredientName,
                  qty: Number(
                    relation.QuantityRequiredPerServing
                  ),
                  unit:
                    ingredient.UnitOfMeasure,
                };
              })
              .filter(
                (
                  value
                ): value is RequiredIngredient =>
                  value !== null
              );

          /*
           * Find allergens belonging to this dish.
           */
          const allergyNames: AllergenType[] =
            allergyRelations
              .filter(
                (relation) =>
                  relation.MenuItemID ===
                  menu.MenuItemID
              )
              .map((relation) => {
                const tag =
                  allergyTags.find(
                    (allergy) =>
                      allergy.AllergyTagID ===
                      relation.AllergyTagID
                  );

                return tag?.AllergenName;
              })
              .filter(
                (
                  name
                ): name is AllergenType =>
                  Boolean(name)
              );

          /*
           * Determine inventory status.
           */
          let inventoryStatus:
            | 'available'
            | 'limited'
            | 'insufficient' =
            'available';

          if (
            requiredIngredients.length > 0
          ) {
            let hasShortfall = false;
            let hasSomeStock = false;

            for (const required of requiredIngredients) {
              const ingredient =
                ingredients.find(
                  (ing) =>
                    String(
                      ing.IngredientID
                    ) === required.id
                );

              if (!ingredient) {
                hasShortfall = true;
                continue;
              }

              if (
                ingredient.CurrentStock <
                required.qty
              ) {
                hasShortfall = true;
              }

              if (
                ingredient.CurrentStock > 0
              ) {
                hasSomeStock = true;
              }
            }

            if (hasShortfall) {
              inventoryStatus =
                hasSomeStock
                  ? 'limited'
                  : 'insufficient';
            } else {
              inventoryStatus =
                'available';
            }
          }

          return {
            id: String(
              menu.MenuItemID
            ),

            name: menu.ItemName,

            description:
              menu.Description ?? '',

            category:
              menu.Category
                .toLowerCase() as MenuItem['category'],

            price: Number(
              menu.Price ?? 0
            ),

            prepTimeDays: Number(
              menu.PrepTimeDays ?? 0
            ),

            /*
             * Macros are no longer displayed
             * or stored in Supabase.
             *
             * These values only remain here because
             * the existing MenuItem TypeScript type
             * still expects the property.
             */
            macros: {
              carbs: 0,
              protein: 0,
              fat: 0,
            },

            allergyTags: allergyNames,

            requiredIngredients,

            inventoryStatus,
          };
        });

      setMenuItems(formattedItems);
    } catch (error) {
      console.error(
        'Menu loading error:',
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load menu items.'
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Load menu when the page opens.
   */
  useEffect(() => {
    loadMenuItems();
  }, []);

  /*
   * OPEN ADD FORM
   */
  const openAdd = () => {
    console.log(
      'Opening Add Menu Item form'
    );

    setEditingItem(null);
    setFormOpen(true);
  };

  /*
   * OPEN EDIT FORM
   */
  const openEdit = (item: MenuItem) => {
    console.log(
      'Opening Edit Menu Item:',
      item
    );

    setEditingItem(item);
    setFormOpen(true);
  };

  /*
   * CLOSE FORM
   */
  const closeForm = () => {
    setFormOpen(false);
    setEditingItem(null);
  };

  /*
   * AFTER SAVING
   */
  const handleFormClose = async () => {
    closeForm();

    /*
     * Reload the actual database values
     * so the page immediately reflects changes.
     */
    await loadMenuItems();
  };

  /*
   * DELETE MENU ITEM
   */
  const handleDelete = async (
    item: MenuItem
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${item.name}" from the menu?`
      );

    if (!confirmed) {
      return;
    }

    const menuItemId = Number(
      item.id
    );

    if (
      Number.isNaN(menuItemId)
    ) {
      window.alert(
        'Invalid menu item ID.'
      );
      return;
    }

    try {
      /*
       * Remove allergen relationships.
       */
      const {
        error: allergyDeleteError,
      } = await supabase
        .from('MENU_ITEM_ALLERGY')
        .delete()
        .eq(
          'MenuItemID',
          menuItemId
        );

      if (allergyDeleteError) {
        console.error(
          'MENU_ITEM_ALLERGY DELETE ERROR:',
          allergyDeleteError
        );

        throw new Error(
          allergyDeleteError.message
        );
      }

      /*
       * Remove ingredient relationships.
       */
      const {
        error: ingredientDeleteError,
      } = await supabase
        .from('DISH_INGREDIENT')
        .delete()
        .eq(
          'MenuItemID',
          menuItemId
        );

      if (ingredientDeleteError) {
        console.error(
          'DISH_INGREDIENT DELETE ERROR:',
          ingredientDeleteError
        );

        throw new Error(
          ingredientDeleteError.message
        );
      }

      /*
       * Remove the actual menu item.
       */
      const {
        error: menuDeleteError,
      } = await supabase
        .from('MENU_ITEM')
        .delete()
        .eq(
          'MenuItemID',
          menuItemId
        );

      if (menuDeleteError) {
        console.error(
          'MENU_ITEM DELETE ERROR:',
          menuDeleteError
        );

        throw new Error(
          menuDeleteError.message
        );
      }

      /*
       * Reload from Supabase.
       */
      await loadMenuItems();
    } catch (error) {
      console.error(
        'Menu item delete error:',
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : 'Unable to delete the menu item.'
      );
    }
  };

  /*
   * Group menu items by category.
   */
  const categorized = useMemo(() => {
    return CATEGORIES.reduce(
      (groups, category) => {
        groups[category] =
          menuItems.filter(
            (item) =>
              item.category ===
              category
          );

        return groups;
      },
      {} as Record<
        MenuItem['category'],
        MenuItem[]
      >
    );
  }, [menuItems]);

  return (
    <DashboardLayout>
      <div className="p-6">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-card-foreground">
              Menu Management
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage your catering menu,
              allergens, and ingredients.
            </p>
          </div>

          <Button
            onClick={openAdd}
            className="bg-primary text-white hover:bg-brand"
          >
            Add Menu Item
          </Button>
        </div>

        {/* ERROR */}
        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* LOADING */}
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            Loading menu items...
          </div>
        ) : (
          <div className="space-y-10">

            {CATEGORIES.map(
              (category) => {
                const items =
                  categorized[
                    category
                  ];

                if (
                  items.length === 0
                ) {
                  return null;
                }

                return (
                  <section
                    key={category}
                  >
                    <h2 className="text-2xl font-heading font-bold text-card-foreground mb-4 uppercase">
                      {category}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                      {items.map(
                        (item) => (
                          <Card
                            key={
                              item.id
                            }
                            className="p-6 border border-border rounded-xl"
                          >

                            {/* ITEM HEADER */}
                            <div className="flex items-start justify-between gap-4">
                              <h3 className="text-lg font-semibold text-card-foreground">
                                {item.name}
                              </h3>

                              <span className="text-lg font-semibold text-primary whitespace-nowrap">
                                ${item.price}
                              </span>
                            </div>

                            {/* DESCRIPTION */}
                            <p className="mt-3 text-sm text-muted-foreground min-h-[40px]">
                              {
                                item.description
                              }
                            </p>

                            {/* PREP + STATUS */}
                            <div className="mt-4 text-sm">
                              <span className="text-muted-foreground">
                                Prep:{' '}
                              </span>

                              <span className="text-card-foreground">
                                {
                                  item.prepTimeDays
                                }{' '}
                                {item.prepTimeDays ===
                                1
                                  ? 'day'
                                  : 'days'}
                              </span>

                              <span className="mx-1 text-muted-foreground">
                                ·
                              </span>

                              <span
                                className={
                                  item.inventoryStatus ===
                                  'available'
                                    ? 'text-green-600'
                                    : item.inventoryStatus ===
                                      'limited'
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                                }
                              >
                                {
                                  item.inventoryStatus
                                }
                              </span>
                            </div>

                            {/* ALLERGENS */}
                            {item.allergyTags
                              .length >
                              0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {item.allergyTags.map(
                                  (
                                    allergen
                                  ) => (
                                    <span
                                      key={
                                        allergen
                                      }
                                      className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                                    >
                                      {
                                        allergen
                                      }
                                    </span>
                                  )
                                )}
                              </div>
                            )}

                            {/* ACTIONS */}
                            <div className="mt-5 flex gap-2">

                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() =>
                                  openEdit(
                                    item
                                  )
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                className="px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() =>
                                  handleDelete(
                                    item
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>

                            </div>
                          </Card>
                        )
                      )}

                    </div>
                  </section>
                );
              }
            )}

            {menuItems.length ===
              0 && (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">
                  No menu items found.
                </p>

                <Button
                  onClick={openAdd}
                  className="mt-4 bg-primary text-white"
                >
                  Add your first menu item
                </Button>
              </div>
            )}

          </div>
        )}

      </div>

      {/* MENU ITEM FORM */}
      <MenuItemForm
        open={formOpen}
        item={editingItem}
        onClose={handleFormClose}
      />
    </DashboardLayout>
  );
}