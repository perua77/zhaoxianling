"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  Calendar,
  ClipboardCheck,
  UserPlus,
} from "lucide-react";

interface MenuSection {
  role: string;
  label: string;
  items: { label: string; href: string; icon: typeof LayoutDashboard }[];
}

const menuSections: MenuSection[] = [
  {
    role: "recruiter",
    label: "招聘者",
    items: [
      { label: "数据看板", href: "/recruiter/dashboard", icon: LayoutDashboard },
      { label: "岗位列表", href: "/recruiter/jobs", icon: Briefcase },
      { label: "投递管理", href: "/recruiter/applications", icon: ClipboardList },
      { label: "面试安排", href: "/recruiter/interviews", icon: Calendar },
    ],
  },
  {
    role: "interviewer",
    label: "面试官",
    items: [
      { label: "我的任务", href: "/recruiter/interviewer-tasks", icon: ClipboardCheck },
    ],
  },
  {
    role: "referrer",
    label: "推荐人",
    items: [
      { label: "我的推荐", href: "/recruiter/referrals", icon: UserPlus },
    ],
  },
];

export default function RecruiterSidebar() {
  const pathname = usePathname();
  const { fullName, roles } = useAuth();

  const hasRole = (role: string) => roles?.includes(role);

  return (
    <aside className="fixed left-0 top-0 w-[240px] h-screen bg-[#185A56] text-white flex flex-col">
      <div className="p-6 border-b border-white/10">
        <div className="text-xl font-bold">招贤令</div>
        <div className="text-sm text-white/60 mt-1">招聘管理后台</div>
      </div>

      <nav className="flex-1 p-4 space-y-4">
        {menuSections.map((section) => {
          if (!hasRole(section.role)) return null;

          return (
            <div key={section.role}>
              <div className="px-4 py-2 text-xs text-white/50 font-medium uppercase tracking-wider">
                {section.label}
              </div>
              <div className="space-y-1 mt-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-white/15 text-white font-medium"
                          : "text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
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