"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

/**
 * 认证 Provider
 * 在根布局中包裹整个应用，自动恢复本地存储的认证状态
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const init = useAuth((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return <>{children}</>;
}
