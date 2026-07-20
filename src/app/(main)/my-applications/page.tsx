"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/lib/constants";
import type { Application, Job } from "@/lib/types";

interface ApplicationWithJob extends Application {
  jobs?: Job;
}

const mockApplications: ApplicationWithJob[] = [
  {
    id: "mock-app-1",
    job_id: "mock-1",
    candidate_id: "mock-user",
    status: "reviewing",
    full_name: "张三",
    phone: "13800138000",
    email: "zhangsan@example.com",
    self_introduction: "我有3年超市收银经验，工作认真负责，善于与顾客沟通。",
    created_at: "2024-01-14T15:30:00Z",
    updated_at: "2024-01-14T15:30:00Z",
    jobs: {
      id: "mock-1",
      recruiter_id: "recruiter-1",
      title: "超市收银员",
      description: "负责超市收银工作",
      domain: "supermarket",
      employment_type: "fulltime",
      salary_min: 4500,
      salary_max: 6000,
      salary_unit: "月",
      location: "北京市朝阳区",
      is_active: true,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    },
  },
  {
    id: "mock-app-2",
    job_id: "mock-3",
    candidate_id: "mock-user",
    status: "pending",
    full_name: "张三",
    phone: "13800138000",
    email: "zhangsan@example.com",
    self_introduction: "我有5年销售经验，曾担任销售主管，具备良好的团队管理能力。",
    created_at: "2024-01-13T10:00:00Z",
    updated_at: "2024-01-13T10:00:00Z",
    jobs: {
      id: "mock-3",
      recruiter_id: "recruiter-3",
      title: "销售代表",
      description: "负责产品销售",
      domain: "sales",
      employment_type: "fulltime",
      salary_min: 5000,
      salary_max: 12000,
      salary_unit: "月",
      location: "广州市天河区",
      is_active: true,
      created_at: "2024-01-13T14:00:00Z",
      updated_at: "2024-01-13T14:00:00Z",
    },
  },
  {
    id: "mock-app-3",
    job_id: "mock-4",
    candidate_id: "mock-user",
    status: "rejected",
    full_name: "张三",
    phone: "13800138000",
    email: "zhangsan@example.com",
    self_introduction: "我能吃苦耐劳，愿意从基层做起。",
    created_at: "2024-01-10T09:00:00Z",
    updated_at: "2024-01-11T14:00:00Z",
    jobs: {
      id: "mock-4",
      recruiter_id: "recruiter-4",
      title: "工厂操作工",
      description: "负责生产线操作",
      domain: "factory",
      employment_type: "daily",
      salary_min: 180,
      salary_max: 220,
      salary_unit: "日",
      location: "深圳市宝安区",
      is_active: true,
      created_at: "2024-01-12T08:00:00Z",
      updated_at: "2024-01-12T08:00:00Z",
    },
  },
];

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      const supabase = createClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setApplications(mockApplications);
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/applications?candidate_id=${user.id}`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          setApplications(result.data as ApplicationWithJob[]);
        } else {
          console.log("[API] No applications found, using mock data");
          setApplications(mockApplications);
        }
      } catch (err) {
        console.error("[API] Error fetching applications:", err);
        setApplications(mockApplications);
      }
      setLoading(false);
    }

    fetchApplications();
  }, []);

  const getStatusBadge = (status: string) => {
    const label = APPLICATION_STATUS_LABELS[status as keyof typeof APPLICATION_STATUS_LABELS] || status;
    const color = APPLICATION_STATUS_COLORS[status as keyof typeof APPLICATION_STATUS_COLORS] || "bg-gray-100 text-gray-600";
    return <Badge className={color}>{label}</Badge>;
  };

  if (loading) {
    return <div className="container mx-auto p-6">加载中...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-green">我的投递</h1>
        <p className="text-gray-600 mt-2">查看你的投递记录和状态</p>
      </div>

      <div className="space-y-4">
        {applications.map((app) => (
          <Card key={app.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{app.jobs?.title || "未知岗位"}</CardTitle>
                {getStatusBadge(app.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">{app.jobs?.location || "未知地点"}</p>
                <p className="text-lg font-semibold text-brand-orange">
                  ¥{app.jobs?.salary_min || 0} - ¥{app.jobs?.salary_max || 0}/{app.jobs?.salary_unit || ""}
                </p>
                <p className="text-sm text-gray-500">
                  投递时间：{new Date(app.created_at).toLocaleString("zh-CN")}
                </p>
                {app.jobs?.id && (
                  <Link href={`/jobs/${app.jobs.id}`}>
                    <Button variant="outline" size="sm">
                      查看岗位详情
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {applications.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">你还没有投递任何岗位</p>
          <Link href="/">
            <Button className="bg-brand-green hover:bg-brand-green-dark">浏览岗位</Button>
          </Link>
        </div>
      )}
    </div>
  );
}