import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("[Supabase] 环境变量缺失:", {
      hasUrl: !!url,
      hasAnonKey: !!anonKey,
    });
    throw new Error("Supabase 环境变量未配置，请检查 .env.local 文件");
  }

  if (!url.startsWith("https://")) {
    console.error("[Supabase] URL 格式错误:", url);
    throw new Error("Supabase URL 必须以 https:// 开头");
  }

  client = createBrowserClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: (...args) => {
        return fetch(...args).catch((err) => {
          console.error("[Supabase] 请求失败:", {
            url: args[0],
            error: err?.message,
            timestamp: new Date().toISOString(),
          });
          throw err;
        });
      },
    },
  });

  return client;
}

/**
 * 测试 Supabase 连接
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const supabase = createClient();
    const { data, error, count } = await supabase
      .from("jobs")
      .select("id, title", { count: "exact" })
      .limit(1);

    if (error) {
      return {
        success: false,
        message: `数据库查询失败: ${error.message}`,
        details: error,
      };
    }

    return {
      success: true,
      message: `连接成功，共 ${count || data?.length || 0} 条数据`,
      details: { dataCount: count || data?.length || 0 },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `连接异常: ${err?.message || String(err)}`,
      details: err,
    };
  }
}
