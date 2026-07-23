import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const type = searchParams.get("type");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    if (type === "interview") {
      const { data: interviews } = await supabase
        .from("interviews")
        .select("*, applications(id, candidate_id), jobs(id, title)")
        .eq("interviewer_id", userId);

      const candidateIds = new Set(
        (interviews || []).map((int: { applications: { candidate_id: string } }) =>
          int.applications?.candidate_id
        )
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(candidateIds).filter(Boolean));

      const profileMap = new Map(
        (profiles as { id: string; full_name: string }[] || []).map((p) => [p.id, p.full_name])
      );

      const appIdToRound = new Map<string, number>();
      (interviews || []).forEach((int: { applications: { id: string } }) => {
        const appId = int.applications?.id;
        if (appId) {
          appIdToRound.set(appId, (appIdToRound.get(appId) || 0) + 1);
        }
      });

      const result = (interviews || []).map((int: any) => ({
        id: int.id,
        application_id: int.applications?.id,
        job_id: int.jobs?.id,
        candidate_name: profileMap.get(int.applications?.candidate_id) || "未知",
        job_title: int.jobs?.title || "未知",
        scheduled_at: int.scheduled_at,
        location: int.location,
        contact_person: int.contact_person,
        contact_phone: int.contact_phone,
        status: int.status,
        result: int.result,
        evaluation: int.evaluation,
        response_status: int.response_status,
        response_reason: int.response_reason,
        round: appIdToRound.get(int.applications?.id) || 1,
      }));

      return NextResponse.json({ success: true, data: result });
    } else if (type === "trial") {
      const { data: trials } = await supabase
        .from("trials")
        .select("*, applications(id, candidate_id), jobs(id, title)")
        .eq("interviewer_id", userId);

      const candidateIds = new Set(
        (trials || []).map((trial: { applications: { candidate_id: string } }) =>
          trial.applications?.candidate_id
        )
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(candidateIds).filter(Boolean));

      const profileMap = new Map(
        (profiles as { id: string; full_name: string }[] || []).map((p) => [p.id, p.full_name])
      );

      const result = (trials || []).map((trial: any) => ({
        id: trial.id,
        application_id: trial.applications?.id,
        job_id: trial.jobs?.id,
        candidate_name: profileMap.get(trial.applications?.candidate_id) || "未知",
        job_title: trial.jobs?.title || "未知",
        start_date: trial.start_date,
        end_date: trial.end_date,
        location: trial.location,
        status: trial.status,
        feedback: trial.feedback,
      }));

      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: "Invalid type parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Interviewer tasks fetch error:", error);
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
      case "accept-interview": {
        const { interviewId } = body;

        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("interviewer_id, response_status")
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

        return NextResponse.json({ success: true, message: "已接受面试安排" });
      }

      case "reject-interview": {
        const { interviewId, reason } = body;

        if (!reason?.trim()) {
          return NextResponse.json(
            { success: false, error: "Reason is required" },
            { status: 400 }
          );
        }

        const { data: interview, error: getError } = await supabase
          .from("interviews")
          .select("application_id, job_id, interviewer_id, response_status")
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
            { success: false, error: "Unauthorized to reject interview" },
            { status: 403 }
          );
        }

        if (interview.response_status !== "pending") {
          return NextResponse.json(
            { success: false, error: "Interview already responded" },
            { status: 400 }
          );
        }

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

        const { data: app, error: appError } = await supabase
          .from("applications")
          .select("candidate_id")
          .eq("id", interview.application_id)
          .single();

        const { data: candidate, error: candidateError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", app?.candidate_id)
          .single();

        const { error } = await supabase
          .from("interviews")
          .update({ response_status: "rejected", response_reason: reason })
          .eq("id", interviewId);

        if (error) throw error;

        if (job && interviewer && candidate) {
          await sendMessage(
            job.recruiter_id,
            "interview",
            "面试官拒绝了面试安排",
            `面试官 ${interviewer.full_name} 拒绝了 ${candidate.full_name} 的面试安排。理由：${reason}。请重新安排面试时间。`
          );
        }

        return NextResponse.json({ success: true, message: "已拒绝面试安排" });
      }

      case "mark-completed": {
        const { interviewId, result, evaluation } = body;

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

        const interviewResult = result || "pending";

        const { error } = await supabase
          .from("interviews")
          .update({
            status: "completed",
            result: interviewResult,
            evaluation,
          })
          .eq("id", interviewId);

        if (error) throw error;

        if (interviewResult === "pass" || interviewResult === "fail") {
          const newStatus = interviewResult === "pass" ? "interview-passed" : "interview-failed";
          await supabase
            .from("applications")
            .update({ status: newStatus })
            .eq("id", interview.application_id);

          if (app && job) {
            const title = interviewResult === "pass" ? "面试通过" : "面试未通过";
            const content =
              interviewResult === "pass"
                ? `恭喜！你在「${job.title}」岗位的面试中表现优秀，已通过面试。我们将尽快与你联系安排下一步流程。`
                : `很遗憾，你在「${job.title}」岗位的面试中未通过。感谢你的投递，祝你早日找到合适的工作！${
                    evaluation ? "\n\n面试官评价：" + evaluation : ""
                  }`;

            await sendMessage(app.candidate_id, "result", title, content);
          }
        }

        return NextResponse.json({ success: true, message: "面试已标记完成" });
      }

      case "mark-no-show": {
        const { interviewId } = body;

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
          .update({ status: "no_show", result: "fail" })
          .eq("id", interviewId);

        if (error) throw error;

        await supabase
          .from("applications")
          .update({ status: "interview-failed" })
          .eq("id", interview.application_id);

        if (app && job) {
          await sendMessage(
            app.candidate_id,
            "result",
            "面试未到场",
            `你在「${job.title}」岗位的面试中未到场，面试已标记为未通过。`
          );
        }

        return NextResponse.json({ success: true, message: "已标记为未到场" });
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

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Interviewer tasks action error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}