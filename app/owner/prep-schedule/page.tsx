'use client';

import { useEffect, useState } from 'react';

import { DashboardLayout } from '@/app/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, PackageCheck } from 'lucide-react';

import { getOwnerPrepSchedule } from '@/app/actions/booking-actions';
import { servingsForOrder } from '@/lib/rules/allocation';

const OPERATOR_ID = 2;

type MenuItem = {
  MenuItemID: number;
  ItemName: string;
  PrepTimeDays: number | null;
};

type Customer = {
  CustomerID: number;
  Name: string;
};

type Booking = {
  BookingID: number;
  CustomerID: number | null;
  EventDate: string;
  EventTime: string | null;
  Venue: string | null;
  GuestCount: number;
  Status: string | null;
};

type BookingItem = {
  BookingItemID: number;
  BookingID: number;
  MenuItemID: number;
  Quantity: number;
};

type MealPrepOrder = {
  MealPrepOrderID: number;
  CustomerID: number | null;
  RecurrencePattern: string | null;
  MealsPerCycle: number | null;
  NextFulfillmentDate: string | null;
  Status: string | null;
};

type MealPrepItem = {
  MealPrepItemID: number;
  MealPrepOrderID: number;
  MenuItemID: number;
  Quantity: number;
};

type CateringPrepItem = {
  id: string;
  customerName: string;
  eventDate: Date;
  venue: string;
  eventTime: string;
  lineItems: Array<{
    itemName: string;
    prepStartDate: Date;
    prepDays: number;
    quantity: number;
  }>;
};

type MealPrepDisplayItem = {
  id: string;
  customerName: string;
  recurrencePattern: string;
  mealsPerCycle: number;
  nextFulfillmentDate: string | null;
  status: string | null;
  lineItems: Array<{
    itemName: string;
    quantity: number;
    prepTimeDays: number | null;
  }>;
};

export default function PrepSchedulePage() {
  const [cateringPrep, setCateringPrep] = useState<
    CateringPrepItem[]
  >([]);

  const [mealPrep, setMealPrep] = useState<
    MealPrepDisplayItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [activeSchedule, setActiveSchedule] = useState<'catering' | 'meal-prep'>('catering');

  const [error, setError] = useState<string | null>(
    null
  );

  // ============================================================
  // LOAD PREP SCHEDULE FROM SUPABASE
  // ============================================================

  useEffect(() => {
    const loadPrepSchedule = async () => {
      setLoading(true);
      setError(null);

      try {
        const schedule = await getOwnerPrepSchedule();
        if (!schedule.ok) throw new Error(schedule.error);

        const bookings = schedule.bookings as Booking[];
        const bookingItems = schedule.bookingItems as BookingItem[];
        const mealPrepOrders = schedule.mealPrepOrders as MealPrepOrder[];
        const mealPrepItems = schedule.mealPrepItems as MealPrepItem[];
        const customers = schedule.customers as Customer[];
        const menuItems = schedule.menuItems as MenuItem[];

        // ========================================================
        // 9. BUILD CATERING PREPARATION SCHEDULE
        // ========================================================

        const cateringPrepItems: CateringPrepItem[] =
          bookings.map((booking) => {
            const customer = customers.find(
              (item) => item.CustomerID === booking.CustomerID
            );
            const eventDate = new Date(`${booking.EventDate}T00:00:00`);
            const lineItems = bookingItems
              .filter((item) => item.BookingID === booking.BookingID)
              .flatMap((bookingItem) => {
                const menuItem = menuItems.find(
                  (item) => item.MenuItemID === bookingItem.MenuItemID
                );
                if (!menuItem) return [];

                const prepDays = Number(menuItem.PrepTimeDays ?? 0);
                const prepStartDate = new Date(eventDate);
                prepStartDate.setDate(prepStartDate.getDate() - prepDays);

                return [{
                  itemName: menuItem.ItemName,
                  prepStartDate,
                  prepDays,
                  quantity: servingsForOrder('booking', booking.GuestCount),
                }];
              });

            return {
              id: `catering-${booking.BookingID}`,
              customerName: customer?.Name ?? 'Unknown customer',
              eventDate,
              venue: booking.Venue ?? 'No venue provided',
              eventTime: booking.EventTime ?? '',
              lineItems,
            };
          }).filter((booking) => booking.lineItems.length > 0);

        // ========================================================
        // 10. BUILD RECURRING MEAL PREP SCHEDULE
        //
        // There is no EventDate in MEAL_PREP_ORDER.
        // Therefore we DO NOT invent a preparation date.
        //
        // Instead, display the confirmed recurring orders.
        // ========================================================

        const mealPrepDisplayItems: MealPrepDisplayItem[] =
          mealPrepOrders.map((order) => {
            const customer =
              customers.find(
                (item) =>
                  item.CustomerID ===
                  order.CustomerID
              );

            const itemsForOrder =
              mealPrepItems.filter(
                (item) =>
                  item.MealPrepOrderID ===
                  order.MealPrepOrderID
              );

            const lineItems = itemsForOrder.flatMap(
              (mealPrepItem) => {
                const menuItem = menuItems.find(
                  (item) =>
                    item.MenuItemID ===
                    mealPrepItem.MenuItemID
                );

                return menuItem
                  ? [{
                      itemName: menuItem.ItemName,
                      quantity: servingsForOrder('meal_prep', undefined, order.MealsPerCycle),
                      prepTimeDays: menuItem.PrepTimeDays,
                    }]
                  : [];
              }
            );

            return {
              id: `meal-prep-${order.MealPrepOrderID}`,
              customerName:
                customer?.Name ??
                'Unknown customer',
              recurrencePattern:
                order.RecurrencePattern ??
                'Recurring',
              mealsPerCycle: Number(
                order.MealsPerCycle ?? 0
              ),
              nextFulfillmentDate:
                order.NextFulfillmentDate,
              status: order.Status,
              lineItems,
            };
          }).filter((order) => order.lineItems.length > 0);

        // ========================================================
        // 11. SAVE TO PAGE
        // ========================================================

        setCateringPrep(cateringPrepItems);

        setMealPrep(mealPrepDisplayItems);
      } catch (loadError) {
        console.error(
          'PREP SCHEDULE LOAD ERROR:',
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the preparation schedule.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadPrepSchedule();
  }, []);

  // ============================================================
  // DATE HELPERS
  // ============================================================

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const upcomingCateringPrep = cateringPrep
    .map((item) => ({
      ...item,
      earliestPrepStartDate: item.lineItems.reduce(
        (earliest, lineItem) =>
          lineItem.prepStartDate < earliest ? lineItem.prepStartDate : earliest,
        item.lineItems[0].prepStartDate
      ),
    }))
    .filter((item) => item.earliestPrepStartDate >= today)
    .sort(
      (a, b) =>
        a.earliestPrepStartDate.getTime() - b.earliestPrepStartDate.getTime()
    );

  const scheduledMealPrep = [...mealPrep].sort((a, b) => {
    const dateA = a.nextFulfillmentDate
      ? new Date(`${a.nextFulfillmentDate}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;
    const dateB = b.nextFulfillmentDate
      ? new Date(`${b.nextFulfillmentDate}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;
    return dateA - dateB;
  });

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            Prep Schedule
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            Preparation schedule for confirmed catering
            bookings and recurring meal-prep orders
          </p>
        </div>

        {/* ======================================================
            LOADING
        ====================================================== */}

        {loading && (
          <Card className="p-12 text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-4 animate-pulse" />

            <p className="text-muted-foreground">
              Loading preparation schedule...
            </p>
          </Card>
        )}

        {/* ======================================================
            ERROR
        ====================================================== */}

        {!loading && error && (
          <Card className="p-8">
            <p className="font-semibold text-destructive">
              Unable to load preparation schedule
            </p>

            <p className="text-sm text-muted-foreground mt-2">
              {error}
            </p>
          </Card>
        )}

        {!loading && !error && (
          <>
            <div className="flex flex-wrap gap-3" role="group" aria-label="Preparation schedule type">
              <Button
                type="button"
                variant={activeSchedule === 'catering' ? 'default' : 'outline'}
                onClick={() => setActiveSchedule('catering')}
                aria-pressed={activeSchedule === 'catering'}
              >
                <Clock data-icon="inline-start" />
                Catering Preparations
              </Button>
              <Button
                type="button"
                variant={activeSchedule === 'meal-prep' ? 'default' : 'outline'}
                onClick={() => setActiveSchedule('meal-prep')}
                aria-pressed={activeSchedule === 'meal-prep'}
              >
                <PackageCheck data-icon="inline-start" />
                Meal Prep
              </Button>
            </div>

            {/* ==================================================
                CATERING PREPARATIONS
            ================================================== */}

            {activeSchedule === 'catering' ? (
              <Card className="p-8">

              <div className="flex items-center gap-2 mb-6">

                <Clock className="w-5 h-5 text-primary" />

                <div>
                  <h2 className="font-heading text-lg font-bold text-card-foreground">
                    Upcoming Catering Preparations
                  </h2>

                  <p className="text-sm text-muted-foreground mt-1">
                    Based on confirmed catering events
                    and each menu item's preparation time
                  </p>
                </div>

              </div>

              {upcomingCateringPrep.length >
              0 ? (
                <div className="space-y-4">

                  {upcomingCateringPrep.map(
                    (item) => {
                      const daysUntilPrep = Math.ceil(
                        (item.earliestPrepStartDate.getTime() - today.getTime()) /
                          (1000 * 60 * 60 * 24)
                      );

                      const isUrgent =
                        daysUntilPrep <= 2;

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-lg border-2 ${
                            isUrgent
                              ? 'border-red-300 bg-red-50'
                              : 'border-border bg-muted/50'
                          }`}
                        >

                          <div className="flex items-start justify-between gap-4">

                            <div>
                              <p className="font-semibold text-card-foreground">
                                Catering preparation
                              </p>

                              <ul className="mt-3 flex flex-col gap-2">
                                {item.lineItems.map((lineItem) => (
                                  <li key={`${item.id}-${lineItem.itemName}`} className="text-sm text-card-foreground">
                                    {lineItem.itemName}{lineItem.quantity > 1 ? ` × ${lineItem.quantity}` : ''}
                                    <span className="block text-xs text-muted-foreground mt-1">
                                      Start prep: {lineItem.prepStartDate.toLocaleDateString()} · Prep time: {lineItem.prepDays} {lineItem.prepDays === 1 ? 'day' : 'days'}
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              <p className="text-sm text-muted-foreground mt-1">
                                For{' '}
                                {
                                  item.customerName
                                }{' '}
                                · Catering event
                              </p>

                              {item.venue && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Venue:{' '}
                                  {item.venue}
                                </p>
                              )}

                              {item.eventTime && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Event time:{' '}
                                  {
                                    item.eventTime
                                  }
                                </p>
                              )}
                            </div>

                            <div className="text-right">

                              <p
                                className={`text-sm font-medium ${
                                  isUrgent
                                    ? 'text-red-700'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                Start:{' '}
                                {item.earliestPrepStartDate.toLocaleDateString()}
                              </p>

                              <p className="text-sm text-muted-foreground mt-1">
                                Event:{' '}
                                {item.eventDate.toLocaleDateString()}
                              </p>


                            </div>

                          </div>

                          {isUrgent && (
                            <div className="mt-3 pt-3 border-t border-red-200">

                              <p className="text-xs font-semibold text-red-700">
                                ⚠️ Prep starts soon!
                              </p>

                            </div>
                          )}

                        </div>
                      );
                    }
                  )}

                </div>
              ) : (
                <div className="text-center py-12">

                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />

                  <p className="text-muted-foreground">
                    No upcoming catering preparations
                    scheduled
                  </p>

                </div>
              )}

            </Card>
            ) : null}

            {/* ==================================================
                RECURRING MEAL PREP
            ================================================== */}

            {activeSchedule === 'meal-prep' ? (
              <Card className="p-8">

              <div className="flex items-center gap-2 mb-6">

                <PackageCheck className="w-5 h-5 text-primary" />

                <div>
                  <h2 className="font-heading text-lg font-bold text-card-foreground">
                    Recurring Meal Prep
                  </h2>

                  <p className="text-sm text-muted-foreground mt-1">
                    Confirmed meal-prep orders and their
                    recurring schedules
                  </p>
                </div>

              </div>

              {scheduledMealPrep.length > 0 ? (
                <div className="space-y-4">
                  {scheduledMealPrep.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border-2 border-border bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-card-foreground">
                            Meal prep order
                          </p>

                          <p className="text-sm text-muted-foreground mt-1">
                            For {item.customerName} · Meal prep
                          </p>

                          <ul className="mt-3 flex flex-col gap-2">
                            {item.lineItems.map((lineItem) => {
                              const fulfillmentDate = item.nextFulfillmentDate
                                ? new Date(`${item.nextFulfillmentDate}T00:00:00`)
                                : null;
                              const prepStartDate = fulfillmentDate
                                ? new Date(fulfillmentDate)
                                : null;

                              if (prepStartDate) {
                                prepStartDate.setDate(
                                  prepStartDate.getDate() - Number(lineItem.prepTimeDays ?? 0)
                                );
                              }

                              return (
                                <li key={`${item.id}-${lineItem.itemName}`} className="text-sm text-card-foreground">
                                  <span className="font-medium">
                                    {lineItem.itemName}{lineItem.quantity > 1 ? ` × ${lineItem.quantity}` : ''}
                                  </span>
                                  <span className="block text-xs text-muted-foreground mt-1">
                                    Fulfillment: {fulfillmentDate ? fulfillmentDate.toLocaleDateString() : 'Not scheduled'} · Start prep: {prepStartDate ? prepStartDate.toLocaleDateString() : 'Not scheduled'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-medium text-card-foreground capitalize">
                            {item.recurrencePattern}
                          </p>

                          <p className="text-sm text-muted-foreground mt-1">
                            {item.mealsPerCycle} {item.mealsPerCycle === 1 ? 'meal' : 'meals'} per cycle
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground capitalize">
                          Status: {item.status ?? 'Unknown'}
                        </p>
                      </div>
                    </div>
                  ))}

                </div>
              ) : (
                <div className="text-center py-12">

                  <PackageCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />

                  <p className="text-muted-foreground">
                    No confirmed recurring meal-prep
                    orders
                  </p>

                </div>
              )}

            </Card>
            ) : null}
          </>
        )}

      </div>
    </DashboardLayout>
  );
}
