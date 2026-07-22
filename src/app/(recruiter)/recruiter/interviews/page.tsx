"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Calendar, Clock, MapPin, FileText, CheckCircle2, ArrowRight, Phone, User, Briefcase } from "lucide-react";
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
  checked_in_at?: string;
  created_at: string;
}

interface TrialRecord {
  id: string;
  application_id: string;
  job_id: string;
  interviewer_id: string;
  start_date: string;
  end_date?: string;
  location: string;
  status: string;
  feedback?: string;
  confirmed_at?: string;
  is_hired?: boolean;
  created_at: string;
}

interface ApplicationWithProcess {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  full_name?: string;
  phone?: string;
  gender?: string;
  age?: number;
  assigned_recruiter_id?: string;
  created_at: string;
  job_title?: string;
  interviews: InterviewRecord[];
  trials: TrialRecord[];
}

type ExpandMode = "interview" | "trial" | "evaluation";

interface ExpandState {
  applicationId: string;
  mode: ExpandMode;
  interviewId?: string;
}

const INTERVIEW_STATUS_LABELS: Record<string, string> = {
  scheduled: "待面试",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "未到场",
};

const INTERVIEW_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-brand-green/10 text-brand-green",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

const INTERVIEW_RESULT_LABELS: Record<string, string> = {
  pass: "通过",
  fail: "未通过",
  pending: "待评定",
};

const INTERVIEW_RESULT_COLORS: Record<string, string> = {
  pass: "bg-green-100 text-green-700",
  fail: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
};

const TRIAL_STATUS_LABELS: Record<string, string> = {
  pending: "待确认",
  active: "试用中",
  completed: "已完成",
  terminated: "已终止",
};

const TRIAL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-brand-green/10 text-brand-green",
  completed: "bg-blue-100 text-blue-700",
  terminated: "bg-red-100 text-red-700",
};

export default function InterviewsPage() {
  const { userId, roles, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithProcess[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandState, setExpandState] = useState<ExpandState | null>(null);
  const [interviewForm, setInterviewForm] = useState({
    scheduled_at: "",
    location: "",
    interviewer_id: "",
    contact_person: "",
    contact_phone: "",
  });
  const [trialForm, setTrialForm] = useState({ start_date: "", end_date: "", location: "" });
  const [evaluationText, setEvaluationText] = useState("");
  const [interviewResult, setInterviewResult] = useState<string>("");
  const [trialFeedback, setTrialFeedback] = useState("");
  const [hireConfirmModal, setHireConfirmModal] = useState<string | null>(null);

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
        const userRole = roles.includes("interviewer") && !roles.includes("recruiter") ? "interviewer" : "recruiter";
        const [interviewsResponse, usersResponse] = await Promise.all([
          fetch(`/api/recruiter/interviews?userId=${userId}&role=${userRole}`),
          fetch("/api/recruiter/users"),
        ]);

        const interviewsResult = await interviewsResponse.json();
        const usersResult = await usersResponse.json();

        if (interviewsResult.success) {
          setApplications(interviewsResult.data as ApplicationWithProcess[]);
        } else {
          console.error("Failed to fetch interviews:", interviewsResult.error);
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
      const response = await fetch(`/api/recruiter/interviews?action=${action}&userId=${userId}`, {
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
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "操作失败",
        type: "error",
      });
    }
    setTimeout(() => setToast(null), 3000);
  };

  const handleScheduleInterview = async (applicationId: string, jobId: string) => {
    await handleAction("schedule-interview", {
      applicationId,
      jobId,
      scheduled_at: interviewForm.scheduled_at,
      location: interviewForm.location,
      interviewer_id: interviewForm.interviewer_id || userId,
      contact_person: interviewForm.contact_person,
      contact_phone: interviewForm.contact_phone,
    });
    setExpandState(null);
    setInterviewForm({
      scheduled_at: "",
      location: "",
      interviewer_id: "",
      contact_person: "",
      contact_phone: "",
    });
  };

  const handleSubmitEvaluation = async (interviewId: string) => {
    await handleAction("submit-evaluation", {
      interviewId,
      evaluation: evaluationText,
      result: interviewResult,
    });
    setExpandState(null);
    setEvaluationText("");
    setInterviewResult("");
  };

  const handleScheduleTrial = async (applicationId: string, jobId: string) => {
    await handleAction("schedule-trial", {
      applicationId,
      jobId,
      start_date: trialForm.start_date,
      end_date: trialForm.end_date,
      location: trialForm.location,
    });
    setExpandState(null);
    setTrialForm({ start_date: "", end_date: "", location: "" });
  };

  const handleSubmitTrialFeedback = async (trialId: string) => {
    await handleAction("submit-trial-feedback", {
      trialId,
      feedback: trialFeedback,
    });
    setExpandState(null);
    setTrialFeedback("");
  };

  const handleHire = async (applicationId: string, jobId: string) => {
    await handleAction("hire", {
      applicationId,
      jobId,
    });
    setHireConfirmModal(null);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getProcessStep = (app: ApplicationWithProcess) => {
    const hasCompletedInterview = app.interviews.some((i) => i.status === "completed");
    const hasActiveTrial = app.trials.some((t) => t.status === "active" || t.status === "pending");
    const hasCompletedTrial = app.trials.some((t) => t.status === "completed");
    const isOffering = app.status === "offering";
    const isHired = app.status === "hired" || app.status === "accepted";

    if (isHired) return 5;
    if (isOffering) return 4;
    if (hasCompletedTrial) return 3;
    if (hasActiveTrial) return 3;
    if (hasCompletedInterview) return 2;
    if (app.interviews.length > 0) return 2;
    return 1;
  };

  const ProcessSteps = [
    { label: "投递", icon: FileText },
    { label: "面试", icon: Clock },
    { label: "试岗", icon: Calendar },
    { label: "Offering", icon: Briefcase },
    { label: "录用", icon: CheckCircle2 },
  ];

  const getInterviewerName = (interviewerId: string) => {
    const user = adminUsers.find((u) => u.id === interviewerId);
    return user?.full_name || "未知";
  };

  const getGenderLabel = (gender?: string) => {
    if (!gender) return "保密";
    if (gender === "男" || gender === "male") return "男";
    if (gender === "女" || gender === "female") return "女";
    return "保密";
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
          面试安排
        </h1>
        <p className="text-gray-600 mt-2">管理面试、试岗和录用流程</p>
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

      {hireConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">确认录用</h3>
            <p className="text-gray-600 mb-6">确认录用该候选人？</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setHireConfirmModal(null)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  const app = applications.find((a) => a.id === hireConfirmModal);
                  if (app) handleHire(app.id, app.job_id);
                }}
              >
                确认录用
              </Button>
            </div>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="暂无面试安排"
          description="没有需要处理的面试、试岗或录用记录"
        />
      ) : (
        <div className="space-y-6">
          {applications.map((app) => {
            const processStep = getProcessStep(app);
            const latestInterview = app.interviews[app.interviews.length - 1];
            const latestTrial = app.trials[app.trials.length - 1];
            const canScheduleInterview =
              !latestInterview || ["completed", "cancelled", "no_show"].includes(latestInterview.status);
            const canScheduleTrial = !latestTrial && latestInterview?.status === "completed";
            const canHire =
              (latestTrial?.status === "completed" || (!latestTrial && latestInterview?.status === "completed")) &&
              !latestTrial?.is_hired;

            return (
              <Card key={app.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{app.full_name}</h3>
                        <Badge className={APPLICATION_STATUS_COLORS[app.status]}>
                          {APPLICATION_STATUS_LABELS[app.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        投递岗位：{app.job_title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {getGenderLabel(app.gender)} {app.age}岁 | {app.phone}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center justify-between">
                      {ProcessSteps.map((step, index) => {
                        const Icon = step.icon;
                        const isCompleted = index < processStep;
                        const isCurrent = index === processStep - 1;

                        return (
                          <div key={step.label} className="flex items-center">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                                isCompleted
                                  ? "bg-brand-green text-white"
                                  : isCurrent
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-200 text-gray-400"
                              }`}
                            >
                              <Icon size={16} />
                            </div>
                            <span
                              className={`ml-2 text-sm ${
                                isCompleted
                                  ? "text-brand-green font-medium"
                                  : isCurrent
                                  ? "text-blue-500 font-medium"
                                  : "text-gray-400"
                              }`}
                            >
                              {step.label}
                              {step.label === "面试" && app.interviews.length > 0 && (
                                <span className="ml-1">(第{app.interviews.length}轮)</span>
                              )}
                            </span>
                            {index < ProcessSteps.length - 1 && (
                              <ArrowRight
                                size={16}
                                className={`ml-4 ${
                                  isCompleted ? "text-brand-green" : "text-gray-300"
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">面试记录</h4>
                      {app.interviews.length === 0 ? (
                        <div className="text-gray-500 text-sm mb-3">暂无面试记录</div>
                      ) : (
                        <div className="space-y-3">
                          {app.interviews.map((interview, index) => (
                            <div
                              key={interview.id}
                              className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">第{index + 1}轮面试</span>
                                  <Badge className={INTERVIEW_STATUS_COLORS[interview.status]}>
                                    {INTERVIEW_STATUS_LABELS[interview.status]}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-600 mt-1 space-y-1">
                                  <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {formatDateTime(interview.scheduled_at)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin size={14} />
                                    {interview.location}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User size={14} />
                                    面试官：{getInterviewerName(interview.interviewer_id)}
                                  </span>
                                  {interview.contact_person && (
                                    <span className="flex items-center gap-1">
                                      <User size={14} />
                                      联系人：{interview.contact_person}
                                    </span>
                                  )}
                                  {interview.contact_phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone size={14} />
                                      联系电话：{interview.contact_phone}
                                    </span>
                                  )}
                                </div>
                                {interview.evaluation && (
                                  <div className="mt-2 text-sm text-gray-600 bg-white p-2 rounded">
                                    <span className="font-medium">面评：</span>
                                    {interview.evaluation}
                                  </div>
                                )}
                                {!interview.result && (
                                  <div className="mt-2">
                                    {expandState?.applicationId === app.id &&
                                      expandState?.mode === "evaluation" &&
                                      expandState?.interviewId === interview.id ? (
                                      <div className="space-y-2">
                                        <div className="flex gap-2">
                                          <Button
                                            type="button"
                                            variant={interviewResult === "pass" ? "default" : "outline"}
                                            className={interviewResult === "pass" ? "bg-green-600 hover:bg-green-700" : ""}
                                            onClick={() => setInterviewResult("pass")}
                                          >
                                            面试通过
                                          </Button>
                                          <Button
                                            type="button"
                                            variant={interviewResult === "fail" ? "default" : "outline"}
                                            className={interviewResult === "fail" ? "bg-red-600 hover:bg-red-700" : ""}
                                            onClick={() => setInterviewResult("fail")}
                                          >
                                            面试未通过
                                          </Button>
                                        </div>
                                        <Textarea
                                          value={evaluationText}
                                          onChange={(e) => setEvaluationText(e.target.value)}
                                          placeholder="请输入面评"
                                          rows={3}
                                        />
                                        <Button
                                          type="button"
                                          onClick={() => handleSubmitEvaluation(interview.id)}
                                          className="w-full"
                                          disabled={!interviewResult}
                                        >
                                          提交面评
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          setExpandState({
                                            applicationId: app.id,
                                            mode: "evaluation",
                                            interviewId: interview.id,
                                          })
                                        }
                                      >
                                        反馈面试结果
                                      </Button>
                                    )}
                                  </div>
                                )}
                                {interview.result && (
                                  <div className="mt-2">
                                    <Badge className={INTERVIEW_RESULT_COLORS[interview.result]}>
                                      面试结果：{INTERVIEW_RESULT_LABELS[interview.result]}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {canScheduleInterview && (
                        <div className="mt-3">
                          {expandState?.applicationId === app.id &&
                          expandState?.mode === "interview" ? (
                            <div className="space-y-3">
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
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="contact_phone">联系人电话</Label>
                                  <Input
                                    id="contact_phone"
                                    readOnly
                                    value={interviewForm.contact_phone}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setExpandState(null)}
                                >
                                  取消
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => handleScheduleInterview(app.id, app.job_id)}
                                >
                                  {app.interviews.length > 0 ? "安排下一轮面试" : "安排面试"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setExpandState({ applicationId: app.id, mode: "interview" })
                              }
                            >
                              {app.interviews.length > 0 ? "安排下一轮面试" : "安排面试"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {latestTrial && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">试岗记录</h4>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={TRIAL_STATUS_COLORS[latestTrial.status]}>
                              {TRIAL_STATUS_LABELS[latestTrial.status]}
                            </Badge>
                            {latestTrial.is_hired && (
                              <Badge className="bg-brand-green/10 text-brand-green">已录用</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar size={14} />
                              开始日期：{formatDate(latestTrial.start_date)}
                            </span>
                            {latestTrial.end_date && (
                              <span className="flex items-center gap-1 ml-4">
                                <Calendar size={14} />
                                结束日期：{formatDate(latestTrial.end_date)}
                              </span>
                            )}
                            <span className="flex items-center gap-1 ml-4">
                              <MapPin size={14} />
                              {latestTrial.location}
                            </span>
                          </div>
                          {latestTrial.feedback && (
                            <div className="mt-2 text-sm text-gray-600 bg-white p-2 rounded">
                              <span className="font-medium">试岗反馈：</span>
                              {latestTrial.feedback}
                            </div>
                          )}
                          {latestTrial.status === "completed" && !latestTrial.feedback && (
                            <div className="mt-2">
                              {expandState?.applicationId === app.id &&
                              expandState?.mode === "trial" ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={trialFeedback}
                                    onChange={(e) => setTrialFeedback(e.target.value)}
                                    placeholder="请输入试岗反馈"
                                    rows={3}
                                  />
                                  <Button
                                    type="button"
                                    onClick={() => handleSubmitTrialFeedback(latestTrial.id)}
                                    className="w-full"
                                  >
                                    提交反馈
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setExpandState({ applicationId: app.id, mode: "trial" })
                                  }
                                >
                                  填写试岗反馈
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {canScheduleTrial && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">试岗安排</h4>
                        {expandState?.applicationId === app.id && expandState?.mode === "trial" ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="start_date">开始日期</Label>
                                <Input
                                  id="start_date"
                                  type="date"
                                  value={trialForm.start_date}
                                  onChange={(e) =>
                                    setTrialForm({ ...trialForm, start_date: e.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <Label htmlFor="end_date">结束日期（可选）</Label>
                                <Input
                                  id="end_date"
                                  type="date"
                                  value={trialForm.end_date}
                                  onChange={(e) =>
                                    setTrialForm({ ...trialForm, end_date: e.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <Label htmlFor="trial_location">试岗地点</Label>
                                <Input
                                  id="trial_location"
                                  placeholder="请输入试岗地点"
                                  value={trialForm.location}
                                  onChange={(e) =>
                                    setTrialForm({ ...trialForm, location: e.target.value })
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setExpandState(null)}
                              >
                                取消
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleScheduleTrial(app.id, app.job_id)}
                              >
                                安排试岗
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setExpandState({ applicationId: app.id, mode: "trial" })
                            }
                          >
                            安排试岗（可选）
                          </Button>
                        )}
                      </div>
                    )}

                    {canHire && (
                      <div className="border-t pt-4 space-y-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => handleAction("offer", { applicationId: app.id })}
                        >
                          发起Offer流程
                        </Button>
                        <Button
                          type="button"
                          className="w-full"
                          onClick={() => setHireConfirmModal(app.id)}
                        >
                          直接录用
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}