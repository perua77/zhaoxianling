"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  OnboardingFormDialog,
  type OnboardingFormPayload,
} from "@/components/recruiter/onboarding-form-dialog";
import {
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_COLORS,
} from "@/lib/constants";
import type { Onboarding, OnboardingStatus } from "@/lib/types";

interface OnboardingRow extends Onboarding {
  jobs?: { id: string; title: string; location: string } | null;
  candidate?: { id: string; full_name: string; phone: string } | null;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "pending_confirmation", label: "待确认" },
  { value: "confirmed", label: "已确认" },
  { value: "onboarded", label: "已入职" },
  { value: "cancelled", label: "已取消" },
];

export default function RecruiterOnboardingPage() {
  const { userId, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  // 编辑弹窗
  const [editTarget, setEditTarget] = useState<OnboardingRow | null>(null);
  const [editing, setEditing] = useState(false);
  // 取消弹窗
  const [cancelTarget, setCancelTarget] = useState<OnboardingRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/onboarding?role=recruiter&userId=${userId}`);
      const result = await res.json();
      if (result.success && result.data) {
        setRows(result.data as OnboardingRow[]);
        setError(null);
      } else {
        setError(result.error || "加载失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    fetchRows();
  }, [authLoading, fetchRows]);

  const view = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    return [...list].sort((a, b) => {
      const ta = new Date(a.onboard_date).getTime();
      const tb = new Date(b.onboard_date).getTime();
      return sortOrder === "asc" ? ta - tb : tb - ta;
    });
  }, [rows, statusFilter, sortOrder]);

  // 保存编辑
  const handleEditConfirm = useCallback(
    async (payload: OnboardingFormPayload) => {
      if (!editTarget || !userId) return;
      setEditing(true);
      try {
        const res = await fetch(
          `/api/onboarding?action=update&userId=${userId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onboardingId: editTarget.id, ...payload }),
          }
        );
        const result = await res.json();
        if (result.success) {
          setEditTarget(null);
          fetchRows();
        } else {
          alert(result.error || "保存失败");
        }
      } catch {
        alert("网络错误，请重试");
      } finally {
        setEditing(false);
      }
    },
    [editTarget, userId, fetchRows]
  );

  // 标记已入职
  const markOnboarded = useCallback(
    async (row: OnboardingRow) => {
      if (!userId) return;
      if (!confirm(`确认将「${row.candidate?.full_name || "候选人"}」标记为已入职？`))
        return;
      setActing(row.id);
      try {
        const res = await fetch(
          `/api/onboarding?action=mark-onboarded&userId=${userId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onboardingId: row.id }),
          }
        );
        const result = await res.json();
        if (result.success) {
          setRows((prev) =>
            prev.map((r) =>
              r.id === row.id ? { ...r, status: "onboarded" as OnboardingStatus } : r
            )
          );
        } else {
          alert(result.error || "操作失败");
        }
      } catch {
        alert("网络错误，请重试");
      } finally {
        setActing(null);
      }
    },
    [userId]
  );

  // 取消入职
  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTarget || !userId) return;
    if (!cancelReason.trim()) {
      alert("请填写取消原因");
      return;
    }
    setActing(cancelTarget.id);
    try {
      const res = await fetch(`/api/onboarding?action=cancel&userId=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingId: cancelTarget.id, reason: cancelReason }),
      });
      const result = await res.json();
      if (result.success) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === cancelTarget.id
              ? { ...r, status: "cancelled" as OnboardingStatus }
              : r
          )
        );
        setCancelTarget(null);
        setCancelReason("");
      } else {
        alert(result.error || "操作失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setActing(null);
    }
  }, [cancelTarget, cancelReason, userId]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">入职管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            管理已录用候选人的入职安排与状态
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="状态筛选" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
          >
            入职日期 {sortOrder === "asc" ? "↑" : "↓"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {view.length === 0 ? (
        <EmptyState title="暂无入职记录" description="录用候选人后会在此显示入职安排" />
      ) : (
        <div className="space-y-4">
          {view.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {row.candidate?.full_name || "候选人"}
                    </CardTitle>
                    <p className="mt-1 text-sm text-gray-500">
                      {row.jobs?.title || "未知岗位"}
                      {row.candidate?.phone ? `  ·  ${row.candidate.phone}` : ""}
                    </p>
                  </div>
                  <Badge
                    className={
                      ONBOARDING_STATUS_COLORS[row.status] ||
                      "bg-gray-100 text-gray-600"
                    }
                  >
                    {ONBOARDING_STATUS_LABELS[row.status] || row.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    入职日期：
                    {row.onboard_date
                      ? new Date(row.onboard_date).toLocaleDateString("zh-CN")
                      : "待定"}
                  </p>
                  <p>入职地点：{row.onboard_location || "待定"}</p>
                  <p>
                    联系人：{row.contact_person || "-"}
                    {row.contact_phone ? ` 电话：${row.contact_phone}` : ""}
                  </p>
                  {row.onboard_notes && (
                    <p className="whitespace-pre-wrap">入职须知：{row.onboard_notes}</p>
                  )}
                </div>
                {row.status !== "onboarded" && row.status !== "cancelled" && (
                  <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditTarget(row)}
                    >
                      编辑信息
                    </Button>
                    <Button
                      size="sm"
                      className="bg-brand-green hover:bg-brand-green/90"
                      disabled={acting === row.id}
                      onClick={() => markOnboarded(row)}
                    >
                      标记已入职
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      disabled={acting === row.id}
                      onClick={() => {
                        setCancelTarget(row);
                        setCancelReason("");
                      }}
                    >
                      取消入职
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑弹窗（复用 OnboardingFormDialog） */}
      <OnboardingFormDialog
        open={!!editTarget}
        title="编辑入职信息"
        candidateName={editTarget?.candidate?.full_name}
        submitting={editing}
        initialValue={
          editTarget
            ? {
                onboard_date: editTarget.onboard_date,
                onboard_location: editTarget.onboard_location,
                contact_person: editTarget.contact_person,
                contact_phone: editTarget.contact_phone,
                onboard_notes: editTarget.onboard_notes || "",
              }
            : undefined
        }
        onClose={() => setEditTarget(null)}
        onConfirm={handleEditConfirm}
      />

      {/* 取消入职弹窗（二次确认 + 原因） */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-2 text-lg font-semibold">取消入职</h3>
            <p className="mb-3 text-sm text-gray-500">
              取消「{cancelTarget.candidate?.full_name || "候选人"}」的入职，将通知候选人并回退投递状态，请填写原因。
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="取消原因（必填）..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
              >
                取消
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600"
                disabled={acting === cancelTarget.id}
                onClick={handleCancelConfirm}
              >
                确认取消入职
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}