"use client";

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Clock, MapPin, User, Phone } from "lucide-react";

// 单场面试的通用展示数据结构
export interface InterviewCardData {
  id: string;
  candidate_name?: string;
  job_title?: string;
  scheduled_at: string;
  location?: string;
  interviewer_name?: string;
  contact_person?: string;
  contact_phone?: string;
  status: string;
  result?: string;
  evaluation?: string;
  response_status?: string;
  response_reason?: string;
  round?: number;
}

// 状态/结果的文案与颜色映射（两个页面统一使用，保证视觉一致）
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

function formatDateTime(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface InterviewCardProps {
  data: InterviewCardData;
  // 是否作为独立卡片渲染（interviewer-tasks 用 true；interviews 内嵌记录用 false）
  standalone?: boolean;
  // 是否显示候选人姓名 + 岗位标题（interviewer-tasks 需要，interviews 外层已展示则不需要）
  showHeader?: boolean;
  // 轮次前缀文案，例如 "第1轮面试"
  roundLabel?: string;
  // 底部操作区插槽：由父页面传入不同按钮（接受/拒绝、反馈结果、重新安排等），
  // 通过插槽解耦，新增第三种页面时无需改动本组件即可扩展。
  actions?: ReactNode;
}

export function InterviewCard({
  data,
  standalone = false,
  showHeader = false,
  roundLabel,
  actions,
}: InterviewCardProps) {
  const body = (
    <>
      {/* 顶部：候选人/岗位 + 状态徽章 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          {showHeader ? (
            <>
              <h3 className="text-lg font-semibold">{data.candidate_name}</h3>
              <p className="text-sm text-gray-600">{data.job_title}</p>
            </>
          ) : (
            <span className="font-medium">{roundLabel || "面试"}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Badge className={INTERVIEW_STATUS_COLORS[data.status] || "bg-gray-100 text-gray-700"}>
            {INTERVIEW_STATUS_LABELS[data.status] || data.status}
          </Badge>
          {data.response_status && (
            <Badge
              className={
                RESPONSE_STATUS_COLORS[data.response_status] || "bg-gray-100 text-gray-700"
              }
            >
              {RESPONSE_STATUS_LABELS[data.response_status] || data.response_status}
            </Badge>
          )}
        </div>
      </div>

      {/* 信息字段：时间 -> 地点 -> 面试官 -> 联系人 -> 电话，两个页面顺序一致 */}
      <div className="text-sm text-gray-600 space-y-2">
        <div className="flex items-center gap-2">
          <Clock size={16} className="shrink-0" />
          <span>{formatDateTime(data.scheduled_at)}</span>
          {roundLabel && showHeader && (
            <span className="text-xs text-gray-400">{roundLabel}</span>
          )}
        </div>
        {data.location && (
          <div className="flex items-center gap-2">
            <MapPin size={16} className="shrink-0" />
            <span>{data.location}</span>
          </div>
        )}
        {data.interviewer_name && (
          <div className="flex items-center gap-2">
            <User size={16} className="shrink-0" />
            <span>面试官：{data.interviewer_name}</span>
          </div>
        )}
        {data.contact_person && (
          <div className="flex items-center gap-2">
            <User size={16} className="shrink-0" />
            <span>联系人：{data.contact_person}</span>
          </div>
        )}
        {data.contact_phone && (
          <div className="flex items-center gap-2">
            <Phone size={16} className="shrink-0" />
            <span>联系电话：{data.contact_phone}</span>
          </div>
        )}
      </div>

      {/* 拒绝理由：长文本换行不溢出 */}
      {data.response_status === "rejected" && data.response_reason && (
        <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm text-orange-800 font-medium">面试官已拒绝此面试安排</p>
          <p className="text-sm text-orange-700 mt-1 break-words whitespace-pre-wrap">
            拒绝理由：{data.response_reason}
          </p>
        </div>
      )}

      {/* 面试结果 */}
      {data.result && (
        <div className="mt-3">
          <Badge className={INTERVIEW_RESULT_COLORS[data.result] || "bg-gray-100 text-gray-700"}>
            面试结果：{INTERVIEW_RESULT_LABELS[data.result] || data.result}
          </Badge>
        </div>
      )}

      {/* 面评：长文本换行不溢出 */}
      {data.evaluation && (
        <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded break-words whitespace-pre-wrap">
          <span className="font-medium">面评：</span>
          {data.evaluation}
        </div>
      )}

      {/* 操作区插槽 */}
      {actions && <div className="mt-4">{actions}</div>}
    </>
  );

  if (standalone) {
    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">{body}</CardContent>
      </Card>
    );
  }

  // 内嵌模式：作为 interviews 页面复合卡片内的单轮记录小块
  return <div className="bg-gray-50 rounded-lg p-4">{body}</div>;
}