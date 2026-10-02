'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, ClipboardList, Home, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { signOutAccount } from '@/lib/auth';

const links = [
  { href: '/customer/inquiry', label: 'Start an order', icon: Home },
  { href: '/customer/status', label: 'My requests', icon: ClipboardList },
  { href: '/customer/active-orders', label: 'Meal plans', icon: BookOpen },
];

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOutAccount();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#F3E8D8] text-foreground">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-brand text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 lg:px-8">
          <Link href="/customer/inquiry" className="flex items-center" onClick={() => setOpen(false)} aria-label="CaterFlex home">
            <img src="/logo.png" alt="CaterFlex" className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
          </Link>
          <button type="button" className="rounded-md p-2 text-primary-foreground md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
          <nav className="hidden items-center gap-2 md:flex" aria-label="Customer navigation">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm transition-colors',
                    pathname === link.href
                      ? 'bg-card text-card-foreground'
                      : 'text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground'
                  )}
                >
                  <Icon className="mr-2 inline size-4" />
                  {link.label}
                </Link>
              );
            })}
            <button type="button" onClick={handleSignOut} className="rounded-full px-4 py-2 text-sm text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground">
              Sign out
            </button>
          </nav>
        </div>
        {open && (
          <nav className="flex flex-col gap-2 border-t border-white/15 px-5 py-4 md:hidden" aria-label="Customer navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-lg px-4 py-3 text-sm',
                  pathname === link.href ? 'bg-card text-card-foreground' : 'text-primary-foreground/85 hover:bg-white/10'
                )}
              >
                {link.label}
              </Link>
            ))}
            <button type="button" onClick={handleSignOut} className="rounded-lg px-4 py-3 text-left text-sm text-primary-foreground/85 hover:bg-white/10">
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main
        className="min-h-[calc(100vh-81px)] bg-top bg-repeat-y bg-[length:100%_auto] px-5 py-8 lg:px-8 lg:py-12"
        style={{ backgroundImage: "url('/customer-bg.png')" }}
      >
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
