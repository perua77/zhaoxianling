import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendMessage(recipient_id: string, type: string, title: string, content: string) {
  try {
    await supabase.from("messages").insert({
      recipient_id,
      type,
      title,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to send onboarding message:", error);
  }
}

/** 校验 userId 是否对某入职记录(job_id) 有招聘者权限（岗位负责人或被分配者或关联面试官） */
async function checkOnboardingPermission(userId: string, jobId: string, applicationId: string) {
  const { data: job } = await supabase
    .from("jobs")
    .select("recruiter_id")
    .eq("id", jobId)
    .single();
  if (job?.recruiter_id === userId) return true;

  const { data: assignment } = await supabase
    .from("job_assignments")
    .select("job_id")
    .eq("job_id", jobId)
    .eq("recruiter_id", userId)
    .maybeSingle();
  if (assignment) return true;

  const { data: interviewer } = await supabase
    .from("interviews")
    .select("id")
    .eq("application_id", applicationId)
    .eq("interviewer_id", userId)
    .limit(1)
    .maybeSingle();
  return !!interviewer;
}

const dateStr = (d?: string) =>
  d ? new Date(d).toLocaleDateString("zh-CN") : "待定";

/**
 * GET：查询入职记录
 * - role=candidate：candidateId 查自己的全部入职记录（含历史）
 * - role=recruiter：userId 查负责岗位的入职记录（recruiter_id OR job_assignments）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "candidate";
  const candidateId = searchParams.get("candidateId");
  const userId = searchParams.get("userId");

  try {
    if (role === "candidate") {
      if (!candidateId) {
        return NextResponse.json({ success: false, error: "candidateId is required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("onboarding")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const jobIds = [...new Set((data || []).map((o) => o.job_id))];
      const { data: jobs } = jobIds.length
        ? await supabase.from("jobs").select("id, title, location").in("id", jobIds)
        : { data: [] };
      const jobMap = new Map((jobs as { id: string; title: string; location: string }[] || []).map((j) => [j.id, j]));

      const result = (data || []).map((o) => ({ ...o, jobs: jobMap.get(o.job_id) || null }));
      return NextResponse.json({ success: true, data: result });
    }

    // recruiter
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }
    const [{ data: myJobs }, { data: assignedJobs }] = await Promise.all([
      supabase.from("jobs").select("id").eq("recruiter_id", userId),
      supabase.from("job_assignments").select("job_id").eq("recruiter_id", userId),
    ]);
    const jobIdSet = new Set<string>();
    (myJobs as { id: string }[] | null)?.forEach((j) => jobIdSet.add(j.id));
    (assignedJobs as { job_id: string }[] | null)?.forEach((a) => jobIdSet.add(a.job_id));
    const allJobIds = Array.from(jobIdSet);
    if (allJobIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from("onboarding")
      .select("*")
      .in("job_id", allJobIds)
      .order("onboard_date", { ascending: true });
    if (error) throw error;

    const jobIds = [...new Set((data || []).map((o) => o.job_id))];
    const candidateIds = [...new Set((data || []).map((o) => o.candidate_id))];
    const [{ data: jobs }, { data: profiles }, { data: apps }] = await Promise.all([
      jobIds.length
        ? supabase.from("jobs").select("id, title, location").in("id", jobIds)
        : Promise.resolve({ data: [] }),
      candidateIds.length
        ? supabase.from("profiles").select("id, full_name, phone").in("id", candidateIds)
        : Promise.resolve({ data: [] }),
      candidateIds.length && jobIds.length
        ? supabase
            .from("applications")
            .select("candidate_id, job_id, full_name, phone")
            .in("candidate_id", candidateIds)
            .in("job_id", jobIds)
        : Promise.resolve({ data: [] }),
    ]);
    const jobMap = new Map((jobs as { id: string; title: string; location: string }[] || []).map((j) => [j.id, j]));
    const profileMap = new Map((profiles as { id: string; full_name: string; phone: string }[] || []).map((p) => [p.id, p]));
    // 投递矫正信息优先：以 candidate_id_job_id 为 key
    const appMap = new Map(
      (apps as { candidate_id: string; job_id: string; full_name: string | null; phone: string | null }[] || []).map(
        (a) => [`${a.candidate_id}_${a.job_id}`, a]
      )
    );

    const result = (data || []).map((o) => {
      const profile = profileMap.get(o.candidate_id) || null;
      const app = appMap.get(`${o.candidate_id}_${o.job_id}`);
      return {
        ...o,
        jobs: jobMap.get(o.job_id) || null,
        // 优先展示招聘者矫正后的投递信息，回退到账号资料
        candidate: profile || app
       ? {
              id: o.candidate_id,
              full_name: app?.full_name || profile?.full_name || null,
              phone: app?.phone || profile?.phone || null,
            }
          : null,
      };
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Onboarding GET error:", error);
    return NextResponse.json({ success: false, error: String(error), data: [] }, { status: 500 });
  }
}

/**
 * PATCH：更新入职记录
 * action:
 *  - confirm：候选人确认入职（pending_confirmation → confirmed），仅本人
 *  - update：招聘者修改入职信息（若已 confirmed，重置回 pending_confirmation 并通知候选人）
 *  - mark-onboarded：招聘者标记已入职（→ onboarded）
 *  - cancel：招聘者取消入职（→ cancelled，需原因；application.status 回退 interview-passed）
 */
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const body = await request.json();
  const { onboardingId } = body;

  if (!onboardingId) {
    return NextResponse.json({ success: false, error: "onboardingId is required" }, { status: 400 });
  }

  try {
    const { data: record, error: recErr } = await supabase
      .from("onboarding")
      .select("*")
      .eq("id", onboardingId)
      .single();
    if (recErr || !record) {
      return NextResponse.json({ success: false, error: "入职记录不存在" }, { status: 404 });
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("title")
      .eq("id", record.job_id)
      .single();
    const jobTitle = job?.title || "该岗位";

    switch (action) {
      case "confirm": {
        // 候选人确认，仅本人
        if (userId !== record.candidate_id) {
          return NextResponse.json({ success: false, error: "无权确认该入职" }, { status: 403 });
        }
        if (record.status !== "pending_confirmation") {
          return NextResponse.json({ success: false, error: "当前状态无法确认" }, { status: 409 });
        }
        const { error } = await supabase
          .from("onboarding")
          .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
          .eq("id", onboardingId)
          .eq("status", "pending_confirmation");
        if (error) throw error;

        // 通知招聘者
        await sendMessage(
          record.recruiter_id,
          "result",
          "候选人已确认入职",
          `候选人已确认「${jobTitle}」岗位的入职安排（入职日期：${dateStr(record.onboard_date)}）。`
        );
        return NextResponse.json({ success: true, message: "已确认入职", status: "confirmed" });
      }

      case "update": {
        if (!userId || !(await checkOnboardingPermission(userId, record.job_id, record.application_id))) {
          return NextResponse.json({ success: false, error: "无权修改该入职信息" }, { status: 403 });
        }
        if (record.status === "cancelled" || record.status === "onboarded") {
          return NextResponse.json({ success: false, error: "已入职或已取消的记录不可修改" }, { status: 409 });
        }
        const { onboard_date, onboard_location, contact_person, contact_phone, onboard_notes } = body;
        if (!onboard_date || !onboard_location || !contact_person || !contact_phone) {
          return NextResponse.json({ success: false, error: "入职日期/地点/联系人/电话为必填" }, { status: 400 });
        }
        // 问2：若已确认，改动关键信息后重置回待确认并通知候选人
        const wasConfirmed = record.status === "confirmed";
        const updatePayload: Record<string, unknown> = {
          onboard_date,
          onboard_location,
          contact_person,
          contact_phone,
          onboard_notes: onboard_notes || "",
        };
        if (wasConfirmed) {
          updatePayload.status = "pending_confirmation";
          updatePayload.confirmed_at = null;
        }
        const { error } = await supabase.from("onboarding").update(updatePayload).eq("id", onboardingId);
        if (error) throw error;

        await sendMessage(
          record.candidate_id,
          "result",
          "入职信息已更新",
          `「${jobTitle}」岗位的入职信息已更新，入职日期：${dateStr(onboard_date)}，地点：${onboard_location}。${wasConfirmed ? "请重新确认。" : ""}`
        );
        return NextResponse.json({
          success: true,
          message: wasConfirmed ? "已更新，需候选人重新确认" : "入职信息已更新",
          status: updatePayload.status || record.status,
        });
      }

      case "mark-onboarded": {
        if (!userId || !(await checkOnboardingPermission(userId, record.job_id, record.application_id))) {
          return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 });
        }
        if (record.status === "cancelled") {
          return NextResponse.json({ success: false, error: "已取消的记录不可标记入职" }, { status: 409 });
        }
        const { error } = await supabase
          .from("onboarding")
          .update({ status: "onboarded" })
          .eq("id", onboardingId);
        if (error) throw error;

        await sendMessage(
          record.candidate_id,
          "result",
          "入职完成",
          `欢迎加入！你在「${jobTitle}」岗位的入职已完成，祝工作顺利！`
        );
        return NextResponse.json({ success: true, message: "已标记为已入职", status: "onboarded" });
      }

      case "cancel": {
        if (!userId || !(await checkOnboardingPermission(userId, record.job_id, record.application_id))) {
          return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 });
        }
        if (record.status === "cancelled") {
          return NextResponse.json({ success: false, error: "该记录已取消" }, { status: 409 });
        }
        const { reason } = body;
        if (!reason || !reason.trim()) {
          return NextResponse.json({ success: false, error: "取消入职需填写原因" }, { status: 400 });
        }
        const { error } = await supabase
          .from("onboarding")
          .update({ status: "cancelled" })
          .eq("id", onboardingId);
        if (error) throw error;

        // 问5：application 回退到 interview-passed，允许后续重新推进
        await supabase
          .from("applications")
          .update({ status: "interview-passed" })
          .eq("id", record.application_id);

        await sendMessage(
          record.candidate_id,
          "result",
          "入职已取消",
          `很抱歉，你在「${jobTitle}」岗位的入职已被取消。原因：${reason}`
        );
        return NextResponse.json({ success: true, message: "已取消入职", status: "cancelled" });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Onboarding PATCH error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}