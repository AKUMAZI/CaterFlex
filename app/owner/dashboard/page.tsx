'use client';

import { DashboardLayout } from '@/app/dashboard-layout';
import { useAppState } from '@/lib/state';
import { Card } from '@/components/ui/card';
import { RevenueActivity } from '@/components/owner/RevenueActivity';
import { AlertCircle, Calendar, DollarSign, Package } from 'lucide-react';

export default function OwnerDashboard() {
  const { bookings, alerts, ingredients } = useAppState();

  const pendingBookings = bookings.filter((b) => b.status === 'pending').length;
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed').length;
  const lowStockItems = ingredients.filter(
    (i) => (i.currentStock / i.maxCapacity) * 100 < 30
  ).length;
  const outstandingBalance = bookings.reduce(
    (sum, b) => sum + (b.totalCost - b.paymentsReceived),
    0
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-heading text-3xl font-bold text-surface-foreground mt-2">Dashboard</h1>
          <p className="text-surface-muted-foreground mt-2">
            Welcome back! Here&apos;s your catering business overview.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 tone-dark" style={{ backgroundColor: '#BA6A4C' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Pending Bookings</p>
                <p className="text-3xl font-bold mt-2">
                  {pendingBookings}
                </p>
              </div>
              <div className="p-3 bg-white/15 rounded-lg">
                <Calendar className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="p-6 tone-dark" style={{ backgroundColor: '#607456' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Confirmed Events</p>
                <p className="text-3xl font-bold mt-2">
                  {confirmedBookings}
                </p>
              </div>
              <div className="p-3 bg-white/15 rounded-lg">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="p-6 tone-dark" style={{ backgroundColor: '#7B2525' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Low Stock Alerts</p>
                <p className="text-3xl font-bold mt-2">
                  {lowStockItems}
                </p>
              </div>
              <div className="p-3 bg-white/15 rounded-lg">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="p-6 tone-light" style={{ backgroundColor: '#D9C39E' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-70">Outstanding Balance</p>
                <p className="text-3xl font-bold mt-2">
                  ${outstandingBalance}
                </p>
              </div>
              <div className="p-3 bg-white/30 rounded-lg">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* Revenue trend + Recent activity */}
        <RevenueActivity />

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <Card className="p-6 border-accent/20 tone-dark" style={{ backgroundColor: '#BA6A4C' }}>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5" />
              <h2 className="font-heading text-lg font-bold">Recent Alerts</h2>
            </div>
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 bg-white/60 rounded-lg tone-light"
                >
                  <div
                    className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      alert.severity === 'error'
                        ? 'bg-red-500'
                        : alert.severity === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {alert.message}
                    </p>
                    <p className="font-heading text-xs text-muted-foreground mt-1">
                      {new Intl.DateTimeFormat('en-US', {
                        timeZone: 'UTC',
                      }).format(new Date(alert.timestamp))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick Stats */}
        <Card className="p-6">
          <h2 className="font-heading text-lg font-bold text-card-foreground mb-6">Quick Stats</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold text-card-foreground mt-2">
                {bookings.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Completion Rate
              </p>
              <p className="text-2xl font-bold text-card-foreground mt-2">
                {bookings.length > 0
                  ? Math.round(
                      (bookings.filter((b) => b.status === 'completed').length /
                        bookings.length) *
                        100
                    )
                  : 0}
                %
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-card-foreground mt-2">
                $
                {bookings.reduce((sum, b) => sum + b.paymentsReceived, 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
