import { getSupabaseServer } from "@/lib/auth-server";
import { decodeSession, SESSION_COOKIE } from "@/lib/session-cookie";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const tableSession = await decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
    const supabase = await getSupabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userRole = session?.user?.user_metadata?.role ?? tableSession?.role;

    if (session) {
      await supabase.auth.signOut();
    }

    cookieStore.delete(SESSION_COOKIE);

    return NextResponse.json({
      message: "Signed out successfully",
      redirectUrl: userRole === "admin" ? "/admin/login" : "/login",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
