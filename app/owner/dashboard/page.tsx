'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/app/dashboard-layout'
import { Card } from '@/components/ui/card'
import { RevenueActivity } from '@/components/owner/RevenueActivity'
import { getOwnerDashboardData } from '@/app/actions/dashboard-actions'
import {
  AlertCircle,
  Calendar,
  DollarSign,
  Loader2,
  Package,
} from 'lucide-react'

type DashboardData = {
  pendingBookings: number
  confirmedBookings: number
  lowStockItems: number
  outstandingBalance: number
  totalBookings: number
  completionRate: number
  totalRevenue: number
  recentActivity: {
    id: string
    customerName: string
    status: string
    createdAt: string
  }[]
  alerts: {
    id: string
    message: string
    severity: 'error' | 'warning' | 'info'
    timestamp: string
  }[]
  revenueData: {
    date: string
    revenue: number
  }[]
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value)
}

export default function OwnerDashboard() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null)

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setErrorMessage('')

      const result = await getOwnerDashboardData()

      if (!result.ok) {
        setErrorMessage(result.error)
        setLoading(false)
        return
      }

      setDashboard(result.data)
      setLoading(false)
    }

    void loadDashboard()
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading dashboard data...
        </div>
      </DashboardLayout>
    )
  }

  if (errorMessage || !dashboard) {
    return (
      <DashboardLayout>
        <Card className="p-6 text-sm text-destructive">
          Failed to load dashboard:
          <br />
          {errorMessage || 'No dashboard data available.'}
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-heading mt-2 text-3xl font-bold text-surface-foreground">
            Dashboard
          </h1>

          <p className="mt-2 text-surface-muted-foreground">
            Welcome back! Here&apos;s your catering business overview.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card
            className="tone-dark p-6"
            style={{ backgroundColor: '#BA6A4C' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">
                  Pending Bookings
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {dashboard.pendingBookings}
                </p>
              </div>

              <div className="rounded-lg bg-white/15 p-3">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card
            className="tone-dark p-6"
            style={{ backgroundColor: '#607456' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">
                  Confirmed Events
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {dashboard.confirmedBookings}
                </p>
              </div>

              <div className="rounded-lg bg-white/15 p-3">
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card
            className="tone-dark p-6"
            style={{ backgroundColor: '#7B2525' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">
                  Low Stock Alerts
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {dashboard.lowStockItems}
                </p>
              </div>

              <div className="rounded-lg bg-white/15 p-3">
                <Package className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card
            className="tone-light p-6"
            style={{ backgroundColor: '#D9C39E' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-70">
                  Outstanding Balance
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {formatPrice(dashboard.outstandingBalance)}
                </p>
              </div>

              <div className="rounded-lg bg-white/30 p-3">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* Revenue + Recent Activity */}
        <RevenueActivity
          revenueData={dashboard.revenueData}
          recentActivity={dashboard.recentActivity}
        />

        {/* Alerts */}
        {dashboard.alerts.length > 0 && (
          <Card
            className="tone-dark border-accent/20 p-6"
            style={{ backgroundColor: '#BA6A4C' }}
          >
            <div className="mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />

              <h2 className="font-heading text-lg font-bold">
                Recent Alerts
              </h2>
            </div>

            <div className="space-y-3">
              {dashboard.alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="tone-light flex items-start gap-3 rounded-lg bg-white/60 p-3"
                >
                  <div
                    className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
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

                    <p className="font-heading mt-1 text-xs text-muted-foreground">
                      {new Date(
                        alert.timestamp
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick Stats */}
        <Card className="p-6">
          <h2 className="font-heading mb-6 text-lg font-bold text-card-foreground">
            Quick Stats
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Total Bookings
              </p>

              <p className="mt-2 text-2xl font-bold text-card-foreground">
                {dashboard.totalBookings}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Completion Rate
              </p>

              <p className="mt-2 text-2xl font-bold text-card-foreground">
                {dashboard.completionRate}%
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Total Revenue
              </p>

              <p className="mt-2 text-2xl font-bold text-card-foreground">
                {formatPrice(dashboard.totalRevenue)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}