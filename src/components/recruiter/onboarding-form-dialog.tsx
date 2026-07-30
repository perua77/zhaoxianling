"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/hooks/useAuth";

interface StaffOption {
  id: string;
  full_name: string;
  phone: string;
}

type ContactMode = "select" | "manual";

export interface OnboardingFormPayload {
  onboard_date: string;
  onboard_location: string;
  contact_person: string;
  contact_phone: string;
  onboard_notes: string;
}

interface OnboardingFormDialogProps {
  open: boolean;
  title?: string;
  candidateName?: string;
  submitting?: boolean;
  /** 编辑模式下的初始值 */
  initialValue?: Partial<OnboardingFormPayload>;
  onClose: () => void;
  onConfirm: (payload: OnboardingFormPayload) => void;
}

const EMPTY: OnboardingFormPayload = {
  onboard_date: "",
  onboard_location: "",
  contact_person: "",
  contact_phone: "",
  onboard_notes: "",
};

export function OnboardingFormDialog({
  open,
  title = "填写入职信息",
  candidateName,
  submitting = false,
  initialValue,
  onClose,
  onConfirm,
}: OnboardingFormDialogProps) {
  const { userId } = useAuth();
  const [form, setForm] = useState<OnboardingFormPayload>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [contactMode, setContactMode] = useState<ContactMode>("select");
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [staffSearch, setStaffSearch] = useState("");

  // 打开时用初始值填充
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...initialValue });
      setError(null);
      setStaffSearch("");
      // 编辑模式(已有联系人)默认手动模式,新建默认选择模式
      setContactMode(initialValue?.contact_person ? "manual" : "select");
    }
  }, [open, initialValue]);

  // 拉取管理端账号(非纯 candidate)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStaffLoading(true);
    fetch("/api/recruiter/users")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && Array.isArray(json.data)) {
          setStaffList(
            json.data.map((u: { id: string; full_name: string; phone: string }) => ({
              id: u.id,
              full_name: u.full_name || "",
              phone: u.phone || "",
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStaffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 默认选中当前登录用户(仅选择模式且未手动选过时)
  useEffect(() => {
    if (
      open &&
      contactMode === "select" &&
      !selectedStaffId &&
      !initialValue?.contact_person &&
      userId &&
      staffList.some((s) => s.id === userId)
    ) {
      const me = staffList.find((s) => s.id === userId);
      if (me) {
        setSelectedStaffId(me.id);
        setForm((prev) => ({
          ...prev,
          contact_person: me.full_name,
          contact_phone: me.phone,
        }));
      }
    }
  }, [open, contactMode, selectedStaffId, staffList, userId, initialValue]);

  const filteredStaff = useMemo(() => {
    const kw = staffSearch.trim().toLowerCase();
    if (!kw) return staffList;
    return staffList.filter(
      (s) =>
        s.full_name.toLowerCase().includes(kw) || s.phone.includes(kw)
    );
  }, [staffList, staffSearch]);

  const switchMode = (mode: ContactMode) => {
    if (mode === contactMode) return;
    setContactMode(mode);
    // 切换时清空联系人内容
    setSelectedStaffId("");
    setStaffSearch("");
    setForm((prev) => ({ ...prev, contact_person: "", contact_phone: "" }));
  };

  const handleSelectStaff = (id: string) => {
    setSelectedStaffId(id);
    const s = staffList.find((x) => x.id === id);
    if (s) {
      setForm((prev) => ({
        ...prev,
        contact_person: s.full_name,
        contact_phone: s.phone,
      }));
    }
  };

  if (!open) return null;

  const today = new Date().toISOString().slice(0, 10);
  const isPastDate = form.onboard_date !== "" && form.onboard_date < today;

  const handleSubmit = () => {
    if (!form.onboard_date) {
      setError("请填写入职日期");
      return;
    }
    if (!form.onboard_location.trim()) {
      setError("请填写入职地点");
      return;
    }
    if (!form.contact_person.trim()) {
      setError("请填写联系人");
      return;
    }
    if (!form.contact_phone.trim()) {
      setError("请填写联系人电话");
      return;
    }
    setError(null);
    onConfirm({
      onboard_date: form.onboard_date,
      onboard_location: form.onboard_location.trim(),
      contact_person: form.contact_person.trim(),
      contact_phone: form.contact_phone.trim(),
      onboard_notes: form.onboard_notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-1">{title}</h3>
        {candidateName && (
          <p className="text-gray-600 mb-4">为 {candidateName} 安排入职</p>
        )}
        <div className="space-y-4">
          <div>
            <Label htmlFor="onboard_date">
              入职日期 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="onboard_date"
              type="date"
              value={form.onboard_date}
              onChange={(e) => setForm({ ...form, onboard_date: e.target.value })}
            />
            {isPastDate && (
              <p className="text-xs text-amber-600 mt-1">
                所选日期已过去，请确认是否正确。
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="onboard_location">
              入职地点 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="onboard_location"
              value={form.onboard_location}
              onChange={(e) => setForm({ ...form, onboard_location: e.target.value })}
              placeholder="如:北京市朝阳区XX大厦8层"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                入职联系人 <span className="text-red-500">*</span>
              </Label>
              <div className="flex rounded-md border border-gray-200 text-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => switchMode("select")}
                  className={`px-3 py-1 ${
                    contactMode === "select"
                      ? "bg-brand-green text-white"
                      : "bg-white text-gray-600"
                  }`}
                >
                  从账号选择
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("manual")}
                  className={`px-3 py-1 ${
                    contactMode === "manual"
                      ? "bg-brand-green text-white"
                      : "bg-white text-gray-600"
                  }`}
                >
                  手动输入
                </button>
              </div>
            </div>

            {contactMode === "select" ? (
              <div className="space-y-2">
                <Input
                  placeholder="搜索姓名或手机号"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 divide-y">
                  {staffLoading ? (
                    <p className="px-3 py-2 text-sm text-gray-400">加载中...</p>
                  ) : filteredStaff.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-400">无匹配账号</p>
                  ) : (
                    filteredStaff.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectStaff(s.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          selectedStaffId === s.id ? "bg-brand-green/10" : ""
                        }`}
                      >
                        <span className="font-medium">{s.full_name || "(未填写姓名)"}</span>
                        <span className="text-gray-400 ml-2">{s.phone || "(无手机号)"}</span>
                      </button>
                    ))
                  )}
                </div>
                {form.contact_person && (
              <p className="text-xs text-brand-green">
                    已选择：{form.contact_person} {form.contact_phone}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="contact_person">
                    联系人 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact_person"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    placeholder="如:HR王女士"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone">
                    联系人电话 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact_phone"
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                    placeholder="如:13800000000"
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="onboard_notes">入职须知(选填)</Label>
            <Textarea
              id="onboard_notes"
              rows={3}
              value={form.onboard_notes}
              onChange={(e) => setForm({ ...form, onboard_notes: e.target.value })}
              placeholder="携带材料、报到流程等提示信息"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? "提交中..." : "确认"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}