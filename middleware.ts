import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public routes that don't require auth. Login pages are handled below so
  // authenticated users can be redirected away from them.
  const publicRoutes = ["/", "/login", "/signup"];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Create Supabase server client for session checking
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userRole = session?.user?.user_metadata?.role || null;
  const isAuthenticated = !!session;

  // Admin routes - require admin role
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      // If already admin, redirect to dashboard
      if (isAuthenticated && userRole === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      return NextResponse.next();
    }

    // Admin dashboard and other admin routes
    if (!isAuthenticated || userRole !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Owner routes - require owner role
  if (pathname.startsWith("/owner")) {
    if (isAuthenticated && userRole === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    if (!isAuthenticated || userRole !== "owner") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Customer routes - require customer role
  if (pathname.startsWith("/customer")) {
    if (isAuthenticated && userRole === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    if (!isAuthenticated || userRole !== "customer") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
