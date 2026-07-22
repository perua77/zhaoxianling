import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    const { data: applications } = await supabase
      .from("applications")
      .select("id, job_id, status")
      .eq("candidate_id", userId);

    interface ApplicationData { id: string; job_id: string; status: string; }
    interface JobData { id: string; title: string; }
    interface InterviewData { id: string; application_id: string; job_id: string; scheduled_at: string; location: string; contact_person?: string; contact_phone?: string; status: string; result?: string; evaluation?: string; }

    const appIds = (applications as ApplicationData[] || []).map((a) => a.id);

    if (appIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title")
      .in("id", (applications as ApplicationData[]).map((a) => a.job_id));
    const jobMap = new Map(
      (jobs as JobData[] || []).map((j) => [j.id, j.title])
    );

    const appStatusMap = new Map(
      (applications as ApplicationData[] || []).map((a) => [a.id, a.status])
    );

    const { data: interviews } = await supabase
      .from("interviews")
      .select("id, application_id, job_id, scheduled_at, location, contact_person, contact_phone, status, result, evaluation")
      .in("application_id", appIds)
      .order("scheduled_at", { ascending: true });

    const result = (interviews as InterviewData[] || []).map((int) => ({
      id: int.id,
      job_title: jobMap.get(int.job_id),
      scheduled_at: int.scheduled_at,
      location: int.location,
      contact_person: int.contact_person,
      contact_phone: int.contact_phone,
      status: int.status,
      result: int.result,
      evaluation: int.evaluation,
      application_status: appStatusMap.get(int.application_id),
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Candidate interviews fetch error:", error);
    return NextResponse.json(
      { success: false, error: String(error), data: [] },
      { status: 500 }
    );
  }
}