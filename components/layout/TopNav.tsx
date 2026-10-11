'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/state';
import { getUnreadNotificationCount } from '@/app/actions/notification-actions';
import { formatUnreadBadgeCount, NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notification-client';
import { signOutAccount } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Bell, LogOut, User } from 'lucide-react';

export function TopNav() {
  const router = useRouter();
  const { currentRole, currentUser } = useAppState();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (currentRole !== 'owner') return;

    let active = true;
    const refresh = async () => {
      const result = await getUnreadNotificationCount();
      if (active && result.ok) setUnreadCount(result.count);
    };
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 30_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    };
  }, [currentRole]);

  const handleSignOut = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await response.json();
      await signOutAccount();
      router.push(response.ok && data.redirectUrl ? data.redirectUrl : '/login');
    } catch {
      await signOutAccount();
      router.push('/login');
    }
  };

  return (
    <header className="border-b border-border sticky top-0 z-50 shadow-md bg-surface text-surface-foreground">
      <div className="flex items-center justify-end h-16 px-6">
          <div className="flex items-center gap-4">
          {currentRole === 'owner' && (
            <button
              type="button"
              onClick={() => router.push('/owner/notifications')}
              aria-label={`Notifications, ${unreadCount} unread`}
              className="relative flex size-10 items-center justify-center rounded-lg text-surface-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Bell className="size-5" aria-hidden="true" />
              {formatUnreadBadgeCount(unreadCount) && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-5 text-white">
                  {formatUnreadBadgeCount(unreadCount)}
                </span>
              )}
            </button>
          )}

          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1">
            <User className="w-4 h-4 text-surface-muted-foreground" />
            <span className="text-sm font-medium capitalize text-surface-foreground">
              {currentUser?.name || currentRole}
            </span>
          </div>

          <Button onClick={handleSignOut} variant="outline" size="sm" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
