"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
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
  return (
    <Suspense fallback={<div className="flex justify-center py-20">加载中...</div>}>
      <JobsPageContent />
    </Suspense>
  );
}

function JobsPageContent() {
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
    async function fetchJobs() {
      try {
        const response = await fetch("/api/test-supabase");
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          setJobs(result.data as Job[]);
        } else {
          setJobs([]);
        }
      } catch (err) {
        console.error("[API] Error fetching jobs:", err);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
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