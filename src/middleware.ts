import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getHomePathByRoles } from "@/lib/auth-redirect";

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

  // 创建 Supabase 客户端读取用户身份
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

  // 使用 getUser() 而非 getSession()：getUser() 会向 Supabase Auth 服务端校验，
  // 确保用户身份可信（getSession() 直接读 cookie，服务端存在安全隐患）
  let user = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (error) {
    console.error("[Middleware] getUser 失败:", error);
    user = null;
  }

  // 已登录访问 /login 或根路径 / → 根据角色重定向到对应首页
  if (user && (pathname === "/login" || pathname === "/")) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", user.id)
        .single();
      const roles = profile?.roles || [];

      return NextResponse.redirect(new URL(getHomePathByRoles(roles), request.url));
    } catch (error) {
      console.error("[Middleware] 查询用户角色失败:", error);
      return NextResponse.redirect(new URL("/home", request.url));
    }
  }

  // 未登录访问受保护页面 → 重定向到 /login
  if (!user && !isPublicPath) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
