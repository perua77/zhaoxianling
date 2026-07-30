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
    interface InterviewData { id: string; application_id: string; job_id: string; scheduled_at: string; location: string; contact_person?: string; contact_phone?: string; status: string; result?: string; created_at?: string; }

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
      .select("id, application_id, job_id, scheduled_at, location, contact_person, contact_phone, status, result, created_at")
   .in("application_id", appIds)
      .order("created_at", { ascending: true });

    // 计算每条面试在其投递中的轮次（按创建先后顺序编号，不受 scheduled_at 时区差异影响）
    // 取消的面试不占轮次，沿用当前计数，与招聘者端保持一致
    const interviewIdToRound = new Map<string, number>();
    const appRunningCount = new Map<string, number>();
    (interviews as InterviewData[] || []).forEach((int) => {
      let next = appRunningCount.get(int.application_id) || 0;
      if (int.status !== "cancelled") {
        next += 1;
        appRunningCount.set(int.application_id, next);
      }
      interviewIdToRound.set(int.id, next === 0 ? 1 : next);
    });

    const result = (interviews as InterviewData[] || []).map((int) => ({
      id: int.id,
      job_title: jobMap.get(int.job_id),
      scheduled_at: int.scheduled_at,
      location: int.location,
  contact_person: int.contact_person,
      contact_phone: int.contact_phone,
      status: int.status,
      result: int.result,
      round: interviewIdToRound.get(int.id) || 1,
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