'use server';

import { requireRole } from '@/app/actions/auth';
import { createAdminClient } from '@/lib/supabase-admin';

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