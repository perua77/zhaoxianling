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
    const [
      { data: myJobs },
      { data: assignedJobs },
    ] = await Promise.all([
      supabase.from("jobs").select("*").eq("recruiter_id", userId),
      supabase.from("job_assignments").select("job_id").eq("recruiter_id", userId),
    ]);

    interface JobIdData { id: string; }
    interface JobAssignmentData { job_id: string; }
    interface JobRecord { id: string; created_at: string; }
    
    const myJobIdsArray = (myJobs as JobIdData[])?.map((j) => j.id) || [];
    const assignedJobIdsArray = (assignedJobs as JobAssignmentData[])?.map((a) => a.job_id) || [];
    const jobIdSet = new Set<string>();
    myJobIdsArray.forEach((id) => jobIdSet.add(id));
    assignedJobIdsArray.forEach((id) => jobIdSet.add(id));
    const allJobIds: string[] = [];
    jobIdSet.forEach((id) => allJobIds.push(id));

    if (allJobIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data: allJobsData } = await supabase
      .from("jobs")
      .select("*")
      .in("id", allJobIds);

    const jobsWithCount = await Promise.all(
      (allJobsData as (JobRecord & Record<string, unknown>)[] || []).map(async (job) => {
        const { count } = await supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("job_id", job.id);

        return {
          ...job,
          applicationCount: count || 0,
        };
      })
    );

    jobsWithCount.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ success: true, data: jobsWithCount });
  } catch (error) {
    console.error("Recruiter jobs fetch error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}