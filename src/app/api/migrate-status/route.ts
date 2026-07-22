import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const requiredStatuses = [
      "pending",
      "reviewing",
      "interview-scheduled",
      "interviewing",
      "interview-passed",
      "interview-failed",
      "offering",
      "hired",
      "accepted",
      "rejected",
    ];

    const { data, error } = await supabase.rpc('execute_sql', { 
      sql: 'SELECT unnest(enum_range(NULL::application_status)) as status;' 
    });

    let existingStatuses: string[] = [];
    if (!error && data) {
      const result = data as unknown;
      if (typeof result === 'string') {
        const trimmed = result.trim();
        if (trimmed) {
          existingStatuses = trimmed.split('\n').map(s => s.trim()).filter(Boolean);
        }
      } else if (Array.isArray(result)) {
        existingStatuses = result.map((item: Record<string, unknown>) => String(item['status'] || '')).filter(Boolean);
      }
    }

    if (existingStatuses.length === 0) {
      const { data: appsData } = await supabase.from('applications').select('status').limit(10);
      if (appsData && Array.isArray(appsData)) {
        const uniqueStatuses = new Set(appsData.map((app: Record<string, unknown>) => String(app['status'] || '')));
        existingStatuses = Array.from(uniqueStatuses).filter(Boolean);
      }
    }

    const missingStatuses = requiredStatuses.filter(s => !existingStatuses.includes(s));
    const hasAllStatuses = missingStatuses.length === 0;

    return NextResponse.json({
      success: hasAllStatuses,
      message: hasAllStatuses ? "枚举值验证成功" : "枚举值不完整",
      existingStatusesInDB: existingStatuses,
      requiredStatuses,
      missingStatuses,
      hasAllStatuses,
      requiredSQL: getMigrationSQL(),
    });
  } catch (error) {
    console.error("Migration status error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        message: "execute_sql 函数不存在，请先执行迁移SQL",
        requiredSQL: getMigrationSQL(),
      },
      { status: 500 }
    );
  }
}

function getMigrationSQL(): string {
  return `
-- 1. 创建 execute_sql RPC 函数（用于动态SQL执行）
CREATE OR REPLACE FUNCTION execute_sql(sql text) 
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  result text;
BEGIN
  EXECUTE sql INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error: ' || SQLERRM;
END;
$$;

-- 2. 添加缺失的 application_status 枚举值
ALTER TYPE application_status ADD VALUE 'reviewing';
ALTER TYPE application_status ADD VALUE 'interview-scheduled';
ALTER TYPE application_status ADD VALUE 'interviewing';
ALTER TYPE application_status ADD VALUE 'interview-passed';
ALTER TYPE application_status ADD VALUE 'interview-failed';
ALTER TYPE application_status ADD VALUE 'offering';
ALTER TYPE application_status ADD VALUE 'hired';
ALTER TYPE application_status ADD VALUE 'rejected';

-- 3. 验证枚举值是否已添加
SELECT unnest(enum_range(NULL::application_status)) as status;
`;
}