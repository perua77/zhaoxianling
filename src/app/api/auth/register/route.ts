import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, password, fullName } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, error: "手机号和密码不能为空" },
        { status: 400 }
      );
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: "请输入正确的11位手机号" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "密码至少需要6位" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "服务器配置错误，请联系管理员" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const email = `${phone}@zhaoxianling.cn`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role: "candidate",
        },
      },
    });

    if (error) {
      console.error("[Auth] 注册失败:", error.message);
      
      let errorMessage = "注册失败，请重试";
      if (error.message.includes("already been registered")) {
        errorMessage = "该手机号已注册，请直接登录";
      } else if (error.message.includes("Password should be at least")) {
        errorMessage = "密码强度不足，请使用更复杂的密码";
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage, detail: error.message },
        { status: 400 }
      );
    }

    if (data.user) {
      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          roles: ["candidate"],
          full_name: fullName,
          phone,
        });
      } catch (profileError) {
        console.warn("[Auth] 创建 profile 失败:", profileError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "注册成功",
      requireLogin: !data.session,
    });
  } catch (err: any) {
    console.error("[Auth] 服务器错误:", err.message);
    return NextResponse.json(
      { success: false, error: "服务器内部错误，请稍后重试" },
      { status: 500 }
    );
  }
}
