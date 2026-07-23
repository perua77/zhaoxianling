import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    interface ProfileData { id: string; full_name: string; phone: string; roles: string[] | null; }
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    console.log("[Users API] All profiles:", JSON.stringify(profiles?.map(p => ({
      id: p.id,
      full_name: p.full_name,
      roles: p.roles,
      rolesIsArray: Array.isArray(p.roles),
      rolesLength: Array.isArray(p.roles) ? p.roles.length : 0
    })), null, 2));

    const filteredUsers = (profiles as ProfileData[] || []).filter((p) => {
      const roles = Array.isArray(p.roles) ? p.roles : [];
      const hasValidRoles = roles.length > 0;
      const notOnlyCandidate = !roles.every((r) => r === "candidate");
      console.log(`[Users API] User ${p.full_name}: roles=${JSON.stringify(roles)}, hasValidRoles=${hasValidRoles}, notOnlyCandidate=${notOnlyCandidate}`);
      return hasValidRoles && notOnlyCandidate;
    });

    console.log("[Users API] Filtered users count:", filteredUsers.length);

    const enrichedUsers = await Promise.all(
      filteredUsers.map(async (user) => {
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id);
        return {
          ...user,
          email: authError ? "" : authUser?.user?.email || "",
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedUsers,
    });
  } catch (error) {
    console.error("Fetch admin users error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}