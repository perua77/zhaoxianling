"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { ArrowLeft } from "lucide-react";

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
  {
    id: "mock-4",
    recruiter_id: "recruiter-4",
    title: "工厂操作工",
    description: "负责生产线操作，按照工艺流程完成生产任务，保证产品质量。要求能适应流水线工作节奏。",
    domain: "factory",
    employment_type: "daily",
    salary_min: 180,
    salary_max: 220,
    salary_unit: "日",
    location: "深圳市宝安区",
    requirements: "1. 年龄18-45岁\n2. 能适应站立工作\n3. 服从管理安排\n4. 无不良嗜好",
    is_active: true,
    created_at: "2024-01-12T08:00:00Z",
    updated_at: "2024-01-12T08:00:00Z",
  },
  {
    id: "mock-5",
    recruiter_id: "recruiter-5",
    title: "生鲜理货员",
    description: "负责超市生鲜区商品陈列、补货、整理，保证商品新鲜度和货架整洁。要求有责任心，注重卫生。",
    domain: "supermarket",
    employment_type: "fulltime",
    salary_min: 4000,
    salary_max: 5500,
    salary_unit: "月",
    location: "成都市锦江区",
    requirements: "1. 年龄18-40岁\n2. 有生鲜工作经验优先\n3. 能适应早晚班\n4. 持有健康证",
    is_active: true,
    created_at: "2024-01-11T11:00:00Z",
    updated_at: "2024-01-11T11:00:00Z",
  },
  {
    id: "mock-6",
    recruiter_id: "recruiter-6",
    title: "物流分拣员",
    description: "负责快递包裹分拣、扫描、打包等工作。要求手脚麻利，能适应高强度工作。",
    domain: "warehouse",
    employment_type: "hourly",
    salary_min: 22,
    salary_max: 28,
    salary_unit: "时",
    location: "杭州市余杭区",
    requirements: "1. 年龄18-45岁\n2. 能适应夜班\n3. 视力良好\n4. 无犯罪记录",
    is_active: true,
    created_at: "2024-01-10T16:00:00Z",
    updated_at: "2024-01-10T16:00:00Z",
  },
];

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

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.warn("[API] Fetch timed out, using mock data");
      const mockJob = mockJobs.find((j) => j.id === id);
      if (mockJob) {
        setJob(mockJob);
      }
      setLoading(false);
    }, 8000);

    async function fetchJob() {
      if (!id) {
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/test-supabase?id=${id}`);
        const result = await response.json();

        if (result.success && result.data) {
          setJob(result.data as Job);
        } else {
          const mockJob = mockJobs.find((j) => j.id === id);
          if (mockJob) {
            setJob(mockJob);
          }
        }
      } catch (err) {
        console.error("[API] Error fetching job:", err);
        const mockJob = mockJobs.find((j) => j.id === id);
        if (mockJob) {
          setJob(mockJob);
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }

    fetchJob();

    return () => clearTimeout(timeoutId);
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingSpinner size="lg" label="加载中..." className="py-20" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-20">
          <p className="text-gray-500">岗位不存在或已删除</p>
          <Link href="/" className="mt-4 inline-flex items-center text-brand-green">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Link href="/" className="mb-4 inline-flex items-center text-muted-foreground hover:text-brand-green transition-colors">
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回岗位列表
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{job.title}</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="brand-green">
              {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
            </Badge>
            <Badge variant="muted">
              {DOMAIN_LABELS[job.domain]}
            </Badge>
            {job.is_active && (
              <Badge variant="brand-green">招聘中</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">
                工作地点
              </h3>
              <p className="text-gray-700">{job.location}</p>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">
                薪资待遇
              </h3>
              {job.salary_min != null && job.salary_max != null && (
                <p className="text-xl font-bold text-brand-orange">
                  ¥{job.salary_min} - ¥{job.salary_max}
                  <span className="text-sm font-normal text-gray-600">
                    /{job.salary_unit || getSalaryUnit(job.employment_type)}
                  </span>
                </p>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">
                岗位描述
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {job.description}
              </p>
            </div>

            {job.requirements && (
              <div>
                <h3 className="font-semibold text-base mb-2 text-foreground">
                  任职要求
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {job.requirements}
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <Link href={`/jobs/${job.id}/apply`}>
                <Button size="lg" variant="primary" className="w-full">
                  立即投递
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
