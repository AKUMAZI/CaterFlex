import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Handle error
          }
        },
      },
    }
  );
}

export async function getSessionWithRole() {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const userRole = session.user.app_metadata?.role || null;

  return {
    session,
    user: session.user,
    role: userRole as "admin" | "owner" | "customer" | null,
  };
}

export async function isAdminSession() {
  const sessionData = await getSessionWithRole();
  return sessionData?.role === "admin";
}

export async function isCustomerOrOwnerSession() {
  const sessionData = await getSessionWithRole();
  return sessionData?.role === "customer" || sessionData?.role === "owner";
}

export async function isOwnerSession() {
  const sessionData = await getSessionWithRole();
  return sessionData?.role === "owner";
}

export async function isCustomerSession() {
  const sessionData = await getSessionWithRole();
  return sessionData?.role === "customer";
}
