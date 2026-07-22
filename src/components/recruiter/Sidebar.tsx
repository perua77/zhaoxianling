"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

const menuItems = [
  { label: "仪表盘", href: "/recruiter/dashboard", icon: LayoutDashboard },
  { label: "职位管理", href: "/recruiter/jobs", icon: Briefcase },
  { label: "申请管理", href: "/recruiter/applications", icon: FileText },
  { label: "面试管理", href: "/recruiter/interviews", icon: Users },
  { label: "系统设置", href: "/recruiter/admin", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <aside className="w-[240px] bg-[#185A56] text-white h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-white/10">
        <Link href="/recruiter/dashboard" className="text-xl font-bold">
          招贤令
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-white/10 w-full transition-colors"
        >
          <LogOut size={20} />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  );
}