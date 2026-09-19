'use client';

import { useEffect, useState } from 'react';

type BookingSection = 'all' | 'catering' | 'meal_prep';

import { DashboardLayout } from '@/app/dashboard-layout';
import { supabase } from '@/lib/supabase';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  ChevronDown,
  Check,
  X,
  Clock3,
  CheckCircle2,
  XCircle,
  Utensils,
  PackageCheck,
} from 'lucide-react';

type Booking = {
  BookingID: number;
  CustomerID: number | null;
  OperatorID: number | null;
  EventDate: string;
  EventTime: string;
  OrderType: 'catering' | 'meal_prep' | null;
  Venue: string | null;
  GuestCount: number;
  Status: string | null;
};

type MealPrepOrder = {
  MealPrepOrderID: number;
  CustomerID: number | null;
  OperatorID: number | null;
  RecurrencePattern: string | null;
  MealsPerCycle: number | null;
  Status: string | null;
};

type Customer = {
  CustomerID: number;
  Name: string;
  Email: string;
  Contact: string | null;
};

type BookingItem = {
  BookingItemID: number;
  BookingID: number;
  MenuItemID: number;
  Quantity: number;
};

type MealPrepItem = {
  MealPrepItemID: number;
  MealPrepOrderID: number;
  MenuItemID: number;
  Quantity: number;
};

type MenuItem = {
  MenuItemID: number;
  ItemName: string;
  Price: number | null;
};

type BookingDisplay = Booking & {
  customer: Customer | null;
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
};

const OPERATOR_ID = 2;

const statusConfig: Record<
  string,
  {
    label: string;
    className: string;
    icon: typeof Clock3;
  }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800',
    icon: Clock3,
  },

  confirmed: {
    label: 'Confirmed',
    className: 'bg-green-100 text-green-800',
    icon: CheckCircle2,
  },

  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800',
    icon: XCircle,
  },

  completed: {
    label: 'Completed',
    className: 'bg-blue-100 text-blue-800',
    icon: CheckCircle2,
  },
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [activeSection, setActiveSection] =
    useState<BookingSection>('all');
  const [loadError, setLoadError] = useState<string | null>(null);

  // ============================================================
  // LOAD BOOKINGS
  // ============================================================

  const loadBookings = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      // ============================================================
      // GET CATERING BOOKINGS
      // ============================================================

      const {
        data: bookingData,
        error: bookingError,
      } = await supabase
        .from('BOOKING')
        .select(
          'BookingID, CustomerID, OperatorID, EventDate, EventTime, Venue, GuestCount, Status'
        )
        .eq('OperatorID', OPERATOR_ID)
        .order('BookingID', { ascending: false });

      if (bookingError) {
        console.error(
          'BOOKING FETCH ERROR:',
          bookingError
        );

        setLoadError(bookingError.message);
        setBookings([]);
        return;
      }

      // ============================================================
      // GET MEAL PREP ORDERS
      // ============================================================

      const {
        data: mealPrepData,
        error: mealPrepError,
      } = await supabase
        .from('MEAL_PREP_ORDER')
        .select(
          'MealPrepOrderID, CustomerID, OperatorID, RecurrencePattern, MealsPerCycle, Status'
        )
        .eq('OperatorID', OPERATOR_ID)
        .order('MealPrepOrderID', {
          ascending: false,
        });

      if (mealPrepError) {
        console.error(
          'MEAL_PREP_ORDER FETCH ERROR:',
          mealPrepError
        );
      }

      const mealPrepOrders =
        (mealPrepData ?? []) as MealPrepOrder[];

      // ============================================================
      // IF THERE ARE NO ORDERS
      // ============================================================

      if (
        (!bookingData || bookingData.length === 0) &&
        mealPrepOrders.length === 0
      ) {
        setBookings([]);
        return;
      }

      // ============================================================
      // GET CUSTOMER IDS
      // ============================================================

      const customerIds = Array.from(
        new Set(
          [
            ...(bookingData ?? []).map(
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

      // ============================================================
      // GET CUSTOMERS
      // ============================================================

      let customers: Customer[] = [];

      if (customerIds.length > 0) {
        const {
          data: customerData,
          error: customerError,
        } = await supabase
          .from('CUSTOMER')
          .select(
            'CustomerID, Name, Email, Contact'
          )
          .in('CustomerID', customerIds);

        if (customerError) {
          console.error(
            'CUSTOMER FETCH ERROR:',
            customerError
          );
        } else {
          customers =
            (customerData ?? []) as Customer[];
        }
      }

      // ============================================================
      // GET CATERING BOOKING ITEMS
      // ============================================================

      const bookingIds = (bookingData ?? []).map(
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
          console.error(
            'BOOKING_ITEM FETCH ERROR:',
            bookingItemError
          );
        } else {
          bookingItems =
            (bookingItemData ?? []) as BookingItem[];
        }
      }

      // ============================================================
      // GET MEAL PREP ITEMS
      //
      // This is the important part for Meal Prep.
      //
      // MEAL_PREP_ORDER
      //       ↓
      // MEAL_PREP_ITEM
      //       ↓
      // MENU_ITEM
      // ============================================================

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
          console.error(
            'MEAL_PREP_ITEM FETCH ERROR:',
            mealPrepItemError
          );
        } else {
          mealPrepItems =
            (mealPrepItemData ??
              []) as MealPrepItem[];
        }
      }

      // ============================================================
      // GET ALL MENU ITEMS
      //
      // We combine MenuItemIDs from both:
      // - BOOKING_ITEM
      // - MEAL_PREP_ITEM
      // ============================================================

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

      let menuItems: MenuItem[] = [];

      if (menuItemIds.length > 0) {
        const {
          data: menuItemData,
          error: menuItemError,
        } = await supabase
          .from('MENU_ITEM')
          .select(
            'MenuItemID, ItemName, Price'
          )
          .in('MenuItemID', menuItemIds);

        if (menuItemError) {
          console.error(
            'MENU_ITEM FETCH ERROR:',
            menuItemError
          );
        } else {
          menuItems =
            (menuItemData ?? []) as MenuItem[];
        }
      }

      // ============================================================
      // COMBINE CATERING BOOKINGS
      // ============================================================

      const combinedBookings: BookingDisplay[] =
        (bookingData ?? []).map((booking) => {
          const customer =
            customers.find(
              (item) =>
                item.CustomerID ===
                booking.CustomerID
            ) ?? null;

          const items = bookingItems
            .filter(
              (item) =>
                item.BookingID ===
                booking.BookingID
            )
            .map((bookingItem) => {
              const menuItem =
                menuItems.find(
                  (item) =>
                    item.MenuItemID ===
                    bookingItem.MenuItemID
                );

              return {
                name:
                  menuItem?.ItemName ??
                  `Menu Item #${bookingItem.MenuItemID}`,

                quantity:
                  bookingItem.Quantity,

                price: Number(
                  menuItem?.Price ?? 0
                ),
              };
            });

          return {
            ...booking,
            OrderType: 'catering' as const,
            customer,
            items,
          };
        });

      // ============================================================
      // COMBINE MEAL PREP ORDERS
      //
      // IMPORTANT:
      // Before this fix, items was simply [].
      //
      // Now we get the actual rows from MEAL_PREP_ITEM
      // and connect them to MENU_ITEM.
      // ============================================================

      const mealPrepBookings: BookingDisplay[] =
        mealPrepOrders.map((order) => {
          const customer =
            customers.find(
              (item) =>
                item.CustomerID ===
                order.CustomerID
            ) ?? null;

          const items = mealPrepItems
            .filter(
              (item) =>
                item.MealPrepOrderID ===
                order.MealPrepOrderID
            )
            .map((mealPrepItem) => {
              const menuItem =
                menuItems.find(
                  (item) =>
                    item.MenuItemID ===
                    mealPrepItem.MenuItemID
                );

              return {
                name:
                  menuItem?.ItemName ??
                  `Menu Item #${mealPrepItem.MenuItemID}`,

                quantity:
                  mealPrepItem.Quantity,

                price: Number(
                  menuItem?.Price ?? 0
                ),
              };
            });

          return {
            BookingID: -order.MealPrepOrderID,
            CustomerID: order.CustomerID,
            OperatorID: order.OperatorID,

            EventDate: '',

            EventTime:
              order.RecurrencePattern ??
              'Recurring',

            OrderType: 'meal_prep',

            Venue:
              'Meal prep subscription',

            GuestCount:
              order.MealsPerCycle ?? 0,

            Status: order.Status,

            customer,

            items,
          };
        });

      // ============================================================
      // SAVE TO UI
      // ============================================================

      setBookings([
        ...combinedBookings,
        ...mealPrepBookings,
      ]);
    } catch (error) {
      console.error(
        'Unexpected booking fetch error:',
        error
      );

      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load bookings.'
      );

      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LOAD WHEN PAGE OPENS
  // ============================================================

  useEffect(() => {
    loadBookings();
  }, []);

  // ============================================================
  // UPDATE BOOKING STATUS
  // ============================================================

  const updateBookingStatus = async (
    bookingId: number,
    status: 'confirmed' | 'rejected'
  ) => {
    if (updatingId !== null) {
      return;
    }

    setUpdatingId(bookingId);

    try {
      // ============================================================
      // CHECK SUPABASE AUTH SESSION
      // ============================================================

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.log(
        'SUPABASE SESSION:',
        session
      );

      console.log(
        'SESSION ERROR:',
        sessionError
      );

      if (!session) {
        alert(
          'No Supabase Auth session found. The owner is not authenticated.'
        );

        return;
      }

      console.log(
        'Authenticated as:',
        session.user.email
      );

      // ============================================================
      // MEAL PREP ORDER
      //
      // Negative BookingID means this is a MealPrepOrderID.
      //
      // Example:
      // BookingID = -8
      // MealPrepOrderID = 8
      // ============================================================

      if (bookingId < 0) {
        const mealPrepOrderId =
          Math.abs(bookingId);

        console.log(
          'UPDATING MEAL PREP ORDER:',
          mealPrepOrderId,
          '→',
          status
        );

        const {
          data: updatedOrder,
          error: mealPrepUpdateError,
        } = await supabase
          .from('MEAL_PREP_ORDER')
          .update({
            Status: status,
          })
          .eq(
            'MealPrepOrderID',
            mealPrepOrderId
          )
          .eq(
            'OperatorID',
            OPERATOR_ID
          )
          .select(
            'MealPrepOrderID, Status'
          )
          .single();

        if (mealPrepUpdateError) {
          console.error(
            'MEAL PREP STATUS UPDATE ERROR:',
            mealPrepUpdateError
          );

          alert(
            `Failed to ${
              status === 'confirmed'
                ? 'confirm'
                : 'reject'
            } meal prep order: ${
              mealPrepUpdateError.message
            }`
          );

          return;
        }

        if (!updatedOrder) {
          alert(
            'The meal prep order was not updated in Supabase.'
          );

          return;
        }

        console.log(
          'MEAL PREP STATUS UPDATE SUCCESS:',
          updatedOrder
        );

        // Only update UI after Supabase confirms the update.
        setBookings((current) =>
          current.map((booking) =>
            booking.BookingID === bookingId
              ? {
                  ...booking,
                  Status:
                    updatedOrder.Status,
                }
              : booking
          )
        );

        return;
      }

      // ============================================================
      // NORMAL CATERING BOOKING
      // ============================================================

      console.log(
        'UPDATING CATERING BOOKING:',
        bookingId,
        '→',
        status
      );

      const {
        data: updatedBooking,
        error: bookingUpdateError,
      } = await supabase
        .from('BOOKING')
        .update({
          Status: status,
        })
        .eq(
          'BookingID',
          bookingId
        )
        .eq(
          'OperatorID',
          OPERATOR_ID
        )
        .select(
          'BookingID, Status'
        )
        .single();

      if (bookingUpdateError) {
        console.error(
          'BOOKING STATUS UPDATE ERROR:',
          bookingUpdateError
        );

        alert(
          `Failed to ${
            status === 'confirmed'
              ? 'confirm'
              : 'reject'
          } booking: ${
            bookingUpdateError.message
          }`
        );

        return;
      }

      if (!updatedBooking) {
        alert(
          'The booking was not updated in Supabase.'
        );

        return;
      }

      console.log(
        'BOOKING STATUS UPDATE SUCCESS:',
        updatedBooking
      );

      setBookings((current) =>
        current.map((booking) =>
          booking.BookingID === bookingId
            ? {
                ...booking,
                Status:
                  updatedBooking.Status,
              }
            : booking
        )
      );
    } catch (error) {
      console.error(
        'Unexpected booking status error:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // ============================================================
  // BOOKING SECTIONS
  // ============================================================

  const bookingSections = [
    {
      key: 'catering' as const,
      label: 'Catering Events',
      description:
        'Full-service catering requests and event bookings',
      icon: Utensils,
      bookings: bookings.filter(
        (booking) =>
          booking.OrderType !== 'meal_prep'
      ),
    },

    {
      key: 'meal_prep' as const,
      label: 'Meal Prep Orders',
      description:
        'Recurring meal prep orders and fulfillment requests',
      icon: PackageCheck,
      bookings: bookings.filter(
        (booking) =>
          booking.OrderType === 'meal_prep'
      ),
    },
  ];

  const visibleSections =
    activeSection === 'all'
      ? bookingSections
      : bookingSections.filter(
          (section) =>
            section.key === activeSection
        );

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* PAGE HEADER */}

        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            Bookings
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            Manage and track all customer bookings
          </p>
        </div>

        {/* BOOKING TYPE TABS */}

        <div
          className="flex flex-wrap gap-3"
          role="tablist"
          aria-label="Booking type"
        >
          {[
            {
              key: 'all' as const,
              label: 'All bookings',
              count: bookings.length,
            },

            {
              key: 'catering' as const,
              label: 'Catering events',
              count:
                bookingSections[0].bookings
                  .length,
            },

            {
              key: 'meal_prep' as const,
              label: 'Meal prep orders',
              count:
                bookingSections[1].bookings
                  .length,
            },
          ].map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant={
                activeSection === tab.key
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                setActiveSection(tab.key)
              }
              role="tab"
              aria-selected={
                activeSection === tab.key
              }
              className="gap-2"
            >
              {tab.key === 'meal_prep' ? (
                <PackageCheck className="h-4 w-4" />
              ) : (
                <Utensils className="h-4 w-4" />
              )}

              {tab.label}

              <span className="rounded-full bg-background/30 px-2 py-0.5 text-xs">
                {tab.count}
              </span>
            </Button>
          ))}
        </div>

        {/* LOADING */}

        {loading ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              Loading bookings...
            </p>
          </Card>
        ) : loadError ? (
          <Card className="p-12 text-center">
            <p className="font-medium text-destructive">
              Unable to load bookings
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              {loadError}
            </p>
          </Card>
        ) : bookings.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              No bookings yet
            </p>
          </Card>
        ) : (
          <div className="space-y-8">

            {visibleSections.map((section) => {
              const SectionIcon =
                section.icon;

              return (
                <section
                  key={section.key}
                  aria-labelledby={`${section.key}-heading`}
                >
                  {/* SECTION HEADER */}

                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <SectionIcon
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </div>

                    <div>
                      <h2
                        id={`${section.key}-heading`}
                        className="font-heading text-xl font-semibold text-surface-foreground"
                      >
                        {section.label}
                      </h2>

                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    </div>

                    <span className="ml-auto rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                      {section.bookings.length}
                    </span>
                  </div>

                  {section.bookings.length ===
                  0 ? (
                    <Card className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        No{' '}
                        {section.key ===
                        'meal_prep'
                          ? 'meal prep orders'
                          : 'catering events'}{' '}
                        yet.
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-4">

                      {section.bookings.map(
                        (booking) => {
                          const statusKey =
                            booking.Status?.toLowerCase() ??
                            'pending';

                          const status =
                            statusConfig[
                              statusKey
                            ] ??
                            statusConfig.pending;

                          const StatusIcon =
                            status.icon;

                          const totalCost =
                            booking.items.reduce(
                              (
                                total,
                                item
                              ) =>
                                total +
                                item.price *
                                  item.quantity,
                              0
                            );

                          return (
                            <Card
                              key={
                                booking.BookingID
                              }
                              className="overflow-hidden"
                            >

                              {/* ==================================================
                                  BOOKING SUMMARY
                              ================================================== */}

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedId(
                                    expandedId ===
                                      booking.BookingID
                                      ? null
                                      : booking.BookingID
                                  )
                                }
                                className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-4 flex-1 text-left">

                                  <div>
                                    <p className="font-semibold text-card-foreground">
                                      {booking
                                        .customer
                                        ?.Name ??
                                        'Unknown customer'}
                                    </p>

                                    <p className="text-sm text-muted-foreground">
                                      {booking.OrderType ===
                                      'meal_prep'
                                        ? 'Meal prep order'
                                        : 'Catering event'}{' '}
                                      #
                                      {Math.abs(
                                        booking.BookingID
                                      )}
                                      {' • '}
                                      {
                                        booking.GuestCount
                                      }
                                      {booking.OrderType ===
                                      'meal_prep'
                                        ? ' servings • '
                                        : ' guests • '}
                                      {
                                        booking.EventTime
                                      }
                                    </p>
                                  </div>

                                  <div className="ml-auto text-right">

                                    <p className="text-sm text-muted-foreground">
                                      {booking.EventDate
                                        ? new Date(
                                            `${booking.EventDate}T00:00:00`
                                          ).toLocaleDateString()
                                        : 'Recurring order'}
                                    </p>

                                    <div className="mt-1">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.className}`}
                                      >
                                        <StatusIcon className="w-3 h-3" />

                                        {
                                          status.label
                                        }
                                      </span>
                                    </div>

                                  </div>
                                </div>

                                <ChevronDown
                                  className={`w-5 h-5 text-muted-foreground transition-transform ml-4 ${
                                    expandedId ===
                                    booking.BookingID
                                      ? 'rotate-180'
                                      : ''
                                  }`}
                                />
                              </button>

                              {/* ==================================================
                                  EXPANDED BOOKING
                              ================================================== */}

                              {expandedId ===
                                booking.BookingID && (
                                <div className="border-t border-border p-6 bg-muted/20">

                                  {/* CUSTOMER + VENUE */}

                                  <div className="grid md:grid-cols-2 gap-6 mb-6">

                                    <div>
                                      <p className="text-sm text-muted-foreground mb-1">
                                        Customer
                                      </p>

                                      <p className="font-medium text-card-foreground">
                                        {booking
                                          .customer
                                          ?.Name ??
                                          'Unknown customer'}
                                      </p>

                                      {booking.customer
                                        ?.Email && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {
                                            booking
                                              .customer
                                              .Email
                                          }
                                        </p>
                                      )}

                                      {booking.customer
                                        ?.Contact && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {
                                            booking
                                              .customer
                                              .Contact
                                          }
                                        </p>
                                      )}
                                    </div>

                                    <div>
                                      <p className="text-sm text-muted-foreground mb-1">
                                        Venue
                                      </p>

                                      <p className="font-medium text-card-foreground">
                                        {booking.Venue ||
                                          'No venue provided'}
                                      </p>

                                      <p className="text-sm text-muted-foreground mt-2">
                                        Event time:{' '}
                                        {
                                          booking.EventTime
                                        }
                                      </p>
                                    </div>

                                  </div>

                                  {/* ==================================================
                                      SELECTED MENU ITEMS
                                  ================================================== */}

                                  <div className="mb-6">

                                    <p className="text-sm text-muted-foreground mb-2">
                                      Selected Items
                                    </p>

                                    <div className="space-y-2">

                                      {booking.items
                                        .length ===
                                      0 ? (
                                        <p className="text-sm text-muted-foreground">
                                          No menu items recorded.
                                        </p>
                                      ) : (
                                        booking.items.map(
                                          (
                                            item,
                                            index
                                          ) => (
                                            <div
                                              key={`${booking.BookingID}-${item.name}-${index}`}
                                              className="flex justify-between items-center p-3 bg-muted rounded-lg"
                                            >
                                              <span className="font-medium text-card-foreground">
                                                {
                                                  item.name
                                                }

                                                {item.quantity >
                                                  1 &&
                                                  ` × ${item.quantity}`}
                                              </span>

                                              <span className="text-sm text-muted-foreground">
                                                ₱
                                                {(
                                                  item.price *
                                                  item.quantity
                                                ).toLocaleString(
                                                  'en-PH',
                                                  {
                                                    minimumFractionDigits: 2,
                                                  }
                                                )}
                                              </span>
                                            </div>
                                          )
                                        )
                                      )}

                                    </div>
                                  </div>

                                  {/* ==================================================
                                      TOTAL
                                  ================================================== */}

                                  <div className="border-t border-border pt-6 mb-6">

                                    <div className="flex justify-between items-center">

                                      <span className="font-semibold text-card-foreground">
                                        Estimated Total:
                                      </span>

                                      <span className="text-lg font-bold text-primary">
                                        ₱
                                        {totalCost.toLocaleString(
                                          'en-PH',
                                          {
                                            minimumFractionDigits: 2,
                                          }
                                        )}
                                      </span>

                                    </div>
                                  </div>

                                  {/* ==================================================
                                      ACTIONS
                                  ================================================== */}

                                  {booking.Status?.toLowerCase() ===
                                    'pending' && (
                                    <div className="flex gap-3">

                                      {/* CONFIRM */}

                                      <Button
                                        onClick={() =>
                                          updateBookingStatus(
                                            booking.BookingID,
                                            'confirmed'
                                          )
                                        }
                                        disabled={
                                          updatingId ===
                                          booking.BookingID
                                        }
                                        className="flex-1 bg-green-600 text-white gap-2 hover:bg-brand"
                                      >
                                        <Check className="w-4 h-4" />

                                        {updatingId ===
                                        booking.BookingID
                                          ? 'Updating...'
                                          : 'Confirm Booking'}
                                      </Button>

                                      {/* REJECT */}

                                      <Button
                                        onClick={() =>
                                          updateBookingStatus(
                                            booking.BookingID,
                                            'rejected'
                                          )
                                        }
                                        disabled={
                                          updatingId ===
                                          booking.BookingID
                                        }
                                        variant="outline"
                                        className="flex-1 gap-2"
                                      >
                                        <X className="w-4 h-4" />

                                        {updatingId ===
                                        booking.BookingID
                                          ? 'Updating...'
                                          : 'Reject'}
                                      </Button>

                                    </div>
                                  )}

                                </div>
                              )}

                            </Card>
                          );
                        }
                      )}

                    </div>
                  )}
                </section>
              );
            })}

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}