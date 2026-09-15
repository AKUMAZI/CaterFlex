'use client';

import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { AllergenType, MenuItem } from '@/lib/types';

const CATEGORIES: MenuItem['category'][] = [
  'appetizers',
  'mains',
  'sides',
  'desserts',
  'beverages',
];

const FALLBACK_ALLERGEN_OPTIONS: AllergenType[] = [
  'shellfish',
  'peanuts',
  'dairy',
  'gluten',
  'eggs',
  'soy',
];

export type MenuItemFormValues = Omit<
  MenuItem,
  'inventoryStatus' | 'macros'
>;

interface MenuItemFormProps {
  open: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onSaved?: () => void;
}

interface DbIngredient {
  IngredientID: number;
  IngredientName: string;
  UnitOfMeasure: string;
  CurrentStock: number;
  MaxStorageCapacity: number;
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

/*
 * Convert a database-loaded MenuItem into
 * the form structure.
 */
function toFormValues(
  item: MenuItem | null
): MenuItemFormValues {
  if (item) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      prepTimeDays: item.prepTimeDays,
      allergyTags: item.allergyTags ?? [],
      requiredIngredients:
        item.requiredIngredients ?? [],
    };
  }

  return {
    id: '',
    name: '',
    description: '',
    category: 'mains',
    price: 0,
    prepTimeDays: 1,
    allergyTags: [],
    requiredIngredients: [],
  };
}

export function MenuItemForm({
  open,
  item,
  onClose,
  onSaved,
}: MenuItemFormProps) {
  const [form, setForm] =
    useState<MenuItemFormValues>(
      () => toFormValues(item)
    );

  /*
   * Price is kept as a string while editing.
   *
   * This allows the user to:
   * - delete the current price
   * - type a new price
   * - type decimal values
   * - freely edit an existing price
   */
  const [priceInput, setPriceInput] =
    useState('');

  const [ingredients, setIngredients] =
    useState<DbIngredient[]>([]);

  const [allergyTags, setAllergyTags] =
    useState<DbAllergyTag[]>([]);

  const [ingredientId, setIngredientId] =
    useState('');

  const [ingredientQty, setIngredientQty] =
    useState('');

  const [loadingData, setLoadingData] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const isEditing = Boolean(item);

  /*
   * Load all database information needed
   * by the form.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const loadFormData = async () => {
      setLoadingData(true);
      setErrorMessage('');

      /*
       * Reset form values whenever the form
       * opens for a new/different item.
       */
      setForm(toFormValues(item));

      /*
       * IMPORTANT:
       * Keep price separate as a string.
       */
      setPriceInput(
        item
          ? String(item.price ?? '')
          : ''
      );

      setIngredientId('');
      setIngredientQty('');

      try {
        /*
         * Load ingredients and allergy tags
         * directly from Supabase.
         */
        const [
          {
            data: ingredientData,
            error: ingredientError,
          },
          {
            data: allergyData,
            error: allergyError,
          },
        ] = await Promise.all([
          supabase
            .from('INGREDIENT')
            .select(
              `
                IngredientID,
                IngredientName,
                UnitOfMeasure,
                CurrentStock,
                MaxStorageCapacity
              `
            )
            .order('IngredientName', {
              ascending: true,
            }),

          supabase
            .from('ALLERGY_TAG')
            .select(
              'AllergyTagID, AllergenName'
            )
            .order('AllergenName', {
              ascending: true,
            }),
        ]);

        if (ingredientError) {
          console.error(
            'INGREDIENT loading error:',
            ingredientError
          );

          throw new Error(
            'Unable to load ingredients from the database.'
          );
        }

        if (allergyError) {
          console.error(
            'ALLERGY_TAG loading error:',
            allergyError
          );

          throw new Error(
            'Unable to load allergy tags from the database.'
          );
        }

        setIngredients(
          ingredientData ?? []
        );

        setAllergyTags(
          allergyData ?? []
        );

        /*
         * If editing an existing menu item,
         * load its relationships from Supabase.
         */
        if (item) {
          const menuItemId =
            Number(item.id);

          if (
            Number.isNaN(menuItemId)
          ) {
            throw new Error(
              'Invalid menu item ID.'
            );
          }

          const [
            {
              data: dishIngredients,
              error: dishIngredientError,
            },
            {
              data: menuAllergies,
              error: menuAllergyError,
            },
          ] = await Promise.all([
            supabase
              .from('DISH_INGREDIENT')
              .select(
                `
                  IngredientID,
                  QuantityRequiredPerServing
                `
              )
              .eq(
                'MenuItemID',
                menuItemId
              ),

            supabase
              .from('MENU_ITEM_ALLERGY')
              .select(
                'AllergyTagID'
              )
              .eq(
                'MenuItemID',
                menuItemId
              ),
          ]);

          if (dishIngredientError) {
            console.error(
              'DISH_INGREDIENT loading error:',
              dishIngredientError
            );

            throw new Error(
              'Unable to load the menu item ingredients.'
            );
          }

          if (menuAllergyError) {
            console.error(
              'MENU_ITEM_ALLERGY loading error:',
              menuAllergyError
            );

            throw new Error(
              'Unable to load the menu item allergens.'
            );
          }

          /*
           * Convert database ingredient
           * relationships into the form structure.
           */
          const requiredIngredients: RequiredIngredient[] =
            (dishIngredients ?? [])
              .map((row) => {
                const ingredient =
                  (
                    ingredientData ?? []
                  ).find(
                    (ing) =>
                      ing.IngredientID ===
                      row.IngredientID
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
                    row.QuantityRequiredPerServing
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
           * Convert database allergy IDs
           * into allergen names.
           */
          const selectedAllergens: AllergenType[] =
            (menuAllergies ?? [])
              .map((row) => {
                const tag =
                  (
                    allergyData ?? []
                  ).find(
                    (allergy) =>
                      allergy.AllergyTagID ===
                      row.AllergyTagID
                  );

                return tag?.AllergenName;
              })
              .filter(
                (
                  name
                ): name is AllergenType => {
                  if (!name) {
                    return false;
                  }

                  return FALLBACK_ALLERGEN_OPTIONS.includes(
                    name as AllergenType
                  );
                }
              );

          /*
           * Put the database relationships
           * into the form.
           */
          setForm((previous) => ({
            ...previous,
            requiredIngredients,
            allergyTags:
              selectedAllergens,
          }));
        }
      } catch (error) {
        console.error(
          'Menu item form loading error:',
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load menu item data.'
        );
      } finally {
        setLoadingData(false);
      }
    };

    loadFormData();
  }, [open, item]);

  /*
   * Do not render anything while closed.
   */
  if (!open) {
    return null;
  }

  /*
   * Toggle allergen selection.
   */
  const toggleAllergen = (
    tag: AllergenType
  ) => {
    setForm((previous) => ({
      ...previous,
      allergyTags:
        previous.allergyTags.includes(tag)
          ? previous.allergyTags.filter(
              (existingTag) =>
                existingTag !== tag
            )
          : [
              ...previous.allergyTags,
              tag,
            ],
    }));
  };

  /*
   * Add an ingredient to the dish.
   */
  const addIngredient = () => {
    const ingredient =
      ingredients.find(
        (ing) =>
          String(
            ing.IngredientID
          ) === ingredientId
      );

    const quantity =
      parseFloat(ingredientQty);

    if (!ingredient) {
      setErrorMessage(
        'Please select an ingredient.'
      );
      return;
    }

    if (
      !quantity ||
      quantity <= 0
    ) {
      setErrorMessage(
        'Please enter a quantity greater than 0.'
      );
      return;
    }

    const alreadyExists =
      form.requiredIngredients.some(
        (required) =>
          required.id ===
          String(
            ingredient.IngredientID
          )
      );

    if (alreadyExists) {
      setErrorMessage(
        'This ingredient has already been added.'
      );
      return;
    }

    setForm((previous) => ({
      ...previous,
      requiredIngredients: [
        ...previous.requiredIngredients,
        {
          id: String(
            ingredient.IngredientID
          ),
          name:
            ingredient.IngredientName,
          qty: quantity,
          unit:
            ingredient.UnitOfMeasure,
        },
      ],
    }));

    setIngredientId('');
    setIngredientQty('');
    setErrorMessage('');
  };

  /*
   * Remove an ingredient.
   */
  const removeIngredient = (
    id: string
  ) => {
    setForm((previous) => ({
      ...previous,
      requiredIngredients:
        previous.requiredIngredients.filter(
          (required) =>
            required.id !== id
        ),
    }));
  };

  /*
   * Save menu item directly to Supabase.
   */
  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    /*
     * Validate name.
     */
    if (!form.name.trim()) {
      setErrorMessage(
        'Menu item name is required.'
      );
      return;
    }

    /*
     * Validate description.
     */
    if (!form.description.trim()) {
      setErrorMessage(
        'Menu item description is required.'
      );
      return;
    }

    /*
     * Validate price.
     */
    const numericPrice =
      Number(priceInput);

    if (
      priceInput.trim() === '' ||
      Number.isNaN(numericPrice) ||
      numericPrice < 0
    ) {
      setErrorMessage(
        'Please enter a valid price.'
      );
      return;
    }

    setSaving(true);
    setErrorMessage('');

    try {
      /*
       * Check the current Supabase session.
       */
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      console.log(
        'SUPABASE SESSION BEFORE MENU SAVE:',
        {
          hasSession: !!session,
          userId:
            session?.user?.id ??
            null,
          email:
            session?.user?.email ??
            null,
        }
      );

      /*
       * Convert the UI category into
       * the database category format.
       *
       * Example:
       * mains -> Mains
       */
      const databaseCategory =
        form.category
          .charAt(0)
          .toUpperCase() +
        form.category.slice(1);

      let menuItemId: number;

      /*
       * ====================================
       * CREATE MENU ITEM
       * ====================================
       */
      if (!isEditing || !item) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        console.log('SUPABASE SESSION BEFORE MENU SAVE:', {
          hasSession: !!session,
          userId: session?.user?.id ?? null,
          email: session?.user?.email ?? null,
        });
        
        const {
          data,
          error,
        } = await supabase
          .from('MENU_ITEM')
          .insert({
            ItemName:
              form.name.trim(),

            Category:
              databaseCategory,

            Price:
              numericPrice,

            PrepTimeDays:
              Math.max(
                0,
                Number(
                  form.prepTimeDays
                ) || 0
              ),

            Description:
              form.description.trim(),
          })
          .select('MenuItemID')
          .single();

        if (
          error ||
          !data
        ) {
          console.error(
            'MENU_ITEM INSERT ERROR:',
            error
          );

          throw new Error(
            error?.message ??
              'Unable to create the menu item.'
          );
        }

        menuItemId =
          Number(
            data.MenuItemID
          );

          
      }

      /*
       * ====================================
       * UPDATE MENU ITEM
       * ====================================
       */
      else {
        menuItemId =
          Number(item.id);

        if (
          Number.isNaN(
            menuItemId
          )
        ) {
          throw new Error(
            'Invalid menu item ID.'
          );
        }

        const {
          error,
        } = await supabase
          .from('MENU_ITEM')
          .update({
            ItemName:
              form.name.trim(),

            Category:
              databaseCategory,

            Price:
              numericPrice,

            PrepTimeDays:
              Math.max(
                0,
                Number(
                  form.prepTimeDays
                ) || 0
              ),

            Description:
              form.description.trim(),
          })
          .eq(
            'MenuItemID',
            menuItemId
          );

        if (error) {
          console.error(
            'MENU_ITEM UPDATE ERROR:',
            error
          );

          throw new Error(
            error.message ||
              'Unable to update the menu item.'
          );
        }
      }

      /*
       * ====================================
       * REMOVE OLD INGREDIENT RELATIONSHIPS
       * ====================================
       *
       * We remove the old rows first and
       * recreate them from the current form.
       */
      const {
        error:
          deleteIngredientError,
      } = await supabase
        .from('DISH_INGREDIENT')
        .delete()
        .eq(
          'MenuItemID',
          menuItemId
        );

      if (
        deleteIngredientError
      ) {
        console.error(
          'DISH_INGREDIENT DELETE ERROR:',
          deleteIngredientError
        );

        throw new Error(
          deleteIngredientError.message
        );
      }

      /*
       * ====================================
       * REMOVE OLD ALLERGEN RELATIONSHIPS
       * ====================================
       */
      const {
        error:
          deleteAllergyError,
      } = await supabase
        .from('MENU_ITEM_ALLERGY')
        .delete()
        .eq(
          'MenuItemID',
          menuItemId
        );

      if (
        deleteAllergyError
      ) {
        console.error(
          'MENU_ITEM_ALLERGY DELETE ERROR:',
          deleteAllergyError
        );

        throw new Error(
          deleteAllergyError.message
        );
      }

      /*
       * ====================================
       * SAVE INGREDIENT RELATIONSHIPS
       * ====================================
       */
      if (
        form.requiredIngredients
          .length > 0
      ) {
        const dishIngredientRows =
          form.requiredIngredients.map(
            (ingredient) => ({
              MenuItemID:
                menuItemId,

              IngredientID:
                Number(
                  ingredient.id
                ),

              QuantityRequiredPerServing:
                Number(
                  ingredient.qty
                ),
            })
          );

        const {
          error:
            dishIngredientError,
        } = await supabase
          .from('DISH_INGREDIENT')
          .insert(
            dishIngredientRows
          );

        if (
          dishIngredientError
        ) {
          console.error(
            'DISH_INGREDIENT INSERT ERROR:',
            dishIngredientError
          );

          /*
           * If this was a newly created
           * menu item, remove it if the
           * relationship save failed.
           */
          if (!isEditing) {
            await supabase
              .from('MENU_ITEM')
              .delete()
              .eq(
                'MenuItemID',
                menuItemId
              );
          }

          throw new Error(
            dishIngredientError.message
          );
        }
      }

      /*
       * ====================================
       * SAVE ALLERGEN RELATIONSHIPS
       * ====================================
       */
      if (
        form.allergyTags.length > 0
      ) {
        const menuAllergyRows =
          form.allergyTags
            .map((allergen) => {
              const tag =
                allergyTags.find(
                  (allergy) =>
                    allergy.AllergenName ===
                    allergen
                );

              if (!tag) {
                return null;
              }

              return {
                MenuItemID:
                  menuItemId,

                AllergyTagID:
                  tag.AllergyTagID,
              };
            })
            .filter(
              (
                row
              ): row is {
                MenuItemID: number;
                AllergyTagID: number;
              } =>
                row !== null
            );

        if (
          menuAllergyRows.length > 0
        ) {
          console.log(
            'MENU_ITEM_ALLERGY ROWS:',
            menuAllergyRows
          );

          const {
            error:
              menuAllergyError,
          } = await supabase
            .from(
              'MENU_ITEM_ALLERGY'
            )
            .insert(
              menuAllergyRows
            );

          if (
            menuAllergyError
          ) {
            console.error(
              'MENU_ITEM_ALLERGY INSERT ERROR:',
              menuAllergyError
            );

            /*
             * If this is a newly created
             * item and its relationships
             * fail, remove the menu item.
             */
            if (!isEditing) {
              await supabase
                .from('MENU_ITEM')
                .delete()
                .eq(
                  'MenuItemID',
                  menuItemId
                );
            }

            throw new Error(
              menuAllergyError.message
            );
          }
        }
      }

      /*
       * ====================================
       * SUCCESS
       * ====================================
       *
       * Supabase is now the source of truth.
       *
       * We intentionally DO NOT call:
       *
       * addMenuItem()
       * updateMenuItem()
       *
       * because those are Zustand/mock
       * operations.
       */

      console.log(
        'MENU ITEM SAVED TO SUPABASE:',
        menuItemId
      );

      /*
       * Tell the parent page that the
       * database has changed.
       */
      onSaved?.();

      onClose();
    } catch (error) {
      console.error(
        'Menu item save error:',
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save the menu item.'
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * Shared input styling.
   */
  const inputClass =
    'mt-1 w-full px-3 py-2 border border-border rounded-lg bg-input text-card-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl font-bold text-card-foreground">
            {isEditing
              ? 'Edit Menu Item'
              : 'Add Menu Item'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR MESSAGE */}
        {errorMessage && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* LOADING */}
        {loadingData ? (
          <div className="py-12 text-center text-muted-foreground">
            Loading menu item data...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* BASIC INFORMATION */}
            <div className="grid md:grid-cols-2 gap-4">

              {/* NAME */}
              <div className="md:col-span-2">
                <label className="text-sm text-muted-foreground">
                  Name *
                </label>

                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name:
                        e.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="Dish name"
                />
              </div>

              {/* DESCRIPTION */}
              <div className="md:col-span-2">
                <label className="text-sm text-muted-foreground">
                  Description *
                </label>

                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description:
                        e.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="Short description for customers"
                />
              </div>

              {/* CATEGORY */}
              <div>
                <label className="text-sm text-muted-foreground">
                  Category
                </label>

                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category:
                        e.target
                          .value as MenuItem['category'],
                    })
                  }
                  className={inputClass}
                >
                  {CATEGORIES.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category
                          .charAt(0)
                          .toUpperCase() +
                          category.slice(1)}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* PRICE */}
              <div>
                <label className="text-sm text-muted-foreground">
                  Price ($)
                </label>

                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceInput}
                  onChange={(e) => {
                    setPriceInput(
                      e.target.value
                    );
                  }}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              {/* PREP TIME */}
              <div>
                <label className="text-sm text-muted-foreground">
                  Prep time (days)
                </label>

                <input
                  type="number"
                  min={0}
                  value={
                    form.prepTimeDays
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      prepTimeDays:
                        parseInt(
                          e.target.value,
                          10
                        ) || 0,
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {/* ALLERGENS */}
            <div>
              <p className="text-sm font-medium text-card-foreground mb-3">
                Allergens
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(
                  allergyTags.length > 0
                    ? allergyTags
                    : FALLBACK_ALLERGEN_OPTIONS.map(
                        (
                          name,
                          index
                        ) => ({
                          AllergyTagID:
                            index + 1,
                          AllergenName:
                            name,
                        })
                      )
                ).map((tag) => {
                  const allergen =
                    tag.AllergenName as AllergenType;

                  return (
                    <label
                      key={
                        tag.AllergyTagID
                      }
                      className="flex items-center gap-2 text-sm text-card-foreground cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.allergyTags.includes(
                          allergen
                        )}
                        onChange={() =>
                          toggleAllergen(
                            allergen
                          )
                        }
                        className="rounded border-border"
                      />

                      <span className="capitalize">
                        {tag.AllergenName.replace(
                          '_',
                          ' '
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* REQUIRED INGREDIENTS */}
            <div>
              <p className="text-sm font-medium text-card-foreground mb-3">
                Required ingredients (per serving)
              </p>

              {/* CURRENT INGREDIENTS */}
              {form.requiredIngredients
                .length > 0 && (
                <ul className="space-y-2 mb-3">
                  {form.requiredIngredients.map(
                    (required) => (
                      <li
                        key={
                          required.id
                        }
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                      >
                        <span className="text-card-foreground">
                          {
                            required.name
                          }{' '}
                          —{' '}
                          {
                            required.qty
                          }
                          {
                            required.unit
                          }
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            removeIngredient(
                              required.id
                            )
                          }
                          className="text-red-600 text-xs hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    )
                  )}
                </ul>
              )}

              {/* ADD INGREDIENT */}
              <div className="flex flex-wrap gap-2 items-end">

                {/* INGREDIENT */}
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs text-muted-foreground">
                    Ingredient
                  </label>

                  <select
                    value={
                      ingredientId
                    }
                    onChange={(e) =>
                      setIngredientId(
                        e.target.value
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">
                      Select…
                    </option>

                    {ingredients.map(
                      (ingredient) => (
                        <option
                          key={
                            ingredient.IngredientID
                          }
                          value={String(
                            ingredient.IngredientID
                          )}
                        >
                          {
                            ingredient.IngredientName
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* QUANTITY */}
                <div className="w-24">
                  <label className="text-xs text-muted-foreground">
                    Qty
                  </label>

                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={
                      ingredientQty
                    }
                    onChange={(e) =>
                      setIngredientQty(
                        e.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="0"
                  />
                </div>

                {/* ADD BUTTON */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={
                    addIngredient
                  }
                >
                  Add
                </Button>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-3 pt-2 border-t border-border">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-primary text-white hover:bg-brand"
              >
                {saving
                  ? 'Saving...'
                  : isEditing
                  ? 'Save Changes'
                  : 'Add Item'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}