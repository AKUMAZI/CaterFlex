'use client';

import { DashboardLayout } from '@/app/dashboard-layout';
import { supabase } from '@/lib/supabase';
import type { PaymentType, Invoice, Payment } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { DollarSign, FileDown, X } from 'lucide-react';
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
  } | null>(null);

  const [periodStart, setPeriodStart] = useState('2026-06-01');
  const [periodEnd, setPeriodEnd] = useState('2026-07-31');

  const loadFinancialData = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Load bookings
      const { data: bookingRows, error: bookingError } = await supabase
        .from('BOOKING')
        .select(
          'BookingID, CustomerID, OperatorID, EventDate, EventTime, Venue, GuestCount, Status'
        )
        .eq('OperatorID', 2)
        .order('EventDate', { ascending: false });

      if (bookingError) throw bookingError;

      // 2. Load customers
      const { data: customerRows, error: customerError } = await supabase
        .from('CUSTOMER')
        .select('CustomerID, Name, Email');

      if (customerError) throw customerError;

      // 3. Load invoices
      const { data: invoiceRows, error: invoiceError } = await supabase
        .from('INVOICE')
        .select('InvoiceID, BookingID, TotalAmount, DateGenerated');

      if (invoiceError) throw invoiceError;

      // 4. Load payments
      const { data: paymentRows, error: paymentError } = await supabase
        .from('PAYMENT')
        .select(
          'PaymentID, InvoiceID, Amount, PaymentType, Status, DatePaid'
        )
        .order('DatePaid', { ascending: false });

      if (paymentError) throw paymentError;

      // 5. Load booking items
      const { data: bookingItemRows, error: bookingItemError } =
        await supabase
          .from('BOOKING_ITEM')
          .select('BookingItemID, BookingID, MenuItemID, Quantity');

      if (bookingItemError) throw bookingItemError;

      // 6. Load menu items
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

      // Convert PAYMENT database rows into UI Payment type
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

      // Calculate total payments per booking
      const paymentsByBooking = new Map<string, number>();

      for (const payment of mappedPayments) {
        if (!payment.bookingId) continue;

        const current = paymentsByBooking.get(payment.bookingId) ?? 0;

        paymentsByBooking.set(
          payment.bookingId,
          current + payment.amount
        );
      }

      // Convert bookings into the shape expected by this page
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

      // Build Invoice objects required by printInvoicePdf()
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
          .filter(
            (payment) =>
              payment.bookingId === String(invoice.BookingID)
          )
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

  // Record payment
  const handleRecordPayment = async () => {
    if (!paymentForm || paymentForm.amount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    const booking = bookings.find(
      (item) => item.id === paymentForm.bookingId
    );

    if (!booking) {
      setError('Booking not found.');
      return;
    }

    const bookingOutstanding =
      booking.totalCost - booking.paymentsReceived;

    if (paymentForm.amount > bookingOutstanding) {
      setError(
        'Payment cannot be greater than the outstanding balance.'
      );
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
      setError(
        paymentError.message || 'Failed to record payment.'
      );
      return;
    }

    setPaymentForm(null);
    setError('');

    await loadFinancialData();
  };

  const totalRevenue = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const outstanding = bookings.reduce(
    (sum, booking) =>
      sum +
      Math.max(
        booking.totalCost - booking.paymentsReceived,
        0
      ),
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
    return invoices.find(
      (invoice) => invoice.bookingId === bookingId
    );
  };

  const selectedBooking = paymentForm
    ? bookings.find(
        (booking) => booking.id === paymentForm.bookingId
      )
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">
            Payments
          </h1>

          <p className="text-surface-muted-foreground mt-2">
            Record payments, track balances, and export invoices per
            booking.
          </p>
        </div>

        {error && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {/* Summary Cards */}
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

        {/* Date Range */}
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

        {/* Financial Table */}
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
                      booking.totalCost -
                      booking.paymentsReceived;

                    const invoice = getInvoiceForBooking(
                      booking.id
                    );

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
                          ₱
                          {Math.max(
                            bookingOutstanding,
                            0
                          ).toFixed(2)}
                        </td>

                        <td className="p-6">
                          <div className="flex gap-2">
                            {/* Record Payment */}
                            {bookingOutstanding > 0 &&
                              invoice && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setPaymentForm({
                                      bookingId: booking.id,
                                      invoiceId: Number(
                                        invoice.id
                                      ),
                                      amount:
                                        bookingOutstanding,
                                      type:
                                        booking.paymentsReceived ===
                                        0
                                          ? 'down_payment'
                                          : 'partial',
                                    })
                                  }
                                >
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  Record
                                </Button>
                              )}

                            {/* Invoice */}
                            {invoice && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  printInvoicePdf(invoice)
                                }
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

        {/* Payment History */}
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
                        {booking?.customerName ??
                          payment.bookingId}{' '}
                        —{' '}
                        <span className="capitalize">
                          {payment.type.replace('_', ' ')}
                        </span>
                      </span>

                      <span className="font-semibold text-green-600">
                        +₱{payment.amount.toFixed(2)}{' '}
                        <span className="text-muted-foreground font-normal">
                          {new Date(
                            payment.date
                          ).toLocaleDateString()}
                        </span>
                      </span>
                    </div>
                  );
                })}
            </div>
          </Card>
        )}
      </div>

      {/* Record Payment Modal */}
        {paymentForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setPaymentForm(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h2 className="font-heading text-xl font-bold text-card-foreground">
                    Record Payment
                  </h2>

                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBooking?.customerName ?? 'Customer'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPaymentForm(null)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Outstanding Balance */}
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    Outstanding Balance
                  </p>

                  <p className="text-2xl font-bold text-card-foreground mt-1">
                    ₱
                    {Math.max(
                      (selectedBooking?.totalCost ?? 0) -
                        (selectedBooking?.paymentsReceived ?? 0),
                      0
                    ).toFixed(2)}
                  </p>
                </div>

                {/* Payment Type */}
                <div>
                  <label className="text-sm font-medium text-card-foreground">
                    Payment Type
                  </label>

                  <select
                    value={paymentForm.type}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        type: e.target.value as PaymentType,
                      })
                    }
                    className="block mt-2 w-full px-3 py-2.5 border border-border rounded-lg bg-white text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
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

                {/* Amount */}
                <div>
                  <label className="text-sm font-medium text-card-foreground">
                    Amount
                  </label>

                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      ₱
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full pl-8 pr-3 py-2.5 border border-border rounded-lg bg-white text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaymentForm(null)}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleRecordPayment}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}
    </DashboardLayout>
  );
}