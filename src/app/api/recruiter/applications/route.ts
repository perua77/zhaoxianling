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
    console.error("Failed to send message:", error);
  }
}

/**
 * fix6：收集某投递的全部协作人 user_id（去重，可排除指定人）。
 * 来源：① 面试官(interviews.interviewer_id) ② 试岗面试官(trials.interviewer_id)
 *       ③ 岗位招聘者(jobs.recruiter_id) ④ 推荐人(applications.referrer_id)
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
  content: string
) {
  for (const recipient_id of recipientIds) {
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
      console.error("Failed to broadcast message to", recipient_id, error);
    }
  }
}

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
      supabase.from("jobs").select("id").eq("recruiter_id", userId),
      supabase.from("job_assignments").select("job_id").eq("recruiter_id", userId),
    ]);

    interface JobIdData { id: string; }
    interface JobAssignmentData { job_id: string; }
    const myJobIds = (myJobs as JobIdData[])?.map((j) => j.id) || [];
    const assignedJobIds = (assignedJobs as JobAssignmentData[])?.map((a) => a.job_id) || [];
    const jobIdSet = new Set<string>();
    myJobIds.forEach((id) => jobIdSet.add(id));
    assignedJobIds.forEach((id) => jobIdSet.add(id));
    const allJobIds: string[] = [];
    jobIdSet.forEach((id) => allJobIds.push(id));

    if (allJobIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data: jobsData } = await supabase
      .from("jobs")
      .select("id, title")
      .in("id", allJobIds);

    interface JobData { id: string; title: string; }
    const jobMap = new Map(
      (jobsData as JobData[] || []).map((j) => [j.id, j.title])
    );

    interface ApplicationData { id: string; job_id: string; candidate_id: string; }
    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .in("job_id", allJobIds)
      .or(`assigned_recruiter_id.is.null,assigned_recruiter_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    const candidateIdSet = new Set<string>();
    (apps as ApplicationData[] || []).forEach(a => candidateIdSet.add(a.candidate_id));
    const candidateIds: string[] = [];
    candidateIdSet.forEach(id => candidateIds.push(id));
    
    interface ProfileData { id: string; gender: string; full_name: string; phone: string; age: number; }
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, gender, full_name, phone, age")
      .in("id", candidateIds);
    
    const profileMap = new Map((profiles as ProfileData[] || []).map(p => [p.id, p]));

    const { data: interviews } = await supabase
      .from("interviews")
      .select("id, application_id, interviewer_id, scheduled_at, location, contact_person, contact_phone, status, result, response_status, response_reason, evaluation")
      .in("application_id", (apps as { id: string }[] || []).map(a => a.id))
      .order("scheduled_at", { ascending: true });
    
    const interviewMap = new Map<string, unknown[]>();
    (interviews as { application_id: string }[] || []).forEach(int => {
      if (!interviewMap.has(int.application_id)) {
        interviewMap.set(int.application_id, []);
      }
      interviewMap.get(int.application_id)!.push(int);
    });

    // 修复3：查询试岗记录，招聘端卡片展示试岗信息
    // 注意：trials 表无 scheduled_at 列，排序须用 start_date，否则 PostgREST 报错导致 trials 全部丢失
    const { data: trials } = await supabase
      .from("trials")
      .select("id, application_id, start_date, end_date, location, status, feedback, is_hired")
      .in("application_id", (apps as { id: string }[] || []).map(a => a.id))
      .order("start_date", { ascending: true });

    const trialMap = new Map<string, unknown[]>();
    (trials as { application_id: string }[] || []).forEach(trial => {
      if (!trialMap.has(trial.application_id)) {
        trialMap.set(trial.application_id, []);
      }
      trialMap.get(trial.application_id)!.push(trial);
    });

    const applicationsWithJob = (apps as (ApplicationData & Record<string, unknown>)[] || []).map((app) => {
      const profile = profileMap.get(app.candidate_id);
      return {
        ...app,
        job_title: jobMap.get(app.job_id),
        gender: profile?.gender,
        full_name: profile?.full_name,
        phone: profile?.phone,
        age: profile?.age,
        interviews: interviewMap.get(app.id) || [],
        trials: trialMap.get(app.id) || [],
      };
    });

    return NextResponse.json({ success: true, data: applicationsWithJob });
  } catch (error) {
    console.error("Recruiter applications fetch error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
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
      case "claim": {
        const { applicationId } = body;

        const { data: existingApp, error: checkError } = await supabase
          .from("applications")
          .select("assigned_recruiter_id")
          .eq("id", applicationId)
          .single();

        if (checkError) throw checkError;

        if (!existingApp || existingApp.assigned_recruiter_id !== null) {
          return NextResponse.json({
            success: false,
            message: "认领失败：该投递已被其他人认领",
          });
        }

        const { error: updateError } = await supabase
          .from("applications")
          .update({ assigned_recruiter_id: userId, status: "reviewing" })
          .eq("id", applicationId);

        if (updateError) throw updateError;

        return NextResponse.json({
          success: true,
          message: "认领成功，开始处理投递",
        });
      }

      case "update-status": {
        const { applicationId, status } = body;
        
        const allowedStatuses = ['pending', 'reviewing', 'interview-scheduled', 'interviewing', 'interview-passed', 'interview-failed', 'offering', 'hired', 'accepted', 'rejected'];
        
        if (!allowedStatuses.includes(status)) {
          return NextResponse.json({ 
            success: false, 
            error: `Invalid status: ${status}. Allowed: ${allowedStatuses.join(', ')}`,
          }, { status: 400 });
        }
        
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
          .update({ status })
          .eq("id", applicationId);

        if (error) {
          console.error("Update status error:", error);
          return NextResponse.json({ 
            success: false, 
            error: error.message,
          }, { status: 400 });
        }

        // 问1：若录用被回退（离开 hired），联动取消进行中的入职记录
        if (status !== "hired") {
          await supabase
            .from("onboarding")
            .update({ status: "cancelled" })
            .eq("application_id", applicationId)
            .in("status", ["pending_confirmation", "confirmed"]);
        }

        if (app && job) {
          const statusMessages: Record<string, { title: string; content: string }> = {
            'reviewing': { title: '审核中', content: `你投递的「${job.title}」岗位正在审核中，请耐心等待。` },
            'interview-scheduled': { title: '面试安排', content: `你投递的「${job.title}」岗位已安排面试，请关注面试通知。` },
            'interview-passed': { title: '面试通过', content: `恭喜！你在「${job.title}」岗位的面试中表现优秀，已通过面试。` },
            'interview-failed': { title: '面试未通过', content: `很遗憾，你在「${job.title}」岗位的面试中未通过。感谢你的投递。` },
            'offering': { title: 'Offer通知', content: `恭喜！「${job.title}」岗位已向你发送Offer，请查收。` },
            'hired': { title: '录用通知', content: `恭喜！你已被「${job.title}」岗位录用！` },
            'rejected': { title: '投递未通过', content: `很遗憾，你投递的「${job.title}」岗位未通过筛选。感谢你的投递。` },
          };

          const message = statusMessages[status];
          if (message) {
            await sendMessage(app.candidate_id, "result", message.title, message.content);
          }
        }

        return NextResponse.json({ success: true, message: "状态更新成功", status });
      }

      case "schedule-interview": {
        const { applicationId, jobId, scheduled_at, location, interviewer_id, contact_person, contact_phone } = body;

        // 幂等 + 轮次识别：同一投递已有 scheduled 面试则拒绝重复创建；
        // 轮次 = 非取消历史面试数 + 1，"安排下一轮"复用此逻辑自动递增。
        const { data: existingInterviews } = await supabase
          .from("interviews")
          .select("id, status")
          .eq("application_id", applicationId);

        const activeInterviews = (existingInterviews || []).filter(
          (i) => i.status === "scheduled"
        );
        if (activeInterviews.length > 0) {
          return NextResponse.json(
            { success: false, error: "该候选人已有进行中的面试安排，请勿重复创建" },
            { status: 409 }
          );
        }

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

        // 注意：interviews 表没有 round 列，轮次为虚拟概念（不入库）。
        // 仅用 roundLabel 组织通知文案，切勿把 round 写入 insert，否则 PostgREST 报错。
        const interviewData = {
          application_id: applicationId,
          job_id: jobId,
          interviewer_id: interviewer_id || userId,
          scheduled_at,
          location,
          contact_person,
          contact_phone,
          status: "scheduled" as const,
          response_status: "pending" as const,
        };
        
        const { error } = await supabase.from("interviews").insert(interviewData);

        if (error) throw error;

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

          // 给对应面试官发新面试任务通知
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
        }

        return NextResponse.json({ success: true, message: `${roundLabel}安排成功` });
      }

      case "submit-interview-result": {
        const { applicationId, result, evaluation } = body;
        
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

        const newStatus = result === "pass" ? "interview-passed" : "interview-failed";

        const { error: updateError } = await supabase
          .from("applications")
          .update({ status: newStatus })
          .eq("id", applicationId);

        if (updateError) throw updateError;

        const { data: interviews, error: intError } = await supabase
          .from("interviews")
          .select("id")
          .eq("application_id", applicationId);

        if (interviews && interviews.length > 0) {
          await supabase
            .from("interviews")
            .update({ 
              status: "completed",
              result: result,
              evaluation: evaluation || ''
            })
            .eq("application_id", applicationId);
        }

        if (app && job) {
          const title = result === "pass" ? "面试通过" : "面试未通过";
          const content = result === "pass" 
            ? `恭喜！你在「${job.title}」岗位的面试中表现优秀，已通过面试。我们将尽快与你联系安排下一步流程。`
            : `很遗憾，你在「${job.title}」岗位的面试中未通过。感谢你的投递，祝你早日找到合适的工作！`;
          
          await sendMessage(app.candidate_id, "result", title, content);
        }

        return NextResponse.json({ success: true, message: "面试结果已更新" });
      }

      case "hire": {
        const {
          applicationId,
          jobId,
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

        const { data: app } = await supabase
          .from("applications")
          .select("candidate_id, job_id, status")
          .eq("id", applicationId)
          .single();

        if (!app) {
          return NextResponse.json({ success: false, error: "投递不存在" }, { status: 404 });
        }

        const { data: job } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", jobId || app.job_id)
          .single();
        const jobTitle = job?.title || "该岗位";

        // 问3：防止对同一投递重复创建有效入职记录
        const { data: existingOnboarding } = await supabase
          .from("onboarding")
          .select("id, status")
          .eq("application_id", applicationId)
          .in("status", ["pending_confirmation", "confirmed", "onboarded"])
          .maybeSingle();
        if (existingOnboarding) {
          return NextResponse.json(
            { success: false, error: "该候选人已有进行中的入职记录，请勿重复录用" },
            { status: 409 }
          );
        }

        // 1) application → offering（发出Offer/录用通知，待候选人接受，不是直接 hired）
        const { error: statusErr } = await supabase
          .from("applications")
          .update({ status: "offering" })
          .eq("id", applicationId);
        if (statusErr) throw statusErr;

        // 2) 插入 onboarding 记录
        const { error: obErr } = await supabase.from("onboarding").insert({
          application_id: applicationId,
          job_id: jobId || app.job_id,
          candidate_id: app.candidate_id,
          recruiter_id: userId,
          onboard_date,
          onboard_location,
          contact_person,
          contact_phone,
          onboard_notes: onboard_notes || "",
          status: "pending_confirmation",
        });
        if (obErr) throw obErr;

        // 3) 通知候选人
        await sendMessage(
          app.candidate_id,
          "result",
          "录用通知",
          `恭喜！你已被「${jobTitle}」岗位录用！入职日期：${new Date(onboard_date).toLocaleDateString("zh-CN")}，地点：${onboard_location}，联系人：${contact_person}（${contact_phone}）。请在「个人中心-我的入职」中确认。`
        );

        // 4) fix6：向全体协作人（面试官 + 试岗面试官 + 招聘者 + 推荐人）广播入职信息同步
        const hireCollaborators = await getCollaborators(applicationId, jobId || app.job_id, [
          userId,
          app.candidate_id,
        ]);
        if (hireCollaborators.length > 0) {
          await broadcastMessage(
            hireCollaborators,
            "system",
            "候选人已录用",
            `你参与协作的「${jobTitle}」岗位候选人已被录用。入职日期：${new Date(onboard_date).toLocaleDateString("zh-CN")}，地点：${onboard_location}，联系人：${contact_person}（${contact_phone}）。`
          );
        }

        return NextResponse.json({ success: true, message: "录用成功，已创建入职记录" });
      }

      case "reject": {
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
          .update({ status: "rejected" })
          .eq("id", applicationId);

        if (error) throw error;

        if (app && job) {
          await sendMessage(
            app.candidate_id,
            "result",
            "投递未通过",
            `很遗憾，你投递的「${job.title}」岗位未通过筛选。感谢你的投递，祝你早日找到合适的工作！`
          );
        }

        return NextResponse.json({ success: true, message: "已拒绝" });
      }

      case "reschedule-interview": {
        // 重新安排一场被取消/被拒绝的面试：重置状态为待面试/待响应，
        // 清空拒绝原因/结果/评价，使面试官端与候选人端恢复到可响应状态。
        const { interviewId, scheduled_at, location, interviewer_id, contact_person, contact_phone } = body;

        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id")
          .eq("id", interviewId)
          .single();

        if (getError) throw getError;

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

        const { error } = await supabase
          .from("interviews")
          .update({
            scheduled_at,
            location,
            interviewer_id: interviewer_id || userId,
            contact_person,
            contact_phone,
            status: "scheduled",
            response_status: "pending",
            response_reason: null,
            result: null,
            evaluation: null,
          })
          .eq("id", interviewId);

        if (error) throw error;

        // 面试重新安排后，把投递状态同步回 interview-scheduled
        await supabase
          .from("applications")
          .update({ status: "interview-scheduled" })
          .eq("id", interview.application_id);

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
            "面试安排已更新",
            `你投递的「${job.title}」岗位面试安排已更新。面试时间：${dateStr}，地点：${location || '未指定'}${contact_person ? '，联系人：' + contact_person : ''}${contact_phone ? '，联系电话：' + contact_phone : ''}`
          );
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
              `你负责的「${job.title}」岗位面试（候选人：${candidateProfile?.full_name || "候选人"}）时间已更新为 ${dateStr}，地点：${location || "未指定"}。请及时确认。`
            );
          }
        }

        return NextResponse.json({ success: true, message: "面试重新安排成功" });
      }

      case "schedule-trial": {
        // 安排试岗：start_date 由前端拼为带时区的 TIMESTAMPTZ（整点小时），写入 trials.start_date
        const { applicationId, jobId, start_date, end_date, location } = body;

        if (!location || !String(location).trim()) {
          return NextResponse.json(
            { success: false, error: "试岗地点不能为空" },
            { status: 400 }
          );
        }

        // 开始日期不得早于今天（按北京时间自然日比较）
        const todayBeijing = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
        const startBeijing = start_date
          ? new Date(start_date as string).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
          : "";
        if (!start_date || startBeijing < todayBeijing) {
          return NextResponse.json(
            { success: false, error: "试岗开始日期不能早于今天，请选择今天或将来的日期" },
            { status: 400 }
          );
        }
        if (end_date) {
          const endBeijing = new Date(end_date as string).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
          if (endBeijing < startBeijing) {
            return NextResponse.json(
              { success: false, error: "试岗结束日期不能早于开始日期" },
              { status: 400 }
            );
          }
        }

        const { data: app } = await supabase
          .from("applications")
          .select("candidate_id")
          .eq("id", applicationId)
          .single();

        const { data: job } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", jobId)
          .single();

        const trialPayload = {
          application_id: applicationId,
          job_id: jobId,
          interviewer_id: userId,
          start_date,
          end_date: end_date && String(end_date).trim() ? end_date : null,
          location,
          status: "confirmed" as const,
        };

        const { error } = await supabase.from("trials").insert(trialPayload);

        if (error) {
          console.error("schedule-trial insert error:", error, "payload:", trialPayload);
          return NextResponse.json(
            { success: false, error: `安排试岗失败：${error.message}`, details: error.details || error.hint || null },
            { status: 500 }
          );
        }

        if (app && job) {
          const startDateStr = new Date(start_date as string).toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          await sendMessage(
            app.candidate_id,
            "interview",
            "试岗安排通知",
            `你投递的「${job.title}」岗位已安排试岗。开始时间：${startDateStr}，地点：${location}。请准时参加。`
          );
        }

        return NextResponse.json({ success: true, message: "试岗安排成功" });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Applications action error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}