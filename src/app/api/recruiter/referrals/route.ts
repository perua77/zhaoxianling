import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: "待认领",
  reviewing: "待审核",
  "interview-scheduled": "待面试",
  interviewing: "面试中",
  "interview-passed": "面试通过",
  "interview-failed": "面试未通过",
  offering: "发放offer",
  hired: "已录用",
  accepted: "已录用",
  rejected: "已拒绝",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", userId)
    .single();

  if (!userProfile?.roles?.includes("referrer")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized access" },
      { status: 403 }
    );
  }

  try {
    const { data: referrals } = await supabase
      .from("referrals")
      .select("*, jobs(title)")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    const jobIds = new Set(
      (referrals || []).map((r: { job_id: string }) => r.job_id)
    );

    const applicationIds = (referrals || [])
      .map((r: { application_id: string }) => r.application_id)
      .filter((id: string) => id);

    let applications: Record<string, { status: string }> = {};
    if (applicationIds.length > 0) {
      const { data: apps } = await supabase
        .from("applications")
        .select("id, status")
        .in("id", applicationIds);

      applications = (apps || []).reduce((acc: Record<string, { status: string }>, app: { id: string; status: string }) => {
        acc[app.id] = { status: app.status };
        return acc;
      }, {});
    }

    const processedReferrals = (referrals || []).map((r: any) => {
      let status = r.status;
      if (r.application_id) {
        const app = applications[r.application_id];
        if (app) {
          if (app.status === "hired" || app.status === "accepted") {
            status = "hired";
          } else {
            status = "applied";
          }
        }
      }

      return {
        id: r.id,
        candidate_name: r.candidate_name,
        candidate_phone: r.candidate_phone,
        job_title: r.jobs?.title || "未知岗位",
        job_id: r.job_id,
        status,
        application_id: r.application_id,
        application_status: r.application_id ? APPLICATION_STATUS_LABELS[applications[r.application_id]?.status] : undefined,
        created_at: r.created_at,
      };
    });

    const stats = {
      total: processedReferrals.length,
      applied: processedReferrals.filter((r: { status: string }) => r.status === "applied").length,
      hired: processedReferrals.filter((r: { status: string }) => r.status === "hired").length,
    };

    return NextResponse.json({
      success: true,
      data: {
        referrals: processedReferrals,
        stats,
      },
    });
  } catch (error) {
    console.error("Referrals fetch error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}