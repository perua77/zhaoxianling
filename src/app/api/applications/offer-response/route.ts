import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 候选人对 Offer 的响应接口
 * POST /api/applications/offer-response
 * body: { applicationId, candidateId, action: "accept" | "reject" | "confirm-onboard" | "abandon", reason? }
 *
 * 状态归属约定（方案B：复用现有枚举，不引入新值）：
 * - accept          -> application.status = "accepted"（已接受 Offer，等待入职）
 * - reject          -> application.status = "rejected"（拒绝 Offer，终态）
 * - confirm-onboard -> application.status = "hired"，onboarding.status = "onboarded"（候选人确认已入职）
 * - abandon         -> application.status = "terminated"，onboarding.status = "cancelled"（放弃入职）
 *
 * 幂等/防误触：
 * - accept/reject 仅当 status === "offering" 时允许
 * - confirm-onboard/abandon 仅当 status === "offering" 或 "accepted" 时允许
 */
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const { applicationId, candidateId, action, reason } = body as {
      applicationId?: string;
      candidateId?: string;
      action?: "accept" | "reject" | "confirm-onboard" | "abandon";
      reason?: string;
    };

    if (!applicationId || !candidateId || !action) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数 applicationId/candidateId/action" },
        { status: 400 }
      );
    }
    const VALID_ACTIONS = ["accept", "reject", "confirm-onboard", "abandon"];
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: "action 必须为 accept/reject/confirm-onboard/abandon" },
        { status: 400 }
      );
    }

    // 读取当前投递，校验归属与状态
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, candidate_id, job_id, status")
      .eq("id", applicationId)
      .single();

    if (appError || !app) {
      return NextResponse.json(
        { success: false, error: "投递记录不存在" },
        { status: 404 }
      );
    }

    // 归属校验：只能操作自己的投递
    if (app.candidate_id !== candidateId) {
      return NextResponse.json(
        { success: false, error: "无权操作该投递记录" },
        { status: 403 }
      );
    }

    // 幂等/状态校验
    // - accept/reject 仅当 offering
    // - confirm-onboard/abandon 允许 offering 或 accepted
    const isResponseAction = action === "accept" || action === "reject";
    const isOnboardAction = action === "confirm-onboard" || action === "abandon";

    if (isResponseAction && app.status !== "offering") {
      return NextResponse.json(
        {
          success: false,
          error:
            app.status === "accepted"
              ? "你已接受该 Offer"
              : "该 Offer 当前不可操作（可能已被撤回或已处理）",
          currentStatus: app.status,
        },
        { status: 409 }
      );
    }

    if (isOnboardAction && app.status !== "offering" && app.status !== "accepted") {
      return NextResponse.json(
        {
          success: false,
          error: "当前状态无法办理入职或放弃入职（可能已入职或流程已终止）",
          currentStatus: app.status,
        },
        { status: 409 }
      );
    }

    if (action === "abandon" && !reason) {
      return NextResponse.json(
        { success: false, error: "放弃入职必须填写原因" },
        { status: 400 }
      );
    }

    // 目标 application 状态映射
    const statusMap: Record<string, string> = {
      accept: "accepted",
      reject: "rejected",
      "confirm-onboard": "hired",
      abandon: "terminated",
    };
    const newStatus = statusMap[action];

    // 更新 application（带并发保险，仅从当前合法态更新）
    let appUpdateQuery = supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId);

    if (isResponseAction) {
      appUpdateQuery = appUpdateQuery.eq("status", "offering");
    } else {
      appUpdateQuery = appUpdateQuery.in("status", ["offering", "accepted"]);
    }

    const { error: updateError } = await appUpdateQuery;

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // 入职类操作：同步 onboarding 记录
    if (isOnboardAction) {
      const onboardingStatus =
        action === "confirm-onboard" ? "onboarded" : "cancelled";

      const { data: onboarding } = await supabase
        .from("onboarding")
        .select("id")
        .eq("application_id", applicationId)
        .maybeSingle();

      if (onboarding?.id) {
        const { error: obError } = await supabase
          .from("onboarding")
          .update({ status: onboardingStatus })
          .eq("id", onboarding.id);

        if (obError) {
          return NextResponse.json(
            { success: false, error: obError.message },
            { status: 500 }
          );
        }
      }
    }

    // 通知招聘者
    const { data: job } = await supabase
      .from("jobs")
      .select("title, recruiter_id")
      .eq("id", app.job_id)
      .single();

    if (job?.recruiter_id) {
      const notifyMap: Record<string, { title: string; content: string }> = {
        accept: {
          title: "候选人已接受Offer",
          content: `候选人已接受「${job.title}」岗位的 Offer。`,
        },
        reject: {
          title: "候选人已拒绝Offer",
          content: `候选人已拒绝「${job.title}」岗位的 Offer${reason ? `，原因：${reason}` : "。"}`,
        },
        "confirm-onboard": {
          title: "候选人已确认入职",
          content: `候选人已确认入职「${job.title}」岗位。`,
        },
        abandon: {
          title: "候选人已放弃入职",
          content: `候选人放弃入职「${job.title}」岗位${reason ? `，原因：${reason}` : "。"}`,
        },
      };
      const { title, content } = notifyMap[action];

      await supabase.from("messages").insert({
        type: "result",
        recipient_id: job.recruiter_id,
        application_id: applicationId,
        title,
        content,
        is_read: false,
      });
    }

    // fix6B：候选人操作 Offer 后，向全体协作人（所有面试官 + 推荐人 + 招聘者）广播同步。
    // 排除候选人本人；招聘者已在上方单独通知，此处去重排除避免重复。
    try {
      const jobTitle = job?.title || "该";
      const broadcastMap: Record<string, { title: string; content: string }> = {
        accept: {
          title: "候选人已接受Offer",
          content: `「${jobTitle}」岗位的候选人已接受 Offer，等待办理入职。`,
        },
        reject: {
          title: "候选人已拒绝Offer",
          content: `「${jobTitle}」岗位的候选人已拒绝 Offer${reason ? `，原因：${reason}` : "。"}`,
        },
        "confirm-onboard": {
          title: "候选人已确认入职",
          content: `「${jobTitle}」岗位的候选人已确认入职。`,
        },
        abandon: {
          title: "候选人已放弃入职",
          content: `「${jobTitle}」岗位的候选人放弃入职${reason ? `，原因：${reason}` : "。"}`,
        },
      };
      const { title: bTitle, content: bContent } = broadcastMap[action];

      const [{ data: ivRows }, { data: trRows }, { data: appRow }] = await Promise.all([
        supabase.from("interviews").select("interviewer_id").eq("application_id", applicationId),
        supabase.from("trials").select("interviewer_id").eq("application_id", applicationId),
        supabase.from("applications").select("referrer_id").eq("id", applicationId).maybeSingle(),
      ]);

      const recipientSet = new Set<string>();
      (ivRows as { interviewer_id: string | null }[] | null)?.forEach((r) => r.interviewer_id && recipientSet.add(r.interviewer_id));
      (trRows as { interviewer_id: string | null }[] | null)?.forEach((r) => r.interviewer_id && recipientSet.add(r.interviewer_id));
      if ((appRow as { referrer_id: string | null } | null)?.referrer_id) recipientSet.add((appRow as { referrer_id: string }).referrer_id);
      // 排除候选人本人与已单独通知的招聘者
      recipientSet.delete(candidateId);
      if (job?.recruiter_id) recipientSet.delete(job.recruiter_id);

      for (const recipient_id of recipientSet) {
        await supabase.from("messages").insert({
          type: "result",
          recipient_id,
        application_id: applicationId,
          title: bTitle,
          content: bContent,
          is_read: false,
        });
      }
    } catch (broadcastErr) {
      console.error("Failed to broadcast offer-response to collaborators:", broadcastErr);
    }

    const messageMap: Record<string, string> = {
      accept: "已接受 Offer",
      reject: "已拒绝 Offer",
      "confirm-onboard": "已确认入职",
      abandon: "已放弃入职",
    };

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: messageMap[action],
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}