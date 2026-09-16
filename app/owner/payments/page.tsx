'use client';

import { DashboardLayout } from '@/app/dashboard-layout';
import { supabase } from '@/lib/supabase';
import type { PaymentType, Invoice, Payment } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { DollarSign, FileDown } from 'lucide-react';
import { printInvoicePdf } from '@/lib/pdf/invoicePdf';

type BookingRow = {
  BookingID: number;
  CustomerID: number;
  OperatorID: number;
  EventDate: string;
  EventTime: string;
  Venue: string;
  GuestCount: number;
  Status: string;
};

type CustomerRow = {
  CustomerID: number;
  Name: string;
  Email: string;
};

type BookingItemRow = {
  BookingItemID: number;
  BookingID: number;
  MenuItemID: number;
  Quantity: number;
};

type MenuItemRow = {
  MenuItemID: number;
  ItemName: string;
  Price: number;
};

type InvoiceRow = {
  InvoiceID: number;
  BookingID: number;
  TotalAmount: number;
  DateGenerated: string;
};

type PaymentRow = {
  PaymentID: number;
  InvoiceID: number;
  Amount: number;
  PaymentType: string;
  Status: string;
  DatePaid: string;
};

type FinancialBooking = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  guestCount: number;
  status: string;
  totalCost: number;
  paymentsReceived: number;
};

export default function PaymentsPage() {
  const [bookings, setBookings] = useState<FinancialBooking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [paymentForm, setPaymentForm] = useState<{
    bookingId: string;
    invoiceId: number;
    amount: number;
    type: PaymentType;
    notes: string;
  } | null>(null);

  const [periodStart, setPeriodStart] = useState('2026-06-01');
  const [periodEnd, setPeriodEnd] = useState('2026-07-31');

  const loadFinancialData = async () => {
    setLoading(true);
    setError('');

    try {
      /*
       * 1. Load bookings
       */
      const { data: bookingRows, error: bookingError } = await supabase
        .from('BOOKING')
        .select(
          'BookingID, CustomerID, OperatorID, EventDate, EventTime, Venue, GuestCount, Status'
        )
        .eq('OperatorID', 2)
        .order('EventDate', { ascending: false });

      if (bookingError) throw bookingError;

      /*
       * 2. Load customers
       */
      const { data: customerRows, error: customerError } = await supabase
        .from('CUSTOMER')
        .select('CustomerID, Name, Email');

      if (customerError) throw customerError;

      /*
       * 3. Load invoices
       */
      const { data: invoiceRows, error: invoiceError } = await supabase
        .from('INVOICE')
        .select('InvoiceID, BookingID, TotalAmount, DateGenerated');

      if (invoiceError) throw invoiceError;

      /*
       * 4. Load payments
       */
      const { data: paymentRows, error: paymentError } = await supabase
        .from('PAYMENT')
        .select(
          'PaymentID, InvoiceID, Amount, PaymentType, Status, DatePaid'
        )
        .order('DatePaid', { ascending: false });

      if (paymentError) throw paymentError;

      /*
       * 5. Load booking items
       */
      const { data: bookingItemRows, error: bookingItemError } = await supabase
        .from('BOOKING_ITEM')
        .select('BookingItemID, BookingID, MenuItemID, Quantity');

      if (bookingItemError) throw bookingItemError;

      /*
       * 6. Load menu items
       */
      const { data: menuItemRows, error: menuItemError } = await supabase
        .from('MENU_ITEM')
        .select('MenuItemID, ItemName, Price');

      if (menuItemError) throw menuItemError;

      const typedBookings = (bookingRows ?? []) as BookingRow[];
      const typedCustomers = (customerRows ?? []) as CustomerRow[];
      const typedInvoices = (invoiceRows ?? []) as InvoiceRow[];
      const typedPayments = (paymentRows ?? []) as PaymentRow[];
      const typedBookingItems = (bookingItemRows ?? []) as BookingItemRow[];
      const typedMenuItems = (menuItemRows ?? []) as MenuItemRow[];

      /*
       * Convert PAYMENT database rows into the current UI Payment type.
       */
      const mappedPayments: Payment[] = typedPayments.map((payment) => {
        const invoice = typedInvoices.find(
          (item) => item.InvoiceID === payment.InvoiceID
        );

        return {
          id: String(payment.PaymentID),
          bookingId: invoice ? String(invoice.BookingID) : '',
          amount: Number(payment.Amount),
          date: payment.DatePaid,
          type: payment.PaymentType as PaymentType,
        };
      });

      /*
       * Calculate total payments per booking.
       */
      const paymentsByBooking = new Map<string, number>();

      for (const payment of mappedPayments) {
        if (!payment.bookingId) continue;

        const current = paymentsByBooking.get(payment.bookingId) ?? 0;

        paymentsByBooking.set(
          payment.bookingId,
          current + payment.amount
        );
      }

      /*
       * Convert database bookings into the shape
       * currently expected by this page.
       */
      const mappedBookings: FinancialBooking[] = typedBookings.map(
        (booking) => {
          const customer = typedCustomers.find(
            (item) => item.CustomerID === booking.CustomerID
          );

          const invoice = typedInvoices.find(
            (item) => item.BookingID === booking.BookingID
          );

          return {
            id: String(booking.BookingID),
            customerId: String(booking.CustomerID),
            customerName: customer?.Name ?? 'Unknown Customer',
            customerEmail: customer?.Email ?? '',
            eventDate: booking.EventDate,
            eventTime: booking.EventTime,
            venue: booking.Venue,
            guestCount: Number(booking.GuestCount),
            status: booking.Status,
            totalCost: invoice ? Number(invoice.TotalAmount) : 0,
            paymentsReceived:
              paymentsByBooking.get(String(booking.BookingID)) ?? 0,
          };
        }
      );

      /*
       * Build the Invoice objects required by printInvoicePdf().
       */
      const mappedInvoices: Invoice[] = typedInvoices.map((invoice) => {
        const booking = typedBookings.find(
          (item) => item.BookingID === invoice.BookingID
        );

        const customer = booking
          ? typedCustomers.find(
              (item) => item.CustomerID === booking.CustomerID
            )
          : undefined;

        const bookingItems = typedBookingItems.filter(
          (item) => item.BookingID === invoice.BookingID
        );

        const lineItems = bookingItems.map((bookingItem) => {
          const menuItem = typedMenuItems.find(
            (item) => item.MenuItemID === bookingItem.MenuItemID
          );

          const unitPrice = Number(menuItem?.Price ?? 0);
          const quantity = Number(bookingItem.Quantity);

          return {
            name: menuItem?.ItemName ?? 'Unknown Menu Item',
            unitPrice,
            quantity,
            total: unitPrice * quantity,
          };
        });

        const paymentsMade = mappedPayments
          .filter((payment) => payment.bookingId === String(invoice.BookingID))
          .reduce((sum, payment) => sum + payment.amount, 0);

        return {
          id: String(invoice.InvoiceID),
          bookingId: String(invoice.BookingID),
          generatedAt: invoice.DateGenerated,
          customerName: customer?.Name ?? 'Unknown Customer',
          customerEmail: customer?.Email ?? '',
          eventDate: booking?.EventDate ?? '',
          eventType: 'Catering Event',
          lineItems,
          guestCount: Number(booking?.GuestCount ?? 0),
          subtotal: Number(invoice.TotalAmount),
          totalDue: Number(invoice.TotalAmount),
          paymentsMade,
          balanceDue: Number(invoice.TotalAmount) - paymentsMade,
        };
      });

      setBookings(mappedBookings);
      setPayments(mappedPayments);
      setInvoices(mappedInvoices);
    } catch (loadError) {
      console.error('Failed to load financial data:', loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load financial data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  /*
   * Record payment directly into PAYMENT.
   */
  const handleRecordPayment = async () => {
    if (!paymentForm || paymentForm.amount <= 0) return;

    const booking = bookings.find(
      (item) => item.id === paymentForm.bookingId
    );

    if (!booking) return;

    if (paymentForm.amount > booking.totalCost - booking.paymentsReceived) {
      setError('Payment cannot be greater than the outstanding balance.');
      return;
    }

    const { error: paymentError } = await supabase
      .from('PAYMENT')
      .insert({
        InvoiceID: paymentForm.invoiceId,
        Amount: paymentForm.amount,
        PaymentType: paymentForm.type,
        Status: 'paid',
        DatePaid: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('Failed to record payment:', paymentError);
      setError(paymentError.message);
      return;
    }

    setPaymentForm(null);
    await loadFinancialData();
  };

  const totalRevenue = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const outstanding = bookings.reduce(
    (sum, booking) =>
      sum + Math.max(booking.totalCost - booking.paymentsReceived, 0),
    0
  );

  const periodRevenue = useMemo(() => {
    const start = new Date(`${periodStart}T00:00:00`);
    const end = new Date(`${periodEnd}T23:59:59`);

    return payments
      .filter((payment) => {
        const date = new Date(payment.date);
        return date >= start && date <= end;
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments, periodStart, periodEnd]);

  const getInvoiceForBooking = (bookingId: string) => {
    return invoices.find((invoice) => invoice.bookingId === bookingId);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            Payments
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            Record payments, track balances, and export invoices per booking.
          </p>
        </div>

        {error && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Total Revenue
            </p>

            <p className="text-3xl font-bold text-primary mt-2">
              ₱{totalRevenue.toFixed(2)}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Outstanding Balance
            </p>

            <p className="text-3xl font-bold text-accent mt-2">
              ₱{outstanding.toFixed(2)}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Period Revenue
            </p>

            <p className="text-3xl font-bold text-secondary mt-2">
              ₱{periodRevenue.toFixed(2)}
            </p>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="font-heading text-lg font-bold text-card-foreground mb-4">
            Financial Summary (date range)
          </h2>

          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground">
                From
              </label>

              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="block mt-1 px-3 py-2 border border-border rounded-lg"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">
                To
              </label>

              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="block mt-1 px-3 py-2 border border-border rounded-lg"
              />
            </div>

            <p className="text-sm text-card-foreground pb-2">
              <span className="font-semibold">
                ₱{periodRevenue.toFixed(2)}
              </span>{' '}
              received in this period
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-6 font-semibold text-card-foreground">
                    Customer
                  </th>

                  <th className="text-left p-6 font-semibold text-card-foreground">
                    Event
                  </th>

                  <th className="text-left p-6 font-semibold text-card-foreground">
                    Total
                  </th>

                  <th className="text-left p-6 font-semibold text-card-foreground">
                    Paid
                  </th>

                  <th className="text-left p-6 font-semibold text-card-foreground">
                    Outstanding
                  </th>

                  <th className="text-left p-6 font-semibold text-card-foreground">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-muted-foreground"
                    >
                      Loading financial records...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-muted-foreground"
                    >
                      No financial records found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => {
                    const bookingOutstanding =
                      booking.totalCost - booking.paymentsReceived;

                    const invoice = getInvoiceForBooking(booking.id);

                    return (
                      <tr
                        key={booking.id}
                        className="border-b border-border hover:bg-muted/50"
                      >
                        <td className="p-6 font-medium text-card-foreground">
                          {booking.customerName}
                        </td>

                        <td className="p-6 text-muted-foreground">
                          Catering Event
                        </td>

                        <td className="p-6 font-semibold text-card-foreground">
                          ₱{booking.totalCost.toFixed(2)}
                        </td>

                        <td className="p-6 text-green-600 font-medium">
                          ₱{booking.paymentsReceived.toFixed(2)}
                        </td>

                        <td
                          className={`p-6 font-semibold ${
                            bookingOutstanding > 0
                              ? 'text-destructive'
                              : 'text-green-600'
                          }`}
                        >
                          ₱{Math.max(bookingOutstanding, 0).toFixed(2)}
                        </td>

                        <td className="p-6">
                          <div className="flex gap-2">
                            {bookingOutstanding > 0 && invoice && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPaymentForm({
                                    bookingId: booking.id,
                                    invoiceId: Number(invoice.id),
                                    amount: bookingOutstanding,
                                    type:
                                      booking.paymentsReceived === 0
                                        ? 'down_payment'
                                        : 'partial',
                                    notes: '',
                                  })
                                }
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                Record
                              </Button>
                            )}

                            {invoice && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => printInvoicePdf(invoice)}
                              >
                                <FileDown className="w-4 h-4 mr-1" />
                                Invoice
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {payments.length > 0 && (
          <Card className="p-6">
            <h2 className="font-heading text-lg font-bold text-card-foreground mb-4">
              Payment History
            </h2>

            <div className="space-y-2">
              {[...payments]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() -
                    new Date(a.date).getTime()
                )
                .map((payment) => {
                  const booking = bookings.find(
                    (b) => b.id === payment.bookingId
                  );

                  return (
                    <div
                      key={payment.id}
                      className="flex justify-between items-center p-3 bg-muted/50 rounded-lg text-sm"
                    >
                      <span className="text-card-foreground">
                        {booking?.customerName ?? payment.bookingId} —{' '}
                        <span className="capitalize">
                          {payment.type.replace('_', ' ')}
                        </span>
                      </span>

                      <span className="font-semibold text-green-600">
                        +₱{payment.amount.toFixed(2)}{' '}
                        <span className="text-muted-foreground font-normal">
                          {new Date(payment.date).toLocaleDateString()}
                        </span>
                      </span>
                    </div>
                  );
                })}
            </div>
          </Card>
        )}

        {paymentForm && (
          <Card className="p-6 bg-primary/5 border-primary/20">
            <h2 className="text-lg font-bold text-card-foreground mb-4">
              Record Payment
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-muted-foreground">
                  Payment type
                </label>

                <select
                  value={paymentForm.type}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      type: e.target.value as PaymentType,
                    })
                  }
                  className="block mt-1 w-full max-w-xs px-3 py-2 border border-border rounded-lg"
                >
                  <option value="down_payment">
                    Down payment
                  </option>

                  <option value="partial">
                    Partial payment
                  </option>

                  <option value="full_payment">
                    Full payment
                  </option>
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  Amount
                </label>

                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    min="0"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-4 py-2 border border-border rounded-lg"
                    placeholder="Amount"
                  />

                  <input
                    type="text"
                    value={paymentForm.notes}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        notes: e.target.value,
                      })
                    }
                    className="flex-1 px-4 py-2 border border-border rounded-lg"
                    placeholder="Notes (optional)"
                  />

                  <Button
                    onClick={handleRecordPayment}
                    className="bg-green-600 text-white hover:bg-brand"
                  >
                    Confirm
                  </Button>

                  <Button
                    onClick={() => setPaymentForm(null)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}