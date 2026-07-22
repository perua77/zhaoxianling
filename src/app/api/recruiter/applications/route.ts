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

    interface ApplicationData { job_id: string; candidate_id: string; }
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
      .select("id, application_id, interviewer_id, scheduled_at, location, status, result, evaluation")
      .in("application_id", (apps as { id: string }[] || []).map(a => a.id));
    
    const interviewMap = new Map<string, unknown[]>();
    (interviews as { application_id: string }[] || []).forEach(int => {
      if (!interviewMap.has(int.application_id)) {
        interviewMap.set(int.application_id, []);
      }
      interviewMap.get(int.application_id)!.push(int);
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

        const interviewData = {
          application_id: applicationId,
          job_id: jobId,
          interviewer_id: interviewer_id || userId,
          scheduled_at,
          location,
          contact_person,
          contact_phone,
          status: "scheduled" as const,
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
            : `很遗憾，你在「${job.title}」岗位的面试中未通过。感谢你的投递，祝你早日找到合适的工作！${evaluation ? '\n\n面试官评价：' + evaluation : ''}`;
          
          await sendMessage(app.candidate_id, "result", title, content);
        }

        return NextResponse.json({ success: true, message: "面试结果已更新" });
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