'use client';

import { CustomerShell } from '@/app/customer/customer-shell';
import { useAppState } from '@/lib/state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getUpcomingFulfillmentDates } from '@/lib/rules/mealPrep';
import { getCustomerMealPrepOrders } from '@/app/actions/booking-actions';
import { Calendar, MapPin, Users, Clock, Pause, Play, Edit2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ActiveOrdersPage() {
  const router = useRouter();
  const { currentUser, bookings, menuItems, updateBooking } = useAppState();
  const [mealPrepOrders, setMealPrepOrders] = useState<Array<{
    id: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    orderType: 'meal_prep';
    eventDate: string;
    eventTime: string;
    eventType: string;
    venue: string;
    guestCount: number;
    mealPrepFrequency: 'weekly' | 'biweekly';
    fulfillmentMethod: 'pickup';
    mealPrepStatus: 'active' | 'paused';
    specialRequests: string;
    status: 'pending' | 'confirmed';
    selectedMenuItemIds: string[];
  }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ servings: '', time: '', frequency: 'weekly', method: 'pickup', address: '', notes: '', dishIds: [] as string[] });

  useEffect(() => {
    getCustomerMealPrepOrders().then((result) => {
      if (!result.ok) return;
      setMealPrepOrders(result.orders
        .filter((order) => order.Status === 'pending' || order.Status === 'confirmed')
        .map((order) => ({
          id: `meal-prep-${order.MealPrepOrderID}`,
          customerId: String(order.CustomerID),
          customerName: currentUser?.name ?? 'Customer',
          customerEmail: currentUser?.email ?? '',
          orderType: 'meal_prep' as const,
          eventDate: new Date().toISOString().slice(0, 10),
          eventTime: '12:00',
          eventType: 'Meal prep plan',
          venue: 'Kitchen',
          guestCount: Number(order.MealsPerCycle ?? 0),
          mealPrepFrequency: order.RecurrencePattern === 'biweekly' ? 'biweekly' as const : 'weekly' as const,
          fulfillmentMethod: 'pickup' as const,
          mealPrepStatus: order.Status === 'confirmed' ? 'active' as const : 'paused' as const,
          specialRequests: '',
          status: order.Status === 'confirmed' ? 'confirmed' as const : 'pending' as const,
          selectedMenuItemIds: (result.items ?? [])
            .filter((item) => item.MealPrepOrderID === order.MealPrepOrderID)
            .map((item) => String(item.MenuItemID)),
        })));
    });
  }, [currentUser?.email, currentUser?.name]);

  // Keep the tab scoped to the signed-in customer before applying meal-plan filters.
  const customerBookings = currentUser
    ? bookings.filter(
        (booking) =>
          booking.customerId === currentUser.id ||
          booking.customerEmail.toLowerCase() === currentUser.email.toLowerCase()
      )
    : [];

  const activeMealPrepOrders = [
    ...customerBookings.filter(
      (booking) => booking.orderType === 'meal_prep' && (booking.status === 'confirmed' || booking.status === 'pending')
    ),
    ...mealPrepOrders,
  ];

  const toggleOrderStatus = (bookingId: string, currentStatus: 'active' | 'paused') => {
    updateBooking(bookingId, {
      mealPrepStatus: currentStatus === 'active' ? 'paused' : 'active',
    });
  };

  const startEditing = (booking: (typeof activeMealPrepOrders)[number]) => {
    setEditingId(booking.id);
    setEditDraft({
      servings: String(booking.guestCount),
      time: booking.eventTime,
      frequency: booking.mealPrepFrequency || 'weekly',
      method: booking.fulfillmentMethod || 'pickup',
      address: booking.fulfillmentMethod === 'delivery' ? booking.venue : '',
      notes: booking.specialRequests || '',
      dishIds: booking.selectedMenuItemIds || [],
    });
  };

  const saveChanges = (bookingId: string) => {
    const servings = Number.parseInt(editDraft.servings, 10);
    if (!Number.isInteger(servings) || servings < 1) return;
    updateBooking(bookingId, {
      guestCount: servings,
      eventTime: editDraft.time,
      mealPrepFrequency: editDraft.frequency as 'weekly' | 'biweekly',
      fulfillmentMethod: editDraft.method as 'pickup' | 'delivery',
      venue: editDraft.method === 'delivery' ? editDraft.address : 'Pickup at kitchen',
      specialRequests: editDraft.notes,
      selectedMenuItemIds: editDraft.dishIds,
    });
    setEditingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (activeMealPrepOrders.length === 0) {
    return (
      <CustomerShell>
        <div className="space-y-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-surface-foreground">Active Orders</h1>
            <p className="text-surface-muted-foreground mt-2">Your recurring meal prep subscriptions</p>
          </div>
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">You don&apos;t have any active meal prep orders yet.</p>
            <Button onClick={() => router.push('/customer/inquiry')}>Start a meal prep plan</Button>
          </Card>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground">Active Orders</h1>
          <p className="text-surface-muted-foreground mt-2">Your recurring meal prep subscriptions</p>
        </div>

        <div className="space-y-4">
          {activeMealPrepOrders.map((booking) => {
            const fulfillmentDates = getUpcomingFulfillmentDates(
              booking.eventDate,
              booking.mealPrepFrequency || 'weekly',
              4
            );
            const isActive = booking.mealPrepStatus === 'active';

            return (
              <Card key={booking.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
                  className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div>
                      <p className="font-semibold text-card-foreground">{booking.eventType}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.guestCount} servings • {booking.mealPrepFrequency === 'biweekly' ? 'Every 2 weeks' : 'Weekly'}
                      </p>
                      <div className="mt-2">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-sm text-muted-foreground">Next fulfillment</p>
                      <p className="font-medium text-card-foreground">{formatDate(fulfillmentDates[0])}</p>
                    </div>
                  </div>
                </button>

                {expandedId === booking.id && (
                  <div className="border-t border-border p-6 bg-muted/20">
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      <div className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-primary mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Servings per cycle</p>
                          <p className="font-medium text-card-foreground">{booking.guestCount}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-primary mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Fulfillment time</p>
                          <p className="font-medium text-card-foreground">{booking.eventTime}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-primary mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {booking.fulfillmentMethod === 'delivery' ? 'Delivery' : 'Pickup'}
                          </p>
                          <p className="font-medium text-card-foreground">
                            {booking.fulfillmentMethod === 'delivery' ? booking.venue : 'Kitchen'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-primary mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Frequency</p>
                          <p className="font-medium text-card-foreground">
                            {booking.mealPrepFrequency === 'biweekly' ? 'Every 2 weeks' : 'Weekly'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <hr className="border-border mb-6" />

                    <div className="mb-6">
                      <h3 className="font-semibold text-card-foreground mb-3">Upcoming fulfillments</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {fulfillmentDates.map((date) => (
                          <div key={date} className="p-2 bg-primary/5 rounded text-center text-sm text-card-foreground">
                            {formatDate(date)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {editingId === booking.id && (
                      <>
                        <div className="mb-6 rounded-xl border border-[#8b2a28] bg-[#8b2a28] p-3 text-[#241f1b]">
                        <p className="mb-3 text-xs font-medium text-[#241f1b]">Dishes in this meal plan</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {menuItems.map((dish) => (
                            <label key={dish.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#241f1b] bg-[#f7f3ed] p-3 text-sm text-[#241f1b] hover:bg-[#eee7dd]">
                              <input type="checkbox" checked={editDraft.dishIds.includes(dish.id)} onChange={(event) => setEditDraft({ ...editDraft, dishIds: event.target.checked ? [...editDraft.dishIds, dish.id] : editDraft.dishIds.filter((id) => id !== dish.id) })} className="size-4 accent-[#c86e4b]" />
                              <span>{dish.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="mb-6 grid gap-4 rounded-xl border border-[#8b2a28] bg-[#8b2a28] p-3 text-[#241f1b] md:grid-cols-2">
                        <label className="text-xs font-medium text-[#241f1b]">Servings
                          <input type="number" min="1" value={editDraft.servings} onChange={(e) => setEditDraft({ ...editDraft, servings: e.target.value })} className="mt-2 w-full rounded-lg border border-[#241f1b] bg-[#f7f3ed] px-3 py-2 text-sm text-[#241f1b] outline-none focus:ring-2 focus:ring-[#c86e4b]" />
                        </label>
                        <label className="text-xs font-medium text-[#241f1b]">Fulfillment time
                          <input type="time" value={editDraft.time} onChange={(e) => setEditDraft({ ...editDraft, time: e.target.value })} className="mt-2 w-full rounded-lg border border-[#241f1b] bg-[#f7f3ed] px-3 py-2 text-sm text-[#241f1b] outline-none focus:ring-2 focus:ring-[#c86e4b]" />
                        </label>
                        <label className="text-xs font-medium text-[#241f1b]">Frequency
                          <select value={editDraft.frequency} onChange={(e) => setEditDraft({ ...editDraft, frequency: e.target.value })} className="mt-2 w-full rounded-lg border border-[#241f1b] bg-[#f7f3ed] px-3 py-2 text-sm text-[#241f1b] outline-none focus:ring-2 focus:ring-[#c86e4b]"><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option></select>
                        </label>
                        <label className="text-xs font-medium text-[#241f1b]">Fulfillment method
                          <select value={editDraft.method} onChange={(e) => setEditDraft({ ...editDraft, method: e.target.value })} className="mt-2 w-full rounded-lg border border-[#241f1b] bg-[#f7f3ed] px-3 py-2 text-sm text-[#241f1b] outline-none focus:ring-2 focus:ring-[#c86e4b]"><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select>
                        </label>
                        {editDraft.method === 'delivery' && <label className="text-xs font-medium text-[#241f1b] md:col-span-2">Delivery address
                          <input value={editDraft.address} onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })} required className="mt-2 w-full rounded-lg border border-[#241f1b] bg-[#f7f3ed] px-3 py-2 text-sm text-[#241f1b] outline-none focus:ring-2 focus:ring-[#c86e4b]" />
                        </label>}
                        <label className="text-xs font-medium text-[#241f1b] md:col-span-2">Special requests
                          <textarea value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} rows={3} className="mt-2 w-full rounded-lg border border-[#241f1b] bg-[#f7f3ed] px-3 py-2 text-sm text-[#241f1b] outline-none focus:ring-2 focus:ring-[#c86e4b]" />
                        </label>
                      </div>
                      </>
                    )}

                    <div className="flex gap-3 pt-6 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => toggleOrderStatus(booking.id, booking.mealPrepStatus || 'active')}
                      >
                        {isActive ? (
                          <>
                            <Pause className="w-4 h-4" />
                            Pause Order
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Resume Order
                          </>
                        )}
                      </Button>
                      {editingId === booking.id ? (
                        <>
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingId(null)}>Cancel</Button>
                          <Button size="sm" className="flex-1" onClick={() => saveChanges(booking.id)}>Save changes</Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => startEditing(booking)}>
                          <Edit2 className="w-4 h-4" />
                          Modify
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </CustomerShell>
  );
}
