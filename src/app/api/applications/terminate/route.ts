import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 终止招聘流程接口
 * POST /api/applications/terminate
 * body: {
 *   applicationId: string;
 *   operatorId: string;        // 操作人 profile.id
 *   operatorRole: "candidate" | "recruiter";
 *   reason?: string;           // 终止原因
 * }
 *
 * 行为：
 * - 更新 applications: status='terminated', terminated_at, terminated_by, terminate_reason
 * - 取消该投递下所有未完成的面试（interviews.status -> 'cancelled'）
 * - 通知规则：
 *     candidate 终止  -> 通知招聘者
 *     recruiter 终止  -> 不通知候选人
 *
 * 幂等：已 terminated / accepted / hired 视为终态，不允许再终止。
 */
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const { applicationId, operatorId, operatorRole, reason } = body as {
      applicationId?: string;
      operatorId?: string;
      operatorRole?: "candidate" | "recruiter";
      reason?: string;
    };

    if (!applicationId || !operatorId || !operatorRole) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少必要参数 applicationId/operatorId/operatorRole",
        },
        { status: 400 }
      );
    }
    if (operatorRole !== "candidate" && operatorRole !== "recruiter") {
      return NextResponse.json(
        { success: false, error: "operatorRole 必须为 candidate 或 recruiter" },
        { status: 400 }
      );
    }

    // 读取当前投递
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

    // 候选人端归属校验
    if (operatorRole === "candidate" && app.candidate_id !== operatorId) {
      return NextResponse.json(
        { success: false, error: "无权操作该投递记录" },
        { status: 403 }
      );
    }

    // 终态校验
    if (
      app.status === "terminated" ||
      app.status === "accepted" ||
      app.status === "hired"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            app.status === "terminated"
              ? "该流程已终止"
              : "当前状态不可终止（已完成录用/入职）",
          currentStatus: app.status,
        },
        { status: 409 }
      );
    }

    // 更新投递状态
    const { error: updateError } = await supabase
      .from("applications")
      .update({
        status: "terminated",
        terminated_at: new Date().toISOString(),
        terminated_by: operatorId,
        terminate_reason: reason || null,
      })
      .eq("id", applicationId)
      .neq("status", "terminated");

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // 取消关联的未完成面试
    await supabase
      .from("interviews")
      .update({ status: "cancelled" })
      .eq("application_id", applicationId)
      .not("status", "in", "(completed,cancelled)");

    // 通知：仅候选人端终止时通知招聘者
    if (operatorRole === "candidate") {
      const { data: job } = await supabase
        .from("jobs")
        .select("title, recruiter_id")
        .eq("id", app.job_id)
        .single();

      if (job?.recruiter_id) {
        await supabase.from("messages").insert({
          type: "result",
          recipient_id: job.recruiter_id,
          application_id: applicationId,
          title: "候选人终止了招聘流程",
          content: `候选人主动终止了「${job.title}」岗位的招聘流程${
            reason ? `，原因：${reason}` : "。"
          }`,
          is_read: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: "terminated",
      message: "已终止招聘流程",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}