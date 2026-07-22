"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface DashboardStats {
  activeJobs: number;
  totalJobs: number;
  totalApplications: number;
  pendingApplications: number;
  upcomingInterviews: number;
}

export default function DashboardPage() {
  const { userId, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/recruiter/dashboard?userId=${userId}`);
        const result = await response.json();

        if (result.success) {
          setStats(result.data as DashboardStats);
        } else {
          console.error("Failed to fetch dashboard stats:", result.error);
          setStats({
            activeJobs: 0,
            totalJobs: 0,
            totalApplications: 0,
            pendingApplications: 0,
            upcomingInterviews: 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        setStats({
          activeJobs: 0,
          totalJobs: 0,
          totalApplications: 0,
          pendingApplications: 0,
          upcomingInterviews: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId, authLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" label="加载中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "#185A56" }}>
          数据看板
        </h1>
        <p className="text-gray-600 mt-2">招聘数据概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">在岗岗位</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: "#185A56" }}>
              {stats?.activeJobs || 0}
              <span className="text-lg font-normal text-gray-400 ml-1">/ {stats?.totalJobs || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">总投递数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: "#185A56" }}>
              {stats?.totalApplications || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">待处理投递</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: "#FD742D" }}>
              {stats?.pendingApplications || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">待面试</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: "#185A56" }}>
              {stats?.upcomingInterviews || 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}