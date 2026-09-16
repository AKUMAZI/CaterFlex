'use client';

import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/state';
import { signOutAccount } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

export function TopNav() {
  const router = useRouter();
  const { currentRole, currentUser } = useAppState();

  const handleSignOut = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        router.push('/login');
      }
    } catch {
      await signOutAccount();
      router.push('/login');
    }
  };

  return (
    <header className="border-b border-border sticky top-0 z-50 shadow-md bg-surface text-surface-foreground">
      <div className="flex items-center justify-end h-16 px-6">
        <div className="flex items-center gap-4">
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
