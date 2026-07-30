import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const role = searchParams.get("role") || "recruiter";

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    let interviews: unknown[] = [];

    // 修复1：全流程可见性——先收集用户参与的所有 application_id（多来源 UNION）：
    // ① 作为任一轮面试官参与的面试所属 application
    // ② 作为试岗面试官参与的试岗所属 application
    // ③ 作为岗位招聘者(recruiter_id) 或被分配招聘者(job_assignments) 所属岗位下的所有 application
    // 然后按这些 application_id 拉取「全部轮次」面试与试岗，确保任一参与人都能看到完整流程。
    const [
      { data: myInterviews },
      { data: myTrials },
      { data: myJobs },
      { data: assignedJobs },
    ] = await Promise.all([
      supabase.from("interviews").select("application_id").eq("interviewer_id", userId),
      supabase.from("trials").select("application_id").eq("interviewer_id", userId),
      supabase.from("jobs").select("id").eq("recruiter_id", userId),
      supabase.from("job_assignments").select("job_id").eq("recruiter_id", userId),
    ]);

    const participatedAppIds = new Set<string>();
    (myInterviews as { application_id: string }[] || []).forEach((i) => {
      if (i.application_id) participatedAppIds.add(i.application_id);
    });
    (myTrials as { application_id: string }[] || []).forEach((t) => {
      if (t.application_id) participatedAppIds.add(t.application_id);
    });

    const myJobIds = (myJobs as { id: string }[] || []).map((j) => j.id);
    const assignedJobIds =(assignedJobs as { job_id: string }[] || []).map((a) => a.job_id);
    const allJobIds = [...new Set([...myJobIds, ...assignedJobIds])];

    if (allJobIds.length > 0) {
      const { data: jobApps } = await supabase
        .from("applications")
        .select("id")
        .in("job_id", allJobIds);
      (jobApps as { id: string }[] || []).forEach((a) => {
        if (a.id) participatedAppIds.add(a.id);
      });
    }

    const participatedAppIdList = Array.from(participatedAppIds);

    if (participatedAppIdList.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 按参与的 application_id 拉取全部轮次面试（不再按 interviewer_id 过滤）
    const { data: allInterviews } = await supabase
      .from("interviews")
      .select("*")
      .in("application_id", participatedAppIdList);

    interviews = allInterviews || [];

    // 使用参与的全部 application_id（含只有试岗无面试的场景），保证流程完整
    const appIds = participatedAppIdList;
    const candidateIds = new Set<string>();

    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .in("id", appIds)
      .order("created_at", { ascending: false });

    const jobIds = (apps as { job_id: string }[] || []).map((a) => a.job_id);

    (apps as { candidate_id: string }[] || []).forEach((app) => candidateIds.add(app.candidate_id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone, gender, age")
      .in("id", Array.from(candidateIds));

    const profileMap = new Map(
      (profiles as { id: string; full_name: string; phone: string; gender: string; age: number }[] || []).map(
        (p) => [p.id, p]
      )
    );

    const { data: jobsData } = await supabase
      .from("jobs")
      .select("id, title")
      .in("id", [...new Set(jobIds)]);

    const jobMap = new Map(
      (jobsData as { id: string; title: string }[] || []).map((j) => [j.id, j.title])
    );

    const interviewMap = new Map<string, unknown[]>();
    (interviews as { application_id: string }[]).forEach((int) => {
      if (!interviewMap.has(int.application_id)) {
        interviewMap.set(int.application_id, []);
      }
      interviewMap.get(int.application_id)!.push(int);
    });

    // 每个投递内的面试按时间升序排列，保证前端 index+1 得到正确轮次序号
    interviewMap.forEach((list) => {
      (list as { scheduled_at?: string }[]).sort((a, b) =>
        String(a.scheduled_at || "").localeCompare(String(b.scheduled_at || ""))
      );
    });

    const { data: trials } = await supabase
      .from("trials")
      .select("*")
      .in("application_id", appIds);

    const trialMap = new Map<string, unknown[]>();
    (trials as { application_id: string }[] || []).forEach((trial) => {
      if (!trialMap.has(trial.application_id)) {
        trialMap.set(trial.application_id, []);
      }
      trialMap.get(trial.application_id)!.push(trial);
    });

    const result = (apps as ({ id: string; job_id: string; candidate_id: string; status: string; assigned_recruiter_id?: string; created_at: string } & Record<string, unknown>)[] || []).map((app) => {
      const profile = profileMap.get(app.candidate_id);
      return {
        ...app,
        job_title: jobMap.get(app.job_id),
        full_name: (app as Record<string, unknown>).full_name || profile?.full_name,
        phone: (app as Record<string, unknown>).phone || profile?.phone,
        gender: (app as Record<string, unknown>).gender || profile?.gender,
        age: (app as Record<string, unknown>).age ?? profile?.age,
        interviews: interviewMap.get(app.id) || [],
        trials: trialMap.get(app.id) || [],
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Interviews fetch error:", error);
    return NextResponse.json(
      { success: false, error: String(error), data: [] },
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

/**
 * fix6：收集某投递的全部协作人 user_id（去重，可排除指定人）。
 * 来源：① 该投递所有面试官(interviews.interviewer_id) ② 试岗面试官(trials.interviewer_id)
 *       ③ 岗位招聘者(jobs.recruiter_id) ④ 推荐人(applications.referrer_id)
 * 用途：录用/Offer 响应等关键节点向所有相关角色广播同步。
 */
async function getCollaborators(
  applicationId: string,
  jobId: string,
  excludeIds: (string | null | undefined)[] = []
): Promise<string[]> {
  const ids = new Set<string>();
  try {
    const [{ data: iv }, { data: tr }, { data: job }, { data: app }] = await Promise.all([
     supabase.from("interviews").select("interviewer_id").eq("application_id", applicationId),
      supabase.from("trials").select("interviewer_id").eq("application_id", applicationId),
      supabase.from("jobs").select("recruiter_id").eq("id", jobId).maybeSingle(),
      supabase.from("applications").select("referrer_id").eq("id", applicationId).maybeSingle(),
    ]);
    (iv as { interviewer_id: string | null }[] | null)?.forEach((r) => r.interviewer_id && ids.add(r.interviewer_id));
    (tr as { interviewer_id: string | null }[] | null)?.forEach((r) => r.interviewer_id && ids.add(r.interviewer_id));
    if ((job as { recruiter_id: string | null } | null)?.recruiter_id) ids.add((job as { recruiter_id: string }).recruiter_id);
    if ((app as { referrer_id: string | null } | null)?.referrer_id) ids.add((app as { referrer_id: string }).referrer_id);
  } catch (error) {
    console.error("Failed to collect collaborators:", error);
  }
  const excludeSet = new Set(excludeIds.filter(Boolean) as string[]);
  return [...ids].filter((id) => !excludeSet.has(id));
}

/** fix6：向多个协作人广播同一条消息（逐条插入，忽略单条失败）。 */
async function broadcastMessage(
  recipientIds: string[],
  type: string,
  title: string,
  content: string,
  applicationId?: string
) {
  for (const recipient_id of recipientIds) {
    try {
      await supabase.from("messages").insert({
        recipient_id,
        type,
        title,
        content,
        is_read: false,
        application_id: applicationId,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to broadcast message to", recipient_id, error);
    }
  }
}

/**
 * 校验 userId 是否有权对某岗位(jobId)发起后续操作。
 * 权限边界：岗位所属招聘者(recruiter_id)、被分配到该岗位的招聘者(job_assignments)、
 * 或该岗位下任一面试记录的面试官(interviewer_id) 均可操作后续流程（协同面试）。
 * 返回 { allowed, jobTitle, recruiterId }。
 */
async function checkJobPermission(userId: string, jobId: string) {
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, recruiter_id")
    .eq("id", jobId)
    .single();

  if (!job) return { allowed: false, jobTitle: null as string | null, recruiterId: null as string | null };

  if (job.recruiter_id === userId) {
    return { allowed: true, jobTitle: job.title as string, recruiterId: job.recruiter_id as string };
  }

  const { data: assignment } = await supabase
    .from("job_assignments")
    .select("job_id")
    .eq("job_id", jobId)
    .eq("recruiter_id", userId)
    .maybeSingle();

  if (assignment) {
    return { allowed: true, jobTitle: job.title as string, recruiterId: job.recruiter_id as string };
  }

  // 协同面试：该岗位任一面试的面试官也可推进后续流程
  const { data: interviewerRow } = await supabase
    .from("interviews")
    .select("id")
    .eq("job_id", jobId)
    .eq("interviewer_id", userId)
    .limit(1)
    .maybeSingle();

  if (interviewerRow) {
    return { allowed: true, jobTitle: job.title as string, recruiterId: job.recruiter_id as string };
  }

  return { allowed: false, jobTitle: job.title as string, recruiterId: job.recruiter_id as string };
}

/** 获取操作者姓名快照 + 北京时间字符串，用于操作记录消息 */
async function getActorSnapshot(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();
  const actorName = profile?.full_name || "某用户";
  const actedAt = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { actorName, actedAt };
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  const body = await request.json();

  try {
    switch (action) {
      case "schedule-interview": {
        const { applicationId, jobId, scheduled_at, location, interviewer_id, contact_person, contact_phone } = body;

        // 权限校验：仅岗位招聘者/被分配招聘者/该岗位面试官可安排面试
        const perm = await checkJobPermission(userId, jobId);
        if (!perm.allowed) {
          return NextResponse.json(
            { success: false, error: "无权对该岗位安排面试" },
            { status: 403 }
          );
        }

        // 幂等性检查：若该 application 已存在"进行中"的面试（scheduled 状态、尚未取消/未到场/完成），
        // 则阻止重复创建，避免重复提交导致出现多条面试记录。
        // 注意：已取消(cancelled)、未到场(no_show)、已完成(completed)的旧记录不算，
        // 因此取消后重新安排同一岗位面试不会被误拦截。
        const { data: existingInterviews, error: activeError } = await supabase
          .from("interviews")
          .select("id, status")
          .eq("application_id", applicationId);

        if (activeError) throw activeError;

        // 幂等：已有 scheduled 面试则拒绝重复创建
        const activeInterviews = (existingInterviews || []).filter(
          (i) => i.status === "scheduled"
        );
        if (activeInterviews.length > 0) {
          return NextResponse.json(
            { success: false, error: "该候选人已有进行中的面试安排，请勿重复创建" },
            { status: 409 }
          );
        }

        // 轮次识别：本次面试为第 N 轮（已有非取消的历史面试数 + 1）
        const priorRounds = (existingInterviews || []).filter(
          (i) => i.status !== "cancelled"
        ).length;
        const roundNo = priorRounds + 1;
        const roundLabel = roundNo === 1 ? "首轮面试" : `第${roundNo}轮面试`;

        const { data: app, error: appError } = await supabase
          .from("applications")
          .select("candidate_id")
          .eq("id", applicationId)
          .single();

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", jobId)
          .single();

        const { error: insertError } = await supabase.from("interviews").insert({
          application_id: applicationId,
          job_id: jobId,
          interviewer_id: interviewer_id || userId,
          scheduled_at,
          location,
          contact_person,
          contact_phone,
          status: "scheduled",
          response_status: "pending",
        });

        if (insertError) throw insertError;

        const { error: statusError } = await supabase
          .from("applications")
          .update({ status: "interview-scheduled" })
          .eq("id", applicationId);

        if (statusError) {
          console.error("Update application status error:", statusError);
        }

        if (app && job) {
          const dateStr = new Date(scheduled_at).toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          
          await sendMessage(
            app.candidate_id,
            "interview",
            "面试邀请",
            `你投递的「${job.title}」岗位已安排${roundLabel}。面试时间：${dateStr}，地点：${location || '未指定'}${contact_person ? '，联系人：' + contact_person : ''}${contact_phone ? '，联系电话：' + contact_phone : ''}`
          );

          // 修复3：安排面试时给对应面试官发消息，使面试官端“消息”Tab 能收到新面试任务通知。
          // recipient_id 必须是该轮面试官（interviewer_id），而非招聘者或候选人。
          const targetInterviewerId = interviewer_id || userId;
          if (targetInterviewerId) {
         const { data: candidateProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", app.candidate_id)
              .single();
            await sendMessage(
              targetInterviewerId,
              "interview",
              "新面试任务",
              `你有一场新的${roundLabel}任务。候选人：${candidateProfile?.full_name || "候选人"}，岗位：「${job.title}」，面试时间：${dateStr}，地点：${location || "未指定"}。请及时确认接受或拒绝。`
            );
          }

          // 操作记录：若操作者非岗位招聘者本人，通知招聘者"谁安排了第N轮面试"
          const actor = await getActorSnapshot(userId);
          if (perm.recruiterId && perm.recruiterId !== userId) {
            await sendMessage(
              perm.recruiterId,
              "interview",
             "面试安排通知",
              `${actor.actorName} 于 ${actor.actedAt} 为「${job.title}」岗位安排了${roundLabel}（面试时间：${dateStr}）。`
            );
          }
        }

        return NextResponse.json({ success: true, message: `${roundLabel}安排成功` });
      }

      case "submit-evaluation": {
        const { interviewId, evaluation, result } = body;

        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id, interviewer_id")
          .eq("id", interviewId)
          .single();

        if (getError) throw getError;

        if (interview.interviewer_id !== userId) {
          return NextResponse.json(
            { success: false, error: "只有该轮面试官可提交面评" },
            { status: 403 }
          );
        }

        const { data: app, error: appError } = await supabase
          .from("applications")
          .select("candidate_id, assigned_recruiter_id")
          .eq("id", interview.application_id)
          .single();

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title, recruiter_id")
          .eq("id", interview.job_id)
          .single();

        const interviewResult = result || "pending";
        const interviewStatus = interviewResult === "pass" || interviewResult === "fail" ? "completed" : "scheduled";

        const { error: updateError } = await supabase
          .from("interviews")
          .update({ 
            evaluation, 
            status: interviewStatus,
            result: interviewResult
          })
          .eq("id", interviewId);

        if (updateError) throw updateError;
        
        if (interviewResult === "pass" || interviewResult === "fail") {
          const newStatus = interviewResult === "pass" ? "interview-passed" : "interview-failed";
          const { error: appError } = await supabase
            .from("applications")
            .update({ status: newStatus })
            .eq("id", interview.application_id);

          if (appError) {
            console.error("Update application status after interview:", appError);
          }

          if (app && job) {
            const title = interviewResult === "pass" ? "面试通过" : "面试未通过";
            const content = interviewResult === "pass" 
              ? `恭喜！你在「${job.title}」岗位的面试中表现优秀，已通过面试。我们将尽快与你联系安排下一步流程。`
              : `很遗憾，你在「${job.title}」岗位的面试中未通过。感谢你的投递，祝你早日找到合适的工作！`;
            
            await sendMessage(app.candidate_id, "result", title, content);

            const { data: candidateProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", app.candidate_id)
              .single();

            const recruiterId = app.assigned_recruiter_id || job.recruiter_id;

            if (recruiterId && recruiterId !== userId && interview.interviewer_id === userId) {
              const recruiterTitle = interviewResult === "pass" ? "面试通过" : "面试未通过";
              const recruiterContent = interviewResult === "pass"
                ? `${candidateProfile?.full_name || '候选人'} 的面试（${job.title}）已通过，面评：${evaluation || '无'}`
                : `${candidateProfile?.full_name || '候选人'} 的面试（${job.title}）未通过，面评：${evaluation || '无'}`;
              
              await sendMessage(recruiterId, "result", recruiterTitle, recruiterContent);
            }
          }
        }
        
        return NextResponse.json({ success: true, message: "面评提交成功" });
      }

      case "schedule-trial": {
        const { applicationId, jobId, start_date, end_date, location } = body;

        // 权限校验：仅岗位招聘者/被分配者/关联面试官可操作
        const perm = await checkJobPermission(userId, jobId);
        if (!perm.allowed) {
          return NextResponse.json(
            { success: false, error: "无权对该岗位安排试岗" },
            { status: 403 }
          );
        }

      // 校验开始日期不得早于今天（按北京时间自然日比较）
        // start_date 为 "YYYY-MM-DD" 或 ISO 字符串，统一取北京时区日期部分比较
        const todayBeijing = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
        const startBeijing = start_date
          ? new Date(start_date).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
          : "";
        if (!start_date || startBeijing < todayBeijing) {
          return NextResponse.json(
            { success: false, error: "试岗开始日期不能早于今天，请选择今天或将来的日期" },
            { status: 400 }
          );
        }
        // 校验结束日期不得早于开始日期
        if (end_date) {
          const endBeijing = new Date(end_date).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
          if (endBeijing < startBeijing) {
            return NextResponse.json(
              { success: false, error: "试岗结束日期不能早于开始日期" },
              { status: 400 }
            );
          }
        }

        const { data: app, error: appError } = await supabase
          .from("applications")
          .select("candidate_id")
          .eq("id", applicationId)
          .single();

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", jobId)
          .single();

        // 字段完整性防御：location 必填，避免 NOT NULL 约束导致的 500
        if (!location || !String(location).trim()) {
          return NextResponse.json(
            { success: false, error: "试岗地点不能为空" },
            { status: 400 }
          );
        }

        const trialPayload = {
          application_id: applicationId,
          job_id: jobId,
          interviewer_id: userId,
          start_date,
          // 空字符串统一转 null，避免 date 类型解析失败
          end_date: end_date && String(end_date).trim() ? end_date : null,
          location,
          status: "confirmed",
        };

        const { error } = await supabase.from("trials").insert(trialPayload);

        // 明文透传数据库错误，便于定位真正的 500 根因（列缺失/约束冲突等）
        if (error) {
          console.error("schedule-trial insert error:", error, "payload:", trialPayload);
          return NextResponse.json(
            {
              success: false,
              error: `安排试岗失败：${error.message}`,
              details: error.details || error.hint || null,
            },
            { status: 500 }
          );
        }

        if (app && job) {
          const startDateStr = new Date(start_date).toLocaleDateString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          });
          const endDateStr = end_date ? new Date(end_date).toLocaleDateString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          }) : '';
          
          await sendMessage(
            app.candidate_id,
            "trial",
            "试岗安排",
            `你在「${job.title}」岗位的试岗已安排。开始时间：${startDateStr}${endDateStr ? '，结束时间：' + endDateStr : ''}，地点：${location || '未指定'}`
          );

          // 操作记录：若操作者非岗位招聘者本人，通知招聘者
          const actor = await getActorSnapshot(userId);
          if (perm.recruiterId && perm.recruiterId !== userId) {
            await sendMessage(
              perm.recruiterId,
              "trial",
              "试岗安排通知",
              `${actor.actorName} 于 ${actor.actedAt} 为「${job.title}」岗位安排了试岗（开始时间：${startDateStr}）。`
            );
          }
        }

        return NextResponse.json({ success: true, message: "试岗安排成功" });
      }

      case "submit-trial-feedback": {
        const { trialId, feedback, result } = body;
        
        const { data: trial, error: getError } = await supabase
          .from("trials")
          .select("application_id, job_id")
          .eq("id", trialId)
          .single();

        if (getError) throw getError;

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

        const resultLabel = result === "pass" ? "试岗通过" : result === "fail" ? "试岗未通过" : "";
        const feedbackToStore = resultLabel ? `[${resultLabel}] ${feedback}` : feedback;

        const { error } = await supabase
          .from("trials")
          .update({ feedback: feedbackToStore, status: "completed" })
          .eq("id", trialId);

        if (error) throw error;

        if (app && job) {
          await sendMessage(
            app.candidate_id,
            "trial",
            "试岗反馈",
            `你在「${job.title}」岗位的试岗已完成${resultLabel ? `（${resultLabel}）` : ""}，请留意后续通知。`
          );
        }

        return NextResponse.json({ success: true, message: "反馈提交成功" });
      }

      case "accept-interview": {
        const { interviewId } = body;
        
        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("*, interviewer_id, response_status, application_id, job_id, scheduled_at")
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
            { success: false, error: "Unauthorized to accept interview" },
            { status: 403 }
          );
        }

        if (interview.response_status !== "pending") {
          return NextResponse.json(
            { success: false, error: "Interview already responded" },
            { status: 400 }
          );
        }

        const { error } = await supabase
          .from("interviews")
          .update({ response_status: "accepted" })
          .eq("id", interviewId);

        if (error) throw error;

        const { data: app } = await supabase
          .from("applications")
          .select("candidate_id, assigned_recruiter_id")
          .eq("id", interview.application_id)
          .single();

        const { data: job } = await supabase
          .from("jobs")
          .select("title, recruiter_id")
          .eq("id", interview.job_id)
          .single();

        const { data: interviewerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", interview.interviewer_id)
          .single();

        const { data: candidateProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", app?.candidate_id)
          .single();

        const recruiterId = app?.assigned_recruiter_id || job?.recruiter_id;

        if (recruiterId && recruiterId !== userId) {
          const dateStr = new Date(interview.scheduled_at).toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          await sendMessage(
            recruiterId,
            "interview",
            "面试邀请已接受",
            `面试官 ${interviewerProfile?.full_name || '未知'} 已接受面试安排：${job?.title || '未知岗位'} - ${candidateProfile?.full_name || '候选人'}，面试时间：${dateStr}`
          );
        }

        return NextResponse.json({ success: true, message: "已接受面试安排" });
      }

      case "reschedule-interview": {
        const { interviewId, scheduled_at, location, interviewer_id, contact_person, contact_phone } = body;
        
        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id")
          .eq("id", interviewId)
          .single();

        if (getError) throw getError;

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
          .update({
            scheduled_at,
            location,
            interviewer_id: interviewer_id || userId,
            contact_person,
            contact_phone,
            // 修复2：重新安排一场被取消/被拒绝的面试时，必须把面试状态整体重置为
            // “待面试/待响应”，否则 status 仍为 cancelled，会导致面试官端仍显示“已取消”、
            // 候选人端日历也显示“已取消”，且无接受/拒绝/反馈结果按钮。
            status: "scheduled",
            response_status: "pending",
            response_reason: null,
            result: null,
            evaluation: null,
          })
          .eq("id", interviewId);

        if (error) throw error;

        // 计算该面试在此投递中的轮次（按非取消面试的时间顺序）
        let roundLabel = "面试";
        {
          const { data: sameAppInterviews } = await supabase
            .from("interviews")
            .select("id, status, scheduled_at")
            .eq("application_id", interview.application_id)
            .neq("status", "cancelled")
            .order("scheduled_at", { ascending: true });
          const idx = (sameAppInterviews || []).findIndex((i) => i.id === interviewId);
          if (idx >= 0) {
            const roundNo = idx + 1;
            roundLabel = roundNo === 1 ? "首轮面试" : `第${roundNo}轮面试`;
          }
        }

        if (app && job) {
          const dateStr = new Date(scheduled_at).toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
            month: "2-digit",
            day: "2-digit",
            hour:"2-digit",
            minute: "2-digit",
            hour12: false,
          });
          
          await sendMessage(
            app.candidate_id,
            "interview",
            "面试安排已更新",
            `你投递的「${job.title}」岗位${roundLabel}安排已更新。面试时间：${dateStr}，地点：${location || '未指定'}${contact_person ? '，联系人：' + contact_person : ''}${contact_phone ? '，联系电话：' + contact_phone : ''}`
          );

          // 修复3：重新安排后给对应面试官发消息，使面试官端“消息”Tab 能收到面试任务通知。
          const targetInterviewerId = interviewer_id || userId;
          if (targetInterviewerId) {
            const { data: candidateProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", app.candidate_id)
              .single();
            await sendMessage(
              targetInterviewerId,
              "interview",
              "面试任务已更新",
              `你负责的「${job.title}」岗位${roundLabel}（候选人：${candidateProfile?.full_name || "候选人"}）时间已更新为 ${dateStr}，地点：${location || "未指定"}。请及时确认。`
            );
          }
        }

        return NextResponse.json({ success: true, message: "面试重新安排成功" });
      }

      case "reject-interview": {
        const { interviewId, reason, candidateName } = body;
        
        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id, interviewer_id")
          .eq("id", interviewId)
          .single();

        if (getError) throw getError;

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("recruiter_id, title")
          .eq("id", interview.job_id)
          .single();

        const { data: interviewer, error: interviewerError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", interview.interviewer_id)
          .single();

        const { error } = await supabase
          .from("interviews")
          .update({
            response_status: "rejected",
            response_reason: reason,
            // 修复1&2：同步将面试标记为 cancelled，使招聘者可重新安排（canScheduleInterview 依赖此状态）
            status: "cancelled",
          })
          .eq("id", interviewId);

        if (error) throw error;

        // 修复B：面试被拒绝后，本轮面试记录已置为 cancelled（招聘者可重新安排）。
        // 将 application 显式置为 interview-scheduled（面试流程中、待重新安排），
        // 保证招聘者卡片标签显示"待面试"、候选人进度条停留"面试"节点，而非退回"审核"。
        if (interview.application_id) {
          await supabase
            .from("applications")
            .update({ status: "interview-scheduled" })
            .eq("id", interview.application_id)
            .in("status", ["interview-scheduled", "interviewing", "reviewing"]);
        }

        if (job && interviewer) {
          const reasonText = reason && reason.trim() ? reason : "未提供拒绝理由";
          await sendMessage(
            job.recruiter_id,
            "interview",
            "面试官拒绝了面试安排",
            `面试官 ${interviewer.full_name} 拒绝了 ${candidateName} 的面试安排。理由：${reasonText}。请重新安排面试时间。`
          );
          // 修复1：同步通知候选人本轮面试已取消，待重新安排
          const { data: appRow } = await supabase
            .from("applications")
            .select("candidate_id")
            .eq("id", interview.application_id)
            .single();
          if (appRow?.candidate_id) {
            await sendMessage(
              appRow.candidate_id,
              "interview",
              "面试安排已取消",
             `你投递的「${job.title}」岗位本轮面试已取消，招聘方将重新安排面试时间，请留意通知。`
            );
          }
        }

        return NextResponse.json({ success: true, message: "已拒绝面试安排" });
      }

      case "hire": {
        const { applicationId, jobId } = body;

        // 权限校验：仅岗位招聘者/被分配者/关联面试官可操作
        const perm = await checkJobPermission(userId, jobId);
        if (!perm.allowed) {
          return NextResponse.json(
            { success: false, error: "无权对该岗位执行录用操作" },
            { status: 403 }
          );
        }

        const {
          onboard_date,
          onboard_location,
          contact_person,
          contact_phone,
          onboard_notes,
        } = body;

        if (!onboard_date || !onboard_location || !contact_person || !contact_phone) {
          return NextResponse.json(
            { success: false, error: "入职日期/地点/联系人/电话为必填" },
            { status: 400 }
          );
        }

        const { data: app, error: appError } = await supabase
          .from("applications")
          .select("candidate_id")
          .eq("id", applicationId)
          .single();

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", jobId)
          .single();

        // 问3：防止重复创建有效入职记录
        const { data: existingOnboarding } = await supabase
          .from("onboarding")
          .select("id")
          .eq("application_id", applicationId)
          .in("status", ["pending_confirmation", "confirmed", "onboarded"])
          .maybeSingle();
        if (existingOnboarding) {
          return NextResponse.json(
            { success: false, error: "该候选人已有进行中的入职记录，请勿重复录用" },
            { status: 409 }
          );
        }

        // 冲突检查：该候选人是否在其他岗位仍有进行中的流程
        // 进行中定义：非终态（排除 rejected / hired / accepted / interview-failed）
        let conflictWarning: string | null = null;
        if (app?.candidate_id) {
          const IN_PROGRESS_STATUSES = [
            "pending",
            "reviewing",
            "interview-scheduled",
            "interviewing",
            "interview-passed",
            "offering",
          ];
          const { data: otherApps } = await supabase
            .from("applications")
            .select("id, job_id, status")
            .eq("candidate_id", app.candidate_id)
            .neq("id", applicationId)
            .in("status", IN_PROGRESS_STATUSES);

          if (otherApps && otherApps.length > 0) {
            const otherJobIds = [...new Set(otherApps.map((a: { job_id: string }) => a.job_id))];
            const { data: otherJobs } = await supabase
              .from("jobs")
              .select("id, title")
              .in("id", otherJobIds);
            const titleMap = new Map(
              (otherJobs as { id: string; title: string }[] || []).map((j) => [j.id, j.title])
            );
            const jobTitles = otherApps
              .map((a: { job_id: string }) => titleMap.get(a.job_id) || "未知岗位")
              .join("、");
            conflictWarning = `该候选人在其他岗位（${jobTitles}）仍有进行中的招聘流程，录用后建议同步处理这些流程。`;
          }
        }

        const { data: existingTrials } = await supabase
          .from("trials")
          .select("id")
          .eq("application_id", applicationId);

        // 确认录用阶段试岗尚未标记入职，仅确保存在试岗记录用于流程追溯
        if (!existingTrials || existingTrials.length === 0) {
          await supabase.from("trials").insert({
            application_id: applicationId,
            job_id: jobId,
            interviewer_id: userId,
            status: "confirmed",
          });
        }

        // 确认录用 → application 进入 offering（等待候选人在 Offer 中确认入职）
        await supabase
          .from("applications")
          .update({ status: "offering" })
          .eq("id", applicationId);

        // 插入 onboarding 记录（录用操作人作为 recruiter_id）
        if (app) {
          await supabase.from("onboarding").insert({
            application_id: applicationId,
            job_id: jobId,
            candidate_id: app.candidate_id,
            recruiter_id: perm.recruiterId || userId,
            onboard_date,
            onboard_location,
            contact_person,
            contact_phone,
            onboard_notes: onboard_notes || "",
            status: "pending_confirmation",
          });
        }

        if (app && job) {
          await sendMessage(
            app.candidate_id,
            "result",
            "录用通知",
            `恭喜！你已被「${job.title}」岗位录用！入职日期：${new Date(onboard_date).toLocaleDateString("zh-CN")}，地点：${onboard_location}，联系人：${contact_person}（${contact_phone}）。请在「我的 Offer」中确认接受并办理入职。`
          );

          // 操作记录：若操作者非岗位招聘者本人，通知招聘者
          const actor = await getActorSnapshot(userId);
          if (perm.recruiterId && perm.recruiterId !== userId) {
            await sendMessage(
              perm.recruiterId,
              "result",
              "录用操作通知",
              `${actor.actorName} 于 ${actor.actedAt} 确认录用了「${job.title}」岗位的候选人，已创建入职记录并等待候选人确认（入职日期：${new Date(onboard_date).toLocaleDateString("zh-CN")}）。${conflictWarning || ""}`
            );
          }

          // fix6A：向全体协作人（所有面试官 + 推荐人 + 招聘者）广播录用确认，
          // 排除候选人与操作者本人（招聘者已在上方单独通知，此处会去重排除）。
          const collaborators = await getCollaborators(applicationId, jobId, [
            app.candidate_id,
            userId,
            perm.recruiterId,
          ]);
          await broadcastMessage(
            collaborators,
            "result",
            "候选人已确认录用",
            `「${job.title}」岗位的候选人已被确认录用，入职日期：${new Date(onboard_date).toLocaleDateString("zh-CN")}，等待候选人确认入职。`,
            applicationId
          );
        }

        return NextResponse.json({ success: true, message: "已确认录用，等待候选人确认入职！", warning: conflictWarning });
      }

      case "offer": {
        const { applicationId } = body;
        
        const { data: app, error: appError } = await supabase
          .from("applications")
          .select("candidate_id, job_id")
          .eq("id", applicationId)
          .single();

        const { data: job, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", app?.job_id)
          .single();

        const { error } = await supabase
          .from("applications")
          .update({ status: "offering" })
          .eq("id", applicationId);

        if (error) throw error;

        if (app && job) {
          await sendMessage(
            app.candidate_id,
            "result",
            "Offer通知",
            `恭喜！「${job.title}」岗位已向你发送Offer，请查收。`
          );
        }

        return NextResponse.json({ success: true, message: "已进入Offer流程" });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Interviews action error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}