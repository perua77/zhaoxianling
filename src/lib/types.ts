// 用户角色
export type UserRole =
  | "candidate" // 候选人
  | "recruiter" // 招聘方
  | "interviewer" // 面试官
  | "referrer" // 推荐人
  | "vendor"; // 供应商

// 行业类型
export type JobDomain =
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
  | "pending" // 待认领
  | "reviewing" // 待审核
  | "interview-scheduled" // 待面试（已安排面试时间）
  | "interviewing" // 面试中
  | "interview-passed" // 面试通过
  | "interview-failed" // 面试未通过
  | "offering" // 发放offer
  | "hired" // 已录用
  | "accepted" // 已录用（兼容旧数据）
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
  roles: UserRole[];
  full_name: string;
  phone: string;
  gender?: string; // 性别: male, female, 或空字符串(保密)
  age?: number; // 年龄
  avatar_url?: string;
  company?: string; // 招聘方/供应商公司名称
  industry?: JobDomain; // 所属行业
  bio?: string; // 个人简介
  created_at: string;
  updated_at: string;
}

// 职位
export interface Job {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  domain: JobDomain;
  employment_type: EmploymentType;
  salary_min?: number;
  salary_max?: number;
  salary_unit?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  requirements?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 申请记录
export interface Application {
  id: string;
  job_id: string; // 关联 job.id
  candidate_id: string; // 关联 profile.id
  status: ApplicationStatus;
  full_name?: string; // 姓名
  phone?: string; // 手机号
  email?: string; // 邮箱
  self_introduction?: string; // 自我介绍
  cover_letter?: string; // 自荐信
  resume_url?: string; // 简历链接
  created_at: string;
  updated_at: string;
}

// 面试记录
export interface Interview {
  id: string;
  application_id: string;
  job_id: string;
  interviewer_id: string;
  scheduled_at: string;
  location: string;
  contact_person?: string;
  contact_phone?: string;
  status: string;
  evaluation?: string;
  checked_in_at?: string;
  created_at: string;
  updated_at: string;
}

// 试用记录
export interface Trial {
  id: string;
  application_id: string;
  job_id: string;
  interviewer_id: string;
  start_date: string;
  end_date: string;
  location: string;
  status: string;
  feedback?: string;
  confirmed_at?: string;
  is_hired?: boolean;
  created_at: string;
  updated_at: string;
}

// 消息通知
export interface Message {
  id: string;
  type: MessageType;
  recipient_id: string;
  application_id?: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// 职位分配记录
export interface JobAssignment {
  id: string;
  job_id: string;
  recruiter_id: string;
  created_at: string;
}
