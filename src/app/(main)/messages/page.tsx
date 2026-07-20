"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MESSAGE_TYPE_LABELS } from "@/lib/constants";
import type { Message } from "@/lib/types";
import { MessageSquare, Clock, FileText, CheckCircle, AlertCircle } from "lucide-react";

const mockMessages: Message[] = [
  {
    id: "mock-msg-1",
    sender_id: "recruiter-1",
    receiver_id: "user-1",
    type: "interview",
    title: "面试邀请",
    content: "你投递的「超市收银员」岗位已通过初筛，邀请你参加面试。面试时间：2024年1月18日 上午10:00，地点：北京市朝阳区XX路XX号",
    is_read: false,
    related_id: "mock-1",
    created_at: "2024-01-16T09:00:00Z",
  },
  {
    id: "mock-msg-2",
    sender_id: "system",
    receiver_id: "user-1",
    type: "apply",
    title: "投递成功通知",
    content: "你已成功投递「销售代表」岗位，我们会尽快处理你的申请。",
    is_read: true,
    related_id: "mock-3",
    created_at: "2024-01-15T14:30:00Z",
  },
  {
    id: "mock-msg-3",
    sender_id: "recruiter-4",
    receiver_id: "user-1",
    type: "result",
    title: "投递结果通知",
    content: "很遗憾，你的「工厂操作工」岗位申请未通过筛选。感谢你的投递，祝你早日找到合适的工作！",
    is_read: true,
    related_id: "mock-4",
    created_at: "2024-01-14T16:00:00Z",
  },
];

function getMessageIcon(type: Message["type"]) {
  switch (type) {
    case "interview":
      return Clock;
    case "apply":
      return FileText;
    case "result":
      return CheckCircle;
    case "trial":
    case "checkin":
    case "reminder":
    default:
      return AlertCircle;
  }
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMessages() {
      const supabase = createClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setMessages(mockMessages);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("receiver_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Failed to fetch messages:", error.message);
          setMessages(mockMessages);
        } else if (data && data.length > 0) {
          setMessages(data as Message[]);
        } else {
          setMessages(mockMessages);
        }
      } catch (err) {
        console.warn("Error fetching messages:", err);
        setMessages(mockMessages);
      }
      setLoading(false);
    }

    fetchMessages();
  }, []);

  if (loading) {
    return <div className="container mx-auto p-6">加载中...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-green">消息中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看通知和消息</p>
      </header>

      <div className="space-y-4">
        {messages.map((msg) => {
          const Icon = getMessageIcon(msg.type);
          return (
            <Card key={msg.id} className={!msg.is_read ? "ring-1 ring-brand-green/30" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-brand-green" />
                    <div>
                      <CardTitle className="text-base">{msg.title}</CardTitle>
                      <Badge variant="muted" className="mt-1">
                        {MESSAGE_TYPE_LABELS[msg.type]}
                      </Badge>
                    </div>
                  </div>
                  {!msg.is_read && (
                    <Badge className="bg-brand-green text-white">未读</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 mb-2">{msg.content}</p>
                <p className="text-xs text-gray-500">
                  {new Date(msg.created_at).toLocaleString("zh-CN")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {messages.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">暂无消息</p>
        </div>
      )}
    </div>
  );
}