'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/app/actions/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { computeOrderIngredientUsage, expandRecurringDates, servingsForBookingItem, servingsForOrder } from '../../lib/rules/allocation'

async function markPrepared(input: { bookingId?: number; mealPrepOrderId?: number; cycleDate?: string }) {
  const owner = await requireRole('owner')
  if (!owner) return { ok: false as const, error: 'Owner access required.' }
  const admin = createAdminClient()
  const operatorId = Number(owner.id)
  const isBooking = input.bookingId !== undefined
  const id = Number(isBooking ? input.bookingId : input.mealPrepOrderId)
  if (!Number.isInteger(id) || id <= 0) return { ok: false as const, error: 'Invalid order.' }

  const table = isBooking ? 'BOOKING' : 'MEAL_PREP_ORDER'
  const idField = isBooking ? 'BookingID' : 'MealPrepOrderID'
  const { data: order, error: orderError } = await admin.from(table).select(isBooking ? 'BookingID, OperatorID, GuestCount, Status, EventDate' : 'MealPrepOrderID, OperatorID, MealsPerCycle, Status, NextFulfillmentDate').eq(idField, id).eq('OperatorID', operatorId).in('Status', isBooking ? ['confirmed'] : ['active', 'confirmed']).maybeSingle()
  if (orderError || !order) return { ok: false as const, error: orderError?.message ?? 'Order was not found or is not ready.' }
  const preparedOrder = order as Record<string, unknown>
  if (!isBooking) {
    const pattern = String(preparedOrder.RecurrencePattern) as 'weekly' | 'biweekly';
    const cycleDates = expandRecurringDates(String(preparedOrder.NextFulfillmentDate), pattern);
    if (!input.cycleDate || !cycleDates.some((date) => date.slice(0, 10) === input.cycleDate)) {
      return { ok: false as const, error: 'Choose a scheduled cycle for this order.' };
    }
  }

  const itemTable = isBooking ? 'BOOKING_ITEM' : 'MEAL_PREP_ITEM'
  const itemField = isBooking ? 'BookingID' : 'MealPrepOrderID'
  const { data: items, error: itemError } = await admin.from(itemTable).select(isBooking ? 'MenuItemID, Quantity' : 'MenuItemID, Quantity').eq(itemField, id)
  if (itemError) return { ok: false as const, error: itemError.message }
  const menuIds = (items ?? []).map((item) => Number(item.MenuItemID))
  const { data: recipes, error: recipeError } = menuIds.length ? await admin.from('DISH_INGREDIENT').select('MenuItemID, IngredientID, QuantityRequiredPerServing').in('MenuItemID', menuIds) : { data: [], error: null }
  if (recipeError) return { ok: false as const, error: recipeError.message }
  const recipeMap = new Map<number, { ingredientId: number; qtyPerServing: number }[]>()
  for (const row of recipes ?? []) {
    const list = recipeMap.get(Number(row.MenuItemID)) ?? []
    list.push({ ingredientId: Number(row.IngredientID), qtyPerServing: Number(row.QuantityRequiredPerServing ?? 0) })
    recipeMap.set(Number(row.MenuItemID), list)
  }
  const servings = servingsForOrder(isBooking ? 'booking' : 'meal_prep', isBooking ? Number(preparedOrder.GuestCount) : undefined, isBooking ? undefined : Number(preparedOrder.MealsPerCycle))
  const usage = computeOrderIngredientUsage((items ?? []).map((item) => ({ menuItemId: Number(item.MenuItemID), servings: isBooking ? servingsForBookingItem(Number(item.Quantity), Number(preparedOrder.GuestCount)) : undefined })), servings, recipeMap)
  const { error: rpcError } = await admin.rpc('mark_prepared', { p_operator_id: operatorId, p_booking_id: isBooking ? id : null, p_meal_prep_order_id: isBooking ? null : id, p_cycle_date: isBooking ? null : input.cycleDate, p_usage: usage.map((item) => ({ ingredientId: item.ingredientId, quantity: item.quantity })) })
  if (rpcError) return { ok: false as const, error: rpcError.message.replace(/^.*?ERROR:\s*/i, '') }
  revalidatePath('/owner/prep-schedule')
  revalidatePath('/owner/inventory')
  return { ok: true as const }
}

export async function markBookingPrepared(bookingId: number) { return markPrepared({ bookingId }) }
export async function markMealPrepCyclePrepared(orderId: number, cycleDate: string) { return markPrepared({ mealPrepOrderId: orderId, cycleDate }) }
