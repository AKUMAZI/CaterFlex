'use server'

import bcrypt from 'bcryptjs'
import { timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { decodeSession, encodeSession, SESSION_COOKIE } from '@/lib/session-cookie'
import type { User, UserRole } from '@/lib/types'

type AuthSuccess = { ok: true; user: User }
type AuthFailure = { ok: false; error: string }
export type AuthActionResult = AuthSuccess | AuthFailure

function passwordsMatch(stored: string | null | undefined, provided: string) {
  if (!stored) return false
  const a = Buffer.from(stored)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function setSessionCookie(user: User) {
  const store = await cookies()
  store.set(SESSION_COOKIE, await encodeSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getAuthSession(): Promise<User | null> {
  const store = await cookies()
  return decodeSession(store.get(SESSION_COOKIE)?.value)
}

export async function requireRole(role: UserRole): Promise<User | null> {
  const user = await getAuthSession()
  if (!user || user.role !== role) return null
  return user
}

export async function signUpCustomer(input: {
  name: string
  contact: string
  email: string
  password: string
}): Promise<AuthActionResult> {
  const name = input.name.trim()
  const contact = input.contact.trim()
  const email = input.email.trim()
  const password = input.password

  if (!name || !contact || !email || password.length < 6) {
    return { ok: false, error: 'Enter your name, contact, email, and a password with at least 6 characters.' }
  }

  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from('CUSTOMER')
    .select('CustomerID')
    .eq('Email', email)
    .maybeSingle()

  if (existingError) {
    return { ok: false, error: 'Could not create the customer profile.' }
  }
  if (existing) {
    return { ok: false, error: 'This email already has a customer profile. Sign in instead.' }
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const { data, error } = await admin
    .from('CUSTOMER')
    .insert({
      Name: name,
      Contact: contact,
      Email: email,
      Password: passwordHash,
    })
    .select('CustomerID, Name, Email')
    .single()

  if (error || !data) {
    return { ok: false, error: 'Could not create the customer profile.' }
  }

  const user: User = {
    id: String(data.CustomerID),
    name: data.Name,
    email: data.Email,
    role: 'customer',
  }
  await setSessionCookie(user)
  return { ok: true, user }
}

export async function signInCustomer(input: {
  email: string
  password: string
}): Promise<AuthActionResult> {
  const email = input.email.trim()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('CUSTOMER')
    .select('CustomerID, Name, Email, Password')
    .eq('Email', email)
    .maybeSingle()

  if (error) {
    return { ok: false, error: 'Could not load the customer profile.' }
  }
  if (
    !data ||
    typeof data.Password !== 'string' ||
    !(await bcrypt.compare(input.password, data.Password))
  ) {
    return { ok: false, error: 'Invalid email or password.' }
  }

  const user: User = {
    id: String(data.CustomerID),
    name: data.Name,
    email: data.Email,
    role: 'customer',
  }
  await setSessionCookie(user)
  return { ok: true, user }
}

export async function signInOwner(input: {
  email: string
  password: string
}): Promise<AuthActionResult> {
  const email = input.email.trim()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('BUSINESS_OWNER')
    .select('OperatorID, OwnerName, Email, Password')
    .eq('Email', email)
    .maybeSingle()

  if (error) {
    return { ok: false, error: 'Could not load the owner profile.' }
  }
  if (!data || !passwordsMatch(data.Password, input.password)) {
    return { ok: false, error: 'Invalid email or password.' }
  }

  const user: User = {
    id: String(data.OperatorID),
    name: data.OwnerName,
    email: data.Email,
    role: 'owner',
  }
  await setSessionCookie(user)
  return { ok: true, user }
}

export async function signOutSession() {
  await clearSessionCookie()
}

export async function getCustomersByIds(customerIds: number[]) {
  const owner = await requireRole('owner')
  if (!owner) {
    return { ok: false as const, error: 'Owner access required.', customers: [] }
  }

  const uniqueIds = Array.from(new Set(customerIds.filter((id) => Number.isFinite(id))))
  if (uniqueIds.length === 0) {
    return { ok: true as const, customers: [] }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('CUSTOMER')
    .select('CustomerID, Name, Email, Contact')
    .in('CustomerID', uniqueIds)

  if (error) {
    return { ok: false as const, error: 'Could not load customers.', customers: [] }
  }

  return { ok: true as const, customers: data ?? [] }
}
