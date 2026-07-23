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
import { Calendar, Clock, MapPin, User, Phone, Mail, Briefcase, MessageSquare, CheckCircle, ArrowRight, FileText, CheckCircle2 } from "lucide-react";

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
  self_introduction?: string;
  created_at: string;
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
  active: "进行中",
  completed: "已完成",
  terminated: "已终止",
};

const TRIAL_STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
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
    start_date: "",
    end_date: "",
    location: "",
  });
  const [showTrialForm, setShowTrialForm] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ type: "mark_result" | "hire"; data: any } | null>(null);

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
    if (latestTrial?.status === "completed" || latestTrial?.status === "active") return 3;
    if (latestInterview?.status === "completed") {
      return latestInterview.result === "pass" ? 3 : 2;
    }
    if (latestInterview?.status === "scheduled") return 2;
    return 1;
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
    } else if (confirmModal.type === "hire") {
      handleAction("hire", {});
    }
    
    setConfirmModal(null);
  };

  const handleScheduleTrial = () => {
    if (!trialForm.start_date || !trialForm.location) return;
    handleAction("schedule-trial", {
      start_date: trialForm.start_date,
      end_date: trialForm.end_date,
      location: trialForm.location,
    });
    setShowTrialForm(false);
    setTrialForm({ start_date: "", end_date: "", location: "" });
  };

  const handleSubmitTrialFeedback = (trialId: string, feedback: string) => {
    if (!feedback.trim()) return;
    handleAction("submit-trial-feedback", {
      trialId,
      feedback,
    });
  };

  const handleHire = () => {
    setConfirmModal({ type: "hire", data: {} });
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

      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {confirmModal.type === "mark_result" 
                ? (confirmModal.data.result === "pass" ? "确认通过" : "确认未通过")
                : "确认录用"}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmModal.type === "mark_result"
                ? `确认${confirmModal.data.result === "pass" ? "通过" : "未通过"}该候选人的面试？`
                : "确认录用该候选人？此操作将发送录用通知给候选人。"}
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
                className={`flex-1 ${confirmModal.type === "mark_result" && confirmModal.data.result === "fail" ? "bg-red-600 hover:bg-red-700" : "bg-brand-green hover:bg-brand-green/90"}`}
                onClick={handleConfirmAction}
              >
                确认
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>候选人信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center">
                  <User size={32} className="text-brand-green" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{candidate.full_name}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span>{candidate.gender === "male" ? "男" : candidate.gender === "female" ? "女" : "保密"}</span>
                    <span>{candidate.age}岁</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={16} />
                  {candidate.phone || "未填写"}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail size={16} />
                  {candidate.email || "未填写"}
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

              {(candidate.bio || application.self_introduction) && (
                <div className="border-t pt-4">
                  <Label className="block mb-2">自我介绍</Label>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {application.self_introduction || candidate.bio}
                  </p>
                </div>
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

                    {interview.response_status === "rejected" && interview.response_reason && (
                      <div className="mt-2 text-sm text-gray-500 italic">
                        拒绝理由：{interview.response_reason}
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

                    {trial.status === "completed" && !trial.feedback && trial.interviewer_id === userId && (
                      <div className="mt-3">
                        <Textarea
                          value={trialForm.location}
                          onChange={(e) => setTrialForm((prev) => ({ ...prev, location: e.target.value }))}
                          placeholder="请输入试岗反馈"
                          rows={3}
                          className="mb-2"
                        />
                        <Button
                          onClick={() => handleSubmitTrialFeedback(trial.id, trialForm.location)}
                          disabled={!trialForm.location.trim()}
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
                        <Label htmlFor="trial-end">结束日期（可选）</Label>
                        <Input
                          id="trial-end"
                          type="date"
                          value={trialForm.end_date}
                          onChange={(e) => setTrialForm((prev) => ({ ...prev, end_date: e.target.value }))}
                        />
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
                          setTrialForm({ start_date: "", end_date: "", location: "" });
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
              {application.status === "hired" || application.status === "accepted" ? (
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
    </div>
  );
}