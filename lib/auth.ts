import { supabase } from '@/lib/supabase';
import { useAppState } from '@/lib/state';
import type { BusinessOwnerRow, CustomerRow, User, UserRole } from '@/lib/types';

const CUSTOMER_SESSION_KEY = 'caterflex-customer-session';
const OWNER_SESSION_KEY = 'caterflex-owner-session';

export type AuthSuccess = { ok: true; user: User };
export type AuthFailure = { ok: false; error: string };
export type AuthResult = AuthSuccess | AuthFailure;

function messageFromError(error: { message?: string; code?: string } | null, fallback: string) {
  const code = error?.code || '';
  const message = error?.message?.trim() || '';
  const lower = message.toLowerCase();

  if (code === '42501' || lower.includes('row-level security')) {
    return 'Supabase is blocking this table. In the SQL Editor, allow insert and select on CUSTOMER for the anon role.';
  }
  if (code === '23505' || lower.includes('duplicate')) {
    return 'This email already has a customer profile. Sign in instead.';
  }
  if (code === 'invalid_credentials') {
    return 'Invalid email or password.';
  }

  return message || fallback;
}

function appUser(user: User) {
  useAppState.getState().setCurrentRole(user.role);
  useAppState.getState().setCurrentUser(user);
  if (typeof window === 'undefined') return;
  if (user.role === 'customer') {
    window.localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
    window.localStorage.setItem(OWNER_SESSION_KEY, JSON.stringify(user));
  }
}

function customerFromRow(row: Pick<CustomerRow, 'CustomerID' | 'Name' | 'Email'>): User {
  return {
    id: String(row.CustomerID),
    name: row.Name,
    email: row.Email,
    role: 'customer',
  };
}

async function findCustomerByEmail(email: string) {
  const { data, error } = await supabase
    .from('CUSTOMER')
    .select('CustomerID, Name, Contact, Email')
    .eq('Email', email)
    .maybeSingle();
  if (error) throw new Error(messageFromError(error, 'Could not load the customer profile.'));
  return data as Pick<CustomerRow, 'CustomerID' | 'Name' | 'Contact' | 'Email'> | null;
}

async function findCustomerByCredentials(email: string, password: string) {
  const { data, error } = await supabase
    .from('CUSTOMER')
    .select('CustomerID, Name, Contact, Email')
    .eq('Email', email)
    .eq('Password', password)
    .maybeSingle();
  if (error) throw new Error(messageFromError(error, 'Could not load the customer profile.'));
  return data as Pick<CustomerRow, 'CustomerID' | 'Name' | 'Contact' | 'Email'> | null;
}

async function findOwner(email: string, password?: string) {
  let query = supabase
    .from('BUSINESS_OWNER')
    .select('OperatorID, Email, BusinessName, OwnerName, Contact, Password')
    .ilike('Email', email);
  if (password) query = query.eq('Password', password);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(messageFromError(error, 'Could not load the owner profile.'));
  return data as BusinessOwnerRow | null;
}

export async function signUpAccount(input: {
  email: string;
  password: string;
  name: string;
  contact: string;
}): Promise<AuthResult> {
  const email = input.email.trim();
  const name = input.name.trim();
  const contact = input.contact.trim();

  try {
    const existing = await findCustomerByEmail(email);
    if (existing) {
      return { ok: false, error: 'This email already has a customer profile. Sign in instead.' };
    }

    const { data, error } = await supabase
      .from('CUSTOMER')
      .insert({
        Name: name,
        Contact: contact,
        Email: email,
        Password: input.password,
      })
      .select('CustomerID, Name, Email')
      .single();

    if (error) {
      return { ok: false, error: messageFromError(error, 'Could not create the customer profile.') };
    }

    const user = customerFromRow(data as Pick<CustomerRow, 'CustomerID' | 'Name' | 'Email'>);
    appUser(user);
    return { ok: true, user };
  } catch (profileError) {
    return {
      ok: false,
      error: profileError instanceof Error ? profileError.message : 'Could not create the customer profile.',
    };
  }
}

export async function signInAccount(input: {
  role: UserRole;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim();

  if (input.role === 'customer') {
    try {
      const customer = await findCustomerByCredentials(email, input.password);
      if (!customer) {
        return { ok: false, error: 'Invalid email or password.' };
      }
      const user = customerFromRow(customer);
      appUser(user);
      return { ok: true, user };
    } catch (profileError) {
      return {
        ok: false,
        error: profileError instanceof Error ? profileError.message : 'Could not load your profile.',
      };
    }
  }

  try {
    const tableOwner = await findOwner(email, input.password);
    if (tableOwner) {
      const user: User = {
        id: String(tableOwner.OperatorID ?? tableOwner.Email),
        name: tableOwner.OwnerName,
        email: tableOwner.Email,
        role: 'owner',
      };
      appUser(user);
      return { ok: true, user };
    }
  } catch (profileError) {
    return { ok: false, error: profileError instanceof Error ? profileError.message : 'Could not load the owner profile.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) return { ok: false, error: messageFromError(error, 'Invalid email or password.') };
  if (!data.user) return { ok: false, error: 'Invalid email or password.' };

  try {
    const owner = await findOwner(email);
    if (!owner) {
      await supabase.auth.signOut();
      return { ok: false, error: 'No owner profile exists for this email.' };
    }
    const user: User = {
      id: data.user.id,
      name: owner.OwnerName,
      email: owner.Email,
      role: 'owner',
    };
    appUser(user);
    return { ok: true, user };
  } catch (profileError) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: profileError instanceof Error ? profileError.message : 'Could not load your profile.',
    };
  }
}

export async function signOutAccount() {
  await supabase.auth.signOut();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
    window.localStorage.removeItem(OWNER_SESSION_KEY);
  }
  useAppState.getState().setCurrentUser(null);
  useAppState.getState().setCurrentRole('customer');
  useAppState.getState().clearCustomerSession();
}

export async function restoreSession() {
  const { data } = await supabase.auth.getUser();
  if (data.user?.email) {
    const owner = await findOwner(data.user.email).catch(() => null);
    if (owner) {
      appUser({ id: data.user.id, name: owner.OwnerName, email: owner.Email, role: 'owner' });
      return;
    }
  }

  if (typeof window === 'undefined') return;
  const ownerRaw = window.localStorage.getItem(OWNER_SESSION_KEY);
  if (ownerRaw) {
    try {
      const savedOwner = JSON.parse(ownerRaw) as User;
      const owner = await findOwner(savedOwner.email);
      if (owner) {
        appUser({ id: String(owner.OperatorID ?? owner.Email), name: owner.OwnerName, email: owner.Email, role: 'owner' });
        return;
      }
    } catch {
      window.localStorage.removeItem(OWNER_SESSION_KEY);
    }
  }

  const raw = window.localStorage.getItem(CUSTOMER_SESSION_KEY);
  if (!raw) {
    useAppState.getState().setCurrentUser(null);
    return;
  }

  try {
    const saved = JSON.parse(raw) as User;
    const customer = await findCustomerByEmail(saved.email);
    if (!customer) {
      window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
      useAppState.getState().setCurrentUser(null);
      return;
    }
    appUser(customerFromRow(customer));
  } catch {
    window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
    useAppState.getState().setCurrentUser(null);
  }
}
