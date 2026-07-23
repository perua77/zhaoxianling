"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserPlus, ArrowRight, Calendar, Briefcase } from "lucide-react";

interface ReferralRecord {
  id: string;
  candidate_name: string;
  candidate_phone: string;
  job_title: string;
  job_id: string;
  status: string;
  application_id?: string;
  application_status?: string;
  created_at: string;
}

interface Stats {
  total: number;
  applied: number;
  hired: number;
}

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  referred: "已推荐",
  applied: "已投递",
  hired: "已录用",
};

const REFERRAL_STATUS_COLORS: Record<string, string> = {
  referred: "bg-blue-100 text-blue-700",
  applied: "bg-yellow-100 text-yellow-700",
  hired: "bg-green-100 text-green-700",
};

export default function ReferralsPage() {
  const { userId, loading: authLoading } = useAuth();
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !userId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/recruiter/referrals?userId=${userId}`);
        const result = await response.json();

        if (result.success) {
          setReferrals(result.data.referrals || []);
          setStats(result.data.stats || { total: 0, applied: 0, hired: 0 });
        }
      } catch (error) {
        console.error("Failed to fetch referrals:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, authLoading]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone || "未填写";
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  };

  if (loading || authLoading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingSpinner size="lg" label="加载中..." className="py-20" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "#185A56" }}>
          我的推荐
        </h1>
        <p className="text-gray-600 mt-2">追踪你的推荐记录和状态</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">总推荐数</p>
                <p className="text-2xl font-bold mt-1">{stats?.total || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <UserPlus size={24} className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">已投递数</p>
                <p className="text-2xl font-bold mt-1">{stats?.applied || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Briefcase size={24} className="text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">已录用数</p>
                <p className="text-2xl font-bold mt-1">{stats?.hired || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <ArrowRight size={24} className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {referrals.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="还没有推荐记录"
          description="去看看岗位，推荐合适的候选人吧"
          action={<Button onClick={() => window.location.href = "/jobs"}>去看看岗位</Button>}
        />
      ) : (
        <div className="space-y-4">
          {referrals.map((referral) => (
            <Card key={referral.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{referral.candidate_name}</h3>
                      <Badge className={REFERRAL_STATUS_COLORS[referral.status]}>
                        {REFERRAL_STATUS_LABELS[referral.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">推荐岗位：</span>
                      {referral.job_title}
                    </p>
                    <p className="text-sm text-gray-500 mb-1">
                      <span className="font-medium">联系方式：</span>
                      {maskPhone(referral.candidate_phone)}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar size={14} />
                      推荐时间：{formatDate(referral.created_at)}
                    </p>
                    {referral.application_status && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">投递状态：</span>
                        {referral.application_status}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      查看详情
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}