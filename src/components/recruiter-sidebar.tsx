"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  { label: "📊 数据看板", href: "/recruiter/dashboard" },
  { label: "💼 岗位列表", href: "/recruiter/jobs" },
  { label: "📋 投递管理", href: "/recruiter/applications" },
  { label: "📅 面试安排", href: "/recruiter/interviews" },
];

export default function RecruiterSidebar() {
  const pathname = usePathname();
  const { fullName } = useAuth();

  return (
    <aside className="fixed left-0 top-0 w-[240px] h-screen bg-[#185A56] text-white flex flex-col">
      <div className="p-6 border-b border-white/10">
        <div className="text-xl font-bold">招贤令</div>
        <div className="text-sm text-white/60 mt-1">招聘管理后台</div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3">
        <Link
          href="/"
          className="block px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          返回首页
        </Link>
        {fullName && (
          <div className="px-4 py-2 text-sm text-white/60">
            当前用户：{fullName}
          </div>
        )}
      </div>
    </aside>
  );
}