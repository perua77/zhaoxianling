"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Clock,
  MapPin,
  Phone,
  User,
  Briefcase,
  Calendar,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
  round?: number;
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

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const PRIMARY = "#185A56";

// ---- 时区工具：统一按北京时间（Asia/Shanghai）取日期 ----
// scheduled_at 为 UTC 时间戳，跨天面试按北京时间所在自然日归属

/** 返回北京时间的 "YYYY-MM-DD" 日期 key */
function getBeijingDateKey(utcString: string): string {
  // en-CA 格式即 YYYY-MM-DD
  return new Date(utcString).toLocaleDateString("en-CA", {
    timeZone: "Asia/Shanghai",
  });
}

/** 由年月日构造本地日期 key（用于与北京时间 key 对齐比较） */
function toDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** 北京时间的今天 key */
function getTodayBeijingKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

/** 按北京时间格式化时分 */
function formatBeijingTime(utcString: string): string {
  return new Date(utcString).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 进度步骤条：根据申请状态推导阶段 */
const PROGRESS_STEPS = ["投递", "面试", "结果"];
function getProgressStep(interview: InterviewData): number {
  if (interview.result === "pass") return 3;
  if (interview.result === "fail") return 3;
  if (interview.status === "completed") return 3;
  if (interview.status === "scheduled") return 2;
  return 1;
}
function isRejected(interview: InterviewData): boolean {
  return interview.result === "fail" || interview.application_status === "rejected";
}

function isCancelled(interview: InterviewData): boolean {
  return interview.status === "cancelled" || interview.status === "no_show";
}

function getDisplayLabel(interview: InterviewData): string {
  if (interview.result === "pass") return INTERVIEW_RESULT_LABELS.pass;
  if (interview.result === "fail") return INTERVIEW_RESULT_LABELS.fail;
  return INTERVIEW_STATUS_LABELS[interview.status] || interview.status;
}

function getDisplayColor(interview: InterviewData): string {
  if (interview.result === "pass") return INTERVIEW_RESULT_COLORS.pass;
  if (interview.result === "fail") return INTERVIEW_RESULT_COLORS.fail;
  return INTERVIEW_STATUS_COLORS[interview.status] || "bg-gray-100 text-gray-500";
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuth((state) => state.user);

  const todayKey = useMemo(() => getTodayBeijingKey(), []);
  const [viewYear, setViewYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(todayKey.slice(5, 7)) - 1);
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);

  const fetchInterviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = user || useAuth.getState().user;
      if (!currentUser) {
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/candidate/interviews?userId=${currentUser.id}`);
      const result = await response.json();
      if (result.success && result.data) {
        setInterviews(result.data as InterviewData[]);
      } else {
        setError(result.error || "面试列表加载失败，请重试");
      }
    } catch (err) {
      console.warn("Error fetching interviews:", err);
      setError("网络异常，面试列表加载失败，请重试");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => setLoading(false), 1500);
      return () => clearTimeout(timer);
    }
    fetchInterviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 按北京时间日期分组
  const interviewsByDate = useMemo(() => {
    const map = new Map<string, InterviewData[]>();
    for (const it of interviews) {
      if (!it.scheduled_at) continue;
      const key = getBeijingDateKey(it.scheduled_at);
      const arr = map.get(key) || [];
      arr.push(it);
      map.set(key, arr);
    }
    // 每日内按时间升序
    for (const arr of map.values()) {
      arr.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    }
    return map;
  }, [interviews]);

  // 生成当前月的日历格子（周一为起始）
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // getDay: 0=周日 → 转为周一起始的偏移
    const jsDow = firstDay.getDay();
    const leadingBlanks = (jsDow + 6) % 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const selectedInterviews = interviewsByDate.get(selectedKey) || [];

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    setViewYear(Number(todayKey.slice(0, 4)));
    setViewMonth(Number(todayKey.slice(5, 7)) - 1);
    setSelectedKey(todayKey);
  };

  if (loading) {
    return <div className="container mx-auto p-6">加载中...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <XCircle className="mx-auto h-12 w-12 text-red-300" />
          <p className="mt-4 text-red-600">{error}</p>
          <button
            onClick={fetchInterviews}
            className="mt-4 rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green/90"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-green">我的面试日历</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看你的面试安排和进度</p>
      </header>

      {/* 全局空状态：候选人从未被安排任何面试 */}
      {interviews.length === 0 && (
        <div className="mb-6 rounded-lg border border-dashed border-gray-200 py-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-base font-medium text-gray-600">暂无面试安排</p>
          <p className="mt-1 text-sm text-gray-400">投递岗位后，招聘者会为你安排面试时间</p>
        </div>
      )}

      {/* 月历视图 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={goPrevMonth}
              aria-label="上个月"
              className="rounded-md p-2 hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">
                {viewYear} 年 {viewMonth + 1} 月
             </span>
              <button
                onClick={goToday}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                今天
              </button>
            </div>
            <button
              onClick={goNextMonth}
              aria-label="下个月"
              className="rounded-md p-2 hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-xs font-medium text-gray-400">
                {w}
              </div>
            ))}
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={`blank-${idx}`} className="aspect-square" />;
              }
              const cellKey = toDateKey(viewYear, viewMonth, day);
              const dayInterviews = interviewsByDate.get(cellKey) || [];
              const count = dayInterviews.length;
              const isToday = cellKey === todayKey;
              const isSelected = cellKey === selectedKey;
              // 当日全部取消则圆点用灰色
              const allCancelled = count > 0 && dayInterviews.every(isCancelled);

              return (
                <button
                  key={cellKey}
                  onClick={() => setSelectedKey(cellKey)}
                  aria-label={`${viewMonth + 1}月${day}日${count > 0 ? `，${count}场面试` : ""}`}
                  aria-pressed={isSelected}
                  className="relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors hover:bg-gray-100"
                  style={
                    isSelected
                      ? { backgroundColor: PRIMARY, color: "#fff" }
                      : isToday
                      ? { backgroundColor: "#E6F0EF" }
                      : undefined
                  }
                >
                  <span className={isToday && !isSelected ? "font-semibold text-brand-green" : ""}>
                    {day}
                  </span>
                  {count > 0 && (
                    <span className="mt-0.5 flex items-center gap-0.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: isSelected
                            ? "#fff"
                            : allCancelled
                            ? "#9CA3AF"
                            : "#F97316",
                        }}
                      />
                      {count > 1 && (
                        <span
                          className="text-[10px] leading-none"
                          style={{ color: isSelected ? "#fff" : "#F97316" }}
                        >
                          {count > 3 ? "3+" : count}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 选中日期的面试详情 */}
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-brand-green" />
        <h2 className="text-lg font-semibold">
          {Number(selectedKey.slice(5, 7))} 月 {Number(selectedKey.slice(8, 10))} 日
          {selectedKey === todayKey ? "（今天）" : ""}
        </h2>
      </div>

      {selectedInterviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">当天暂无面试安排</p>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedInterviews.map((interview) => {
            const cancelled = isCancelled(interview);
            const rejected = isRejected(interview);
            const step = getProgressStep(interview);
            return (
              <Card key={interview.id} className={cancelled ? "opacity-60" : ""}>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-brand-green" />
                      <h3
                        className={`text-base font-semibold ${
                          cancelled ? "text-gray-400 line-through" : ""
                        }`}
                      >
              {interview.job_title || "未知岗位"}
                        {interview.round ? (
                          <span className="ml-2 text-xs font-normal text-brand-green">
                            {interview.round === 1 ? "首轮面试" : `第${interview.round}轮面试`}
                          </span>
                        ) : null}
                      </h3>
                    </div>
                    <Badge className={getDisplayColor(interview)}>
                      {getDisplayLabel(interview)}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="font-medium">
                        {formatBeijingTime(interview.scheduled_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                      <span>{interview.location || "未指定地点"}</span>
                    </div>
                    {interview.contact_person && (
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 shrink-0 text-gray-400" />
                        <span>{interview.contact_person}</span>
                      </div>
                    )}
                    {interview.contact_phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                        <a
                          href={`tel:${interview.contact_phone}`}
                          className="font-medium text-brand-green hover:underline"
                        >
                          {interview.contact_phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* 进度步骤条 */}
                  <div className="mt-4 flex items-center">
                    {PROGRESS_STEPS.map((label, i) => {
                      const stepNo = i + 1;
                      const done = stepNo <= step;
                      const isFailNode = rejected && stepNo === PROGRESS_STEPS.length;
                      const dotColor = isFailNode
                        ? "#EF4444"
                        : done
                        ? PRIMARY
                        : "#D1D5DB";
                      return (
                        <div key={label} className="flex flex-1 items-center last:flex-none">
                          <div className="flex flex-col items-center">
                            <span
                              className="h-3 w-3 rounded-full"
                       style={{ backgroundColor: dotColor }}
                            />
                            <span
                              className="mt-1 text-[11px]"
                             style={{ color: done || isFailNode ? "#374151" : "#9CA3AF" }}
                            >
                              {isFailNode ? "未通过" : label}
                            </span>
                          </div>
                          {i < PROGRESS_STEPS.length - 1 && (
                            <span
                              className="mx-1 h-0.5 flex-1"
                              style={{
                                backgroundColor: stepNo < step ? PRIMARY : "#E5E7EB",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 面评为内部管理信息，候选人端不展示 */}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}