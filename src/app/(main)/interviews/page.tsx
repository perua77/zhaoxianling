"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Clock, MapPin, Phone, User, Briefcase, Calendar, CheckCircle, XCircle } from "lucide-react";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/lib/constants";

interface InterviewData {
  id: string;
  job_title: string;
  scheduled_at: string;
  location: string;
  contact_person?: string;
  contact_phone?: string;
  status: string;
  result?: string;
  evaluation?: string;
  application_status?: string;
}

const INTERVIEW_STATUS_LABELS: Record<string, string> = {
  scheduled: "待面试",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "未到场",
};

const INTERVIEW_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

const INTERVIEW_RESULT_LABELS: Record<string, string> = {
  pass: "面试通过",
  fail: "面试未通过",
  pending: "待评定",
};

const INTERVIEW_RESULT_COLORS: Record<string, string> = {
  pass: "bg-green-100 text-green-700",
  fail: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
};

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInterviews() {
      const supabase = createClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/candidate/interviews?userId=${user.id}`);
        const result = await response.json();

        if (result.success && result.data) {
          setInterviews(result.data as InterviewData[]);
        }
      } catch (err) {
        console.warn("Error fetching interviews:", err);
      }
      setLoading(false);
    }

    fetchInterviews();
  }, []);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDisplayLabel = (interview: InterviewData) => {
    if (interview.result === "pass") return INTERVIEW_RESULT_LABELS.pass;
    if (interview.result === "fail") return INTERVIEW_RESULT_LABELS.fail;
    return INTERVIEW_STATUS_LABELS[interview.status] || interview.status;
  };

  const getDisplayColor = (interview: InterviewData) => {
    if (interview.result === "pass") return INTERVIEW_RESULT_COLORS.pass;
    if (interview.result === "fail") return INTERVIEW_RESULT_COLORS.fail;
    return INTERVIEW_STATUS_COLORS[interview.status] || "bg-gray-100 text-gray-500";
  };

  if (loading) {
    return <div className="container mx-auto p-6">加载中...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-green">我的面试</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看你的面试安排和进度</p>
      </header>

      {interviews.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">暂无面试安排</p>
        </div>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview) => (
            <Card key={interview.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-5 w-5 text-brand-green" />
                      <h3 className="text-lg font-semibold">{interview.job_title}</h3>
                      <Badge className={getDisplayColor(interview)}>
                        {getDisplayLabel(interview)}
                      </Badge>
                    </div>
                    {interview.application_status && (
                      <div className="mt-2">
                        <Badge variant="outline" className={(APPLICATION_STATUS_COLORS as Record<string, string>)[interview.application_status] || ""}>
                          申请状态：{(APPLICATION_STATUS_LABELS as Record<string, string>)[interview.application_status] || interview.application_status}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {interview.result === "pass" && (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  )}
                  {interview.result === "fail" && (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">面试时间</p>
                      <p className="font-medium">{formatDateTime(interview.scheduled_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">面试地点</p>
                      <p className="font-medium">{interview.location || "未指定"}</p>
                    </div>
                  </div>

                  {interview.contact_person && (
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">面试联系人</p>
                        <p className="font-medium">{interview.contact_person}</p>
                      </div>
                    </div>
                  )}

                  {interview.contact_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">联系电话</p>
                        <p className="font-medium">{interview.contact_phone}</p>
                      </div>
                    </div>
                  )}

                  {interview.evaluation && interview.result && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">面试官评价</p>
                      <p className="text-sm text-gray-700 mt-1">{interview.evaluation}</p>
                    </div>
                  )}
                </div>

                {interview.status === "scheduled" && !interview.result && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      请准时参加面试，如有特殊情况请提前联系面试联系人。
                    </p>
                  </div>
                )}

                {interview.result === "pass" && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      恭喜！你已通过本次面试，请等待下一步通知。
                    </p>
                  </div>
                )}

                {interview.result === "fail" && (
                  <div className="mt-4 p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-700">
                      很遗憾，本次面试未通过。感谢你的参与，祝你早日找到合适的工作！
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}