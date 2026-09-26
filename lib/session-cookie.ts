import type { User } from '@/lib/types'

export const SESSION_COOKIE = 'caterflex-session'

function sessionSecret() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }
  return key
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = padded + '='.repeat((4 - (padded.length % 4 || 4)) % 4)
  const binary = atob(paddedBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function utf8ToBase64Url(text: string) {
  return bytesToBase64Url(new TextEncoder().encode(text))
}

function base64UrlToUtf8(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value))
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

async function hmacSha256(message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  )
  return new Uint8Array(signature)
}

export async function encodeSession(user: User) {
  const payload = utf8ToBase64Url(JSON.stringify(user))
  const signature = bytesToBase64Url(await hmacSha256(payload))
  return `${payload}.${signature}`
}

export async function decodeSession(value: string | undefined): Promise<User | null> {
  if (!value) return null
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null

  const expected = await hmacSha256(payload)
  const actual = base64UrlToBytes(signature)
  if (!timingSafeEqualBytes(expected, actual)) return null

  try {
    const user = JSON.parse(base64UrlToUtf8(payload)) as User
    if (!user?.id || !user.email || !user.role) return null
    return user
  } catch {
    return null
  }
}
