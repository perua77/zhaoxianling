import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json({ 
      success: true, 
      message: "请在Supabase SQL编辑器中执行以下SQL语句来启用RLS行级安全策略",
      requiredSQL: getRLSSQL(),
    });
  } catch (error) {
    console.error("RLS setup error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        requiredSQL: getRLSSQL(),
      },
      { status: 500 }
    );
  }
}

function getRLSSQL(): string {
  return `
-- ====================
-- 启用行级安全策略 (RLS)
-- ====================

-- 1. 启用所有表的RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ====================
-- profiles 表策略
-- ====================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admin users can view all profiles" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin users can view all profiles" ON profiles FOR SELECT USING ((SELECT roles::text[] FROM profiles WHERE id = auth.uid()) && ARRAY['recruiter', 'interviewer', 'vendor']::text[]);

-- ====================
-- jobs 表策略
-- ====================
DROP POLICY IF EXISTS "Jobs are viewable by everyone" ON jobs;
DROP POLICY IF EXISTS "Recruiters can create jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiters can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Recruiters can delete their own jobs" ON jobs;

CREATE POLICY "Jobs are viewable by everyone" ON jobs FOR SELECT USING (is_active = true);
CREATE POLICY "Recruiters can create jobs" ON jobs FOR INSERT WITH CHECK ((SELECT roles::text[] FROM profiles WHERE id = auth.uid()) && ARRAY['recruiter']::text[]);
CREATE POLICY "Recruiters can update their own jobs" ON jobs FOR UPDATE USING (recruiter_id = auth.uid());
CREATE POLICY "Recruiters can delete their own jobs" ON jobs FOR DELETE USING (recruiter_id = auth.uid());

-- ====================
-- applications 表策略
-- ====================
DROP POLICY IF EXISTS "Applications are viewable by everyone" ON applications;
DROP POLICY IF EXISTS "Candidates can view their own applications" ON applications;
DROP POLICY IF EXISTS "Recruiters can view applications for their jobs" ON applications;
DROP POLICY IF EXISTS "Candidates can apply to jobs" ON applications;
DROP POLICY IF EXISTS "Recruiters can update applications for their jobs" ON applications;

CREATE POLICY "Candidates can view their own applications" ON applications FOR SELECT USING (candidate_id = auth.uid());
CREATE POLICY "Recruiters can view applications for their jobs" ON applications FOR SELECT USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = auth.uid()) OR job_id IN (SELECT job_id FROM job_assignments WHERE recruiter_id = auth.uid()) OR assigned_recruiter_id = auth.uid());
CREATE POLICY "Candidates can apply to jobs" ON applications FOR INSERT WITH CHECK ((SELECT roles::text[] FROM profiles WHERE id = auth.uid()) && ARRAY['candidate']::text[]);
CREATE POLICY "Recruiters can update applications for their jobs" ON applications FOR UPDATE USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = auth.uid()) OR job_id IN (SELECT job_id FROM job_assignments WHERE recruiter_id = auth.uid()) OR assigned_recruiter_id = auth.uid());

-- ====================
-- interviews 表策略
-- ====================
DROP POLICY IF EXISTS "Interviews are viewable by everyone" ON interviews;
DROP POLICY IF EXISTS "Candidates can view their own interviews" ON interviews;
DROP POLICY IF EXISTS "Interviewers can view their assigned interviews" ON interviews;
DROP POLICY IF EXISTS "Recruiters can view interviews for their jobs" ON interviews;
DROP POLICY IF EXISTS "Recruiters can create interviews" ON interviews;
DROP POLICY IF EXISTS "Interviewers can update their own interviews" ON interviews;

CREATE POLICY "Candidates can view their own interviews" ON interviews FOR SELECT USING (application_id IN (SELECT id FROM applications WHERE candidate_id = auth.uid()));
CREATE POLICY "Interviewers can view their assigned interviews" ON interviews FOR SELECT USING (interviewer_id = auth.uid());
CREATE POLICY "Recruiters can view interviews for their jobs" ON interviews FOR SELECT USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = auth.uid()) OR job_id IN (SELECT job_id FROM job_assignments WHERE recruiter_id = auth.uid()));
CREATE POLICY "Recruiters can create interviews" ON interviews FOR INSERT WITH CHECK ((SELECT roles::text[] FROM profiles WHERE id = auth.uid()) && ARRAY['recruiter']::text[]);
CREATE POLICY "Interviewers can update their own interviews" ON interviews FOR UPDATE USING (interviewer_id = auth.uid());

-- ====================
-- trials 表策略
-- ====================
DROP POLICY IF EXISTS "Trials are viewable by everyone" ON trials;
DROP POLICY IF EXISTS "Candidates can view their own trials" ON trials;
DROP POLICY IF EXISTS "Recruiters can view trials for their jobs" ON trials;
DROP POLICY IF EXISTS "Recruiters can create trials" ON trials;

CREATE POLICY "Candidates can view their own trials" ON trials FOR SELECT USING (application_id IN (SELECT id FROM applications WHERE candidate_id = auth.uid()));
CREATE POLICY "Recruiters can view trials for their jobs" ON trials FOR SELECT USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = auth.uid()) OR job_id IN (SELECT job_id FROM job_assignments WHERE recruiter_id = auth.uid()));
CREATE POLICY "Recruiters can create trials" ON trials FOR INSERT WITH CHECK ((SELECT roles::text[] FROM profiles WHERE id = auth.uid()) && ARRAY['recruiter']::text[]);

-- ====================
-- job_assignments 表策略
-- ====================
DROP POLICY IF EXISTS "Job assignments are viewable by everyone" ON job_assignments;
DROP POLICY IF EXISTS "Recruiters can view their own assignments" ON job_assignments;
DROP POLICY IF EXISTS "Job owners can view all assignments" ON job_assignments;

CREATE POLICY "Recruiters can view their own assignments" ON job_assignments FOR SELECT USING (recruiter_id = auth.uid());
CREATE POLICY "Job owners can view all assignments" ON job_assignments FOR SELECT USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = auth.uid()));

-- ====================
-- messages 表策略
-- ====================
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Recruiters can send messages" ON messages;

CREATE POLICY "Users can view their own messages" ON messages FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "Recruiters can send messages" ON messages FOR INSERT WITH CHECK ((SELECT roles::text[] FROM profiles WHERE id = auth.uid()) && ARRAY['recruiter', 'interviewer']::text[]);

-- ====================
-- 创建验证函数
-- ====================
DROP FUNCTION IF EXISTS get_rls_status();
CREATE OR REPLACE FUNCTION get_rls_status() 
RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t)) 
    FROM (
      SELECT 
        relname as table_name, 
        relrowsecurity as rls_enabled,
        (SELECT json_agg(policyname) FROM pg_policies WHERE tablename = relname) as policies
      FROM pg_class 
      WHERE relname IN ('profiles', 'jobs', 'applications', 'interviews', 'trials', 'job_assignments', 'messages')
    ) t
  );
END;
$$;

-- ====================
-- 验证RLS状态
-- ====================
SELECT get_rls_status();
`;
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      message: "请在Supabase SQL编辑器中执行验证查询来确认RLS状态",
      verificationSQL: `
-- 验证枚举值
SELECT unnest(enum_range(NULL::application_status)) as status;

-- 验证RLS状态
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('profiles', 'jobs', 'applications', 'interviews', 'trials', 'job_assignments', 'messages');

-- 验证策略
SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('profiles', 'jobs', 'applications', 'interviews', 'trials', 'job_assignments', 'messages');

-- 使用验证函数
SELECT get_rls_status();
      `.trim(),
    });
  } catch (error) {
    console.error("Get RLS status error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: "请直接在Supabase SQL编辑器中验证",
    }, { status: 500 });
  }
}