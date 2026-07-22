"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { User, Phone, Edit2, Save } from "lucide-react";

export default function ProfilePage() {
  const { user, profile, role, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    gender: "",
    age: "",
    phone: "",
    bio: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isEditing && profile) {
      setFormData({
        full_name: profile.full_name || "",
        gender: profile.gender || "",
        age: profile.age?.toString() || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
      });
    }
  }, [profile, isEditing]);

  const handleSave = async () => {
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user?.id,
          full_name: formData.full_name,
          gender: formData.gender,
          age: formData.age ? parseInt(formData.age) : null,
          phone: formData.phone,
          bio: formData.bio,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: "success", text: "保存成功" });
        setIsEditing(false);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error?.message || "保存失败" });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "保存失败" });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <div className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-green">个人中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理你的个人信息</p>
      </header>

      <Card className="mb-4">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-brand-green/10 flex items-center justify-center">
                <User className="h-8 w-8 text-brand-green" />
              </div>
              <div>
                <CardTitle>{profile?.full_name || user?.email || "用户"}</CardTitle>
                <Badge variant="brand-green">
                  {role ? USER_ROLE_LABELS[role] : "候选人"}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? <Save className="h-4 w-4 mr-1" /> : <Edit2 className="h-4 w-4 mr-1" />}
              {isEditing ? "保存" : "编辑"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {message && (
            <div className={`rounded-lg px-4 py-3 mb-4 ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                姓名
              </Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                disabled={!isEditing}
                className="mt-1"
                placeholder="请输入姓名"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                性别
              </Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: "male" })}
                  disabled={!isEditing}
                  className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                    formData.gender === "male"
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-muted-foreground hover:border-brand-green/30"
                  } ${!isEditing ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  男
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: "female" })}
                  disabled={!isEditing}
                  className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                    formData.gender === "female"
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-muted-foreground hover:border-brand-green/30"
                  } ${!isEditing ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  女
                </button>
              </div>
            </div>

            <div>
              <Label>年龄</Label>
              <Input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                disabled={!isEditing}
                className="mt-1"
                placeholder="请输入年龄"
                min={1}
                max={120}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                手机号
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                className="mt-1"
                placeholder="请输入手机号"
              />
            </div>

            <div>
              <Label>个人简介</Label>
              <textarea
                value={formData.bio || ""}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!isEditing}
                placeholder="简单介绍一下你自己"
                rows={4}
                className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {isEditing && (
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                取消
              </Button>
              <Button onClick={handleSave}>保存</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}