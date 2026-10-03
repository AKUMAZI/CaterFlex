'use server'

import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'

type DishIngredientRow = {
  MenuItemID: number
  IngredientID: number
  QuantityRequiredPerServing: number
}

type MenuAllergyRow = {
  MenuItemID: number
  AllergyTagID: number
}

export async function replaceMenuItemAllergies(menuItemId: number, rows: MenuAllergyRow[]) {
  const user = await requireRole('owner')
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error: deleteError } = await admin.from('MENU_ITEM_ALLERGY').delete().eq('MenuItemID', menuItemId)
  if (deleteError) throw new Error(deleteError.message)

  if (rows.length === 0) return
  const { error: insertError } = await admin.from('MENU_ITEM_ALLERGY').insert(rows)
  if (insertError) throw new Error(insertError.message)
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
