"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/lib/constants";
import type { Application, Job, ApplicationStatus } from "@/lib/types";

/* ============================================================
 * 状态分区（互斥，保证同一条记录只出现在一个 Tab）
 * 以 application.status 为唯一归属依据：
 *  - 我的投递(Tab1)：pending / reviewing / interview-scheduled /
 *    interviewing / interview-passed / interview-failed / rejected / terminated
 *  - 我的 Offer(Tab2)：offering / accepted / hired
 * hired（已入职）合并到 Tab2 展示（删除独立的"我的入职"Tab）。
 * 撤回 Offer（offering→interview-scheduled）后自动回到 Tab1。
 * ============================================================ */
const TAB1_STATUSES: ApplicationStatus[] = [
  "pending",
  "reviewing",
  "interview-scheduled",
  "interviewing",
  "interview-passed",
  "interview-failed",
  "rejected",
  "terminated",
];
const TAB2_STATUSES: ApplicationStatus[] = ["offering", "accepted", "hired"];

// 允许候选人主动终止流程的状态（进行中的中间态）
const TERMINABLE_STATUSES: ApplicationStatus[] = [
  "pending",
  "reviewing",
  "interview-scheduled",
  "interviewing",
  "interview-passed",
  "offering",
];

interface TrialInfo {
  id: string;
  start_date?: string;
  location?: string;
}
interface InterviewInfo {
  id: string;
  contact_person?: string;
  contact_phone?: string;
}
interface OnboardingInfo {
  id: string;
  status?: string;
  onboard_date?: string;
 onboard_location?: string;
  contact_person?: string;
  contact_phone?: string;
  onboard_notes?: string;
}
interface ApplicationWithJob extends Application {
  jobs?: Job;
  trials?: TrialInfo[];
  interviews?: InterviewInfo[];
  onboarding?: OnboardingInfo[];
}

type TabKey = "applications" | "offers";

/* 进度条阶段（Tab1 卡片用） */
const PROGRESS_STEPS = ["投递", "审核", "面试", "试岗", "Offer", "录用"];

function getProgressIndex(status: ApplicationStatus, trials?: TrialInfo[]): number {
  // 修复2：优先检查 trials 表——安排试岗后进度条应推进到「试岗」阶段
  const hasTrial = Array.isArray(trials) && trials.length > 0;
  switch (status) {
    case "pending":
      return 0;
    case "reviewing":
      return 1;
    case "interview-scheduled":
    case "interviewing":
    case "interview-failed":
      return 2;
    case "interview-passed":
      // 面试通过后若已安排试岗，推进到「试岗」(3)，否则停留在「面试」(2)
      return hasTrial ? 3 : 2;
    case "offering":
    case "accepted":
      return 4;
    case "hired":
      return 5;
    default:
      return hasTrial ? 3 : 0;
  }
}

function ProgressBar({ status, trials }: { status: ApplicationStatus; trials?: TrialInfo[] }) {
  const current = getProgressIndex(status, trials);
  const failed =
    status === "rejected" ||
    status === "interview-failed" ||
    status === "terminated";
  return (
    <div className="mt-3 flex items-center">
      {PROGRESS_STEPS.map((step, idx) => {
        const done = idx <= current && !failed;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  done ? "bg-brand-green" : "bg-gray-300"
                }`}
              />
              <span
                className={`mt-1 text-[10px] ${
                  done ? "text-brand-green" : "text-gray-400"
                }`}
              >
                {step}
              </span>
            </div>
            {idx < PROGRESS_STEPS.length - 1 && (
              <div
                className={`mx-1 h-0.5 flex-1 ${
                  idx < current && !failed ? "bg-brand-green" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function statusBadge(status: string) {
  const label =
    APPLICATION_STATUS_LABELS[status as keyof typeof APPLICATION_STATUS_LABELS] || status;
  const color =
    APPLICATION_STATUS_COLORS[status as keyof typeof APPLICATION_STATUS_COLORS] ||
    "bg-gray-100 text-gray-600";
  return <Badge className={color}>{label}</Badge>;
}

export function MyApplicationsTabs({ candidateId }: { candidateId?: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("applications");
  // 懒加载：一次性拉取全部投递，本地按状态分区
  const [apps, setApps] = useState<ApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tab1 排序：最新/最早
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  // Tab1 状态筛选
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Offer 拒绝弹窗
  const [rejectTarget, setRejectTarget] = useState<ApplicationWithJob | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  // 放弃入职弹窗
  const [abandonTarget, setAbandonTarget] = useState<ApplicationWithJob | null>(null);
  const [abandonReason, setAbandonReason] = useState("");
  // 接受 Offer 确认弹窗
  const [acceptTarget, setAcceptTarget] = useState<ApplicationWithJob | null>(null);
  // 确认已入职弹窗
  const [onboardTarget, setOnboardTarget] = useState<ApplicationWithJob | null>(null);
  // 终止流程弹窗
  const [terminateTarget, setTerminateTarget] = useState<ApplicationWithJob | null>(null);
  const [terminateReason, setTerminateReason] = useState("");
  const [terminating, setTerminating] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/applications?candidate_id=${candidateId}`);
      const result = await res.json();
      if (result.success && result.data) {
        setApps(result.data as ApplicationWithJob[]);
        setError(null);
      } else {
        setError(result.error?.message || result.error || "加载失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // 分区
  const tab1 = useMemo(
    () => apps.filter((a) => TAB1_STATUSES.includes(a.status)),
    [apps]
  );
  const tab2 = useMemo(
    () => apps.filter((a) => TAB2_STATUSES.includes(a.status)),
    [apps]
  );

  // Tab1 筛选+排序
  const tab1View = useMemo(() => {
    let list = tab1;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });
  }, [tab1, statusFilter, sortOrder]);

  // Offer 响应
  const respondOffer = useCallback(
    async (
      app: ApplicationWithJob,
      action: "accept" | "reject" | "confirm-onboard" | "abandon",
      reason?: string
    ) => {
      if (!candidateId) return;
      setActing(app.id);
      try {
        const res = await fetch("/api/applications/offer-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: app.id,
            candidateId,
            action,
            reason,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setApps((prev) =>
            prev.map((a) =>
              a.id === app.id
                ? {
                    ...a,
                    status: result.status as ApplicationStatus,
                    onboarding: a.onboarding?.map((o) => ({
                      ...o,
                      status:
                        action === "confirm-onboard"
                          ? "onboarded"
                          : action === "abandon"
                          ? "cancelled"
                          : o.status,
                    })),
                  }
                : a
            )
          );
        } else {
          alert(result.error || "操作失败");
          fetchApps();
        }
      } catch {
        alert("网络错误，请重试");
      } finally {
        setActing(null);
        setRejectTarget(null);
        setRejectReason("");
        setAbandonTarget(null);
        setAbandonReason("");
        setAcceptTarget(null);
        setOnboardTarget(null);
      }
    },
    [candidateId, fetchApps]
  );

  // 候选人终止招聘流程
  const terminateProcess = useCallback(
    async (app: ApplicationWithJob, reason?: string) => {
      if (!candidateId) return;
      setTerminating(app.id);
      try {
        const res = await fetch("/api/applications/terminate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: app.id,
            operatorId: candidateId,
            operatorRole: "candidate",
            reason,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setApps((prev) =>
            prev.map((a) =>
              a.id === app.id
                ? {
                    ...a,
                    status: "terminated" as ApplicationStatus,
                    terminated_at: new Date().toISOString(),
                    terminate_reason: reason,
                  }
                : a
            )
   );
        } else {
          alert(result.error || "操作失败");
          fetchApps();
        }
      } catch {
        alert("网络错误，请重试");
      } finally {
        setTerminating(null);
        setTerminateTarget(null);
        setTerminateReason("");
      }
    },
    [candidateId, fetchApps]
  );

  const salaryText = (job?: Job) =>
    job ? `¥${job.salary_min || 0} - ¥${job.salary_max || 0}/${job.salary_unit || "月"}` : "";

  return (
    <div>
      {/* Tab 头部：固定显示，含数量徽章 */}
      <div className="sticky top-0 z-10 -mx-1 flex gap-1 border-b bg-white px-1 pb-0 pt-1">
        {(
          [
            { key: "applications", label: "我的投递", count: tab1.length },
            { key: "offers", label: "我的 Offer", count: tab2.length },
          ] as { key: TabKey; label: string; count: number }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 whitespace-nowrap border-b-2 px-2 py-3 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "border-brand-green text-brand-green"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="pt-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">加载中…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-500">{error}</p>
        ) : activeTab === "applications" ? (
          /* ================= Tab1：我的投递 ================= */
          <div>
            {/* 筛选 + 排序 */}
            <div className="mb-3 flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border px-2 py-1 text-sm"
              >
                <option value="all">全部状态</option>
                {TAB1_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {APPLICATION_STATUS_LABELS[s as keyof typeof APPLICATION_STATUS_LABELS] || s}
                  </option>
                ))}
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                className="rounded-md border px-2 py-1 text-sm"
              >
                <option value="newest">最新优先</option>
                <option value="oldest">最早优先</option>
              </select>
            </div>

            {tab1View.length === 0 ? (
    <p className="py-10 text-center text-sm text-gray-400">暂无投递记录</p>
            ) : (
              <div className="space-y-3">
                {tab1View.map((app) => (
                  <Card
                    key={app.id}
                 className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => router.push(`/jobs/${app.job_id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {app.jobs?.title || "职位"}
                        </CardTitle>
                        {statusBadge(app.status)}
                      </div>
                      <p className="text-xs text-gray-500">{salaryText(app.jobs)}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ProgressBar status={app.status} trials={app.trials} />
                      {app.status === "terminated" && app.terminate_reason && (
                        <p className="mt-2 text-xs text-gray-500">
                          终止原因：{app.terminate_reason}
                        </p>
                      )}
                      {TERMINABLE_STATUSES.includes(app.status) && (
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={terminating === app.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTerminateTarget(app);
                            }}
                          >
                            终止流程
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ================= Tab2：我的 Offer ================= */
          <div>
            {tab2.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">暂无 Offer</p>
            ) : (
              <div className="space-y-3">
                {tab2.map((app) => {
                  const isPending = app.status === "offering";
                  const isHired = app.status === "hired";
                  const onboard = app.onboarding?.[0];
                  const hasOnboardDetail =
                    !!onboard && (!!onboard.onboard_date || !!onboard.onboard_location);
                  return (
                    <Card
                      key={app.id}
                      className="cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => router.push(`/jobs/${app.job_id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">
                            {app.jobs?.title || "职位"}
                          </CardTitle>
                          {isHired ? (
                            <Badge className="bg-green-100 text-green-700">已入职</Badge>
                          ) : (
                            statusBadge(app.status)
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{salaryText(app.jobs)}</p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {/* 入职详情：offering/accepted/hired 均展示（若已填写） */}
                        {hasOnboardDetail && (
                          <div className="mt-2 space-y-1 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                            {onboard?.onboard_date && (
                              <p>入职日期：{onboard.onboard_date}</p>
                            )}
                            {onboard?.onboard_location && (
                              <p>入职地点：{onboard.onboard_location}</p>
                            )}
                            {onboard?.contact_person && (
                              <p>对接人：{onboard.contact_person}</p>
                            )}
                            {onboard?.contact_phone && (
                              <p>联系电话：{onboard.contact_phone}</p>
                            )}
                            {onboard?.onboard_notes && (
                              <p>备注：{onboard.onboard_notes}</p>
                            )}
                          </div>
                        )}

                        {/* 操作区：offering=接受/拒绝；accepted=已入职/放弃入职（分阶段） */}
                        {(isPending || app.status === "accepted") && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {isPending && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={acting === app.id}
                                  style={{ backgroundColor: "#185A56", color: "#fff" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAcceptTarget(app);
                                  }}
                                >
                                  接受 Offer
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={acting === app.id}
                                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRejectTarget(app);
                                  }}
                                >
                                  拒绝 Offer
                                </Button>
                              </>
                            )}
                            {app.status === "accepted" && (
                              <>
                                <span className="w-full text-xs text-brand-green">
                                  已接受 Offer，请按入职安排办理入职
                                </span>
                                <Button
                                  size="sm"
                                  disabled={acting === app.id}
                                  style={{ backgroundColor: "#185A56", color: "#fff" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOnboardTarget(app);
                                  }}
                                >
                                  已入职
                                </Button>
                              <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={acting === app.id}
                                  className="border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAbandonTarget(app);
                                  }}
                                >
                                  放弃入职
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                        {isHired && (
                          <p className="mt-2 text-xs text-green-600">恭喜入职！</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 接受 Offer 确认弹窗 */}
      {acceptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5">
            <h3 className="mb-3 text-base font-semibold">接受 Offer</h3>
            <p className="mb-4 text-sm text-gray-600">
              确认接受「{acceptTarget.jobs?.title ?? ""}」的 Offer 吗？接受后请按入职安排办理入职。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={acting === acceptTarget.id}
                onClick={() => setAcceptTarget(null)}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={acting === acceptTarget.id}
                style={{ backgroundColor: "#185A56", color: "#fff" }}
                onClick={() => respondOffer(acceptTarget, "accept")}
              >
                确认接受
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 确认已入职弹窗 */}
      {onboardTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5">
            <h3 className="mb-3 text-base font-semibold">确认已入职</h3>
            <p className="mb-4 text-sm text-gray-600">
              确认已在「{onboardTarget.jobs?.title ?? ""}」入职吗？确认后流程将标记为已入职。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={acting === onboardTarget.id}
                onClick={() => setOnboardTarget(null)}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={acting === onboardTarget.id}
                style={{ backgroundColor: "#185A56", color: "#fff" }}
                onClick={() => respondOffer(onboardTarget, "confirm-onboard")}
              >
                确认已入职
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 拒绝 Offer 弹窗 */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5">
            <h3 className="mb-3 text-base font-semibold">拒绝 Offer</h3>
            <p className="mb-2 text-sm text-gray-500">
              {rejectTarget.jobs?.title || "该职位"}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写拒绝原因（选填）"
              className="h-24 w-full resize-none rounded-md border p-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={acting === rejectTarget.id}
                onClick={() => respondOffer(rejectTarget, "reject", rejectReason)}
              >
                确认拒绝
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 放弃入职弹窗 */}
      {abandonTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5">
            <h3 className="mb-3 text-base font-semibold">放弃入职</h3>
            <p className="mb-2 text-sm text-gray-500">
              放弃入职后该流程将终止且无法恢复。确定放弃入职
              「{abandonTarget.jobs?.title || "该职位"}」？
            </p>
            <textarea
              value={abandonReason}
              onChange={(e) => setAbandonReason(e.target.value)}
              placeholder="请填写放弃原因（必填）"
              className="h-24 w-full resize-none rounded-md border p-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAbandonTarget(null);
                  setAbandonReason("");
                }}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={acting === abandonTarget.id || !abandonReason.trim()}
                onClick={() => respondOffer(abandonTarget, "abandon", abandonReason)}
              >
                确认放弃
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 终止流程弹窗 */}
      {terminateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5">
            <h3 className="mb-3 text-base font-semibold">终止招聘流程</h3>
            <p className="mb-2 text-sm text-gray-500">
              终止后将取消关联的未完成面试，且无法恢复。确定终止
              「{terminateTarget.jobs?.title || "该职位"}」的招聘流程？
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
                size="sm"
                onClick={() => {
                  setTerminateTarget(null);
                  setTerminateReason("");
                }}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={terminating === terminateTarget.id}
                onClick={() => terminateProcess(terminateTarget, terminateReason)}
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