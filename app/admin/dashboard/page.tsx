'use client';

import { DashboardLayout } from '@/app/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Sparkles,
  Users,
  UtensilsCrossed,
  AlertTriangle,
} from 'lucide-react';

const bookings = [
  { initials: 'JM', name: 'James Mitchell', event: 'Garden wedding', date: 'Today, 6:30 PM', guests: 84, status: 'Confirmed' },
  { initials: 'LR', name: 'Lisa Rodriguez', event: 'Corporate lunch', date: 'Tomorrow, 12:00 PM', guests: 42, status: 'In prep' },
  { initials: 'AK', name: 'Avery Kim', event: 'Birthday dinner', date: 'Sat, Sep 21', guests: 18, status: 'Pending' },
];

const prepItems = [
  { label: 'Herb-roasted chicken', count: '84 portions', progress: 78 },
  { label: 'Seasonal vegetable medley', count: '84 portions', progress: 52 },
  { label: 'Chocolate torte with berries', count: '84 portions', progress: 31 },
];

export default function AdminDashboard() {
  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" />
              <span>Monday, September 16, 2026</span>
            </div>
            <h1 className="font-heading text-4xl tracking-tight text-foreground md:text-5xl">Good morning, Sarah.</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">Here is what is happening across your kitchen and events today.</p>
          </div>
          <Button className="w-fit gap-2 rounded-full px-5">
            <Plus data-icon="inline-start" /> New booking
          </Button>
        </header>

        <section aria-label="Business overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={DollarSign} label="Revenue this month" value="$18,420" trend="+12.8%" detail="vs. last month" />
          <MetricCard icon={CalendarDays} label="Upcoming events" value="24" trend="+4" detail="this week" />
          <MetricCard icon={Users} label="Guests being served" value="486" trend="+18.2%" detail="across all events" />
          <MetricCard icon={PackageCheck} label="Inventory health" value="92%" trend="Good" detail="2 items need attention" warning />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card className="overflow-hidden border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-5">
              <div>
                <CardTitle className="text-xl">Today&apos;s schedule</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Your next events and their current status.</p>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-primary">View calendar <ChevronRight data-icon="inline-end" /></Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/70">
                {bookings.map((booking) => (
                  <div key={booking.name} className="flex items-center gap-4 px-6 py-5 transition-colors hover:bg-muted/40">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-semibold text-primary">{booking.initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{booking.event}</p>
                        <StatusBadge status={booking.status} />
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{booking.name} · {booking.guests} guests</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium text-foreground">{booking.date}</p>
                      <p className="mt-1 text-xs text-muted-foreground">On-site service</p>
                    </div>
                    <Button variant="ghost" size="icon" aria-label={`More options for ${booking.name}`}><MoreHorizontal /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-secondary text-secondary-foreground shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-white/15"><UtensilsCrossed className="size-5" /></div>
                <Badge className="border-white/20 bg-white/15 text-secondary-foreground">Live kitchen</Badge>
              </div>
              <CardTitle className="pt-3 text-xl">Prep progress</CardTitle>
              <p className="text-sm text-secondary-foreground/75">Garden wedding · 84 guests</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {prepItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{item.label}</span>
                    <span className="shrink-0 text-secondary-foreground/70">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-primary" style={{ width: `${item.progress}%` }} /></div>
                </div>
              ))}
              <div className="mt-1 flex items-center gap-2 border-t border-white/15 pt-4 text-sm font-medium"><Clock3 className="size-4" /> Service begins in 5h 42m</div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle className="text-xl">Quick actions</CardTitle><p className="mt-1 text-sm text-muted-foreground">Keep your operation moving.</p></div></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <QuickAction icon={CalendarDays} title="Manage bookings" detail="Review 8 pending requests" />
              <QuickAction icon={UtensilsCrossed} title="Update menu" detail="12 menu items published" />
              <QuickAction icon={PackageCheck} title="Check inventory" detail="2 low-stock ingredients" />
              <QuickAction icon={Users} title="Customer directory" detail="128 active customers" />
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle className="text-xl">Needs attention</CardTitle><p className="mt-1 text-sm text-muted-foreground">Small things before service.</p></div><AlertTriangle className="size-5 text-primary" /></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <AttentionRow title="Peanut butter is running low" detail="Update inventory before tomorrow" />
              <AttentionRow title="8 booking requests waiting" detail="The oldest request is 2 days old" />
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ icon: Icon, label, value, trend, detail, warning = false }: { icon: typeof DollarSign; label: string; value: string; trend: string; detail: string; warning?: boolean }) {
  return <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div><span className={`flex items-center gap-1 text-xs font-semibold ${warning ? 'text-primary' : 'text-secondary'}`}><ArrowUpRight className="size-3" />{trend}</span></div><p className="mt-5 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function StatusBadge({ status }: { status: string }) {
  const styles = status === 'Confirmed' ? 'bg-secondary/10 text-secondary' : status === 'In prep' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  return <Badge variant="outline" className={`border-transparent text-[11px] ${styles}`}>{status}</Badge>;
}

function QuickAction({ icon: Icon, title, detail }: { icon: typeof CalendarDays; title: string; detail: string }) {
  return <Button variant="outline" className="h-auto justify-start gap-3 rounded-2xl px-4 py-4 text-left"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span><span className="min-w-0"><span className="block font-semibold text-foreground">{title}</span><span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{detail}</span></span><ChevronRight className="ml-auto size-4 text-muted-foreground" /></Button>;
}

function AttentionRow({ title, detail }: { title: string; detail: string }) {
  return <div className="flex items-start gap-3"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CheckCircle2 className="size-4" /></div><div><p className="text-sm font-medium text-foreground">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div>;
}
'} отс &jsonҳәыс}]} Oqartussat 天天中彩票中大奖. } tungaanut дәриҗ. 手机上天天中彩票 ?} novitads
