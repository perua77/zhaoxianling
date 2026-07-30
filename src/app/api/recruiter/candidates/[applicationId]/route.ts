import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request, { params }: { params: { applicationId: string } }) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const { applicationId } = params;

  if (!userId || !applicationId) {
    return NextResponse.json(
      { success: false, error: "userId and applicationId are required" },
      { status: 400 }
    );
  }

  try {
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("roles")
      .eq("id", userId)
      .single();

    const isRecruiter = userProfile?.roles?.includes("recruiter");
    const isInterviewer = userProfile?.roles?.includes("interviewer");

    if (!isRecruiter && !isInterviewer) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access" },
        { status: 403 }
      );
    }

    if (isInterviewer && !isRecruiter) {
      const { data: interviews } = await supabase
        .from("interviews")
        .select("id")
        .eq("application_id", applicationId)
        .eq("interviewer_id", userId);

      const { data: trials } = await supabase
        .from("trials")
        .select("id")
        .eq("application_id", applicationId)
        .eq("interviewer_id", userId);

      if (!interviews?.length && !trials?.length) {
        return NextResponse.json(
          { success: false, error: "Unauthorized access" },
          { status: 403 }
        );
      }
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("profiles")
      .select("full_name, gender, age, phone, email, bio")
      .eq("id", application.candidate_id)
      .single();

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title")
      .eq("id", application.job_id)
      .single();

    // 按创建先后顺序取面试，确保轮次编号与候选人端一致（不受 scheduled_at 时区/改期影响）
    const { data: interviews, error: interviewsError } = await supabase
      .from("interviews")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });

    const interviewerIds = new Set(
      (interviews || []).map((i: { interviewer_id: string }) => i.interviewer_id)
    );

    const { data: interviewers, error: interviewersError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(interviewerIds));

    // 轮次编号：按创建先后为非取消面试逐个编号；取消的面试沿用当前计数（不占轮次）
    let roundCounter = 0;
    const processedInterviews = (interviews || []).map((int: any) => {
      if (int.status !== "cancelled") {
        roundCounter += 1;
      }
      return {
        ...int,
        round: roundCounter === 0 ? 1 : roundCounter,
      };
    });

    const { data: trials, error: trialsError } = await supabase
      .from("trials")
      .select("*")
      .eq("application_id", applicationId);

    // 查询矫正操作人姓名(用于"已核实"标识)
    let verifierName: string | null = null;
    if (application.verified_by) {
      const { data: verifier } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", application.verified_by)
        .single();
      verifierName = verifier?.full_name || null;
    }

    return NextResponse.json({
      success: true,
      data: {
        application,
        candidate: candidate || {},
        job: job || {},
        interviews: processedInterviews,
        trials: trials || [],
        interviewers: interviewers || [],
        verifierName,
      },
    });
  } catch (error) {
    console.error("Candidate detail fetch error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

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
    console.error("Failed to send message:", error);
  }
}

export async function POST(request: Request, { params }: { params: { applicationId: string } }) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const { applicationId } = params;

  if (!userId || !applicationId) {
    return NextResponse.json(
      { success: false, error: "userId and applicationId are required" },
      { status: 400 }
    );
  }

  const body = await request.json();

  try {
    switch (action) {
      case "submit-evaluation": {
        const { interviewId, evaluation } = body;

        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id, interviewer_id")
          .eq("id", interviewId)
          .single();

        if (getError) throw getError;
        if (!interview) {
          return NextResponse.json(
            { success: false, error: "Interview not found" },
            { status: 404 }
          );
        }

        if (interview.interviewer_id !== userId) {
          return NextResponse.json(
            { success: false, error: "Unauthorized to submit evaluation" },
            { status: 403 }
          );
        }

        const { error } = await supabase
          .from("interviews")
          .update({ evaluation })
          .eq("id", interviewId);

        if (error) throw error;

        return NextResponse.json({ success: true, message: "面评提交成功" });
      }

      case "mark-interview-result": {
        const { interviewId, result } = body;

        if (!["pass", "fail"].includes(result)) {
          return NextResponse.json(
            { success: false, error: "Invalid result value" },
            { status: 400 }
          );
        }

        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id, interviewer_id")
          .eq("id", interviewId)
          .single();

        if (getError) throw getError;
        if (!interview) {
          return NextResponse.json(
            { success: false, error: "Interview not found" },
            { status: 404 }
          );
        }

        if (interview.interviewer_id !== userId) {
          return NextResponse.json(
            { success: false, error: "Unauthorized to mark result" },
            { status: 403 }
          );
        }

        const { data: app, error: appError } = await supabase
          .from("applications")
          .select("candidate_id")
          .eq("id", interview.application_id)
          .single();

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", interview.job_id)
          .single();

        const { error } = await supabase
          .from("interviews")
          .update({ result, status: "completed" })
          .eq("id", interviewId);

        if (error) throw error;

        if (result === "pass" || result === "fail") {
          const newStatus = result === "pass" ? "interview-passed" : "interview-failed";
          await supabase
            .from("applications")
            .update({ status: newStatus })
            .eq("id", interview.application_id);

          if (app && job) {
            const title = result === "pass" ? "面试通过" : "面试未通过";
            const content =
              result === "pass"
                ? `恭喜！你在「${job.title}」岗位的面试中表现优秀，已通过面试。我们将尽快与你联系安排下一步流程。`
                : `很遗憾，你在「${job.title}」岗位的面试中未通过。感谢你的投递，祝你早日找到合适的工作！`;

            await sendMessage(app.candidate_id, "result", title, content);
          }
        }

        return NextResponse.json({ success: true, message: "面试结果已更新" });
      }

      // fix1：重新安排——被面试官拒绝/已取消的面试，重置原记录为待响应，重新走安排流程。
      case "reschedule-interview": {
        const { interviewId, scheduled_at, location, contact_person, contact_phone } = body;

        if (!interviewId) {
          return NextResponse.json(
            { success: false, error: "interviewId is required" },
            { status: 400 }
          );
        }

        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id, interviewer_id")
          .eq("id", interviewId)
          .single();

        if (getError) throw getError;
        if (!interview) {
          return NextResponse.json(
            { success: false, error: "Interview not found" },
            { status: 404 }
          );
        }

        const updatePayload: Record<string, unknown> = {
          status: "scheduled",
          response_status: "pending",
          response_reason: null,
          result: null,
        };
        if (scheduled_at) updatePayload.scheduled_at = scheduled_at;
        if (location) updatePayload.location = location;
        if (contact_person !== undefined) updatePayload.contact_person = contact_person;
    if (contact_phone !== undefined) updatePayload.contact_phone = contact_phone;

        const { error } = await supabase
          .from("interviews")
          .update(updatePayload)
          .eq("id", interviewId);

        if (error) throw error;

        await supabase
          .from("applications")
          .update({ status: "interview-scheduled" })
          .eq("id", interview.application_id);

        const { data: app } = await supabase
          .from("applications")
          .select("candidate_id")
          .eq("id", interview.application_id)
          .single();
        const { data: job } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", interview.job_id)
          .single();

        if (app && job) {
          await sendMessage(
            app.candidate_id,
            "interview",
            "面试已重新安排",
            `你在「${job.title}」岗位的面试已重新安排，请留意最新的面试时间与地点。`
          );
          if (interview.interviewer_id) {
            await sendMessage(
              interview.interviewer_id,
              "interview",
              "面试重新安排",
              `「${job.title}」岗位的一场面试已被重新安排，请在「我的任务」中查看并响应。`
            );
          }
        }

        return NextResponse.json({ success: true, message: "面试已重新安排" });
      }

      // fix1：安排下一轮面试——在上一轮基础上新建一条面试记录（轮次由后端按创建顺序自动累加）。
      case "schedule-next-round": {
        const { scheduled_at, location, contact_person, contact_phone, interviewer_id } = body;

        if (!scheduled_at || !location || !String(location).trim()) {
          return NextResponse.json(
            { success: false, error: "面试时间与地点不能为空" },
            { status: 400 }
          );
        }

        const { data: application, error: appError } = await supabase
          .from("applications")
          .select("candidate_id, job_id")
          .eq("id", applicationId)
          .single();

        if (appError) throw appError;

        const { error } = await supabase.from("interviews").insert({
          application_id: applicationId,
          job_id: application.job_id,
          interviewer_id: interviewer_id || userId,
          scheduled_at,
          location,
          contact_person: contact_person || null,
          contact_phone: contact_phone || null,
          status: "scheduled",
          response_status: "pending",
        });

        if (error) {
          console.error("schedule-next-round insert error:", error);
          return NextResponse.json(
            { success: false, error: `安排下一轮面试失败：${error.message}` },
            { status: 500 }
          );
        }

        await supabase
          .from("applications")
          .update({ status: "interview-scheduled" })
          .eq("id", applicationId);

        const { data: job } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", application.job_id)
          .single();

        if (application && job) {
          await sendMessage(
            application.candidate_id,
            "interview",
            "下一轮面试已安排",
            `你在「${job.title}」岗位的下一轮面试已安排，请留意面试时间与地点。`
          );
        }

        return NextResponse.json({ success: true, message: "下一轮面试已安排" });
      }

      case "schedule-trial": {
        const { start_date, end_date, location } = body;

        const { data: application, error: appError } = await supabase
          .from("applications")
          .select("candidate_id, job_id")
          .eq("id", applicationId)
          .single();

        if (appError) throw appError;

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", application.job_id)
          .single();

        if (!location || !String(location).trim()) {
          return NextResponse.json(
            { success: false, error: "试岗地点不能为空" },
            { status: 400 }
          );
        }

        const { error } = await supabase.from("trials").insert({
          application_id: applicationId,
          job_id: application.job_id,
          interviewer_id: userId,
          start_date,
          end_date: end_date && String(end_date).trim() ? end_date : null,
          location,
          status: "confirmed",
        });

        if (error) {
          console.error("schedule-trial insert error:", error);
          return NextResponse.json(
            { success: false, error: `安排试岗失败：${error.message}`, details: error.details || error.hint || null },
            { status: 500 }
          );
        }

        await supabase
          .from("applications")
          .update({ status: "interview-passed" })
          .eq("id", applicationId);

        if (application && job) {
          await sendMessage(
            application.candidate_id,
            "trial",
            "试岗安排",
            `你在「${job.title}」岗位的试岗已安排。开始时间：${start_date}${
              end_date ? "，结束时间：" + end_date : ""
            }，地点：${location}`
          );
        }

        return NextResponse.json({ success: true, message: "试岗安排成功" });
      }

      case "submit-trial-feedback": {
        const { trialId, feedback } = body;

        if (!feedback?.trim()) {
          return NextResponse.json(
            { success: false, error: "Feedback is required" },
            { status: 400 }
          );
        }

        const { data: trial, error: getError } = await supabase
          .from("trials")
          .select("application_id, job_id, interviewer_id")
          .eq("id", trialId)
          .single();

        if (getError) throw getError;
        if (!trial) {
          return NextResponse.json(
            { success: false, error: "Trial not found" },
            { status: 404 }
          );
        }

        if (trial.interviewer_id !== userId) {
          return NextResponse.json(
            { success: false, error: "Unauthorized to submit feedback" },
            { status: 403 }
          );
        }

        const { data: app, error: appError } = await supabase
          .from("applications")
          .select("candidate_id")
          .eq("id", trial.application_id)
          .single();

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", trial.job_id)
          .single();

        const { error } = await supabase
          .from("trials")
          .update({ feedback, status: "completed" })
          .eq("id", trialId);

        if (error) throw error;

        if (app && job) {
          await sendMessage(
            app.candidate_id,
            "trial",
            "试岗反馈",
            `你在「${job.title}」岗位的试岗已完成，请留意后续通知。`
          );
        }

        return NextResponse.json({ success: true, message: "反馈提交成功" });
      }

      case "hire": {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("roles")
          .eq("id", userId)
          .single();

        if (!userProfile?.roles?.includes("recruiter")) {
          return NextResponse.json(
            { success: false, error: "Unauthorized to hire" },
            { status: 403 }
          );
        }

        const { data: application, error: appError } = await supabase
          .from("applications")
          .select("candidate_id, job_id")
          .eq("id", applicationId)
          .single();

        if (appError || !application) {
          return NextResponse.json(
            { success: false, error: "Application not found" },
            { status: 404 }
          );
        }

        // 入职信息必填校验
        const {
          onboard_date,
          onboard_location,
          contact_person,
          contact_phone,
          onboard_notes,
        } = body;
        if (!onboard_date || !onboard_location || !contact_person || !contact_phone) {
          return NextResponse.json(
            { success: false, error: "请填写完整的入职信息(日期/地点/联系人/电话)" },
            { status: 400 }
          );
        }

        // 重复录用防护:已存在有效 onboarding 记录则拒绝
        const { data: existingOnboarding } = await supabase
          .from("onboarding")
          .select("id")
          .eq("application_id", applicationId)
          .in("status", ["pending_confirmation", "confirmed", "onboarded"]);

        if (existingOnboarding && existingOnboarding.length > 0) {
          return NextResponse.json(
            { success: false, error: "该候选人已有进行中的入职记录,请勿重复录用" },
            { status: 409 }
          );
        }

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", application.job_id)
          .single();

        const { data: existingTrials } = await supabase
          .from("trials")
          .select("id")
          .eq("application_id", applicationId);

        if (existingTrials && existingTrials.length > 0) {
          const { error: trialError } = await supabase
            .from("trials")
            .update({ is_hired: true, status: "completed" })
            .eq("application_id", applicationId);

          if (trialError) throw trialError;
        } else {
          const { error: trialError } = await supabase.from("trials").insert({
            application_id: applicationId,
            job_id: application.job_id,
            interviewer_id: userId,
            status: "completed",
            is_hired: true,
          });

          if (trialError) throw trialError;
        }

        const { error: appError2 } = await supabase
          .from("applications")
          .update({ status: "offering" })
          .eq("id", applicationId);

        if (appError2) throw appError2;

        // 插入入职记录(待候选人确认)
        const { error: onboardingError } = await supabase
          .from("onboarding")
          .insert({
            application_id: applicationId,
            job_id: application.job_id,
            candidate_id: application.candidate_id,
            recruiter_id: userId,
            onboard_date,
            onboard_location,
            contact_person,
            contact_phone,
            onboard_notes: onboard_notes || "",
            status: "pending_confirmation",
          });

        if (onboardingError) throw onboardingError;

        if (application && job) {
          await sendMessage(
            application.candidate_id,
            "result",
            "录用通知",
            `恭喜！你已被「${job.title}」岗位录用。入职日期:${onboard_date},入职地点:${onboard_location},联系人:${contact_person}(${contact_phone})。请前往「我的入职」确认入职信息。`
          );
        }

        return NextResponse.json({ success: true, message: "录用成功,已发送入职通知" });
      }

      case "update-application-info": {
        // 仅 recruiter 可矫正投递信息
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("roles")
          .eq("id", userId)
          .single();
        if (!actorProfile?.roles?.includes("recruiter")) {
          return NextResponse.json(
            { success: false, error: "无权限矫正投递信息" },
            { status: 403 }
          );
        }

        const {
          full_name,
          phone,
          age,
          gender,
          self_introduction,
          wechat,
        } = body as {
          full_name?: string;
          phone?: string;
          age?: number | string | null;
          gender?: string;
          self_introduction?: string;
          wechat?: string;
        };

        const updatePayload: Record<string, unknown> = {
          verified_by: userId,
          verified_at: new Date().toISOString(),
        };
        if (full_name !== undefined) updatePayload.full_name = full_name;
        if (phone !== undefined) updatePayload.phone = phone;
        if (gender !== undefined) updatePayload.gender = gender;
        if (self_introduction !== undefined)
          updatePayload.self_introduction = self_introduction;
        if (wechat !== undefined) updatePayload.wechat = wechat;
        if (age !== undefined) {
          updatePayload.age =
            age === "" || age === null ? null : Number(age);
        }

        const { error: updateError } = await supabase
          .from("applications")
          .update(updatePayload)
          .eq("id", applicationId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, message: "信息已更新" });
      }

      case "terminate": {
        // 仅 recruiter 可终止流程
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("roles")
          .eq("id", userId)
          .single();
        if (!actorProfile?.roles?.includes("recruiter")) {
          return NextResponse.json(
            { success: false, error: "无权限终止流程" },
            { status: 403 }
          );
        }

        const { reason } = body as { reason?: string };

        const { data: application, error: appError } = await supabase
          .from("applications")
          .select("status")
          .eq("id", applicationId)
          .single();

        if (appError || !application) {
          return NextResponse.json(
            { success: false, error: "Application not found" },
            { status: 404 }
          );
        }

        // 终态保护：已终止/已接受/已录用不可再终止
        if (["terminated", "accepted", "hired"].includes(application.status)) {
          return NextResponse.json(
            { success: false, error: "当前状态无法终止流程" },
            { status: 409 }
          );
        }

        const { error: updateError } = await supabase
          .from("applications")
          .update({
            status: "terminated",
            terminated_at: new Date().toISOString(),
            terminated_by: userId,
            terminate_reason: reason || null,
          })
          .eq("id", applicationId);

        if (updateError) throw updateError;

        // 取消关联的未完成面试
        await supabase
          .from("interviews")
          .update({ status: "cancelled" })
          .eq("application_id", applicationId)
          .not("status", "in", "(completed,cancelled)");

        // 管理端终止不通知候选人（按需求）
        return NextResponse.json({ success: true, message: "已终止招聘流程" });
      }

      case "confirm-onboard": {
        // 仅 recruiter 可确认入职
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("roles")
          .eq("id", userId)
          .single();
        if (!actorProfile?.roles?.includes("recruiter")) {
          return NextResponse.json(
            { success: false, error: "无权限确认入职" },
            { status: 403 }
          );
        }

        const { data: onboarding, error: onbError } = await supabase
          .from("onboarding")
          .select("id, candidate_id, job_id, status")
          .eq("application_id", applicationId)
          .in("status", ["pending_confirmation", "confirmed"])
          .maybeSingle();

        if (onbError) throw onbError;
        if (!onboarding) {
          return NextResponse.json(
            { success: false, error: "未找到待确认的入职记录" },
            { status: 404 }
          );
        }

        const { error: updateOnbError } = await supabase
          .from("onboarding")
          .update({ status: "onboarded" })
          .eq("id", onboarding.id);

        if (updateOnbError) throw updateOnbError;

        // 同步 applications 状态为 hired（保持已入职）
        await supabase
          .from("applications")
          .update({ status: "hired" })
          .eq("id", applicationId);

        const { data: job } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", onboarding.job_id)
          .single();

        await sendMessage(
          onboarding.candidate_id,
          "result",
          "入职确认",
          `你在「${job?.title || "该职位"}」岗位的入职已确认，欢迎加入！`
        );

        return NextResponse.json({ success: true, message: "已确认入职" });
      }

      case "cancel-onboard": {
        // 仅 recruiter 可取消入职
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("roles")
          .eq("id", userId)
          .single();
        if (!actorProfile?.roles?.includes("recruiter")) {
          return NextResponse.json(
            { success: false, error: "无权限取消入职" },
            { status: 403 }
          );
        }

        const { data: onboarding, error: onbError } = await supabase
          .from("onboarding")
          .select("id, candidate_id, job_id, status")
          .eq("application_id", applicationId)
          .in("status", ["pending_confirmation", "confirmed", "onboarded"])
          .maybeSingle();

        if (onbError) throw onbError;
        if (!onboarding) {
          return NextResponse.json(
            { success: false, error: "未找到有效的入职记录" },
            { status: 404 }
          );
        }

        const { error: updateOnbError } = await supabase
          .from("onboarding")
          .update({ status: "cancelled" })
          .eq("id", onboarding.id);

        if (updateOnbError) throw updateOnbError;

        // applications 回退到 accepted（已接受 Offer，待重新安排入职）
        await supabase
          .from("applications")
          .update({ status: "accepted" })
          .eq("id", applicationId);

        const { data: job } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", onboarding.job_id)
          .single();

        await sendMessage(
          onboarding.candidate_id,
          "result",
          "入职取消",
          `你在「${job?.title || "该职位"}」岗位的入职安排已被取消，请联系招聘方了解详情。`
        );

        return NextResponse.json({ success: true, message: "已取消入职" });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Candidate action error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}