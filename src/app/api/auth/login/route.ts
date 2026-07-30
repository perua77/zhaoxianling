import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "邮箱和密码不能为空" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Auth] 环境变量缺失:", { hasUrl: !!supabaseUrl, hasAnonKey: !!supabaseAnonKey });
      return NextResponse.json(
        { success: false, error: "服务器配置错误，请联系管理员" },
        { status: 500 }
      );
    }

    // 使用 @supabase/ssr 的 createServerClient，登录成功后会以标准格式写入
    // 会话 cookie（与 middleware 的 createServerClient 完全一致），
    // 保证服务端 getUser() 能正确解析并校验用户身份。
    const cookieStore = await cookies();
    const response = NextResponse.json({ success: true });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
      global: {
        fetch: (url, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          return fetch(url, { ...init, signal: controller.signal }).finally(() =>
            clearTimeout(timeoutId)
          );
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[Auth] 登录失败:", error.message);

      let errorMessage = "登录失败，请重试";
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "账号或密码错误";
      } else if (error.message.includes("Email rate limit exceeded")) {
        errorMessage = "请求过于频繁，请稍后再试";
      } else if (
        error.message.includes(
          "For security purposes, you have reached the maximum number of email confirmations"
        )
      ) {
        errorMessage = "登录尝试次数过多，请稍后再试";
      }

      return NextResponse.json(
        { success: false, error: errorMessage, detail: error.message },
        { status: 401 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        { success: false, error: "登录成功但会话创建失败" },
        { status: 500 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("roles, full_name, phone")
      .eq("id", data.user.id)
      .single();

    const userRoles =
      profile?.roles ||
      (data.user.user_metadata?.role ? [data.user.user_metadata.role] : []);

    const responsePayload = {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name || data.user.user_metadata?.full_name || "",
        phone: profile?.phone || data.user.user_metadata?.phone || "",
        roles: userRoles,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };

    // 会话 cookie 已由 createServerClient 的 setAll 写入 response，
    // 这里仅需把业务数据合并进同一个 response 返回。
    return NextResponse.json(responsePayload, { headers: response.headers });
  } catch (err: any) {
    console.error("[Auth] 服务器错误:",err);
    const errorMessage = err?.message || "服务器内部错误，请稍后重试";
    return NextResponse.json(
      { success: false, error: errorMessage, detail: errorMessage },
      { status: 500 }
    );
  }
}