/**
 * 登录页布局 - 简洁居中
 * 用于 /login, /register 等认证相关页面
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-green/5 to-background px-4">
      {/* 顶部品牌标识 */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-brand-green">招贤令</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          招贤纳士，汇聚英才
        </p>
      </div>

      {/* 表单卡片 */}
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
