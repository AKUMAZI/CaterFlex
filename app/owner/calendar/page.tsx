'use client';

import { DashboardLayout } from '@/app/dashboard-layout';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CalendarBooking {
  BookingID: number;
  CustomerID: number;
  OperatorID: number;
  EventDate: string;
  EventTime: string;
  Venue: string;
  GuestCount: number;
  Status: string;
  EventType?: string;
  customerName: string;
}

const OPERATOR_ID = 2;

export default function CalendarPage() {
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Start with the current month instead of hardcoded July 2026
  const [currentDate, setCurrentDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  /*
   * ============================================================
   * LOAD BOOKINGS FROM SUPABASE
   * ============================================================
   */
  const loadBookings = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      /*
       * Get catering bookings directly from BOOKING.
       *
       * EventDate here is the actual date stored in Supabase.
       */
      const {
        data: bookingRows,
        error: bookingError,
      } = await supabase
        .from('BOOKING')
        .select(
          `
            BookingID,
            CustomerID,
            OperatorID,
            EventDate,
            EventTime,
            Venue,
            GuestCount,
            Status
          `
        )
        .eq('OperatorID', OPERATOR_ID)
        .order('EventDate', { ascending: true });

      if (bookingError) {
        console.error('BOOKING loading error:', bookingError);
        throw new Error(
          `Failed to load bookings: ${bookingError.message}`
        );
      }

      if (!bookingRows || bookingRows.length === 0) {
        setBookings([]);
        return;
      }

      /*
       * Get the customers belonging to the bookings.
       */
      const customerIds = [
        ...new Set(
          bookingRows.map((booking) => booking.CustomerID)
        ),
      ];

      const {
        data: customerRows,
        error: customerError,
      } = await supabase
        .from('CUSTOMER')
        .select('CustomerID, Name')
        .in('CustomerID', customerIds);

      if (customerError) {
        console.error('CUSTOMER loading error:', customerError);
        throw new Error(
          `Failed to load customers: ${customerError.message}`
        );
      }

      /*
       * Match each booking with its customer.
       */
      const formattedBookings: CalendarBooking[] =
        bookingRows.map((booking) => {
          const customer = customerRows?.find(
            (item) =>
              item.CustomerID === booking.CustomerID
          );

          return {
            BookingID: booking.BookingID,
            CustomerID: booking.CustomerID,
            OperatorID: booking.OperatorID,
            EventDate: booking.EventDate,
            EventTime: booking.EventTime,
            Venue: booking.Venue,
            GuestCount: booking.GuestCount,
            Status: booking.Status,
            customerName:
              customer?.Name ??
              `Customer #${booking.CustomerID}`,
          };
        });

      console.log(
        'CALENDAR BOOKINGS FROM SUPABASE:',
        formattedBookings
      );

      setBookings(formattedBookings);
    } catch (error) {
      console.error(
        'Unexpected calendar loading error:',
        error
      );

      setBookings([]);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load bookings.'
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Load bookings when the calendar opens.
   */
  useEffect(() => {
    loadBookings();
  }, []);

  /*
   * ============================================================
   * CALENDAR NAVIGATION
   * ============================================================
   */

  const goToPreviousMonth = () => {
    setCurrentDate(
      (date) =>
        new Date(
          date.getFullYear(),
          date.getMonth() - 1,
          1
        )
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      (date) =>
        new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          1
        )
    );
  };

  const goToToday = () => {
    const today = new Date();

    setCurrentDate(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );
  };

  /*
   * ============================================================
   * CALENDAR HELPERS
   * ============================================================
   */

  const getDaysInMonth = (date: Date) => {
    return new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    ).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    ).getDay();
  };

  /*
   * IMPORTANT:
   *
   * EventDate is a DATE value from PostgreSQL.
   * We compare the YYYY-MM-DD string directly instead
   * of relying on JavaScript timezone conversion.
   */
  const getBookingsForDate = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(
      currentDate.getMonth() + 1
    ).padStart(2, '0');
    const dayString = String(day).padStart(2, '0');

    const calendarDate =
      `${year}-${month}-${dayString}`;

    return bookings.filter(
      (booking) =>
        booking.EventDate === calendarDate
    );
  };

  const days = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  const monthName = currentDate.toLocaleString(
    'default',
    {
      month: 'long',
      year: 'numeric',
    }
  );

  const dayLabels = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ];

  /*
   * ============================================================
   * UPCOMING EVENTS
   * ============================================================
   */

  const todayString = new Date()
    .toISOString()
    .split('T')[0];

  const upcomingBookings = bookings
    .filter(
      (booking) =>
        booking.EventDate >= todayString
    )
    .sort(
      (a, b) =>
        a.EventDate.localeCompare(b.EventDate)
    )
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* PAGE HEADER */}
        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            Calendar
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            View all events scheduled for {monthName}
          </p>
        </div>

        {/* ERROR */}
        {errorMessage && (
          <Card className="p-4 border-red-300 bg-red-50">
            <p className="text-sm text-red-700">
              {errorMessage}
            </p>
          </Card>
        )}

        {/* CALENDAR */}
        <Card className="p-8">

          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">

            <h2 className="font-heading text-2xl font-bold text-card-foreground">
              {monthName}
            </h2>

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={goToPreviousMonth}
                aria-label="View previous month"
                className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-5" />
              </button>

              <button
                type="button"
                onClick={goToToday}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                Today
              </button>

              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="View next month"
                className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-5" />
              </button>

              <Calendar className="ml-2 size-6 text-primary" />

            </div>
          </div>

          {/* LOADING */}
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading bookings...
            </div>
          ) : (
            <>
              {/* DAY LABELS */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayLabels.map((day) => (
                  <div
                    key={day}
                    className="text-center font-semibold text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* CALENDAR GRID */}
              <div className="grid grid-cols-7 gap-2">

                {/* EMPTY CELLS */}
                {Array.from({
                  length: firstDay,
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-square"
                  />
                ))}

                {/* DAYS */}
                {Array.from({
                  length: days,
                }).map((_, i) => {

                  const day = i + 1;

                  const dayBookings =
                    getBookingsForDate(day);

                  return (
                    <div
                      key={day}
                      className="aspect-square p-2 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >

                      <div className="text-sm font-medium text-card-foreground mb-1">
                        {day}
                      </div>

                      <div className="space-y-1">

                        {dayBookings
                          .slice(0, 2)
                          .map((booking) => (
                            <div
                              key={booking.BookingID}
                              className="text-xs bg-primary/20 text-primary px-1 py-0.5 rounded truncate"
                              title={`${booking.customerName} - ${booking.Status}`}
                            >
                              {booking.customerName}
                            </div>
                          ))}

                        {dayBookings.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayBookings.length - 2} more
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}

              </div>
            </>
          )}

        </Card>

        {/* UPCOMING EVENTS */}
        <Card className="p-8">

          <h2 className="font-heading text-lg font-bold text-card-foreground mb-6">
            Upcoming Events
          </h2>

          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading upcoming events...
            </p>
          ) : upcomingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming events.
            </p>
          ) : (
            <div className="space-y-3">

              {upcomingBookings.map((booking) => (
                <div
                  key={booking.BookingID}
                  className="flex justify-between items-center p-4 bg-muted/50 rounded-lg"
                >

                  <div>
                    <p className="font-medium text-card-foreground">
                      {booking.customerName}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      {booking.EventTime}
                      {' • '}
                      {booking.GuestCount} guests
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      {booking.Venue}
                    </p>
                  </div>

                  <div className="text-right">

                    <p className="text-sm font-medium text-card-foreground">
                      {new Date(
                        `${booking.EventDate}T12:00:00`
                      ).toLocaleDateString()}
                    </p>

                    <span
                      className={`inline-block text-xs font-medium mt-1 px-2 py-1 rounded-full ${
                        booking.Status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : booking.Status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {booking.Status}
                    </span>

                  </div>
                </div>
              ))}

            </div>
          )}

        </Card>

      </div>
    </DashboardLayout>
  );
}