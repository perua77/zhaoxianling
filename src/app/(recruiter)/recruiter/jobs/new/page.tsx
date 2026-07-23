"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { DOMAIN_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/lib/constants";
import { getRegions } from "@/lib/region-data";
import type { JobDomain, EmploymentType } from "@/lib/types";

interface FormData {
  title: string;
  domain: JobDomain;
  employment_type: EmploymentType;
  province: string;
  city: string;
  district: string;
  location: string;
  salary_min: string;
  salary_max: string;
  salary_unit: string;
  description: string;
  requirements: string;
}

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS);
const EMPLOYMENT_TYPE_OPTIONS = Object.entries(EMPLOYMENT_TYPE_LABELS);
const SALARY_UNIT_OPTIONS = [
  { value: "月", label: "月" },
  { value: "日", label: "日" },
  { value: "时", label: "时" },
];

export default function NewJobPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    domain: "supermarket",
    employment_type: "fulltime",
    province: "",
    city: "",
    district: "",
    location: "",
    salary_min: "",
    salary_max: "",
    salary_unit: "月",
    description: "",
    requirements: "",
  });

  const provinces = useMemo(() => getRegions(), []);
  const cities = useMemo(() => getRegions(formData.province), [formData.province]);
  const districts = useMemo(() => getRegions(formData.province, formData.city), [formData.province, formData.city]);

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.title.trim()) newErrors.title = "请输入岗位名称";
    if (!formData.province) newErrors.province = "请选择省份";
    if (!formData.city) newErrors.city = "请选择城市";
    if (!formData.district) newErrors.district = "请选择区县";
    if (!formData.location.trim()) newErrors.location = "请输入详细地址";
    if (!formData.salary_min || isNaN(Number(formData.salary_min))) newErrors.salary_min = "请输入有效的最低薪资";
    if (!formData.salary_max || isNaN(Number(formData.salary_max))) newErrors.salary_max = "请输入有效的最高薪资";
    if (Number(formData.salary_min) > Number(formData.salary_max)) newErrors.salary_max = "最高薪资不能低于最低薪资";
    if (!formData.description.trim()) newErrors.description = "请输入岗位描述";
    if (!formData.requirements.trim()) newErrors.requirements = "请输入任职要求";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;
    if (!userId) {
      setToast({ message: "请先登录", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const fullLocation = `${formData.province}${formData.city}${formData.district}${formData.location.trim()}`;
      const { error } = await supabase.from("jobs").insert({
        title: formData.title.trim(),
        domain: formData.domain,
        employment_type: formData.employment_type,
        province: formData.province,
        city: formData.city,
        district: formData.district,
        location: fullLocation,
        salary_min: Number(formData.salary_min),
        salary_max: Number(formData.salary_max),
        salary_unit: formData.salary_unit,
        description: formData.description.trim(),
        requirements: formData.requirements.trim(),
        recruiter_id: userId,
        is_active: true,
      });

      if (error) {
        throw error;
      }

      setToast({ message: "岗位发布成功", type: "success" });
      setTimeout(() => {
        router.push("/recruiter/jobs");
      }, 1500);
    } catch (error) {
      console.error("Failed to create job:", error);
      setToast({
        message: error instanceof Error ? error.message : "发布失败，请重试",
        type: "error",
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "#185A56" }}>
          发布新岗位
        </h1>
        <p className="text-gray-600 mt-2">填写岗位信息，开始招聘</p>
      </div>

      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all ${
            toast.type === "success"
              ? "bg-brand-green text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="title">岗位名称 *</Label>
                <Input
                  id="title"
                  placeholder="请输入岗位名称"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  error={errors.title}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="domain">领域 *</Label>
                  <select
                    id="domain"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                    value={formData.domain}
                    onChange={(e) => handleChange("domain", e.target.value)}
                  >
                    {DOMAIN_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="employment_type">用工类型 *</Label>
                  <select
                    id="employment_type"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                    value={formData.employment_type}
                    onChange={(e) => handleChange("employment_type", e.target.value)}
                  >
                    {EMPLOYMENT_TYPE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                  <Label>省市区 *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.province}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, province: value, city: "", district: "" }));
                        if (errors.province) setErrors((prev) => ({ ...prev, province: undefined }));
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="请选择省份" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={formData.city}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, city: value, district: "" }));
                        if (errors.city) setErrors((prev) => ({ ...prev, city: undefined }));
                      }}
                      disabled={!formData.province}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="请选择城市" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={formData.district}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, district: value }));
                        if (errors.district) setErrors((prev) => ({ ...prev, district: undefined }));
                      }}
                      disabled={!formData.city}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="请选择区县" />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map((district) => (
                          <SelectItem key={district} value={district}>
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">详细地址 *</Label>
                  <Input
                    id="location"
                    placeholder="请输入详细地址（如：张杨路500号一楼）"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    error={errors.location}
                  />
                </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="salary_min">最低薪资 *</Label>
                  <Input
                    id="salary_min"
                    type="number"
                    placeholder="0"
                    value={formData.salary_min}
                    onChange={(e) => handleChange("salary_min", e.target.value)}
                    error={errors.salary_min}
                  />
                </div>

                <div>
                  <Label htmlFor="salary_max">最高薪资 *</Label>
                  <Input
                    id="salary_max"
                    type="number"
                    placeholder="0"
                    value={formData.salary_max}
                    onChange={(e) => handleChange("salary_max", e.target.value)}
                    error={errors.salary_max}
                  />
                </div>

                <div>
                  <Label htmlFor="salary_unit">薪资单位 *</Label>
                  <select
                    id="salary_unit"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                    value={formData.salary_unit}
                    onChange={(e) => handleChange("salary_unit", e.target.value)}
                  >
                    {SALARY_UNIT_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">岗位描述 *</Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="请输入岗位描述"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  error={errors.description}
                />
              </div>

              <div>
                <Label htmlFor="requirements">任职要求 *</Label>
                <Textarea
                  id="requirements"
                  rows={4}
                  placeholder="请输入任职要求"
                  value={formData.requirements}
                  onChange={(e) => handleChange("requirements", e.target.value)}
                  error={errors.requirements}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button type="submit" className="flex-1" loading={loading}>
                  发布岗位
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}