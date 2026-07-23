import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Auth] 环境变量缺失:", { hasUrl: !!supabaseUrl, hasAnonKey: !!supabaseAnonKey });
      return NextResponse.json(
        { success: false, error: "服务器配置错误，请联系管理员" },
        { status: 500 }
      );
    }

    const apiKey = supabaseServiceKey || supabaseAnonKey;

    const supabase = createClient(supabaseUrl, apiKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: (url, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
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
      } else if (error.message.includes("For security purposes, you have reached the maximum number of email confirmations")) {
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

    const userRoles = profile?.roles || (data.user.user_metadata?.role ? [data.user.user_metadata.role] : []);

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

    // 创建响应并设置会话 cookie，供中间件识别登录状态
    const response = NextResponse.json(responsePayload);
    
    // Supabase 项目引用 ID（从 URL 中提取）
    const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");
    
    // 设置 Supabase 会话 cookie（与 Supabase 客户端保持一致）
    // Supabase 使用 sb-<project-ref>-auth-token cookie 存储会话信息
    const sessionData = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: data.session.token_type,
      expires_in: data.session.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + data.session.expires_in,
    };
    
    response.cookies.set(`sb-${projectRef}-auth-token`, JSON.stringify(sessionData), {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: data.session.expires_in,
    });

    return response;
  } catch (err: any) {
    console.error("[Auth] 服务器错误:", err);
    const errorMessage = err?.message || "服务器内部错误，请稍后重试";
    return NextResponse.json(
      { success: false, error: errorMessage, detail: errorMessage },
      { status: 500 }
    );
  }
}
