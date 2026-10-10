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

type MenuItemCreate = MenuItemUpdate

export function validatePerServingQuantity(value: number): string | null {
  if (!Number.isInteger(value) || value < 1) {
    return 'Per-serving quantity must be a whole number greater than or equal to 1.'
  }
  return null
}

export async function createMenuItem(values: MenuItemCreate) {
  const user = await requireRole('owner')
  if (!user) throw new Error('Unauthorized')
  const admin = createAdminClient()
  const { data, error } = await admin.from('MENU_ITEM').insert(values).select('MenuItemID').single()
  if (error || !data) throw new Error(error?.message ?? 'Unable to create the menu item.')
  return Number(data.MenuItemID)
}

export async function updateMenuItem(menuItemId: number, values: MenuItemUpdate) {
  const user = await requireRole('owner')
  if (!user) throw new Error('Unauthorized')
  const admin = createAdminClient()
  const { error } = await admin.from('MENU_ITEM').update(values).eq('MenuItemID', menuItemId)
  if (error) throw new Error(error.message)
}

type DishIngredientRow = { MenuItemID: number; IngredientID: number; QuantityRequiredPerServing: number }
type MenuAllergyRow = { MenuItemID: number; AllergyTagID: number }

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
  const invalidQuantity = rows.map((row) => validatePerServingQuantity(row.QuantityRequiredPerServing)).find(Boolean)
  if (invalidQuantity) throw new Error(invalidQuantity)
  const admin = createAdminClient()
  const { error: deleteError } = await admin.from('DISH_INGREDIENT').delete().eq('MenuItemID', menuItemId)
  if (deleteError) throw new Error(deleteError.message)
  if (rows.length === 0) return
  const { error: insertError } = await admin.from('DISH_INGREDIENT').insert(rows)
  if (insertError) throw new Error(insertError.message)
}

export async function uploadMenuItemPhoto(menuItemId: number, file: File) {
  const user = await requireRole('owner')
  if (!user) throw new Error('Unauthorized')
  if (!file || file.size === 0) throw new Error('No photo was selected.')
  if (!file.type.startsWith('image/')) throw new Error('Please upload an image file.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Photo must be 5 MB or smaller.')
  const admin = createAdminClient()
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filePath = `${menuItemId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await admin.storage.from('menu-images').upload(filePath, file, { contentType: file.type, upsert: false })
  if (uploadError) throw new Error(`Unable to upload menu photo: ${uploadError.message}`)
  const { data: publicUrlData } = admin.storage.from('menu-images').getPublicUrl(filePath)
  const { error: updateError } = await admin.from('MENU_ITEM').update({ PhotoURL: publicUrlData.publicUrl }).eq('MenuItemID', menuItemId)
  if (updateError) throw new Error(`Photo uploaded but could not save its URL: ${updateError.message}`)
  return publicUrlData.publicUrl
}
