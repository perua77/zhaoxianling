import { Navbar } from "@/components/Navbar";

/**
 * 公共页面布局 - 包含顶部导航栏
 * 用于公开访问的页面（岗位列表、岗位详情等）
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}