"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";

import { USER_ROLE_LABELS } from "@/lib/constants";
import {beijingLocalToUtcISO } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Combobox, type ComboboxItem } from "@/components/ui/Combobox";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { InterviewCard } from "@/components/interview-card";
import { OnboardingFormDialog, type OnboardingFormPayload } from "@/components/recruiter/onboarding-form-dialog";
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
  contact_person_id?: string;
  contact_person?: string;
  contact_phone?: string;
  status: string;
  result?: string;
  evaluation?: string;
  checked_in_at?: string;
  created_at: string;
  response_status?: string;
  response_reason?: string;
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
  updated_at?: string;
  job_title?: string;
  interviews: InterviewRecord[];
  trials: TrialRecord[];
}

type ExpandMode = "interview" | "trial" | "evaluation";

interface ExpandState {
  applicationId: string;
  mode: ExpandMode;
  interviewId?: string;
  reschedule?: boolean;
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

const RESPONSE_STATUS_LABELS: Record<string, string> = {
  pending: "待响应",
  accepted: "已接受",
  rejected: "已拒绝",
};

const RESPONSE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const TRIAL_STATUS_LABELS: Record<string, string> = {
  pending: "待确认",
  confirmed: "试岗中",
  active: "试岗中",
  completed: "已完成",
  cancelled: "已终止",
  terminated: "已终止",
};

const TRIAL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-brand-green/10 text-brand-green",
  active: "bg-brand-green/10 text-brand-green",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  terminated: "bg-red-100 text-red-700",
};

const FILTER_OPTIONS = [
  { value: "", label: "全部" },
  { value: "scheduled", label: "待面试" },
  { value: "pending_eval", label: "待评价" },
  { value: "pass", label: "面试通过" },
  { value: "fail", label: "面试未通过" },
  { value: "cancelled", label: "面试取消" },
  { value: "no_show", label: "未到场" },
  { value: "trial_active", label: "试岗中" },
  { value: "hired", label: "已录用" },
];

const SORT_OPTIONS = [
  { value: "scheduled_at_desc", label: "面试时间倒序" },
  { value: "scheduled_at_asc", label: "面试时间正序" },
  { value: "updated_at_desc", label: "进入当前阶段时间倒序" },
  { value: "updated_at_asc", label: "进入当前阶段时间正序" },
];

export function InterviewsPageContent({ embedded = false }: { embedded?: boolean } = {}) {
  const { userId, roles, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<ApplicationWithProcess[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get("status") || "");
  const [sortBy, setSortBy] = useState(() => searchParams.get("sort") || "scheduled_at_desc");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandState, setExpandState] = useState<ExpandState | null>(null);
  const [interviewForm, setInterviewForm] = useState({
    scheduled_at: "",
    location: "",
    interviewer_id: "",
    contact_person_id: "",
    contact_person: "",
    contact_phone: "",
  });
  const [trialForm, setTrialForm] = useState({ start_date: "", start_hour: "09", end_date: "", end_hour: "18", location: "" });
  const [evaluationText, setEvaluationText] = useState("");
  const [interviewResult, setInterviewResult] = useState<string>("");
  const [trialFeedback, setTrialFeedback] = useState("");
  const [trialResult, setTrialResult] = useState<"pass" | "fail" | "">("");
  const [trialHireApp, setTrialHireApp] = useState<{ applicationId: string; jobId: string } | null>(null);
  const [hireConfirmModal, setHireConfirmModal] = useState<string | null>(null);
  const [hireSubmitting, setHireSubmitting] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ interviewId: string; application: ApplicationWithProcess } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 已结束流程折叠卡片：记录被用户点击展开的 applicationId
  const [expandedTerminated, setExpandedTerminated] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

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
  }, [userId, roles]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    fetchData();
  }, [authLoading, fetchData]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (sortBy !== "scheduled_at_desc") params.set("sort", sortBy);
    const paramString = params.toString();
    router.replace(paramString ? `?${paramString}` : window.location.pathname, { scroll: false });
  }, [filterStatus, sortBy, router]);

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
    if (submitting) return; // 防止重复提交
    setSubmitting(true);
    try {
      const isReschedule = expandState?.reschedule && expandState?.interviewId;
      if (isReschedule) {
        await handleAction("reschedule-interview", {
          interviewId: expandState.interviewId,
          scheduled_at: beijingLocalToUtcISO(interviewForm.scheduled_at),
          location: interviewForm.location,
          interviewer_id: interviewForm.interviewer_id || userId,
          contact_person: interviewForm.contact_person,
          contact_phone: interviewForm.contact_phone,
        });
      } else {
        await handleAction("schedule-interview", {
          applicationId,
          jobId,
          scheduled_at: beijingLocalToUtcISO(interviewForm.scheduled_at),
          location: interviewForm.location,
          interviewer_id: interviewForm.interviewer_id || userId,
          contact_person: interviewForm.contact_person,
          contact_phone: interviewForm.contact_phone,
        });
      }
      setExpandState(null);
      setInterviewForm({
        scheduled_at: "",
        location: "",
        interviewer_id: "",
        contact_person_id: "",
        contact_person: "",
        contact_phone: "",
      });
      // 提交成功后刷新数据，避免用户看到旧状态而重复提交
      await fetchData();
    } finally {
      setSubmitting(false);
    }
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
    const start_date = trialForm.start_date
      ? `${trialForm.start_date}T${trialForm.start_hour}:00:00+08:00`
      : "";
    await handleAction("schedule-trial", {
      applicationId,
      jobId,
      start_date,
      end_date: trialForm.end_date
        ? `${trialForm.end_date}T${trialForm.end_hour}:00:00+08:00`
        : null,
      location: trialForm.location,
    });
    setExpandState(null);
    setTrialForm({ start_date: "", start_hour: "09", end_date: "", end_hour: "18", location: "" });
  };

  const handleSubmitTrialFeedback = async (trialId: string) => {
    await handleAction("submit-trial-feedback", {
      trialId,
      feedback: trialFeedback,
      result: trialResult,
    });
    setExpandState(null);
    setTrialFeedback("");
    // 试岗通过且选择直接录用 → 弹出入职信息弹窗
    if (trialResult === "pass" && trialHireApp) {
      setHireConfirmModal(trialHireApp.applicationId);
    }
    setTrialResult("");
    setTrialHireApp(null);
  };

  const handleHire = async (applicationId: string, jobId: string, payload: OnboardingFormPayload) => {
    setHireSubmitting(true);
    await handleAction("hire", {
      applicationId,
      jobId,
      ...payload,
    });
    setHireSubmitting(false);
    setHireConfirmModal(null);
    await fetchData();
  };

  const handleAcceptInterview = async (interviewId: string) => {
    await handleAction("accept-interview", { interviewId });
    fetchData();
  };

  const handleRejectInterview = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    await handleAction("reject-interview", {
      interviewId: rejectModal.interviewId,
      reason: rejectReason,
      candidateName: rejectModal.application.full_name,
    });
    setRejectModal(null);
    setRejectReason("");
    fetchData();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getProcessStep = (app: ApplicationWithProcess) => {
    const hasCompletedInterview = app.interviews.some((i) => i.status === "completed");
    const hasActiveTrial = app.trials.some((t) => t.status === "confirmed" || t.status === "active" || t.status === "pending");
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

  // 面试官选择器：只显示 roles 中包含 "interviewer" 的用户
  const interviewerItems = useMemo<ComboboxItem[]>(() => {
    return adminUsers
      .filter((user) => user.roles.includes("interviewer"))
      .map((user) => ({
        value: user.id,
        label: user.full_name || user.id,
        phone: user.phone,
        email: (user as { email?: string }).email,
      }));
  }, [adminUsers]);

  // 面试联系人选择器：显示拥有 candidate 以外任一角色的用户
  // （即排除 roles 仅为 ['candidate'] 的用户）
  const contactItems = useMemo<ComboboxItem[]>(() => {
    return adminUsers
      .filter((user) => {
        const roles = Array.isArray(user.roles) ? user.roles : [];
        return roles.some((role) =>
          ["recruiter", "interviewer", "referrer", "vendor"].includes(role)
        );
      })
      .map((user) => ({
        value: user.id,
        label: user.full_name || user.id,
        phone: user.phone,
        email: (user as { email?: string }).email,
      }));
  }, [adminUsers]);

  const getGenderLabel = (gender?: string) => {
    if (!gender) return "保密";
    if (gender === "男" || gender === "male") return "男";
    if (gender === "女" || gender === "female") return "女";
    return "保密";
  };

  const filteredApplications = applications.filter((app) => {
    if (!filterStatus) return true;
    
    const latestInterview = app.interviews[app.interviews.length - 1];
    const latestTrial = app.trials[app.trials.length - 1];
    
    switch (filterStatus) {
      case "scheduled":
        return latestInterview?.status === "scheduled";
      case "pending_eval":
        // 待评价：面试已完成但结果仍为 pending（status=completed 天然排除 cancelled/no_show）
        return latestInterview?.status === "completed" && latestInterview?.result === "pending";
      case "pass":
        return latestInterview?.result === "pass";
      case "fail":
        return latestInterview?.result === "fail";
      case "cancelled":
        return latestInterview?.status === "cancelled";
      case "no_show":
        return latestInterview?.status === "no_show";
      case "trial_active":
        return latestTrial?.status === "confirmed" || latestTrial?.status === "active";
      case "hired":
        return app.status === "hired" || app.status === "accepted";
      default:
        return true;
    }
  });

  const sortedApplications = [...filteredApplications].sort((a, b) => {
    const latestA = a.interviews[a.interviews.length - 1];
    const latestB = b.interviews[b.interviews.length - 1];
    
    let dateA: Date, dateB: Date;
    
    if (sortBy === "scheduled_at_desc" || sortBy === "scheduled_at_asc") {
      dateA = new Date(latestA?.scheduled_at || a.created_at || Date.now());
      dateB = new Date(latestB?.scheduled_at || b.created_at || Date.now());
    } else {
      dateA = new Date(a.updated_at || a.created_at || Date.now());
      dateB = new Date(b.updated_at || b.created_at || Date.now());
    }
    
    return sortBy.includes("desc") ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" label="加载中..." />
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "min-h-screen"}>
      {!embedded && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: "#185A56" }}>
            面试安排
          </h1>
          <p className="text-gray-600 mt-2">管理面试、试岗和录用流程</p>
        </div>
      )}

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
        <OnboardingFormDialog
          open={!!hireConfirmModal}
          title="确认录用并安排入职"
          candidateName={applications.find((a) => a.id === hireConfirmModal)?.full_name}
          submitting={hireSubmitting}
          onClose={() => setHireConfirmModal(null)}
          onConfirm={(payload) => {
            const app = applications.find((a) => a.id === hireConfirmModal);
            if (app) handleHire(app.id, app.job_id, payload);
          }}
        />
      )}

      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">拒绝面试安排</h3>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="如时间冲突，建议改到..."
              rows={4}
              className="mb-4"
            />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                type="button"
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleRejectInterview}
                disabled={!rejectReason.trim()}
              >
                确认拒绝
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="筛选条件" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sortedApplications.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="暂无面试安排"
          description="没有需要处理的面试、试岗或录用记录"
        />
      ) : (
        <div className="space-y-6">
          {sortedApplications.map((app) => {
            const processStep = getProcessStep(app);
            const latestInterview = app.interviews[app.interviews.length - 1];
            const latestTrial = app.trials[app.trials.length - 1];
            const canScheduleInterview =
              !latestInterview || ["completed", "cancelled", "no_show"].includes(latestInterview.status);
            const canScheduleTrial = !latestTrial && latestInterview?.status === "completed";
            const canHire =
              (latestTrial?.status === "completed" || (!latestTrial && latestInterview?.status === "completed")) &&
              !latestTrial?.is_hired;

            // 判断流程是否已结束（终态），已结束则折叠显示
            // 本系统 ApplicationStatus 终态：rejected（拒绝/拒绝Offer）、terminated（终止/放弃入职）、interview-failed（面试未通过）
            // trial cancelled=试岗已终止（终态）；trial completed+未录用属"待录用决策"，非终态不折叠
            const isTerminated =
              app.status === "rejected" ||
              app.status === "terminated" ||
              app.status === "interview-failed" ||
              latestTrial?.status === "cancelled";

            const getTerminateLabel = () => {
              if (app.status === "rejected") return "已拒绝";
              if (app.status === "terminated") return "已终止";
              if (app.status === "interview-failed") return "面试未通过";
              if (latestTrial?.status === "cancelled") return "试岗已终止";
              return "流程已结束";
            };

            const isExpanded = expandedTerminated.has(app.id);

            if (isTerminated && !isExpanded) {
              return (
                <div
                  key={app.id}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50 opacity-75 cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() =>
                    setExpandedTerminated((prev) => {
                      const next = new Set(prev);
                      next.add(app.id);
                      return next;
                    })
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-600">{app.full_name}</span>
                      <span className="text-sm text-gray-400">{app.job_title}</span>
                    </div>
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                      {getTerminateLabel()}
                    </span>
                  </div>
                </div>
              );
            }

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
                          {app.interviews.map((interview, index) => {
                            const isRejected = interview.response_status === "rejected";
                            const canRespond =
                              interview.response_status === "pending" &&
                              interview.status === "scheduled";
                            // 修复A：仅未取消/未拒绝且尚无结果的面试才允许反馈结果。
                            // 已取消(cancelled)、未到场(no_show)或已被面试官拒绝(rejected)的面试
                            // 不得再提交面评，否则 submit-evaluation 会把 status 改回 completed，
                            // 导致被拒面试错误显示为"已完成"。
                            const showEval =
                              !interview.result &&
                              interview.status !== "cancelled" &&
                              interview.status !== "no_show" &&
                              interview.response_status !== "rejected";
                            const evalExpanded =
                              expandState?.applicationId === app.id &&
                              expandState?.mode === "evaluation" &&
                              expandState?.interviewId === interview.id;
                            const actions = (
                              <div className="space-y-2">
                                {isRejected && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setExpandState({
                                        applicationId: app.id,
                                        mode: "interview",
                                        interviewId: interview.id,
                                        reschedule: true,
                                      })
                                    }
                                  >
                                    重新安排
                                  </Button>
                                )}
                                {canRespond && (
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      className="bg-[#185A56] hover:bg-[#185A56]/90 text-white"
                                      onClick={() => handleAcceptInterview(interview.id)}
                                    >
                                      接受
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        setRejectModal({ interviewId: interview.id, application: app })
                                      }
                                    >
                                      拒绝
                                    </Button>
                                  </div>
                                )}
                                {showEval &&
                                  (evalExpanded ? (
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
                                  ))}
                              </div>
                            );
                            return (
                              <InterviewCard
                                key={interview.id}
                                roundLabel={`第${index + 1}轮面试`}
                                data={{
                                  id: interview.id,
                                  scheduled_at: interview.scheduled_at,
                                  location: interview.location,
                                  interviewer_name: getInterviewerName(interview.interviewer_id),
                                  contact_person: interview.contact_person,
                                  contact_phone: interview.contact_phone,
                                  status: interview.status,
                            result: interview.result,
                                  evaluation: interview.evaluation,
                                  response_status: interview.response_status,
                                  response_reason: interview.response_reason,
                                }}
                                actions={actions}
                              />
                            );
                          })}
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
                                  <Label htmlFor="interviewer">面试官</Label>
                                  <Combobox
                                    value={interviewForm.interviewer_id}
                                    onValueChange={(value) =>
                                      setInterviewForm({ ...interviewForm, interviewer_id: value })
                                    }
                                    items={interviewerItems}
                                    placeholder="请选择面试官"
                                    searchPlaceholder="搜索面试官姓名..."
                                    emptyMessage="暂无面试官角色用户"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="contact_person">面试联系人</Label>
                                  <Combobox
                                    value={interviewForm.contact_person_id}
                                    onValueChange={(value, item) => {
                                      setInterviewForm({
                                        ...interviewForm,
                                        contact_person_id: value,
                                        contact_person: item?.label || "",
                                        contact_phone: item?.phone || "",
                                      });
                                    }}
                                    items={contactItems}
                                    placeholder="请选择联系人"
                                    searchPlaceholder="搜索联系人姓名..."
                                    emptyMessage="暂无可用联系人"
                                  />
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
                                  disabled={submitting}
                                >
                                  取消
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => handleScheduleInterview(app.id, app.job_id)}
                                  disabled={submitting}
                                >
                                  {submitting
                                    ? "提交中..."
                                    : app.interviews.length > 0
                                    ? "安排下一轮面试"
                                    : "安排面试"}
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
                          {latestTrial.status !== "completed" && (
                            <div className="mt-2">
                              {expandState?.applicationId === app.id &&
                              expandState?.mode === "trial" ? (
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant={trialResult === "pass" ? "default" : "outline"}
                                      className={trialResult === "pass" ? "bg-green-600 hover:bg-green-700" : ""}
                                      onClick={() => setTrialResult("pass")}
                                    >
                                      通过
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={trialResult === "fail" ? "default" : "outline"}
                                      className={trialResult === "fail" ? "bg-red-600 hover:bg-red-700" : ""}
                                      onClick={() => setTrialResult("fail")}
                                    >
                                      不通过
                                    </Button>
                               </div>
                                  <Textarea
                                    value={trialFeedback}
                                    onChange={(e) => setTrialFeedback(e.target.value)}
                                    placeholder="请输入试岗反馈"
                                    rows={3}
                                  />
                                  {trialResult === "pass" && (
                                    <label className="flex items-center gap-2 text-sm text-gray-600">
                                      <input
                                        type="checkbox"
                                        checked={trialHireApp?.applicationId === app.id}
                                        onChange={(e) =>
                                          setTrialHireApp(
                                            e.target.checked
                                              ? { applicationId: app.id, jobId: app.job_id }
                                              : null
                                          )
                                        }
                                      />
                                      通过后直接录用（提交后填写入职信息）
                                    </label>
                                  )}
                                  <Button
                                    type="button"
                                    onClick={() => handleSubmitTrialFeedback(latestTrial.id)}
                                    disabled={!trialResult || !trialFeedback.trim()}
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
                            <div className="grid grid-cols-2 gap-4">
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
                                <Label htmlFor="start_hour">开始时间（整点）</Label>
                                <select
                                  id="start_hour"
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  value={trialForm.start_hour}
                                  onChange={(e) =>
                                    setTrialForm({ ...trialForm, start_hour: e.target.value })
                                  }
                                >
                                  {Array.from({ length: 10 }, (_, i) => {
                                    const h = String(i + 9).padStart(2, "0");
                                    return (
                                      <option key={h} value={h}>
                                        {h}:00
                                      </option>
                                    );
                                  })}
                                </select>
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
                                <Label htmlFor="end_hour">结束时间（整点）</Label>
                                <select
                                  id="end_hour"
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  value={trialForm.end_hour}
                                  onChange={(e) =>
                                    setTrialForm({ ...trialForm, end_hour: e.target.value })
                                  }
                                >
                                  {Array.from({ length: 10 }, (_, i) => {
                                    const h = String(i + 9).padStart(2, "0");
                                    return (
                                      <option key={h} value={h}>
                                        {h}:00
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              <div className="col-span-2">
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
                      <div className="border-t pt-4">
                        <Button
                          type="button"
                          className="w-full"
                          onClick={() => setHireConfirmModal(app.id)}
                        >
                          确认录用
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