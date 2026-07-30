"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Combobox, type ComboboxItem } from "@/components/ui/Combobox";
import { Textarea } from "@/components/ui/Textarea";
import { ChevronDown, ClipboardList, Phone, Copy } from "lucide-react";
import { OnboardingFormDialog, type OnboardingFormPayload } from "@/components/recruiter/onboarding-form-dialog";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { beijingLocalToUtcISO } from "@/lib/utils";
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
  response_status?: string;
  response_reason?: string;
  round?: number;
  evaluation?: string;
}

interface TrialRecord {
  id: string;
  application_id: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  status: string;
  feedback?: string;
  is_hired?: boolean;
}

interface ApplicationWithJob {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  full_name?: string;
  phone?: string;
  wechat?: string;
  email?: string;
  gender?: string;
  age?: number;
  self_introduction?: string;
  assigned_recruiter_id?: string;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
  job_title?: string;
  interviews?: InterviewRecord[];
  trials?: TrialRecord[];
}

export default function ApplicationsPage() {
  const { userId, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "");
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
  const [hireModal, setHireModal] = useState<{ applicationId: string; candidateName: string } | null>(null);
  const [hireSubmitting, setHireSubmitting] = useState(false);

  // 修复1：重新安排面试（针对被取消/被拒绝的面试）——携带 interviewId 走 reschedule-interview
  const [rescheduleModal, setRescheduleModal] = useState<{ applicationId: string; interviewId: string; candidateName: string } | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    scheduled_at: "",
    location: "",
    interviewer_id: "",
    contact_person: "",
    contact_phone: "",
  });

  // 修复2：试岗安排（日期 + 整点小时下拉）
  const [trialModal, setTrialModal] = useState<{ applicationId: string; candidateName: string } | null>(null);
  const [trialForm, setTrialForm] = useState({
    start_date: "",
    start_hour: "09",
    end_date: "",
    end_hour: "18",
    location: "",
  });
  const [trialSubmitting, setTrialSubmitting] = useState(false);

  // 投递信息矫正编辑态
  const [editModal, setEditModal] = useState<{ applicationId: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [showCancelEditConfirm, setShowCancelEditConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    age: "" as string,
    gender: "",
    wechat: "",
    self_introduction: "",
  });

  // 组件级数据拉取：供 useEffect 与各 handler 复用（重新安排/试岗后刷新列表）
  const fetchData = async () => {
    if (!userId) return;
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

  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authLoading]);

  // 按状态筛选（支持从看板卡片带 ?status= 参数跳转联动）
  const filteredApplications = useMemo(() => {
    if (!statusFilter) return applications;
    return applications.filter((app) => app.status === statusFilter);
  }, [applications, statusFilter]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to legacy method
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCall = async (phone?: string) => {
    const raw = (phone || "").trim();
    if (!raw) {
      showToast("该候选人未填写电话号码", "error");
      return;
    }
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    );
    // 保留 + 与数字用于 tel: 拨号，去除空格与横杠
    const telNumber = raw.replace(/[^\d+]/g, "");
    if (isMobile) {
      window.location.href = `tel:${telNumber}`;
    } else {
      const clean = raw.replace(/[\s-]/g, "");
      const ok = await copyText(clean);
      showToast(ok ? "已复制电话号码，请在手机上拨打" : "复制失败，请手动复制", ok ? "success" : "error");
    }
  };

  const handleCopyWechat = async (wechat?: string) => {
    const raw = (wechat || "").trim();
    if (!raw) {
      showToast("该候选人未填写微信号", "error");
      return;
    }
    const ok = await copyText(raw);
    showToast(ok ? `已复制微信号：${raw}` : "复制失败，请手动复制", ok ? "success" : "error");
  };

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

  const handleHire = async (payload: OnboardingFormPayload) => {
    if (!hireModal || !userId) return;
    setHireSubmitting(true);
    const result = await handleAction("hire", {
      applicationId: hireModal.applicationId,
      ...payload,
    });
    setHireSubmitting(false);

    if (result.success) {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === hireModal.applicationId ? { ...app, status: "offering" } : app
        )
      );
      setHireModal(null);
    }

    setTimeout(() => setToast(null), 3000);
  };

  const handleScheduleInterview = async () => {
    if (!interviewModal || !userId) return;

    const jobId = applications.find((a) => a.id === interviewModal.applicationId)?.job_id;
    
    const result = await handleAction("schedule-interview", {
      applicationId: interviewModal.applicationId,
      jobId,
      scheduled_at: beijingLocalToUtcISO(interviewForm.scheduled_at),
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
      await fetchData();
    }

    setTimeout(() => setToast(null), 3000);
  };

  // 修复1：重新安排一场被取消/被拒绝的面试
  const handleReschedule = async () => {
    if (!rescheduleModal || !userId) return;

    const result = await handleAction("reschedule-interview", {
      interviewId: rescheduleModal.interviewId,
      scheduled_at: beijingLocalToUtcISO(rescheduleForm.scheduled_at),
      location: rescheduleForm.location,
      interviewer_id: rescheduleForm.interviewer_id || userId,
      contact_person: rescheduleForm.contact_person,
      contact_phone: rescheduleForm.contact_phone,
    });

    if (result.success) {
      setRescheduleModal(null);
      setRescheduleForm({ scheduled_at: "", location: "", interviewer_id: "", contact_person: "", contact_phone: "" });
      await fetchData();
    }

    setTimeout(() => setToast(null), 3000);
  };

  // 修复1：安排下一轮面试——复用 schedule-interview，后端自动按已有轮次递增
  const handleScheduleNextRound = (applicationId: string, candidateName: string) => {
    setInterviewModal({ applicationId, candidateName });
  };

  // 修复2：安排试岗（日期 + 整点小时，拼 TIMESTAMPTZ 写入 trials.start_date）
  const handleScheduleTrial = async () => {
    if (!trialModal || !userId) return;
    const jobId = applications.find((a) => a.id === trialModal.applicationId)?.job_id;

    setTrialSubmitting(true);
    const start_date = trialForm.start_date
      ? `${trialForm.start_date}T${trialForm.start_hour}:00:00+08:00`
      : "";
    const result = await handleAction("schedule-trial", {
      applicationId: trialModal.applicationId,
      jobId,
      start_date,
      end_date: trialForm.end_date
        ? `${trialForm.end_date}T${trialForm.end_hour}:00:00+08:00`
        : null,
      location: trialForm.location,
    });
    setTrialSubmitting(false);

    if (result.success) {
      setTrialModal(null);
      setTrialForm({ start_date: "", start_hour: "09", end_date: "", end_hour: "18", location: "" });
      await fetchData();
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

  const startEditInfo = (app: ApplicationWithJob) => {
    setEditForm({
      full_name: app.full_name ?? "",
      phone: app.phone ?? "",
      age: app.age != null ? String(app.age) : "",
      gender: app.gender ?? "",
      wechat: app.wechat ?? "",
      self_introduction: app.self_introduction ?? "",
    });
    setEditModal({ applicationId: app.id });
  };

  const cancelEditInfo = () => {
    setShowCancelEditConfirm(true);
  };

  const confirmCancelEdit = () => {
    setShowCancelEditConfirm(false);
    setEditModal(null);
  };

  const saveEditInfo = async () => {
    if (!editModal || !userId) return;
    if (!editForm.full_name.trim()) {
      showToast("姓名不能为空", "error");
      return;
    }
    setEditSaving(true);
    try {
      const response = await fetch(
        `/api/recruiter/candidates/${editModal.applicationId}?action=update-application-info&userId=${userId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: editForm.full_name.trim(),
            phone: editForm.phone.trim(),
            age: editForm.age.trim(),
            gender: editForm.gender,
            wechat: editForm.wechat.trim(),
            self_introduction: editForm.self_introduction.trim(),
          }),
        }
      );
      const result = await response.json();
      if (result.success) {
        showToast("信息已更新", "success");
        setApplications((prev) =>
          prev.map((app) =>
            app.id === editModal.applicationId
              ? {
                  ...app,
                  full_name: editForm.full_name.trim(),
                  phone: editForm.phone.trim(),
                  age: editForm.age.trim() ? Number(editForm.age.trim()) : undefined,
                  gender: editForm.gender,
                  wechat: editForm.wechat.trim(),
                  self_introduction: editForm.self_introduction.trim(),
                  verified_by: userId,
                  verified_at: new Date().toISOString(),
                }
              : app
          )
        );
        setEditModal(null);
      } else {
        showToast(result.error || "更新失败", "error");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "更新失败", "error");
    } finally {
      setEditSaving(false);
    }
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

  // 面试官选择器：只显示 roles 中包含 "interviewer" 的用户
  const interviewerItems = useMemo<ComboboxItem[]>(() => {
    return adminUsers
      .filter((user) => Array.isArray(user.roles) && user.roles.includes("interviewer"))
      .map((user) => ({
        value: user.id,
        label: user.full_name || user.id,
        phone: user.phone,
      }));
  }, [adminUsers]);

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

      {/* 状态筛选栏（看板卡片跳转会自动带入选中状态） */}
      <div className="mb-6 max-w-xs">
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {(Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <Combobox
                    value={interviewForm.interviewer_id}
                    onValueChange={(value) =>
                      setInterviewForm({ ...interviewForm, interviewer_id: value })
                    }
                    items={interviewerItems}
                    placeholder="请选择面试人"
                    searchPlaceholder="搜索面试官姓名..."
                    emptyMessage="暂无面试官角色用户"
                  />
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

      {rescheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">重新安排面试</h3>
            <p className="text-gray-600 mb-4">
              为 {rescheduleModal.candidateName} 重新安排面试
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reschedule_at">面试时间</Label>
                  <Input
                    id="reschedule_at"
                    type="datetime-local"
                    value={rescheduleForm.scheduled_at}
                    onChange={(e) =>
                      setRescheduleForm({ ...rescheduleForm, scheduled_at: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="reschedule_location">面试地点</Label>
                  <Input
                    id="reschedule_location"
                    placeholder="请输入面试地点"
                    value={rescheduleForm.location}
                    onChange={(e) =>
                      setRescheduleForm({ ...rescheduleForm, location: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reschedule_interviewer">面试人</Label>
                  <Combobox
                    value={rescheduleForm.interviewer_id}
                    onValueChange={(value) =>
                      setRescheduleForm({ ...rescheduleForm, interviewer_id: value })
                    }
                    items={interviewerItems}
                    placeholder="请选择面试人"
                    searchPlaceholder="搜索面试官姓名..."
                    emptyMessage="暂无面试官角色用户"
                  />
                </div>
                <div>
                  <Label htmlFor="reschedule_contact">面试联系人</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      const selectedUser = adminUsers.find((u) => u.id === value);
                      setRescheduleForm({
                        ...rescheduleForm,
                        contact_person: selectedUser?.full_name || "",
                  contact_phone: selectedUser?.phone || "",
                      });
                    }}
                  >
                    <SelectTrigger id="reschedule_contact">
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
                <Label htmlFor="reschedule_phone">联系人电话</Label>
                <Input id="reschedule_phone" readOnly value={rescheduleForm.contact_phone} />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRescheduleModal(null)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button type="button" onClick={handleReschedule} className="flex-1">
                  确认重新安排
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {trialModal && (
       <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">安排试岗</h3>
            <p className="text-gray-600 mb-4">
              为 {trialModal.candidateName} 安排试岗
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trial_start_date">开始日期</Label>
                  <Input
                    id="trial_start_date"
                    type="date"
                    value={trialForm.start_date}
                    onChange={(e) =>
                      setTrialForm({ ...trialForm, start_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="trial_start_hour">开始时间</Label>
                  <Select
                    value={trialForm.start_hour}
           onValueChange={(value) =>
                      setTrialForm({ ...trialForm, start_hour: value })
                    }
                  >
                    <SelectTrigger id="trial_start_hour">
                      <SelectValue placeholder="请选择整点" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => String(i + 9).padStart(2, "0")).map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}:00
               </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trial_end_date">结束日期（可选）</Label>
                  <Input
                    id="trial_end_date"
                    type="date"
                    value={trialForm.end_date}
                    onChange={(e) =>
                      setTrialForm({ ...trialForm, end_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="trial_end_hour">结束时间</Label>
                  <Select
                    value={trialForm.end_hour}
                    onValueChange={(value) =>
                      setTrialForm({ ...trialForm, end_hour: value })
                    }
                  >
                    <SelectTrigger id="trial_end_hour">
                      <SelectValue placeholder="请选择整点" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => String(i + 9).padStart(2, "0")).map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
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
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTrialModal(null)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={handleScheduleTrial}
                  disabled={trialSubmitting}
                  className="flex-1"
                >
                  {trialSubmitting ? "提交中..." : "确认安排"}
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

      {showCancelEditConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2">放弃修改？</h3>
            <p className="text-sm text-gray-600 mb-4">已编辑的内容将不会保存。</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCancelEditConfirm(false)}>
                继续编辑
              </Button>
              <Button className="flex-1" onClick={confirmCancelEdit}>
                放弃
              </Button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">矫正候选人投递信息</h3>
            <p className="text-sm text-gray-500 mb-4">
              此处修改仅影响该条投递记录，不会改动候选人账号资料
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_name">姓名 <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit_name"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_phone">手机号</Label>
                  <Input
                    id="edit_phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_age">年龄</Label>
                  <Input
                    id="edit_age"
                    type="number"
                    value={editForm.age}
                    onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_gender">性别</Label>
                  <select
                    id="edit_gender"
                    className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm"
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  >
                    <option value="">保密</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit_wechat">微信号</Label>
                  <Input
                    id="edit_wechat"
                    value={editForm.wechat}
                    onChange={(e) => setEditForm({ ...editForm, wechat: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit_intro">自我介绍</Label>
                <Textarea
                  id="edit_intro"
                  rows={3}
                  value={editForm.self_introduction}
                  onChange={(e) => setEditForm({ ...editForm, self_introduction: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={cancelEditInfo} disabled={editSaving} className="flex-1">
                  取消
                </Button>
                <Button onClick={saveEditInfo} disabled={editSaving} className="flex-1">
                  {editSaving ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <OnboardingFormDialog
        open={!!hireModal}
        title="确认录用并安排入职"
        candidateName={hireModal?.candidateName}
        submitting={hireSubmitting}
        onClose={() => setHireModal(null)}
        onConfirm={handleHire}
      />

      {filteredApplications.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={statusFilter ? "该状态下暂无投递" : "暂无投递记录"}
          description={
            statusFilter
              ? `没有处于「${APPLICATION_STATUS_LABELS[statusFilter as ApplicationStatus] ?? statusFilter}」状态的投递`
              : "没有候选人投递您负责的岗位"
          }
     />
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => {
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
                      {app.verified_at && (
                        <p className="text-xs text-[#185A56] mt-1">
                          ✅ 信息已核实（{formatDate(app.verified_at)} 更新）
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleCall(app.phone)}
                          className="border-[#185A56] text-[#185A56] hover:bg-[#185A56]/10 h-8 px-3"
                        >
                          <Phone size={16} className="mr-1" />
                          打电话
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleCopyWechat(app.wechat)}
                          className="border-[#185A56] text-[#185A56] hover:bg-[#185A56]/10 h-8 px-3"
                        >
                          <Copy size={16} className="mr-1" />
                          复制微信
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => startEditInfo(app)}
                          className="border-[#185A56] text-[#185A56] hover:bg-[#185A56]/10 h-8 px-3"
                        >
                          编辑信息
                        </Button>
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
                          {app.wechat && (
                            <p className="text-sm text-gray-600">微信：{app.wechat}</p>
                          )}
                          {app.email && (
                            <p className="text-sm text-gray-600">{app.email}</p>
                          )}
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
                            {app.interviews.map((interview, index) => {
                              // 修复1：面试状态标签需覆盖 cancelled/completed/pass/fail，
                              // 不能简单“非 scheduled 即已完成”，否则被取消的面试会错误显示为“已完成”。
                              // 面试官主动拒绝任务时（response_status=rejected）单独用红色标签“面试官已拒绝”。
                              const isRejected = interview.response_status === "rejected";
                              let badgeClass = "bg-blue-100 text-blue-700";
                              let badgeText = "待面试";
                              if (isRejected) {
                                badgeClass = "bg-red-100 text-red-700";
                                badgeText = "面试官已拒绝";
                              } else if (interview.status === "cancelled") {
                                badgeClass = "bg-orange-100 text-orange-700";
                                badgeText = "已取消";
                              } else if (interview.status === "no_show") {
                                badgeClass = "bg-red-100 text-red-700";
                                badgeText = "未到场";
                              } else if (interview.result === "pass") {
                                badgeClass = "bg-green-100 text-green-700";
                                badgeText = "通过";
                              } else if (interview.result === "fail") {
                                badgeClass = "bg-red-100 text-red-700";
                                badgeText = "未通过";
                              } else if (interview.status === "completed") {
                                badgeClass = "bg-green-100 text-green-700";
                                badgeText = "已完成";
                              }
                              // 显示条件：被取消/被拒绝→可“重新安排”；被拒绝或已完成通过→可“安排下一轮”
                              // “安排下一轮”只在“最新一轮面试”上显示，避免历史每一条都冒出该按钮。
                              const isLatestInterview = index === (app.interviews?.length ?? 0) - 1;
                              const canReschedule = isRejected || interview.status === "cancelled";
                              const canNextRound = isLatestInterview && (isRejected || (interview.status === "completed" && interview.result === "pass"));
                              return (
                              <div key={interview.id} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">第{interview.round ?? index + 1}轮面试</span>
                                  <Badge className={badgeClass}>
                                    {badgeText}
                                </Badge>
                                </div>
                                <div className="text-xs text-gray-600 mt-1 space-y-1">
                                  <span>时间：{formatDate(interview.scheduled_at)}</span>
                                  <span>地点：{interview.location}</span>
                                  <span>面试官：{getInterviewerName(interview.interviewer_id)}</span>
                                  {interview.contact_person && <span>联系人：{interview.contact_person}</span>}
                                  {interview.contact_phone && <span>联系电话：{interview.contact_phone}</span>}
                                </div>
                                {isRejected && interview.response_reason && (
                                  <div className="mt-2 text-xs text-red-600">
                                    <span className="font-medium">拒绝原因：</span>{interview.response_reason}
                                  </div>
                                )}
                                {interview.evaluation && (
                                  <div className="mt-2 text-xs text-gray-600">
                                    <span className="font-medium">面评：</span>{interview.evaluation}
                                  </div>
                                )}
                                {(canReschedule || canNextRound) && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {canReschedule && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="bg-[#185A56] hover:bg-[#124441]"
                                        onClick={() =>
                                          setRescheduleModal({
                                            applicationId: app.id,
                                            interviewId: interview.id,
                                            candidateName: app.full_name || "",
                                          })
                                        }
                                      >
                                        重新安排
                                      </Button>
                                    )}
                                    {canNextRound && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="border-[#185A56] text-[#185A56] hover:bg-[#185A56]/10"
                                        onClick={() => handleScheduleNextRound(app.id, app.full_name || "")}
                                      >
                                        安排下一轮面试
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}


                      {app.trials && app.trials.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-2">试岗信息</p>
                          <div className="space-y-2">
                            {app.trials.map((trial) => (
                              <div key={trial.id} className="bg-amber-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">试岗</span>
                                  <Badge className={trial.status === "completed" ? "bg-green-100 text-green-700" : (trial.status === "cancelled" || trial.status === "terminated") ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}>
                                    {trial.status === "completed" ? "已完成" : (trial.status === "cancelled" || trial.status === "terminated") ? "已终止" : "试岗中"}
                                    {trial.is_hired ? " · 已录用" : ""}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-600 mt-1 space-y-1">
                                  {trial.start_date && <span>开始：{formatDate(trial.start_date)}</span>}
                                  {trial.end_date && <span>结束：{formatDate(trial.end_date)}</span>}
                                  {trial.location && <span>地点：{trial.location}</span>}
                                </div>
                                {trial.feedback && (
                                  <div className="mt-2 text-xs text-gray-600">
                                    <span className="font-medium">反馈：</span>{trial.feedback}
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
                              onClick={() =>
                                setTrialModal({
                                  applicationId: app.id,
                                  candidateName: app.full_name || "",
                                })
                              }
                              variant="outline"
                              className="border-[#185A56] text-[#185A56] hover:bg-[#185A56]/10"
                            >
                              安排试岗
                            </Button>
                            <Button
                              type="button"
                              onClick={() =>
                                setHireModal({
                                  applicationId: app.id,
                                  candidateName: app.full_name || "",
                                })
                              }
                              className="bg-green-600 hover:bg-green-700"
                            >
                              确认录用
                            </Button>
                          </>
                        )}
                        {app.status === "offering" && (
                          <span className="text-sm text-gray-500">
                            已发出录用，等待候选人确认入职
                          </span>
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