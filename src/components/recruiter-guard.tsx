"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const ALLOWED_ROLES = ["recruiter", "interviewer", "referrer"];

interface RecruiterGuardProps {
  children: ReactNode;
}

export function RecruiterGuard({ children }: RecruiterGuardProps) {
  const { userId, roles, loading } = useAuth();
  const router = useRouter();

  // 登录态恢复中：已恢复 userId 但 profile(roles) 尚未拉取到。
  // 此时不能判定为“无权限”，否则会在 profile 到达前白屏 / 误跳转。
  const restoring = Boolean(userId) && roles.length === 0;

  useEffect(() => {
    // 仅在确定“已登录但无权限”或“未登录”时才跳转
    if (loading || restoring) return;

    if (!userId) {
      router.push("/login");
      return;
    }

    const hasPermission = roles.some((role) => ALLOWED_ROLES.includes(role));
    if (!hasPermission) {
      router.push("/");
    }
  }, [userId, roles, loading, restoring, router]);

  if (loading || restoring) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  if (!userId) {
    return null;
  }

  const hasPermission = roles.some((role) => ALLOWED_ROLES.includes(role));

  if (!hasPermission) {
    return null;
  }

  return <>{children}</>;
}