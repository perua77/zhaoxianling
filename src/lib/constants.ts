import type {
  UserRole,
  JobDomain,
  EmploymentType,
  ApplicationStatus,
  MessageType,
  TrialStatus,
  InterviewResult,
  ReferralStatus,
  OnboardingStatus,
} from "@/lib/types";
import type { FC } from "react";
import {
  Home,
  Briefcase,
  MessageSquare,
  User,
  PlusCircle,
  ClipboardList,
  LayoutDashboard,
  Calendar,
} from "lucide-react";

/* ============================================================
 * 枚举值 → 中文标签映射
 * ============================================================ */

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  candidate: "候选人",
  recruiter: "招聘方",
  interviewer: "面试官",
  referrer: "推荐人",
  vendor: "供应商",
};

export const DOMAIN_LABELS: Record<JobDomain, string> = {
  supermarket: "超市",
  warehouse: "仓储",
  sales: "销售",
  factory: "工厂",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  fulltime: "全职",
  hourly: "小时工",
  daily: "日结",
  outsource: "外包",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "待认领",
  reviewing: "待审核",
  "interview-scheduled": "待面试",
  interviewing: "面试中",
  "interview-passed": "面试通过",
  "interview-failed": "面试未通过",
  offering: "Offering",
  hired: "已录用",
  accepted: "已录用",
  rejected: "已拒绝",
  terminated: "已终止",
};

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  interview: "面试通知",
  result: "结果通知",
  apply: "申请通知",
  trial: "试用通知",
  checkin: "签到提醒",
  reminder: "系统提醒",
};

export const TRIAL_STATUS_LABELS: Record<TrialStatus, string> = {
  pending: "待开始",
  confirmed: "试岗中",
  completed: "已完成",
  cancelled: "已终止",
};

export const INTERVIEW_RESULT_LABELS: Record<InterviewResult, string> = {
  pass: "通过",
  fail: "未通过",
  pending: "待评定",
};

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "待确认",
  accepted: "已接受",
  rejected: "已拒绝",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  active: "招聘中",
  paused: "暂停招聘",
  closed: "已关闭",
};

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  pending_confirmation: "待确认",
  confirmed: "已确认",
  onboarded: "已入职",
  cancelled: "已取消",
};

/* ============================================================
 * 状态颜色映射（Tailwind 类名）
 * ============================================================ */

export const JOB_STATUS_COLORS: Record<string, string> = {
  active: "bg-brand-green/10 text-brand-green",
  paused: "bg-yellow-100 text-yellow-700",
  closed: "bg-gray-100 text-gray-500",
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  reviewing: "bg-blue-100 text-blue-700",
  "interview-scheduled": "bg-purple-100 text-purple-700",
  interviewing: "bg-brand-orange/10 text-brand-orange",
  "interview-passed": "bg-green-100 text-green-700",
  "interview-failed": "bg-red-100 text-red-700",
  offering: "bg-yellow-100 text-yellow-700",
  hired: "bg-brand-green/10 text-brand-green",
  accepted: "bg-brand-green/10 text-brand-green",
  rejected: "bg-red-100 text-red-700",
  terminated: "bg-gray-100 text-gray-500",
};

export const TRIAL_STATUS_COLORS: Record<TrialStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  confirmed: "bg-brand-green/10 text-brand-green",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

export const INTERVIEW_RESULT_COLORS: Record<InterviewResult, string> = {
  pass: "bg-brand-green/10 text-brand-green",
  fail: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
};

export const REFERRAL_STATUS_COLORS: Record<ReferralStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  accepted: "bg-brand-green/10 text-brand-green",
  rejected: "bg-red-100 text-red-700",
};

export const ONBOARDING_STATUS_COLORS: Record<OnboardingStatus, string> = {
  pending_confirmation: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  onboarded: "bg-brand-green/10 text-brand-green",
  cancelled: "bg-gray-100 text-gray-500",
};

/* ============================================================
 * 底部导航栏配置（按角色动态显示 Tab）
 * ============================================================ */

export interface NavTab {
  label: string;
  href: string;
  icon: FC<{ className?: string }>;
}

export const BOTTOM_NAV: Record<UserRole, NavTab[]> = {
  candidate: [
    { label: "首页", href: "/home", icon: Home },
    { label: "岗位", href: "/jobs", icon: Briefcase },
    { label: "面试日历", href: "/calendar", icon: Calendar },
    { label: "消息", href: "/messages", icon: MessageSquare },
    { label: "我的", href: "/profile", icon: User },
  ],
  recruiter: [
    { label: "首页", href: "/home", icon: Home },
    { label: "发布", href: "/recruiter/jobs/new", icon: PlusCircle },
    { label: "管理", href: "/recruiter/jobs", icon: ClipboardList },
    { label: "看板", href: "/recruiter/dashboard", icon: LayoutDashboard },
    { label: "消息", href: "/messages", icon: MessageSquare },
    { label: "我的", href: "/profile", icon: User },
  ],
  interviewer: [
    { label: "首页", href: "/home", icon: Home },
    { label: "岗位", href: "/jobs", icon: Briefcase },
    { label: "面试安排", href: "/recruiter/interviews", icon: Calendar },
    { label: "消息", href: "/messages", icon: MessageSquare },
    { label: "我的", href: "/profile", icon: User },
  ],
  referrer: [
    { label: "首页", href: "/home", icon: Home },
    { label: "岗位", href: "/jobs", icon: Briefcase },
    { label: "消息", href: "/messages", icon: MessageSquare },
    { label: "我的", href: "/profile", icon: User },
  ],
  vendor: [
    { label: "首页", href: "/home", icon: Home },
    { label: "岗位", href: "/jobs", icon: Briefcase },
    { label: "消息", href: "/messages", icon: MessageSquare },
    { label: "我的", href: "/profile", icon: User },
  ],
};
