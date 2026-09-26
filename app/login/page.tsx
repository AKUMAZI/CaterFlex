'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signInAccount } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

const fieldClass =
  'h-11 w-full rounded-xl border border-border bg-card px-4 font-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'owner' ? 'owner' : 'customer';
  const [role, setRole] = useState<UserRole>(initialRole);
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
    const result = await signInAccount({ role, email, password });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace(role === 'owner' ? '/owner/dashboard' : '/customer/inquiry');
  }

  return (
    <main className="relative h-screen max-h-screen overflow-hidden bg-cover bg-center px-6 py-4 text-primary-foreground" style={{ backgroundImage: "url('/background.webp')" }}>
      <div className="absolute inset-0 bg-brand/80" aria-hidden="true" />
      <header className="relative z-10 flex justify-end">
        <span className="hidden font-mono text-xs uppercase tracking-[0.35em] text-primary-foreground/80 sm:block">Catering, refined</span>
      </header>
      <div className="relative z-10 mx-auto flex h-[calc(100vh-5rem)] max-w-6xl items-center justify-center gap-12 py-2 lg:gap-16">
        <section className="hidden max-w-xl lg:block">
          <button type="button" onClick={() => router.push('/')} className="mb-4 block" aria-label="Back to CaterFlex home">
            <img src="/logo.png" alt="CaterFlex logo" className="size-28 object-contain object-left" />
          </button>
          <p className="font-mono text-sm uppercase tracking-[0.35em] text-primary-foreground/80">The calm behind every great event</p>
          <h1 className="mt-6 max-w-xl text-balance text-6xl font-bold uppercase leading-[0.88] tracking-tight">Your table is ready.</h1>
          <p className="mt-7 max-w-xl font-mono text-lg leading-7 text-primary-foreground/85">One considered space for running your catering business or planning a memorable gathering. Sign in to pick up where you left off.</p>
          <div className="mt-8 flex gap-8 font-mono text-sm text-primary-foreground/70"><span>• Bookings made simple</span><span>• Menus made personal</span></div>
        </section>
        <section className="w-full max-w-lg rounded-3xl border border-border/70 bg-card p-6 text-card-foreground shadow-2xl sm:p-8" aria-labelledby="login-heading">
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">Welcome back</p><h2 id="login-heading" className="mt-3 text-4xl font-semibold uppercase tracking-tight">Sign in</h2></div>
          </div>
          <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Account type">
            {(['owner', 'customer'] as const).map((accountRole) => (
              <button
                key={accountRole}
                type="button"
                role="tab"
                aria-selected={role === accountRole}
                onClick={() => setRole(accountRole)}
                className={`rounded-lg px-3 py-3 text-sm font-semibold capitalize transition-colors ${role === accountRole ? 'bg-card text-card-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {accountRole}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label htmlFor="email" className="flex flex-col gap-2 text-sm font-semibold">
              Email address
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={fieldClass} />
            </label>
            <label htmlFor="password" className="flex flex-col gap-2 text-sm font-semibold">
              Password
              <span className="relative">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password" className={`${fieldClass} pr-20`} />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:underline">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending} className="h-11 w-full text-base">
              {pending ? 'Signing in…' : `Continue as ${role}`}
            </Button>
          </form>
          {role === 'customer' && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              New to CaterFlex? <button type="button" onClick={() => router.push('/signup')} className="font-semibold text-primary hover:underline">Create a customer account</button>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" aria-busy="true" />}>
      <LoginForm />
    </Suspense>
  );
}
