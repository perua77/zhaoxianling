import { NextResponse } from "next/server";

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
    tests: {},
  };

  // Test 1: Basic fetch to Supabase
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      results.tests.basic_fetch = { error: "No Supabase URL" };
    } else {
      const start = Date.now();
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        method: "GET",
        headers: {
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
      });
      const elapsed = Date.now() - start;
      results.tests.basic_fetch = {
        status: response.status,
        elapsed: `${elapsed}ms`,
        ok: response.ok,
      };
    }
  } catch (err: any) {
    results.tests.basic_fetch = {
      error: err?.message || String(err),
      cause: err?.cause?.message || err?.cause?.code,
      stack: err?.stack?.slice(0, 300),
    };
  }

  // Test 2: Try DNS resolution via a simple HTTP request
  try {
    const start = Date.now();
    const response = await fetch("https://httpbin.org/get", {
      method: "GET",
    });
    const elapsed = Date.now() - start;
    results.tests.httpbin = {
      status: response.status,
      elapsed: `${elapsed}ms`,
      ok: response.ok,
    };
  } catch (err: any) {
    results.tests.httpbin = {
      error: err?.message || String(err),
    };
  }

  // Test 3: Try with the supabase-js client
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const start = Date.now();
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });

      const { data, error } = await supabase
        .from("jobs")
        .select("id")
        .limit(1);

      const elapsed = Date.now() - start;
      results.tests.supabase_client = {
        elapsed: `${elapsed}ms`,
        hasData: !!data,
        error: error?.message || null,
      };
    }
  } catch (err: any) {
    results.tests.supabase_client = {
      error: err?.message || String(err),
      stack: err?.stack?.slice(0, 300),
    };
  }

  return NextResponse.json(results);
}
