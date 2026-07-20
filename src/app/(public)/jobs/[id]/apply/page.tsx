"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ApplyPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const router = useRouter();

  const [formData, setFormData] = useState({
    full_name: "",
    gender: "",
    age: "",
    phone: "",
    self_introduction: "",
  });
  const [registeredPhone, setRegisteredPhone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchUserProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          const response = await fetch(`/api/profile?user_id=${user.id}`);
          const result = await response.json();

          if (result.success && result.data) {
            const profile = result.data;
            setRegisteredPhone(profile.phone || null);
            setFormData({
              full_name: profile.full_name || "",
              gender: profile.gender || "",
              age: profile.age?.toString() || "",
              phone: profile.phone || "",
              self_introduction: profile.bio || "",
            });
          }
        } catch (err) {
          console.error("Failed to fetch profile:", err);
        }
      }
    }

    fetchUserProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setMessage({ type: "error", text: "请先登录后再投递" });
      setSubmitting(false);
      return;
    }

    if (registeredPhone && formData.phone !== registeredPhone) {
      setMessage({ type: "error", text: "电话必须与注册时填写的号码一致" });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("applications").insert({
      job_id: jobId,
      candidate_id: user.id,
      full_name: formData.full_name,
      gender: formData.gender,
      age: formData.age ? parseInt(formData.age) : null,
      phone: formData.phone,
      self_introduction: formData.self_introduction,
      status: "pending",
    });

    if (error) {
      setMessage({ type: "error", text: "投递失败：" + error.message });
    } else {
      setMessage({ type: "success", text: "投递成功！我们会尽快处理你的投递" });
      setTimeout(() => {
        router.push("/my-applications");
      }, 2000);
    }

    setSubmitting(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Link
        href={`/jobs/${jobId}`}
        className="mb-4 inline-flex items-center text-muted-foreground hover:text-brand-green transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回岗位详情
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">投递岗位</CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <div className={`rounded-lg px-4 py-3 mb-4 ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">姓名 *</Label>
              <Input
                id="full_name"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="请输入你的姓名"
              />
            </div>

            <div>
              <Label>性别</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: "male" })}
                  className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                    formData.gender === "male"
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-muted-foreground hover:border-brand-green/30"
                  }`}
                >
                  男
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: "female" })}
                  className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                    formData.gender === "female"
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-muted-foreground hover:border-brand-green/30"
                  }`}
                >
                  女
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: "" })}
                  className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                    formData.gender === ""
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-muted-foreground hover:border-brand-green/30"
                  }`}
                >
                  保密
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="age">年龄</Label>
              <Input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="请输入年龄"
                min={1}
                max={120}
              />
            </div>

            <div>
              <Label htmlFor="phone">
                电话 *
                {registeredPhone && (
                  <span className="ml-2 text-sm text-muted-foreground">(注册号码)</span>
                )}
              </Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="请输入你的手机号"
                className={registeredPhone && formData.phone !== registeredPhone ? "border-red-500 focus:ring-red-500" : ""}
              />
              {registeredPhone && formData.phone && formData.phone !== registeredPhone && (
                <p className="mt-1 text-sm text-red-500">电话必须与注册时填写的号码一致</p>
              )}
            </div>

            <div>
              <Label htmlFor="self_introduction">个人简介 *</Label>
              <Textarea
                id="self_introduction"
                required
                value={formData.self_introduction}
                onChange={(e) => setFormData({ ...formData, self_introduction: e.target.value })}
                placeholder="简单介绍一下你自己，包括工作经历、技能特长等"
                rows={6}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              variant="primary"
              className="w-full"
            >
              {submitting ? "提交中..." : "提交投递"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}