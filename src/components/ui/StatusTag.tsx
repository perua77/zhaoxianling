import { cn } from "@/lib/utils";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  TRIAL_STATUS_LABELS,
  TRIAL_STATUS_COLORS,
  INTERVIEW_RESULT_LABELS,
  INTERVIEW_RESULT_COLORS,
  REFERRAL_STATUS_LABELS,
  REFERRAL_STATUS_COLORS,
} from "@/lib/constants";
import type {
  JobStatus,
  ApplicationStatus,
  TrialStatus,
  InterviewResult,
  ReferralStatus,
} from "@/lib/types";

interface StatusTagProps {
  status:
    | { kind: "job"; value: JobStatus }
    | { kind: "application"; value: ApplicationStatus }
    | { kind: "trial"; value: TrialStatus }
    | { kind: "interview"; value: InterviewResult }
    | { kind: "referral"; value: ReferralStatus };
  className?: string;
}

/**
 * 状态标签组件
 * 根据不同状态类型自动匹配中文标签与颜色
 */
export function StatusTag({ status, className }: StatusTagProps) {
  let label: string;
  let color: string;

  switch (status.kind) {
    case "job":
      label = JOB_STATUS_LABELS[status.value];
      color = JOB_STATUS_COLORS[status.value];
      break;
    case "application":
      label = APPLICATION_STATUS_LABELS[status.value];
      color = APPLICATION_STATUS_COLORS[status.value];
      break;
    case "trial":
      label = TRIAL_STATUS_LABELS[status.value];
      color = TRIAL_STATUS_COLORS[status.value];
      break;
    case "interview":
      label = INTERVIEW_RESULT_LABELS[status.value];
      color = INTERVIEW_RESULT_COLORS[status.value];
      break;
    case "referral":
      label = REFERRAL_STATUS_LABELS[status.value];
      color = REFERRAL_STATUS_COLORS[status.value];
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        color,
        className
      )}
    >
      {label}
    </span>
  );
}
