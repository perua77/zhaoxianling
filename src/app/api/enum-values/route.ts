import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: apps } = await supabase.from("applications").select("status");
    const existingStatuses: string[] = [];
    if (apps) {
      const statusSet = new Set<string>();
      (apps as {status:string}[]).forEach(a => statusSet.add(a.status));
      statusSet.forEach(s => existingStatuses.push(s));
    }

    const { data: pendingApps } = await supabase
      .from("applications")
      .select("id")
      .eq("status", "pending")
      .limit(1);
    
    const { data: reviewingApps } = await supabase
      .from("applications")
      .select("id")
      .eq("status", "reviewing")
      .limit(1);

    const { data: acceptedApps } = await supabase
      .from("applications")
      .select("id")
      .eq("status", "accepted")
      .limit(1);

    const { data: rejectedApps } = await supabase
      .from("applications")
      .select("id")
      .eq("status", "rejected")
      .limit(1);

    const { data: interviewingApps } = await supabase
      .from("applications")
      .select("id")
      .eq("status", "interviewing")
      .limit(1);

    return NextResponse.json({
      success: true,
      existingStatuses,
      validStatuses: {
        pending: pendingApps !== null,
        reviewing: reviewingApps !== null,
        accepted: acceptedApps !== null,
        rejected: rejectedApps !== null,
        interviewing: interviewingApps !== null,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) });
  }
}