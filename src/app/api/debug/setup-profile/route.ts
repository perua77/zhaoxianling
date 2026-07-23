import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, full_name, phone, roles } = await request.json();

    // First, get the user from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      return NextResponse.json({ success: false, error: authError.message }, { status: 500 });
    }

    const authUser = authUsers.users.find(u => u.email === email);
    
    if (!authUser) {
      return NextResponse.json({ success: false, error: `用户 ${email} 不存在于 auth.users 表中` }, { status: 404 });
    }

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({ full_name, phone, roles })
        .eq("id", authUser.id)
        .select();

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: "Profile updated",
        data: updatedProfile,
      });
    } else {
      // Create new profile
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: authUser.id, full_name, phone, roles })
        .select();

      if (insertError) throw insertError;

      return NextResponse.json({
        success: true,
        message: "Profile created",
        data: newProfile,
      });
    }
  } catch (error: any) {
    console.error("Setup profile error:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 }
    );
  }
}
