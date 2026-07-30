"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/lib/constants";
import type { Application, Job } from "@/lib/types";

interface ApplicationWithJob extends Application {
  jobs?: Job;
}

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuth((state) => state.user);

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => setLoading(false), 1500);
      return () => clearTimeout(timer);
    }
    async function fetchApplications() {
      try {
        const response = await fetch(`/api/applications?candidate_id=${user!.id}`);
        const result = await response.json();

        if (result.success && result.data) {
          setApplications(result.data as ApplicationWithJob[]);
        }
      } catch (err) {
        console.error("[API] Error fetching applications:", err);
      }
      setLoading(false);
    }

    fetchApplications();
  }, [user]);

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