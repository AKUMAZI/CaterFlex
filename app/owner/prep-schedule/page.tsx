'use client';

import { useEffect, useState } from 'react';

import { DashboardLayout } from '@/app/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Clock, PackageCheck, Utensils } from 'lucide-react';

import { supabase } from '@/lib/supabase';

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
  itemName: string;
  customerName: string;
  eventDate: Date;
  prepStartDate: Date;
  prepDays: number;
  quantity: number;
  venue: string;
  eventTime: string;
};

type MealPrepDisplayItem = {
  id: string;
  itemName: string;
  customerName: string;
  recurrencePattern: string;
  mealsPerCycle: number;
  quantity: number;
};

export default function PrepSchedulePage() {
  const [cateringPrep, setCateringPrep] = useState<
    CateringPrepItem[]
  >([]);

  const [mealPrep, setMealPrep] = useState<
    MealPrepDisplayItem[]
  >([]);

  const [loading, setLoading] = useState(true);

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
        // ========================================================
        // 1. LOAD CONFIRMED CATERING BOOKINGS
        // ========================================================

        const {
          data: bookingData,
          error: bookingError,
        } = await supabase
          .from('BOOKING')
          .select(
            'BookingID, CustomerID, EventDate, EventTime, Venue, GuestCount, Status'
          )
          .eq('OperatorID', OPERATOR_ID)
          .eq('Status', 'confirmed');

        if (bookingError) {
          throw bookingError;
        }

        const bookings =
          (bookingData ?? []) as Booking[];

        // ========================================================
        // 2. LOAD CATERING BOOKING ITEMS
        // ========================================================

        const bookingIds = bookings.map(
          (booking) => booking.BookingID
        );

        let bookingItems: BookingItem[] = [];

        if (bookingIds.length > 0) {
          const {
            data: bookingItemData,
            error: bookingItemError,
          } = await supabase
            .from('BOOKING_ITEM')
            .select(
              'BookingItemID, BookingID, MenuItemID, Quantity'
            )
            .in('BookingID', bookingIds);

          if (bookingItemError) {
            throw bookingItemError;
          }

          bookingItems =
            (bookingItemData ?? []) as BookingItem[];
        }

        // ========================================================
        // 3. LOAD CONFIRMED MEAL PREP ORDERS
        // ========================================================

        const {
          data: mealPrepOrderData,
          error: mealPrepOrderError,
        } = await supabase
          .from('MEAL_PREP_ORDER')
          .select(
            'MealPrepOrderID, CustomerID, RecurrencePattern, MealsPerCycle, Status'
          )
          .eq('OperatorID', OPERATOR_ID)
          .eq('Status', 'confirmed');

        if (mealPrepOrderError) {
          throw mealPrepOrderError;
        }

        const mealPrepOrders =
          (mealPrepOrderData ??
            []) as MealPrepOrder[];

        // ========================================================
        // 4. LOAD MEAL PREP ITEMS
        // ========================================================

        const mealPrepOrderIds =
          mealPrepOrders.map(
            (order) => order.MealPrepOrderID
          );

        let mealPrepItems: MealPrepItem[] = [];

        if (mealPrepOrderIds.length > 0) {
          const {
            data: mealPrepItemData,
            error: mealPrepItemError,
          } = await supabase
            .from('MEAL_PREP_ITEM')
            .select(
              'MealPrepItemID, MealPrepOrderID, MenuItemID, Quantity'
            )
            .in(
              'MealPrepOrderID',
              mealPrepOrderIds
            );

          if (mealPrepItemError) {
            throw mealPrepItemError;
          }

          mealPrepItems =
            (mealPrepItemData ??
              []) as MealPrepItem[];
        }

        // ========================================================
        // 5. GET ALL CUSTOMER IDS
        // ========================================================

        const customerIds = Array.from(
          new Set(
            [
              ...bookings.map(
                (booking) => booking.CustomerID
              ),
              ...mealPrepOrders.map(
                (order) => order.CustomerID
              ),
            ].filter(
              (id): id is number => id !== null
            )
          )
        );

        // ========================================================
        // 6. LOAD CUSTOMERS
        // ========================================================

        let customers: Customer[] = [];

        if (customerIds.length > 0) {
          const {
            data: customerData,
            error: customerError,
          } = await supabase
            .from('CUSTOMER')
            .select('CustomerID, Name')
            .in('CustomerID', customerIds);

          if (customerError) {
            throw customerError;
          }

          customers =
            (customerData ?? []) as Customer[];
        }

        // ========================================================
        // 7. GET ALL MENU ITEM IDS
        // ========================================================

        const menuItemIds = Array.from(
          new Set([
            ...bookingItems.map(
              (item) => item.MenuItemID
            ),
            ...mealPrepItems.map(
              (item) => item.MenuItemID
            ),
          ])
        );

        // ========================================================
        // 8. LOAD MENU ITEMS
        // ========================================================

        let menuItems: MenuItem[] = [];

        if (menuItemIds.length > 0) {
          const {
            data: menuItemData,
            error: menuItemError,
          } = await supabase
            .from('MENU_ITEM')
            .select(
              'MenuItemID, ItemName, PrepTimeDays'
            )
            .in('MenuItemID', menuItemIds);

          if (menuItemError) {
            throw menuItemError;
          }

          menuItems =
            (menuItemData ?? []) as MenuItem[];
        }

        // ========================================================
        // 9. BUILD CATERING PREPARATION SCHEDULE
        // ========================================================

        const cateringPrepItems: CateringPrepItem[] =
          [];

        bookings.forEach((booking) => {
          const bookingItemsForBooking =
            bookingItems.filter(
              (item) =>
                item.BookingID ===
                booking.BookingID
            );

          const customer =
            customers.find(
              (item) =>
                item.CustomerID ===
                booking.CustomerID
            );

          bookingItemsForBooking.forEach(
            (bookingItem) => {
              const menuItem =
                menuItems.find(
                  (item) =>
                    item.MenuItemID ===
                    bookingItem.MenuItemID
                );

              if (!menuItem) {
                return;
              }

              const eventDate = new Date(
                `${booking.EventDate}T00:00:00`
              );

              const prepDays =
                Number(
                  menuItem.PrepTimeDays ?? 0
                );

              const prepStartDate =
                new Date(eventDate);

              prepStartDate.setDate(
                prepStartDate.getDate() -
                  prepDays
              );

              cateringPrepItems.push({
                id: `catering-${booking.BookingID}-${bookingItem.BookingItemID}`,

                itemName:
                  menuItem.ItemName,

                customerName:
                  customer?.Name ??
                  'Unknown customer',

                eventDate,

                prepStartDate,

                prepDays,

                quantity:
                  bookingItem.Quantity,

                venue:
                  booking.Venue ??
                  'No venue provided',

                eventTime:
                  booking.EventTime ??
                  '',
              });
            }
          );
        });

        // ========================================================
        // 10. BUILD RECURRING MEAL PREP SCHEDULE
        //
        // There is no EventDate in MEAL_PREP_ORDER.
        // Therefore we DO NOT invent a preparation date.
        //
        // Instead, display the confirmed recurring orders.
        // ========================================================

        const mealPrepDisplayItems: MealPrepDisplayItem[] =
          [];

        mealPrepOrders.forEach((order) => {
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

          itemsForOrder.forEach((mealPrepItem) => {
            const menuItem =
              menuItems.find(
                (item) =>
                  item.MenuItemID ===
                  mealPrepItem.MenuItemID
              );

            if (!menuItem) {
              return;
            }

            mealPrepDisplayItems.push({
              id: `meal-prep-${order.MealPrepOrderID}-${mealPrepItem.MealPrepItemID}`,

              itemName:
                menuItem.ItemName,

              customerName:
                customer?.Name ??
                'Unknown customer',

              recurrencePattern:
                order.RecurrencePattern ??
                'Recurring',

              mealsPerCycle:
                Number(
                  order.MealsPerCycle ?? 0
                ),

              quantity:
                mealPrepItem.Quantity,
            });
          });
        });

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

  const upcomingCateringPrep =
    cateringPrep
      .filter(
        (item) =>
          item.prepStartDate >= today
      )
      .sort(
        (a, b) =>
          a.prepStartDate.getTime() -
          b.prepStartDate.getTime()
      );

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
            {/* ==================================================
                CATERING PREPARATIONS
            ================================================== */}

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
                      const daysUntilPrep =
                        Math.ceil(
                          (item.prepStartDate.getTime() -
                            today.getTime()) /
                            (1000 *
                              60 *
                              60 *
                              24)
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
                                {item.itemName}

                                {item.quantity >
                                  1 &&
                                  ` × ${item.quantity}`}
                              </p>

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
                                {item.prepStartDate.toLocaleDateString()}
                              </p>

                              <p className="text-sm text-muted-foreground mt-1">
                                Event:{' '}
                                {item.eventDate.toLocaleDateString()}
                              </p>

                              <p className="text-xs text-muted-foreground mt-1">
                                Prep time:{' '}
                                {item.prepDays}{' '}
                                {item.prepDays ===
                                1
                                  ? 'day'
                                  : 'days'}
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

            {/* ==================================================
                RECURRING MEAL PREP
            ================================================== */}

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

              {mealPrep.length > 0 ? (
                <div className="space-y-4">

                  {mealPrep.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border-2 border-border bg-muted/50"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="font-semibold text-card-foreground">
                            {item.itemName}

                            {item.quantity >
                              1 &&
                              ` × ${item.quantity}`}
                          </p>

                          <p className="text-sm text-muted-foreground mt-1">
                            For{' '}
                            {
                              item.customerName
                            }{' '}
                            · Meal prep
                          </p>

                        </div>

                        <div className="text-right">

                          <p className="text-sm font-medium text-card-foreground capitalize">
                            {
                              item.recurrencePattern
                            }
                          </p>

                          <p className="text-sm text-muted-foreground mt-1">
                            {
                              item.mealsPerCycle
                            }{' '}
                            {item.mealsPerCycle ===
                            1
                              ? 'meal'
                              : 'meals'}{' '}
                            per cycle
                          </p>

                        </div>

                      </div>

                      <div className="mt-3 pt-3 border-t border-border">

                        <p className="text-xs font-medium text-muted-foreground">
                          Status: Confirmed
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
          </>
        )}

      </div>
    </DashboardLayout>
  );
}