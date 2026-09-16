import { supabase } from '@/lib/supabase';
import { useAppState } from '@/lib/state';
import type {
  BusinessOwnerRow,
  CustomerRow,
  User,
  UserRole,
} from '@/lib/types';

const CUSTOMER_SESSION_KEY = 'caterflex-customer-session';

export type AuthSuccess = {
  ok: true;
  user: User;
};

export type AuthFailure = {
  ok: false;
  error: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

function messageFromError(
  error: { message?: string; code?: string } | null,
  fallback: string
) {
  const code = error?.code || '';
  const message = error?.message?.trim() || '';
  const lower = message.toLowerCase();

  if (code === '42501' || lower.includes('row-level security')) {
    return 'Supabase is blocking this table. In the SQL Editor, allow insert and select on CUSTOMER for the anon role.';
  }

  if (code === '23505' || lower.includes('duplicate')) {
    return 'This email already has a customer profile. Sign in instead.';
  }

  if (
    code === 'invalid_credentials' ||
    lower.includes('invalid login credentials')
  ) {
    return 'Invalid email or password.';
  }

  return message || fallback;
}

function appUser(user: User) {
  useAppState.getState().setCurrentRole(user.role);
  useAppState.getState().setCurrentUser(user);

  if (typeof window === 'undefined') return;

  if (user.role === 'customer') {
    window.localStorage.setItem(
      CUSTOMER_SESSION_KEY,
      JSON.stringify(user)
    );
  } else {
    window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
  }
}

function customerFromRow(
  row: Pick<CustomerRow, 'CustomerID' | 'Name' | 'Email'>
): User {
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

  if (error) {
    throw new Error(
      messageFromError(error, 'Could not load the customer profile.')
    );
  }

  return data as Pick<
    CustomerRow,
    'CustomerID' | 'Name' | 'Contact' | 'Email'
  > | null;
}

async function findCustomerByCredentials(
  email: string,
  password: string
) {
  const { data, error } = await supabase
    .from('CUSTOMER')
    .select('CustomerID, Name, Contact, Email')
    .eq('Email', email)
    .eq('Password', password)
    .maybeSingle();

  if (error) {
    throw new Error(
      messageFromError(error, 'Could not load the customer profile.')
    );
  }

  return data as Pick<
    CustomerRow,
    'CustomerID' | 'Name' | 'Contact' | 'Email'
  > | null;
}

async function findOwner(email: string) {
  const { data, error } = await supabase
    .from('BUSINESS_OWNER')
    .select('OperatorID, Email, BusinessName, OwnerName, Contact')
    .eq('Email', email)
    .maybeSingle();

  if (error) {
    throw new Error(
      messageFromError(error, 'Could not load the owner profile.')
    );
  }

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
      return {
        ok: false,
        error: 'This email already has a customer profile. Sign in instead.',
      };
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
      return {
        ok: false,
        error: messageFromError(
          error,
          'Could not create the customer profile.'
        ),
      };
    }

    const user = customerFromRow(
      data as Pick<CustomerRow, 'CustomerID' | 'Name' | 'Email'>
    );

    appUser(user);

    return {
      ok: true,
      user,
    };
  } catch (profileError) {
    return {
      ok: false,
      error:
        profileError instanceof Error
          ? profileError.message
          : 'Could not create the customer profile.',
    };
  }
}

export async function signInAccount(input: {
  role: UserRole;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim();

  // ============================================================
  // CUSTOMER LOGIN
  // ============================================================
  // Customers continue using the existing CUSTOMER table login.
  // We are NOT changing customer authentication to Supabase Auth.
  // ============================================================

  if (input.role === 'customer') {
    try {
      const customer = await findCustomerByCredentials(
        email,
        input.password
      );

      if (!customer) {
        return {
          ok: false,
          error: 'Invalid email or password.',
        };
      }

      const user = customerFromRow(customer);

      appUser(user);

      return {
        ok: true,
        user,
      };
    } catch (profileError) {
      return {
        ok: false,
        error:
          profileError instanceof Error
            ? profileError.message
            : 'Could not load your profile.',
      };
    }
  }

  // ============================================================
  // OWNER LOGIN
  // ============================================================
  // Owner authentication MUST use Supabase Auth.
  // BUSINESS_OWNER only stores the owner's profile information.
  // ============================================================

  try {
    // First make sure there isn't an old/stale session.
    await supabase.auth.signOut();

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });

    if (authError) {
      return {
        ok: false,
        error: messageFromError(
          authError,
          'Invalid owner email or password.'
        ),
      };
    }

    // A real owner login must have BOTH a user and a session.
    if (!authData.user || !authData.session) {
      await supabase.auth.signOut();

      return {
        ok: false,
        error:
          'Owner authentication succeeded, but no Supabase session was created.',
      };
    }

    // Confirm that this authenticated email has a
    // corresponding BUSINESS_OWNER profile.
    const owner = await findOwner(email);

    if (!owner) {
      await supabase.auth.signOut();

      return {
        ok: false,
        error: 'No owner profile exists for this email.',
      };
    }

    await supabase.auth.updateUser({ data: { role: 'owner' } });

    const user: User = {
      id: authData.user.id,
      name: owner.OwnerName,
      email: owner.Email,
      role: 'owner',
    };

    appUser(user);

    return {
      ok: true,
      user,
    };
  } catch (error) {
    await supabase.auth.signOut();

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not authenticate the owner.',
    };
  }
}

export async function signOutAccount() {
  await supabase.auth.signOut();

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
  }

  useAppState.getState().setCurrentUser(null);
  useAppState.getState().setCurrentRole('customer');
  useAppState.getState().clearCustomerSession();
}

export async function signInAdmin(email: string, password: string): Promise<AuthResult> {
  try {
    // Sign out any existing session first
    await supabase.auth.signOut();

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return {
        ok: false,
        error: messageFromError(authError, 'Invalid admin email or password.'),
      };
    }

    if (!authData.user || !authData.session) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: 'Admin authentication succeeded, but no session was created.',
      };
    }

    const userRole = authData.user.user_metadata?.role;

    if (userRole !== 'admin') {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: 'You do not have administrator access.',
      };
    }

    const user: User = {
      id: authData.user.id,
      name: authData.user.email || 'Administrator',
      email: authData.user.email || '',
      role: 'admin',
    };

    appUser(user);

    return {
      ok: true,
      user,
    };
  } catch (error) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not authenticate as administrator.',
    };
  }
}

export async function restoreSession() {
  // ============================================================
  // RESTORE OWNER SESSION
  // ============================================================

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user?.email) {
    const owner = await findOwner(session.user.email).catch(
      () => null
    );

    if (owner) {
      appUser({
        id: session.user.id,
        name: owner.OwnerName,
        email: owner.Email,
        role: 'owner',
      });

      return;
    }
  }

  // ============================================================
  // RESTORE CUSTOMER SESSION
  // ============================================================

  if (typeof window === 'undefined') return;

  const raw = window.localStorage.getItem(
    CUSTOMER_SESSION_KEY
  );

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
