import { cn } from "@/lib/utils";

/**
 * 页面容器组件
 * 提供统一的 padding 和 max-width
 */
interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** 是否带底部导航栏留白（默认 true） */
  withBottomNav?: boolean;
}

export function PageContainer({
  children,
  className,
  withBottomNav = true,
}: PageContainerProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-screen-sm px-4",
        withBottomNav && "pb-20 pt-4",
        className
      )}
    >
      {children}
    </main>
  );
}
