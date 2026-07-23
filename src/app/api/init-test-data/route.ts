import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({
      success: false,
      error: "环境变量缺失",
    }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results: any = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  try {
    // Step 1: 测试连接
    results.steps.push({ name: "connection", status: "testing" });

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, title")
      .limit(1);

    if (jobsError) {
      results.steps[0] = { name: "connection", status: "failed", error: jobsError.message };
      return NextResponse.json(results, { status: 500 });
    }

    results.steps[0] = { name: "connection", status: "success", message: "Supabase 连接正常" };

    // Step 2: 检查是否已有测试用户
    results.steps.push({ name: "check_users", status: "testing" });

    const { data: profiles, error: profilesError, count: profilesCount } = await supabase
      .from("profiles")
      .select("id, full_name, roles", { count: "exact" });

    if (profilesError) {
      results.steps[1] = { name: "check_users", status: "failed", error: profilesError.message };
    } else {
      results.steps[1] = {
        name: "check_users",
        status: "success",
        count: profilesCount,
        profiles: profiles?.map(p => ({ id: p.id, name: p.full_name, roles: p.roles })),
      };
    }

    // Step 3: 检查 jobs 表数据
    results.steps.push({ name: "check_jobs", status: "testing" });

    const { data: allJobs, error: allJobsError, count: jobsCount } = await supabase
      .from("jobs")
      .select("id, title, status, employment_type", { count: "exact" });

    if (allJobsError) {
      results.steps[2] = { name: "check_jobs", status: "failed", error: allJobsError.message };
    } else {
      results.steps[2] = {
        name: "check_jobs",
        status: "success",
        count: jobsCount,
        jobs: allJobs?.map(j => ({ id: j.id, title: j.title, status: j.status, type: j.employment_type })),
      };
    }

    // Step 4: 检查 applications 表
    results.steps.push({ name: "check_applications", status: "testing" });

    const { count: appCount, error: appError } = await supabase
      .from("applications")
      .select("*", { count: "exact" })
      .limit(0);

    if (appError) {
      results.steps[3] = { name: "check_applications", status: "failed", error: appError.message };
    } else {
      results.steps[3] = { name: "check_applications", status: "success", count: appCount };
    }

    // Step 5: 检查 interviews 表
    results.steps.push({ name: "check_interviews", status: "testing" });

    const { count: interviewCount, error: interviewError } = await supabase
      .from("interviews")
      .select("*", { count: "exact" })
      .limit(0);

    if (interviewError) {
      results.steps[4] = { name: "check_interviews", status: "failed", error: interviewError.message };
    } else {
      results.steps[4] = { name: "check_interviews", status: "success", count: interviewCount };
    }

    // Step 6: 检查 trials 表
    results.steps.push({ name: "check_trials", status: "testing" });

    const { count: trialCount, error: trialError } = await supabase
      .from("trials")
      .select("*", { count: "exact" })
      .limit(0);

    if (trialError) {
      results.steps[5] = { name: "check_trials", status: "failed", error: trialError.message };
    } else {
      results.steps[5] = { name: "check_trials", status: "success", count: trialCount };
    }

    // Step 7: 检查 messages 表
    results.steps.push({ name: "check_messages", status: "testing" });

    const { count: msgCount, error: msgError } = await supabase
      .from("messages")
      .select("*", { count: "exact" })
      .limit(0);

    if (msgError) {
      results.steps[6] = { name: "check_messages", status: "failed", error: msgError.message };
    } else {
      results.steps[6] = { name: "check_messages", status: "success", count: msgCount };
    }

    results.success = true;
    results.message = "数据库检查完成";

  } catch (err: any) {
    results.success = false;
    results.error = err?.message || String(err);
  }

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({
      success: false,
      error: "环境变量缺失",
    }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "create_test_user") {
      const email = body?.email || "admin@test.com";
      const password = body?.password || "Test1234";
      const fullName = body?.fullName || "测试管理员";
      const roles = body?.roles || ["recruiter"];

      // 创建 Auth 用户
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: roles[0],
        },
      });

      if (authError) {
        return NextResponse.json({
          success: false,
          error: `创建 Auth 用户失败: ${authError.message}`,
        }, { status: 500 });
      }

      // 创建 Profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: authUser.user!.id,
          full_name: fullName,
          roles,
          phone: body?.phone || "",
        })
        .select()
        .single();

      if (profileError) {
        return NextResponse.json({
          success: false,
          error: `创建 Profile 失败: ${profileError.message}`,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "测试用户创建成功",
        user: {
          id: authUser.user!.id,
          email,
          fullName,
          roles,
        },
      });
    }

    if (action === "create_test_jobs") {
      const testJobs = [
        {
          title: "前端开发工程师",
          description: "负责公司前端产品开发",
          requirements: "熟悉 React/Vue，有经验优先",
          salary_min: 8000,
          salary_max: 15000,
          salary_type: "月薪",
          employment_type: "全职",
          location: "上海市浦东新区",
          province: "上海市",
          city: "上海市",
          district: "浦东新区",
          is_active: true,
          recruiter_id: body?.recruiterId,
        },
        {
          title: "UI 设计师",
          description: "负责产品 UI 设计和交互设计",
          requirements: "熟练使用 Figma/Sketch",
          salary_min: 6000,
          salary_max: 12000,
          salary_type: "月薪",
          employment_type: "全职",
          location: "北京市朝阳区",
          province: "北京市",
          city: "北京市",
          district: "朝阳区",
          is_active: true,
          recruiter_id: body?.recruiterId,
        },
      ];

      const { data, error } = await supabase
        .from("jobs")
        .insert(testJobs)
        .select();

      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "测试岗位创建成功",
        jobs: data,
      });
    }

    return NextResponse.json({
      success: false,
      error: `未知操作: ${action}`,
      availableActions: ["create_test_user", "create_test_jobs"],
    }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || String(err),
    }, { status: 500 });
  }
}
