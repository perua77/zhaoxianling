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
      {children}
    </div>
  );
}
