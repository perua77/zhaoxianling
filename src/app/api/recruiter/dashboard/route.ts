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
      { data: upcomingInterviews },
    ] = await Promise.all([
      supabase.from("jobs").select("id, is_active").eq("recruiter_id", userId),
      supabase.from("job_assignments").select("job_id").eq("recruiter_id", userId),
      supabase
        .from("interviews")
        .select("id")
        .eq("interviewer_id", userId)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString()),
    ]);

    interface JobData { id: string; is_active: boolean; }
    interface JobAssignmentData { job_id: string; }
    interface InterviewData { id: string; }
    interface ApplicationData { status: string; }
    
    const myJobIdsArray = (myJobs as JobData[])?.map((j) => j.id) || [];
    const assignedJobIdsArray = (assignedJobs as JobAssignmentData[])?.map((a) => a.job_id) || [];
    const jobIdSet = new Set<string>();
    myJobIdsArray.forEach((id) => jobIdSet.add(id));
    assignedJobIdsArray.forEach((id) => jobIdSet.add(id));
    const allJobIds: string[] = [];
    jobIdSet.forEach((id) => allJobIds.push(id));

    const activeJobs = (myJobs as JobData[])?.filter((j) => j.is_active).length || 0;
    const totalJobs = myJobIdsArray.length;

    let totalApplications = 0;
    let pendingApplications = 0;

    if (allJobIds.length > 0) {
      const { data: apps } = await supabase
        .from("applications")
        .select("status")
        .in("job_id", allJobIds);

      totalApplications = (apps as ApplicationData[])?.length || 0;
      pendingApplications = (apps as ApplicationData[])?.filter((a) => a.status === "pending").length || 0;
    }

    const upcomingInterviewsCount = (upcomingInterviews as InterviewData[])?.length || 0;

    return NextResponse.json({
      success: true,
      data: {
        activeJobs,
        totalJobs,
        totalApplications,
        pendingApplications,
        upcomingInterviews: upcomingInterviewsCount,
      },
    });
  } catch (error) {
    console.error("Dashboard stats fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        data: {
          activeJobs: 0,
          totalJobs: 0,
          totalApplications: 0,
          pendingApplications: 0,
          upcomingInterviews: 0,
        },
      },
      { status: 500 }
    );
  }
}