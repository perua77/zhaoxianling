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
import { Briefcase } from "lucide-react";



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
      try {
        console.log("[API] Fetching jobs from server API...");
        const response = await fetch("/api/test-supabase");
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          console.log("[API] Found", result.data.length, "jobs from Supabase");
          setJobs(result.data as Job[]);
        } else {
          console.log("[API] No data found");
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
      <div className="container mx-auto p-6">
        <LoadingSpinner size="lg" label="加载中..." className="py-20" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-green">招贤令</h1>
        <p className="text-gray-600 mt-2">找到适合你的工作机会</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <Card key={job.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl">{job.title}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="brand-green">
                  {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
                </Badge>
                <Badge variant="muted">
                  {DOMAIN_LABELS[job.domain]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-2">{job.location}</p>
              {job.salary_min != null && job.salary_max != null && (
                <p className="text-lg font-semibold text-brand-orange mb-4">
                  ¥{job.salary_min} - ¥{job.salary_max}/
                  {job.salary_unit || getSalaryUnit(job.employment_type)}
                </p>
              )}
              <p className="text-sm text-gray-700 line-clamp-2 mb-4">
                {job.description}
              </p>
              <Link href={`/jobs/${job.id}`}>
                <Button variant="primary" className="w-full">
                  查看详情
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {jobs.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="暂无招聘中的岗位"
          description="请稍后再来看看更多工作机会"
        />
      )}
    </div>
  );
}
