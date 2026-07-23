"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { Job } from "@/lib/types";
import {
  DOMAIN_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/constants";
import { getRegions } from "@/lib/region-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Briefcase } from "lucide-react";

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "", label: "全部" },
  { value: "fulltime", label: "全职" },
  { value: "hourly", label: "小时工" },
  { value: "daily", label: "日结" },
  { value: "outsource", label: "外包" },
];

const mockJobs: Job[] = [
  {
    id: "mock-1",
    recruiter_id: "recruiter-1",
    title: "超市收银员",
    description: "负责超市收银工作，处理顾客结账，维护收银台整洁，提供优质顾客服务。要求有责任心，沟通能力强。",
    domain: "supermarket",
    employment_type: "fulltime",
    salary_min: 4500,
    salary_max: 6000,
    salary_unit: "月",
    location: "北京市朝阳区",
    requirements: "1. 年龄18-35岁\n2. 有收银经验优先\n3. 能适应轮班工作\n4. 持有健康证",
    is_active: true,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "mock-2",
    recruiter_id: "recruiter-2",
    title: "仓库管理员",
    description: "负责仓库日常管理，包括货物入库、出库、盘点、整理等工作。要求熟悉仓库操作流程，能吃苦耐劳。",
    domain: "warehouse",
    employment_type: "hourly",
    salary_min: 25,
    salary_max: 32,
    salary_unit: "时",
    location: "上海市浦东新区",
    requirements: "1. 年龄20-45岁\n2. 能熟练操作叉车优先\n3. 有仓库管理经验\n4. 身体健康，能承受体力劳动",
    is_active: true,
    created_at: "2024-01-14T09:00:00Z",
    updated_at: "2024-01-14T09:00:00Z",
  },
  {
    id: "mock-3",
    recruiter_id: "recruiter-3",
    title: "销售代表",
    description: "负责产品销售，开发新客户，维护老客户关系，完成销售目标。要求有良好的沟通能力和销售技巧。",
    domain: "sales",
    employment_type: "fulltime",
    salary_min: 5000,
    salary_max: 12000,
    salary_unit: "月",
    location: "广州市天河区",
    requirements: "1. 年龄22-40岁\n2. 有销售经验优先\n3. 能适应出差\n4. 有驾照优先",
    is_active: true,
    created_at: "2024-01-13T14:00:00Z",
    updated_at: "2024-01-13T14:00:00Z",
  },
  {
    id: "mock-4",
    recruiter_id: "recruiter-4",
    title: "工厂操作工",
    description: "负责生产线操作，按照工艺流程完成生产任务，保证产品质量。要求能适应流水线工作节奏。",
    domain: "factory",
    employment_type: "daily",
    salary_min: 180,
    salary_max: 220,
    salary_unit: "日",
    location: "深圳市宝安区",
    requirements: "1. 年龄18-45岁\n2. 能适应站立工作\n3. 服从管理安排\n4. 无不良嗜好",
    is_active: true,
    created_at: "2024-01-12T08:00:00Z",
    updated_at: "2024-01-12T08:00:00Z",
  },
  {
    id: "mock-5",
    recruiter_id: "recruiter-5",
    title: "生鲜理货员",
    description: "负责超市生鲜区商品陈列、补货、整理，保证商品新鲜度和货架整洁。要求有责任心，注重卫生。",
    domain: "supermarket",
    employment_type: "fulltime",
    salary_min: 4000,
    salary_max: 5500,
    salary_unit: "月",
    location: "成都市锦江区",
    requirements: "1. 年龄18-40岁\n2. 有生鲜工作经验优先\n3. 能适应早晚班\n4. 持有健康证",
    is_active: true,
    created_at: "2024-01-11T11:00:00Z",
    updated_at: "2024-01-11T11:00:00Z",
  },
  {
    id: "mock-6",
    recruiter_id: "recruiter-6",
    title: "物流分拣员",
    description: "负责快递包裹分拣、扫描、打包等工作。要求手脚麻利，能适应高强度工作。",
    domain: "warehouse",
    employment_type: "hourly",
    salary_min: 22,
    salary_max: 28,
    salary_unit: "时",
    location: "杭州市余杭区",
    requirements: "1. 年龄18-45岁\n2. 能适应夜班\n3. 视力良好\n4. 无犯罪记录",
    is_active: true,
    created_at: "2024-01-10T16:00:00Z",
    updated_at: "2024-01-10T16:00:00Z",
  },
];

function getSalaryUnit(employmentType: Job["employment_type"]): string {
  switch (employmentType) {
    case "hourly":
      return "时";
    case "daily":
      return "日";
    case "fulltime":
      return "月";
    case "outsource":
      return "项目";
  }
}

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState(() => searchParams.get("province") || "");
  const [selectedCity, setSelectedCity] = useState(() => searchParams.get("city") || "");
  const [selectedDistrict, setSelectedDistrict] = useState(() => searchParams.get("district") || "");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState(() => searchParams.get("employment_type") || "");

  const provinces = useMemo(() => getRegions(), []);
  const cities = useMemo(() => getRegions(selectedProvince), [selectedProvince]);
  const districts = useMemo(() => getRegions(selectedProvince, selectedCity), [selectedProvince, selectedCity]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (selectedEmploymentType && job.employment_type !== selectedEmploymentType) {
        return false;
      }
      return true;
    });
  }, [jobs, selectedEmploymentType]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.warn("[API] Fetch timed out, using mock data");
      setJobs(mockJobs);
      setLoading(false);
    }, 8000);

    async function fetchJobs() {
      try {
        const response = await fetch("/api/test-supabase");
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          setJobs(result.data as Job[]);
        } else {
          setJobs(mockJobs);
        }
      } catch (err) {
        console.error("[API] Error fetching jobs:", err);
        setJobs(mockJobs);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }

    fetchJobs();

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedProvince) params.set("province", selectedProvince);
    if (selectedCity) params.set("city", selectedCity);
    if (selectedDistrict) params.set("district", selectedDistrict);
    if (selectedEmploymentType) params.set("employment_type", selectedEmploymentType);
    const paramString = params.toString();
    router.replace(paramString ? `?${paramString}` : window.location.pathname, { scroll: false });
  }, [selectedProvince, selectedCity, selectedDistrict, selectedEmploymentType, router]);

  const handleProvinceChange = (value: string) => {
    setSelectedProvince(value);
    setSelectedCity("");
    setSelectedDistrict("");
  };

  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    setSelectedDistrict("");
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingSpinner size="lg" label="加载中..." className="py-20" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-green">全部岗位</h1>
        <p className="text-gray-600 mt-2">浏览所有招聘中的岗位</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Select value={selectedProvince} onValueChange={handleProvinceChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="全部地区" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部地区</SelectItem>
            {provinces.map((province) => (
              <SelectItem key={province} value={province}>
                {province}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedCity}
          onValueChange={handleCityChange}
          disabled={!selectedProvince}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="全部城市" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部城市</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedDistrict}
          onValueChange={setSelectedDistrict}
          disabled={!selectedCity}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="全部区县" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部区县</SelectItem>
            {districts.map((district) => (
              <SelectItem key={district} value={district}>
                {district}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedEmploymentType}
          onValueChange={setSelectedEmploymentType}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="用工类型" />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJobs.map((job) => (
          <Card key={job.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl">{job.title}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="brand-green">
                  {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
                </Badge>
                <Badge variant="muted">
                  {DOMAIN_LABELS[job.domain]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-2">{job.location}</p>
              {job.salary_min != null && job.salary_max != null && (
                <p className="text-lg font-semibold text-brand-orange mb-4">
                  ¥{job.salary_min} - ¥{job.salary_max}/
                  {job.salary_unit || getSalaryUnit(job.employment_type)}
                </p>
              )}
              <p className="text-sm text-gray-700 line-clamp-2 mb-4">
                {job.description}
              </p>
              <Link href={`/jobs/${job.id}`}>
                <Button variant="primary" className="w-full">
                  查看详情
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {jobs.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="暂无招聘中的岗位"
          description="请稍后再来看看更多工作机会"
        />
      )}
    </div>
  );
}