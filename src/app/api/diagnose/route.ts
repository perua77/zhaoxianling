import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? `${supabaseUrl.slice(0, 20)}...` : null,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 20)}...` : null,
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? `${supabaseServiceKey.slice(0, 20)}...` : null,
      urlValid: supabaseUrl?.startsWith("https://") ?? false,
      keyLength: supabaseAnonKey?.length ?? 0,
    },
    network: {
      online: typeof navigator !== "undefined" ? navigator.onLine : "server-side",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server-side",
    },
    tests: {
      basicConnection: null as any,
      tableAccess: null as any,
    },
  };

  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      diagnostics.tests.basicConnection = {
        status: "error",
        message: "环境变量缺失",
      };
      return NextResponse.json(diagnostics);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from("jobs")
      .select("id, title")
      .limit(1);

    if (error) {
      diagnostics.tests.basicConnection = {
        status: "error",
        message: error.message,
        code: error.code,
        hint: error.hint,
      };
    } else {
      diagnostics.tests.basicConnection = {
        status: "success",
        message: "连接成功",
        dataCount: data?.length ?? 0,
      };
    }

    const { data: tableCheck, error: tableError } = await supabase
      .from("profiles")
      .select("count", { count: "exact" })
      .limit(0);

    diagnostics.tests.tableAccess = {
      profiles: tableError ? `Error: ${tableError.message}` : `Profiles 表可访问`,
    };

  } catch (err: any) {
    diagnostics.tests.basicConnection = {
      status: "error",
      message: err?.message || String(err),
      stack: err?.stack?.slice(0, 200),
    };
  }

  return NextResponse.json(diagnostics);
}
