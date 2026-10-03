'use server'

import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'

type MenuItemUpdate = {
  ItemName: string
  Category: string
  Price: number
  PrepTimeDays: number
  Description: string
  Availability: boolean
}

export async function updateMenuItem(menuItemId: number, values: MenuItemUpdate) {
  const user = await requireRole('owner')
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error } = await admin.from('MENU_ITEM').update(values).eq('MenuItemID', menuItemId)
  if (error) throw new Error(error.message)
}

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
