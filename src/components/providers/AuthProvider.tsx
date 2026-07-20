"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

/**
 * 认证 Provider
 * 在根布局中包裹整个应用，自动监听 Supabase 认证状态变化
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const init = useAuth((state) => state.init);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  return <>{children}</>;
}
