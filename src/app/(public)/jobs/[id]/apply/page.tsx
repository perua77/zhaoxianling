"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20">加载中...</div>}>
      <ApplyPageContent />
    </Suspense>
  );
}

function ApplyPageContent() {
  const { id: jobId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: authUser, session: authSession } = useAuth();

  const mode = searchParams.get("mode") === "refer" ? "refer" : "apply";

  const [applyForm, setApplyForm] = useState({
    full_name: "",
    gender: "",
    age: "",
    phone: "",
    wechat: "",
    self_introduction: "",
  });

  const [referForm, setReferForm] = useState({
    candidate_name: "",
    candidate_phone: "",
    candidate_email: "",
    reason: "",
  });

  const [registeredPhone, setRegisteredPhone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (mode === "apply") {
      const fetchUserProfile = async () => {
        const supabase = createClient();
        let { data: { user } } = await supabase.auth.getUser();

        if (!user && authSession?.access_token) {
          await supabase.auth.setSession({
            access_token: authSession.access_token,
            refresh_token: authSession.refresh_token,
            token_type: "bearer",
            expires_in: authSession.expires_in,
            expires_at: Math.floor(Date.now() / 1000) + authSession.expires_in,
          });
          ({ data: { user } } = await supabase.auth.getUser());
        }

        // 兜底：supabase session 尚未恢复时，直接用 useAuth store 里的用户 id
        const targetUserId = user?.id || authUser?.id;

        if (targetUserId) {
          // 网络抖动容错：最多重试 3 次，避免瞬时失败导致个人信息不自动填充
          const MAX_RETRY = 3;
          for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
            try {
              const response = await fetch(`/api/profile?user_id=${targetUserId}`);
              const result = await response.json();

              if (result.success && result.data) {
                const profile = result.data;
                setRegisteredPhone(profile.phone || null);
                setApplyForm((prev) => ({
                  ...prev,
                  full_name: profile.full_name || "",
                  gender: profile.gender || "",
                  age: profile.age?.toString() || "",
                  phone: profile.phone || "",
                  self_introduction: profile.bio || "",
                  wechat: prev.wechat || profile.wechat || "",
                }));
              }
              break;
            } catch (err) {
              console.error(`Failed to fetch profile (attempt ${attempt}):`, err);
              if (attempt < MAX_RETRY) {
                await new Promise((r) => setTimeout(r, attempt * 400));
              }
            }
          }
        }
      }

      fetchUserProfile();
    }
  }, [mode, authSession, authUser]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const supabase = createClient();
    
    if (!authUser || !authSession) {
      setMessage({ type: "error", text: "请先登录后再投递" });
      setSubmitting(false);
      return;
    }

    let { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      if (authSession.access_token) {
        await supabase.auth.setSession({
          access_token: authSession.access_token,
          refresh_token: authSession.refresh_token,
          token_type: "bearer",
          expires_in: authSession.expires_in,
          expires_at: Math.floor(Date.now() / 1000) + authSession.expires_in,
        });
        ({ data: { user } } = await supabase.auth.getUser());
        if (!user) {
          setMessage({ type: "error", text: "请先登录后再投递" });
          setSubmitting(false);
          return;
        }
      } else {
        setMessage({ type: "error", text: "请先登录后再投递" });
        setSubmitting(false);
        return;
      }
    }

    if (registeredPhone && applyForm.phone !== registeredPhone) {
      setMessage({ type: "error", text: "电话必须与注册时填写的号码一致" });
      setSubmitting(false);
      return;
    }

    const wechatTrimmed = applyForm.wechat.trim();
    if (!wechatTrimmed) {
      setMessage({ type: "error", text: "请填写微信号" });
      setSubmitting(false);
      return;
    }
    if (wechatTrimmed.length < 3 || wechatTrimmed.length > 30) {
      setMessage({ type: "error", text: "微信号长度需为 3-30 个字符" });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("applications").insert({
      job_id: jobId,
      candidate_id: user.id,
      full_name: applyForm.full_name,
      gender: applyForm.gender,
      age: applyForm.age ? parseInt(applyForm.age) : null,
      phone: applyForm.phone,
      wechat: wechatTrimmed,
      self_introduction: applyForm.self_introduction,
      status: "pending",
    });

    if (error) {
      setMessage({ type: "error", text: "投递失败：" + error.message });
    } else {
      try {
        const { data: jobData } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", jobId)
          .single();
        
        if (jobData) {
          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient_id: user.id,
              type: "apply",
              title: "投递成功通知",
              content: `你已成功投递「${jobData.title}」岗位，我们会尽快处理你的申请。`,
            }),
          });
        }
      } catch (msgError) {
        console.error("Failed to send message:", msgError);
      }
      
      setMessage({ type: "success", text: "投递成功！我们会尽快处理你的投递" });
      setTimeout(() => {
        router.push("/profile");
      }, 2000);
    }

    setSubmitting(false);
  };

  const handleReferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const supabase = createClient();
    
    if (!authUser || !authSession) {
      setMessage({ type: "error", text: "请先登录后再推荐" });
      setSubmitting(false);
      return;
    }

    let { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      if (authSession.access_token) {
        await supabase.auth.setSession({
          access_token: authSession.access_token,
          refresh_token: authSession.refresh_token,
          token_type: "bearer",
          expires_in: authSession.expires_in,
          expires_at: Math.floor(Date.now() / 1000) + authSession.expires_in,
        });
        ({ data: { user } } = await supabase.auth.getUser());
        if (!user) {
          setMessage({ type: "error", text: "请先登录后再推荐" });
          setSubmitting(false);
          return;
        }
      } else {
        setMessage({ type: "error", text: "请先登录后再推荐" });
        setSubmitting(false);
        return;
      }
    }

    let candidateId: string | null = null;
    let candidateName = referForm.candidate_name;

    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("phone", referForm.candidate_phone)
        .single();

      if (profiles) {
        candidateId = profiles.id;
        candidateName = profiles.full_name || referForm.candidate_name;
      }
    } catch (err) {
      console.log("Candidate not registered yet");
    }

    const { data: referral, error: referralError } = await supabase
      .from("referrals")
      .insert({
        referrer_id: user.id,
        candidate_id: candidateId,
        candidate_name: candidateName,
        candidate_phone: referForm.candidate_phone,
        job_id: jobId,
        status: "referred",
        reason: referForm.reason,
      })
      .select("id")
      .single();

    if (referralError || !referral) {
      setMessage({ type: "error", text: "推荐失败：" + (referralError?.message || "创建推荐记录失败") });
      setSubmitting(false);
      return;
    }

    const referralId = referral.id;

    let applicationId: string | null = null;

    if (candidateId) {
      const { data: existingApps } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", jobId)
        .eq("candidate_id", candidateId)
        .limit(1);

      if (!existingApps || existingApps.length === 0) {
        const { data: newApp, error: appError } = await supabase
          .from("applications")
          .insert({
            job_id: jobId,
            candidate_id: candidateId,
            full_name: candidateName,
            phone: referForm.candidate_phone,
            status: "pending",
            referrer_id: user.id,
          })
          .select("id")
          .single();

        if (newApp) {
          applicationId = newApp.id;
        }
      } else if (existingApps.length > 0) {
        applicationId = existingApps[0].id;
      }
    }

    if (applicationId) {
      const { error: updateError } = await supabase
        .from("referrals")
        .update({ application_id: applicationId })
        .eq("id", referralId);

      if (updateError) {
        console.error("Failed to update referral with application_id:", updateError);
      }
    }

    setMessage({
      type: "success",
      text: candidateId
        ? "推荐成功！候选人已有账号，已自动创建投递记录"
        : "推荐成功！候选人尚未注册，TA注册后将自动关联",
    });

    setTimeout(() => {
      router.push("/recruiter/referrals");
    }, 2000);

    setSubmitting(false);
  };

  if (mode === "refer") {
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
            <CardTitle className="text-2xl">推荐候选人</CardTitle>
            <p className="text-gray-500 text-sm mt-1">
              请填写候选人的基本信息，推荐成功后可在"我的推荐"中追踪进度
            </p>
          </CardHeader>
          <CardContent>
            {message && (
              <div className={`rounded-lg px-4 py-3 mb-4 ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleReferSubmit} className="space-y-4">
              <div>
                <Label htmlFor="candidate_name">候选人姓名 *</Label>
                <Input
                  id="candidate_name"
                  required
                  value={referForm.candidate_name}
                  onChange={(e) => setReferForm({ ...referForm, candidate_name: e.target.value })}
                  placeholder="请输入候选人姓名"
                />
              </div>

              <div>
                <Label htmlFor="candidate_phone">候选人手机号 *</Label>
                <Input
                  id="candidate_phone"
                  type="tel"
                  required
                  value={referForm.candidate_phone}
                  onChange={(e) => setReferForm({ ...referForm, candidate_phone: e.target.value })}
                  placeholder="请输入候选人手机号"
                />
              </div>

              <div>
                <Label htmlFor="candidate_email">候选人邮箱</Label>
                <Input
                  id="candidate_email"
                  type="email"
                  value={referForm.candidate_email}
                  onChange={(e) => setReferForm({ ...referForm, candidate_email: e.target.value })}
                  placeholder="请输入候选人邮箱（可选）"
                />
              </div>

              <div>
                <Label htmlFor="reason">推荐理由</Label>
                <Textarea
                  id="reason"
                  value={referForm.reason}
                  onChange={(e) => setReferForm({ ...referForm, reason: e.target.value })}
                  placeholder="请简要说明推荐理由（可选）"
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                variant="primary"
                className="w-full"
              >
                {submitting ? "提交中..." : "提交推荐"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

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

          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">姓名 *</Label>
              <Input
                id="full_name"
                required
                value={applyForm.full_name}
                onChange={(e) => setApplyForm({ ...applyForm, full_name: e.target.value })}
                placeholder="请输入你的姓名"
              />
            </div>

            <div>
              <Label>性别</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setApplyForm({ ...applyForm, gender: "male" })}
                  className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                    applyForm.gender === "male"
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-muted-foreground hover:border-brand-green/30"
                  }`}
                >
                  男
                </button>
                <button
                  type="button"
                  onClick={() => setApplyForm({ ...applyForm, gender: "female" })}
                  className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                    applyForm.gender === "female"
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-muted-foreground hover:border-brand-green/30"
                  }`}
                >
                  女
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="age">年龄</Label>
              <Input
                id="age"
                type="number"
                value={applyForm.age}
                onChange={(e) => setApplyForm({ ...applyForm, age: e.target.value })}
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
                value={applyForm.phone}
                onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                placeholder="请输入你的手机号"
                className={registeredPhone && applyForm.phone !== registeredPhone ? "border-red-500 focus:ring-red-500" : ""}
              />
              {registeredPhone && applyForm.phone && applyForm.phone !== registeredPhone && (
                <p className="mt-1 text-sm text-red-500">电话必须与注册时填写的号码一致</p>
              )}
            </div>

            <div>
              <Label htmlFor="wechat">微信号 *</Label>
              <Input
                id="wechat"
                type="text"
                required
                value={applyForm.wechat}
                onChange={(e) => setApplyForm({ ...applyForm, wechat: e.target.value })}
                placeholder="请输入微信号，方便招聘者联系您"
                maxLength={30}
              />
            </div>

            <div>
              <Label htmlFor="self_introduction">个人简介 *</Label>
              <Textarea
                id="self_introduction"
                required
                value={applyForm.self_introduction}
                onChange={(e) => setApplyForm({ ...applyForm, self_introduction: e.target.value })}
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