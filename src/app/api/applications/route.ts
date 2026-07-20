import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const candidate_id = searchParams.get("candidate_id");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    if (!candidate_id) {
      return NextResponse.json({
        success: false,
        error: "Missing candidate_id",
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("applications")
      .select(`
        id,
        job_id,
        candidate_id,
        full_name,
        phone,
        email,
        self_introduction,
        status,
        referrer_id,
        created_at,
        updated_at,
        jobs (
          id,
          title,
          location,
          salary_min,
          salary_max,
          salary_unit,
          domain
        )
      `)
      .eq("candidate_id", candidate_id)
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
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
    }, { status: 500 });
  }
}