"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Briefcase, PlusCircle } from "lucide-react";
import { DOMAIN_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/lib/constants";
import type { Job } from "@/lib/types";

interface JobWithCount extends Job {
  applicationCount: number;
}

export default function JobsPage() {
  const { userId, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<JobWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchJobs = async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/recruiter/jobs?userId=${userId}`);
        const result = await response.json();

        if (result.success) {
          setJobs(result.data as JobWithCount[]);
        } else {
          console.error("Failed to fetch jobs:", result.error);
          setJobs([]);
        }
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [userId, authLoading]);

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-brand-green/10 text-brand-green">招聘中</Badge>
    ) : (
      <Badge variant="outline" className="text-gray-500 border-gray-300">已关闭</Badge>
    );
  };

  const getSalaryDisplay = (job: Job) => {
    if (job.salary_min == null || job.salary_max == null) return null;
    return (
      <span style={{ color: "#FD742D" }}>
        ¥{job.salary_min} - ¥{job.salary_max}/{job.salary_unit || "月"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" label="加载中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#185A56" }}>
            岗位列表
          </h1>
          <p className="text-gray-600 mt-2">管理您发布和负责的岗位</p>
        </div>
        <Link href="/recruiter/jobs/new">
          <Button className="bg-[#185A56] hover:bg-[#124441]">
            <PlusCircle size={18} />
            发布新岗位
          </Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="暂无岗位"
          description="您还没有发布或负责任何岗位"
          action={
            <Link href="/recruiter/jobs/new">
              <Button className="bg-[#185A56] hover:bg-[#124441]">发布第一个岗位</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    {getStatusBadge(job.is_active)}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{DOMAIN_LABELS[job.domain]}</Badge>
                    <Badge variant="outline">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{job.location}</span>
                    {getSalaryDisplay(job)}
                  </div>
                </div>
                <div className="text-right ml-6">
                  <div className="text-2xl font-bold" style={{ color: "#185A56" }}>
                    {job.applicationCount}
                  </div>
                  <div className="text-xs text-gray-500">份投递</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}