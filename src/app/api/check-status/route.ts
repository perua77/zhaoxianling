import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: apps } = await supabase.from("applications").select("status");
    const statuses: string[] = [];
    if (apps) {
      const statusSet = new Set<string>();
      (apps as {status:string}[]).forEach(a => statusSet.add(a.status));
      statusSet.forEach(s => statuses.push(s));
    }
    return NextResponse.json({ success: true, existingStatuses: statuses });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) });
  }
}