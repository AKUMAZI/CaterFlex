'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import { MoreHorizontal } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

type RevenuePoint = {
  date: string
  revenue: number
}

type Activity = {
  id: string
  customerName: string
  status: string
  createdAt: string
}

type RevenueActivityProps = {
  revenueData: RevenuePoint[]
  recentActivity: Activity[]
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#BA6A4C',
  },
} satisfies ChartConfig

const AVATAR_COLORS = [
  '#BA6A4C',
  '#607456',
  '#7B2525',
  '#D9A05B',
  '#4C6EBA',
]

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  const now = Date.now()

  const diff = now - then
  const mins = Math.round(diff / 60000)

  if (mins < 60) {
    return `${Math.max(mins, 1)} min ago`
  }

  const hours = Math.round(mins / 60)

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.round(hours / 24)

  if (days === 1) {
    return 'Yesterday'
  }

  return `${days} days ago`
}

function activityText(activity: Activity) {
  switch (activity.status) {
    case 'confirmed':
      return {
        verb: 'confirmed event',
        target: `#${activity.id}`,
      }

    case 'completed':
      return {
        verb: 'completed event',
        target: `#${activity.id}`,
      }

    case 'rejected':
      return {
        verb: 'had a booking declined',
        target: `#${activity.id}`,
      }

    case 'cancelled':
      return {
        verb: 'cancelled booking',
        target: `#${activity.id}`,
      }

    default:
      return {
        verb: 'requested a new booking',
        target: `#${activity.id}`,
      }
  }
}

export function RevenueActivity({
  revenueData,
  recentActivity,
}: RevenueActivityProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

      {/* Revenue Trend */}
      <Card className="p-6 lg:col-span-2">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-card-foreground">
              Revenue trend
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Actual paid revenue over the past 30 days.
            </p>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            aria-label="Revenue options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {revenueData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No payment data available yet.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="h-[280px] w-full"
          >
            <AreaChart
              data={revenueData}
              margin={{
                left: 4,
                right: 8,
                top: 8,
              }}
            >
              <defs>
                <linearGradient
                  id="fillRevenue"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-revenue)"
                    stopOpacity={0.3}
                  />

                  <stop
                    offset="95%"
                    stopColor="var(--color-revenue)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={3}
                tickFormatter={(value) => {
                  const date = new Date(value)

                  if (Number.isNaN(date.getTime())) {
                    return value
                  }

                  return date.toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                  })
                }}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={55}
                tickFormatter={(value) =>
                  `₱${(Number(value) / 1000).toFixed(1)}k`
                }
              />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      const date = new Date(String(value))

                      if (Number.isNaN(date.getTime())) {
                        return String(value)
                      }

                      return date.toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    }}
                    formatter={(value, name) => (
                      <span className="flex w-full justify-between gap-4">
                        <span className="capitalize text-muted-foreground">
                          {name}
                        </span>

                        <span className="font-mono font-medium">
                          ₱
                          {Number(value).toLocaleString(
                            'en-PH',
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </span>
                      </span>
                    )}
                  />
                }
              />

              <ChartLegend
                content={<ChartLegendContent />}
              />

              <Area
                dataKey="revenue"
                type="monotone"
                stroke="var(--color-revenue)"
                fill="url(#fillRevenue)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-card-foreground">
              Recent activity
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Latest booking updates.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0"
          >
            View all
          </Button>
        </div>

        <div className="space-y-5">
          {recentActivity.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No recent activity.
            </p>
          )}

          {recentActivity.map((activity) => {
            const { verb, target } =
              activityText(activity)

            const color =
              AVATAR_COLORS[
                Math.abs(
                  activity.id
                    .split('')
                    .reduce(
                      (total, character) =>
                        total + character.charCodeAt(0),
                      0
                    )
                ) % AVATAR_COLORS.length
              ]

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3"
              >
                {/* Avatar */}
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{
                    backgroundColor: color,
                  }}
                  aria-hidden="true"
                >
                  {initials(activity.customerName)}
                </div>

                {/* Activity text */}
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-card-foreground">
                    <span className="font-semibold">
                      {activity.customerName}
                    </span>{' '}

                    {verb}{' '}

                    <span className="font-semibold">
                      {target}
                    </span>
                    .
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {relativeTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}