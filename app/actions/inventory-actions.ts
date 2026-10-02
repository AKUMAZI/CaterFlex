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
      Category: input.category,
      UnitOfMeasure: 'units',
      MaxStorageCapacity: Math.max(input.quantity, 100),
    })
    .select('IngredientID, OperatorID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity, Category')
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
    .update({ IngredientName: name, CurrentStock: input.quantity, Category: input.category })
    .eq('IngredientID', ingredientId)
    .select('IngredientID, OperatorID, IngredientName, UnitOfMeasure, CurrentStock, MaxStorageCapacity, Category')
    .single();

  if (error) {
    console.error('Ingredient update error:', error);
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, ingredient: data };
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
