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

    const [
      { data: myInterviews },
      { data: myJobs },
      { data: assignedJobs },
    ] = await Promise.all([
      supabase.from("interviews").select("*").eq("interviewer_id", userId),
      supabase.from("jobs").select("id").eq("recruiter_id", userId),
      supabase.from("job_assignments").select("job_id").eq("recruiter_id", userId),
    ]);

    const myInterviewList = myInterviews || [];
    const myJobIds = (myJobs as { id: string }[] || []).map((j) => j.id);
    const assignedJobIds = (assignedJobs as { job_id: string }[] || []).map((a) => a.job_id);
    const allJobIds = [...new Set([...myJobIds, ...assignedJobIds])];

    if (allJobIds.length > 0) {
      const { data: apps } = await supabase
        .from("applications")
        .select("id")
        .in("job_id", allJobIds);
      const appIds = (apps as { id: string }[] || []).map((a) => a.id);
      
      if (appIds.length > 0) {
        const { data: allInterviews } = await supabase
          .from("interviews")
          .select("*")
          .in("application_id", appIds);
        const jobInterviews = allInterviews || [];
        const interviewIdSet = new Set((myInterviewList as { id: string }[]).map(int => int.id));
        jobInterviews.forEach((int: { id: string }) => {
          if (!interviewIdSet.has(int.id)) {
            myInterviewList.push(int);
            interviewIdSet.add(int.id);
          }
        });
      }
    }

    interviews = myInterviewList;

    if (interviews.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const appIds = (interviews as { application_id: string }[]).map((int) => int.application_id);
    const jobIds = (interviews as { job_id: string }[]).map((int) => int.job_id);
    const candidateIds = new Set<string>();

    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .in("id", appIds)
      .order("created_at", { ascending: false });

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
        full_name: profile?.full_name,
        phone: profile?.phone,
        gender: profile?.gender,
        age: profile?.age,
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
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          
          await sendMessage(
            app.candidate_id,
            "interview",
            "面试邀请",
            `你投递的「${job.title}」岗位已安排面试。面试时间：${dateStr}，地点：${location || '未指定'}${contact_person ? '，联系人：' + contact_person : ''}${contact_phone ? '，联系电话：' + contact_phone : ''}`
          );
        }

        return NextResponse.json({ success: true, message: "面试安排成功" });
      }

      case "submit-evaluation": {
        const { interviewId, evaluation, result } = body;

        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id, interviewer_id")
          .eq("id", interviewId)
          .single();

        if (getError) throw getError;

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
              : `很遗憾，你在「${job.title}」岗位的面试中未通过。感谢你的投递，祝你早日找到合适的工作！${evaluation ? '\n\n面试官评价：' + evaluation : ''}`;
            
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

        const { error } = await supabase.from("trials").insert({
          application_id: applicationId,
          job_id: jobId,
          interviewer_id: userId,
          start_date,
          end_date: end_date || null,
          location,
          status: "pending",
        });

        if (error) throw error;

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
        }

        return NextResponse.json({ success: true, message: "试岗安排成功" });
      }

      case "submit-trial-feedback": {
        const { trialId, feedback } = body;
        
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
            `你在「${job.title}」岗位的试岗已完成。反馈内容：${feedback}`
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
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
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
            response_status: "pending",
            response_reason: null,
          })
          .eq("id", interviewId);

        if (error) throw error;

        if (app && job) {
          const dateStr = new Date(scheduled_at).toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          
          await sendMessage(
            app.candidate_id,
            "interview",
            "面试安排已更新",
            `你投递的「${job.title}」岗位面试安排已更新。面试时间：${dateStr}，地点：${location || '未指定'}${contact_person ? '，联系人：' + contact_person : ''}${contact_phone ? '，联系电话：' + contact_phone : ''}`
          );
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
          .update({ response_status: "rejected", response_reason: reason })
          .eq("id", interviewId);

        if (error) throw error;

        if (job && interviewer) {
          const reasonText = reason && reason.trim() ? reason : "未提供拒绝理由";
          await sendMessage(
            job.recruiter_id,
            "interview",
            "面试官拒绝了面试安排",
            `面试官 ${interviewer.full_name} 拒绝了 ${candidateName} 的面试安排。理由：${reasonText}。请重新安排面试时间。`
          );
        }

        return NextResponse.json({ success: true, message: "已拒绝面试安排" });
      }

      case "hire": {
        const { applicationId, jobId } = body;

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

        const { data: existingTrials } = await supabase
          .from("trials")
          .select("id")
          .eq("application_id", applicationId);

        if (existingTrials && existingTrials.length > 0) {
          await supabase
            .from("trials")
            .update({ is_hired: true, status: "completed" })
            .eq("application_id", applicationId);
        } else {
          await supabase.from("trials").insert({
            application_id: applicationId,
            job_id: jobId,
            interviewer_id: userId,
            status: "completed",
            is_hired: true,
          });
        }

        await supabase
          .from("applications")
          .update({ status: "hired" })
          .eq("id", applicationId);

        if (app && job) {
          await sendMessage(
            app.candidate_id,
            "result",
            "录用通知",
            `恭喜！你已被「${job.title}」岗位录用！我们将尽快与你联系办理入职手续。`
          );
        }

        return NextResponse.json({ success: true, message: "录用成功！" });
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