"use client";

import { useEffect, useState } from "react";
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
import { Briefcase } from "lucide-react";

const mockJobs: Job[] = [
  {
    id: "mock-1",
    recruiter_id: "recruiter-1",
    title: "超市收银员",
    description: "负责超市收银工作，处理顾客结账，维护收银台整洁，提供优质顾客服务。要求有责任心，沟通能力强。",
    domain: "supermarket",
    employment_type: "fulltime",
    salary_min: 4500,
    salary_max: 6000,
    salary_unit: "月",
    location: "北京市朝阳区",
    requirements: "1. 年龄18-35岁\n2. 有收银经验优先\n3. 能适应轮班工作\n4. 持有健康证",
    is_active: true,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "mock-2",
    recruiter_id: "recruiter-2",
    title: "仓库管理员",
    description: "负责仓库日常管理，包括货物入库、出库、盘点、整理等工作。要求熟悉仓库操作流程，能吃苦耐劳。",
    domain: "warehouse",
    employment_type: "hourly",
    salary_min: 25,
    salary_max: 32,
    salary_unit: "时",
    location: "上海市浦东新区",
    requirements: "1. 年龄20-45岁\n2. 能熟练操作叉车优先\n3. 有仓库管理经验\n4. 身体健康，能承受体力劳动",
    is_active: true,
    created_at: "2024-01-14T09:00:00Z",
    updated_at: "2024-01-14T09:00:00Z",
  },
  {
    id: "mock-3",
    recruiter_id: "recruiter-3",
    title: "销售代表",
    description: "负责产品销售，开发新客户，维护老客户关系，完成销售目标。要求有良好的沟通能力和销售技巧。",
    domain: "sales",
    employment_type: "fulltime",
    salary_min: 5000,
    salary_max: 12000,
    salary_unit: "月",
    location: "广州市天河区",
    requirements: "1. 年龄22-40岁\n2. 有销售经验优先\n3. 能适应出差\n4. 有驾照优先",
    is_active: true,
    created_at: "2024-01-13T14:00:00Z",
    updated_at: "2024-01-13T14:00:00Z",
  },
];

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
    const timeoutId = setTimeout(() => {
      console.warn("[API] Fetch timed out, using mock data");
      setJobs(mockJobs);
      setLoading(false);
    }, 8000);

    async function fetchJobs() {
      try {
        const response = await fetch("/api/test-supabase");
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          setJobs(result.data as Job[]);
        } else {
          setJobs(mockJobs);
        }
      } catch (err) {
        console.error("[API] Error fetching jobs:", err);
        setJobs(mockJobs);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }

    fetchJobs();

    return () => clearTimeout(timeoutId);
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
          title="暂无招聘中的岗位"
          description="请稍后再来看看更多工作机会"
        />
      )}
    </PageContainer>
  );
}
