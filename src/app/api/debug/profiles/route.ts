import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, roles");

    if (error) throw error;

    const result = (profiles || []).map(p => ({
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      roles: p.roles,
      roles_type: Array.isArray(p.roles) ? "array" : typeof p.roles,
      roles_is_null: p.roles === null,
      roles_is_undefined: p.roles === undefined,
    }));

    return NextResponse.json({
      success: true,
      total: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Fetch profiles error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
