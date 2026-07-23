import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 路由守卫中间件
 * - 未登录用户访问受保护页面 → 重定向到 /login
 * - 已登录用户访问 /login → 根据角色重定向
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开页面：不需要登录即可访问
  const isPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/jobs");

  // 静态资源和 API 回调不拦截
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/fonts") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 创建 Supabase 客户端读取 session
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          if (cookiesToSet && Array.isArray(cookiesToSet)) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          }
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 已登录访问 /login → 根据角色重定向
  if (session && session.user && pathname === "/login") {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", session.user.id)
        .single();
      const roles = profile?.roles || [];

      if (roles.includes("recruiter") || roles.includes("interviewer") || roles.includes("vendor")) {
        return NextResponse.redirect(new URL("/recruiter/dashboard", request.url));
      } else {
        return NextResponse.redirect(new URL("/home", request.url));
      }
    } catch (error) {
      console.error("[Middleware] 查询用户角色失败:", error);
      return NextResponse.redirect(new URL("/home", request.url));
    }
  }

  // 未登录访问受保护页面 → 重定向到 /login
  if (!session && !isPublicPath) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
