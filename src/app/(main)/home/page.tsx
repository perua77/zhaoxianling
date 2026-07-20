"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/lib/types";
import {
  INDUSTRY_TYPE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Briefcase } from "lucide-react";

/** 根据雇佣类型推导薪资单位 */
function getSalaryUnit(employmentType: Job["employment_type"]): string {
  switch (employmentType) {
    case "hourly":
      return "时";
    case "daily":
      return "日";
    case "fulltime":
      return "月";
    case "outsource":
      return "项目";
  }
}

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setJobs(data as Job[]);
      }
      setLoading(false);
    }

    fetchJobs();
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <LoadingSpinner size="lg" label="加载岗位中..." className="py-20" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* 标题区 */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-green">招贤令</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          找到适合你的工作机会
        </p>
      </header>

      {/* 岗位列表 */}
      {jobs.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => (
            <Card key={job.id} interactive>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">
                  {job.title}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant="brand-green">
                    {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
                  </Badge>
                  <Badge variant="muted">
                    {INDUSTRY_TYPE_LABELS[job.industry]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm text-muted-foreground">
                  {job.location}
                </p>
                {job.salary_min != null && job.salary_max != null && (
                  <p className="mb-3 text-base font-semibold text-brand-orange">
                    ¥{job.salary_min} - ¥{job.salary_max}/
                    {getSalaryUnit(job.employment_type)}
                  </p>
                )}
                <p className="mb-4 line-clamp-2 text-sm text-foreground/80">
                  {job.description}
                </p>
                <Link href={`/jobs/${job.id}`}>
                  <Button variant="primary" fullWidth size="sm">
                    查看详情
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="暂无招聘中的岗位"
          description="请稍后再来看看更多工作机会"
        />
      )}
    </PageContainer>
  );
}
