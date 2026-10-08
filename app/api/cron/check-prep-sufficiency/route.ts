import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { checkOrderSufficiencyWithAllocations } from '@/lib/macroflex'
import { createNotification, hasNotificationForToday } from '@/lib/notifications'
import { addDays, orderPrepWindow, servingsForOrder } from '@/lib/rules/allocation'

export const dynamic = 'force-dynamic'

function prepStartDate(eventDate: string, prepDays: number): string {
  return addDays(eventDate, -Math.max(0, prepDays))
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const { data: bookings, error } = await admin
    .from('BOOKING')
    .select('BookingID, OperatorID, EventDate, GuestCount')
    .eq('Status', 'confirmed')
    .lte('EventDate', today.toISOString().slice(0, 10))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let checked = 0
  let notified = 0
  let mealPrepChecked = 0
  let mealPrepNotified = 0
  for (const booking of bookings ?? []) {
    const { data: items } = await admin.from('BOOKING_ITEM').select('MenuItemID, Quantity').eq('BookingID', booking.BookingID)
    const menuItemIds = (items ?? []).map((item) => Number(item.MenuItemID))
    if (!menuItemIds.length) continue
    const { data: menuItems } = await admin.from('MENU_ITEM').select('MenuItemID, ItemName, PrepTimeDays').in('MenuItemID', menuItemIds)
    const fulfillmentDate = String(booking.EventDate).slice(0, 10)
    const prepWindow = orderPrepWindow(fulfillmentDate, (menuItems ?? []).map((item) => Number(item.PrepTimeDays ?? 0)))
    if (prepWindow.prepStartDate > today.toISOString().slice(0, 10)) continue
    const result = await checkOrderSufficiencyWithAllocations(
      menuItemIds.map((menuItemId) => ({ menuItemId })),
      servingsForOrder('booking', booking.GuestCount),
      fulfillmentDate,
      { type: 'booking', id: Number(booking.BookingID) },
      admin,
    )
    checked += 1
    const type = result.sufficient ? 'prep_start_confirmed' : 'insufficient_ingredients'
    const metadata = { bookingId: Number(booking.BookingID) }
    if (await hasNotificationForToday(Number(booking.OperatorID), type, metadata)) continue
    const message = result.sufficient
      ? 'Preparation can start for this booking.'
      : `Insufficient ingredients: ${result.shortfalls.map((shortfall) => `${shortfall.ingredientName} short by ${shortfall.shortBy} ${shortfall.unitOfMeasure} (${shortfall.contributingItems.map((item) => item.itemName).join(', ')})`).join(', ')}.`
    if (await createNotification(Number(booking.OperatorID), type, message, metadata)) notified += 1
  }

  const { data: mealPrepOrders, error: mealPrepError } = await admin
    .from('MEAL_PREP_ORDER')
    .select('MealPrepOrderID, OperatorID, RecurrencePattern, MealsPerCycle, NextFulfillmentDate')
    // Paused and cancelled orders are intentionally excluded from prep checks and notifications.
    .eq('Status', 'active')
    .not('NextFulfillmentDate', 'is', null)
    .lte('NextFulfillmentDate', today.toISOString().slice(0, 10))
  if (mealPrepError) return NextResponse.json({ error: mealPrepError.message }, { status: 500 })

  for (const order of mealPrepOrders ?? []) {
    const { data: items } = await admin
      .from('MEAL_PREP_ITEM')
      .select('MenuItemID, Quantity')
      .eq('MealPrepOrderID', order.MealPrepOrderID)
    const menuItemIds = (items ?? []).map((item) => Number(item.MenuItemID))
    const fulfillmentDate = String(order.NextFulfillmentDate).slice(0, 10)
    const { data: menuItems } = await admin.from('MENU_ITEM').select('MenuItemID, PrepTimeDays').in('MenuItemID', menuItemIds)
    const prepWindow = orderPrepWindow(fulfillmentDate, (menuItems ?? []).map((item) => Number(item.PrepTimeDays ?? 0)))
    if (menuItemIds.length && prepWindow.prepStartDate <= today.toISOString().slice(0, 10)) {
      const result = await checkOrderSufficiencyWithAllocations(
        menuItemIds.map((menuItemId) => ({ menuItemId })),
        servingsForOrder('meal_prep', undefined, order.MealsPerCycle),
        fulfillmentDate,
        { type: 'meal_prep', id: Number(order.MealPrepOrderID) },
        admin,
      )
      mealPrepChecked += 1
      const type = result.sufficient ? 'prep_start_confirmed' : 'insufficient_ingredients'
      const metadata = { mealPrepOrderId: Number(order.MealPrepOrderID) }
      if (!(await hasNotificationForToday(Number(order.OperatorID), type, metadata))) {
        const message = result.sufficient
          ? `Preparation can start for meal prep order ${order.MealPrepOrderID}.`
          : `Insufficient ingredients for meal prep order ${order.MealPrepOrderID}: ${result.shortfalls.map((shortfall) => `${shortfall.ingredientName} short by ${shortfall.shortBy} ${shortfall.unitOfMeasure} (${shortfall.contributingItems.map((item) => item.itemName).join(', ')})`).join(', ')}.`
        if (await createNotification(Number(order.OperatorID), type, message, metadata)) mealPrepNotified += 1
      }
    }

    const nextDate = addDays(String(order.NextFulfillmentDate), order.RecurrencePattern === 'biweekly' ? 14 : 7)
    const { error: updateError } = await admin
      .from('MEAL_PREP_ORDER')
      .update({ NextFulfillmentDate: nextDate })
      .eq('MealPrepOrderID', order.MealPrepOrderID)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, checked, notified, mealPrepChecked, mealPrepNotified })
}
