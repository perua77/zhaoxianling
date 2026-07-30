"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/Card";
import { FileText, ClipboardCheck, Clock, CheckCircle2, UserCheck, CalendarCheck } from "lucide-react";

interface DashboardStats {
  newApplications: number;
  pendingEvaluations: number;
  pendingTrialFeedback: number;
  hired: number;
  pendingOnboarding: number;
  onboarded: number;
  onboardedThisMonth: number;
}

const EMPTY_STATS: DashboardStats = {
  newApplications: 0,
  pendingEvaluations: 0,
  pendingTrialFeedback: 0,
  hired: 0,
  pendingOnboarding: 0,
  onboarded: 0,
  onboardedThisMonth: 0,
};

interface MetricCard {
  key: keyof DashboardStats;
  label: string;
  hint: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  href?: string;
  emptyHint: string;
}

const CARDS: MetricCard[] = [
  {
    key: "newApplications",
    label: "新投递",
    hint: "最近 7 天",
    color: "#185A56",
    icon: FileText,
    href: "/recruiter/applications?status=reviewing",
    emptyHint: "近 7 天暂无新投递",
  },
  {
    key: "pendingEvaluations",
    label: "待评价面试",
    hint: "面试已完成，待给出结果",
    color: "#FD742D",
    icon: ClipboardCheck,
    href: "/recruiter/interviews?status=pending_eval",
    emptyHint: "没有待评价的面试",
  },
  {
    key: "pendingTrialFeedback",
    label: "待反馈试岗",
    hint: "试岗进行中，待填写反馈",
    color: "#FD742D",
    icon: Clock,
    href: "/recruiter/interviews?status=trial_active",
    emptyHint: "没有进行中的试岗",
  },
  {
    key: "pendingOnboarding",
    label: "待入职",
    hint: "已录用，待确认/待到岗",
    color: "#FD742D",
    icon: UserCheck,
    href: "/recruiter/onboarding?status=pending_confirmation",
    emptyHint: "暂无待入职",
  },
  {
    key: "onboarded",
    label: "已入职",
    hint: "累计成功入职人数",
    color: "#16A34A",
    icon: CheckCircle2,
    href: "/recruiter/onboarding?status=onboarded",
    emptyHint: "暂无入职记录",
  },
  {
    key: "onboardedThisMonth",
    label: "本月入职",
    hint: "本月成功入职人数",
    color: "#16A34A",
    icon: CalendarCheck,
    href: "/recruiter/onboarding?status=onboarded",
    emptyHint: "本月暂无入职",
  },
];

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-20 rounded bg-gray-200" />
          <div className="h-9 w-16 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-100" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = user?.id;

  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/recruiter/dashboard?userId=${userId}`);
        const result = await response.json();
        setStats(result.success ? (result.data as DashboardStats) : EMPTY_STATS);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        setStats(EMPTY_STATS);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId, authLoading]);

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "#185A56" }}>
          数据看板
        </h1>
        <p className="text-gray-600 mt-2">重点关注需要处理的事项</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading || !stats
          ? CARDS.map((c) => <SkeletonCard key={c.key} />)
          : CARDS.map((card) => {
              const Icon = card.icon;
              const value = stats[card.key];
              const clickable = Boolean(card.href);
              return (
                <Card
                  key={card.key}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable ? `${card.label}：${value}，点击查看` : undefined}
                  interactive={clickable}
                  onClick={() => card.href && router.push(card.href)}
                  onKeyDown={(e) => {
                    if (card.href && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      router.push(card.href);
                    }
                  }}
                  className={clickable ? "focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2" : ""}
                >
                  <CardContent className="p-2 text-inherit">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        {card.label}
                      </span>
                      <Icon className="h-5 w-5" style={{ color: card.color }} />
                    </div>
                    <div className="mt-3 text-3xl font-bold" style={{ color: card.color }}>
                      {value}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {value === 0 ? card.emptyHint : card.hint}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}