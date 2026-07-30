import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 将 datetime-local 输入框的本地时间值（视为北京时间 UTC+8）转换为 UTC ISO 字符串，用于入库。
 * 例如 "2026-07-28T15:02" -> "2026-07-28T07:02:00.000Z"
 * 若已带时区信息或为空则原样返回。
 */
export function beijingLocalToUtcISO(localValue: string): string {
  if (!localValue) return localValue;
  // 已经是带时区的 ISO（含 Z 或 +hh:mm）则不再处理
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(localValue)) return localValue;
  // datetime-local 可能不含秒，补全后拼上北京时区偏移
  const withSeconds = localValue.length === 16 ? `${localValue}:00` : localValue;
  const parsed = new Date(`${withSeconds}+08:00`);
  if (Number.isNaN(parsed.getTime())) return localValue;
  return parsed.toISOString();
}

/**
 * 将 UTC 时间字符串转换为可供 datetime-local 输入框使用的北京时间值。
 * 例如 "2026-07-28T07:02:00.000Z" -> "2026-07-28T15:02"
 */
export function utcToBeijingLocalInput(utcString: string): string {
  if (!utcString) return utcString;
  const d = new Date(utcString);
  if (Number.isNaN(d.getTime())) return utcString;
  // 通过 en-CA + Asia/Shanghai 得到 "YYYY-MM-DD, HH:mm" 再整理
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

