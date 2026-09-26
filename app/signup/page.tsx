'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signUpAccount } from '@/lib/auth';

const fieldClass =
  'h-11 w-full rounded-xl border border-border bg-card px-4 font-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const contact = String(form.get('contact') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirmPassword') || '');

    if (!name || !contact || !email || password.length < 6) {
      setError('Enter your name, contact, email, and a password with at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setPending(true);
    setError('');
    const result = await signUpAccount({ email, password, name, contact });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace('/customer/inquiry');
  }

  return (
    <main className="relative min-h-screen overflow-y-auto bg-cover bg-center px-6 py-4 text-primary-foreground" style={{ backgroundImage: "url('/background.webp')" }}>
      <div className="absolute inset-0 bg-brand/80" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen items-center justify-center py-8">
        <section className="w-full max-w-lg rounded-3xl border border-border/70 bg-card p-6 text-card-foreground shadow-2xl sm:p-8" aria-labelledby="signup-heading">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">Welcome to CaterFlex</p>
          <h1 id="signup-heading" className="mt-3 text-4xl font-semibold uppercase tracking-tight">Create account</h1>
          <p className="mt-3 text-sm text-muted-foreground">Customer accounts only. Business owners should sign in with an existing profile.</p>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label htmlFor="name" className="flex flex-col gap-2 text-sm font-semibold">
              Full name
              <input id="name" name="name" required autoComplete="name" placeholder="Your name" className={fieldClass} />
            </label>
            <label htmlFor="contact" className="flex flex-col gap-2 text-sm font-semibold">
              Contact
              <input id="contact" name="contact" required autoComplete="tel" placeholder="09xxxxxxxxx" className={fieldClass} />
            </label>
            <label htmlFor="email" className="flex flex-col gap-2 text-sm font-semibold">
              Email address
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={fieldClass} />
            </label>
            <label htmlFor="password" className="flex flex-col gap-2 text-sm font-semibold">
              Password
              <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" className={fieldClass} />
            </label>
            <label htmlFor="confirmPassword" className="flex flex-col gap-2 text-sm font-semibold">
              Confirm password
              <input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} autoComplete="new-password" placeholder="Repeat your password" className={fieldClass} />
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending} className="h-11 w-full text-base">
              {pending ? 'Creating account…' : 'Create customer account'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <button type="button" onClick={() => router.push('/login')} className="font-semibold text-primary hover:underline">Sign in</button>
          </p>
        </section>
      </div>
    </main>
  );
}
