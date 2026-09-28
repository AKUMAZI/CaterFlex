"use server";

import { getSupabaseServer } from "@/lib/auth-server";

export async function requireAdmin() {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user?.app_metadata?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  return session;
}
