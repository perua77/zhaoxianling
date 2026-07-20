// 用户角色
export type UserRole =
  | "candidate" // 候选人
  | "recruiter" // 招聘方
  | "interviewer" // 面试官
  | "referrer" // 推荐人
  | "vendor"; // 供应商

// 行业类型
export type IndustryType =
  | "supermarket" // 超市
  | "warehouse" // 仓库
  | "sales" // 销售
  | "factory"; // 工厂

// 雇佣类型
export type EmploymentType =
  | "fulltime" // 全职
  | "hourly" // 小时工
  | "daily" // 日结
  | "outsource"; // 外包

// 职位状态
export type JobStatus = "active" | "paused" | "closed";

// 申请状态
export type ApplicationStatus =
  | "pending" // 待处理
  | "reviewing" // 审核中
  | "interviewing" // 面试中
  | "offered" // 已录用
  | "rejected"; // 已拒绝

// 消息类型
export type MessageType =
  | "interview" // 面试通知
  | "result" // 结果通知
  | "apply" // 申请通知
  | "trial" // 试用通知
  | "checkin" // 签到提醒
  | "reminder"; // 其他提醒

// 试用状态
export type TrialStatus = "active" | "completed" | "terminated";

// 面试形式
export type InterviewFormat = "online" | "onsite";

// 面试结果
export type InterviewResult = "pass" | "fail" | "pending";

// 推荐状态
export type ReferralStatus = "pending" | "accepted" | "rejected";

// 用户资料
export interface Profile {
  id: string; // 关联 auth.users.id
  role: UserRole;
  name: string;
  phone: string;
  avatar_url?: string;
  company?: string; // 招聘方/供应商公司名称
  industry?: IndustryType; // 所属行业
  bio?: string; // 个人简介
  created_at: string;
  updated_at: string;
}

// 职位
export interface Job {
  id: string;
  recruiter_id: string; // 关联 profile.id
  title: string;
  description: string;
  industry: IndustryType;
  employment_type: EmploymentType;
  salary_min?: number;
  salary_max?: number;
  location: string;
  requirements?: string;
  headcount?: number; // 招聘人数
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

// 申请记录
export interface Application {
  id: string;
  job_id: string; // 关联 job.id
  candidate_id: string; // 关联 profile.id
  status: ApplicationStatus;
  cover_letter?: string; // 自荐信
  resume_url?: string; // 简历链接
  created_at: string;
  updated_at: string;
}

// 面试记录
export interface Interview {
  id: string;
  application_id: string; // 关联 application.id
  interviewer_id: string; // 关联 profile.id
  scheduled_at: string; // 面试时间 ISO 字符串
  location: string; // 面试地点或会议链接
  format: InterviewFormat;
  notes?: string; // 面试备注
  result: InterviewResult;
  created_at: string;
  updated_at: string;
}

// 试用记录
export interface Trial {
  id: string;
  application_id: string; // 关联 application.id
  start_date: string; // 试用期开始日期
  end_date: string; // 试用期结束日期
  status: TrialStatus;
  feedback?: string; // 试用反馈
  created_at: string;
  updated_at: string;
}

// 消息通知
export interface Message {
  id: string;
  sender_id: string; // 关联 profile.id
  receiver_id: string; // 关联 profile.id
  type: MessageType;
  title: string;
  content: string;
  is_read: boolean;
  related_id?: string; // 关联的 job/application/interview id
  created_at: string;
}

// 推荐记录
export interface Referral {
  id: string;
  referrer_id: string; // 推荐人 profile.id
  candidate_id: string; // 被推荐人 profile.id
  job_id: string; // 关联 job.id
  status: ReferralStatus;
  reward?: number; // 推荐奖励金额
  note?: string; // 推荐备注
  created_at: string;
  updated_at: string;
}
