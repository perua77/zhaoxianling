"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

import type { Job } from "@/lib/types";
import {
  DOMAIN_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Briefcase, Search } from "lucide-react";



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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          job.location?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [jobs, searchQuery]
  );

  useEffect(() => {
    async function fetchJobs() {
      try {
        const response = await fetch("/api/test-supabase");
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          setJobs(result.data as Job[]);
        } else {
          setJobs([]);
        }
      } catch (err) {
        console.error("[API] Error fetching jobs:", err);
        setJobs([]);
      } finally {
        setLoading(false);
      }
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

      {/* 搜索框 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜索岗位名称、地点..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#185A56]"
        />
      </div>

      {/* 岗位列表 */}
      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredJobs.map((job) => (
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
                    {DOMAIN_LABELS[job.domain]}
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
                    {job.salary_unit || getSalaryUnit(job.employment_type)}
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
          title={searchQuery ? "未找到匹配的岗位" : "暂无招聘中的岗位"}
          description={searchQuery ? "换个关键词试试" : "请稍后再来看看更多工作机会"}
        />
      )}
    </PageContainer>
  );
}
