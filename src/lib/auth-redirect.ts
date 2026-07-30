/**
 * 根据用户角色计算登录后应跳转的首页。
 *
 * 优先级：recruiter > interviewer > referrer > candidate
 * - recruiter（招聘者，含 vendor 供应商）→ /recruiter/dashboard
 * - interviewer（面试官）→ /recruiter/interviewer-tasks
 * - referrer（推荐人）→ /home
 * - candidate（候选人）或未知 → /home
 */
export function getHomePathByRoles(roles: string[] | null | undefined): string {
  const list = Array.isArray(roles) ? roles : [];

  // recruiter / vendor 优先级最高
  if (list.includes("recruiter") || list.includes("vendor")) {
    return "/recruiter/dashboard";
  }

  // 面试官（不含 recruiter/vendor）
  if (list.includes("interviewer")) {
    return "/recruiter/interviewer-tasks";
  }

  // 推荐人与候选人都进入 /home
  return "/home";
}