import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    if (id) {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data,
      });
    } else {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: data || [],
        count: data?.length || 0,
      });
    }
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
    }, { status: 500 });
  }
}