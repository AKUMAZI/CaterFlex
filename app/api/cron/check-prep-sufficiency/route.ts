import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { checkSufficiency, getAllocatedIngredients } from '@/lib/macroflex'
import { createNotification, hasNotificationForToday } from '@/lib/notifications'
import { prepStartDate } from '@/lib/rules/mealPrep'

export const dynamic = 'force-dynamic'

const dateOnly = (date: Date) => date.toISOString().slice(0, 10)
const todayDate = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d }

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const today = todayDate()
  const todayString = dateOnly(today)
  const { data: bookings, error } = await admin.from('BOOKING').select('BookingID, OperatorID, EventDate, GuestCount').eq('Status', 'confirmed').gte('EventDate', todayString)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const bookingIds = (bookings ?? []).map((b) => b.BookingID)
  const { data: bookingItems } = bookingIds.length ? await admin.from('BOOKING_ITEM').select('BookingID, MenuItemID, Quantity').in('BookingID', bookingIds) : { data: [] }
  const menuIds = [...new Set((bookingItems ?? []).map((i) => i.MenuItemID))]
  const { data: menuItems } = menuIds.length ? await admin.from('MENU_ITEM').select('MenuItemID, ItemName, PrepTimeDays').in('MenuItemID', menuIds) : { data: [] }
  const menuById = new Map((menuItems ?? []).map((m) => [Number(m.MenuItemID), m]))
  let checked = 0, notified = 0, mealPrepChecked = 0, mealPrepNotified = 0

  for (const booking of bookings ?? []) {
    const items = (bookingItems ?? []).filter((i) => i.BookingID === booking.BookingID)
    const fulfillmentDate = new Date(`${booking.EventDate}T12:00:00`)
    const bookingPrepDates = items.map((item) => prepStartDate(String(booking.EventDate), Number(menuById.get(Number(item.MenuItemID))?.PrepTimeDays ?? 0)))
    const bookingWindowStart = bookingPrepDates.length ? new Date(Math.min(...bookingPrepDates.map((date) => date.getTime()))) : fulfillmentDate
    const allocated = await getAllocatedIngredients(Number(booking.OperatorID), bookingWindowStart, fulfillmentDate, `booking:${booking.BookingID}`)
    const allocatedByIngredient = Object.fromEntries(allocated)
    for (const item of items) {
      const menuItem = menuById.get(Number(item.MenuItemID))
      if (!menuItem || prepStartDate(String(booking.EventDate), Number(menuItem.PrepTimeDays ?? 0)) > today) continue
      const result = await checkSufficiency(Number(item.MenuItemID), Number(item.Quantity ?? booking.GuestCount ?? 1), { allocatedByIngredient })
      checked++
      const type = result.sufficient ? 'prep_start_confirmed' : 'insufficient_ingredients'
      const metadata = { bookingId: Number(booking.BookingID) }
      if (await hasNotificationForToday(Number(booking.OperatorID), type, metadata)) continue
      const message = result.sufficient ? `Preparation can start for ${menuItem.ItemName}.` : `Insufficient ingredients for ${menuItem.ItemName}: ${result.shortfalls.map((s) => `${s.ingredientName} short by ${s.shortBy} ${s.unitOfMeasure}${s.allocated > 0 ? ` after ${s.allocated} ${s.unitOfMeasure} allocated to other orders` : ''}`).join(', ')}.`
      if (await createNotification(Number(booking.OperatorID), type, message, metadata)) notified++
    }
  }

  const { data: orders, error: orderError } = await admin.from('MEAL_PREP_ORDER').select('MealPrepOrderID, OperatorID, RecurrencePattern, MealsPerCycle, NextFulfillmentDate').eq('Status', 'active').not('NextFulfillmentDate', 'is', null).lte('NextFulfillmentDate', todayString)
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })
  for (const order of orders ?? []) {
    const { data: items } = await admin.from('MEAL_PREP_ITEM').select('MenuItemID, Quantity').eq('MealPrepOrderID', order.MealPrepOrderID)
    const fulfillmentDate = new Date(`${order.NextFulfillmentDate}T12:00:00`)
    const prepDates = (items ?? []).map((item) => prepStartDate(String(order.NextFulfillmentDate), Number(menuById.get(Number(item.MenuItemID))?.PrepTimeDays ?? 0)))
    const orderWindowStart = prepDates.length ? new Date(Math.min(...prepDates.map((date) => date.getTime()))) : fulfillmentDate
    const allocated = await getAllocatedIngredients(Number(order.OperatorID), orderWindowStart, fulfillmentDate, `mealPrep:${order.MealPrepOrderID}`)
    const allocatedByIngredient = Object.fromEntries(allocated)
    for (const item of items ?? []) {
      const menuItem = menuById.get(Number(item.MenuItemID)) ?? (await admin.from('MENU_ITEM').select('ItemName, PrepTimeDays').eq('MenuItemID', item.MenuItemID).maybeSingle()).data
      if (!menuItem || prepStartDate(String(order.NextFulfillmentDate), Number(menuItem.PrepTimeDays ?? 0)) > today) continue
      const result = await checkSufficiency(Number(item.MenuItemID), Number(item.Quantity ?? order.MealsPerCycle ?? 1), { allocatedByIngredient })
      mealPrepChecked++
      const type = result.sufficient ? 'prep_start_confirmed' : 'insufficient_ingredients'
      const metadata = { mealPrepOrderId: Number(order.MealPrepOrderID) }
      if (await hasNotificationForToday(Number(order.OperatorID), type, metadata)) continue
      const message = result.sufficient ? `Preparation can start for meal prep order ${order.MealPrepOrderID}.` : `Insufficient ingredients for meal prep order ${order.MealPrepOrderID}: ${result.shortfalls.map((s) => `${s.ingredientName} short by ${s.shortBy} ${s.unitOfMeasure}${s.allocated > 0 ? ` after ${s.allocated} ${s.unitOfMeasure} allocated to other orders` : ''}`).join(', ')}.`
      if (await createNotification(Number(order.OperatorID), type, message, metadata)) mealPrepNotified++
    }
    const step = order.RecurrencePattern === 'biweekly' ? 14 : 7
    const next = new Date(`${order.NextFulfillmentDate}T12:00:00`)
    do { next.setDate(next.getDate() + step) } while (next <= today)
    const { error: updateError } = await admin.from('MEAL_PREP_ORDER').update({ NextFulfillmentDate: dateOnly(next) }).eq('MealPrepOrderID', order.MealPrepOrderID)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, checked, notified, mealPrepChecked, mealPrepNotified })
}
