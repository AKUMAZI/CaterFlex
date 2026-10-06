'use server';

import { requireRole } from '@/app/actions/auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function createIngredient(input: {
  name: string;
  quantity: number;
  category: string;
}) {
  const owner = await requireRole('owner');

  if (!owner) {
    return { ok: false as const, error: 'Owner access required.' };
  }

  const name = input.name.trim();
  if (!name || !Number.isFinite(input.quantity) || input.quantity < 0) {
    return { ok: false as const, error: 'Enter a valid ingredient name and quantity.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('INGREDIENT')
    .insert({
      IngredientName: name,
      CurrentStock: input.quantity,
      category: input.category,
      UnitOfMeasure: 'units',
      MaxStorageCapacity: Math.max(input.quantity, 100),
    })
    .select('IngredientID, OperatorID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity, category')
    .single();

  if (error) {
    console.error('Ingredient creation error:', error);
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, ingredient: data };
}

export async function updateIngredient(
  ingredientId: number,
  input: { name: string; quantity: number; category: string }
) {
  const owner = await requireRole('owner');

  if (!owner) {
    return { ok: false as const, error: 'Owner access required.' };
  }

  const name = input.name.trim();
  if (!Number.isFinite(ingredientId) || !name || !Number.isFinite(input.quantity) || input.quantity < 0) {
    return { ok: false as const, error: 'Enter a valid ingredient name and quantity.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('INGREDIENT')
    .update({ IngredientName: name, CurrentStock: input.quantity, category: input.category })
    .eq('IngredientID', ingredientId)
    .select('IngredientID, OperatorID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity, category')
    .single();

  if (error) {
    console.error('Ingredient update error:', error);
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, ingredient: data };
}

type DishIngredientInput = { ingredientId: number; quantity: number }

export async function createDish(input: { name: string; category: string; price: number; prepTimeDays: number; description: string; availability?: boolean; ingredients?: DishIngredientInput[] }) {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.' }
  const name = input.name.trim()
  if (!name || !Number.isFinite(input.price) || input.price < 0 || !Number.isFinite(input.prepTimeDays) || input.prepTimeDays < 0) return { ok: false as const, error: 'Enter a valid dish name, price, and prep time.' }
  const admin = createAdminClient()
  const { data, error } = await admin.from('MENU_ITEM').insert({ ItemName: name, Category: input.category, Price: input.price, PrepTimeDays: input.prepTimeDays, Description: input.description.trim(), Availability: input.availability ?? true }).select('MenuItemID, ItemName, Category, Price, PrepTimeDays, Description, Availability').maybeSingle()
  if (error || !data) return { ok: false as const, error: error?.message ?? 'The menu item could not be created.' }
  if (input.ingredients?.length) {
    const { error: ingredientError } = await admin.from('DISH_INGREDIENT').insert(input.ingredients.map((entry) => ({ MenuItemID: data.MenuItemID, IngredientID: entry.ingredientId, QuantityRequiredPerServing: entry.quantity })))
    if (ingredientError) return { ok: false as const, error: ingredientError.message }
  }
  return { ok: true as const, menuItem: data }
}

export async function updateDish(dishId: number, input: { name: string; category: string; price?: number; prepTimeDays?: number; description: string; availability?: boolean }) {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.' }
  const name = input.name.trim()
  if (!Number.isFinite(dishId) || !name || !Number.isFinite(input.price) || !Number.isFinite(input.prepTimeDays)) return { ok: false as const, error: 'Enter valid menu item details.' }
  const { data, error } = await createAdminClient().from('MENU_ITEM').update({ ItemName: name, Category: input.category, ...(input.price === undefined ? {} : { Price: input.price }), ...(input.prepTimeDays === undefined ? {} : { PrepTimeDays: input.prepTimeDays }), Description: input.description.trim(), ...(input.availability === undefined ? {} : { Availability: input.availability }) }).eq('MenuItemID', dishId).select('MenuItemID, ItemName, Category, Price, PrepTimeDays, Description, Availability').maybeSingle()
  if (error || !data) return { ok: false as const, error: error?.message ?? 'The menu item could not be updated.' }
  return { ok: true as const, menuItem: data }
}

export async function updateDishAvailability(dishId: number, availability: boolean) {
  const owner = await requireRole('owner');
  if (!owner) return { ok: false as const, error: 'Owner access required.' };
  if (!Number.isFinite(dishId)) return { ok: false as const, error: 'Invalid dish.' };
  const { error } = await createAdminClient().from('MENU_ITEM').update({ Availability: availability }).eq('MenuItemID', dishId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, availability };
}

export async function updateIngredientStock(
  ingredientId: number,
  newStock: number
) {
  const owner = await requireRole('owner');

  if (!owner) {
    return {
      ok: false as const,
      error: 'Owner access required.',
    };
  }

  if (
    !Number.isFinite(ingredientId) ||
    !Number.isFinite(newStock) ||
    newStock < 0
  ) {
    return {
      ok: false as const,
      error: 'Invalid ingredient or stock value.',
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('INGREDIENT')
    .update({
      CurrentStock: newStock,
    })
    .eq('IngredientID', ingredientId)
    .select(
      'IngredientID, CurrentStock'
    )
    .maybeSingle();

  if (error) {
    console.error(
      'Ingredient stock update error:',
      error
    );

    return {
      ok: false as const,
      error: error.message,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      error: `Ingredient ${ingredientId} was not found.`,
    };
  }

  return {
    ok: true as const,
    currentStock: Number(data.CurrentStock),
  };
}
