'use client';

import Link from 'next/link';
import { useAppState } from '@/lib/state';
import {
  LayoutDashboard,
  Calendar,
  UtensilsCrossed,
  Package,
  Clock,
  DollarSign,
  ClipboardList,
  Home,
  Settings,
  Activity,
} from 'lucide-react';

export function Sidebar() {
  const { currentRole } = useAppState();

  const ownerLinks = [
    { href: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/owner/bookings', label: 'Bookings', icon: ClipboardList },
    { href: '/owner/calendar', label: 'Calendar', icon: Calendar },
    { href: '/menu-management', label: 'Menu Management', icon: UtensilsCrossed },
    { href: '/owner/inventory', label: 'Inventory', icon: Package },
    { href: '/owner/prep-schedule', label: 'Prep Schedule', icon: Clock },
    { href: '/owner/payments', label: 'Payments', icon: DollarSign },
    { href: '/owner/settings', label: 'Operating Rules', icon: Settings },
  ];

  const customerLinks = [
    { href: '/customer/inquiry', label: 'New Booking', icon: Home },
    { href: '/customer/browse', label: 'Browse Menu', icon: UtensilsCrossed },
    { href: '/customer/status', label: 'My Bookings', icon: Activity },
  ];

  const links = currentRole === 'owner' ? ownerLinks : customerLinks;

  return (
    <aside
      className="fixed top-0 left-0 z-30 w-64 h-screen overflow-y-auto border-r border-sidebar-border p-6 bg-repeat"
      style={{
        backgroundColor: '#7B2525',
        backgroundImage:
          'url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/sidebar-bg-DwHu1DKQ3WqCsvm9bMcmzbss6zNvL1.png)',
        backgroundSize: '600px auto',
      }}
    >
      <div className="mb-12 flex items-center justify-center">
        <img src="/logo.png" alt="CaterFlex" className="h-24 w-24 object-contain" />
      </div>

      <nav className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Icon className="w-5 h-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
