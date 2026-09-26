'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

const fieldClass =
  'h-11 w-full rounded-lg border border-border bg-card px-4 font-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20';

function AdminLoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    if (!email || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setPending(true);
    setError('');

    try {
      const signInRequest = supabase.auth.signInWithPassword({
        email,
        password,
      });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SIGN_IN_TIMEOUT')), 10000)
      );

      const { data, error: signInError } = await Promise.race([
        signInRequest,
        timeout,
      ]);

      if (signInError) {
        setError('Invalid email or password.');
        setPending(false);
        return;
      }

      if (!data.user) {
        setError('Authentication failed. Please try again.');
        setPending(false);
        return;
      }

      const userRole = data.user.app_metadata?.role;

      if (userRole !== 'admin') {
        await supabase.auth.signOut();
        setError('You do not have administrator access.');
        setPending(false);
        return;
      }

      router.push('/admin/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Administrator</h1>
            <p className="mt-2 text-sm text-slate-400">Secure access for system administrators</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="email" className="flex flex-col gap-2 text-sm font-medium">
              <span className="text-slate-200">Email address</span>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@example.com"
                className={`${fieldClass} bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20`}
              />
            </label>

            <label htmlFor="password" className="flex flex-col gap-2 text-sm font-medium">
              <span className="text-slate-200">Password</span>
              <span className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`${fieldClass} bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 pr-20`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="h-11 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors mt-6"
            >
              {pending ? 'Signing in…' : 'Sign in as Administrator'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-500">
            This is a secure administrative panel. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-900" aria-busy="true" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
