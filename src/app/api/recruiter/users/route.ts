import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    interface ProfileData { id: string; full_name: string; phone: string; roles: string[] | null; }
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, roles");

    if (error) throw error;

    const filteredUsers = (profiles as ProfileData[] || []).filter((p) => {
      const roles = Array.isArray(p.roles) ? p.roles : [];
      return roles.length > 0 && !roles.every((r) => r === "candidate");
    });

    return NextResponse.json({
      success: true,
      data: filteredUsers,
    });
  } catch (error) {
    console.error("Fetch admin users error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}