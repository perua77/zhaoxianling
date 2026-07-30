"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Calendar, Clock, MapPin, User, Phone, Briefcase, MessageSquare, CheckCircle, ArrowRight, FileText, CheckCircle2 } from "lucide-react";
import { OnboardingFormDialog, type OnboardingFormPayload } from "@/components/recruiter/onboarding-form-dialog";

interface CandidateProfile {
  full_name: string;
  gender?: string;
  age?: number;
  phone?: string;
  email?: string;
  bio?: string;
}

interface JobInfo {
  id: string;
  title: string;
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
  response_status?: string;
  response_reason?: string;
  round: number;
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
  is_hired?: boolean;
}

interface ApplicationDetail {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  full_name?: string;
  phone?: string;
  email?: string;
  age?: number | null;
  gender?: string;
  wechat?: string;
  self_introduction?: string;
  created_at: string;
  verified_by?: string | null;
  verified_at?: string | null;
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
  cancelled: "bg-gray-100 text-gray-700",
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
  pending: "待开始",
  confirmed: "进行中",
  active: "进行中",
  completed: "已完成",
  cancelled: "已终止",
  terminated: "已终止",
};

const TRIAL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-100 text-blue-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  terminated: "bg-red-100 text-red-700",
};

const PROCESS_STEPS = [
  { label: "投递", icon: FileText },
  { label: "面试", icon: MessageSquare },
  { label: "试岗", icon: Briefcase },
  { label: "录用", icon: CheckCircle },
];

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userId, roles, loading: authLoading } = useAuth();
  const applicationId = params.applicationId as string;

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [trials, setTrials] = useState<TrialRecord[]>([]);
  const [interviewerNames, setInterviewerNames] = useState<Map<string, string>>(new Map());
  
  const [evaluationText, setEvaluationText] = useState<string>("");
  const [evaluationInterviewId, setEvaluationInterviewId] = useState<string | null>(null);
  
  const [trialForm, setTrialForm] = useState({
    start_date: "", // 仅日期部分 yyyy-MM-dd
    start_hour: "09", // 整点小时（09~18）
    end_date: "",
    end_hour: "18", // 结束整点小时（09~18）
    location: "",
  });
  const [showTrialForm, setShowTrialForm] = useState(false);
  // 试岗反馈输入独立 state，key 为 trialId，避免与安排试岗的 location 输入冲突
  const [trialFeedback, setTrialFeedback] = useState<Record<string, string>>({});
  // fix1：面试重新安排 / 安排下一轮的内联表单。mode 区分动作，interviewId 仅重新安排时使用。
  const [interviewForm, setInterviewForm] = useState<{
    mode: "reschedule" | "next-round";
    interviewId: string | null;
    date: string;
    hour: string;
    location: string;
    contact_person: string;
    contact_phone: string;
  } | null>(null);
  // fix1：“安排下一轮”表单无 interviewId，用锚点记录挂靠在哪条卡片下方展示
  const [nextRoundAnchorId, setNextRoundAnchorId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: "mark_result"; data: any } | null>(null);
  const [hireModal, setHireModal] = useState(false);
  const [hireSubmitting, setHireSubmitting] = useState(false);

  // 投递信息矫正编辑态
  const [verifierName, setVerifierName] = useState<string | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const [showCancelEditConfirm, setShowCancelEditConfirm] = useState(false);
  const [infoForm, setInfoForm] = useState({
    full_name: "",
    phone: "",
    age: "" as string,
    gender: "",
    wechat: "",
    self_introduction: "",
  });
  // 终止流程弹窗
  const [showTerminate, setShowTerminate] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [terminating, setTerminating] = useState(false);
  // 入职确认/取消提交中
  const [onboardActing, setOnboardActing] = useState(false);
  useEffect(() => {
    if (authLoading || !applicationId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/recruiter/candidates/${applicationId}?userId=${userId}`);
        const result = await response.json();

        if (result.success) {
          setApplication(result.data.application);
          setCandidate(result.data.candidate);
          setJob(result.data.job);
          setInterviews(result.data.interviews || []);
          setTrials(result.data.trials || []);
          
          const names = new Map<string, string>();
          (result.data.interviewers || []).forEach((i: { id: string; full_name: string }) => {
            names.set(i.id, i.full_name);
          });
          setInterviewerNames(names);
          setVerifierName(result.data.verifierName || null);
        } else {
          setToast({ message: result.error || "获取数据失败", type: "error" });
        }
      } catch (error) {
        console.error("Failed to fetch candidate detail:", error);
        setToast({ message: "获取数据失败", type: "error" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [applicationId, userId, authLoading]);

  const getProcessStep = () => {
    if (!application) return 0;
    
    const latestInterview = interviews[interviews.length - 1];
    const latestTrial = trials[trials.length - 1];
    
    if (application.status === "hired" || application.status === "accepted") return 4;
    if (latestTrial?.status === "completed" || latestTrial?.status === "confirmed" || latestTrial?.status === "active") return 3;
    if (latestInterview?.status === "completed") {
      return latestInterview.result === "pass" ? 3 : 2;
    }
    if (latestInterview?.status === "scheduled") return 2;
    return 1;
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

  const handleAction = async (action: string, body: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/recruiter/candidates/${applicationId}?action=${action}&userId=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (result.success) {
        setToast({ message: result.message, type: "success" });
        window.location.reload();
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

  const startEditInfo = () => {
    setInfoForm({
      full_name: application?.full_name ?? candidate?.full_name ?? "",
      phone: application?.phone ?? candidate?.phone ?? "",
      age:
        application?.age != null
          ? String(application.age)
          : candidate?.age != null
            ? String(candidate.age)
            : "",
      gender: application?.gender ?? candidate?.gender ?? "",
      wechat: application?.wechat ?? "",
      self_introduction:
        application?.self_introduction ?? candidate?.bio ?? "",
    });
    setEditingInfo(true);
  };

  const cancelEditInfo = () => {
    setShowCancelEditConfirm(true);
  };

  const confirmCancelEdit = () => {
    setShowCancelEditConfirm(false);
    setEditingInfo(false);
  };

  const saveEditInfo = async () => {
    if (!infoForm.full_name.trim()) {
      setToast({ message: "姓名不能为空", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setInfoSaving(true);
    try {
      const response = await fetch(
        `/api/recruiter/candidates/${applicationId}?action=update-application-info&userId=${userId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: infoForm.full_name.trim(),
            phone: infoForm.phone.trim(),
            age: infoForm.age.trim(),
            gender: infoForm.gender,
            wechat: infoForm.wechat.trim(),
            self_introduction: infoForm.self_introduction.trim(),
          }),
        }
      );
      const result= await response.json();
      if (result.success) {
        setToast({ message: "信息已更新", type: "success" });
        setEditingInfo(false);
        window.location.reload();
      } else {
        setToast({ message: result.error || "更新失败", type: "error" });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "更新失败",
        type: "error",
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setInfoSaving(false);
    }
  };

  const handleSubmitEvaluation = () => {
    if (!evaluationInterviewId || !evaluationText.trim()) return;
    handleAction("submit-evaluation", {
      interviewId: evaluationInterviewId,
      evaluation: evaluationText,
    });
  };

  const handleMarkResult = (interviewId: string, result: string) => {
    setConfirmModal({ type: "mark_result", data: { interviewId, result } });
  };

  const handleConfirmAction = () => {
    if (!confirmModal) return;
    
    if (confirmModal.type === "mark_result") {
      handleAction("mark-interview-result", {
        interviewId: confirmModal.data.interviewId,
        result: confirmModal.data.result,
      });
    }
    
    setConfirmModal(null);
  };

  const handleConfirmHire = async (payload: OnboardingFormPayload) => {
    setHireSubmitting(true);
    await handleAction("hire", { ...payload } as Record<string, unknown>);
    setHireSubmitting(false);
    setHireModal(false);
  };

  const handleScheduleTrial = () => {
    if (!trialForm.start_date || !trialForm.location) return;
    // fix2：日期 + 整点小时拼接为带北京时区(+08:00)的 TIMESTAMPTZ，避免入库被当作 UTC 造成 8 小时偏移。
    const startAt = `${trialForm.start_date}T${trialForm.start_hour}:00:00+08:00`;
    // 结束时间：若用户填了结束日期则用该日期 + 所选整点；否则默认次日 18:00。
    let endAt = "";
    if (trialForm.end_date) {
      endAt = `${trialForm.end_date}T${trialForm.end_hour}:00:00+08:00`;
    } else {
      const next = new Date(`${trialForm.start_date}T00:00:00+08:00`);
      next.setDate(next.getDate() + 1);
      const y = next.getFullYear();
      const m = String(next.getMonth() + 1).padStart(2, "0");
      const d = String(next.getDate()).padStart(2, "0");
      endAt = `${y}-${m}-${d}T18:00:00+08:00`;
    }
    handleAction("schedule-trial", {
      start_date: startAt,
      end_date: endAt,
      location: trialForm.location,
    });
    setShowTrialForm(false);
    setTrialForm({ start_date: "", start_hour: "09", end_date: "", end_hour: "18", location: "" });
  };

  const handleSubmitTrialFeedback = (trialId: string, feedback: string) => {
    if (!feedback.trim()) return;
    handleAction("submit-trial-feedback", {
      trialId,
      feedback,
    });
  };

  // fix1：打开重新安排 / 安排下一轮表单
  const openInterviewForm = (
    mode: "reschedule" | "next-round",
    interview?: InterviewRecord
  ) => {
    setInterviewForm({
      mode,
      interviewId: mode === "reschedule" ? interview?.id ?? null : null,
      date: "",
      hour: "09",
      location: interview?.location ?? "",
      contact_person: interview?.contact_person ?? "",
      contact_phone: interview?.contact_phone ?? "",
    });
  };

  // fix1：提交重新安排 / 安排下一轮面试
  const handleSubmitInterviewForm = () => {
    if (!interviewForm) return;
    if (!interviewForm.date || !interviewForm.location.trim()) {
      setToast({ message: "面试时间与地点不能为空", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    // 与试岗一致：拼接带北京时区(+08:00)的 TIMESTAMPTZ，避免入库被当作 UTC 偏移 8 小时。
    const scheduledAt = `${interviewForm.date}T${interviewForm.hour}:00:00+08:00`;
    const action =
      interviewForm.mode === "reschedule" ? "reschedule-interview" : "schedule-next-round";
    const body: Record<string, unknown> = {
      scheduled_at: scheduledAt,
      location: interviewForm.location.trim(),
      contact_person: interviewForm.contact_person.trim() || undefined,
      contact_phone: interviewForm.contact_phone.trim() || undefined,
    };
    if (interviewForm.mode === "reschedule") body.interviewId = interviewForm.interviewId;
    handleAction(action, body);
    setInterviewForm(null);
  };

  const handleHire = () => {
    setHireModal(true);
  };

  // 终止招聘流程
  const handleTerminate = async () => {
    setTerminating(true);
    await handleAction("terminate", { reason: terminateReason });
    setTerminating(false);
    setShowTerminate(false);
    setTerminateReason("");
  };

  // 确认入职
  const handleConfirmOnboard = async () => {
    setOnboardActing(true);
    await handleAction("confirm-onboard", {});
    setOnboardActing(false);
  };

  // 取消入职
  const handleCancelOnboard = async () => {
    setOnboardActing(true);
    await handleAction("cancel-onboard", {});
    setOnboardActing(false);
  };

  // 是否允许终止（进行中的中间态）
  const canTerminate = () => {
    if (!application) return false;
    return !["terminated", "accepted", "hired", "rejected", "interview-failed"].includes(
      application.status
    );
  };

  const canScheduleTrial = () => {
    const latestInterview = interviews[interviews.length - 1];
    return latestInterview?.status === "completed" && latestInterview.result === "pass" && trials.length === 0;
  };

  const canHire = () => {
    const latestTrial = trials[trials.length - 1];
    if (latestTrial?.status === "completed") return true;
    
    const latestInterview = interviews[interviews.length - 1];
    return !latestTrial && latestInterview?.status === "completed" && latestInterview.result === "pass";
  };

  const isInterviewer = (interview: InterviewRecord) => {
    return interview.interviewer_id === userId;
  };

  if (loading || authLoading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingSpinner size="lg" label="加载中..." className="py-20" />
      </div>
    );
  }

  if (!application || !candidate || !job) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-20">
          <p className="text-gray-600">候选人信息不存在或无权访问</p>
        </div>
      </div>
    );
  }

  const processStep = getProcessStep();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          返回
        </Button>
        <h1 className="text-3xl font-bold" style={{ color: "#185A56" }}>
          候选人详情
        </h1>
      </div>

      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all ${
            toast.type === "success" ? "bg-brand-green text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {showCancelEditConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2">放弃修改？</h3>
            <p className="text-sm text-gray-600 mb-4">已编辑的内容将不会保存。</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelEditConfirm(false)}
              >
                继续编辑
              </Button>
              <Button className="flex-1" onClick={confirmCancelEdit}>
                放弃
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {confirmModal.data.result === "pass" ? "确认通过" : "确认未通过"}
            </h3>
            <p className="text-gray-600 mb-6">
              {`确认${confirmModal.data.result === "pass" ? "通过" : "未通过"}该候选人的面试？`}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmModal(null)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                className={`flex-1 ${confirmModal.data.result === "fail" ? "bg-red-600 hover:bg-red-700" : "bg-brand-green hover:bg-brand-green/90"}`}
                onClick={handleConfirmAction}
              >
                确认
              </Button>
            </div>
          </div>
        </div>
      )}

      <OnboardingFormDialog
        open={hireModal}
        title="确认录用并安排入职"
        candidateName={candidate?.full_name || application?.full_name}
        submitting={hireSubmitting}
        onClose={() => setHireModal(false)}
        onConfirm={handleConfirmHire}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>候选人信息</CardTitle>
                {!editingInfo && (
                  <Button variant="outline" size="sm" onClick={startEditInfo}>
                    编辑信息
                  </Button>
                )}
              </div>
              {application.verified_at && (
                <p className="text-xs text-brand-green mt-1">
                  ✅ 信息已核实（由 {verifierName || "招聘人员"} 于{" "}
                  {formatDate(application.verified_at)} 更新）
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {editingInfo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_name">姓名 <span className="text-red-500">*</span></Label>
                      <Input
                        id="edit_name"
                        value={infoForm.full_name}
                        onChange={(e) => setInfoForm({ ...infoForm, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_phone">手机号</Label>
                      <Input
                        id="edit_phone"
                        value={infoForm.phone}
                        onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_age">年龄</Label>
                      <Input
                        id="edit_age"
                        type="number"
                        value={infoForm.age}
                        onChange={(e) => setInfoForm({ ...infoForm, age: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_gender">性别</Label>
                      <select
                        id="edit_gender"
                        className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm"
                        value={infoForm.gender}
                        onChange={(e) => setInfoForm({ ...infoForm, gender: e.target.value })}
                      >
                    <option value="">保密</option>
                        <option value="male">男</option>
                        <option value="female">女</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="edit_wechat">微信号</Label>
                      <Input
                        id="edit_wechat"
                        value={infoForm.wechat}
                        onChange={(e) => setInfoForm({ ...infoForm, wechat: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit_intro">自我介绍</Label>
                    <Textarea
                      id="edit_intro"
                      rows={3}
                      value={infoForm.self_introduction}
                      onChange={(e) => setInfoForm({ ...infoForm, self_introduction: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={cancelEditInfo} disabled={infoSaving} className="flex-1">
                      取消
                    </Button>
                    <Button onClick={saveEditInfo} disabled={infoSaving} className="flex-1">
                      {infoSaving ? "保存中..." : "保存"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center">
                      <User size={32} className="text-brand-green" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{application.full_name || candidate.full_name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span>{(application.gender ?? candidate.gender) === "male" ? "男" : (application.gender ?? candidate.gender) === "female" ? "女" : "保密"}</span>
                        <span>{application.age ?? candidate.age}岁</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone size={16} />
                      {application.phone || candidate.phone || "未填写"}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MessageSquare size={16} />
                      {application.wechat || "未填写微信"}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Briefcase size={16} />
                      投递岗位：{job.title}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock size={16} />
                      投递时间：{formatDateTime(application.created_at)}
                    </div>
                  </div>

                  {(application.self_introduction || candidate.bio) && (
                    <div className="border-t pt-4">
                      <Label className="block mb-2">自我介绍</Label>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        {application.self_introduction || candidate.bio}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>流程时间线</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {PROCESS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index < processStep;
                  const isCurrent = index === processStep - 1;
                  const showRound = step.label === "面试" && interviews.length > 0;

                  return (
                    <div key={step.label} className="flex items-center">
                      <div
                        className={`flex flex-col items-center ${
                          index > 0 ? "ml-8" : ""
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-full ${
                            isCompleted
                              ? "bg-brand-green text-white"
                              : isCurrent
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-400"
                          }`}
                        >
                          <Icon size={20} />
                        </div>
                        <span
                          className={`mt-2 text-sm ${
                            isCompleted
                              ? "text-brand-green font-medium"
                              : isCurrent
                              ? "text-blue-500 font-medium"
                              : "text-gray-400"
                          }`}
                        >
                          {step.label}
                          {showRound && `(第${interviews.length}轮)`}
                        </span>
                      </div>
                      {index < PROCESS_STEPS.length - 1 && (
                        <ArrowRight
                          size={20}
                          className={`ml-4 ${
                            isCompleted ? "text-brand-green" : "text-gray-300"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>面试记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {interviews.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-4">暂无面试记录</div>
              ) : (
                interviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="bg-gray-50 rounded-lg p-4 border"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">第{interview.round}轮面试</span>
                        <Badge className={INTERVIEW_STATUS_COLORS[interview.status]}>
                          {INTERVIEW_STATUS_LABELS[interview.status]}
                        </Badge>
                        {interview.response_status && (
                          <Badge className={RESPONSE_STATUS_COLORS[interview.response_status]}>
                            {RESPONSE_STATUS_LABELS[interview.response_status]}
                          </Badge>
                        )}
                      </div>
                      {interview.result && (
                        <Badge className={INTERVIEW_RESULT_COLORS[interview.result]}>
                          {INTERVIEW_RESULT_LABELS[interview.result]}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDateTime(interview.scheduled_at)}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        {interview.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <User size={14} />
                        {interviewerNames.get(interview.interviewer_id) || "未知"}
                      </div>
                      {interview.contact_person && (
                        <div className="flex items-center gap-1">
                          <Phone size={14} />
                          {interview.contact_person}
                        </div>
                      )}
                    </div>

                    {/* fix1A：面试官拒绝或面试被取消时，显示红色标签 + 拒绝原因（空则提示未填写） */}
                    {(interview.response_status === "rejected" ||
                      interview.status === "cancelled") && (
                      <div className="mt-2">
                        <Badge className="bg-red-100 text-red-700">面试官已拒绝</Badge>
                        <div className="mt-1 text-sm text-red-600">
                          拒绝原因：{interview.response_reason?.trim() || "未填写原因"}
                        </div>
                      </div>
                    )}

                    {interview.evaluation && (
                      <div className="mt-3 text-sm text-gray-600 bg-white p-3 rounded">
                        <span className="font-medium">面评：</span>
                        {interview.evaluation}
                      </div>
                    )}

                    {interview.status === "completed" && !interview.evaluation && isInterviewer(interview) && (
                      <div className="mt-3">
                        {evaluationInterviewId === interview.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={evaluationText}
                              onChange={(e) => setEvaluationText(e.target.value)}
                              placeholder="请输入面评"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button onClick={handleSubmitEvaluation} disabled={!evaluationText.trim()}>
                                提交面评
                              </Button>
                              <Button variant="outline" onClick={() => {
                                setEvaluationInterviewId(null);
                                setEvaluationText("");
                              }}>
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="outline" onClick={() => {
                            setEvaluationInterviewId(interview.id);
                            setEvaluationText("");
                          }}>
                            填写面评
                          </Button>
                        )}
                      </div>
                    )}

                    {interview.status === "completed" && interview.result === "pending" && isInterviewer(interview) && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleMarkResult(interview.id, "pass")}
                        >
                          标记通过
                        </Button>
                        <Button
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleMarkResult(interview.id, "fail")}
                        >
                          标记未通过
                        </Button>
                      </div>
                    )}

                    {/* fix1B/C：招聘者操作按钮。
                        - 面试被拒绝/取消 → 重新安排 + 安排下一轮
                        - 面试已完成且通过 → 仅安排下一轮
                        - 其它(如 scheduled) → 无额外按钮 */}
                    {roles?.includes("recruiter") &&
                      (() => {
                        const isRejectedOrCancelled =
                          interview.response_status === "rejected" ||
                          interview.status === "cancelled";
                        const isPassed =
                          interview.status === "completed" && interview.result === "pass";
                        const showReschedule = isRejectedOrCancelled;
                        const showNextRound = isRejectedOrCancelled || isPassed;
                        if (!showReschedule && !showNextRound) return null;
                        const formOpen =
                          interviewForm &&
                          ((interviewForm.mode === "reschedule" &&
                            interviewForm.interviewId === interview.id) ||
                            (interviewForm.mode === "next-round" &&
                              interviewForm.interviewId === null &&
                              nextRoundAnchorId === interview.id));
                     return (
                          <div className="mt-3">
                            <div className="flex gap-2">
                              {showReschedule && (
                                <Button
                                  style={{ backgroundColor: "#185A56", color: "#fff" }}
                                  onClick={() => {
                                    setNextRoundAnchorId(null);
                                    openInterviewForm("reschedule", interview);
                                  }}
                                >
                                  重新安排
                                </Button>
                              )}
                              {showNextRound && (
                                <Button
                                  style={{ backgroundColor: "#185A56", color: "#fff" }}
                                  onClick={() => {
                                    setNextRoundAnchorId(interview.id);
                                    openInterviewForm("next-round");
                                  }}
                                >
                                  安排下一轮面试
                                </Button>
                              )}
                            </div>
                            {formOpen && (
                              <div className="mt-3 space-y-3 bg-white p-3 rounded border">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>面试日期</Label>
                                    <Input
                                      type="date"
                                      value={interviewForm!.date}
                                      onChange={(e) =>
                                        setInterviewForm((prev) =>
                                          prev ? { ...prev, date: e.target.value } : prev
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>开始时间（整点）</Label>
                                    <select
                                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                                      value={interviewForm!.hour}
                                      onChange={(e) =>
                                        setInterviewForm((prev) =>
                                          prev ? { ...prev, hour: e.target.value } : prev
                                        )
                                      }
                                    >
                                      {Array.from({ length: 10 }, (_, i) => i + 9).map((h) => {
                                        const hh = String(h).padStart(2, "0");
                                        return (
                                          <option key={hh} value={hh}>
                                            {hh}:00
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <Label>面试地点</Label>
                                  <Input
                                    value={interviewForm!.location}
                                    onChange={(e) =>
                                      setInterviewForm((prev) =>
                                        prev ? { ...prev, location: e.target.value } : prev
                                      )
                                    }
                                    placeholder="请输入面试地点"
                                  />
                                </div>
                          <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>联系人（可选）</Label>
                                    <Input
                                      value={interviewForm!.contact_person}
                                      onChange={(e) =>
                                        setInterviewForm((prev) =>
                                          prev ? { ...prev, contact_person: e.target.value } : prev
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>联系电话（可选）</Label>
                                    <Input
                                      value={interviewForm!.contact_phone}
                                      onChange={(e) =>
                                        setInterviewForm((prev) =>
                                          prev ? { ...prev, contact_phone: e.target.value } : prev
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    style={{ backgroundColor: "#185A56", color: "#fff" }}
                                    onClick={handleSubmitInterviewForm}
                                  >
                                    提交
                                  </Button>
                                  <Button
                                variant="outline"
                                    onClick={() => {
                                      setInterviewForm(null);
                                      setNextRoundAnchorId(null);
                                    }}
                                  >
                                    取消
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>试岗管理</CardTitle>
            </CardHeader>
            <CardContent>
              {trials.length > 0 ? (
                trials.map((trial) => (
                  <div key={trial.id} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={TRIAL_STATUS_COLORS[trial.status]}>
                        {TRIAL_STATUS_LABELS[trial.status]}
                      </Badge>
                      {trial.is_hired && (
                        <Badge className="bg-brand-green text-white">已录用</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(trial.start_date)}
                        {trial.end_date && ` - ${formatDate(trial.end_date)}`}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        {trial.location}
                      </div>
                    </div>

                    {trial.feedback && (
                      <div className="mt-3 text-sm text-gray-600 bg-white p-3 rounded">
                        <span className="font-medium">反馈：</span>
                        {trial.feedback}
                      </div>
                    )}

                    {trial.status !== "completed" && trial.status !== "cancelled" && !trial.feedback && trial.interviewer_id === userId && (
                      <div className="mt-3">
                        <Textarea
                          value={trialFeedback[trial.id] ?? ""}
                          onChange={(e) => setTrialFeedback((prev) => ({ ...prev, [trial.id]: e.target.value }))}
                          placeholder="请输入试岗反馈"
                          rows={3}
                          className="mb-2"
                        />
                        <Button
                          onClick={() => handleSubmitTrialFeedback(trial.id, trialFeedback[trial.id] ?? "")}
                          disabled={!(trialFeedback[trial.id] ?? "").trim()}
                        >
                          提交反馈
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : canScheduleTrial() ? (
                <div className="text-center py-8">
                  {showTrialForm ? (
                    <div className="space-y-4 text-left">
                      <div>
                        <Label htmlFor="trial-start">开始日期</Label>
                        <Input
                          id="trial-start"
                          type="date"
                          value={trialForm.start_date}
                          onChange={(e) => setTrialForm((prev) => ({ ...prev, start_date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="trial-hour">开始时间（整点）</Label>
                        <select
                          id="trial-hour"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={trialForm.start_hour}
                          onChange={(e) => setTrialForm((prev) => ({ ...prev, start_hour: e.target.value }))}
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
                        <Label htmlFor="trial-end">结束日期（可选）</Label>
                        <Input
                          id="trial-end"
                          type="date"
                          value={trialForm.end_date}
                          onChange={(e) => setTrialForm((prev) => ({ ...prev, end_date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="trial-end-hour">结束时间（整点）</Label>
                        <select
                          id="trial-end-hour"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={trialForm.end_hour}
                          onChange={(e) => setTrialForm((prev) => ({ ...prev, end_hour: e.target.value }))}
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
                        <Label htmlFor="trial-location">地点</Label>
                        <Input
                          id="trial-location"
                          placeholder="请输入试岗地点"
                          value={trialForm.location}
                          onChange={(e) => setTrialForm((prev) => ({ ...prev, location: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleScheduleTrial} disabled={!trialForm.start_date || !trialForm.location}>
                          安排试岗
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowTrialForm(false);
                          setTrialForm({ start_date: "",start_hour: "09", end_date: "", end_hour: "18", location: "" });
                        }}>
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => setShowTrialForm(true)}>安排试岗</Button>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-sm text-center py-4">暂无试岗记录</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>录用</CardTitle>
            </CardHeader>
            <CardContent>
              {application.status === "hired" ? (
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={24} className="text-brand-green" />
                    <span className="text-lg font-medium text-brand-green">已录用</span>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button
                      className="bg-brand-green hover:bg-brand-green/90"
                      disabled={onboardActing}
                      onClick={handleConfirmOnboard}
                    >
                      确认入职
                    </Button>
                    <Button
                      variant="outline"
                      disabled={onboardActing}
                      onClick={handleCancelOnboard}
                    >
                      取消入职
                    </Button>
                  </div>
                </div>
              ) : application.status === "accepted" ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <CheckCircle2 size={24} className="text-brand-green" />
                  <span className="text-lg font-medium text-brand-green">已录用</span>
                </div>
              ) : canHire() ? (
                <div className="text-center py-8">
                  <Button
                    className="bg-brand-green hover:bg-brand-green/90"
                    onClick={handleHire}
                  >
                    发起录用
                  </Button>
                </div>
              ) : (
                <div className="text-gray-500 text-sm text-center py-4">
                  满足条件后可发起录用（试岗完成或面试通过且无试岗）
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full" onClick={() => router.back()}>
                返回列表
              </Button>
              {canTerminate() && (
                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowTerminate(true)}
                >
                  终止流程
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>岗位信息</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{job.title}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 终止流程弹窗 */}
      {showTerminate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5">
            <h3 className="mb-3 text-base font-semibold">终止招聘流程</h3>
            <p className="mb-2 text-sm text-gray-500">
              终止后将取消该候选人关联的未完成面试，且无法恢复。确定终止？
            </p>
            <textarea
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              placeholder="请填写终止原因（选填）"
              className="h-24 w-full resize-none rounded-md border p-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
           setShowTerminate(false);
                  setTerminateReason("");
                }}
              >
                取消
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={terminating}
                onClick={handleTerminate}
              >
                确认终止
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}