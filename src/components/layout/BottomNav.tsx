"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { BOTTOM_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * 底部导航栏组件
 * 根据用户角色动态显示不同的 Tab
 */
export function BottomNav() {
  const pathname = usePathname();
  const role = useAuth((state) => state.role);
  const loading = useAuth((state) => state.loading);

  // 加载中或未登录时显示默认导航
  const tabs = BOTTOM_NAV[role ?? "candidate"];

  if (loading) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-screen-sm items-center justify-around px-2" />
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-screen-sm items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/home"
              ? pathname === "/" || pathname === "/home" || pathname.startsWith("/home")
              : pathname.startsWith(tab.href);

          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                isActive
                  ? "text-brand-green"
                  : "text-muted-foreground hover:text-brand-green-light"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive && "text-brand-orange"
                )}
              />
              <span className={cn(isActive && "font-medium")}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
