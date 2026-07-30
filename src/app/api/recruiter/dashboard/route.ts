import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 空统计（用于错误兜底）
const EMPTY_STATS = {
  newApplications: 0,
  pendingEvaluations: 0,
  pendingTrialFeedback: 0,
  hired: 0,
  pendingOnboarding: 0,
  onboarded: 0,
  onboardedThisMonth: 0,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required", data: EMPTY_STATS },
      { status: 400 }
    );
  }

  try {
    // 1. 权限过滤：先取该招聘者名下 + 被分配的岗位 id
    const [{ data: myJobs }, { data: assignedJobs }] = await Promise.all([
      supabase.from("jobs").select("id").eq("recruiter_id", userId),
      supabase.from("job_assignments").select("job_id").eq("recruiter_id", userId),
    ]);

    const jobIdSet = new Set<string>();
    (myJobs as { id: string }[] | null)?.forEach((j) => jobIdSet.add(j.id));
    (assignedJobs as { job_id: string }[] | null)?.forEach((a) => jobIdSet.add(a.job_id));
    const allJobIds = Array.from(jobIdSet);

    // 没有任何负责的岗位，直接返回全 0，避免无过滤的全表扫描
    if (allJobIds.length === 0) {
      return NextResponse.json({ success: true, data: EMPTY_STATS });
    }

    // 2. 服务端计算"最近 7 天"起点：取 7 天前当天 00:00（UTC 无关，用绝对时间戳），
    //    含今天在内共 7 个自然日，避免用 now-7*24h 漏掉边界（如今天是周一漏上周日）
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 今天 + 前 6 天 = 7 天
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // 本月第一天 00:00，用于统计本月入职
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthStartISO = monthStart.toISOString();

    // 3. 用 count/head 查询，只取数量不拉全量数据，避免大数据量拖慢页面
    const [
      newApplicationsRes,
      pendingEvaluationsRes,
      pendingTrialFeedbackRes,
      hiredRes,
      pendingOnboardingRes,
      onboardedRes,
      onboardedThisMonthRes,
    ] = await Promise.all([
      // 新投递：最近 7 天内创建的投递
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("job_id", allJobIds)
        .gte("created_at", sevenDaysAgoISO),
      // 待评价面试：已完成但结果 pending，且排除 cancelled/no_show（status 已限定 completed 天然排除）
      supabase
        .from("interviews")
        .select("id", { count: "exact", head: true })
        .in("job_id", allJobIds)
        .eq("status", "completed")
        .eq("result", "pending"),
      // 待反馈试岗：试岗进行中
      supabase
        .from("trials")
        .select("id", { count: "exact", head: true })
        .in("job_id", allJobIds)
        .eq("status", "confirmed"),
      // 已入职：当前 status 为 hired/accepted（按当前状态统计，被 rejected 覆盖后不会计入）
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("job_id", allJobIds)
        .in("status", ["hired", "accepted"]),
      // 待入职：onboarding 表 pending_confirmation + confirmed
      supabase
        .from("onboarding")
        .select("id", { count: "exact", head: true })
        .in("job_id", allJobIds)
        .in("status", ["pending_confirmation", "confirmed"]),
      // 已入职：onboarding 表 onboarded（累计）
      supabase
        .from("onboarding")
        .select("id", { count: "exact", head: true })
        .in("job_id", allJobIds)
        .eq("status", "onboarded"),
      // 本月入职：本月更新为 onboarded 的记录
      supabase
        .from("onboarding")
        .select("id", { count: "exact", head: true })
        .in("job_id", allJobIds)
        .eq("status", "onboarded")
        .gte("updated_at", monthStartISO),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        newApplications: newApplicationsRes.count ?? 0,
        pendingEvaluations: pendingEvaluationsRes.count ?? 0,
        pendingTrialFeedback: pendingTrialFeedbackRes.count ?? 0,
        hired: hiredRes.count ?? 0,
        pendingOnboarding: pendingOnboardingRes.count ?? 0,
        onboarded: onboardedRes.count ?? 0,
        onboardedThisMonth: onboardedThisMonthRes.count ?? 0,
      },
    });
  } catch (error) {
    console.error("Dashboard stats fetch error:", error);
    return NextResponse.json(
      { success: false, error: String(error), data: EMPTY_STATS },
      { status: 500 }
    );
  }
}