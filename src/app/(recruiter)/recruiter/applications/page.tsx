"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ChevronDown, ClipboardList } from "lucide-react";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import type { ApplicationStatus } from "@/lib/types";

interface AdminUser {
  id: string;
  full_name: string;
  phone: string;
  roles: string[];
}

interface InterviewRecord {
  id: string;
  application_id: string;
  job_id: string;
  interviewer_id: string;
  scheduled_at: string;
  location: string;
  contact_person?: string;
  contact_phone?: string;
  status: string;
  result?: string;
  evaluation?: string;
}

interface ApplicationWithJob {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  full_name?: string;
  phone?: string;
  email?: string;
  gender?: string;
  age?: number;
  self_introduction?: string;
  assigned_recruiter_id?: string;
  created_at: string;
  updated_at: string;
  job_title?: string;
  interviews?: InterviewRecord[];
}

export default function ApplicationsPage() {
  const { userId, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [interviewModal, setInterviewModal] = useState<{ applicationId: string; candidateName: string } | null>(null);
  const [interviewForm, setInterviewForm] = useState({
    scheduled_at: "",
    location: "",
    interviewer_id: "",
    contact_person: "",
    contact_phone: "",
  });
  const [feedbackModal, setFeedbackModal] = useState<{ applicationId: string; candidateName: string } | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    result: "",
    evaluation: "",
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      try {
        const [appsResponse, usersResponse] = await Promise.all([
          fetch(`/api/recruiter/applications?userId=${userId}`),
          fetch("/api/recruiter/users"),
        ]);

        const appsResult = await appsResponse.json();
        const usersResult = await usersResponse.json();

        if (appsResult.success) {
          setApplications(appsResult.data as ApplicationWithJob[]);
        } else {
          console.error("Failed to fetch applications:", appsResult.error);
          setApplications([]);
        }

        if (usersResult.success) {
          setAdminUsers(usersResult.data as AdminUser[]);
        } else {
          console.error("Failed to fetch admin users:", usersResult.error);
          setAdminUsers([]);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setApplications([]);
        setAdminUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, authLoading]);

  const handleAction = async (action: string, body: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/recruiter/applications?action=${action}&userId=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (result.success) {
        setToast({ message: result.message, type: "success" });
      } else {
        setToast({ message: result.error || result.message, type: "error" });
      }

      return result;
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "操作失败",
        type: "error",
      });
      return { success: false };
    }
  };

  const handleClaim = async (applicationId: string) => {
    if (!userId) return;

    const result = await handleAction("claim", { applicationId });

    if (result.success) {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId
            ? { ...app, assigned_recruiter_id: userId, status: "reviewing" }
            : app
        )
      );
    }

    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateStatus = async (applicationId: string, newStatus: ApplicationStatus) => {
    const result = await handleAction("update-status", { applicationId, status: newStatus });

    if (result.success) {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      );
    }

    setTimeout(() => setToast(null), 3000);
  };

  const handleScheduleInterview = async () => {
    if (!interviewModal || !userId) return;

    const jobId = applications.find((a) => a.id === interviewModal.applicationId)?.job_id;
    
    const result = await handleAction("schedule-interview", {
      applicationId: interviewModal.applicationId,
      jobId,
      scheduled_at: interviewForm.scheduled_at,
      location: interviewForm.location,
      interviewer_id: interviewForm.interviewer_id || userId,
      contact_person: interviewForm.contact_person,
      contact_phone: interviewForm.contact_phone,
    });

    if (result.success) {
      setInterviewModal(null);
      setInterviewForm({
        scheduled_at: "",
        location: "",
        interviewer_id: "",
        contact_person: "",
        contact_phone: "",
      });
    }

    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackModal) return;

    const result = await handleAction("submit-interview-result", {
      applicationId: feedbackModal.applicationId,
      result: feedbackForm.result,
      evaluation: feedbackForm.evaluation,
    });

    if (result.success) {
      setFeedbackModal(null);
      setFeedbackForm({
        result: "",
        evaluation: "",
      });
    }

    setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getGenderLabel = (gender?: string) => {
    if (!gender) return "保密";
    if (gender === "男" || gender === "male") return "男";
    if (gender === "女" || gender === "female") return "女";
    return "保密";
  };

  const getInterviewerName = (interviewerId: string) => {
    const user = adminUsers.find((u) => u.id === interviewerId);
    return user?.full_name || "未知";
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "#185A56" }}>
          投递管理
        </h1>
        <p className="text-gray-600 mt-2">查看和处理候选人投递记录</p>
      </div>

      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all ${
            toast.type === "success"
              ? "bg-brand-green text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {interviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">安排面试</h3>
            <p className="text-gray-600 mb-4">
              为 {interviewModal.candidateName} 安排面试
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scheduled_at">面试时间</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={interviewForm.scheduled_at}
                    onChange={(e) =>
                      setInterviewForm({ ...interviewForm, scheduled_at: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="location">面试地点</Label>
                  <Input
                    id="location"
                    placeholder="请输入面试地点"
                    value={interviewForm.location}
                    onChange={(e) =>
                      setInterviewForm({ ...interviewForm, location: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interviewer">面试人</Label>
                  <Select
                    value={interviewForm.interviewer_id}
                    onValueChange={(value) =>
                      setInterviewForm({ ...interviewForm, interviewer_id: value })
                    }
                  >
                    <SelectTrigger id="interviewer">
                      <SelectValue placeholder="请选择面试人" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contact_person">面试联系人</Label>
                  <Select
                    value={interviewForm.contact_person}
                    onValueChange={(value) => {
                      const selectedUser = adminUsers.find((u) => u.id === value);
                      setInterviewForm({
                        ...interviewForm,
                        contact_person: selectedUser?.full_name || "",
                        contact_phone: selectedUser?.phone || "",
                      });
                    }}
                  >
                    <SelectTrigger id="contact_person">
                      <SelectValue placeholder="请选择联系人" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="contact_phone">联系人电话</Label>
                <Input
                  id="contact_phone"
                  readOnly
                  value={interviewForm.contact_phone}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInterviewModal(null)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button type="button" onClick={handleScheduleInterview} className="flex-1">
                  确认安排
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {feedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">面试反馈</h3>
            <p className="text-gray-600 mb-4">
              为 {feedbackModal.candidateName} 提交面试结果
            </p>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">面试结果</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={feedbackForm.result === "pass" ? "default" : "outline"}
                    className={feedbackForm.result === "pass" ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => setFeedbackForm({ ...feedbackForm, result: "pass" })}
                  >
                    面试通过
                  </Button>
                  <Button
                    type="button"
                    variant={feedbackForm.result === "fail" ? "default" : "outline"}
                    className={feedbackForm.result === "fail" ? "bg-red-600 hover:bg-red-700" : ""}
                    onClick={() => setFeedbackForm({ ...feedbackForm, result: "fail" })}
                  >
                    面试未通过
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="evaluation">面试评价（可选）</Label>
                <Textarea
                  id="evaluation"
                  placeholder="请输入面试评价"
                  value={feedbackForm.evaluation}
                  onChange={(e) =>
                    setFeedbackForm({ ...feedbackForm, evaluation: e.target.value })
                  }
                  rows={4}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFeedbackModal(null)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button type="button" onClick={handleSubmitFeedback} className="flex-1" disabled={!feedbackForm.result}>
                  提交反馈
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="暂无投递记录"
          description="没有候选人投递您负责的岗位"
        />
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const isExpanded = expandedId === app.id;
            const isClaimed = app.assigned_recruiter_id === userId;
            const canClaim = !app.assigned_recruiter_id;
            const hasScheduledInterview = app.interviews?.some(i => i.status === "scheduled");
            const hasCompletedInterview = app.interviews?.some(i => i.status === "completed");

            return (
              <Card key={app.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{app.full_name}</h3>
                        <Badge className={APPLICATION_STATUS_COLORS[app.status]}>
                          {APPLICATION_STATUS_LABELS[app.status]}
                        </Badge>
                        {app.assigned_recruiter_id && !isClaimed && (
                          <Badge variant="outline" className="text-gray-500">
                            已被其他人认领
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-gray-600">{app.job_title}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-sm text-gray-600">{formatDate(app.created_at)}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      className="p-2"
                    >
                      <ChevronDown
                        size={20}
                        className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">联系方式</p>
                          <p className="font-medium">{app.phone}</p>
                          <p className="text-sm text-gray-600">{app.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">基本信息</p>
                          <p className="font-medium">
                            {getGenderLabel(app.gender)} {app.age}岁
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">岗位</p>
                          <p className="font-medium">{app.job_title}</p>
                        </div>
                      </div>

                      {app.self_introduction && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500">自我介绍</p>
                          <p className="text-sm text-gray-600 mt-1">{app.self_introduction}</p>
                        </div>
                      )}

                      {app.interviews && app.interviews.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-2">面试安排</p>
                          <div className="space-y-2">
                            {app.interviews.map((interview, index) => (
                              <div key={interview.id} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">第{index + 1}轮面试</span>
                                  <Badge className={interview.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                                    {interview.status === "scheduled" ? "待面试" : "已完成"}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-600 mt-1 space-y-1">
                                  <span>时间：{formatDate(interview.scheduled_at)}</span>
                                  <span>地点：{interview.location}</span>
                                  <span>面试官：{getInterviewerName(interview.interviewer_id)}</span>
                                  {interview.contact_person && <span>联系人：{interview.contact_person}</span>}
                                  {interview.contact_phone && <span>联系电话：{interview.contact_phone}</span>}
                                </div>
                                {interview.evaluation && (
                                  <div className="mt-2 text-xs text-gray-600">
                                    <span className="font-medium">面评：</span>{interview.evaluation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {canClaim && (
                          <Button
                            type="button"
                            onClick={() => handleClaim(app.id)}
                            className="bg-[#185A56] hover:bg-[#124441]"
                          >
                            认领此投递
                          </Button>
                        )}
                        {isClaimed && app.status === "reviewing" && (
                          <>
                            <Button
                              type="button"
                              onClick={() =>
                                setInterviewModal({
                                  applicationId: app.id,
                                  candidateName: app.full_name || "",
                                })
                              }
                            >
                              安排面试时间
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleUpdateStatus(app.id, "rejected")}
                            >
                              拒绝
                            </Button>
                          </>
                        )}
                        {(app.status === "interview-scheduled" || app.status === "interviewing") && (
                          <>
                            <Button
                              type="button"
                              onClick={() =>
                                setInterviewModal({
                                  applicationId: app.id,
                                  candidateName: app.full_name || "",
                                })
                              }
                            >
                              安排面试时间
                            </Button>
                            <Button
                              type="button"
                              onClick={() =>
                                setFeedbackModal({
                                  applicationId: app.id,
                                  candidateName: app.full_name || "",
                                })
                              }
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              反馈面试结果
                            </Button>
                          </>
                        )}
                        {app.status === "interview-passed" && (
                          <>
                            <Button
                              type="button"
                              onClick={() => handleUpdateStatus(app.id, "offering")}
                              className="bg-yellow-600 hover:bg-yellow-700"
                            >
                              发放Offer
                            </Button>
                            <Button
                              type="button"
                              onClick={() => handleUpdateStatus(app.id, "hired")}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              直接录用
                            </Button>
                          </>
                        )}
                        {app.status === "offering" && (
                          <Button
                            type="button"
                            onClick={() => handleUpdateStatus(app.id, "hired")}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            确认录用
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}