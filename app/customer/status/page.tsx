'use client';

import { useEffect, useState } from 'react';

import { CustomerShell } from '@/app/customer/customer-shell';
import { useAppState } from '@/lib/state';
import { supabase } from '@/lib/supabase';
import { getCustomerBookings } from '@/app/actions/booking-actions';
import { OWNER_CONTACT } from '@/lib/constants';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import {
  CheckCircle2,
  Clock3,
  XCircle,
} from 'lucide-react';

type Booking = {
  BookingID: number;
  CustomerID: number;
  OperatorID: number | null;
  EventDate: string;
  EventTime: string;
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

type MenuItem = {
  MenuItemID: number;
  ItemName: string;
  Price: number | null;
};

type BookingWithItems = Booking & {
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
};

const statusCopy: Record<
  string,
  {
    label: string;
    icon: typeof Clock3;
    tone: 'secondary' | 'default' | 'destructive';
  }
> = {
  pending: {
    label: 'Pending review',
    icon: Clock3,
    tone: 'secondary',
  },

  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle2,
    tone: 'default',
  },

  rejected: {
    label: 'Rejected',
    icon: XCircle,
    tone: 'destructive',
  },

  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    tone: 'default',
  },
};

export default function CustomerStatusPage() {
  const { currentUser } = useAppState();

  const [bookings, setBookings] = useState<BookingWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBookings = async () => {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      const customerId = Number(currentUser.id);

      if (Number.isNaN(customerId)) {
        setLoading(false);
        return;
      }

      try {
        const result = await getCustomerBookings();

        if (!result.ok) {
          console.error('BOOKING FETCH ERROR:', result.error);
          setBookings([]);
          return;
        }

        const bookingData = result.bookings;
        const bookingItemData = result.bookingItems;

        if (bookingData.length === 0) {
          setBookings([]);
          return;
        }

        const bookingIds = bookingData.map(
          (booking) => booking.BookingID
        );

        const menuItemIds = Array.from(
          new Set(
            (bookingItemData ?? []).map(
              (item) => item.MenuItemID
            )
          )
        );

        let menuItems: MenuItem[] = [];

        if (menuItemIds.length > 0) {
          const { data: menuItemData, error: menuItemError } =
            await supabase
              .from('MENU_ITEM')
              .select('MenuItemID, ItemName, Price')
              .in('MenuItemID', menuItemIds);

          if (menuItemError) {
            console.error(
              'MENU_ITEM FETCH ERROR:',
              menuItemError
            );
          } else {
            menuItems = menuItemData ?? [];
          }
        }

        // Combine bookings + booking items + menu items
        const combinedBookings: BookingWithItems[] =
          bookingData.map((booking) => {
            const itemsForBooking =
              (bookingItemData ?? []).filter(
                (item) => item.BookingID === booking.BookingID
              );

            const items = itemsForBooking.map((bookingItem) => {
              const menuItem = menuItems.find(
                (item) =>
                  item.MenuItemID === bookingItem.MenuItemID
              );

              return {
                name:
                  menuItem?.ItemName ??
                  `Menu Item #${bookingItem.MenuItemID}`,
                quantity: bookingItem.Quantity,
                price: Number(menuItem?.Price ?? 0),
              };
            });

            return {
              ...booking,
              items,
            };
          });

        setBookings(combinedBookings);
      } catch (error) {
        console.error('Unexpected booking fetch error:', error);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [currentUser?.id]);

  return (
    <CustomerShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            My bookings
          </h1>

          <p className="mt-2 text-surface-muted-foreground">
            Track your submitted bookings and their current status.
          </p>
        </header>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              Loading your bookings...
            </CardContent>
          </Card>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No bookings yet. Start a new inquiry to see it here.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {bookings.map((booking) => {
              const statusKey =
                booking.Status?.toLowerCase() ?? 'pending';

              const status =
                statusCopy[statusKey] ?? statusCopy.pending;

              const StatusIcon = status.icon;

              const estimatedTotal = booking.items.reduce(
                (total, item) =>
                  total + item.price * item.quantity,
                0
              );

              return (
                <Card key={booking.BookingID}>
                  <CardHeader className="flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>
                        Catering Order #{booking.BookingID}
                      </CardTitle>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(
                          `${booking.EventDate}T00:00:00`
                        ).toLocaleDateString()}{' '}
                        · {booking.GuestCount} guests
                      </p>

                      {booking.Venue && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {booking.Venue}
                        </p>
                      )}

                      <p className="mt-1 text-sm text-muted-foreground">
                        Event time: {booking.EventTime}
                      </p>
                    </div>

                    <Badge variant={status.tone}>
                      <StatusIcon data-icon="inline-start" />
                      {status.label}
                    </Badge>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-5">
                    {(statusKey === 'pending' || statusKey === 'confirmed') && (
                      <p className="text-sm text-muted-foreground">
                        Need to cancel or change this booking? Please contact the caterer at {OWNER_CONTACT}.
                      </p>
                    )}
                    <div>
                      <p className="mb-2 text-sm font-medium text-foreground">
                        Selected menu items
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {booking.items.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            No menu items recorded.
                          </span>
                        ) : (
                          booking.items.map((item) => (
                            <Badge
                              key={`${booking.BookingID}-${item.name}`}
                              variant="outline"
                            >
                              {item.name}
                              {item.quantity > 1 &&
                                ` × ${item.quantity}`}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4 text-sm">
                      <span className="text-muted-foreground">
                        Estimated total
                      </span>

                      <span className="font-semibold text-foreground">
                        ₱
                        {estimatedTotal.toLocaleString(
                          'en-PH',
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
