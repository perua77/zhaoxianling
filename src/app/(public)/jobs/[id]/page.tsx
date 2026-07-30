"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import type { Job } from "@/lib/types";
import {
  DOMAIN_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ArrowLeft, UserPlus, Share2 } from "lucide-react";

// 品牌色
const BRAND_GREEN = "#185A56";

function getSalaryUnit(employmentType: Job["employment_type"]): string {
  switch (employmentType) {
    case "hourly":
      return "时";
    case "daily":
      return "日";
    case "fulltime":
      return "月";
    case "outsource":
      return "项目";
  }
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { roles } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isReferrer = roles?.includes("referrer");

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 生成分享文案：【七鲜招聘】{岗位名称} | {薪资范围} | {工作地点}\n查看详情：{URL}
  const buildShareText = (currentJob: Job, url: string) => {
    const title = currentJob.title?.trim() || "优质岗位";
    const location = currentJob.location?.trim() || "地点面议";

    let salary = "薪资面议";
    if (currentJob.salary_min != null && currentJob.salary_max != null) {
      const unit = currentJob.salary_unit || getSalaryUnit(currentJob.employment_type);
      salary = `¥${currentJob.salary_min}-${currentJob.salary_max}/${unit}`;
    }

    return `【七鲜招聘】${title} | ${salary} | ${location}\n查看详情：${url}`;
  };

  const handleShare = async () => {
    if (!job) return;

    // 使用当前页面 origin + 路径，不硬编码域名
    const url = `${window.location.origin}/jobs/${job.id}`;
    const shareText = buildShareText(job, url);

    // 移动端优先系统原生分享面板（需 HTTPS/localhost 环境）
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `七鲜招聘 - ${job.title}`, text: shareText, url });
        return;
      } catch (err) {
        // 用户主动取消（AbortError）不提示错误，直接返回
        if (err instanceof DOMException && err.name === "AbortError") return;
        // 其他错误则降级到复制
      }
    }

    // 剪贴板复制（需安全上下文 HTTPS/localhost）
    const isSecure =
      typeof window !== "undefined" &&
      (window.isSecureContext || window.location.hostname === "localhost");

    if (
      isSecure &&
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      try {
        await navigator.clipboard.writeText(shareText);
        showToast("已复制分享文案，快去发给朋友吧", "success");
        return;
      } catch {
        // 权限被拒或写入失败 → 尝试降级方案
      }
    }

    // 降级：非 HTTPS 或剪贴板不可用，使用 execCommand 兜底
    try {
      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        showToast("已复制分享文案，快去发给朋友吧", "success");
        return;
      }
      throw new Error("execCommand copy failed");
    } catch {
      showToast(
        isSecure ? "复制失败，请手动长按选择文案复制" : "当前环境不支持自动复制，请手动复制链接分享",
        "error"
      );
    }
  };

  useEffect(() => {
    async function fetchJob() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/test-supabase?id=${id}`);
        const result = await response.json();

        if (result.success && result.data) {
          setJob(result.data as Job);
        }
      } catch (err) {
        console.error("[API] Error fetching job:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingSpinner size="lg" label="加载中..." className="py-20" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-20">
          <p className="text-gray-500">岗位不存在或已删除</p>
          <Link href="/" className="mt-4 inline-flex items-center text-brand-green">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all ${
            toast.type === "success" ? "bg-brand-green text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
      <Link href="/" className="mb-4 inline-flex items-center text-muted-foreground hover:text-brand-green transition-colors">
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回岗位列表
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{job.title}</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="brand-green">
              {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
            </Badge>
            <Badge variant="muted">
              {DOMAIN_LABELS[job.domain]}
            </Badge>
            {job.is_active && (
              <Badge variant="brand-green">招聘中</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">
                工作地点
              </h3>
              <p className="text-gray-700">{job.location}</p>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">
                薪资待遇
              </h3>
              {job.salary_min != null && job.salary_max != null && (
                <p className="text-xl font-bold text-brand-orange">
                  ¥{job.salary_min} - ¥{job.salary_max}
                  <span className="text-sm font-normal text-gray-600">
                    /{job.salary_unit || getSalaryUnit(job.employment_type)}
                  </span>
                </p>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">
                岗位描述
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {job.description}
              </p>
            </div>

            {job.requirements && (
              <div>
                <h3 className="font-semibold text-base mb-2 text-foreground">
                  任职要求
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {job.requirements}
                </p>
              </div>
            )}

            <div className="pt-4 border-t space-y-3">
              <Link href={`/jobs/${job.id}/apply`}>
                <Button size="lg" variant="primary" className="w-full">
                  立即投递
                </Button>
              </Link>
              {isReferrer && (
                <Link href={`/jobs/${job.id}/apply?mode=refer`}>
                  <Button size="lg" variant="outline" className="w-full">
                    <UserPlus className="mr-2" size={18} />
                    推荐候选人
                  </Button>
                </Link>
              )}
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}
                onClick={handleShare}
              >
                <Share2 className="mr-2" size={18} />
                分享岗位
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
