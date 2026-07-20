import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";

/**
 * 主应用布局 - 包含顶部导航栏和底部 TabBar
 * 用于需要认证的页面
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* 页面内容区 */}
      <div className="min-h-screen pb-16">{children}</div>

      {/* 底部导航栏 */}
      <BottomNav />
    </div>
  );
}
