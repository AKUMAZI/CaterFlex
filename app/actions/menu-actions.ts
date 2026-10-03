'use server'

import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'

type DishIngredientRow = {
  MenuItemID: number
  IngredientID: number
  QuantityRequiredPerServing: number
}

export async function replaceDishIngredients(menuItemId: number, rows: DishIngredientRow[]) {
  const user = await requireRole('owner')
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error: deleteError } = await admin.from('DISH_INGREDIENT').delete().eq('MenuItemID', menuItemId)
  if (deleteError) throw new Error(deleteError.message)

  if (rows.length === 0) return
  const { error: insertError } = await admin.from('DISH_INGREDIENT').insert(rows)
  if (insertError) throw new Error(insertError.message)
}
