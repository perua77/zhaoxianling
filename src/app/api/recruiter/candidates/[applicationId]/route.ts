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

    const { data: interviews, error: interviewsError } = await supabase
      .from("interviews")
      .select("*")
      .eq("application_id", applicationId)
      .order("scheduled_at", { ascending: true });

    const interviewerIds = new Set(
      (interviews || []).map((i: { interviewer_id: string }) => i.interviewer_id)
    );

    const { data: interviewers, error: interviewersError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(interviewerIds));

    const appIdToRound = new Map<string, number>();
    const allInterviews = await supabase
      .from("interviews")
      .select("application_id")
      .eq("application_id", applicationId);
    (allInterviews.data || []).forEach((int: { application_id: string }, idx: number) => {
      appIdToRound.set(int.application_id, idx + 1);
    });

    const processedInterviews = (interviews || []).map((int: any, idx: number) => ({
      ...int,
      round: idx + 1,
    }));

    const { data: trials, error: trialsError } = await supabase
      .from("trials")
      .select("*")
      .eq("application_id", applicationId);

    return NextResponse.json({
      success: true,
      data: {
        application,
        candidate: candidate || {},
        job: job || {},
        interviews: processedInterviews,
        trials: trials || [],
        interviewers: interviewers || [],
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

        const { error } = await supabase.from("trials").insert({
          application_id: applicationId,
          job_id: application.job_id,
          interviewer_id: userId,
          start_date,
          end_date,
          location,
          status: "active",
        });

        if (error) throw error;

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
            `你在「${job.title}」岗位的试岗已完成。反馈内容：${feedback}`
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
          .update({ status: "hired" })
          .eq("id", applicationId);

        if (appError2) throw appError2;

        if (application && job) {
          await sendMessage(
            application.candidate_id,
            "result",
            "录用通知",
            `恭喜！你已被「${job.title}」岗位录用。我们将尽快与你联系办理入职手续。`
          );
        }

        return NextResponse.json({ success: true, message: "录用成功" });
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