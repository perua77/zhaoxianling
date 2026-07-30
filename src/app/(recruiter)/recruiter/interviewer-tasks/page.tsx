"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { InterviewCard } from "@/components/interview-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Calendar, MapPin, User, Phone, ClipboardCheck, Clock, Briefcase } from "lucide-react";
import { InterviewsPageContent } from "@/components/recruiter/interviews-management";

const INTERVIEW_FILTER_OPTIONS = [
  { value: "", label: "全部" },
  { value: "scheduled", label: "待面试" },
  { value: "pass", label: "面试通过" },
  { value: "fail", label: "面试未通过" },
  { value: "cancelled", label: "面试取消" },
  { value: "no_show", label: "未到场" },
];

const TRIAL_FILTER_OPTIONS = [
  { value: "", label: "全部" },
  { value: "confirmed", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已终止" },
];

const SORT_OPTIONS = [
  { value: "scheduled_at_desc", label: "时间倒序" },
  { value: "scheduled_at_asc", label: "时间正序" },
];

interface InterviewTask {
  id: string;
  application_id: string;
  job_id: string;
  candidate_name: string;
  job_title: string;
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

interface TrialTask {
  id: string;
  application_id: string;
  job_id: string;
  candidate_name: string;
  job_title: string;
  start_date: string;
  end_date?: string;
  location: string;
  status: string;
  feedback?: string;
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

export default function InterviewerTasksPage() {
  const { userId, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"process" | "interview" | "trial">("interview");
  const [interviewTasks, setInterviewTasks] = useState<InterviewTask[]>([]);
  const [trialTasks, setTrialTasks] = useState<TrialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [evaluationText, setEvaluationText] = useState("");
  const [interviewResult, setInterviewResult] = useState<string>("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [trialFeedback, setTrialFeedback] = useState("");
  const [trialResult, setTrialResult] = useState<"pass" | "fail" | "">("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("scheduled_at_desc");

  const fetchData = useCallback(async () => {
    if (authLoading || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [interviewsResponse, trialsResponse] = await Promise.all([
        fetch(`/api/recruiter/interviewer-tasks?userId=${userId}&type=interview`),
        fetch(`/api/recruiter/interviewer-tasks?userId=${userId}&type=trial`),
      ]);

      const interviewsResult = await interviewsResponse.json();
      const trialsResult = await trialsResponse.json();

      if (interviewsResult.success) {
        setInterviewTasks(interviewsResult.data as InterviewTask[]);
      }

      if (trialsResult.success) {
        setTrialTasks(trialsResult.data as TrialTask[]);
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, authLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: string, body: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/recruiter/interviewer-tasks?action=${action}&userId=${userId}`, {
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

  const handleAcceptInterview = async (interviewId: string) => {
    await handleAction("accept-interview", { interviewId });
    await fetchData();
  };

  const handleRejectInterview = async (interviewId: string) => {
    if (!rejectReason.trim()) return;
    await handleAction("reject-interview", { interviewId, reason: rejectReason });
    setRejectModal(null);
    setRejectReason("");
    await fetchData();
  };

  const handleMarkCompleted = async (interviewId: string) => {
    if (!interviewResult) return;
    await handleAction("mark-completed", {
      interviewId,
      result: interviewResult,
      evaluation: evaluationText,
    });
    setExpandedTask(null);
    setEvaluationText("");
    setInterviewResult("");
    await fetchData();
  };

  const handleMarkNoShow = async (interviewId: string) => {
    await handleAction("mark-no-show", { interviewId });
    await fetchData();
  };

  const handleSubmitTrialFeedback = async (trialId: string) => {
    if (!trialFeedback.trim() || !trialResult) return;
    await handleAction("submit-trial-feedback", {
      trialId,
      feedback: trialFeedback,
      result: trialResult,
    });
    setExpandedTask(null);
    setTrialFeedback("");
    setTrialResult("");
    await fetchData();
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

  const filteredAndSortedInterviewTasks = useMemo(() => {
    let filtered = [...interviewTasks];
    
    if (filterStatus) {
      filtered = filtered.filter((task) => {
        if (filterStatus === "pass" || filterStatus === "fail") {
          return task.result === filterStatus;
        }
        return task.status === filterStatus;
      });
    }
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.scheduled_at);
      const dateB = new Date(b.scheduled_at);
      return sortBy === "scheduled_at_desc" 
        ? dateB.getTime() - dateA.getTime() 
        : dateA.getTime() - dateB.getTime();
    });
    
    return filtered;
  }, [interviewTasks, filterStatus, sortBy]);

  const filteredAndSortedTrialTasks = useMemo(() => {
    let filtered = [...trialTasks];
    
    if (filterStatus) {
      filtered = filtered.filter((task) => task.status === filterStatus);
    }
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.start_date);
      const dateB = new Date(b.start_date);
      return sortBy === "scheduled_at_desc" 
        ? dateB.getTime() - dateA.getTime() 
        : dateA.getTime() - dateB.getTime();
    });
    
    return filtered;
  }, [trialTasks, filterStatus, sortBy]);

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
          我的任务
        </h1>
        <p className="text-gray-600 mt-2">管理你的面试和试岗任务</p>
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

      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "process" ? "default" : "outline"}
          onClick={() => setActiveTab("process")}
        >
          <Briefcase size={18} className="mr-2" />
          流程管理
        </Button>
        <Button
          variant={activeTab === "interview" ? "default" : "outline"}
          onClick={() => setActiveTab("interview")}
        >
          <ClipboardCheck size={18} className="mr-2" />
          面试任务 ({interviewTasks.length})
        </Button>
      </div>

      {activeTab === "process" && (
        <Suspense fallback={<LoadingSpinner size="lg" label="加载中..." className="py-20" />}>
          <InterviewsPageContent embedded />
        </Suspense>
      )}

      {activeTab !== "process" && (
      <div className="flex gap-4 mb-6">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="筛选条件" />
          </SelectTrigger>
          <SelectContent>
            {(activeTab === "interview" ? INTERVIEW_FILTER_OPTIONS : TRIAL_FILTER_OPTIONS).map((option) => (
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
      )}

      {activeTab !== "process" && (activeTab === "interview" ? (
        filteredAndSortedInterviewTasks.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="暂无面试任务"
            description="没有需要处理的面试安排"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAndSortedInterviewTasks.map((task) => {
              const resultPending = !task.result || task.result === "pending";
              const canRespond = task.response_status === "pending" && task.status === "scheduled";
              // 已接受且结果待评定 → 允许填写面评/反馈结果（不再要求面试时间已过）
              const canMark =
                task.response_status === "accepted" &&
                task.status === "scheduled" &&
                resultPending;
              const canEvaluate = task.status === "completed" && !task.evaluation;
              let actions: ReactNode = null;
              if (canRespond) {
                actions = (
                  <div className="flex gap-2">
                    <Button
                      className="bg-[#185A56] hover:bg-[#185A56]/90 text-white"
                      onClick={() => handleAcceptInterview(task.id)}
                    >
                      接受
                    </Button>
                    <Button variant="outline" onClick={() => setRejectModal(task.id)}>
                      拒绝
                    </Button>
                  </div>
                );
              } else if (canMark) {
                actions =
                  expandedTask === task.id ? (
              <div className="space-y-2 w-full">
                      <div className="flex gap-2">
                        <Button
                          variant={interviewResult === "pass" ? "default" : "outline"}
                          className={interviewResult === "pass" ? "bg-green-600 hover:bg-green-700" : ""}
                          onClick={() => setInterviewResult("pass")}
                        >
                          通过
                        </Button>
                        <Button
                          variant={interviewResult=== "fail" ? "default" : "outline"}
                          className={interviewResult === "fail" ? "bg-red-600 hover:bg-red-700" : ""}
                          onClick={() => setInterviewResult("fail")}
                        >
                      未通过
                       </Button>
                      </div>
                      <Textarea
                        value={evaluationText}
                        onChange={(e) => setEvaluationText(e.target.value)}
                        placeholder="请输入面评"
                        rows={3}
                      />
                      <Button onClick={() => handleMarkCompleted(task.id)} disabled={!interviewResult}>
                        提交结果
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button onClick={() => setExpandedTask(task.id)}>填写面评</Button>
                      <Button onClick={() => setExpandedTask(task.id)}>反馈结果</Button>
                      <Button variant="outline" onClick={() => handleMarkNoShow(task.id)}>
                        标记未到场
                    </Button>
                    </div>
                  );
              } else if (canEvaluate) {
                actions =
                  expandedTask === task.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={evaluationText}
                        onChange={(e) => setEvaluationText(e.target.value)}
                        placeholder="请输入面评"
                        rows={3}
                      />
                      <Button onClick={() => handleMarkCompleted(task.id)}>提交面评</Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => setExpandedTask(task.id)}>
                      填写面评
                    </Button>
                  );
              }
              return (
                <InterviewCard
                  key={task.id}
                  standalone
                  showHeader
                  roundLabel={`第${task.round}轮`}
                  data={{
                    id: task.id,
                    candidate_name: task.candidate_name,
                    job_title: task.job_title,
                    scheduled_at: task.scheduled_at,
                    location: task.location,
                    contact_person: task.contact_person,
                    contact_phone: task.contact_phone,
                    status: task.status,
                    result: task.result,
                    evaluation: task.evaluation,
                    response_status: task.response_status,
                    response_reason: task.response_reason,
                    round: task.round,
                  }}
                  actions={actions}
                />
              );
            })}
          </div>
        )
      ) : (
        filteredAndSortedTrialTasks.length === 0 ? (
          <EmptyState icon={Clock} title="暂无试岗任务" description="没有需要处理的试岗安排" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAndSortedTrialTasks.map((task) => (
              <Card key={task.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{task.candidate_name}</h3>
                      <p className="text-sm text-gray-600">{task.job_title}</p>
                    </div>
                    <Badge className={TRIAL_STATUS_COLORS[task.status]}>
                      {TRIAL_STATUS_LABELS[task.status]}
                    </Badge>
                  </div>

                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      {formatDate(task.start_date)}
                      {task.end_date && ` - ${formatDate(task.end_date)}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} />
                      {task.location}
                    </div>
                  </div>

                  {task.feedback && (
                    <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      <span className="font-medium">反馈：</span>
                      {task.feedback}
                    </div>
                  )}

                  {task.status !== "completed" && (
                    <div className="mt-4">
                      {expandedTask === task.id ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={trialResult === "pass" ? "default" : "outline"}
                              onClick={() => setTrialResult("pass")}
                            >
                              试岗通过
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={trialResult === "fail" ? "default" : "outline"}
                              onClick={() => setTrialResult("fail")}
                            >
                              试岗未通过
                            </Button>
                          </div>
                          <Textarea
                            value={trialFeedback}
                            onChange={(e) => setTrialFeedback(e.target.value)}
                            placeholder="请输入试岗反馈"
                            rows={3}
                          />
                          <Button
                            onClick={() => handleSubmitTrialFeedback(task.id)}
                            disabled={!trialResult || !trialFeedback.trim()}
                          >
                            提交反馈
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" onClick={() => { setExpandedTask(task.id); setTrialResult(""); setTrialFeedback(""); }}>
                          填写反馈
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ))}

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
                variant="outline"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => handleRejectInterview(rejectModal)}
                disabled={!rejectReason.trim()}
              >
                确认拒绝
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}