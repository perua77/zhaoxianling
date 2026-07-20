import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

/**
 * Auth 回调处理
 * 处理 Supabase 邮箱验证、OAuth 回调等
 * 交换 code 获取 session 后重定向到 /home
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/home";

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // 交换失败，重定向到登录页
      return NextResponse.redirect(`${origin}/login?error=auth_callback`);
    }

    return response;
  }

  // 没有 code 参数，重定向到登录页
  return NextResponse.redirect(`${origin}/login`);
}
