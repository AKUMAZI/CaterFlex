import { getSupabaseServer } from "@/lib/auth-server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await getSupabaseServer();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 }
      );
    }

    const userRole = session.user?.user_metadata?.role;

    await supabase.auth.signOut();

    const redirectUrl = userRole === "admin" ? "/admin/login" : "/login";

    return NextResponse.json(
      { message: "Signed out successfully", redirectUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
